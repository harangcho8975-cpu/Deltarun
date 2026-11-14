import Phaser from 'phaser';
import { Sound } from '../audio/Sound';
import { characterById } from '../data/characters';
import { stageOrder, stages } from '../data/stages';
import { saveStore } from '../save/store';
import { fullscreen } from '../ui/fullscreen';
import { button, COLORS, text } from '../ui/style';

const W = 1280;
const H = 720;
const CARD_W = 240;
const CARD_H = 480;
const CARD_GAP = 36;
const CARD_Y = 370;
const EDGE = 60;
/** 스테이지별 미리보기 색 (그림이 생기면 교체) */
const PREVIEW_COLORS = [0x9fd8ef, 0xf4a261, 0x2b3a67, 0x6aa77a, 0xc77dff];

/**
 * 로비: 선택한 캐릭터가 가운데에 크게 서 있고, 오른쪽 아래 [플레이]를 누르면
 * 세로로 긴 스테이지 카드가 가로로 늘어선다.
 */
export class LobbyScene extends Phaser.Scene {
  private hero!: Phaser.GameObjects.Image;
  private heroName!: Phaser.GameObjects.Text;
  private heroTagline!: Phaser.GameObjects.Text;
  private heroShadow!: Phaser.GameObjects.Ellipse;
  private heroHint!: Phaser.GameObjects.Text;
  private homeUI!: Phaser.GameObjects.Container;
  private stageUI!: Phaser.GameObjects.Container;
  private strip!: Phaser.GameObjects.Container;
  private stageOpen = false;
  private scrollMin = EDGE;
  private dragStartX = 0;
  private dragStripX = 0;
  private dragging = false;
  private dragMoved = 0;

  constructor() {
    super('Lobby');
  }

  create(): void {
    Sound.stopBgm();
    this.stageOpen = false;

    this.add.tileSprite(0, 0, W, H, 'bg_far').setOrigin(0);
    this.add.tileSprite(0, 0, W, H, 'bg_mid').setOrigin(0);
    this.add.tileSprite(0, 600, W, H - 600, 'ground_tile').setOrigin(0);

    this.buildHero();
    this.homeUI = this.buildHomeUI();
    this.stageUI = this.buildStageUI().setVisible(false);

    this.setupKeys();
    this.setupDrag();
  }

  // ───────── 캐릭터 (가운데) ─────────

