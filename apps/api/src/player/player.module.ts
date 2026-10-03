import { Module } from '@nestjs/common';
import { JournalController } from './journal.controller';
import { PlayerController } from './player.controller';
import { PlayerService } from './player.service';

@Module({
  controllers: [PlayerController, JournalController],
  providers: [PlayerService],
})
export class PlayerModule {}
