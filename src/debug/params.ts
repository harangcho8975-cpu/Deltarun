// URL 쿼리로 켜는 개발용 옵션
const q = new URLSearchParams(typeof location === 'undefined' ? '' : location.search);

export const params = {
  debug: q.get('debug') === '1',
  /** 디버그: 이 x에서 시작 */
  startX: q.has('x') ? Number(q.get('x')) : undefined,
  /** 디버그: 타이틀을 건너뛰고 바로 이 스테이지 */
  stage: q.get('stage') ?? undefined,
  /** 테스트용: 주소에 ?god=1 을 붙이면 처음부터 무적 디버그(피격·체력 감소 무시)로 시작한다 */
  god: q.get('god') === '1',
  /** 테스트용: 저장된 선택과 무관하게 이 캐릭터로 플레이 (예: ?char=chaosking) */
  char: q.get('char') ?? undefined,
  /** 테스트용: ?coins=500 으로 코인을 이만큼으로 맞춘다 (뽑기 시험용, 주소에 debug=1도 필요) */
  coins: q.has('coins') ? Number(q.get('coins')) : undefined,
  /** 테스트용: ?equip=heart,armor 처럼 저장과 무관하게 이 장비를 끼고 한 판 한다 (최대 3개) */
  equip: q.get('equip') ? q.get('equip')!.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 3) : undefined,
  /** 테스트용: ?ult=2 이면 제빌 대능력이 2초 뒤에 시작한다 (기본 20초) */
  ult: q.has('ult') ? Number(q.get('ult')) : undefined,
  /** 테스트용: ?offline=1 이면 클라우드 저장을 쓰지 않는다 */
  offline: q.get('offline') === '1',
  /** 테스트용: ?cloud=1 이면 자동화 브라우저에서도 클라우드를 켠다 */
  cloud: q.get('cloud') === '1',
  /** 테스트용: 이 틱에서 시뮬레이션을 멈춘다 */
  freezeAt: q.has('freezeAt') ? Number(q.get('freezeAt')) : undefined,
};
