// 스테이지 생성기: 장애물·구멍·아이템 배치를 적으면,
//  1) 실제 게임 물리(src/sim)로 "알맞은 조작"(점프 시점, 2단 점프, 슬라이드 구간)을 찾고
//  2) 그 조작으로 달린 캐릭터 몸 중심 궤적을 따라 젤리를 일정 간격(호 길이)으로 깐다.
// 그래서 젤리는 겹치거나 비지 않고, 알맞게 움직이면 처음부터 끝까지 이어서 먹게 된다.
// 결과는 Tiled 맵(.tmj)으로 쓰고, 평소처럼 npm run maps 로 변환·검증한다.
import { gameConfig as cfg } from '../../src/config/gameConfig';
import type { ItemType, JellyType, ObstacleType, StageData } from '../../src/data/schema';
import { cloneSim, createSim, ReplayRecorder, step, type Replay, type SimState } from '../../src/sim';
import { footX } from '../../src/sim/collision';

export type JellyStyle = 'jelly' | 'coin' | 'none';

interface Action {
  kind: 'jump' | 'double' | 'slide';
  /** 넘거나 지나가야 할 구간 [start, end) (월드 x) */
  start: number;
  end: number;
  /** 이 점프의 정점에 놓을 특별한 젤리 */
  apex?: 'card' | 'rune' | 'big';
}

interface Press {
  x: number;
  /** 2단 점프: 첫 점프 뒤 이 틱 수 후에 한 번 더 */
  delay?: number;
}

interface Plan {
  presses: Press[];
  slides: [number, number][];
}

interface Zone {
  from: number;
  to: number;
  style: JellyStyle;
}

export interface StageSpec {
  id: string;
  name: string;
  bgm: string;
  background?: [string, string, string];
  speed?: number;
}

const SPACING = 44; // 젤리 간격 (호 길이, px)
const BODY_C = { run: cfg.hitbox.run.h / 2, slide: cfg.hitbox.slide.h / 2 };

export class StageBuilder {
  x = 0;
  private obstacles: { type: ObstacleType; x: number }[] = [];
  private holes: [number, number][] = [];
  private items: { type: ItemType; x: number }[] = [];
  private actions: Action[] = [];
  private zones: Zone[] = [];
  private bears: number[] = [];

  constructor(private spec: StageSpec) {}

  /** 이후 젤리 모양: 젤리 / 코인 / 없음 */
  jellies(style: JellyStyle): this {
    this.zones.push({ from: this.x, to: Infinity, style });
    return this;
  }

  /** 평지를 len만큼 달린다 */
  run(len: number): this {
    this.x += len;
    return this;
  }

  /** 낮은 장애물: 점프 */
  low(after = 420, apex?: Action['apex']): this {
    return this.obstacle('obstacle_low', 'jump', after, apex);
  }

  /** 높은 장애물: 2단 점프 */
  high(after = 520, apex?: Action['apex']): this {
    return this.obstacle('obstacle_high', 'double', after, apex);
  }

  /** 매달린 장애물: 슬라이드 */
  air(after = 360): this {
    const ox = this.x;
    this.obstacles.push({ type: 'obstacle_air', x: ox });
    this.actions.push({ kind: 'slide', start: ox, end: ox + cfg.hitbox.obstacle_air.w });
    this.x = ox + cfg.hitbox.obstacle_air.w + after;
    return this;
  }

  /** 매달린 장애물 여러 개를 이어서 (슬라이드를 쭉) */
  airs(n: number, gap = 160, after = 360): this {
    const ox = this.x;
    for (let i = 0; i < n; i++) this.obstacles.push({ type: 'obstacle_air', x: ox + i * (cfg.hitbox.obstacle_air.w + gap) });
    const end = ox + n * cfg.hitbox.obstacle_air.w + (n - 1) * gap;
    this.actions.push({ kind: 'slide', start: ox, end });
    this.x = end + after;
    return this;
  }

  /** 구멍: 폭에 따라 점프 또는 2단 점프 */
  hole(width: number, after = 420, apex?: Action['apex']): this {
    const a = this.x;
    this.holes.push([a, a + width]);
    this.actions.push({ kind: width > 250 ? 'double' : 'jump', start: a, end: a + width, apex });
    this.x = a + width + after;
    return this;
  }

  /** 아이템 (달리는 높이에 놓는다) */
  item(type: ItemType, after = 200): this {
    this.items.push({ type, x: this.x });
    this.x += after;
    return this;
  }

  /** 곰젤리(큰 젤리)를 지금 자리 바닥 경로에 */
  bear(after = 120): this {
    this.bears.push(this.x);
    this.x += after;
    return this;
  }

