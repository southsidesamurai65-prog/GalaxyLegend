import type { Coord, Stats } from '../core/types';
import { MAX_TEAM_SIZE } from '../core/types';
import { createStats } from '../core/attributes';
import { CHARACTER_MAP } from '../data/characters';
import { CRYSTAL_MAP } from '../data/crystals';
import { Battle } from '../battle/Battle';
import type { Unit } from '../battle/Unit';
import { buildUnit, buildUnitStats } from './loadout';

export interface PlayerSlot {
  charId: string;
  coord: Coord;
  crystalIds: string[];
}

export interface EnemyPreviewSlot {
  charId: string;
  coord: Coord;
  crystalIds: string[];
}

export type Phase = 'prepare' | 'battle' | 'result';

const DEFAULT_SLOTS: PlayerSlot[] = [
  {
    charId: 'guardian',
    coord: { x: 1, y: 3 },
    crystalIds: ['hp-plate', 'guard-plate'],
  },
  {
    charId: 'destroyer',
    coord: { x: 2, y: 3 },
    crystalIds: ['energy-core', 'crit-dmg-chip'],
  },
  {
    charId: 'holy',
    coord: { x: 3, y: 3 },
    crystalIds: ['skill-core', 'hit-chip'],
  },
  {
    charId: 'assassin',
    coord: { x: 1, y: 2 },
    crystalIds: ['crit-chip', 'speed-chip'],
  },
  {
    charId: 'mage',
    coord: { x: 2, y: 2 },
    crystalIds: ['charge-chip', 'ward-plate'],
  },
];

/** 敌方固定阵容，方便先验证机制；后续可替换为关卡数据。 */
export const ENEMY_LOADOUT: EnemyPreviewSlot[] = [
  { charId: 'destroyer', coord: { x: 1, y: 3 }, crystalIds: [] },
  { charId: 'guardian', coord: { x: 2, y: 3 }, crystalIds: [] },
  { charId: 'controller', coord: { x: 3, y: 3 }, crystalIds: [] },
  { charId: 'holy', coord: { x: 1, y: 2 }, crystalIds: [] },
  { charId: 'assassin', coord: { x: 2, y: 2 }, crystalIds: [] },
];

const FORMATION: Coord[] = [
  { x: 1, y: 3 },
  { x: 2, y: 3 },
  { x: 3, y: 3 },
  { x: 1, y: 2 },
  { x: 2, y: 2 },
  { x: 3, y: 2 },
  { x: 1, y: 1 },
  { x: 2, y: 1 },
  { x: 3, y: 1 },
];

export class Game {
  phase: Phase = 'prepare';
  slots: PlayerSlot[] = [];
  selectedCharId: string | null = null;
  selectedBattleUnitId: string | null = null;
  battle: Battle | null = null;
  seed = 1;

  constructor() {
    this.reset();
  }

  reset(): void {
    this.slots = DEFAULT_SLOTS.map((slot) => ({
      charId: slot.charId,
      coord: { ...slot.coord },
      crystalIds: [...slot.crystalIds],
    }));
    this.selectedCharId = this.slots[0]?.charId ?? null;
    this.selectedBattleUnitId = null;
    this.battle = null;
    this.phase = 'prepare';
  }

  get enemyPreview(): EnemyPreviewSlot[] {
    return ENEMY_LOADOUT.map((slot) => ({
      charId: slot.charId,
      coord: { ...slot.coord },
      crystalIds: [...slot.crystalIds],
    }));
  }

  get selectedSlot(): PlayerSlot | undefined {
    if (!this.selectedCharId) return undefined;
    return this.slots.find((slot) => slot.charId === this.selectedCharId);
  }

  isPlaced(charId: string): boolean {
    return this.slots.some((slot) => slot.charId === charId);
  }

  slotAt(coord: Coord): PlayerSlot | undefined {
    return this.slots.find(
      (slot) => slot.coord.x === coord.x && slot.coord.y === coord.y,
    );
  }

