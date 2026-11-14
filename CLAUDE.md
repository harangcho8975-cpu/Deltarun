# delta run 작업 규칙

사용자와는 한국어로 대화한다.

## 변경할 때마다 (사용자 요청 규칙)

1. 확인: `npm test`, `npm run build`가 통과해야 한다. 화면이 바뀌면 `npm run e2e`도 돌리고 스크린샷으로 직접 본다.
2. 커밋하고 `main`에 push한다 (`git push origin main`). GitHub Actions가 몇 분 안에 GitHub Pages로 자동 배포한다.
3. **구현 설계 문서에 반영한다.** Claude Docs 문서 https://claude.ai/artifact/7TBiVzYQa1TXSjFBXnik9s 의 "구현 설계" 탭:
   - 바뀐 명세는 해당 장(파일 구조 2장, 씬 8장, 저장 11장, 테스트 12장 등)을 고친다.
   - 14장 "구현 현황과 변경 기록" 표 맨 위에 한 줄 추가: 날짜 · 변경 · 반영한 장 · 커밋 링크(`https://github.com/harangcho8975-cpu/Deltarun/commit/<해시>`).
   - 기획서 탭과 어긋나는 내용이 있으면 함께 고친다.
4. **답변 맨 끝에 테스트 링크를 단다:** https://harangcho8975-cpu.github.io/Deltarun/
   - 특정 화면을 바로 열 수 있으면 쿼리를 붙인다. 예: `?debug=1&stage=stage_02&x=9000`
   - 배포에 몇 분 걸린다는 점, 이 세션에서는 github.io에 접속할 수 없어 실제로 열리는지는 직접 확인하지 못한다는 점을 필요할 때 밝힌다.

## 설계 원칙 (자세한 내용은 문서의 구현 설계 탭)

- `src/sim/`은 Phaser를 import하지 않는다. 1틱 = 1/60초, 랜덤·시계 함수 금지. 같은 입력이면 같은 결과.
- 수치는 `src/config/gameConfig.ts`에만. 규칙 코드를 바꿔 결과가 달라지면 `SIM_VERSION`을 올리고 `npm run replays`로 리플레이를 다시 녹화한다.
- 맵은 `maps/*.tmj`(Tiled)를 고친 뒤 `npm run maps`. `src/data/stages/`는 직접 고치지 않는다.
- 에셋은 `public/assets/manifest.json`의 키로만 쓴다. `path: null`이면 플레이스홀더.
- 화면은 1280×720 고정(FIT). 휴대폰·PC가 같은 화면을 본다.
- 장르와 메커니즘만 참고하고, 캐릭터·이름·그림·소리는 원작(쿠키런 등)의 것을 쓰지 않는다.
