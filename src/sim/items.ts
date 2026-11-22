import { gameConfig as cfg, TICK_RATE } from '../config/gameConfig';
import type { ItemType } from '../data/schema';
import { jevilSpeedMul } from './jevil';
import type { EffectName, SimEvent, SimState } from './types';

export function applyItem(s: SimState, kind: ItemType): void {
  const e = cfg.effects;
  switch (kind) {
    case 'item_heal':
      s.player.hp = Math.min(s.maxHp, s.player.hp + cfg.hp.heal + s.mods.healBonus);
      break;
    case 'item_magnet':
      s.effects.magnet = e.magnetTicks;
      break;
    case 'item_giant':
      s.effects.giant = e.giantTicks;
      break;
    case 'item_boost':
      s.effects.boost = e.boostTicks;
      s.boostGroundGrace = 0;
      break;
  }
}

/** 4장 3번: 타이머 감소. 거대화·부스터가 끝나면 짧은 무적을 준다. */
export function tickTimers(s: SimState, events: SimEvent[]): void {
  const p = s.player;
  if (p.invulnTicks > 0) p.invulnTicks--;
  if (s.boostGroundGrace > 0) s.boostGroundGrace--;
  for (const name of ['magnet', 'giant', 'boost'] as EffectName[]) {
    if (s.effects[name] <= 0) continue;
    s.effects[name]--;
    if (s.effects[name] === 0) {
      events.push({ type: 'effectEnd', effect: name });
      if (name === 'giant' || name === 'boost') {
        p.invulnTicks = Math.max(p.invulnTicks, cfg.invulnTicksAfterEffect);
      }
      if (name === 'boost') s.boostGroundGrace = cfg.invulnTicksAfterEffect;
    }
  }
}

/** 4장 8번: 자석 */
export function applyMagnet(s: SimState, from: number, to: number): void {
  // 자석 아이템, 또는 카오스 킹·제빌의 대능력 중에도 자석과 같은 범위로 끌어당긴다
  const ability = (s.skill?.id === 'chaosKing' && s.skill.ultimateTicks > 0) || (!!s.jevil && s.jevil.phase > 0);
  const timed = s.effects.magnet > 0 || ability;
  const radius = Math.max(timed ? cfg.effects.magnetRadius : 0, s.mods.passiveMagnetRadius);
  const p = s.player;
  const px = p.x + cfg.hitbox.run.w / 2;
  const py = p.y - cfg.hitbox.run.h / 2;
  const r = radius;
  // 화면이 빨리 갈 때(부스터·제빌 돌진·비행)도 따라오도록, 앞으로 가는 속도보다 조금 더 빠르게 끌린다
  const scroll = (s.stage.speed * (s.effects.boost > 0 ? cfg.effects.boostMultiplier : 1) * jevilSpeedMul(s)) / TICK_RATE;
  const pull = Math.max(cfg.effects.magnetPullPerTick, scroll + cfg.effects.magnetCatchUp);
  for (let i = from; i < to; i++) {
    const e = s.entities[i];
    if (!e.alive || (!e.kind.startsWith('jelly_') && e.kind !== 'coin')) continue;
    const cx = e.x + e.w / 2;
    const cy = e.y - e.h / 2;
    const dx = px - cx;
    const dy = py - cy;
    const d = Math.hypot(dx, dy);
    if (d === 0) continue;
    // 끌리던 젤리는 자석이 막 끝나도 자석 범위 안이면 마저 끌려와 먹힌다 (길 밖에 멈추지 않게)
    const reach = e.pulled ? Math.max(r, cfg.effects.magnetRadius) : r;
    if (d > reach) {
      e.pulled = false; // 멀어지면 자력이 완전히 끊긴다
      continue;
    }
    e.pulled = true; // 범위 안에서 끌리던 젤리는 자석이 막 끝나도 마저 끌려와 먹힌다 (길 밖에 멈추지 않게)
    const step = Math.min(pull, d);
    e.x += (dx / d) * step;
    e.y += (dy / d) * step;
  }
}
