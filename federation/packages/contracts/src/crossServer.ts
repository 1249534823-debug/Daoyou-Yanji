import type { CrossServerCombatBuild } from '@daoyou/game-domain/combat/cross-server';
import { z } from 'zod';

export const CROSS_SERVER_PROTOCOL = 'wanjie-federation-v1' as const;
export const CROSS_SERVER_ADAPTER = 'daoyou-v6-auto-v1' as const;
export const CROSS_SERVER_BODY_LIMIT = 256 * 1024;
export const CROSS_SERVER_CLOCK_SKEW_SECONDS = 300;
export const CROSS_SERVER_INVITE_TTL_MS = 15 * 60 * 1000;

// Only facts needed by the full-resource sparring projection leave the home site.
export type CrossServerBuild = CrossServerCombatBuild;

const digest = z.string().regex(/^[a-f0-9]{64}$/);
export const CrossServerIdSchema = z.uuid();
export const CrossServerManifestSchema = z.strictObject({
  protocol: z.literal(CROSS_SERVER_PROTOCOL),
  adapter: z.literal(CROSS_SERVER_ADAPTER),
  siteId: CrossServerIdSchema,
  name: z.string().trim().min(1).max(80),
  apiBaseUrl: z.url().max(300),
  publicKey: z
    .string()
    .regex(/^[A-Za-z0-9+/]+={0,2}$/)
    .max(256),
  combatHash: digest,
});
export type CrossServerManifest = z.infer<typeof CrossServerManifestSchema>;

export const CrossServerPublicPlayerSchema = z.strictObject({
  id: CrossServerIdSchema,
  name: z.string().min(1).max(100),
  realm: z.string().min(1).max(30),
  realmStage: z.string().min(1).max(30),
});
export type CrossServerPublicPlayer = z.infer<
  typeof CrossServerPublicPlayerSchema
>;
export const CrossServerDirectorySchema = z.strictObject({
  players: z.array(CrossServerPublicPlayerSchema).max(20),
  nextCursor: CrossServerIdSchema.nullable(),
});

export const CROSS_SERVER_TERMINAL_STATES = [
  'completed',
  'declined',
  'cancelled',
  'expired',
] as const;
export type CrossServerStatus =
  'sending' | 'pending' | (typeof CROSS_SERVER_TERMINAL_STATES)[number];
export const CrossServerCreateSchema = z.strictObject({
  requestId: CrossServerIdSchema,
  peerId: CrossServerIdSchema,
  targetId: CrossServerIdSchema,
});
export const CrossServerProfileSchema = z.strictObject({
  enabled: z.boolean(),
});
export const CrossServerInspectSchema = z.strictObject({
  url: z.url().max(300),
});
export const CrossServerRegisterSchema = z.strictObject({
  manifest: CrossServerManifestSchema,
  fingerprint: digest,
});
export const CrossServerPeerPatchSchema = z.strictObject({
  enabled: z.boolean(),
});

export function createCrossServerWireSchemas(
  build: z.ZodType<CrossServerBuild>,
) {
  const invitation = z.strictObject({
    id: CrossServerIdSchema,
    combatHash: digest,
    targetId: CrossServerIdSchema,
    expiresAt: z.iso.datetime(),
    challenger: build,
  });
  const result = z.strictObject({
    defender: build,
    battleDigest: digest,
    winner: z.union([z.literal(0), z.literal(1), z.literal('draw')]),
    roundCount: z.number().int().min(1).max(201),
    finishedAt: z.iso.datetime(),
  });
  const receipt = z
    .strictObject({
      id: CrossServerIdSchema,
      status: z.enum(['pending', ...CROSS_SERVER_TERMINAL_STATES]),
      defender: CrossServerPublicPlayerSchema,
      result: result.optional(),
    })
    .refine(
      (v) => (v.status === 'completed') === !!v.result,
      'Only completed challenges contain a result',
    );
  const lookup = z.union([
    receipt,
    z.strictObject({
      id: CrossServerIdSchema,
      status: z.literal('missing'),
      seenAt: z.iso.datetime(),
    }),
  ]);
  return { invitation, result, receipt, lookup };
}
export type CrossServerInvitation = {
  id: string;
  combatHash: string;
  targetId: string;
  expiresAt: string;
  challenger: CrossServerBuild;
};
export type CrossServerResult = {
  defender: CrossServerBuild;
  battleDigest: string;
  winner: 0 | 1 | 'draw';
  roundCount: number;
  finishedAt: string;
};
export type CrossServerReceipt = {
  id: string;
  status: Exclude<CrossServerStatus, 'sending'>;
  defender: CrossServerPublicPlayer;
  result?: CrossServerResult;
};
export type CrossServerPeerView = {
  siteId: string;
  name: string;
  enabled: boolean;
  compatible: boolean;
  apiBaseUrl: string;
  fingerprint: string;
  lastError: string | null;
  checkedAt: string | null;
};
export type CrossServerChallengeView = {
  id: string;
  peerId: string;
  peerName: string;
  direction: 'incoming' | 'outgoing';
  opponentName: string;
  status: CrossServerStatus;
  expiresAt: string;
  createdAt: string;
  lastError: string | null;
  outcome: 'victory' | 'defeat' | 'draw' | null;
  roundCount: number | null;
};
export type CrossServerState = {
  configured: boolean;
  profileEnabled: boolean;
  peers: CrossServerPeerView[];
  challenges: CrossServerChallengeView[];
};

