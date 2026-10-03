import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  UseFilters,
} from '@nestjs/common';
import type { ActiveCultivatorRef } from '@server/lib/auth/types';
import { redisLockErrorResponse } from '@server/lib/http/errors';
import { Access, CurrentCultivator } from '../auth/access';
import { apiErrorFilter } from '../http/error-filter';
import { FirstQuery } from '../http/first-query';
import { ProductsService } from './products.service';

const ProductsErrors = apiErrorFilter((error) => {
  const lock = redisLockErrorResponse(error);
  if (lock) return lock;
  console.error('旧产物请求失败:', error);
  return Response.json(
    { success: false, error: '服务器内部错误' },
    { status: 500 },
  );
});

@Controller('api/v2/products')
@Access('active')
@UseFilters(ProductsErrors)
export class ProductsController {
  constructor(
    @Inject(ProductsService) private readonly products: ProductsService,
  ) {}

  @Get()
  list(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @FirstQuery() query: Record<string, string | undefined>,
  ) {
    return this.products.list(actor, query);
  }

  @Post('equip')
  @HttpCode(410)
  equip() {
    return { error: '旧产物装配已停用' };
  }

  @Get(':id')
  read(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @Param('id') id: string,
  ) {
    return this.products.read(actor, id);
  }

  @Delete(':id')
  @HttpCode(410)
  delete() {
    return { error: '历史产物直接删除已停用' };
  }
}
