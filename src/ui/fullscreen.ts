// 전체화면 도우미. 브라우저는 사용자 입력(터치·클릭·키) 안에서만 전체화면을 허락한다.
// iPhone Safari는 일반 웹페이지의 전체화면을 지원하지 않아, '홈 화면에 추가'로 실행하면 전체화면(standalone)이 된다.
//
// 휴대폰 뒤로가기 처리: 전체화면에 들어갈 때 기록(history) 한 칸을 더 쌓아 두고,
// 뒤로가기를 누르면 그 칸이 먼저 소비되어 페이지를 떠나지 않고 전체화면과 가로 고정만 푼다.
// 가로 고정은 원래 세로였을 때만 풀고, 처음부터 가로였다면 건드리지 않는다.

type FsDoc = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void>;
};
type FsEl = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };
type Orientation = ScreenOrientation & {
  lock?: (o: string) => Promise<void>;
  unlock?: () => void;
};

const doc = document as FsDoc;
const root = document.documentElement as FsEl;

let historyPushed = false; // 전체화면용 기록 한 칸을 쌓아 두었는가
let suppressPop = false; // 우리가 history.back()으로 칸을 지울 때의 popstate는 무시
let lockedByUs = false; // 세로 → 가로로 우리가 바꾼 방향 고정인가

const isFullscreen = () => !!(document.fullscreenElement || doc.webkitFullscreenElement);
const isPortrait = () => (screen.orientation?.type ?? '').startsWith('portrait');

async function leaveFullscreen(): Promise<void> {
  if (lockedByUs) {
    try {
      (screen.orientation as Orientation).unlock?.();
    } catch {
      // 지원하지 않음
    }
    lockedByUs = false;
  }
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else if (doc.webkitFullscreenElement) await doc.webkitExitFullscreen?.();
  } catch {
    // 이미 나왔거나 지원하지 않음
  }
}

// 뒤로가기: 우리가 쌓은 칸이 소비되면 페이지를 떠나지 않고 전체화면만 푼다
window.addEventListener('popstate', () => {
  if (suppressPop) {
    suppressPop = false;
    return;
  }
  if (!historyPushed) return;
  historyPushed = false;
  void leaveFullscreen();
});

export const fullscreen = {
  /** 이 브라우저가 전체화면을 지원하는가 (iPhone Safari는 false) */
  supported(): boolean {
    return !!(root.requestFullscreen || root.webkitRequestFullscreen);
  },

  /**
   * 홈 화면에 설치한 앱으로 실행 중인가 (이때 브라우저 전체화면 요청은 필요 없다).
   * 주의: display-mode: fullscreen은 여기서 보지 않는다. 브라우저가 전체화면처럼 보이는 상태도 이 값이 true가 되어,
   * 그러면 다시 진입하는 코드가 막혀 버린다.
   */
  standalone(): boolean {
    return matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
  },

  /** 지금 전체화면인가 (또는 설치 앱이라 따로 할 일이 없는가) */
  active(): boolean {
    return isFullscreen() || this.standalone();
  },

  /** 전체화면 + 가로 고정. 사용자 터치 안에서 불러야 브라우저가 허락한다. */
  async enter(): Promise<void> {
    if (this.standalone()) return;
    const wasPortrait = isPortrait();
    // 뒤로가기 칸은 가장 먼저 쌓는다 (아래 요청이 응답하지 않아도 뒤로가기는 동작해야 한다)
    if (!historyPushed) {
      history.pushState({ deltaRunFullscreen: true }, '');
      historyPushed = true;
    }
    try {
      if (!isFullscreen()) await (root.requestFullscreen?.() ?? root.webkitRequestFullscreen?.());
    } catch {
      // 거부됨: 가로 고정만이라도 시도한다
    }
    try {
      const o = screen.orientation as Orientation;
      if (o?.lock) {
        await o.lock('landscape');
        // 세로에서 바꾼 경우에만 나갈 때 되돌린다
        lockedByUs = wasPortrait;
      }
    } catch {
      // 지원하지 않음 (iPhone Safari 등)
    }
  },

  /** 전체화면과 가로 고정을 풀고, 쌓아 둔 뒤로가기 칸도 정리한다 */
  async exit(): Promise<void> {
    await leaveFullscreen();
    if (historyPushed) {
      historyPushed = false;
      suppressPop = true;
      history.back();
    }
  },

  async toggle(): Promise<void> {
    if (this.standalone()) return;
    if (isFullscreen()) await this.exit();
    else await this.enter();
  },
};
