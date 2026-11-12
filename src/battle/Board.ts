import type { Coord, Side } from '../core/types';
import { otherSide } from '../core/types';
import type { Unit } from './Unit';

export class Board {
  units: Unit[] = [];

  place(unit: Unit): void {
    this.units.push(unit);
  }

  remove(unit: Unit): void {
    this.units = this.units.filter((current) => current !== unit);
  }

  aliveUnits(side: Side): Unit[] {
    return this.units.filter((unit) => unit.side === side && unit.alive);
  }

  allAlive(): Unit[] {
    return this.units.filter((unit) => unit.alive);
  }

  aliveEnemies(side: Side): Unit[] {
    return this.aliveUnits(otherSide(side));
  }

  /** 隐身单位不能被选为靶点，也不能被攻击到。 */
  targetableEnemies(side: Side): Unit[] {
    return this.aliveUnits(otherSide(side)).filter(
      (unit) => !unit.isStealthed(),
    );
  }

  unitAt(side: Side, coord: Coord): Unit | undefined {
    return this.units.find(
      (unit) =>
        unit.side === side &&
        unit.alive &&
        unit.coord.x === coord.x &&
        unit.coord.y === coord.y,
    );
  }

  isOccupied(side: Side, coord: Coord): boolean {
    return this.unitAt(side, coord) !== undefined;
  }

  aliveEnemiesInRow(side: Side, x: number): Unit[] {
    return this.targetableEnemies(side).filter((unit) => unit.coord.x === x);
  }

  aliveEnemiesInColumn(side: Side, y: number): Unit[] {
    return this.targetableEnemies(side).filter((unit) => unit.coord.y === y);
  }

  totalSpeed(side: Side): number {
    return this.aliveUnits(side).reduce((total, unit) => total + unit.getStat('speed'), 0);
  }
}
