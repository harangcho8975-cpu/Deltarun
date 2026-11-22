// 에피소드 1 "시작": 스테이지 10개. 배치만 적는다 (점프 시점·젤리 길은 생성기가 물리로 계산).
//  low(): 낮은 장애물 → 점프   high(): 높은 장애물 → 2단 점프   air()/airs(n): 매달린 장애물 → 슬라이드
//  hole(w): 구멍 (250px 넘으면 2단 점프)   item(): 아이템   bear(): 곰젤리   smash(): 거대화·부스터로 부술 장애물
//  apex 'card' | 'rune' | 'big': 그 점프의 정점에 카드 젤리 / 델타룬 문양 젤리 / 곰젤리
//  jellies('coin' | 'jelly' | 'none'): 이후 젤리 길의 종류
import type { StageBuilder, StageSpec } from '../lib/stageBuilder';

export interface StageDef {
  spec: StageSpec;
  build: (b: StageBuilder) => void;
}

const BG: [string, string, string] = ['bg_far', 'bg_mid', 'bg_near'];
const spec = (n: number, name: string): StageSpec => ({ id: `ep1_${String(n).padStart(2, '0')}`, name, bgm: n <= 4 ? 'bgm_stage1' : n <= 7 ? 'bgm_stage2' : 'bgm_stage3', background: BG });

