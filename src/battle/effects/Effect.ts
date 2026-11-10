import type { EffectKind } from '../../core/types';

export type EffectSpec =
  | { kind: 'shield'; duration: number; absorb: number }
  | { kind: 'lock'; duration: number }
  | { kind: 'silence'; duration: number };

export interface Effect {
  id: string;
  kind: EffectKind;
  name: string;
  /** 按“受影响单位自身的行动次数”计算，行动结束时 -1。 */
  remainingActions: number;
  /** 仅护盾使用：剩余可吸收伤害。 */
  absorb?: number;
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
};
