import type { BattleEvent } from '../core/events';
import type { Coord, ShapeId, Side } from '../core/types';
import { otherSide } from '../core/types';
import { EFFECT_LABELS } from '../battle/effects/Effect';
import { formatCompact } from './format';

type DamageEvent = Extract<BattleEvent, { type: 'damage' }>;

const NORMAL_TRAVEL_MS = 500;
const SKILL_TRAVEL_MS = 440;
const GHOST_TRAVEL_MS = 600;
const TEXT_LIFE_MS = 1000;

let fxLayer: HTMLElement | null = null;
let fxGeneration = 0;
const persistentStatFx = new Map<
  string,
  { element: HTMLElement; count: number }
>();

export function initFxLayer(layer: HTMLElement | null): void {
  fxLayer = layer;
}

export function clearFxLayer(): void {
  fxGeneration += 1;
  persistentStatFx.clear();
  fxLayer?.replaceChildren();
  document
    .querySelectorAll('.skill-banner')
    .forEach((banner) => banner.remove());
}

export function cellFor(side: Side, coord: Coord): HTMLElement | null {
  return document.querySelector<HTMLElement>(
    `.cell[data-side="${side}"][data-x="${coord.x}"][data-y="${coord.y}"]`,
  );
}

function pointFor(
  side: Side,
  coord: Coord,
): { x: number; y: number } | null {
  if (!fxLayer) return null;
  const cell = cellFor(side, coord);
  if (!cell) return null;

  const cellRect = cell.getBoundingClientRect();
  const layerRect = fxLayer.getBoundingClientRect();
  return {
    x: cellRect.left - layerRect.left + cellRect.width / 2,
    y: cellRect.top - layerRect.top + cellRect.height / 2,
  };
}

function schedule(fn: () => void, delay: number): void {
  if (delay <= 0) {
    fn();
    return;
  }
  const generation = fxGeneration;
  window.setTimeout(() => {
    if (generation !== fxGeneration) return;
    fn();
  }, delay);
}

function keyFor(side: Side, coord: Coord): string {
  return `${side}:${coord.x},${coord.y}`;
}

