import { characters, characterById, type CharacterInfo } from '../data/characters';
import { params } from '../debug/params';
import { saveStore } from '../save/store';

/**
 * 지금 플레이에 쓰는 캐릭터. 보통은 로비에서 고른 캐릭터이고,
 * 테스트용으로 주소에 ?char=chaosking 을 붙이면 저장된 선택과 무관하게 그 캐릭터로 한 판 한다 (저장은 바뀌지 않음).
 */
export function activeCharacter(): CharacterInfo {
  const forced = params.char && characters.some((c) => c.id === params.char) ? params.char : undefined;
  return characterById(forced ?? saveStore.data.selectedCharacter);
}
