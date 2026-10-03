import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AccessGuard } from './access.guard';
import { CaptchaController } from './captcha.controller';
import { CaptchaService } from './captcha.service';
import { SessionService } from './session.service';

@Module({
  controllers: [CaptchaController],
  providers: [
    CaptchaService,
    SessionService,
    { provide: APP_GUARD, useClass: AccessGuard },
  ],
  exports: [SessionService],
})
export class AuthModule {}
