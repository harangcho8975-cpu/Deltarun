import { describe, expect, it } from 'vitest';
import { gameConfig as cfg } from '../../src/config/gameConfig';
import { JUMP, NONE, SLIDE, run, sim } from '../helpers';

describe('충돌', () => {
  it('장애물에 부딪히면 hp −15, 무적 90틱', () => {
    const s = sim({ obstacles: [{ type: 'obstacle_low', x: 400 }] });
    const ev = run(s, 60);
    const hits = ev.filter((e) => e.type === 'hit');
    expect(hits).toHaveLength(1);
    expect(s.player.invulnTicks).toBeGreaterThan(cfg.invulnTicksOnHit - 60);
    const drain = (cfg.hp.drainPerSec / 60) * 60;
    expect(s.player.hp).toBeCloseTo(100 - 15 - drain, 5);
  });

  it('무적 중에는 다른 장애물을 무시한다', () => {
    const s = sim({ obstacles: [{ type: 'obstacle_low', x: 400 }, { type: 'obstacle_low', x: 480 }] });
    const ev = run(s, 60);
    expect(ev.filter((e) => e.type === 'hit')).toHaveLength(1);
  });

  it('낮은 장애물은 1단 점프로 넘는다', () => {
    const s = sim({ obstacles: [{ type: 'obstacle_low', x: 400 }] });
    // 발 중앙 268 → 장애물 중앙 424. 정점(약 20틱 뒤)이 장애물 위에 오도록 점프
    run(s, 11);
    const ev = run(s, 80, (t) => (t === 0 ? JUMP : NONE));
    expect(ev.some((e) => e.type === 'hit')).toBe(false);
  });

  it('공중 장애물은 서 있으면 닿고, 슬라이드하면 통과한다', () => {
    const stand = sim({ obstacles: [{ type: 'obstacle_air', x: 400 }] });
    expect(run(stand, 60).some((e) => e.type === 'hit')).toBe(true);
    const duck = sim({ obstacles: [{ type: 'obstacle_air', x: 400 }] });
    expect(run(duck, 60, SLIDE).some((e) => e.type === 'hit')).toBe(false);
  });

  it('젤리·코인 점수', () => {
    const s = sim({
      jellies: [
        { type: 'jelly_normal', x: 400, y: 560 },
        { type: 'jelly_big', x: 480, y: 560 },
        { type: 'coin', x: 560, y: 560 },
      ],
    });
    run(s, 80);
    expect(s.jellyScore).toBe(110);
    expect(s.jelliesTaken).toBe(2);
    expect(s.jelliesTotal).toBe(2);
    expect(s.coins).toBe(1);
  });

  it('체력이 다 닳으면 failed(hp)', () => {
    const s = sim();
    s.player.hp = 0.01;
    const ev = run(s, 2);
    expect(ev).toContainEqual({ type: 'failed', reason: 'hp' });
    expect(s.outcome).toBe('failed');
  });

  it('결승점에 닿으면 cleared, 거리 점수는 goalX 기준', () => {
    const s = sim({ goalX: 600 });
    const ev = run(s, 200);
    expect(ev).toContainEqual({ type: 'cleared' });
    expect(s.distance).toBe(60);
  });

  it('활성 범위 밖 엔티티는 검사하지 않는다 (엔티티 5,000개)', async () => {
    const { activeRange } = await import('../../src/sim');
    const jellies = Array.from({ length: 5000 }, (_, i) => ({ type: 'jelly_normal' as const, x: 300 + i * 40, y: 300 }));
    const s = sim({ jellies, length: 210000, ground: [[0, 210000]], goalX: 209000 });
    let maxActive = 0;
    for (let t = 0; t < 600; t++) {
      run(s, 1, NONE);
      const [a, b] = activeRange(s);
      maxActive = Math.max(maxActive, b - a);
    }
    expect(maxActive).toBeLessThanOrEqual(100);
    void JUMP;
  });
});
