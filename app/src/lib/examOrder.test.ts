import { describe, expect, it } from 'vitest';
import type { Exam } from './assessment';
import { gradeOf, sortExams } from './examOrder';

const exam = (title: string, subject = '수학'): Exam => ({
  id: title,
  title,
  subject,
  date: '2026-10-04',
  questions: [],
});

describe('gradeOf', () => {
  it('학교급 · 학년 · 학기를 읽는다', () => {
    expect(gradeOf('초6-1 진단평가')).toEqual({ level: 0, year: 6, term: 1 });
    expect(gradeOf('초6 진단평가')).toEqual({ level: 0, year: 6, term: null });
    expect(gradeOf('중3-2 진단평가')).toEqual({ level: 1, year: 3, term: 2 });
    expect(gradeOf('중1 과학 영재성평가')).toEqual({ level: 1, year: 1, term: null });
    expect(gradeOf('공통수학2 진단평가')).toEqual({ level: 2, year: 1, term: 2 });
  });

  it('읽지 못하면 null', () => {
    expect(gradeOf('모의고사')).toBeNull();
  });
});

describe('sortExams', () => {
  it('들어온 차례가 아니라 과목별 · 배우는 차례로 놓는다', () => {
    // 사이트에 실제로 들어온 차례 그대로다
    const came = [
      exam('중1 과학 영재성평가', '과학'),
      exam('중1-1 진단평가'),
      exam('중1-2 진단평가'),
      exam('중2 과학 영재성평가', '과학'),
      exam('중2-1 진단평가'),
      exam('중2-2 진단평가'),
      exam('중3-1 진단평가'),
      exam('중3-2 진단평가'),
      exam('공통수학1 진단평가'),
      exam('공통수학2 진단평가'),
      exam('초6-1 진단평가'),
      exam('초5 진단평가'),
      exam('초6 진단평가'),
    ];
    expect(sortExams(came).map((e) => e.title)).toEqual([
      '초5 진단평가',
      '초6-1 진단평가',
      '초6 진단평가',
      '중1-1 진단평가',
      '중1-2 진단평가',
      '중2-1 진단평가',
      '중2-2 진단평가',
      '중3-1 진단평가',
      '중3-2 진단평가',
      '공통수학1 진단평가',
      '공통수학2 진단평가',
      '중1 과학 영재성평가',
      '중2 과학 영재성평가',
    ]);
  });

  it('한 해짜리는 그 학년의 학기 시험지 뒤에 온다', () => {
    const got = sortExams([exam('초6 진단평가'), exam('초6-2 진단평가'), exam('초6-1 진단평가')]);
    expect(got.map((e) => e.title)).toEqual(['초6-1 진단평가', '초6-2 진단평가', '초6 진단평가']);
  });

  it('모르는 과목은 뒤에 가나다 차례로, 학년을 못 읽은 것은 그 과목 맨 뒤에 온다', () => {
    const got = sortExams([
      exam('영어 단어 시험', '영어'),
      exam('모의고사'),
      exam('국어 문법', '국어'),
      exam('중1-1 진단평가'),
    ]);
    expect(got.map((e) => e.title)).toEqual(['중1-1 진단평가', '모의고사', '국어 문법', '영어 단어 시험']);
  });

  it('받은 배열은 바꾸지 않는다', () => {
    const came = [exam('중1-1 진단평가'), exam('초5 진단평가')];
    sortExams(came);
    expect(came.map((e) => e.title)).toEqual(['중1-1 진단평가', '초5 진단평가']);
  });
});
