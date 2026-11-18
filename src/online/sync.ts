// 클라우드 저장 동기화. 서버는 CloudBackend 뒤에 숨겨 두어 (Firebase / 모의 서버) 바꿔 끼울 수 있다.
// 규칙: 서버와 기기 중 updatedAt이 더 최근인 쪽이 이긴다. 서버에 아무것도 없으면 올린다.
import type { SaveStore } from '../save/SaveStore';

export interface CloudUser {
  uid: string;
  /** 게스트(익명) 계정인가 */
  anonymous: boolean;
  label?: string;
}

export interface CloudDoc {
  /** SaveData를 JSON으로 만든 문자열 */
  save: string;
  updatedAt: number;
}

export interface CloudBackend {
  /** 기존 로그인을 복원하거나 게스트로 새로 시작한다. 실패하면 예외 */
  init(): Promise<CloudUser>;
  load(user: CloudUser): Promise<CloudDoc | null>;
  save(user: CloudUser, doc: CloudDoc): Promise<void>;
  signOut(): Promise<void>;
}

export type CloudStatus = 'off' | 'connecting' | 'synced' | 'syncing' | 'error';

export class CloudSync {
  status: CloudStatus = 'off';
  user: CloudUser | null = null;
  lastSyncedAt = 0;
  lastError = '';
  private timer: ReturnType<typeof setTimeout> | null = null;
  private busy: Promise<void> = Promise.resolve();
  private listeners = new Set<() => void>();

  constructor(
    private store: SaveStore,
    private backend: CloudBackend,
    private debounceMs = 3000,
  ) {
    store.onSave(() => this.schedulePush());
  }

  onChange(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private set(status: CloudStatus, error = ''): void {
    this.status = status;
    this.lastError = error;
    this.listeners.forEach((f) => f());
  }

  /** 로그인(게스트)하고 서버와 맞춘다. 실패해도 게임은 오프라인으로 계속 된다. */
  start(): Promise<void> {
    return this.run(async () => {
      this.set('connecting');
      this.user = await this.backend.init();
      await this.reconcile();
    });
  }

  /** 지금 바로 서버와 맞춘다 (계정 화면의 [지금 동기화]) */
  syncNow(): Promise<void> {
    return this.run(async () => {
      if (!this.user) this.user = await this.backend.init();
      await this.reconcile();
    });
  }

  async signOut(): Promise<void> {
    if (this.timer) clearTimeout(this.timer);
    await this.run(async () => {
      await this.backend.signOut();
      this.user = null;
      this.set('off');
    });
  }

  private run(fn: () => Promise<void>): Promise<void> {
    const next = this.busy.then(fn).catch((e: unknown) => {
      this.set('error', e instanceof Error ? e.message : String(e));
    });
    this.busy = next;
    return next;
  }

  private async reconcile(): Promise<void> {
    const user = this.user!;
    this.set('syncing');
    const remote = await this.backend.load(user);
    const local = this.store.data.updatedAt;
    if (remote && remote.updatedAt > local) {
      this.store.replaceFromCloud(JSON.parse(remote.save), remote.updatedAt);
    } else if (!remote || local > remote.updatedAt) {
      await this.push();
    }
    this.lastSyncedAt = Date.now();
    this.set('synced');
  }

  private async push(): Promise<void> {
    if (!this.user) return;
    await this.backend.save(this.user, { save: JSON.stringify(this.store.data), updatedAt: this.store.data.updatedAt });
  }

  private schedulePush(): void {
    if (!this.user) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.run(async () => {
        this.set('syncing');
        await this.push();
        this.lastSyncedAt = Date.now();
        this.set('synced');
      });
    }, this.debounceMs);
  }

  /** 테스트용: 예약된 올리기를 기다리지 않고 바로 끝낸다 */
  flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
      return this.run(async () => {
        this.set('syncing');
        await this.push();
        this.lastSyncedAt = Date.now();
        this.set('synced');
      });
    }
    return this.busy;
  }
}
