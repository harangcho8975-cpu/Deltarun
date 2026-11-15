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
  /** 캐릭터 뽑기 */
  charPullCost: 100,
  charPull10Cost: 900,
  charRates: { common: 0.5, rare: 0.3, epic: 0.17, legendary: 0.03 } as Record<Rarity, number>,
  /** 픽업(이벤트) 뽑기: 레전드 확률이 올라간다 */
  charPickupRates: { common: 0.44, rare: 0.28, epic: 0.2, legendary: 0.08 } as Record<Rarity, number>,
  charDuplicateRefund: { common: 30, rare: 80, epic: 200, legendary: 500 } as Record<Rarity, number>,
  /** 처음부터 가지고 있는 캐릭터 */
  startCharacters: ['orange', 'frisk'],
  /** 이벤트: 하루 한 번 출석 보상 */
  attendanceCoins: 100,
};
