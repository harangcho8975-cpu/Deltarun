import { gameConfig as cfg } from '../config/gameConfig';
import type { SimState } from './types';

/** 4장 7번: 커서를 카메라 뒤쪽까지 전진시키고, 검사할 [from, to) 범위를 돌려준다. */
export function activeRange(s: SimState): [number, number] {
  const ents = s.entities;
  const behind = s.cameraX - cfg.activeBehind;
  while (s.cursor < ents.length && ents[s.cursor].x + ents[s.cursor].w < behind) s.cursor++;
  const ahead = s.cameraX + cfg.activeAhead;
  let to = s.cursor;
  while (to < ents.length && ents[to].x <= ahead) to++;
  return [s.cursor, to];
}
