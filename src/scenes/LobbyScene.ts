import Phaser from 'phaser';
import { Sound } from '../audio/Sound';
import { characterById, RARITY } from '../data/characters';
import { stageOrder, stages } from '../data/stages';
import { cloud } from '../online';
import { saveStore } from '../save/store';
import { todayKey } from './EventScene';
import { fullscreen } from '../ui/fullscreen';
import { button, coinPill, COLORS, hex, iconButton, panel, shade, text, topBar } from '../ui/style';

const W = 1280;
const H = 720;
const CARD_W = 250;
const CARD_H = 470;
const CARD_GAP = 36;
const CARD_Y = 390;
const EDGE = 60;
/** 스테이지별 카드 색 (그림이 생기면 교체) */
const STAGE_COLORS = [0x5bbcf0, 0xf08a3c, 0x5a4fcf, 0x4fb36b, 0xc77dff];

/**
 * 로비 (쿠키런 오븐브레이크 느낌): 가운데 선택한 캐릭터, 위쪽 프로필·코인, 왼쪽 이벤트·계정,
 * 아래쪽 캐릭터·장비·뽑기 탭과 큰 [플레이]. 플레이 → 스테이지 카드 → 준비 화면(캐릭터·장비 선택) → 게임.
 */
export class LobbyScene extends Phaser.Scene {
  private hero!: Phaser.GameObjects.Image;
  private heroParts: Phaser.GameObjects.GameObject[] = [];
  private homeUI!: Phaser.GameObjects.Container;
  private stageUI!: Phaser.GameObjects.Container;
  private settingsUI!: Phaser.GameObjects.Container;
  private strip!: Phaser.GameObjects.Container;
  private stageOpen = false;
  private openOnStart = false;
  private scrollMin = EDGE;
  private dragStartX = 0;
  private dragStripX = 0;
  private dragging = false;
  private dragMoved = 0;

  constructor() {
    super('Lobby');
  }

  init(data?: { openStages?: boolean }): void {
    this.openOnStart = !!data?.openStages;
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
    this.settingsUI = this.buildSettings().setVisible(false);

    this.setupKeys();
    this.setupDrag();
    if (this.openOnStart) this.openStages(false);
  }

  // ───────── 캐릭터 (가운데) ─────────

