import type { AttributeKey, Stats } from '../core/types';
import { MAX_TEAM_SIZE } from '../core/types';
import { ATTRIBUTE_DEFS, ATTRIBUTE_KEYS, formatAttribute } from '../core/attributes';
import type { Game } from '../game/Game';
import { loadLineupPresets } from '../game/lineups';
import type { Unit } from '../battle/Unit';
import type { SkillDef } from '../skills/Skill';
import { CHARACTERS, CHARACTER_MAP, isFlagship } from '../data/characters';
import { CRYSTALS, CRYSTAL_MAP } from '../data/crystals';
import { SKILLS } from '../skills/registry';
import { SHAPE_LABELS } from '../skills/shapes';
import { EFFECT_LABELS } from '../battle/effects/Effect';
import { formatCompact } from './format';

const RARITY_RANK: Record<string, number> = {
  B: 1,
  A: 2,
  S: 3,
  S1: 4,
  S2: 5,
  SS: 6,
};

export interface PrepareCallbacks {
  selectChar: (charId: string) => void;
  placeChar: (charId: string) => void;
  removeChar: (charId: string) => void;
  toggleCrystal: (charId: string, crystalId: string) => void;
  toggleEnemyCrystal: (charId: string, crystalId: string) => void;
  saveLineup: (name: string) => void;
  loadLineup: (id: string) => void;
  deleteLineup: (id: string) => void;
}

