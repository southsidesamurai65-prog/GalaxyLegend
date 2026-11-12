import codexRaw from '../../codex.txt?raw';
import type { AttributeKey, Stats } from '../core/types';
import { ATTRIBUTE_DEFS } from '../core/attributes';
import type { EffectSpec } from '../battle/effects/Effect';
import type { CastEffectSpec, SkillDef } from '../skills/Skill';
import type { CharacterTemplate, Rarity } from './characterTypes';

export interface CodexResult {
  characters: CharacterTemplate[];
  skills: Record<string, SkillDef>;
  warnings: string[];
}

interface PendingCharacter {
  name: string;
  rarity: Rarity;
  faction: string;
  skillText: string;
  base?: Partial<Stats>;
  complete: boolean;
}

const RARITY_COLORS: Record<Rarity, string> = {
  B: '#94a3b8',
  A: '#38bdf8',
  S: '#c084fc',
  S1: '#fbbf24',
  S2: '#fb923c',
  SS: '#f87171',
};

const FACTION_HEADER = /^[-—–\s]*([\u4e00-\u9fa5A-Za-z]+)\((\d*)\)$/;
const CHARACTER_LINE =
  /^([\u4e00-\u9fa5A-Za-z0-9·]+)\(((?:SS|S1|S2|S|A|B))\)\s*[，,]\s*(?:技能|节能)[：:]\s*(.+)$/;
const ATTRIBUTE_LINE = /^属性[：:]\s*(.+)$/;

const STAT_ALT =
  '物理攻击|物理防御|技能攻击|技能防御|能量攻击|能量防御|暴击伤害|暴击|免爆|拦截|格挡|破防|闪避|命中|速度|HP|初始蓄能';
const STAT_JOIN = '和|、|/|及';
const MULTI_STAT = `((?:${STAT_ALT})(?:(?:${STAT_JOIN})(?:${STAT_ALT}))*)`;
const ALLY_BUFF_RE = new RegExp(
  `(?:增加|提高|提升)随(?:机|即)一名队友(\\d+(?:\\.\\d+)?)%${MULTI_STAT}(?:(\\d+)回合)?`,
);
const SELF_BUFF_RE = new RegExp(
  `(?:增加|提高|提升)自身(\\d+(?:\\.\\d+)?)%${MULTI_STAT}(?:(\\d+)回合)?`,
);
const TEAM_BUFF_RE = new RegExp(
  `(?:增加|提高|提升)全体(?:队友|友方)?(\\d+(?:\\.\\d+)?)%${MULTI_STAT}(?:(\\d+)回合)?`,
);
const SELF_FLAT_BUFF_RE = new RegExp(
  `(?:增加|提高|提升)自身([\\d,.]+(?:W|万|w)?)(${STAT_ALT})(?:.*?(\\d+)回合)?`,
);

