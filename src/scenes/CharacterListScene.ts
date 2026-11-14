import Phaser from 'phaser';
import { characters, RARITY, type CharacterInfo } from '../data/characters';
import { saveStore } from '../save/store';
import { button, COLORS, text } from '../ui/style';

const W = 1280;
const H = 720;
const CARD_W = 200;
const CARD_H = 270;
const GAP = 28;
const COLS = 5;
const TOP = 120; // 격자가 시작하는 y
const HEADER_H = 104;

/** 이미지를 비율을 지키며 maxW×maxH 안에 맞춘다 */
export function fitImage(img: Phaser.GameObjects.Image, maxW: number, maxH: number): Phaser.GameObjects.Image {
  const f = img.frame;
  const k = Math.min(maxW / f.width, maxH / f.height);
  return img.setDisplaySize(f.width * k, f.height * k);
}

/**
 * 캐릭터 목록: 로비에서 가운데 캐릭터를 누르면 열린다.
 * 카드가 격자로 늘어서고, 카드를 누르면 정보 화면(CharacterInfo)으로 들어간다.
 */
export class CharacterListScene extends Phaser.Scene {
  private grid!: Phaser.GameObjects.Container;
  private scrollMin = 0;
  private dragStartY = 0;
  private dragGridY = 0;
  private dragMoved = 0;

  constructor() {
    super('Characters');
  }

  create(): void {
    this.add.tileSprite(0, 0, W, H, 'bg_far').setOrigin(0);
    this.add.rectangle(0, 0, W, H, COLORS.panel, 0.78).setOrigin(0);

    this.grid = this.add.container(0, 0);
    const startX = (W - (COLS * CARD_W + (COLS - 1) * GAP)) / 2;
    characters.forEach((c, i) => {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const x = startX + col * (CARD_W + GAP) + CARD_W / 2;
      const y = TOP + row * (CARD_H + GAP) + CARD_H / 2;
      this.grid.add(this.card(x, y, c, i));
    });
    const rows = Math.ceil(characters.length / COLS);
    const contentBottom = TOP + rows * (CARD_H + GAP) - GAP + 24;
    this.scrollMin = Math.min(0, H - contentBottom);

    // 머리줄: 스크롤되는 카드 위를 덮는다
    this.add.rectangle(0, 0, W, HEADER_H, COLORS.panel, 1).setOrigin(0).setDepth(5);
    text(this, W / 2, 52, '캐릭터', 40, '#ffffff', true).setOrigin(0.5).setDepth(6);
    text(this, W / 2, 88, `${characters.length}명 · 카드를 누르면 정보를 볼 수 있어요`, 18, COLORS.inkDim).setOrigin(0.5).setDepth(6);
    button(this, 120, 52, 180, 64, '← 로비', () => this.scene.start('Lobby'), 0xdfe6f5, 24).setDepth(6);

    this.setupScroll();
    this.input.keyboard?.on('keydown', (ev: KeyboardEvent) => {
      if (ev.code === 'Escape' || ev.code === 'Backspace') this.scene.start('Lobby');
      const n = Number(ev.key);
      if (n >= 1 && n <= Math.min(9, characters.length)) this.open(characters[n - 1].id);
    });
  }

  private card(x: number, y: number, c: CharacterInfo, i: number): Phaser.GameObjects.Container {
    const r = RARITY[c.rarity];
    const selected = c.id === saveStore.data.selectedCharacter;
    const g = this.add.graphics();
    g.fillStyle(0xffffff, 0.96).fillRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 16);
    // 등급 색 배경 (그림 뒤)
    g.fillStyle(r.color, 0.28).fillRoundedRect(-CARD_W / 2 + 10, -CARD_H / 2 + 10, CARD_W - 20, 186, 12);
    g.lineStyle(selected ? 6 : 4, selected ? COLORS.accent : r.color, 1).strokeRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 16);

    const portrait = fitImage(this.add.image(0, -CARD_H / 2 + 194, `char_${c.id}`).setOrigin(0.5, 1), 150, 176);
    const items: Phaser.GameObjects.GameObject[] = [
      g,
      portrait,
      text(this, 0, CARD_H / 2 - 52, c.name, 26, '#1a1a2e', true).setOrigin(0.5),
      text(this, 0, CARD_H / 2 - 22, r.label, 17, r.css, true).setOrigin(0.5),
      text(this, -CARD_W / 2 + 16, -CARD_H / 2 + 14, `${i + 1}`, 16, '#4a5068', true),
    ];
    if (selected) {
      const tag = this.add.graphics();
      tag.fillStyle(COLORS.accent, 1).fillRoundedRect(CARD_W / 2 - 82, -CARD_H / 2 + 12, 70, 28, 14);
      items.push(tag, text(this, CARD_W / 2 - 47, -CARD_H / 2 + 26, '선택 중', 15, '#1a1a2e', true).setOrigin(0.5));
    }
    const zone = this.add.zone(0, 0, CARD_W, CARD_H).setInteractive({ useHandCursor: true });
    zone.on('pointerup', () => {
      if (this.dragMoved < 12) this.open(c.id);
    });
    items.push(zone);
    const card = this.add.container(x, y, items);
    card.setData('id', c.id);
    return card;
  }

  private open(id: string): void {
    this.scene.start('CharacterInfo', { id });
  }

  /** 캐릭터가 한 화면보다 많아지면 위아래로 끌어서 넘긴다 */
  private setupScroll(): void {
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.dragStartY = p.y;
      this.dragGridY = this.grid.y;
      this.dragMoved = 0;
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!p.isDown) return;
      this.dragMoved = Math.max(this.dragMoved, Math.abs(p.y - this.dragStartY));
      if (this.scrollMin < 0) this.grid.y = Phaser.Math.Clamp(this.dragGridY + (p.y - this.dragStartY), this.scrollMin, 0);
    });
    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => {
      if (this.scrollMin < 0) this.grid.y = Phaser.Math.Clamp(this.grid.y - dy, this.scrollMin, 0);
    });
  }
}
