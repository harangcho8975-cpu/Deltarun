import { params } from '../debug/params';
import { saveStore } from '../save/store';
import { firebaseConfig } from './firebaseConfig';
import { FirebaseBackend } from './firebaseBackend';
import { CloudSync } from './sync';

/**
 * 클라우드 저장을 쓸지: 자동화 브라우저(e2e)·?offline=1·코인 디버그(?debug=1&coins=)에서는 끄고,
 * ?cloud=1 이면 항상 켠다. 꺼져 있으면 게임은 지금까지처럼 이 기기에만 저장한다.
 */
export const cloudEnabled =
  params.cloud || !(params.offline || (typeof navigator !== 'undefined' && navigator.webdriver) || (params.debug && params.coins !== undefined));

export const cloud: CloudSync | null = cloudEnabled ? new CloudSync(saveStore, new FirebaseBackend(firebaseConfig)) : null;

/** 접속하면 백그라운드에서 로그인·동기화한다 (실패해도 게임은 계속) */
export function startCloud(onChange?: () => void): void {
  if (!cloud) return;
  if (onChange) cloud.onChange(onChange);
  void cloud.start();
}
