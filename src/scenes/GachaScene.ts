import Phaser from 'phaser';
import { ECONOMY } from '../config/economy';
import { characterById, RARITY, type Rarity } from '../data/characters';
import { describeEffect, equipmentById } from '../data/equipment';
import { type Banner, pullCharacters, ratesFor } from '../gacha/characterGacha';
import { pull, type PullOutcome, type PullResult } from '../gacha/gacha';
import { saveStore } from '../save/store';
import { button, COLORS, text, type Button } from '../ui/style';
import { fitImage } from './CharacterListScene';

const W = 1280;
const H = 720;
const pct = (x: number) => `${Math.round(x * 100)}%`;

export type GachaMode = 'equipment' | 'character';

/** 결과 카드에 그릴 내용 */
interface CardView {
  name: string;
  rarity: Rarity;
  lines: string[];
  portrait?: string;
}

function view(mode: GachaMode, id: string): CardView {
  if (mode === 'character') {
    const c = characterById(id);
    return { name: c.name, rarity: c.rarity, lines: [c.abilities.length ? c.abilities.map((a) => a.name).join(' · ') : '능력 없음'], portrait: `char_${c.id}` };
  }
  const e = equipmentById(id)!;
  return { name: e.name, rarity: e.rarity, lines: describeEffect(e.effect) };
}

/** 뽑기: 장비 / 캐릭터 탭. 코인으로 1회·10회 뽑고, 결과는 카드로 펼쳐진다. 처음 얻으면 NEW, 이미 있으면 코인 환급. */
export class GachaScene extends Phaser.Scene {
  private mode: GachaMode = 'equipment';
  private banner: Banner = 'normal';
  private results!: Phaser.GameObjects.Container;
  private coinText!: Phaser.GameObjects.Text;
  private hint!: Phaser.GameObjects.Text;
  private toastText!: Phaser.GameObjects.Text;
  private btn1!: Button;
  private btn10!: Button;

  constructor() {
    super('Gacha');
  }

  init(data?: { mode?: GachaMode; banner?: Banner }): void {
    this.mode = data?.mode ?? 'equipment';
    this.banner = this.mode === 'character' ? (data?.banner ?? 'normal') : 'normal';
  }

  private get costs() {
    return this.mode === 'character'
      ? { one: ECONOMY.charPullCost, ten: ECONOMY.charPull10Cost }
      : { one: ECONOMY.pullCost, ten: ECONOMY.pull10Cost };
  }

  create(): void {
    const ch = this.mode === 'character';
    this.add.tileSprite(0, 0, W, H, 'bg_far').setOrigin(0);
    this.add.rectangle(0, 0, W, H, COLORS.panel, 0.82).setOrigin(0);

    button(this, 120, 52, 180, 64, '← 로비', () => this.scene.start('Lobby'), 0xdfe6f5, 24);
    // 탭
    button(this, 470, 52, 200, 56, '장비 뽑기', () => this.scene.start('Gacha', { mode: 'equipment' }), ch ? 0xdfe6f5 : COLORS.accent, 24);
    button(this, 690, 52, 220, 56, '캐릭터 뽑기', () => this.scene.start('Gacha', { mode: 'character' }), ch ? COLORS.accent : 0xdfe6f5, 24);
    this.coinText = text(this, 1230, 36, '', 24, '#ffd23f', true).setOrigin(1, 0.5);
    button(this, 1110, 84, 220, 52, ch ? '← 캐릭터 보기' : '← 장비 보기', () => this.scene.start(ch ? 'Characters' : 'Equipment'), 0xdfe6f5, 22);

    const r = ch ? ratesFor(this.banner) : ECONOMY.rates;
    const label = ch && this.banner === 'pickup' ? '[픽업] ' : '';
    text(this, 640, 124, `${label}일반 ${pct(r.common)}  ·  레어 ${pct(r.rare)}  ·  에픽 ${pct(r.epic)}  ·  레전드 ${pct(r.legendary)}`, 20, ch && this.banner === 'pickup' ? '#ffd23f' : '#ffffff', true).setOrigin(0.5);
    const d = ch ? ECONOMY.charDuplicateRefund : ECONOMY.duplicateRefund;
    text(
      this,
      640,
      154,
      `10회 뽑기는 레어 이상이 1개 이상 나와요  ·  이미 가진 ${ch ? '캐릭터' : '장비'}는 코인으로 돌려받아요 (일반 ${d.common} · 레어 ${d.rare} · 에픽 ${d.epic} · 레전드 ${d.legendary})`,
      15,
      COLORS.inkDim,
    ).setOrigin(0.5);

    this.results = this.add.container(0, 0);
    this.hint = text(this, 640, 340, `아래 버튼으로 ${ch ? '캐릭터' : '장비'}를 뽑아 보세요`, 28, COLORS.inkDim).setOrigin(0.5);
    this.toastText = text(this, 640, 560, '', 22, '#ffb3b3', true).setOrigin(0.5);

    this.btn1 = button(this, 400, 640, 340, 84, `1회 뽑기  ${this.costs.one} 코인`, () => this.doPull(1), COLORS.accent, 28);
    this.btn10 = button(this, 880, 640, 340, 84, `10회 뽑기  ${this.costs.ten} 코인`, () => this.doPull(10), COLORS.accent, 28);
    this.refresh();

    this.input.keyboard?.on('keydown', (ev: KeyboardEvent) => {
      if (ev.code === 'Escape' || ev.code === 'Backspace') this.scene.start('Lobby');
      if (ev.code === 'Digit1') this.doPull(1);
      if (ev.code === 'Digit0') this.doPull(10);
      if (ev.code === 'Tab') {
        ev.preventDefault();
        this.scene.start('Gacha', { mode: ch ? 'equipment' : 'character' });
      }
    });
  }

