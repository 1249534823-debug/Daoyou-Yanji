import {
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  UseFilters,
} from '@nestjs/common';
import type { AuthUser } from '@server/lib/auth/types';
import { Access, CurrentUser } from '../auth/access';
import { FirstQuery } from '../http/first-query';
import { JsonBody } from '../http/json-body';
import { AdminErrors } from './admin-errors';
import { AdminRedeemCodesService } from './redeem-codes.service';

@Controller('api/admin/redeem-codes')
@Access('admin')
@UseFilters(AdminErrors)
export class AdminRedeemCodesController {
  constructor(
    @Inject(AdminRedeemCodesService)
    private readonly service: AdminRedeemCodesService,
  ) {}
  @Get()
  list(@FirstQuery() query: Record<string, string | undefined>) {
    return this.service.list(query);
  }
  @Post()
  @HttpCode(200)
  create(
    @CurrentUser() user: AuthUser,
    @JsonBody({ fallback: null }) body: unknown,
  ) {
    return this.service.create(user.id, body);
  }
  @Post(':id/toggle')
  @HttpCode(200)
  toggle(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.toggle(user.id, id);
  }
}
