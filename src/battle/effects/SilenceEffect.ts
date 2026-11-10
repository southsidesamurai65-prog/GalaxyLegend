import type { Effect } from './Effect';
import { nextEffectId } from './Effect';

export function createSilenceEffect(duration: number, source?: string): Effect {
  return {
    id: nextEffectId(),
    kind: 'silence',
    name: '禁技',
    remainingActions: duration,
    source,
  };
}
