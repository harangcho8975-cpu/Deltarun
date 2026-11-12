import { expect, test, type Page } from '@playwright/test';

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

const activeScenes = (page: Page) =>
  page.evaluate(() => window.__deltaRun!.game.scene.getScenes(true).map((s) => s.scene.key));

test('이미지 파일 없이 타이틀 → 스테이지 1 → 점프, 콘솔 에러 0건', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/');
  await expect.poll(() => activeScenes(page)).toContain('Title');
  await page.keyboard.press('1');
  await expect.poll(() => activeScenes(page)).toContain('Game');
  await expect.poll(() => page.evaluate(() => window.__deltaRun!.tick)).toBeGreaterThan(30);
  await page.keyboard.press('Space');
  await expect
    .poll(() => page.evaluate(() => (window.__deltaRun!.game.scene.getScene('Game') as unknown as { sim: { player: { state: string } } }).sim.player.state))
    .toMatch(/jump|fall/);
  await page.screenshot({ path: 'test-results/smoke-game.png' });
  expect(errors).toEqual([]);
});

test('스테이지를 끝까지 달리면 결과 화면이 뜬다', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/?debug=1&stage=stage_test&x=5500');
  await expect.poll(() => activeScenes(page), { timeout: 20_000 }).toContain('Result');
  expect(errors).toEqual([]);
});

// 휴대폰·PC가 같은 화면을 보는지: 캔버스 내부 해상도는 항상 1280×720이고,
// 화면에는 16:9 비율 그대로 맞춰 들어가며, 같은 틱의 렌더 결과가 같다.
const VIEWPORTS = [
  { name: 'iPhone 가로', width: 844, height: 390 },
  { name: 'Android 가로', width: 915, height: 412 },
  { name: '1920×1080', width: 1920, height: 1080 },
  { name: '2560×1080', width: 2560, height: 1080 },
];

test('네 가지 화면 크기에서 같은 장면', async ({ browser }) => {
  const shots: number[][] = [];
  for (const vp of VIEWPORTS) {
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
    await page.goto('/?stage=stage_01&freezeAt=90');
    await expect.poll(() => page.evaluate(() => window.__deltaRun!.frozen), { timeout: 30_000 }).toBe(true);
    await page.waitForTimeout(300);
    const info = await page.evaluate(() => {
      const c = document.querySelector('#game canvas') as HTMLCanvasElement;
      const r = c.getBoundingClientRect();
      // 렌더 결과를 64×36으로 줄여 비교 (화면 표시 크기와 무관한 내부 버퍼)
      const small = document.createElement('canvas');
      small.width = 64;
      small.height = 36;
      const ctx = small.getContext('2d')!;
      ctx.drawImage(c, 0, 0, 64, 36);
      return { w: c.width, h: c.height, rw: r.width, rh: r.height, px: Array.from(ctx.getImageData(0, 0, 64, 36).data) };
    });
    expect(info.w, vp.name).toBe(1280);
    expect(info.h, vp.name).toBe(720);
    expect(info.rw / info.rh, vp.name).toBeCloseTo(16 / 9, 1);
    // 한 변은 화면에 꽉 차고(레터박스는 다른 변에만), 넘치지 않는다
    expect(info.rw <= vp.width + 1 && info.rh <= vp.height + 1, vp.name).toBe(true);
    expect(Math.abs(info.rw - vp.width) < 2 || Math.abs(info.rh - vp.height) < 2, vp.name).toBe(true);
    await page.screenshot({ path: `test-results/scale-${vp.width}x${vp.height}.png` });
    shots.push(info.px);
    await page.close();
  }
  const diff = (a: number[], b: number[]) => a.reduce((s, v, i) => s + Math.abs(v - b[i]), 0) / a.length;
  for (let i = 1; i < shots.length; i++) expect(diff(shots[0], shots[i]), VIEWPORTS[i].name).toBeLessThan(2);
});
