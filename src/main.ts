import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { PreloadScene } from './scenes/PreloadScene';
import { LobbyScene } from './scenes/LobbyScene';
import { CharacterListScene } from './scenes/CharacterListScene';
import { CharacterInfoScene } from './scenes/CharacterInfoScene';
import { AccountScene } from './scenes/AccountScene';
import { EquipmentScene } from './scenes/EquipmentScene';
import { EventScene } from './scenes/EventScene';
import { GachaScene } from './scenes/GachaScene';
import { GameScene } from './scenes/GameScene';
import { UIScene } from './scenes/UIScene';
import { ResultScene } from './scenes/ResultScene';
import { startCloud } from './online';
import { fullscreen } from './ui/fullscreen';

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
  scene: [BootScene, PreloadScene, LobbyScene, CharacterListScene, CharacterInfoScene, EquipmentScene, GachaScene, EventScene, AccountScene, GameScene, UIScene, ResultScene],
});

declare global {
  interface Window {
    __deltaRun?: { game: Phaser.Game; frozen: boolean; tick: number };
  }
}
window.__deltaRun = { game, frozen: false, tick: 0 };
startCloud();

// 휴대폰(터치)에서는 접속 후 첫 터치 때 자동으로 전체화면 + 가로 전환을 한다.
// 브라우저는 보안상 사용자가 화면을 한 번 누른 뒤에만 전체화면을 허락하므로, 접속 즉시는 불가능하다.
// iPhone Safari처럼 지원하지 않는 곳에서는 '홈 화면에 추가'로 열면 처음부터 전체화면이다.
// 전체화면이나 가로 고정이 풀렸다면 다음 터치 때 다시 시도한다 (이미 전체화면이면 아무 일도 없다)
if (matchMedia('(pointer: coarse)').matches) {
  window.addEventListener('pointerup', () => {
    if (!fullscreen.active()) void fullscreen.enter();
  });
}

// 전체화면·회전으로 화면 크기가 바뀌면 캔버스 크기를 다시 맞춘다 (브라우저마다 resize 이벤트가 늦게 와서 작게 남는 문제 방지)
const refreshScale = () => {
  game.scale.refresh();
  setTimeout(() => game.scale.refresh(), 150);
  setTimeout(() => game.scale.refresh(), 500);
};
document.addEventListener('fullscreenchange', refreshScale);
window.addEventListener('resize', refreshScale);
window.addEventListener('orientationchange', refreshScale);
window.visualViewport?.addEventListener('resize', refreshScale);
