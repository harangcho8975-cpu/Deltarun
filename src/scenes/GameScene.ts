import Phaser from 'phaser';
import { TICK_MS } from '../config/gameConfig';
import { Sound } from '../audio/Sound';
import { validateStage, type StageData } from '../data/schema';
import { stages } from '../data/stages';
import testStage from '../data/stage_test.json';
import { DebugOverlay } from '../debug/DebugOverlay';
import { params } from '../debug/params';
import { InputController } from '../input/InputController';
import { WorldRenderer, type RenderSnapshot } from '../render/WorldRenderer';
import { createSim, ReplayRecorder, starsFor, step, totalScore, type SimEvent, type SimState } from '../sim';
import { fullscreen } from '../ui/fullscreen';
import { activeCharacter } from '../ui/activeCharacter';
import { text } from '../ui/style';

export interface RunResultData {
  stageId: string;
  outcome: 'cleared' | 'failed';
  failReason: 'hp' | 'fall' | null;
  jellyScore: number;
  distance: number;
  score: number;
  stars: 0 | 1 | 2 | 3;
  coins: number;
  jellies: string;
}

export function stageById(id: string): StageData | undefined {
  if (id === 'stage_test') return testStage as StageData;
  return stages[id];
}

const MAX_STEPS_PER_FRAME = 5;

export class GameScene extends Phaser.Scene {
  sim!: SimState;
  stageId = '';
  paused = false;
  /** 디버그 시간 배속: 프레임당 시뮬레이션 진행 비율 */
  timeScale = 1;
  recorder!: ReplayRecorder;
  controls!: InputController;
  private world!: WorldRenderer;
  private prev: RenderSnapshot = { cameraX: 0, playerY: 0 };
  private acc = 0;
  private finished = false;
  private frozen = false;
  private debug: DebugOverlay | null = null;

  constructor() {
    super('Game');
  }

  init(data: { stageId: string }): void {
    this.stageId = data.stageId;
    this.paused = false;
    this.finished = false;
    this.frozen = false;
    this.acc = 0;
    this.timeScale = 1;
  }

  create(): void {
    const stage = stageById(this.stageId);
    const errors = stage ? validateStage(stage) : [`스테이지 "${this.stageId}"를 찾을 수 없음`];
    if (!stage || errors.length) {
      this.cameras.main.setBackgroundColor('#1a1a2e');
      text(this, 40, 40, `스테이지 데이터 오류\n\n${errors.join('\n')}`, 22, '#ff8080');
      return;
    }

    const ch = activeCharacter();
    this.sim = createSim(stage, { startX: params.debug ? params.startX : undefined, skill: ch.skillId ?? null });
    this.prev = { cameraX: this.sim.cameraX, playerY: this.sim.player.y };
    this.recorder = new ReplayRecorder(stage.id, ch.skillId);
    this.controls = new InputController(this);
    this.world = new WorldRenderer(this, stage, params.debug);
    if (params.debug) this.debug = new DebugOverlay(this);

    this.scene.launch('UI', { stageId: stage.id });
    this.scene.bringToTop('UI');
    Sound.playBgm(this, stage.bgm);

    this.input.keyboard?.on('keydown', (ev: KeyboardEvent) => {
      if (ev.code === 'Escape' || ev.code === 'KeyP') this.setPaused(!this.paused);
      if (ev.code === 'KeyF') void fullscreen.toggle();
    });
    const onVisibility = () => document.hidden && this.setPaused(true);
    document.addEventListener('visibilitychange', onVisibility);
    this.events.once('shutdown', () => {
      document.removeEventListener('visibilitychange', onVisibility);
      this.debug?.destroy();
      this.debug = null;
    });
  }

  setPaused(on: boolean): void {
    if (!this.sim || this.finished || this.paused === on) return;
    this.paused = on;
    this.acc = 0;
    this.controls.clear();
    this.controls.enabled = !on;
    this.events.emit('paused', on);
  }

