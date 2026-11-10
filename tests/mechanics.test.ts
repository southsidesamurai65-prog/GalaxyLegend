import { describe, expect, it } from 'vitest';
import { Board } from '../src/battle/Board';
import { Unit } from '../src/battle/Unit';
import { findAnchor } from '../src/battle/targeting';
import { rollDamage } from '../src/battle/damage';
import { decideAction } from '../src/battle/action';
import { Battle } from '../src/battle/Battle';
import { createStats } from '../src/core/attributes';
import { createShieldEffect } from '../src/battle/effects/ShieldEffect';
import { createLockEffect } from '../src/battle/effects/LockEffect';
import { createSilenceEffect } from '../src/battle/effects/SilenceEffect';
import { CHARACTER_MAP } from '../src/data/characters';
import { buildUnit } from '../src/game/loadout';
import { Game } from '../src/game/Game';
import { SKILLS } from '../src/skills/registry';
import type { Rng } from '../src/core/rng';
import type { SkillDef } from '../src/skills/Skill';
import type { Coord, Side, Stats } from '../src/core/types';

function makeUnit(options: {
  id: string;
  side: Side;
  coord: Coord;
  stats?: Partial<Stats>;
  skill?: SkillDef;
  destroyer?: boolean;
}): Unit {
  return new Unit({
    id: options.id,
    name: options.id,
    role: 'test',
    destroyer: options.destroyer ?? false,
    side: options.side,
    coord: options.coord,
    stats: createStats(options.stats),
    skill: options.skill ?? SKILLS['swift-volley'],
  });
}

function stubRng(results: boolean[]): Rng {
  let index = 0;
  return {
    next: () => 0.5,
    chance: () => results[index++] ?? false,
  };
}

const TEST_SKILL_150: SkillDef = {
  id: 'test-150',
  name: '测试150',
  description: '',
  shape: 'single',
  baseMultiplier: 1.5,
};

describe('targeting', () => {
  it('优先同行且 y 最大的敌人', () => {
    const board = new Board();
    const me = makeUnit({ id: 'me', side: 'player', coord: { x: 2, y: 2 } });
    const back = makeUnit({ id: 'back', side: 'enemy', coord: { x: 2, y: 1 } });
    const front = makeUnit({ id: 'front', side: 'enemy', coord: { x: 2, y: 3 } });

    board.place(me);
    board.place(back);
    board.place(front);

    expect(findAnchor(me, board)?.coord).toEqual({ x: 2, y: 3 });
  });

  it('同行无人时按 上一行 > 下一行 > 上两行 > 下两行', () => {
    const board = new Board();
    const me = makeUnit({ id: 'me', side: 'player', coord: { x: 2, y: 2 } });
    board.place(me);
    board.place(makeUnit({ id: 'up', side: 'enemy', coord: { x: 1, y: 1 } }));
    board.place(makeUnit({ id: 'down', side: 'enemy', coord: { x: 3, y: 3 } }));

    expect(findAnchor(me, board)?.coord).toEqual({ x: 1, y: 1 });
  });

  it('行优先级高于跨行的 y', () => {
    const board = new Board();
    const me = makeUnit({ id: 'me', side: 'player', coord: { x: 2, y: 2 } });
    board.place(me);
    board.place(makeUnit({ id: 'up', side: 'enemy', coord: { x: 1, y: 2 } }));
    board.place(makeUnit({ id: 'down', side: 'enemy', coord: { x: 3, y: 3 } }));

    expect(findAnchor(me, board)?.coord).toEqual({ x: 1, y: 2 });
  });

  it('第一行和第三行的越界行按跳过处理', () => {
    const board = new Board();
    const top = makeUnit({ id: 'top', side: 'player', coord: { x: 1, y: 2 } });
    board.place(top);
    board.place(makeUnit({ id: 'same', side: 'enemy', coord: { x: 1, y: 1 } }));
    board.place(makeUnit({ id: 'far', side: 'enemy', coord: { x: 3, y: 3 } }));

    expect(findAnchor(top, board)?.coord).toEqual({ x: 1, y: 1 });
  });
});

