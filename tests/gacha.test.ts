import { describe, expect, it } from 'vitest';
import { ECONOMY } from '../src/config/economy';
import { equipment } from '../src/data/equipment';
import { pull, rollRarity, type Rng } from '../src/gacha/gacha';
import { SaveStore, SAVE_KEY, type KeyValueStorage } from '../src/save/SaveStore';

const memory = (init: Record<string, string> = {}): KeyValueStorage & { data: Record<string, string> } => {
  const data = { ...init };
  return { data, getItem: (k) => data[k] ?? null, setItem: (k, v) => void (data[k] = v) };
};

/** 항상 같은 순서로 나오는 난수 (mulberry32) */
function seeded(seed: number): Rng {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const constant = (x: number): Rng => () => x;
const rich = (storage = memory()) => {
  const s = new SaveStore(storage);
  s.data.coins = 10_000;
  return s;
};

describe('뽑기 확률', () => {
  it('확률의 합은 1이다', () => {
    expect(Object.values(ECONOMY.rates).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
  });

  it('20000번 뽑으면 등급 비율이 설정한 확률과 비슷하다 (±1.5%p)', () => {
    const rng = seeded(1234);
    const n = 20000;
    const count = { common: 0, rare: 0, epic: 0, legendary: 0 };
    for (let i = 0; i < n; i++) count[rollRarity(rng)]++;
    for (const r of ['common', 'rare', 'epic', 'legendary'] as const) {
      expect(Math.abs(count[r] / n - ECONOMY.rates[r]), r).toBeLessThan(0.015);
    }
  });
});

describe('뽑기 진행', () => {
  it('1회: 코인을 쓰고 장비를 하나 얻는다', () => {
    const s = rich();
    const before = s.data.coins;
    const r = pull(s, 1, seeded(7));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.results).toHaveLength(1);
    expect(s.data.coins).toBe(before - ECONOMY.pullCost + r.results[0].refund);
    expect(Object.values(s.data.equipment.owned).reduce((a, b) => a + b, 0)).toBe(1);
    expect(r.results[0].isNew).toBe(true);
  });

  it('코인이 모자라면 아무것도 바뀌지 않는다', () => {
    const s = new SaveStore(memory());
    s.data.coins = ECONOMY.pullCost - 1;
    const r = pull(s, 1, seeded(1));
    expect(r).toEqual({ ok: false, reason: 'coins', need: ECONOMY.pullCost });
    expect(s.data.coins).toBe(ECONOMY.pullCost - 1);
    expect(s.data.equipment.owned).toEqual({});
    s.data.coins = ECONOMY.pull10Cost - 1;
    expect(pull(s, 10, seeded(1)).ok).toBe(false);
  });

  it('10회: 270코인으로 10개를 얻고, 레어 이상이 최소 1개 보장된다', () => {
    // 난수가 항상 0이면 전부 일반이지만, 보장 규칙으로 마지막이 레어 이상이 된다
    const s = rich();
    const r = pull(s, 10, constant(0));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.results).toHaveLength(10);
    expect(r.cost).toBe(ECONOMY.pull10Cost);
    expect(r.results.filter((x) => x.rarity !== 'common').length).toBeGreaterThanOrEqual(1);
    expect(r.results.slice(0, 9).every((x) => x.rarity === 'common')).toBe(true);
  });

  it('여러 번 해도 10회 뽑기마다 레어 이상이 하나 이상 나온다', () => {
    const rng = seeded(99);
    for (let i = 0; i < 200; i++) {
      const s = rich();
      const r = pull(s, 10, rng);
      if (!r.ok) throw new Error('코인 부족');
      expect(r.results.some((x) => x.rarity !== 'common')).toBe(true);
    }
  });

  it('이미 가진 장비가 또 나오면 등급별 코인을 돌려받는다', () => {
    const s = rich();
    const first = pull(s, 1, constant(0)); // 항상 같은 일반 장비
    const second = pull(s, 1, constant(0));
    if (!first.ok || !second.ok) throw new Error('코인 부족');
    expect(first.results[0].isNew).toBe(true);
    expect(first.results[0].refund).toBe(0);
    expect(second.results[0].id).toBe(first.results[0].id);
    expect(second.results[0].isNew).toBe(false);
    expect(second.results[0].refund).toBe(ECONOMY.duplicateRefund.common);
    expect(s.data.equipment.owned[first.results[0].id]).toBe(2);
    expect(s.data.coins).toBe(10_000 - ECONOMY.pullCost * 2 + ECONOMY.duplicateRefund.common);
  });

  it('뽑기 결과는 저장되고 다시 열어도 남아 있다', () => {
    const mem = memory();
    const s = rich(mem);
    s.save();
    pull(s, 10, seeded(5));
    const again = new SaveStore(mem);
    expect(again.data.equipment.owned).toEqual(s.data.equipment.owned);
    expect(again.data.coins).toBe(s.data.coins);
  });
});

