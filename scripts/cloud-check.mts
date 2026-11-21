import { firebaseConfig } from '../src/online/firebaseConfig';
import { RestBackend } from '../src/online/restBackend';

const mem = new Map<string, string>();
const storage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) };
const b = new RestBackend(firebaseConfig, fetch, storage);
try {
  const user = await b.init();
  console.log('1 게스트 로그인 OK', user.uid);
  const before = await b.load(user);
  console.log('2 처음 읽기', before === null ? 'null(문서 없음) OK' : before);
  await b.save(user, { save: JSON.stringify({ hello: 'live-test' }), updatedAt: Date.now() });
  console.log('3 쓰기 OK');
  const back = await b.load(user);
  console.log('4 다시 읽기', back?.save);
  // 두 번째 접속: 저장된 로그인 복원
  const b2 = new RestBackend(firebaseConfig, fetch, storage);
  const user2 = await b2.init();
  console.log('5 로그인 복원', user2.uid === user.uid ? '같은 uid OK' : '다른 uid!');
} catch (e) {
  console.log('실패:', (e as Error).message);
}
