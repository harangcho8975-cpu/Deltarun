import { gameConfig as cfg, TICK_RATE } from '../config/gameConfig';
import { hasFloorUnder } from './collision';
import type { InputFrame, SimEvent, SimState } from './types';

const isGrounded = (st: string) => st === 'run' || st === 'slide';

/** 4장 1번: 점프 버퍼 */
export function updateJumpBuffer(s: SimState, input: InputFrame): void {
  const p = s.player;
  p.slideHeld = input.slideHeld;
  if (input.jumpPressed) p.jumpBufferTicks = cfg.jumpBufferTicks;
  else if (p.jumpBufferTicks > 0) p.jumpBufferTicks--;
}

function startJump(s: SimState, events: SimEvent[], double: boolean): void {
  const p = s.player;
  p.vy = double ? cfg.doubleJumpVelocity : cfg.jumpVelocity;
  p.state = double ? 'doubleJump' : 'jump';
  p.jumpsUsed = double ? 2 : 1;
  p.jumpBufferTicks = 0;
  p.coyoteTicks = 0;
  events.push({ type: 'jump', double });
}

/** 4장 5번: 상태 머신 + 수직 물리. 반환값은 이번 틱 시작 시의 y (착지 판정용). */
export function updatePlayer(s: SimState, events: SimEvent[]): number {
  const p = s.player;
  const prevY = p.y;

  if (isGrounded(p.state)) {
    if (p.jumpBufferTicks > 0) {
      startJump(s, events, false);
    } else {
      p.state = p.slideHeld ? 'slide' : 'run';
    }
  } else if (p.jumpBufferTicks > 0) {
    // 공중: 코요테 타임 안이면 1단 점프, 아니면 남은 기회로 2단 점프. 기회가 없으면 버퍼 유지.
    if (p.state === 'fall' && p.jumpsUsed === 0 && p.coyoteTicks > 0) startJump(s, events, false);
    else if (p.jumpsUsed < 2) startJump(s, events, true);
  }

  if (!isGrounded(p.state)) {
    // 공중에서는 slideHeld를 무시한다: 자세도 낙하 속도도 바뀌지 않는다.
    // 틱 시작·끝 속도의 평균으로 이동 (사다리꼴 적분): 점프 높이가 v²/2g와 맞는다
    const vy0 = p.vy;
    // 올라가는 동안은 gravity, 내려오기 시작하면(vy ≥ 0) gravity × fallGravityScale
    const g = vy0 >= 0 ? cfg.gravity * cfg.fallGravityScale : cfg.gravity;
    p.vy = Math.min(vy0 + g / TICK_RATE, cfg.maxFallSpeed);
    p.y += (vy0 + p.vy) / 2 / TICK_RATE;
    if ((p.state === 'jump' || p.state === 'doubleJump') && p.vy >= 0) p.state = 'fall';
    if (p.coyoteTicks > 0) p.coyoteTicks--;
  }
  return prevY;
}

/** 4장 6번: 착지 / 구멍 낙하 / 추락 사망 */
export function updateGround(s: SimState, prevY: number, events: SimEvent[]): void {
  const p = s.player;
  const floor = hasFloorUnder(s);

  if (isGrounded(p.state)) {
    if (!floor) {
      p.state = 'fall';
      p.vy = 0;
      p.jumpsUsed = 0;
      p.coyoteTicks = cfg.coyoteTicks;
    }
  } else if (floor && p.vy >= 0 && p.y >= cfg.groundY && prevY <= cfg.groundY) {
    // 바닥선을 이번 틱에 위에서 아래로 지나왔을 때만 착지 (구멍 안에서는 다시 올라오지 못함)
    p.y = cfg.groundY;
    p.vy = 0;
    p.jumpsUsed = 0;
    p.coyoteTicks = 0;
    p.state = p.slideHeld ? 'slide' : 'run';
    events.push({ type: 'land' });
    if (p.jumpBufferTicks > 0) startJump(s, events, false); // 착지 직전에 누른 점프
  }

  if (p.y > cfg.deathY) {
    p.state = 'dead';
    s.outcome = 'failed';
    s.failReason = 'fall';
    events.push({ type: 'failed', reason: 'fall' });
  }
}
