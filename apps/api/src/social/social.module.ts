import { Module } from '@nestjs/common';
import { FriendsController } from './friends.controller';
import { FriendsService } from './friends.service';
import { WorldChatController } from './world-chat.controller';
import { WorldChatService } from './world-chat.service';

@Module({
  controllers: [WorldChatController, FriendsController],
  providers: [WorldChatService, FriendsService],
})
export class SocialModule {}
