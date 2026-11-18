import { describe, expect, it, vi } from 'vitest';
import { RestBackend } from '../src/online/restBackend';
import { CloudSync, type CloudBackend, type CloudDoc, type CloudUser } from '../src/online/sync';
import { SaveStore, type KeyValueStorage } from '../src/save/SaveStore';

const mem = (): KeyValueStorage & { m: Map<string, string> } => {
  const m = new Map<string, string>();
  return { m, getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v) };
};

class FakeBackend implements CloudBackend {
  doc: CloudDoc | null = null;
  saves = 0;
  failInit = false;
  async init(): Promise<CloudUser> {
    if (this.failInit) throw new Error('offline');
    return { uid: 'u1', anonymous: true };
  }
  async load(): Promise<CloudDoc | null> {
    return this.doc;
  }
  async save(_u: CloudUser, d: CloudDoc): Promise<void> {
    this.saves++;
    this.doc = d;
  }
  async signOut(): Promise<void> {}
}

describe('클라우드 동기화', () => {
  it('서버에 아무것도 없으면 이 기기의 저장을 올린다', async () => {
    const store = new SaveStore(mem());
    store.addCoins(500);
    store.save();
    const b = new FakeBackend();
    const sync = new CloudSync(store, b, 0);
    await sync.start();
    expect(sync.status).toBe('synced');
    expect(JSON.parse(b.doc!.save).coins).toBe(600);
  });

  it('서버가 더 최근이면 서버 저장으로 바꾼다 (다른 기기에서 이어하기)', async () => {
    const a = new SaveStore(mem());
    a.addCoins(900);
    a.save();
    const b = new FakeBackend();
    await new CloudSync(a, b, 0).start();

    const phone = new SaveStore(mem()); // 새 기기: updatedAt 0
    const sync = new CloudSync(phone, b, 0);
    await sync.start();
    expect(phone.data.coins).toBe(1000);
    expect(phone.data.updatedAt).toBe(b.doc!.updatedAt);
  });

  it('이 기기가 더 최근이면 서버를 덮어쓴다', async () => {
    const store = new SaveStore(mem());
    const b = new FakeBackend();
    b.doc = { save: JSON.stringify({ ...store.data, coins: 5 }), updatedAt: 1000 };
    store.addCoins(40);
    store.save(); // updatedAt = 지금
    await new CloudSync(store, b, 0).start();
    expect(JSON.parse(b.doc.save).coins).toBe(140);
  });

  it('저장할 때마다 잠시 뒤 한 번만 올린다 (연달아 저장해도 1번)', async () => {
    vi.useFakeTimers();
    const store = new SaveStore(mem());
    const b = new FakeBackend();
    const sync = new CloudSync(store, b, 3000);
    await sync.start();
    const base = b.saves;
    store.save();
    store.save();
    store.save();
    await vi.advanceTimersByTimeAsync(3100);
    expect(b.saves).toBe(base + 1);
    vi.useRealTimers();
  });

  it('서버에 못 붙어도 게임은 이 기기 저장으로 계속 된다', async () => {
    const store = new SaveStore(mem());
    const b = new FakeBackend();
    b.failInit = true;
    const sync = new CloudSync(store, b, 0);
    await sync.start();
    expect(sync.status).toBe('error');
    expect(sync.lastError).toBe('offline');
    store.addCoins(1);
    expect(() => store.save()).not.toThrow();
  });

  it('깨진 서버 데이터도 안전하게 받아들인다', async () => {
    const store = new SaveStore(mem());
    const b = new FakeBackend();
    b.doc = { save: JSON.stringify({ version: 1, coins: -5, ownedCharacters: ['없는캐릭터'], equipment: 7 }), updatedAt: 5 };
    await new CloudSync(store, b, 0).start();
    expect(store.data.coins).toBe(100); // 잘못된 값은 기본값
    expect(store.data.ownedCharacters).not.toContain('없는캐릭터');
  });
});

describe('REST 백엔드 (모의 fetch)', () => {
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

  function makeFetch(docs: Map<string, unknown>) {
    const calls: { url: string; method: string; auth?: string; body?: string }[] = [];
    const f = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const u = String(url);
      const headers = (init?.headers ?? {}) as Record<string, string>;
      calls.push({ url: u, method: init?.method ?? 'GET', auth: headers.Authorization, body: init?.body as string | undefined });
      if (u.includes('accounts:signUp')) return json({ localId: 'abc', refreshToken: 'r1', idToken: 't1', expiresIn: '3600' });
      if (u.includes('securetoken')) return json({ user_id: 'abc', refresh_token: 'r2', id_token: 't2', expires_in: '3600' });
      if (u.includes('firestore.googleapis.com')) {
        if (init?.method === 'PATCH') {
          docs.set('doc', JSON.parse(init.body as string));
          return json({});
        }
        return docs.has('doc') ? json(docs.get('doc')) : json({ error: { message: 'NOT_FOUND' } }, 404);
      }
      return json({}, 500);
    });
    return { f: f as unknown as typeof fetch, calls };
  }
  const cfg = { apiKey: 'KEY', projectId: 'proj' };
  const store = () => {
    const m = new Map<string, string>();
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) };
  };

  it('게스트 로그인 → 문서가 없으면 null → 저장 → 다시 읽으면 같은 값', async () => {
    const { f, calls } = makeFetch(new Map());
    const b = new RestBackend(cfg, f, store());
    const user = await b.init();
    expect(user).toMatchObject({ uid: 'abc', anonymous: true });
    expect(calls[0].url).toContain('identitytoolkit.googleapis.com/v1/accounts:signUp?key=KEY');
    expect(await b.load(user)).toBeNull();
    await b.save(user, { save: '{"a":1}', updatedAt: 1234 });
    const patch = calls.find((c) => c.method === 'PATCH')!;
    expect(patch.url).toContain('/projects/proj/databases/(default)/documents/users/abc');
    expect(patch.url).toContain('updateMask.fieldPaths=save');
    expect(patch.auth).toBe('Bearer t1');
    expect(await b.load(user)).toEqual({ save: '{"a":1}', updatedAt: 1234 });
  });

  it('다음 접속에서는 저장된 로그인을 되살린다 (새 게스트를 만들지 않음)', async () => {
    const st = store();
    const first = makeFetch(new Map());
    await new RestBackend(cfg, first.f, st).init();
    const second = makeFetch(new Map());
    const user = await new RestBackend(cfg, second.f, st).init();
    expect(user.uid).toBe('abc');
    expect(second.calls.some((c) => c.url.includes('accounts:signUp'))).toBe(false);
    expect(second.calls[0].url).toContain('securetoken.googleapis.com');
  });

  it('토큰이 곧 만료되면 갱신해서 쓴다', async () => {
    let t = 0;
    const { f, calls } = makeFetch(new Map());
    const b = new RestBackend(cfg, f, store(), () => t);
    const user = await b.init();
    t = 3_600_000; // 1시간 뒤
    await b.load(user);
    expect(calls.some((c) => c.url.includes('securetoken'))).toBe(true);
    expect(calls[calls.length - 1].auth).toBe('Bearer t2');
  });

  it('서버 오류는 메시지와 함께 예외로 올라온다', async () => {
    const f = vi.fn(async () => json({ error: { message: 'ADMIN_ONLY_OPERATION' } }, 400)) as unknown as typeof fetch;
    await expect(new RestBackend(cfg, f, store()).init()).rejects.toThrow('ADMIN_ONLY_OPERATION');
  });
});
