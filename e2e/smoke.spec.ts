import { expect, test, type Page } from '@playwright/test';

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

const activeScenes = (page: Page) =>
  page.evaluate(() => window.__deltaRun!.game.scene.getScenes(true).map((s) => s.scene.key));

test('이미지 파일 없이 로비 → 스테이지 1 → 점프, 콘솔 에러 0건', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/');
  await expect.poll(() => activeScenes(page)).toContain('Lobby');
  await page.keyboard.press('Enter'); // 플레이 → 스테이지 카드
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

test('로비: 캐릭터가 가운데, 플레이를 누르면 세로 카드가 가로로 늘어선다', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/');
  await expect.poll(() => activeScenes(page)).toContain('Lobby');
  const lobby = () =>
    page.evaluate(() => {
      const s = window.__deltaRun!.game.scene.getScene('Lobby') as unknown as {
        hero: { x: number; texture: { key: string } };
        homeUI: { visible: boolean };
        stageUI: { visible: boolean };
        strip: { list: { x: number; y: number; list: { width?: number; height?: number; type: string }[] }[] };
      };
      const cards = s.strip.list.map((c) => ({ x: c.x, y: c.y }));
      return { heroX: s.hero.x, heroKey: s.hero.texture.key, home: s.homeUI.visible, stages: s.stageUI.visible, cards };
    });

  let st = await lobby();
  expect(st.heroX).toBe(640);
  expect(st.heroKey).toBe('char_orange');
  expect(st.home).toBe(true);
  expect(st.stages).toBe(false);

  // 로비에서는 캐릭터를 바꾸지 않는다 (변경은 캐릭터 목록·정보 화면에서)
  await page.waitForTimeout(200);
  expect((await lobby()).heroKey).toBe('char_orange');

  // [플레이](오른쪽 아래)를 누르면 카드가 나타난다
  await page.mouse.click(1090, 640);
  await expect.poll(async () => (await lobby()).stages).toBe(true);
  st = await lobby();
  expect(st.home).toBe(false);
  expect(st.cards).toHaveLength(3);
  // 가로로 배열: y는 모두 같고 x는 증가
  expect(new Set(st.cards.map((c) => c.y)).size).toBe(1);
  expect(st.cards[0].x).toBeLessThan(st.cards[1].x);
  expect(st.cards[1].x).toBeLessThan(st.cards[2].x);
  await page.screenshot({ path: 'test-results/lobby-stages.png' });
  expect(errors).toEqual([]);
});

test('로비 캐릭터를 누르면 격자 목록 → 카드를 누르면 정보 화면 → 선택하면 로비 캐릭터가 바뀐다', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/');
  await expect.poll(() => activeScenes(page)).toContain('Lobby');

  await page.mouse.click(640, 400); // 가운데 캐릭터
  await expect.poll(() => activeScenes(page)).toContain('Characters');
  const cards = await page.evaluate(() => {
    const s = window.__deltaRun!.game.scene.getScene('Characters') as unknown as { grid: { list: { x: number; y: number; getData(k: string): string }[] } };
    return s.grid.list.map((c) => ({ x: c.x, y: c.y, id: c.getData('id') }));
  });
  expect(cards.map((c) => c.id)).toEqual(['orange', 'blueberry', 'mint', 'frisk', 'chaosking']);
  expect(new Set(cards.map((c) => c.y)).size).toBe(1); // 한 줄에 왼쪽부터
  expect(cards[0].x).toBeLessThan(cards[1].x);

  await page.mouse.click(cards[1].x, cards[1].y); // 블루베리
  await expect.poll(() => activeScenes(page)).toContain('CharacterInfo');
  expect(await page.evaluate(() => (window.__deltaRun!.game.scene.getScene('CharacterInfo') as unknown as { id: string }).id)).toBe('blueberry');
  await page.screenshot({ path: 'test-results/character-info.png' });

  await page.mouse.click(1090, 674); // 선택하기
  await expect.poll(() => activeScenes(page)).toContain('Lobby');
  expect(
    await page.evaluate(() => (window.__deltaRun!.game.scene.getScene('Lobby') as unknown as { hero: { texture: { key: string } } }).hero.texture.key),
  ).toBe('char_blueberry');
  expect(errors).toEqual([]);
});

test('휴대폰: 첫 터치로 전체화면, 뒤로가기 한 번이면 페이지를 떠나지 않고 전체화면만 풀린다', async ({ browser }) => {
  // 휴대폰처럼 터치 입력 + 거친 포인터로 접속한다
  const ctx = await browser.newContext({ hasTouch: true, isMobile: true, viewport: { width: 844, height: 390 } });
  const page = await ctx.newPage();
  const errors = collectErrors(page);
  await page.goto('/');
  await expect.poll(() => activeScenes(page)).toContain('Lobby');
  const isFs = () => page.evaluate(() => !!document.fullscreenElement);
  expect(await isFs()).toBe(false);

  await page.tap('#game canvas', { position: { x: 20, y: 20 } }); // 첫 터치
  await expect.poll(isFs).toBe(true);
  // 전체화면 뒤에도 게임 화면이 작아지지 않는다 (높이의 90% 이상을 채움)
  await expect
    .poll(() => page.evaluate(() => document.querySelector('#game canvas')!.getBoundingClientRect().height / window.innerHeight))
    .toBeGreaterThan(0.9);

  await page.goBack();
  await expect.poll(isFs).toBe(false);
  expect(new URL(page.url()).pathname).toBe('/');
  await expect.poll(() => activeScenes(page)).toContain('Lobby');

  // 풀린 뒤 다시 터치하면 전체화면이 다시 된다
  await page.tap('#game canvas', { position: { x: 20, y: 20 } });
  await expect.poll(isFs).toBe(true);
  expect(errors).toEqual([]);
  await ctx.close();
});

