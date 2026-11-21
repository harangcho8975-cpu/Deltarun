import { describe, expect, it, vi } from 'vitest';
import { explainAuthError, FirebaseBackend, type Sdk } from '../src/online/firebaseBackend';
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
  google: { user: CloudUser; switched: boolean } | Error = { user: { uid: 'g1', anonymous: false, label: 'a@b.c' }, switched: false };
  async signInGoogle(): Promise<{ user: CloudUser; switched: boolean }> {
    if (this.google instanceof Error) throw this.google;
    return this.google;
  }
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

describe('구글 로그인 (동기화)', () => {
  it('게스트에 연결하면(uid 유지) 보통 동기화: 이 기기가 최신이면 올린다', async () => {
    const store = new SaveStore(mem());
    const b = new FakeBackend();
    const sync = new CloudSync(store, b, 0);
    await sync.start();
    store.addCoins(70);
    store.save();
    await sync.signInGoogle();
    expect(sync.user).toMatchObject({ uid: 'g1', anonymous: false, label: 'a@b.c' });
    expect(JSON.parse(b.doc!.save).coins).toBe(170);
    expect(sync.status).toBe('synced');
  });

  it('이미 있는 구글 계정으로 바뀌면 서버 저장이 이긴다 (이 기기가 더 최근이어도)', async () => {
    const store = new SaveStore(mem());
    const b = new FakeBackend();
    const sync = new CloudSync(store, b, 0);
    await sync.start();
    b.doc = { save: JSON.stringify({ ...store.data, coins: 4242 }), updatedAt: 5 }; // 아주 오래된 서버 저장
    store.addCoins(1);
    store.save(); // 이 기기가 훨씬 최근
    b.google = { user: { uid: 'g2', anonymous: false, label: 'x@y.z' }, switched: true };
    await sync.signInGoogle();
    expect(store.data.coins).toBe(4242);
    expect(sync.user!.uid).toBe('g2');
  });

  it('바뀐 계정에 서버 저장이 없으면 이 기기의 진행을 올린다', async () => {
    const store = new SaveStore(mem());
    const b = new FakeBackend();
    const sync = new CloudSync(store, b, 0);
    await sync.start();
    store.addCoins(9);
    store.save();
    b.doc = null;
    b.google = { user: { uid: 'g3', anonymous: false }, switched: true };
    await sync.signInGoogle();
    expect(JSON.parse(b.doc!.save).coins).toBe(109);
  });

  it('로그인 취소·실패는 오류로 남고 게스트 상태는 그대로', async () => {
    const store = new SaveStore(mem());
    const b = new FakeBackend();
    const sync = new CloudSync(store, b, 0);
    await sync.start();
    b.google = Object.assign(new Error('popup closed'), { code: 'auth/popup-closed-by-user' });
    await sync.signInGoogle();
    expect(sync.status).toBe('error');
    expect(sync.lastError).toBe('popup closed');
    expect(sync.user).toMatchObject({ uid: 'u1', anonymous: true });
  });
});

