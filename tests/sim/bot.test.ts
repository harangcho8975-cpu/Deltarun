import { describe, expect, it } from 'vitest';
import { stageOrder, stages } from '../../src/data/stages';
import { playWithBot } from '../../src/sim/bot';

describe('자동 플레이 봇', () => {
  for (const id of stageOrder) {
    it(`${id}를 클리어한다`, () => {
      const r = playWithBot(stages[id]);
      expect(r.state.outcome).toBe('cleared');
    });
  }
});