export function renderPreparePanel(
  container: HTMLElement,
  game: Game,
  callbacks: PrepareCallbacks,
): void {
  const previousRosterScroll =
    container.querySelector<HTMLElement>('.roster-list')?.scrollTop ?? 0;
  const previousCrystalScroll =
    container.querySelector<HTMLElement>('.crystal-grid')?.scrollTop ?? 0;

  container.innerHTML = '';

  const roster = document.createElement('div');
  roster.className = 'panel-section';
  roster.innerHTML = game.enemyEditMode
    ? '<h3>角色选择 <span class="hint">编辑敌方：点击角色后点击敌方格子</span></h3>'
    : '<h3>角色选择</h3>';

  const list = document.createElement('div');
  list.className = 'roster-list';

  // 已上阵角色置顶，方便直接下阵；其余按稀有度从高到低排列。
  const rosterCharacters = [...CHARACTERS].sort((a, b) => {
    const aPlaced = (
      game.enemyEditMode ? game.isEnemyPlaced(a.id) : game.isPlaced(a.id)
    )
      ? 1
      : 0;
    const bPlaced = (
      game.enemyEditMode ? game.isEnemyPlaced(b.id) : game.isPlaced(b.id)
    )
      ? 1
      : 0;
    if (aPlaced !== bPlaced) return bPlaced - aPlaced;
    return (RARITY_RANK[b.rarity] ?? 0) - (RARITY_RANK[a.rarity] ?? 0);
  });

  for (const template of rosterCharacters) {
    const placed = game.isPlaced(template.id);
    const flagship = isFlagship(template.id);
    const base = game.baseStats(template.id);
    const attack = template.destroyer
      ? `能量 ${base.energyAtk}`
      : `物攻 ${base.physAtk}`;
    const anotherFlagshipPlaced =
      flagship &&
      game.slots.some(
        (slot) => slot.charId !== template.id && isFlagship(slot.charId),
      );
    const disabled =
      !placed &&
      (!template.complete ||
        game.slots.length >= MAX_TEAM_SIZE ||
        anotherFlagshipPlaced);

    const selected = game.enemyEditMode
      ? game.selectedEnemyCharId === template.id
      : game.selectedCharId === template.id;
    const enemyPlaced = game.isEnemyPlaced(template.id);
    const card = document.createElement('div');
    card.className = [
      'roster-card',
      selected ? 'selected' : '',
      game.enemyEditMode && enemyPlaced ? 'enemy-placed' : '',
    ]
      .filter(Boolean)
      .join(' ');
    card.innerHTML = `
      <div class="roster-head">
        <span class="name">${template.name}</span>
        <span class="rarity ${template.rarity}">${template.rarity}</span>
      </div>
      <div class="roster-meta">${template.faction}${flagship ? ' · 👑 旗舰' : ''}${!template.complete ? ' · 数据待补' : ''}</div>
      <div class="roster-stats">${attack} · 速 ${base.speed}</div>
      <div class="roster-skill">${SKILLS[template.skillId]?.name ?? '—'}</div>
      ${
        game.enemyEditMode
          ? `<div class="roster-edit-hint ${enemyPlaced ? 'on' : ''}">${
              !template.complete
                ? '数据待补'
                : enemyPlaced
                  ? '已在敌方阵容'
                  : '点击选择'
            }</div>`
          : `<button class="mini ${placed ? 'danger' : ''}" ${disabled ? 'disabled' : ''}>
              ${placed ? '下阵' : template.complete ? '上阵' : '数据待补'}
            </button>`
      }
    `;
    card.addEventListener('click', () => callbacks.selectChar(template.id));

    const button = card.querySelector('button');
    button?.addEventListener('click', (event) => {
      event.stopPropagation();
      if (placed) callbacks.removeChar(template.id);
      else callbacks.placeChar(template.id);
    });

    list.appendChild(card);
  }

  roster.appendChild(list);
  container.appendChild(roster);

  if (game.enemyEditMode) {
    renderEnemyEditPanel(container, game, callbacks);
    renderLineupPresets(container, callbacks);
    restorePanelScroll(container, previousRosterScroll, previousCrystalScroll);
    return;
  }

  const charId = game.selectedCharId;
  const detail = document.createElement('div');
  detail.className = 'panel-section char-detail';

  if (!charId) {
    detail.innerHTML =
      '<h3>角色详情</h3><p class="hint">点击角色查看详情。</p>';
  } else {
    const template = CHARACTER_MAP[charId];
    const slot = game.selectedSlot;
    const stats = game.previewStats(charId);
    const skill = SKILLS[template.skillId];

    detail.innerHTML = `
      <h3>${template.name}
        <span class="tag">${template.faction}</span>
        <span class="rarity ${template.rarity}">${template.rarity}</span>
        ${isFlagship(template.id) ? '<span class="tag flagship-tag">👑 旗舰</span>' : ''}
        <span class="status ${slot ? 'on' : ''}">${slot ? '已上阵' : '未上阵'}</span>
      </h3>
      ${
        !template.complete
          ? '<div class="hint warn">该角色属性尚未填写，暂不能上阵。补充 codex.txt 后会自动刷新。</div>'
          : slot
            ? `<div class="hint">位置 (${slot.coord.x}, ${slot.coord.y}) · 点击棋盘空位可移动</div>`
            : '<div class="hint">选中后点击我方棋盘空位放置。</div>'
      }
      ${statGrid(stats, !!template.destroyer)}
      ${skillBlock(skill)}
      ${template.passive?.description ? `<div class="passive-block">被动：${template.passive.description}</div>` : ''}
      ${slot ? crystalSlots(template.crystalSlots, slot.crystalIds) : ''}
    `;

    detail
      .querySelectorAll<HTMLButtonElement>('[data-remove-crystal]')
      .forEach((button) => {
        button.addEventListener('click', () => {
          const crystalId = button.dataset.removeCrystal;
          if (crystalId) callbacks.toggleCrystal(charId, crystalId);
        });
      });
  }

  container.appendChild(detail);

  const slot = game.selectedSlot;
  container.appendChild(
    crystalInventorySection(game, charId, slot, false, callbacks),
  );
  renderLineupPresets(container, callbacks);
  restorePanelScroll(container, previousRosterScroll, previousCrystalScroll);
}

