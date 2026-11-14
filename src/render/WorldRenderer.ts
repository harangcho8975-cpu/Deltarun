import Phaser from 'phaser';
import { gameConfig as cfg } from '../config/gameConfig';
import type { StageData } from '../data/schema';
import { playerBox } from '../sim/collision';
import { ultimateBox } from '../sim/skills';
import type { Entity, EntityKind, SimEvent, SimState } from '../sim/types';
import { activeCharacter } from '../ui/activeCharacter';
import { FONT } from '../ui/style';
import { ANIM_PREFIX } from './assets';

const W = 1280;
const H = 720;
const PARALLAX = [0.1, 0.3, 0.6];
const GROUND_TILE = 64;

const isCentered = (k: EntityKind) => !k.startsWith('obstacle_');

/** 키별 스프라이트 풀. 플레이 중에는 새 객체를 만들지 않고 빌려 쓰고 돌려준다. */
class SpritePool {
  private free = new Map<string, Phaser.GameObjects.Sprite[]>();
  constructor(private scene: Phaser.Scene, private depth: number) {}

  prewarm(key: string, n: number): void {
    for (let i = 0; i < n; i++) this.release(this.make(key));
  }

  private make(key: string): Phaser.GameObjects.Sprite {
    const s = this.scene.add.sprite(-1000, -1000, key).setDepth(this.depth);
    s.setData('poolKey', key);
    return s;
  }

  acquire(key: string): Phaser.GameObjects.Sprite {
    const list = this.free.get(key);
    const s = list?.pop() ?? this.make(key);
    return s.setActive(true).setVisible(true);
  }

  release(s: Phaser.GameObjects.Sprite): void {
    s.setActive(false).setVisible(false).setPosition(-1000, -1000).setAlpha(1).setAngle(0).setScale(1);
    const key = s.getData('poolKey') as string;
    if (!this.free.has(key)) this.free.set(key, []);
    this.free.get(key)!.push(s);
  }
}

/** 월드 좌표로 움직이는 연출용 코인: 튀어나와 → 떨어져 → 바닥에서 살짝 튕기고 → 멈췄다가 사라진다 */
interface CoinParticle {
  img: Phaser.GameObjects.Image;
  active: boolean;
  wx: number;
  wy: number;
  vx: number;
  vy: number;
  delayMs: number;
  settled: boolean;
  restMs: number;
  bounces: number;
}

const COIN_FX_MAX = 80;
const COIN_FX_SIZE = 36;
const COIN_GRAVITY = 2600;
const COIN_BOUNCE = 0.42; // 바닥에 닿을 때 남는 속도 비율 (작을수록 덜 튕김)
const COIN_FLOOR = cfg.groundY - COIN_FX_SIZE / 2;

export interface RenderSnapshot {
  cameraX: number;
  playerY: number;
}

export class WorldRenderer {
  private bg: Phaser.GameObjects.TileSprite[];
  private groundTiles: Phaser.GameObjects.TileSprite[] = [];
  private pool: SpritePool;
  private live = new Map<number, Phaser.GameObjects.Sprite>();
  private seen = new Set<number>();
  private player: Phaser.GameObjects.Sprite;
  private goal: Phaser.GameObjects.Graphics;
  private fxPool: Phaser.GameObjects.Image[] = [];
  private flash: Phaser.GameObjects.Rectangle;
  private chaosBox!: Phaser.GameObjects.Image;
  private chaosLabel!: Phaser.GameObjects.Text;
  /** 대능력이 끝날 때 상자에서 튀어나오는 코인 (연출 전용: 코인 지급은 시뮬레이션이 이미 했다) */
  private coinFx: CoinParticle[] = [];
  private debugGfx: Phaser.GameObjects.Graphics | null = null;
  private playerAnim = '';
  renderCameraX = 0;

