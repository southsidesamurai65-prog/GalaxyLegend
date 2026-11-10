import type { BattleEvent } from '../core/events';
import type { Coord, ShapeId, Side } from '../core/types';
import { otherSide } from '../core/types';
import { EFFECT_LABELS } from '../battle/effects/Effect';

export function cellFor(side: Side, coord: Coord): HTMLElement | null {
  return document.querySelector<HTMLElement>(
    `.cell[data-side="${side}"][data-x="${coord.x}"][data-y="${coord.y}"]`,
  );
}

export function floatText(
  side: Side,
  coord: Coord,
  text: string,
  kind: string,
): void {
  const cell = cellFor(side, coord);
  if (!cell) return;

  const span = document.createElement('span');
  span.className = `float-text ${kind}`;
  span.textContent = text;
  span.style.setProperty('--dx', `${(Math.random() - 0.5) * 26}px`);
  cell.appendChild(span);
  window.setTimeout(() => span.remove(), 1000);
}

export function flashCell(side: Side, coord: Coord, className: string): void {
  const cell = cellFor(side, coord);
  if (!cell) return;
  cell.classList.add(className);
  window.setTimeout(() => cell.classList.remove(className), 500);
}

export function showBanner(text: string, className = ''): void {
  const banner = document.createElement('div');
  banner.className = `skill-banner ${className}`.trim();
  banner.textContent = text;
  document.body.appendChild(banner);
  window.setTimeout(() => banner.remove(), 900);
}

export function playEventsFx(events: BattleEvent[]): void {
  for (const event of events) {
    switch (event.type) {
      case 'skillCast': {
        showBanner(
          `${event.casterSide === 'player' ? '我方' : '敌方'}·${event.casterName} · ${event.skillName}`,
        );
        flashCell(event.casterSide, event.casterCoord, 'skill-cast');
        // 高亮完整技能范围，而不只是有敌人的格子。
        const targetSide = otherSide(event.casterSide);
        for (const coord of shapeCells(event.shape, event.anchorCoord)) {
          flashCell(targetSide, coord, 'skill-target');
        }
        break;
      }
      case 'normalAttack':
        flashCell(event.attackerSide, event.attackerCoord, 'attack-flash');
        break;
      case 'damage':
        flashCell(
          event.targetSide,
          event.targetCoord,
          event.shieldAbsorbed > 0 ? 'shield-flash' : 'hit-flash',
        );
        floatText(
          event.targetSide,
          event.targetCoord,
          `${event.crit ? '暴击 ' : ''}-${event.amount}`,
          event.crit ? 'crit' : event.holy ? 'holy' : 'damage',
        );
        if (event.shieldAbsorbed > 0) {
          floatText(
            event.targetSide,
            event.targetCoord,
            `🛡 -${event.shieldAbsorbed}`,
            'shield',
          );
        }
        break;
      case 'miss':
        floatText(event.targetSide, event.targetCoord, 'MISS', 'miss');
        break;
      case 'charge':
        floatText(
          event.side,
          event.coord,
          `+${event.amount} 蓄能`,
          'charge',
        );
        break;
      case 'effectApplied':
        floatText(
          event.side,
          event.coord,
          event.effect === 'shield'
            ? `🛡 +${event.amount ?? 0}`
            : `${event.effect === 'lock' ? '🔒' : '🚫'} ${EFFECT_LABELS[event.effect]}`,
          `effect effect-${event.effect}`,
        );
        break;
      case 'death':
        flashCell(event.side, event.coord, 'death-flash');
        floatText(event.side, event.coord, '阵亡', 'death');
        break;
      case 'battleEnd':
        showBanner(
          event.winner === 'player' ? '我方胜利' : '敌方胜利',
          'end',
        );
        break;
    }
  }
}

function shapeCells(shape: ShapeId, anchor: Coord): Coord[] {
  const cells: Coord[] = [];

  switch (shape) {
    case 'single':
      cells.push(anchor);
      break;
    case 'sameRow':
      for (let y = 1; y <= 3; y += 1) cells.push({ x: anchor.x, y });
      break;
    case 'sameColumn':
      for (let x = 1; x <= 3; x += 1) cells.push({ x, y: anchor.y });
      break;
    case 'cross':
      for (let y = 1; y <= 3; y += 1) cells.push({ x: anchor.x, y });
      for (let x = 1; x <= 3; x += 1) cells.push({ x, y: anchor.y });
      break;
  }

  const seen = new Set<string>();
  return cells.filter((coord) => {
    const key = `${coord.x},${coord.y}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