describe('장비 장착 (슬롯 3개)', () => {
  const owned = () => {
    const s = rich();
    for (const id of ['sneakers', 'pouch', 'bandage', 'shield']) s.addEquipment(id);
    return s;
  };

  it('최대 3개까지 장착하고, 가득 차면 더 장착하지 못한다', () => {
    const s = owned();
    expect(ECONOMY.equipSlots).toBe(3);
    expect(s.toggleEquip('sneakers')).toBe('equipped');
    expect(s.toggleEquip('pouch')).toBe('equipped');
    expect(s.toggleEquip('bandage')).toBe('equipped');
    expect(s.toggleEquip('shield')).toBe('full'); // 4번째는 장착되지 않는다
    expect(s.data.equipment.equipped).toEqual(['sneakers', 'pouch', 'bandage']);
  });

  it('해제하면 슬롯이 비어 다른 장비를 장착할 수 있다', () => {
    const s = owned();
    s.toggleEquip('sneakers');
    s.toggleEquip('pouch');
    s.toggleEquip('bandage');
    expect(s.toggleEquip('pouch')).toBe('unequipped');
    expect(s.toggleEquip('shield')).toBe('equipped');
    expect(s.data.equipment.equipped).toEqual(['sneakers', 'bandage', 'shield']);
  });

  it('가지고 있지 않은 장비는 장착할 수 없다', () => {
    const s = owned();
    expect(s.toggleEquip('heart')).toBe('not_owned');
    expect(s.data.equipment.equipped).toEqual([]);
  });

  it('장착 상태가 저장된다. 저장이 이상하면(없는 장비·가지지 않은 장비·4개 이상) 걸러낸다', () => {
    const mem = memory();
    const s = new SaveStore(mem);
    s.addEquipment('sneakers');
    s.addEquipment('pouch');
    s.toggleEquip('sneakers');
    expect(new SaveStore(mem).data.equipment.equipped).toEqual(['sneakers']);

    mem.data[SAVE_KEY] = JSON.stringify({
      version: 1, stages: {}, coins: 5,
      equipment: {
        owned: { sneakers: 1, pouch: 1, bandage: 1, shield: 1, 없는장비: 3, heart: -2 },
        equipped: ['sneakers', 'sneakers', '없는장비', 'heart', 'pouch', 'bandage', 'shield'],
      },
    });
    const loaded = new SaveStore(mem);
    expect(Object.keys(loaded.data.equipment.owned).sort()).toEqual(['bandage', 'pouch', 'shield', 'sneakers']);
    expect(loaded.data.equipment.equipped).toEqual(['sneakers', 'pouch', 'bandage']); // 중복·없는 것·가지지 않은 것 제외, 3개까지
  });

  it('예전 저장(장비 항목 없음)도 읽는다', () => {
    const s = new SaveStore(memory({ [SAVE_KEY]: JSON.stringify({ version: 1, stages: {}, coins: 7 }) }));
    expect(s.data.coins).toBe(7);
    expect(s.data.equipment).toEqual({ owned: {}, equipped: [] });
  });

  it('장비 14종이 모두 저장 가능한 id다', () => {
    const s = rich();
    for (const e of equipment) expect(s.addEquipment(e.id).isNew).toBe(true);
    expect(() => s.addEquipment('없는장비')).toThrow();
  });
});
