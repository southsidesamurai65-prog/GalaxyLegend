export type Side = 'player' | 'enemy';

export interface Coord {
  x: number;
  y: number;
}

export type AttributeKey =
  | 'physAtk'
  | 'energyAtk'
  | 'skillAtk'
  | 'physDef'
  | 'skillDef'
  | 'hp'
  | 'initialCharge'
  | 'speed'
  | 'hit'
  | 'dodge'
  | 'crit'
  | 'antiCrit'
  | 'critDamage';

export type AttributeCategory = 'absolute' | 'percent';

export interface AttributeDef {
  key: AttributeKey;
  label: string;
  category: AttributeCategory;
  defaultValue: number;
  min?: number;
  max?: number;
}

export type Stats = Record<AttributeKey, number>;

export type ShapeId = 'single' | 'sameRow' | 'sameColumn' | 'cross';

export type EffectKind = 'shield' | 'lock' | 'silence';

export type DamageKind = 'normal' | 'skill';

export const BOARD_SIZE = 3;
export const MAX_TEAM_SIZE = 5;
export const MAX_CHARGE = 300;

export function otherSide(side: Side): Side {
  return side === 'player' ? 'enemy' : 'player';
}

export function sameCoord(a: Coord, b: Coord): boolean {
  return a.x === b.x && a.y === b.y;
}

export function coordKey(coord: Coord): string {
  return `${coord.x},${coord.y}`;
}

export function inBoard(coord: Coord): boolean {
  return coord.x >= 1 && coord.x <= BOARD_SIZE && coord.y >= 1 && coord.y <= BOARD_SIZE;
}
