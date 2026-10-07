import type { Context } from 'hono';
import { getConnInfo } from 'hono/bun';
import { isIP } from 'node:net';

/** Only addresses, never ports, lists, zones or arbitrary header text. */
export function normalizeIp(value?: string | null): string | undefined {
  const address = value?.trim();
  if (!address || address.includes('%') || !isIP(address)) return undefined;
  if (isIP(address) === 4) return address;
  const canonical = new URL(`http://[${address}]/`).hostname.slice(1, -1);
  // IPv4-mapped IPv6 must share the IPv4 rate-limit bucket.
  const mapped = /^::ffff:([\da-f]+):([\da-f]+)$/.exec(canonical);
  if (mapped) {
    const high = Number.parseInt(mapped[1], 16);
    const low = Number.parseInt(mapped[2], 16);
    return `${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`;
  }
  return canonical;
}

export function resolveRequestIp(
  peerAddress: string | undefined,
  realIp: string | undefined,
  trustedProxyIps = process.env.TRUSTED_PROXY_IPS ?? '',
): string | undefined {
  const peer = normalizeIp(peerAddress);
  if (!peer) return undefined;
  const trusted = trustedProxyIps
    .split(',')
    .some((ip) => normalizeIp(ip) === peer);
  // The trusted edge must OVERWRITE X-Real-IP. Never trust CF/Forwarded/XFF.
  return trusted ? (normalizeIp(realIp) ?? peer) : peer;
}

export function getRequestIp(context: Context): string | undefined {
  let peer: string | undefined;
  try {
    peer = getConnInfo(context).remote.address;
  } catch {
    // Fetch-only callers have no socket. Callers must not bypass limits for this.
    return undefined;
  }
  return resolveRequestIp(peer, context.req.header('x-real-ip'));
}
