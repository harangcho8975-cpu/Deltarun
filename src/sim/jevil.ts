// 제빌의 스킬. 수치는 gameConfig.skills.jevil, 동작 순서는 파일 맨 아래 updateJevil.
// 모든 움직임은 사칙연산만 쓴다 (삼각함수 없음): 조각 방향은 미리 적어 둔 단위 벡터 표.
import { gameConfig as cfg, TICK_RATE } from '../config/gameConfig';
import { footX, overlaps, type Box } from './collision';
import type { Entity, JevilPhase, JevilState, SimEvent, SimState } from './types';

const J = cfg.skills.jevil;
const isObstacle = (e: Entity) => e.kind.startsWith('obstacle_');
const isAir = (st: string) => st === 'jump' || st === 'doubleJump' || st === 'fall';

/** 30°마다 하나씩, 12방향 단위 벡터 (cos, sin) */
const DIRS: [number, number][] = [
  [1, 0], [0.866, 0.5], [0.5, 0.866], [0, 1], [-0.5, 0.866], [-0.866, 0.5],
  [-1, 0], [-0.866, -0.5], [-0.5, -0.866], [0, -1], [0.5, -0.866], [0.866, -0.5],
];

/** 대능력(1~4단계) 중인가: 무적이고 구멍 위도 바닥으로 본다 */
export function jevilUltimate(s: SimState): boolean {
  return !!s.jevil && s.jevil.phase > 0;
}

/** 돌진 중 스크롤 배율 */
export function jevilSpeedMul(s: SimState): number {
  return s.jevil?.phase === 2 ? J.dashSpeedMul : 1;
}

/** 상자의 지금 위치 (화면 좌표, 중심): 왼쪽 위 출발점에서 목표점까지 곧게 */
export function jevilBoxPos(b: { t: number; tx: number; ty: number }): { x: number; y: number } {
  const k = Math.min(1, b.t / J.box.flightTicks);
  return { x: J.box.startScreenX + (b.tx - J.box.startScreenX) * k, y: J.box.startY + (b.ty - J.box.startY) * k };
}

/** 휘두르는 낫의 판정 (월드 좌표, 아랫변 기준). 휘두르는 중이 아니면 null */
export function scytheBox(s: SimState): Box | null {
  const j = s.jevil;
  if (!j || j.swing <= 0) return null;
  const sc = J.scythe;
  // 플레이어 몸 가운데를 기준으로 위아래 절반씩, 등 뒤 조금부터 앞으로 reach만큼
  const cy = s.player.y - cfg.hitbox.run.h / 2;
  return { x: footX(s.player) - 40, y: cy + sc.height / 2, w: sc.reach + 40, h: sc.height };
}

/** 심판의 낫 중심 y (화면 좌표). 4단계가 아니면 null */
export function bigScytheY(s: SimState): number | null {
  const j = s.jevil;
  if (!j || j.phase !== 4 || j.judged) return null; // 섬광이 터지면 낫은 사라진다
  const b = J.bigScythe;
  return b.startY + ((b.endY - b.startY) * j.elapsed) / J.judgementTicks;
}

function spawnBox(j: JevilState, tx: number, ty: number, ultimate: boolean, events: SimEvent[]): void {
  j.boxes.push({ id: j.nextId++, t: 0, tx, ty });
  events.push({ type: 'jevilBox', ultimate });
}

function destroyIn(s: SimState, from: number, to: number, box: Box, events: SimEvent[]): number {
  let n = 0;
  for (let i = from; i < to; i++) {
    const e = s.entities[i];
    if (!e.alive || !isObstacle(e) || !overlaps(box, e)) continue;
    e.alive = false;
    n++;
    events.push({ type: 'smash', id: e.id });
  }
  return n;
}

function setPhase(s: SimState, j: JevilState, phase: JevilPhase, events: SimEvent[]): void {
  j.phase = phase;
  j.elapsed = 0;
  const p = s.player;
  if (phase === 2) {
    p.state = 'fly'; // 돌진이 시작되면 그때의 높이·속도 그대로 비행 조작으로 넘어간다
  } else if (phase === 4) {
    // 비행이 끝나면 그때의 속도를 이어받아 자연스럽게 떨어진다. 2단 점프 한 번은 남겨 둔다.
    p.state = 'fall';
    p.vy = Math.max(0, p.vy);
    p.jumpsUsed = 1;
    p.coyoteTicks = 0;
    j.swing = 0;
  }
  events.push({ type: 'jevilPhase', phase });
}

/** 4장 5번 대신: 돌진·비행 중의 수직 이동 (player.ts에서 부른다) */
export function updateFlight(s: SimState): void {
  const p = s.player;
  // 돌진·비행: 누르고 있으면 올라가고, 떼면 내려간다 (지오메트리 대시의 비행기처럼)
  const a = p.jumpHeld ? -J.flightUpAccel : J.flightGravity;
  const vy0 = p.vy;
  p.vy = Math.max(-J.flightMaxVy, Math.min(J.flightMaxVy, vy0 + a / TICK_RATE));
  p.y += (vy0 + p.vy) / 2 / TICK_RATE;
  if (p.y < J.ceilingY) {
    p.y = J.ceilingY;
    p.vy = 0;
  }
  if (p.y > cfg.groundY) {
    p.y = cfg.groundY; // 비행 중에는 구멍 위에서도 바닥선 아래로 내려가지 않는다
    p.vy = 0;
  }
}

