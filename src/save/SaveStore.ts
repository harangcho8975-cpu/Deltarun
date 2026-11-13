// localStorage 래퍼. 어떤 오류가 나도 게임은 기본값으로 계속 돈다.
import { characters, DEFAULT_CHARACTER } from '../data/characters';

export interface StageRecord {
  cleared: boolean;
  bestScore: number;
  bestStars: 0 | 1 | 2 | 3;
}

export interface SaveData {
  version: 1;
  stages: Record<string, StageRecord>;
  coins: number;
  selectedCharacter: string;
  settings: { bgm: boolean; sfx: boolean };
}

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const SAVE_KEY = 'deltarun.save';

export function defaultSave(): SaveData {
  return { version: 1, stages: {}, coins: 0, selectedCharacter: DEFAULT_CHARACTER, settings: { bgm: true, sfx: true } };
}

function sanitize(raw: unknown): SaveData {
  const d = defaultSave();
  if (!raw || typeof raw !== 'object') return d;
  const r = raw as Partial<SaveData>;
  if (r.version !== 1) return d; // 이후 버전이 생기면 여기서 migrate
  if (typeof r.selectedCharacter === 'string' && characters.some((c) => c.id === r.selectedCharacter)) {
    d.selectedCharacter = r.selectedCharacter; // 목록에 없는 값(지워진 캐릭터 등)은 기본값
  }
  if (typeof r.coins === 'number' && Number.isFinite(r.coins) && r.coins >= 0) d.coins = Math.floor(r.coins);
  if (r.settings && typeof r.settings === 'object') {
    d.settings.bgm = r.settings.bgm !== false;
    d.settings.sfx = r.settings.sfx !== false;
  }
  if (r.stages && typeof r.stages === 'object') {
    for (const [id, rec] of Object.entries(r.stages)) {
      if (!rec || typeof rec !== 'object') continue;
      const stars = Number(rec.bestStars);
      d.stages[id] = {
        cleared: rec.cleared === true,
        bestScore: Number.isFinite(rec.bestScore) ? Math.max(0, Math.floor(rec.bestScore)) : 0,
        bestStars: (stars >= 0 && stars <= 3 ? Math.floor(stars) : 0) as 0 | 1 | 2 | 3,
      };
    }
  }
  return d;
}

function browserStorage(): KeyValueStorage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export interface RunReport {
  stageId: string;
  cleared: boolean;
  score: number;
  stars: 0 | 1 | 2 | 3;
  coins: number;
}

export class SaveStore {
  data: SaveData;

  constructor(private storage: KeyValueStorage | null = browserStorage()) {
    this.data = this.load();
  }

  private load(): SaveData {
    try {
      const text = this.storage?.getItem(SAVE_KEY);
      return text ? sanitize(JSON.parse(text)) : defaultSave();
    } catch {
      return defaultSave();
    }
  }

  save(): void {
    try {
      this.storage?.setItem(SAVE_KEY, JSON.stringify(this.data));
    } catch {
      // 비공개 창·용량 초과 등: 저장만 건너뛴다
    }
  }

  record(id: string): StageRecord {
    return this.data.stages[id] ?? { cleared: false, bestScore: 0, bestStars: 0 };
  }

  /** 첫 스테이지는 항상 열림, n번째는 n−1번째를 클리어해야 열림 */
  isUnlocked(order: string[], id: string): boolean {
    const i = order.indexOf(id);
    if (i <= 0) return true;
    return this.record(order[i - 1]).cleared;
  }

  /** 한 판 결과 반영. 최고점수가 갱신됐는지 돌려준다. */
  applyRun(r: RunReport): { newBest: boolean } {
    const prev = this.record(r.stageId);
    const next: StageRecord = { ...prev };
    const newBest = r.score > prev.bestScore;
    if (newBest) next.bestScore = r.score;
    if (r.stars > prev.bestStars) next.bestStars = r.stars;
    if (r.cleared) next.cleared = true;
    this.data.stages[r.stageId] = next;
    this.data.coins += r.coins; // 코인은 실패해도 누적
    this.save();
    return { newBest };
  }

  setCharacter(id: string): void {
    if (!characters.some((c) => c.id === id)) return;
    this.data.selectedCharacter = id;
    this.save();
  }

  setSetting(key: 'bgm' | 'sfx', value: boolean): void {
    this.data.settings[key] = value;
    this.save();
  }
}
