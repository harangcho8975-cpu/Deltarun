// 코인·뽑기·장비 슬롯 수치. 한곳에서 조절한다.
import type { Rarity } from '../data/characters';

export const ECONOMY = {
  /** 새로 시작할 때 가진 코인 (뽑기를 몇 번 해볼 수 있도록) */
  startCoins: 100,
  /** 스테이지를 클리어할 때마다 받는 보너스 코인 (판에서 주운 코인에 더해진다) */
  stageClearBonus: 50,
  /** 한 번에 장착할 수 있는 장비 수 */
  equipSlots: 3,
  /** 뽑기 비용 */
  pullCost: 30,
  pull10Cost: 270,
  /** 뽑기 확률 (합이 1) */
  rates: { common: 0.6, rare: 0.28, epic: 0.1, legendary: 0.02 } as Record<Rarity, number>,
  /** 10회 뽑기는 이 등급 이상이 최소 1개 나온다 */
  pull10MinRarity: 'rare' as Rarity,
  /** 이미 가진 장비가 또 나왔을 때 돌려받는 코인 */
  duplicateRefund: { common: 10, rare: 30, epic: 80, legendary: 200 } as Record<Rarity, number>,
};
