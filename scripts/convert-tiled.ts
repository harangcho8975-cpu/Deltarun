// npm run maps — maps/*.tmj → src/data/stages/<id>.json + index.ts
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { convertTiled, type TiledMap } from './lib/convertTiled';

const root = join(import.meta.dirname, '..');
const mapsDir = join(root, 'maps');
const outDir = join(root, 'src/data/stages');
mkdirSync(outDir, { recursive: true });

const files = readdirSync(mapsDir)
  .filter((f) => f.endsWith('.tmj'))
  .sort();

const ids: string[] = [];
let failed = false;
for (const f of files) {
  const map = JSON.parse(readFileSync(join(mapsDir, f), 'utf8')) as TiledMap;
  const { stage, errors } = convertTiled(map, f);
  if (!stage) {
    failed = true;
    for (const e of errors) console.error(`✗ ${e}`);
    continue;
  }
  writeFileSync(join(outDir, `${stage.id}.json`), JSON.stringify(stage) + '\n');
  ids.push(stage.id);
  console.log(
    `✓ ${f} → ${stage.id}.json  (길이 ${stage.length}px, 장애물 ${stage.obstacles.length}, 젤리 ${stage.jellies.length}, 아이템 ${stage.items.length})`,
  );
}

if (failed) {
  console.error('변환 실패: 위 오류를 고친 뒤 다시 실행하세요.');
  process.exit(1);
}

// 파일 이름 순서가 곧 스테이지 순서다.
const ident = (id: string) => id.replace(/[^a-zA-Z0-9_]/g, '_');
const index =
  `// 자동 생성 파일 (npm run maps). 직접 고치지 마세요.\n` +
  `import type { StageData } from '../schema';\n` +
  ids.map((id) => `import ${ident(id)} from './${id}.json';\n`).join('') +
  `\nexport const stageOrder: string[] = ${JSON.stringify(ids)};\n` +
  `export const stages: Record<string, StageData> = {\n` +
  ids.map((id) => `  ${JSON.stringify(id)}: ${ident(id)} as StageData,\n`).join('') +
  `};\n`;
writeFileSync(join(outDir, 'index.ts'), index);
console.log(`index.ts: ${ids.length}개 스테이지`);
