import { HttpException, type PipeTransform } from '@nestjs/common';

export class RejectRetiredBattleSharePipe implements PipeTransform {
  transform(value: unknown) {
    if (
      typeof value === 'object' &&
      value !== null &&
      'messageType' in value &&
      value.messageType === 'battle_showcase'
    ) {
      throw new HttpException(
        { success: false, error: '旧版战报分享已停用' },
        410,
      );
    }
    return value;
  }
}
