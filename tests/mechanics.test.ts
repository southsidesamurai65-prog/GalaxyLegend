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
import { createStatBuffEffect } from '../src/battle/effects/StatBuffEffect';
import { createFreezeEffect } from '../src/battle/effects/FreezeEffect';
import { createStealthEffect } from '../src/battle/effects/StealthEffect';
import { CHARACTER_MAP, isFlagship } from '../src/data/characters';
import { parseCodex } from '../src/data/codex';
import { CRYSTALS } from '../src/data/crystals';
import { formatCompact } from '../src/ui/format';
import {
  MAX_LEVEL,
  buildLevelBaseStats,
  speedPerLevel,
} from '../src/game/level';
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
  noHitCharge?: boolean;
  passiveDescription?: string;
}): Unit {
  return new Unit({
    id: options.id,
    name: options.id,
    role: 'test',
    destroyer: options.destroyer ?? false,
    noHitCharge: options.noHitCharge,
    passiveDescription: options.passiveDescription,
    side: options.side,
    coord: options.coord,
    stats: createStats(options.stats),
    skill: options.skill ?? TEST_BASIC,
  });
}

function stubRng(results: boolean[]): Rng {
  let index = 0;
  return {
    next: () => 0.5,
    chance: () => results[index++] ?? false,
  };
}

const TEST_BASIC: SkillDef = {
  id: 'test-basic',
  name: '测试普攻',
  description: '',
  shape: 'sameColumn',
  baseMultiplier: 1.3,
};

const TEST_ROW: SkillDef = {
  id: 'test-row',
  name: '测试同行',
  description: '',
  shape: 'sameRow',
  baseMultiplier: 1,
};

const TEST_SKILL_150: SkillDef = {
  id: 'test-150',
  name: '测试150',
  description: '',
  shape: 'single',
  baseMultiplier: 1.5,
};

const TEST_SELF_BUFF: SkillDef = {
  id: 'test-self-buff',
  name: '测试甲',
  description: '',
  shape: 'self',
  baseMultiplier: 0,
  castEffects: [
    {
      target: 'self',
      effect: {
        kind: 'statBuff',
        duration: 2,
        stat: 'physDef',
        mul: 1.2,
        label: '物理防御 +20%',
      },
    },
  ],
};

const TEST_TEAM_BUFF: SkillDef = {
  id: 'test-team-buff',
  name: '测试光',
  description: '',
  shape: 'cross',
  baseMultiplier: 0.7,
  castEffects: [
    {
      target: 'allAllies',
      effect: {
        kind: 'statBuff',
        duration: 1,
        stat: 'dodge',
        add: 10,
        label: '闪避 +10%',
      },
    },
  ],
};

const TEST_CHARGE_REDUCE: SkillDef = {
  id: 'test-charge-reduce',
  name: '测试干扰',
  description: '',
  shape: 'single',
  baseMultiplier: 0.3,
  targetChargeDelta: -25,
  skipHitCharge: true,
};

const TEST_FLAT_HOLY: SkillDef = {
  id: 'test-flat-holy',
  name: '测试神圣',
  description: '',
  shape: 'single',
  baseMultiplier: 1,
  flatHolyDamage: 500,
};

const TEST_POISON: SkillDef = {
  id: 'test-poison',
  name: '测试中毒',
  description: '',
  shape: 'single',
  baseMultiplier: 1,
  poisonPercent: 10,
  poisonDuration: 2,
};

const TEST_SELF_CHARGE: SkillDef = {
  id: 'test-self-charge',
  name: '测试自充',
  description: '',
  shape: 'single',
  baseMultiplier: 1,
  selfChargeGain: 100,
};

