import Phaser from 'phaser';
import { ECONOMY } from '../config/economy';
import { ABILITY_LABEL, characterById, RARITY } from '../data/characters';
import { describeEffect, equipmentById, modsFor } from '../data/equipment';
import { stageTitle } from '../data/episodes';
import { stageOrder, stages } from '../data/stages';
import { saveStore } from '../save/store';
import { button, COLORS, panel, rarityPill, text, topBar } from '../ui/style';
import { fitImage } from './CharacterListScene';

const W = 1280;
const H = 720;

/**
 * 준비 화면: 스테이지를 고른 뒤 여기서 캐릭터와 장비(최대 3개)를 정하고 [게임 시작].
 * 캐릭터·장비를 누르면 고르는 화면으로 갔다가 다시 이 화면으로 돌아온다.
 */
export class ReadyScene extends Phaser.Scene {
  private stageId = '';

  constructor() {
    super('Ready');
  }

  init(data: { stageId: string }): void {
    this.stageId = data?.stageId ?? stageOrder[0];
  }

  create(): void {
    this.add.tileSprite(0, 0, W, H, 'bg_far').setOrigin(0);
    this.add.tileSprite(0, 0, W, H, 'bg_mid').setOrigin(0).setAlpha(0.6);
    this.add.rectangle(0, 0, W, H, COLORS.panel, 0.35).setOrigin(0);
    topBar(this, stageTitle(this.stageId), () => this.back(), saveStore.data.coins);

    this.buildCharacter();
    this.buildEquipment();
    this.buildStageInfo();

    button(this, 1060, 640, 380, 110, '게임 시작 ▶', () => this.start(), COLORS.green, 42);

    this.input.keyboard?.on('keydown', (ev: KeyboardEvent) => {
      if (ev.code === 'Enter' || ev.code === 'Space') this.start();
      if (ev.code === 'Escape' || ev.code === 'Backspace') this.back();
      if (ev.code === 'KeyC') this.pickCharacter();
      if (ev.code === 'KeyE') this.pickEquipment();
    });
  }

  // ───────── 캐릭터 (왼쪽) ─────────

  private buildCharacter(): void {
    const c = characterById(saveStore.data.selectedCharacter);
    const r = RARITY[c.rarity];
    panel(this, 40, 140, 400, 470, '캐릭터', COLORS.yellow);
    // 등급 색 배경 + 캐릭터
    const g = this.add.graphics();
    g.fillStyle(r.color, 0.3).fillRoundedRect(64, 170, 352, 250, 16);
    for (let i = 4; i >= 1; i--) g.fillStyle(0xffffff, 0.08 * (5 - i)).fillCircle(240, 300, 40 + i * 24);
    const hero = fitImage(this.add.image(240, 418, `char_${c.id}`).setOrigin(0.5, 1), 200, 240);
    this.tweens.add({ targets: hero, y: 412, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    text(this, 240, 446, c.name, 30, '#4a3520', true).setOrigin(0.5);
    rarityPill(this, 240, 484, r.label, r.color, 15);
    const abil = c.abilities.length ? c.abilities.map((a) => `${ABILITY_LABEL[a.kind]} ${a.name}`).join('  ·  ') : '능력 없음';
    text(this, 240, 516, abil, 16, '#7a6048').setOrigin(0.5).setWordWrapWidth(360, true).setAlign('center');
    button(this, 240, 572, 220, 60, '캐릭터 변경', () => this.pickCharacter(), COLORS.yellow, 22);
    // 그림을 눌러도 변경
    this.add.zone(240, 300, 352, 250).setInteractive({ useHandCursor: true }).on('pointerup', () => this.pickCharacter());
  }

  // ───────── 장비 3칸 (오른쪽 위) ─────────

  private buildEquipment(): void {
    const eq = saveStore.data.equipment.equipped;
    panel(this, 470, 140, 770, 290, `장비  ${eq.length} / ${ECONOMY.equipSlots}`, COLORS.green);
    const slotW = 230;
    const slotH = 170;
    for (let i = 0; i < ECONOMY.equipSlots; i++) {
      const x = 500 + slotW / 2 + i * (slotW + 25);
      const y = 178 + slotH / 2;
      const e = eq[i] ? equipmentById(eq[i]) : undefined;
      const g = this.add.graphics();
      if (e) {
        const r = RARITY[e.rarity];
        g.fillStyle(0xffffff, 1).fillRoundedRect(x - slotW / 2, y - slotH / 2, slotW, slotH, 16);
        g.fillStyle(r.color, 0.25).fillRoundedRect(x - slotW / 2 + 6, y - slotH / 2 + 6, slotW - 12, 44, 12);
        g.lineStyle(4, r.color, 1).strokeRoundedRect(x - slotW / 2, y - slotH / 2, slotW, slotH, 16);
        text(this, x, y - slotH / 2 + 28, r.label, 15, r.css, true).setOrigin(0.5);
        text(this, x, y - 16, e.name, 22, '#4a3520', true).setOrigin(0.5);
        text(this, x, y + 30, describeEffect(e.effect).join('\n'), 15, '#7a6048').setOrigin(0.5).setAlign('center').setWordWrapWidth(slotW - 20, true);
      } else {
        g.fillStyle(0xe9dcc0, 1).fillRoundedRect(x - slotW / 2, y - slotH / 2, slotW, slotH, 16);
        g.lineStyle(3, 0xc9b48c, 1).strokeRoundedRect(x - slotW / 2, y - slotH / 2, slotW, slotH, 16);
        g.fillStyle(0xc9b48c, 1).fillRoundedRect(x - 6, y - 34, 12, 52, 6).fillRoundedRect(x - 26, y - 14, 52, 12, 6);
        text(this, x, y + 46, '빈 슬롯', 17, '#a08a68', true).setOrigin(0.5);
      }
      this.add.zone(x, y, slotW, slotH).setInteractive({ useHandCursor: true }).on('pointerup', () => this.pickEquipment());
    }
    const total = describeEffect(modsFor(eq));
    text(this, 500, 392, eq.length ? `효과 합계: ${total.join(' · ')}` : '슬롯을 눌러 장비를 고르세요', 16, '#7a6048')
      .setWordWrapWidth(710, true)
      .setOrigin(0, 0.5);
  }

  // ───────── 스테이지 정보 (오른쪽 아래) ─────────

  private buildStageInfo(): void {
    const rec = saveStore.record(this.stageId);
    const stage = stages[this.stageId];
    panel(this, 470, 460, 400, 150, '기록', COLORS.blue);
    text(this, 670, 512, '★'.repeat(rec.bestStars) + '☆'.repeat(3 - rec.bestStars), 38, '#f5a623').setOrigin(0.5).setStroke('#8a5a00', 3);
    text(this, 670, 560, rec.bestScore ? `최고 ${rec.bestScore.toLocaleString()}점` : '아직 기록 없음', 20, '#4a3520', true).setOrigin(0.5);
    if (stage) {
      const km = Math.round(stage.length / 100) / 10;
      text(this, 670, 590, `길이 ${km}k  ·  ${rec.cleared ? '클리어함' : '도전 중'}`, 15, '#7a6048').setOrigin(0.5);
    }
  }

  private pickCharacter(): void {
    this.scene.start('Characters', { mode: 'pick', stageId: this.stageId });
  }

  private pickEquipment(): void {
    this.scene.start('Equipment', { mode: 'pick', stageId: this.stageId });
  }

  private back(): void {
    this.scene.start('Lobby', { openStages: true });
  }

  private start(): void {
    this.scene.start('Game', { stageId: this.stageId });
  }
}
