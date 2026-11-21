// 공통 UI 부품. 쿠키런 오븐브레이크처럼 두툼한 입체 버튼, 위쪽 바, 코인 알약, 크림색 패널.
// 그림 에셋이 생기기 전까지는 모두 도형으로 그린다.
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
  /** 오븐브레이크 느낌 */
  yellow: 0xffc83d,
  green: 0x41c75f,
  blue: 0x3d9bff,
  pink: 0xff6fa5,
  purple: 0x9b6bff,
  cream: 0xfff4dc,
  brown: 0x6b4423,
  bar: 0x24203a,
};

export function text(scene: Phaser.Scene, x: number, y: number, str: string, size = 24, color = COLORS.ink, bold = false) {
  return scene.add
    .text(x, y, str, { fontFamily: FONT, fontSize: `${size}px`, color, fontStyle: bold ? 'bold' : 'normal' })
    .setResolution(2);
}

/** 색을 어둡게 (0~1) */
export function shade(color: number, k: number): number {
  const c = Phaser.Display.Color.IntegerToColor(color);
  return Phaser.Display.Color.GetColor(Math.round(c.red * k), Math.round(c.green * k), Math.round(c.blue * k));
}

export const hex = (color: number) => '#' + color.toString(16).padStart(6, '0');

const isLight = (color: number) => {
  const c = Phaser.Display.Color.IntegerToColor(color);
  return (0.299 * c.red + 0.587 * c.green + 0.114 * c.blue) / 255 > 0.8;
};

export interface Button extends Phaser.GameObjects.Container {
  setEnabled(on: boolean): Button;
}

/**
 * 두툼한 입체 버튼: 아래에 어두운 받침, 위에 윤기, 흰 테두리. 누르면 쑥 들어가고 손을 뗄 때 실행된다.
 * 밝은 색 버튼은 진한 글씨, 진한 색 버튼은 흰 글씨 + 테두리.
 */
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
  const depth = Math.max(5, Math.round(h * 0.09));
  const r = Math.min(18, h / 2.6);
  const bg = scene.add.graphics();
  const t = text(scene, 0, 0, label, size, '#ffffff', true).setOrigin(0.5);
  let pressed = false;
  let enabled = true;
  const draw = () => {
    const face = enabled ? fill : COLORS.locked;
    const off = pressed ? depth - 2 : 0;
    const top = -h / 2;
    const fh = h - depth;
    bg.clear();
    bg.fillStyle(shade(face, 0.62), 1).fillRoundedRect(-w / 2, top + depth, w, fh, r); // 받침
    bg.fillStyle(face, 1).fillRoundedRect(-w / 2, top + off, w, fh, r); // 앞면
    bg.fillStyle(0xffffff, 0.22).fillRoundedRect(-w / 2 + 6, top + off + 4, w - 12, fh * 0.42, { tl: r - 4, tr: r - 4, bl: 6, br: 6 }); // 윤기
    bg.lineStyle(3, 0xffffff, enabled ? 0.85 : 0.35).strokeRoundedRect(-w / 2, top + off, w, fh, r); // 테두리
    const light = enabled && isLight(face);
    t.setColor(light ? '#4a3520' : '#ffffff')
      .setStroke(hex(shade(face, 0.45)), light ? 0 : Math.max(3, Math.round(size / 6)))
      .setY(top + off + fh / 2);
  };
  draw();
  const c = scene.add.container(x, y, [bg, t]) as Button;
  c.setSize(w, h).setInteractive({ useHandCursor: true });
  c.on('pointerdown', () => {
    if (!enabled) return;
    pressed = true;
    draw();
  });
  c.on('pointerout', () => {
    pressed = false;
    draw();
  });
  c.on('pointerup', () => {
    pressed = false;
    draw();
    if (enabled) onClick();
  });
  c.setEnabled = (on: boolean) => {
    enabled = on;
    draw();
    return c;
  };
  return c;
}

