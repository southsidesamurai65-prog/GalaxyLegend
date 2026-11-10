import type { Modifier } from '../core/modifiers';
import { ATTRIBUTE_DEFS } from '../core/attributes';

export interface CrystalDef {
  id: string;
  name: string;
  description: string;
  color: string;
  mods: Modifier[];
}

export const CRYSTALS: CrystalDef[] = [
  {
    id: 'atk-core',
    name: '攻击核心',
    description: '+25 物理攻击',
    color: '#f87171',
    mods: [{ key: 'physAtk', add: 25 }],
  },
  {
    id: 'energy-core',
    name: '能量核心',
    description: '+25 能量攻击',
    color: '#fb923c',
    mods: [{ key: 'energyAtk', add: 25 }],
  },
  {
    id: 'skill-core',
    name: '技能核心',
    description: '+25 技能攻击',
    color: '#c084fc',
    mods: [{ key: 'skillAtk', add: 25 }],
  },
  {
    id: 'hp-plate',
    name: '生命装甲',
    description: '+180 HP',
    color: '#22c55e',
    mods: [{ key: 'hp', add: 180 }],
  },
  {
    id: 'guard-plate',
    name: '物防装甲',
    description: '+18 物理防御',
    color: '#38bdf8',
    mods: [{ key: 'physDef', add: 18 }],
  },
  {
    id: 'ward-plate',
    name: '技防装甲',
    description: '+18 技能防御',
    color: '#818cf8',
    mods: [{ key: 'skillDef', add: 18 }],
  },
  {
    id: 'speed-chip',
    name: '速度芯片',
    description: '+3 速度',
    color: '#22d3ee',
    mods: [{ key: 'speed', add: 3 }],
  },
  {
    id: 'charge-chip',
    name: '蓄能芯片',
    description: '+15 初始蓄能',
    color: '#fbbf24',
    mods: [{ key: 'initialCharge', add: 15 }],
  },
  {
    id: 'hit-chip',
    name: '瞄准芯片',
    description: '+8 命中',
    color: '#4ade80',
    mods: [{ key: 'hit', add: 8 }],
  },
  {
    id: 'dodge-chip',
    name: '闪避芯片',
    description: '+6 闪避',
    color: '#2dd4bf',
    mods: [{ key: 'dodge', add: 6 }],
  },
  {
    id: 'crit-chip',
    name: '暴击芯片',
    description: '+8 暴击',
    color: '#facc15',
    mods: [{ key: 'crit', add: 8 }],
  },
  {
    id: 'anti-crit-chip',
    name: '免爆芯片',
    description: '+6 免爆',
    color: '#94a3b8',
    mods: [{ key: 'antiCrit', add: 6 }],
  },
  {
    id: 'crit-dmg-chip',
    name: '暴伤芯片',
    description: '+20 暴击伤害',
    color: '#f97316',
    mods: [{ key: 'critDamage', add: 20 }],
  },
];

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
      const value = mod.add ?? 0;
      return `${value >= 0 ? '+' : ''}${value} ${label}`;
    })
    .join('，');
}