export function parseCodex(raw: string): CodexResult {
  const characters: CharacterTemplate[] = [];
  const skills = new Map<string, SkillDef>();
  const warnings: string[] = [];
  let faction = '未分类';
  let pending: PendingCharacter | null = null;

  const finalize = (): void => {
    if (!pending) return;
    const current = pending;
    pending = null;

    const passiveMatch = current.skillText.match(/被动[：:]\s*(.+)$/);
    const passiveText = passiveMatch
      ? passiveMatch[1].trim().replace(/[。.]$/, '')
      : '';
    const activeSkillText = current.skillText
      .replace(/被动[：:].*$/, '')
      .trim();

    const parsedSkill = parseSkill(activeSkillText, warnings);
    let skill = skills.get(parsedSkill.id);

    if (!skill) {
      skills.set(parsedSkill.id, parsedSkill);
      skill = parsedSkill;
    } else if (!sameSkillMechanics(skill, parsedSkill)) {
      // 同名技能在不同角色身上效果不同：为该角色生成独立变体。
      let variantId = `${parsedSkill.id}-${current.name}`;
      let index = 2;
      while (skills.has(variantId)) {
        variantId = `${parsedSkill.id}-${current.name}-${index}`;
        index += 1;
      }
      skill = { ...parsedSkill, id: variantId };
      skills.set(variantId, skill);
      warnings.push(
        `技能【${parsedSkill.name}】在【${current.name}】上效果不同，已生成独立技能 ${variantId}。`,
      );
    }

    const usedIds = new Set(characters.map((character) => character.id));
    characters.push({
      id: uniqueId(current.name, usedIds),
      name: current.name,
      role: current.faction,
      faction: current.faction,
      rarity: current.rarity,
      destroyer: current.faction === '毁灭者',
      color: RARITY_COLORS[current.rarity],
      crystalSlots: 3,
      skillId: skill.id,
      base: current.base ?? {},
      complete: current.complete,
      source: 'codex',
      passive: passiveText
        ? {
            noHitCharge: /被击中.*不会增加蓄能/.test(passiveText),
            description: passiveText,
          }
        : undefined,
    });
  };

  type LogicalKind = 'faction' | 'character' | 'attribute';
  const logicalLines: Array<{ line: string; kind: LogicalKind }> = [];

  // codex 里技能描述可能被手动换行，续行拼回上一条角色行。
  for (const rawLine of raw.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    if (FACTION_HEADER.test(line)) {
      logicalLines.push({ line, kind: 'faction' });
      continue;
    }
    if (CHARACTER_LINE.test(line)) {
      logicalLines.push({ line, kind: 'character' });
      continue;
    }
    if (ATTRIBUTE_LINE.test(line)) {
      logicalLines.push({ line, kind: 'attribute' });
      continue;
    }

    const previous = logicalLines[logicalLines.length - 1];
    if (previous && previous.kind === 'character') {
      previous.line += line;
    }
    // 其余是标题/说明行，忽略。
  }

  for (const entry of logicalLines) {
    const line = entry.line;

    if (entry.kind === 'faction') {
      const factionMatch = line.match(FACTION_HEADER);
      if (factionMatch) {
        finalize();
        faction = factionMatch[1];
      }
      continue;
    }

    if (entry.kind === 'character') {
      const characterMatch = line.match(CHARACTER_LINE);
      if (characterMatch) {
        finalize();
        pending = {
          name: characterMatch[1],
          rarity: characterMatch[2] as Rarity,
          faction,
          skillText: characterMatch[3],
          complete: false,
        };
      }
      continue;
    }

    if (entry.kind === 'attribute') {
      const attributeMatch = line.match(ATTRIBUTE_LINE);
      if (attributeMatch) {
        if (!pending) {
          warnings.push(`属性行没有对应角色：${line}`);
          continue;
        }
        const parsed = parseAttributes(
          attributeMatch[1],
          pending.faction,
          pending.name,
          warnings,
        );
        pending.base = parsed.base;
        pending.complete = parsed.complete;
      }
    }
  }

  finalize();

  return {
    characters,
    skills: Object.fromEntries(skills),
    warnings,
  };
}

