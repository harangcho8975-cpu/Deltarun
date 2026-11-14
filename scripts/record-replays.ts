// npm run replays — 자동 플레이 봇으로 각 스테이지 클리어 리플레이를 다시 녹화한다.
// 맵이나 gameConfig 수치, 시뮬레이션 규칙을 바꾼 뒤 실행한다.
// 스킬이 있는 캐릭터는 스킬을 켠 리플레이를 따로 만든다 (stage_01.chaosking.replay.json).
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { stageOrder, stages } from '../src/data/stages';
import { playWithBot } from '../src/sim/bot';
import { starsFor, totalScore } from '../src/sim/scoring';
import type { SkillId } from '../src/sim/types';

const dir = join(import.meta.dirname, '../tests/replays');
mkdirSync(dir, { recursive: true });

const variants: { label: string; suffix: string; skill: SkillId | null }[] = [
  { label: '기본', suffix: '', skill: null },
  { label: '카오스 킹', suffix: '.chaosking', skill: 'chaosKing' },
];

let failed = false;
for (const v of variants) {
  for (const id of stageOrder) {
    const r = playWithBot(stages[id], undefined, v.skill);
    const s = r.state;
    if (s.outcome !== 'cleared') {
      failed = true;
      console.error(`✗ ${id} (${v.label}): 봇이 클리어하지 못함 (${s.failReason}, x = ${Math.round(s.player.x)})`);
      continue;
    }
    writeFileSync(join(dir, `${id}${v.suffix}.replay.json`), JSON.stringify(r.replay) + '\n');
    console.log(`✓ ${id} (${v.label}): ${s.tick}틱, 피격 ${r.hits}, 코인 ${s.coins}, 점수 ${totalScore(s)}, 별 ${starsFor(s)}, 입력 ${r.replay.inputs.length}개`);
  }
}
if (failed) process.exit(1);
