import type { Effect } from './Effect';
import { nextEffectId } from './Effect';

export function createLockEffect(duration: number, source?: string): Effect {
  return {
    id: nextEffectId(),
    kind: 'lock',
    name: '锁定',
    remainingActions: duration,
    source,
  };
}