describe('damage', () => {
  it('普攻 = 物攻 - 物防，暴击后乘暴伤', () => {
    const attacker = makeUnit({
      id: 'a',
      side: 'player',
      coord: { x: 1, y: 1 },
      stats: { physAtk: 120, hit: 100, crit: 20, critDamage: 150 },
    });
    const target = makeUnit({
      id: 'b',
      side: 'enemy',
      coord: { x: 1, y: 2 },
      stats: { hp: 1000, physDef: 30, dodge: 0, antiCrit: 0 },
    });

    const normal = rollDamage(
      { attacker, target, kind: 'normal' },
      stubRng([true, false]),
    );
    expect(normal.amount).toBe(90);

    const crit = rollDamage(
      { attacker, target, kind: 'normal' },
      stubRng([true, true]),
    );
    expect(crit.amount).toBe(135);
    expect(crit.crit).toBe(true);
  });

  it('毁灭者普攻使用能量攻击并忽略物防', () => {
    const attacker = makeUnit({
      id: 'a',
      side: 'player',
      coord: { x: 1, y: 1 },
      destroyer: true,
      stats: { energyAtk: 100, hit: 100 },
    });
    const target = makeUnit({
      id: 'b',
      side: 'enemy',
      coord: { x: 1, y: 2 },
      stats: { hp: 1000, physDef: 30, dodge: 0 },
    });

    const result = rollDamage(
      { attacker, target, kind: 'normal' },
      stubRng([true, false]),
    );
    expect(result.amount).toBe(100);
  });

  it('技能倍率 = 描述倍率 × 蓄能 / 100', () => {
    const attacker = makeUnit({
      id: 'a',
      side: 'player',
      coord: { x: 1, y: 1 },
      stats: { physAtk: 100, skillAtk: 40, hit: 100, crit: 0 },
    });
    const target = makeUnit({
      id: 'b',
      side: 'enemy',
      coord: { x: 1, y: 2 },
      stats: { hp: 1000, physDef: 30, skillDef: 10, dodge: 0, antiCrit: 0 },
    });

    const result = rollDamage(
      {
        attacker,
        target,
        kind: 'skill',
        skill: TEST_SKILL_150,
        charge: 150,
      },
      stubRng([true, false]),
    );

    // 1.5 × 150 / 100 = 2.25；2.25 × (100 + 40) - 30 - 10 = 275
    expect(result.multiplier).toBe(2.25);
    expect(result.amount).toBe(275);
  });

  it('神圣伤害无视双防，毁灭者技能无视物防但吃技防', () => {
    const attacker = makeUnit({
      id: 'a',
      side: 'player',
      coord: { x: 1, y: 1 },
      stats: { physAtk: 100, skillAtk: 40, hit: 100, crit: 0 },
    });
    const target = makeUnit({
      id: 'b',
      side: 'enemy',
      coord: { x: 1, y: 2 },
      stats: { hp: 1000, physDef: 30, skillDef: 10, dodge: 0, antiCrit: 0 },
    });

    const holy = rollDamage(
      {
        attacker,
        target,
        kind: 'skill',
        skill: TEST_SKILL_150,
        charge: 150,
        holy: true,
      },
      stubRng([true, false]),
    );
    expect(holy.amount).toBe(315);

    const destroyer = makeUnit({
      id: 'd',
      side: 'player',
      coord: { x: 1, y: 1 },
      destroyer: true,
      stats: { energyAtk: 100, skillAtk: 40, hit: 100, crit: 0 },
    });
    const destroyerSkill = rollDamage(
      {
        attacker: destroyer,
        target,
        kind: 'skill',
        skill: TEST_SKILL_150,
        charge: 150,
      },
      stubRng([true, false]),
    );
    expect(destroyerSkill.amount).toBe(305);
  });
});

