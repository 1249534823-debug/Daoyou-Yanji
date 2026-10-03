import { runtimeConfig } from '../config/runtime.config';
import type { ConfigType } from '@nestjs/config';
import {
  HttpException,
  Inject,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import type { Request } from 'express';
@Injectable()
export class InternalCronGuard implements CanActivate {
  constructor(@Inject(runtimeConfig.KEY) private readonly config: ConfigType<typeof runtimeConfig>) {}
  canActivate(context: ExecutionContext): boolean {
    const secret = this.config.CRON_SECRET;
    if (!secret) {
      if (this.config.NODE_ENV === 'production')
        throw new HttpException(
          { success: false, error: 'CRON_SECRET is required in production' },
          500,
        );
      return true;
    }
    const request = context.switchToHttp().getRequest<Request>();
    if (request.get('authorization') !== `Bearer ${secret}`)
      throw new HttpException({ success: false, error: 'Unauthorized' }, 401);
    return true;
  }
}