export function floatText(
  side: Side,
  coord: Coord,
  text: string,
  kind: string,
  delay = 0,
): void {
  schedule(() => {
    if (fxLayer) {
      const point = pointFor(side, coord);
      if (!point) return;
      const span = document.createElement('span');
      span.className = `float-text ${kind}`;
      span.textContent = text;
      span.style.left = `${point.x}px`;
      span.style.top = `${point.y}px`;
      span.style.setProperty('--dx', `${(Math.random() - 0.5) * 26}px`);
      fxLayer.appendChild(span);
      window.setTimeout(() => span.remove(), TEXT_LIFE_MS);
      return;
    }

    const cell = cellFor(side, coord);
    if (!cell) return;
    const span = document.createElement('span');
    span.className = `float-text ${kind}`;
    span.textContent = text;
    span.style.setProperty('--dx', `${(Math.random() - 0.5) * 26}px`);
    cell.appendChild(span);
    window.setTimeout(() => span.remove(), TEXT_LIFE_MS);
  }, delay);
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

function createProjectile(
  from: { x: number; y: number },
  to: { x: number; y: number },
  color: string,
  duration: number,
): void {
  if (!fxLayer) return;
  const orb = document.createElement('div');
  orb.className = 'projectile';
  orb.style.left = `${from.x}px`;
  orb.style.top = `${from.y}px`;
  orb.style.setProperty('--dx', `${to.x - from.x}px`);
  orb.style.setProperty('--dy', `${to.y - from.y}px`);
  orb.style.setProperty('--color', color);
  orb.style.setProperty('--duration', `${duration}ms`);
  fxLayer.appendChild(orb);
  window.setTimeout(() => orb.remove(), duration + 80);
}

function createBeam(
  from: { x: number; y: number },
  to: { x: number; y: number },
  color: string,
  duration: number,
): void {
  if (!fxLayer) return;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;

  const beam = document.createElement('div');
  beam.className = 'beam';
  beam.style.left = `${from.x}px`;
  beam.style.top = `${from.y}px`;
  beam.style.width = `${length}px`;
  beam.style.setProperty('--angle', `${angle}deg`);
  beam.style.setProperty('--color', color);
  beam.style.setProperty('--duration', `${duration}ms`);
  fxLayer.appendChild(beam);
  window.setTimeout(() => beam.remove(), duration + 80);
}

function createGhostProjectile(
  from: { x: number; y: number },
  to: { x: number; y: number },
  duration: number,
): void {
  if (!fxLayer) return;
  const ghost = document.createElement('div');
  ghost.className = 'ghost-projectile';
  ghost.style.left = `${from.x}px`;
  ghost.style.top = `${from.y}px`;
  ghost.style.setProperty('--dx', `${to.x - from.x}px`);
  ghost.style.setProperty('--dy', `${to.y - from.y}px`);
  ghost.style.setProperty('--duration', `${duration}ms`);
  ghost.innerHTML =
    '<span class="ghost-body"><i></i><i></i><b></b></span>';
  fxLayer.appendChild(ghost);
  window.setTimeout(() => ghost.remove(), duration + 40);
}

function createGhostBurst(
  side: Side,
  coord: Coord,
  delay: number,
): void {
  schedule(() => {
    if (!fxLayer) return;
    const point = pointFor(side, coord);
    if (!point) return;

    const burst = document.createElement('div');
    burst.className = 'ghost-burst';
    burst.style.left = `${point.x}px`;
    burst.style.top = `${point.y}px`;

    const rings = document.createElement('span');
    rings.className = 'ghost-rings';
    burst.appendChild(rings);

    // 八道幽灵残影向四周炸开。
    for (let index = 0; index < 10; index += 1) {
      const wisp = document.createElement('i');
      wisp.className = 'ghost-wisp';
      wisp.style.setProperty('--angle', `${index * 36}deg`);
      wisp.style.setProperty('--dist', `${90 + (index % 3) * 20}px`);
      wisp.style.setProperty('--delay', `${(index % 4) * 18}ms`);
      burst.appendChild(wisp);
    }

    fxLayer.appendChild(burst);
    window.setTimeout(() => burst.remove(), 1300);
  }, delay);
}

function isGhostSkill(event: Extract<BattleEvent, { type: 'skillCast' }>): boolean {
  return (
    event.skillName.includes('幽灵') || event.casterName === '无头骑士'
  );
}

function isSpecialStat(
  stat: string | undefined,
): stat is 'hit' | 'crit' | 'intercept' {
  return stat === 'hit' || stat === 'crit' || stat === 'intercept';
}

function statFxKey(side: Side, coord: Coord, stat: string): string {
  return `${side}:${coord.x},${coord.y}:${stat}`;
}

function statFxMarkup(stat: 'hit' | 'crit' | 'intercept'): string {
  if (stat === 'crit') {
    return Array.from(
      { length: 10 },
      (_, index) => `<i class="spark" style="--i:${index}"></i>`,
    ).join('');
  }
  if (stat === 'hit') {
    return '<i class="ring"></i><i class="ring second"></i><i class="wind"></i>';
  }
  return '<i class="hex-grid"></i><i class="hex-core"></i>';
}

function showPersistentStatFx(
  side: Side,
  coord: Coord,
  stat: 'hit' | 'crit' | 'intercept',
): void {
  if (!fxLayer) return;
  const key = statFxKey(side, coord, stat);
  const existing = persistentStatFx.get(key);
  if (existing) {
    existing.count += 1;
    return;
  }

  const point = pointFor(side, coord);
  if (!point) return;

  const element = document.createElement('div');
  element.className = `stat-up ${stat}-up persistent`;
  element.style.left = `${point.x}px`;
  element.style.top = `${point.y}px`;
  element.innerHTML = statFxMarkup(stat);
  fxLayer.appendChild(element);
  persistentStatFx.set(key, { element, count: 1 });
}

function hidePersistentStatFx(
  side: Side,
  coord: Coord,
  stat: 'hit' | 'crit' | 'intercept',
): void {
  const key = statFxKey(side, coord, stat);
  const entry = persistentStatFx.get(key);
  if (!entry) return;
  entry.count -= 1;
  if (entry.count > 0) return;

  persistentStatFx.delete(key);
  entry.element.classList.add('fading');
  window.setTimeout(() => entry.element.remove(), 320);
}

function clearStatFxAt(side: Side, coord: Coord): void {
  const prefix = `${side}:${coord.x},${coord.y}:`;
  for (const [key, entry] of persistentStatFx) {
    if (!key.startsWith(prefix)) continue;
    entry.element.remove();
    persistentStatFx.delete(key);
  }
}

function createAura(
  side: Side,
  coord: Coord,
  color: string,
  delay = 0,
): void {
  schedule(() => {
    if (!fxLayer) return;
    const point = pointFor(side, coord);
    if (!point) return;
    const aura = document.createElement('div');
    aura.className = 'aura';
    aura.style.left = `${point.x}px`;
    aura.style.top = `${point.y}px`;
    aura.style.setProperty('--color', color);
    fxLayer.appendChild(aura);
    window.setTimeout(() => aura.remove(), 750);
  }, delay);
}

function createExplosion(side: Side, coord: Coord, delay: number): void {
  schedule(() => {
    if (!fxLayer) return;
    const cell = cellFor(side, coord);
    const point = pointFor(side, coord);
    if (!cell || !point) return;

    const rect = cell.getBoundingClientRect();
    const blast = Math.max(rect.width, rect.height, 40);

    const explosion = document.createElement('div');
    explosion.className = 'explosion';
    explosion.style.left = `${point.x}px`;
    explosion.style.top = `${point.y}px`;
    explosion.style.setProperty('--blast', `${blast}px`);

    const shards = Array.from({ length: 16 }, (_, index) => {
      const angle = (360 / 16) * index + (Math.random() * 24 - 12);
      const distance = blast * (0.45 + Math.random() * 0.55);
      const size = 6 + Math.random() * 6;
      const shardDelay = Math.random() * 80;
      return `<i class="explosion-shard" style="--angle:${angle.toFixed(
        1,
      )}deg;--distance:${distance.toFixed(1)}px;--size:${size.toFixed(
        1,
      )}px;--delay:${shardDelay.toFixed(0)}ms"></i>`;
    }).join('');

    const smoke = Array.from({ length: 5 }, (_, index) => {
      const angle = 72 * index + (Math.random() * 30 - 15);
      const distance = blast * (0.35 + Math.random() * 0.4);
      const smokeDelay = 60 + Math.random() * 120;
      return `<i class="explosion-smoke" style="--angle:${angle.toFixed(
        1,
      )}deg;--distance:${distance.toFixed(1)}px;--delay:${smokeDelay.toFixed(
        0,
      )}ms"></i>`;
    }).join('');

    explosion.innerHTML = `
      <i class="explosion-flash"></i>
      <i class="explosion-fireball"></i>
      <i class="explosion-ring"></i>
      <i class="explosion-ring second"></i>
      ${shards}
      ${smoke}
    `;
    fxLayer.appendChild(explosion);
    window.setTimeout(() => explosion.remove(), 1300);

    const battlefield = document.querySelector<HTMLElement>('.battlefield');
    if (battlefield) {
      battlefield.classList.remove('battle-shake');
      // 强制重排，让连续阵亡时震动动画可以重新播放。
      void battlefield.offsetWidth;
      battlefield.classList.add('battle-shake');
      window.setTimeout(() => {
        battlefield.classList.remove('battle-shake');
      }, 420);
    }
  }, delay);
}

function createImpact(
  side: Side,
  coord: Coord,
  color: string,
  delay: number,
): void {
  schedule(() => {
    if (!fxLayer) return;
    const point = pointFor(side, coord);
    if (!point) return;
    const impact = document.createElement('div');
    impact.className = 'impact';
    impact.style.left = `${point.x}px`;
    impact.style.top = `${point.y}px`;
    impact.style.setProperty('--color', color);
    fxLayer.appendChild(impact);
    window.setTimeout(() => impact.remove(), 500);
  }, delay);
}

function colorFor(
  side: Side,
  damage: DamageEvent | undefined,
  mode: 'normal' | 'skill',
): string {
  if (damage?.holy) return '#c084fc';
  if (damage?.crit) return '#fbbf24';
  if (mode === 'skill') {
    return side === 'player' ? '#38bdf8' : '#fb923c';
  }
  return side === 'player' ? '#67e8f9' : '#fca5a5';
}

export function playEventsFx(events: BattleEvent[]): void {
  const damageByTarget = new Map<string, DamageEvent>();
  for (const event of events) {
    if (event.type === 'damage') {
      damageByTarget.set(
        keyFor(event.targetSide, event.targetCoord),
        event,
      );
    }
  }

  let actionDelay = 0;
  const targetDelays = new Map<string, number>();
  const ghostTargetKeys = new Set<string>();

  for (const event of events) {
    switch (event.type) {
      case 'normalAttack': {
        actionDelay = NORMAL_TRAVEL_MS;
        targetDelays.clear();

        const targetKey = keyFor(event.targetSide, event.targetCoord);
        const damage = damageByTarget.get(targetKey);
        const from = pointFor(event.attackerSide, event.attackerCoord);
        const to = pointFor(event.targetSide, event.targetCoord);
        if (from && to) {
          createProjectile(
            from,
            to,
            colorFor(event.attackerSide, damage, 'normal'),
            NORMAL_TRAVEL_MS,
          );
        }
        flashCell(event.attackerSide, event.attackerCoord, 'attack-flash');
        break;
      }

      case 'skillCast': {
        const ghost = isGhostSkill(event);
        actionDelay = ghost ? GHOST_TRAVEL_MS : SKILL_TRAVEL_MS;
        targetDelays.clear();

        showBanner(
          `${event.casterSide === 'player' ? '我方' : '敌方'}·${event.casterName} · ${event.skillName}`,
        );
        flashCell(event.casterSide, event.casterCoord, 'skill-cast');

        // 高亮完整技能范围，而不只是有敌人的格子。
        const targetSide = otherSide(event.casterSide);
        for (const coord of shapeCells(event.shape, event.anchorCoord)) {
          flashCell(
            targetSide,
            coord,
            ghost ? 'ghost-target' : 'skill-target',
          );
        }

        // 自身/友方增益先亮光环；命中/暴击/拦截由 effectApplied 创建持续特效。
        for (const castTarget of event.castEffectTargets ?? []) {
          if (
            castTarget.effect === 'statBuff' &&
            isSpecialStat(castTarget.stat)
          ) {
            continue;
          }

          const color =
            castTarget.effect === 'shield'
              ? '#38bdf8'
              : castTarget.effect === 'statBuff'
                ? '#86efac'
                : castTarget.effect === 'freeze'
                  ? '#7dd3fc'
                  : castTarget.effect === 'stealth'
                    ? '#cbd5e1'
                    : castTarget.effect === 'poison'
                      ? '#86efac'
                      : '#a78bfa';
          createAura(castTarget.side, castTarget.coord, color);
        }

        const from = pointFor(event.casterSide, event.casterCoord);
        if (from) {
          if (ghost) {
            const anchorPoint = pointFor(targetSide, event.anchorCoord);
            if (anchorPoint) {
              createGhostProjectile(from, anchorPoint, GHOST_TRAVEL_MS);
            }
            createGhostBurst(targetSide, event.anchorCoord, GHOST_TRAVEL_MS);
          }

          event.targets.forEach((target, index) => {
            const targetKey = keyFor(target.side, target.coord);
            const delay =
              (ghost ? GHOST_TRAVEL_MS + 110 : SKILL_TRAVEL_MS) + index * 20;
            targetDelays.set(targetKey, delay);

            if (ghost) {
              ghostTargetKeys.add(targetKey);
              return;
            }

            const to = pointFor(target.side, target.coord);
            if (!to) return;
            const damage = damageByTarget.get(targetKey);
            createBeam(
              from,
              to,
              colorFor(target.side, damage, 'skill'),
              SKILL_TRAVEL_MS,
            );
          });

          if (
            event.targets.length === 0 &&
            (event.castEffectTargets?.length ?? 0) === 0
          ) {
            createAura(event.casterSide, event.casterCoord, '#a78bfa');
          }
        }
        break;
      }

      case 'intercept': {
        const targetKey = keyFor(event.side, event.coord);
        const delay = targetDelays.get(targetKey) ?? actionDelay;
        schedule(
          () => flashCell(event.side, event.coord, 'intercept-flash'),
          delay,
        );
        floatText(
          event.side,
          event.coord,
          '拦截 -50%',
          'intercept',
          delay,
        );
        break;
      }

      case 'damage': {
        const targetKey = keyFor(event.targetSide, event.targetCoord);
        const delay = targetDelays.get(targetKey) ?? actionDelay;
        const ghostDamage = ghostTargetKeys.has(targetKey);
        const impactColor = ghostDamage
          ? '#c084fc'
          : event.holy
            ? '#c084fc'
            : event.crit
              ? '#fbbf24'
              : event.shieldAbsorbed > 0
                ? '#38bdf8'
                : event.targetSide === 'player'
                  ? '#fca5a5'
                  : '#67e8f9';
        createImpact(event.targetSide, event.targetCoord, impactColor, delay);
        schedule(
          () =>
            flashCell(
              event.targetSide,
              event.targetCoord,
              event.shieldAbsorbed > 0 ? 'shield-flash' : 'hit-flash',
            ),
          delay,
        );
        floatText(
          event.targetSide,
          event.targetCoord,
          `${event.crit ? '暴击 ' : ''}-${formatCompact(event.amount)}`,
          event.crit
            ? 'crit'
            : event.holy
              ? 'holy'
              : ghostDamage
                ? 'ghost'
                : 'damage',
          delay,
        );
        if (event.shieldAbsorbed > 0) {
          floatText(
            event.targetSide,
            event.targetCoord,
            `🛡 -${formatCompact(event.shieldAbsorbed)}`,
            'shield',
            delay + 50,
          );
        }
        if (event.bonusDamage && event.bonusDamage > 0) {
          floatText(
            event.targetSide,
            event.targetCoord,
            `神圣 +${formatCompact(event.bonusDamage)}`,
            'holy',
            delay + 40,
          );
        }
        break;
      }

      case 'miss': {
        const targetKey = keyFor(event.targetSide, event.targetCoord);
        const delay = targetDelays.get(targetKey) ?? actionDelay;
        floatText(event.targetSide, event.targetCoord, 'MISS', 'miss', delay);
        break;
      }

      case 'charge': {
        const targetKey = keyFor(event.side, event.coord);
        const delay = (targetDelays.get(targetKey) ?? actionDelay) + 60;
        floatText(
          event.side,
          event.coord,
          `${event.amount >= 0 ? '+' : ''}${event.amount} 蓄能`,
          event.amount < 0 ? 'charge-drain' : 'charge',
          delay,
        );
        break;
      }

      case 'chargeDrained': {
        const targetKey = keyFor(event.side, event.coord);
        const delay = (targetDelays.get(targetKey) ?? actionDelay) + 60;
        floatText(event.side, event.coord, '蓄能清零', 'charge-drain', delay);
        break;
      }

      case 'poison': {
        const delay = actionDelay > 0 ? actionDelay + 80 : 80;
        schedule(
          () => flashCell(event.side, event.coord, 'poison-flash'),
          delay,
        );
        floatText(
          event.side,
          event.coord,
          `☠ -${formatCompact(event.amount)}`,
          'poison',
          delay,
        );
        break;
      }

      case 'heal': {
        const delay = actionDelay > 0 ? actionDelay : 80;
        createAura(event.targetSide, event.targetCoord, '#86efac', delay);
        floatText(
          event.targetSide,
          event.targetCoord,
          `+${formatCompact(event.amount)} HP`,
          'heal',
          delay,
        );
        break;
      }

      case 'effectApplied': {
        if (event.effect === 'statBuff' && isSpecialStat(event.stat)) {
          showPersistentStatFx(event.side, event.coord, event.stat);
        }

        const targetKey = keyFor(event.side, event.coord);
        const impact = targetDelays.get(targetKey);
        const delay = impact !== undefined ? impact + 80 : 80;
        const text =
          event.effect === 'shield'
            ? `🛡 +${formatCompact(event.amount ?? 0)}`
            : event.effect === 'statBuff'
              ? `✨ ${event.description ?? '属性变化'}`
              : event.effect === 'freeze'
                ? '❄ 冰冻'
                : event.effect === 'stealth'
                  ? '🌫 隐身'
                  : event.effect === 'poison'
                    ? `☠ ${event.description ?? '中毒'}`
                    : `${event.effect === 'lock' ? '🔒' : '🚫'} ${EFFECT_LABELS[event.effect]}`;
        floatText(
          event.side,
          event.coord,
          text,
          `effect effect-${event.effect}`,
          delay,
        );
        break;
      }

      case 'effectResisted': {
        const targetKey = keyFor(event.side, event.coord);
        const impact = targetDelays.get(targetKey);
        const delay = impact !== undefined ? impact + 80 : 80;
        floatText(
          event.side,
          event.coord,
          `${event.description ?? EFFECT_LABELS[event.effect]}未触发`,
          'miss',
          delay,
        );
        break;
      }

      case 'death': {
        clearStatFxAt(event.side, event.coord);
        const targetKey = keyFor(event.side, event.coord);
        const delay = (targetDelays.get(targetKey) ?? actionDelay) + 80;
        schedule(
          () => flashCell(event.side, event.coord, 'death-flash'),
          delay,
        );
        createExplosion(event.side, event.coord, delay);
        floatText(event.side, event.coord, '阵亡', 'death', delay + 60);
        break;
      }

      case 'battleEnd':
        schedule(() => {
          document
            .querySelectorAll('.skill-banner')
            .forEach((banner) => banner.remove());
          showBanner(
            event.winner === 'player' ? '我方胜利' : '敌方胜利',
            'end',
          );
        }, actionDelay + 250);
        break;

      case 'effectExpired': {
        if (event.effect === 'statBuff' && isSpecialStat(event.stat)) {
          hidePersistentStatFx(event.side, event.coord, event.stat);
        }
        break;
      }

      case 'roundStart':
      case 'roundEnd':
      case 'actionStart':
      case 'actionSkip':
        break;
    }
  }
}

function shapeCells(shape: ShapeId, anchor: Coord): Coord[] {
  const cells: Coord[] = [];

  switch (shape) {
    case 'self':
      return [];
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
