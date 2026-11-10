import type { Coord, Side, Stats } from '../core/types';
import type { Game } from '../game/Game';
import type { Unit } from '../battle/Unit';
import { CHARACTER_MAP } from '../data/characters';
import { CRYSTAL_MAP } from '../data/crystals';
import { SKILLS } from '../skills/registry';
import { formatAttribute } from '../core/attributes';

export interface BoardCallbacks {
  onCellClick?: (coord: Coord) => void;
  onUnitClick?: (unitId: string) => void;
  onPreviewClick?: (charId: string) => void;
}

export function renderBoard(
  container: HTMLElement,
  game: Game,
  side: Side,
  callbacks: BoardCallbacks = {},
): void {
  container.innerHTML = '';
  container.classList.add('board');

  const columns = side === 'player' ? [1, 2, 3] : [3, 2, 1];

  for (let x = 1; x <= 3; x += 1) {
    for (const y of columns) {
      const coord: Coord = { x, y };
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.side = side;
      cell.dataset.x = String(x);
      cell.dataset.y = String(y);

      if (game.phase === 'prepare' && side === 'player') {
        cell.classList.add('interactive');
        cell.addEventListener('click', () => callbacks.onCellClick?.(coord));
      }

      if (game.phase === 'prepare') {
        if (side === 'player') {
          const slot = game.slots.find(
            (current) =>
              current.coord.x === coord.x && current.coord.y === coord.y,
          );
          if (slot) {
            cell.appendChild(renderPreviewCard(game, slot.charId, slot.crystalIds, side, callbacks));
          }
        } else {
          const slot = game.enemyPreview.find(
            (current) =>
              current.coord.x === coord.x && current.coord.y === coord.y,
          );
          if (slot) {
            cell.appendChild(renderPreviewCard(game, slot.charId, slot.crystalIds, side, callbacks));
          }
        }
      } else if (game.battle) {
        const unit = game.battle.board.unitAt(side, coord);
        if (unit) cell.appendChild(renderUnitCard(game, unit, callbacks));
      }

      container.appendChild(cell);
    }
  }
}

function renderPreviewCard(
  game: Game,
  charId: string,
  crystalIds: string[],
  side: Side,
  callbacks: BoardCallbacks,
): HTMLElement {
  const template = CHARACTER_MAP[charId];
  const stats: Stats =
    side === 'player'
      ? game.previewStats(charId, crystalIds)
      : game.baseStats(charId);
  const skill = SKILLS[template.skillId];

  const card = document.createElement('div');
  card.className = `unit-card preview ${side}`;
  if (side === 'player' && game.selectedCharId === charId) {
    card.classList.add('selected');
  }

  const attackLabel = template.destroyer
    ? `能量 ${formatAttribute('energyAtk', stats.energyAtk)}`
    : `物攻 ${formatAttribute('physAtk', stats.physAtk)}`;

  card.innerHTML = `
    <div class="unit-head">
      <span class="unit-name">${template.name}</span>
      <span class="unit-role">${template.role}</span>
    </div>
    <div class="preview-hp">HP ${formatAttribute('hp', stats.hp)}</div>
    <div class="preview-line">${attackLabel} · 速 ${formatAttribute('speed', stats.speed)}</div>
    <div class="preview-skill">${skill?.name ?? '—'}</div>
    <div class="preview-crystals">氪晶 ${crystalIds.length}/${template.crystalSlots}</div>
  `;

  if (side === 'player') {
    card.addEventListener('click', (event) => {
      event.stopPropagation();
      callbacks.onPreviewClick?.(charId);
    });
  }

  return card;
}

function renderUnitCard(
  game: Game,
  unit: Unit,
  callbacks: BoardCallbacks,
): HTMLElement {
  const card = document.createElement('div');
  card.className = `unit-card ${unit.side}`;
  card.dataset.unitId = unit.id;
  if (unit.destroyer) card.classList.add('destroyer');
  if (game.selectedBattleUnitId === unit.id) card.classList.add('selected');
  if (game.phase === 'battle' && game.battle?.currentUnit?.id === unit.id) {
    card.classList.add('active');
  }

  const hpPercent = Math.max(0, Math.min(100, (unit.hp / unit.maxHp) * 100));
  const chargePercent = Math.max(0, Math.min(100, (unit.charge / 300) * 100));
  const ready = unit.charge >= 100;
  const attack = unit.destroyer
    ? `能量 ${unit.stats.energyAtk}`
    : `物攻 ${unit.stats.physAtk}`;

  card.innerHTML = `
    <div class="unit-head">
      <span class="unit-name">${unit.name}</span>
      <span class="unit-role">${unit.role}</span>
    </div>
    <div class="bar hp-bar"><div class="fill hp-fill" style="width:${hpPercent}%"></div></div>
    <div class="unit-hp"><span>HP</span><span>${Math.ceil(unit.hp)} / ${unit.maxHp}</span></div>
    <div class="bar charge-bar"><div class="fill charge-fill ${ready ? 'ready' : ''}" style="width:${chargePercent}%"></div></div>
    <div class="unit-charge"><span>蓄能</span><span>${unit.charge} / 300</span></div>
    <div class="unit-badges">${renderBadges(unit, ready)}</div>
    <div class="unit-foot">${attack} · 速 ${unit.stats.speed}</div>
  `;

  card.addEventListener('click', (event) => {
    event.stopPropagation();
    callbacks.onUnitClick?.(unit.id);
  });

  return card;
}

function renderBadges(unit: Unit, ready: boolean): string {
  const badges: string[] = [];

  const shieldTotal = unit.shieldTotal();
  if (shieldTotal > 0) {
    badges.push(
      `<span class="badge shield">🛡 ${shieldTotal} · ${unit.shieldMinDuration()}</span>`,
    );
  }

  const lockDuration = unit.effectMaxDuration('lock');
  if (lockDuration > 0) {
    badges.push(`<span class="badge lock">🔒 ${lockDuration}</span>`);
  }

  const silenceDuration = unit.effectMaxDuration('silence');
  if (silenceDuration > 0) {
    badges.push(`<span class="badge silence">🚫 ${silenceDuration}</span>`);
  }

  if (ready && !unit.isSilenced()) {
    badges.push('<span class="badge ready">⚡ 就绪</span>');
  }

  return badges.join('');
}

export function crystalName(id: string): string {
  return CRYSTAL_MAP[id]?.name ?? id;
}
