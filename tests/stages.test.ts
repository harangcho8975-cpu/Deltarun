import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { episodes, stageLabel } from '../src/data/episodes';
import { validateStage } from '../src/data/schema';
import { stageOrder, stages } from '../src/data/stages';
import testStage from '../src/data/stage_test.json';
import { runReplay, starsFor, type Replay } from '../src/sim';

describe('스테이지 데이터', () => {
  it('에피소드 "시작"에 스테이지 10개가 순서대로 있다', () => {
    expect(stageOrder).toEqual(Array.from({ length: 10 }, (_, i) => `ep1_${String(i + 1).padStart(2, '0')}`));
    expect(episodes[0].name).toBe('시작');
    expect(episodes[0].stageIds).toHaveLength(10);
    expect(stageLabel('ep1_01')).toBe('1-1');
    expect(stageLabel('ep1_10')).toBe('1-10');
  });
  for (const id of stageOrder) {
    it(`${id}는 스키마 검증을 통과한다`, () => {
      expect(validateStage(stages[id])).toEqual([]);
    });
  }
  it('stage_test.json도 통과한다', () => {
    expect(validateStage(testStage)).toEqual([]);
  });
  it('모든 스테이지 속도 620, 뒤로 갈수록 대체로 길어진다', () => {
    for (const id of stageOrder) expect(stages[id].speed).toBe(620);
    expect(stages.ep1_10.length).toBeGreaterThan(stages.ep1_01.length);
  });
  it('스테이지마다 카드 젤리와 델타룬 문양 젤리가 있고, 마지막 스테이지는 룬이 2개', () => {
    for (const id of stageOrder) {
      const j = stages[id].jellies;
      expect(j.filter((x) => x.type === 'jelly_card').length).toBeGreaterThanOrEqual(2);
      expect(j.filter((x) => x.type === 'jelly_rune').length).toBeGreaterThanOrEqual(1);
    }
    expect(stages.ep1_10.jellies.filter((x) => x.type === 'jelly_rune')).toHaveLength(2);
  });
  it('젤리끼리 겹치지 않는다 (가장 가까운 두 젤리 중심이 크기만큼 떨어져 있다)', () => {
    for (const id of stageOrder) {
      const j = stages[id].jellies;
      for (let a = 0; a < j.length; a++) {
        for (let b = a + 1; b < j.length && j[b].x - j[a].x < 140; b++) {
          const d = Math.hypot(j[a].x - j[b].x, j[a].y - j[b].y);
          expect(d, `${id} ${JSON.stringify(j[a])} ${JSON.stringify(j[b])}`).toBeGreaterThan(28);
        }
      }
    }
  });
});

describe('젤리 길: 알맞게 움직이면 젤리를 전부 먹는다', () => {
  for (const id of stageOrder) {
    it(`${id} 정답 조작으로 달리면 맞지 않고 젤리 100%, 별 3개`, () => {
      const replay = JSON.parse(readFileSync(join(import.meta.dirname, 'replays', `${id}.perfect.replay.json`), 'utf8')) as Replay;
      const { state } = runReplay(stages[id], replay);
      expect(state.outcome).toBe('cleared');
      expect(state.jelliesTaken).toBe(state.jelliesTotal);
      expect(starsFor(state)).toBe(3);
    });
  }
});
