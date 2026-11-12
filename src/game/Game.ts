import type { Coord, Stats } from '../core/types';
import { MAX_TEAM_SIZE } from '../core/types';
import {
  CHARACTER_MAP,
  COMPLETE_CHARACTERS,
  isFlagship,
  type CharacterTemplate,
} from '../data/characters';
import { CRYSTAL_MAP } from '../data/crystals';
import { Battle } from '../battle/Battle';
import type { Unit } from '../battle/Unit';
import { buildUnit, buildUnitStats } from './loadout';
import { buildLevelBaseStats } from './level';
import type { LineupSnapshot } from './lineups';

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

const DEFAULT_FORMATION: Coord[] = [
  { x: 2, y: 2 },
  { x: 1, y: 3 },
  { x: 2, y: 3 },
  { x: 3, y: 3 },
  { x: 1, y: 2 },
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

const DEFAULT_CRYSTAL_SETS = [
  ['星海', '死眼'],
  ['致密', '磁云'],
  ['星辉', '跃闪'],
  ['裂隙', '暗隐'],
  ['强袭', '铁拳'],
];

// 默认双方尽量避开 S 级怪物，先展示 B/A 角色和机制；玩家仍可自行换人。
const DEFAULT_PLAYER_IDS = ['主角', '里昂', '林明美', '萨博', '冈萨罗'];

function pickCharacters(ids: string[]): CharacterTemplate[] {
  const selected: CharacterTemplate[] = [];

  for (const id of ids) {
    const character = CHARACTER_MAP[id];
    if (
      character &&
      character.complete &&
      !selected.some((current) => current.id === character.id)
    ) {
      selected.push(character);
    }
  }

  const flagship = COMPLETE_CHARACTERS.find(
    (character) => character.faction === '旗舰',
  );
  if (flagship && !selected.some((character) => character.id === flagship.id)) {
    selected.unshift(flagship);
  }

  for (const character of COMPLETE_CHARACTERS) {
    if (selected.length >= 5) break;
    if (selected.some((current) => current.id === character.id)) continue;
    selected.push(character);
  }

  // 默认阵容最多保留 1 艘旗舰。
  const flagshipId = selected.find(
    (character) => character.faction === '旗舰',
  )?.id;
  for (let index = selected.length - 1; index >= 0; index -= 1) {
    const character = selected[index];
    if (character.faction === '旗舰' && character.id !== flagshipId) {
      selected.splice(index, 1);
    }
  }

  return selected.slice(0, 5);
}

function buildDefaultSlots(): PlayerSlot[] {
  return pickCharacters(DEFAULT_PLAYER_IDS).map((character, index) => ({
    charId: character.id,
    coord: { ...DEFAULT_FORMATION[index % DEFAULT_FORMATION.length] },
    crystalIds: [...(DEFAULT_CRYSTAL_SETS[index] ?? [])],
  }));
}

function shuffle<T>(items: readonly T[]): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

function randomCrystals(
  character: CharacterTemplate,
  used: Set<string> = new Set(),
): string[] {
  const slots = Math.min(character.crystalSlots, 2);
  if (slots <= 0) return [];
  const available = Object.keys(CRYSTAL_MAP).filter((id) => !used.has(id));
  if (available.length === 0) return [];
  const count = Math.min(
    available.length,
    1 + Math.floor(Math.random() * slots),
  );
  const picked = shuffle(available).slice(0, count);
  for (const id of picked) used.add(id);
  return picked;
}

function buildRandomEnemySlots(): EnemyPreviewSlot[] {
  const flagship = COMPLETE_CHARACTERS.filter(
    (character) => character.faction === '旗舰',
  );
  const others = COMPLETE_CHARACTERS.filter(
    (character) => character.faction !== '旗舰',
  );

  const selected: CharacterTemplate[] = [];
  if (flagship.length > 0) {
    selected.push(flagship[Math.floor(Math.random() * flagship.length)]);
  }

  for (const character of shuffle(others)) {
    if (selected.length >= 5) break;
    selected.push(character);
  }

  for (const character of shuffle(COMPLETE_CHARACTERS)) {
    if (selected.length >= 5) break;
    if (selected.some((current) => current.id === character.id)) continue;
    selected.push(character);
  }

  const formation = shuffle(FORMATION);
  const usedCrystals = new Set<string>();
  return selected.map((character, index) => ({
    charId: character.id,
    coord: { ...formation[index % formation.length] },
    crystalIds: randomCrystals(character, usedCrystals),
  }));
}

const DEFAULT_SLOTS = buildDefaultSlots();

export class Game {
  phase: Phase = 'prepare';
  slots: PlayerSlot[] = [];
  enemySlots: EnemyPreviewSlot[] = [];
  selectedCharId: string | null = null;
  selectedEnemyCharId: string | null = null;
  enemyEditMode = false;
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
    this.selectedEnemyCharId = null;
    this.enemyEditMode = false;
    this.selectedBattleUnitId = null;
    this.battle = null;
    this.phase = 'prepare';
    this.refreshEnemy();
  }

  refreshEnemy(): void {
    this.enemySlots = buildRandomEnemySlots();
    this.selectedEnemyCharId = null;
  }

  get enemyPreview(): EnemyPreviewSlot[] {
    return this.enemySlots.map((slot) => ({
      charId: slot.charId,
      coord: { ...slot.coord },
      crystalIds: [...slot.crystalIds],
    }));
  }

  get selectedSlot(): PlayerSlot | undefined {
    if (!this.selectedCharId) return undefined;
    return this.slots.find((slot) => slot.charId === this.selectedCharId);
  }

  get flagshipCount(): number {
    return this.slots.filter((slot) => isFlagship(slot.charId)).length;
  }

  isComplete(charId: string): boolean {
    return CHARACTER_MAP[charId]?.complete === true;
  }

  isPlaced(charId: string): boolean {
    return this.slots.some((slot) => slot.charId === charId);
  }

  slotAt(coord: Coord): PlayerSlot | undefined {
    return this.slots.find(
      (slot) => slot.coord.x === coord.x && slot.coord.y === coord.y,
    );
  }

  enemySlotAt(coord: Coord): EnemyPreviewSlot | undefined {
    return this.enemySlots.find(
      (slot) => slot.coord.x === coord.x && slot.coord.y === coord.y,
    );
  }

  isEnemyPlaced(charId: string): boolean {
    return this.enemySlots.some((slot) => slot.charId === charId);
  }

  placeEnemyAt(charId: string, coord: Coord): boolean {
    if (coord.x < 1 || coord.x > 3 || coord.y < 1 || coord.y > 3) return false;
    const template = CHARACTER_MAP[charId];
    if (!template || !template.complete) return false;

    const existing = this.enemySlots.find((slot) => slot.charId === charId);
    const occupied = this.enemySlots.find(
      (slot) =>
        slot.charId !== charId &&
        slot.coord.x === coord.x &&
        slot.coord.y === coord.y,
    );

    if (
      isFlagship(charId) &&
      this.enemySlots.some(
        (slot) =>
          slot.charId !== charId &&
          slot !== occupied &&
          isFlagship(slot.charId),
      )
    ) {
      return false;
    }

    if (existing) {
      if (occupied) {
        const previous = { ...existing.coord };
        existing.coord = { ...coord };
        occupied.coord = previous;
      } else {
        existing.coord = { ...coord };
      }
      return true;
    }

    if (occupied) {
      this.enemySlots = this.enemySlots.filter((slot) => slot !== occupied);
    }
    if (this.enemySlots.length >= MAX_TEAM_SIZE) return false;

    const usedCrystals = new Set(
      this.enemySlots.flatMap((slot) => slot.crystalIds),
    );
    this.enemySlots.push({
      charId,
      coord: { ...coord },
      crystalIds: randomCrystals(template, usedCrystals),
    });
    return true;
  }

  removeEnemy(charId: string): void {
    this.enemySlots = this.enemySlots.filter((slot) => slot.charId !== charId);
    if (this.selectedEnemyCharId === charId) this.selectedEnemyCharId = null;
  }

  clearEnemyLineup(): void {
    this.enemySlots = [];
    this.selectedEnemyCharId = null;
  }

  enemyCrystalUsedBy(crystalId: string): string | null {
    const owner = this.enemySlots.find((slot) =>
      slot.crystalIds.includes(crystalId),
    );
    return owner?.charId ?? null;
  }

  equipEnemyCrystal(charId: string, crystalId: string): boolean {
    const slot = this.enemySlots.find((current) => current.charId === charId);
    if (!slot) return false;

    const existingIndex = slot.crystalIds.indexOf(crystalId);
    if (existingIndex >= 0) {
      slot.crystalIds.splice(existingIndex, 1);
      return true;
    }

    const usedBy = this.enemyCrystalUsedBy(crystalId);
    if (usedBy !== null) return false;

    const template = CHARACTER_MAP[charId];
    if (!template) return false;
    if (slot.crystalIds.length >= template.crystalSlots) return false;

    slot.crystalIds.push(crystalId);
    return true;
  }

  placeAt(charId: string, coord: Coord): boolean {
    if (coord.x < 1 || coord.x > 3 || coord.y < 1 || coord.y > 3) return false;
    const template = CHARACTER_MAP[charId];
    if (!template || !template.complete) return false;

    if (
      isFlagship(charId) &&
      this.slots.some(
        (slot) => slot.charId !== charId && isFlagship(slot.charId),
      )
    ) {
      return false;
    }

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
    if (!this.isComplete(charId)) return false;
    if (
      isFlagship(charId) &&
      this.slots.some((slot) => isFlagship(slot.charId))
    ) {
      return false;
    }
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

  snapshotLineup(): LineupSnapshot {
    return {
      player: this.slots.map((slot) => ({
        charId: slot.charId,
        coord: { ...slot.coord },
        crystalIds: [...slot.crystalIds],
      })),
      enemy: this.enemySlots.map((slot) => ({
        charId: slot.charId,
        coord: { ...slot.coord },
        crystalIds: [...slot.crystalIds],
      })),
    };
  }

  applyLineup(snapshot: LineupSnapshot): boolean {
    const player = this.normalizeLineup(snapshot.player);
    if (player.length === 0) return false;
    const enemy = this.normalizeLineup(snapshot.enemy);

    this.slots = player;
    this.enemySlots = enemy;
    this.selectedCharId = player[0]?.charId ?? null;
    this.selectedEnemyCharId = null;
    this.enemyEditMode = false;
    this.selectedBattleUnitId = null;
    this.battle = null;
    this.phase = 'prepare';
    return true;
  }

  private normalizeLineup(
    slots: Array<{ charId: string; coord: Coord; crystalIds: string[] }>,
  ): PlayerSlot[] {
    const result: PlayerSlot[] = [];
    const usedChars = new Set<string>();
    const usedCrystals = new Set<string>();

    for (const slot of slots) {
      if (result.length >= MAX_TEAM_SIZE) break;
      const template = CHARACTER_MAP[slot.charId];
      if (!template || !template.complete) continue;
      if (usedChars.has(slot.charId)) continue;
      const { x, y } = slot.coord;
      if (x < 1 || x > 3 || y < 1 || y > 3) continue;

      const crystalIds: string[] = [];
      for (const crystalId of slot.crystalIds) {
        if (!CRYSTAL_MAP[crystalId] || usedCrystals.has(crystalId)) continue;
        if (crystalIds.length >= template.crystalSlots) break;
        crystalIds.push(crystalId);
        usedCrystals.add(crystalId);
      }

      usedChars.add(slot.charId);
      result.push({
        charId: slot.charId,
        coord: { x, y },
        crystalIds,
      });
    }

    return result;
  }

  baseStats(charId: string): Stats {
    const template = CHARACTER_MAP[charId];
    if (!template) throw new Error(`Unknown character: ${charId}`);
    return buildLevelBaseStats(template);
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
    if (this.flagshipCount !== 1) return false;
    if (this.enemySlots.length === 0) return false;
    this.enemyEditMode = false;
    this.selectedEnemyCharId = null;

    const playerUnits = this.slots.map((slot) => {
      const template = CHARACTER_MAP[slot.charId];
      if (!template) throw new Error(`Unknown character: ${slot.charId}`);
      return buildUnit(template, 'player', slot.coord, slot.crystalIds, 'p');
    });

    const enemyUnits = this.enemySlots.map((slot) => {
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
    this.enemyEditMode = false;
    this.selectedEnemyCharId = null;
    this.refreshEnemy();
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
