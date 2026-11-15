// 장비가 게임 규칙에 주는 효과 모음. 장비 3개의 효과를 합친 값을 createSim에 넘긴다.
// sim은 장비 이름·종류를 모르고 이 숫자들만 안다. (데이터는 src/data/equipment.ts)

export interface Modifiers {
  /** 최대 체력 + (시작 체력도 함께 늘어난다) */
  maxHpBonus: number;
  /** 장애물에 맞을 때 받는 피해 − (최소 1) */
  hitDamageReduce: number;
  /** 시간에 따른 체력 감소 배율 (1 = 그대로, 0.8 = 20% 느리게) */
  hpDrainMul: number;
  /** 피격 직후 무적 틱 + */
  invulnOnHitBonus: number;
  /** 코요테 타임(바닥 끝에서 떨어진 뒤에도 1단 점프가 되는 틱) + */
  coyoteBonus: number;
  /** 점프 버퍼(착지 직전에 누른 점프를 기억하는 틱) + */
  bufferBonus: number;
  /** 코인 1개를 주울 때 추가로 받는 코인 */
  coinBonus: number;
  /** 젤리 점수 +N% */
  jellyScorePct: number;
  /** 자석 아이템 없이도 항상 끌어당기는 반경(px). 0이면 없음 */
  passiveMagnetRadius: number;
  /** 회복 아이템으로 더 회복하는 체력 */
  healBonus: number;
}

export const NO_MODS: Modifiers = {
  maxHpBonus: 0,
  hitDamageReduce: 0,
  hpDrainMul: 1,
  invulnOnHitBonus: 0,
  coyoteBonus: 0,
  bufferBonus: 0,
  coinBonus: 0,
  jellyScorePct: 0,
  passiveMagnetRadius: 0,
  healBonus: 0,
};

/** 효과 여러 개를 합친다. 더하는 값은 더하고, 체력 감소 배율은 곱하고, 자석 반경은 가장 큰 값을 쓴다. */
export function combineMods(list: Partial<Modifiers>[]): Modifiers {
  const out: Modifiers = { ...NO_MODS };
  for (const m of list) {
    out.maxHpBonus += m.maxHpBonus ?? 0;
    out.hitDamageReduce += m.hitDamageReduce ?? 0;
    out.hpDrainMul *= m.hpDrainMul ?? 1;
    out.invulnOnHitBonus += m.invulnOnHitBonus ?? 0;
    out.coyoteBonus += m.coyoteBonus ?? 0;
    out.bufferBonus += m.bufferBonus ?? 0;
    out.coinBonus += m.coinBonus ?? 0;
    out.jellyScorePct += m.jellyScorePct ?? 0;
    out.passiveMagnetRadius = Math.max(out.passiveMagnetRadius, m.passiveMagnetRadius ?? 0);
    out.healBonus += m.healBonus ?? 0;
  }
  return out;
}
