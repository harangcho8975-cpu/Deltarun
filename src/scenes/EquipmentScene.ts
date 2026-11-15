import Phaser from 'phaser';
import { ECONOMY } from '../config/economy';
import { RARITY } from '../data/characters';
import { describeEffect, equipment, equipmentById, type Equipment } from '../data/equipment';
import { saveStore } from '../save/store';
import { button, COLORS, text } from '../ui/style';

const W = 1280;
const H = 720;
const SLOT_W = 380;
const SLOT_H = 130;
const SLOT_Y = 205;
const CARD_W = 232;
const CARD_H = 116;
const CARD_GAP = 12;
const COLS = 5;
const GRID_TOP = 316;

/**
 * 장비 화면: 위쪽에 장착 슬롯 3개, 아래쪽에 모든 장비(가진 것은 밝게, 못 가진 것은 어둡게).
 * 가진 장비를 누르면 장착·해제되고, 슬롯을 누르면 해제된다. 슬롯이 가득 차면 장착되지 않는다.
 */
export class EquipmentScene extends Phaser.Scene {
  constructor() {
    super('Equipment');
  }

  create(data?: { toast?: string }): void {
    this.add.tileSprite(0, 0, W, H, 'bg_far').setOrigin(0);
    this.add.rectangle(0, 0, W, H, COLORS.panel, 0.82).setOrigin(0);

    const eq = saveStore.data.equipment;
    const owned = equipment.filter((e) => eq.owned[e.id]).length;

    // 머리줄
    button(this, 120, 52, 180, 64, '← 로비', () => this.scene.start('Lobby'), 0xdfe6f5, 24);
    text(this, 640, 52, '장비', 40, '#ffffff', true).setOrigin(0.5);
    text(this, 1230, 36, `코인 ${saveStore.data.coins.toLocaleString()}`, 24, '#ffd23f', true).setOrigin(1, 0.5);
    button(this, 1110, 84, 220, 52, '장비 뽑기 →', () => this.scene.start('Gacha'), COLORS.accent, 22);

    // 장착 슬롯
    text(this, 40, 100, `장착 중  ${eq.equipped.length} / ${ECONOMY.equipSlots}`, 22, '#ffffff', true);
    for (let i = 0; i < ECONOMY.equipSlots; i++) {
      const id = eq.equipped[i];
      this.slot(40 + SLOT_W / 2 + i * (SLOT_W + 30), SLOT_Y, id ? equipmentById(id) : undefined);
    }

    // 보유 장비
    text(this, 40, 292, `장비 목록  ${owned} / ${equipment.length}`, 22, '#ffffff', true).setOrigin(0, 0.5);
    equipment.forEach((e, i) => {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const x = 36 + CARD_W / 2 + col * (CARD_W + CARD_GAP);
      const y = GRID_TOP + CARD_H / 2 + row * (CARD_H + CARD_GAP);
      this.card(x, y, e);
    });

    if (data?.toast) {
      const t = text(this, 1240, 292, data.toast, 20, '#ffb3b3', true).setOrigin(1, 0.5);
      this.tweens.add({ targets: t, alpha: 0, delay: 1400, duration: 500 });
    }

    this.input.keyboard?.on('keydown', (ev: KeyboardEvent) => {
      if (ev.code === 'Escape' || ev.code === 'Backspace') this.scene.start('Lobby');
      if (ev.code === 'KeyG') this.scene.start('Gacha');
    });
  }

  private slot(x: number, y: number, e?: Equipment): void {
    const g = this.add.graphics();
    const r = e ? RARITY[e.rarity] : undefined;
    g.fillStyle(e ? 0xffffff : 0x2a2f45, e ? 0.96 : 0.85).fillRoundedRect(x - SLOT_W / 2, y - SLOT_H / 2, SLOT_W, SLOT_H, 16);
    g.lineStyle(4, r ? r.color : 0x4a5068, 1).strokeRoundedRect(x - SLOT_W / 2, y - SLOT_H / 2, SLOT_W, SLOT_H, 16);
    if (!e) {
      text(this, x, y - 10, '빈 슬롯', 26, '#8a90a8', true).setOrigin(0.5);
      text(this, x, y + 24, '아래 장비를 눌러 장착', 16, '#6b7190').setOrigin(0.5);
      return;
    }
    text(this, x - SLOT_W / 2 + 18, y - SLOT_H / 2 + 14, e.name, 26, '#1a1a2e', true);
    text(this, x - SLOT_W / 2 + 18, y - SLOT_H / 2 + 50, RARITY[e.rarity].label, 16, RARITY[e.rarity].css, true);
    text(this, x - SLOT_W / 2 + 18, y - SLOT_H / 2 + 74, describeEffect(e.effect).join('\n'), 17, '#33384d').setWordWrapWidth(SLOT_W - 36, true);
    text(this, x + SLOT_W / 2 - 16, y - SLOT_H / 2 + 16, '눌러서 해제', 14, '#8a90a8').setOrigin(1, 0);
    this.add.zone(x, y, SLOT_W, SLOT_H).setInteractive({ useHandCursor: true }).on('pointerup', () => this.toggle(e.id));
  }

  private card(x: number, y: number, e: Equipment): void {
    const eq = saveStore.data.equipment;
    const count = eq.owned[e.id] ?? 0;
    const have = count > 0;
    const on = eq.equipped.includes(e.id);
    const r = RARITY[e.rarity];

    const g = this.add.graphics();
    g.fillStyle(have ? 0xffffff : 0x333851, have ? 0.95 : 0.7).fillRoundedRect(x - CARD_W / 2, y - CARD_H / 2, CARD_W, CARD_H, 12);
    g.lineStyle(on ? 6 : 3, on ? COLORS.accent : have ? r.color : 0x4a5068, 1).strokeRoundedRect(x - CARD_W / 2, y - CARD_H / 2, CARD_W, CARD_H, 12);

    const left = x - CARD_W / 2 + 12;
    if (!have) {
      text(this, left, y - CARD_H / 2 + 12, '???', 22, '#8a90a8', true);
      text(this, left, y - CARD_H / 2 + 42, r.label, 14, r.css, true).setAlpha(0.6);
      text(this, left, y - CARD_H / 2 + 66, '아직 얻지 못했어요', 14, '#8a90a8');
      return;
    }
    text(this, left, y - CARD_H / 2 + 10, e.name, 20, '#1a1a2e', true);
    text(this, left, y - CARD_H / 2 + 36, r.label, 13, r.css, true);
    text(this, left, y - CARD_H / 2 + 56, describeEffect(e.effect).join('\n'), 14, '#33384d').setWordWrapWidth(CARD_W - 24, true);
    if (count > 1) text(this, x + CARD_W / 2 - 10, y - CARD_H / 2 + 10, `×${count}`, 16, '#4a5068', true).setOrigin(1, 0);
    if (on) {
      const tag = this.add.graphics();
      tag.fillStyle(COLORS.accent, 1).fillRoundedRect(x + CARD_W / 2 - 66, y + CARD_H / 2 - 32, 56, 22, 11);
      text(this, x + CARD_W / 2 - 38, y + CARD_H / 2 - 21, '장착', 13, '#1a1a2e', true).setOrigin(0.5);
    }
    this.add.zone(x, y, CARD_W, CARD_H).setInteractive({ useHandCursor: true }).on('pointerup', () => this.toggle(e.id));
  }

  private toggle(id: string): void {
    const result = saveStore.toggleEquip(id);
    this.scene.restart({ toast: result === 'full' ? `슬롯이 가득 찼어요 (최대 ${ECONOMY.equipSlots}개)` : undefined });
  }
}
