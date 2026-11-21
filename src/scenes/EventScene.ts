import Phaser from 'phaser';
import { ECONOMY } from '../config/economy';
import { characterById, RARITY } from '../data/characters';
import { saveStore } from '../save/store';
import { button, COLORS, hex, rarityPill, shade, text, topBar } from '../ui/style';
import { fitImage } from './CharacterListScene';

const W = 1280;
const H = 720;
const TAB_X = 30;
const TAB_W = 360;
const TAB_H = 96;
const TAB_GAP = 14;
const TAB_TOP = 120;
const BODY = { x: 420, y: 120, w: 830, h: 570 };

/** 오늘 날짜(기기 시각 기준) YYYY-MM-DD. 메뉴 쪽이라 Date를 써도 된다. */
export function todayKey(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

interface EventDef {
  id: string;
  title: string;
  sub: string;
  color: number;
  /** 빨간 점: 지금 받을 것이 있다 */
  badge?: () => boolean;
}

/** 이벤트 목록 (위에서부터). 새 이벤트는 여기에 한 줄 추가하고 아래 render에 내용을 그린다. */
export const EVENTS: EventDef[] = [
  { id: 'attendance', title: '출석 보상', sub: `매일 +${ECONOMY.attendanceCoins} 코인`, color: COLORS.blue, badge: () => saveStore.canClaimAttendance(todayKey()) },
  { id: 'pickup', title: '카오스 킹 픽업', sub: '레전드 확률 UP!', color: COLORS.pink },
  { id: 'jevil', title: '신규 캐릭터 제빌', sub: '상자와 낫의 광대 등장', color: COLORS.purple },
];

/**
 * 이벤트 (쿠키런 킹덤·오븐브레이크 식): 왼쪽에 이벤트 제목이 세로로 늘어서고,
 * 하나를 누르면 오른쪽에 그 이벤트 화면이 뜬다.
 */
export class EventScene extends Phaser.Scene {
  private tab = EVENTS[0].id;
  private coinLabel?: Phaser.GameObjects.Text;

  constructor() {
    super('Event');
  }

  init(data?: { tab?: string }): void {
    this.tab = EVENTS.some((e) => e.id === data?.tab) ? data!.tab! : EVENTS[0].id;
  }

  create(): void {
    this.add.tileSprite(0, 0, W, H, 'bg_far').setOrigin(0);
    this.add.rectangle(0, 0, W, H, COLORS.panel, 0.82).setOrigin(0);
    this.coinLabel = topBar(this, '이벤트', () => this.scene.start('Lobby'), saveStore.data.coins).coinLabel;

    EVENTS.forEach((e, i) => this.tabButton(e, i));
    this.render(EVENTS.find((e) => e.id === this.tab)!);

    this.input.keyboard?.on('keydown', (ev: KeyboardEvent) => {
      if (ev.code === 'Escape' || ev.code === 'Backspace') this.scene.start('Lobby');
      const i = EVENTS.findIndex((e) => e.id === this.tab);
      if (ev.code === 'ArrowDown') this.select(EVENTS[(i + 1) % EVENTS.length].id);
      if (ev.code === 'ArrowUp') this.select(EVENTS[(i - 1 + EVENTS.length) % EVENTS.length].id);
    });
  }

  private select(id: string): void {
    if (id !== this.tab) this.scene.restart({ tab: id });
  }

  // ───────── 왼쪽 목록 ─────────

  private tabButton(e: EventDef, i: number): void {
    const on = e.id === this.tab;
    const x = TAB_X;
    const y = TAB_TOP + i * (TAB_H + TAB_GAP);
    const g = this.add.graphics();
    g.fillStyle(shade(e.color, 0.55), 1).fillRoundedRect(x, y + 6, TAB_W, TAB_H, 18);
    g.fillStyle(on ? e.color : shade(e.color, 0.75), 1).fillRoundedRect(x, y, TAB_W, TAB_H, 18);
    g.fillStyle(0xffffff, on ? 0.22 : 0.1).fillRoundedRect(x + 6, y + 5, TAB_W - 12, TAB_H * 0.42, { tl: 14, tr: 14, bl: 4, br: 4 });
    g.lineStyle(on ? 5 : 2, 0xffffff, on ? 1 : 0.4).strokeRoundedRect(x, y, TAB_W, TAB_H, 18);
    if (on) {
      // 오른쪽 화면을 가리키는 화살표
      g.fillStyle(0xffffff, 1).fillTriangle(x + TAB_W + 2, y + TAB_H / 2 - 14, x + TAB_W + 2, y + TAB_H / 2 + 14, x + TAB_W + 20, y + TAB_H / 2);
    }
    const dark = hex(shade(e.color, 0.4));
    text(this, x + 24, y + 30, e.title, 26, '#ffffff', true).setOrigin(0, 0.5).setStroke(dark, 5).setAlpha(on ? 1 : 0.85);
    text(this, x + 24, y + 66, e.sub, 17, '#ffffff').setOrigin(0, 0.5).setAlpha(on ? 0.95 : 0.7);
    if (e.badge?.()) this.add.circle(x + TAB_W - 14, y + 14, 11, 0xe74c3c).setStrokeStyle(3, 0xffffff);
    this.add.zone(x + TAB_W / 2, y + TAB_H / 2, TAB_W, TAB_H).setInteractive({ useHandCursor: true }).on('pointerup', () => this.select(e.id));
  }

  // ───────── 오른쪽 내용 ─────────

  private frame(e: EventDef, headline: string): void {
    const { x, y, w, h } = BODY;
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.25).fillRoundedRect(x + 4, y + 8, w, h, 24);
    g.fillStyle(COLORS.cream, 1).fillRoundedRect(x, y, w, h, 24);
    // 위쪽 배너
    g.fillStyle(e.color, 1).fillRoundedRect(x, y, w, 150, { tl: 24, tr: 24, bl: 0, br: 0 });
    g.fillStyle(0xffffff, 0.16).fillRoundedRect(x, y, w, 64, { tl: 24, tr: 24, bl: 0, br: 0 });
    // 배너 장식 원
    for (let i = 0; i < 5; i++) g.fillStyle(0xffffff, 0.1).fillCircle(x + w - 70 - i * 80, y + 58 + (i % 2) * 36, 26 + (i % 3) * 8);
    g.lineStyle(5, COLORS.brown, 1).strokeRoundedRect(x, y, w, h, 24);
    text(this, x + 40, y + 56, e.title, 40, '#ffffff', true).setOrigin(0, 0.5).setStroke(hex(shade(e.color, 0.4)), 7);
    text(this, x + 40, y + 108, headline, 20, '#ffffff', true).setOrigin(0, 0.5).setStroke(hex(shade(e.color, 0.4)), 4);
  }

  private render(e: EventDef): void {
    const cx = BODY.x + BODY.w / 2;
    const btnY = BODY.y + BODY.h - 70;
    switch (e.id) {
      case 'attendance': {
        this.frame(e, '하루에 한 번, 접속만 해도 코인을 드려요');
        const today = todayKey();
        // 큰 동전
        const g = this.add.graphics();
        g.fillStyle(0xd99a00, 1).fillCircle(cx - 170, 400, 70);
        g.fillStyle(0xffd23f, 1).fillCircle(cx - 170, 392, 70);
        g.lineStyle(8, 0xfff3b0, 1).strokeCircle(cx - 170, 392, 44);
        text(this, cx - 70, 392, `+${ECONOMY.attendanceCoins} 코인`, 64, '#f5a623', true).setOrigin(0, 0.5).setStroke('#8a5a00', 6);
        const can = saveStore.canClaimAttendance(today);
        text(this, cx, 500, can ? '오늘의 보상을 받을 수 있어요!' : '오늘 보상은 받았어요. 내일 또 와요!', 20, '#7a6048', true).setOrigin(0.5);
        const claim = button(this, cx, btnY, 380, 90, can ? '받기' : '오늘은 받았어요', () => {
          if (saveStore.claimAttendance(today) > 0) this.scene.restart({ tab: e.id });
        }, COLORS.green, 32);
        claim.setEnabled(can);
        break;
      }
      case 'pickup': {
        this.frame(e, '이 뽑기에서 레전드가 나오면 언제나 카오스 킹!');
        this.portrait('chaosking', BODY.x + 150, 560);
        const r = ECONOMY.charPickupRates;
        const tx = BODY.x + 300;
        text(this, tx, 320, `레전드 ${Math.round(r.legendary * 100)}%`, 56, '#f5a623', true).setOrigin(0, 0.5).setStroke('#8a5a00', 6);
        text(this, tx, 372, `기본 뽑기 ${Math.round(ECONOMY.charRates.legendary * 100)}%보다 높아요`, 20, '#7a6048', true).setOrigin(0, 0.5);
        text(this, tx, 440, `일반 ${Math.round(r.common * 100)}% · 레어 ${Math.round(r.rare * 100)}% · 에픽 ${Math.round(r.epic * 100)}%\n1회 ${ECONOMY.charPullCost} · 10회 ${ECONOMY.charPull10Cost} 코인 · 10회는 레어 이상 1개 보장`, 18, '#7a6048')
          .setOrigin(0, 0.5)
          .setLineSpacing(6);
        button(this, cx + 120, btnY, 380, 90, '뽑으러 가기', () => this.scene.start('Gacha', { mode: 'character', banner: 'pickup' }), COLORS.pink, 32);
        break;
      }
      case 'jevil': {
        this.frame(e, '공중에서 상자를 던지고, 하늘을 날며 낫을 휘두른다!');
        const c = characterById('jevil');
        this.portrait('jevil', BODY.x + 150, 560);
        const tx = BODY.x + 300;
        text(this, tx, 316, c.name, 44, '#4a3520', true).setOrigin(0, 0.5);
        rarityPill(this, tx + 150, 318, RARITY[c.rarity].label, RARITY[c.rarity].color, 17);
        text(this, tx, 364, c.tagline, 19, '#7a6048').setOrigin(0, 0.5);
        const lines = c.abilities.map((a) => `· ${a.kind === 'minor' ? '소능력' : '대능력'} ${a.name}`);
        text(this, tx, 428, lines.join('\n'), 21, '#4a3520', true).setOrigin(0, 0.5).setLineSpacing(8);
        const owned = saveStore.ownsCharacter(c.id);
        text(this, tx, 490, owned ? '이미 가지고 있어요!' : '캐릭터 뽑기에서 만날 수 있어요', 17, owned ? '#1e9c52' : '#7a6048', true).setOrigin(0, 0.5);
        button(this, cx - 5, btnY, 250, 90, '정보 보기', () => this.scene.start('CharacterInfo', { id: c.id, mode: 'view' }), COLORS.blue, 28);
        button(this, cx + 265, btnY, 250, 90, '캐릭터 뽑기', () => this.scene.start('Gacha', { mode: 'character' }), COLORS.purple, 28);
        break;
      }
    }
    // 코인이 바뀐 경우를 위해 위쪽 숫자도 맞춘다
    this.coinLabel?.setText(saveStore.data.coins.toLocaleString());
  }

  /** 캐릭터 그림 + 등급 색 원광 (발끝 기준) */
  private portrait(id: string, x: number, bottom: number): void {
    const c = characterById(id);
    const g = this.add.graphics();
    for (let i = 4; i >= 1; i--) g.fillStyle(RARITY[c.rarity].color, 0.08 * (5 - i)).fillCircle(x, bottom - 120, 50 + i * 22);
    this.add.ellipse(x, bottom + 2, 150, 18, 0x000000, 0.2);
    fitImage(this.add.image(x, bottom, `char_${id}`).setOrigin(0.5, 1), 190, 250);
  }
}
