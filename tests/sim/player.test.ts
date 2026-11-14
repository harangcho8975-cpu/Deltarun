import { describe, expect, it } from 'vitest';
import { gameConfig as cfg } from '../../src/config/gameConfig';
import { playerBox } from '../../src/sim';
import { JUMP, NONE, SLIDE, run, sim } from '../helpers';

const apex = (s: ReturnType<typeof sim>, input: Parameters<typeof run>[2]) => {
  let minY = s.player.y;
  for (let t = 0; t < 120; t++) {
    run(s, 1, typeof input === 'function' ? () => input(t) : input);
    minY = Math.min(minY, s.player.y);
  }
  return cfg.groundY - minY;
};

describe('플레이어 물리', () => {
  it('1단 점프 최고 높이는 165–185px', () => {
    const h = apex(sim(), (t: number) => (t === 0 ? JUMP : NONE));
    expect(h).toBeGreaterThanOrEqual(165);
    expect(h).toBeLessThanOrEqual(185);
  });

  it('2단 점프는 높은 장애물(160) + 몸 높이(100)보다 높이 올라간다', () => {
    const h = apex(sim(), (t: number) => (t === 0 || t === 20 ? JUMP : NONE));
    expect(h).toBeGreaterThan(260);
  });

  it('공중에서는 세 번째 점프가 되지 않는다', () => {
    const s = sim();
    const ev = run(s, 40, (t) => (t === 0 || t === 10 || t === 20 ? JUMP : NONE));
    expect(ev.filter((e) => e.type === 'jump')).toHaveLength(2);
  });

  it('슬라이드 히트박스 높이는 44', () => {
    const s = sim();
    run(s, 2, SLIDE);
    expect(s.player.state).toBe('slide');
    expect(playerBox(s).h).toBe(44);
    run(s, 1, NONE);
    expect(s.player.state).toBe('run');
    expect(playerBox(s).h).toBe(100);
  });

  it('슬라이드 중 점프 입력이면 점프한다', () => {
    const s = sim();
    run(s, 3, SLIDE);
    run(s, 1, { jumpPressed: true, slideHeld: true });
    expect(s.player.state).toBe('jump');
  });

  it('공중에서 slideHeld를 눌러도 vy와 자세가 바뀌지 않는다', () => {
    const a = sim();
    const b = sim();
    run(a, 1, JUMP);
    run(b, 1, JUMP);
    for (let t = 0; t < 30; t++) {
      run(a, 1, NONE);
      run(b, 1, SLIDE);
      expect(b.player.vy).toBe(a.player.vy);
      expect(b.player.y).toBe(a.player.y);
      expect(playerBox(b).h).toBe(100);
    }
  });

  it('누른 채로 착지하면 그 틱부터 slide', () => {
    const s = sim();
    run(s, 1, JUMP);
    let landedAs = '';
    for (let t = 0; t < 80; t++) {
      for (const e of run(s, 1, SLIDE)) if (e.type === 'land') landedAs = s.player.state;
    }
    expect(landedAs).toBe('slide');
  });

  it('점프 버퍼: 착지 6틱 전 누른 점프는 착지하자마자 실행된다', () => {
    const s = sim();
    run(s, 1, JUMP);
    run(s, 1, JUMP); // 2단 점프로 기회를 다 쓴다
    let ticksToLand = 0;
    const probe = sim();
    run(probe, 1, JUMP);
    run(probe, 1, JUMP);
    while (!run(probe, 1, NONE).some((e) => e.type === 'land')) ticksToLand++;
    run(s, ticksToLand - 5, NONE);
    run(s, 1, JUMP); // 착지 약 5틱 전
    const ev = run(s, 8, NONE);
    const landIdx = ev.findIndex((e) => e.type === 'land');
    expect(landIdx).toBeGreaterThanOrEqual(0);
    expect(ev[landIdx + 1]).toEqual({ type: 'jump', double: false });
  });

  it('점프 버퍼는 6틱 뒤 사라진다', () => {
    const s = sim();
    run(s, 1, JUMP);
    run(s, 1, JUMP);
    let ticksToLand = 0;
    const probe = sim();
    run(probe, 1, JUMP);
    run(probe, 1, JUMP);
    while (!run(probe, 1, NONE).some((e) => e.type === 'land')) ticksToLand++;
    run(s, ticksToLand - 10, NONE);
    run(s, 1, JUMP); // 착지 약 10틱 전 → 버퍼 만료
    const ev = run(s, 15, NONE);
    expect(ev.some((e) => e.type === 'jump')).toBe(false);
  });

  it('코요테 타임: 바닥 끝에서 떨어진 뒤 6틱 안의 점프는 1단 점프', () => {
    // 플레이어 발 중앙이 x=268에서 시작해 300px/s(5px/틱)로 이동. 300에서 구멍 시작.
    const mk = () => sim({ ground: [[0, 300], [500, 20000]] });
    const s = mk();
    while (s.player.state !== 'fall') run(s, 1, NONE);
    run(s, 3, NONE);
    const ev = run(s, 1, JUMP);
    expect(ev).toContainEqual({ type: 'jump', double: false });
    expect(s.player.jumpsUsed).toBe(1);

    const late = mk();
    while (late.player.state !== 'fall') run(late, 1, NONE);
    run(late, 8, NONE);
    const ev2 = run(late, 1, JUMP);
    expect(ev2).toContainEqual({ type: 'jump', double: true });
  });
});