function restorePanelScroll(
  container: HTMLElement,
  rosterTop: number,
  crystalTop: number,
): void {
  const roster = container.querySelector<HTMLElement>('.roster-list');
  if (roster) roster.scrollTop = rosterTop;
  const crystals = container.querySelector<HTMLElement>('.crystal-grid');
  if (crystals) crystals.scrollTop = crystalTop;
}

function renderEnemyEditPanel(
  container: HTMLElement,
  game: Game,
  callbacks: PrepareCallbacks,
): void {
  const charId = game.selectedEnemyCharId;
  const slot = charId
    ? game.enemySlots.find((current) => current.charId === charId)
    : undefined;

  const detail = document.createElement('div');
  detail.className = 'panel-section char-detail';

  if (!charId || !slot) {
    detail.innerHTML =
      '<h3>敌方角色</h3><p class="hint">点击敌方角色查看属性并编辑氪晶。</p>';
    container.appendChild(detail);
    container.appendChild(
      crystalInventorySection(game, null, undefined, true, callbacks),
    );
    return;
  }

  const template = CHARACTER_MAP[charId];
  const stats = game.previewStats(charId, slot.crystalIds);
  const skill = SKILLS[template.skillId];

  detail.innerHTML = `
    <h3>${template.name}
      <span class="tag">敌方</span>
      <span class="rarity ${template.rarity}">${template.rarity}</span>
      <span class="status on">位置 (${slot.coord.x}, ${slot.coord.y})</span>
    </h3>
    <div class="hint">点击下方氪晶装备/卸下；敌方氪晶与玩家独立。</div>
    ${statGrid(stats, !!template.destroyer)}
    ${skillBlock(skill)}
    ${template.passive?.description ? `<div class="passive-block">被动：${template.passive.description}</div>` : ''}
    ${crystalSlots(template.crystalSlots, slot.crystalIds)}
  `;

  detail
    .querySelectorAll<HTMLButtonElement>('[data-remove-crystal]')
    .forEach((button) => {
      button.addEventListener('click', () => {
        const crystalId = button.dataset.removeCrystal;
        if (crystalId) callbacks.toggleEnemyCrystal(charId, crystalId);
      });
    });

  container.appendChild(detail);
  container.appendChild(
    crystalInventorySection(game, charId, slot, true, callbacks),
  );
}

function crystalInventorySection(
  game: Game,
  charId: string | null,
  slot: { charId: string; crystalIds: string[] } | undefined,
  enemy: boolean,
  callbacks: PrepareCallbacks,
): HTMLElement {
  const inventory = document.createElement('div');
  inventory.className = 'panel-section';
  inventory.innerHTML = enemy
    ? '<h3>敌方氪晶库存 <span class="hint">敌方独立 · 不可重复</span></h3>'
    : '<h3>氪晶库存 <span class="hint">共享 · 不可重复</span></h3>';

  if (!charId || !slot) {
    inventory.innerHTML += enemy
      ? '<p class="hint">点击敌方角色后为其分配氪晶。</p>'
      : '<p class="hint">先让角色上阵，再为其分配氪晶。</p>';
    return inventory;
  }

  const template = CHARACTER_MAP[charId];
  const grid = document.createElement('div');
  grid.className = 'crystal-grid';
  const usedBy = (crystalId: string): string | null =>
    enemy ? game.enemyCrystalUsedBy(crystalId) : game.crystalUsedBy(crystalId);

  for (const crystal of CRYSTALS) {
    const owner = usedBy(crystal.id);
    const equipped = slot.crystalIds.includes(crystal.id);
    const full = slot.crystalIds.length >= template.crystalSlots;
    const disabled = (owner !== null && !equipped) || (!equipped && full);
    const ownerName = owner
      ? CHARACTER_MAP[owner]?.name ?? owner
      : '';
    const status = equipped
      ? '已装备'
      : owner
        ? `由${ownerName}装备`
        : full
          ? '槽位已满'
          : '点击装备';

    const card = document.createElement('div');
    card.className = `crystal-card${equipped ? ' equipped' : ''}${disabled ? ' used' : ''}`;
    card.style.borderColor = equipped ? crystal.color : '';
    card.innerHTML = `
      <div class="crystal-name">
        <span>${crystal.name}</span>
        <span class="crystal-rarity">${crystal.rarity} · Lv.${crystal.level}</span>
      </div>
      <div class="crystal-mods">${crystal.description}</div>
      <div class="crystal-status">${status}</div>
    `;
    if (!disabled) {
      card.addEventListener('click', () => {
        if (enemy) callbacks.toggleEnemyCrystal(charId, crystal.id);
        else callbacks.toggleCrystal(charId, crystal.id);
      });
    }
    grid.appendChild(card);
  }

  inventory.appendChild(grid);
  return inventory;
}

