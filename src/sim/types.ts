// 이 폴더(src/sim)는 Phaser를 import하지 않는다. 랜덤·시간 함수도 쓰지 않는다.
import type { ItemType, JellyType, ObstacleType, StageData } from '../data/schema';

export type PlayerState = 'run' | 'jump' | 'doubleJump' | 'fall' | 'slide' | 'dead';
export type Outcome = 'playing' | 'cleared' | 'failed';
export type EffectName = 'magnet' | 'giant' | 'boost';
export type EntityKind = ObstacleType | JellyType | ItemType;
export type SkillId = 'chaosKing';

export interface InputFrame {
  jumpPressed: boolean;
  slideHeld: boolean;
}

export const NO_INPUT: InputFrame = { jumpPressed: false, slideHeld: false };

export interface Entity {
  id: number; // 배열 인덱스와 같다
  kind: EntityKind;
  /** 히트박스 왼쪽 */
  x: number;
  /** 히트박스 아랫변 */
  y: number;
  w: number;
  h: number;
  alive: boolean;
}

export interface PlayerSim {
  /** 기준 x. 발 중앙 = x + run 폭/2 */
  x: number;
  /** 발끝 y */
  y: number;
  vy: number;
  state: PlayerState;
  hp: number;
  jumpsUsed: 0 | 1 | 2;
  invulnTicks: number;
  coyoteTicks: number;
  jumpBufferTicks: number;
  slideHeld: boolean;
}

/** 캐릭터 스킬 진행 상태. 스킬이 없는 캐릭터는 SimState.skill이 null */
export interface SkillState {
  id: SkillId;
  /** 다음 발동까지 남은 틱 (대능력 중에는 멈춘다) */
  timer: number;
  /** 지금까지 발동한 횟수. 3의 배수 번째 발동이 대능력 */
  count: number;
  /** 대능력 남은 틱 (0이면 꺼져 있음) */
  ultimateTicks: number;
  /** 대능력이 시작된 뒤 지난 틱 (박스 움직임의 기준) */
  ultimateElapsed: number;
  /** 박스에 쌓인 코인 (대능력이 끝나면 터져서 코인으로 지급) */
  boxCoins: number;
}

/** 대능력이 끝나면 상자에서 쏟아지는 코인 한 개. 주워야 코인이 지급된다 (월드 좌표, 중심 기준). */
export interface DropCoin {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** 아직 상자 안에서 튀어나오기를 기다리는 틱 (0이면 날아다니는 중) */
  delay: number;
  bounces: number;
  settled: boolean;
}

export interface SimState {
  tick: number;
  outcome: Outcome;
  failReason: 'hp' | 'fall' | null;
  cameraX: number;
  player: PlayerSim;
  /** 남은 틱 */
  effects: { magnet: number; giant: number; boost: number };
  /** 부스터가 끝난 뒤에도 구멍 위를 바닥으로 보는 남은 틱 (무적과 같이 끝남) */
  boostGroundGrace: number;
  jellyScore: number;
  jelliesTaken: number;
  jelliesTotal: number;
  coins: number;
  distance: number; // m
  entities: Entity[]; // x 오름차순
  cursor: number;
  ground: [number, number][];
  /** 거대화용: 폭이 giantGapBridge 미만인 구멍을 메운 구간 */
  giantGround: [number, number][];
  stage: StageData;
  skill: SkillState | null;
  /** 대능력이 끝난 뒤 바닥에 떨어져 있는 코인들 */
  drops: DropCoin[];
  nextDropId: number;
  debugInvincible: boolean;
}

export type SimEvent =
  | { type: 'jump'; double: boolean }
  | { type: 'land' }
  | { type: 'collect'; id: number; kind: JellyType; points: number }
  | { type: 'item'; id: number; kind: ItemType }
  | { type: 'hit'; id: number; damage: number }
  | { type: 'smash'; id: number }
  | { type: 'effectEnd'; effect: EffectName }
  | { type: 'skillMinor'; destroyed: number }
  | { type: 'ultimateStart' }
  | { type: 'boxHit'; id: number; boxCoins: number }
  | { type: 'ultimateEnd'; coins: number; x: number; y: number }
  | { type: 'dropCollect'; id: number; x: number; y: number }
  | { type: 'cleared' }
  | { type: 'failed'; reason: 'hp' | 'fall' };
