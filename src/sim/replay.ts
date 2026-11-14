import { configHash, fnv1a } from '../config/gameConfig';
import type { StageData } from '../data/schema';
import { createSim } from './createSim';
import { step } from './step';
import type { InputFrame, SimState, SkillId } from './types';

export type ReplayAction = 'J' | 'S+' | 'S-';

export interface Replay {
  stageId: string;
  configHash: string;
  /** 녹화한 캐릭터의 스킬 (없으면 스킬 없음) */
  skill?: SkillId;
  inputs: [number, ReplayAction][];
}

/** 입력이 바뀐 틱만 기록한다. */
export class ReplayRecorder {
  private inputs: [number, ReplayAction][] = [];
  private slide = false;

  constructor(private stageId: string, private skill?: SkillId | null) {}

  record(tick: number, input: InputFrame): void {
    if (input.jumpPressed) this.inputs.push([tick, 'J']);
    if (input.slideHeld !== this.slide) {
      this.slide = input.slideHeld;
      this.inputs.push([tick, input.slideHeld ? 'S+' : 'S-']);
    }
  }

  toJSON(): Replay {
    const out: Replay = { stageId: this.stageId, configHash: configHash(), inputs: this.inputs.map((x) => [x[0], x[1]]) };
    if (this.skill) out.skill = this.skill;
    return out;
  }
}

/** 리플레이를 틱별 InputFrame으로 돌려주는 재생기 */
export class ReplayPlayer {
  private i = 0;
  private slide = false;

  constructor(private replay: Replay) {}

  frame(tick: number): InputFrame {
    let jump = false;
    const ins = this.replay.inputs;
    while (this.i < ins.length && ins[this.i][0] === tick) {
      const a = ins[this.i][1];
      if (a === 'J') jump = true;
      else this.slide = a === 'S+';
      this.i++;
    }
    return { jumpPressed: jump, slideHeld: this.slide };
  }
}

export interface RunResult {
  state: SimState;
  hashes: string[];
}

export function runReplay(stage: StageData, replay: Replay, maxTicks = 60 * 60 * 5, collectHashes = false): RunResult {
  const s = createSim(stage, { skill: replay.skill ?? null });
  const player = new ReplayPlayer(replay);
  const hashes: string[] = [];
  while (s.outcome === 'playing' && s.tick < maxTicks) {
    step(s, player.frame(s.tick));
    if (collectHashes) hashes.push(hashState(s));
  }
  return { state: s, hashes };
}

/** 결정성 확인용 상태 해시 */
export function hashState(s: SimState): string {
  const p = s.player;
  const parts: (string | number)[] = [
    s.tick, s.outcome, s.cameraX, p.x, p.y, p.vy, p.state, p.hp, p.jumpsUsed, p.invulnTicks,
    p.coyoteTicks, p.jumpBufferTicks, s.effects.magnet, s.effects.giant, s.effects.boost,
    s.boostGroundGrace, s.jellyScore, s.jelliesTaken, s.coins, s.cursor,
  ];
  if (s.skill) parts.push(s.skill.timer, s.skill.count, s.skill.ultimateTicks, s.skill.ultimateElapsed, s.skill.boxCoins);
  if (s.drops.length) parts.push(s.drops.map((d) => `${d.id}:${d.x.toFixed(3)}:${d.y.toFixed(3)}:${d.delay}:${d.settled ? 1 : 0}`).join(','));
  let alive = '';
  for (const e of s.entities) alive += e.alive ? '1' : '0';
  return fnv1a(parts.join('|') + '|' + alive);
}
