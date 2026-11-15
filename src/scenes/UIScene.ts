import Phaser from 'phaser';
import { gameConfig as cfg, TICK_RATE } from '../config/gameConfig';
import { PAUSE_AREA, type InputController } from '../input/InputController';
import { totalScore, type SimState } from '../sim';
import { fullscreen } from '../ui/fullscreen';
import { button, COLORS, text } from '../ui/style';
import type { GameScene } from './GameScene';

const ITEM_LABEL: Record<string, string> = {
  item_heal: '체력 회복!',
  item_magnet: '자석!',
  item_giant: '거대화!',
  item_boost: '부스터!',
};

/** HUD. 게임 상태는 GameScene이 보내는 'hud' 이벤트로만 받는다. 모든 좌표는 1280×720 기준. */
export class UIScene extends Phaser.Scene {
  private hpFill!: Phaser.GameObjects.Graphics;
  private progress!: Phaser.GameObjects.Graphics;
  private score!: Phaser.GameObjects.Text;
  private effects!: Phaser.GameObjects.Text;
  private skillLabel!: Phaser.GameObjects.Text;
  private skillBar!: Phaser.GameObjects.Graphics;
  private popup!: Phaser.GameObjects.Text;
  private banner!: Phaser.GameObjects.Text;
  private jumpBtn!: Phaser.GameObjects.Image;
  private slideBtn!: Phaser.GameObjects.Image;
  private menu!: Phaser.GameObjects.Container;
  private game_!: GameScene;

  constructor() {
    super('UI');
  }

  create(): void {
    this.game_ = this.scene.get('Game') as GameScene;

    // 체력바
    this.add.image(40, 28, 'ui_hp_bar').setOrigin(0).setDisplaySize(400, 32);
    this.hpFill = this.add.graphics();
    text(this, 48, 32, 'HP', 18, '#1a1a2e', true);
    // 진행률
    this.progress = this.add.graphics();
    this.score = text(this, 1130, 30, '0', 34, '#ffffff', true).setOrigin(1, 0).setStroke('#1a1a2e', 6);
    this.effects = text(this, 40, 98, '', 20, '#ffffff', true).setStroke('#1a1a2e', 5);
    // 캐릭터 스킬 막대 (스킬 있는 캐릭터만 보인다)
    this.skillLabel = text(this, 40, 124, '', 18, '#ffffff', true).setStroke('#1a1a2e', 4);
    this.skillBar = this.add.graphics();
    this.popup = text(this, 640, 220, '', 44, '#ffffff', true).setOrigin(0.5).setStroke('#1a1a2e', 8).setAlpha(0);
    this.banner = text(this, 640, 330, '', 72, '#ffffff', true).setOrigin(0.5).setStroke('#1a1a2e', 10).setVisible(false);

    // 점프·슬라이드 버튼 (표시용: 실제 판정은 화면 왼쪽/오른쪽 절반)
    this.jumpBtn = this.add.image(130, 600, 'ui_btn_jump').setDisplaySize(160, 160).setAlpha(0.5);
    text(this, 130, 600, '점프', 26, '#1a1a2e', true).setOrigin(0.5);
    this.slideBtn = this.add.image(1150, 600, 'ui_btn_slide').setDisplaySize(160, 160).setAlpha(0.5);
    text(this, 1150, 600, '슬라이드', 24, '#1a1a2e', true).setOrigin(0.5);

    // 일시정지 버튼
    const pa = PAUSE_AREA;
    const pause = this.add.container(pa.x + pa.w / 2, pa.y + 55);
    const pg = this.add.graphics();
    pg.fillStyle(0x1a1a2e, 0.55).fillCircle(0, 0, 34).fillStyle(0xffffff, 1).fillRect(-12, -14, 8, 28).fillRect(4, -14, 8, 28);
    pause.add(pg).setSize(80, 80).setInteractive({ useHandCursor: true });
    pause.on('pointerup', () => this.game_.setPaused(!this.game_.paused));

    this.menu = this.buildMenu().setVisible(false);

    this.game_.events.on('hud', this.onHud, this);
    this.game_.events.on('paused', this.onPaused, this);
    this.game_.events.on('item', this.onItem, this);
    this.game_.events.on('popup', this.onPopup, this);
    this.game_.events.on('finished', this.onFinished, this);
    this.events.once('shutdown', () => {
      this.game_.events.off('hud', this.onHud, this);
      this.game_.events.off('paused', this.onPaused, this);
      this.game_.events.off('item', this.onItem, this);
      this.game_.events.off('popup', this.onPopup, this);
      this.game_.events.off('finished', this.onFinished, this);
    });
  }

