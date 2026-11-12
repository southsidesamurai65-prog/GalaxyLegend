import type { BattleEvent } from '../core/events';
import type { Side } from '../core/types';
import { EFFECT_LABELS } from '../battle/effects/Effect';
import { formatCompact } from './format';

interface LogEntry {
  html: string;
  className: string;
}

export class LogView {
  private readonly element: HTMLElement;
  private readonly maxLines = 260;

  constructor(element: HTMLElement) {
    this.element = element;
  }

  clear(): void {
    this.element.innerHTML = '';
  }

  add(html: string, className = ''): void {
    const line = document.createElement('div');
    line.className = `log-line ${className}`.trim();
    line.innerHTML = html;
    this.element.appendChild(line);

    while (this.element.childElementCount > this.maxLines) {
      this.element.firstElementChild?.remove();
    }
    this.element.scrollTop = this.element.scrollHeight;
  }

  handle(event: BattleEvent): void {
    const entry = formatEvent(event);
    if (entry) this.add(entry.html, entry.className);
  }
}

export function formatEvent(event: BattleEvent): LogEntry | null {
  switch (event.type) {
    case 'roundStart':
      return {
        html: `—— 第 ${event.round} 回合 ——`,
        className: 'round',
      };
    case 'roundEnd':
      return null;
    case 'actionStart':
      return {
        html: `▶ ${unitLabel(event.side, event.unitName)} 行动`,
        className: 'action',
      };
    case 'actionSkip':
      return {
        html: `🔒 ${unitLabel(event.side, event.unitName)} 被${event.reason === 'freeze' ? '冰冻' : '锁定'}，跳过行动`,
        className: 'lock',
      };
    case 'normalAttack':
      return {
        html: `${unitLabel(event.attackerSide, event.attackerName)} 普攻 → ${unitLabel(event.targetSide, event.targetName)}`,
        className: 'attack',
      };
    case 'skillCast': {
      const costText =
        event.chargeAfter > 0 ? `（消耗后 ${event.chargeAfter}）` : '';
      const damageText =
        event.multiplier > 0 ? ` → ${event.multiplier.toFixed(2)}×` : '';
      return {
        html: `✦ ${unitLabel(event.casterSide, event.casterName)} 释放【${event.skillName}】 蓄能 ${event.charge}${costText}${damageText}`,
        className: 'skill',
      };
    }
    case 'miss':
      return {
        html: `${unitLabel(event.targetSide, event.targetName)} 闪避了${event.skill ? `【${event.skill}】` : '攻击'}`,
        className: 'miss',
      };
    case 'intercept': {
      const counterText = event.counter ? '，并反击' : '';
      return {
        html: `🛡 ${unitLabel(event.side, event.unitName)} 拦截了 ${unitLabel(event.attackerSide, event.attackerName)} 的攻击${counterText}（${formatCompact(event.originalDamage)} → ${formatCompact(event.reducedDamage)}）`,
        className: 'intercept',
      };
    }
    case 'damage': {
      const tags: string[] = [];
      if (event.crit) tags.push('暴击');
      if (event.holy) tags.push('神圣');
      const tagText = tags.length > 0 ? `（${tags.join('·')}）` : '';
      const shieldText =
        event.shieldAbsorbed > 0
          ? `（护盾吸收 ${formatCompact(event.shieldAbsorbed)}${event.hpDamage > 0 ? `，HP -${formatCompact(event.hpDamage)}` : ''}）`
          : '';
      const bonusText =
        event.bonusDamage && event.bonusDamage > 0
          ? `（额外神圣 ${formatCompact(event.bonusDamage)}）`
          : '';
      return {
        html: `${unitLabel(event.targetSide, event.targetName)} 受到 ${formatCompact(event.amount)} 伤害${tagText}${bonusText}${shieldText}`,
        className: event.crit ? 'crit' : event.holy ? 'holy' : 'damage',
      };
    }
    case 'charge': {
      const sign = event.amount >= 0 ? '+' : '';
      return {
        html: `${unitLabel(event.side, event.unitName)} 蓄能 ${sign}${event.amount} → ${event.total}`,
        className: event.amount < 0 ? 'charge-drain' : 'charge',
      };
    }
    case 'chargeDrained':
      return {
        html: `${unitLabel(event.side, event.unitName)} 蓄能被清空（-${event.amount}）`,
        className: 'charge-drain',
      };
    case 'poison':
      return {
        html: `${unitLabel(event.side, event.unitName)} 受到 ${formatCompact(event.amount)} 中毒伤害`,
        className: 'poison',
      };
    case 'heal':
      return {
        html: `✚ ${unitLabel(event.targetSide, event.targetName)} 回复 ${formatCompact(event.amount)} HP`,
        className: 'heal',
      };
    case 'effectApplied': {
      const amount =
        event.effect === 'shield' && event.amount !== undefined
          ? ` ${formatCompact(event.amount)}`
          : '';
      const label = event.description ?? EFFECT_LABELS[event.effect];
      return {
        html: `${unitLabel(event.side, event.unitName)} 获得${label}${amount}（${event.duration} 次行动）`,
        className: `effect effect-${event.effect}`,
      };
    }
    case 'effectResisted':
      return {
        html: `${unitLabel(event.side, event.unitName)} 的${event.description ?? EFFECT_LABELS[event.effect]}未触发`,
        className: 'miss',
      };
    case 'effectExpired':
      return {
        html: `${unitLabel(event.side, event.unitName)} 的${event.description ?? EFFECT_LABELS[event.effect]}消失`,
        className: 'expire',
      };
    case 'death':
      return {
        html: `💀 ${unitLabel(event.side, event.unitName)} 阵亡`,
        className: 'death',
      };
    case 'battleEnd':
      return {
        html: `🏆 ${sideName(event.winner)}胜利`,
        className: 'end',
      };
  }
}

function sideName(side: Side): string {
  return side === 'player' ? '我方' : '敌方';
}

function unitLabel(side: Side, name: string): string {
  return `${sideName(side)}·${name}`;
}
