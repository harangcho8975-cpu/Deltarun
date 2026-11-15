import Phaser from 'phaser';
import { ABILITY_LABEL, characterById, characterIndex, characters, RARITY } from '../data/characters';
import { saveStore } from '../save/store';
import { button, COLORS, text } from '../ui/style';
import { fitImage } from './CharacterListScene';

const W = 1280;
const H = 720;
const PANEL = { x: 640, y: 104, w: 600, h: 524 };

/**
 * 캐릭터 정보: 왼쪽에 캐릭터를 크게, 오른쪽 패널에 이름·등급·스킬·소개.
 * ◀ ▶로 앞뒤 캐릭터를 넘기고, [선택하기]를 누르면 로비 캐릭터로 정하고 로비로 돌아간다.
 */
export class CharacterInfoScene extends Phaser.Scene {
  private id = '';

  constructor() {
    super('CharacterInfo');
  }

  init(data: { id: string }): void {
    this.id = characterById(data?.id ?? '').id;
  }

  create(): void {
    const c = characterById(this.id);
    const r = RARITY[c.rarity];
    const selected = c.id === saveStore.data.selectedCharacter;

    // 배경: 어두운 바탕 + 캐릭터 뒤로 등급 색 원광
    this.add.rectangle(0, 0, W, H, COLORS.panel, 1).setOrigin(0);
    const glow = this.add.graphics();
    for (let i = 6; i >= 1; i--) glow.fillStyle(r.color, 0.06 * (7 - i)).fillCircle(320, 380, 60 + i * 38);
    this.add.ellipse(320, 640, 300, 36, 0x000000, 0.35);
    const hero = fitImage(this.add.image(320, 640, `char_${c.id}`).setOrigin(0.5, 1), 360, 480);
    this.tweens.add({ targets: hero, y: 632, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    // 머리줄
    text(this, W / 2, 52, '캐릭터 정보', 30, COLORS.inkDim, true).setOrigin(0.5);
    button(this, 120, 52, 180, 64, '← 목록', () => this.scene.start('Characters'), 0xdfe6f5, 24);
    const i = characterIndex(c.id);
    text(this, W - 40, 52, `${i + 1} / ${characters.length}`, 22, COLORS.inkDim).setOrigin(1, 0.5);

    // 앞뒤 캐릭터
    if (characters.length > 1) {
      button(this, 60, 380, 72, 72, '◀', () => this.go(-1), 0xffffff, 30);
      button(this, 580, 380, 72, 72, '▶', () => this.go(1), 0xffffff, 30);
    }

    this.buildPanel(c, r, selected);

    // 오른쪽 아래 [선택하기]
    const owned = saveStore.ownsCharacter(c.id);
    const pick = button(this, 1090, 674, 300, 80, !owned ? '미보유' : selected ? '선택 중' : '선택하기', () => this.pick(), COLORS.accent, 34);
    if (selected || !owned) pick.setEnabled(false);
    if (!owned) button(this, 780, 674, 240, 80, '뽑으러 가기', () => this.scene.start('Gacha', { mode: 'character' }), 0xdfe6f5, 26);

    this.input.keyboard?.on('keydown', (ev: KeyboardEvent) => {
      if (ev.code === 'Escape' || ev.code === 'Backspace') this.scene.start('Characters');
      if (ev.code === 'ArrowLeft' || ev.code === 'KeyA') this.go(-1);
      if (ev.code === 'ArrowRight' || ev.code === 'KeyD') this.go(1);
      if (ev.code === 'Enter' || ev.code === 'Space') this.pick();
    });
  }

  private buildPanel(c: ReturnType<typeof characterById>, r: (typeof RARITY)[keyof typeof RARITY], selected: boolean): void {
    const { x, y, w, h } = PANEL;
    const g = this.add.graphics();
    g.fillStyle(0xffffff, 0.97).fillRoundedRect(x, y, w, h, 20);
    g.fillStyle(r.color, 1).fillRoundedRect(x, y, w, 10, { tl: 20, tr: 20, bl: 0, br: 0 });

    const left = x + 36;
    const inner = w - 72;
    text(this, left, y + 34, c.name, 46, '#1a1a2e', true);
    // 등급 배지
    const badge = this.add.graphics();
    badge.fillStyle(r.color, 1).fillRoundedRect(left, y + 98, 86, 32, 16);
    text(this, left + 43, y + 114, r.label, 18, '#ffffff', true).setOrigin(0.5);
    if (selected) {
      badge.fillStyle(COLORS.accent, 1).fillRoundedRect(left + 98, y + 98, 96, 32, 16);
      text(this, left + 146, y + 114, '선택 중', 18, '#1a1a2e', true).setOrigin(0.5);
    }
    text(this, left, y + 146, c.tagline, 21, '#4a5068').setWordWrapWidth(inner, true);

    g.fillStyle(0xe3e6ef, 1).fillRect(left, y + 190, inner, 2);

    // 능력 목록: 소능력·대능력 (없으면 '능력 없음')
    let cy = y + 204;
    if (c.abilities.length === 0) {
      text(this, left, cy, '능력 없음', 26, '#1a1a2e', true);
      text(this, left, cy + 38, '점프와 슬라이드만으로 승부해요.', 18, '#4a5068');
      cy += 76;
    }
    for (const a of c.abilities) {
      const pill = this.add.graphics();
      pill.fillStyle(a.kind === 'ultimate' ? COLORS.accent : 0x4a90e2, 1).fillRoundedRect(left, cy + 2, 68, 28, 14);
      text(this, left + 34, cy + 16, ABILITY_LABEL[a.kind], 15, a.kind === 'ultimate' ? '#1a1a2e' : '#ffffff', true).setOrigin(0.5);
      text(this, left + 82, cy, a.name, 24, '#1a1a2e', true);
      const desc = text(this, left, cy + 36, a.description, 17, '#33384d').setWordWrapWidth(inner, true).setLineSpacing(3);
      cy += 36 + desc.height;
      if (!a.active) {
        text(this, left, cy + 4, '준비 중 (아직 게임에 적용되지 않음)', 14, '#a0a6ba');
        cy += 22;
      }
      cy += 14;
    }

    g.fillStyle(0xe3e6ef, 1).fillRect(left, cy, inner, 2);

    // 소개
    text(this, left, cy + 12, '소개', 18, '#8a90a8', true);
    text(this, left, cy + 38, c.story, 18, '#33384d').setWordWrapWidth(inner, true).setLineSpacing(4);
  }

  private go(dir: 1 | -1): void {
    const n = characters.length;
    const next = characters[(characterIndex(this.id) + dir + n) % n];
    this.scene.restart({ id: next.id });
  }

  private pick(): void {
    if (this.id === saveStore.data.selectedCharacter || !saveStore.ownsCharacter(this.id)) return;
    saveStore.setCharacter(this.id);
    this.scene.start('Lobby');
  }
}
