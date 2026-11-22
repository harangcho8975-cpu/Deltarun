import { describe, expect, it } from 'vitest';
import { stages } from '../../src/data/stages';
import { runReplay, type Replay } from '../../src/sim';
import { configHash } from '../../src/config/gameConfig';

describe('결정성', () => {
  it('같은 입력 기록을 두 번 돌리면 매 틱 해시가 같다', () => {
    const replay: Replay = {
      stageId: 'ep1_02',
      configHash: configHash(),
      inputs: Array.from({ length: 200 }, (_, i) => [i * 13 + 5, (['J', 'S+', 'S-'] as const)[i % 3]]),
    };
    const a = runReplay(stages.ep1_02, replay, 3000, true);
    const b = runReplay(stages.ep1_02, replay, 3000, true);
    expect(a.hashes.length).toBeGreaterThan(100);
    expect(a.hashes).toEqual(b.hashes);
  });
});
