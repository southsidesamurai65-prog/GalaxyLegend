import type { BattleEvent } from '../core/events';
import type { Rng } from '../core/rng';
import { createRng } from '../core/rng';
import type { Side } from '../core/types';
import { MAX_CHARGE, otherSide } from '../core/types';
import { Board } from './Board';
import { Unit } from './Unit';
import { findAnchor } from './targeting';
import { rollDamage, type DamageResult } from './damage';
import { decideAction } from './action';
import { resolveTargets } from '../skills/shapes';
import { createEffectFromSpec } from './effects/registry';
import { EFFECT_LABELS, type EffectSpec } from './effects/Effect';
import type { DamageKind } from '../core/types';

export interface BattleOptions {
  playerUnits: Unit[];
  enemyUnits: Unit[];
  seed: number;
  /** 测试时可注入固定随机源。 */
  rng?: Rng;
}

export class Battle {
  readonly board = new Board();
  readonly rng: Rng;
  readonly speedTotals: Record<Side, number>;
  readonly firstSide: Side;

  round = 1;
  queue: Unit[] = [];
  finished = false;
  winner: Side | null = null;
  currentUnit: Unit | null = null;

  private roundStarted = false;

  constructor(options: BattleOptions) {
    for (const unit of options.playerUnits) this.board.place(unit);
    for (const unit of options.enemyUnits) this.board.place(unit);

    this.rng = options.rng ?? createRng(options.seed);
    this.speedTotals = {
      player: options.playerUnits.reduce((total, unit) => total + unit.stats.speed, 0),
      enemy: options.enemyUnits.reduce((total, unit) => total + unit.stats.speed, 0),
    };
    // 总速度只在开局判定一次；相同则我方先手。
    this.firstSide =
      this.speedTotals.player >= this.speedTotals.enemy ? 'player' : 'enemy';
  }

  /**
   * 推进行动队列中的下一个单位行动。
   * 返回本次 step 产生的全部事件，UI 用它做日志和特效。
   */
  step(): BattleEvent[] {
    const events: BattleEvent[] = [];
    if (this.finished) return events;

    if (!this.roundStarted) {
      this.roundStarted = true;
      this.queue = this.buildQueue();
      events.push({ type: 'roundStart', round: this.round });
    }

    if (this.queue.length === 0) {
      events.push({ type: 'roundEnd', round: this.round });
      this.currentUnit = null;
      if (this.checkEnd(events)) return events;

      this.round += 1;
      this.roundStarted = true;
      this.queue = this.buildQueue();
      events.push({ type: 'roundStart', round: this.round });
    }

    let unit: Unit | null = null;
    while (this.queue.length > 0) {
      const candidate = this.queue.shift()!;
      if (candidate.alive) {
        unit = candidate;
        break;
      }
    }
    if (!unit) return events;

    this.currentUnit = unit;
    events.push({
      type: 'actionStart',
      unitId: unit.id,
      unitName: unit.name,
      side: unit.side,
      coord: unit.coord,
    });

    // 在出手前结算持续时间：x 回合效果会在第 x+1 次出手前移除。
    const expiredAtStart = unit.tickEffects([...unit.effects]);
    for (const effect of expiredAtStart) {
      events.push({
        type: 'effectExpired',
        unitId: unit.id,
        unitName: unit.name,
        side: unit.side,
        coord: unit.coord,
        effect: effect.kind,
        description: effect.description,
        stat: effect.kind === 'statBuff' ? effect.statMods?.[0]?.key : undefined,
      });
    }

    const effectsAtStart = [...unit.effects];
    const decision = decideAction(unit);

    if (decision.type === 'skip') {
      events.push({
        type: 'actionSkip',
        unitId: unit.id,
        unitName: unit.name,
        side: unit.side,
        coord: unit.coord,
        reason: decision.reason,
      });
    } else if (decision.type === 'skill') {
      this.performSkill(unit, events);
    } else {
      this.performNormal(unit, events);
    }

    if (unit.alive) {
      for (const effect of effectsAtStart) {
        if (effect.kind !== 'poison' || !unit.effects.includes(effect)) {
          continue;
        }
        const amount = effect.poisonDamage ?? 0;
        if (amount <= 0) continue;

        const died = unit.takeTrueDamage(amount);
        events.push({
          type: 'poison',
          unitId: unit.id,
          unitName: unit.name,
          side: unit.side,
          coord: unit.coord,
          amount,
        });

        if (died) {
          unit.clearEffects();
          this.board.remove(unit);
          events.push({
            type: 'death',
            unitId: unit.id,
            unitName: unit.name,
            side: unit.side,
            coord: unit.coord,
          });
          break;
        }
      }
    }

    this.checkEnd(events);
    return events;
  }

