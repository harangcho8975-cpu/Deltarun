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

  for (const id of stageOrder) {
    it(`${id}를 카오스 킹(스킬 켬)으로도 클리어하고 코인을 모은다`, () => {
      const r = playWithBot(stages[id], undefined, 'chaosKing');
      expect(r.state.outcome).toBe('cleared');
      expect(r.state.coins).toBeGreaterThan(0); // 박스가 모은 코인이 터지며 지급됨
    });
  }
});
