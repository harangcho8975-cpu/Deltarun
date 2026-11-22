// Firebase 공식 SDK를 쓰는 백엔드: 게스트(익명) 로그인, 구글 로그인(게스트 계정에 연결), Firestore 문서 1개.
// SDK는 처음 필요할 때 내려받는다 (게임 첫 로딩에 포함되지 않음).
import type { CloudBackend, CloudDoc, CloudUser } from './sync';

export interface Sdk {
  app: typeof import('firebase/app');
  auth: typeof import('firebase/auth');
  fs: typeof import('firebase/firestore');
}

export const loadSdk = async (): Promise<Sdk> => {
  const [app, auth, fs] = await Promise.all([import('firebase/app'), import('firebase/auth'), import('firebase/firestore')]);
  return { app, auth, fs };
};

type FbUser = import('firebase/auth').User;
type FbAuth = import('firebase/auth').Auth;
type FbDb = import('firebase/firestore').Firestore;

const toUser = (u: FbUser): CloudUser => ({
  uid: u.uid,
  anonymous: u.isAnonymous,
  label: u.isAnonymous ? '게스트' : (u.email ?? u.displayName ?? '구글 계정'),
});

/** 사람이 읽을 오류 문구 */
export function explainAuthError(e: unknown): string {
  const code = (e as { code?: string })?.code ?? '';
  const map: Record<string, string> = {
    'auth/popup-closed-by-user': '로그인 창이 닫혔어요. 홈 화면 앱이나 카카오톡·인스타 안의 브라우저라면 Chrome·Safari로 주소를 열어 다시 해 보세요',
    'auth/cancelled-popup-request': '로그인 창이 이미 열려 있어요',
    'auth/popup-blocked': '팝업이 막혔어요. 브라우저의 팝업 차단을 풀어 주세요',
    'auth/unauthorized-domain': '이 주소가 Firebase의 승인된 도메인에 없어요 (Authentication → 설정 → 승인된 도메인)',
    'auth/operation-not-allowed': 'Firebase 콘솔에서 이 로그인 방법이 꺼져 있어요',
    'auth/network-request-failed': '인터넷 연결을 확인해 주세요',
    'auth/operation-not-supported-in-this-environment': '이 브라우저에서는 로그인 창을 열 수 없어요. Chrome·Safari로 열어 주세요',
    'auth/web-storage-unsupported': '브라우저 저장소가 꺼져 있어요 (비공개 창이면 일반 창으로 열어 주세요)',
    'auth/internal-error': '로그인 중 오류가 났어요. 다른 브라우저로 시도해 주세요',
  };
  const msg = map[code] ?? (e instanceof Error ? e.message : String(e));
  return code ? `${msg} (${code})` : msg;
}

export class FirebaseBackend implements CloudBackend {
  private sdk: Sdk | null = null;
  private auth: FbAuth | null = null;
  private db: FbDb | null = null;

  constructor(
    private config: Record<string, string>,
    private sdkLoader: () => Promise<Sdk> = loadSdk,
  ) {}

  private async ensure(): Promise<{ sdk: Sdk; auth: FbAuth; db: FbDb }> {
    if (!this.sdk) {
      const sdk = await this.sdkLoader();
      const { app, auth, fs } = sdk;
      const a = app.getApps().length ? app.getApp() : app.initializeApp(this.config);
      this.sdk = sdk;
      this.auth = auth.getAuth(a);
      this.db = fs.getFirestore(a);
    }
    return { sdk: this.sdk, auth: this.auth!, db: this.db! };
  }

  async init(): Promise<CloudUser> {
    const { sdk, auth } = await this.ensure();
    await auth.authStateReady(); // 저장된 로그인이 있으면 복원될 때까지 기다린다
    if (!auth.currentUser) await sdk.auth.signInAnonymously(auth);
    return toUser(auth.currentUser!);
  }

  async signInGoogle(): Promise<{ user: CloudUser; switched: boolean }> {
    const { sdk, auth } = await this.ensure();
    const provider = new sdk.auth.GoogleAuthProvider();
    const current = auth.currentUser;
    if (current && !current.isAnonymous) return { user: toUser(current), switched: false };
    try {
      // 게스트 계정에 구글을 연결한다: uid가 그대로라 진행 상황이 이어진다
      const r = current ? await sdk.auth.linkWithPopup(current, provider) : await sdk.auth.signInWithPopup(auth, provider);
      return { user: toUser(r.user), switched: !current };
    } catch (e) {
      // 이 구글 계정이 이미 다른 계정으로 쓰이고 있으면 그 계정으로 로그인한다 (그 계정의 저장을 받아온다)
      if ((e as { code?: string })?.code === 'auth/credential-already-in-use') {
        const credential = sdk.auth.GoogleAuthProvider.credentialFromError(e as import('firebase/auth').AuthError);
        if (credential) {
          const r = await sdk.auth.signInWithCredential(auth, credential);
          return { user: toUser(r.user), switched: true };
        }
      }
      // 화면에 그대로 보여 줄 수 있게 사람이 읽을 문구로 바꾼다 (원래 코드도 괄호로 붙는다)
      throw new Error(explainAuthError(e));
    }
  }

  async load(user: CloudUser): Promise<CloudDoc | null> {
    const { sdk, db } = await this.ensure();
    const snap = await sdk.fs.getDoc(sdk.fs.doc(db, 'users', user.uid));
    if (!snap.exists()) return null;
    const d = snap.data() as { save?: string; updatedAt?: number };
    return typeof d.save === 'string' ? { save: d.save, updatedAt: Number(d.updatedAt ?? 0) } : null;
  }

  async save(user: CloudUser, doc: CloudDoc): Promise<void> {
    const { sdk, db } = await this.ensure();
    await sdk.fs.setDoc(sdk.fs.doc(db, 'users', user.uid), { save: doc.save, updatedAt: doc.updatedAt, version: 1 });
  }

  async signOut(): Promise<void> {
    const { sdk, auth } = await this.ensure();
    await sdk.auth.signOut(auth);
  }
}
