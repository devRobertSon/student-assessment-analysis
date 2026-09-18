// src/lib/cloud.ts — 구글 로그인 + Firestore 문서 실시간 동기화 훅
import { useEffect, useRef, useState } from 'react';
import {
  GoogleAuthProvider,
  User,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db, firebaseEnabled } from './firebase';

export function signInWithGoogle(): Promise<unknown> {
  if (!auth) return Promise.reject(new Error('cloud disabled'));
  return signInWithPopup(auth, new GoogleAuthProvider());
}
export function signOutCloud(): Promise<void> {
  if (!auth) return Promise.resolve();
  return signOut(auth);
}

export function useAuthUser(): { user: User | null; ready: boolean; enabled: boolean } {
  const [user, setUser] = useState<User | null>(auth?.currentUser ?? null);
  const [ready, setReady] = useState(!firebaseEnabled);
  useEffect(() => {
    if (!firebaseEnabled || !auth) {
      setReady(true);
      return;
    }
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setReady(true);
    });
  }, []);
  return { user, ready, enabled: firebaseEnabled };
}

export type CloudStatus = 'off' | 'signedout' | 'syncing' | 'synced' | 'denied' | 'error';

// 로컬(localStorage)을 즉시 쓰되, 로그인하면 Firestore의 sync/<name> 문서와 실시간 동기화.
// - 원격 스냅샷이 오면 로컬 상태를 갱신(쓰기 안 함)
// - 사용자가 값을 바꾸면 로컬 저장 + 디바운스 후 원격 저장
// - 원격 문서가 없으면 현재 로컬 값으로 최초 시딩
export function useCloudDoc<T>(
  name: string,
  loadLocal: () => T,
  saveLocal: (v: T) => void
): { value: T; setValue: (v: T) => void; status: CloudStatus } {
  const [value, setValueState] = useState<T>(() => loadLocal());
  const [status, setStatus] = useState<CloudStatus>(firebaseEnabled ? 'signedout' : 'off');
  const valueRef = useRef(value);
  valueRef.current = value;
  const writeTimer = useRef<number | undefined>(undefined);
  const { user } = useAuthUser();

  useEffect(() => {
    if (!firebaseEnabled || !db || !user) {
      setStatus(firebaseEnabled ? 'signedout' : 'off');
      return;
    }
    setStatus('syncing');
    const ref = doc(db, 'sync', name);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          // 최초 시딩: 현재 로컬 값을 클라우드에 올림
          setDoc(ref, { json: JSON.stringify(valueRef.current), updatedAt: serverTimestamp() }).catch(() => {});
          setStatus('synced');
          return;
        }
        const json = snap.data().json;
        if (typeof json === 'string') {
          try {
            const parsed = JSON.parse(json) as T;
            setValueState(parsed);
            saveLocal(parsed);
          } catch {
            /* 파싱 실패 무시 */
          }
        }
        setStatus('synced');
      },
      (err) => {
        setStatus((err as { code?: string }).code === 'permission-denied' ? 'denied' : 'error');
      }
    );
    return () => {
      window.clearTimeout(writeTimer.current);
      unsub();
    };
  }, [user, name]);

  const setValue = (next: T) => {
    setValueState(next);
    saveLocal(next);
    if (firebaseEnabled && db && user) {
      window.clearTimeout(writeTimer.current);
      writeTimer.current = window.setTimeout(() => {
        setDoc(doc(db!, 'sync', name), { json: JSON.stringify(next), updatedAt: serverTimestamp() }).catch(() => {});
      }, 500);
    }
  };

  return { value, setValue, status };
}
