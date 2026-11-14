import { gameConfig as cfg } from '../config/gameConfig';
import type { StageData } from '../data/schema';
import { bridgeGaps } from './collision';
import type { Entity, EntityKind, SimState, SkillId } from './types';

export interface CreateSimOptions {
  /** 디버그: 이 월드 x(플레이어 위치)에서 시작 */
  startX?: number;
  /** 캐릭터 스킬 (없으면 null) */
  skill?: SkillId | null;
}

function sizeOf(kind: EntityKind) {
  const hb = cfg.hitbox;
  switch (kind) {
    case 'obstacle_low':
    case 'obstacle_high':
    case 'obstacle_air':
    case 'jelly_normal':
    case 'jelly_big':
    case 'coin':
      return hb[kind];
    default:
      return hb.item;
  }
}

export function createSim(stage: StageData, opts: CreateSimOptions = {}): SimState {
  const raw: Omit<Entity, 'id'>[] = [];
  for (const o of stage.obstacles) {
    const { w, h } = sizeOf(o.type);
    const y = o.type === 'obstacle_air' ? cfg.hitbox.airBottomY : cfg.groundY;
    raw.push({ kind: o.type, x: o.x, y, w, h, alive: true });
  }
  for (const j of stage.jellies) {
    const { w, h } = sizeOf(j.type);
    raw.push({ kind: j.type, x: j.x - w / 2, y: j.y + h / 2, w, h, alive: true });
  }
  for (const it of stage.items) {
    const { w, h } = sizeOf(it.type);
    raw.push({ kind: it.type, x: it.x - w / 2, y: it.y + h / 2, w, h, alive: true });
  }
  // 안정 정렬: x가 같으면 원래 순서 유지 → 언제나 같은 id
  const entities: Entity[] = raw
    .map((e, i) => ({ e, i }))
    .sort((a, b) => a.e.x - b.e.x || a.i - b.i)
    .map(({ e }, id) => ({ ...e, id }));

  const startPlayerX = opts.startX ?? cfg.playerScreenX;
  const cameraX = startPlayerX - cfg.playerScreenX;
  let cursor = 0;
  while (cursor < entities.length && entities[cursor].x + entities[cursor].w < cameraX - cfg.activeBehind) cursor++;

  const ground = stage.ground.map(([a, b]) => [a, b] as [number, number]);
  return {
    tick: 0,
    outcome: 'playing',
    failReason: null,
    cameraX,
    player: {
      x: startPlayerX,
      y: cfg.groundY,
      vy: 0,
      state: 'run',
      hp: cfg.hp.max,
      jumpsUsed: 0,
      invulnTicks: 0,
      coyoteTicks: 0,
      jumpBufferTicks: 0,
      slideHeld: false,
    },
    effects: { magnet: 0, giant: 0, boost: 0 },
    boostGroundGrace: 0,
    jellyScore: 0,
    jelliesTaken: 0,
    jelliesTotal: entities.filter((e) => e.kind === 'jelly_normal' || e.kind === 'jelly_big').length,
    coins: 0,
    distance: Math.floor(cameraX / cfg.pxPerMeter),
    entities,
    cursor,
    ground,
    giantGround: bridgeGaps(ground, cfg.giantGapBridge),
    stage,
    skill: opts.skill
      ? { id: opts.skill, timer: cfg.skills[opts.skill].intervalTicks, count: 0, ultimateTicks: 0, ultimateElapsed: 0, boxCoins: 0 }
      : null,
    drops: [],
    nextDropId: 0,
    debugInvincible: false,
  };
}

/** 봇 탐색·테스트용 복제. stage와 ground는 바뀌지 않으므로 공유한다. */
export function cloneSim(s: SimState): SimState {
  return {
    ...s,
    player: { ...s.player },
    effects: { ...s.effects },
    skill: s.skill ? { ...s.skill } : null,
    drops: s.drops.map((d) => ({ ...d })),
    entities: s.entities.map((e) => ({ ...e })),
  };
}
