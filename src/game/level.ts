import type { AttributeKey, Stats } from '../core/types';
import { createStats } from '../core/attributes';
import type { CharacterTemplate } from '../data/characters';

export const MAX_LEVEL = 75;

/**
 * 75 级固定装备加成。codex 里写的是 1 级属性，
 * 打架时默认把这套装备数值加上。
 */
const GEAR_BONUS: Partial<Stats> = {
  hp: 66400,
  physAtk: 46500,
  physDef: 33200,
  skillAtk: 33200,
  skillDef: 33200,
  energyAtk: 19900,
  speed: 2612,
};

export function speedPerLevel(faction: string): number {
  if (faction.includes('旗舰') || faction.includes('护卫')) return 2;
  if (faction.includes('突击')) return 3;
  if (faction.includes('打击')) return 4;
  if (faction.includes('徘徊') || faction.includes('毁灭')) return 5;
  return 0;
}

const FIFTEEN_X_KEYS: AttributeKey[] = [
  'hp',
  'physAtk',
  'physDef',
  'skillAtk',
  'skillDef',
  'energyAtk',
];

export function applyLevelBonuses(
  template: CharacterTemplate,
  stats: Stats,
): Stats {
  const result: Stats = { ...stats };

  // codex：75 级时这些绝对值属性是 1 级的 15 倍。
  // 速度走单独的每级成长，初始蓄能和百分比属性不变。
  for (const key of FIFTEEN_X_KEYS) {
    result[key] *= 15;
  }

  const keys = Object.keys(GEAR_BONUS) as AttributeKey[];
  for (const key of keys) {
    result[key] += GEAR_BONUS[key] ?? 0;
  }
  result.speed += (MAX_LEVEL - 1) * speedPerLevel(template.faction);
  return result;
}

export function buildLevelBaseStats(
  template: CharacterTemplate,
): Stats {
  return applyLevelBonuses(template, createStats(template.base));
}
