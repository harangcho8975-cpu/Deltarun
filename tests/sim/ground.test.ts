import { describe, expect, it } from 'vitest';
import { JUMP, NONE, run, sim } from '../helpers';

describe('바닥과 구멍', () => {
  const holeAt = (x: number, w: number) => ({ ground: [[0, x], [x + w, 20000]] as [number, number][] });

  it('구멍에 떨어지면 failed(fall)', () => {
    const s = sim(holeAt(500, 200));
    const ev = run(s, 200);
    expect(ev).toContainEqual({ type: 'failed', reason: 'fall' });
  });

  it('구멍 위를 점프로 넘으면 생존', () => {
    const s = sim(holeAt(500, 160));
    // 발 중앙 268, 5px/틱 → 구멍 끝 직전(x≈480)에서 점프
    run(s, 42);
    run(s, 100, (t) => (t === 0 ? JUMP : NONE));
    expect(s.outcome).toBe('playing');
    expect(s.player.state).toBe('run');
  });

  it('떨어지는 중에 땅이 다시 나와도 올라오지 못한다', () => {
    const s = sim(holeAt(500, 60));
    const ev = run(s, 200);
    expect(ev).toContainEqual({ type: 'failed', reason: 'fall' });
  });

  it('부스터 중에는 구멍 위를 달려서 통과한다', () => {
    const s = sim({ ...holeAt(1200, 400), items: [{ type: 'item_boost', x: 400, y: 550 }] });
    run(s, 120);
    expect(s.outcome).toBe('playing');
    expect(s.player.y).toBe(600);
  });

  it('구멍 위에서 부스터가 끝나면 무적이 끝난 틱부터 떨어진다', () => {
    // 부스터 240틱 × 10px = 2400px. 먹는 위치 이후 아주 긴 구멍.
    const s = sim({ ground: [[0, 600], [8000, 20000]], items: [{ type: 'item_boost', x: 400, y: 550 }] });
    let endTick = -1;
    let fallTick = -1;
    for (let t = 0; t < 600 && s.outcome === 'playing'; t++) {
      const ev = run(s, 1, NONE);
      if (ev.some((e) => e.type === 'effectEnd')) endTick = s.tick;
      if (fallTick < 0 && s.player.state === 'fall') fallTick = s.tick;
    }
    expect(endTick).toBeGreaterThan(0);
    expect(fallTick - endTick).toBe(60);
  });

  it('거대화 중에는 40px 미만 구멍은 건너고, 40px 이상이면 빠진다', () => {
    const small = sim({ ground: [[0, 900], [930, 20000]], items: [{ type: 'item_giant', x: 400, y: 550 }] });
    run(small, 150);
    expect(small.outcome).toBe('playing');
    expect(small.player.y).toBe(600);

    const big = sim({ ground: [[0, 900], [940, 20000]], items: [{ type: 'item_giant', x: 400, y: 550 }] });
    const ev = run(big, 200);
    expect(ev).toContainEqual({ type: 'failed', reason: 'fall' });
  });

  it('거대화가 아니면 30px 구멍에도 빠진다', () => {
    const s = sim({ ground: [[0, 900], [930, 20000]] });
    const ev = run(s, 200);
    expect(ev).toContainEqual({ type: 'failed', reason: 'fall' });
  });
});