/** 크림색 둥근 패널 + (있으면) 위쪽 리본 제목 */
export function panel(scene: Phaser.Scene, x: number, y: number, w: number, h: number, title?: string, ribbon: number = COLORS.yellow): Phaser.GameObjects.Container {
  const g = scene.add.graphics();
  g.fillStyle(0x000000, 0.25).fillRoundedRect(x + 4, y + 8, w, h, 22);
  g.fillStyle(COLORS.cream, 1).fillRoundedRect(x, y, w, h, 22);
  g.lineStyle(5, COLORS.brown, 1).strokeRoundedRect(x, y, w, h, 22);
  const items: Phaser.GameObjects.GameObject[] = [g];
  if (title) {
    const label = text(scene, x + w / 2, y + 4, title, 24, '#ffffff', true).setOrigin(0.5).setStroke(hex(shade(ribbon, 0.45)), 5);
    const tw = Math.min(w - 40, label.width + 70);
    const rg = scene.add.graphics();
    rg.fillStyle(shade(ribbon, 0.7), 1).fillRoundedRect(x + w / 2 - tw / 2, y - 12, tw, 44, 14);
    rg.fillStyle(ribbon, 1).fillRoundedRect(x + w / 2 - tw / 2, y - 18, tw, 44, 14);
    rg.lineStyle(3, 0xffffff, 0.9).strokeRoundedRect(x + w / 2 - tw / 2, y - 18, tw, 44, 14);
    items.push(rg, label);
  }
  return scene.add.container(0, 0, items);
}

/** 코인 알약: 동전 아이콘 + 숫자 (오른쪽 끝 x 기준) */
export function coinPill(scene: Phaser.Scene, right: number, y: number, coins: number, w = 210): { container: Phaser.GameObjects.Container; label: Phaser.GameObjects.Text } {
  const x0 = right - w;
  const g = scene.add.graphics();
  g.fillStyle(0x000000, 0.45).fillRoundedRect(x0, y - 22, w, 44, 22);
  g.lineStyle(2, 0xffffff, 0.35).strokeRoundedRect(x0, y - 22, w, 44, 22);
  g.fillStyle(0xd99a00, 1).fillCircle(x0 + 22, y + 2, 18);
  g.fillStyle(0xffd23f, 1).fillCircle(x0 + 22, y, 18);
  g.lineStyle(3, 0xfff3b0, 1).strokeCircle(x0 + 22, y, 11);
  const label = text(scene, right - 18, y, coins.toLocaleString(), 24, '#ffffff', true).setOrigin(1, 0.5).setStroke('#1a1a2e', 4);
  return { container: scene.add.container(0, 0, [g, label]), label };
}

/** 둥근 뒤로 가기 버튼 (왼쪽 위) */
export function backButton(scene: Phaser.Scene, onClick: () => void): Button {
  return button(scene, 70, 46, 100, 66, '◀', onClick, COLORS.yellow, 30);
}

/** 화면 위쪽 바: 왼쪽 뒤로 가기, 가운데 제목, 오른쪽 코인. 화면들의 머리줄을 한 모양으로 맞춘다. */
export function topBar(
  scene: Phaser.Scene,
  title: string,
  onBack: (() => void) | null,
  coins?: number,
): { coinLabel?: Phaser.GameObjects.Text; objects: Phaser.GameObjects.GameObject[] } {
  const before = scene.children.list.length;
  const g = scene.add.graphics();
  g.fillStyle(COLORS.bar, 0.92).fillRect(0, 0, 1280, 92);
  g.fillStyle(0x000000, 0.25).fillRect(0, 92, 1280, 6);
  if (onBack) backButton(scene, onBack);
  if (title) text(scene, 640, 46, title, 36, '#ffffff', true).setOrigin(0.5).setStroke('#000000', 6);
  let coinLabel: Phaser.GameObjects.Text | undefined;
  if (coins !== undefined) coinLabel = coinPill(scene, 1256, 46, coins).label;
  return { coinLabel, objects: scene.children.list.slice(before) };
}

/** 메뉴 아이콘 종류 (도형으로 그린다) */
export type IconKind = 'character' | 'equip' | 'gacha' | 'event' | 'account' | 'settings';

