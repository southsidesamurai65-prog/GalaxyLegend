import type { BattleEvent } from '../core/events';
import type { Rng } from '../core/rng';
import { createRng } from '../core/rng';
import type { Side } from '../core/types';
import { otherSide } from '../core/types';
import { Board } from './Board';
import { Unit } from './Unit';
import { findAnchor } from './targeting';
import { rollDamage, type DamageResult } from './damage';
import { decideAction } from './action';
import { resolveTargets } from '../skills/shapes';
import { createEffectFromSpec } from './effects/registry';
import type { EffectSpec } from './effects/Effect';
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
      const expired = unit.tickEffects(effectsAtStart);
      for (const effect of expired) {
        events.push({
          type: 'effectExpired',
          unitId: unit.id,
          unitName: unit.name,
          side: unit.side,
          coord: unit.coord,
          effect: effect.kind,
        });
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
    const anchor = findAnchor(unit, this.board);
    if (!anchor) return;

    const skill = unit.skill;
    const charge = unit.charge;
    const multiplier = skill.baseMultiplier * (charge / 100);
    const targets = resolveTargets(skill.shape, unit, anchor, this.board);

    // 释放后清空蓄能；本次技能伤害使用释放瞬间的 charge。
    unit.charge = 0;

    events.push({
      type: 'skillCast',
      casterId: unit.id,
      casterName: unit.name,
      casterSide: unit.side,
      casterCoord: unit.coord,
      anchorCoord: anchor.coord,
      skillName: skill.name,
      shape: skill.shape,
      charge,
      multiplier,
      targets: targets.map((target) => ({
        id: target.id,
        name: target.name,
        side: target.side,
        coord: target.coord,
      })),
    });

    if (skill.selfEffects) {
      for (const spec of skill.selfEffects) {
        this.applyEffect(unit, spec, unit.name, events);
      }
    }

    let anyHit = false;
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

      anyHit = true;
      this.applyHit(unit, target, result, 'skill', !!skill.holy, events);

      if (target.alive && skill.targetEffects) {
        for (const spec of skill.targetEffects) {
          this.applyEffect(target, spec, unit.name, events);
        }
      }
    }

    // 多目标技能：攻击方每次行动最多 +25 一次。
    if (anyHit) this.gainCharge(unit, 25, 'attack', events);
  }

  private applyHit(
    attacker: Unit,
    target: Unit,
    result: DamageResult,
    kind: DamageKind,
    holy: boolean,
    events: BattleEvent[],
  ): void {
    const { shieldAbsorbed, hpDamage, died } = target.takeDamage(result.amount);

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
    } else {
      // 每个受击单位每次行动最多 +25 一次。
      this.gainCharge(target, 25, 'hit', events);
    }
  }

  private applyEffect(
    unit: Unit,
    spec: EffectSpec,
    source: string,
    events: BattleEvent[],
  ): void {
    if (!unit.alive) return;

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
    });
  }

  private gainCharge(
    unit: Unit,
    amount: number,
    reason: 'attack' | 'hit',
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