function renderLineupPresets(
  container: HTMLElement,
  callbacks: PrepareCallbacks,
): void {
  const presets = loadLineupPresets();
  const section = document.createElement('div');
  section.className = 'panel-section';

  const title = document.createElement('h3');
  title.innerHTML = '阵容存档 <span class="hint">含双方阵容与氪晶</span>';
  section.appendChild(title);

  const saveRow = document.createElement('div');
  saveRow.className = 'lineup-save';
  const input = document.createElement('input');
  input.type = 'text';
  input.maxLength = 20;
  input.placeholder = `阵容 ${presets.length + 1}`;
  const save = document.createElement('button');
  save.type = 'button';
  save.className = 'mini';
  save.textContent = '保存当前阵容';
  save.addEventListener('click', () => callbacks.saveLineup(input.value));
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') callbacks.saveLineup(input.value);
  });
  saveRow.append(input, save);
  section.appendChild(saveRow);

  if (presets.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'hint';
    empty.textContent = '还没有存档。保存后会出现在这里，可快速读取。';
    section.appendChild(empty);
  }

  for (const preset of presets) {
    const row = document.createElement('div');
    row.className = 'lineup-item';

    const info = document.createElement('div');
    const name = document.createElement('div');
    name.className = 'lineup-name';
    name.textContent = preset.name;
    const meta = document.createElement('div');
    meta.className = 'lineup-meta';
    meta.textContent = `我 ${preset.player.length} · 敌 ${preset.enemy.length} · ${new Date(preset.savedAt).toLocaleString()}`;
    info.append(name, meta);

    const actions = document.createElement('div');
    actions.className = 'lineup-actions';
    const load = document.createElement('button');
    load.type = 'button';
    load.className = 'mini';
    load.textContent = '读取';
    load.addEventListener('click', () => callbacks.loadLineup(preset.id));
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'mini danger';
    remove.textContent = '删除';
    remove.addEventListener('click', () => callbacks.deleteLineup(preset.id));
    actions.append(load, remove);

    row.append(info, actions);
    section.appendChild(row);
  }

  container.appendChild(section);
}

