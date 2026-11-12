import { describe, expect, it } from 'vitest';
import { gameConfig as cfg } from '../../src/config/gameConfig';
import { NONE, run, sim } from '../helpers';

const itemAt = (type: 'item_heal' | 'item_magnet' | 'item_giant' | 'item_boost', x = 400) => ({ type, x, y: 550 });

describe('아이템', () => {
  it('회복은 +20, 최대 100', () => {
    const s = sim({ items: [itemAt('item_heal')] });
    s.player.hp = 50;
    run(s, 40);
    expect(s.player.hp).toBeCloseTo(50 + 20 - (1.5 / 60) * 40, 5);
    const full = sim({ items: [itemAt('item_heal')] });
    run(full, 40);
    expect(full.player.hp).toBeLessThanOrEqual(100);
  });

  it('거대화 중에는 장애물을 부순다 (smash, 피해 없음)', () => {
    const s = sim({ items: [itemAt('item_giant')], obstacles: [{ type: 'obstacle_high', x: 700 }] });
    const ev = run(s, 120);
    expect(ev.some((e) => e.type === 'smash')).toBe(true);
    expect(ev.some((e) => e.type === 'hit')).toBe(false);
  });

  it('부스터는 속도 ×2, 장애물을 부순다', () => {
    const s = sim({ items: [itemAt('item_boost')], obstacles: [{ type: 'obstacle_low', x: 900 }] });
    run(s, 40);
    const x0 = s.cameraX;
    run(s, 10);
    expect(s.cameraX - x0).toBeCloseTo((300 * 2 * 10) / 60, 5);
    const ev = run(s, 60);
    expect(ev.some((e) => e.type === 'smash')).toBe(true);
  });

  it('효과가 끝나면 effectEnd와 무적 60틱', () => {
    const s = sim({ items: [itemAt('item_giant')] });
    run(s, 40);
    const ev = run(s, cfg.effects.giantTicks);
    expect(ev).toContainEqual({ type: 'effectEnd', effect: 'giant' });
    expect(s.player.invulnTicks).toBeGreaterThan(0);
  });

  it('같은 아이템을 또 먹으면 남은 시간이 초기화된다', () => {
    const s = sim({ items: [itemAt('item_magnet', 400), itemAt('item_magnet', 1000)] });
    run(s, 40);
    expect(s.effects.magnet).toBeGreaterThan(0);
    run(s, 120);
    expect(s.effects.magnet).toBeGreaterThan(cfg.effects.magnetTicks - 30);
  });

  it('자석은 반경 220px 안 젤리만 끌어당긴다', () => {
    // 몸 중심 y = 550. 하나는 세로 150px(반경 안), 하나는 세로 300px(반경 밖) 위에 둔다.
    const near = { type: 'jelly_normal' as const, x: 900, y: 400 };
    const far = { type: 'jelly_big' as const, x: 1400, y: 250 };
    const s = sim({ items: [itemAt('item_magnet')], jellies: [near, far] });
    run(s, 40);
    const nearEnt = () => s.entities.find((e) => e.kind === 'jelly_normal')!;
    const farEnt = () => s.entities.find((e) => e.kind === 'jelly_big')!;
    const x0 = nearEnt().x;
    run(s, 1, NONE); // 아직 220px 밖 → 그대로
    expect(nearEnt().x).toBe(x0);
    const farX = farEnt().x;
    run(s, 300);
    expect(nearEnt().alive).toBe(false); // 점프 없이 닿지 않는 높이인데 끌려와서 먹힘
    expect(farEnt().alive).toBe(true);
    expect(farEnt().x).toBe(farX);
  });
});
