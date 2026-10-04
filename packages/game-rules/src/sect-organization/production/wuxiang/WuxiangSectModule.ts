import { StandardSectModule } from '../../core/index.js';
import { WUXIANG_DEFINITION } from '@daoyou/game-content/sect-organization/wuxiang/definition';
import { WUXIANG_ORGANIZATION_THEME } from '@daoyou/game-content/sect-organization/wuxiang/organization';

export class WuxiangSectModule extends StandardSectModule {
  constructor() {
    super(WUXIANG_DEFINITION, {
      organizationTheme: WUXIANG_ORGANIZATION_THEME,
    });
  }
}

export const WUXIANG_MODULE = new WuxiangSectModule();
export const WUXIANG_SECT = WUXIANG_MODULE.definition;
