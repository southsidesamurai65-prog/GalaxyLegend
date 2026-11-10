import type { AttributeKey, Stats } from './types';
import { ATTRIBUTE_KEYS, clampStat } from './attributes';

export interface Modifier {
  key: AttributeKey;
  add?: number;
  mul?: number;
}

/**
 * 所有属性来源（氪晶、buff、光环等）都先转成 Modifier，
 * 最后一次性聚合，避免不同系统直接改 Unit 的 stats。
 */
export function applyModifiers(base: Stats, mods: Modifier[]): Stats {
  const result: Stats = { ...base };

  for (const mod of mods) {
    if (mod.add !== undefined) result[mod.key] += mod.add;
  }
  for (const mod of mods) {
    if (mod.mul !== undefined) result[mod.key] *= mod.mul;
  }
  for (const key of ATTRIBUTE_KEYS) {
    result[key] = clampStat(key, result[key]);
  }
  return result;
}

export function describeModifier(mod: Modifier): string {
  if (mod.add !== undefined) return `${mod.add >= 0 ? '+' : ''}${mod.add}`;
  if (mod.mul !== undefined) return `×${mod.mul}`;
  return '—';
}
