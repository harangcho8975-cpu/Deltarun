// 이 폴더(src/sim)는 Phaser를 import하지 않는다. 랜덤·시간 함수도 쓰지 않는다.
import type { ItemType, JellyType, ObstacleType, StageData } from '../data/schema';

export type PlayerState = 'run' | 'jump' | 'doubleJump' | 'fall' | 'slide' | 'dead';
export type Outcome = 'playing' | 'cleared' | 'failed';
export type EffectName = 'magnet' | 'giant' | 'boost';
export type EntityKind = ObstacleType | JellyType | ItemType;

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
  | { type: 'cleared' }
  | { type: 'failed'; reason: 'hp' | 'fall' };
