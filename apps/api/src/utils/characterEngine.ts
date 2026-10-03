import { CharacterGenerator } from '@server/lib/generation/CharacterGenerator';
import type { Cultivator } from '@daoyou/shared/types/cultivator';

/**
 * @deprecated Use CharacterGenerator.generate() directly from @server/lib/generation/CharacterGenerator
 */
export async function generateCultivatorFromAI(
  userInput: string,
): Promise<{ cultivator: Cultivator; balanceNotes: string }> {
  return CharacterGenerator.generate(userInput);
}
