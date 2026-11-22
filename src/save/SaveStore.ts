// localStorage 래퍼. 어떤 오류가 나도 게임은 기본값으로 계속 돈다.
import { ECONOMY } from '../config/economy';
import { characters, DEFAULT_CHARACTER } from '../data/characters';
import { equipmentById } from '../data/equipment';

export interface StageRecord {
  cleared: boolean;
  bestScore: number;
  bestStars: 0 | 1 | 2 | 3;
  /** 맵 안에서 가장 멀리 간 스테이지 번호 (1부터) */
  bestSection?: number;
}

/** 장비: 가진 장비(id → 개수)와 지금 장착한 장비(최대 슬롯 수) */
export interface EquipmentSave {
  owned: Record<string, number>;
  equipped: string[];
}

export interface SaveData {
  version: 1;
  /** 마지막으로 저장한 시각(ms). 클라우드 동기화에서 어느 쪽이 최신인지 가린다 */
  updatedAt: number;
  stages: Record<string, StageRecord>;
  coins: number;
  selectedCharacter: string;
  equipment: EquipmentSave;
  /** 가진 캐릭터 */
  ownedCharacters: string[];
  /** 마지막으로 출석 보상을 받은 날짜 (YYYY-MM-DD) */
  lastAttendance: string;
  settings: { bgm: boolean; sfx: boolean };
}

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const SAVE_KEY = 'deltarun.save';

export function defaultSave(): SaveData {
  return {
    version: 1,
    updatedAt: 0,
    stages: {},
    coins: ECONOMY.startCoins,
    selectedCharacter: DEFAULT_CHARACTER,
    equipment: { owned: {}, equipped: [] },
    ownedCharacters: [...ECONOMY.startCharacters],
    lastAttendance: '',
    settings: { bgm: true, sfx: true },
  };
}