  /** 거대화·부스터 중에 부술 장애물 (조작 없이 지나간다) */
  smash(types: ObstacleType[], gap = 300): this {
    for (const t of types) {
      this.obstacles.push({ type: t, x: this.x });
      this.x += cfg.hitbox[t].w + gap;
    }
    return this;
  }

  private obstacle(type: ObstacleType, kind: Action['kind'], after: number, apex?: Action['apex']): this {
    const ox = this.x;
    this.obstacles.push({ type, x: ox });
    this.actions.push({ kind, start: ox, end: ox + cfg.hitbox[type].w, apex });
    this.x = ox + cfg.hitbox[type].w + after;
    return this;
  }

  // ───────── 만들기 ─────────

  private stageData(withJellies: StageData['jellies'] = [], items = true): StageData {
    const goalX = Math.ceil((this.x + 200) / 40) * 40;
    const length = goalX + 640;
    const ground: [number, number][] = [];
    let start = 0;
    for (const [a, b] of [...this.holes].sort((p, q) => p[0] - q[0])) {
      ground.push([start, a]);
      start = b;
    }
    ground.push([start, length]);
    return {
      id: this.spec.id,
      name: this.spec.name,
      length,
      speed: this.spec.speed ?? 620,
      bgm: this.spec.bgm,
      background: this.spec.background ?? ['bg_far', 'bg_mid', 'bg_near'],
      ground,
      obstacles: [...this.obstacles].sort((a, b) => a.x - b.x),
      jellies: withJellies,
      items: items ? this.items.map((it) => ({ type: it.type, x: it.x, y: cfg.groundY - BODY_C.run })) : [],
      goalX,
      stars: [0.5, 0.75, 0.95],
    };
  }

  /** 계획대로 한 틱 입력을 만든다 */
  private static runner(plan: Plan, startFoot = -Infinity) {
    let prevFoot = startFoot;
    const fired = new Map<number, number>(); // press index → 누른 틱
    return (s: SimState) => {
      const fx = footX(s.player);
      let jump = false;
      plan.presses.forEach((p, i) => {
        if (prevFoot < p.x && fx >= p.x) {
          jump = true;
          fired.set(i, s.tick);
        }
        const t = fired.get(i);
        if (p.delay !== undefined && t !== undefined && s.tick === t + p.delay) jump = true;
      });
      prevFoot = fx;
      const slide = plan.slides.some(([a, b]) => fx >= a && fx <= b);
      return { jumpPressed: jump, slideHeld: slide };
    };
  }

  /** 계획대로 base 상태에서 x까지 달려 본다. 맞거나 떨어지면 null */
  private static tryRun(base: SimState, plan: Plan, untilFoot: number): SimState | null {
    const s = cloneSim(base);
    // 이미 지난 누름을 다시 누르지 않도록 지금 위치에서 시작한다
    const input = StageBuilder.runner(plan, footX(s.player));
    let guard = 0;
    while (s.outcome === 'playing' && guard++ < 20000) {
      const ev = step(s, input(s));
      if (ev.some((e) => e.type === 'hit' || e.type === 'failed')) return null;
      if (s.player.y > cfg.groundY + 1 && s.player.state !== 'fly') {
        // 바닥선 아래 = 구멍에 빠지는 중
        return null;
      }
      const grounded = s.player.state === 'run' || s.player.state === 'slide';
      if (footX(s.player) >= untilFoot && grounded) return s;
    }
    return s.outcome === 'cleared' ? s : null;
  }

  /** 모든 조작을 앞에서부터 하나씩 정한다 */
  private solve(): Plan {
    const stage = this.stageData([], true);
    const plan: Plan = { presses: [], slides: [] };
    const actions = [...this.actions].sort((a, b) => a.start - b.start);
    let base = createSim(stage);
    let lastLand = footX(base.player);
    for (const a of actions) {
      if (a.kind === 'slide') {
        const s0 = a.start - cfg.hitbox.slide.w / 2 - 70;
        const s1 = a.end + cfg.hitbox.slide.w / 2 + 40;
        const cand: Plan = { presses: plan.presses, slides: [...plan.slides, [s0, s1]] };
        const r = StageBuilder.tryRun(base, cand, s1 + 20);
        if (!r) throw new Error(`${this.spec.id}: x=${a.start} 슬라이드로 지나갈 수 없음`);
        plan.slides.push([s0, s1]);
        base = r;
        lastLand = s1;
        continue;
      }
      const delays = a.kind === 'double' ? [17, 15, 19, 13, 21, 11, 23, 9, 25] : [undefined];
      let chosen: Press | null = null;
      let after: SimState | null = null;
      for (const delay of delays) {
        const ok: { x: number; s: SimState }[] = [];
        for (let px = a.start - 520; px <= a.start + 40; px += 4) {
          if (px < lastLand + 12) continue;
          const cand: Plan = { presses: [...plan.presses, { x: px, delay }], slides: plan.slides };
          const r = StageBuilder.tryRun(base, cand, a.end + cfg.hitbox.run.w);
          if (r) ok.push({ x: px, s: r });
        }
        if (ok.length) {
          // 가능한 범위의 가운데: 너무 이르지도 늦지도 않은, 가장 넉넉한 시점
          const mid = ok[Math.floor(ok.length / 2)];
          chosen = { x: mid.x, delay };
          after = mid.s;
          break;
        }
      }
      if (!chosen || !after) throw new Error(`${this.spec.id}: x=${a.start} (${a.kind}) 를 넘을 시점이 없음`);
      plan.presses.push(chosen);
      base = after;
      lastLand = footX(after.player);
    }
    return plan;
  }

