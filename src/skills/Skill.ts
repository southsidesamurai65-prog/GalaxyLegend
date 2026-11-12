import type { ShapeId } from '../core/types';
import type { EffectSpec } from '../battle/effects/Effect';

export type CastEffectTarget =
  | 'self'
  | 'randomAlly'
  | 'randomAllies'
  | 'allAllies'
  | 'allAlliesExceptSelf'
  | 'lowestHpAlly';

export type HealTarget = 'self' | 'lowestHpAlly';

export interface CastEffectSpec {
  target: CastEffectTarget;
  /** 仅 randomAllies 使用：随机选择多少名友方。 */
  count?: number;
  effect: EffectSpec;
}

export interface SkillDef {
  id: string;
  name: string;
  description: string;
  shape: ShapeId;
  /** 技能描述倍率，1.5 表示 150%。最终倍率 = baseMultiplier × 蓄能 / 100。 */
  baseMultiplier: number;
  /** 神圣伤害：无视物理防御和技能防御。 */
  holy?: boolean;
  /** 释放时对自身/友方施加的效果。 */
  castEffects?: CastEffectSpec[];
  /** 命中目标后对目标施加的效果。 */
  onHitEffects?: EffectSpec[];
  /** 消耗蓄能的比例，默认 1（清空）。0.5 表示只消耗一半。 */
  chargeCostRatio?: number;
  /** 命中后清空目标蓄能。 */
  drainTargetCharge?: boolean;
  /** 命中后对目标蓄能施加的增减量。 */
  targetChargeDelta?: number;
  /** 命中后不触发“挨打 +25”。 */
  skipHitCharge?: boolean;
  /** 额外附带的无视防御神圣伤害。 */
  flatHolyDamage?: number;
  /** 中毒：每次行动损失 = 本次技能伤害 × percent%。 */
  poisonPercent?: number;
  poisonDuration?: number;
  /** 有值时从存活敌人中随机选择该数量施加中毒。 */
  poisonRandomCount?: number;
  /** 治疗量 =（攻击 + 技能攻击）× healPercent%。 */
  healPercent?: number;
  healTargets?: HealTarget[];
  /** 释放后自身/全体额外获得蓄能。 */
  selfChargeGain?: number;
  teamChargeGain?: number;
}
