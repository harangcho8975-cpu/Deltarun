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
      expect(c.name && c.tagline && c.story, c.id).toBeTruthy();
      for (const a of c.abilities) expect(a.name && a.description, `${c.id} 능력`).toBeTruthy();
    }
  });
  it('프리스크는 능력이 없고, 카오스 킹은 소능력·대능력이 있으며 둘 다 게임에서 동작한다', () => {
    expect(characterById('frisk').abilities).toHaveLength(0);
    expect(characterById('frisk').skillId).toBeUndefined();
    const k = characterById('chaosking');
    expect(k.abilities.map((a) => a.kind)).toEqual(['minor', 'ultimate']);
    expect(k.abilities.every((a) => a.active)).toBe(true);
    expect(k.skillId).toBe('chaosKing');
  });
  it('게임에서 동작하는 능력(active)이 있는 캐릭터는 skillId가 있다', () => {
    for (const c of characters) expect(c.abilities.some((a) => a.active), c.id).toBe(!!c.skillId);
  });
  it('모르는 id는 기본 캐릭터로', () => {
    expect(characterById('없음').id).toBe(DEFAULT_CHARACTER);
    expect(characterIndex('없음')).toBe(0);
  });
});
