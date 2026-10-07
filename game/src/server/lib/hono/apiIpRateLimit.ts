import { getRequestIp } from '@server/lib/http/requestIp';
import {
  checkApiIpRateLimit,
  type ApiIpRateLimitResult,
} from '@server/lib/redis/apiIpRateLimiter';
import type { Context, MiddlewareHandler } from 'hono';
import type { AppEnv } from './types';

function applyRateLimitHeaders(
  context: Context<AppEnv>,
  result: ApiIpRateLimitResult,
) {
  context.header('X-RateLimit-Limit', String(result.limit));
  context.header('X-RateLimit-Remaining', String(result.remaining));
  context.header(
    'X-RateLimit-Reset',
    String(Math.ceil(result.resetAt.getTime() / 1000)),
  );
}

function applyRateLimitHeadersToResponse(
  response: Response,
  result: ApiIpRateLimitResult,
) {
  response.headers.set('X-RateLimit-Limit', String(result.limit));
  response.headers.set('X-RateLimit-Remaining', String(result.remaining));
  response.headers.set(
    'X-RateLimit-Reset',
    String(Math.ceil(result.resetAt.getTime() / 1000)),
  );
}

export function apiIpRateLimit(): MiddlewareHandler<AppEnv> {
  return async (context, next) => {
    if (
      ['/api/health-check', '/api/live', '/api/ready'].includes(
        context.req.path,
      )
    ) {
      await next();
      return;
    }

    const ip = getRequestIp(context) ?? 'unknown-peer';

    let result: ApiIpRateLimitResult;
    try {
      result = await checkApiIpRateLimit(ip);
    } catch (error) {
      console.warn('[api-rate-limit] redis check failed', {
        errorType: error instanceof Error ? error.name : 'unknown',
      });
      if (allowsRateLimitFailure(context.req.method, context.req.path)) {
        await next();
        return;
      }
      context.header('Retry-After', '5');
      return context.json(
        { success: false, error: '服务暂时繁忙，请稍后重试' },
        503,
      );
    }

    applyRateLimitHeaders(context, result);

    if (!result.allowed) {
      const response = Response.json(
        {
          success: false,
          error: '请求过于频繁，请稍后再试',
        },
        { status: 429 },
      );
      applyRateLimitHeadersToResponse(response, result);
      response.headers.set('Retry-After', String(result.retryAfterSeconds));
      context.res = response;
      return;
    }

    await next();
  };
}

/** Only reviewed ordinary reads degrade open; auth/unknown/expensive paths close. */
export function allowsRateLimitFailure(method: string, path: string): boolean {
  if (method !== 'GET') return false;
  return /^\/api\/(?:tasks(?:\/[^/]+)?|rankings(?:\/(?:items|wealth|my-rank))?|community\/(?:qq-group|announcement)|world-chat\/messages|battle-records\/(?:shared\/[^/]+|v3(?:\/[^/]+)?))\/?$/.test(
    path,
  );
}
