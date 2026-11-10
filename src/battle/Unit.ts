import type { Coord, Side, Stats, EffectKind } from '../core/types';
import { MAX_CHARGE } from '../core/types';
import type { Effect } from './effects/Effect';
import type { SkillDef } from '../skills/Skill';

export interface UnitInit {
  id: string;
  name: string;
  role: string;
  destroyer: boolean;
  side: Side;
  coord: Coord;
  stats: Stats;
  skill: SkillDef;
}

export class Unit {
  readonly id: string;
  readonly name: string;
  readonly role: string;
  readonly destroyer: boolean;
  readonly side: Side;
  readonly stats: Stats;
  readonly maxHp: number;
  readonly skill: SkillDef;

  coord: Coord;
  hp: number;
  charge: number;
  effects: Effect[] = [];
  alive = true;

  constructor(init: UnitInit) {
    this.id = init.id;
    this.name = init.name;
    this.role = init.role;
    this.destroyer = init.destroyer;
    this.side = init.side;
    this.coord = { ...init.coord };
    this.stats = init.stats;
    this.skill = init.skill;
    this.maxHp = init.stats.hp;
    this.hp = this.maxHp;
    this.charge = Math.min(MAX_CHARGE, Math.max(0, init.stats.initialCharge));
  }

  get offense(): number {
    return this.destroyer ? this.stats.energyAtk : this.stats.physAtk;
  }

  isLocked(): boolean {
    return this.effects.some((effect) => effect.kind === 'lock');
  }

  isSilenced(): boolean {
    return this.effects.some((effect) => effect.kind === 'silence');
  }

  hasEffect(kind: EffectKind): boolean {
    return this.effects.some((effect) => effect.kind === kind);
  }

  gainCharge(amount: number): number {
    if (amount === 0 || !this.alive) return 0;
    const before = this.charge;
    this.charge = Math.min(MAX_CHARGE, Math.max(0, this.charge + amount));
    return this.charge - before;
  }

  addEffect(effect: Effect): void {
    this.effects.push(effect);
  }

  removeEffect(effect: Effect): void {
    this.effects = this.effects.filter((current) => current !== effect);
  }

  clearEffects(): void {
    this.effects = [];
  }

  shieldTotal(): number {
    return this.effects
      .filter((effect) => effect.kind === 'shield')
      .reduce((total, effect) => total + (effect.absorb ?? 0), 0);
  }

  shieldMinDuration(): number {
    const shields = this.effects.filter(
      (effect) => effect.kind === 'shield' && (effect.absorb ?? 0) > 0,
    );
    if (shields.length === 0) return 0;
    return Math.min(...shields.map((effect) => effect.remainingActions));
  }

  effectMaxDuration(kind: EffectKind): number {
    const effects = this.effects.filter((effect) => effect.kind === kind);
    if (effects.length === 0) return 0;
    return Math.max(...effects.map((effect) => effect.remainingActions));
  }

  /**
   * 护盾先于 HP 扣除，多个护盾按加入顺序依次吸收。
   * 返回本次实际被护盾吸收的量、进入 HP 的量，以及是否死亡。
   */
  takeDamage(amount: number): {
    shieldAbsorbed: number;
    hpDamage: number;
    died: boolean;
  } {
    let remaining = amount;
    let shieldAbsorbed = 0;

    for (const effect of [...this.effects]) {
      if (remaining <= 0) break;
      if (effect.kind !== 'shield') continue;
      const available = effect.absorb ?? 0;
      if (available <= 0) continue;
      const absorbed = Math.min(available, remaining);
      effect.absorb = available - absorbed;
      remaining -= absorbed;
      shieldAbsorbed += absorbed;
      if ((effect.absorb ?? 0) <= 0) this.removeEffect(effect);
    }

    const hpDamage = remaining;
    this.hp = Math.max(0, this.hp - hpDamage);
    const died = this.hp <= 0 && this.alive;
    if (died) this.alive = false;

    return { shieldAbsorbed, hpDamage, died };
  }

  /**
   * 只递减“本次行动开始时已经存在”的效果。
   * 本次行动中新获得的效果不会立刻掉一层。
   */
  tickEffects(effectsAtStart: Effect[]): Effect[] {
    const expired: Effect[] = [];
    for (const effect of effectsAtStart) {
      if (!this.effects.includes(effect)) continue;
      effect.remainingActions -= 1;
      if (effect.remainingActions <= 0) {
        this.removeEffect(effect);
        expired.push(effect);
      }
    }
    return expired;
  }
}