  private buildHero(): void {
    const c = characterById(saveStore.data.selectedCharacter);
    const r = RARITY[c.rarity];
    const glow = this.add.graphics().setDepth(1);
    for (let i = 5; i >= 1; i--) glow.fillStyle(0xffffff, 0.05 * (6 - i)).fillCircle(W / 2, 470, 70 + i * 26);
    const shadow = this.add.ellipse(W / 2, 598, 150, 20, 0x000000, 0.25).setDepth(1);
    this.hero = this.add.image(W / 2, 596, `char_${c.id}`).setOrigin(0.5, 1).setDepth(2);
    this.hero.setDisplaySize(180, 240);
    this.tweens.add({ targets: this.hero, scaleY: this.hero.scaleY * 1.025, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    // 이름 리본
    const name = text(this, W / 2, 278, c.name, 32, '#ffffff', true).setOrigin(0.5).setStroke('#000000', 6).setDepth(3);
    const rib = this.add.graphics().setDepth(2);
    const rw = name.width + 80;
    rib.fillStyle(shade(r.color, 0.6), 1).fillRoundedRect(W / 2 - rw / 2, 260, rw, 46, 16);
    rib.fillStyle(r.color, 1).fillRoundedRect(W / 2 - rw / 2, 254, rw, 46, 16);
    rib.lineStyle(3, 0xffffff, 0.9).strokeRoundedRect(W / 2 - rw / 2, 254, rw, 46, 16);
    const hint = text(this, W / 2, 324, '눌러서 캐릭터 보기', 16, '#ffffff').setOrigin(0.5).setStroke('#1a1a2e', 4).setDepth(3).setAlpha(0.85);
    this.heroParts = [glow, shadow, this.hero, rib, name, hint];

    this.hero.setInteractive({ useHandCursor: true });
    this.hero.on('pointerup', () => this.openCharacters());
  }

  private showHero(on: boolean): void {
    for (const o of this.heroParts) (o as unknown as Phaser.GameObjects.Components.Visible).setVisible(on);
  }

  private openCharacters(): void {
    if (this.stageOpen) return;
    this.scene.start('Characters', { mode: 'view' });
  }

  // ───────── 홈 화면 UI ─────────

  private buildHomeUI(): Phaser.GameObjects.Container {
    const items: Phaser.GameObjects.GameObject[] = [];

    // 위쪽: 프로필 · 설정 · 코인
    const pg = this.add.graphics();
    pg.fillStyle(0x000000, 0.45).fillRoundedRect(18, 14, 360, 66, 33);
    pg.lineStyle(2, 0xffffff, 0.35).strokeRoundedRect(18, 14, 360, 66, 33);
    pg.fillStyle(COLORS.yellow, 1).fillCircle(51, 47, 27);
    pg.lineStyle(3, 0xffffff, 1).strokeCircle(51, 47, 27);
    items.push(pg);
    const cleared = stageOrder.filter((id) => saveStore.record(id).cleared).length;
    const who = cloud?.user && !cloud.user.anonymous ? (cloud.user.label ?? '플레이어') : '게스트';
    items.push(
      text(this, 51, 47, `${cleared}`, 24, '#ffffff', true).setOrigin(0.5).setStroke('#8a5a00', 4),
      text(this, 92, 28, who.length > 22 ? who.slice(0, 21) + '…' : who, 20, '#ffffff', true),
      text(this, 92, 54, `클리어 ${cleared} / ${stageOrder.length} 스테이지`, 15, '#ffd23f'),
    );
    items.push(coinPill(this, 1256, 46, saveStore.data.coins).container);
    items.push(iconButton(this, 1000, 40, 'settings', '', 0x6b7190, () => this.settingsUI.setVisible(true), false, 56));

    // 왼쪽 세로 메뉴
    items.push(iconButton(this, 66, 180, 'event', '이벤트', COLORS.pink, () => this.scene.start('Event'), saveStore.canClaimAttendance(todayKey())));
    items.push(iconButton(this, 66, 310, 'account', '계정', COLORS.blue, () => this.scene.start('Account')));

    // 아래쪽 탭 바
    const bar = this.add.graphics();
    bar.fillStyle(COLORS.bar, 0.85).fillRoundedRect(-30, 590, 480, 160, 30);
    bar.lineStyle(3, 0xffffff, 0.25).strokeRoundedRect(-30, 590, 480, 160, 30);
    items.push(bar);
    items.push(iconButton(this, 80, 636, 'character', '캐릭터', COLORS.yellow, () => this.openCharacters()));
    items.push(iconButton(this, 210, 636, 'equip', '장비', COLORS.green, () => this.scene.start('Equipment', { mode: 'view' })));
    items.push(iconButton(this, 340, 636, 'gacha', '뽑기', COLORS.purple, () => this.scene.start('Gacha')));

    // 오른쪽 아래 [플레이]
    items.push(button(this, 1070, 632, 360, 120, '플레이 ▶', () => this.openStages(), COLORS.yellow, 46));

    if (!fullscreen.supported() && !fullscreen.standalone()) {
      // iPhone Safari: 전체화면 API가 없다
      items.push(text(this, 700, 704, '전체화면: 공유 → "홈 화면에 추가"로 열어 주세요', 16, '#ffffff').setOrigin(0.5, 1).setStroke('#1a1a2e', 4));
    }
    return this.add.container(0, 0, items).setDepth(10);
  }

  private buildSettings(): Phaser.GameObjects.Container {
    const dim = this.add.rectangle(0, 0, W, H, 0x000000, 0.55).setOrigin(0).setInteractive();
    const p = panel(this, 400, 170, 480, 400, '설정');
    const s = saveStore.data.settings;
    const label = (k: 'bgm' | 'sfx') => `${k === 'bgm' ? '배경음' : '효과음'}  ${s[k] ? '켜짐' : '꺼짐'}`;
    const items: Phaser.GameObjects.GameObject[] = [dim, p];
    const toggle = (y: number, k: 'bgm' | 'sfx') => {
      const b = button(this, 640, y, 320, 70, label(k), () => {
        saveStore.setSetting(k, !s[k]);
        (b.list[1] as Phaser.GameObjects.Text).setText(label(k));
      }, COLORS.green, 26);
      items.push(b);
    };
    toggle(250, 'bgm');
    toggle(340, 'sfx');
    if (fullscreen.supported() && !fullscreen.standalone()) {
      items.push(button(this, 640, 430, 320, 70, '전체화면 (F)', () => void fullscreen.toggle(), COLORS.blue, 26));
    }
    items.push(button(this, 640, 520, 200, 64, '닫기', () => this.settingsUI.setVisible(false), COLORS.yellow, 26));
    return this.add.container(0, 0, items).setDepth(50);
  }

  // ───────── 스테이지 카드 (세로로 긴 카드가 가로로 배열) ─────────

  private buildStageUI(): Phaser.GameObjects.Container {
    const dim = this.add.rectangle(0, 0, W, H, COLORS.panel, 0.55).setOrigin(0);
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
    // 위쪽 바: 만들어진 객체들을 모아 스테이지 화면과 함께 보이고 숨긴다
    const head = topBar(this, '스테이지 선택', () => this.closeStages(), saveStore.data.coins).objects;
    return this.add.container(0, 0, [dim, this.strip, ...head]).setDepth(20);
  }

  private card(x: number, y: number, id: string, i: number): Phaser.GameObjects.Container {
    const unlocked = saveStore.isUnlocked(stageOrder, id);
    const rec = saveStore.record(id);
    const color = STAGE_COLORS[i % STAGE_COLORS.length];
    const g = this.add.graphics();
    const L = -CARD_W / 2;
    const T = -CARD_H / 2;
    g.fillStyle(0x000000, 0.3).fillRoundedRect(L + 4, T + 10, CARD_W, CARD_H, 24);
    g.fillStyle(unlocked ? COLORS.cream : 0x6b6f80, 1).fillRoundedRect(L, T, CARD_W, CARD_H, 24);
    // 위쪽 그림 자리 (스테이지 색)
    g.fillStyle(unlocked ? color : 0x4a4e60, 1).fillRoundedRect(L + 12, T + 12, CARD_W - 24, 220, 16);
    g.fillStyle(0xffffff, 0.18).fillRoundedRect(L + 12, T + 12, CARD_W - 24, 90, { tl: 16, tr: 16, bl: 0, br: 0 });
    g.lineStyle(5, unlocked ? COLORS.brown : 0x3d4157, 1).strokeRoundedRect(L, T, CARD_W, CARD_H, 24);

    const items: Phaser.GameObjects.GameObject[] = [
      g,
      text(this, 0, T + 40, `STAGE ${i + 1}`, 22, '#ffffff', true).setOrigin(0.5).setStroke(hex(shade(color, 0.45)), 5),
      text(this, 0, T + 140, `${i + 1}`, 110, '#ffffff', true).setOrigin(0.5).setAlpha(unlocked ? 0.95 : 0.4).setStroke(hex(shade(color, 0.5)), 8),
      text(this, 0, T + 268, stages[id].name, 28, unlocked ? '#4a3520' : '#d3d7e6', true).setOrigin(0.5),
    ];
    if (unlocked) {
      items.push(
        text(this, 0, T + 318, '★'.repeat(rec.bestStars) + '☆'.repeat(3 - rec.bestStars), 40, '#f5a623').setOrigin(0.5).setStroke('#8a5a00', 3),
        text(this, 0, T + 366, rec.bestScore ? `최고 ${rec.bestScore.toLocaleString()}점` : '아직 기록 없음', 19, '#7a6048').setOrigin(0.5),
      );
      const chip = this.add.graphics();
      chip.fillStyle(shade(COLORS.green, 0.6), 1).fillRoundedRect(-80, T + 404, 160, 46, 18);
      chip.fillStyle(COLORS.green, 1).fillRoundedRect(-80, T + 398, 160, 46, 18);
      chip.lineStyle(3, 0xffffff, 0.9).strokeRoundedRect(-80, T + 398, 160, 46, 18);
      items.push(chip, text(this, 0, T + 421, '선택', 22, '#ffffff', true).setOrigin(0.5).setStroke('#1e6b33', 4));
    } else {
      items.push(
        text(this, 0, T + 330, '잠김', 32, '#e8eaf2', true).setOrigin(0.5),
        text(this, 0, T + 390, `STAGE ${i}을 클리어하면\n열려요`, 18, '#e8eaf2').setOrigin(0.5).setAlign('center'),
      );
    }

    const zone = this.add.zone(0, 0, CARD_W, CARD_H).setInteractive({ useHandCursor: unlocked });
    zone.on('pointerup', () => {
      if (this.dragMoved < 12) this.selectStage(id);
    });
    items.push(zone);
    return this.add.container(x, y, items);
  }

  private openStages(animate = true): void {
    if (this.stageOpen) return;
    this.stageOpen = true;
    this.homeUI.setVisible(false);
    this.showHero(false);
    this.stageUI.setVisible(true).setAlpha(animate ? 0 : 1);
    this.strip.x = this.strip.getData('home') as number;
    const unlockedIdx = stageOrder.reduce((last, id, i) => (saveStore.isUnlocked(stageOrder, id) ? i : last), 0);
    // 카드가 많아 스크롤되는 경우, 지금 열린 마지막 스테이지가 보이게 맞춘다
    if (this.scrollMin < EDGE) {
      const target = EDGE - unlockedIdx * (CARD_W + CARD_GAP) + (W - EDGE * 2 - CARD_W) / 2;
      this.strip.x = Phaser.Math.Clamp(target, this.scrollMin - EDGE, 0);
    }
    if (!animate) return;
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

  /** 스테이지를 고르면 준비 화면(캐릭터·장비 선택)으로 */
  private selectStage(id: string): void {
    if (!this.stageOpen || !saveStore.isUnlocked(stageOrder, id)) return;
    this.scene.start('Ready', { stageId: id });
  }

  // ───────── 입력 ─────────

  private setupKeys(): void {
    this.input.keyboard?.on('keydown', (ev: KeyboardEvent) => {
      if (ev.code === 'KeyF') void fullscreen.toggle();
      if (this.settingsUI.visible) {
        if (ev.code === 'Escape') this.settingsUI.setVisible(false);
        return;
      }
      if (!this.stageOpen) {
        if (ev.code === 'Enter' || ev.code === 'Space') this.openStages();
        if (ev.code === 'KeyC') this.openCharacters();
        if (ev.code === 'KeyE') this.scene.start('Equipment', { mode: 'view' });
        if (ev.code === 'KeyG') this.scene.start('Gacha');
        if (ev.code === 'KeyV') this.scene.start('Event');
        return;
      }
      if (ev.code === 'Escape' || ev.code === 'Backspace') this.closeStages();
      const n = Number(ev.key);
      if (n >= 1 && n <= stageOrder.length) this.selectStage(stageOrder[n - 1]);
      if (ev.code === 'Enter') {
        const open = stageOrder.filter((id) => saveStore.isUnlocked(stageOrder, id));
        this.selectStage(open[open.length - 1]);
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
