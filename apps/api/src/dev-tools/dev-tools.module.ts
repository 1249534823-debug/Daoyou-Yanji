import { getRuntimeEnvironment } from '@server/lib/config/environment';
import {
  Module,
  RequestMethod,
  type MiddlewareConsumer,
  type NestModule,
} from '@nestjs/common';
import { allowsLocalDevTools } from '@daoyou/shared/config/deployment';
import type { NextFunction, Request, Response } from 'express';
import { DevToolsController } from './dev-tools.controller';
import { DevToolsService } from './dev-tools.service';

@Module({ controllers: [DevToolsController], providers: [DevToolsService] })
export class DevToolsModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply((_request: Request, response: Response, next: NextFunction) => {
        if (!allowsLocalDevTools(getRuntimeEnvironment().APP_ENV, getRuntimeEnvironment().NODE_ENV)) {
          response.status(404).json({ success: false, error: '接口不存在' });
          return;
        }
        response.setHeader('Cache-Control', 'no-store');
        next();
      })
      .forRoutes({ path: 'api/dev{/*path}', method: RequestMethod.ALL });
  }
}
