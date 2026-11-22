// npm run stages — 맵 "시작"을 만든다. 카카오 쿠키런처럼 한 맵 안에 스테이지 10개가 이어져 있고,
// 일정 거리를 가면 다음 스테이지 구간으로 들어간다. 배치는 scripts/stages/episode1.ts,
// 점프 시점과 젤리 길은 실제 물리로 계산한다 (scripts/lib/stageBuilder.ts).
import { mkdirSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { StageBuilder, toTmj } from './lib/stageBuilder';
import { EPISODE1 } from './stages/episode1';

const mapsDir = join(import.meta.dirname, '..', 'maps');
const replayDir = join(import.meta.dirname, '..', 'tests', 'replays');
mkdirSync(replayDir, { recursive: true });
for (const f of readdirSync(mapsDir)) if (f.endsWith('.tmj')) unlinkSync(join(mapsDir, f));

const b = new StageBuilder({ id: 'ep1', name: '시작', bgm: 'bgm_stage1' });
EPISODE1.forEach((def, i) => {
  b.section(def.spec.name);
  // 스테이지가 바뀌는 곳에는 회복 물약 두 개 (한 맵을 6분 가까이 달리므로)
  if (i > 0) b.run(200).item('item_heal', 260).item('item_heal', 200);
  def.build(b);
});
const { stage, perfect, report } = b.build();
writeFileSync(join(mapsDir, `${stage.id}.tmj`), JSON.stringify(toTmj(stage), null, 1) + '\n');
// 정답 조작: 이대로 달리면 맞지 않고 젤리를 전부 먹는다 (tests/stages.test.ts 가 확인)
writeFileSync(join(replayDir, `${stage.id}.perfect.replay.json`), JSON.stringify(perfect) + '\n');
console.log('✓ ' + report);
for (const s of stage.sections ?? []) console.log(`   STAGE ${stage.sections!.indexOf(s) + 1} ${s.name}: x = ${s.x} (${(s.x / stage.speed).toFixed(0)}초)`);