  private buildMenu(): Phaser.GameObjects.Container {
    const dim = this.add.rectangle(0, 0, 1280, 720, 0x000000, 0.55).setOrigin(0).setInteractive();
    const title = text(this, 640, 200, '일시정지', 56, '#ffffff', true).setOrigin(0.5);
    const resume = button(this, 640, 320, 320, 76, '계속하기', () => this.game_.setPaused(false));
    const retry = button(this, 640, 420, 320, 76, '다시 시작', () => this.game_.restart(), 0xdfe6f5);
    const quit = button(this, 640, 520, 320, 76, '로비로', () => this.game_.quit(), 0xdfe6f5);
    const items: Phaser.GameObjects.GameObject[] = [dim, title, resume, retry, quit];
    if (fullscreen.supported() && !fullscreen.standalone()) {
      items.push(button(this, 640, 620, 320, 60, '전체화면 켜기/끄기', () => void fullscreen.toggle(), 0xdfe6f5, 22));
    }
    return this.add.container(0, 0, items).setDepth(100);
  }

  private onPaused(on: boolean): void {
    this.menu.setVisible(on);
  }

  private onItem(kind: string): void {
    this.onPopup(ITEM_LABEL[kind] ?? '');
  }

  private onPopup(label: string): void {
    this.popup.setText(label).setAlpha(1).setScale(0.8).setY(220);
    this.tweens.killTweensOf(this.popup);
    this.tweens.add({ targets: this.popup, alpha: 0, y: 190, scale: 1, duration: 900, ease: 'Cubic.easeIn' });
  }

  private onFinished(outcome: string): void {
    this.banner
      .setText(outcome === 'cleared' ? '클리어!' : '실패…')
      .setColor(outcome === 'cleared' ? '#ffd23f' : '#ff8080')
      .setVisible(true)
      .setScale(0.6);
    this.tweens.add({ targets: this.banner, scale: 1, duration: 300, ease: 'Back.easeOut' });
  }

  private onHud(s: SimState, controls: InputController): void {
    const hp = Math.max(0, s.player.hp) / s.maxHp;
    this.hpFill
      .clear()
      .fillStyle(hp < 0.3 ? COLORS.bad : COLORS.good, 1)
      .fillRoundedRect(84, 32, 352 * hp, 24, 6);

    const ratio = Math.min(1, (s.player.x - cfg.playerScreenX) / (s.stage.goalX - cfg.playerScreenX));
    this.progress
      .clear()
      .fillStyle(0x1a1a2e, 0.45)
      .fillRoundedRect(40, 72, 400, 12, 6)
      .fillStyle(0xffd23f, 1)
      .fillRoundedRect(40, 72, Math.max(12, 400 * ratio), 12, 6);

    this.score.setText(totalScore(s).toLocaleString());

    const parts: string[] = [];
    const sec = (t: number) => (t / TICK_RATE).toFixed(1);
    if (s.effects.magnet > 0) parts.push(`자석 ${sec(s.effects.magnet)}초`);
    if (s.effects.giant > 0) parts.push(`거대화 ${sec(s.effects.giant)}초`);
    if (s.effects.boost > 0) parts.push(`부스터 ${sec(s.effects.boost)}초`);
    this.effects.setText(parts.join('   '));

    // 스킬 막대: 평소엔 다음 발동까지, 대능력 중엔 남은 시간과 박스 코인
    const k = s.skill;
    this.skillLabel.setVisible(!!k);
    this.skillBar.clear();
    if (k) {
      const c = cfg.skills[k.id];
      let fill: number;
      let color: number;
      if (k.ultimateTicks > 0) {
        this.skillLabel.setText(`대능력  박스 코인 ${k.boxCoins}  ·  ${sec(k.ultimateTicks)}초`);
        fill = k.ultimateTicks / c.ultimateTicks;
        color = 0xa66cff;
      } else {
        const nextIsUltimate = (k.count + 1) % c.ultimateEvery === 0;
        this.skillLabel.setText(`${nextIsUltimate ? '다음: 대능력!' : '다음: 소능력'}  ${sec(k.timer)}초`);
        fill = 1 - k.timer / c.intervalTicks;
        color = nextIsUltimate ? COLORS.accent : 0x4a90e2;
      }
      this.skillBar
        .fillStyle(0x1a1a2e, 0.45)
        .fillRoundedRect(40, 150, 400, 12, 6)
        .fillStyle(color, 1)
        .fillRoundedRect(40, 150, Math.max(12, 400 * fill), 12, 6);
    }

    const jumpLit = this.time.now - controls.lastJumpAt < 120;
    this.jumpBtn.setAlpha(jumpLit ? 0.95 : 0.5).setScale(jumpLit ? 0.93 * (160 / this.jumpBtn.width) : 160 / this.jumpBtn.width);
    this.slideBtn.setAlpha(controls.slideHeld ? 0.95 : 0.5);
  }
}
