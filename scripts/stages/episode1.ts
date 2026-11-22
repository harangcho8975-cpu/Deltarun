// 맵 "시작"의 스테이지 10개. 배치만 적는다 (점프 시점·젤리 길은 생성기가 물리로 계산).
//  low(): 낮은 장애물 → 점프   high(): 높은 장애물 → 2단 점프   air()/airs(n): 매달린 장애물 → 슬라이드
//  hole(w): 구멍 (250px 넘으면 2단 점프)   item(): 아이템   bear(): 곰젤리   smash(): 거대화·부스터로 부술 장애물
//  magnetField(len): 자석 + 길 위쪽 젤리밭 (자석 없이는 다 못 먹음)
//  apex 'card' | 'rune' | 'big': 그 점프의 정점에 카드 젤리 / 델타룬 문양 젤리 / 곰젤리
//  jellies('coin' | 'jelly'): 이후 젤리 길의 종류
// 난이도는 처음부터 고르게: 모든 스테이지에 점프·2단 점프·슬라이드·구멍이 섞여 있고, 뒤로 갈수록 간격(g)만 조금 좁아진다.
import type { StageBuilder, StageSpec } from '../lib/stageBuilder';

export interface StageDef {
  spec: StageSpec;
  build: (b: StageBuilder) => void;
}

const spec = (n: number, name: string): StageSpec => ({ id: `ep1_${String(n).padStart(2, '0')}`, name, bgm: 'bgm_stage1' });

/** 자주 쓰는 묶음. g = 장애물 뒤 여유 (작을수록 촘촘) */
const P = {
  jumps: (b: StageBuilder, g: number) => b.low(g).low(g).low(g + 100),
  mix: (b: StageBuilder, g: number) => b.low(g).high(g + 60).air(g).hole(220, g + 60),
  slideRun: (b: StageBuilder, g: number) => b.airs(3, 180, g).low(g).air(g + 60),
  wide: (b: StageBuilder, g: number, apex?: 'card' | 'rune' | 'big') => b.hole(360, g + 80, apex).low(g).hole(240, g + 60),
  highs: (b: StageBuilder, g: number, apex?: 'card' | 'rune' | 'big') => b.high(g + 60).low(g).high(g + 80, apex),
  coins: (b: StageBuilder, g: number) => b.item('item_heal', 240).jellies('coin').low(g).air(g).low(g).hole(200, g + 60).jellies('jelly'),
};

