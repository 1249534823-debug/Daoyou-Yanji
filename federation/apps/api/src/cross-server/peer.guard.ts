import {
  CROSS_SERVER_BODY_LIMIT,
  CrossServerIdSchema,
} from '@daoyou/contracts/cross-server';
import {
  Inject,
  Injectable,
  RequestTimeoutException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import type { Request } from 'express';
import { readRequestBody } from '../http/json-body.js';
import { CrossServerPeersService } from './peers.service.js';
import { crossServerError, type SigningPeer } from './transport.js';

export interface CrossServerRequest extends Request {
  crossServerPeer: SigningPeer;
}
async function readCrossServerBody(request: Request) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      readRequestBody(request, CROSS_SERVER_BODY_LIMIT),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => {
          request.destroy();
          reject(
            new RequestTimeoutException({
              success: false,
              error: '跨服请求体读取超时',
            }),
          );
        }, 8000);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
@Injectable()
export class CrossServerPeerGuard implements CanActivate {
  constructor(
    @Inject(CrossServerPeersService)
    private readonly peers: CrossServerPeersService,
  ) {}
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<CrossServerRequest>();
    const siteId = CrossServerIdSchema.safeParse(request.get('x-dy-site'));
    if (!siteId.success) crossServerError('跨服认证失败', 401);
    const peer = await this.peers.trusted(siteId.data, false);
    if (request.get('cookie') || request.get('content-encoding'))
      crossServerError('跨服请求格式无效', 400);
    if (
      request.method === 'GET' &&
      (request.get('transfer-encoding') ||
        (request.get('content-length') &&
          request.get('content-length') !== '0'))
    )
      crossServerError('跨服 GET 请求必须为空体', 400);
    const body =
      request.method === 'GET'
        ? Buffer.alloc(0)
        : await readCrossServerBody(request);
    await this.peers.transport.authenticate(peer, request, body);
    request.crossServerPeer = peer;
    return true;
  }
}
@Injectable()
export class CrossServerBodyGuard implements CanActivate {
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    if (['POST', 'PATCH'].includes(request.method))
      await readCrossServerBody(request);
    return true;
  }
}
