import type { AttributeKey, EffectKind } from '../../core/types';
import type { Modifier } from '../../core/modifiers';

export type EffectSpec =
  | { kind: 'shield'; duration: number; absorb: number; chance?: number }
  | { kind: 'lock'; duration: number; chance?: number }
  | { kind: 'silence'; duration: number; chance?: number }
  | {
      kind: 'statBuff';
      duration: number;
      stat: AttributeKey;
      add?: number;
      mul?: number;
      label: string;
      chance?: number;
    }
  | { kind: 'freeze'; duration: number; chance?: number; defDownPercent?: number }
  | { kind: 'stealth'; duration: number; chance?: number }
  | {
      kind: 'poison';
      duration: number;
      damage: number;
      label?: string;
      chance?: number;
    };

export interface Effect {
  id: string;
  kind: EffectKind;
  name: string;
  /** 按“受影响单位自身的行动次数”计算，行动结束时 -1。 */
  remainingActions: number;
  /** 仅护盾使用：剩余可吸收伤害。 */
  absorb?: number;
  /** 仅中毒使用：每次行动结束时损失的 HP。 */
  poisonDamage?: number;
  /** 仅属性增益/减益使用：动态属性修正。 */
  statMods?: Modifier[];
  /** 用于日志和 UI 的简短说明，例如“物理攻击 -50%”。 */
  description?: string;
  source?: string;
}

let effectSequence = 0;

export function nextEffectId(): string {
  effectSequence += 1;
  return `effect-${effectSequence}`;
}

export const EFFECT_LABELS: Record<EffectKind, string> = {
  shield: '护盾',
  lock: '锁定',
  silence: '禁技',
  statBuff: '属性变化',
  freeze: '冰冻',
  stealth: '隐身',
  poison: '中毒',
};
