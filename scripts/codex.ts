import { CODEX_RESULT } from '../src/data/codex';
import { CHARACTERS } from '../src/data/characters';
import { SKILLS } from '../src/skills/registry';

console.log('codex characters:');
for (const character of CODEX_RESULT.characters) {
  const skill = SKILLS[character.skillId];
  console.log(
    [
      character.name,
      character.rarity,
      character.faction,
      character.complete ? 'complete' : 'incomplete',
      `HP=${character.base.hp ?? '?'}`,
      `atk=${character.base.physAtk ?? character.base.energyAtk ?? '?'}`,
      `skill=${skill?.name ?? '?'}`,
      `shape=${skill?.shape ?? '?'}`,
      `mult=${skill?.baseMultiplier ?? '?'}`,
      `cost=${skill?.chargeCostRatio ?? 1}`,
      `drain=${skill?.drainTargetCharge ?? false}`,
      `targetDelta=${skill?.targetChargeDelta ?? 0}`,
      `skipHit=${skill?.skipHitCharge ?? false}`,
      `flatHoly=${skill?.flatHolyDamage ?? 0}`,
      `poison=${skill?.poisonPercent ?? 0}/${skill?.poisonDuration ?? 0}`,
      `selfCharge=${skill?.selfChargeGain ?? 0}`,
      `teamCharge=${skill?.teamChargeGain ?? 0}`,
      `passive=${JSON.stringify(character.passive ?? null)}`,
      `cast=${JSON.stringify(skill?.castEffects ?? [])}`,
      `onHit=${JSON.stringify(skill?.onHitEffects ?? [])}`,
    ].join(' | '),
  );
}

console.log('\nall characters:', CHARACTERS.length);
console.log('warnings:', CODEX_RESULT.warnings);
