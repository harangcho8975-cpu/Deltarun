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
    magnetRadius: 340, // 자석 아이템의 기본 범위 (px)
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
        magnetAfterTicks: 54, // 튀어나온 뒤 0.9초 동안 튕기다가
        magnetSpeed: 850, // 이후 이 속도(px/s)로 플레이어에게 끌려간다 (약하게)
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
    // 제빌
    //  - 소능력: 상자 스택. 시작할 때와 대능력이 끝날 때마다 2개씩 쌓인다.
    //    공중(땅에 닿지 않은 상태)에서 슬라이드를 누르면 스택 1개로 상자가 화면 왼쪽 위에서 사선으로 날아와 터지고,
    //    사방으로 퍼진 조각이 닿는 장애물을 부순다.
    //  - 대능력: 20초마다. 발동 중 무적, 구멍 위도 바닥으로 본다.
    //    상자 폭격(3초, 상자 5개) → 돌진(2초, 두 배 속도. 높이는 비행처럼 직접 조절) → 비행(7초, 누르면 상승·떼면 하강, 슬라이드로 낫)
    //    → 심판의 낫(3초, 거대한 낫이 천천히 떨어지다 화면 절반에서 섬광과 함께 화면 안 장애물을 모두 부수고 사라짐)
    jevil: {
      startStacks: 2,
      stacksPerUltimate: 2,
      ultimateIntervalTicks: 1200, // 20초
      box: {
        size: 72,
        flightTicks: 24, // 왼쪽 위에서 터지는 곳까지 날아오는 시간
        startScreenX: -80, // 출발점 (화면 좌표, 왼쪽 위 바깥)
        startY: -80,
        minorAhead: 340, // 소능력 상자가 터지는 곳: 플레이어보다 이만큼 앞
        minorAbove: 90, // 플레이어 발보다 이만큼 위
      },
      shard: { count: 12, speed: 900, lifeTicks: 30, size: 28 },
      boxPhaseTicks: 180, // 상자 폭격 3초
      boxEveryTicks: 36, // 상자 5개를 이 간격으로
      // 대능력 상자 5개가 터지는 곳 (화면 좌표)
      boxTargets: [
        [560, 330],
        [860, 480],
        [1040, 300],
        [720, 520],
        [960, 380],
      ] as [number, number][],
      dashTicks: 120, // 돌진 2초
      dashSpeedMul: 2, // 돌진 중 스크롤 속도 배율
      flightTicks: 420, // 비행 7초
      // 돌진·비행 공통: 누르고 있으면 위로, 떼면 아래로 (속도가 부드럽게 바뀐다)
      flightUpAccel: 2600, // px/s²
      flightGravity: 2200,
      flightMaxVy: 600,
      ceilingY: 150, // 비행 중 발 y의 최소값 (화면 위로 나가지 않게)
      scythe: { swingTicks: 18, reach: 440, height: 440 }, // 낫 판정: 앞으로 440px, 위아래 440px
      judgementTicks: 180, // 심판의 낫 3초
      bigScythe: { startY: -360, endY: 560, flashAtY: 360 }, // 낫 중심 y. 화면 절반(360)을 지날 때 섬광
      afterUltimateTicks: 60, // 끝난 뒤 1초 동안 무적 + 구멍 위 바닥
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
export const SIM_VERSION = 15;

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
