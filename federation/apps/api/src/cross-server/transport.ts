import {
  canonicalCrossServerJson,
  CROSS_SERVER_BODY_LIMIT,
  CROSS_SERVER_PROTOCOL,
  CrossServerIdSchema,
  crossServerRequestMessage,
  crossServerResponseMessage,
  crossServerTimestampValid,
  isPublicCrossServerAddress,
} from '@daoyou/contracts/cross-server';
import { HttpException, Inject, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { randomUUID, sign, verify } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { isIP } from 'node:net';
import { AppConfigService } from '../config/app-config.service.js';
import { redis } from '../lib/redis/index.js';
import {
  createCrossServerIdentity,
  publicKeyObject,
  sha256,
  type CrossServerIdentity,
} from './identity.js';

export type SigningPeer = {
  siteId: string;
  apiBaseUrl: string;
  publicKey: string;
};
export function crossServerError(message: string, status = 409): never {
  throw new HttpException({ success: false, error: message }, status);
}

@Injectable()
export class CrossServerTransport {
  readonly identity: CrossServerIdentity | null;
  private readonly allowLoopback: boolean;
  constructor(@Inject(AppConfigService) config: AppConfigService) {
    this.allowLoopback =
      config.get('APP_ENV') === 'local' &&
      config.get('NODE_ENV') !== 'production' &&
      config.get('CROSS_SERVER_ALLOW_LOCALHOST') === 'true';
    this.identity = createCrossServerIdentity(config);
    if (this.identity) this.validateBase(this.identity.manifest.apiBaseUrl);
  }
  requireIdentity() {
    return this.identity ?? crossServerError('本站尚未开启跨服接入', 503);
  }
  validateBase(value: string) {
    const url = new URL(value);
    if (
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      !/^\/[A-Za-z0-9/_-]*$/.test(url.pathname)
    ) {
      crossServerError('接入地址格式无效', 400);
    }
    const local =
      this.allowLoopback && ['127.0.0.1', '[::1]'].includes(url.hostname);
    if (url.protocol !== 'https:' && !(local && url.protocol === 'http:'))
      crossServerError('接入地址必须使用 HTTPS', 400);
    return url.toString().replace(/\/$/, '');
  }

  async json(
    url: string,
    method = 'GET',
    body = '',
    headers: Record<string, string> = {},
  ): Promise<unknown> {
    const parsed = new URL(url);
    const hostname = parsed.hostname.replace(/^\[|\]$/g, '');
    const local = this.allowLoopback && ['127.0.0.1', '::1'].includes(hostname);
    if (
      parsed.username ||
      parsed.password ||
      parsed.hash ||
      (parsed.protocol !== 'https:' && !(local && parsed.protocol === 'http:'))
    ) {
      crossServerError('接入地址不安全', 400);
    }
    let addresses: { address: string; family: number }[];
    if (isIP(hostname))
      addresses = [{ address: hostname, family: isIP(hostname) }];
    else {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        addresses = await Promise.race([
          lookup(hostname, { all: true, verbatim: true }),
          new Promise<never>((_resolve, reject) => {
            timer = setTimeout(
              () => reject(new Error('Peer DNS timed out')),
              4000,
            );
          }),
        ]);
      } finally {
        clearTimeout(timer);
      }
    }
    if (
      !addresses.length ||
      addresses.some((a) => !local && !isPublicCrossServerAddress(a.address))
    )
      crossServerError('不允许连接内网或保留地址', 400);
    const pinned = addresses[0];
    return new Promise((resolve, reject) => {
      const requester =
        parsed.protocol === 'https:' ? httpsRequest : httpRequest;
      const req = requester(parsed, {
        method,
        agent: false,
        family: pinned.family,
        lookup: (_hostname, _options, callback) =>
          callback(null, pinned.address, pinned.family),
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...headers,
          'Content-Length': String(Buffer.byteLength(body)),
        },
      });
      const timer = setTimeout(
        () => req.destroy(new Error('Peer request timed out')),
        8000,
      );
      const fail = (error: Error) => {
        clearTimeout(timer);
        reject(error);
      };
      req.on('error', fail);
      req.on('response', (response) => {
        if (
          response.statusCode !== 200 ||
          !response.headers['content-type']?.includes('application/json') ||
          response.headers['content-encoding']
        ) {
          response.resume();
          req.destroy();
          fail(new Error('Peer rejected request'));
          return;
        }
        let size = 0;
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => {
          size += chunk.length;
          if (size > CROSS_SERVER_BODY_LIMIT)
            req.destroy(new Error('Peer response too large'));
          else chunks.push(chunk);
        });
        response.on('error', fail);
        response.on('end', () => {
          clearTimeout(timer);
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
          } catch {
            reject(new Error('Invalid peer response'));
          }
        });
      });
      req.end(body);
    });
  }

  async call(
    peer: SigningPeer,
    path: string,
    method = 'GET',
    data?: unknown,
  ): Promise<unknown> {
    const identity = this.requireIdentity();
    const url = new URL(`${this.validateBase(peer.apiBaseUrl)}${path}`);
    const body = data === undefined ? '' : JSON.stringify(data);
    if (Buffer.byteLength(body) > CROSS_SERVER_BODY_LIMIT)
      crossServerError('跨服构筑数据过大', 422);
    const nonce = randomUUID();
    const timestamp = String(Math.floor(Date.now() / 1000));
    const requestPath = `${url.pathname}${url.search}`;
    const message = crossServerRequestMessage({
      method,
      path: requestPath,
      sender: identity.manifest.siteId,
      audience: peer.siteId,
      timestamp,
      nonce,
      bodyHash: sha256(body),
    });
    const raw = await this.json(url.toString(), method, body, {
      'x-dy-protocol': CROSS_SERVER_PROTOCOL,
      'x-dy-site': identity.manifest.siteId,
      'x-dy-audience': peer.siteId,
      'x-dy-timestamp': timestamp,
      'x-dy-nonce': nonce,
      'x-dy-signature': sign(
        null,
        Buffer.from(message),
        identity.privateKey,
      ).toString('base64'),
    });
    if (
      !raw ||
      typeof raw !== 'object' ||
      !('data' in raw) ||
      !('signature' in raw) ||
      typeof raw.signature !== 'string' ||
      raw.signature.length > 150
    )
      crossServerError('对站响应签名缺失', 502);
    const payloadHash = sha256(canonicalCrossServerJson(raw.data));
    if (
      !verify(
        null,
        Buffer.from(
          crossServerResponseMessage({
            sender: peer.siteId,
            audience: identity.manifest.siteId,
            nonce,
            path: requestPath,
            payloadHash,
          }),
        ),
        publicKeyObject(peer.publicKey),
        Buffer.from(raw.signature, 'base64'),
      )
    )
      crossServerError('对站响应签名无效', 502);
    return raw.data;
  }

  async authenticate(peer: SigningPeer, request: Request, body: Buffer) {
    const identity = this.requireIdentity();
    const timestamp = request.get('x-dy-timestamp') ?? '';
    const nonce = request.get('x-dy-nonce') ?? '';
    const signature = request.get('x-dy-signature') ?? '';
    if (
      request.get('x-dy-protocol') !== CROSS_SERVER_PROTOCOL ||
      request.get('x-dy-audience') !== identity.manifest.siteId ||
      request.get('x-dy-site') !== peer.siteId ||
      !CrossServerIdSchema.safeParse(nonce).success ||
      !crossServerTimestampValid(timestamp, Math.floor(Date.now() / 1000)) ||
      !/^[A-Za-z0-9+/]{86}==$/.test(signature)
    )
      crossServerError('跨服认证失败', 401);
    const message = crossServerRequestMessage({
      method: request.method,
      path: request.originalUrl,
      sender: peer.siteId,
      audience: identity.manifest.siteId,
      timestamp,
      nonce,
      bodyHash: sha256(body),
    });
    if (
      !verify(
        null,
        Buffer.from(message),
        publicKeyObject(peer.publicKey),
        Buffer.from(signature, 'base64'),
      )
    )
      crossServerError('跨服认证失败', 401);
    const fresh = await redis.set(
      `cross-server:nonce:${peer.siteId}:${nonce}`,
      '1',
      'EX',
      601,
      'NX',
    );
    if (!fresh) crossServerError('跨服请求已使用', 409);
    const key = `cross-server:rate:${peer.siteId}:${Math.floor(Date.now() / 60000)}`;
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, 120);
    if (count > 120) crossServerError('对站请求过于频繁', 429);
  }

  reply(peer: SigningPeer, request: Request, data: unknown) {
    const identity = this.requireIdentity();
    const message = crossServerResponseMessage({
      sender: identity.manifest.siteId,
      audience: peer.siteId,
      nonce: request.get('x-dy-nonce')!,
      path: request.originalUrl,
      payloadHash: sha256(canonicalCrossServerJson(data)),
    });
    return {
      data,
      signature: sign(null, Buffer.from(message), identity.privateKey).toString(
        'base64',
      ),
    };
  }
}