describe('charge and effects', () => {
  it('锁定时跳过行动；禁技时改用普攻', () => {
    const unit = makeUnit({
      id: 'u',
      side: 'player',
      coord: { x: 1, y: 1 },
      stats: { initialCharge: 100 },
    });

    expect(decideAction(unit).type).toBe('skill');

    unit.addEffect(createSilenceEffect(2));
    expect(decideAction(unit).type).toBe('normal');

    unit.addEffect(createLockEffect(1));
    expect(decideAction(unit).type).toBe('skip');
  });

  it('护盾先吸收伤害，按行动次数过期', () => {
    const unit = makeUnit({
      id: 'u',
      side: 'player',
      coord: { x: 1, y: 1 },
      stats: { hp: 1000 },
    });
    const shield = createShieldEffect(100, 2);
    unit.addEffect(shield);

    const first = unit.takeDamage(80);
    expect(first).toEqual({ shieldAbsorbed: 80, hpDamage: 0, died: false });
    expect(unit.hp).toBe(1000);

    const second = unit.takeDamage(50);
    expect(second.shieldAbsorbed).toBe(20);
    expect(second.hpDamage).toBe(30);
    expect(unit.hp).toBe(970);
    expect(unit.effects).toHaveLength(0);
  });

  it('护盾持续 2 次行动，本次行动中新获得的护盾不立即掉层', () => {
    const unit = makeUnit({
      id: 'u',
      side: 'player',
      coord: { x: 1, y: 1 },
      stats: { hp: 1000 },
    });
    const shield = createShieldEffect(50, 2);
    unit.addEffect(shield);

    expect(unit.tickEffects([shield])).toHaveLength(0);
    expect(shield.remainingActions).toBe(1);
    expect(unit.tickEffects([shield])).toHaveLength(1);
    expect(unit.effects).toHaveLength(0);

    const next = createShieldEffect(50, 2);
    const snapshot = [...unit.effects];
    unit.addEffect(next);
    expect(unit.tickEffects(snapshot)).toHaveLength(0);
    expect(next.remainingActions).toBe(2);
  });
});