export function renderBattlePanel(container: HTMLElement, game: Game): void {
  container.innerHTML = '';
  const battle = game.battle;
  if (!battle) return;

  const playerAlive = battle.board.aliveUnits('player').length;
  const enemyAlive = battle.board.aliveUnits('enemy').length;

  const info = document.createElement('div');
  info.className = 'panel-section';
  const nextUnits = battle.queue
    .filter((unit) => unit.alive)
    .slice(0, 8)
    .map((unit) => `${unit.side === 'player' ? '我' : '敌'}·${unit.name}`)
    .join(' → ');
  const current = battle.currentUnit?.alive
    ? `${battle.currentUnit.side === 'player' ? '我方' : '敌方'}·${battle.currentUnit.name}`
    : '—';

  info.innerHTML = `
    <h3>战斗信息</h3>
    <div class="stat-grid">
      <div class="stat-row"><span>回合</span><b>${battle.round}</b></div>
      <div class="stat-row"><span>先手</span><b>${battle.firstSide === 'player' ? '我方' : '敌方'}</b></div>
      <div class="stat-row"><span>总速度</span><b>我方 ${battle.speedTotals.player} / 敌方 ${battle.speedTotals.enemy}</b></div>
      <div class="stat-row"><span>存活</span><b>我方 ${playerAlive} / 敌方 ${enemyAlive}</b></div>
    </div>
    <div class="queue-line">当前：${current}</div>
    <div class="queue-line">接下来：${nextUnits || '本回合结束'}</div>
    ${battle.finished ? `<div class="result-line">${battle.winner === 'player' ? '我方胜利' : '敌方胜利'}</div>` : ''}
  `;
  container.appendChild(info);

  const selected = game.getSelectedBattleUnit();
  const detail = document.createElement('div');
  detail.className = 'panel-section char-detail';

  if (selected) {
    detail.innerHTML = `
      <h3>${selected.name}
        <span class="tag">${selected.faction ?? selected.role}</span>
        ${selected.rarity ? `<span class="rarity ${selected.rarity}">${selected.rarity}</span>` : ''}
      </h3>
      <div class="hint">
        HP ${formatCompact(selected.hp)} / ${formatCompact(selected.maxHp)} · 蓄能 ${selected.charge} / 300 ·
        位置 (${selected.coord.x}, ${selected.coord.y})
      </div>
      ${statGrid(selected.getStats(), selected.destroyer)}
      ${skillBlock(selected.skill, selected.charge)}
      ${selected.passiveDescription ? `<div class="passive-block">被动：${selected.passiveDescription}</div>` : ''}
      ${effectsBlock(selected)}
    `;
  } else if (game.selectedBattleUnitId) {
    detail.innerHTML =
      '<h3>角色详情</h3><p class="hint">该角色已经阵亡。</p>';
  } else {
    detail.innerHTML =
      '<h3>角色详情</h3><p class="hint">点击棋盘上的角色查看属性、技能与效果。</p>';
  }

  container.appendChild(detail);

  const legend = document.createElement('div');
  legend.className = 'panel-section';
  legend.innerHTML = `
    <h3>机制速览</h3>
    <ul class="legend">
      <li>靶点：同行最前 → 上一行 → 下一行 → 上两行 → 下两行。</li>
      <li>蓄能：普攻命中 +25，挨打 +25；技能释放清空蓄能，本次不额外增加，上限 300。</li>
      <li>技能最终倍率 = 描述倍率 × 蓄能 / 100。</li>
      <li>护盾先吸收伤害；锁定跳过行动；禁技时只能普攻。</li>
      <li>所有持续效果按受影响单位自身的行动次数计算。</li>
    </ul>
  `;
  container.appendChild(legend);
}

function statGrid(stats: Stats, destroyer: boolean): string {
  // 直接遍历属性注册表：新增属性会自动出现在面板里。
  const preferred: AttributeKey[] = [
    'hp',
    'speed',
    'initialCharge',
    'physAtk',
    'energyAtk',
    'skillAtk',
    'physDef',
    'skillDef',
    'energyDef',
    'hit',
    'dodge',
    'crit',
    'antiCrit',
    'critDamage',
    'intercept',
    'armorBreak',
  ];
  const keys = [
    ...preferred,
    ...ATTRIBUTE_KEYS.filter((key) => !preferred.includes(key)),
  ].filter((key) => {
    if (key === 'physAtk') return !destroyer;
    if (key === 'energyAtk') return destroyer;
    return true;
  });

  return `<div class="stat-grid">${keys
    .map((key) => {
      const value =
        key === 'hp'
          ? formatCompact(stats[key])
          : formatAttribute(key, stats[key]);
      return `<div class="stat-row"><span>${ATTRIBUTE_DEFS[key].label}</span><b>${value}</b></div>`;
    })
    .join('')}</div>`;
}

