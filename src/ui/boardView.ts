import type { Coord, Side, Stats } from '../core/types';
import type { Game } from '../game/Game';
import type { Unit } from '../battle/Unit';
import { CHARACTER_MAP } from '../data/characters';
import { CRYSTAL_MAP } from '../data/crystals';
import { SKILLS } from '../skills/registry';
import { formatAttribute } from '../core/attributes';
import { formatCompact } from './format';

export interface BoardCallbacks {
  onCellClick?: (coord: Coord) => void;
  onEnemyCellClick?: (coord: Coord) => void;
  onUnitClick?: (unitId: string) => void;
  onPreviewClick?: (charId: string) => void;
  enemyEditMode?: boolean;
}

export function renderBoard(
  container: HTMLElement,
  game: Game,
  side: Side,
  callbacks: BoardCallbacks = {},
): void {
  container.innerHTML = '';
  container.classList.add('board');
  container.classList.toggle('battle-board', game.phase !== 'prepare');

  const columns = side === 'player' ? [1, 2, 3] : [3, 2, 1];

  for (let x = 1; x <= 3; x += 1) {
    for (const y of columns) {
      const coord: Coord = { x, y };
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.side = side;
      cell.dataset.x = String(x);
      cell.dataset.y = String(y);

      if (
        game.phase === 'prepare' &&
        side === 'player' &&
        !callbacks.enemyEditMode
      ) {
        cell.classList.add('interactive');
        cell.addEventListener('click', () => callbacks.onCellClick?.(coord));
      }

      if (
        game.phase === 'prepare' &&
        side === 'enemy' &&
        callbacks.enemyEditMode
      ) {
        cell.classList.add('interactive');
        cell.addEventListener('click', () =>
          callbacks.onEnemyCellClick?.(coord),
        );
      }

      if (game.phase === 'prepare') {
        if (side === 'player') {
          const slot = game.slots.find(
            (current) =>
              current.coord.x === coord.x && current.coord.y === coord.y,
          );
          if (slot) {
            cell.appendChild(
              wrapVisual(
                renderPreviewCard(
                  game,
                  slot.charId,
                  slot.crystalIds,
                  side,
                  callbacks,
                ),
                side,
              ),
            );
          }
        } else {
          const slot = game.enemyPreview.find(
            (current) =>
              current.coord.x === coord.x && current.coord.y === coord.y,
          );
          if (slot) {
            cell.appendChild(
              wrapVisual(
                renderPreviewCard(
                  game,
                  slot.charId,
                  slot.crystalIds,
                  side,
                  callbacks,
                ),
                side,
              ),
            );
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

function wrapVisual(card: HTMLElement, side: Side): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = `unit-visual ${side}`;
  if (card.classList.contains('selected')) wrapper.classList.add('selected');
  if (card.classList.contains('active')) wrapper.classList.add('active');
  if (card.classList.contains('stealthed')) wrapper.classList.add('stealthed');
  wrapper.appendChild(card);
  return wrapper;
}

function renderPreviewCard(
  game: Game,
  charId: string,
  crystalIds: string[],
  side: Side,
  callbacks: BoardCallbacks,
): HTMLElement {
  const template = CHARACTER_MAP[charId];
  const stats: Stats = game.previewStats(charId, crystalIds);
  const skill = SKILLS[template.skillId];

  const card = document.createElement('div');
  card.className = `unit-card preview ${side}`;
  if (
    (side === 'player' && game.selectedCharId === charId) ||
    (side === 'enemy' && game.selectedEnemyCharId === charId)
  ) {
    card.classList.add('selected');
  }

  const attackLabel = template.destroyer
    ? `能量 ${formatAttribute('energyAtk', stats.energyAtk)}`
    : `物攻 ${formatAttribute('physAtk', stats.physAtk)}`;

  card.title = `${template.faction} · ${template.role}`;
  card.innerHTML = `
    <div class="unit-head">
      <span class="unit-name">${template.name}</span>
      <span class="rarity ${template.rarity}">${template.rarity}</span>
    </div>
    <div class="preview-hp">HP ${formatCompact(stats.hp)}</div>
    <div class="preview-line">${template.faction} · ${attackLabel} · 速 ${formatAttribute('speed', stats.speed)}</div>
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
  card.className = `unit-card battle-card ${unit.side}`;
  card.dataset.unitId = unit.id;
  if (unit.destroyer) card.classList.add('destroyer');
  if (unit.isStealthed()) card.classList.add('stealthed');
  if (game.selectedBattleUnitId === unit.id) card.classList.add('selected');
  if (game.phase === 'battle' && game.battle?.currentUnit?.id === unit.id) {
    card.classList.add('active');
  }

  const ready = unit.charge >= 100;
  if (ready) card.classList.add('charge-ready');

  const attack = unit.destroyer
    ? `能量 ${unit.getStat('energyAtk')}`
    : `物攻 ${unit.getStat('physAtk')}`;
  const speed = unit.getStat('speed');

  card.title = `${unit.faction ?? unit.role} · ${unit.rarity ?? ''} · HP ${formatCompact(unit.hp)}/${formatCompact(unit.maxHp)} · ${attack} · 速 ${speed}`;
  card.innerHTML = `
    <div class="unit-head">
      <span class="unit-name">${unit.name}</span>
      ${unit.rarity ? `<span class="rarity ${unit.rarity}">${unit.rarity}</span>` : ''}
    </div>
    <div class="unit-token">
      ${ready ? '<span class="charge-ring"></span>' : ''}
      <span class="ship"></span>
    </div>
    <div class="unit-bars">
      <div class="unit-bar-row">
        <span class="bar-tag">HP</span>
        <div class="seg-bar hp">${renderSegments(unit.hp, unit.maxHp)}</div>
        <span class="bar-num">${formatCompact(unit.hp)}</span>
      </div>
      <div class="unit-bar-row">
        <span class="bar-tag">⚡</span>
        <div class="seg-bar charge ${ready ? 'ready' : ''}">${renderSegments(unit.charge, 300)}</div>
        <span class="bar-num">${unit.charge}</span>
      </div>
    </div>
    <div class="unit-badges">${renderBadges(unit)}</div>
  `;

  card.addEventListener('click', (event) => {
    event.stopPropagation();
    callbacks.onUnitClick?.(unit.id);
  });

  const wrapper = wrapVisual(card, unit.side);

  if (unit.shieldTotal() > 0) {
    const shield = document.createElement('div');
    shield.className = 'shield-bubble';
    wrapper.appendChild(shield);
  }

  if (unit.effectMaxDuration('freeze') > 0) {
    const freeze = document.createElement('div');
    freeze.className = 'freeze-aura';
    wrapper.appendChild(freeze);
  } else if (unit.isLocked()) {
    const lock = document.createElement('div');
    lock.className = 'lock-ring';
    wrapper.appendChild(lock);
  }

  if (unit.isStealthed()) {
    const stealth = document.createElement('div');
    stealth.className = 'stealth-aura';
    wrapper.appendChild(stealth);
  }

  if (unit.effectMaxDuration('poison') > 0) {
    const poison = document.createElement('div');
    poison.className = 'poison-aura';
    wrapper.appendChild(poison);
  }

  return wrapper;
}

function renderSegments(value: number, max: number, total = 10): string {
  const ratio = max > 0 ? value / max : 0;
  const filled =
    value <= 0
      ? 0
      : Math.max(1, Math.min(total, Math.round(ratio * total)));

  return Array.from(
    { length: total },
    (_, index) => `<i class="${index < filled ? 'on' : ''}"></i>`,
  ).join('');
}

function renderBadges(unit: Unit): string {
  const badges: string[] = [];

  const shieldTotal = unit.shieldTotal();
  if (shieldTotal > 0) {
    badges.push(
      `<span class="badge shield">🛡 ${formatCompact(shieldTotal)} · ${unit.shieldMinDuration()}</span>`,
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

  const buffDuration = unit.effectMaxDuration('statBuff');
  if (buffDuration > 0) {
    badges.push(`<span class="badge buff">✨ ${buffDuration}</span>`);
  }

  const freezeDuration = unit.effectMaxDuration('freeze');
  if (freezeDuration > 0) {
    badges.push(`<span class="badge freeze">❄ ${freezeDuration}</span>`);
  }

  const stealthDuration = unit.effectMaxDuration('stealth');
  if (stealthDuration > 0) {
    badges.push(`<span class="badge stealth">🌫 ${stealthDuration}</span>`);
  }

  const poisonDuration = unit.effectMaxDuration('poison');
  if (poisonDuration > 0) {
    badges.push(`<span class="badge poison">☠ ${poisonDuration}</span>`);
  }

  return badges.join('');
}

export function crystalName(id: string): string {
  return CRYSTAL_MAP[id]?.name ?? id;
}
