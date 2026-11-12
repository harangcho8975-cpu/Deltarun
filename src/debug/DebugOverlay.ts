import GUI from 'lil-gui';
import Phaser from 'phaser';
import { gameConfig } from '../config/gameConfig';
import { activeRange, type SimState } from '../sim';
import type { GameScene } from '../scenes/GameScene';

const SPEEDS: Record<string, number> = { Digit1: 1, Digit2: 2, Digit3: 4, Digit4: 0.25 };

/** ?debug=1: 정보 패널, 무적(I), 배속(1~4), 리플레이 저장(R), 수치 조절 패널 */
export class DebugOverlay {
  private info: Phaser.GameObjects.Text;
  private gui: GUI;

  constructor(private scene: GameScene) {
    this.info = scene.add
      .text(8, 140, '', { fontFamily: 'monospace', fontSize: '14px', color: '#00ff88', backgroundColor: '#000000aa' })
      .setDepth(60)
      .setResolution(2);
    scene.input.keyboard?.on('keydown', this.onKey, this);

    this.gui = new GUI({ title: 'gameConfig (디버그)' });
    this.gui.close();
    const phys = this.gui.addFolder('물리');
    phys.add(gameConfig, 'gravity', 1000, 5000, 50);
    phys.add(gameConfig, 'jumpVelocity', -1400, -400, 10);
    phys.add(gameConfig, 'doubleJumpVelocity', -1400, -400, 10);
    phys.add(gameConfig, 'maxFallSpeed', 600, 3000, 50);
    const hp = this.gui.addFolder('체력');
    hp.add(gameConfig.hp, 'drainPerSec', 0, 10, 0.1);
    hp.add(gameConfig.hp, 'hitDamage', 0, 50, 1);
    hp.add(gameConfig, 'invulnTicksOnHit', 0, 240, 1);
    const fx = this.gui.addFolder('아이템');
    fx.add(gameConfig.effects, 'magnetRadius', 50, 600, 10);
    fx.add(gameConfig.effects, 'boostMultiplier', 1, 4, 0.1);
  }

  private onKey(ev: KeyboardEvent): void {
    const s = this.scene.sim;
    if (ev.code === 'KeyI') s.debugInvincible = !s.debugInvincible;
    if (ev.code in SPEEDS) this.scene.timeScale = SPEEDS[ev.code];
    if (ev.code === 'KeyR') {
      const blob = new Blob([JSON.stringify(this.scene.recorder.toJSON())], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${s.stage.id}.replay.json`;
      a.click();
      URL.revokeObjectURL(a.href);
    }
  }

  update(s: SimState): void {
    const p = s.player;
    const [a, b] = activeRange({ ...s });
    this.info.setText(
      [
        `FPS ${this.scene.game.loop.actualFps.toFixed(0)}  tick ${s.tick}  ×${this.scene.timeScale}`,
        `cameraX ${s.cameraX.toFixed(0)}  x ${p.x.toFixed(0)}`,
        `state ${p.state}  y ${p.y.toFixed(1)}  vy ${p.vy.toFixed(0)}`,
        `hp ${p.hp.toFixed(1)}  inv ${p.invulnTicks}  ${s.debugInvincible ? '무적(I)' : ''}`,
        `활성 엔티티 ${b - a}  커서 ${s.cursor}/${s.entities.length}`,
        `I 무적 · 1~4 배속 · R 리플레이 저장`,
      ].join('\n'),
    );
  }

  destroy(): void {
    this.scene.input.keyboard?.off('keydown', this.onKey, this);
    this.gui.destroy();
  }
}
