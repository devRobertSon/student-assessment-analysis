import { describe, expect, it } from 'vitest';
import type { Student } from './assessment';
import { sortStudents } from './studentOrder';

const s = (name: string, p: Partial<Student> = {}): Student => ({ id: name + (p.school ?? '') + (p.grade ?? ''), name, grade: '중1', ...p });

describe('sortStudents', () => {
  it('등록한 차례가 아니라 가나다 차례로 놓는다', () => {
    const got = sortStudents([s('홍길동'), s('김민수'), s('이서연'), s('강하늘'), s('박지호')]);
    expect(got.map((x) => x.name)).toEqual(['강하늘', '김민수', '박지호', '이서연', '홍길동']);
  });

  it('동명이인은 학교, 그다음 학년으로 가른다. 학교를 안 적은 학생은 뒤에 온다', () => {
    const got = sortStudents([
      s('김민수', { grade: '중2' }),
      s('김민수', { school: '대치중', grade: '중3' }),
      s('김민수', { school: '대치중', grade: '중1' }),
      s('김민수', { school: '단대부중', grade: '중2' }),
    ]);
    expect(got.map((x) => `${x.school ?? '-'} ${x.grade}`)).toEqual(['단대부중 중2', '대치중 중1', '대치중 중3', '- 중2']);
  });

  it('받은 배열은 바꾸지 않는다', () => {
    const came = [s('홍길동'), s('강하늘')];
    sortStudents(came);
    expect(came.map((x) => x.name)).toEqual(['홍길동', '강하늘']);
  });
});
