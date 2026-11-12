import { gameConfig as cfg } from '../config/gameConfig';
import type { ItemType } from '../data/schema';
import type { EffectName, SimEvent, SimState } from './types';

export function applyItem(s: SimState, kind: ItemType): void {
  const e = cfg.effects;
  switch (kind) {
    case 'item_heal':
      s.player.hp = Math.min(cfg.hp.max, s.player.hp + cfg.hp.heal);
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
  if (s.effects.magnet <= 0) return;
  const p = s.player;
  const px = p.x + cfg.hitbox.run.w / 2;
  const py = p.y - cfg.hitbox.run.h / 2;
  const r = cfg.effects.magnetRadius;
  const pull = cfg.effects.magnetPullPerTick;
  for (let i = from; i < to; i++) {
    const e = s.entities[i];
    if (!e.alive || (e.kind !== 'jelly_normal' && e.kind !== 'jelly_big' && e.kind !== 'coin')) continue;
    const cx = e.x + e.w / 2;
    const cy = e.y - e.h / 2;
    const dx = px - cx;
    const dy = py - cy;
    const d = Math.hypot(dx, dy);
    if (d > r || d === 0) continue;
    const step = Math.min(pull, d);
    e.x += (dx / d) * step;
    e.y += (dy / d) * step;
  }
}