const TEST_TEAM_CHARGE: SkillDef = {
  id: 'test-team-charge',
  name: '测试群充',
  description: '',
  shape: 'single',
  baseMultiplier: 1,
  teamChargeGain: 50,
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

  it('神圣伤害无视双防，毁灭者技能无视物理防御和技能防御', () => {
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
    expect(destroyerSkill.amount).toBe(315);
  });

  it('毁灭者技能只扣能量防御，不扣物理防御和技能防御', () => {
    const attacker = makeUnit({
      id: 'd',
      side: 'player',
      coord: { x: 1, y: 1 },
      destroyer: true,
      stats: { energyAtk: 100, skillAtk: 40, hit: 100, crit: 0 },
    });
    const target = makeUnit({
      id: 'e',
      side: 'enemy',
      coord: { x: 1, y: 2 },
      stats: {
        hp: 1000,
        physDef: 9999,
        energyDef: 20,
        skillDef: 9999,
        dodge: 0,
        antiCrit: 0,
      },
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

    // 2.25 × (100 + 40) - 20 能量防御 = 295；物理防御和技能防御都不参与。
    expect(result.amount).toBe(295);
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
    // 第 2 次出手前仍保留，但已经进入最后一个回合。
    expect(unit.tickEffects([shield])).toHaveLength(0);
    expect(shield.remainingActions).toBe(0);
    expect(unit.effects).toHaveLength(1);
    // 第 3 次出手前移除。
    expect(unit.tickEffects([shield])).toHaveLength(1);
    expect(unit.effects).toHaveLength(0);

    const next = createShieldEffect(50, 2);
    const snapshot = [...unit.effects];
    unit.addEffect(next);
    expect(unit.tickEffects(snapshot)).toHaveLength(0);
    expect(next.remainingActions).toBe(2);
  });
});

describe('enemy refresh', () => {
  it('随机敌人是 5 个不重复的完整角色，位置互不重叠', () => {
    const game = new Game();

    for (let round = 0; round < 8; round += 1) {
      game.refreshEnemy();
      const slots = game.enemyPreview;

      expect(slots).toHaveLength(5);
      expect(new Set(slots.map((slot) => slot.charId)).size).toBe(5);
      expect(slots.every((slot) => CHARACTER_MAP[slot.charId]?.complete)).toBe(
        true,
      );
      expect(
        new Set(slots.map((slot) => `${slot.coord.x},${slot.coord.y}`)).size,
      ).toBe(5);
      expect(
        slots.filter((slot) => isFlagship(slot.charId)).length,
      ).toBeLessThanOrEqual(1);
    }
  });
});

describe('enemy customization', () => {
  it('阵容快照包含双方氪晶并可以恢复', () => {
    const game = new Game();
    const player = game.slots[0];
    player.crystalIds = [];
    expect(game.equipCrystal(player.charId, '魅影')).toBe(true);

    game.clearEnemyLineup();
    expect(game.placeEnemyAt('无头骑士', { x: 2, y: 2 })).toBe(true);
    const enemy = game.enemySlots[0];
    enemy.crystalIds = [];
    expect(game.equipEnemyCrystal(enemy.charId, '怒火')).toBe(true);

    const snapshot = game.snapshotLineup();
    const restored = new Game();
    expect(restored.applyLineup(snapshot)).toBe(true);

    expect(restored.slots[0].crystalIds).toContain('魅影');
    expect(restored.enemySlots[0].crystalIds).toContain('怒火');
  });

  it('可以清空并手动放置敌方阵容，开战时使用自定义阵容', () => {
    const game = new Game();
    game.clearEnemyLineup();

    expect(game.placeEnemyAt('无头骑士', { x: 2, y: 2 })).toBe(true);
    expect(game.placeEnemyAt('罗薇', { x: 1, y: 2 })).toBe(true);
    expect(game.enemySlotAt({ x: 2, y: 2 })?.charId).toBe('无头骑士');
    expect(game.isEnemyPlaced('罗薇')).toBe(true);

    game.removeEnemy('罗薇');
    expect(game.isEnemyPlaced('罗薇')).toBe(false);

    expect(game.startBattle()).toBe(true);
    expect(
      game.battle?.board.aliveUnits('enemy').map((unit) => unit.name),
    ).toEqual(['无头骑士']);
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

  it('多目标技能：释放后攻击方蓄能清空，每个受击者各 +25', () => {
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
      skill: TEST_ROW,
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
    expect(player.charge).toBe(0);
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

describe('codex mechanics', () => {
  it('属性增减益影响当前属性，并在行动次数结束后恢复', () => {
    const unit = makeUnit({
      id: 'u',
      side: 'player',
      coord: { x: 1, y: 1 },
      stats: { hp: 1000, physAtk: 100 },
    });
    const effect = createStatBuffEffect({
      stat: 'physAtk',
      duration: 2,
      label: '物理攻击 -50%',
      mul: 0.5,
    });
    unit.addEffect(effect);

    expect(unit.getStat('physAtk')).toBe(50);
    unit.tickEffects([effect]);
    expect(unit.getStat('physAtk')).toBe(50);
    unit.tickEffects([effect]);
    expect(unit.getStat('physAtk')).toBe(50);
    unit.tickEffects([effect]);
    expect(unit.getStat('physAtk')).toBe(100);
  });

  it('自身增益技能不攻击，只施加增益', () => {
    const player = makeUnit({
      id: 'p',
      side: 'player',
      coord: { x: 2, y: 2 },
      stats: {
        hp: 10000,
        physDef: 100,
        hit: 200,
        dodge: 0,
        crit: 0,
        antiCrit: 0,
        initialCharge: 100,
        speed: 100,
      },
      skill: TEST_SELF_BUFF,
    });
    const enemy = makeUnit({
      id: 'e',
      side: 'enemy',
      coord: { x: 2, y: 3 },
      stats: { hp: 10000, speed: 1 },
    });

    const battle = new Battle({
      playerUnits: [player],
      enemyUnits: [enemy],
      seed: 20,
    });
    const events = battle.step();
    const cast = events.find((event) => event.type === 'skillCast');

    expect(cast?.type).toBe('skillCast');
    if (cast?.type === 'skillCast') expect(cast.targets).toHaveLength(0);
    expect(events.some((event) => event.type === 'damage')).toBe(false);
    expect(player.getStat('physDef')).toBeCloseTo(120);
    expect(player.effectMaxDuration('statBuff')).toBe(2);
    expect(player.charge).toBe(0);
  });

  it('全体增益作用于所有存活友方', () => {
    const player = makeUnit({
      id: 'p',
      side: 'player',
      coord: { x: 2, y: 2 },
      stats: {
        hp: 10000,
        physAtk: 100,
        hit: 200,
        dodge: 5,
        crit: 0,
        antiCrit: 0,
        initialCharge: 100,
        skillAtk: 0,
        speed: 100,
      },
      skill: TEST_TEAM_BUFF,
    });
    const ally = makeUnit({
      id: 'a',
      side: 'player',
      coord: { x: 1, y: 1 },
      stats: { hp: 10000, dodge: 5, speed: 1 },
    });
    const enemies = [
      makeUnit({
        id: 'e1',
        side: 'enemy',
        coord: { x: 1, y: 3 },
        stats: { hp: 10000, physDef: 0, skillDef: 0, dodge: 0, speed: 1 },
      }),
      makeUnit({
        id: 'e2',
        side: 'enemy',
        coord: { x: 2, y: 3 },
        stats: { hp: 10000, physDef: 0, skillDef: 0, dodge: 0, speed: 1 },
      }),
    ];

    const battle = new Battle({
      playerUnits: [player, ally],
      enemyUnits: enemies,
      seed: 21,
    });
    const events = battle.step();

    expect(player.getStat('dodge')).toBe(15);
    expect(ally.getStat('dodge')).toBe(15);
    expect(player.effectMaxDuration('statBuff')).toBe(1);
    expect(ally.effectMaxDuration('statBuff')).toBe(1);
    expect(events.filter((event) => event.type === 'damage').length).toBeGreaterThan(0);
  });

  it('解析自身增益和全体增益技能', () => {
    const result = parseCodex(`
护卫者()
测试甲(B)，技能：测试甲，增加自身20%物理防御2回合
属性：469 32 90 82 123 0% 0% 150% 0% 100% 20 50

徘徊者()
测试光(S)，技能：测试光，十字，70%，增加全体10%闪避1回合
属性：2072 1040 520 128 84 10% 10% 150% 10% 100% 35 50
`);

    const selfSkill = result.skills['codex-skill-测试甲'];
    expect(selfSkill.shape).toBe('self');
    expect(selfSkill.baseMultiplier).toBe(0);
    expect(selfSkill.castEffects?.[0]?.target).toBe('self');

    const teamSkill = result.skills['codex-skill-测试光'];
    expect(teamSkill.shape).toBe('cross');
    expect(teamSkill.baseMultiplier).toBeCloseTo(0.7);
    expect(teamSkill.castEffects?.[0]?.target).toBe('allAllies');
  });

  it('减少目标蓄能并阻止本次挨打 +25', () => {
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
        initialCharge: 100,
        skillAtk: 0,
        speed: 100,
      },
      skill: TEST_CHARGE_REDUCE,
    });
    const enemy = makeUnit({
      id: 'e',
      side: 'enemy',
      coord: { x: 2, y: 3 },
      stats: {
        hp: 10000,
        physDef: 0,
        skillDef: 0,
        dodge: 0,
        crit: 0,
        antiCrit: 0,
        initialCharge: 100,
        speed: 1,
      },
    });

    const battle = new Battle({
      playerUnits: [player],
      enemyUnits: [enemy],
      seed: 22,
    });
    const events = battle.step();

    expect(enemy.charge).toBe(75);
    expect(
      events.some(
        (event) =>
          event.type === 'charge' && event.reason === 'drain' && event.amount === -25,
      ),
    ).toBe(true);
    expect(
      events.some(
        (event) => event.type === 'charge' && event.reason === 'hit',
      ),
    ).toBe(false);
    expect(player.charge).toBe(0);
  });

  it('解析减少目标蓄能并阻止挨打蓄能', () => {
    const result = parseCodex(`
徘徊者()
测试(S)，技能：测试干扰，十字，30%，减少目标25蓄能(不光这一次不加还倒扣)
属性：2056 996 518 130 84 10% 0% 170% 0% 100% 35 50
`);

    const skill = result.skills['codex-skill-测试干扰'];
    expect(skill.shape).toBe('cross');
    expect(skill.baseMultiplier).toBeCloseTo(0.3);
    expect(skill.targetChargeDelta).toBe(-25);
    expect(skill.skipHitCharge).toBe(true);
  });

  it('氢弹只消耗一半蓄能，伤害仍按释放时蓄能计算', () => {
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
        initialCharge: 100,
        skillAtk: 0,
        speed: 100,
      },
      skill: SKILLS['codex-skill-氢弹'],
    });
    const enemy = makeUnit({
      id: 'e',
      side: 'enemy',
      coord: { x: 2, y: 3 },
      stats: {
        hp: 10000,
        physDef: 0,
        skillDef: 0,
        dodge: 0,
        crit: 0,
        antiCrit: 0,
        speed: 1,
      },
    });

    const battle = new Battle({
      playerUnits: [player],
      enemyUnits: [enemy],
      seed: 10,
    });
    const events = battle.step();
    const cast = events.find((event) => event.type === 'skillCast');

    expect(cast?.type).toBe('skillCast');
    if (cast?.type === 'skillCast') {
      expect(cast.charge).toBe(100);
      expect(cast.chargeAfter).toBe(50);
      expect(cast.multiplier).toBeCloseTo(1.5);
    }
    // 释放技能不额外加蓄能，只保留消耗后剩余的 50。
    expect(player.charge).toBe(50);
  });

  it('中子干扰命中后清空目标蓄能', () => {
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
        initialCharge: 100,
        skillAtk: 0,
        speed: 100,
      },
      skill: SKILLS['codex-skill-中子干扰'],
    });
    const enemy = makeUnit({
      id: 'e',
      side: 'enemy',
      coord: { x: 2, y: 3 },
      stats: {
        hp: 10000,
        physDef: 0,
        skillDef: 0,
        dodge: 0,
        crit: 0,
        antiCrit: 0,
        initialCharge: 100,
        speed: 1,
      },
    });

    const battle = new Battle({
      playerUnits: [player],
      enemyUnits: [enemy],
      seed: 11,
    });
    const events = battle.step();

    expect(enemy.charge).toBe(0);
    expect(events.some((event) => event.type === 'chargeDrained')).toBe(true);
  });

  it('50% 锁定按每个目标单独判定，未触发时产生抵抗事件', () => {
    const makeEnemy = (id: string, x: number) =>
      makeUnit({
        id,
        side: 'enemy',
        coord: { x, y: 2 },
        stats: {
          hp: 10000,
          physDef: 0,
          skillDef: 0,
          dodge: 0,
          crit: 0,
          antiCrit: 0,
          initialCharge: 0,
          speed: 1,
        },
      });

    const makeBattle = (chance: (percent: number) => boolean) => {
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
        skill: SKILLS['codex-skill-正电子炮'],
      });
      const enemies = [
        makeEnemy('e1', 1),
        makeEnemy('e2', 2),
        makeEnemy('e3', 3),
      ];
      return {
        enemies,
        battle: new Battle({
          playerUnits: [player],
          enemyUnits: enemies,
          seed: 12,
          rng: { next: () => 0.5, chance },
        }),
      };
    };

    const resisted = makeBattle((percent) => percent >= 100);
    const resistedEvents = resisted.battle.step();
    expect(
      resistedEvents.filter((event) => event.type === 'effectResisted'),
    ).toHaveLength(3);
    for (const enemy of resisted.enemies) expect(enemy.isLocked()).toBe(false);

    const applied = makeBattle((percent) => percent >= 50);
    applied.battle.step();
    for (const enemy of applied.enemies) expect(enemy.isLocked()).toBe(true);
  });

  it('解析毁灭者的 13 位属性，无 = 0', () => {
    const result = parseCodex(`
毁灭者()
测试(B)，技能：测试炮，单体，100%伤害。
属性：302 无 92 96 112 84 2.5% 0% 170% 0% 100% 28 50
`);
    expect(result.characters).toHaveLength(1);
    const character = result.characters[0];
    expect(character.complete).toBe(true);
    expect(character.base.hp).toBe(302);
    expect(character.base.physAtk).toBe(0);
    expect(character.base.physDef).toBe(92);
    expect(character.base.skillAtk).toBe(96);
    expect(character.base.skillDef).toBe(112);
    expect(character.base.energyAtk).toBe(84);
    expect(character.base.crit).toBe(2.5);
    expect(character.base.critDamage).toBe(170);
    expect(character.base.hit).toBe(100);
    expect(character.base.speed).toBe(28);
    expect(character.base.initialCharge).toBe(50);
    expect(character.source).toBe('codex');
  });

  it('解析全体大护盾和 30W 数值', () => {
    const result = parseCodex(`
护卫者()
测试(SS)，技能：等离子立场，单体，100%，给全体加一个30W的护盾，持续1回合
属性：4073 1038 1026 524 536 5% 40% 180% 0% 110% 23 75
`);

    const character = result.characters[0];
    expect(character.complete).toBe(true);
    expect(character.rarity).toBe('SS');

    const skill = result.skills[character.skillId];
    expect(skill.shape).toBe('single');
    expect(skill.baseMultiplier).toBe(1);
    expect(skill.castEffects?.[0]).toMatchObject({
      target: 'allAllies',
      effect: {
        kind: 'shield',
        duration: 1,
        absorb: 300000,
      },
    });
  });

  it('大数字显示为 W', () => {
    expect(formatCompact(300000)).toBe('30W');
    expect(formatCompact(15000)).toBe('1.5W');
    expect(formatCompact(4073)).toBe('4073');
  });

  it('默认阵容必须且只能有 1 艘旗舰', () => {
    const game = new Game();
    expect(game.flagshipCount).toBe(1);
    expect(game.startBattle()).toBe(true);

    const noFlagship = new Game();
    const flagship = noFlagship.slots.find((slot) => isFlagship(slot.charId));
    expect(flagship).toBeDefined();
    if (flagship) noFlagship.removeChar(flagship.charId);
    expect(noFlagship.flagshipCount).toBe(0);
    expect(noFlagship.startBattle()).toBe(false);
  });
});

