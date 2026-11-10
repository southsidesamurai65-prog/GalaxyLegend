import type { Stats } from '../core/types';

export interface CharacterTemplate {
  id: string;
  name: string;
  role: string;
  destroyer?: boolean;
  color: string;
  crystalSlots: number;
  skillId: string;
  base: Partial<Stats>;
}

export const CHARACTERS: CharacterTemplate[] = [
  {
    id: 'destroyer',
    name: '破晓',
    role: '毁灭者',
    destroyer: true,
    color: '#fb923c',
    crystalSlots: 3,
    skillId: 'piercing-ray',
    base: {
      hp: 1150,
      energyAtk: 155,
      skillAtk: 45,
      physDef: 45,
      skillDef: 30,
      initialCharge: 50,
      speed: 12,
      hit: 96,
      dodge: 6,
      crit: 16,
      antiCrit: 5,
      critDamage: 165,
    },
  },
  {
    id: 'guardian',
    name: '星盾',
    role: '守护',
    color: '#38bdf8',
    crystalSlots: 3,
    skillId: 'star-shield',
    base: {
      hp: 1350,
      physAtk: 100,
      skillAtk: 35,
      physDef: 65,
      skillDef: 55,
      initialCharge: 50,
      speed: 9,
      hit: 95,
      dodge: 8,
      crit: 8,
      antiCrit: 12,
      critDamage: 150,
    },
  },
  {
    id: 'controller',
    name: '锁链',
    role: '控制',
    color: '#a78bfa',
    crystalSlots: 3,
    skillId: 'chain-lock',
    base: {
      hp: 1050,
      physAtk: 115,
      skillAtk: 55,
      physDef: 40,
      skillDef: 45,
      initialCharge: 50,
      speed: 14,
      hit: 100,
      dodge: 10,
      crit: 10,
      antiCrit: 6,
      critDamage: 150,
    },
  },
  {
    id: 'holy',
    name: '圣光',
    role: '圣职',
    color: '#facc15',
    crystalSlots: 3,
    skillId: 'holy-cross',
    base: {
      hp: 1000,
      physAtk: 95,
      skillAtk: 75,
      physDef: 35,
      skillDef: 60,
      initialCharge: 50,
      speed: 11,
      hit: 100,
      dodge: 8,
      crit: 12,
      antiCrit: 8,
      critDamage: 155,
    },
  },
  {
    id: 'assassin',
    name: '疾风',
    role: '刺客',
    color: '#22d3ee',
    crystalSlots: 3,
    skillId: 'swift-volley',
    base: {
      hp: 900,
      physAtk: 135,
      skillAtk: 30,
      physDef: 30,
      skillDef: 25,
      initialCharge: 70,
      speed: 20,
      hit: 105,
      dodge: 18,
      crit: 30,
      antiCrit: 2,
      critDamage: 180,
    },
  },
  {
    id: 'mage',
    name: '群星',
    role: '法师',
    color: '#f472b6',
    crystalSlots: 3,
    skillId: 'silence-wave',
    base: {
      hp: 950,
      physAtk: 100,
      skillAtk: 70,
      physDef: 30,
      skillDef: 50,
      initialCharge: 50,
      speed: 13,
      hit: 100,
      dodge: 6,
      crit: 15,
      antiCrit: 5,
      critDamage: 160,
    },
  },
];

export const CHARACTER_MAP: Record<string, CharacterTemplate> = Object.fromEntries(
  CHARACTERS.map((character) => [character.id, character]),
);

export function getCharacter(id: string): CharacterTemplate {
  const character = CHARACTER_MAP[id];
  if (!character) throw new Error(`Unknown character: ${id}`);
  return character;
}
