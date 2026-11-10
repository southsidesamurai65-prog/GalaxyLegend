import type { Coord, DamageKind, EffectKind, ShapeId, Side } from './types';

export type BattleEvent =
  | { type: 'roundStart'; round: number }
  | { type: 'roundEnd'; round: number }
  | {
      type: 'actionStart';
      unitId: string;
      unitName: string;
      side: Side;
      coord: Coord;
    }
  | {
      type: 'actionSkip';
      unitId: string;
      unitName: string;
      side: Side;
      coord: Coord;
      reason: 'lock';
    }
  | {
      type: 'normalAttack';
      attackerId: string;
      attackerName: string;
      attackerSide: Side;
      attackerCoord: Coord;
      targetId: string;
      targetName: string;
      targetSide: Side;
      targetCoord: Coord;
    }
  | {
      type: 'skillCast';
      casterId: string;
      casterName: string;
      casterSide: Side;
      casterCoord: Coord;
      anchorCoord: Coord;
      skillName: string;
      shape: ShapeId;
      charge: number;
      multiplier: number;
      targets: Array<{ id: string; name: string; side: Side; coord: Coord }>;
    }
  | {
      type: 'miss';
      attackerName: string;
      attackerSide: Side;
      targetName: string;
      targetSide: Side;
      targetCoord: Coord;
      skill?: string;
    }
  | {
      type: 'damage';
      attackerName: string;
      attackerSide: Side;
      targetId: string;
      targetName: string;
      targetSide: Side;
      targetCoord: Coord;
      amount: number;
      shieldAbsorbed: number;
      hpDamage: number;
      crit: boolean;
      holy: boolean;
      kind: DamageKind;
    }
  | {
      type: 'charge';
      unitId: string;
      unitName: string;
      side: Side;
      coord: Coord;
      amount: number;
      total: number;
      reason: 'attack' | 'hit';
    }
  | {
      type: 'effectApplied';
      unitId: string;
      unitName: string;
      side: Side;
      coord: Coord;
      effect: EffectKind;
      duration: number;
      amount?: number;
    }
  | {
      type: 'effectExpired';
      unitId: string;
      unitName: string;
      side: Side;
      coord: Coord;
      effect: EffectKind;
    }
  | {
      type: 'death';
      unitId: string;
      unitName: string;
      side: Side;
      coord: Coord;
    }
  | { type: 'battleEnd'; winner: Side };