  constructor(private scene: Phaser.Scene, private stage: StageData, debug: boolean) {
    this.bg = stage.background.map((key, i) =>
      scene.add.tileSprite(0, 0, W, H, key).setOrigin(0).setDepth(i).setScrollFactor(0),
    );
    for (let i = 0; i < 6; i++) {
      this.groundTiles.push(
        scene.add.tileSprite(0, cfg.groundY, GROUND_TILE, H - cfg.groundY, 'ground_tile').setOrigin(0).setDepth(5).setVisible(false),
      );
    }
    this.goal = scene.add.graphics().setDepth(6);
    this.drawGoal();
    this.pool = new SpritePool(scene, 10);
    // 화면에 동시에 보일 만큼 미리 만들어 둔다
    const counts: Record<string, number> = { jelly_normal: 70, jelly_big: 6, coin: 8, obstacle_low: 4, obstacle_high: 4, obstacle_air: 4 };
    for (const [k, n] of Object.entries(counts)) this.pool.prewarm(k, n);
    for (const k of ['item_heal', 'item_magnet', 'item_giant', 'item_boost']) this.pool.prewarm(k, 2);

    this.player = scene.add.sprite(0, 0, 'player_run').setOrigin(0.5, 1).setDepth(20);
    for (let i = 0; i < 24; i++) this.fxPool.push(scene.add.image(-1000, -1000, 'jelly_normal').setDepth(30).setVisible(false));
    this.flash = scene.add.rectangle(0, 0, W, H, 0xff0000, 0).setOrigin(0).setDepth(40);
    for (let i = 0; i < COIN_FX_MAX; i++) {
      const img = scene.add.image(-1000, -1000, 'coin').setDisplaySize(COIN_FX_SIZE, COIN_FX_SIZE).setDepth(31).setVisible(false);
      this.coinFx.push({ img, active: false, wx: 0, wy: 0, vx: 0, vy: 0, delayMs: 0, settled: false, restMs: 0, bounces: 0 });
    }
    // 카오스 킹 대능력 박스 (그림 자리: fx_chaos_box)와 쌓인 코인 표시
    this.chaosBox = scene.add.image(0, 0, 'fx_chaos_box').setOrigin(0, 1).setDepth(24).setVisible(false);
    this.chaosLabel = scene.add
      .text(0, 0, '', { fontFamily: FONT, fontSize: '44px', color: '#ffd23f', fontStyle: 'bold' })
      .setResolution(2)
      .setOrigin(0.5)
      .setStroke('#1a1a2e', 8)
      .setDepth(25)
      .setVisible(false);
    if (debug) this.debugGfx = scene.add.graphics().setDepth(50);
  }

  private drawGoal(): void {
    // 결승선: 체크무늬 기둥 (월드 좌표 → sync에서 x 이동)
    const g = this.goal;
    g.clear();
    for (let i = 0; i < 12; i++) {
      g.fillStyle(i % 2 ? 0xffffff : 0x222222, 1).fillRect(0, cfg.groundY - 300 + i * 25, 16, 25);
      g.fillStyle(i % 2 ? 0x222222 : 0xffffff, 1).fillRect(16, cfg.groundY - 300 + i * 25, 16, 25);
    }
  }

  sync(s: SimState, prev: RenderSnapshot, alpha: number): void {
    const cam = prev.cameraX + (s.cameraX - prev.cameraX) * alpha;
    this.renderCameraX = cam;
    const py = prev.playerY + (s.player.y - prev.playerY) * alpha;

    this.bg.forEach((t, i) => (t.tilePositionX = cam * PARALLAX[i]));

    // 바닥: 보이는 구간만 잘라 그리고, 무늬는 월드 좌표에 고정
    let gi = 0;
    for (const [a, b] of this.stage.ground) {
      if (b < cam || a > cam + W) continue;
      const t = this.groundTiles[gi++];
      if (!t) break;
      const vx = Math.max(a, cam);
      const vEnd = Math.min(b, cam + W);
      t.setVisible(true).setPosition(vx - cam, cfg.groundY).setSize(vEnd - vx, H - cfg.groundY);
      t.tilePositionX = vx - a;
    }
    for (; gi < this.groundTiles.length; gi++) this.groundTiles[gi].setVisible(false);

    this.goal.setPosition(this.stage.goalX - cam - 16, 0);

    // 엔티티
    this.seen.clear();
    const ents = s.entities;
    for (let i = s.cursor; i < ents.length; i++) {
      const e = ents[i];
      if (e.x > cam + W + 64) break;
      if (!e.alive || e.x + e.w < cam - 64) continue;
      this.seen.add(e.id);
      let spr = this.live.get(e.id);
      if (!spr) {
        spr = this.pool.acquire(e.kind);
        spr.setOrigin(0.5, isCentered(e.kind) ? 0.5 : 1);
        this.live.set(e.id, spr);
      }
      const x = e.x + e.w / 2 - cam;
      spr.setPosition(x, isCentered(e.kind) ? e.y - e.h / 2 : e.y);
      if (e.kind.startsWith('item_')) spr.setScale(1 + 0.08 * Math.sin((s.tick + e.id * 7) / 6));
    }
    for (const [id, spr] of this.live) {
      if (!this.seen.has(id)) {
        this.pool.release(spr);
        this.live.delete(id);
      }
    }

    this.syncPlayer(s, py);
    this.syncBox(s, cam);
    if (this.debugGfx) this.drawDebug(s, cam);
  }

