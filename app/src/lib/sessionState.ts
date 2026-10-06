// src/lib/sessionState.ts
//
// 화면에서 고른 학생 · 시험지를 F5 로 새로 불러와도 남기는 자리. 이 탭의
// sessionStorage 에 적는다. 탭을 닫으면 사라지고, 다른 탭과 섞이지 않는다.
// 채점 결과 같은 자료가 아니라 '무엇을 보고 있었는가' 만 적는다.
//
// 저장소를 못 쓰는 창(사생활 보호 모드 등)에서는 적지 못한 채 보통 useState
// 처럼 돈다.

import { Dispatch, SetStateAction, useEffect, useState } from 'react';

const PREFIX = 'sda.ui.';

/** 적어 둔 값. 없거나 읽지 못하면 fallback. */
export function readSession<T>(key: string, fallback: T): T {
  try {
    const raw = window.sessionStorage.getItem(PREFIX + key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function writeSession(key: string, value: unknown): void {
  try {
    window.sessionStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // 못 적어도 화면은 그대로 돈다. 새로 불러오면 처음부터 고를 뿐이다.
  }
}

/** 새로 불러와도 값이 남는 useState. */
export function useSessionState<T>(key: string, initial: T): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => readSession(key, initial));
  useEffect(() => writeSession(key, value), [key, value]);
  return [value, setValue];
}
