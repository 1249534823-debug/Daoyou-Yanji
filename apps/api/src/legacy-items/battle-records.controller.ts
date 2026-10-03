import { All, Controller, HttpCode } from '@nestjs/common';
import { Access } from '../auth/access';

@Controller('api/battle-records')
@Access('public')
export class LegacyBattleRecordsController {
  @All(['', '*path'])
  @HttpCode(410)
  retired() {
    return {
      success: false,
      error: '旧版战绩已停止查看，请前往新版战绩。',
      code: 'LEGACY_BATTLE_HISTORY_RETIRED',
    };
  }
}
