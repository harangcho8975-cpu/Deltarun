// 모든 게임 수치는 여기에만 둔다. 디버그 패널(lil-gui)이 이 객체를 실시간으로 바꿀 수 있다.

export const TICK_RATE = 60;
export const TICK_MS = 1000 / TICK_RATE;

export interface Size {
  w: number;
  h: number;
}

export const gameConfig = {
  view: { width: 1280, height: 720 },
  groundY: 600,
  deathY: 820,
  playerScreenX: 240,

  gravity: 2600, // px/s²
  jumpVelocity: -960, // px/s
  doubleJumpVelocity: -900,
  maxFallSpeed: 1600,
  coyoteTicks: 6,
  jumpBufferTicks: 6,

  hp: { max: 100, drainPerSec: 1.5, hitDamage: 15, heal: 20 },
  invulnTicksOnHit: 90,
  invulnTicksAfterEffect: 60,

  hitbox: {
    run: { w: 56, h: 100 } as Size,
    slide: { w: 88, h: 44 } as Size,
    giantScale: 1.6,
    obstacle_low: { w: 48, h: 48 } as Size,
    obstacle_high: { w: 48, h: 160 } as Size,
    obstacle_air: { w: 80, h: 400 } as Size,
    airBottomY: 544,
    jelly_normal: { w: 28, h: 28 } as Size,
    coin: { w: 28, h: 28 } as Size,
    jelly_big: { w: 56, h: 56 } as Size,
    item: { w: 48, h: 48 } as Size,
  },

  points: { jelly_normal: 10, jelly_big: 100 },

  effects: {
    magnetTicks: 360,
    giantTicks: 300,
    boostTicks: 240,
    magnetRadius: 220,
    magnetPullPerTick: 14,
    boostMultiplier: 2,
  },

  giantGapBridge: 40, // 거대화 중 이 폭 미만의 구멍은 바닥으로 본다

  activeBehind: 128,
  activeAhead: 1280 + 256,
  pxPerMeter: 10,
};

export type GameConfig = typeof gameConfig;

/**
 * 시뮬레이션 규칙(코드)을 바꿔 같은 입력의 결과가 달라지면 올린다.
 * 리플레이는 이 값과 수치가 모두 같을 때만 유효하다.
 */
export const SIM_VERSION = 2;

/** 리플레이가 녹화될 때의 설정·규칙과 지금이 같은지 확인하는 해시. */
export function configHash(cfg: GameConfig = gameConfig): string {
  return fnv1a(`v${SIM_VERSION}:` + JSON.stringify(cfg));
}

export function fnv1a(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}
