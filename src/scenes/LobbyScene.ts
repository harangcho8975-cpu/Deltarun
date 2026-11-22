import Phaser from 'phaser';
import { Sound } from '../audio/Sound';
import { characterById, RARITY } from '../data/characters';
import { episodes, stageLabel } from '../data/episodes';
import { stageOrder, stages } from '../data/stages';
import { cloud } from '../online';
import { saveStore } from '../save/store';
import { todayKey } from './EventScene';
import { fullscreen } from '../ui/fullscreen';
import { button, coinPill, COLORS, hex, iconButton, panel, shade, text, topBar } from '../ui/style';

const W = 1280;
const H = 720;
/** 월드맵에서 스테이지 점의 자리: 아래 줄 왼쪽→오른쪽, 위 줄 오른쪽→왼쪽으로 굽이치는 길 */
const NODE_POS: [number, number][] = [
  [130, 610], [330, 548], [530, 610], [730, 548], [930, 610],
  [1140, 470], [960, 330], [750, 268], [540, 330], [290, 250],
];

/**
 * 로비 (쿠키런 오븐브레이크 느낌): 가운데 선택한 캐릭터, 위쪽 프로필·코인, 왼쪽 이벤트·계정,
 * 아래쪽 캐릭터·장비·뽑기 탭과 큰 [플레이]. 플레이 → 월드맵(에피소드의 스테이지들) → 준비 화면(캐릭터·장비 선택) → 게임.
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

  // ───────── 스테이지 선택: 쿠키런 킹덤처럼 길을 따라 늘어선 스테이지 ─────────

  private buildStageUI(): Phaser.GameObjects.Container {
    const ep = episodes[0];
    const sky = this.add.graphics();
    sky.fillStyle(0x7ccf8a, 1).fillRect(0, 0, W, H);
    // 들판 무늬
    for (let i = 0; i < 26; i++) sky.fillStyle(0x6bbf7a, 1).fillEllipse((i * 197) % W, 140 + ((i * 131) % 560), 160, 60);
    for (let i = 0; i < 14; i++) {
      const x = (i * 263 + 80) % W;
      const y = 150 + ((i * 89) % 520);
      sky.fillStyle(0x3f8f55, 1).fillCircle(x, y, 22).fillCircle(x + 18, y + 6, 18).fillCircle(x - 16, y + 8, 16); // 덤불
    }
    this.strip = this.add.container(0, 0);
    const pts = NODE_POS.slice(0, ep.stageIds.length).map(([x, y]) => new Phaser.Math.Vector2(x, y));
    const road = this.add.graphics();
    if (pts.length > 1) {
      const curve = new Phaser.Curves.Spline(pts);
      const line = curve.getPoints(pts.length * 24);
      road.lineStyle(44, COLORS.brown, 1).strokePoints(line, false);
      road.lineStyle(32, 0xf3dfb0, 1).strokePoints(line, false);
      // 지나온 길(열린 곳까지)은 진하게
      const open = ep.stageIds.filter((id) => saveStore.isUnlocked(stageOrder, id)).length;
      if (open > 1) {
        const upto = curve.getPoints((open - 1) * 24).slice(0, (open - 1) * 24 + 1);
        road.lineStyle(14, COLORS.yellow, 0.9).strokePoints(upto, false);
      }
    }
    this.strip.add(road);
    ep.stageIds.forEach((id, i) => this.strip.add(this.node(pts[i].x, pts[i].y, id, i === ep.stageIds.length - 1)));
    const head = topBar(this, `에피소드 ${ep.no} · ${ep.name}`, () => this.closeStages(), saveStore.data.coins).objects;
    return this.add.container(0, 0, [sky, this.strip, ...head]).setDepth(20);
  }

  /** 길 위의 스테이지 점: 지나온 곳은 별, 지금 도전할 곳은 통통 튄다, 잠긴 곳은 회색 */
  private node(x: number, y: number, id: string, boss: boolean): Phaser.GameObjects.Container {
    const unlocked = saveStore.isUnlocked(stageOrder, id);
    const rec = saveStore.record(id);
    const current = unlocked && !rec.cleared;
    const r = boss ? 54 : 42;
    const color = !unlocked ? 0x8a8fa3 : rec.cleared ? COLORS.green : COLORS.yellow;
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.25).fillEllipse(0, r - 2, r * 2.1, r * 0.7);
    g.fillStyle(shade(color, 0.6), 1).fillCircle(0, 6, r);
    g.fillStyle(color, 1).fillCircle(0, 0, r);
    g.fillStyle(0xffffff, 0.25).fillEllipse(0, -r * 0.42, r * 1.3, r * 0.6);
    g.lineStyle(5, 0xffffff, 1).strokeCircle(0, 0, r);
    const items: Phaser.GameObjects.GameObject[] = [
      g,
      text(this, 0, -2, stageLabel(id), boss ? 30 : 26, '#ffffff', true).setOrigin(0.5).setStroke(hex(shade(color, 0.45)), 6),
    ];
    if (unlocked) {
      items.push(text(this, 0, r + 22, '★'.repeat(rec.bestStars) + '☆'.repeat(3 - rec.bestStars), 24, '#ffd23f').setOrigin(0.5).setStroke('#6b4423', 4));
    } else {
      // 자물쇠
      const lock = this.add.graphics();
      lock.lineStyle(5, 0xffffff, 1).strokeCircle(r * 0.62, -r * 0.62, 9);
      lock.fillStyle(0xffffff, 1).fillRoundedRect(r * 0.62 - 12, -r * 0.62, 24, 18, 4);
      items.push(lock);
    }
    // 이름표
    const name = text(this, 0, unlocked ? r + 50 : r + 22, stages[id].name, 16, '#ffffff', true).setOrigin(0.5).setStroke('#1a1a2e', 4);
    items.push(name);
    if (boss) items.push(text(this, 0, -r - 18, 'BOSS', 18, '#ffd23f', true).setOrigin(0.5).setStroke('#6b4423', 5));
    const c = this.add.container(x, y, items);
    c.setData('id', id);
    const zone = this.add.zone(0, 0, r * 2.4, r * 2.4).setInteractive({ useHandCursor: unlocked });
    zone.on('pointerup', () => this.selectStage(id));
    c.add(zone);
    if (current) this.tweens.add({ targets: c, y: y - 10, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    return c;
  }

  private openStages(animate = true): void {
    if (this.stageOpen) return;
    this.stageOpen = true;
    this.homeUI.setVisible(false);
    this.showHero(false);
    this.stageUI.setVisible(true).setAlpha(animate ? 0 : 1);
    if (animate) this.tweens.add({ targets: this.stageUI, alpha: 1, duration: 220 });
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
}
