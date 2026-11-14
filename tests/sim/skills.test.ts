import { describe, expect, it } from 'vitest';
import { gameConfig as cfg } from '../../src/config/gameConfig';
import { cloneSim, hashState, step, ultimateBox, type SimEvent } from '../../src/sim';
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

  it('박스가 장애물을 부수고 하나당 코인 10개를 박스에 쌓았다가, 끝나면 한꺼번에 지급한다', () => {
    // 대능력(720~1080틱) 동안 카메라 3600 → 5400. 이 구간에 새로 나타나는 장애물 3개.
    const s = skillSim({ obstacles: [obstacle(5000), obstacle(5400), obstacle(5800), obstacle(9500)] });
    const ev = runTagged(s, 1079);
    expect(types(ev, 'boxHit')).toHaveLength(3);
    expect(types(ev, 'boxHit').map(([, e]) => (e.type === 'boxHit' ? e.boxCoins : 0))).toEqual([10, 20, 30]);
    expect(s.coins).toBe(0); // 끝나기 전에는 아직 지급되지 않는다
    expect(s.skill!.boxCoins).toBe(30);
    expect([5000, 5400, 5800].every((x) => !alive(s, x))).toBe(true);
    expect(alive(s, 9500)).toBe(true);

    const end = runTagged(s, 1);
    const e = end.find(([, x]) => x.type === 'ultimateEnd')![1];
    expect(e.type === 'ultimateEnd' && e.coins).toBe(30);
    expect(s.coins).toBe(30);
    expect(s.skill!.boxCoins).toBe(0);
  });

  it('박스는 오른쪽에 있고, 아랫변이 460~600 사이를 부드럽게 오르내린다', () => {
    const s = skillSim();
    runTagged(s, 720);
    expect(s.skill!.ultimateTicks).toBe(360);
    let prev = ultimateBox(s)!.y;
    let min = prev;
    let max = prev;
    let maxStep = 0;
    for (let t = 0; t < 359; t++) {
      step(s, NONE);
      const b = ultimateBox(s)!;
      expect(b.x - s.cameraX).toBe(cfg.skills.chaosKing.box.screenX);
      maxStep = Math.max(maxStep, Math.abs(b.y - prev));
      min = Math.min(min, b.y);
      max = Math.max(max, b.y);
      prev = b.y;
    }
    expect(min).toBeGreaterThanOrEqual(460);
    expect(max).toBeLessThanOrEqual(600);
    expect(max - min).toBeGreaterThan(130); // 위아래 끝까지 움직인다
    expect(maxStep).toBeLessThan(5); // 순간이동 없이 부드럽다 (틱당 5px 미만)
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
