import type {
  AttributeKey,
  Coord,
  DamageKind,
  EffectKind,
  ShapeId,
  Side,
} from './types';

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
      reason: 'lock' | 'freeze';
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
      /** 消耗后、命中加蓄能前的剩余蓄能。 */
      chargeAfter: number;
      multiplier: number;
      targets: Array<{ id: string; name: string; side: Side; coord: Coord }>;
      castEffectTargets?: Array<{
        side: Side;
        coord: Coord;
        effect: EffectKind;
        stat?: AttributeKey;
        description?: string;
      }>;
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
      type: 'intercept';
      unitId: string;
      unitName: string;
      side: Side;
      coord: Coord;
      attackerName: string;
      attackerSide: Side;
      attackerCoord: Coord;
      kind: DamageKind;
      chance: number;
      originalDamage: number;
      reducedDamage: number;
      /** 是否实际进行了普攻反击（目标存活时才会反击）。 */
      counter?: boolean;
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
      bonusDamage?: number;
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
      reason: 'attack' | 'hit' | 'drain' | 'effect';
    }
  | {
      type: 'poison';
      unitId: string;
      unitName: string;
      side: Side;
      coord: Coord;
      amount: number;
    }
  | {
      type: 'chargeDrained';
      unitId: string;
      unitName: string;
      side: Side;
      coord: Coord;
      amount: number;
      total: number;
    }
  | {
      type: 'heal';
      sourceName: string;
      targetId: string;
      targetName: string;
      targetSide: Side;
      targetCoord: Coord;
      amount: number;
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
      stat?: AttributeKey;
      description?: string;
    }
  | {
      type: 'effectResisted';
      unitId: string;
      unitName: string;
      side: Side;
      coord: Coord;
      effect: EffectKind;
      description?: string;
    }
  | {
      type: 'effectExpired';
      unitId: string;
      unitName: string;
      side: Side;
      coord: Coord;
      effect: EffectKind;
      stat?: AttributeKey;
      description?: string;
    }
  | {
      type: 'death';
      unitId: string;
      unitName: string;
      side: Side;
      coord: Coord;
    }
  | { type: 'battleEnd'; winner: Side };
