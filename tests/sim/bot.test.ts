import { describe, expect, it } from 'vitest';
import type { StageData } from '../../src/data/schema';
import { stages } from '../../src/data/stages';
import { playWithBot } from '../../src/sim/bot';

/** 맵 앞부분(스테이지 n개 구간)만 잘라 낸다: 전체 맵(6분)은 리플레이 녹화(npm run replays)에서 봇이 완주한다 */
function firstSections(stage: StageData, n: number): StageData {
  const end = stage.sections![n].x;
  const goalX = end - 200;
  const length = end + 640;
  return {
    ...stage,
    length,
    goalX,
    ground: stage.ground.filter(([a]) => a < length).map(([a, b]) => [a, Math.min(b, length)] as [number, number]),
    obstacles: stage.obstacles.filter((o) => o.x < goalX),
    jellies: stage.jellies.filter((j) => j.x < goalX),
    items: stage.items.filter((it) => it.x < goalX),
    sections: stage.sections!.slice(0, n),
  };
}

describe('자동 플레이 봇', () => {
  const part = firstSections(stages.ep1, 3);

  it('맵 "시작"의 앞 3개 스테이지를 피격 없이 지난다', () => {
    const r = playWithBot(part);
    expect(r.state.outcome).toBe('cleared');
    expect(r.hits).toBe(0);
  }, 180_000);

  it('카오스 킹(스킬 켬)으로도 지나고 코인을 모은다', () => {
    const r = playWithBot(part, undefined, 'chaosKing');
    expect(r.state.outcome).toBe('cleared');
    expect(r.state.coins).toBeGreaterThan(0);
  }, 180_000);
});