test('프리스크는 능력이 없고, 카오스 킹은 4초마다 소능력·3번째에 대능력(박스)이 나간다', async ({ page }) => {
  test.setTimeout(180_000); // 실시간으로 수십 초 달리는 테스트
  const errors = collectErrors(page);
  const info = () =>
    page.evaluate(() => {
      const g = window.__deltaRun!.game.scene.getScene('Game') as unknown as {
        sim: { tick: number; skill: { count: number; ultimateTicks: number; boxCoins: number } | null };
        world: { chaosBox: { visible: boolean } };
      };
      return { tick: g.sim.tick, skill: g.sim.skill, box: g.world.chaosBox.visible };
    });

  // 프리스크: 스킬 없음
  await page.goto('/?char=frisk&stage=stage_01&freezeAt=300');
  await expect.poll(() => page.evaluate(() => window.__deltaRun!.frozen), { timeout: 30_000 }).toBe(true);
  const frisk = await info();
  expect(frisk.skill).toBeNull();
  expect(frisk.box).toBe(false);

  // 카오스 킹: 300틱 = 소능력 1번 발동 (240틱)
  await page.goto('/?char=chaosking&stage=stage_01&freezeAt=300');
  await expect.poll(() => page.evaluate(() => window.__deltaRun!.frozen), { timeout: 30_000 }).toBe(true);
  const early = await info();
  expect(early.skill!.count).toBe(1);
  expect(early.skill!.ultimateTicks).toBe(0);
  expect(early.box).toBe(false);

  // 780틱 = 3번째 발동(720)이 대능력이라 지금 박스가 나와 있다
  await page.goto('/?char=chaosking&stage=stage_01&freezeAt=780');
  await expect.poll(() => page.evaluate(() => window.__deltaRun!.frozen), { timeout: 60_000 }).toBe(true);
  const mid = await info();
  expect(mid.skill!.count).toBe(3);
  expect(mid.skill!.ultimateTicks).toBeGreaterThan(0);
  expect(mid.box).toBe(true);
  await page.screenshot({ path: 'test-results/chaos-king-ultimate.png' });
  expect(errors).toEqual([]);
});

test('카오스 킹 대능력이 끝나면 상자에서 코인이 튀어나와 바닥에서 튕긴다', async ({ page }) => {
  test.setTimeout(180_000);
  const errors = collectErrors(page);
  type Fx = { active: boolean; settled: boolean; bounces: number; wy: number };
  const fx = () =>
    page.evaluate(() => {
      const g = window.__deltaRun!.game.scene.getScene('Game') as unknown as {
        sim: { coins: number; skill: { ultimateTicks: number } };
        world: { coinFx: Fx[]; chaosBox: { displayWidth: number; displayHeight: number } };
      };
      const list = g.world.coinFx.filter((p) => p.active);
      return { coins: g.sim.coins, ultimate: g.sim.skill.ultimateTicks, active: list.length, bounced: list.filter((p) => p.bounces > 0).length, floor: list.filter((p) => p.settled).map((p) => p.wy) };
    });

  // 1080틱에 대능력이 끝난다. 그 직후(1090)에 멈춰 두고 연출이 도는지 본다.
  await page.goto('/?char=chaosking&stage=stage_01&freezeAt=1090');
  await expect.poll(() => page.evaluate(() => window.__deltaRun!.frozen), { timeout: 50_000 }).toBe(true);
  const start = await fx();
  expect(start.ultimate).toBe(0);
  expect(start.coins).toBeGreaterThan(0); // 쌓인 코인이 지급됨
  expect(start.active).toBeGreaterThanOrEqual(8); // 코인이 튀어나오는 연출 시작
  await page.screenshot({ path: 'test-results/chaos-coin-shower.png' });

  // 잠시 뒤 코인들이 바닥에 떨어져 튕겼고, 멈춘 코인은 바닥 높이(582)에 있다
  await expect.poll(async () => (await fx()).bounced, { timeout: 5000 }).toBeGreaterThan(0);
  await expect.poll(async () => (await fx()).floor.length, { timeout: 5000 }).toBeGreaterThan(0);
  const later = await fx();
  expect(later.floor.every((y) => Math.abs(y - 582) < 1)).toBe(true);

  // 가로로 긴 상자
  const size = await page.evaluate(() => {
    const g = window.__deltaRun!.game.scene.getScene('Game') as unknown as { world: { chaosBox: { displayWidth: number; displayHeight: number } } };
    return { w: g.world.chaosBox.displayWidth, h: g.world.chaosBox.displayHeight };
  });
  expect(size.w).toBeGreaterThan(size.h * 1.5);
  expect(errors).toEqual([]);
});
