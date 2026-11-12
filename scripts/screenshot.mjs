import { chromium } from 'playwright';

const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH;
const browser = await chromium.launch({
  headless: true,
  ...(executablePath ? { executablePath } : {}),
});
const page = await browser.newPage({
  viewport: { width: 1600, height: 1050 },
  deviceScaleFactor: 1,
});

await page.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle' });
await page.waitForTimeout(1800);
await page.screenshot({
  path: '/tmp/opencode/galaxy-prepare.png',
  fullPage: true,
});

const start = page.getByRole('button', { name: '开始战斗' });
await start.click();
await page.waitForTimeout(2200);
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(300);
await page.screenshot({
  path: '/tmp/opencode/galaxy-battle.png',
  fullPage: false,
});

// 暂停战斗，避免下一帧重绘清掉手动注入的效果。
const pause = page.getByRole('button', { name: '暂停' });
if (await pause.count()) await pause.click();
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(200);

// 手动给第一个我方单位叠加满蓄能、护盾、锁定视觉效果，检查 CSS。
await page.evaluate(() => {
  const wrappers = document.querySelectorAll('#player-board .unit-visual');
  const shieldWrapper = wrappers[0];
  const shieldCard = shieldWrapper?.querySelector('.unit-card');
  if (shieldWrapper && shieldCard) {
    shieldWrapper.classList.remove('active');
    shieldCard.classList.remove('active', 'charge-ready');
    shieldWrapper.insertAdjacentHTML(
      'beforeend',
      '<div class="shield-bubble"></div><div class="lock-ring"></div>',
    );
  }

  const freezeWrapper = wrappers[1];
  const freezeCard = freezeWrapper?.querySelector('.unit-card');
  if (freezeWrapper && freezeCard) {
    freezeWrapper.classList.remove('active');
    freezeCard.classList.remove('active', 'charge-ready');
    freezeWrapper.insertAdjacentHTML(
      'beforeend',
      '<div class="freeze-aura"></div>',
    );
  }

  const chargeWrapper = wrappers[2];
  const chargeCard = chargeWrapper?.querySelector('.unit-card');
  if (chargeWrapper && chargeCard) {
    chargeCard.classList.add('charge-ready');
    const token = chargeCard.querySelector('.unit-token');
    if (token && !token.querySelector('.charge-ring')) {
      token.insertAdjacentHTML(
        'afterbegin',
        '<span class="charge-ring"></span>',
      );
    }
  }
});
await page.waitForTimeout(600);
await page.screenshot({
  path: '/tmp/opencode/galaxy-effects.png',
  fullPage: false,
});

const rect = await page.evaluate(() => {
  const el = document.querySelector('#player-board .unit-visual');
  const r = el?.getBoundingClientRect();
  return r
    ? { x: r.x, y: r.y, width: r.width, height: r.height }
    : { x: 0, y: 0, width: 100, height: 100 };
});
await page.screenshot({
  path: '/tmp/opencode/galaxy-effect-zoom.png',
  clip: {
    x: Math.max(0, rect.x - 60),
    y: Math.max(0, rect.y - 60),
    width: rect.width + 120,
    height: rect.height + 120,
  },
});

await browser.close();
console.log('screenshots written');
