// 캐릭터 뽑기. 장비 뽑기와 같은 규칙(중복은 코인 환급, 10회는 레어 이상 보장)이고, 확률·비용·환급만 다르다.
import { ECONOMY } from '../config/economy';
import { characters, type Rarity } from '../data/characters';
import type { SaveStore } from '../save/SaveStore';
import { rollRarity, type PullOutcome, type Rng } from './gacha';

export type Banner = 'normal' | 'pickup';

const ORDER: Rarity[] = ['common', 'rare', 'epic', 'legendary'];

export const ratesFor = (banner: Banner) => (banner === 'pickup' ? ECONOMY.charPickupRates : ECONOMY.charRates);

function rollCharacter(rng: Rng, rarity: Rarity) {
  const list = characters.filter((c) => c.rarity === rarity);
  return list[Math.min(list.length - 1, Math.floor(rng() * list.length))];
}

export function pullCharacters(store: SaveStore, count: 1 | 10, banner: Banner = 'normal', rng: Rng = Math.random): PullOutcome {
  const cost = count === 10 ? ECONOMY.charPull10Cost : ECONOMY.charPullCost;
  if (store.data.coins < cost) return { ok: false, reason: 'coins', need: cost };

  const rates = ratesFor(banner);
  const roll = () => {
    const r = rollRarity(rng, rates);
    if (banner === 'pickup' && r === 'legendary') return characters.find((c) => c.id === ECONOMY.pickupCharacter)!;
    return rollCharacter(rng, r);
  };
  const rolled = Array.from({ length: count }, roll);
  const min = ORDER.indexOf(ECONOMY.pull10MinRarity);
  if (count === 10 && !rolled.some((c) => ORDER.indexOf(c.rarity) >= min)) {
    rolled[rolled.length - 1] = rollCharacter(rng, ECONOMY.pull10MinRarity);
  }

  store.spendCoins(cost);
  const results = rolled.map((c) => {
    const { isNew } = store.addCharacter(c.id);
    const refund = isNew ? 0 : ECONOMY.charDuplicateRefund[c.rarity];
    if (refund) store.addCoins(refund);
    return { id: c.id, rarity: c.rarity, isNew, refund };
  });
  store.save();
  return { ok: true, results, cost };
}
