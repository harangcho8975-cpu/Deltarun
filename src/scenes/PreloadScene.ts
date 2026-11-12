import Phaser from 'phaser';
import { MANIFEST_KEY, makePlaceholder, queueAssets, registerAnimations, type ManifestEntry } from '../render/assets';
import { params } from '../debug/params';
import { FONT } from '../ui/style';

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('Preload');
  }

  preload(): void {
    const manifest = this.cache.json.get(MANIFEST_KEY) as ManifestEntry[];
    const missing = new Set<string>();

    const bar = this.add.graphics();
    const label = this.add
      .text(640, 400, '불러오는 중…', { fontFamily: FONT, fontSize: '24px', color: '#1a1a2e' })
      .setOrigin(0.5)
      .setResolution(2);
    this.load.on('progress', (v: number) => {
      bar.clear().fillStyle(0x1a1a2e, 0.3).fillRect(440, 340, 400, 16).fillStyle(0x1a1a2e, 1).fillRect(440, 340, 400 * v, 16);
    });
    this.load.on('loaderror', (file: Phaser.Loader.File) => {
      missing.add(file.key);
      console.warn(`[assets] ${file.key} 로드 실패 → 플레이스홀더 사용`);
    });
    this.load.once('complete', () => {
      for (const e of manifest) {
        if (e.type !== 'audio' && (!e.path || missing.has(e.key))) makePlaceholder(this, e);
      }
      registerAnimations(this, manifest);
      label.destroy();
      bar.destroy();
    });
    queueAssets(this, manifest);
  }

  create(): void {
    if (params.stage) this.scene.start('Game', { stageId: params.stage });
    else this.scene.start('Title');
  }
}
