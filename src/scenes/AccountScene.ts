import Phaser from 'phaser';
import { cloud, cloudEnabled } from '../online';
import { saveStore } from '../save/store';
import { button, COLORS, text } from '../ui/style';

const W = 1280;
const H = 720;

const STATUS: Record<string, [string, string]> = {
  off: ['연결 안 됨', '#c9d1e6'],
  connecting: ['연결 중…', '#ffd23f'],
  syncing: ['동기화 중…', '#ffd23f'],
  synced: ['동기화됨', '#7cf29c'],
  error: ['연결 실패 (이 기기에만 저장 중)', '#ff8a8a'],
};

/** 계정·클라우드 저장 상태 화면 */
export class AccountScene extends Phaser.Scene {
  private off?: () => void;

  constructor() {
    super('Account');
  }

  create(): void {
    this.add.tileSprite(0, 0, W, H, 'bg_far').setOrigin(0);
    this.add.rectangle(0, 0, W, H, COLORS.panel, 0.82).setOrigin(0);
    button(this, 120, 52, 180, 64, '← 로비', () => this.scene.start('Lobby'), 0xdfe6f5, 24);
    text(this, 640, 52, '계정 · 클라우드 저장', 40, '#ffffff', true).setOrigin(0.5);

    const g = this.add.graphics();
    g.fillStyle(0xffffff, 0.97).fillRoundedRect(240, 130, 800, 400, 20);
    g.fillStyle(0x4a90e2, 1).fillRoundedRect(240, 130, 800, 10, { tl: 20, tr: 20, bl: 0, br: 0 });

    const state = text(this, 290, 170, '', 34, '#1a1a2e', true);
    const who = text(this, 290, 228, '', 22, '#4a5068');
    const last = text(this, 290, 266, '', 20, '#4a5068');
    const note = text(this, 290, 308, '', 17, '#33384d').setWordWrapWidth(710, true).setLineSpacing(2);
    const local = text(this, 290, 484, `이 기기 저장 시각: ${saveStore.data.updatedAt ? new Date(saveStore.data.updatedAt).toLocaleString() : '-'}`, 16, '#8a90a8');
    void local;

    const googleBtn = button(this, 400, 430, 220, 70, '구글로 로그인', () => void cloud?.signInGoogle(), 0xffffff, 24);
    const syncBtn = button(this, 640, 430, 220, 70, '지금 동기화', () => void cloud?.syncNow(), COLORS.accent, 24);
    const outBtn = button(this, 880, 430, 220, 70, '로그아웃', async () => {
      await cloud?.signOut();
    }, 0xdfe6f5, 24);

    const render = () => {
      if (!cloudEnabled || !cloud) {
        state.setText('사용 안 함').setColor('#4a5068');
        who.setText('');
        last.setText('');
        note.setText('이 주소에서는 클라우드 저장이 꺼져 있어요. 진행 상황은 이 기기에만 저장돼요.');
        googleBtn.setEnabled(false);
        syncBtn.setEnabled(false);
        outBtn.setEnabled(false);
        return;
      }
      const [label, color] = STATUS[cloud.status];
      state.setText(label).setColor(color === '#c9d1e6' ? '#4a5068' : color === '#ffd23f' ? '#d98a00' : color === '#7cf29c' ? '#1e9c52' : '#d03a3a');
      who.setText(cloud.user ? `계정: ${cloud.user.anonymous ? '게스트' : (cloud.user.label ?? '구글 계정')}` : '계정: 없음');
      last.setText(cloud.lastSyncedAt ? `마지막 동기화: ${new Date(cloud.lastSyncedAt).toLocaleString()}` : '');
      note.setText(
        cloud.status === 'error'
          ? `오류: ${cloud.lastError}\n(인터넷 연결, 또는 Firebase 콘솔의 로그인 방법·Firestore 설정을 확인해 주세요)`
          : cloud.user && !cloud.user.anonymous
            ? '구글 계정으로 저장 중이에요. 다른 기기에서도 같은 구글 계정으로 로그인하면 이어서 할 수 있어요.'
            : '게스트로 저장 중이에요. [구글로 로그인]을 누르면 지금까지의 진행이 구글 계정에 연결돼서 다른 기기에서도 이어서 할 수 있어요. 이미 저장이 있는 구글 계정이면 그 저장으로 바뀌어요.',
      );
      const busy = cloud.status === 'syncing' || cloud.status === 'connecting';
      googleBtn.setEnabled(!busy && !!cloud.user?.anonymous);
      syncBtn.setEnabled(!busy);
      outBtn.setEnabled(!!cloud.user);
    };
    render();
    this.off = cloud?.onChange(render);
    this.events.once('shutdown', () => this.off?.());

    this.input.keyboard?.on('keydown', (ev: KeyboardEvent) => {
      if (ev.code === 'Escape' || ev.code === 'Backspace') this.scene.start('Lobby');
    });
  }
}
