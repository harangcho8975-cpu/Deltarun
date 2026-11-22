import { describe, expect, it } from 'vitest';
import { gameConfig as cfg } from '../../src/config/gameConfig';
import { hashState, ReplayPlayer, ReplayRecorder, step, type InputFrame, type SimEvent, type SimState } from '../../src/sim';
import { bigScytheY, scytheBox } from '../../src/sim/jevil';
import { NONE, flatStage, skillSim } from '../helpers';

const J = cfg.skills.jevil;
const JUMP: InputFrame = { jumpPressed: true, slideHeld: false };
const SLIDE: InputFrame = { jumpPressed: false, slideHeld: true };
const HOLD: InputFrame = { jumpPressed: false, slideHeld: false, jumpHeld: true };

const jv = (over = {}) => skillSim(over, 'jevil');
function go(s: SimState, n: number, input: InputFrame | ((t: number) => InputFrame) = NONE): SimEvent[] {
  const out: SimEvent[] = [];
  for (let t = 0; t < n && s.outcome === 'playing'; t++) out.push(...step(s, typeof input === 'function' ? input(t) : input));
  return out;
}
const of = (ev: SimEvent[], type: SimEvent['type']) => ev.filter((e) => e.type === type);
/** 대능력 바로 앞까지 */
function toUltimate(s: SimState): SimEvent[] {
  s.jevil!.timer = 1;
  return go(s, 1);
}

describe('제빌 소능력: 상자 스택', () => {
  it('시작할 때 스택 2개, 대능력까지 20초', () => {
    const s = jv();
    expect(s.jevil!.stacks).toBe(2);
    expect(s.jevil!.timer).toBe(1200);
  });

  it('공중에서 슬라이드를 누르면 스택 1개로 상자, 땅에서는 그냥 슬라이드', () => {
    const s = jv();
    let ev = go(s, 5, SLIDE); // 땅
    expect(of(ev, 'jevilBox')).toHaveLength(0);
    expect(s.player.state).toBe('slide');
    go(s, 1, NONE);
    go(s, 1, JUMP);
    go(s, 5, NONE);
    ev = go(s, 10, SLIDE); // 공중에서 누르고 있어도 누른 순간 한 번만
    expect(of(ev, 'jevilBox')).toEqual([{ type: 'jevilBox', ultimate: false }]);
    expect(s.jevil!.stacks).toBe(1);
  });

  it('스택이 없으면 상자가 나가지 않는다', () => {
    const s = jv();
    s.jevil!.stacks = 0;
    go(s, 1, JUMP);
    const ev = go(s, 5, (t) => (t === 3 ? SLIDE : NONE));
    expect(of(ev, 'jevilBox')).toHaveLength(0);
  });

  it('상자는 날아와 터지며 12방향 조각을 뿌리고, 조각이 장애물을 부순다', () => {
    const s = jv({ obstacles: [{ type: 'obstacle_high', x: 760 }] });
    go(s, 1, JUMP);
    go(s, 8, NONE);
    go(s, 1, SLIDE);
    let ev = go(s, J.box.flightTicks - 2, NONE);
    expect(of(ev, 'jevilBurst')).toHaveLength(0);
    ev = go(s, 4, NONE);
    expect(of(ev, 'jevilBurst')).toHaveLength(1);
    expect(s.jevil!.shards).toHaveLength(J.shard.count);
    ev = go(s, J.shard.lifeTicks, NONE);
    expect(of(ev, 'smash')).toHaveLength(1);
    expect(s.entities[0].alive).toBe(false);
    expect(s.jevil!.shards).toHaveLength(0); // 수명이 다하면 사라진다
  });
});

