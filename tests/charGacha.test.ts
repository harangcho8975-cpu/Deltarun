import { describe, expect, it } from 'vitest';
import { ECONOMY } from '../src/config/economy';
import { characters } from '../src/data/characters';
import { pullCharacters, ratesFor } from '../src/gacha/characterGacha';
import { SaveStore, type KeyValueStorage } from '../src/save/SaveStore';

const mem = (): KeyValueStorage & { m: Map<string, string> } => {
  const m = new Map<string, string>();
  return { m, getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v) };
};
const seq = (...xs: number[]) => {
  let i = 0;
  return () => xs[i++ % xs.length];
};

describe('캐릭터 소유', () => {
  it('처음에는 시작 캐릭터만 가지고 있다', () => {
    const s = new SaveStore(mem());
    expect(s.data.ownedCharacters).toEqual(ECONOMY.startCharacters);
    expect(s.ownsCharacter('chaosking')).toBe(false);
  });
  it('가지지 않은 캐릭터는 선택할 수 없다', () => {
    const s = new SaveStore(mem());
    s.setCharacter('chaosking');
    expect(s.data.selectedCharacter).not.toBe('chaosking');
    s.addCharacter('chaosking');
    s.setCharacter('chaosking');
    expect(s.data.selectedCharacter).toBe('chaosking');
  });
  it('예전 저장(소유 목록 없음)에서 고른 캐릭터는 계속 쓸 수 있다', () => {
    const st = mem();
    st.setItem('deltarun.save', JSON.stringify({ version: 1, selectedCharacter: 'mint', coins: 5, stages: {} }));
    const s = new SaveStore(st);
    expect(s.ownsCharacter('mint')).toBe(true);
  });
});

describe('캐릭터 뽑기', () => {
  it('확률 합이 1이고 픽업은 레전드가 더 높다', () => {
    for (const b of ['normal', 'pickup'] as const) {
      const r = ratesFor(b);
      expect(r.common + r.rare + r.epic + r.legendary).toBeCloseTo(1);
    }
    expect(ECONOMY.charPickupRates.legendary).toBeGreaterThan(ECONOMY.charRates.legendary);
  });
  it('코인이 모자라면 아무것도 바뀌지 않는다', () => {
    const s = new SaveStore(mem());
    s.spendCoins(s.data.coins - 10);
    const out = pullCharacters(s, 1);
    expect(out).toEqual({ ok: false, reason: 'coins', need: ECONOMY.charPullCost });
  });
  it('새 캐릭터를 얻고 코인을 쓴다', () => {
    const s = new SaveStore(mem());
    s.addCoins(1000);
    const before = s.data.coins;
    const out = pullCharacters(s, 1, 'normal', seq(0.99, 0.0)); // 레전드 구간, 첫 번째 레전드
    expect(out.ok && out.results[0]).toMatchObject({ id: 'chaosking', isNew: true, refund: 0 });
    expect(s.data.coins).toBe(before - ECONOMY.charPullCost);
    expect(s.ownsCharacter('chaosking')).toBe(true);
  });
  it('픽업 뽑기에서 레전드가 나오면 언제나 픽업 캐릭터', () => {
    const s = new SaveStore(mem());
    s.addCoins(1000);
    const out = pullCharacters(s, 1, 'pickup', seq(0.99, 0.99));
    expect(out.ok && out.results[0].id).toBe(ECONOMY.pickupCharacter);
  });

  it('중복이면 코인을 돌려받는다', () => {
    const s = new SaveStore(mem());
    s.addCoins(1000);
    const out = pullCharacters(s, 1, 'normal', seq(0.0, 0.0)); // 일반 → 첫 일반 캐릭터(이미 보유)
    expect(out.ok && out.results[0].isNew).toBe(false);
    expect(s.data.coins).toBe(100 + 1000 - ECONOMY.charPullCost + ECONOMY.charDuplicateRefund.common);
  });
  it('10회는 레어 이상이 최소 1개', () => {
    const s = new SaveStore(mem());
    s.addCoins(5000);
    const out = pullCharacters(s, 10, 'normal', seq(0.0));
    expect(out.ok && out.results.some((r) => r.rarity !== 'common')).toBe(true);
    expect(out.ok && out.results).toHaveLength(10);
  });
  it('보유 캐릭터는 저장에 남는다', () => {
    const st = mem();
    const s = new SaveStore(st);
    s.addCoins(500);
    pullCharacters(s, 1, 'pickup', seq(0.99));
    expect(new SaveStore(st).ownsCharacter(characters.find((c) => c.rarity === 'legendary')!.id)).toBe(true);
  });
});

describe('출석 이벤트', () => {
  it('하루에 한 번만 받는다', () => {
    const s = new SaveStore(mem());
    const c0 = s.data.coins;
    expect(s.claimAttendance('2026-11-15')).toBe(ECONOMY.attendanceCoins);
    expect(s.claimAttendance('2026-11-15')).toBe(0);
    expect(s.claimAttendance('2026-11-16')).toBe(ECONOMY.attendanceCoins);
    expect(s.data.coins).toBe(c0 + ECONOMY.attendanceCoins * 2);
  });
});
