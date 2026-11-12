import type { DamageKind } from '../core/types';
import type { Rng } from '../core/rng';
import type { SkillDef } from '../skills/Skill';
import type { Unit } from './Unit';

export interface DamageInput {
  attacker: Unit;
  target: Unit;
  kind: DamageKind;
  skill?: SkillDef;
  charge?: number;
  holy?: boolean;
}

export interface DamageResult {
  hit: boolean;
  crit: boolean;
  /** 暴击后、护盾前的伤害。 */
  amount: number;
  base: number;
  hitChance: number;
  critChance: number;
  /** 技能最终倍率（普通攻击为 1）。 */
  multiplier: number;
}

/**
 * 伤害管线：
 * 1. 命中判定：命中 - 闪避
 * 2. 基础伤害：普攻/技能公式，处理毁灭者与神圣
 * 3. 暴击判定：暴击 - 免爆；暴击后乘暴击伤害倍率
 * 4. 向下取整，最低 1
 * 护盾与 HP 的扣除由 Unit.takeDamage 处理。
 */
export function rollDamage(input: DamageInput, rng: Rng): DamageResult {
  const { attacker, target, kind, skill, charge = 0, holy = false } = input;

  const hitChance = clamp(attacker.getStat('hit') - target.getStat('dodge'), 0, 100);
  const critChance = clamp(
    attacker.getStat('crit') - target.getStat('antiCrit'),
    0,
    100,
  );

  if (!rng.chance(hitChance)) {
    return {
      hit: false,
      crit: false,
      amount: 0,
      base: 0,
      hitChance,
      critChance,
      multiplier: kind === 'skill' && skill ? skill.baseMultiplier * (charge / 100) : 1,
    };
  }

  const offense = attacker.offense;
  let base: number;
  let multiplier = 1;

  if (kind === 'normal') {
    const defense = holy
      ? 0
      : attacker.destroyer
        ? target.getStat('energyDef')
        : target.getStat('physDef');
    base = offense - defense;
  } else {
    if (!skill) throw new Error('Skill damage requires a skill definition');
    multiplier = skill.baseMultiplier * (charge / 100);
    const primaryDef = holy
      ? 0
      : attacker.destroyer
        ? target.getStat('energyDef')
        : target.getStat('physDef');
    const skillDef =
      holy || attacker.destroyer ? 0 : target.getStat('skillDef');
    base =
      multiplier * (offense + attacker.getStat('skillAtk')) -
      primaryDef -
      skillDef;
  }

  const crit = rng.chance(critChance);
  const critMultiplier = attacker.getStat('critDamage') / 100;
  let amount = base;
  if (crit) amount *= critMultiplier;
  amount = Math.max(1, Math.floor(amount));

  return {
    hit: true,
    crit,
    amount,
    base,
    hitChance,
    critChance,
    multiplier,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
