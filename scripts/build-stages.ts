// npm run stages — 에피소드 1 "시작"의 스테이지 10개를 만들어 maps/ep1_XX.tmj 로 쓴다.
// 배치만 여기서 정하고, 점프 시점과 젤리 길은 실제 물리로 계산한다 (scripts/lib/stageBuilder.ts).
import { mkdirSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { StageBuilder, toTmj } from './lib/stageBuilder';
import { EPISODE1 } from './stages/episode1';

const mapsDir = join(import.meta.dirname, '..', 'maps');
const replayDir = join(import.meta.dirname, '..', 'tests', 'replays');
mkdirSync(replayDir, { recursive: true });
// 예전 맵은 지운다 (에피소드 맵만 남긴다)
for (const f of readdirSync(mapsDir)) if (f.endsWith('.tmj')) unlinkSync(join(mapsDir, f));

for (const def of EPISODE1) {
  const b = new StageBuilder(def.spec);
  def.build(b);
  const { stage, perfect, report } = b.build();
  writeFileSync(join(mapsDir, `${stage.id}.tmj`), JSON.stringify(toTmj(stage), null, 1) + '\n');
  // 정답 조작: 이대로 달리면 맞지 않고 젤리를 전부 먹는다 (tests/stages.test.ts 가 확인)
  writeFileSync(join(replayDir, `${stage.id}.perfect.replay.json`), JSON.stringify(perfect) + '\n');
  console.log('✓ ' + report);
}
