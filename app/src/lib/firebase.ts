// src/lib/firebase.ts — Firebase 초기화(구글 로그인 + Firestore 실시간 동기화)
//
// firebaseConfig 값은 공개용 식별자라 저장소에 그대로 두어도 됩니다.
// 실제 접근 통제는 Firestore 보안 규칙(허용 이메일 목록)으로 합니다. README 참고.
//
// ⚠ 아래는 아직 채워지지 않은 자리표시자입니다.
//    Firebase 콘솔 → 프로젝트 설정 → 내 앱 → 웹 앱의 firebaseConfig 값으로 교체하세요.
//    교체 전까지 firebaseEnabled가 false가 되어, 로그인 없이 브라우저 로컬 저장만으로 동작합니다.
import { initializeApp } from 'firebase/app';
import { Auth, getAuth } from 'firebase/auth';
import {
  Firestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'YOUR_API_KEY',
  authDomain: 'YOUR_PROJECT.firebaseapp.com',
  projectId: 'YOUR_PROJECT',
  storageBucket: 'YOUR_PROJECT.firebasestorage.app',
  messagingSenderId: 'YOUR_SENDER_ID',
  appId: 'YOUR_APP_ID',
};

export const firebaseEnabled = !!firebaseConfig.apiKey && !firebaseConfig.apiKey.startsWith('YOUR_');

let _auth: Auth | null = null;
let _db: Firestore | null = null;

if (firebaseEnabled) {
  try {
    const app = initializeApp(firebaseConfig);
    _auth = getAuth(app);
    _db = initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
  } catch (e) {
    // 초기화 실패 시 클라우드 없이 로컬 저장만 사용
    console.error('Firebase init failed', e);
    _auth = null;
    _db = null;
  }
}

export const auth = _auth;
export const db = _db;
