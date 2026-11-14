// 선택할 수 있는 캐릭터. 이름·그림·설명은 모두 자리표시다.
// 지금은 겉모습만 다르고 게임 수치는 같다. skill은 정보 화면에 보여 주는 기획 내용이며,
// 아직 게임에 적용되지 않는다 (skill.active === false).
//
// 그림 규칙 (public/assets/manifest.json 의 키):
//   char_<id>              로비·목록·정보 화면의 캐릭터 그림 (360×480, 발끝이 이미지 아래쪽)
//   <id>_run / _jump / _slide / _hit   게임 중 스프라이트. 없으면 공용 player_* 로 대신한다.

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

export const RARITY: Record<Rarity, { label: string; color: number; css: string }> = {
  common: { label: '일반', color: 0x9aa0b4, css: '#9aa0b4' },
  rare: { label: '레어', color: 0x4a90e2, css: '#4a90e2' },
  epic: { label: '에픽', color: 0xa66cff, css: '#a66cff' },
  legendary: { label: '레전드', color: 0xf5a623, css: '#f5a623' },
};

export interface CharacterInfo {
  id: string;
  name: string;
  tagline: string;
  rarity: Rarity;
  skill: { name: string; description: string; active: boolean };
  story: string;
}

export const characters: CharacterInfo[] = [
  {
    id: 'orange',
    name: '오렌지',
    tagline: '아침 들판을 제일 먼저 달리는 러너',
    rarity: 'common',
    skill: { name: '아침 질주', description: '출발 후 5초 동안 조금 더 빨리 달린다.', active: false },
    story: '해가 뜨기 전부터 들판을 달려 온 러너. 누구보다 먼저 결승선을 보고 싶어서 오늘도 신발 끈을 꽉 묶는다.',
  },
  {
    id: 'blueberry',
    name: '블루베리',
    tagline: '차분하게 구멍을 건너는 러너',
    rarity: 'rare',
    skill: { name: '차분한 착지', description: '2단 점프가 조금 더 높아진다.', active: false },
    story: '협곡 마을에서 자란 조용한 러너. 서두르지 않고 한 번 더 뛰어오르는 법을 안다.',
  },
  {
    id: 'mint',
    name: '민트',
    tagline: '젤리를 놓치지 않는 러너',
    rarity: 'epic',
    skill: { name: '젤리 감지', description: '가까운 젤리를 약하게 끌어당긴다.', active: false },
    story: '반짝이는 것이라면 어디서든 찾아내는 러너. 주머니는 늘 젤리로 가득하다.',
  },
];

export const DEFAULT_CHARACTER = characters[0].id;

export function characterById(id: string): CharacterInfo {
  return characters.find((c) => c.id === id) ?? characters[0];
}

export function characterIndex(id: string): number {
  return Math.max(0, characters.findIndex((c) => c.id === id));
}
