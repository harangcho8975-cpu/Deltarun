# delta run

가로 스크롤 오토 러너. 점프·슬라이드 두 버튼으로 장애물을 피하며 젤리를 모으고 결승점까지 달린다.
스테이지마다 맵이 고정되어 있어 같은 입력이면 언제나 같은 결과가 나온다. 휴대폰과 PC가 같은 화면(1280×720, 16:9)을 본다.

## 실행

```bash
npm install
npm run dev        # 개발 서버
npm run build      # 타입 검사 + dist/ 빌드
npm test           # 시뮬레이션·변환기·저장·리플레이·봇 테스트 (vitest)
npm run e2e        # 브라우저 스모크 + 화면 크기 4종 비교 (Playwright)
npm run maps       # maps/*.tmj → src/data/stages/*.json
npm run replays    # 봇으로 스테이지별 클리어 리플레이 재녹화
```

## 로비

- 가운데에 **선택한 캐릭터**가 서 있고, `◀ ▶`(또는 ←/→, A/D)로 바꾼다. 선택은 저장된다.
- 오른쪽 아래 **[플레이]**(또는 Enter/Space)를 누르면 세로로 긴 **스테이지 카드**가 가로로 늘어선다. 카드를 누르거나 `1`~`3` 키로 시작, `뒤로`(또는 Esc)로 돌아간다. 카드가 화면보다 많아지면 좌우로 끌어서 넘긴다.
- 가운데 캐릭터를 누르면(또는 `C`) **캐릭터 목록**이 격자로 열린다. 카드를 누르면 **캐릭터 정보** 화면(왼쪽 큰 그림, 오른쪽 이름·등급·스킬·소개, ◀▶로 넘기기)으로 들어가고, [선택하기]를 누르면 로비 캐릭터로 정해진다. 스킬은 아직 설명만 있고 게임에 적용되지 않는다.
- 캐릭터는 `src/data/characters.ts`에 추가한다. 겉모습만 다르고 게임 수치는 같다. 그림은 `manifest.json`의 `char_<id>`(로비용 360×480)와 `<id>_run`·`<id>_jump`·`<id>_slide`·`<id>_hit`(게임 중)을 쓰며, 게임 중 그림이 없으면 공용 `player_*`로 대신한다.

## 조작

| | 점프 (2단 가능) | 슬라이드 (누르는 동안) | 일시정지 |
| --- | --- | --- | --- |
| 터치·마우스 | 화면 왼쪽 절반 | 화면 오른쪽 절반 | 오른쪽 위 버튼 |
| 키보드 | Space, ↑, W | ↓, S | Esc, P |

## 전체화면

- **PC**: `F` 키, 타이틀의 "전체화면" 버튼, 일시정지 메뉴의 버튼.
- **안드로이드 Chrome**: 처음 화면을 터치하면 전체화면 + 가로 고정을 자동으로 시도한다.
- **iPhone Safari**: 일반 웹페이지의 전체화면을 지원하지 않는다. 공유 버튼 → "홈 화면에 추가"로 설치한 아이콘으로 열면 주소창 없이 전체화면(`manifest.webmanifest`, `apple-mobile-web-app-capable`)이 된다. 안드로이드도 같은 방법으로 설치하면 처음부터 전체화면으로 열린다.

## 이미지·사운드 교체

모든 에셋은 `public/assets/manifest.json`의 키로만 쓰인다. `path`가 `null`이면 색 사각형 플레이스홀더가 자동으로 생기고, 사운드는 무음이 된다.

1. 파일을 `public/assets/images/`(또는 `audio/`)에 넣는다. 스프라이트 시트는 프레임을 가로 한 줄로.
2. `manifest.json`에서 해당 키의 `path`를 `"images/player_run.png"`처럼 바꾸고, `width`·`height`(프레임 1개 크기)·`frames`를 맞춘다.
3. 코드는 고치지 않는다. 히트박스는 `src/config/gameConfig.ts` 값이라 이미지가 바뀌어도 난이도는 그대로다.

## 맵 편집

`maps/stage_0N.tmj`를 [Tiled](https://www.mapeditor.org/)로 열어 오브젝트 레이어(`ground`, `obstacles`, `jellies`, `items`, `goal`)를 고친 뒤:

```bash
npm run maps
```

```bash
npm run replays
```

`npm run maps`는 규칙 위반(구멍 위 장애물, 2단 점프로 못 넘는 구멍 등)이 있으면 오브젝트 번호와 함께 실패한다. 맵이나 수치를 바꾸면 `npm run replays`로 리플레이를 다시 녹화해야 `npm test`가 통과한다. 시뮬레이션 규칙(코드)을 바꿔 결과가 달라지면 `gameConfig.ts`의 `SIM_VERSION`을 올린다.

## 디버그 (`?debug=1`)

- 히트박스 표시, 정보 패널, `I` 무적, `1`~`4` 배속(×1/×2/×4/×0.25), `R` 리플레이 저장, 오른쪽 위 수치 조절 패널
- `?debug=1&stage=stage_02&x=9000`: 스테이지 2의 x=9000에서 바로 시작 (`stage_test`는 수기 테스트 맵)

## 구조

- `src/sim/` — 게임 규칙. Phaser를 쓰지 않는 순수 TypeScript, 1틱 = 1/60초 고정. `step(state, input)`이 상태를 전진시키고 이벤트를 돌려준다.
- `src/scenes/`, `src/render/`, `src/input/` — Phaser 화면·입력. 시뮬레이션 상태를 읽기만 한다.
- `src/data/stages/` — 변환기가 만든 스테이지 JSON (직접 고치지 않음)
- `scripts/` — Tiled 변환기, 리플레이 녹화
- `tests/`, `e2e/` — 테스트

## 아직 안 한 것

- PWA(설치·오프라인)와 배포(GitHub Pages / Netlify) — 호스팅을 정하면 추가
- Capacitor 앱 포장 (M5, 선택)
- 실제 이미지·사운드
