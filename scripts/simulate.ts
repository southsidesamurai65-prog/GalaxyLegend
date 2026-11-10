import { Game } from '../src/game/Game';
import { formatEvent } from '../src/ui/logView';

const game = new Game();
game.startBattle();
const battle = game.battle;
if (!battle) throw new Error('battle not started');

let steps = 0;
while (!battle.finished && steps < 500) {
  const events = battle.step();
  for (const event of events) {
    const line = formatEvent(event);
    if (line) console.log(line.html.replace(/<[^>]+>/g, ''));
  }
  steps += 1;
}

console.log('---');
console.log(
  `steps=${steps} round=${battle.round} winner=${battle.winner} finished=${battle.finished}`,
);
