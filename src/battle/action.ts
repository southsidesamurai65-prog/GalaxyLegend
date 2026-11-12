import type { Unit } from './Unit';

export type ActionDecision =
  | { type: 'skip'; reason: 'lock' | 'freeze' }
  | { type: 'skill' }
  | { type: 'normal' };

export function decideAction(unit: Unit): ActionDecision {
  const lock = unit.lockKind();
  if (lock) return { type: 'skip', reason: lock };
  if (unit.charge >= 100 && !unit.isSilenced() && unit.skill) {
    return { type: 'skill' };
  }
  return { type: 'normal' };
}
