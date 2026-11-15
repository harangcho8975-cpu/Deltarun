// 장비 뽑기. 난수는 바깥에서 넣을 수 있어(테스트) 결과를 똑같이 재현할 수 있다.
// 게임 규칙(sim)이 아니라 메뉴 쪽이라 Math.random을 써도 된다.
import { ECONOMY } from '../config/economy';
import { RARITY, type Rarity } from '../data/characters';
import { equipmentByRarity, equipmentById, type Equipment } from '../data/equipment';
import type { SaveStore } from '../save/SaveStore';

export type Rng = () => number;

const ORDER: Rarity[] = ['common', 'rare', 'epic', 'legendary'];

export function rollRarity(rng: Rng): Rarity {
  const x = rng();
  let acc = 0;
  for (const r of ORDER) {
    acc += ECONOMY.rates[r];
    if (x < acc) return r;
  }
  return 'common';
}

export function rollEquipment(rng: Rng, rarity: Rarity): Equipment {
  const list = equipmentByRarity(rarity);
  return list[Math.min(list.length - 1, Math.floor(rng() * list.length))];
}

const atLeast = (r: Rarity, min: Rarity) => ORDER.indexOf(r) >= ORDER.indexOf(min);

export interface PullResult {
  id: string;
  rarity: Rarity;
  /** 처음 얻은 장비인가 */
  isNew: boolean;
  /** 이미 가지고 있어서 돌려받은 코인 (새 장비면 0) */
  refund: number;
}

export type PullOutcome = { ok: true; results: PullResult[]; cost: number } | { ok: false; reason: 'coins'; need: number };

/** count회 뽑는다 (1 또는 10). 코인이 모자라면 아무것도 바꾸지 않는다. */
export function pull(store: SaveStore, count: 1 | 10, rng: Rng = Math.random): PullOutcome {
  const cost = count === 10 ? ECONOMY.pull10Cost : ECONOMY.pullCost;
  if (store.data.coins < cost) return { ok: false, reason: 'coins', need: cost };

  const rolled: Equipment[] = [];
  for (let i = 0; i < count; i++) rolled.push(rollEquipment(rng, rollRarity(rng)));
  // 10회 뽑기 보장: 레어 이상이 하나도 없으면 마지막을 레어로 올린다
  if (count === 10 && !rolled.some((e) => atLeast(e.rarity, ECONOMY.pull10MinRarity))) {
    rolled[rolled.length - 1] = rollEquipment(rng, ECONOMY.pull10MinRarity);
  }

  store.spendCoins(cost);
  const results: PullResult[] = rolled.map((e) => {
    const { isNew } = store.addEquipment(e.id);
    const refund = isNew ? 0 : ECONOMY.duplicateRefund[e.rarity];
    if (refund) store.addCoins(refund);
    return { id: e.id, rarity: e.rarity, isNew, refund };
  });
  store.save();
  return { ok: true, results, cost };
}

export function rarityLabel(id: string): string {
  const e = equipmentById(id);
  return e ? RARITY[e.rarity].label : '';
}