describe('battle loop', () => {
  it('普攻命中双方各 +25；未命中不加', () => {
    const player = makeUnit({
      id: 'p',
      side: 'player',
      coord: { x: 2, y: 2 },
      stats: {
        hp: 10000,
        physAtk: 100,
        hit: 200,
        dodge: 0,
        crit: 0,
        antiCrit: 0,
        initialCharge: 50,
        speed: 100,
      },
    });
    const enemy = makeUnit({
      id: 'e',
      side: 'enemy',
      coord: { x: 2, y: 3 },
      stats: {
        hp: 10000,
        physAtk: 0,
        hit: 200,
        dodge: 0,
        crit: 0,
        antiCrit: 0,
        initialCharge: 50,
        speed: 1,
      },
    });

    const battle = new Battle({ playerUnits: [player], enemyUnits: [enemy], seed: 1 });
    battle.step();

    expect(player.charge).toBe(75);
    expect(enemy.charge).toBe(75);
  });

  it('未命中时双方都不加蓄能', () => {
    const player = makeUnit({
      id: 'p',
      side: 'player',
      coord: { x: 2, y: 2 },
      stats: {
        hp: 10000,
        physAtk: 100,
        hit: 0,
        dodge: 100,
        crit: 0,
        antiCrit: 0,
        initialCharge: 50,
        speed: 100,
      },
    });
    const enemy = makeUnit({
      id: 'e',
      side: 'enemy',
      coord: { x: 2, y: 3 },
      stats: {
        hp: 10000,
        physAtk: 0,
        hit: 0,
        dodge: 100,
        crit: 0,
        antiCrit: 0,
        initialCharge: 50,
        speed: 1,
      },
    });

    const battle = new Battle({ playerUnits: [player], enemyUnits: [enemy], seed: 2 });
    battle.step();

    expect(player.charge).toBe(50);
    expect(enemy.charge).toBe(50);
  });

  it('多目标技能：攻击方只 +25 一次，每个受击者各 +25', () => {
    const player = makeUnit({
      id: 'p',
      side: 'player',
      coord: { x: 2, y: 1 },
      stats: {
        hp: 10000,
        physAtk: 100,
        hit: 200,
        dodge: 0,
        crit: 0,
        antiCrit: 0,
        initialCharge: 100,
        skillAtk: 0,
        speed: 100,
      },
      skill: SKILLS['silence-wave'],
    });
    const enemies = [1, 2, 3].map((y) =>
      makeUnit({
        id: `e${y}`,
        side: 'enemy',
        coord: { x: 2, y },
        stats: {
          hp: 10000,
          physDef: 0,
          skillDef: 0,
          hit: 0,
          dodge: 0,
          crit: 0,
          antiCrit: 0,
          initialCharge: 0,
          speed: 1,
        },
      }),
    );

    const battle = new Battle({
      playerUnits: [player],
      enemyUnits: enemies,
      seed: 3,
    });
    const events = battle.step();
    const cast = events.find((event) => event.type === 'skillCast');
    const damageEvents = events.filter((event) => event.type === 'damage');

    expect(cast?.type).toBe('skillCast');
    if (cast?.type === 'skillCast') expect(cast.targets).toHaveLength(3);
    expect(damageEvents).toHaveLength(3);
    expect(player.charge).toBe(25);
    for (const enemy of enemies) expect(enemy.charge).toBe(25);
  });

  it('行动队列快方先手并交替，方内 y 降序 x 升序', () => {
    const playerUnits = [
      makeUnit({
        id: 'p1',
        side: 'player',
        coord: { x: 1, y: 3 },
        stats: { hp: 10000, hit: 0, dodge: 100, speed: 50 },
      }),
      makeUnit({
        id: 'p2',
        side: 'player',
        coord: { x: 2, y: 3 },
        stats: { hp: 10000, hit: 0, dodge: 100, speed: 50 },
      }),
    ];
    const enemyUnits = [
      makeUnit({
        id: 'e1',
        side: 'enemy',
        coord: { x: 1, y: 3 },
        stats: { hp: 10000, hit: 0, dodge: 100, speed: 25 },
      }),
      makeUnit({
        id: 'e2',
        side: 'enemy',
        coord: { x: 2, y: 3 },
        stats: { hp: 10000, hit: 0, dodge: 100, speed: 25 },
      }),
    ];

    const battle = new Battle({ playerUnits, enemyUnits, seed: 4 });
    const order: string[] = [];
    for (let index = 0; index < 4; index += 1) {
      const events = battle.step();
      const start = events.find((event) => event.type === 'actionStart');
      if (start?.type === 'actionStart') order.push(start.unitId);
    }

    expect(order).toEqual(['p1', 'e1', 'p2', 'e2']);
  });

  it('一方全灭后战斗结束', () => {
    const player = makeUnit({
      id: 'p',
      side: 'player',
      coord: { x: 1, y: 3 },
      stats: {
        hp: 10000,
        physAtk: 10000,
        hit: 200,
        dodge: 0,
        crit: 0,
        antiCrit: 0,
        initialCharge: 0,
        speed: 100,
      },
    });
    const enemy = makeUnit({
      id: 'e',
      side: 'enemy',
      coord: { x: 1, y: 3 },
      stats: { hp: 100, physDef: 0, hit: 0, dodge: 0, speed: 1 },
    });

    const battle = new Battle({ playerUnits: [player], enemyUnits: [enemy], seed: 5 });
    battle.step();

    expect(battle.finished).toBe(true);
    expect(battle.winner).toBe('player');
  });
});

describe('crystals', () => {
  it('氪晶属性正确聚合到单位', () => {
    const template = CHARACTER_MAP['destroyer'];
    const unit = buildUnit(
      template,
      'player',
      { x: 1, y: 1 },
      ['energy-core', 'hp-plate'],
      'p',
    );

    expect(unit.stats.energyAtk).toBe((template.base.energyAtk ?? 0) + 25);
    expect(unit.maxHp).toBe((template.base.hp ?? 1000) + 180);
  });

  it('共享库存且不可重复装备', () => {
    const game = new Game();

    expect(game.crystalUsedBy('hp-plate')).toBe('guardian');
    expect(game.equipCrystal('destroyer', 'hp-plate')).toBe(false);
    expect(game.equipCrystal('destroyer', 'atk-core')).toBe(true);
    expect(game.crystalUsedBy('atk-core')).toBe('destroyer');
    expect(game.equipCrystal('guardian', 'atk-core')).toBe(false);
  });
});