function parseAttributes(
  text: string,
  faction: string,
  characterName: string,
  warnings: string[],
): { base: Partial<Stats>; complete: boolean } {
  const cleaned = text.trim().replace(/[。.]$/, '');
  const parts = cleaned.split(/\s+/).filter(Boolean);
  const values = parts.map((part) => {
    const token = part.replace(/%/g, '');
    if (token === '无' || token === '—' || token === '-' || token === 'N/A') {
      return 0;
    }
    return Number.parseFloat(token);
  });

  if (values.some((value) => Number.isNaN(value))) {
    warnings.push(`角色【${characterName}】的属性行无法解析：${text}`);
    return { base: {}, complete: false };
  }

  const isDestroyer = faction === '毁灭者';
  let base: Partial<Stats>;

  if (values.length === 15) {
    base = {
      hp: values[0],
      physAtk: values[1],
      physDef: values[2],
      skillAtk: values[3],
      skillDef: values[4],
      energyAtk: values[5],
      crit: values[6],
      antiCrit: values[7],
      critDamage: values[8],
      intercept: values[9],
      armorBreak: values[10],
      dodge: values[11],
      hit: values[12],
      speed: values[13],
      initialCharge: values[14],
    };
  } else if (values.length === 14) {
    if (isDestroyer) {
      // 毁灭者的 14 位写法按“省略物理攻击”处理。
      base = {
        hp: values[0],
        physDef: values[1],
        skillAtk: values[2],
        skillDef: values[3],
        energyAtk: values[4],
        crit: values[5],
        antiCrit: values[6],
        critDamage: values[7],
        intercept: values[8],
        armorBreak: values[9],
        dodge: values[10],
        hit: values[11],
        speed: values[12],
        initialCharge: values[13],
        physAtk: 0,
      };
      warnings.push(
        `毁灭者【${characterName}】使用 14 位属性，按省略物理攻击解析；如格式不符请改成 15 位。`,
      );
    } else {
      base = {
        hp: values[0],
        physAtk: values[1],
        physDef: values[2],
        skillAtk: values[3],
        skillDef: values[4],
        crit: values[5],
        antiCrit: values[6],
        critDamage: values[7],
        intercept: values[8],
        armorBreak: values[9],
        dodge: values[10],
        hit: values[11],
        speed: values[12],
        initialCharge: values[13],
        energyAtk: 0,
      };
    }
  } else if (values.length === 13) {
    // 兼容旧版毁灭者 13 位格式。
    base = {
      hp: values[0],
      physAtk: values[1],
      physDef: values[2],
      skillAtk: values[3],
      skillDef: values[4],
      energyAtk: values[5],
      crit: values[6],
      antiCrit: values[7],
      critDamage: values[8],
      dodge: values[9],
      hit: values[10],
      speed: values[11],
      initialCharge: values[12],
    };
  } else if (values.length === 12) {
    if (isDestroyer) {
      // 旧版毁灭者 12 位写法：省略物理攻击。
      base = {
        hp: values[0],
        physDef: values[1],
        skillAtk: values[2],
        skillDef: values[3],
        energyAtk: values[4],
        crit: values[5],
        antiCrit: values[6],
        critDamage: values[7],
        dodge: values[8],
        hit: values[9],
        speed: values[10],
        initialCharge: values[11],
        physAtk: 0,
      };
      warnings.push(
        `毁灭者【${characterName}】使用 12 位属性，按省略物理攻击解析；建议改成 15 位。`,
      );
    } else {
      base = {
        hp: values[0],
        physAtk: values[1],
        physDef: values[2],
        skillAtk: values[3],
        skillDef: values[4],
        crit: values[5],
        antiCrit: values[6],
        critDamage: values[7],
        dodge: values[8],
        hit: values[9],
        speed: values[10],
        initialCharge: values[11],
        energyAtk: 0,
      };
    }
  } else {
    warnings.push(
      `角色【${characterName}】的属性数量为 ${values.length}，期望 12/13/14/15 位：${text}`,
    );
    return { base: {}, complete: false };
  }

  if (!isDestroyer) base.physAtk = base.physAtk ?? 0;
  if (isDestroyer) base.energyAtk = base.energyAtk ?? 0;

  return { base, complete: true };
}

