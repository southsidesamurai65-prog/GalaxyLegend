import type { Effect } from './Effect';
import { nextEffectId } from './Effect';

export function createPoisonEffect(
  duration: number,
  damage: number,
  label?: string,
): Effect {
  return {
    id: nextEffectId(),
    kind: 'poison',
    name: label ?? '中毒',
    remainingActions: duration,
    poisonDamage: damage,
    description: label ?? `中毒（每次行动 -${damage} HP）`,
  };
}
