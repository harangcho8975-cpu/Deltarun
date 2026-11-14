// 캐릭터 스킬. 지금은 카오스 킹 하나.
//  - 소능력: 4초(240틱)마다 화면 안의 장애물을 모두 부순다.
//  - 대능력: 3번째 발동은 소능력 대신 대능력. 6초(360틱) 동안 화면 오른쪽에 거대한 박스가 위아래로 부드럽게 움직이며
//    닿는 장애물을 부수고, 하나당 코인 10개를 박스에 쌓는다. 끝나면 박스가 터지며 쌓인 코인이 지급된다.
//    대능력 중에는 소능력이 발동하지 않고, 발동 타이머도 멈춘다. 끝나면 타이머가 다시 4초부터 시작한다.
// 박스 움직임은 사인 함수 대신 smoothstep(사칙연산만)을 써서 브라우저가 달라도 결과가 같다.
import { gameConfig as cfg } from '../config/gameConfig';
import { overlaps, type Box } from './collision';
import type { Entity, SimEvent, SimState } from './types';

const isObstacle = (e: Entity) => e.kind.startsWith('obstacle_');

function smoothPingPong(p: number): number {
  const tri = p < 0.5 ? 2 * p : 2 * (1 - p); // 0 → 1 → 0
  return tri * tri * (3 - 2 * tri);
}

/** 대능력 박스의 지금 위치 (월드 좌표, 아랫변 기준). 대능력 중이 아니면 null. */
export function ultimateBox(s: SimState): Box | null {
  const k = s.skill;
  if (!k || k.ultimateTicks <= 0) return null;
  const c = cfg.skills[k.id].box;
  const phase = (k.ultimateElapsed % c.periodTicks) / c.periodTicks;
  const bottom = c.bottomMin + (c.bottomMax - c.bottomMin) * smoothPingPong(phase);
  return { x: s.cameraX + c.screenX, y: bottom, w: c.w, h: c.h };
}

function endUltimate(s: SimState, box: Box, events: SimEvent[]): void {
  const k = s.skill!;
  const coins = k.boxCoins;
  s.coins += coins;
  events.push({ type: 'ultimateEnd', coins, x: box.x + box.w / 2, y: box.y - box.h / 2 });
  k.ultimateTicks = 0;
  k.ultimateElapsed = 0;
  k.boxCoins = 0;
  k.timer = cfg.skills[k.id].intervalTicks;
}

/** 4장 8.5번: 스킬 진행. 충돌(9번)보다 먼저 돌아서, 부서진 장애물은 이번 틱 충돌에서 빠진다. */
export function updateSkill(s: SimState, from: number, to: number, events: SimEvent[]): void {
  const k = s.skill;
  if (!k) return;
  const c = cfg.skills[k.id];

  if (k.ultimateTicks > 0) {
    const box = ultimateBox(s)!;
    for (let i = from; i < to; i++) {
      const e = s.entities[i];
      if (!e.alive || !isObstacle(e) || !overlaps(box, e)) continue;
      e.alive = false;
      k.boxCoins += c.coinsPerObstacle;
      events.push({ type: 'smash', id: e.id }, { type: 'boxHit', id: e.id, boxCoins: k.boxCoins });
    }
    k.ultimateElapsed++;
    k.ultimateTicks--;
    if (k.ultimateTicks === 0) endUltimate(s, box, events);
    return;
  }

  k.timer--;
  if (k.timer > 0) return;
  k.count++;
  if (k.count % c.ultimateEvery === 0) {
    k.ultimateTicks = c.ultimateTicks;
    k.ultimateElapsed = 0;
    k.boxCoins = 0;
    events.push({ type: 'ultimateStart' });
    return;
  }
  // 소능력: 화면 안(카메라 폭)에 걸친 장애물을 모두 부순다
  let destroyed = 0;
  const left = s.cameraX;
  const right = s.cameraX + cfg.view.width;
  for (let i = from; i < to; i++) {
    const e = s.entities[i];
    if (!e.alive || !isObstacle(e) || e.x >= right || e.x + e.w <= left) continue;
    e.alive = false;
    destroyed++;
    events.push({ type: 'smash', id: e.id });
  }
  events.push({ type: 'skillMinor', destroyed });
  k.timer = c.intervalTicks;
}

/** 판이 끝났는데 대능력이 남아 있으면 그 자리에서 박스를 터뜨려 코인을 지급한다 */
export function flushSkill(s: SimState, events: SimEvent[]): void {
  if (!s.skill || s.skill.ultimateTicks <= 0) return;
  endUltimate(s, ultimateBox(s)!, events);
}
