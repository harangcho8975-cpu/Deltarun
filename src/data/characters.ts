// 선택할 수 있는 캐릭터. 이름·그림·설명은 모두 자리표시다.
// abilities는 정보 화면에 보여 주는 능력 목록이다. active가 true인 능력만 게임에서 실제로 동작하며,
// 동작은 skillId로 src/sim/skills.ts 에 연결된다. 능력이 없는 캐릭터는 abilities가 빈 목록이다.
//
// 그림 규칙 (public/assets/manifest.json 의 키):
//   char_<id>              로비·목록·정보 화면의 캐릭터 그림 (360×480, 발끝이 이미지 아래쪽)
//   <id>_run / _jump / _slide / _hit   게임 중 스프라이트. 없으면 공용 player_* 로 대신한다.
import type { SkillId } from '../sim/types';

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

export const RARITY: Record<Rarity, { label: string; color: number; css: string }> = {
  common: { label: '일반', color: 0x9aa0b4, css: '#9aa0b4' },
  rare: { label: '레어', color: 0x4a90e2, css: '#4a90e2' },
  epic: { label: '에픽', color: 0xa66cff, css: '#a66cff' },
  legendary: { label: '레전드', color: 0xf5a623, css: '#f5a623' },
};

export type AbilityKind = 'minor' | 'ultimate';

export const ABILITY_LABEL: Record<AbilityKind, string> = { minor: '소능력', ultimate: '대능력' };

export interface Ability {
  kind: AbilityKind;
  name: string;
  description: string;
  /** false면 설명만 있고 아직 게임에 적용되지 않는다 */
  active: boolean;
}

export interface CharacterInfo {
  id: string;
  name: string;
  tagline: string;
  rarity: Rarity;
  abilities: Ability[];
  /** 게임 중 실제로 동작하는 스킬 (sim/skills.ts) */
  skillId?: SkillId;
  story: string;
}

export const characters: CharacterInfo[] = [
  {
    id: 'orange',
    name: '오렌지',
    tagline: '아침 들판을 제일 먼저 달리는 러너',
    rarity: 'common',
    abilities: [{ kind: 'minor', name: '아침 질주', description: '출발 후 5초 동안 조금 더 빨리 달린다.', active: false }],
    story: '해가 뜨기 전부터 들판을 달려 온 러너. 누구보다 먼저 결승선을 보고 싶어서 오늘도 신발 끈을 꽉 묶는다.',
  },
  {
    id: 'blueberry',
    name: '블루베리',
    tagline: '차분하게 구멍을 건너는 러너',
    rarity: 'rare',
    abilities: [{ kind: 'minor', name: '차분한 착지', description: '2단 점프가 조금 더 높아진다.', active: false }],
    story: '협곡 마을에서 자란 조용한 러너. 서두르지 않고 한 번 더 뛰어오르는 법을 안다.',
  },
  {
    id: 'mint',
    name: '민트',
    tagline: '젤리를 놓치지 않는 러너',
    rarity: 'epic',
    abilities: [{ kind: 'minor', name: '젤리 감지', description: '가까운 젤리를 약하게 끌어당긴다.', active: false }],
    story: '반짝이는 것이라면 어디서든 찾아내는 러너. 주머니는 늘 젤리로 가득하다.',
  },
  {
    id: 'frisk',
    name: '프리스크',
    tagline: '아무 능력 없이 오직 달리기로 승부하는 러너',
    rarity: 'common',
    abilities: [],
    story: '특별한 힘은 없다. 점프와 슬라이드만으로 끝까지 달리는 가장 기본에 충실한 러너.',
  },
  {
    id: 'chaosking',
    name: '카오스 킹',
    tagline: '앞을 막는 장애물을 상자째 부수는 혼돈의 왕',
    rarity: 'legendary',
    skillId: 'chaosKing',
    abilities: [
      { kind: 'minor', name: '혼돈의 파쇄', description: '4초마다 화면 안의 장애물을 모두 부순다.', active: true },
      {
        kind: 'ultimate',
        name: '혼돈의 상자',
        description:
          '세 번째 발동은 소능력 대신 대능력이 나간다. 6초 동안 오른쪽에서 위아래로 움직이는 거대한 박스가 닿는 장애물을 부수고, 하나당 코인 10개를 모은다. 끝나면 박스가 폭발하며 코인이 쏟아진다. 대능력 중에는 소능력이 나가지 않는다.',
        active: true,
      },
    ],
    story: '왕관 하나 쓰고 나타나 길 위의 모든 것을 부수며 달리는 러너. 부순 만큼 주머니가 두둑해진다.',
  },
  {
    id: 'jevil',
    name: '제빌',
    tagline: '상자와 낫으로 길을 뒤엎는 광대',
    rarity: 'legendary',
    skillId: 'jevil',
    abilities: [
      {
        kind: 'minor',
        name: '깜짝 상자',
        description:
          '시작할 때와 대능력이 끝날 때마다 상자 스택이 2개 쌓인다. 땅에 닿지 않은 상태에서 슬라이드를 누르면 스택 1개를 써서 왼쪽 위에서 상자가 사선으로 날아와 터지고, 사방으로 퍼진 조각이 장애물을 부순다.',
        active: true,
      },
      {
        kind: 'ultimate',
        name: '혼돈의 비행',
        description:
          '20초마다 발동, 발동 중 무적. 3초 동안 상자 5개가 날아와 터지고, 2초 동안 앞으로 날아간 뒤 7초 동안 비행한다(누르면 상승, 떼면 하강, 슬라이드로 낫 휘두르기). 비행이 끝나면 거대한 낫이 3초 동안 천천히 떨어지다 화면 절반에서 섬광과 함께 화면 안의 장애물을 모두 부순다.',
        active: true,
      },
    ],
    story: '상자 속에서 튀어나와 낫을 휘두르며 하늘을 나는 광대. 어디로 튈지 아무도 모른다.',
  },
];

export const DEFAULT_CHARACTER = characters[0].id;

export function characterById(id: string): CharacterInfo {
  return characters.find((c) => c.id === id) ?? characters[0];
}

export function characterIndex(id: string): number {
  return Math.max(0, characters.findIndex((c) => c.id === id));
}
