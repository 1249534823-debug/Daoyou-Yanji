import { getRuntimeEnvironment } from '@server/lib/config/environment';
import { Controller, Get, Inject, Param, UseFilters } from '@nestjs/common';
import type { AuthUser } from '@server/lib/auth/types';
import { Access, CurrentUser } from '../auth/access';
import { apiErrorFilter } from '../http/error-filter';
import { EnemiesService } from './enemies.service';

const EnemyErrors = apiErrorFilter((error) => {
  console.error('获取敌人数据 API 错误:', error);
  return Response.json(
    {
      error:
        getRuntimeEnvironment().NODE_ENV === 'development' && error instanceof Error
          ? error.message
          : '获取敌人数据失败，请稍后重试',
    },
    { status: 500 },
  );
});

@Controller('api/enemies')
@Access('user')
@UseFilters(EnemyErrors)
export class EnemiesController {
  constructor(
    @Inject(EnemiesService) private readonly enemies: EnemiesService,
  ) {}

  @Get(':id')
  read(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.enemies.read(user.id, id);
  }
}
