import type { Unit } from './Unit';

export type ActionDecision =
  | { type: 'skip'; reason: 'lock' }
  | { type: 'skill' }
  | { type: 'normal' };

export function decideAction(unit: Unit): ActionDecision {
  if (unit.isLocked()) return { type: 'skip', reason: 'lock' };
  if (unit.charge >= 100 && !unit.isSilenced() && unit.skill) {
    return { type: 'skill' };
  }
  return { type: 'normal' };
}
