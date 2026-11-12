import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { PreloadScene } from './scenes/PreloadScene';
import { TitleScene } from './scenes/TitleScene';
import { GameScene } from './scenes/GameScene';
import { UIScene } from './scenes/UIScene';
import { ResultScene } from './scenes/ResultScene';

// 논리 해상도는 항상 1280×720. 기기는 비율 그대로 키우거나 줄여서 보여주기만 한다 (휴대폰·PC 같은 화면).
const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#87ceeb',
  pixelArt: false,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 1280,
    height: 720,
  },
  input: { activePointers: 3 },
  render: { preserveDrawingBuffer: true },
  scene: [BootScene, PreloadScene, TitleScene, GameScene, UIScene, ResultScene],
});

declare global {
  interface Window {
    __deltaRun?: { game: Phaser.Game; frozen: boolean; tick: number };
  }
}
window.__deltaRun = { game, frozen: false, tick: 0 };

// 휴대폰(터치)에서 첫 터치 때 전체화면 + 가로 고정 시도. 실패하면(iOS 등) 회전 안내만 보인다.
const isTouch = matchMedia('(pointer: coarse)').matches;
if (isTouch) {
  const tryLock = async () => {
    try {
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
      const o = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
      await o.lock?.('landscape');
    } catch {
      // 지원하지 않는 브라우저
    }
  };
  window.addEventListener('pointerdown', tryLock, { once: true });
}