  placeAt(charId: string, coord: Coord): boolean {
    if (coord.x < 1 || coord.x > 3 || coord.y < 1 || coord.y > 3) return false;
    if (!CHARACTER_MAP[charId]) return false;

    const occupied = this.slots.find(
      (slot) =>
        slot.charId !== charId &&
        slot.coord.x === coord.x &&
        slot.coord.y === coord.y,
    );
    if (occupied) return false;

    const existing = this.slots.find((slot) => slot.charId === charId);
    if (existing) {
      existing.coord = { ...coord };
      this.selectedCharId = charId;
      return true;
    }

    if (this.slots.length >= MAX_TEAM_SIZE) return false;
    this.slots.push({ charId, coord: { ...coord }, crystalIds: [] });
    this.selectedCharId = charId;
    return true;
  }

  autoPlace(charId: string): boolean {
    if (this.isPlaced(charId)) return true;
    const free = FORMATION.find(
      (coord) =>
        !this.slots.some(
          (slot) => slot.coord.x === coord.x && slot.coord.y === coord.y,
        ),
    );
    if (!free) return false;
    return this.placeAt(charId, free);
  }

  removeChar(charId: string): void {
    this.slots = this.slots.filter((slot) => slot.charId !== charId);
    if (this.selectedCharId === charId) {
      this.selectedCharId = this.slots[0]?.charId ?? null;
    }
  }

  crystalUsedBy(crystalId: string): string | null {
    const owner = this.slots.find((slot) => slot.crystalIds.includes(crystalId));
    return owner?.charId ?? null;
  }

  equipCrystal(charId: string, crystalId: string): boolean {
    const slot = this.slots.find((current) => current.charId === charId);
    if (!slot) return false;

    const existingIndex = slot.crystalIds.indexOf(crystalId);
    if (existingIndex >= 0) {
      slot.crystalIds.splice(existingIndex, 1);
      return true;
    }

    const usedBy = this.crystalUsedBy(crystalId);
    if (usedBy !== null) return false;

    const template = CHARACTER_MAP[charId];
    if (!template) return false;
    if (slot.crystalIds.length >= template.crystalSlots) return false;

    slot.crystalIds.push(crystalId);
    return true;
  }

  baseStats(charId: string): Stats {
    const template = CHARACTER_MAP[charId];
    if (!template) throw new Error(`Unknown character: ${charId}`);
    return createStats(template.base);
  }

  previewStats(charId: string, crystalIds?: string[]): Stats {
    const template = CHARACTER_MAP[charId];
    if (!template) throw new Error(`Unknown character: ${charId}`);
    const ids =
      crystalIds ??
      this.slots.find((slot) => slot.charId === charId)?.crystalIds ??
      [];
    return buildUnitStats(template, ids);
  }

  startBattle(): boolean {
    if (this.slots.length === 0) return false;

    const playerUnits = this.slots.map((slot) => {
      const template = CHARACTER_MAP[slot.charId];
      if (!template) throw new Error(`Unknown character: ${slot.charId}`);
      return buildUnit(template, 'player', slot.coord, slot.crystalIds, 'p');
    });

    const enemyUnits = ENEMY_LOADOUT.map((slot) => {
      const template = CHARACTER_MAP[slot.charId];
      if (!template) throw new Error(`Unknown character: ${slot.charId}`);
      return buildUnit(template, 'enemy', slot.coord, slot.crystalIds, 'e');
    });

    this.seed = Math.floor(Math.random() * 1_000_000_000);
    this.battle = new Battle({
      playerUnits,
      enemyUnits,
      seed: this.seed,
    });
    this.phase = 'battle';
    this.selectedBattleUnitId =
      this.battle.board.aliveUnits('player')[0]?.id ?? null;
    return true;
  }

  backToPrepare(): void {
    this.phase = 'prepare';
    this.battle = null;
    this.selectedBattleUnitId = null;
  }

  getSelectedBattleUnit(): Unit | null {
    if (!this.battle || !this.selectedBattleUnitId) return null;
    return (
      this.battle.board.units.find(
        (unit) => unit.id === this.selectedBattleUnitId,
      ) ?? null
    );
  }
}