  private refresh(): void {
    const c = saveStore.data.coins;
    this.coinText.setText(`코인 ${c.toLocaleString()}`);
    this.btn1.setEnabled(c >= this.costs.one);
    this.btn10.setEnabled(c >= this.costs.ten);
  }

  private doPull(count: 1 | 10): void {
    const out: PullOutcome = this.mode === 'character' ? pullCharacters(saveStore, count, this.banner) : pull(saveStore, count);
    if (!out.ok) {
      this.toastText.setText(`코인이 부족해요 (${out.need} 코인 필요)`).setAlpha(1);
      this.tweens.add({ targets: this.toastText, alpha: 0, delay: 1400, duration: 500 });
      return;
    }
    this.toastText.setAlpha(0);
    this.hint.setVisible(false);
    this.show(out.results);
    this.refresh();
  }

  /** 결과를 카드로 펼친다. 1개면 크게, 10개면 2줄 × 5개 */
  private show(list: PullResult[]): void {
    this.results.removeAll(true);
    const big = list.length === 1;
    const w = big ? 380 : 220;
    const h = big ? 300 : 150;
    const cols = big ? 1 : 5;
    const gap = 16;
    const startX = (W - (cols * w + (cols - 1) * gap)) / 2 + w / 2;
    const startY = big ? 190 + h / 2 : 200 + h / 2;
    list.forEach((res, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const card = this.resultCard(startX + col * (w + gap), startY + row * (h + gap), w, h, res, big);
      this.results.add(card);
      card.setScale(0);
      this.tweens.add({ targets: card, scale: 1, delay: i * 90, duration: 260, ease: 'Back.easeOut' });
    });
  }

  private resultCard(x: number, y: number, w: number, h: number, res: PullResult, big: boolean): Phaser.GameObjects.Container {
    const v = view(this.mode, res.id);
    const r = RARITY[v.rarity];
    const g = this.add.graphics();
    g.fillStyle(0xffffff, 0.97).fillRoundedRect(-w / 2, -h / 2, w, h, 14);
    g.fillStyle(r.color, 0.25).fillRoundedRect(-w / 2 + 6, -h / 2 + 6, w - 12, big ? 74 : 42, 10);
    g.lineStyle(big ? 6 : 4, r.color, 1).strokeRoundedRect(-w / 2, -h / 2, w, h, 14);
    const items: Phaser.GameObjects.GameObject[] = [
      g,
      text(this, 0, -h / 2 + (big ? 24 : 14), r.label, big ? 22 : 15, r.css, true).setOrigin(0.5, 0),
      text(this, 0, -h / 2 + (big ? 88 : 46), v.name, big ? 34 : 20, '#1a1a2e', true).setOrigin(0.5, 0),
      text(this, 0, -h / 2 + (big ? 140 : 78), v.lines.join('\n'), big ? 22 : 14, '#33384d')
        .setOrigin(0.5, 0)
        .setAlign('center')
        .setWordWrapWidth(w - 24, true),
    ];
    if (v.portrait && big) {
      // 큰 카드에는 캐릭터 그림을 오른쪽 위에 작게
      items.push(fitImage(this.add.image(w / 2 - 56, -h / 2 + 8, v.portrait).setOrigin(0.5, 0), 80, 100));
    }
    const tagY = h / 2 - (big ? 44 : 30);
    if (res.isNew) {
      const tag = this.add.graphics();
      tag.fillStyle(0x2ecc71, 1).fillRoundedRect(-44, tagY - 4, 88, big ? 36 : 26, 13);
      items.push(tag, text(this, 0, tagY + (big ? 14 : 9), 'NEW!', big ? 22 : 15, '#ffffff', true).setOrigin(0.5));
    } else {
      items.push(text(this, 0, tagY + (big ? 14 : 9), `중복  +${res.refund} 코인`, big ? 22 : 15, '#7a8099', true).setOrigin(0.5));
    }
    return this.add.container(x, y, items);
  }
}
