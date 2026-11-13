// 전체화면 도우미. 브라우저는 사용자 입력(터치·클릭·키) 안에서만 전체화면을 허락한다.
// iPhone Safari는 일반 웹페이지의 전체화면을 지원하지 않아, '홈 화면에 추가'로 실행하면 전체화면(standalone)이 된다.

type FsDoc = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void>;
};
type FsEl = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };

const doc = document as FsDoc;
const root = document.documentElement as FsEl;

export const fullscreen = {
  /** 이 브라우저가 전체화면을 지원하는가 (iPhone Safari는 false) */
  supported(): boolean {
    return !!(root.requestFullscreen || root.webkitRequestFullscreen);
  },

  /**
   * 홈 화면 앱으로 설치돼 실행 중인가. 이때는 이미 전체화면이다.
   * 주의: 전체화면 API로 들어간 상태도 display-mode: fullscreen으로 잡히므로, API 전체화면 중에는 설치 앱으로 보지 않는다.
   */
  standalone(): boolean {
    if (document.fullscreenElement || doc.webkitFullscreenElement) return false;
    return matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
  },

  active(): boolean {
    return !!(document.fullscreenElement || doc.webkitFullscreenElement) || this.standalone();
  },

  async enter(): Promise<void> {
    try {
      if (!this.active()) await (root.requestFullscreen?.() ?? root.webkitRequestFullscreen?.());
      // 가로 고정은 지원하는 브라우저(안드로이드 Chrome)에서만 된다
      const o = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
      await o.lock?.('landscape');
    } catch {
      // 거부되거나 지원하지 않음: 그냥 넘어간다
    }
  },

  async exit(): Promise<void> {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (doc.webkitFullscreenElement) await doc.webkitExitFullscreen?.();
    } catch {
      // 무시
    }
  },

  async toggle(): Promise<void> {
    if (this.standalone()) return;
    if (document.fullscreenElement || doc.webkitFullscreenElement) await this.exit();
    else await this.enter();
  },
};
