import Phaser from 'phaser';
import { Sound } from '../audio/Sound';
import { stageOrder, stages } from '../data/stages';
import { saveStore } from '../save/store';
import { button, COLORS, text } from '../ui/style';
import type { RunResultData } from './GameScene';

export class ResultScene extends Phaser.Scene {
  constructor() {
    super('Result');
  }

  create(r: RunResultData): void {
    Sound.stopBgm();
    const inOrder = stageOrder.includes(r.stageId);
    const { newBest } = inOrder
      ? saveStore.applyRun({ stageId: r.stageId, cleared: r.outcome === 'cleared', score: r.score, stars: r.stars, coins: r.coins })
      : { newBest: false };

    this.add.tileSprite(0, 0, 1280, 720, 'bg_far').setOrigin(0);
    this.add.rectangle(0, 0, 1280, 720, COLORS.panel, 0.6).setOrigin(0);
    const cleared = r.outcome === 'cleared';
    const name = stages[r.stageId]?.name ?? r.stageId;
    text(this, 640, 80, name, 28, COLORS.inkDim).setOrigin(0.5);
    text(this, 640, 140, cleared ? '클리어!' : r.failReason === 'fall' ? '구멍에 빠졌어요' : '체력이 다 떨어졌어요', 56, cleared ? '#ffd23f' : '#ff8a8a', true).setOrigin(0.5);

    const stars = '★'.repeat(r.stars) + '☆'.repeat(3 - r.stars);
    text(this, 640, 225, stars, 64, '#f5a623').setOrigin(0.5);

    const rows: [string, string][] = [
      ['젤리', `${r.jellyScore.toLocaleString()}점  (${r.jellies})`],
      ['거리', `${r.distance.toLocaleString()}m`],
      ['코인', `${r.coins}`],
    ];
    rows.forEach(([k, v], i) => {
      text(this, 470, 300 + i * 44, k, 26, COLORS.inkDim).setOrigin(0, 0.5);
      text(this, 810, 300 + i * 44, v, 26, '#ffffff', true).setOrigin(1, 0.5);
    });
    this.add.rectangle(640, 432, 340, 2, 0xffffff, 0.4);
    text(this, 470, 465, '점수', 30, '#ffffff', true).setOrigin(0, 0.5);
    text(this, 810, 465, r.score.toLocaleString(), 36, '#ffd23f', true).setOrigin(1, 0.5);
    if (newBest) text(this, 830, 465, '최고 기록!', 22, '#7cf29c', true).setOrigin(0, 0.5);

    const idx = stageOrder.indexOf(r.stageId);
    const next = idx >= 0 ? stageOrder[idx + 1] : undefined;
    const canNext = cleared && !!next && saveStore.isUnlocked(stageOrder, next);
    const retry = () => this.scene.start('Game', { stageId: r.stageId });
    const goNext = () => canNext && this.scene.start('Game', { stageId: next });
    button(this, 350, 600, 260, 76, '다시 하기', retry, 0xdfe6f5);
    button(this, 640, 600, 260, 76, '다음 스테이지', goNext).setEnabled(canNext);
    button(this, 930, 600, 260, 76, '로비로', () => this.scene.start('Lobby'), 0xdfe6f5);

    this.input.keyboard?.on('keydown', (ev: KeyboardEvent) => {
      if (ev.code === 'Enter' || ev.code === 'Space') (canNext ? goNext : retry)();
      if (ev.code === 'Escape') this.scene.start('Lobby');
    });
  }
}
