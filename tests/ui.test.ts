// @vitest-environment jsdom
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

describe('ui smoke', () => {
  beforeAll(async () => {
    document.body.innerHTML =
      '<div id="galaxy-bg"></div><div id="app"></div>';
    vi.useFakeTimers();
    await import('../src/main');
  });

  afterAll(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('渲染星空背景、双棋盘，并在普攻时生成弹道与命中数字', () => {
    expect(document.querySelectorAll('#galaxy-bg .star').length).toBeGreaterThan(
      100,
    );
    expect(document.querySelectorAll('#galaxy-bg .meteor')).toHaveLength(4);
    expect(document.querySelectorAll('.cell')).toHaveLength(18);
    expect(document.querySelector('#battle-fx-layer')).not.toBeNull();

    const start = Array.from(document.querySelectorAll('button')).find(
      (button) => button.textContent === '开始战斗',
    ) as HTMLButtonElement | undefined;

    expect(start).toBeDefined();
    expect(start?.disabled).toBe(false);
    start?.click();

    // 第一次行动
    vi.advanceTimersByTime(1000);
    expect(document.querySelectorAll('#log .log-line').length).toBeGreaterThan(0);
    expect(
      document.querySelectorAll(
        '#battle-fx-layer .projectile, #battle-fx-layer .beam, #battle-fx-layer .aura, #battle-fx-layer .stat-up',
      ).length,
    ).toBeGreaterThan(0);

    // 弹道命中后的伤害数字
    vi.advanceTimersByTime(600);
    expect(
      document.querySelectorAll('#battle-fx-layer .float-text').length,
    ).toBeGreaterThan(0);
  });
});
