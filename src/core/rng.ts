export interface Rng {
  next(): number;
  chance(percent: number): boolean;
}

/** mulberry32：可注入种子，方便复现战斗和写测试。 */
export function createRng(seed: number): Rng {
  let state = seed >>> 0;
  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    chance(percent: number): boolean {
      if (percent <= 0) return false;
      if (percent >= 100) return true;
      return next() * 100 < percent;
    },
  };
}
