import type { Stats } from '../core/types';

export type Rarity = 'B' | 'A' | 'S' | 'S1' | 'S2' | 'SS';

export interface CharacterTemplate {
  id: string;
  name: string;
  /** UI 上的职业/定位文本；codex 角色通常等于阵营。 */
  role: string;
  faction: string;
  rarity: Rarity;
  destroyer?: boolean;
  color: string;
  crystalSlots: number;
  skillId: string;
  base: Partial<Stats>;
  /** 属性是否已填写；未填写时不能在准备阶段上阵。 */
  complete: boolean;
  source: 'codex';
  passive?: {
    noHitCharge?: boolean;
    description?: string;
  };
}

export function isFlagshipCharacter(character: CharacterTemplate): boolean {
  return character.faction === '旗舰';
}
