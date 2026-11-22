import type { StageData } from './schema';
import { stageOrder, stages } from './stages';

/**
 * 맵 목록. 카카오 쿠키런처럼 맵 하나 안에 스테이지 구간이 여러 개 이어져 있다 (StageData.sections).
 * 맵 id가 곧 스테이지 데이터 id다.
 */
export const maps: string[] = stageOrder;

/** 화면에 쓰는 맵 이름 */
export function stageTitle(id: string): string {
  return stages[id]?.name ?? id;
}

/** x 위치가 몇 번째 스테이지 구간인지 (0부터). 구간이 없으면 0 */
export function sectionAt(stage: StageData, x: number): number {
  const secs = stage.sections ?? [];
  let i = 0;
  for (let k = 0; k < secs.length; k++) if (x >= secs[k].x) i = k;
  return i;
}

export function sectionCount(stage: StageData): number {
  return Math.max(1, stage.sections?.length ?? 1);
}