function parseSkill(text: string, warnings: string[]): SkillDef {
  const cleaned = text.trim().replace(/[。.]$/, '');
  // 数字里的千分位逗号（如 2,000,000）不能当作技能描述分隔符。
  const splitText = cleaned.replace(/(?<=\d),(?=\d)/g, '');
  const parts = splitText
    .split(/[，,]/)
    .map((part) => part.trim())
    .filter(Boolean);
  const name = parts[0] ?? '未知技能';
  const shape = detectShape(cleaned);
  const baseMultiplier = detectMultiplier(cleaned);
  const hasBonusHoly = /额外附带.*神圣伤害/.test(cleaned);
  const holy =
    (!hasBonusHoly && /神圣/.test(cleaned)) ||
    /(无视|忽略)[^，,]*防御/.test(cleaned);

  const castEffects: CastEffectSpec[] = [];
  const onHitEffects: EffectSpec[] = [];
  let chargeCostRatio: number | undefined;
  let drainTargetCharge = false;
  let targetChargeDelta: number | undefined;
  let skipHitCharge =
    /本次攻击不会增加目标蓄能|本次攻击不增加目标蓄能|不加.*倒扣/.test(
      cleaned,
    );
  let flatHolyDamage: number | undefined;
  let poisonPercent: number | undefined;
  let poisonDuration: number | undefined;
  let poisonRandomCount: number | undefined;
  let healPercent: number | undefined;
  let healTargets: SkillDef['healTargets'];
  let selfChargeGain: number | undefined;
  let teamChargeGain: number | undefined;

  const bonusHoly = cleaned.match(
    /额外附带([\d,.]+(?:W|万|w)?)神圣伤害/,
  );
  if (bonusHoly) flatHolyDamage = parseAmount(bonusHoly[1]);

  const poison = cleaned.match(
    /中毒.*?(\d+(?:\.\d+)?)%技能伤害.*?持续(\d+)回合/,
  );
  if (poison) {
    poisonPercent = Number(poison[1]);
    poisonDuration = Number(poison[2]);
  }

  const randomPoison = cleaned.match(
    /随机([一二两三四五六七八九十\d]+)(?:名|个)?敌人.*?中毒(\d+)回合/,
  );
  const randomPoisonPercent = cleaned.match(
    /掉落(\d+(?:\.\d+)?)%技能伤害/,
  );
  if (randomPoison && randomPoisonPercent) {
    poisonRandomCount = parseSmallNumber(randomPoison[1]);
    poisonDuration = Number(randomPoison[2]);
    poisonPercent = Number(randomPoisonPercent[1]);
  }

  const heal = cleaned.match(
    /治疗自身和己方除自身血量最低单位.*?治疗量相当于(\d+(?:\.\d+)?)%伤害/,
  );
  if (heal) {
    healPercent = Number(heal[1]);
    healTargets = ['self', 'lowestHpAlly'];
  }

  for (const part of parts.slice(1)) {
    const chanceMatch = part.match(/(\d+(?:\.\d+)?)%几率/);
    const chance = chanceMatch ? Number(chanceMatch[1]) : undefined;

    if (/仅消耗一半蓄能/.test(part)) chargeCostRatio = 0.5;
    const costPercent = part.match(/仅消耗(\d+(?:\.\d+)?)%蓄能/);
    if (costPercent) chargeCostRatio = Number(costPercent[1]) / 100;

    if (/清空目标蓄能/.test(part)) drainTargetCharge = true;

    const reduceCharge = part.match(/减少目标(\d+)蓄能/);
    if (reduceCharge) {
      targetChargeDelta = -Number(reduceCharge[1]);
    }

    const selfCharge = part.match(
      /(?:增加|提高|提升|回复|恢复)(?:自身)?(\d+)蓄能/,
    );
    if (selfCharge) selfChargeGain = Number(selfCharge[1]);

    const teamCharge = part.match(
      /(?:增加|提高|提升)全体(?:队友|友方)?(\d+)蓄能/,
    );
    if (teamCharge) teamChargeGain = Number(teamCharge[1]);

    const atkDown = part.match(
      /降低目标(\d+(?:\.\d+)?)%物理攻击(\d+)回合/,
    );
    if (atkDown) {
      onHitEffects.push({
        kind: 'statBuff',
        duration: Number(atkDown[2]),
        stat: 'physAtk',
        mul: 1 - Number(atkDown[1]) / 100,
        label: `物理攻击 -${Number(atkDown[1])}%`,
      });
    }

    const defDown = part.match(
      /降低目标(\d+(?:\.\d+)?)%物理防御(\d+)回合/,
    );
    if (defDown) {
      onHitEffects.push({
        kind: 'statBuff',
        duration: Number(defDown[2]),
        stat: 'physDef',
        mul: 1 - Number(defDown[1]) / 100,
        label: `物理防御 -${Number(defDown[1])}%`,
      });
    }

    const skillDefDown = part.match(
      /降低目标(\d+(?:\.\d+)?)%技能防御(\d+)回合/,
    );
    if (skillDefDown) {
      onHitEffects.push({
        kind: 'statBuff',
        duration: Number(skillDefDown[2]),
        stat: 'skillDef',
        mul: 1 - Number(skillDefDown[1]) / 100,
        label: `技能防御 -${Number(skillDefDown[1])}%`,
      });
    }

    const skillAtkZero = part.match(
      /(?:使)?目标技能攻击降低为0\s*(\d+)回合/,
    );
    if (skillAtkZero) {
      onHitEffects.push({
        kind: 'statBuff',
        duration: Number(skillAtkZero[1]),
        stat: 'skillAtk',
        mul: 0,
        label: '技能攻击降为 0',
      });
    }

    const lock = part.match(
      /(?:(\d+(?:\.\d+)?)%\s*)?锁定(?:目标)?(\d+)回合/,
    );
    if (lock) {
      onHitEffects.push({
        kind: 'lock',
        duration: Number(lock[2]),
        ...(lock[1] ? { chance: Number(lock[1]) } : {}),
      });
    }

    const silence = part.match(
      /(?:(\d+(?:\.\d+)?)%\s*)?(?:禁止释放技能|禁技)(?:目标)?(\d+)回合/,
    );
    if (silence) {
      onHitEffects.push({
        kind: 'silence',
        duration: Number(silence[2]),
        ...(silence[1] ? { chance: Number(silence[1]) } : {}),
      });
    }

    const freeze = part.match(
      /(?:(\d+(?:\.\d+)?)%\s*几率)?冰冻目标(\d+)回合/,
    );
    if (freeze) {
      const freezeDefDown =
        part.match(/降低其(\d+(?:\.\d+)?)%物理防御/) ??
        cleaned.match(/降低其(\d+(?:\.\d+)?)%物理防御/) ??
        cleaned.match(/冰冻效果.*?降低(\d+)%物理防御/);
      onHitEffects.push({
        kind: 'freeze',
        duration: Number(freeze[2]),
        ...(freeze[1] ? { chance: Number(freeze[1]) } : {}),
        defDownPercent: freezeDefDown ? Number(freezeDefDown[1]) : 20,
      });
    }

    const allyStealth = part.match(
      /(?:使)?血量最少的队友(?:[（(]包括自身[）)])?隐身(\d+)回合/,
    );
    if (allyStealth) {
      castEffects.push({
        target: 'lowestHpAlly',
        effect: { kind: 'stealth', duration: Number(allyStealth[1]) },
      });
    }

    const teamStealth = part.match(
      /使己方除自身(?:所有)?队友隐身(\d+)回合/,
    );
    if (teamStealth) {
      castEffects.push({
        target: 'allAlliesExceptSelf',
        effect: { kind: 'stealth', duration: Number(teamStealth[1]) },
      });
    }

    const targetStealth = part.match(
      /将被攻击的目标隐身(\d+)回合/,
    );
    if (targetStealth) {
      onHitEffects.push({
        kind: 'stealth',
        duration: Number(targetStealth[1]),
      });
    }

    const allyBuff = part.match(ALLY_BUFF_RE);
    if (allyBuff) {
      const duration = allyBuff[3] ? Number(allyBuff[3]) : 2;
      if (!allyBuff[3]) {
        warnings.push(
          `技能【${name}】的队友增益未写持续时间，暂按 2 次行动处理。`,
        );
      }
      pushStatBuffList(
        castEffects,
        'randomAlly',
        allyBuff[2],
        Number(allyBuff[1]),
        duration,
        name,
        warnings,
      );
    }

    const selfBuff = part.match(SELF_BUFF_RE);
    if (selfBuff) {
      pushStatBuffList(
        castEffects,
        'self',
        selfBuff[2],
        Number(selfBuff[1]),
        selfBuff[3] ? Number(selfBuff[3]) : 2,
        name,
        warnings,
      );
    }

    const teamBuff = part.match(TEAM_BUFF_RE);
    if (teamBuff) {
      pushStatBuffList(
        castEffects,
        'allAllies',
        teamBuff[2],
        Number(teamBuff[1]),
        teamBuff[3] ? Number(teamBuff[3]) : 2,
        name,
        warnings,
      );
    }

    const randomAlliesBuff = part.match(
      new RegExp(
        `(?:增加|提高|提升)随机([一二两三四五六七八九十\\d]+)(?:个|名)?己方单位(\\d+(?:\\.\\d+)?)%${MULTI_STAT}(?:(\\d+)回合)?`,
      ),
    );
    if (randomAlliesBuff) {
      pushStatBuffList(
        castEffects,
        'randomAllies',
        randomAlliesBuff[3],
        Number(randomAlliesBuff[2]),
        randomAlliesBuff[4] ? Number(randomAlliesBuff[4]) : 2,
        name,
        warnings,
        parseSmallNumber(randomAlliesBuff[1]),
      );
    }

    const luckyAtk = part.match(
      /(\d+(?:\.\d+)?)%几率(?:使)?自身(?:物理)?攻击(?:力)?(?:上涨|提高|提升)(\d+(?:\.\d+)?)倍/,
    );
    if (luckyAtk) {
      const multiplier = Number(luckyAtk[2]);
      castEffects.push({
        target: 'self',
        effect: {
          kind: 'statBuff',
          duration: 1,
          stat: 'physAtk',
          mul: multiplier,
          label: `物理攻击 ×${multiplier}`,
          chance: Number(luckyAtk[1]),
        },
      });
    }

    const flatEnergyDef = part.match(
      /为自身增加([\d,.]+(?:W|万|w)?)能量防御(?:.*?(\d+)回合)?/,
    );
    if (flatEnergyDef) {
      const amount = parseAmount(flatEnergyDef[1]);
      castEffects.push({
        target: 'self',
        effect: {
          kind: 'statBuff',
          duration: flatEnergyDef[2] ? Number(flatEnergyDef[2]) : 2,
          stat: 'energyDef',
          add: amount,
          label: `能量防御 +${amount}`,
        },
      });
    }

    const selfFlatBuff = part.match(SELF_FLAT_BUFF_RE);
    if (selfFlatBuff) {
      const stat = STAT_NAME_MAP[selfFlatBuff[2]];
      if (stat) {
        const amount = parseAmount(selfFlatBuff[1]);
        castEffects.push({
          target: 'self',
          effect: {
            kind: 'statBuff',
            duration: selfFlatBuff[3] ? Number(selfFlatBuff[3]) : 2,
            stat,
            add: amount,
            label: `${ATTRIBUTE_DEFS[stat].label} +${amount}`,
          },
        });
      }
    }

    const selfShield = part.match(
      /(?:为自身)?(?:附加|获得|增加)(?:一个)?([\d,.]+(?:W|万|w)?)的?护盾(?:(\d+)回合)?/,
    );
    if (selfShield && !/目标/.test(part) && !/全体/.test(part)) {
      castEffects.push({
        target: 'self',
        effect: {
          kind: 'shield',
          duration: selfShield[2] ? Number(selfShield[2]) : 2,
          absorb: parseAmount(selfShield[1]),
          ...(chance !== undefined ? { chance } : {}),
        },
      });
    }

    const targetShield = part.match(
      /(?:(\d+(?:\.\d+)?)%几率)?(?:给)?(?:被攻击的?)?目标(?:加|获得|附加|增加)(?:一个)?([\d,.]+(?:W|万|w)?)的?护盾(?:(\d+)回合)?/,
    );
    if (targetShield) {
      onHitEffects.push({
        kind: 'shield',
        duration: targetShield[3] ? Number(targetShield[3]) : 1,
        absorb: parseAmount(targetShield[2]),
        ...(chance !== undefined ? { chance } : {}),
      });
    }
  }

  // “给全体加一个30W的护盾，持续1回合”这类写法。
  const teamShield = cleaned.match(
    /(?:给)?全体(?:队友|友方)?(?:加|获得|附加|增加)?(?:一个)?([\d,.]+(?:W|万|w)?)的?护盾(?:.*?持续(\d+)回合)?/,
  );
  if (teamShield) {
    const absorb = parseAmount(teamShield[1]);
    if (absorb > 0) {
      castEffects.push({
        target: 'allAllies',
        effect: {
          kind: 'shield',
          duration: teamShield[2] ? Number(teamShield[2]) : 2,
          absorb,
        },
      });
    }
  }

  return {
    id: `codex-skill-${name}`,
    name,
    description: cleaned,
    shape,
    baseMultiplier,
    holy,
    castEffects: castEffects.length > 0 ? castEffects : undefined,
    onHitEffects: onHitEffects.length > 0 ? onHitEffects : undefined,
    chargeCostRatio,
    drainTargetCharge: drainTargetCharge || undefined,
    targetChargeDelta,
    skipHitCharge: skipHitCharge || undefined,
    flatHolyDamage,
    poisonPercent,
    poisonDuration,
    poisonRandomCount,
    healPercent,
    healTargets,
    selfChargeGain,
    teamChargeGain,
  };
}

