#!/usr/bin/env node
import { createHash, generateKeyPairSync, randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';

const { values } = parseArgs({
  options: {
    name: { type: 'string' },
    url: { type: 'string' },
    output: { type: 'string' },
  },
});
if (
  !values.name ||
  values.name.trim().length > 80 ||
  /[\r\n]/.test(values.name) ||
  !values.url ||
  !values.output
) {
  throw new Error(
    'Usage: node scripts/cross-server-identity.mjs --name "站点名称" --url https://example.com/api/cross-server/v1 --output env/cross-server.env',
  );
}
const url = new URL(values.url);
if (
  url.protocol !== 'https:' ||
  url.username ||
  url.password ||
  url.search ||
  url.hash ||
  !/^\/[A-Za-z0-9/_-]*$/.test(url.pathname)
) {
  throw new Error(
    'The public federation URL must use HTTPS without credentials, a query or a fragment',
  );
}
const { publicKey, privateKey } = generateKeyPairSync('ed25519');
const secret = privateKey
  .export({ format: 'der', type: 'pkcs8' })
  .toString('base64');
const publicDer = publicKey.export({ format: 'der', type: 'spki' });
const siteId = randomUUID();
const output = resolve(values.output);
writeFileSync(
  output,
  [
    '# Keep this identity private and stable across upgrades. Do not commit this file.',
    'CROSS_SERVER_ENABLED=true',
    `CROSS_SERVER_SITE_ID=${siteId}`,
    `CROSS_SERVER_NAME=${JSON.stringify(values.name.trim())}`,
    `CROSS_SERVER_API_BASE_URL=${url.toString().replace(/\/$/, '')}`,
    `CROSS_SERVER_PRIVATE_KEY=${secret}`,
    'CROSS_SERVER_ALLOW_LOCALHOST=false',
    '',
  ].join('\n'),
  { flag: 'wx', mode: 0o600 },
);
console.log(`Identity saved: ${output}`);
console.log(`Site ID: ${siteId}`);
console.log(
  `Public key fingerprint (SHA-256): ${createHash('sha256').update(publicDer).digest('hex')}`,
);
