// src/lib/firebase.ts: Firebase 초기화(구글 로그인 + Firestore 실시간 동기화)
//
// firebaseConfig 값은 공개용 식별자라 저장소에 그대로 두어도 됩니다.
// 실제 접근 통제는 Firestore 보안 규칙(허용 이메일 목록)으로 합니다. README 참고.
//
// 프로젝트: student-assessment-analysis (이 앱 전용. 시간표 앱의 sodam-alpha와 별개)
import { initializeApp } from 'firebase/app';
import { Auth, getAuth } from 'firebase/auth';
import {
  Firestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyClA70Wj98DefrVbCI83lMCAa_wcTJH-M4',
  authDomain: 'student-assessment-analysis.firebaseapp.com',
  projectId: 'student-assessment-analysis',
  storageBucket: 'student-assessment-analysis.firebasestorage.app',
  messagingSenderId: '57850334277',
  appId: '1:57850334277:web:ae6f673bb11f683073a72c',
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
