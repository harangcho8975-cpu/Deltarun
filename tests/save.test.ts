import { describe, expect, it } from 'vitest';
import { SAVE_KEY, SaveStore, type KeyValueStorage } from '../src/save/SaveStore';

const memory = (init: Record<string, string> = {}): KeyValueStorage & { data: Record<string, string> } => {
  const data = { ...init };
  return { data, getItem: (k) => data[k] ?? null, setItem: (k, v) => void (data[k] = v) };
};

describe('저장', () => {
  it('깨진 JSON이면 기본값', () => {
    const s = new SaveStore(memory({ [SAVE_KEY]: '{not json' }));
    expect(s.data.coins).toBe(0);
    expect(s.data.settings).toEqual({ bgm: true, sfx: true });
  });

  it('저장소 접근이 예외를 던져도 멈추지 않는다', () => {
    const broken: KeyValueStorage = {
      getItem: () => { throw new Error('denied'); },
      setItem: () => { throw new Error('denied'); },
    };
    const s = new SaveStore(broken);
    expect(() => s.applyRun({ stageId: 'stage_01', cleared: true, score: 10, stars: 1, coins: 1 })).not.toThrow();
  });

  it('최고기록은 더 클 때만 갱신, 코인은 누적, 해금 규칙', () => {
    const mem = memory();
    const s = new SaveStore(mem);
    const order = ['stage_01', 'stage_02', 'stage_03'];
    expect(s.isUnlocked(order, 'stage_01')).toBe(true);
    expect(s.isUnlocked(order, 'stage_02')).toBe(false);

    expect(s.applyRun({ stageId: 'stage_01', cleared: false, score: 500, stars: 0, coins: 2 }).newBest).toBe(true);
    expect(s.isUnlocked(order, 'stage_02')).toBe(false);
    expect(s.applyRun({ stageId: 'stage_01', cleared: true, score: 400, stars: 2, coins: 1 }).newBest).toBe(false);
    expect(s.record('stage_01')).toEqual({ cleared: true, bestScore: 500, bestStars: 2 });
    expect(s.data.coins).toBe(3);
    expect(s.isUnlocked(order, 'stage_02')).toBe(true);

    const reloaded = new SaveStore(mem);
    expect(reloaded.record('stage_01').bestScore).toBe(500);
  });
});
