import { describe, expect, it } from 'vitest';
import { describeEffect, equipment, equipmentById, equipmentByRarity, modsFor } from '../src/data/equipment';
import { RARITY } from '../src/data/characters';
import { combineMods, createSim, hashState, NO_MODS, runReplay, step, type Replay } from '../src/sim';
import { configHash } from '../src/config/gameConfig';
import { stages } from '../src/data/stages';
import { flatStage, JUMP, NONE, run } from './helpers';

const simWith = (mods: Parameters<typeof combineMods>[0][number], over = {}) => {
  const s = createSim(flatStage(over), { mods });
  return s;
};

describe('장비 데이터', () => {
  it('id가 겹치지 않고, 모든 장비에 등급과 효과와 설명이 있다', () => {
    expect(new Set(equipment.map((e) => e.id)).size).toBe(equipment.length);
    for (const e of equipment) {
      expect(RARITY[e.rarity], e.id).toBeDefined();
      expect(Object.keys(e.effect).length, e.id).toBeGreaterThan(0);
      expect(describeEffect(e.effect).length, e.id).toBeGreaterThan(0);
      expect(e.name, e.id).toBeTruthy();
    }
  });
  it('등급별로 뽑을 장비가 있다 (일반 4 · 레어 4 · 에픽 3 · 레전드 3)', () => {
    expect(['common', 'rare', 'epic', 'legendary'].map((r) => equipmentByRarity(r as 'common').length)).toEqual([4, 4, 3, 3]);
  });
  it('효과 합치기: 더하고, 체력 감소 배율은 곱하고, 자석 반경은 가장 큰 값', () => {
    const m = combineMods([{ maxHpBonus: 20, hpDrainMul: 0.8, passiveMagnetRadius: 120 }, { maxHpBonus: 40, hpDrainMul: 0.7, passiveMagnetRadius: 220, coinBonus: 1 }]);
    expect(m.maxHpBonus).toBe(60);
    expect(m.hpDrainMul).toBeCloseTo(0.56, 5);
    expect(m.passiveMagnetRadius).toBe(220);
    expect(m.coinBonus).toBe(1);
    expect(combineMods([])).toEqual(NO_MODS);
  });
  it('modsFor는 모르는 id를 무시하고 장비 3개의 효과를 합친다', () => {
    const m = modsFor(['heart', 'angelwing', 'kingmagnet', '없는장비']);
    expect(m.maxHpBonus).toBe(40);
    expect(m.hitDamageReduce).toBe(5);
    expect(m.invulnOnHitBonus).toBe(60);
    expect(m.jellyScorePct).toBe(30);
    expect(m.passiveMagnetRadius).toBe(220);
    expect(m.hpDrainMul).toBeCloseTo(0.7, 5);
    expect(equipmentById('없는장비')).toBeUndefined();
  });
});