describe('level bonuses', () => {
  it('默认 75 级并叠加固定装备与阵营速度成长', () => {
    const template = CHARACTER_MAP['主角'];
    const stats = buildLevelBaseStats(template);

    expect(MAX_LEVEL).toBe(75);
    expect(stats.hp).toBe((template.base.hp ?? 0) * 15 + 66400);
    expect(stats.physAtk).toBe((template.base.physAtk ?? 0) * 15 + 46500);
    expect(stats.physDef).toBe((template.base.physDef ?? 0) * 15 + 33200);
    expect(stats.skillAtk).toBe((template.base.skillAtk ?? 0) * 15 + 33200);
    expect(stats.skillDef).toBe((template.base.skillDef ?? 0) * 15 + 33200);
    expect(stats.energyAtk).toBe(
      (template.base.energyAtk ?? 0) * 15 + 19900,
    );
    expect(stats.speed).toBe(
      (template.base.speed ?? 0) + 2612 + (MAX_LEVEL - 1) * 2,
    );

    expect(speedPerLevel('旗舰')).toBe(2);
    expect(speedPerLevel('护卫者')).toBe(2);
    expect(speedPerLevel('突击舰')).toBe(3);
    expect(speedPerLevel('打击者')).toBe(4);
    expect(speedPerLevel('徘徊者')).toBe(5);
    expect(speedPerLevel('毁灭者')).toBe(5);
  });
});

