import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { configHash } from '../../src/config/gameConfig';
import { stageOrder, stages } from '../../src/data/stages';
import { runReplay, type Replay } from '../../src/sim';

const dir = join(import.meta.dirname, '../replays');
const files = readdirSync(dir).filter((f) => f.endsWith('.replay.json'));

describe('저장된 리플레이', () => {
  it('모든 스테이지에 리플레이가 있다', () => {
    for (const id of stageOrder) expect(files).toContain(`${id}.replay.json`);
  });

  for (const f of files) {
    it(`${f}가 cleared로 끝난다`, () => {
      const replay = JSON.parse(readFileSync(join(dir, f), 'utf8')) as Replay;
      expect(replay.configHash, '설정이 바뀌었습니다: npm run replays 로 재녹화 필요').toBe(configHash());
      const { state } = runReplay(stages[replay.stageId], replay);
      expect(state.outcome).toBe('cleared');
    });
  }
});