export function canonicalCrossServerJson(value: unknown, depth = 0): string {
  if (depth > 64) throw new Error('Cross-server JSON nesting limit exceeded');
  if (value === null || typeof value === 'boolean' || typeof value === 'string')
    return JSON.stringify(value);
  if (typeof value === 'number' && Number.isFinite(value))
    return JSON.stringify(value);
  if (Array.isArray(value))
    return `[${value.map((item) => canonicalCrossServerJson(item, depth + 1)).join(',')}]`;
  if (
    typeof value === 'object' &&
    Object.getPrototypeOf(value) === Object.prototype
  ) {
    return `{${Object.keys(value)
      .sort()
      .filter((k) => (value as Record<string, unknown>)[k] !== undefined)
      .map(
        (k) =>
          `${JSON.stringify(k)}:${canonicalCrossServerJson((value as Record<string, unknown>)[k], depth + 1)}`,
      )
      .join(',')}}`;
  }
  throw new Error('Unsupported cross-server JSON value');
}

export function crossServerRequestMessage(input: {
  method: string;
  path: string;
  sender: string;
  audience: string;
  timestamp: string;
  nonce: string;
  bodyHash: string;
}) {
  return [
    CROSS_SERVER_PROTOCOL,
    'request',
    input.method,
    input.path,
    input.sender,
    input.audience,
    input.timestamp,
    input.nonce,
    input.bodyHash,
  ].join('\n');
}
export function crossServerResponseMessage(input: {
  sender: string;
  audience: string;
  nonce: string;
  path: string;
  payloadHash: string;
}) {
  return [
    CROSS_SERVER_PROTOCOL,
    'response',
    input.sender,
    input.audience,
    input.nonce,
    input.path,
    input.payloadHash,
  ].join('\n');
}

// Conservatively allow public unicast only. DNS is pinned by the API transport.
export function isPublicCrossServerAddress(address: string): boolean {
  if (address.includes(':')) {
    const lower = address.toLowerCase();
    const halves = lower.split('::');
    if (halves.length > 2) return false;
    const left = halves[0] ? halves[0].split(':') : [];
    const right = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
    const groups = [...left, ...right];
    if (
      groups.some((group) => !/^[0-9a-f]{1,4}$/.test(group)) ||
      (halves.length === 1 ? groups.length !== 8 : groups.length >= 8)
    )
      return false;
    const expanded =
      halves.length === 1
        ? groups
        : [...left, ...Array<string>(8 - groups.length).fill('0'), ...right];
    const [first, second] = expanded.map((group) => Number.parseInt(group, 16));
    return (
      first >= 0x2000 &&
      first <= 0x3fff &&
      first !== 0x2002 &&
      first !== 0x3fff &&
      !(first === 0x2001 && (second <= 0x1ff || second === 0xdb8))
    );
  }
  const parts = address.split('.');
  if (
    parts.length !== 4 ||
    parts.some((p) => !/^(?:0|[1-9]\d{0,2})$/.test(p) || Number(p) > 255)
  )
    return false;
  const [a, b, c] = parts.map(Number);
  return (
    a > 0 &&
    a < 224 &&
    a !== 10 &&
    a !== 127 &&
    !(a === 100 && b >= 64 && b <= 127) &&
    !(a === 169 && b === 254) &&
    !(a === 172 && b >= 16 && b <= 31) &&
    !(
      a === 192 &&
      (b === 168 ||
        (b === 0 && c === 0) ||
        (b === 0 && c === 2) ||
        (b === 88 && c === 99))
    ) &&
    !(a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) &&
    !(a === 203 && b === 0 && c === 113)
  );
}

export function crossServerTimestampValid(
  timestamp: string,
  nowSeconds: number,
) {
  return (
    /^\d{10}$/.test(timestamp) &&
    Math.abs(nowSeconds - Number(timestamp)) <= CROSS_SERVER_CLOCK_SKEW_SECONDS
  );
}