  private buildQueue(): Unit[] {
    const order = (side: Side): Unit[] =>
      this.board
        .aliveUnits(side)
        .sort(
          (a, b) => b.coord.y - a.coord.y || a.coord.x - b.coord.x,
        );

    const first = order(this.firstSide);
    const second = order(otherSide(this.firstSide));
    const queue: Unit[] = [];
    const max = Math.max(first.length, second.length);

    for (let index = 0; index < max; index += 1) {
      if (first[index]) queue.push(first[index]);
      if (second[index]) queue.push(second[index]);
    }
    return queue;
  }

  private performNormal(unit: Unit, events: BattleEvent[]): void {
    const anchor = findAnchor(unit, this.board);
    if (!anchor) return;

    events.push({
      type: 'normalAttack',
      attackerId: unit.id,
      attackerName: unit.name,
      attackerSide: unit.side,
      attackerCoord: unit.coord,
      targetId: anchor.id,
      targetName: anchor.name,
      targetSide: anchor.side,
      targetCoord: anchor.coord,
    });

    const result = rollDamage(
      { attacker: unit, target: anchor, kind: 'normal' },
      this.rng,
    );

    if (!result.hit) {
      events.push({
        type: 'miss',
        attackerName: unit.name,
        attackerSide: unit.side,
        targetName: anchor.name,
        targetSide: anchor.side,
        targetCoord: anchor.coord,
      });
      return;
    }

    this.applyHit(unit, anchor, result, 'normal', false, events);
    this.gainCharge(unit, 25, 'attack', events);
  }

