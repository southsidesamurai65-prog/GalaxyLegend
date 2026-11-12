import { Battle } from '../src/battle/Battle';
import { CHARACTER_MAP } from '../src/data/characters';
import { buildUnit } from '../src/game/loadout';
import { formatEvent } from '../src/ui/logView';
import type { Coord, Side } from '../src/core/types';

function make(charId: string, side: Side, coord: Coord): ReturnType<typeof buildUnit> {
  const template = CHARACTER_MAP[charId];
  if (!template) throw new Error(`missing ${charId}`);
  const unit = buildUnit(template, side, coord, [], `${side[0]}-${charId}`);
  unit.charge = 100;
  return unit;
}

const player = [
  make('兰斯洛特', 'player', { x: 1, y: 3 }),
  make('艾尔莎', 'player', { x: 2, y: 3 }),
  make('格拉汉姆', 'player', { x: 3, y: 3 }),
  make('娜西娅', 'player', { x: 1, y: 2 }),
  make('瑞泽格尔', 'player', { x: 2, y: 2 }),
];
const enemy = [
  make('艾玛女王', 'enemy', { x: 1, y: 3 }),
  make('无头骑士', 'enemy', { x: 2, y: 3 }),
  make('风暴丹尼斯', 'enemy', { x: 3, y: 3 }),
  make('安德鲁', 'enemy', { x: 1, y: 2 }),
  make('泽拉图', 'enemy', { x: 2, y: 2 }),
];

const battle = new Battle({ playerUnits: player, enemyUnits: enemy, seed: 99 });
let steps = 0;
while (!battle.finished && steps < 300) {
  const events = battle.step();
  for (const event of events) {
    const line = formatEvent(event);
    if (line) console.log(line.html.replace(/<[^>]+>/g, ''));
  }
  steps += 1;
}
console.log('---');
console.log(`steps=${steps} round=${battle.round} winner=${battle.winner}`);