function skillBlock(skill: SkillDef, charge?: number): string {
  const base = Math.round(skill.baseMultiplier * 100);
  const isDamage = skill.baseMultiplier > 0;
  const costText =
    skill.chargeCostRatio !== undefined && skill.chargeCostRatio < 1
      ? ` · 消耗 ${Math.round(skill.chargeCostRatio * 100)}% 蓄能`
      : '';
  const drainText = skill.drainTargetCharge
    ? ' · 清空目标蓄能'
    : skill.targetChargeDelta !== undefined
      ? ` · 目标蓄能 ${skill.targetChargeDelta}`
      : '';
  const hitChargeText = skill.skipHitCharge ? ' · 阻止挨打蓄能' : '';
  const flatHolyText = skill.flatHolyDamage
    ? ` · 额外神圣 ${formatCompact(skill.flatHolyDamage)}`
    : '';
  const poisonText = skill.poisonPercent
    ? ` · ${
        skill.poisonRandomCount
          ? `随机 ${skill.poisonRandomCount} 名敌人中毒`
          : '中毒'
      } ${skill.poisonPercent}% 技能伤害 / ${skill.poisonDuration ?? 2} 次行动`
    : '';
  const healText = skill.healPercent
    ? ` · 治疗 ${skill.healPercent}%（攻击 + 技能攻击）`
    : '';
  const selfChargeText = skill.selfChargeGain
    ? ` · 自身蓄能 +${skill.selfChargeGain}`
    : '';
  const teamChargeText = skill.teamChargeGain
    ? ` · 全体蓄能 +${skill.teamChargeGain}`
    : '';
  const meta = isDamage
    ? `描述倍率 ${base}%`
    : '非伤害';
  const final =
    charge !== undefined
      ? isDamage
        ? `<div class="skill-final">当前蓄能 ${charge} → 最终倍率 ${(
            skill.baseMultiplier *
            (charge / 100)
          ).toFixed(2)}×（${Math.round(skill.baseMultiplier * charge)}%）</div>`
        : `<div class="skill-final">当前蓄能 ${charge} · 释放时施加效果</div>`
      : '';

  return `
    <div class="skill-block">
      <div class="skill-name">${skill.name}</div>
      <div class="skill-meta">
        ${SHAPE_LABELS[skill.shape]} · ${meta}${skill.holy ? ' · 神圣' : ''}${costText}${drainText}${hitChargeText}${flatHolyText}${poisonText}${healText}${selfChargeText}${teamChargeText}
      </div>
      <div class="skill-desc">${skill.description}</div>
      ${final}
    </div>
  `;
}

function crystalSlots(slots: number, crystalIds: string[]): string {
  let html = `<div class="equipped-title">氪晶槽位 ${crystalIds.length}/${slots}</div><div class="equipped-list">`;

  for (let index = 0; index < slots; index += 1) {
    const id = crystalIds[index];
    if (!id) {
      html += '<span class="chip empty">空槽</span>';
      continue;
    }
    const crystal = CRYSTAL_MAP[id];
    html += `<span class="chip" style="border-color:${crystal?.color ?? '#334155'}">
      ${crystal?.name ?? id}
      <button data-remove-crystal="${id}" title="卸下">×</button>
    </span>`;
  }

  html += '</div>';
  return html;
}

function effectsBlock(unit: Unit): string {
  if (unit.effects.length === 0) {
    return '<div class="hint">当前没有持续效果。</div>';
  }

  return `<div class="equipped-title">当前效果</div><div class="equipped-list">${unit.effects
    .map((effect) => {
      const amount =
        effect.kind === 'shield' && effect.absorb !== undefined
          ? ` ${formatCompact(effect.absorb)}`
          : '';
      const label = effect.description ?? EFFECT_LABELS[effect.kind];
      return `<span class="chip effect-${effect.kind}">${label}${amount} · ${effect.remainingActions} 次行动</span>`;
    })
    .join('')}</div>`;
}
