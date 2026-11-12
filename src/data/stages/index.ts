// 자동 생성 파일 (npm run maps). 직접 고치지 마세요.
import type { StageData } from '../schema';
import stage_01 from './stage_01.json';
import stage_02 from './stage_02.json';
import stage_03 from './stage_03.json';

export const stageOrder: string[] = ["stage_01","stage_02","stage_03"];
export const stages: Record<string, StageData> = {
  "stage_01": stage_01 as StageData,
  "stage_02": stage_02 as StageData,
  "stage_03": stage_03 as StageData,
};
