// 캐릭터 스킬. 지금은 카오스 킹 하나.
//  - 소능력: 4초(240틱)마다 화면 안의 장애물을 모두 부순다.
//  - 대능력: 3번째 발동은 소능력 대신 대능력. 6초(360틱) 동안 화면 오른쪽에 거대한 박스가 위아래로 부드럽게 움직이며
//    닿는 장애물을 부수고, 하나당 코인 10개를 박스에 쌓는다. 끝나면 박스가 터지며 쌓인 코인이 지급된다.
//    대능력 중에는 소능력이 발동하지 않고, 발동 타이머도 멈춘다. 끝나면 타이머가 다시 4초부터 시작한다.
// 박스 움직임은 사인 함수 대신 smoothstep(사칙연산만)을 써서 브라우저가 달라도 결과가 같다.
import { gameConfig as cfg, TICK_RATE } from '../config/gameConfig';
import { overlaps, playerBox, type Box } from './collision';
import type { DropCoin, Entity, SimEvent, SimState } from './types';

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

/** 정수 연산만 쓰는 작은 난수 (xorshift32). 브라우저가 달라도 같은 값이 나온다. */
function rng(seed: number): () => number {
  let x = (seed >>> 0) || 1;
  return () => {
    x ^= x << 13;
    x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5;
    x >>>= 0;
    return x / 4294967296;
  };
}

/** 코인 한 개의 가로·세로 크기(히트박스)의 절반. 바닥 위에서 중심이 이 높이만큼 떠 있다 */
const COIN_HALF = cfg.hitbox.coin.w / 2;
export const DROP_FLOOR_Y = cfg.groundY - COIN_HALF;

/** 쌓인 코인 전부를 상자 중심에서 하나씩 튀어나오게 만든다 */
function spawnDrops(s: SimState, coins: number, box: Box): void {
  const d = cfg.skills.chaosKing.drop;
  const rand = rng(s.tick * 7919 + coins * 104729 + 1);
  const cx = box.x + box.w / 2;
  const cy = box.y - box.h / 2;
  for (let i = 0; i < coins; i++) {
    s.drops.push({
      id: s.nextDropId++,
      x: cx + (rand() - 0.5) * box.w * 0.6,
      y: cy + (rand() - 0.5) * 100,
      vx: (rand() * 2 - 1) * d.vxRange,
      vy: d.vyMin + rand() * (d.vyMax - d.vyMin),
      delay: Math.floor(rand() * d.delayMaxTicks),
      bounces: 0,
      settled: false,
      age: 0,
    });
  }
}

/** 대능력 종료. 쌓인 코인이 하나하나 떨어지고, 플레이어가 직접 주워야 지급된다 (예외 없음). */
function endUltimate(s: SimState, box: Box, events: SimEvent[]): void {
  const k = s.skill!;
  const coins = k.boxCoins;
  spawnDrops(s, coins, box);
  events.push({ type: 'ultimateEnd', coins, x: box.x + box.w / 2, y: box.y - box.h / 2 });
  k.ultimateTicks = 0;
  k.ultimateElapsed = 0;
  k.boxCoins = 0;
  k.timer = cfg.skills[k.id].intervalTicks;
  // 대능력이 끝난 직후 잠깐 무적
  s.player.invulnTicks = Math.max(s.player.invulnTicks, cfg.skills[k.id].invulnAfterUltimateTicks);
}

/** 4장 8.6번: 떨어진 코인의 움직임과 줍기. 상자 안에서 대기 → 날아오름 → 바닥에서 튕김 → 멈춤 → 줍거나 화면 밖으로 사라짐 */
export function updateDrops(s: SimState, events: SimEvent[]): void {
  if (s.drops.length === 0) return;
  const d = cfg.skills.chaosKing.drop;
  const dt = 1 / TICK_RATE;
  const pb = playerBox(s);
  const keep: DropCoin[] = [];
  for (const c of s.drops) {
    if (c.delay > 0) {
      c.delay--;
      keep.push(c);
      continue;
    }
    c.age++;
    if (c.age > d.magnetAfterTicks) {
      // 잠깐 튕기다가 자력이 붙어 플레이어에게 빨려 든다 (결정적 이동: 정규화 + 고정 속도)
      const tx = pb.x + pb.w / 2;
      const ty = pb.y - pb.h / 2;
      const dx = tx - c.x;
      const dy = ty - c.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const sp = d.magnetSpeed * dt;
      if (dist <= sp) {
        c.x = tx;
        c.y = ty;
      } else {
        c.x += (dx / dist) * sp;
        c.y += (dy / dist) * sp;
      }
      c.vx = 0;
      c.vy = 0;
      c.settled = true;
    } else if (!c.settled) {
      c.vy += d.gravity * dt;
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      // 어디서든 바닥(y = DROP_FLOOR_Y)에서 튕긴다. 구멍 위라도 빠지지 않는다 (예외 없음)
      if (c.vy > 0 && c.y >= DROP_FLOOR_Y) {
        c.y = DROP_FLOOR_Y;
        c.bounces++;
        c.vy = -c.vy * d.bounce;
        c.vx *= 0.6;
        if (Math.abs(c.vy) < d.settleSpeed) {
          c.vy = 0;
          c.vx = 0;
          c.settled = true;
        }
      }
    }
    const coinBox: Box = { x: c.x - COIN_HALF, y: c.y + COIN_HALF, w: COIN_HALF * 2, h: COIN_HALF * 2 };
    if (overlaps(pb, coinBox)) {
      s.coins += 1 + s.mods.coinBonus;
      events.push({ type: 'dropCollect', id: c.id, x: c.x, y: c.y });
      continue;
    }
    if (c.x + COIN_HALF < s.cameraX - cfg.activeBehind || c.y > cfg.deathY) continue; // 놓친 코인은 사라진다
    keep.push(c);
  }
  s.drops = keep;
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
  // 소능력을 쓴 직후 잠깐 무적
  s.player.invulnTicks = Math.max(s.player.invulnTicks, c.invulnAfterMinorTicks);
}
