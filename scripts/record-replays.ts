// npm run replays — 자동 플레이 봇으로 각 스테이지 클리어 리플레이를 다시 녹화한다.
// 맵이나 gameConfig 수치를 바꾼 뒤 실행한다.
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { stageOrder, stages } from '../src/data/stages';
import { playWithBot } from '../src/sim/bot';
import { starsFor, totalScore } from '../src/sim/scoring';

const dir = join(import.meta.dirname, '../tests/replays');
mkdirSync(dir, { recursive: true });
let failed = false;
for (const id of stageOrder) {
  const r = playWithBot(stages[id]);
  const s = r.state;
  if (s.outcome !== 'cleared') {
    failed = true;
    console.error(`✗ ${id}: 봇이 클리어하지 못함 (${s.failReason}, x = ${Math.round(s.player.x)})`);
    continue;
  }
  writeFileSync(join(dir, `${id}.replay.json`), JSON.stringify(r.replay) + '\n');
  console.log(`✓ ${id}: ${s.tick}틱, 피격 ${r.hits}, 점수 ${totalScore(s)}, 별 ${starsFor(s)}, 입력 ${r.replay.inputs.length}개`);
}
if (failed) process.exit(1);
