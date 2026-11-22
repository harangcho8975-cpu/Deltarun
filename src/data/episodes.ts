import { stageOrder, stages } from './stages';

export interface Episode {
  id: string;
  /** 에피소드 번호 (스테이지 이름 앞의 "1-") */
  no: number;
  name: string;
  stageIds: string[];
}

/** 에피소드 목록. 지금은 "시작" 하나에 스테이지 10개 */
export const episodes: Episode[] = [{ id: 'ep1', no: 1, name: '시작', stageIds: stageOrder.filter((id) => id.startsWith('ep1_')) }];

/** "1-3" 같은 스테이지 번호 */
export function stageLabel(id: string): string {
  for (const e of episodes) {
    const i = e.stageIds.indexOf(id);
    if (i >= 0) return `${e.no}-${i + 1}`;
  }
  return id;
}

/** "1-3 숙여서 지나가기" */
export function stageTitle(id: string): string {
  return `${stageLabel(id)}  ${stages[id]?.name ?? ''}`.trim();
}