  private performSkill(unit: Unit, events: BattleEvent[]): void {
    const skill = unit.skill;
    const anchor = skill.shape === 'self' ? null : findAnchor(unit, this.board);
    if (skill.shape !== 'self' && !anchor) return;

    const charge = unit.charge;
    const multiplier = skill.baseMultiplier * (charge / 100);
    const targets = anchor
      ? resolveTargets(skill.shape, unit, anchor, this.board)
      : [];

    // 默认释放后清空蓄能；chargeCostRatio 可让技能只消耗一部分。
    const costRatio = skill.chargeCostRatio ?? 1;
    const chargeAfter = Math.max(0, Math.floor(charge * (1 - costRatio)));
    unit.charge = chargeAfter;

    // 先确定自身/友方效果的落点，供 UI 绘制光环。
    const castApplications: Array<{ unit: Unit; spec: EffectSpec }> = [];
    if (skill.castEffects) {
      for (const cast of skill.castEffects) {
        const effectTargets =
          cast.target === 'self'
            ? [unit]
            : cast.target === 'allAllies'
              ? this.board.aliveUnits(unit.side)
              : cast.target === 'allAlliesExceptSelf'
                ? this.board
                    .aliveUnits(unit.side)
                    .filter((ally) => ally.id !== unit.id)
                : cast.target === 'randomAllies'
                  ? this.pickRandom(
                      this.board.aliveUnits(unit.side),
                      cast.count ?? 1,
                    )
                : cast.target === 'lowestHpAlly'
                  ? this.lowestHpAlly(unit)
                  : this.randomAlly(unit);
        for (const effectTarget of effectTargets) {
          castApplications.push({ unit: effectTarget, spec: cast.effect });
        }
      }
    }

    events.push({
      type: 'skillCast',
      casterId: unit.id,
      casterName: unit.name,
      casterSide: unit.side,
      casterCoord: unit.coord,
      anchorCoord: anchor?.coord ?? unit.coord,
      skillName: skill.name,
      shape: skill.shape,
      charge,
      chargeAfter,
      multiplier,
      targets: targets.map((target) => ({
        id: target.id,
        name: target.name,
        side: target.side,
        coord: target.coord,
      })),
      castEffectTargets: castApplications.map((application) => ({
        side: application.unit.side,
        coord: application.unit.coord,
        effect: application.spec.kind,
        stat:
          application.spec.kind === 'statBuff'
            ? application.spec.stat
            : undefined,
        description:
          application.spec.kind === 'statBuff'
            ? application.spec.label
            : undefined,
      })),
    });

    for (const application of castApplications) {
      this.applyEffect(
        application.unit,
        application.spec,
        unit.name,
        events,
      );
    }

    if (skill.selfChargeGain) {
      this.gainCharge(unit, skill.selfChargeGain, 'effect', events);
    }
    if (skill.teamChargeGain) {
      for (const ally of this.board.aliveUnits(unit.side)) {
        this.gainCharge(ally, skill.teamChargeGain, 'effect', events);
      }
    }

    this.applyHeal(unit, skill, events);

    let lastHitAmount = 0;
    for (const target of targets) {
      if (!target.alive) continue;

      const result = rollDamage(
        {
          attacker: unit,
          target,
          kind: 'skill',
          skill,
          charge,
          holy: !!skill.holy,
        },
        this.rng,
      );

      if (!result.hit) {
        events.push({
          type: 'miss',
          attackerName: unit.name,
          attackerSide: unit.side,
          targetName: target.name,
          targetSide: target.side,
          targetCoord: target.coord,
          skill: skill.name,
        });
        continue;
      }

      const bonusDamage = skill.flatHolyDamage ?? 0;
      if (bonusDamage > 0) result.amount += bonusDamage;
      lastHitAmount = result.amount;
      this.applyHit(unit, target, result, 'skill', !!skill.holy, events, {
        skipHitCharge: !!skill.skipHitCharge,
        bonusDamage,
      });

      if (
        target.alive &&
        skill.poisonPercent &&
        !skill.poisonRandomCount
      ) {
        const poisonDamage = Math.max(
          1,
          Math.floor((result.amount * skill.poisonPercent) / 100),
        );
        this.applyEffect(
          target,
          {
            kind: 'poison',
            duration: skill.poisonDuration ?? 2,
            damage: poisonDamage,
            label: `中毒 ${poisonDamage}`,
          },
          unit.name,
          events,
        );
      }

      if (target.alive && skill.targetChargeDelta !== undefined) {
        const before = target.charge;
        const after = Math.max(
          0,
          Math.min(MAX_CHARGE, before + skill.targetChargeDelta),
        );
        if (after !== before) {
          target.charge = after;
          events.push({
            type: 'charge',
            unitId: target.id,
            unitName: target.name,
            side: target.side,
            coord: target.coord,
            amount: after - before,
            total: after,
            reason: 'drain',
          });
        }
      }

      if (target.alive && skill.drainTargetCharge) {
        const before = target.charge;
        if (before > 0) {
          target.charge = 0;
          events.push({
            type: 'chargeDrained',
            unitId: target.id,
            unitName: target.name,
            side: target.side,
            coord: target.coord,
            amount: before,
            total: 0,
          });
        }
      }

      if (target.alive && skill.onHitEffects) {
        for (const spec of skill.onHitEffects) {
          this.applyEffect(target, spec, unit.name, events);
        }
      }
    }

    if (
      skill.poisonRandomCount &&
      skill.poisonPercent &&
      lastHitAmount > 0
    ) {
      const poisonDamage = Math.max(
        1,
        Math.floor((lastHitAmount * skill.poisonPercent) / 100),
      );
      const pool = this.board.aliveUnits(otherSide(unit.side));
      for (const target of this.pickRandom(pool, skill.poisonRandomCount)) {
        this.applyEffect(
          target,
          {
            kind: 'poison',
            duration: skill.poisonDuration ?? 2,
            damage: poisonDamage,
            label: `中毒 ${poisonDamage}`,
          },
          unit.name,
          events,
        );
      }
    }
  }

