// URL 쿼리로 켜는 개발용 옵션
const q = new URLSearchParams(typeof location === 'undefined' ? '' : location.search);

export const params = {
  debug: q.get('debug') === '1',
  /** 디버그: 이 x에서 시작 */
  startX: q.has('x') ? Number(q.get('x')) : undefined,
  /** 디버그: 타이틀을 건너뛰고 바로 이 스테이지 */
  stage: q.get('stage') ?? undefined,
  /** 테스트용: 저장된 선택과 무관하게 이 캐릭터로 플레이 (예: ?char=chaosking) */
  char: q.get('char') ?? undefined,
  /** 테스트용: 이 틱에서 시뮬레이션을 멈춘다 */
  freezeAt: q.has('freezeAt') ? Number(q.get('freezeAt')) : undefined,
};
