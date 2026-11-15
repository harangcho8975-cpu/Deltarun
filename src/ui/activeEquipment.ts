import { equipmentById, modsFor, type Equipment } from '../data/equipment';
import { params } from '../debug/params';
import type { Modifiers } from '../sim/modifiers';
import { saveStore } from '../save/store';

/**
 * 지금 플레이에 끼는 장비. 보통은 장비 화면에서 장착한 것이고,
 * 테스트용으로 주소에 ?equip=heart,armor 를 붙이면 저장된 장착과 무관하게 그 장비로 한 판 한다 (저장은 바뀌지 않음).
 */
export function activeEquipment(): Equipment[] {
  const ids = params.equip ?? saveStore.data.equipment.equipped;
  return ids.map((id) => equipmentById(id)).filter((e): e is Equipment => !!e);
}

export function activeMods(): Modifiers {
  return modsFor(activeEquipment().map((e) => e.id));
}
