// 실서버 점검: 게스트 로그인 → 읽기 → 쓰기 → 다시 읽기 (구글 로그인은 팝업이라 브라우저에서만 확인할 수 있다)
import { firebaseConfig } from '../src/online/firebaseConfig';
import { FirebaseBackend } from '../src/online/firebaseBackend';

const b = new FirebaseBackend(firebaseConfig);
try {
  const user = await b.init();
  console.log('1 게스트 로그인 OK', user.uid);
  const before = await b.load(user);
  console.log('2 처음 읽기', before === null ? 'null(문서 없음) OK' : '문서 있음 OK');
  await b.save(user, { save: JSON.stringify({ hello: 'check' }), updatedAt: Date.now() });
  console.log('3 쓰기 OK');
  const back = await b.load(user);
  console.log('4 다시 읽기', back?.save === '{"hello":"check"}' ? 'OK' : back);
  await b.signOut();
  console.log('5 로그아웃 OK');
} catch (e) {
  console.log('실패:', (e as Error).message);
}
process.exit(0);