describe('new mechanics', () => {
  it('冰冻同时锁定并降低物理防御', () => {
    const unit = makeUnit({
      id: 'u',
      side: 'player',
      coord: { x: 1, y: 1 },
      stats: { hp: 1000, physDef: 100 },
    });
    const effect = createFreezeEffect(1, 20);
    unit.addEffect(effect);

    expect(unit.isLocked()).toBe(true);
    expect(unit.getStat('physDef')).toBeCloseTo(80);
    expect(unit.tickEffects([effect])).toHaveLength(0);
    expect(unit.isLocked()).toBe(true);
    expect(unit.tickEffects([effect])).toHaveLength(1);
    expect(unit.isLocked()).toBe(false);
    expect(unit.getStat('physDef')).toBe(100);
  });

  it('隐身单位不会被选为靶点', () => {
    const board = new Board();
    const me = makeUnit({
      id: 'me',
      side: 'player',
      coord: { x: 2, y: 2 },
    });
    const enemy = makeUnit({
      id: 'e',
      side: 'enemy',
      coord: { x: 1, y: 2 },
    });
    board.place(me);
    board.place(enemy);

    const stealth = createStealthEffect(1);
    enemy.addEffect(stealth);

    expect(board.targetableEnemies('player')).toHaveLength(0);
    expect(findAnchor(me, board)).toBeNull();

    enemy.tickEffects([stealth]);
    expect(findAnchor(me, board)).toBeNull();
    enemy.tickEffects([stealth]);
    expect(findAnchor(me, board)?.id).toBe('e');
  });

  it('能量防御可抵挡毁灭者攻击', () => {
    const attacker = makeUnit({
      id: 'a',
      side: 'player',
      coord: { x: 1, y: 1 },
      destroyer: true,
      stats: { hp: 1000, energyAtk: 100, hit: 100, crit: 0 },
    });
    const target = makeUnit({
      id: 'b',
      side: 'enemy',
      coord: { x: 1, y: 2 },
      stats: {
        hp: 1000,
        energyDef: 40,
        physDef: 1000,
        dodge: 0,
        antiCrit: 0,
      },
    });

    const result = rollDamage(
      { attacker, target, kind: 'normal' },
      stubRng([true, false]),
    );
    expect(result.amount).toBe(60);
  });

  it('被动：被击中不会增加蓄能', () => {
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
      noHitCharge: true,
      stats: {
        hp: 10000,
        physDef: 0,
        hit: 0,
        dodge: 0,
        crit: 0,
        antiCrit: 0,
        initialCharge: 50,
        speed: 1,
      },
    });

    const battle = new Battle({
      playerUnits: [player],
      enemyUnits: [enemy],
      seed: 30,
    });
    battle.step();

    expect(player.charge).toBe(75);
    expect(enemy.charge).toBe(50);
  });

  it('额外神圣伤害计入命中伤害', () => {
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
        initialCharge: 100,
        skillAtk: 0,
        speed: 100,
      },
      skill: TEST_FLAT_HOLY,
    });
    const enemy = makeUnit({
      id: 'e',
      side: 'enemy',
      coord: { x: 2, y: 3 },
      stats: {
        hp: 10000,
        physDef: 0,
        skillDef: 0,
        dodge: 0,
        antiCrit: 0,
        speed: 1,
      },
    });

    const battle = new Battle({
      playerUnits: [player],
      enemyUnits: [enemy],
      seed: 31,
    });
    const events = battle.step();
    const damage = events.find((event) => event.type === 'damage');

    expect(damage?.type).toBe('damage');
    if (damage?.type === 'damage') {
      expect(damage.amount).toBe(600);
      expect(damage.bonusDamage).toBe(500);
    }
  });

  it('中毒在目标行动结束时扣血，持续 2 次行动', () => {
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
        initialCharge: 100,
        skillAtk: 0,
        speed: 100,
      },
      skill: TEST_POISON,
    });
    const enemy = makeUnit({
      id: 'e',
      side: 'enemy',
      coord: { x: 2, y: 3 },
      stats: {
        hp: 10000,
        physDef: 0,
        skillDef: 0,
        dodge: 0,
        crit: 0,
        antiCrit: 0,
        initialCharge: 0,
        speed: 1,
      },
    });

    const battle = new Battle({
      playerUnits: [player],
      enemyUnits: [enemy],
      seed: 32,
    });

    battle.step(); // 施放中毒，技能本身先造成 100 伤害
    expect(enemy.hp).toBe(9900);

    // 之后的普攻让目标闪避，避免干扰中毒伤害断言。
    player.stats.hit = 0;

    battle.step(); // 敌方行动，中毒结算 10
    expect(enemy.hp).toBe(9890);

    battle.step(); // 新回合，我方普攻（必闪）
    battle.step(); // 敌方行动，中毒第二次结算 10
    expect(enemy.hp).toBe(9880);
  });

  it('技能可增加自身蓄能', () => {
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
        initialCharge: 100,
        skillAtk: 0,
        speed: 100,
      },
      skill: TEST_SELF_CHARGE,
    });
    const enemy = makeUnit({
      id: 'e',
      side: 'enemy',
      coord: { x: 2, y: 3 },
      stats: {
        hp: 10000,
        physDef: 0,
        skillDef: 0,
        dodge: 0,
        antiCrit: 0,
        speed: 1,
      },
    });

    const battle = new Battle({
      playerUnits: [player],
      enemyUnits: [enemy],
      seed: 33,
    });
    const events = battle.step();

    expect(player.charge).toBe(100);
    expect(
      events.some(
        (event) => event.type === 'charge' && event.reason === 'effect',
      ),
    ).toBe(true);
  });

  it('技能可增加全体蓄能', () => {
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
        initialCharge: 100,
        skillAtk: 0,
        speed: 100,
      },
      skill: TEST_TEAM_CHARGE,
    });
    const ally = makeUnit({
      id: 'a',
      side: 'player',
      coord: { x: 1, y: 1 },
      stats: { hp: 10000, initialCharge: 50, speed: 1 },
    });
    const enemy = makeUnit({
      id: 'e',
      side: 'enemy',
      coord: { x: 2, y: 3 },
      stats: {
        hp: 10000,
        physDef: 0,
        skillDef: 0,
        dodge: 0,
        antiCrit: 0,
        speed: 1,
      },
    });

    const battle = new Battle({
      playerUnits: [player, ally],
      enemyUnits: [enemy],
      seed: 34,
    });
    battle.step();

    expect(player.charge).toBe(50);
    expect(ally.charge).toBe(100);
  });

  it('解析新角色的特殊技能机制', () => {
    expect(SKILLS['codex-skill-赤光镭射炮'].selfChargeGain).toBe(100);
    expect(SKILLS['codex-skill-赤光镭射炮'].onHitEffects?.[0]).toMatchObject({
      kind: 'statBuff',
      stat: 'skillAtk',
      mul: 0,
      duration: 1,
    });

    expect(SKILLS['codex-skill-伽马耀斑'].selfChargeGain).toBe(25);

    const drunk = SKILLS['codex-skill-零式醉光弹'];
    expect(drunk.castEffects?.[0]).toMatchObject({
      target: 'self',
      effect: { kind: 'statBuff', stat: 'physAtk', mul: 10, chance: 10 },
    });
    expect(drunk.castEffects?.[1]).toMatchObject({
      target: 'self',
      effect: { kind: 'shield', absorb: 1500000, chance: 10 },
    });

    const pharaoh = SKILLS['codex-skill-法老的祝福'];
    expect(pharaoh.castEffects?.[0]).toMatchObject({
      target: 'allAlliesExceptSelf',
      effect: { kind: 'stealth', duration: 1 },
    });
    expect(pharaoh.onHitEffects?.[0]).toMatchObject({
      kind: 'shield',
      absorb: 100000,
      chance: 10,
    });

    const jesse = SKILLS['codex-skill-纳米修复'];
    expect(jesse.healPercent).toBe(60);
    expect(jesse.healTargets).toEqual(['self', 'lowestHpAlly']);
    expect(jesse.selfChargeGain).toBe(100);

    const boris = SKILLS['codex-skill-暗能侵蚀'];
    expect(boris.poisonRandomCount).toBe(2);
    expect(boris.poisonPercent).toBe(66);
    expect(boris.poisonDuration).toBe(2);

    expect(SKILLS['codex-skill-冰封光束'].onHitEffects?.[0]).toMatchObject({
      kind: 'freeze',
      duration: 1,
      defDownPercent: 50,
    });
  });

  it('赤蝎雷利释放技能后回复蓄能并清空目标技能攻击', () => {
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
        initialCharge: 100,
        skillAtk: 0,
        speed: 100,
      },
      skill: SKILLS['codex-skill-赤光镭射炮'],
    });
    const enemy = makeUnit({
      id: 'e',
      side: 'enemy',
      coord: { x: 2, y: 3 },
      stats: {
        hp: 100000,
        physDef: 0,
        skillDef: 0,
        skillAtk: 500,
        dodge: 0,
        antiCrit: 0,
        speed: 1,
      },
    });

    const battle = new Battle({
      playerUnits: [player],
      enemyUnits: [enemy],
      seed: 40,
    });
    battle.step();

    expect(player.charge).toBe(100);
    expect(enemy.getStat('skillAtk')).toBe(0);
  });

  it('杰西治疗自身和血量最低的队友', () => {
    const player = makeUnit({
      id: 'p',
      side: 'player',
      coord: { x: 2, y: 2 },
      stats: {
        hp: 10000,
        physAtk: 500,
        skillAtk: 100,
        dodge: 0,
        crit: 0,
        antiCrit: 0,
        initialCharge: 100,
        speed: 100,
      },
      skill: SKILLS['codex-skill-纳米修复'],
    });
    const ally = makeUnit({
      id: 'a',
      side: 'player',
      coord: { x: 1, y: 1 },
      stats: { hp: 10000, speed: 1 },
    });
    const enemy = makeUnit({
      id: 'e',
      side: 'enemy',
      coord: { x: 2, y: 3 },
      stats: { hp: 10000, speed: 1 },
    });
    player.hp = 5000;
    ally.hp = 3000;

    const battle = new Battle({
      playerUnits: [player, ally],
      enemyUnits: [enemy],
      seed: 41,
    });
    const events = battle.step();

    expect(player.hp).toBe(5360);
    expect(ally.hp).toBe(3360);
    expect(events.filter((event) => event.type === 'heal')).toHaveLength(2);
  });

  it('解析拦截和破防属性', () => {
    expect(CHARACTER_MAP['艾玛'].base.intercept).toBe(1);
    expect(CHARACTER_MAP['艾玛'].base.armorBreak).toBe(8);
    expect(CHARACTER_MAP['无头骑士'].base.intercept).toBe(20);
    expect(CHARACTER_MAP['无头骑士'].base.armorBreak).toBe(20);

    const result = parseCodex(`
护航者()
测试(S)，技能：测试，单体，100%伤害
属性：1000 100 50 80 40 10% 5% 160% 20% 30% 7% 105% 25 60
`);
    const base = result.characters[0].base;
    expect(base.intercept).toBe(20);
    expect(base.armorBreak).toBe(30);
    expect(base.dodge).toBe(7);
    expect(base.hit).toBe(105);
  });

  it('拦截普通攻击时伤害减半并普攻还击', () => {
    const attacker = makeUnit({
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
        initialCharge: 0,
        armorBreak: 100,
        speed: 100,
      },
    });
    const target = makeUnit({
      id: 'e',
      side: 'enemy',
      coord: { x: 2, y: 3 },
      stats: {
        hp: 10000,
        physAtk: 100,
        physDef: 0,
        hit: 200,
        dodge: 0,
        crit: 0,
        antiCrit: 0,
        initialCharge: 0,
        intercept: 0,
        armorBreak: 0,
        speed: 1,
      },
    });

    const battle = new Battle({
      playerUnits: [attacker],
      enemyUnits: [target],
      seed: 50,
      rng: stubRng([true, false, true, true, false]),
    });
    const events = battle.step();

    expect(target.hp).toBe(9950);
    expect(attacker.hp).toBe(9900);
    expect(events.some((event) => event.type === 'intercept')).toBe(true);
    expect(
      events.filter((event) => event.type === 'normalAttack'),
    ).toHaveLength(2);
    expect(target.charge).toBe(25);
    expect(attacker.charge).toBe(50);
  });

  it('拦截技能时只减伤，不触发普攻反击', () => {
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
        initialCharge: 100,
        skillAtk: 0,
        armorBreak: 200,
        speed: 100,
      },
      skill: TEST_SKILL_150,
    });
    const target = makeUnit({
      id: 'e',
      side: 'enemy',
      coord: { x: 2, y: 3 },
      stats: {
        hp: 10000,
        physAtk: 100,
        physDef: 0,
        skillDef: 0,
        hit: 200,
        dodge: 0,
        crit: 0,
        antiCrit: 0,
        initialCharge: 0,
        intercept: 100,
        speed: 1,
      },
    });

    const battle = new Battle({
      playerUnits: [player],
      enemyUnits: [target],
      seed: 51,
      rng: stubRng([true, false, true]),
    });
    const events = battle.step();

    expect(target.hp).toBe(9925);
    expect(events.filter((event) => event.type === 'intercept')).toHaveLength(1);
    expect(
      events.filter((event) => event.type === 'normalAttack'),
    ).toHaveLength(0);
  });

  it('解析小野和达伦的技能', () => {
    const ono = SKILLS['codex-skill-量子护盾'];
    expect(ono.baseMultiplier).toBeCloseTo(1.8);
    expect(ono.selfChargeGain).toBe(25);
    expect(ono.castEffects?.[0]).toMatchObject({
      target: 'self',
      effect: {
        kind: 'statBuff',
        stat: 'intercept',
        add: 30,
        duration: 2,
      },
    });

    const daren = SKILLS['codex-skill-黑暗侵袭'];
    expect(daren.shape).toBe('sameRow');
    expect(daren.castEffects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          target: 'allAllies',
          effect: expect.objectContaining({
            kind: 'statBuff',
            stat: 'hit',
            add: 100,
            duration: 1,
          }),
        }),
        expect.objectContaining({
          target: 'randomAllies',
          count: 3,
          effect: expect.objectContaining({
            kind: 'statBuff',
            stat: 'intercept',
            add: 100,
            duration: 1,
          }),
        }),
      ]),
    );
  });

  it('达伦为随机三名友方增加拦截', () => {
    const coords: Coord[] = [
      { x: 1, y: 3 },
      { x: 2, y: 3 },
      { x: 3, y: 3 },
      { x: 1, y: 2 },
      { x: 2, y: 2 },
    ];
    const players = coords.map((coord, index) =>
      makeUnit({
        id: `p${index}`,
        side: 'player',
        coord,
        stats: {
          hp: 10000,
          physAtk: 100,
          hit: 200,
          dodge: 0,
          crit: 0,
          antiCrit: 0,
          initialCharge: index === 0 ? 100 : 0,
          speed: index === 0 ? 100 : 1,
        },
        skill: index === 0 ? SKILLS['codex-skill-黑暗侵袭'] : TEST_BASIC,
      }),
    );
    const enemy = makeUnit({
      id: 'e',
      side: 'enemy',
      coord: { x: 2, y: 3 },
      stats: {
        hp: 100000,
        physDef: 0,
        skillDef: 0,
        dodge: 0,
        antiCrit: 0,
        speed: 1,
      },
    });

    const battle = new Battle({
      playerUnits: players,
      enemyUnits: [enemy],
      seed: 60,
    });
    battle.step();

    const withIntercept = players.filter((unit) =>
      unit.effects.some((effect) =>
        effect.statMods?.some(
          (mod) => mod.key === 'intercept' && mod.add === 100,
        ),
      ),
    );
    expect(withIntercept).toHaveLength(3);
    expect(players.every((unit) => unit.getStat('hit') === 300)).toBe(true);
  });

  it('解析 -- 阵营、节能 别名和被动', () => {
    const result = parseCodex(`
--突击舰(1)
测试(S)，节能：测试甲，单体，100%伤害。被动：测试者被击中时不会增加蓄能。
属性：3090 850 1025 135 100 10% 0% 150% 10% 105% 37 50
`);
    const character = result.characters[0];
    expect(character.faction).toBe('突击舰');
    expect(character.complete).toBe(true);
    expect(character.passive?.noHitCharge).toBe(true);
    expect(result.skills[character.skillId].name).toBe('测试甲');
  });

  it('解析多属性全体增益', () => {
    const result = parseCodex(`
突击舰()
测试(SS)，技能：测试，单体，100%伤害，增加全体100%暴击和命中1回合
属性：5110 1060 1031 538 540 40% 5% 170% 20% 120% 42 75
`);
    const character = result.characters[0];
    const skill = result.skills[character.skillId];
    const stats = skill.castEffects?.map((cast) =>
      cast.effect.kind === 'statBuff' ? cast.effect.stat : '',
    );
    expect(stats).toEqual(['crit', 'hit']);
  });
});

