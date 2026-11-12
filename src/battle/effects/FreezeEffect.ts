import type { Modifier } from '../../core/modifiers';
import type { Effect } from './Effect';
import { nextEffectId } from './Effect';

export function createFreezeEffect(
  duration: number,
  defDownPercent = 20,
): Effect {
  const modifier: Modifier = {
    key: 'physDef',
    mul: Math.max(0, 1 - defDownPercent / 100),
  };
  return {
    id: nextEffectId(),
    kind: 'freeze',
    name: '冰冻',
    remainingActions: duration,
    statMods: [modifier],
    description: `冰冻（锁定 + 物理防御 -${defDownPercent}%）`,
  };
}