  private syncPlayer(s: SimState, y: number): void {
    const p = s.player;
    const hitRecently = p.invulnTicks > cfg.invulnTicksOnHit - 20 && s.effects.giant === 0 && s.effects.boost === 0;
    let pose = 'run';
    if (p.state === 'jump' || p.state === 'doubleJump' || p.state === 'fall') pose = 'jump';
    else if (p.state === 'slide') pose = 'slide';
    if (hitRecently || p.state === 'dead') pose = 'hit';
    const key = this.spriteKey(pose);
    const anim = ANIM_PREFIX + key;
    if (anim !== this.playerAnim) {
      this.player.play(anim);
      this.playerAnim = anim;
    }
    const footX = p.x + cfg.hitbox.run.w / 2 - s.cameraX;
    this.player.setPosition(footX, y);
    this.player.setScale(s.effects.giant > 0 ? cfg.hitbox.giantScale : 1);
    this.player.setVisible(p.invulnTicks === 0 || Math.floor(p.invulnTicks / 8) % 2 === 0);
    this.player.setTint(s.effects.boost > 0 ? 0x9ff3ff : 0xffffff);
  }

  /** 선택한 캐릭터 전용 스프라이트(<id>_<포즈>)가 있으면 그것, 없으면 공용 player_<포즈> */
  private spriteKey(pose: string): string {
    const own = `${activeCharacter().id}_${pose}`;
    return this.scene.textures.exists(own) ? own : `player_${pose}`;
  }

  /** 대능력 박스: 오른쪽에서 위아래로 움직이며, 쌓인 코인을 박스 안에 보여 준다 */
  private syncBox(s: SimState, cam: number): void {
    const b = ultimateBox(s);
    this.chaosBox.setVisible(!!b);
    this.chaosLabel.setVisible(!!b);
    if (!b) return;
    this.chaosBox.setPosition(b.x - cam, b.y).setDisplaySize(b.w, b.h);
    this.chaosLabel.setPosition(b.x - cam + b.w / 2, b.y - b.h / 2).setText(`+${s.skill!.boxCoins}`);
  }

  private drawDebug(s: SimState, cam: number): void {
    const g = this.debugGfx!;
    g.clear().lineStyle(2, 0xff0000, 1);
    const pb = playerBox(s);
    g.strokeRect(pb.x - cam, pb.y - pb.h, pb.w, pb.h);
    for (const [id] of this.live) {
      const e: Entity = s.entities[id];
      g.strokeRect(e.x - cam, e.y - e.h, e.w, e.h);
    }
  }

  /** 시뮬레이션 이벤트 → 연출 (렌더링 쪽 랜덤 허용) */
  fx(s: SimState, ev: SimEvent): void {
    const cam = this.renderCameraX;
    switch (ev.type) {
      case 'collect': {
        const e = s.entities[ev.id];
        this.burst(ev.kind, e.x + e.w / 2 - cam, e.y - e.h / 2, 'up');
        break;
      }
      case 'item': {
        const e = s.entities[ev.id];
        this.burst(ev.kind, e.x + e.w / 2 - cam, e.y - e.h / 2, 'pop');
        break;
      }
      case 'smash': {
        const e = s.entities[ev.id];
        this.burst(e.kind, e.x + e.w / 2 - cam, e.y - e.h / 2, 'fly');
        this.scene.cameras.main.shake(80, 0.004);
        break;
      }
      case 'hit':
        this.scene.cameras.main.shake(160, 0.01);
        this.flash.setFillStyle(0xff0000, 0.25);
        this.scene.tweens.add({ targets: this.flash, fillAlpha: 0, duration: 250 });
        break;
      case 'skillMinor': {
        // 화면 전체가 하얗게 번쩍이고 충격파가 퍼진다
        this.flash.setFillStyle(0xffffff, 0.4);
        this.scene.tweens.add({ targets: this.flash, fillAlpha: 0, duration: 260 });
        this.scene.cameras.main.shake(140, 0.007);
        this.shockwave(0xffffff);
        break;
      }
      case 'ultimateStart':
        this.flash.setFillStyle(0xa66cff, 0.45);
        this.scene.tweens.add({ targets: this.flash, fillAlpha: 0, duration: 400 });
        this.scene.cameras.main.shake(220, 0.009);
        break;
      case 'boxHit': {
        const e = s.entities[ev.id];
        this.burst('coin', e.x + e.w / 2 - cam, e.y - e.h / 2, 'up');
        break;
      }
      case 'ultimateEnd': {
        // 박스가 폭발하며 모인 코인이 사방으로 쏟아진다
        this.flash.setFillStyle(0xffb347, 0.5);
        this.scene.tweens.add({ targets: this.flash, fillAlpha: 0, duration: 450 });
        this.scene.cameras.main.shake(260, 0.012);
        this.shockwave(0xffd23f, ev.x - cam, ev.y);
        this.spawnCoinShower(ev.x, ev.y, ev.coins);
        break;
      }
      default:
        break;
    }
  }

