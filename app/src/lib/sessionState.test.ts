import { afterEach, describe, expect, it, vi } from 'vitest';
import { readSession, writeSession } from './sessionState';

/** 브라우저의 sessionStorage 를 흉내 낸다. 테스트는 node 에서 돈다. */
function fakeStorage() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => void m.set(k, v),
    raw: m,
  };
}

afterEach(() => vi.unstubAllGlobals());

describe('readSession · writeSession', () => {
  it('적은 값을 그대로 읽는다', () => {
    const s = fakeStorage();
    vi.stubGlobal('window', { sessionStorage: s });
    writeSession('grading.exam', 'ex-중1-1');
    writeSession('report', { studentId: 'stu1', ids: ['r1', 'r2'] });
    expect(readSession('grading.exam', '')).toBe('ex-중1-1');
    expect(readSession('report', null)).toEqual({ studentId: 'stu1', ids: ['r1', 'r2'] });
    // 앱의 다른 자리와 겹치지 않게 이름 앞에 sda.ui. 를 붙인다
    expect([...s.raw.keys()]).toEqual(['sda.ui.grading.exam', 'sda.ui.report']);
  });

  it('적은 적이 없으면 fallback', () => {
    vi.stubGlobal('window', { sessionStorage: fakeStorage() });
    expect(readSession('student', '')).toBe('');
  });

  it('저장소를 못 쓰거나 값이 깨져 있어도 멈추지 않는다', () => {
    vi.stubGlobal('window', {
      sessionStorage: {
        getItem: () => {
          throw new Error('blocked');
        },
        setItem: () => {
          throw new Error('blocked');
        },
      },
    });
    expect(() => writeSession('student', 'stu1')).not.toThrow();
    expect(readSession('student', 'none')).toBe('none');

    const s = fakeStorage();
    s.setItem('sda.ui.student', '{깨진');
    vi.stubGlobal('window', { sessionStorage: s });
    expect(readSession('student', 'none')).toBe('none');
  });
});