  private applyHeal(
    unit: Unit,
    skill: Unit['skill'],
    events: BattleEvent[],
  ): void {
    if (!skill.healPercent || !skill.healTargets?.length) return;

    const amount = Math.max(
      1,
      Math.round(
        ((unit.offense + unit.getStat('skillAtk')) * skill.healPercent) / 100,
      ),
    );
    const targets: Unit[] = [];

    for (const target of skill.healTargets) {
      if (target === 'self') targets.push(unit);
      else targets.push(...this.lowestHpOtherAlly(unit));
    }

    for (const target of new Set(targets)) {
      if (!target.alive) continue;
      const healed = target.heal(amount);
      if (healed <= 0) continue;
      events.push({
        type: 'heal',
        sourceName: unit.name,
        targetId: target.id,
        targetName: target.name,
        targetSide: target.side,
        targetCoord: target.coord,
        amount: healed,
      });
    }
  }

  private lowestHpOtherAlly(unit: Unit): Unit[] {
    const allies = this.board
      .aliveUnits(unit.side)
      .filter((ally) => ally.id !== unit.id);
    if (allies.length === 0) return [];
    return [
      allies.reduce((lowest, ally) => (ally.hp < lowest.hp ? ally : lowest)),
    ];
  }

  private pickRandom<T>(items: T[], count: number): T[] {
    const pool = [...items];
    const picked: T[] = [];
    const total = Math.min(count, pool.length);
    while (picked.length < total) {
      const index = Math.floor(this.rng.next() * pool.length);
      picked.push(...pool.splice(index, 1));
    }
    return picked;
  }

  private applyHit(
    attacker: Unit,
    target: Unit,
    result: DamageResult,
    kind: DamageKind,
    holy: boolean,
    events: BattleEvent[],
    options?: {
      skipHitCharge?: boolean;
      bonusDamage?: number;
      isCounter?: boolean;
    },
  ): void {
    const chance = this.interceptChance(attacker, target);
    const intercepted = chance > 0 && this.rng.chance(chance);
    const originalDamage = result.amount;

    if (intercepted) {
      result.amount = Math.max(1, Math.floor(result.amount * 0.5));
    }

    const { shieldAbsorbed, hpDamage, died } = target.takeDamage(result.amount);

    if (intercepted) {
      events.push({
        type: 'intercept',
        unitId: target.id,
        unitName: target.name,
        side: target.side,
        coord: target.coord,
        attackerName: attacker.name,
        attackerSide: attacker.side,
        attackerCoord: attacker.coord,
        kind,
        chance,
        originalDamage,
        reducedDamage: result.amount,
        counter:
          kind === 'normal' && !died && !options?.isCounter,
      });
    }

    events.push({
      type: 'damage',
      attackerName: attacker.name,
      attackerSide: attacker.side,
      targetId: target.id,
      targetName: target.name,
      targetSide: target.side,
      targetCoord: target.coord,
      amount: result.amount,
      shieldAbsorbed,
      hpDamage,
      bonusDamage: options?.bonusDamage,
      crit: result.crit,
      holy,
      kind,
    });

    if (died) {
      target.clearEffects();
      this.board.remove(target);
      events.push({
        type: 'death',
        unitId: target.id,
        unitName: target.name,
        side: target.side,
        coord: target.coord,
      });
    } else if (!options?.skipHitCharge && !target.noHitCharge) {
      // 每个受击单位每次行动最多 +25 一次。
      this.gainCharge(target, 25, 'hit', events);
    }

    if (
      intercepted &&
      kind === 'normal' &&
      target.alive &&
      !options?.isCounter
    ) {
      this.performCounterAttack(target, attacker, events);
    }
  }

