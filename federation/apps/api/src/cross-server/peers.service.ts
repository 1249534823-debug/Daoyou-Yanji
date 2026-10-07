import {
  CrossServerManifestSchema,
  type CrossServerManifest,
  type CrossServerPeerView,
} from '@daoyou/contracts/cross-server';
import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DRIZZLE_DATABASE } from '../database/database.service.js';
import type { DbClient } from '../lib/drizzle/db.js';
import { crossServerPeers } from '../lib/drizzle/schema.js';
import { keyFingerprint, publicKeyObject } from './identity.js';
import { crossServerError, CrossServerTransport } from './transport.js';

@Injectable()
export class CrossServerPeersService {
  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: DbClient,
    @Inject(CrossServerTransport) readonly transport: CrossServerTransport,
  ) {}
  manifest() {
    return this.transport.requireIdentity().manifest;
  }
  async list(): Promise<CrossServerPeerView[]> {
    const hash = this.transport.identity?.manifest.combatHash;
    const rows = await this.db.select().from(crossServerPeers).limit(32);
    return rows.map((row) => ({
      siteId: row.siteId,
      name: row.name,
      enabled: row.enabled,
      compatible: row.combatHash === hash,
      apiBaseUrl: row.apiBaseUrl,
      fingerprint: keyFingerprint(row.publicKey),
      lastError: row.lastError,
      checkedAt: row.checkedAt?.toISOString() ?? null,
    }));
  }
  async trusted(id: string, compatible = true) {
    const identity = this.transport.requireIdentity();
    const [peer] = await this.db
      .select()
      .from(crossServerPeers)
      .where(
        and(
          eq(crossServerPeers.siteId, id),
          eq(crossServerPeers.enabled, true),
        ),
      )
      .limit(1);
    if (!peer) crossServerError('对站尚未获得本站信任', 403);
    if (compatible && peer.combatHash !== identity.manifest.combatHash)
      crossServerError('双方战斗规则不兼容，请联系管理员检查接入');
    return peer;
  }
  async inspect(url: string) {
    this.transport.requireIdentity();
    const base = this.transport.validateBase(url.replace(/\/manifest\/?$/, ''));
    let raw: unknown;
    try {
      raw = await this.transport.json(`${base}/manifest`);
    } catch (error) {
      if (error instanceof Error && 'getStatus' in error) throw error;
      crossServerError('无法读取对站接入信息，请检查地址和网络', 502);
    }
    const parsed = CrossServerManifestSchema.safeParse(raw);
    if (!parsed.success) crossServerError('对站尚未实现受支持的跨服协议', 422);
    const manifest = parsed.data;
    if (this.transport.validateBase(manifest.apiBaseUrl) !== base)
      crossServerError('对站公布的接入地址与访问地址不一致', 422);
    try {
      publicKeyObject(manifest.publicKey);
    } catch {
      crossServerError('对站公钥格式无效', 422);
    }
    if (
      manifest.siteId === this.manifest().siteId ||
      base === this.manifest().apiBaseUrl
    )
      crossServerError('不能接入本站', 400);
    return {
      manifest,
      fingerprint: keyFingerprint(manifest.publicKey),
      compatible: manifest.combatHash === this.manifest().combatHash,
    };
  }
  async register(
    manifest: CrossServerManifest,
    fingerprint: string,
    userId: string,
  ) {
    const current = await this.inspect(manifest.apiBaseUrl);
    if (
      current.fingerprint !== fingerprint ||
      current.manifest.siteId !== manifest.siteId
    )
      crossServerError('对站身份已变化，请重新核验指纹', 409);
    const existing = await this.db
      .select()
      .from(crossServerPeers)
      .where(eq(crossServerPeers.siteId, manifest.siteId))
      .limit(1);
    if (existing[0]) {
      if (
        existing[0].publicKey !== current.manifest.publicKey ||
        existing[0].apiBaseUrl !== current.manifest.apiBaseUrl
      ) {
        crossServerError('站点 ID 已绑定另一身份或地址，请先处理身份变更', 409);
      }
      return;
    }
    const count = await this.db
      .select({ id: crossServerPeers.siteId })
      .from(crossServerPeers)
      .limit(32);
    if (count.length >= 32) crossServerError('接入站点已达上限', 409);
    await this.db
      .insert(crossServerPeers)
      .values({
        siteId: current.manifest.siteId,
        name: current.manifest.name,
        apiBaseUrl: current.manifest.apiBaseUrl,
        publicKey: current.manifest.publicKey,
        combatHash: current.manifest.combatHash,
        enabled: false,
        updatedBy: userId,
        checkedAt: new Date(),
      })
      .onConflictDoNothing();
    const [saved] = await this.db
      .select()
      .from(crossServerPeers)
      .where(eq(crossServerPeers.siteId, manifest.siteId))
      .limit(1);
    if (
      !saved ||
      saved.publicKey !== current.manifest.publicKey ||
      saved.apiBaseUrl !== current.manifest.apiBaseUrl
    )
      crossServerError('接入身份冲突', 409);
  }
  async enable(siteId: string, enabled: boolean, userId: string) {
    this.transport.requireIdentity();
    const [row] = await this.db
      .update(crossServerPeers)
      .set({ enabled, updatedBy: userId, updatedAt: new Date() })
      .where(eq(crossServerPeers.siteId, siteId))
      .returning({ siteId: crossServerPeers.siteId });
    if (!row) crossServerError('接入站点不存在', 404);
  }
  async check(siteId: string, userId: string) {
    const [peer] = await this.db
      .select()
      .from(crossServerPeers)
      .where(eq(crossServerPeers.siteId, siteId))
      .limit(1);
    if (!peer) crossServerError('接入站点不存在', 404);
    let lastError: string | null = null;
    let combatHash = peer.combatHash;
    let enabled = peer.enabled;
    try {
      const current = await this.inspect(peer.apiBaseUrl);
      if (
        current.manifest.siteId !== peer.siteId ||
        current.manifest.publicKey !== peer.publicKey
      ) {
        enabled = false;
        lastError = '对站身份已变化，接入已自动关闭；请通过站外渠道重新核验。';
        crossServerError(lastError, 409);
      }
      combatHash = current.manifest.combatHash;
      if (!current.compatible) crossServerError('双方战斗规则不兼容', 409);
      if (!peer.enabled) crossServerError('本站尚未启用此对站', 409);
      const remote = CrossServerManifestSchema.safeParse(
        await this.transport.call(peer, '/ping'),
      );
      if (
        !remote.success ||
        remote.data.siteId !== peer.siteId ||
        remote.data.combatHash !== combatHash
      )
        crossServerError('对站接入校验失败', 502);
    } catch {
      lastError ??=
        '双向接入未通过；请核对双方启用状态、身份指纹、战斗规则与网络。';
    }
    await this.db
      .update(crossServerPeers)
      .set({
        combatHash,
        enabled,
        lastError,
        checkedAt: new Date(),
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(eq(crossServerPeers.siteId, siteId));
    return { connected: lastError === null, lastError };
  }
}
