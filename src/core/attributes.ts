import type { AttributeDef, AttributeKey, Stats } from './types';

export const ATTRIBUTE_DEFS: Record<AttributeKey, AttributeDef> = {
  physAtk: {
    key: 'physAtk',
    label: '物理攻击',
    category: 'absolute',
    defaultValue: 0,
    min: 0,
  },
  energyAtk: {
    key: 'energyAtk',
    label: '能量攻击',
    category: 'absolute',
    defaultValue: 0,
    min: 0,
  },
  skillAtk: {
    key: 'skillAtk',
    label: '技能攻击',
    category: 'absolute',
    defaultValue: 0,
    min: 0,
  },
  physDef: {
    key: 'physDef',
    label: '物理防御',
    category: 'absolute',
    defaultValue: 0,
    min: 0,
  },
  skillDef: {
    key: 'skillDef',
    label: '技能防御',
    category: 'absolute',
    defaultValue: 0,
    min: 0,
  },
  energyDef: {
    key: 'energyDef',
    label: '能量防御',
    category: 'absolute',
    defaultValue: 0,
    min: 0,
  },
  hp: {
    key: 'hp',
    label: 'HP',
    category: 'absolute',
    defaultValue: 1000,
    min: 1,
  },
  initialCharge: {
    key: 'initialCharge',
    label: '初始蓄能',
    category: 'absolute',
    defaultValue: 50,
    min: 0,
    max: 300,
  },
  speed: {
    key: 'speed',
    label: '速度',
    category: 'absolute',
    defaultValue: 10,
    min: 0,
  },
  hit: {
    key: 'hit',
    label: '命中',
    category: 'percent',
    defaultValue: 100,
    min: 0,
  },
  dodge: {
    key: 'dodge',
    label: '闪避',
    category: 'percent',
    defaultValue: 0,
    min: 0,
  },
  crit: {
    key: 'crit',
    label: '暴击',
    category: 'percent',
    defaultValue: 0,
    min: 0,
  },
  antiCrit: {
    key: 'antiCrit',
    label: '免爆',
    category: 'percent',
    defaultValue: 0,
    min: 0,
  },
  critDamage: {
    key: 'critDamage',
    label: '暴击伤害',
    category: 'percent',
    defaultValue: 150,
    min: 100,
  },
  intercept: {
    key: 'intercept',
    label: '拦截',
    category: 'percent',
    defaultValue: 0,
    min: 0,
  },
  armorBreak: {
    key: 'armorBreak',
    label: '破防',
    category: 'percent',
    defaultValue: 0,
    min: 0,
  },
};

export const ATTRIBUTE_KEYS = Object.keys(ATTRIBUTE_DEFS) as AttributeKey[];

export function createStats(overrides: Partial<Stats> = {}): Stats {
  const stats = {} as Stats;
  for (const key of ATTRIBUTE_KEYS) {
    stats[key] = ATTRIBUTE_DEFS[key].defaultValue;
  }
  for (const key of ATTRIBUTE_KEYS) {
    const value = overrides[key];
    if (value !== undefined) stats[key] = value;
  }
  for (const key of ATTRIBUTE_KEYS) {
    stats[key] = clampStat(key, stats[key]);
  }
  return stats;
}

export function clampStat(key: AttributeKey, value: number): number {
  const def = ATTRIBUTE_DEFS[key];
  let result = Number.isFinite(value) ? value : def.defaultValue;
  if (def.min !== undefined) result = Math.max(def.min, result);
  if (def.max !== undefined) result = Math.min(def.max, result);
  return result;
}

export function formatAttribute(key: AttributeKey, value: number): string {
  const def = ATTRIBUTE_DEFS[key];
  const rounded = Math.round(value);
  return def.category === 'percent' ? `${rounded}%` : `${rounded}`;
}

export function attributeLabel(key: AttributeKey): string {
  return ATTRIBUTE_DEFS[key].label;
}
