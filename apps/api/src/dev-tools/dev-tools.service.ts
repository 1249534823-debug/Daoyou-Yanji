import { HttpException, Injectable } from '@nestjs/common';
import { patchDevCultivator } from '@server/lib/services/DevCultivatorService';
import { resetDevDivination } from '@server/lib/services/DevDivinationService';
import { clearDevInventoryBag } from '@server/lib/services/DevInventoryService';
import { DivinationError } from '@server/lib/services/DivinationService';
import { grantDevResources } from '@server/lib/services/ForgingService';
import { InventoryError } from '@server/lib/services/InventoryService';
import { QiServiceError } from '@server/lib/services/QiService';
import { DevCultivatorPatchSchema } from '@daoyou/shared/contracts/devTools';
import { DevGrantSchema } from '@daoyou/shared/contracts/forging';
import { InventoryRuleError } from '@daoyou/shared/inventory';
import { z } from 'zod';

@Injectable()
export class DevToolsService {
  async grant(body: Uint8Array | undefined) {
    try {
      return {
        success: true,
        ...(await grantDevResources(
          DevGrantSchema.parse(JSON.parse(new TextDecoder().decode(body))),
        )),
      };
    } catch (error) {
      if (error instanceof z.ZodError)
        throw new HttpException({ success: false, error: '发放参数无效' }, 400);
      if (
        error instanceof InventoryError ||
        error instanceof InventoryRuleError ||
        error instanceof QiServiceError
      )
        throw new HttpException({ success: false, error: error.message }, 409);
      throw error;
    }
  }

  async clearBag(id: string) {
    try {
      return {
        success: true,
        ...(await clearDevInventoryBag(z.uuid().parse(id))),
      };
    } catch (error) {
      if (error instanceof z.ZodError)
        throw new HttpException({ success: false, error: '角色 ID 无效' }, 400);
      if (error instanceof InventoryError)
        throw new HttpException({ success: false, error: error.message }, 409);
      throw error;
    }
  }

  async resetDivination(id: string) {
    try {
      return {
        success: true,
        ...(await resetDevDivination(z.uuid().parse(id))),
      };
    } catch (error) {
      if (error instanceof z.ZodError)
        throw new HttpException({ success: false, error: '角色 ID 无效' }, 400);
      if (error instanceof DivinationError)
        throw new HttpException(
          { success: false, error: error.message },
          error.status,
        );
      throw error;
    }
  }

  async patch(id: string, body: Uint8Array | undefined) {
    try {
      // The original endpoint validates the ID before decoding the request body.
      return {
        success: true,
        ...(await patchDevCultivator(
          z.uuid().parse(id),
          DevCultivatorPatchSchema.parse(
            JSON.parse(new TextDecoder().decode(body)),
          ),
        )),
      };
    } catch (error) {
      if (error instanceof z.ZodError)
        throw new HttpException(
          { success: false, error: '角色调整参数无效' },
          400,
        );
      if (error instanceof InventoryError)
        throw new HttpException({ success: false, error: error.message }, 409);
      throw error;
    }
  }
}