export function drawIcon(g: Phaser.GameObjects.Graphics, kind: IconKind, x: number, y: number, s: number): void {
  g.fillStyle(0xffffff, 1);
  const P = (px: number, py: number) => new Phaser.Geom.Point(x + px * s, y + py * s);
  switch (kind) {
    case 'character':
      g.fillCircle(x, y - s * 0.16, s * 0.2);
      g.fillRoundedRect(x - s * 0.3, y + s * 0.08, s * 0.6, s * 0.3, s * 0.12);
      break;
    case 'equip': // 방패
      g.fillPoints([P(-0.3, -0.32), P(0.3, -0.32), P(0.28, 0.04), P(0, 0.36), P(-0.28, 0.04)], true);
      break;
    case 'gacha': // 선물 상자
      g.fillRect(x - s * 0.3, y - s * 0.06, s * 0.6, s * 0.4);
      g.fillRect(x - s * 0.36, y - s * 0.22, s * 0.72, s * 0.16);
      g.fillStyle(COLORS.pink, 1).fillRect(x - s * 0.06, y - s * 0.22, s * 0.12, s * 0.56);
      break;
    case 'event': {
      const pts: Phaser.Geom.Point[] = [];
      for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? 0.38 : 0.16;
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        pts.push(P(Math.cos(a) * r, Math.sin(a) * r));
      }
      g.fillPoints(pts, true);
      break;
    }
    case 'account': // 구름
      g.fillCircle(x - s * 0.14, y + s * 0.06, s * 0.16);
      g.fillCircle(x + s * 0.05, y - s * 0.06, s * 0.22);
      g.fillCircle(x + s * 0.22, y + s * 0.08, s * 0.14);
      g.fillRect(x - s * 0.14, y + s * 0.06, s * 0.36, s * 0.16);
      break;
    case 'settings':
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        g.fillCircle(x + Math.cos(a) * s * 0.26, y + Math.sin(a) * s * 0.26, s * 0.09);
      }
      g.fillCircle(x, y, s * 0.24);
      g.fillStyle(0x000000, 0.35).fillCircle(x, y, s * 0.09);
      break;
  }
}

/** 아이콘 버튼: 색 사각형 위에 아이콘, 아래 이름. badge가 true면 빨간 점 */
export function iconButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  kind: IconKind,
  label: string,
  color: number,
  onClick: () => void,
  badge = false,
  size = 80,
): Phaser.GameObjects.Container {
  const g = scene.add.graphics();
  let pressed = false;
  const draw = () => {
    const off = pressed ? 4 : 0;
    g.clear();
    g.fillStyle(shade(color, 0.6), 1).fillRoundedRect(-size / 2, -size / 2 + 6, size, size, 20);
    g.fillStyle(color, 1).fillRoundedRect(-size / 2, -size / 2 + off, size, size, 20);
    g.fillStyle(0xffffff, 0.2).fillRoundedRect(-size / 2 + 5, -size / 2 + off + 4, size - 10, size * 0.4, { tl: 16, tr: 16, bl: 6, br: 6 });
    g.lineStyle(3, 0xffffff, 0.9).strokeRoundedRect(-size / 2, -size / 2 + off, size, size, 20);
    drawIcon(g, kind, 0, off, size * 0.78);
  };
  draw();
  const items: Phaser.GameObjects.GameObject[] = [g, text(scene, 0, size / 2 + 20, label, 18, '#ffffff', true).setOrigin(0.5).setStroke('#1a1a2e', 5)];
  if (badge) items.push(scene.add.circle(size / 2 - 6, -size / 2 + 6, 11, 0xe74c3c).setStrokeStyle(3, 0xffffff));
  const c = scene.add.container(x, y, items);
  c.setSize(size, size).setInteractive({ useHandCursor: true });
  c.on('pointerdown', () => {
    pressed = true;
    draw();
  });
  c.on('pointerout', () => {
    pressed = false;
    draw();
  });
  c.on('pointerup', () => {
    pressed = false;
    draw();
    onClick();
  });
  return c;
}

/** 등급 알약 */
export function rarityPill(scene: Phaser.Scene, x: number, y: number, label: string, color: number, size = 16): Phaser.GameObjects.Container {
  const t = text(scene, 0, 0, label, size, '#ffffff', true).setOrigin(0.5).setStroke(hex(shade(color, 0.5)), 3);
  const w = t.width + 24;
  const g = scene.add.graphics();
  g.fillStyle(color, 1).fillRoundedRect(-w / 2, -size * 0.85, w, size * 1.7, size * 0.85);
  return scene.add.container(x, y, [g, t]);
}
