import { params } from '../debug/params';
import { SaveStore } from './SaveStore';

/** 게임 전체가 공유하는 저장소 인스턴스 */
export const saveStore = new SaveStore();

// 개발용: 주소에 ?debug=1&coins=500 을 붙이면 코인을 그 값으로 맞춘다 (뽑기 시험용)
if (params.debug && params.coins !== undefined && Number.isFinite(params.coins)) saveStore.data.coins = Math.max(0, Math.floor(params.coins));
