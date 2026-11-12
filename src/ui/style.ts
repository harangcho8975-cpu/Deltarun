import Phaser from 'phaser';

export const FONT = '"Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", system-ui, sans-serif';
export const COLORS = {
  ink: '#ffffff',
  inkDim: '#c9d1e6',
  panel: 0x1a1a2e,
  accent: 0xf5a623,
  good: 0x2ecc71,
  bad: 0xe74c3c,
  locked: 0x555a6e,
};

export function text(scene: Phaser.Scene, x: number, y: number, str: string, size = 24, color = COLORS.ink, bold = false) {
  return scene.add
    .text(x, y, str, { fontFamily: FONT, fontSize: `${size}px`, color, fontStyle: bold ? 'bold' : 'normal' })
    .setResolution(2);
}

export interface Button extends Phaser.GameObjects.Container {
  setEnabled(on: boolean): Button;
}

/** 둥근 사각형 버튼. 누르면 살짝 작아지고, 손을 뗄 때 실행된다. */
export function button(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  onClick: () => void,
  fill: number = COLORS.accent,
  size = 26,
): Button {
  const bg = scene.add.graphics();
  const draw = (color: number) => {
    bg.clear();
    bg.fillStyle(color, 1).fillRoundedRect(-w / 2, -h / 2, w, h, 14);
    bg.lineStyle(3, 0x000000, 0.25).strokeRoundedRect(-w / 2, -h / 2, w, h, 14);
  };
  draw(fill);
  const t = text(scene, 0, 0, label, size, '#1a1a2e', true).setOrigin(0.5);
  const c = scene.add.container(x, y, [bg, t]) as Button;
  c.setSize(w, h).setInteractive({ useHandCursor: true });
  let enabled = true;
  c.on('pointerdown', () => enabled && c.setScale(0.96));
  c.on('pointerout', () => c.setScale(1));
  c.on('pointerup', () => {
    c.setScale(1);
    if (enabled) onClick();
  });
  c.setEnabled = (on: boolean) => {
    enabled = on;
    draw(on ? fill : COLORS.locked);
    return c;
  };
  return c;
}