  private buildHero(): void {
    const id = saveStore.data.selectedCharacter;
    this.hero = this.add.image(W / 2, 596, `char_${id}`).setOrigin(0.5, 1).setDepth(2);
    this.hero.setDisplaySize(330, 440);
    // 서 있는 동안 살짝 숨 쉬듯 위아래로 움직인다
    this.tweens.add({ targets: this.hero, scaleY: this.hero.scaleY * 1.025, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.heroShadow = this.add.ellipse(W / 2, 598, 260, 30, 0x000000, 0.22).setDepth(1);

    this.heroName = text(this, W / 2, 70, '', 48, '#ffffff', true).setOrigin(0.5).setStroke('#1a1a2e', 8).setDepth(3);
    this.heroTagline = text(this, W / 2, 122, '', 22, '#ffffff').setOrigin(0.5).setStroke('#1a1a2e', 5).setDepth(3);
    this.heroHint = text(this, W / 2, 158, '캐릭터를 누르면 목록이 열려요', 17, '#ffffff').setOrigin(0.5).setStroke('#1a1a2e', 4).setDepth(3).setAlpha(0.85);

    // 가운데 캐릭터를 누르면 캐릭터 목록(격자)
    this.hero.setInteractive({ useHandCursor: true });
    this.hero.on('pointerup', () => this.openCharacters());
    this.refreshHero(false);
  }

  private refreshHero(pop: boolean): void {
    const c = characterById(saveStore.data.selectedCharacter);
    this.hero.setTexture(`char_${c.id}`).setDisplaySize(330, 440);
    this.heroName.setText(c.name);
    this.heroTagline.setText(c.tagline);
    if (pop) {
      const sx = this.hero.scaleX;
      const sy = this.hero.scaleY;
      this.hero.setScale(sx * 0.92, sy * 0.92);
      this.tweens.add({ targets: this.hero, scaleX: sx, scaleY: sy, duration: 220, ease: 'Back.easeOut' });
    }
  }

  /** 스테이지 카드가 열려 있는 동안은 캐릭터를 숨긴다 */
  private showHero(on: boolean): void {
    for (const o of [this.hero, this.heroShadow, this.heroName, this.heroTagline, this.heroHint]) o.setVisible(on);
  }

  private openCharacters(): void {
    if (this.stageOpen) return;
    this.scene.start('Characters');
  }

  // ───────── 홈 화면 UI ─────────

  private buildHomeUI(): Phaser.GameObjects.Container {
    const items: Phaser.GameObjects.GameObject[] = [];

    items.push(text(this, 40, 34, `코인 ${saveStore.data.coins}`, 26, '#ffd23f', true).setStroke('#1a1a2e', 5));

    // 설정: 오른쪽 위
    const s = saveStore.data.settings;
    const label = (k: 'bgm' | 'sfx') => `${k === 'bgm' ? '배경음' : '효과음'} ${s[k] ? '켜짐' : '꺼짐'}`;
    const toggle = (x: number, k: 'bgm' | 'sfx') => {
      const b = button(this, x, 46, 140, 48, label(k), () => {
        saveStore.setSetting(k, !s[k]);
        (b.list[1] as Phaser.GameObjects.Text).setText(label(k));
      }, 0xdfe6f5, 17);
      items.push(b);
    };
    toggle(1000, 'bgm');
    toggle(1150, 'sfx');
    if (fullscreen.supported() && !fullscreen.standalone()) {
      items.push(button(this, 1150, 104, 140, 48, '전체화면 (F)', () => void fullscreen.toggle(), 0xdfe6f5, 17));
    }


    // 오른쪽 아래 [플레이]
    items.push(button(this, 1090, 640, 320, 100, '플레이  ▶', () => this.openStages(), COLORS.accent, 42));

    if (!fullscreen.supported() && !fullscreen.standalone()) {
      // iPhone Safari: 전체화면 API가 없다
      items.push(text(this, 40, 700, '전체화면: 공유 → "홈 화면에 추가"로 열어 주세요', 17, '#ffffff').setOrigin(0, 1).setStroke('#1a1a2e', 4));
    }
    return this.add.container(0, 0, items).setDepth(10);
  }

  // ───────── 스테이지 카드 (세로로 긴 카드가 가로로 배열) ─────────

  private buildStageUI(): Phaser.GameObjects.Container {
    const dim = this.add.rectangle(0, 0, W, H, COLORS.panel, 0.62).setOrigin(0);
    const title = text(this, W / 2, 56, '스테이지 선택', 42, '#ffffff', true).setOrigin(0.5).setStroke('#1a1a2e', 7);
    const back = button(this, 120, 56, 180, 64, '← 뒤로', () => this.closeStages(), 0xdfe6f5, 24);

    this.strip = this.add.container(0, 0);
    const n = stageOrder.length;
    const total = n * CARD_W + (n - 1) * CARD_GAP;
    const overflow = total > W - EDGE * 2;
    const startX = overflow ? EDGE : (W - total) / 2;
    this.scrollMin = overflow ? W - EDGE - total : startX;
    stageOrder.forEach((id, i) => {
      const x = startX + i * (CARD_W + CARD_GAP) + CARD_W / 2;
      this.strip.add(this.card(x, CARD_Y, id, i));
    });
    this.strip.setData('home', 0);
    return this.add.container(0, 0, [dim, title, back, this.strip]).setDepth(20);
  }

  private card(x: number, y: number, id: string, i: number): Phaser.GameObjects.Container {
    const unlocked = saveStore.isUnlocked(stageOrder, id);
    const rec = saveStore.record(id);
    const g = this.add.graphics();
    g.fillStyle(unlocked ? 0xffffff : COLORS.locked, unlocked ? 0.95 : 0.85).fillRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 20);
    g.lineStyle(4, unlocked ? COLORS.accent : 0x3d4157, 1).strokeRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 20);

    const preview = this.add.graphics();
    preview.fillStyle(PREVIEW_COLORS[i % PREVIEW_COLORS.length], unlocked ? 1 : 0.45).fillRoundedRect(-CARD_W / 2 + 14, -CARD_H / 2 + 52, CARD_W - 28, 180, 12);

    const items: Phaser.GameObjects.GameObject[] = [
      g,
      preview,
      text(this, 0, -CARD_H / 2 + 28, `STAGE ${i + 1}`, 22, unlocked ? '#f5a623' : '#aab0c4', true).setOrigin(0.5),
      text(this, 0, -CARD_H / 2 + 142, `${i + 1}`, 96, '#ffffff', true).setOrigin(0.5).setAlpha(unlocked ? 0.9 : 0.5),
      text(this, 0, 36, stages[id].name, 28, unlocked ? '#1a1a2e' : '#d3d7e6', true).setOrigin(0.5),
    ];
    if (unlocked) {
      items.push(
        text(this, 0, 92, '★'.repeat(rec.bestStars) + '☆'.repeat(3 - rec.bestStars), 40, '#f5a623').setOrigin(0.5),
        text(this, 0, 146, rec.bestScore ? `최고 ${rec.bestScore.toLocaleString()}점` : '아직 기록 없음', 20, '#4a5068').setOrigin(0.5),
        text(this, 0, 198, '눌러서 시작', 18, '#8a90a8').setOrigin(0.5),
      );
    } else {
      items.push(
        text(this, 0, 110, '잠김', 34, '#e8eaf2', true).setOrigin(0.5),
        text(this, 0, 168, `STAGE ${i}을 클리어하면\n열려요`, 18, '#e8eaf2').setOrigin(0.5).setAlign('center'),
      );
    }

    const zone = this.add.zone(0, 0, CARD_W, CARD_H).setInteractive({ useHandCursor: unlocked });
    zone.on('pointerup', () => {
      if (this.dragMoved < 12) this.startStage(id);
    });
    items.push(zone);
    return this.add.container(x, y, items);
  }

