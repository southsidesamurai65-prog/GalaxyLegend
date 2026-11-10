import { Unit } from '../battle/Unit';
import type { CharacterTemplate } from '../data/characters';
import type { Coord, Side, Stats } from '../core/types';
import { createStats } from '../core/attributes';
import { applyModifiers } from '../core/modifiers';
import { CRYSTAL_MAP } from '../data/crystals';
import { SKILLS } from '../skills/registry';

export function buildUnitStats(
  template: CharacterTemplate,
  crystalIds: string[],
): Stats {
  const mods = crystalIds.flatMap((id) => CRYSTAL_MAP[id]?.mods ?? []);
  return applyModifiers(createStats(template.base), mods);
}

export function buildUnit(
  template: CharacterTemplate,
  side: Side,
  coord: Coord,
  crystalIds: string[],
  idPrefix: string,
): Unit {
  const stats = buildUnitStats(template, crystalIds);
  const skill = SKILLS[template.skillId];
  if (!skill) throw new Error(`Unknown skill: ${template.skillId}`);

  return new Unit({
    id: `${idPrefix}-${template.id}`,
    name: template.name,
    role: template.role,
    destroyer: !!template.destroyer,
    side,
    coord,
    stats,
    skill,
  });
}
