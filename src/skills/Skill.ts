import type { ShapeId } from '../core/types';
import type { EffectSpec } from '../battle/effects/Effect';

export interface SkillDef {
  id: string;
  name: string;
  description: string;
  shape: ShapeId;
  /** 技能描述倍率，1.5 表示 150%。最终倍率 = baseMultiplier × 蓄能 / 100。 */
  baseMultiplier: number;
  /** 神圣伤害：无视物理防御和技能防御。 */
  holy?: boolean;
  /** 释放时对自己施加的效果（例如护盾）。 */
  selfEffects?: EffectSpec[];
  /** 命中目标后对目标施加的效果（例如锁定/禁技）。 */
  targetEffects?: EffectSpec[];
}
