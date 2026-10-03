import { Injectable } from '@nestjs/common';
import { readCombatActivityNotice } from '@server/lib/services/combat-v6/CombatActivityNotice';

@Injectable()
export class CombatActivityService {
  async read(cultivatorId: string) {
    return {
      success: true,
      data: await readCombatActivityNotice(cultivatorId),
    };
  }
}
