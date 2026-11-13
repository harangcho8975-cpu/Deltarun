// 선택할 수 있는 캐릭터. 이름·그림은 모두 자리표시이며, 게임 규칙(수치)에는 영향이 없다 (겉모습만 다름).
//
// 그림 규칙 (public/assets/manifest.json 의 키):
//   char_<id>              로비에 크게 보이는 캐릭터 (360×480, 발끝이 이미지 아래쪽)
//   <id>_run / _jump / _slide / _hit   게임 중 스프라이트. 없으면 공용 player_* 로 대신한다.
export interface CharacterInfo {
  id: string;
  name: string;
  tagline: string;
}

export const characters: CharacterInfo[] = [
  { id: 'orange', name: '오렌지', tagline: '아침 들판을 제일 먼저 달리는 러너' },
  { id: 'blueberry', name: '블루베리', tagline: '차분하게 구멍을 건너는 러너' },
  { id: 'mint', name: '민트', tagline: '젤리를 놓치지 않는 러너' },
];

export const DEFAULT_CHARACTER = characters[0].id;

export function characterById(id: string): CharacterInfo {
  return characters.find((c) => c.id === id) ?? characters[0];
}