export const EPISODE1: StageDef[] = [
  {
    spec: spec(1, '첫 발걸음'),
    build: (b) => {
      const g = 480;
      b.run(2200); // 시작하고 3초 남짓은 젤리만 먹으며 달린다
      P.mix(b, g);
      P.jumps(b, g);
      b.high(g + 80, 'card').bear();
      P.slideRun(b, g);
      b.magnetField(2400);
      P.coins(b, g);
      P.wide(b, g, 'card');
      P.highs(b, g, 'rune');
      P.mix(b, g);
      b.run(400);
    },
  },
  {
    spec: spec(2, '두 번 뛰기'),
    build: (b) => {
      const g = 470;
      b.run(500);
      P.highs(b, g, 'card');
      P.mix(b, g);
      b.bear();
      P.wide(b, g);
      P.slideRun(b, g);
      P.coins(b, g);
      b.magnetField(2400);
      P.highs(b, g, 'card');
      P.jumps(b, g);
      b.high(g + 120, 'rune').run(400);
    },
  },
  {
    spec: spec(3, '숙여서 지나가기'),
    build: (b) => {
      const g = 460;
      b.run(500);
      P.slideRun(b, g);
      P.mix(b, g);
      b.airs(4, 160, g).high(g + 80, 'card').bear();
      P.wide(b, g);
      b.magnetField(2600);
      P.coins(b, g);
      P.slideRun(b, g);
      P.highs(b, g, 'card');
      b.hole(380, g + 140, 'rune').run(400);
    },
  },
  {
    spec: spec(4, '첫 구멍'),
    build: (b) => {
      const g = 450;
      b.run(500);
      P.wide(b, g, 'card');
      P.mix(b, g);
      b.hole(200, g).hole(260, g).hole(320, g + 80, 'card').bear();
      P.slideRun(b, g);
      P.coins(b, g);
      b.magnetField(2400);
      P.highs(b, g);
      P.wide(b, g);
      b.hole(420, g + 140, 'rune').run(400);
    },
  },
  {
    spec: spec(5, '카드 정원'),
    build: (b) => {
      const g = 440;
      b.run(500);
      b.low(g, 'card').low(g, 'card').high(g + 60, 'card').hole(340, g + 60, 'card');
      P.mix(b, g);
      b.magnetField(2800);
      P.slideRun(b, g);
      P.highs(b, g, 'card');
      b.bear();
      P.coins(b, g);
      P.wide(b, g, 'card');
      b.low(g, 'card').air(g).high(g + 140, 'rune').run(400);
    },
  },
  {
    spec: spec(6, '부스터 언덕'),
    build: (b) => {
      const g = 430;
      b.run(500);
      P.mix(b, g);
      P.highs(b, g, 'card');
      b.item('item_boost', 300).smash(['obstacle_low', 'obstacle_high', 'obstacle_low', 'obstacle_high', 'obstacle_low', 'obstacle_high'], 460).run(2600);
      P.wide(b, g);
      P.slideRun(b, g);
      b.magnetField(2400);
      P.coins(b, g);
      b.bear();
      P.wide(b, g, 'card');
      b.high(g + 60).hole(400, g + 140, 'rune').run(400);
    },
  },
  {
    spec: spec(7, '거인의 길'),
    build: (b) => {
      const g = 420;
      b.run(500);
      P.mix(b, g);
      b.item('item_giant', 300).smash(['obstacle_low', 'obstacle_high', 'obstacle_high', 'obstacle_low', 'obstacle_high'], 380).run(1000);
      P.highs(b, g, 'card');
      P.slideRun(b, g);
      b.bear();
      P.wide(b, g, 'card');
      b.magnetField(2600);
      P.coins(b, g);
      P.mix(b, g);
      b.high(g + 140, 'rune').run(400);
    },
  },
  {
    spec: spec(8, '리듬 달리기'),
    build: (b) => {
      const g = 420;
      b.run(500);
      for (let i = 0; i < 3; i++) b.low(g).air(g).hole(220, g);
      P.highs(b, g, 'card');
      b.magnetField(2400);
      P.slideRun(b, g);
      b.bear();
      for (let i = 0; i < 3; i++) b.hole(280, g).air(g);
      P.coins(b, g);
      P.wide(b, g, 'card');
      b.low(g).air(g + 160).hole(400, g + 140, 'rune').run(400);
    },
  },
  {
    spec: spec(9, '낭떠러지'),
    build: (b) => {
      const g = 410;
      b.run(500);
      b.hole(320, g).hole(380, g).hole(440, g + 60, 'card');
      P.mix(b, g);
      b.item('item_boost', 300).run(700).boostHole(500, 400).boostHole(500, 400).run(2600);
      P.wide(b, g, 'card');
      b.magnetField(2400);
      P.slideRun(b, g);
      b.bear();
      P.coins(b, g);
      P.highs(b, g);
      b.hole(380, g).hole(460, g + 140, 'rune').run(400);
    },
  },
  {
    spec: spec(10, '시작의 끝'),
    build: (b) => {
      const g = 400;
      b.run(500);
      P.mix(b, g);
      P.highs(b, g, 'card');
      b.hole(420, g + 60, 'rune');
      P.slideRun(b, g);
      b.item('item_giant', 300).smash(['obstacle_high', 'obstacle_low', 'obstacle_high', 'obstacle_high', 'obstacle_low'], 380).run(1000);
      b.magnetField(2800);
      P.wide(b, g, 'card');
      P.coins(b, g);
      b.bear();
      P.mix(b, g);
      b.item('item_boost', 300).smash(['obstacle_low', 'obstacle_high', 'obstacle_low', 'obstacle_high', 'obstacle_low'], 460).run(2600);
      P.highs(b, g, 'card');
      b.airs(2, 200, g).hole(460, g + 200, 'rune').run(600);
    },
  },
];