  private interceptChance(attacker: Unit, target: Unit): number {
    return Math.min(
      100,
      Math.max(
        0,
        attacker.getStat('armorBreak') - target.getStat('intercept'),
      ),
    );
  }

  /** 拦截普通攻击后，以普通攻击的形式还击攻击者。 */
  private performCounterAttack(
    defender: Unit,
    attacker: Unit,
    events: BattleEvent[],
  ): void {
    if (!defender.alive || !attacker.alive) return;

    events.push({
      type: 'normalAttack',
      attackerId: defender.id,
      attackerName: defender.name,
      attackerSide: defender.side,
      attackerCoord: defender.coord,
      targetId: attacker.id,
      targetName: attacker.name,
      targetSide: attacker.side,
      targetCoord: attacker.coord,
    });

    const result = rollDamage(
      { attacker: defender, target: attacker, kind: 'normal' },
      this.rng,
    );

    if (!result.hit) {
      events.push({
        type: 'miss',
        attackerName: defender.name,
        attackerSide: defender.side,
        targetName: attacker.name,
        targetSide: attacker.side,
        targetCoord: attacker.coord,
      });
      return;
    }

    this.applyHit(defender, attacker, result, 'normal', false, events, {
      isCounter: true,
    });
    // 拦截普攻的 +25 已由本次受击蓄能提供，反击不再重复加。
  }

  private applyEffect(
    unit: Unit,
    spec: EffectSpec,
    source: string,
    events: BattleEvent[],
  ): void {
    if (!unit.alive) return;

    const description =
      spec.kind === 'statBuff'
        ? spec.label
        : spec.kind === 'poison'
          ? (spec.label ?? EFFECT_LABELS.poison)
          : EFFECT_LABELS[spec.kind];

    if (spec.chance !== undefined && !this.rng.chance(spec.chance)) {
      events.push({
        type: 'effectResisted',
        unitId: unit.id,
        unitName: unit.name,
        side: unit.side,
        coord: unit.coord,
        effect: spec.kind,
        description,
      });
      return;
    }

    const effect = createEffectFromSpec(spec, source);
    unit.addEffect(effect);

    events.push({
      type: 'effectApplied',
      unitId: unit.id,
      unitName: unit.name,
      side: unit.side,
      coord: unit.coord,
      effect: effect.kind,
      duration: effect.remainingActions,
      amount: effect.absorb,
      stat: spec.kind === 'statBuff' ? spec.stat : undefined,
      description: effect.description,
    });
  }

  private randomAlly(unit: Unit): Unit[] {
    const allies = this.board
      .aliveUnits(unit.side)
      .filter((ally) => ally.id !== unit.id);
    if (allies.length === 0) return [unit];
    const index = Math.floor(this.rng.next() * allies.length);
    return [allies[index] ?? allies[0]];
  }

  private lowestHpAlly(unit: Unit): Unit[] {
    const allies = this.board.aliveUnits(unit.side);
    if (allies.length === 0) return [unit];
    return [
      allies.reduce((lowest, ally) =>
        ally.hp < lowest.hp ? ally : lowest,
      ),
    ];
  }

  private gainCharge(
    unit: Unit,
    amount: number,
    reason: 'attack' | 'hit' | 'effect',
    events: BattleEvent[],
  ): void {
    if (!unit.alive) return;
    const gained = unit.gainCharge(amount);
    if (gained === 0) return;

    events.push({
      type: 'charge',
      unitId: unit.id,
      unitName: unit.name,
      side: unit.side,
      coord: unit.coord,
      amount: gained,
      total: unit.charge,
      reason,
    });
  }

  private checkEnd(events: BattleEvent[]): boolean {
    if (this.finished) return true;

    const playerAlive = this.board.aliveUnits('player').length;
    const enemyAlive = this.board.aliveUnits('enemy').length;
    if (playerAlive === 0 || enemyAlive === 0) {
      this.finished = true;
      this.winner = playerAlive > 0 ? 'player' : 'enemy';
      events.push({ type: 'battleEnd', winner: this.winner });
      return true;
    }
    return false;
  }
}