describe('제빌 대능력', () => {
  it('20초째에 시작해 상자 폭격 3초(상자 5개) → 돌진 2초 → 비행 7초 → 심판의 낫 3초', () => {
    const s = jv();
    let ev = go(s, 1199);
    expect(s.jevil!.phase).toBe(0);
    ev = go(s, 1);
    expect(ev).toContainEqual({ type: 'jevilPhase', phase: 1 });
    ev = go(s, J.boxPhaseTicks);
    expect(of(ev, 'jevilBox').filter((e) => e.type === 'jevilBox' && e.ultimate)).toHaveLength(5);
    expect(s.jevil!.phase).toBe(2);
    ev = go(s, J.dashTicks);
    expect(s.jevil!.phase).toBe(3);
    ev = go(s, J.flightTicks);
    expect(s.jevil!.phase).toBe(4);
    ev = go(s, J.judgementTicks);
    expect(s.jevil!.phase).toBe(0);
    expect(s.jevil!.stacks).toBe(4); // 끝나면 스택 +2
    expect(s.jevil!.timer).toBe(1200);
  });

  it('돌진 중에는 두 배 속도로 앞으로 날아가고, 높이는 고정되지 않고 직접 조절한다', () => {
    const s = jv();
    toUltimate(s);
    go(s, J.boxPhaseTicks);
    expect(s.jevil!.phase).toBe(2);
    expect(s.player.state).toBe('fly');
    const x0 = s.cameraX;
    go(s, 10);
    expect(s.cameraX - x0).toBeCloseTo((s.stage.speed * J.dashSpeedMul * 10) / 60, 6);
    expect(s.player.y).toBe(cfg.groundY); // 누르지 않으면 바닥 높이 그대로
    go(s, 30, HOLD);
    const up = s.player.y;
    expect(up).toBeLessThan(cfg.groundY - 100); // 누르면 올라간다
    go(s, 45, NONE);
    expect(s.player.y).toBeGreaterThan(up); // 떼면 (관성으로 조금 더 오른 뒤) 다시 내려간다
  });

  it('낫 판정은 앞으로 넓고 위아래로 크다', () => {
    const s = jv();
    toUltimate(s);
    go(s, J.boxPhaseTicks + J.dashTicks + 30);
    s.jevil!.swing = 1;
    const b = scytheBox(s)!;
    expect(b.w).toBeGreaterThanOrEqual(J.scythe.reach);
    expect(b.h).toBe(J.scythe.height);
    expect(J.scythe.reach).toBeGreaterThanOrEqual(400);
  });

  it('비행: 누르고 있으면 올라가고, 떼면 내려간다. 천장·바닥을 넘지 않는다', () => {
    const s = jv();
    toUltimate(s);
    go(s, J.boxPhaseTicks + J.dashTicks);
    expect(s.jevil!.phase).toBe(3);
    const y0 = s.player.y;
    go(s, 20, HOLD);
    expect(s.player.y).toBeLessThan(y0 - 50);
    go(s, 100, HOLD);
    expect(s.player.y).toBe(J.ceilingY);
    const y1 = s.player.y;
    go(s, 20, NONE);
    expect(s.player.y).toBeGreaterThan(y1 + 50);
    go(s, 100, NONE);
    expect(s.player.y).toBe(cfg.groundY);
    expect(s.player.state).toBe('fly');
  });

  it('비행 중 슬라이드로 낫을 휘둘러 앞의 장애물을 부순다', () => {
    const s = jv();
    toUltimate(s);
    go(s, J.boxPhaseTicks + J.dashTicks + 30, NONE); // 바닥 근처로 내려와 있음
    // 플레이어 바로 앞에 장애물을 놓는다
    const ahead = s.player.x + 120;
    s.entities.push({ id: s.entities.length, kind: 'obstacle_low', x: ahead, y: cfg.groundY, w: 60, h: 60, alive: true });
    const ev = go(s, 4, (t) => (t === 0 ? SLIDE : NONE));
    expect(of(ev, 'jevilSwing')).toHaveLength(1);
    expect(of(ev, 'smash')).toHaveLength(1);
  });

  it('심판의 낫: 화면 절반에서 섬광 한 번, 화면 안 장애물을 모두 부순다', () => {
    const s = jv();
    toUltimate(s);
    go(s, J.boxPhaseTicks + J.dashTicks + J.flightTicks);
    expect(s.jevil!.phase).toBe(4);
    expect(s.player.state).toBe('fall');
    const cam = s.cameraX;
    s.entities.push(
      { id: s.entities.length, kind: 'obstacle_high', x: cam + 1000, y: cfg.groundY, w: 60, h: 120, alive: true },
      { id: s.entities.length + 1, kind: 'obstacle_air', x: cam + 1180, y: 450, w: 80, h: 300, alive: true },
    );
    let judged: SimEvent[] = [];
    let lastY = 0;
    for (let t = 0; t < J.judgementTicks && !judged.length; t++) {
      lastY = bigScytheY(s)!;
      judged = of(step(s, NONE), 'jevilJudgement');
    }
    expect(judged).toHaveLength(1);
    expect(lastY).toBeLessThan(J.bigScythe.flashAtY); // 화면 절반 직전까지 떨어지다가
    expect(lastY).toBeGreaterThan(J.bigScythe.flashAtY - 10);
    expect(bigScytheY(s)).toBeNull(); // 섬광이 터지면 낫은 사라진다
    expect(s.entities.slice(-2).every((e) => !e.alive)).toBe(true);
    const ev = go(s, J.judgementTicks);
    expect(of(ev, 'jevilJudgement')).toHaveLength(0); // 한 번만
  });

  it('발동 중에는 무적이고 구멍에도 빠지지 않는다', () => {
    const s = jv({ ground: [[0, 1400], [4000, 20000]], obstacles: [{ type: 'obstacle_high', x: 900 }] });
    s.debugInvincible = false;
    toUltimate(s);
    const ev = go(s, 400, NONE);
    expect(of(ev, 'hit')).toHaveLength(0);
    expect(s.outcome).toBe('playing');
  });
});