const STAT_NAME_MAP: Record<string, AttributeKey> = {
  HP: 'hp',
  物理攻击: 'physAtk',
  物理防御: 'physDef',
  技能攻击: 'skillAtk',
  技能防御: 'skillDef',
  能量攻击: 'energyAtk',
  能量防御: 'energyDef',
  暴击伤害: 'critDamage',
  暴击: 'crit',
  免爆: 'antiCrit',
  拦截: 'intercept',
  格挡: 'intercept',
  破防: 'armorBreak',
  闪避: 'dodge',
  命中: 'hit',
  速度: 'speed',
  初始蓄能: 'initialCharge',
};

const PERCENT_POINT_STATS = new Set<AttributeKey>([
  'crit',
  'antiCrit',
  'critDamage',
  'dodge',
  'hit',
  'intercept',
  'armorBreak',
]);

function pushStatBuff(
  castEffects: CastEffectSpec[],
  target: CastEffectSpec['target'],
  statText: string,
  value: number,
  duration: number,
  skillName: string,
  warnings: string[],
  count?: number,
): void {
  const stat = STAT_NAME_MAP[statText];
  if (!stat) {
    warnings.push(`技能【${skillName}】无法识别属性【${statText}】。`);
    return;
  }

  const label = `${ATTRIBUTE_DEFS[stat].label} +${value}%`;
  const effect: EffectSpec = PERCENT_POINT_STATS.has(stat)
    ? { kind: 'statBuff', duration, stat, add: value, label }
    : { kind: 'statBuff', duration, stat, mul: 1 + value / 100, label };

  castEffects.push({
    target,
    ...(count !== undefined ? { count } : {}),
    effect,
  });
}

