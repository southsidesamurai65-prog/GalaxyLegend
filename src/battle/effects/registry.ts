import type { Effect, EffectSpec } from './Effect';
import { createShieldEffect } from './ShieldEffect';
import { createLockEffect } from './LockEffect';
import { createSilenceEffect } from './SilenceEffect';
import { createStatBuffEffect } from './StatBuffEffect';
import { createFreezeEffect } from './FreezeEffect';
import { createStealthEffect } from './StealthEffect';
import { createPoisonEffect } from './PoisonEffect';

export function createEffectFromSpec(spec: EffectSpec, source?: string): Effect {
  switch (spec.kind) {
    case 'shield':
      return createShieldEffect(spec.absorb, spec.duration, source);
    case 'lock':
      return createLockEffect(spec.duration, source);
    case 'silence':
      return createSilenceEffect(spec.duration, source);
    case 'statBuff':
      return createStatBuffEffect({
        stat: spec.stat,
        duration: spec.duration,
        label: spec.label,
        add: spec.add,
        mul: spec.mul,
        source,
      });
    case 'freeze':
      return createFreezeEffect(spec.duration, spec.defDownPercent);
    case 'stealth':
      return createStealthEffect(spec.duration);
    case 'poison':
      return createPoisonEffect(spec.duration, spec.damage, spec.label);
  }
}
