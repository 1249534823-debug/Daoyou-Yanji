import { Module } from '@nestjs/common';
import { DatabaseModule } from '@server/database/database.module';
import { StoryController } from './story.controller';
import { StoryService } from './story.service';

@Module({
  imports: [DatabaseModule],
  controllers: [StoryController],
  providers: [StoryService],
})
export class StoryModule {}
