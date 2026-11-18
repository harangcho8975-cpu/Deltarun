import Phaser from 'phaser';
import type { InputFrame } from '../sim/types';

const JUMP_KEYS = new Set(['Space', 'ArrowUp', 'KeyW']);
const SLIDE_KEYS = new Set(['ArrowDown', 'KeyS']);

/** 화면 오른쪽 위 일시정지 버튼 영역: 점프·슬라이드 판정에서 뺀다 */
export const PAUSE_AREA = { x: 1160, y: 0, w: 120, h: 110 };

/**
 * 브라우저 입력을 모아 두었다가 틱마다 InputFrame 하나로 넘긴다.
 * 터치: 왼쪽 절반 = 점프(누르는 순간), 오른쪽 절반 = 슬라이드(누르는 동안). 멀티터치 지원.
 */
export class InputController {
  private jumpLatched = false;
  private slidePointers = new Set<number>();
  private slideKeys = new Set<string>();
  /** 누르고 있는 점프 입력 (제빌 비행용) */
  private jumpPointers = new Set<number>();
  private jumpKeys = new Set<string>();
  /** UI 버튼 반응용: 마지막 점프 입력 시각(ms) */
  lastJumpAt = -1e9;
  enabled = true;

  constructor(private scene: Phaser.Scene) {
    const input = scene.input;
    input.addPointer(2);
    input.on('pointerdown', this.onDown, this);
    input.on('pointerup', this.onUp, this);
    input.on('pointerupoutside', this.onUp, this);
    input.on('gameout', this.clear, this);
    input.keyboard?.addCapture('SPACE,UP,DOWN');
    input.keyboard?.on('keydown', this.onKeyDown, this);
    input.keyboard?.on('keyup', this.onKeyUp, this);
    window.addEventListener('blur', this.clear);
    scene.events.once('shutdown', () => this.destroy());
  }

  private onDown(p: Phaser.Input.Pointer): void {
    if (!this.enabled) return;
    const a = PAUSE_AREA;
    if (p.x >= a.x && p.y <= a.y + a.h) return;
    if (p.x < this.scene.scale.width / 2) {
      this.pressJump();
      this.jumpPointers.add(p.id);
    } else this.slidePointers.add(p.id);
  }

  private onUp(p: Phaser.Input.Pointer): void {
    this.slidePointers.delete(p.id);
    this.jumpPointers.delete(p.id);
  }

  private onKeyDown(ev: KeyboardEvent): void {
    if (!this.enabled) return;
    if (JUMP_KEYS.has(ev.code)) {
      if (!ev.repeat) this.pressJump();
      this.jumpKeys.add(ev.code);
    } else if (SLIDE_KEYS.has(ev.code)) this.slideKeys.add(ev.code);
  }

  private onKeyUp(ev: KeyboardEvent): void {
    this.slideKeys.delete(ev.code);
    this.jumpKeys.delete(ev.code);
  }

  private pressJump(): void {
    this.jumpLatched = true;
    this.lastJumpAt = this.scene.time.now;
  }

  clear = (): void => {
    this.jumpLatched = false;
    this.slidePointers.clear();
    this.slideKeys.clear();
    this.jumpPointers.clear();
    this.jumpKeys.clear();
  };

  get slideHeld(): boolean {
    return this.slidePointers.size > 0 || this.slideKeys.size > 0;
  }

  consumeFrame(): InputFrame {
    const f = { jumpPressed: this.jumpLatched, slideHeld: this.slideHeld, jumpHeld: this.jumpPointers.size > 0 || this.jumpKeys.size > 0 };
    this.jumpLatched = false;
    return f;
  }

  destroy(): void {
    window.removeEventListener('blur', this.clear);
    const input = this.scene.input;
    input.off('pointerdown', this.onDown, this);
    input.off('pointerup', this.onUp, this);
    input.off('pointerupoutside', this.onUp, this);
    input.off('gameout', this.clear, this);
    input.keyboard?.off('keydown', this.onKeyDown, this);
    input.keyboard?.off('keyup', this.onKeyUp, this);
  }
}