function pushStatBuffList(
  castEffects: CastEffectSpec[],
  target: CastEffectSpec['target'],
  statList: string,
  value: number,
  duration: number,
  skillName: string,
  warnings: string[],
  count?: number,
): void {
  const stats = statList
    .split(/和|、|\/|及/)
    .map((stat) => stat.trim())
    .filter(Boolean);
  for (const statText of stats) {
    pushStatBuff(
      castEffects,
      target,
      statText,
      value,
      duration,
      skillName,
      warnings,
      count,
    );
  }
}

function sameSkillMechanics(a: SkillDef, b: SkillDef): boolean {
  return (
    JSON.stringify({
      shape: a.shape,
      baseMultiplier: a.baseMultiplier,
      holy: !!a.holy,
      castEffects: a.castEffects ?? [],
      onHitEffects: a.onHitEffects ?? [],
      chargeCostRatio: a.chargeCostRatio ?? 1,
      drainTargetCharge: !!a.drainTargetCharge,
      targetChargeDelta: a.targetChargeDelta ?? 0,
      skipHitCharge: !!a.skipHitCharge,
      flatHolyDamage: a.flatHolyDamage ?? 0,
      poisonPercent: a.poisonPercent ?? 0,
      poisonDuration: a.poisonDuration ?? 0,
      poisonRandomCount: a.poisonRandomCount ?? 0,
      healPercent: a.healPercent ?? 0,
      healTargets: a.healTargets ?? [],
      selfChargeGain: a.selfChargeGain ?? 0,
      teamChargeGain: a.teamChargeGain ?? 0,
    }) ===
    JSON.stringify({
      shape: b.shape,
      baseMultiplier: b.baseMultiplier,
      holy: !!b.holy,
      castEffects: b.castEffects ?? [],
      onHitEffects: b.onHitEffects ?? [],
      chargeCostRatio: b.chargeCostRatio ?? 1,
      drainTargetCharge: !!b.drainTargetCharge,
      targetChargeDelta: b.targetChargeDelta ?? 0,
      skipHitCharge: !!b.skipHitCharge,
      flatHolyDamage: b.flatHolyDamage ?? 0,
      poisonPercent: b.poisonPercent ?? 0,
      poisonDuration: b.poisonDuration ?? 0,
      poisonRandomCount: b.poisonRandomCount ?? 0,
      healPercent: b.healPercent ?? 0,
      healTargets: b.healTargets ?? [],
      selfChargeGain: b.selfChargeGain ?? 0,
      teamChargeGain: b.teamChargeGain ?? 0,
    })
  );
}

