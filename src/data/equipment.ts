// 장비 목록. 이름·설명은 자리표시다. 효과는 src/sim/modifiers.ts 의 숫자로 게임 규칙에 반영된다.
// 한 번에 3개까지 장착할 수 있고, 같은 장비를 두 개 장착할 수는 없다.
import { combineMods, type Modifiers } from '../sim/modifiers';
import type { Rarity } from './characters';

export interface Equipment {
  id: string;
  name: string;
  rarity: Rarity;
  effect: Partial<Modifiers>;
}

export const equipment: Equipment[] = [
  // 일반
  { id: 'sneakers', name: '튼튼한 운동화', rarity: 'common', effect: { hitDamageReduce: 3 } },
  { id: 'pouch', name: '작은 주머니', rarity: 'common', effect: { coinBonus: 1 } },
  { id: 'bandage', name: '응급 반창고', rarity: 'common', effect: { healBonus: 10 } },
  { id: 'sole', name: '고무 밑창', rarity: 'common', effect: { coyoteBonus: 2 } },
  // 레어
  { id: 'shield', name: '철제 방패', rarity: 'rare', effect: { invulnOnHitBonus: 30 } },
  { id: 'bracelet', name: '자석 팔찌', rarity: 'rare', effect: { passiveMagnetRadius: 120 } },
  { id: 'bottle', name: '마라토너 물통', rarity: 'rare', effect: { hpDrainMul: 0.8 } },
  { id: 'lens', name: '젤리 돋보기', rarity: 'rare', effect: { jellyScorePct: 20 } },
  // 에픽
  { id: 'armor', name: '용사의 갑옷', rarity: 'epic', effect: { maxHpBonus: 20 } },
  { id: 'goldpouch', name: '황금 주머니', rarity: 'epic', effect: { coinBonus: 2 } },
  { id: 'windshoes', name: '바람의 신발', rarity: 'epic', effect: { coyoteBonus: 4, bufferBonus: 4 } },
  // 레전드
  { id: 'angelwing', name: '수호천사 날개', rarity: 'legendary', effect: { invulnOnHitBonus: 60, hitDamageReduce: 5 } },
  { id: 'kingmagnet', name: '왕의 자석', rarity: 'legendary', effect: { passiveMagnetRadius: 220, jellyScorePct: 30 } },
  { id: 'heart', name: '불굴의 심장', rarity: 'legendary', effect: { maxHpBonus: 40, hpDrainMul: 0.7 } },
];

export function equipmentById(id: string): Equipment | undefined {
  return equipment.find((e) => e.id === id);
}

export function equipmentByRarity(r: Rarity): Equipment[] {
  return equipment.filter((e) => e.rarity === r);
}

/** 장착한 장비 id들의 효과를 합친다 (모르는 id는 무시) */
export function modsFor(ids: string[]): Modifiers {
  return combineMods(ids.map((id) => equipmentById(id)?.effect ?? {}));
}

const sec = (ticks: number) => `${(ticks / 60).toFixed(1)}초`;

/** 효과를 사람이 읽을 문장 목록으로 */
export function describeEffect(e: Partial<Modifiers>): string[] {
  const out: string[] = [];
  if (e.maxHpBonus) out.push(`최대 체력 +${e.maxHpBonus}`);
  if (e.hitDamageReduce) out.push(`받는 피해 −${e.hitDamageReduce}`);
  if (e.hpDrainMul !== undefined && e.hpDrainMul !== 1) out.push(`체력 감소 −${Math.round((1 - e.hpDrainMul) * 100)}%`);
  if (e.invulnOnHitBonus) out.push(`피격 후 무적 +${sec(e.invulnOnHitBonus)}`);
  if (e.coyoteBonus) out.push(`바닥 끝 점프 여유 +${e.coyoteBonus}틱`);
  if (e.bufferBonus) out.push(`착지 전 점프 입력 +${e.bufferBonus}틱`);
  if (e.coinBonus) out.push(`코인을 주울 때 +${e.coinBonus}`);
  if (e.jellyScorePct) out.push(`젤리 점수 +${e.jellyScorePct}%`);
  if (e.passiveMagnetRadius) out.push(`젤리를 ${e.passiveMagnetRadius}px 안에서 끌어당김`);
  if (e.healBonus) out.push(`회복 아이템 +${e.healBonus}`);
  return out;
}
