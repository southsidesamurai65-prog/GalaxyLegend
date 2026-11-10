import type { BattleEvent } from '../core/events';
import type { Side } from '../core/types';
import { EFFECT_LABELS } from '../battle/effects/Effect';

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
        html: `🔒 ${unitLabel(event.side, event.unitName)} 被锁定，跳过行动`,
        className: 'lock',
      };
    case 'normalAttack':
      return {
        html: `${unitLabel(event.attackerSide, event.attackerName)} 普攻 → ${unitLabel(event.targetSide, event.targetName)}`,
        className: 'attack',
      };
    case 'skillCast':
      return {
        html: `✦ ${unitLabel(event.casterSide, event.casterName)} 释放【${event.skillName}】 蓄能 ${event.charge} → ${event.multiplier.toFixed(2)}×`,
        className: 'skill',
      };
    case 'miss':
      return {
        html: `${unitLabel(event.targetSide, event.targetName)} 闪避了${event.skill ? `【${event.skill}】` : '攻击'}`,
        className: 'miss',
      };
    case 'damage': {
      const tags: string[] = [];
      if (event.crit) tags.push('暴击');
      if (event.holy) tags.push('神圣');
      const tagText = tags.length > 0 ? `（${tags.join('·')}）` : '';
      const shieldText =
        event.shieldAbsorbed > 0
          ? `（护盾吸收 ${event.shieldAbsorbed}${event.hpDamage > 0 ? `，HP -${event.hpDamage}` : ''}）`
          : '';
      return {
        html: `${unitLabel(event.targetSide, event.targetName)} 受到 ${event.amount} 伤害${tagText}${shieldText}`,
        className: event.crit ? 'crit' : event.holy ? 'holy' : 'damage',
      };
    }
    case 'charge':
      return {
        html: `${unitLabel(event.side, event.unitName)} 蓄能 +${event.amount} → ${event.total}`,
        className: 'charge',
      };
    case 'effectApplied': {
      const amount =
        event.effect === 'shield' && event.amount !== undefined
          ? ` ${event.amount}`
          : '';
      return {
        html: `${unitLabel(event.side, event.unitName)} 获得${EFFECT_LABELS[event.effect]}${amount}（${event.duration} 次行动）`,
        className: `effect effect-${event.effect}`,
      };
    }
    case 'effectExpired':
      return {
        html: `${unitLabel(event.side, event.unitName)} 的${EFFECT_LABELS[event.effect]}消失`,
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
