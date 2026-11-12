// Tiled(.tmj) → StageData 변환과 검증. CLI(scripts/convert-tiled.ts)와 테스트가 함께 쓴다.
import { gameConfig as cfg } from '../../src/config/gameConfig';
import {
  ITEM_TYPES,
  JELLY_TYPES,
  OBSTACLE_TYPES,
  type ItemType,
  type JellyType,
  type ObstacleType,
  type StageData,
} from '../../src/data/schema';

interface TiledProperty {
  name: string;
  type?: string;
  value: unknown;
}

export interface TiledObject {
  id: number;
  x: number;
  y: number;
  width?: number;
  height?: number;
  type?: string;
  class?: string;
  point?: boolean;
  polyline?: { x: number; y: number }[];
  properties?: TiledProperty[];
}

interface TiledLayer {
  type: string;
  name: string;
  objects?: TiledObject[];
}

export interface TiledMap {
  width: number;
  tilewidth: number;
  height: number;
  tileheight: number;
  properties?: TiledProperty[];
  layers: TiledLayer[];
}

export interface ConvertResult {
  stage: StageData | null;
  errors: string[];
}

const clsOf = (o: TiledObject) => (o.type ?? o.class ?? '').trim();
const prop = (props: TiledProperty[] | undefined, name: string) => props?.find((p) => p.name === name)?.value;

/** 2단 점프(정점에서 2단)로 날 수 있는 최대 수평 거리 */
export function maxJumpDistance(speed: number): number {
  const g = cfg.gravity;
  const v1 = -cfg.jumpVelocity;
  const v2 = -cfg.doubleJumpVelocity;
  const h = (v1 * v1) / (2 * g) + (v2 * v2) / (2 * g);
  const airtime = v1 / g + v2 / g + Math.sqrt((2 * h) / g);
  return speed * airtime;
}

function expandPolyline(o: TiledObject, spacing: number): { x: number; y: number }[] {
  const pts = (o.polyline ?? []).map((p) => ({ x: o.x + p.x, y: o.y + p.y }));
  const out: { x: number; y: number }[] = [];
  if (pts.length === 0) return out;
  out.push(pts[0]);
  let carry = 0; // 지난 선분에서 남은 거리
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    let d = spacing - carry;
    while (d <= len + 1e-6) {
      const t = d / len;
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
      d += spacing;
    }
    carry = len - (d - spacing);
  }
  return out;
}

