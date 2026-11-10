import type { Board } from './Board';
import type { Unit } from './Unit';

/** 同行 > 上一行 > 下一行 > 上两行 > 下两行；越界行跳过。 */
const ROW_OFFSETS = [0, -1, 1, -2, 2];

export function findAnchor(unit: Unit, board: Board): Unit | null {
  const originX = unit.coord.x;

  for (const offset of ROW_OFFSETS) {
    const x = originX + offset;
    if (x < 1 || x > 3) continue;

    const row = board.aliveEnemiesInRow(unit.side, x);
    if (row.length === 0) continue;

    return row.reduce((best, candidate) =>
      candidate.coord.y > best.coord.y ? candidate : best,
    );
  }

  return null;
}
