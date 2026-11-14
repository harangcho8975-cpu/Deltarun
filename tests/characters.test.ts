import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { characterById, characterIndex, characters, DEFAULT_CHARACTER, RARITY } from '../src/data/characters';

const manifest = JSON.parse(readFileSync(join(import.meta.dirname, '../public/assets/manifest.json'), 'utf8')) as { key: string }[];
const keys = new Set(manifest.map((e) => e.key));

describe('캐릭터 데이터', () => {
  it('id가 겹치지 않는다', () => {
    expect(new Set(characters.map((c) => c.id)).size).toBe(characters.length);
  });
  it('모든 캐릭터에 로비·목록·정보 화면 그림 키(char_<id>)가 manifest에 있다', () => {
    for (const c of characters) expect(keys, c.id).toContain(`char_${c.id}`);
  });
  it('정보 화면에 필요한 항목이 다 있다', () => {
    for (const c of characters) {
      expect(RARITY[c.rarity], c.id).toBeDefined();
      expect(c.name && c.tagline && c.skill.name && c.skill.description && c.story, c.id).toBeTruthy();
    }
  });
  it('모르는 id는 기본 캐릭터로', () => {
    expect(characterById('없음').id).toBe(DEFAULT_CHARACTER);
    expect(characterIndex('없음')).toBe(0);
  });
});
