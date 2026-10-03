import { Controller, Get, Inject } from '@nestjs/common';
import { Access } from '../auth/access';
import { CommunityService } from './community.service';

@Controller('api/community')
@Access('public')
export class CommunityController {
  constructor(
    @Inject(CommunityService) private readonly community: CommunityService,
  ) {}

  @Get('qq-group')
  qqGroup() {
    return this.community.qqGroup();
  }

  @Get('announcement')
  announcement() {
    return this.community.announcement();
  }
}