describe('FirebaseBackend (가짜 SDK)', () => {
  function fakeSdk(opts: { current?: { uid: string; isAnonymous: boolean; email?: string } | null; linkError?: { code: string } } = {}) {
    const calls: string[] = [];
    const docs = new Map<string, unknown>();
    const auth = { currentUser: opts.current === undefined ? null : opts.current, authStateReady: async () => {} };
    const mk = (uid: string, isAnonymous: boolean, email?: string) => ({ uid, isAnonymous, email, displayName: null });
    class GoogleAuthProvider {
      static credentialFromError(e: unknown) {
        return (e as { code: string }).code ? { cred: true } : null;
      }
    }
    const sdk = {
      app: { getApps: () => [], getApp: () => ({}), initializeApp: () => ({}) },
      auth: {
        getAuth: () => auth,
        GoogleAuthProvider,
        signInAnonymously: async (a: typeof auth) => {
          calls.push('anon');
          a.currentUser = mk('anon1', true);
        },
        linkWithPopup: async () => {
          calls.push('link');
          if (opts.linkError) throw opts.linkError;
          return { user: mk(auth.currentUser!.uid, false, 'me@g.com') };
        },
        signInWithPopup: async (a: typeof auth) => {
          calls.push('popup');
          a.currentUser = mk('google1', false, 'me@g.com');
          return { user: a.currentUser };
        },
        signInWithCredential: async (a: typeof auth) => {
          calls.push('credential');
          a.currentUser = mk('existing', false, 'me@g.com');
          return { user: a.currentUser };
        },
        signOut: async (a: typeof auth) => {
          calls.push('signout');
          a.currentUser = null;
        },
      },
      fs: {
        getFirestore: () => ({}),
        doc: (_db: unknown, c: string, id: string) => `${c}/${id}`,
        getDoc: async (ref: string) => ({ exists: () => docs.has(ref), data: () => docs.get(ref) }),
        setDoc: async (ref: string, v: unknown) => void docs.set(ref, v),
      },
    };
    return { sdk: sdk as unknown as Sdk, calls, docs, auth };
  }

  it('저장된 로그인이 없으면 게스트로 시작, 있으면 그대로 쓴다', async () => {
    const a = fakeSdk();
    const u = await new FirebaseBackend({}, async () => a.sdk).init();
    expect(u).toMatchObject({ uid: 'anon1', anonymous: true });
    expect(a.calls).toEqual(['anon']);

    const b = fakeSdk({ current: { uid: 'keep', isAnonymous: true } });
    expect((await new FirebaseBackend({}, async () => b.sdk).init()).uid).toBe('keep');
    expect(b.calls).toEqual([]);
  });

  it('게스트에 구글을 연결하면 uid가 유지된다', async () => {
    const f = fakeSdk({ current: { uid: 'guest1', isAnonymous: true } });
    const r = await new FirebaseBackend({}, async () => f.sdk).signInGoogle();
    expect(f.calls).toEqual(['link']);
    expect(r).toEqual({ user: { uid: 'guest1', anonymous: false, label: 'me@g.com' }, switched: false });
  });

  it('이미 쓰이는 구글 계정이면 그 계정으로 로그인한다 (switched)', async () => {
    const f = fakeSdk({ current: { uid: 'guest1', isAnonymous: true }, linkError: { code: 'auth/credential-already-in-use' } });
    const r = await new FirebaseBackend({}, async () => f.sdk).signInGoogle();
    expect(f.calls).toEqual(['link', 'credential']);
    expect(r.switched).toBe(true);
    expect(r.user.uid).toBe('existing');
  });

  it('다른 오류는 그대로 던진다', async () => {
    const f = fakeSdk({ current: { uid: 'g', isAnonymous: true }, linkError: { code: 'auth/popup-closed-by-user' } });
    await expect(new FirebaseBackend({}, async () => f.sdk).signInGoogle()).rejects.toMatchObject({ code: 'auth/popup-closed-by-user' });
  });

  it('이미 구글로 로그인했다면 팝업을 띄우지 않는다', async () => {
    const f = fakeSdk({ current: { uid: 'g', isAnonymous: false, email: 'e@g.com' } });
    const r = await new FirebaseBackend({}, async () => f.sdk).signInGoogle();
    expect(f.calls).toEqual([]);
    expect(r.switched).toBe(false);
  });

  it('Firestore: users/{uid} 문서를 읽고 쓴다 (없으면 null)', async () => {
    const f = fakeSdk({ current: { uid: 'u9', isAnonymous: true } });
    const b = new FirebaseBackend({}, async () => f.sdk);
    const u = await b.init();
    expect(await b.load(u)).toBeNull();
    await b.save(u, { save: '{"a":1}', updatedAt: 77 });
    expect(f.docs.get('users/u9')).toEqual({ save: '{"a":1}', updatedAt: 77, version: 1 });
    expect(await b.load(u)).toEqual({ save: '{"a":1}', updatedAt: 77 });
  });

  it('로그아웃하면 SDK 로그아웃을 부른다', async () => {
    const f = fakeSdk({ current: { uid: 'u', isAnonymous: true } });
    const b = new FirebaseBackend({}, async () => f.sdk);
    await b.signOut();
    expect(f.calls).toEqual(['signout']);
  });

  it('오류 문구', () => {
    expect(explainAuthError({ code: 'auth/popup-blocked' })).toContain('팝업');
    expect(explainAuthError({ code: 'auth/unauthorized-domain' })).toContain('승인된 도메인');
    expect(explainAuthError(new Error('boom'))).toBe('boom');
  });
});
