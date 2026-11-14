import { describe, expect, it } from 'vitest';
import { gameConfig as cfg } from '../../src/config/gameConfig';
import { cloneSim, hashState, step, ultimateBox, type SimEvent } from '../../src/sim';
import { DROP_FLOOR_Y, updateDrops } from '../../src/sim/skills';
import { NONE, flatStage, runTagged, skillSim } from '../helpers';

const types = (ev: [number, SimEvent][], type: SimEvent['type']) => ev.filter(([, e]) => e.type === type);
const obstacle = (x: number, type: 'obstacle_low' | 'obstacle_high' | 'obstacle_air' = 'obstacle_high') => ({ type, x });
const alive = (s: ReturnType<typeof skillSim>, x: number) => s.entities.find((e) => e.kind.startsWith('obstacle_') && e.x === x)!.alive;

describe('카오스 킹 소능력', () => {
  it('240틱(4초)째에 화면 안 장애물만 부순다', () => {
    // 240틱 뒤 카메라 x = 1200 → 화면은 1200~2480. 2000은 안, 6000은 밖.
    const s = skillSim({ obstacles: [obstacle(2000), obstacle(6000)] });
    runTagged(s, 239);
    expect(alive(s, 2000)).toBe(true);
    const ev = runTagged(s, 1);
    expect(ev).toContainEqual([240, { type: 'skillMinor', destroyed: 1 }]);
    expect(alive(s, 2000)).toBe(false);
    expect(alive(s, 6000)).toBe(true);
  });

  it('화면에 장애물이 없어도 발동하고 4초 주기는 유지된다', () => {
    const s = skillSim();
    const ev = runTagged(s, 500);
    expect(types(ev, 'skillMinor').map(([t]) => t)).toEqual([240, 480]);
    expect(types(ev, 'skillMinor').every(([, e]) => e.type === 'skillMinor' && e.destroyed === 0)).toBe(true);
  });

  it('젤리·아이템은 부수지 않는다', () => {
    const s = skillSim({ jellies: [{ type: 'jelly_normal', x: 2000, y: 300 }], items: [{ type: 'item_heal', x: 2100, y: 300 }] });
    runTagged(s, 240);
    expect(s.entities.filter((e) => !e.kind.startsWith('obstacle_')).every((e) => e.alive)).toBe(true);
  });
});

describe('카오스 킹 대능력', () => {
  it('3번째 발동(720틱)이 소능력 대신 대능력이고, 6초 뒤(1080틱) 끝난다', () => {
    const s = skillSim();
    const ev = runTagged(s, 1100);
    expect(types(ev, 'skillMinor').map(([t]) => t)).toEqual([240, 480]); // 3번째는 소능력이 아니다
    expect(types(ev, 'ultimateStart').map(([t]) => t)).toEqual([720]);
    expect(types(ev, 'ultimateEnd').map(([t]) => t)).toEqual([1080]);
  });

  it('대능력 중에는 소능력이 나가지 않고 타이머가 멈췄다가, 끝난 뒤 4초부터 다시 센다', () => {
    const s = skillSim({ length: 40000, ground: [[0, 40000]], goalX: 39000 });
    const ev = runTagged(s, 1700);
    const minor = types(ev, 'skillMinor').map(([t]) => t);
    // 240·480 소능력 → 720~1080 대능력(소능력 없음) → 끝난 1080 + 240 = 1320, 1560 소능력
    expect(minor).toEqual([240, 480, 1320, 1560]);
    expect(minor.some((t) => t > 720 && t <= 1080)).toBe(false);
    expect(s.skill!.count).toBe(5);
  });

  it('6번째·9번째 발동도 대능력이다 (3의 배수)', () => {
    const s = skillSim({ length: 80000, ground: [[0, 80000]], goalX: 79000 });
    const ev = runTagged(s, 3000);
    // 720 시작·1080 끝 → 1320·1560 소능력 → 1800 대능력(2160 끝) → 2400·2640 소능력 → 2880 대능력
    expect(types(ev, 'ultimateStart').map(([t]) => t)).toEqual([720, 1800, 2880]);
    expect(types(ev, 'ultimateEnd').map(([t]) => t)).toEqual([1080, 2160]);
  });

  it('박스가 장애물을 부수고 하나당 코인 10개를 박스에 쌓는다 (끝나기 전엔 아직 지급되지 않는다)', () => {
    // 대능력(720~1080틱) 동안 카메라 3600 → 5400. 이 구간에 새로 나타나는 장애물 3개.
    const s = skillSim({ obstacles: [obstacle(5000), obstacle(5400), obstacle(5800), obstacle(9500)] });
    const ev = runTagged(s, 1079);
    expect(types(ev, 'boxHit')).toHaveLength(3);
    expect(types(ev, 'boxHit').map(([, e]) => (e.type === 'boxHit' ? e.boxCoins : 0))).toEqual([10, 20, 30]);
    expect(s.coins).toBe(0);
    expect(s.drops).toHaveLength(0);
    expect(s.skill!.boxCoins).toBe(30);
    expect([5000, 5400, 5800].every((x) => !alive(s, x))).toBe(true);
    expect(alive(s, 9500)).toBe(true);
  });

  it('박스는 가로로 긴 모양이고, 화면 오른쪽 끝(x = 1250)에 붙어 있다', () => {
    const b = cfg.skills.chaosKing.box;
    expect(b.w).toBeGreaterThan(b.h * 1.5); // 가로가 세로의 1.5배 이상
    expect(b.screenX + b.w).toBe(1250);
    expect(b.screenX + b.w).toBeLessThanOrEqual(cfg.view.width);
  });

  it('박스가 위에 있을 땐 낮은 장애물을 놓친다 (닿는 것만 부순다)', () => {
    // 대능력 시작 직후엔 박스가 가장 높은 곳(아랫변 460)에 있다. 박스 구역 안으로 들어온 낮은 장애물(552~600)은 안 닿는다.
    const s = skillSim({ obstacles: [obstacle(4800, 'obstacle_low')] });
    runTagged(s, 725);
    const box = ultimateBox(s)!;
    expect(box.y).toBeLessThan(552); // 박스 아랫변이 낮은 장애물 윗변보다 위
    expect(box.x).toBeLessThan(4800 + 48); // 가로로는 겹치는 위치
    expect(box.x + box.w).toBeGreaterThan(4800);
    const ev = runTagged(s, 15);
    expect(types(ev, 'boxHit')).toHaveLength(0);
    expect(alive(s, 4800)).toBe(true);
  });

  it('대능력 중에 판이 끝나면 쌓인 코인을 바로 지급한다', () => {
    const s = skillSim({ goalX: 5200, obstacles: [obstacle(5000)] });
    const ev = runTagged(s, 1200);
    expect(s.outcome).toBe('cleared');
    expect(s.skill!.ultimateTicks).toBe(0);
    expect(s.coins).toBe(10);
    expect(types(ev, 'ultimateEnd')).toHaveLength(1);
  });
});