  private openStages(): void {
    if (this.stageOpen) return;
    this.stageOpen = true;
    this.homeUI.setVisible(false);
    this.showHero(false);
    this.stageUI.setVisible(true).setAlpha(0);
    this.strip.x = this.strip.getData('home') as number;
    const unlockedIdx = stageOrder.reduce((last, id, i) => (saveStore.isUnlocked(stageOrder, id) ? i : last), 0);
    // 카드가 많아 스크롤되는 경우, 지금 열린 마지막 스테이지가 보이게 맞춘다
    if (this.scrollMin < EDGE) {
      const target = EDGE - unlockedIdx * (CARD_W + CARD_GAP) + (W - EDGE * 2 - CARD_W) / 2;
      this.strip.x = Phaser.Math.Clamp(target, this.scrollMin - EDGE, 0);
    }
    const finalX = this.strip.x;
    this.strip.x = finalX + 220;
    this.tweens.add({ targets: this.stageUI, alpha: 1, duration: 200 });
    this.tweens.add({ targets: this.strip, x: finalX, duration: 320, ease: 'Cubic.easeOut' });
  }

  private closeStages(): void {
    if (!this.stageOpen) return;
    this.stageOpen = false;
    this.stageUI.setVisible(false);
    this.homeUI.setVisible(true);
    this.showHero(true);
  }

  private startStage(id: string): void {
    if (!this.stageOpen || !saveStore.isUnlocked(stageOrder, id)) return;
    this.scene.start('Game', { stageId: id });
  }

  // ───────── 입력 ─────────

  private setupKeys(): void {
    this.input.keyboard?.on('keydown', (ev: KeyboardEvent) => {
      if (ev.code === 'KeyF') void fullscreen.toggle();
      if (!this.stageOpen) {
        if (ev.code === 'Enter' || ev.code === 'Space') this.openStages();
        if (ev.code === 'KeyC') this.openCharacters();
        return;
      }
      if (ev.code === 'Escape' || ev.code === 'Backspace') this.closeStages();
      const n = Number(ev.key);
      if (n >= 1 && n <= stageOrder.length) this.startStage(stageOrder[n - 1]);
      if (ev.code === 'Enter') {
        const open = stageOrder.filter((id) => saveStore.isUnlocked(stageOrder, id));
        this.startStage(open[open.length - 1]);
      }
    });
  }

  /** 카드가 화면보다 많아지면 좌우로 끌어서 넘긴다 */
  private setupDrag(): void {
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.dragging = this.stageOpen && this.scrollMin < EDGE;
      this.dragStartX = p.x;
      this.dragStripX = this.strip.x;
      this.dragMoved = 0;
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!p.isDown || !this.dragging) return;
      this.dragMoved = Math.max(this.dragMoved, Math.abs(p.x - this.dragStartX));
      this.strip.x = Phaser.Math.Clamp(this.dragStripX + (p.x - this.dragStartX), this.scrollMin - EDGE, 0);
    });
    this.input.on('pointerup', () => {
      this.dragging = false;
      this.time.delayedCall(0, () => (this.dragMoved = 0));
    });
  }
}
