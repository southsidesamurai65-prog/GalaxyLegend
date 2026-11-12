import type { CharacterTemplate } from './characterTypes';
import { CODEX_RESULT } from './codex';

export type { CharacterTemplate, Rarity } from './characterTypes';
export { isFlagshipCharacter } from './characterTypes';

/** 角色表完全以 codex.txt 为准，codex 变化时 Vite 会热更新。 */
export const CHARACTERS: CharacterTemplate[] = [...CODEX_RESULT.characters];

export const CHARACTER_MAP: Record<string, CharacterTemplate> = Object.fromEntries(
  CHARACTERS.map((character) => [character.id, character]),
);

export const COMPLETE_CHARACTERS = CHARACTERS.filter(
  (character) => character.complete,
);

export function getCharacter(id: string): CharacterTemplate {
  const character = CHARACTER_MAP[id];
  if (!character) throw new Error(`Unknown character: ${id}`);
  return character;
}

export function isFlagship(id: string): boolean {
  return CHARACTER_MAP[id]?.faction === '旗舰';
}

export function getFlagshipCharacters(): CharacterTemplate[] {
  return CHARACTERS.filter((character) => character.faction === '旗舰');
}
