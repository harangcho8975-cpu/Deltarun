import { describe, expect, it } from 'vitest';
import { validateStage } from '../src/data/schema';
import { stageOrder, stages } from '../src/data/stages';
import testStage from '../src/data/stage_test.json';

describe('스테이지 데이터', () => {
  it('스테이지 3개가 순서대로 있다', () => {
    expect(stageOrder).toEqual(['stage_01', 'stage_02', 'stage_03']);
  });
  for (const id of stageOrder) {
    it(`${id}는 스키마 검증을 통과한다`, () => {
      expect(validateStage(stages[id])).toEqual([]);
    });
  }
  it('stage_test.json도 통과한다', () => {
    expect(validateStage(testStage)).toEqual([]);
  });
  it('기획서의 길이·속도', () => {
    expect([stages.stage_01.length, stages.stage_01.speed]).toEqual([12000, 420]);
    expect([stages.stage_02.length, stages.stage_02.speed]).toEqual([18000, 500]);
    expect([stages.stage_03.length, stages.stage_03.speed]).toEqual([24000, 580]);
  });
});