describe('장비 효과가 게임 규칙에 적용된다', () => {
  const hitObstacle = { obstacles: [{ type: 'obstacle_low' as const, x: 400 }] };

  it('장비가 없으면 효과가 하나도 없다 (기존 규칙 그대로)', () => {
    const s = createSim(flatStage());
    expect(s.mods).toEqual(NO_MODS);
    expect(s.maxHp).toBe(100);
    expect(s.player.hp).toBe(100);
  });

  it('최대 체력 +: 시작 체력과 회복 상한이 함께 늘어난다', () => {
    const s = simWith({ maxHpBonus: 20 }, { items: [{ type: 'item_heal', x: 400, y: 550 }] });
    expect(s.maxHp).toBe(120);
    expect(s.player.hp).toBe(120);
    s.player.hp = 100;
    run(s, 40);
    expect(s.player.hp).toBeLessThanOrEqual(120); // 상한을 넘지 않는다
    expect(s.player.hp).toBeGreaterThan(115);
  });

  it('받는 피해 −: 피격 피해가 줄고, 최소 1은 받는다', () => {
    const a = simWith({ hitDamageReduce: 3 }, hitObstacle);
    expect(run(a, 60).find((e) => e.type === 'hit')).toMatchObject({ damage: 12 });
    const b = simWith({ hitDamageReduce: 99 }, hitObstacle);
    expect(run(b, 60).find((e) => e.type === 'hit')).toMatchObject({ damage: 1 });
  });

  it('체력 감소 배율: 초당 체력 감소가 줄어든다', () => {
    const slow = simWith({ hpDrainMul: 0.5 });
    const normal = createSim(flatStage());
    run(slow, 60);
    run(normal, 60);
    expect(100 - slow.player.hp).toBeCloseTo(0.75, 5);
    expect(100 - normal.player.hp).toBeCloseTo(1.5, 5);
  });

  it('피격 후 무적 +: 맞은 직후 무적 틱이 늘어난다', () => {
    const s = simWith({ invulnOnHitBonus: 30 }, hitObstacle);
    let tickOfHit = -1;
    for (let t = 0; t < 120 && tickOfHit < 0; t++) if (run(s, 1).some((e) => e.type === 'hit')) tickOfHit = t;
    expect(s.player.invulnTicks).toBe(90 + 30);
  });

  it('코요테 타임 +: 바닥 끝에서 떨어진 뒤에도 더 오래 1단 점프가 된다', () => {
    const mk = (bonus: number) => createSim(flatStage({ ground: [[0, 300], [900, 20000]] }), { mods: { coyoteBonus: bonus } });
    const late = (s: ReturnType<typeof mk>) => {
      while (s.player.state !== 'fall') run(s, 1);
      run(s, 8); // 떨어진 지 8틱 뒤: 기본(6틱)이면 이미 늦다
      return run(s, 1, JUMP);
    };
    expect(late(mk(0))).toContainEqual({ type: 'jump', double: true });
    expect(late(mk(4))).toContainEqual({ type: 'jump', double: false });
  });

  it('점프 버퍼 +: 점프 입력을 기억하는 틱이 늘어난다', () => {
    const s = simWith({ bufferBonus: 4 });
    run(s, 1, JUMP);
    run(s, 1, JUMP); // 2단 점프까지 쓴다
    run(s, 1, JUMP);
    expect(s.player.jumpBufferTicks).toBe(6 + 4 - 0); // 방금 눌렀으니 최대값
  });

  it('코인을 주울 때 +: 코인 하나가 (1 + 보너스)개', () => {
    const s = simWith({ coinBonus: 2 }, { jellies: [{ type: 'coin', x: 400, y: 560 }, { type: 'coin', x: 480, y: 560 }] });
    run(s, 80);
    expect(s.coins).toBe(6); // 2개 × (1 + 2)
  });

  it('젤리 점수 +%: 젤리 점수가 늘어난다', () => {
    const s = simWith({ jellyScorePct: 20 }, { jellies: [{ type: 'jelly_normal', x: 400, y: 560 }, { type: 'jelly_big', x: 480, y: 560 }] });
    run(s, 80);
    expect(s.jellyScore).toBe(12 + 120);
  });

  it('상시 자석: 자석 아이템 없이도 반경 안 젤리를 끌어당긴다 (없으면 끌려오지 않는다)', () => {
    // 몸 중심 y = 550. 젤리를 위로 150px(점프 없이는 닿지 않는 높이)에 둔다.
    const jelly = { jellies: [{ type: 'jelly_normal' as const, x: 700, y: 400 }] };
    const with_ = simWith({ passiveMagnetRadius: 220 }, jelly);
    const without = createSim(flatStage(jelly));
    run(with_, 150);
    run(without, 150);
    expect(with_.jelliesTaken).toBe(1);
    expect(without.jelliesTaken).toBe(0);
  });

  it('회복 아이템 +: 회복량이 늘어난다', () => {
    const s = simWith({ healBonus: 10 }, { items: [{ type: 'item_heal', x: 400, y: 550 }] });
    s.player.hp = 50;
    run(s, 40);
    expect(s.player.hp).toBeGreaterThan(50 + 20 + 10 - 1.5); // 기본 +20에 +10
  });

  it('같은 장비·같은 입력이면 매 틱 같은 결과 (결정성)', () => {
    const mods = modsFor(['heart', 'kingmagnet', 'windshoes']);
    const mk = () => createSim(flatStage({ obstacles: [{ type: 'obstacle_low', x: 900 }], jellies: [{ type: 'jelly_normal', x: 600, y: 420 }] }), { mods });
    const a = mk();
    const b = mk();
    for (let t = 0; t < 400; t++) {
      const input = { jumpPressed: t % 90 === 10, slideHeld: false };
      step(a, input);
      step(b, input);
      expect(hashState(a)).toBe(hashState(b));
    }
    void NONE;
  });

  it('리플레이는 장착한 장비 효과를 함께 기록해 같은 결과로 재생된다', () => {
    const mods = modsFor(['armor', 'bottle', 'sneakers']);
    const replay: Replay = { stageId: 'stage_01', configHash: configHash(), mods, inputs: [[30, 'J'], [200, 'J']] };
    const a = runReplay(stages.stage_01, replay, 800, true);
    const b = runReplay(stages.stage_01, replay, 800, true);
    expect(a.hashes).toEqual(b.hashes);
    expect(a.state.maxHp).toBe(120); // 장비 효과가 재생에도 적용됨
    const plain = runReplay(stages.stage_01, { ...replay, mods: undefined }, 800, true);
    expect(plain.hashes).not.toEqual(a.hashes);
  });
});
