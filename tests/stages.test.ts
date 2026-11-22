import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { maps, sectionAt, sectionCount } from '../src/data/episodes';
import { validateStage } from '../src/data/schema';
import { stageOrder, stages } from '../src/data/stages';
import testStage from '../src/data/stage_test.json';
import { runReplay, starsFor, type Replay } from '../src/sim';

const ep1 = stages.ep1;

describe('맵 "시작"', () => {
  it('맵 하나 안에 스테이지 10개 구간이 순서대로 있다 (카카오 쿠키런처럼)', () => {
    expect(stageOrder).toEqual(['ep1']);
    expect(maps).toEqual(['ep1']);
    expect(ep1.name).toBe('시작');
    expect(sectionCount(ep1)).toBe(10);
    expect(ep1.sections!.map((s) => s.name)).toEqual([
      '첫 발걸음', '두 번 뛰기', '숙여서 지나가기', '첫 구멍', '카드 정원',
      '부스터 언덕', '거인의 길', '리듬 달리기', '낭떠러지', '시작의 끝',
    ]);
    expect(ep1.sections![0].x).toBe(0);
  });
  it('일정 거리를 가면 다음 스테이지: 위치로 구간을 찾는다', () => {
    const s = ep1.sections!;
    expect(sectionAt(ep1, 0)).toBe(0);
    expect(sectionAt(ep1, s[1].x - 1)).toBe(0);
    expect(sectionAt(ep1, s[1].x)).toBe(1);
    expect(sectionAt(ep1, ep1.goalX)).toBe(9);
  });
  it('스키마 검증을 통과한다 (stage_test.json 포함)', () => {
    expect(validateStage(ep1)).toEqual([]);
    expect(validateStage(testStage)).toEqual([]);
  });
  it('속도 620, 구간마다 카드 젤리와 델타룬 문양 젤리가 있다', () => {
    expect(ep1.speed).toBe(620);
    const secs = ep1.sections!;
    secs.forEach((sec, i) => {
      const end = secs[i + 1]?.x ?? ep1.goalX;
      const j = ep1.jellies.filter((x) => x.x >= sec.x && x.x < end);
      expect(j.filter((x) => x.type === 'jelly_card').length, sec.name).toBeGreaterThanOrEqual(2);
      expect(j.filter((x) => x.type === 'jelly_rune').length, sec.name).toBeGreaterThanOrEqual(1);
    });
  });
  it('스테이지가 바뀌는 곳마다 회복 물약이 있다', () => {
    for (const sec of ep1.sections!.slice(1)) {
      const heals = ep1.items.filter((it) => it.type === 'item_heal' && it.x >= sec.x && it.x < sec.x + 800);
      expect(heals.length, sec.name).toBe(2);
    }
  });
  it('젤리끼리 겹치지 않는다', () => {
    const j = ep1.jellies;
    for (let a = 0; a < j.length; a++) {
      for (let b = a + 1; b < j.length && j[b].x - j[a].x < 140; b++) {
        expect(Math.hypot(j[a].x - j[b].x, j[a].y - j[b].y), `${JSON.stringify(j[a])} ${JSON.stringify(j[b])}`).toBeGreaterThan(28);
      }
    }
  });
});

describe('젤리 길 모양', () => {
  it('2단 점프 젤리 길은 좌우 대칭: 가장 높은 젤리가 아치의 가운데에 있고 양쪽 높이가 같다', () => {
    const base = 550;
    const j = stages.ep1.jellies.filter((x) => x.type === 'jelly_normal' || x.type === 'coin');
    // 바닥 높이를 벗어난 젤리들을 x 순서로 이어 붙여 아치를 찾는다
    let arc: { x: number; y: number }[] = [];
    let checked = 0;
    const check = () => {
      // 끊기지 않은 온전한 2단 점프 아치만 (룬·카드 젤리 자리에서 끊긴 반쪽 아치는 뺀다)
      if (arc.length < 8 || base - Math.min(...arc.map((p) => p.y)) < 230 || arc[arc.length - 1].x - arc[0].x < 330) return;
      const x0 = arc[0].x;
      const x1 = arc[arc.length - 1].x;
      const top = arc.reduce((a, b) => (b.y < a.y ? b : a));
      expect(Math.abs(top.x - (x0 + x1) / 2), `아치 ${x0}~${x1}`).toBeLessThan(46); // 젤리 간격(44px) 안
      checked++;
    };
    for (const p of j) {
      if (p.y < base - 8) {
        if (arc.length && p.x - arc[arc.length - 1].x > 60) {
          check();
          arc = [];
        }
        arc.push(p);
      } else if (arc.length) {
        check();
        arc = [];
      }
    }
    expect(checked).toBeGreaterThan(20);
  });

  it('자석 젤리밭: 자석 없이 정답대로 달리면 다 못 먹는다', () => {
    const replay = JSON.parse(readFileSync(join(import.meta.dirname, 'replays', 'ep1.perfect.replay.json'), 'utf8')) as Replay;
    const noMagnet = { ...stages.ep1, items: stages.ep1.items.filter((it) => it.type !== 'item_magnet') };
    const { state } = runReplay(noMagnet, replay);
    expect(state.outcome).toBe('cleared');
    expect(state.jelliesTotal - state.jelliesTaken).toBeGreaterThan(1000);
  });
});

describe('젤리 길: 알맞게 움직이면 젤리를 전부 먹는다', () => {
  it('정답 조작으로 끝까지 달리면 맞지 않고 젤리 100%, 별 3개', () => {
    const replay = JSON.parse(readFileSync(join(import.meta.dirname, 'replays', 'ep1.perfect.replay.json'), 'utf8')) as Replay;
    const { state } = runReplay(ep1, replay);
    expect(state.outcome).toBe('cleared');
    expect(state.jelliesTaken).toBe(state.jelliesTotal);
    expect(starsFor(state)).toBe(3);
  });
});
