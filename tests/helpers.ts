import type { StageData } from '../src/data/schema';
import { createSim, step, type InputFrame, type SimState, type SimEvent, type SkillId } from '../src/sim';

export function flatStage(over: Partial<StageData> = {}): StageData {
  return {
    id: 'test',
    name: 'test',
    length: 20000,
    speed: 300,
    bgm: 'bgm_stage1',
    background: ['bg_far', 'bg_mid', 'bg_near'],
    ground: [[0, 20000]],
    obstacles: [],
    jellies: [],
    items: [],
    goalX: 19800,
    stars: [0.5, 0.75, 0.95],
    ...over,
  };
}

export const NONE: InputFrame = { jumpPressed: false, slideHeld: false };
export const JUMP: InputFrame = { jumpPressed: true, slideHeld: false };
export const SLIDE: InputFrame = { jumpPressed: false, slideHeld: true };

/** n틱 동안 같은 입력(또는 함수)을 넣고 이벤트를 모은다 */
export function run(s: SimState, n: number, input: InputFrame | ((t: number) => InputFrame) = NONE): SimEvent[] {
  const all: SimEvent[] = [];
  for (let t = 0; t < n && s.outcome === 'playing'; t++) {
    all.push(...step(s, typeof input === 'function' ? input(t) : input));
  }
  return all;
}

export function sim(over: Partial<StageData> = {}, startX?: number): SimState {
  const s = createSim(flatStage(over), { startX });
  s.debugInvincible = false;
  return s;
}

/** 스킬이 있는 캐릭터로 시작한다. 장애물에 맞아도 체력이 닳지 않게 무적이다. */
export function skillSim(over: Partial<StageData> = {}, skill: SkillId | null = 'chaosKing'): SimState {
  const s = createSim(flatStage(over), { skill });
  s.debugInvincible = true;
  return s;
}

/** 틱마다 이벤트를 모아 돌려준다: [틱 번호(1부터), 이벤트][] */
export function runTagged(s: SimState, n: number): [number, SimEvent][] {
  const out: [number, SimEvent][] = [];
  for (let t = 0; t < n && s.outcome === 'playing'; t++) {
    for (const e of step(s, NONE)) out.push([s.tick, e]);
  }
  return out;
}
