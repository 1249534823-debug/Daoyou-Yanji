import { StandardSectModule } from '../../core/index.js';
import { YOUDU_DEFINITION } from '@daoyou/game-content/sect-organization/youdu/definition';
import { YOUDU_ORGANIZATION_THEME } from '@daoyou/game-content/sect-organization/youdu/organization';

export class YouduSectModule extends StandardSectModule {
  constructor() {
    super(YOUDU_DEFINITION, { organizationTheme: YOUDU_ORGANIZATION_THEME });
  }
}

export const YOUDU_MODULE = new YouduSectModule();
export const YOUDU_SECT = YOUDU_MODULE.definition;
