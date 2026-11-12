import { gameConfig as cfg } from '../config/gameConfig';
import type { SimState } from './types';

export function totalScore(s: SimState): number {
  return s.jellyScore + s.distance;
}

/** 젤리 수집률(코인 제외)로 별 0~3개. 실패하면 0. */
export function starsFor(s: SimState): 0 | 1 | 2 | 3 {
  if (s.outcome !== 'cleared') return 0;
  const ratio = s.jelliesTotal === 0 ? 1 : s.jelliesTaken / s.jelliesTotal;
  return s.stage.stars.filter((t) => ratio >= t).length as 0 | 1 | 2 | 3;
}

export function distanceMeters(x: number): number {
  return Math.floor(x / cfg.pxPerMeter);
}
