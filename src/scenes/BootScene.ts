import Phaser from 'phaser';
import { MANIFEST_KEY } from '../render/assets';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    this.load.json(MANIFEST_KEY, 'assets/manifest.json');
  }

  create(): void {
    this.scene.start('Preload');
  }
}
