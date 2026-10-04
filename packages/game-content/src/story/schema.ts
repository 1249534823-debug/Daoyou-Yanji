import { createStoryChapterSchema } from '@daoyou/game-domain/story/schema';
import { getGuideLesson } from '../guide/catalog.js';
import { hasStoryReward } from './rewards.js';

export const { StoryChapterSchema } = createStoryChapterSchema({
  getGuideLesson,
  hasStoryReward,
});
