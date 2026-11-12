import Phaser from 'phaser';
import { saveStore } from '../save/store';

let currentBgm: Phaser.Sound.BaseSound | null = null;
let currentBgmKey = '';

/** 파일이 없는 키는 조용히 무시한다 (플레이스홀더 단계에서도 에러 없음). */
export const Sound = {
  play(scene: Phaser.Scene, key: string, volume = 0.7): void {
    if (!saveStore.data.settings.sfx) return;
    if (!scene.cache.audio.exists(key)) return;
    scene.sound.play(key, { volume });
  },

  playBgm(scene: Phaser.Scene, key: string): void {
    if (currentBgmKey === key && currentBgm?.isPlaying) return;
    this.stopBgm();
    currentBgmKey = key;
    if (!saveStore.data.settings.bgm || !scene.cache.audio.exists(key)) return;
    currentBgm = scene.sound.add(key, { loop: true, volume: 0.5 });
    currentBgm.play();
  },

  stopBgm(): void {
    currentBgm?.stop();
    currentBgm?.destroy();
    currentBgm = null;
    currentBgmKey = '';
  },
};
