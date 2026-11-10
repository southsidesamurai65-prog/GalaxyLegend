import type { AttributeKey, Stats } from '../core/types';
import { MAX_TEAM_SIZE } from '../core/types';
import { ATTRIBUTE_DEFS, ATTRIBUTE_KEYS, formatAttribute } from '../core/attributes';
import type { Game } from '../game/Game';
import type { Unit } from '../battle/Unit';
import type { SkillDef } from '../skills/Skill';
import { CHARACTERS, CHARACTER_MAP } from '../data/characters';
import { CRYSTALS, CRYSTAL_MAP } from '../data/crystals';
import { SKILLS } from '../skills/registry';
import { SHAPE_LABELS } from '../skills/shapes';
import { EFFECT_LABELS } from '../battle/effects/Effect';

export interface PrepareCallbacks {
  selectChar: (charId: string) => void;
  placeChar: (charId: string) => void;
  removeChar: (charId: string) => void;
  toggleCrystal: (charId: string, crystalId: string) => void;
}

export function renderPreparePanel(
  container: HTMLElement,
  game: Game,
  callbacks: PrepareCallbacks,
): void {
  container.innerHTML = '';

  const roster = document.createElement('div');
  roster.className = 'panel-section';
  roster.innerHTML = '<h3>角色选择</h3>';

  const list = document.createElement('div');
  list.className = 'roster-list';

  for (const template of CHARACTERS) {
    const placed = game.isPlaced(template.id);
    const base = game.baseStats(template.id);
    const attack = template.destroyer
      ? `能量 ${base.energyAtk}`
      : `物攻 ${base.physAtk}`;
    const disabled = !placed && game.slots.length >= MAX_TEAM_SIZE;

    const card = document.createElement('div');
    card.className = `roster-card${game.selectedCharId === template.id ? ' selected' : ''}`;
    card.innerHTML = `
      <div class="roster-head">
        <span class="name">${template.name}</span>
        <span class="role">${template.role}</span>
      </div>
      <div class="roster-stats">${attack} · 速 ${base.speed}</div>
      <div class="roster-skill">${SKILLS[template.skillId]?.name ?? '—'}</div>
      <button class="mini ${placed ? 'danger' : ''}" ${disabled ? 'disabled' : ''}>
        ${placed ? '下阵' : '上阵'}
      </button>
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

  const charId = game.selectedCharId;
  const detail = document.createElement('div');
  detail.className = 'panel-section';

  if (!charId) {
    detail.innerHTML =
      '<h3>角色详情</h3><p class="hint">点击角色查看详情。</p>';
  } else {
    const template = CHARACTER_MAP[charId];
    const slot = game.selectedSlot;
    const stats = game.previewStats(charId);
    const skill = SKILLS[template.skillId];

    detail.innerHTML = `
      <h3>${template.name} <span class="tag">${template.role}</span>
        <span class="status ${slot ? 'on' : ''}">${slot ? '已上阵' : '未上阵'}</span>
      </h3>
      ${
        slot
          ? `<div class="hint">位置 (${slot.coord.x}, ${slot.coord.y}) · 点击棋盘空位可移动</div>`
          : '<div class="hint">选中后点击我方棋盘空位放置。</div>'
      }
      ${statGrid(stats, !!template.destroyer)}
      ${skillBlock(skill)}
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

  const inventory = document.createElement('div');
  inventory.className = 'panel-section';
  inventory.innerHTML =
    '<h3>氪晶库存 <span class="hint">共享 · 不可重复</span></h3>';

  const slot = game.selectedSlot;
  if (!charId || !slot) {
    inventory.innerHTML +=
      '<p class="hint">先让角色上阵，再为其分配氪晶。</p>';
  } else {
    const template = CHARACTER_MAP[charId];
    const grid = document.createElement('div');
    grid.className = 'crystal-grid';

    for (const crystal of CRYSTALS) {
      const usedBy = game.crystalUsedBy(crystal.id);
      const equipped = slot.crystalIds.includes(crystal.id);
      const full = slot.crystalIds.length >= template.crystalSlots;
      const disabled = (usedBy !== null && !equipped) || (!equipped && full);
      const status = equipped
        ? '已装备'
        : usedBy
          ? `由${CHARACTER_MAP[usedBy]?.name ?? usedBy}装备`
          : full
            ? '槽位已满'
            : '点击装备';

      const card = document.createElement('div');
      card.className = `crystal-card${equipped ? ' equipped' : ''}${disabled ? ' used' : ''}`;
      card.style.borderColor = equipped ? crystal.color : '';
      card.innerHTML = `
        <div class="crystal-name">${crystal.name}</div>
        <div class="crystal-mods">${crystal.description}</div>
        <div class="crystal-status">${status}</div>
      `;
      if (!disabled) {
        card.addEventListener('click', () =>
          callbacks.toggleCrystal(charId, crystal.id),
        );
      }
      grid.appendChild(card);
    }

    inventory.appendChild(grid);
  }

  container.appendChild(inventory);
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
  detail.className = 'panel-section';

  if (selected) {
    detail.innerHTML = `
      <h3>${selected.name} <span class="tag">${selected.role}</span></h3>
      <div class="hint">
        HP ${Math.ceil(selected.hp)} / ${selected.maxHp} · 蓄能 ${selected.charge} / 300 ·
        位置 (${selected.coord.x}, ${selected.coord.y})
      </div>
      ${statGrid(selected.stats, selected.destroyer)}
      ${skillBlock(selected.skill, selected.charge)}
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
      <li>蓄能：普攻/技能命中 +25，挨打 +25，上限 300。</li>
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
    'hit',
    'dodge',
    'crit',
    'antiCrit',
    'critDamage',
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
    .map(
      (key) =>
        `<div class="stat-row"><span>${ATTRIBUTE_DEFS[key].label}</span><b>${formatAttribute(key, stats[key])}</b></div>`,
    )
    .join('')}</div>`;
}

function skillBlock(skill: SkillDef, charge?: number): string {
  const base = Math.round(skill.baseMultiplier * 100);
  const final =
    charge !== undefined
      ? `<div class="skill-final">当前蓄能 ${charge} → 最终倍率 ${(
          skill.baseMultiplier *
          (charge / 100)
        ).toFixed(2)}×（${Math.round(skill.baseMultiplier * charge)}%）</div>`
      : '';

  return `
    <div class="skill-block">
      <div class="skill-name">${skill.name}</div>
      <div class="skill-meta">
        ${SHAPE_LABELS[skill.shape]} · 描述倍率 ${base}%${skill.holy ? ' · 神圣' : ''}
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
          ? ` ${effect.absorb}`
          : '';
      return `<span class="chip effect-${effect.kind}">${EFFECT_LABELS[effect.kind]}${amount} · ${effect.remainingActions} 次行动</span>`;
    })
    .join('')}</div>`;
}
