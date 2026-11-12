import type { AttributeKey, Coord, Side, Stats, EffectKind } from '../core/types';
import { MAX_CHARGE } from '../core/types';
import { applyModifiers } from '../core/modifiers';
import type { Effect } from './effects/Effect';
import type { SkillDef } from '../skills/Skill';

export interface UnitInit {
  id: string;
  name: string;
  role: string;
  faction?: string;
  rarity?: string;
  destroyer: boolean;
  noHitCharge?: boolean;
  passiveDescription?: string;
  side: Side;
  coord: Coord;
  stats: Stats;
  skill: SkillDef;
}

export class Unit {
  readonly id: string;
  readonly name: string;
  readonly role: string;
  readonly faction?: string;
  readonly rarity?: string;
  readonly destroyer: boolean;
  readonly noHitCharge: boolean;
  readonly passiveDescription?: string;
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
    this.faction = init.faction;
    this.rarity = init.rarity;
    this.destroyer = init.destroyer;
    this.noHitCharge = !!init.noHitCharge;
    this.passiveDescription = init.passiveDescription;
    this.side = init.side;
    this.coord = { ...init.coord };
    this.stats = init.stats;
    this.skill = init.skill;
    this.maxHp = init.stats.hp;
    this.hp = this.maxHp;
    this.charge = Math.min(MAX_CHARGE, Math.max(0, init.stats.initialCharge));
  }

  /** 基础属性 + 氪晶等永久修正；临时 buff/debuff 通过 getStats 叠加。 */
  getStats(): Stats {
    const mods = this.effects.flatMap((effect) => effect.statMods ?? []);
    return mods.length === 0 ? { ...this.stats } : applyModifiers(this.stats, mods);
  }

  getStat(key: AttributeKey): number {
    const hasTemporaryMods = this.effects.some(
      (effect) => (effect.statMods?.length ?? 0) > 0,
    );
    return hasTemporaryMods ? this.getStats()[key] : this.stats[key];
  }

  get offense(): number {
    return this.getStat(this.destroyer ? 'energyAtk' : 'physAtk');
  }

  lockKind(): 'lock' | 'freeze' | null {
    if (this.effects.some((effect) => effect.kind === 'freeze')) {
      return 'freeze';
    }
    if (this.effects.some((effect) => effect.kind === 'lock')) {
      return 'lock';
    }
    return null;
  }

  isLocked(): boolean {
    return this.lockKind() !== null;
  }

  isSilenced(): boolean {
    return this.effects.some((effect) => effect.kind === 'silence');
  }

  isStealthed(): boolean {
    return this.effects.some((effect) => effect.kind === 'stealth');
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
    return Math.max(
      1,
      Math.min(...shields.map((effect) => effect.remainingActions)),
    );
  }

  effectMaxDuration(kind: EffectKind): number {
    const effects = this.effects.filter((effect) => effect.kind === kind);
    if (effects.length === 0) return 0;
    return Math.max(
      1,
      Math.max(...effects.map((effect) => effect.remainingActions)),
    );
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

  /** 治疗，返回实际回复的 HP；不会超过最大 HP。 */
  heal(amount: number): number {
    if (!this.alive || amount <= 0) return 0;
    const before = this.hp;
    this.hp = Math.min(this.maxHp, this.hp + amount);
    return this.hp - before;
  }

  /** 中毒等直接损失 HP，不经过护盾和防御。 */
  takeTrueDamage(amount: number): boolean {
    this.hp = Math.max(0, this.hp - amount);
    const died = this.hp <= 0 && this.alive;
    if (died) this.alive = false;
    return died;
  }

  /**
   * 在受影响单位每次行动开始前调用。
   * x 回合效果会在第 x+1 次行动开始前移除，因此第 x 次行动和其间的其他单位行动都还能享受效果。
   * 行动中新获得的效果不会立刻掉层。
   */
  tickEffects(effectsAtStart: Effect[]): Effect[] {
    const expired: Effect[] = [];
    for (const effect of effectsAtStart) {
      if (!this.effects.includes(effect)) continue;
      effect.remainingActions -= 1;
      if (effect.remainingActions < 0) {
        this.removeEffect(effect);
        expired.push(effect);
      }
    }
    return expired;
  }
}
