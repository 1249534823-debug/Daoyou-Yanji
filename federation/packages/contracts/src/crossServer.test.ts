import { createHash, generateKeyPairSync, sign, verify } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  canonicalCrossServerJson,
  crossServerRequestMessage,
  crossServerResponseMessage,
  crossServerTimestampValid,
  isPublicCrossServerAddress,
} from './crossServer.js';

describe('跨站签名契约', () => {
  it('规范 JSON 与字段插入顺序无关，保留数组顺序及 Unicode', () => {
    const a = {
      z: [null, '道友', { b: true, a: -0 }],
      a: 2,
      omitted: undefined,
    };
    const b = { a: 2, z: [null, '道友', { a: 0, b: true }] };
    expect(canonicalCrossServerJson(a)).toBe(
      '{"a":2,"z":[null,"道友",{"a":0,"b":true}]}',
    );
    expect(canonicalCrossServerJson(a)).toBe(canonicalCrossServerJson(b));
    expect(canonicalCrossServerJson([2, 1])).not.toBe(
      canonicalCrossServerJson([1, 2]),
    );
    expect(
      canonicalCrossServerJson(JSON.parse(canonicalCrossServerJson(a))),
    ).toBe(canonicalCrossServerJson(a));
  });
  it.each([NaN, Infinity, undefined, BigInt(1), new Date()])(
    '拒绝不能跨 JSON 传输的值 %s',
    (value) => {
      expect(() => canonicalCrossServerJson(value)).toThrow();
    },
  );
  it('深层或循环载荷有明确上限', () => {
    const cyclic: unknown[] = [];
    cyclic.push(cyclic);
    expect(() => canonicalCrossServerJson(cyclic)).toThrow('nesting limit');
    let nested: unknown = 1;
    for (let n = 0; n < 65; n++) nested = [nested];
    expect(() => canonicalCrossServerJson(nested)).toThrow('nesting limit');
  });
  it('请求签名绑定方法、完整路径、双方身份、时戳、随机数与原始请求体', () => {
    const { publicKey, privateKey } = generateKeyPairSync('ed25519');
    const hash = (body: string) =>
      createHash('sha256').update(body).digest('hex');
    const input = {
      method: 'POST',
      path: '/api/cross-server/v1/challenges',
      sender: 'site-a',
      audience: 'site-b',
      timestamp: '1780000000',
      nonce: 'nonce-a',
      bodyHash: hash('{"a":1}'),
    };
    const signature = sign(
      null,
      Buffer.from(crossServerRequestMessage(input)),
      privateKey,
    );
    expect(
      verify(
        null,
        Buffer.from(crossServerRequestMessage(input)),
        publicKey,
        signature,
      ),
    ).toBe(true);
    for (const key of Object.keys(input) as (keyof typeof input)[]) {
      expect(
        verify(
          null,
          Buffer.from(
            crossServerRequestMessage({ ...input, [key]: input[key] + 'x' }),
          ),
          publicKey,
          signature,
        ),
      ).toBe(false);
    }
    expect(
      verify(
        null,
        Buffer.from(
          crossServerRequestMessage({ ...input, bodyHash: hash('{ "a":1 }') }),
        ),
        publicKey,
        signature,
      ),
    ).toBe(false);
  });
  it('响应不能用于其他请求或其他接收站点', () => {
    const { publicKey, privateKey } = generateKeyPairSync('ed25519');
    const input = {
      sender: 'site-b',
      audience: 'site-a',
      path: '/challenges/1',
      nonce: 'n1',
      payloadHash: 'digest',
    };
    const signature = sign(
      null,
      Buffer.from(crossServerResponseMessage(input)),
      privateKey,
    );
    expect(
      verify(
        null,
        Buffer.from(crossServerResponseMessage(input)),
        publicKey,
        signature,
      ),
    ).toBe(true);
    for (const key of Object.keys(input) as (keyof typeof input)[]) {
      expect(
        verify(
          null,
          Buffer.from(
            crossServerResponseMessage({ ...input, [key]: input[key] + 'x' }),
          ),
          publicKey,
          signature,
        ),
      ).toBe(false);
    }
    expect(
      verify(
        null,
        Buffer.from(
          crossServerRequestMessage({
            method: 'GET',
            path: input.path,
            sender: input.sender,
            audience: input.audience,
            timestamp: '1780000000',
            nonce: input.nonce,
            bodyHash: input.payloadHash,
          }),
        ),
        publicKey,
        signature,
      ),
    ).toBe(false);
  });
  it.each([-301, -300, 0, 300, 301])('时间窗口边界 %s 秒', (offset) => {
    expect(
      crossServerTimestampValid(String(1780000000 + offset), 1780000000),
    ).toBe(Math.abs(offset) <= 300);
  });
  it.each(['', '1780000000x', '1.78e9', '01780000000', 'NaN'])(
    '拒绝非十位秒时戳 %s',
    (timestamp) => {
      expect(crossServerTimestampValid(timestamp, 1780000000)).toBe(false);
    },
  );
});

describe('跨站连接地址边界', () => {
  it.each([
    '8.8.8.8',
    '1.1.1.1',
    '172.15.255.255',
    '172.32.0.1',
    '100.63.255.255',
    '100.128.0.1',
    '2001:4860:4860::8888',
    '2606:4700:4700::1111',
  ])('允许公网单播 %s', (address) => {
    expect(isPublicCrossServerAddress(address)).toBe(true);
  });
  it.each([
    '0.0.0.0',
    '10.1.2.3',
    '127.0.0.1',
    '169.254.169.254',
    '172.16.0.1',
    '172.31.255.255',
    '192.168.0.1',
    '100.64.0.1',
    '100.127.255.255',
    '192.0.0.1',
    '192.0.2.1',
    '192.88.99.1',
    '198.18.0.1',
    '198.19.255.255',
    '198.51.100.1',
    '203.0.113.1',
    '224.0.0.1',
    '255.255.255.255',
    '::',
    '::1',
    'fc00::1',
    'fe80::1',
    'ff02::1',
    '::ffff:127.0.0.1',
    '2001::1',
    '2001:0000:1::1',
    '2001:2::1',
    '2001:0020::1',
    '2001:db8::1',
    '2001:0db8::1',
    '2002:0808:0808::1',
    '3fff::1',
    '8.8.8.999',
    '008.8.8.8',
    'localhost',
    '2001:4860',
    '2606:::1',
  ])('拒绝内网、保留及非法地址 %s', (address) => {
    expect(isPublicCrossServerAddress(address)).toBe(false);
  });
});