describe('스킬이 없는 캐릭터', () => {
  it('skill이 null이고 스킬 이벤트가 없다', () => {
    const s = skillSim({}, null);
    expect(s.skill).toBeNull();
    const ev = runTagged(s, 1500);
    expect(ev.filter(([, e]) => ['skillMinor', 'ultimateStart', 'ultimateEnd', 'boxHit'].includes(e.type))).toHaveLength(0);
  });

  it('스킬 유무가 다른 규칙(장애물 피격)을 바꾸지 않는다', () => {
    const base = skillSim({ obstacles: [obstacle(500)] }, null);
    base.debugInvincible = false;
    const withSkill = skillSim({ obstacles: [obstacle(500)] });
    withSkill.debugInvincible = false;
    runTagged(base, 100);
    runTagged(withSkill, 100); // 100틱 < 240틱이라 스킬이 아직 발동 전
    expect(withSkill.player.hp).toBe(base.player.hp);
  });
});

describe('결정성', () => {
  it('같은 입력이면 스킬 상태까지 매 틱 해시가 같다', () => {
    const mk = () => skillSim({ obstacles: [obstacle(1500), obstacle(5000), obstacle(5500)], jellies: [{ type: 'coin', x: 3000, y: 560 }] });
    const a = mk();
    const b = mk();
    for (let t = 0; t < 1500; t++) {
      step(a, NONE);
      step(b, NONE);
      expect(hashState(a)).toBe(hashState(b));
    }
  });

  it('cloneSim이 스킬 상태를 따로 복사한다', () => {
    const s = skillSim();
    runTagged(s, 100);
    const c = cloneSim(s);
    runTagged(c, 300);
    expect(s.skill!.count).toBe(0);
    expect(c.skill!.count).toBe(1);
    expect(flatStage().id).toBe('test');
  });
});