/** 상자 이동·폭발, 조각 이동·파괴 */
function updateProjectiles(s: SimState, j: JevilState, from: number, to: number, events: SimEvent[]): void {
  const dt = 1 / TICK_RATE;
  const keep = [];
  for (const b of j.boxes) {
    b.t++;
    if (b.t < J.box.flightTicks) {
      keep.push(b);
      continue;
    }
    // 터진다: 월드 좌표로 바꿔 조각을 사방으로
    const x = s.cameraX + b.tx;
    const y = b.ty;
    for (const [dx, dy] of DIRS) {
      j.shards.push({ id: j.nextId++, x, y, vx: dx * J.shard.speed, vy: dy * J.shard.speed, life: J.shard.lifeTicks });
    }
    events.push({ type: 'jevilBurst', x, y });
  }
  j.boxes = keep;

  const half = J.shard.size / 2;
  const alive = [];
  for (const sh of j.shards) {
    sh.x += sh.vx * dt;
    sh.y += sh.vy * dt;
    sh.life--;
    destroyIn(s, from, to, { x: sh.x - half, y: sh.y + half, w: J.shard.size, h: J.shard.size }, events);
    if (sh.life > 0) alive.push(sh);
  }
  j.shards = alive;
}

/** 4장 8.5번 (제빌): 스택 상자, 대능력 단계 진행 */
export function updateJevil(s: SimState, from: number, to: number, events: SimEvent[]): void {
  const j = s.jevil;
  if (!j) return;
  const p = s.player;
  const slidePressed = p.slideHeld && !j.slidePrev;
  j.slidePrev = p.slideHeld;

  switch (j.phase) {
    case 0: {
      // 소능력: 공중에서 슬라이드를 누르는 순간 스택 1개로 상자
      if (slidePressed && isAir(p.state) && j.stacks > 0) {
        j.stacks--;
        p.invulnTicks = Math.max(p.invulnTicks, J.invulnAfterMinorTicks); // 소능력 직후 무적
        spawnBox(j, cfg.playerScreenX + J.box.minorAhead, Math.max(120, p.y - J.box.minorAbove), false, events);
      }
      j.timer--;
      if (j.timer <= 0) setPhase(s, j, 1, events);
      break;
    }
    case 1: {
      // 상자 폭격: 상자 5개
      if (j.elapsed % J.boxEveryTicks === 0) {
        const i = j.elapsed / J.boxEveryTicks;
        if (i < J.boxTargets.length) spawnBox(j, J.boxTargets[i][0], J.boxTargets[i][1], true, events);
      }
      j.elapsed++;
      if (j.elapsed >= J.boxPhaseTicks) setPhase(s, j, 2, events);
      break;
    }
    case 2:
      j.elapsed++;
      if (j.elapsed >= J.dashTicks) setPhase(s, j, 3, events);
      break;
    case 3: {
      if (slidePressed && j.swing === 0) {
        j.swing = J.scythe.swingTicks;
        events.push({ type: 'jevilSwing' });
      }
      const sb = scytheBox(s);
      if (sb) destroyIn(s, from, to, sb, events);
      if (j.swing > 0) j.swing--;
      j.elapsed++;
      if (j.elapsed >= J.flightTicks) setPhase(s, j, 4, events);
      break;
    }
    case 4: {
      j.elapsed++;
      const y = bigScytheY(s)!;
      if (!j.judged && y >= J.bigScythe.flashAtY) {
        // 심판: 화면 안의 장애물을 모두 부순다
        j.judged = true;
        let destroyed = 0;
        for (let i = from; i < to; i++) {
          const e = s.entities[i];
          if (!e.alive || !isObstacle(e) || e.x >= s.cameraX + cfg.view.width || e.x + e.w <= s.cameraX) continue;
          e.alive = false;
          destroyed++;
          events.push({ type: 'smash', id: e.id });
        }
        events.push({ type: 'jevilJudgement', destroyed });
      }
      if (j.elapsed >= J.judgementTicks) {
        j.phase = 0;
        j.elapsed = 0;
        j.judged = false;
        j.stacks += J.stacksPerUltimate;
        j.timer = J.ultimateIntervalTicks;
        p.invulnTicks = Math.max(p.invulnTicks, J.afterUltimateTicks);
        s.boostGroundGrace = Math.max(s.boostGroundGrace, J.groundGraceAfterUltimateTicks);
        events.push({ type: 'jevilPhase', phase: 0 });
      }
      break;
    }
  }

  updateProjectiles(s, j, from, to, events);
}
