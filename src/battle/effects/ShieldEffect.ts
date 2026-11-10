import type { Effect } from './Effect';
import { nextEffectId } from './Effect';

export function createShieldEffect(absorb: number, duration: number, source?: string): Effect {
  return {
    id: nextEffectId(),
    kind: 'shield',
    name: '护盾',
    remainingActions: duration,
    absorb,
    source,
  };
}
