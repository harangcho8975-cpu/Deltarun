// Firebase를 공식 REST 주소로 직접 부르는 백엔드 (패키지 설치 없음, 게스트 로그인 + Firestore 문서 1개).
//  로그인: identitytoolkit.googleapis.com / securetoken.googleapis.com
//  저장:   firestore.googleapis.com  →  users/{uid}  { save, updatedAt, version }
import type { CloudBackend, CloudDoc, CloudUser } from './sync';

export interface RestConfig {
  apiKey: string;
  projectId: string;
}

interface Tokens {
  uid: string;
  refreshToken: string;
  idToken: string;
  expiresAt: number;
}

const TOKEN_KEY = 'deltarun.cloud';

export class RestBackend implements CloudBackend {
  private tokens: Tokens | null = null;

  constructor(
    private cfg: RestConfig,
    private fetcher: typeof fetch = (...a) => fetch(...a),
    private storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null = typeof localStorage === 'undefined' ? null : localStorage,
    private now: () => number = Date.now,
  ) {}

  private async post(url: string, body: unknown, form = false): Promise<Record<string, string>> {
    const res = await this.fetcher(url, {
      method: 'POST',
      headers: { 'Content-Type': form ? 'application/x-www-form-urlencoded' : 'application/json' },
      body: form ? new URLSearchParams(body as Record<string, string>).toString() : JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      const msg = (json.error as { message?: string } | undefined)?.message ?? `HTTP ${res.status}`;
      throw new Error(msg);
    }
    return json as Record<string, string>;
  }

  private persist(): void {
    try {
      if (this.tokens) this.storage?.setItem(TOKEN_KEY, JSON.stringify({ uid: this.tokens.uid, refreshToken: this.tokens.refreshToken }));
    } catch {
      // 저장 못 해도 이번 접속에서는 계속 쓴다
    }
  }

  async init(): Promise<CloudUser> {
    let saved: { uid: string; refreshToken: string } | null = null;
    try {
      const raw = this.storage?.getItem(TOKEN_KEY);
      if (raw) saved = JSON.parse(raw);
    } catch {
      saved = null;
    }
    if (saved?.refreshToken) {
      try {
        await this.refresh(saved.refreshToken);
        return { uid: this.tokens!.uid, anonymous: true, label: '게스트' };
      } catch {
        // 만료·삭제된 로그인: 새 게스트로 시작
      }
    }
    const r = await this.post(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${this.cfg.apiKey}`, { returnSecureToken: true });
    this.tokens = {
      uid: r.localId,
      refreshToken: r.refreshToken,
      idToken: r.idToken,
      expiresAt: this.now() + Number(r.expiresIn) * 1000,
    };
    this.persist();
    return { uid: r.localId, anonymous: true, label: '게스트' };
  }

  private async refresh(refreshToken: string): Promise<void> {
    const r = await this.post(
      `https://securetoken.googleapis.com/v1/token?key=${this.cfg.apiKey}`,
      { grant_type: 'refresh_token', refresh_token: refreshToken },
      true,
    );
    this.tokens = {
      uid: r.user_id,
      refreshToken: r.refresh_token,
      idToken: r.id_token,
      expiresAt: this.now() + Number(r.expires_in) * 1000,
    };
    this.persist();
  }

  private async token(): Promise<string> {
    if (!this.tokens) throw new Error('로그인이 필요해요');
    if (this.now() > this.tokens.expiresAt - 60_000) await this.refresh(this.tokens.refreshToken);
    return this.tokens.idToken;
  }

  private docUrl(uid: string): string {
    return `https://firestore.googleapis.com/v1/projects/${this.cfg.projectId}/databases/(default)/documents/users/${uid}`;
  }

  async load(user: CloudUser): Promise<CloudDoc | null> {
    const res = await this.fetcher(this.docUrl(user.uid), { headers: { Authorization: `Bearer ${await this.token()}` } });
    if (res.status === 404) return null;
    const json = (await res.json()) as { fields?: { save?: { stringValue: string }; updatedAt?: { integerValue: string } }; error?: { message?: string } };
    if (!res.ok) throw new Error(json.error?.message ?? `HTTP ${res.status}`);
    if (!json.fields?.save) return null;
    return { save: json.fields.save.stringValue, updatedAt: Number(json.fields.updatedAt?.integerValue ?? 0) };
  }

  async save(user: CloudUser, doc: CloudDoc): Promise<void> {
    const mask = ['save', 'updatedAt', 'version'].map((f) => `updateMask.fieldPaths=${f}`).join('&');
    const res = await this.fetcher(`${this.docUrl(user.uid)}?${mask}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${await this.token()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: {
          save: { stringValue: doc.save },
          updatedAt: { integerValue: String(doc.updatedAt) },
          version: { integerValue: '1' },
        },
      }),
    });
    if (!res.ok) {
      const json = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
      throw new Error(json.error?.message ?? `HTTP ${res.status}`);
    }
  }

  async signOut(): Promise<void> {
    this.tokens = null;
    try {
      this.storage?.removeItem(TOKEN_KEY);
    } catch {
      // 무시
    }
  }
}
