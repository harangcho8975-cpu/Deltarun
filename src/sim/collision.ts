import { gameConfig as cfg, type Size } from '../config/gameConfig';
import type { PlayerSim, SimState } from './types';

/** 왼쪽 x, 아랫변 y 기준 사각형 */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function overlaps(a: Box, b: Box): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y - a.h < b.y && a.y > b.y - b.h;
}

/** 발 중앙 x (상태와 무관하게 고정) */
export function footX(p: PlayerSim): number {
  return p.x + cfg.hitbox.run.w / 2;
}

export function playerSize(s: SimState): Size {
  const base = s.player.state === 'slide' ? cfg.hitbox.slide : cfg.hitbox.run;
  const k = s.effects.giant > 0 ? cfg.hitbox.giantScale : 1;
  return { w: base.w * k, h: base.h * k };
}

export function playerBox(s: SimState): Box {
  const { w, h } = playerSize(s);
  return { x: footX(s.player) - w / 2, y: s.player.y, w, h };
}

/** 구간 목록 안에 x가 있는가 (구간은 [start, end)) */
export function inSegments(segs: [number, number][], x: number): boolean {
  // 구간 수가 적으므로 이진 탐색
  let lo = 0;
  let hi = segs.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const [a, b] = segs[mid];
    if (x < a) hi = mid - 1;
    else if (x >= b) lo = mid + 1;
    else return true;
  }
  return false;
}

/** 폭이 minGap 미만인 구멍을 메운 구간 목록 */
export function bridgeGaps(segs: [number, number][], minGap: number): [number, number][] {
  const out: [number, number][] = [];
  for (const [a, b] of segs) {
    const last = out[out.length - 1];
    if (last && a - last[1] < minGap) last[1] = b;
    else out.push([a, b]);
  }
  return out;
}

/** 이번 틱에 발밑을 바닥으로 볼지 (부스터·거대화 예외 포함) */
export function hasFloorUnder(s: SimState): boolean {
  if (s.effects.boost > 0 || s.boostGroundGrace > 0) return true;
  if (s.jevil && s.jevil.phase > 0) return true; // 제빌 대능력 중에는 구멍 위도 바닥
  const fx = footX(s.player);
  if (s.effects.giant > 0) return inSegments(s.giantGround, fx);
  return inSegments(s.ground, fx);
}
