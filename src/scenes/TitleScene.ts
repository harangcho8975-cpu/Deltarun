import Phaser from 'phaser';
import { Sound } from '../audio/Sound';
import { stageOrder, stages } from '../data/stages';
import { saveStore } from '../save/store';
import { fullscreen } from '../ui/fullscreen';
import { button, COLORS, text } from '../ui/style';

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  create(): void {
    Sound.stopBgm();
    this.add.tileSprite(0, 0, 1280, 720, 'bg_far').setOrigin(0);
    this.add.tileSprite(0, 0, 1280, 720, 'bg_mid').setOrigin(0);
    this.add.rectangle(0, 0, 1280, 720, COLORS.panel, 0.35).setOrigin(0);

    text(this, 640, 110, 'delta run', 88, '#ffffff', true).setOrigin(0.5).setShadow(0, 4, '#000000', 8, true, true);
    text(this, 640, 185, '스테이지를 고르세요', 26, COLORS.inkDim).setOrigin(0.5);

    const cardW = 300;
    const gap = 40;
    const x0 = 640 - ((stageOrder.length - 1) * (cardW + gap)) / 2;
    stageOrder.forEach((id, i) => this.card(x0 + i * (cardW + gap), 380, cardW, id, i));

    // 사운드 설정
    const s = saveStore.data.settings;
    const label = (k: 'bgm' | 'sfx') => `${k === 'bgm' ? '배경음' : '효과음'} ${s[k] ? '켜짐' : '꺼짐'}`;
    const mk = (x: number, k: 'bgm' | 'sfx') => {
      const b = button(this, x, 640, 200, 60, label(k), () => {
        saveStore.setSetting(k, !s[k]);
        (b.list[1] as Phaser.GameObjects.Text).setText(label(k));
      }, 0xdfe6f5, 22);
    };
    mk(430, 'bgm');
    mk(650, 'sfx');
    if (fullscreen.supported() && !fullscreen.standalone()) {
      button(this, 870, 640, 200, 60, '전체화면 (F)', () => void fullscreen.toggle(), 0xdfe6f5, 22);
    } else if (!fullscreen.standalone()) {
      // iPhone Safari: 전체화면 API가 없다
      text(this, 640, 700, '전체화면: 공유 버튼 → "홈 화면에 추가"로 열어 주세요', 18, COLORS.inkDim).setOrigin(0.5, 1);
    }
    text(this, 1260, 700, `코인 ${saveStore.data.coins}`, 20, '#ffd23f', true).setOrigin(1, 1);

    // 키보드: 1·2·3으로 시작, Enter는 열린 마지막 스테이지
    this.input.keyboard?.on('keydown', (ev: KeyboardEvent) => {
      const n = Number(ev.key);
      if (n >= 1 && n <= stageOrder.length) this.start(stageOrder[n - 1]);
      if (ev.code === 'KeyF') void fullscreen.toggle();
      if (ev.key === 'Enter') {
        const open = stageOrder.filter((id) => saveStore.isUnlocked(stageOrder, id));
        this.start(open[open.length - 1]);
      }
    });
  }

  private start(id: string): void {
    if (!saveStore.isUnlocked(stageOrder, id)) return;
    this.scene.start('Game', { stageId: id });
  }

  private card(x: number, y: number, w: number, id: string, i: number): void {
    const unlocked = saveStore.isUnlocked(stageOrder, id);
    const rec = saveStore.record(id);
    const h = 260;
    const g = this.add.graphics();
    g.fillStyle(unlocked ? 0xffffff : COLORS.locked, unlocked ? 0.92 : 0.8).fillRoundedRect(x - w / 2, y - h / 2, w, h, 18);
    text(this, x, y - 95, `STAGE ${i + 1}`, 22, unlocked ? '#f5a623' : '#9aa0b4', true).setOrigin(0.5);
    text(this, x, y - 55, stages[id].name, 32, unlocked ? '#1a1a2e' : '#c3c7d6', true).setOrigin(0.5);
    if (unlocked) {
      const stars = '★'.repeat(rec.bestStars) + '☆'.repeat(3 - rec.bestStars);
      text(this, x, y + 5, stars, 40, '#f5a623').setOrigin(0.5);
      text(this, x, y + 55, rec.bestScore ? `최고 ${rec.bestScore.toLocaleString()}점` : '아직 기록 없음', 22, '#4a5068').setOrigin(0.5);
      text(this, x, y + 95, '눌러서 시작', 18, '#8a90a8').setOrigin(0.5);
    } else {
      text(this, x, y + 20, '잠김', 34, '#e8eaf2', true).setOrigin(0.5);
      text(this, x, y + 70, `STAGE ${i}을 클리어하면 열려요`, 18, '#e8eaf2').setOrigin(0.5);
    }
    const zone = this.add.zone(x, y, w, h).setInteractive({ useHandCursor: unlocked });
    zone.on('pointerup', () => this.start(id));
  }
}