  /** 계획대로 끝까지 달리며 몸 중심 궤적을 기록한다 */
  private trace(plan: Plan): { pts: { x: number; y: number; air: boolean }[]; final: SimState } {
    const s = createSim(this.stageData([], true));
    const input = StageBuilder.runner(plan);
    const pts: { x: number; y: number; air: boolean }[] = [];
    while (s.outcome === 'playing' && s.tick < 60 * 60 * 5) {
      const ev = step(s, input(s));
      if (ev.some((e) => e.type === 'hit')) throw new Error(`${this.spec.id}: 계획대로 달렸는데 x=${Math.round(s.player.x)}에서 맞음`);
      const p = s.player;
      const giant = s.effects.giant > 0 ? cfg.hitbox.giantScale : 1;
      const half = (p.state === 'slide' ? BODY_C.slide : BODY_C.run) * giant;
      pts.push({ x: footX(p), y: p.y - half, air: !(p.state === 'run' || p.state === 'slide') });
    }
    if (s.outcome !== 'cleared') throw new Error(`${this.spec.id}: 계획대로 달려도 클리어하지 못함 (${s.failReason})`);
    return { pts, final: s };
  }

  private styleAt(x: number): JellyStyle {
    let st: JellyStyle = 'jelly';
    for (const z of this.zones) if (x >= z.from) st = z.style;
    return st;
  }

  /** 젤리를 깔고 StageData와 계획을 돌려준다 */
  build(): { stage: StageData; plan: Plan; perfect: Replay; report: string } {
    const plan = this.solve();
    const { pts } = this.trace(plan);
    const goal = this.stageData().goalX;

    // 1) 궤적을 따라 호 길이 SPACING마다 점
    const path: { x: number; y: number; air: boolean }[] = [];
    let acc = 0;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      let d = SPACING - acc;
      while (d <= len) {
        const t = d / len;
        path.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, air: a.air || b.air });
        d += SPACING;
      }
      acc = len - (d - SPACING);
    }

    // 2) 특별한 젤리: 점프 정점(카드·룬·곰), 지정한 곰젤리 자리
    const specials: { type: JellyType; x: number; y: number; clear: number }[] = [];
    const sorted = [...this.actions].sort((p, q) => p.start - q.start);
    for (const a of sorted) {
      if (!a.apex) continue;
      // 이 장애물 근처 공중 구간에서 가장 높은 점
      let best: { x: number; y: number } | null = null;
      for (const p of pts) {
        if (!p.air || p.x < a.start - 420 || p.x > a.end + 300) continue;
        if (!best || p.y < best.y) best = p;
      }
      if (!best) continue;
      const type: JellyType = a.apex === 'rune' ? 'jelly_rune' : a.apex === 'card' ? 'jelly_card' : 'jelly_big';
      const clear = type === 'jelly_rune' ? 96 : type === 'jelly_big' ? 46 : 36;
      // 룬은 커서 몸 중심보다 살짝 위로 띄워 머리로 받는 느낌 (그래도 반드시 닿는다)
      specials.push({ type, x: best.x, y: best.y - (type === 'jelly_rune' ? 30 : 0), clear });
    }
    for (const bx of this.bears) {
      const p = pts.find((q) => q.x >= bx);
      if (p) specials.push({ type: 'jelly_big', x: p.x, y: p.y, clear: 46 });
    }
    const itemX = this.items.map((it) => it.x);

    // 3) 경로 젤리: 시작 400px, 결승 직전, 아이템·특별 젤리 주변은 비운다
    const jellies: StageData['jellies'] = [];
    for (const p of path) {
      if (p.x < 420 || p.x > goal - 120) continue;
      if (itemX.some((ix) => Math.abs(ix - p.x) < 50)) continue;
      if (specials.some((sp) => Math.hypot(sp.x - p.x, sp.y - p.y) < sp.clear)) continue;
      const st = this.styleAt(p.x);
      if (st === 'none') continue;
      jellies.push({ type: st === 'coin' ? 'coin' : 'jelly_normal', x: Math.round(p.x), y: Math.round(p.y) });
    }
    for (const sp of specials) jellies.push({ type: sp.type, x: Math.round(sp.x), y: Math.round(sp.y) });
    jellies.sort((a, b) => a.x - b.x || a.y - b.y);

    const stage = this.stageData(jellies, true);

    // 4) 검증: 계획대로 달리면 맞지 않고, 젤리를 (거의) 전부 먹는다
    const s = createSim(stage);
    const input = StageBuilder.runner(plan);
    const rec = new ReplayRecorder(stage.id, null);
    let hits = 0;
    while (s.outcome === 'playing' && s.tick < 60 * 60 * 5) {
      const f = input(s);
      rec.record(s.tick, f);
      for (const e of step(s, f)) if (e.type === 'hit') hits++;
    }
    const total = stage.jellies.filter((j) => j.type !== 'coin').length;
    const rate = s.jelliesTaken / Math.max(1, total);
    if (s.outcome !== 'cleared' || hits > 0) throw new Error(`${this.spec.id}: 검증 실패 (결과 ${s.outcome}, 피격 ${hits})`);
    if (s.jelliesTaken < total) {
      const missed = s.entities.filter((e) => e.alive && e.kind.startsWith('jelly_')).map((e) => `${e.kind}@(${Math.round(e.x + e.w / 2)},${Math.round(e.y - e.h / 2)})`);
      throw new Error(`${this.spec.id}: 계획대로 달려도 못 먹는 젤리 ${missed.length}개: ${missed.slice(0, 8).join(' ')}`);
    }
    const count = (t: JellyType) => stage.jellies.filter((j) => j.type === t).length;
    const report =
      `${stage.id} ${stage.name}: 길이 ${stage.length}px(${(stage.goalX / stage.speed).toFixed(0)}초), 장애물 ${stage.obstacles.length}, 구멍 ${this.holes.length}, ` +
      `젤리 ${count('jelly_normal')} · 곰 ${count('jelly_big')} · 카드 ${count('jelly_card')} · 룬 ${count('jelly_rune')} · 코인 ${count('coin')}, ` +
      `아이템 ${stage.items.length}, 계획대로 먹은 젤리 ${(rate * 100).toFixed(1)}%, 점수 ${s.jellyScore.toLocaleString()}`;
    return { stage, plan, perfect: rec.toJSON(), report };
  }
}

