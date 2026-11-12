// 자동 플레이 봇: 시뮬레이션이 결정적이므로 상태를 복제해 행동 후보를 미리 돌려 본다.
// 1단계 행동(점프·슬라이드 등)을 실행한 뒤, 2단계로 이어질 가장 좋은 행동까지 내다보고
// "피해 없이 버틴 틱 수"가 가장 길고, 같으면 젤리를 더 먹는 행동을 고른다.
import { gameConfig as cfg } from '../config/gameConfig';
import type { StageData } from '../data/schema';
import { cloneSim, createSim } from './createSim';
import { ReplayRecorder, type Replay } from './replay';
import { step } from './step';
import type { InputFrame, SimState } from './types';

interface Plan {
  /** 숫자면 그 틱 수만큼, 'land'면 점프 후 착지할 때까지 실행 */
  len: number | 'land';
  input: (t: number) => InputFrame;
}

const HORIZON = 120;
const MAX_PLAN = 90;
const NONE: InputFrame = { jumpPressed: false, slideHeld: false };

const run = (len: number): Plan => ({ len, input: () => NONE });
const slide = (len: number): Plan => ({ len, input: () => ({ jumpPressed: false, slideHeld: true }) });
const jump = (wait: number, double?: number): Plan => ({
  len: 'land',
  input: (t) => ({ jumpPressed: t === wait || (double !== undefined && t === wait + double), slideHeld: false }),
});

const DOUBLES = [6, 10, 14, 18, 22, 26, 30];
const LEVEL1: Plan[] = [
  run(4),
  slide(4),
  ...[0, 1, 2, 3].flatMap((w) => [jump(w), ...DOUBLES.map((d) => jump(w, d))]),
];
const LEVEL2: Plan[] = [
  run(HORIZON),
  slide(HORIZON),
  ...[0, 3, 6, 9, 12].flatMap((w) => [jump(w), ...DOUBLES.map((d) => jump(w, d))]),
];

interface Score {
  safe: number;
  jellies: number;
}

const better = (a: Score, b: Score) => a.safe > b.safe || (a.safe === b.safe && a.jellies > b.jellies);

/** 계획을 실행한다. 피해를 입으면 그 틱을, 아니면 null을 돌려준다. */
function execute(s: SimState, plan: Plan, budget: number): { hitAt: number | null; used: number } {
  let jumped = false;
  const limit = Math.min(budget, plan.len === 'land' ? MAX_PLAN : plan.len);
  for (let t = 0; t < limit; t++) {
    const ev = step(s, plan.input(t));
    if (ev.some((e) => e.type === 'hit' || e.type === 'failed')) return { hitAt: t, used: t + 1 };
    // 바닥선 아래로 내려갔다면 구멍에 빠진 것: 다시 올라올 수 없으므로 바로 실패로 본다
    if (s.player.y > cfg.groundY + 2) return { hitAt: t, used: t + 1 };
    if (s.outcome === 'cleared') return { hitAt: null, used: budget };
    if (ev.some((e) => e.type === 'jump')) jumped = true;
    if (plan.len === 'land' && jumped && (s.player.state === 'run' || s.player.state === 'slide')) {
      return { hitAt: null, used: t + 1 };
    }
  }
  return { hitAt: null, used: limit };
}

function evaluate(base: SimState, plan: Plan, depth: number, budget: number): Score {
  const s = cloneSim(base);
  const j0 = s.jellyScore;
  const r = execute(s, plan, budget);
  if (r.hitAt !== null) return { safe: r.hitAt, jellies: s.jellyScore - j0 };
  if (s.outcome === 'cleared' || r.used >= budget || depth === 0) {
    return { safe: s.outcome === 'cleared' ? budget + 1 : r.used, jellies: s.jellyScore - j0 };
  }
  let best: Score = { safe: -1, jellies: -1 };
  const rest = budget - r.used;
  for (const p of LEVEL2) {
    const sc = evaluate(s, p, 0, rest);
    if (better(sc, best)) best = sc;
    if (best.safe >= rest) break; // 끝까지 안전한 이어가기를 찾았으면 충분
  }
  return { safe: r.used + best.safe, jellies: s.jellyScore - j0 + best.jellies };
}

/** 지금 상태에서 다음에 실행할 계획을 고른다. */
export function botChoose(s: SimState): Plan {
  let best = LEVEL1[0];
  let bestScore: Score = { safe: -1, jellies: -1 };
  for (const p of LEVEL1) {
    const sc = evaluate(s, p, 1, HORIZON);
    if (better(sc, bestScore)) {
      best = p;
      bestScore = sc;
    }
  }
  return best;
}

export interface BotRun {
  state: SimState;
  replay: Replay;
  hits: number;
}

export function playWithBot(stage: StageData, maxTicks = 60 * 60 * 5): BotRun {
  const s = createSim(stage);
  const rec = new ReplayRecorder(stage.id);
  let hits = 0;
  while (s.outcome === 'playing' && s.tick < maxTicks) {
    const plan = botChoose(s);
    let jumped = false;
    const limit = plan.len === 'land' ? MAX_PLAN : plan.len;
    for (let t = 0; t < limit && s.outcome === 'playing'; t++) {
      const input = plan.input(t);
      rec.record(s.tick, input);
      const ev = step(s, input);
      for (const e of ev) {
        if (e.type === 'hit') hits++;
        if (e.type === 'jump') jumped = true;
      }
      if (plan.len === 'land' && jumped && (s.player.state === 'run' || s.player.state === 'slide')) break;
    }
  }
  return { state: s, replay: rec.toJSON(), hits };
}
