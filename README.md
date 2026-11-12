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

## 조작

| | 점프 (2단 가능) | 슬라이드 (누르는 동안) | 일시정지 |
| --- | --- | --- | --- |
| 터치·마우스 | 화면 왼쪽 절반 | 화면 오른쪽 절반 | 오른쪽 위 버튼 |
| 키보드 | Space, ↑, W | ↓, S | Esc, P |

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