/** StageData → Tiled 맵(.tmj) */
export function toTmj(stage: StageData): unknown {
  let id = 1;
  const obj = (o: Record<string, unknown>) => ({ id: id++, name: '', rotation: 0, visible: true, ...o });
  const point = (type: string, x: number, y: number) => obj({ type, x, y, width: 0, height: 0, point: true });
  const layer = (lid: number, name: string, objects: unknown[]) => ({
    id: lid,
    name,
    type: 'objectgroup',
    visible: true,
    opacity: 1,
    x: 0,
    y: 0,
    draworder: 'topdown',
    objects,
  });
  const layers = [
    layer(1, 'ground', stage.ground.map(([a, b]) => obj({ type: 'ground', x: a, y: cfg.groundY, width: b - a, height: 720 - cfg.groundY }))),
    layer(
      2,
      'obstacles',
      stage.obstacles.map((o) => {
        const hb = cfg.hitbox[o.type];
        const bottom = o.type === 'obstacle_air' ? cfg.hitbox.airBottomY : cfg.groundY;
        return obj({ type: o.type, x: o.x, y: bottom - hb.h, width: hb.w, height: hb.h });
      }),
    ),
    layer(3, 'jellies', stage.jellies.map((j) => point(j.type, j.x, j.y))),
    layer(4, 'items', stage.items.map((it) => point(it.type, it.x, it.y))),
    layer(5, 'goal', [obj({ type: 'goal', x: stage.goalX, y: 0, width: 32, height: cfg.groundY })]),
  ];
  return {
    type: 'map',
    version: '1.10',
    tiledversion: '1.10.2',
    orientation: 'orthogonal',
    renderorder: 'right-down',
    infinite: false,
    compressionlevel: -1,
    width: stage.length / 40,
    height: 18,
    tilewidth: 40,
    tileheight: 40,
    nextlayerid: 6,
    nextobjectid: id,
    tilesets: [],
    properties: [
      { name: 'background', type: 'string', value: stage.background.join(',') },
      { name: 'bgm', type: 'string', value: stage.bgm },
      { name: 'id', type: 'string', value: stage.id },
      { name: 'name', type: 'string', value: stage.name },
      { name: 'speed', type: 'int', value: stage.speed },
      { name: 'stars', type: 'string', value: stage.stars.join(',') },
    ],
    layers,
  };
}
