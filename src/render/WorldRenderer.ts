import Phaser from 'phaser';
import { gameConfig as cfg } from '../config/gameConfig';
import type { StageData } from '../data/schema';
import { playerBox } from '../sim/collision';
import { bigScytheY, jevilBoxPos, scytheBox } from '../sim/jevil';
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

/** id가 붙은 시뮬레이션 물체를 이미지로 그린다 (없어진 id는 숨겨 재사용) */
class IdImages {
  private scene!: Phaser.Scene;
  private key = '';
  private depth = 0;
  private live = new Map<number, Phaser.GameObjects.Image>();
  private free: Phaser.GameObjects.Image[] = [];

  init(scene: Phaser.Scene, key: string, depth: number): void {
    this.scene = scene;
    this.key = key;
    this.depth = depth;
  }

  sync(list: { id: number; x: number; y: number; angle?: number; alpha?: number }[]): void {
    const seen = new Set<number>();
    for (const o of list) {
      seen.add(o.id);
      let img = this.live.get(o.id);
      if (!img) {
        img = this.free.pop() ?? this.scene.add.image(0, 0, this.key).setDepth(this.depth);
        img.setVisible(true);
        this.live.set(o.id, img);
      }
      img.setPosition(o.x, o.y).setAngle(o.angle ?? 0).setAlpha(o.alpha ?? 1);
    }
    for (const [id, img] of this.live) {
      if (seen.has(id)) continue;
      img.setVisible(false);
      this.free.push(img);
      this.live.delete(id);
    }
  }
}

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
  /** 대능력이 끝난 뒤 떨어진 코인의 스프라이트 (위치·상태는 모두 시뮬레이션이 정한다) */
  private dropSprites = new Map<number, Phaser.GameObjects.Image>();
  private dropFree: Phaser.GameObjects.Image[] = [];
  /** 제빌: 상자·조각 (id별 이미지), 휘두르는 낫, 심판의 낫, 심판 섬광 */
  private jvBoxes = new IdImages();
  private jvShards = new IdImages();
  private scythe!: Phaser.GameObjects.Image;
  private bigScythe!: Phaser.GameObjects.Image;
  private whiteout!: Phaser.GameObjects.Rectangle;
  private debugGfx: Phaser.GameObjects.Graphics | null = null;
  private playerAnim = '';
  private hitFlashUntil = 0;
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
    // 카오스 킹 대능력 박스 (그림 자리: fx_chaos_box)와 쌓인 코인 표시
    this.chaosBox = scene.add.image(0, 0, 'fx_chaos_box').setOrigin(0, 1).setDepth(24).setVisible(false);
    this.chaosLabel = scene.add
      .text(0, 0, '', { fontFamily: FONT, fontSize: '44px', color: '#ffd23f', fontStyle: 'bold' })
      .setResolution(2)
      .setOrigin(0.5)
      .setStroke('#1a1a2e', 8)
      .setDepth(25)
      .setVisible(false);
    this.jvBoxes.init(scene, 'fx_jevil_box', 26);
    this.jvShards.init(scene, 'fx_jevil_shard', 27);
    this.scythe = scene.add.image(0, 0, 'fx_jevil_scythe').setOrigin(0, 0.5).setDepth(22).setVisible(false);
    this.bigScythe = scene.add.image(W / 2, 0, 'fx_jevil_bigscythe').setDepth(36).setVisible(false);
    this.whiteout = scene.add.rectangle(0, 0, W, H, 0xffffff, 0).setOrigin(0).setDepth(45);
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
    this.syncDrops(s, cam);
    this.syncJevil(s, cam);
    if (this.debugGfx) this.drawDebug(s, cam);
  }

  private syncPlayer(s: SimState, y: number): void {
    const p = s.player;
    // 피격 그림은 실제로 맞은 직후 20틱만 (무적이 길어져도 계속 빨갛게 보이지 않는다)
    const hitRecently = s.tick < this.hitFlashUntil && s.effects.giant === 0 && s.effects.boost === 0;
    let pose = 'run';
    if (p.state === 'jump' || p.state === 'doubleJump' || p.state === 'fall' || p.state === 'fly') pose = 'jump';
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
    const flying = p.state === 'fly';
    // 비행 중에는 올라가면 머리를 들고 내려가면 숙인다. 제빌 대능력 중에는 보라빛
    this.player.setAngle(flying ? Math.max(-25, Math.min(25, p.vy / 25)) : 0);
    this.player.setTint(s.effects.boost > 0 ? 0x9ff3ff : s.jevil && s.jevil.phase > 0 ? 0xe0b3ff : 0xffffff);
  }

  /** 제빌: 시뮬레이션 상태를 그대로 그린다 */
  private syncJevil(s: SimState, cam: number): void {
    const j = s.jevil;
    this.jvBoxes.sync(
      (j?.boxes ?? []).map((b) => {
        const pos = jevilBoxPos(b);
        return { id: b.id, x: pos.x, y: pos.y, angle: b.t * 15 };
      }),
    );
    this.jvShards.sync((j?.shards ?? []).map((x) => ({ id: x.id, x: x.x - cam, y: x.y, angle: x.life * 30, alpha: Math.min(1, x.life / 10) })));
    const sb = scytheBox(s);
    this.scythe.setVisible(!!sb);
    if (sb && j) {
      const k = 1 - j.swing / cfg.skills.jevil.scythe.swingTicks; // 0 → 1
      this.scythe.setPosition(sb.x - cam, sb.y - sb.h / 2).setAngle(-70 + 140 * k);
    }
    const by = bigScytheY(s);
    this.bigScythe.setVisible(by !== null);
    if (by !== null) this.bigScythe.setY(by);
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

  /** 대능력 뒤 떨어진 코인: 시뮬레이션의 위치를 그대로 그린다. 상자 안에서 기다리는 코인(delay)은 아직 보이지 않는다. */
  private syncDrops(s: SimState, cam: number): void {
    const seen = new Set<number>();
    for (const d of s.drops) {
      if (d.delay > 0) continue;
      seen.add(d.id);
      let img = this.dropSprites.get(d.id);
      if (!img) {
        img = this.dropFree.pop() ?? this.scene.add.image(0, 0, 'coin').setDisplaySize(32, 32).setDepth(31);
        img.setVisible(true).setAlpha(1);
        this.dropSprites.set(d.id, img);
      }
      // 날아다니는 동안은 빙글 돌고, 멈추면 똑바로 선다
      img.setPosition(d.x - cam, d.y).setAngle(d.settled ? 0 : (s.tick * 9 + d.id * 41) % 360);
    }
    for (const [id, img] of this.dropSprites) {
      if (!seen.has(id)) {
        img.setVisible(false);
        this.dropFree.push(img);
        this.dropSprites.delete(id);
      }
    }
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
        this.hitFlashUntil = s.tick + 20;
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
        break;
      }
      case 'jevilBurst':
        this.shockwave(0xe04ecf, ev.x - cam, ev.y);
        this.scene.cameras.main.shake(90, 0.005);
        break;
      case 'jevilPhase':
        if (ev.phase === 1) {
          this.flash.setFillStyle(0xa66cff, 0.45);
          this.scene.tweens.add({ targets: this.flash, fillAlpha: 0, duration: 400 });
        }
        break;
      case 'jevilJudgement':
        // 섬광이 화면을 덮는다
        this.whiteout.setFillStyle(0xffffff, 1);
        this.scene.tweens.add({ targets: this.whiteout, fillAlpha: 0, delay: 120, duration: 700 });
        this.scene.cameras.main.shake(300, 0.015);
        break;
      case 'dropCollect':
        this.burst('coin', ev.x - cam, ev.y, 'up');
        break;
      default:
        break;
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