function sanitize(raw: unknown): SaveData {
  const d = defaultSave();
  if (!raw || typeof raw !== 'object') return d;
  const r = raw as Partial<SaveData>;
  if (r.version !== 1) return d; // 이후 버전이 생기면 여기서 migrate
  if (typeof r.updatedAt === 'number' && Number.isFinite(r.updatedAt) && r.updatedAt > 0) d.updatedAt = Math.floor(r.updatedAt);
  if (typeof r.selectedCharacter === 'string' && characters.some((c) => c.id === r.selectedCharacter)) {
    d.selectedCharacter = r.selectedCharacter; // 목록에 없는 값(지워진 캐릭터 등)은 기본값
  }
  if (Array.isArray(r.ownedCharacters)) {
    for (const id of r.ownedCharacters) {
      if (characters.some((c) => c.id === id) && !d.ownedCharacters.includes(id)) d.ownedCharacters.push(id);
    }
  }
  // 예전 저장(전부 열려 있던 때)에서 고른 캐릭터는 계속 쓸 수 있게 한다
  if (!d.ownedCharacters.includes(d.selectedCharacter)) d.ownedCharacters.push(d.selectedCharacter);
  if (typeof r.lastAttendance === 'string') d.lastAttendance = r.lastAttendance;
  if (r.equipment && typeof r.equipment === 'object') {
    const eq = r.equipment as Partial<EquipmentSave>;
    for (const [id, n] of Object.entries(eq.owned ?? {})) {
      if (equipmentById(id) && Number.isFinite(n) && n > 0) d.equipment.owned[id] = Math.floor(n);
    }
    // 장착은 가진 장비만, 중복 없이, 슬롯 수까지
    for (const id of eq.equipped ?? []) {
      if (d.equipment.owned[id] && !d.equipment.equipped.includes(id) && d.equipment.equipped.length < ECONOMY.equipSlots) {
        d.equipment.equipped.push(id);
      }
    }
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
        ...(Number.isFinite(rec.bestSection) && (rec.bestSection as number) > 0 ? { bestSection: Math.floor(rec.bestSection as number) } : {}),
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

/** 한 판 결과를 저장에 반영한 뒤의 정보 */
export interface ApplyResult {
  newBest: boolean;
  /** 클리어 보너스로 받은 코인 */
  bonus: number;
}

export interface RunReport {
  stageId: string;
  cleared: boolean;
  score: number;
  stars: 0 | 1 | 2 | 3;
  coins: number;
  /** 이번 판에 도달한 스테이지 번호 (1부터, 맵 안 구간) */
  section?: number;
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

  private listeners: (() => void)[] = [];

  /** 저장할 때마다 불린다 (클라우드 동기화용) */
  onSave(fn: () => void): void {
    this.listeners.push(fn);
  }

  /** 서버의 저장으로 통째로 바꾼다 (updatedAt도 서버 값 그대로) */
  replaceFromCloud(raw: unknown, updatedAt: number): void {
    this.data = sanitize(raw);
    this.data.updatedAt = updatedAt;
    try {
      this.storage?.setItem(SAVE_KEY, JSON.stringify(this.data));
    } catch {
      // 무시
    }
  }

  save(): void {
    this.data.updatedAt = Date.now();
    try {
      this.storage?.setItem(SAVE_KEY, JSON.stringify(this.data));
    } catch {
      // 비공개 창·용량 초과 등: 저장만 건너뛴다
    }
    this.listeners.forEach((f) => f());
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
  applyRun(r: RunReport): ApplyResult {
    const prev = this.record(r.stageId);
    const next: StageRecord = { ...prev };
    const newBest = r.score > prev.bestScore;
    if (newBest) next.bestScore = r.score;
    if (r.stars > prev.bestStars) next.bestStars = r.stars;
    if (r.cleared) next.cleared = true;
    if (r.section && r.section > (prev.bestSection ?? 0)) next.bestSection = r.section;
    this.data.stages[r.stageId] = next;
    const bonus = r.cleared ? ECONOMY.stageClearBonus : 0; // 클리어할 때마다 보너스
    this.data.coins += r.coins + bonus; // 판에서 주운 코인은 실패해도 누적
    this.save();
    return { newBest, bonus };
  }

  addCoins(n: number): void {
    this.data.coins += n;
  }

  /** 코인을 쓴다. 모자라면 아무것도 바꾸지 않고 false */
  spendCoins(n: number): boolean {
    if (n < 0 || this.data.coins < n) return false;
    this.data.coins -= n;
    return true;
  }

  /** 장비를 얻는다. 처음 얻으면 isNew */
  addEquipment(id: string): { isNew: boolean; count: number } {
    if (!equipmentById(id)) throw new Error(`알 수 없는 장비: ${id}`);
    const prev = this.data.equipment.owned[id] ?? 0;
    this.data.equipment.owned[id] = prev + 1;
    return { isNew: prev === 0, count: prev + 1 };
  }

  /** 장착·해제. 슬롯이 가득 차면 'full', 가지고 있지 않으면 'not_owned' */
  toggleEquip(id: string): 'equipped' | 'unequipped' | 'full' | 'not_owned' {
    const eq = this.data.equipment;
    if (eq.equipped.includes(id)) {
      eq.equipped = eq.equipped.filter((x) => x !== id);
      this.save();
      return 'unequipped';
    }
    if (!eq.owned[id]) return 'not_owned';
    if (eq.equipped.length >= ECONOMY.equipSlots) return 'full';
    eq.equipped.push(id);
    this.save();
    return 'equipped';
  }

  ownsCharacter(id: string): boolean {
    return this.data.ownedCharacters.includes(id);
  }

  /** 캐릭터를 얻는다. 처음 얻으면 isNew */
  addCharacter(id: string): { isNew: boolean } {
    if (!characters.some((c) => c.id === id)) throw new Error(`알 수 없는 캐릭터: ${id}`);
    if (this.ownsCharacter(id)) return { isNew: false };
    this.data.ownedCharacters.push(id);
    return { isNew: true };
  }

  /** 오늘 출석 보상을 받을 수 있는가 */
  canClaimAttendance(today: string): boolean {
    return this.data.lastAttendance !== today;
  }

  /** 출석 보상. 받은 코인을 돌려주고, 오늘 이미 받았으면 0 */
  claimAttendance(today: string): number {
    if (!this.canClaimAttendance(today)) return 0;
    this.data.lastAttendance = today;
    this.data.coins += ECONOMY.attendanceCoins;
    this.save();
    return ECONOMY.attendanceCoins;
  }

  setCharacter(id: string): void {
    if (!characters.some((c) => c.id === id) || !this.ownsCharacter(id)) return;
    this.data.selectedCharacter = id;
    this.save();
  }

  setSetting(key: 'bgm' | 'sfx', value: boolean): void {
    this.data.settings[key] = value;
    this.save();
  }
}
