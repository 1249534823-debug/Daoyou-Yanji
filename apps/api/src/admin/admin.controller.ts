import {
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  UseFilters,
} from '@nestjs/common';
import type { AuthUser } from '@server/lib/auth/types';
import { Access, CurrentUser } from '../auth/access';
import { FirstQuery } from '../http/first-query';
import { JsonBody } from '../http/json-body';
import { AdminErrors } from './admin-errors';
import { AdminFeedbackService } from './feedback.service';
import { MonitoringService } from './monitoring.service';
import { SettingsService } from './settings.service';

@Controller('api/admin')
@Access('admin')
@UseFilters(AdminErrors)
export class AdminController {
  constructor(
    @Inject(SettingsService) private readonly settings: SettingsService,
    @Inject(MonitoringService) private readonly monitoring: MonitoringService,
    @Inject(AdminFeedbackService)
    private readonly feedback: AdminFeedbackService,
  ) {}

  @Get('session')
  session(@CurrentUser() user: AuthUser) {
    return { success: true, userId: user.id, email: user.email };
  }

  @Get('announcement')
  announcement() {
    return this.settings.announcement();
  }

  @Patch('announcement')
  updateAnnouncement(
    @CurrentUser() user: AuthUser,
    @JsonBody({ fallback: null }) input: unknown,
  ) {
    return this.settings.updateAnnouncement(user.id, input);
  }

  @Get('community-group')
  community() {
    return this.settings.community();
  }

  @Patch('community-group')
  updateCommunity(
    @CurrentUser() user: AuthUser,
    @JsonBody({ fallback: null }) input: unknown,
  ) {
    return this.settings.updateCommunity(user.id, input);
  }

  @Get('llm-metrics')
  llmMetrics(@FirstQuery() query: Record<string, string | undefined>) {
    return this.monitoring.llmMetrics(query);
  }

  @Get('online-users')
  onlineUsers() {
    return this.monitoring.onlineUsers();
  }

  @Get('feedback')
  listFeedback(@FirstQuery() query: Record<string, string | undefined>) {
    return this.feedback.list(query);
  }

  @Patch('feedback/:id/status')
  updateFeedback(
    @Param('id') id: string,
    @JsonBody({ fallback: null }) input: unknown,
  ) {
    return this.feedback.update(id, input);
  }
}
