import { describe, expect, it } from 'vitest';
import { convertTiled, maxJumpDistance, type TiledMap, type TiledObject } from '../../scripts/lib/convertTiled';

let nextId = 1;
const obj = (o: Partial<TiledObject>): TiledObject => ({ id: nextId++, x: 0, y: 0, ...o });
const props = [
  { name: 'id', type: 'string', value: 'mini' },
  { name: 'name', type: 'string', value: '미니' },
  { name: 'speed', type: 'int', value: 300 },
  { name: 'bgm', type: 'string', value: 'bgm_stage1' },
  { name: 'background', type: 'string', value: 'bg_far, bg_mid, bg_near' },
  { name: 'stars', type: 'string', value: '0.5,0.75,0.95' },
];

function map(layers: Record<string, TiledObject[]>, p = props): TiledMap {
  return {
    width: 100, tilewidth: 40, height: 18, tileheight: 40, properties: p,
    layers: Object.entries(layers).map(([name, objects]) => ({ type: 'objectgroup', name, objects })),
  };
}

const base = () => ({
  ground: [obj({ x: 0, y: 600, width: 2000, height: 120 }), obj({ x: 2200, y: 600, width: 1800, height: 120 })],
  obstacles: [obj({ x: 1000.4, y: 600, point: true, type: 'obstacle_low' }), obj({ x: 600, y: 544, point: true, class: 'obstacle_air' })],
  jellies: [
    obj({ x: 300, y: 560, point: true, type: 'jelly_big' }),
    obj({ x: 100, y: 560, type: 'jelly_path', polyline: [{ x: 0, y: 0 }, { x: 100, y: 0 }], properties: [{ name: 'type', value: 'coin' }, { name: 'spacing', value: 50 }] }),
  ],
  items: [obj({ x: 1500, y: 540, point: true, type: 'item_magnet' })],
  goal: [obj({ x: 3800, y: 600, point: true })],
});

describe('Tiled 변환', () => {
  it('작은 맵을 기대한 StageData로 바꾼다', () => {
    const { stage, errors } = convertTiled(map(base()), 'mini.tmj');
    expect(errors).toEqual([]);
    expect(stage).toEqual({
      id: 'mini', name: '미니', length: 4000, speed: 300, bgm: 'bgm_stage1',
      background: ['bg_far', 'bg_mid', 'bg_near'],
      ground: [[0, 2000], [2200, 4000]],
      obstacles: [{ type: 'obstacle_air', x: 600 }, { type: 'obstacle_low', x: 1000 }],
      jellies: [
        { type: 'coin', x: 100, y: 560 }, { type: 'coin', x: 150, y: 560 }, { type: 'coin', x: 200, y: 560 },
        { type: 'jelly_big', x: 300, y: 560 },
      ],
      items: [{ type: 'item_magnet', x: 1500, y: 540 }],
      goalX: 3800,
      stars: [0.5, 0.75, 0.95],
    });
  });

  const fails = (layers: Record<string, TiledObject[]>, match: RegExp, p = props) => {
    const { stage, errors } = convertTiled(map(layers, p), 'bad.tmj');
    expect(stage).toBeNull();
    expect(errors.join('\n')).toMatch(match);
  };

  it('모르는 클래스', () => fails({ ...base(), obstacles: [obj({ x: 500, type: 'rock' })] }, /모르는 장애물 클래스 "rock"/));
  it('맵 속성 누락', () => fails(base(), /speed/, props.filter((p) => p.name !== 'speed')));
  it('goal이 1개가 아님', () => fails({ ...base(), goal: [] }, /goal은 1개/));
  it('goal이 구멍 위', () => fails({ ...base(), goal: [obj({ x: 2100 })] }, /goal이 바닥 위가 아님/));
  it('ground가 0에서 시작하지 않음', () => fails({ ...base(), ground: [obj({ x: 40, width: 3960 })] }, /x = 0/));
  it('ground 겹침', () => fails({ ...base(), ground: [obj({ x: 0, width: 2000 }), obj({ x: 1900, width: 2100 })] }, /겹침/));
  it('지상 장애물이 구멍 위', () => fails({ ...base(), obstacles: [obj({ x: 1980, type: 'obstacle_high' })] }, /구멍 위/));
  it('구멍이 2단 점프 거리보다 넓음', () => {
    const w = Math.ceil(maxJumpDistance(300)) + 10;
    fails({ ...base(), ground: [obj({ x: 0, width: 1000 }), obj({ x: 1000 + w, width: 3000 - w })] }, /2단 점프 최대 거리/);
  });
  it('맵 밖 오브젝트', () => fails({ ...base(), items: [obj({ x: 4500, y: 540, type: 'item_heal' })] }, /밖에 있음/));
});