describe('대능력이 끝나면 쌓인 코인이 떨어진다 (직접 주워야 지급)', () => {
  const three = () => skillSim({ length: 40000, ground: [[0, 40000]], goalX: 39000, obstacles: [obstacle(5000), obstacle(5400), obstacle(5800)] });
  const toEnd = () => {
    const s = three();
    const ev = runTagged(s, 1080);
    return { s, ev };
  };

  it('쌓인 코인 전부(30개)가 코인 객체로 쏟아지고, 아직 지급되지 않는다', () => {
    const { s, ev } = toEnd();
    const end = ev.find(([, e]) => e.type === 'ultimateEnd')![1];
    expect(end).toMatchObject({ type: 'ultimateEnd', coins: 30, released: true });
    expect(s.drops).toHaveLength(30); // 모든 코인이 하나하나 떨어진다
    expect(s.coins).toBe(0); // 줍기 전에는 지급되지 않는다
    expect(s.skill!.boxCoins).toBe(0);
  });

  it('코인은 상자 안에서 하나씩(0~24틱 사이) 튀어나온다', () => {
    const { s } = toEnd();
    const delays = s.drops.map((d) => d.delay);
    expect(Math.max(...delays)).toBeLessThanOrEqual(24);
    expect(new Set(delays).size).toBeGreaterThan(5); // 한꺼번에가 아니다
  });

  // 플레이어와 멀리 떨어진 화면 오른쪽에서 떨어뜨려, 줍는 것과 무관하게 낙하 물리만 본다
  const farDrops = () => {
    const s = skillSim({ length: 40000, ground: [[0, 40000]], goalX: 39000 });
    for (let i = 0; i < 20; i++) {
      s.drops.push({
        id: i, x: s.cameraX + 1300 + i * 10, y: 300 + (i % 5) * 20, vx: (i - 10) * 25, vy: -500 - i * 25,
        delay: 0, bounces: 0, settled: false,
      });
    }
    return s;
  };

  it('바닥에서 살짝 튕기다 멈춘다 (멈춘 코인은 바닥 높이)', () => {
    const s = farDrops();
    for (let i = 0; i < 200; i++) updateDrops(s, []);
    expect(s.drops).toHaveLength(20);
    expect(s.drops.every((d) => d.settled)).toBe(true);
    expect(s.drops.every((d) => d.y === DROP_FLOOR_Y)).toBe(true);
    expect(s.drops.every((d) => d.bounces >= 1)).toBe(true);
    expect(s.drops.some((d) => d.bounces >= 2)).toBe(true); // 두세 번 튕긴다
    expect(s.drops.every((d) => d.bounces <= 6)).toBe(true); // 끝없이 튀지 않는다
  });

  it('튕기는 높이가 점점 낮아진다', () => {
    const s = farDrops();
    const id = 0;
    const peaks: number[] = [];
    let prevY = Infinity;
    let rising = false;
    for (let t = 0; t < 200; t++) {
      updateDrops(s, []);
      const c = s.drops.find((d) => d.id === id)!;
      if (c.y > prevY && rising) {
        peaks.push(prevY); // 위로 가다 아래로 바뀐 지점 = 정점
        rising = false;
      }
      if (c.y < prevY) rising = true;
      prevY = c.y;
    }
    expect(peaks.length).toBeGreaterThanOrEqual(2);
    const heights = peaks.map((y) => DROP_FLOOR_Y - y); // 바닥에서의 높이
    for (let i = 1; i < heights.length; i++) expect(heights[i]).toBeLessThan(heights[i - 1]);
  });

  it('달리다가 코인에 닿으면 하나당 코인 +1, 모두 주우면 30', () => {
    const { s } = toEnd();
    const ev = runTagged(s, 400);
    const picked = types(ev, 'dropCollect');
    expect(s.coins).toBe(picked.length);
    expect(s.coins).toBe(30);
    expect(s.drops).toHaveLength(0);
  });

  it('줍지 못하고 화면 뒤로 지나간 코인은 사라진다', () => {
    const s = skillSim({ length: 40000, ground: [[0, 40000]], goalX: 39000 });
    // 플레이어가 점프로 코인을 피한다고 가정: 코인을 플레이어 뒤쪽 먼 곳에 둔다
    s.drops.push({ id: 1, x: s.cameraX - 500, y: DROP_FLOOR_Y, vx: 0, vy: 0, delay: 0, bounces: 2, settled: true });
    updateDrops(s, []);
    expect(s.drops).toHaveLength(0);
    expect(s.coins).toBe(0);
  });

  it('구멍 위에서는 바닥이 없어 한 번도 튕기지 않고 떨어져 사라진다 (주울 수 없다)', () => {
    const s = skillSim({ length: 40000, ground: [[0, 1000], [9000, 40000]], goalX: 39000 }); // 1000~9000 구멍
    s.drops.push({ id: 1, x: s.cameraX + 1500, y: 300, vx: 0, vy: 0, delay: 0, bounces: 0, settled: false });
    let maxBounces = 0;
    for (let i = 0; i < 400 && s.drops.length > 0; i++) {
      updateDrops(s, []);
      maxBounces = Math.max(maxBounces, s.drops[0]?.bounces ?? 0);
    }
    expect(maxBounces).toBe(0);
    expect(s.drops).toHaveLength(0); // 화면 아래로 떨어져 사라짐
    expect(s.coins).toBe(0);
  });

  it('판이 끝나는 순간 대능력이 남아 있으면 더 주울 수 없으므로 바로 지급한다 (떨어뜨리지 않음)', () => {
    const s = skillSim({ goalX: 5200, obstacles: [obstacle(5000)] });
    const ev = runTagged(s, 1200);
    expect(s.outcome).toBe('cleared');
    expect(s.coins).toBe(10);
    expect(s.drops).toHaveLength(0);
    const end = ev.find(([, e]) => e.type === 'ultimateEnd')![1];
    expect(end).toMatchObject({ released: false });
  });
});
