export type ObstacleType = 'obstacle_low' | 'obstacle_high' | 'obstacle_air';
export type JellyType = 'jelly_normal' | 'jelly_big' | 'coin';
export type ItemType = 'item_heal' | 'item_magnet' | 'item_giant' | 'item_boost';

export const OBSTACLE_TYPES: readonly ObstacleType[] = ['obstacle_low', 'obstacle_high', 'obstacle_air'];
export const JELLY_TYPES: readonly JellyType[] = ['jelly_normal', 'jelly_big', 'coin'];
export const ITEM_TYPES: readonly ItemType[] = ['item_heal', 'item_magnet', 'item_giant', 'item_boost'];

export interface StageData {
  id: string;
  name: string;
  length: number; // 월드 폭(px)
  speed: number; // 기본 스크롤 속도(px/s)
  bgm: string;
  background: [string, string, string]; // far, mid, near
  ground: [number, number][]; // [startX, endX) 구간, x 오름차순
  obstacles: { type: ObstacleType; x: number }[]; // x = 히트박스 왼쪽 끝
  jellies: { type: JellyType; x: number; y: number }[]; // 중심 좌표
  items: { type: ItemType; x: number; y: number }[]; // 중심 좌표
  goalX: number;
  stars: [number, number, number];
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** 런타임 검증. 문제가 있으면 사람이 읽을 수 있는 메시지 목록을 돌려준다. */
export function validateStage(data: unknown): string[] {
  const errors: string[] = [];
  const s = data as Partial<StageData>;
  if (!s || typeof s !== 'object') return ['스테이지 데이터가 객체가 아님'];
  if (typeof s.id !== 'string' || !s.id) errors.push('id 없음');
  if (typeof s.name !== 'string') errors.push('name 없음');
  if (!isNum(s.length) || s.length <= 0) errors.push('length가 양수가 아님');
  if (!isNum(s.speed) || s.speed <= 0) errors.push('speed가 양수가 아님');
  if (typeof s.bgm !== 'string') errors.push('bgm 없음');
  if (!Array.isArray(s.background) || s.background.length !== 3) errors.push('background는 키 3개');
  if (!Array.isArray(s.stars) || s.stars.length !== 3 || !s.stars.every(isNum)) errors.push('stars는 숫자 3개');
  if (!isNum(s.goalX)) errors.push('goalX 없음');

  if (!Array.isArray(s.ground) || s.ground.length === 0) {
    errors.push('ground 구간 없음');
  } else {
    let prevEnd = -Infinity;
    for (const seg of s.ground) {
      if (!Array.isArray(seg) || !isNum(seg[0]) || !isNum(seg[1]) || seg[1] <= seg[0]) {
        errors.push(`잘못된 ground 구간 ${JSON.stringify(seg)}`);
        continue;
      }
      if (seg[0] < prevEnd) errors.push(`ground 구간이 겹치거나 정렬되지 않음: ${JSON.stringify(seg)}`);
      prevEnd = seg[1];
    }
  }
  for (const o of s.obstacles ?? []) {
    if (!OBSTACLE_TYPES.includes(o.type) || !isNum(o.x)) errors.push(`잘못된 장애물 ${JSON.stringify(o)}`);
  }
  for (const j of s.jellies ?? []) {
    if (!JELLY_TYPES.includes(j.type) || !isNum(j.x) || !isNum(j.y)) errors.push(`잘못된 젤리 ${JSON.stringify(j)}`);
  }
  for (const it of s.items ?? []) {
    if (!ITEM_TYPES.includes(it.type) || !isNum(it.x) || !isNum(it.y)) errors.push(`잘못된 아이템 ${JSON.stringify(it)}`);
  }
  if (!Array.isArray(s.obstacles)) errors.push('obstacles 배열 없음');
  if (!Array.isArray(s.jellies)) errors.push('jellies 배열 없음');
  if (!Array.isArray(s.items)) errors.push('items 배열 없음');
  return errors;
}
