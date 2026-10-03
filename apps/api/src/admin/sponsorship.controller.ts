import {
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Put,
  UseFilters,
} from '@nestjs/common';
import type { AuthUser } from '@server/lib/auth/types';
import { Access, CurrentUser } from '../auth/access';
import { FirstQuery } from '../http/first-query';
import { JsonBody } from '../http/json-body';
import { AdminErrors } from './admin-errors';
import { AdminSponsorshipService } from './sponsorship.service';

@Controller('api/admin/sponsorship')
@Access('admin')
@UseFilters(AdminErrors)
export class AdminSponsorshipController {
  constructor(
    @Inject(AdminSponsorshipService)
    private readonly service: AdminSponsorshipService,
  ) {}
  @Get('config')
  config() {
    return this.service.config();
  }
  @Put('config')
  updateConfig(
    @CurrentUser() user: AuthUser,
    @JsonBody({ fallback: null }) body: unknown,
  ) {
    return this.service.updateConfig(user.id, body);
  }
  @Post('ping')
  @HttpCode(200)
  ping() {
    return this.service.ping();
  }
  @Get('orders')
  orders(@FirstQuery() query: Record<string, string | undefined>) {
    return this.service.orders(query);
  }
  @Get('orders/:id')
  detail(@Param('id') id: string) {
    return this.service.detail(id);
  }
  @Post('orders/:id/retry')
  @HttpCode(200)
  retry(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.retry(user.id, id);
  }
  @Post('orders/:id/revoke')
  @HttpCode(200)
  revoke(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.revoke(user.id, id);
  }
  @Post('orders/:id/rotate-claim')
  @HttpCode(200)
  rotateClaim(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.rotateClaim(user.id, id);
  }
  @Post('snapshots/:id/reveal')
  @HttpCode(200)
  reveal(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.reveal(user.id, id);
  }
  @Post('manual-grants')
  @HttpCode(201)
  grant(
    @CurrentUser() user: AuthUser,
    @JsonBody({ fallback: null }) body: unknown,
  ) {
    return this.service.grant(user.id, body);
  }
}