describe('제빌 무적', () => {
  it('상자(소능력)를 쓴 직후 1초 무적', () => {
    const s = jv();
    s.debugInvincible = false;
    go(s, 1, JUMP);
    go(s, 5, NONE);
    expect(s.player.invulnTicks).toBe(0);
    go(s, 1, SLIDE);
    expect(s.jevil!.stacks).toBe(1);
    expect(s.player.invulnTicks).toBe(J.invulnAfterMinorTicks - 1 + 1); // 이번 틱에 걸렸다
    expect(J.invulnAfterMinorTicks).toBe(60);
  });

  it('대능력 발동 중에는 장애물에 맞지 않고, 끝난 뒤 3초 무적 (그 사이 맞지 않는다)', () => {
    const obstacles = Array.from({ length: 60 }, (_, i) => ({ type: 'obstacle_high' as const, x: 1200 + i * 400 }));
    const s = jv({ obstacles });
    s.debugInvincible = false;
    toUltimate(s);
    const during = go(s, J.boxPhaseTicks + J.dashTicks + J.flightTicks + J.judgementTicks, NONE);
    expect(of(during, 'hit')).toHaveLength(0);
    expect(s.jevil!.phase).toBe(0);
    expect(s.player.invulnTicks).toBeGreaterThan(J.afterUltimateTicks - 5);
    expect(J.afterUltimateTicks).toBe(180);
    const after = go(s, J.afterUltimateTicks - 5, NONE);
    expect(of(after, 'hit')).toHaveLength(0);
    // 무적이 끝나면 다시 맞는다
    const later = go(s, 400, NONE);
    expect(of(later, 'hit').length).toBeGreaterThan(0);
  });
});

describe('제빌 결정성', () => {
  const inputs = (t: number): InputFrame => ({
    jumpPressed: t % 97 === 0,
    slideHeld: t % 53 < 6,
    jumpHeld: t % 40 < 18,
  });

  it('같은 입력이면 같은 결과, 리플레이(누르고 있기 포함)로 그대로 재현된다', () => {
    const stage = flatStage({ obstacles: Array.from({ length: 30 }, (_, i) => ({ type: 'obstacle_low' as const, x: 1500 + i * 600 })) });
    const a = skillSim(stage, 'jevil');
    const b = skillSim(stage, 'jevil');
    const rec = new ReplayRecorder(stage.id, 'jevil');
    for (let t = 0; t < 2400; t++) {
      const f = inputs(t);
      rec.record(a.tick, f);
      step(a, f);
      step(b, inputs(t));
    }
    expect(hashState(a)).toBe(hashState(b));
    const c = skillSim(stage, 'jevil');
    const player = new ReplayPlayer(rec.toJSON());
    for (let t = 0; t < 2400; t++) step(c, player.frame(c.tick));
    expect(hashState(c)).toBe(hashState(a));
  });
});
