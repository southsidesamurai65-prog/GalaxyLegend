import type { Coord } from '../core/types';

export interface LineupSlot {
  charId: string;
  coord: Coord;
  crystalIds: string[];
}

export interface LineupSnapshot {
  player: LineupSlot[];
  enemy: LineupSlot[];
}

export interface LineupPreset extends LineupSnapshot {
  id: string;
  name: string;
  savedAt: number;
}

const STORAGE_KEY = 'galaxy-legend-lineups-v1';
const MAX_PRESETS = 20;

function copyCoord(coord: Coord): Coord {
  return { x: coord.x, y: coord.y };
}

function normalizeSlot(raw: unknown): LineupSlot | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Partial<LineupSlot>;
  if (typeof value.charId !== 'string') return null;
  const coord = value.coord;
  if (
    !coord ||
    typeof coord.x !== 'number' ||
    typeof coord.y !== 'number' ||
    coord.x < 1 ||
    coord.x > 3 ||
    coord.y < 1 ||
    coord.y > 3
  ) {
    return null;
  }
  return {
    charId: value.charId,
    coord: copyCoord(coord),
    crystalIds: Array.isArray(value.crystalIds)
      ? value.crystalIds.filter((id): id is string => typeof id === 'string')
      : [],
  };
}

function normalizeSlots(raw: unknown): LineupSlot[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const slots: LineupSlot[] = [];
  for (const item of raw) {
    const slot = normalizeSlot(item);
    if (!slot || seen.has(slot.charId)) continue;
    seen.add(slot.charId);
    slots.push(slot);
    if (slots.length >= 5) break;
  }
  return slots;
}

function normalizePreset(raw: unknown): LineupPreset | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Partial<LineupPreset>;
  if (typeof value.id !== 'string' || typeof value.name !== 'string') {
    return null;
  }
  const player = normalizeSlots(value.player);
  const enemy = normalizeSlots(value.enemy);
  if (player.length === 0) return null;
  return {
    id: value.id,
    name: value.name,
    savedAt: typeof value.savedAt === 'number' ? value.savedAt : Date.now(),
    player,
    enemy,
  };
}

export function loadLineupPresets(): LineupPreset[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(normalizePreset)
      .filter((preset): preset is LineupPreset => preset !== null);
  } catch {
    return [];
  }
}

function persist(presets: LineupPreset[]): LineupPreset[] {
  if (typeof localStorage === 'undefined') return presets;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
  } catch {
    // 隐私模式或存储空间不足时静默失败，不影响当前阵容。
  }
  return presets;
}

export function saveLineupPreset(
  name: string,
  snapshot: LineupSnapshot,
): LineupPreset[] {
  const presets = loadLineupPresets();
  const preset: LineupPreset = {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    name: name.trim() || `阵容 ${presets.length + 1}`,
    savedAt: Date.now(),
    player: snapshot.player.map((slot) => ({
      charId: slot.charId,
      coord: copyCoord(slot.coord),
      crystalIds: [...slot.crystalIds],
    })),
    enemy: snapshot.enemy.map((slot) => ({
      charId: slot.charId,
      coord: copyCoord(slot.coord),
      crystalIds: [...slot.crystalIds],
    })),
  };
  const next = [preset, ...presets].slice(0, MAX_PRESETS);
  return persist(next);
}

export function deleteLineupPreset(id: string): LineupPreset[] {
  const next = loadLineupPresets().filter((preset) => preset.id !== id);
  return persist(next);
}
