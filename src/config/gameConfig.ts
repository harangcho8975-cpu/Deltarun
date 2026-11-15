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

  gravity: 4150, // px/s² (올라갈 때). 점프 높이는 v²/2g ≈ 176px로 유지하면서 점프 전체 시간만 짧게
  fallGravityScale: 1.25, // 내려올 때(vy ≥ 0) 중력 배율: 올라갈 때보다 빠르게 떨어진다
  jumpVelocity: -1210, // px/s
  doubleJumpVelocity: -1130,
  maxFallSpeed: 2000,
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

  skills: {
    chaosKing: {
      intervalTicks: 240, // 4초마다 발동
      ultimateEvery: 3, // 3번째 발동은 소능력 대신 대능력
      ultimateTicks: 360, // 대능력 6초
      coinsPerObstacle: 10, // 박스가 부순 장애물 하나당 적립 코인
      invulnAfterMinorTicks: 30, // 소능력 발동 직후 무적 (0.5초)
      invulnAfterUltimateTicks: 180, // 대능력이 끝난 직후 무적 (3초)
      // 대능력이 끝나면 쌓인 코인이 하나하나 떨어져 바닥에서 튕기고, 플레이어가 직접 주워야 지급된다
      drop: {
        gravity: 2600, // px/s²
        bounce: 0.42, // 바닥에 닿을 때 남는 속도 비율 (작을수록 덜 튕김)
        settleSpeed: 150, // 튕기는 속도가 이보다 작아지면 멈춘다
        vxRange: 300, // 튀어나올 때 가로 속도 ±
        vyMin: -1000, // 튀어나올 때 위로 가는 속도 범위
        vyMax: -500,
        delayMaxTicks: 24, // 한꺼번에가 아니라 0~0.4초 사이에 하나씩 튀어나옴
      },
      box: {
        w: 480, // 가로로 긴 상자
        h: 260,
        screenX: 770, // 화면 오른쪽 (왼쪽 끝 기준, 오른쪽 끝은 x = 1250)
        bottomMin: 460, // 박스 아랫변이 가장 높을 때 y
        bottomMax: 600, // 가장 낮을 때 (바닥)
        periodTicks: 120, // 한 번 오르내리는 데 걸리는 시간 (2초)
      },
    },
  },

  activeBehind: 128,
  activeAhead: 1280 + 256,
  pxPerMeter: 10,
};

export type GameConfig = typeof gameConfig;

/**
 * 시뮬레이션 규칙(코드)을 바꿔 같은 입력의 결과가 달라지면 올린다.
 * 리플레이는 이 값과 수치가 모두 같을 때만 유효하다.
 */
export const SIM_VERSION = 9;

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