function parseAmount(text: string): number {
  const normalized = text.trim().toLowerCase().replace(/,/g, '');
  const match = normalized.match(/^([\d.]+)(w|万)?$/);
  if (!match) return 0;
  const value = Number(match[1]);
  return match[2] ? value * 10000 : value;
}

function parseSmallNumber(text: string): number {
  if (/^\d+$/.test(text)) return Number(text);
  const numerals: Record<string, number> = {
    一: 1,
    二: 2,
    两: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
    十: 10,
  };
  return numerals[text] ?? 1;
}

function detectShape(text: string): SkillDef['shape'] {
  if (/十字/.test(text)) return 'cross';
  if (/横向|同列/.test(text)) return 'sameColumn';
  if (/纵向|同行/.test(text)) return 'sameRow';
  if (/单体/.test(text)) return 'single';
  if (/自身|全体/.test(text)) return 'self';
  return 'single';
}

function detectMultiplier(text: string): number {
  const damage = text.match(/(\d+(?:\.\d+)?)%\s*伤害/);
  if (damage) return Number(damage[1]) / 100;

  // 有些技能写成“十字，70%，增加……”，伤害百分比单独成段。
  const standalone = text.match(/(?:^|[，,])\s*(\d+(?:\.\d+)?)%\s*(?=[，,]|$)/);
  return standalone ? Number(standalone[1]) / 100 : 0;
}

function uniqueId(name: string, usedIds: Set<string>): string {
  if (!usedIds.has(name)) return name;
  let index = 2;
  while (usedIds.has(`${name}#${index}`)) index += 1;
  return `${name}#${index}`;
}

export const CODEX_RESULT: CodexResult = parseCodex(codexRaw);

if (CODEX_RESULT.warnings.length > 0) {
  console.warn('[codex]', ...CODEX_RESULT.warnings);
}
