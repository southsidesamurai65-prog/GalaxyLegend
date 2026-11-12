import type { Effect } from './Effect';
import { nextEffectId } from './Effect';

export function createStealthEffect(duration: number): Effect {
  return {
    id: nextEffectId(),
    kind: 'stealth',
    name: '隐身',
    remainingActions: duration,
    description: '隐身（无法被选为靶点或攻击到）',
  };
}
