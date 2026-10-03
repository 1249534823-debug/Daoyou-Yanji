import { Module } from '@nestjs/common';
import { DatabaseModule } from '@server/database/database.module';
import { FriendsController } from './friends.controller';
import { FriendsService } from './friends.service';
import { WorldChatController } from './world-chat.controller';
import { WorldChatService } from './world-chat.service';

@Module({
  imports: [DatabaseModule],
  controllers: [WorldChatController, FriendsController],
  providers: [WorldChatService, FriendsService],
})
export class SocialModule {}
