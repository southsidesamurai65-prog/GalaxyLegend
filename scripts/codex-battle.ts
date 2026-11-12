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
  make('里昂', 'player', { x: 2, y: 2 }),
  make('林明美', 'player', { x: 1, y: 3 }),
  make('主角', 'player', { x: 3, y: 2 }),
  make('雅各', 'player', { x: 2, y: 1 }),
  make('多米里安', 'player', { x: 3, y: 1 }),
];
const enemy = [
  make('里希特', 'enemy', { x: 2, y: 3 }),
  make('达太', 'enemy', { x: 1, y: 3 }),
  make('索菲蒂亚', 'enemy', { x: 3, y: 3 }),
  make('艾玛', 'enemy', { x: 1, y: 2 }),
  make('奥尼尔', 'enemy', { x: 2, y: 2 }),
];

const battle = new Battle({ playerUnits: player, enemyUnits: enemy, seed: 42 });
let steps = 0;
while (!battle.finished && steps < 200) {
  const events = battle.step();
  for (const event of events) {
    const line = formatEvent(event);
    if (line) console.log(line.html.replace(/<[^>]+>/g, ''));
  }
  steps += 1;
}
console.log('---');
console.log(`steps=${steps} round=${battle.round} winner=${battle.winner}`);
