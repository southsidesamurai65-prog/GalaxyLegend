import type { SkillDef } from './Skill';

export const SKILLS: Record<string, SkillDef> = {
  'piercing-ray': {
    id: 'piercing-ray',
    name: '湮灭射线',
    description: '单体 180% 伤害；毁灭者以能量攻击结算并无视物理防御。',
    shape: 'single',
    baseMultiplier: 1.8,
  },
  'star-shield': {
    id: 'star-shield',
    name: '星盾展开',
    description: '单体 100% 伤害，并为自身附加 150 护盾（持续 2 次行动）。',
    shape: 'single',
    baseMultiplier: 1.0,
    selfEffects: [{ kind: 'shield', duration: 2, absorb: 150 }],
  },
  'chain-lock': {
    id: 'chain-lock',
    name: '锁链禁锢',
    description: '单体 80% 伤害，命中后锁定目标 1 次行动。',
    shape: 'single',
    baseMultiplier: 0.8,
    targetEffects: [{ kind: 'lock', duration: 1 }],
  },
  'holy-cross': {
    id: 'holy-cross',
    name: '圣光十字',
    description: '十字 120% 神圣伤害，无视物理防御和技能防御。',
    shape: 'cross',
    baseMultiplier: 1.2,
    holy: true,
  },
  'swift-volley': {
    id: 'swift-volley',
    name: '疾风连射',
    description: '同列 130% 伤害。',
    shape: 'sameColumn',
    baseMultiplier: 1.3,
  },
  'silence-wave': {
    id: 'silence-wave',
    name: '静默星波',
    description: '同行 100% 伤害，命中后禁技 2 次行动。',
    shape: 'sameRow',
    baseMultiplier: 1.0,
    targetEffects: [{ kind: 'silence', duration: 2 }],
  },
};