export const EPISODE1: StageDef[] = [
  {
    // 1-1: 점프만. 넉넉한 간격, 곰젤리와 카드 젤리 맛보기, 끝에 룬 젤리
    spec: spec(1, '첫 발걸음'),
    build: (b) => {
      b.run(900);
      b.low(700).low(700).bear().run(500).low(700, 'card').run(300);
      b.jellies('coin').low(600).low(600).jellies('jelly').run(400);
      b.low(500).low(500).low(700, 'card').bear().run(500);
      b.low(420).low(420).low(700).run(300);
      b.item('item_magnet', 400).low(500).low(500).low(500).run(400);
      b.low(700, 'big').run(300).low(420).low(420).low(800, 'rune').run(700);
    },
  },
  {
    // 1-2: 높은 장애물(2단 점프)
    spec: spec(2, '두 번 뛰기'),
    build: (b) => {
      b.run(900);
      b.low(600).high(700).run(300).low(500).high(700, 'card').bear().run(500);
      b.high(600).high(700).run(300);
      b.jellies('coin').low(450).low(600).jellies('jelly').high(700, 'card').run(300);
      b.item('item_heal', 400).low(450).high(560).low(450).high(700).run(400);
      b.low(420).low(420).high(800, 'rune').bear().run(400);
      b.high(560).low(450).high(800).run(600);
    },
  },
  {
    // 1-3: 매달린 장애물(슬라이드)
    spec: spec(3, '숙여서 지나가기'),
    build: (b) => {
      b.run(900);
      b.air(600).air(600).low(600).air(500).run(300);
      b.airs(3, 200, 600).bear().run(300).low(450).air(500).high(700, 'card').run(300);
      b.item('item_magnet', 400).jellies('coin').airs(2, 260, 500).jellies('jelly').low(450).low(600);
      b.air(450).high(600).air(450).low(700, 'card').run(300);
      b.item('item_heal', 400).airs(4, 180, 600).bear().run(300);
      b.low(420).air(450).low(420).high(900, 'rune').run(600);
    },
  },
  {
    // 1-4: 첫 구멍 (한 번 점프로 건너는 폭)
    spec: spec(4, '첫 구멍'),
    build: (b) => {
      b.run(900);
      b.hole(160, 600).hole(200, 600).low(500).hole(200, 700, 'card').run(300);
      b.air(500).hole(220, 500).low(450).bear().run(300);
      b.jellies('coin').hole(180, 450).hole(180, 450).hole(180, 600).jellies('jelly');
      b.item('item_heal', 400).high(600).hole(240, 600, 'card').air(500).low(600);
      b.hole(200, 450).low(420).hole(220, 450).high(700).run(300);
      b.airs(2, 220, 500).hole(240, 800, 'rune').bear().run(600);
    },
  },
  {
    // 1-5: 넓은 구멍(2단 점프)과 카드 젤리 정원
    spec: spec(5, '카드 정원'),
    build: (b) => {
      b.run(900);
      b.hole(320, 600, 'card').hole(200, 500).hole(360, 700, 'card').run(300);
      b.item('item_magnet', 400).low(420, 'card').low(420, 'card').low(420, 'card').low(600, 'card').run(300);
      b.hole(380, 600).air(450).hole(300, 600, 'card').bear().run(300);
      b.item('item_heal', 400).jellies('coin').high(500).high(600).jellies('jelly').hole(420, 700, 'card');
      b.low(420).hole(220, 450).high(560, 'card').air(450).hole(340, 600);
      b.item('item_heal', 400).hole(260, 450).hole(400, 900, 'rune').bear().run(300);
      b.low(420, 'card').low(420, 'card').high(800, 'card').run(600);
    },
  },
  {
    // 1-6: 부스터 — 달려서 부수는 맛, 그 뒤 촘촘한 조합
    spec: spec(6, '부스터 언덕'),
    build: (b) => {
      b.run(900);
      b.low(450).high(560).air(500).run(300);
      b.item('item_boost', 300).smash(['obstacle_low', 'obstacle_high', 'obstacle_low', 'obstacle_high', 'obstacle_low', 'obstacle_high', 'obstacle_low'], 420).run(1800);
      b.hole(240, 500, 'card').low(420).low(420).air(450).high(600).run(300);
      b.item('item_heal', 400).airs(2, 240, 450).hole(360, 600).bear().run(300);
      b.jellies('coin').low(420).low(420).low(420).jellies('jelly').high(560, 'card').hole(300, 600);
      b.item('item_boost', 300).smash(['obstacle_high', 'obstacle_low', 'obstacle_high', 'obstacle_low', 'obstacle_high', 'obstacle_low'], 460).run(1800);
      b.item('item_heal', 400).air(450).hole(220, 450).high(560).low(420).hole(400, 900, 'rune').run(600);
    },
  },
  {
    // 1-7: 거대화 — 커져서 부수고, 다시 정확하게
    spec: spec(7, '거인의 길'),
    build: (b) => {
      b.run(900);
      b.low(450).air(450).hole(260, 600).run(300);
      b.item('item_giant', 300).smash(['obstacle_low', 'obstacle_high', 'obstacle_low', 'obstacle_low', 'obstacle_high'], 400).run(1100);
      b.high(560, 'card').hole(300, 500).airs(3, 180, 500).bear().run(300);
      b.item('item_heal', 400).low(420).hole(220, 450).low(420).hole(380, 600, 'card').air(500);
      b.item('item_giant', 300).smash(['obstacle_high', 'obstacle_high', 'obstacle_low', 'obstacle_high', 'obstacle_low'], 400).run(1100);
      b.jellies('coin').hole(200, 450).hole(200, 450).hole(200, 600).jellies('jelly');
      b.item('item_heal', 400).high(560).air(450).low(420).high(900, 'rune').bear().run(600);
    },
  },
  {
    // 1-8: 리듬 — 점프·슬라이드·구멍이 박자처럼
    spec: spec(8, '리듬 달리기'),
    build: (b) => {
      b.run(900);
      for (let i = 0; i < 3; i++) b.low(420).air(420).hole(220, 450);
      b.bear().run(300).item('item_magnet', 400);
      b.high(500, 'card').low(420).high(500).low(420).air(500).run(300);
      b.item('item_heal', 400).jellies('coin').airs(3, 160, 450).jellies('jelly').hole(320, 500, 'card').low(420);
      for (let i = 0; i < 3; i++) b.hole(260, 420).air(420);
      b.item('item_heal', 400).high(500).high(500).hole(380, 600, 'card').bear().run(300);
      b.low(420).air(420).low(420).air(420).hole(400, 900, 'rune').run(600);
    },
  },
  {
    // 1-9: 낭떠러지 — 넓은 구멍이 이어진다
    spec: spec(9, '낭떠러지'),
    build: (b) => {
      b.run(900);
      b.hole(300, 450).hole(360, 450).hole(420, 600, 'card').run(300);
      b.low(420).hole(260, 450).high(500).hole(380, 600).bear().run(300);
      b.item('item_heal', 400).air(420).hole(340, 450, 'card').air(420).hole(400, 600);
      b.item('item_boost', 300).run(800).hole(500, 300).run(400).hole(500, 300).run(1500);
      b.item('item_heal', 400).jellies('coin').hole(220, 420).hole(220, 420).hole(220, 600).jellies('jelly');
      b.high(500, 'card').hole(420, 500).low(420).hole(440, 600).bear().run(300);
      b.item('item_heal', 400).airs(2, 200, 450).hole(380, 450).hole(450, 900, 'rune').run(600);
    },
  },
  {
    // 1-10: 시작의 끝 — 지금까지 배운 것 전부, 룬 젤리 두 개
    spec: spec(10, '시작의 끝'),
    build: (b) => {
      b.run(900);
      b.low(420).high(500).air(420).hole(260, 500, 'card').run(300);
      b.item('item_magnet', 400).low(420, 'card').low(420, 'card').hole(360, 500).airs(3, 180, 500).bear().run(300);
      b.high(500).hole(420, 600, 'rune').run(300);
      b.item('item_heal', 400).item('item_giant', 300).smash(['obstacle_high', 'obstacle_low', 'obstacle_high', 'obstacle_high', 'obstacle_low'], 400).run(1100);
      b.jellies('coin').low(420).air(420).low(420).air(500).jellies('jelly');
      b.hole(300, 420).hole(380, 420).high(500, 'card').low(420).air(500).bear().run(300);
      b.item('item_heal', 400).item('item_boost', 300).smash(['obstacle_low', 'obstacle_high', 'obstacle_low', 'obstacle_high', 'obstacle_low', 'obstacle_high'], 440).run(1800);
      b.air(420).hole(340, 420).high(500).hole(400, 500, 'card').low(420).low(420);
      b.item('item_heal', 400).airs(2, 200, 450).hole(440, 450).high(500).hole(460, 1000, 'rune').run(700);
    },
  },
];