  restart(): void {
    this.scene.stop('UI');
    this.scene.restart({ stageId: this.stageId });
  }

  quit(): void {
    this.scene.stop('UI');
    this.scene.start('Lobby');
  }

  update(_time: number, delta: number): void {
    if (!this.sim) return;
    const s = this.sim;

    if (!this.paused && !this.finished && !this.frozen) {
      this.acc += Math.min(delta, 250) * this.timeScale;
      let steps = 0;
      while (this.acc >= TICK_MS && steps < MAX_STEPS_PER_FRAME * Math.max(1, this.timeScale)) {
        const input = this.controls.consumeFrame();
        this.recorder.record(s.tick, input);
        this.prev = { cameraX: s.cameraX, playerY: s.player.y };
        const events = step(s, input);
        this.handle(events);
        this.acc -= TICK_MS;
        steps++;
        if (s.outcome !== 'playing') {
          this.finish();
          break;
        }
        if (params.freezeAt !== undefined && s.tick >= params.freezeAt) {
          this.frozen = true;
          this.acc = 0;
          this.prev = { cameraX: s.cameraX, playerY: s.player.y };
          if (window.__deltaRun) window.__deltaRun.frozen = true;
          break;
        }
      }
      if (steps >= MAX_STEPS_PER_FRAME * Math.max(1, this.timeScale)) this.acc = 0; // 너무 느리면 따라잡지 않고 느려진다
    }
    if (window.__deltaRun) window.__deltaRun.tick = s.tick;

    const alpha = this.paused || this.finished || this.frozen ? 1 : this.acc / TICK_MS;
    this.world.sync(s, this.prev, alpha);
    this.events.emit('hud', s, this.controls);
    this.debug?.update(s);
  }

  private handle(events: SimEvent[]): void {
    for (const ev of events) {
      this.world.fx(this.sim, ev);
      switch (ev.type) {
        case 'jump':
          Sound.play(this, 'sfx_jump', 0.5);
          break;
        case 'collect':
          Sound.play(this, ev.kind === 'coin' ? 'sfx_coin' : 'sfx_jelly', 0.4);
          break;
        case 'item':
          Sound.play(this, 'sfx_item');
          this.events.emit('item', ev.kind);
          break;
        case 'hit':
          Sound.play(this, 'sfx_hit');
          break;
        case 'smash':
          Sound.play(this, 'sfx_smash');
          break;
        case 'skillMinor':
          Sound.play(this, 'sfx_smash');
          if (ev.destroyed > 0) this.events.emit('popup', `파쇄! ×${ev.destroyed}`);
          break;
        case 'ultimateStart':
          Sound.play(this, 'sfx_item');
          this.events.emit('popup', '혼돈의 상자!');
          break;
        case 'ultimateEnd':
          Sound.play(this, 'sfx_coin');
          break;
        case 'dropCollect':
          Sound.play(this, 'sfx_coin', 0.3);
          break;
        case 'cleared':
          Sound.play(this, 'sfx_clear');
          break;
        case 'failed':
          Sound.play(this, 'sfx_fail');
          break;
        default:
          break;
      }
    }
  }

  private finish(): void {
    this.finished = true;
    const s = this.sim;
    const result: RunResultData = {
      stageId: s.stage.id,
      outcome: s.outcome === 'cleared' ? 'cleared' : 'failed',
      failReason: s.failReason,
      jellyScore: s.jellyScore,
      distance: s.distance,
      score: totalScore(s),
      stars: starsFor(s),
      coins: s.coins,
      jellies: `${s.jelliesTaken}/${s.jelliesTotal}`,
    };
    this.controls.enabled = false;
    this.events.emit('finished', result.outcome);
    this.time.delayedCall(1100, () => {
      this.scene.stop('UI');
      this.scene.start('Result', result);
    });
  }
}
