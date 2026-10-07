import type { CrossServerManifest } from '@daoyou/contracts/cross-server';
import {
  CROSS_SERVER_ADAPTER,
  CROSS_SERVER_PROTOCOL,
} from '@daoyou/contracts/cross-server';
import {
  createHash,
  createPrivateKey,
  createPublicKey,
  type KeyObject,
} from 'node:crypto';
import { readFileSync, realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative } from 'node:path';
import type { AppConfigService } from '../config/app-config.service.js';

export const sha256 = (value: string | Uint8Array) =>
  createHash('sha256').update(value).digest('hex');
export const keyFingerprint = (publicKey: string) =>
  sha256(Buffer.from(publicKey, 'base64'));
export function publicKeyObject(publicKey: string) {
  const key = createPublicKey({
    key: Buffer.from(publicKey, 'base64'),
    format: 'der',
    type: 'spki',
  });
  if (key.asymmetricKeyType !== 'ed25519')
    throw new Error('Only Ed25519 keys are supported');
  return key;
}

// Hash the compiled combat dependency closure, independent of API/UI revisions.
function combatRuntimeHash() {
  const files = new Map<string, string>();
  const seen = new Set<string>();
  function visit(filename: string) {
    const file = realpathSync(filename);
    if (seen.has(file)) return;
    seen.add(file);
    let root = dirname(file);
    while (!readable(join(root, 'package.json'))) {
      const parent = dirname(root);
      if (parent === root) throw new Error('Missing combat package metadata');
      root = parent;
    }
    const pkg = JSON.parse(
      readFileSync(join(root, 'package.json'), 'utf8'),
    ) as { name: string };
    if (!pkg.name.startsWith('@daoyou/')) return;
    const name = `${pkg.name}/${relative(root, file).replaceAll('\\', '/')}`;
    const source = readFileSync(file, 'utf8');
    if (files.has(name) && files.get(name) !== source)
      throw new Error('Inconsistent compiled combat libraries');
    files.set(name, source);
    if (!file.endsWith('.js')) return;
    const require = createRequire(file);
    const imports =
      /(?:\bfrom\s*|\bimport\s*|\bimport\s*\()\s*['"]([^'"]+)['"]/g;
    for (const match of source.matchAll(imports)) {
      if (match[1].startsWith('.') || match[1].startsWith('@daoyou/'))
        visit(require.resolve(match[1]));
    }
  }
  const require = createRequire(import.meta.url);
  visit(require.resolve('@daoyou/game-rules/combat/cross-server'));
  const hash = createHash('sha256');
  for (const [name, source] of [...files].sort(([a], [b]) =>
    a < b ? -1 : a > b ? 1 : 0,
  ))
    hash.update(`${name}\0${source}\0`);
  return hash.digest('hex');
}
function readable(path: string) {
  try {
    readFileSync(path);
    return true;
  } catch {
    return false;
  }
}

export type CrossServerIdentity = {
  privateKey: KeyObject;
  manifest: CrossServerManifest;
};
export function createCrossServerIdentity(
  config: AppConfigService,
): CrossServerIdentity | null {
  if (config.get('CROSS_SERVER_ENABLED') !== 'true') return null;
  const privateKey = createPrivateKey({
    key: Buffer.from(config.get('CROSS_SERVER_PRIVATE_KEY')!, 'base64'),
    format: 'der',
    type: 'pkcs8',
  });
  if (privateKey.asymmetricKeyType !== 'ed25519')
    throw new Error('Cross-server identity must be Ed25519');
  const publicKey = createPublicKey(privateKey)
    .export({ type: 'spki', format: 'der' })
    .toString('base64');
  return {
    privateKey,
    manifest: {
      protocol: CROSS_SERVER_PROTOCOL,
      adapter: CROSS_SERVER_ADAPTER,
      siteId: config.get('CROSS_SERVER_SITE_ID')!,
      name: config.get('CROSS_SERVER_NAME')!,
      apiBaseUrl: config.get('CROSS_SERVER_API_BASE_URL')!.replace(/\/$/, ''),
      publicKey,
      combatHash: combatRuntimeHash(),
    },
  };
}

export function namespacedCombatId(siteId: string, id: string) {
  const digest = sha256(`${CROSS_SERVER_PROTOCOL}\0${siteId}\0${id}`);
  return `${digest.slice(0, 8)}-${digest.slice(8, 12)}-5${digest.slice(13, 16)}-a${digest.slice(17, 20)}-${digest.slice(20, 32)}`;
}
