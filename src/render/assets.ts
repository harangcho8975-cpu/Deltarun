import Phaser from 'phaser';

export interface ManifestEntry {
  key: string;
  type: 'image' | 'spritesheet' | 'audio';
  /** null이거나 로드에 실패하면 플레이스홀더를 만든다 */
  path: string | null;
  width?: number;
  height?: number;
  frames?: number;
  frameRate?: number;
  /** '#rrggbb' 또는 '#rrggbbaa' */
  placeholderColor?: string;
  /** 배경용: 아래에서부터 채울 비율 (0~1) */
  placeholderFill?: number;
}

export const MANIFEST_KEY = 'manifest';
export const ANIM_PREFIX = 'anim_';

/** 매니페스트 항목을 로더에 넣는다. 경로가 없는 항목은 건너뛴다. */
export function queueAssets(scene: Phaser.Scene, manifest: ManifestEntry[]): void {
  for (const e of manifest) {
    if (!e.path) continue;
    const url = `assets/${e.path}`;
    if (e.type === 'audio') scene.load.audio(e.key, url);
    else if (e.type === 'spritesheet') scene.load.spritesheet(e.key, url, { frameWidth: e.width!, frameHeight: e.height! });
    else scene.load.image(e.key, url);
  }
}

/** 색 사각형 + 키 이름 텍스처. 프레임이 여럿이면 가로로 나란히 그리고 번호 프레임을 등록한다. */
export function makePlaceholder(scene: Phaser.Scene, e: ManifestEntry): void {
  const frames = e.frames ?? 1;
  const w = e.width ?? 64;
  const h = e.height ?? 64;
  if (scene.textures.exists(e.key)) scene.textures.remove(e.key);
  const tex = scene.textures.createCanvas(e.key, w * frames, h);
  if (!tex) return;
  const ctx = tex.getContext();
  const color = e.placeholderColor ?? '#cccccc';
  const fill = e.placeholderFill ?? 1;
  const top = Math.round(h * (1 - fill));
  const isBg = e.key.startsWith('bg_');

  for (let i = 0; i < frames; i++) {
    const x0 = i * w;
    ctx.fillStyle = color;
    ctx.fillRect(x0, top, w, h - top);
    if (isBg) {
      // 스크롤이 보이도록 세로 줄무늬
      ctx.fillStyle = 'rgba(0,0,0,0.08)';
      for (let sx = 0; sx < w; sx += 160) ctx.fillRect(x0 + sx, top, 80, h - top);
    } else {
      // 프레임마다 명도 띠 위치를 달리해 애니메이션이 도는 게 보이게
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      const band = Math.max(4, Math.round(h / 6));
      ctx.fillRect(x0, top + ((i * band) % Math.max(1, h - top - band)), w, band);
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.lineWidth = 2;
      ctx.strokeRect(x0 + 1, top + 1, w - 2, h - top - 2);
    }
    if (w >= 48) {
      ctx.fillStyle = 'rgba(0,0,0,0.75)';
      ctx.font = '11px sans-serif';
      ctx.textBaseline = 'top';
      ctx.fillText(e.key, x0 + 4, top + 4, w - 8);
      if (frames > 1) ctx.fillText(`${i + 1}/${frames}`, x0 + 4, top + 18);
    }
    tex.add(i, 0, x0, 0, w, h);
  }
  tex.refresh();
}

/** 프레임이 여럿인 항목은 애니메이션 anim_<key>로 등록 */
export function registerAnimations(scene: Phaser.Scene, manifest: ManifestEntry[]): void {
  for (const e of manifest) {
    if (e.type === 'audio') continue;
    const key = ANIM_PREFIX + e.key;
    if (scene.anims.exists(key)) scene.anims.remove(key);
    const frames = e.frames ?? 1;
    scene.anims.create({
      key,
      frames: Array.from({ length: frames }, (_, i) => ({ key: e.key, frame: frames > 1 ? i : undefined })),
      frameRate: e.frameRate ?? 8,
      repeat: -1,
    });
  }
}
