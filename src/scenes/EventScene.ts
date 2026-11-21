import Phaser from 'phaser';
import { ECONOMY } from '../config/economy';
import { saveStore } from '../save/store';
import { button, COLORS, panel, text, topBar } from '../ui/style';

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
    const { coinLabel } = topBar(this, '이벤트', () => this.scene.start('Lobby'), saveStore.data.coins);

    // 출석 보상
    const today = todayKey();
    panel(this, 40, 140, 560, 400, '출석 보상', COLORS.blue);
    text(this, 320, 210, '하루에 한 번 접속해서 받아요', 20, '#7a6048').setOrigin(0.5);
    text(this, 320, 300, `+${ECONOMY.attendanceCoins} 코인`, 60, '#f5a623', true).setOrigin(0.5).setStroke('#8a5a00', 5);
    const claim = button(this, 320, 450, 360, 84, '', () => {}, COLORS.green, 30);
    const label = claim.list[1] as Phaser.GameObjects.Text;
    const sync = () => {
      const can = saveStore.canClaimAttendance(today);
      label.setText(can ? '받기' : '오늘은 받았어요');
      claim.setEnabled(can);
    };
    claim.on('pointerup', () => {
      if (saveStore.claimAttendance(today) > 0) {
        coinLabel!.setText(saveStore.data.coins.toLocaleString());
        sync();
      }
    });
    sync();

    // 카오스 킹 픽업 뽑기
    panel(this, 680, 140, 560, 400, '픽업 뽑기', COLORS.pink);
    text(this, 960, 196, '카오스 킹 픽업!', 30, '#4a3520', true).setOrigin(0.5);
    const r = ECONOMY.charPickupRates;
    text(this, 960, 262, `레전드 ${Math.round(r.legendary * 100)}%  (기본 ${Math.round(ECONOMY.charRates.legendary * 100)}%)`, 38, '#f5a623', true).setOrigin(0.5).setStroke('#8a5a00', 4);
    text(this, 960, 340, `레전드가 나오면 언제나 카오스 킹\n1회 ${ECONOMY.charPullCost} · 10회 ${ECONOMY.charPull10Cost} 코인 · 10회는 레어 이상 1개 보장`, 18, '#7a6048').setOrigin(0.5).setAlign('center').setLineSpacing(6);
    button(this, 960, 450, 360, 84, '뽑으러 가기', () => this.scene.start('Gacha', { mode: 'character', banner: 'pickup' }), COLORS.pink, 30);

    this.input.keyboard?.on('keydown', (ev: KeyboardEvent) => {
      if (ev.code === 'Escape' || ev.code === 'Backspace') this.scene.start('Lobby');
    });
  }

}