export function convertTiled(map: TiledMap, file: string): ConvertResult {
  const errors: string[] = [];
  const err = (msg: string, o?: TiledObject) => errors.push(`${file}${o ? ` (오브젝트 #${o.id})` : ''}: ${msg}`);
  const P = map.properties;

  const id = prop(P, 'id');
  const name = prop(P, 'name');
  const speed = Number(prop(P, 'speed'));
  const bgm = prop(P, 'bgm');
  const bgRaw = prop(P, 'background');
  const starsRaw = prop(P, 'stars');
  if (typeof id !== 'string' || !id) err('맵 속성 id 누락');
  if (typeof name !== 'string') err('맵 속성 name 누락');
  if (!Number.isFinite(speed) || speed <= 0) err('맵 속성 speed 누락 또는 잘못됨');
  if (typeof bgm !== 'string') err('맵 속성 bgm 누락');
  const background = typeof bgRaw === 'string' ? bgRaw.split(',').map((x) => x.trim()) : [];
  if (background.length !== 3) err('맵 속성 background는 쉼표로 구분한 키 3개');
  const stars = typeof starsRaw === 'string' ? starsRaw.split(',').map((x) => Number(x.trim())) : [];
  if (stars.length !== 3 || stars.some((x) => !Number.isFinite(x))) err('맵 속성 stars는 쉼표로 구분한 숫자 3개');

  const length = map.width * map.tilewidth;
  const layer = (n: string) => map.layers.find((l) => l.type === 'objectgroup' && l.name === n)?.objects ?? [];

  const ground: [number, number][] = layer('ground')
    .map((o) => [Math.round(o.x), Math.round(o.x + (o.width ?? 0))] as [number, number])
    .sort((a, b) => a[0] - b[0]);
  if (ground.length === 0) err('ground 레이어에 구간이 없음');
  else if (ground[0][0] !== 0) err(`첫 ground 구간이 x = 0에서 시작하지 않음 (x = ${ground[0][0]})`);
  for (let i = 0; i < ground.length; i++) {
    if (ground[i][1] <= ground[i][0]) err(`폭이 0인 ground 구간 x = ${ground[i][0]}`);
    if (i > 0 && ground[i][0] < ground[i - 1][1]) err(`ground 구간이 겹침: x = ${ground[i][0]}`);
  }
  const inGround = (x: number) => ground.some(([a, b]) => x >= a && x < b);
  if (Number.isFinite(speed) && speed > 0) {
    const limit = maxJumpDistance(speed);
    for (let i = 1; i < ground.length; i++) {
      const gap = ground[i][0] - ground[i - 1][1];
      if (gap > limit) err(`구멍 폭 ${gap}px가 2단 점프 최대 거리 ${Math.floor(limit)}px를 넘음 (x = ${ground[i - 1][1]})`);
    }
  }

  const inside = (x: number, o: TiledObject) => {
    if (x < 0 || x > length) err(`오브젝트가 [0, ${length}] 밖에 있음 (x = ${x})`, o);
  };

  const obstacles: StageData['obstacles'] = [];
  for (const o of layer('obstacles')) {
    const c = clsOf(o);
    if (!OBSTACLE_TYPES.includes(c as ObstacleType)) {
      err(`모르는 장애물 클래스 "${c}"`, o);
      continue;
    }
    const x = Math.round(o.x);
    inside(x, o);
    if (c !== 'obstacle_air') {
      const w = cfg.hitbox[c as 'obstacle_low' | 'obstacle_high'].w;
      const seg = ground.find(([a, b]) => x >= a && x + w <= b);
      if (!seg) err(`지상 장애물이 구멍 위에 있음 (x = ${x})`, o);
    }
    obstacles.push({ type: c as ObstacleType, x });
  }

  const jellies: StageData['jellies'] = [];
  for (const o of layer('jellies')) {
    const c = clsOf(o);
    if (c === 'jelly_path') {
      const t = String(prop(o.properties, 'type') ?? 'jelly_normal');
      if (!JELLY_TYPES.includes(t as JellyType)) {
        err(`jelly_path의 type "${t}"을 모름`, o);
        continue;
      }
      const spacing = Number(prop(o.properties, 'spacing') ?? 40);
      if (!o.polyline || o.polyline.length < 2) {
        err('jelly_path는 점이 2개 이상인 폴리라인이어야 함', o);
        continue;
      }
      for (const p of expandPolyline(o, spacing > 0 ? spacing : 40)) {
        inside(p.x, o);
        jellies.push({ type: t as JellyType, x: Math.round(p.x), y: Math.round(p.y) });
      }
    } else if (JELLY_TYPES.includes(c as JellyType)) {
      inside(o.x, o);
      jellies.push({ type: c as JellyType, x: Math.round(o.x), y: Math.round(o.y) });
    } else {
      err(`모르는 젤리 클래스 "${c}"`, o);
    }
  }

  const items: StageData['items'] = [];
  for (const o of layer('items')) {
    const c = clsOf(o);
    if (!ITEM_TYPES.includes(c as ItemType)) {
      err(`모르는 아이템 클래스 "${c}"`, o);
      continue;
    }
    inside(o.x, o);
    items.push({ type: c as ItemType, x: Math.round(o.x), y: Math.round(o.y) });
  }

  const goals = layer('goal');
  if (goals.length !== 1) err(`goal은 1개여야 함 (현재 ${goals.length}개)`);
  const goalX = goals.length ? Math.round(goals[0].x) : 0;
  if (goals.length === 1) {
    inside(goalX, goals[0]);
    if (!inGround(goalX)) err(`goal이 바닥 위가 아님 (x = ${goalX})`, goals[0]);
  }

  if (errors.length) return { stage: null, errors };

  obstacles.sort((a, b) => a.x - b.x);
  jellies.sort((a, b) => a.x - b.x || a.y - b.y);
  items.sort((a, b) => a.x - b.x);
  return {
    stage: {
      id: id as string,
      name: name as string,
      length,
      speed,
      bgm: bgm as string,
      background: background as [string, string, string],
      ground,
      obstacles,
      jellies,
      items,
      goalX,
      stars: stars as [number, number, number],
    },
    errors,
  };
}
