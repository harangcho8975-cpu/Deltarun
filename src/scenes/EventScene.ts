import Phaser from 'phaser';
import { ECONOMY } from '../config/economy';
import { saveStore } from '../save/store';
import { button, COLORS, text } from '../ui/style';

const W = 1280;
const H = 720;

/** 오늘 날짜(기기 시각 기준) YYYY-MM-DD. 메뉴 쪽이라 Date를 써도 된다. */
export function todayKey(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** 이벤트 탭: 출석 보상, 카오스 킹 픽업 뽑기. */
export class EventScene extends Phaser.Scene {
  constructor() {
    super('Event');
  }

  create(): void {
    this.add.tileSprite(0, 0, W, H, 'bg_far').setOrigin(0);
    this.add.rectangle(0, 0, W, H, COLORS.panel, 0.82).setOrigin(0);
    button(this, 120, 52, 180, 64, '← 로비', () => this.scene.start('Lobby'), 0xdfe6f5, 24);
    text(this, 640, 52, '이벤트', 40, '#ffffff', true).setOrigin(0.5);
    const coinText = text(this, 1230, 36, `코인 ${saveStore.data.coins.toLocaleString()}`, 24, '#ffd23f', true).setOrigin(1, 0.5);

    // 출석 보상
    const today = todayKey();
    this.panel(40, 130, 560, 380, 0x4a90e2);
    text(this, 70, 156, '출석 보상', 34, '#1a1a2e', true);
    text(this, 70, 210, '하루에 한 번 접속해서 받아요', 20, '#4a5068');
    text(this, 70, 270, `+${ECONOMY.attendanceCoins} 코인`, 56, '#d98a00', true);
    const claim = button(this, 320, 450, 360, 80, '', () => {}, COLORS.accent, 30);
    const label = claim.list[1] as Phaser.GameObjects.Text;
    const sync = () => {
      const can = saveStore.canClaimAttendance(today);
      label.setText(can ? '받기' : '오늘은 받았어요');
      claim.setEnabled(can);
    };
    claim.on('pointerup', () => {
      if (saveStore.claimAttendance(today) > 0) {
        coinText.setText(`코인 ${saveStore.data.coins.toLocaleString()}`);
        sync();
      }
    });
    sync();

    // 카오스 킹 픽업 뽑기
    this.panel(680, 130, 560, 380, 0xf5a623);
    text(this, 710, 156, '카오스 킹 픽업 뽑기', 34, '#1a1a2e', true);
    text(this, 710, 210, '레전드 확률이 올라가요', 20, '#4a5068');
    const r = ECONOMY.charPickupRates;
    text(this, 710, 262, `레전드 ${Math.round(r.legendary * 100)}%  (기본 ${Math.round(ECONOMY.charRates.legendary * 100)}%)`, 40, '#d98a00', true);
    text(this, 710, 330, `1회 ${ECONOMY.charPullCost} · 10회 ${ECONOMY.charPull10Cost} 코인\n10회 뽑기는 레어 이상 1개 보장`, 20, '#33384d').setLineSpacing(6);
    button(this, 960, 450, 360, 80, '뽑으러 가기', () => this.scene.start('Gacha', { mode: 'character', banner: 'pickup' }), COLORS.accent, 30);

    this.input.keyboard?.on('keydown', (ev: KeyboardEvent) => {
      if (ev.code === 'Escape' || ev.code === 'Backspace') this.scene.start('Lobby');
    });
  }

  private panel(x: number, y: number, w: number, h: number, color: number): void {
    const g = this.add.graphics();
    g.fillStyle(0xffffff, 0.97).fillRoundedRect(x, y, w, h, 20);
    g.fillStyle(color, 1).fillRoundedRect(x, y, w, 10, { tl: 20, tr: 20, bl: 0, br: 0 });
  }
}