describe('crystals', () => {
  it('氪晶属性正确聚合到单位', () => {
    const template = CHARACTER_MAP['奥尼尔'];
    const unit = buildUnit(
      template,
      'player',
      { x: 1, y: 1 },
      ['湛蓝', '星海'],
      'p',
    );

    // R5 湛蓝：2400 + 800 × (7 - 1) = 7200 能量攻击。
    expect(unit.stats.energyAtk).toBeCloseTo(
      (template.base.energyAtk ?? 0) * 15 + 19900 + 7200,
    );
    // R4 星海：固定 +50 初始蓄能。
    expect(unit.charge).toBe(
      Math.min(300, (template.base.initialCharge ?? 50) + 50),
    );

    // R5 死眼：6% + 2% × (7 - 1) = 18% 命中。
    const hero = CHARACTER_MAP['主角'];
    const hitUnit = buildUnit(hero, 'player', { x: 1, y: 1 }, ['死眼'], 'h');
    expect(hitUnit.stats.hit).toBeCloseTo((hero.base.hit ?? 0) + 18);
  });

  it('共享库存且不可重复装备', () => {
    const game = new Game();
    const unused = CRYSTALS.find(
      (crystal) => game.crystalUsedBy(crystal.id) === null,
    );
    expect(unused).toBeDefined();
    if (!unused) return;

    const owner = game.slots[0];
    const other = game.slots[1];
    expect(owner).toBeDefined();
    expect(other).toBeDefined();
    if (!owner || !other) return;

    expect(game.equipCrystal(owner.charId, unused.id)).toBe(true);
    expect(game.crystalUsedBy(unused.id)).toBe(owner.charId);
    expect(game.equipCrystal(other.charId, unused.id)).toBe(false);
  });
});