  /** 상자 안에서 코인이 하나씩 튀어나온다. 많이 쌓였을수록 많이 (최대 80개) */
  private spawnCoinShower(wx: number, wy: number, coins: number): void {
    const n = Math.min(COIN_FX_MAX, Math.max(8, Math.ceil(coins / 3)));
    const free = this.coinFx.filter((p) => !p.active);
    for (let i = 0; i < Math.min(n, free.length); i++) {
      const p = free[i];
      const r = (a: number, b: number) => a + Math.random() * (b - a);
      p.active = true;
      p.settled = false;
      p.restMs = 0;
      p.bounces = 0;
      p.wx = wx + r(-this.boxHalfW() * 0.6, this.boxHalfW() * 0.6);
      p.wy = wy + r(-50, 50);
      p.vx = r(-300, 300);
      p.vy = r(-1000, -500); // 위로 튀어 오른 뒤 떨어진다
      p.delayMs = r(0, 380); // 한꺼번에가 아니라 하나씩 튀어나오는 느낌
      p.img.setVisible(false).setAlpha(1);
    }
  }

  private boxHalfW(): number {
    return cfg.skills.chaosKing.box.w / 2;
  }

  /** 연출용 코인 움직임. 월드 좌표라 카메라가 움직이면 화면에서는 뒤로 흘러간다. */
  updateFx(dtMs: number): void {
    const dt = Math.min(dtMs, 50) / 1000;
    for (const p of this.coinFx) {
      if (!p.active) continue;
      if (p.delayMs > 0) {
        p.delayMs -= dtMs;
        continue;
      }
      if (!p.settled) {
        p.vy += COIN_GRAVITY * dt;
        p.wx += p.vx * dt;
        p.wy += p.vy * dt;
        p.img.angle += p.vx * dt * 0.8;
        if (p.wy >= COIN_FLOOR && p.vy > 0) {
          // 바닥에서 살짝 튕긴다: 속도가 줄어들며 두세 번 튀다가 멈춘다
          p.wy = COIN_FLOOR;
          p.bounces++;
          p.vy = -p.vy * COIN_BOUNCE;
          p.vx *= 0.6;
          if (Math.abs(p.vy) < 150) {
            p.vy = 0;
            p.vx = 0;
            p.settled = true;
            p.img.setAngle(0);
          }
        }
      } else {
        p.restMs += dtMs;
        if (p.restMs > 900) p.img.setAlpha(Math.max(0, 1 - (p.restMs - 900) / 500));
        if (p.restMs > 1400) {
          p.active = false;
          p.img.setVisible(false);
          continue;
        }
      }
      p.img.setVisible(true).setPosition(p.wx - this.renderCameraX, p.wy);
    }
  }

  private shockwave(color: number, x = W / 2, y = H / 2): void {
    const ring = this.scene.add.circle(x, y, 40).setStrokeStyle(10, color).setFillStyle(color, 0).setDepth(35);
    this.scene.tweens.add({ targets: ring, scale: 14, alpha: 0, duration: 420, ease: 'Cubic.easeOut', onComplete: () => ring.destroy() });
  }

  private burst(key: string, x: number, y: number, mode: 'up' | 'pop' | 'fly'): void {
    const img = this.fxPool.find((i) => !i.visible);
    if (!img) return;
    img.setTexture(key).setPosition(x, y).setVisible(true).setAlpha(1).setScale(1).setAngle(0);
    const done = () => img.setVisible(false);
    if (mode === 'up') {
      this.scene.tweens.add({ targets: img, y: y - 60, alpha: 0, scale: 0.6, duration: 260, onComplete: done });
    } else if (mode === 'pop') {
      this.scene.tweens.add({ targets: img, scale: 2.2, alpha: 0, duration: 350, onComplete: done });
    } else {
      this.scene.tweens.add({
        targets: img,
        x: x + 300 + Math.random() * 200,
        y: y - 300,
        angle: 360 + Math.random() * 180,
        alpha: 0,
        duration: 600,
        onComplete: done,
      });
    }
  }
}
