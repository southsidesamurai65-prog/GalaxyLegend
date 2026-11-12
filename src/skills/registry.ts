import type { SkillDef } from './Skill';
import { CODEX_RESULT } from '../data/codex';

/** 技能表完全以 codex.txt 为准。 */
export const SKILLS: Record<string, SkillDef> = {
  ...CODEX_RESULT.skills,
};
