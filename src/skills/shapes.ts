import type { ShapeId } from '../core/types';
import type { Board } from '../battle/Board';
import type { Unit } from '../battle/Unit';

/**
 * README 里的“纵向”= 同行（同 x）。
 * README 里的“横向”= 同列（同 y）。
 * 内部用 sameRow / sameColumn，避免叫法混淆。
 */
export function resolveTargets(
  shape: ShapeId,
  caster: Unit,
  anchor: Unit,
  board: Board,
): Unit[] {
  const enemies = board.aliveEnemies(caster.side);
  let targets: Unit[];

  switch (shape) {
    case 'single':
      targets = [anchor];
      break;
    case 'sameRow':
      targets = enemies.filter((unit) => unit.coord.x === anchor.coord.x);
      break;
    case 'sameColumn':
      targets = enemies.filter((unit) => unit.coord.y === anchor.coord.y);
      break;
    case 'cross':
      targets = enemies.filter(
        (unit) => unit.coord.x === anchor.coord.x || unit.coord.y === anchor.coord.y,
      );
      break;
  }

  const unique = new Map<string, Unit>();
  for (const target of targets) unique.set(target.id, target);
  return [...unique.values()].sort(
    (a, b) => b.coord.y - a.coord.y || a.coord.x - b.coord.x,
  );
}

export const SHAPE_LABELS: Record<ShapeId, string> = {
  single: '单体',
  sameRow: '纵向（同行）',
  sameColumn: '横向（同列）',
  cross: '十字',
};
