import type { StageData } from '../src/data/schema';
import { createSim, step, type InputFrame, type SimState, type SimEvent } from '../src/sim';

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
