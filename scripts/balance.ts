import { Game } from '../src/game/Game';

let playerWins = 0;
let enemyWins = 0;
const rounds: number[] = [];

for (let index = 0; index < 40; index += 1) {
  const game = new Game();
  game.startBattle();
  const battle = game.battle!;
  let steps = 0;
  while (!battle.finished && steps < 500) {
    battle.step();
    steps += 1;
  }
  if (battle.winner === 'player') playerWins += 1;
  else enemyWins += 1;
  rounds.push(battle.round);
}

const average = rounds.reduce((sum, value) => sum + value, 0) / rounds.length;
console.log({ playerWins, enemyWins, averageRound: average.toFixed(2) });
