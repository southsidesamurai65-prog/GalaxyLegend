import type { AttributeKey } from '../../core/types';
import type { Modifier } from '../../core/modifiers';
import type { Effect } from './Effect';
import { nextEffectId } from './Effect';

export function createStatBuffEffect(options: {
  stat: AttributeKey;
  duration: number;
  label: string;
  add?: number;
  mul?: number;
  source?: string;
}): Effect {
  const modifier: Modifier = { key: options.stat };
  if (options.add !== undefined) modifier.add = options.add;
  if (options.mul !== undefined) modifier.mul = options.mul;

  return {
    id: nextEffectId(),
    kind: 'statBuff',
    name: options.label,
    remainingActions: options.duration,
    statMods: [modifier],
    description: options.label,
    source: options.source,
  };
}
