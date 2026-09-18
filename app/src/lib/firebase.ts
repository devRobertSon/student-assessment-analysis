// src/lib/firebase.ts — Firebase 초기화(구글 로그인 + Firestore 실시간 동기화)
// firebaseConfig 값은 공개용 식별자이며, 실제 접근 통제는 Firestore 보안 규칙(허용 이메일)으로 함.
import { initializeApp } from 'firebase/app';
import { Auth, getAuth } from 'firebase/auth';
import {
  Firestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'YOUR_FIREBASE_API_KEY',
  authDomain: 'sodam-alpha.firebaseapp.com',
  projectId: 'sodam-alpha',
  storageBucket: 'sodam-alpha.firebasestorage.app',
  messagingSenderId: '494030326962',
  appId: '1:494030326962:web:0c5c7070970e7853724dab',
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
