import { Module } from '@nestjs/common';
import { DatabaseModule } from '@server/database/database.module';
import { MailController } from './mail.controller';
import { MailService } from './mail.service';

@Module({
  imports: [DatabaseModule],
  controllers: [MailController],
  providers: [MailService],
})
export class MailModule {}
