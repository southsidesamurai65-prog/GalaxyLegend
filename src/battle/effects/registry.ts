import type { Effect, EffectSpec } from './Effect';
import { createShieldEffect } from './ShieldEffect';
import { createLockEffect } from './LockEffect';
import { createSilenceEffect } from './SilenceEffect';

export function createEffectFromSpec(spec: EffectSpec, source?: string): Effect {
  switch (spec.kind) {
    case 'shield':
      return createShieldEffect(spec.absorb, spec.duration, source);
    case 'lock':
      return createLockEffect(spec.duration, source);
    case 'silence':
      return createSilenceEffect(spec.duration, source);
  }
}
