import { Module } from '@nestjs/common';
import { DatabaseModule } from '@server/database/database.module';
import { JournalController } from './journal.controller';
import { PlayerController } from './player.controller';
import { PlayerService } from './player.service';

@Module({
  imports: [DatabaseModule],
  controllers: [PlayerController, JournalController],
  providers: [PlayerService],
})
export class PlayerModule {}
