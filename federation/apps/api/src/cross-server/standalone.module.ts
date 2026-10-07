import { CrossServerIdSchema } from '@daoyou/contracts/cross-server';
import { combatV6ReplayView } from '@daoyou/game-rules/combat/replay';
import {
  Controller,
  Get,
  Header,
  Inject,
  Injectable,
  Module,
  Param,
  type BeforeApplicationShutdown,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { AccessGuard } from '../auth/access.guard.js';
import { Access, CurrentCultivator } from '../auth/access.js';
import { SessionService } from '../auth/session.service.js';
import { ConfigurationModule } from '../config/configuration.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { DatabaseService } from '../database/database.service.js';
import { ApiExceptionFilter } from '../http/api-exception.filter.js';
import { HttpContextModule } from '../http/http-context.module.js';
import { RequestWorkService } from '../http/request-work.service.js';
import type { ActiveCultivatorRef } from '../lib/auth/types.js';
import { closeDatabase } from '../lib/drizzle/db.js';
import {
  closeRedisConnection,
  getRedisHealthStatus,
} from '../lib/redis/index.js';
import { findOwnedCombatV6Replay } from '../lib/repositories/combatV6ReplayRepository.js';
import { CrossServerModule } from './cross-server.module.js';
import { crossServerError } from './transport.js';

@Controller('internal/cross-server')
@Access('public')
class CrossServerReadyController {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}
  @Get('ready')
  @Header('Cache-Control', 'no-store')
  async ready() {
    const [database, cache] = await Promise.all([
      this.database.healthStatus(),
      getRedisHealthStatus(),
    ]);
    if (database !== 'up' || cache !== 'up')
      crossServerError('跨服服务暂不可用', 503);
    return { ready: true };
  }
}

@Controller('api/cross-server/replays')
@Access('active')
class CrossServerOwnedReplayController {
  @Get(':id')
  @Header('Cache-Control', 'private, no-store')
  async read(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @Param('id') id: string,
  ) {
    const parsed = CrossServerIdSchema.safeParse(id);
    if (!parsed.success) crossServerError('跨服请求参数无效', 400);
    const archive = await findOwnedCombatV6Replay(
      parsed.data,
      actor.cultivatorId,
    );
    if (
      archive?.sourceType !== 'cross-server' ||
      !archive.replay ||
      !archive.replay.participants.some(
        (p) =>
          p.userId === actor.userId && p.cultivatorId === actor.cultivatorId,
      )
    )
      crossServerError('战报不存在或无权访问', 404);
    return {
      success: true,
      data: combatV6ReplayView(
        archive.replay,
        actor.cultivatorId,
        actor.userId,
      ),
    };
  }
}

@Injectable()
class CrossServerLifecycle
  implements BeforeApplicationShutdown, OnApplicationShutdown
{
  constructor(
    @Inject(RequestWorkService) private readonly work: RequestWorkService,
  ) {}
  async beforeApplicationShutdown() {
    await this.work.drain();
  }
  async onApplicationShutdown() {
    await Promise.allSettled([closeDatabase(), closeRedisConnection()]);
  }
}

/** A signed federation service sharing normal auth, without gameplay jobs or workers. */
@Module({
  imports: [
    ConfigurationModule,
    HttpContextModule,
    DatabaseModule,
    CrossServerModule,
  ],
  controllers: [CrossServerReadyController, CrossServerOwnedReplayController],
  providers: [
    SessionService,
    CrossServerLifecycle,
    { provide: APP_GUARD, useClass: AccessGuard },
    { provide: APP_FILTER, useClass: ApiExceptionFilter },
  ],
})
export class CrossServerStandaloneModule {}
