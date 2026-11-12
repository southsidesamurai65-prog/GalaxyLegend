import kejingRaw from '../../kejing.txt?raw';
import type { AttributeKey } from '../core/types';
import type { Modifier } from '../core/modifiers';
import { ATTRIBUTE_DEFS } from '../core/attributes';

export type CrystalRarity = 'R4' | 'R5';

export interface CrystalDef {
  id: string;
  name: string;
  rarity: CrystalRarity;
  /** 战斗时使用的氪晶等级；R5 默认 7 级。 */
  level: number;
  description: string;
  color: string;
  mods: Modifier[];
}

const DEFAULT_R5_LEVEL = 7;

const STAT_COLORS: Partial<Record<AttributeKey, string>> = {
  initialCharge: '#fbbf24',
  physAtk: '#f87171',
  skillAtk: '#c084fc',
  energyAtk: '#fb923c',
  physDef: '#38bdf8',
  skillDef: '#818cf8',
  hit: '#4ade80',
  crit: '#facc15',
  armorBreak: '#fb7185',
  intercept: '#a78bfa',
  dodge: '#2dd4bf',
  antiCrit: '#94a3b8',
  critDamage: '#f97316',
};

const LABEL_TO_KEY = new Map<string, AttributeKey>(
  (Object.keys(ATTRIBUTE_DEFS) as AttributeKey[]).map((key) => [
    ATTRIBUTE_DEFS[key].label,
    key,
  ]),
);

const CRYSTAL_LINE =
  /^(R[45])([\u4e00-\u9fa5A-Za-z0-9]+)[，,]\s*(.+)$/;
const R5_LEVEL_LINE = /R5氪晶打架默认按照(\d+)级/;

interface ParsedEffect {
  stat: string;
  value: number;
  percent: boolean;
}

function parseEffect(text: string): ParsedEffect | null {
  const trimmed = text.trim();
  const prefix = trimmed.match(/^([+\-])(\d+(?:\.\d+)?)(%?)(.+)$/);
  if (prefix) {
    return {
      stat: prefix[4].trim(),
      value: (prefix[1] === '-' ? -1 : 1) * Number(prefix[2]),
      percent: prefix[3] === '%',
    };
  }

  const suffix = trimmed.match(/^(.+?)([+\-])(\d+(?:\.\d+)?)(%?)$/);
  if (!suffix) return null;
  return {
    stat: suffix[1].trim(),
    value: (suffix[2] === '-' ? -1 : 1) * Number(suffix[3]),
    percent: suffix[4] === '%',
  };
}

function parsePerLevel(text: string): number {
  const match = text
    .trim()
    .match(/^([+\-])(\d+(?:\.\d+)?)(%?)\s*\/\s*(?:级|lv)$/i);
  if (!match) return 0;
  return (match[1] === '-' ? -1 : 1) * Number(match[2]);
}

function cleanNumber(value: number): string {
  return String(Number(value.toFixed(2)));
}

function buildDescription(key: AttributeKey, value: number): string {
  const def = ATTRIBUTE_DEFS[key];
  const suffix = def.category === 'percent' ? '%' : '';
  return `${def.label} +${cleanNumber(value)}${suffix}`;
}

function uniqueId(name: string, used: Set<string>): string {
  if (!used.has(name)) return name;
  let index = 2;
  while (used.has(`${name}#${index}`)) index += 1;
  return `${name}#${index}`;
}

function parseCrystals(): { crystals: CrystalDef[]; warnings: string[] } {
  const crystals: CrystalDef[] = [];
  const warnings: string[] = [];
  const usedIds = new Set<string>();
  let r5Level = DEFAULT_R5_LEVEL;

  for (const rawLine of kejingRaw.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    const levelMatch = line.match(R5_LEVEL_LINE);
    if (levelMatch) {
      r5Level = Number(levelMatch[1]);
      continue;
    }

    const match = line.match(CRYSTAL_LINE);
    if (!match) continue;

    const rarity = match[1] as CrystalRarity;
    const name = match[2];
    const parts = match[3]
      .split(/[，,]/)
      .map((part) => part.trim())
      .filter(Boolean);
    const effect = parseEffect(parts[0] ?? '');
    if (!effect) {
      warnings.push(`氪晶【${name}】无法解析属性：${line}`);
      continue;
    }

    const key = LABEL_TO_KEY.get(effect.stat);
    if (!key) {
      warnings.push(`氪晶【${name}】无法识别属性【${effect.stat}】`);
      continue;
    }

    const level = rarity === 'R5' ? r5Level : 1;
    const perLevel = parts[1] ? parsePerLevel(parts[1]) : 0;
    const value =
      effect.value + (rarity === 'R5' ? perLevel * (level - 1) : 0);

    const mod: Modifier = { key, add: value };
    const id = uniqueId(name, usedIds);
    usedIds.add(id);

    crystals.push({
      id,
      name,
      rarity,
      level,
      description: buildDescription(key, value),
      color: STAT_COLORS[key] ?? '#94a3b8',
      mods: [mod],
    });
  }

  return { crystals, warnings };
}

const parsed = parseCrystals();

export const CRYSTALS: CrystalDef[] = parsed.crystals;
export const CRYSTAL_WARNINGS = parsed.warnings;

export const CRYSTAL_MAP: Record<string, CrystalDef> = Object.fromEntries(
  CRYSTALS.map((crystal) => [crystal.id, crystal]),
);

export function getCrystal(id: string): CrystalDef {
  const crystal = CRYSTAL_MAP[id];
  if (!crystal) throw new Error(`Unknown crystal: ${id}`);
  return crystal;
}

export function describeCrystalMods(crystal: CrystalDef): string {
  return crystal.mods
    .map((mod) => {
      const label = ATTRIBUTE_DEFS[mod.key].label;
      if (mod.mul !== undefined) {
        const percent = Math.round((mod.mul - 1) * 100);
        return `${percent >= 0 ? '+' : ''}${percent}% ${label}`;
      }
      const value = mod.add ?? 0;
      return `${value >= 0 ? '+' : ''}${value} ${label}`;
    })
    .join('，');
}

if (CRYSTAL_WARNINGS.length > 0) {
  console.warn('[kejing]', ...CRYSTAL_WARNINGS);
}
