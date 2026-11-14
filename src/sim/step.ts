import { gameConfig as cfg, TICK_RATE } from '../config/gameConfig';
import type { ItemType, JellyType } from '../data/schema';
import { overlaps, playerBox } from './collision';
import { applyItem, applyMagnet, tickTimers } from './items';
import { updateGround, updateJumpBuffer, updatePlayer } from './player';
import { distanceMeters } from './scoring';
import { flushSkill, updateSkill } from './skills';
import { activeRange } from './spatialIndex';
import type { InputFrame, SimEvent, SimState } from './types';

function fail(s: SimState, reason: 'hp' | 'fall', events: SimEvent[]): void {
  s.player.state = 'dead';
  s.outcome = 'failed';
  s.failReason = reason;
  events.push({ type: 'failed', reason });
}

/** 시뮬레이션을 정확히 1틱(1/60초) 전진시킨다. 순서는 구현 설계 4장과 같다. */
function stepTick(s: SimState, input: InputFrame): SimEvent[] {
  const events: SimEvent[] = [];
  if (s.outcome !== 'playing') return events;
  const p = s.player;

  // 1. 입력 버퍼
  updateJumpBuffer(s, input);

  // 2. 스크롤
  const speed = s.stage.speed * (s.effects.boost > 0 ? cfg.effects.boostMultiplier : 1);
  s.cameraX += speed / TICK_RATE;
  p.x = s.cameraX + cfg.playerScreenX;
  s.distance = distanceMeters(s.cameraX);

  // 3. 타이머
  tickTimers(s, events);

  // 4. 체력 감소
  if (!s.debugInvincible) {
    p.hp -= cfg.hp.drainPerSec / TICK_RATE;
    if (p.hp <= 0) {
      p.hp = 0;
      fail(s, 'hp', events);
      s.tick++;
      return events;
    }
  }

  // 5. 상태 머신·수직 물리, 6. 바닥 판정
  const prevY = updatePlayer(s, events);
  updateGround(s, prevY, events);
  if (s.outcome !== 'playing') {
    s.tick++;
    return events;
  }

  // 7. 활성 범위, 8. 자석
  const [from, to] = activeRange(s);
  applyMagnet(s, from, to);

  // 8.5 캐릭터 스킬
  updateSkill(s, from, to, events);

  // 9. 충돌
  const pb = playerBox(s);
  for (let i = from; i < to; i++) {
    const e = s.entities[i];
    if (!e.alive || !overlaps(pb, e)) continue;
    switch (e.kind) {
      case 'jelly_normal':
      case 'jelly_big':
      case 'coin': {
        e.alive = false;
        const kind = e.kind as JellyType;
        let points = 0;
        if (kind === 'coin') s.coins++;
        else {
          points = cfg.points[kind];
          s.jellyScore += points;
          s.jelliesTaken++;
        }
        events.push({ type: 'collect', id: e.id, kind, points });
        break;
      }
      case 'obstacle_low':
      case 'obstacle_high':
      case 'obstacle_air':
        if (s.effects.giant > 0 || s.effects.boost > 0) {
          e.alive = false;
          events.push({ type: 'smash', id: e.id });
        } else if (p.invulnTicks > 0 || s.debugInvincible) {
          // 무시
        } else {
          p.hp = Math.max(0, p.hp - cfg.hp.hitDamage);
          p.invulnTicks = cfg.invulnTicksOnHit;
          events.push({ type: 'hit', id: e.id, damage: cfg.hp.hitDamage });
          if (p.hp <= 0) {
            fail(s, 'hp', events);
            s.tick++;
            return events;
          }
        }
        break;
      default:
        e.alive = false;
        applyItem(s, e.kind as ItemType);
        events.push({ type: 'item', id: e.id, kind: e.kind as ItemType });
    }
  }

  // 10. 결승점
  if (p.x >= s.stage.goalX) {
    s.outcome = 'cleared';
    s.distance = distanceMeters(s.stage.goalX);
    events.push({ type: 'cleared' });
  }

  // 11.
  s.tick++;
  return events;
}

/** 시뮬레이션을 정확히 1틱(1/60초) 전진시킨다. 순서는 구현 설계 4장과 같다. */
export function step(s: SimState, input: InputFrame): SimEvent[] {
  const events = stepTick(s, input);
  if (s.outcome !== 'playing') flushSkill(s, events); // 판이 끝났으면 박스 코인을 지급
  return events;
}
