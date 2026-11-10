import './styles.css';
import type { Coord } from './core/types';
import { Game } from './game/Game';
import { renderBoard } from './ui/boardView';
import { renderBattlePanel, renderPreparePanel } from './ui/hud';
import { LogView } from './ui/logView';
import { playEventsFx } from './ui/fx';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('Missing #app');

app.innerHTML = `
  <div class="game-shell">
    <header class="topbar">
      <div>
        <h1>银河传说</h1>
        <div class="subtitle">3×3 自动战斗 · 机制演示</div>
      </div>
      <div id="phase-label" class="phase-label prepare">准备阶段</div>
    </header>
    <main class="layout">
      <section class="battlefield">
        <div class="board-wrap">
          <div class="side-title player-title">我方</div>
          <div id="player-board" class="board"></div>
          <div class="axis">后排 <span>←</span> <span>→</span> 前排</div>
        </div>
        <div class="vs">VS</div>
        <div class="board-wrap">
          <div class="side-title enemy-title">敌方</div>
          <div id="enemy-board" class="board"></div>
          <div class="axis">前排 <span>←</span> <span>→</span> 后排</div>
        </div>
      </section>
      <aside class="panel">
        <div id="panel-content"></div>
        <div class="log-section">
          <h3>战斗日志</h3>
          <div id="log" class="log"></div>
        </div>
      </aside>
    </main>
    <footer class="footer">
      <div id="footer-actions" class="footer-actions"></div>
      <div id="footer-hint" class="footer-hint"></div>
    </footer>
  </div>
`;

const playerBoard = document.querySelector<HTMLDivElement>('#player-board')!;
const enemyBoard = document.querySelector<HTMLDivElement>('#enemy-board')!;
const panelContent = document.querySelector<HTMLDivElement>('#panel-content')!;
const logElement = document.querySelector<HTMLDivElement>('#log')!;
const phaseLabel = document.querySelector<HTMLDivElement>('#phase-label')!;
const footerActions = document.querySelector<HTMLDivElement>('#footer-actions')!;
const footerHint = document.querySelector<HTMLDivElement>('#footer-hint')!;

const game = new Game();
const log = new LogView(logElement);

let timer: number | null = null;
let paused = false;
let speedMs = 700;

const prepareCallbacks = {
  selectChar: (charId: string) => {
    game.selectedCharId = charId;
    render();
  },
  placeChar: (charId: string) => {
    game.autoPlace(charId);
    render();
  },
  removeChar: (charId: string) => {
    game.removeChar(charId);
    render();
  },
  toggleCrystal: (charId: string, crystalId: string) => {
    game.equipCrystal(charId, crystalId);
    render();
  },
};

log.add(
  '准备阶段：点击角色，再点击我方棋盘空位放置/移动；点击氪晶装备或卸下。',
  'round',
);

render();

function render(): void {
  phaseLabel.textContent =
    game.phase === 'prepare'
      ? '准备阶段'
      : game.phase === 'battle'
        ? '战斗中'
        : '战斗结束';
  phaseLabel.className = `phase-label ${game.phase}`;

  renderBoard(playerBoard, game, 'player', {
    onCellClick: handleCellClick,
    onUnitClick: handleUnitClick,
    onPreviewClick: handlePreviewClick,
  });
  renderBoard(enemyBoard, game, 'enemy', {
    onUnitClick: handleUnitClick,
  });

  if (game.phase === 'prepare') {
    renderPreparePanel(panelContent, game, prepareCallbacks);
  } else {
    renderBattlePanel(panelContent, game);
  }

  renderFooter();
}

function handleCellClick(coord: Coord): void {
  if (game.phase !== 'prepare') return;

  const slot = game.slotAt(coord);
  if (slot) {
    game.selectedCharId = slot.charId;
    render();
    return;
  }

  if (game.selectedCharId) {
    game.placeAt(game.selectedCharId, coord);
    render();
  }
}

function handleUnitClick(unitId: string): void {
  game.selectedBattleUnitId = unitId;
  render();
}

function handlePreviewClick(charId: string): void {
  game.selectedCharId = charId;
  render();
}

function beginBattle(): void {
  if (game.slots.length === 0) return;
  clearTimer();

  if (!game.startBattle()) return;
  paused = false;
  log.clear();

  const battle = game.battle!;
  log.add(
    `总速度：我方 ${battle.speedTotals.player} vs 敌方 ${battle.speedTotals.enemy}；${
      battle.firstSide === 'player' ? '我方' : '敌方'
    }先手`,
    'round',
  );

  render();
  scheduleTick();
}

function scheduleTick(): void {
  clearTimer();
  if (paused || game.phase !== 'battle' || !game.battle || game.battle.finished) {
    return;
  }

  timer = window.setTimeout(() => {
    if (!game.battle || game.phase !== 'battle' || paused) return;

    const events = game.battle.step();
    for (const event of events) log.handle(event);

    if (game.battle.finished) game.phase = 'result';

    // 先渲染新状态，再在最新 DOM 上播放特效。
    render();
    playEventsFx(events);

    if (game.phase === 'battle') scheduleTick();
  }, speedMs);
}

function clearTimer(): void {
  if (timer !== null) {
    window.clearTimeout(timer);
    timer = null;
  }
}

function togglePause(): void {
  paused = !paused;
  if (paused) clearTimer();
  else scheduleTick();
  renderFooter();
}

function setSpeed(nextSpeedMs: number): void {
  speedMs = nextSpeedMs;
  if (!paused && game.phase === 'battle') scheduleTick();
  renderFooter();
}

function renderFooter(): void {
  footerActions.innerHTML = '';

  if (game.phase === 'prepare') {
    const start = button('开始战斗', 'primary', beginBattle);
    start.disabled = game.slots.length === 0;

    const reset = button('重置阵容', '', () => {
      clearTimer();
      paused = false;
      game.reset();
      log.clear();
      log.add('阵容已重置。', 'round');
      render();
    });

    footerActions.append(start, reset);
    footerHint.textContent = `已上阵 ${game.slots.length}/5 · 点击角色后点击空位放置/移动`;
    return;
  }

  if (game.phase === 'battle') {
    const pause = button(paused ? '继续' : '暂停', '', togglePause);
    const speed1 = button('1×', speedMs === 700 ? 'active' : '', () => setSpeed(700));
    const speed2 = button('2×', speedMs === 350 ? 'active' : '', () => setSpeed(350));
    const speed4 = button('4×', speedMs === 175 ? 'active' : '', () => setSpeed(175));
    const restart = button('重新开始', '', beginBattle);

    footerActions.append(pause, speed1, speed2, speed4, restart);
    footerHint.textContent = `第 ${game.battle?.round ?? 1} 回合 · 点击棋盘角色查看详情`;
    return;
  }

  const again = button('再战', 'primary', beginBattle);
  const back = button('返回准备', '', () => {
    clearTimer();
    paused = false;
    game.backToPrepare();
    log.clear();
    log.add('已返回准备阶段。', 'round');
    render();
  });

  footerActions.append(again, back);
  footerHint.textContent =
    game.battle?.winner === 'player' ? '我方胜利' : '敌方胜利';
}

function button(
  label: string,
  className: string,
  onClick: () => void,
): HTMLButtonElement {
  const element = document.createElement('button');
  element.textContent = label;
  element.className = className;
  element.addEventListener('click', onClick);
  return element;
}
