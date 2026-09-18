// src/lib/assessment.test.ts
import { describe, expect, it } from 'vitest';
import {
  Exam,
  examQuestionsFromCsv,
  parseCsv,
  scoreOf,
  typeStatsForResult,
} from './assessment';

describe('parseCsv', () => {
  it('기본 파싱 + 헤더/행', () => {
    const rows = parseCsv('a,b\n1,2\n3,4');
    expect(rows).toEqual([['a', 'b'], ['1', '2'], ['3', '4']]);
  });
  it('따옴표 안 쉼표를 하나의 필드로 처리', () => {
    const rows = parseCsv('name,note\n"김,철수","줄1"');
    expect(rows[1]).toEqual(['김,철수', '줄1']);
  });
  it('CRLF와 BOM 처리, 빈 줄 제거', () => {
    const rows = parseCsv('﻿a,b\r\n1,2\r\n\r\n');
    expect(rows).toEqual([['a', 'b'], ['1', '2']]);
  });
});

describe('examQuestionsFromCsv', () => {
  const csv = [
    '시험지,과목,문항번호,유형,정답,배점',
    '중2 진단,과학,1,밀도,3,1',
    '중2 진단,과학,2,광합성,1,2',
    '중2 진단,과학,3,밀도,4,1',
  ].join('\n');

  it('문항 수·유형·메타를 읽는다', () => {
    const r = examQuestionsFromCsv(csv);
    expect(r.errors).toEqual([]);
    expect(r.title).toBe('중2 진단');
    expect(r.subject).toBe('과학');
    expect(r.questions).toHaveLength(3);
    expect(r.questions[1]).toMatchObject({ no: 2, type: '광합성', answer: '1', points: 2 });
  });

  it('문항번호 순으로 정렬한다', () => {
    const r = examQuestionsFromCsv('번호,유형\n3,C\n1,A\n2,B');
    expect(r.questions.map((q) => q.no)).toEqual([1, 2, 3]);
    expect(r.questions.map((q) => q.type)).toEqual(['A', 'B', 'C']);
  });

  it('영문/별칭 헤더도 인식한다', () => {
    const r = examQuestionsFromCsv('no,type\n1,Algebra\n2,Geometry');
    expect(r.questions).toHaveLength(2);
    expect(r.questions[0].type).toBe('Algebra');
  });

  it('모르는 열(수업 등)이 섞여 있어도 무시하고 읽는다', () => {
    const r = examQuestionsFromCsv('시험지,수업,문항번호,유형\n1차 진단,진단테스트,1,계산\n1차 진단,진단테스트,2,추론');
    expect(r.title).toBe('1차 진단');
    expect(r.questions).toHaveLength(2);
    expect(r.questions.map((q) => q.type)).toEqual(['계산', '추론']);
  });

  it('필수 열이 없으면 에러', () => {
    const r = examQuestionsFromCsv('과목,정답\n과학,3');
    expect(r.questions).toHaveLength(0);
    expect(r.errors[0]).toContain('필수 열');
  });
});

describe('typeStatsForResult', () => {
  const exam: Exam = {
    id: 'e1',
    title: 't',
    subject: '과학',
    date: '2026-07-04',
    questions: [
      { no: 1, type: '밀도' },
      { no: 2, type: '밀도' },
      { no: 3, type: '광합성' },
      { no: 4, type: '광합성' },
    ],
  };

  it('유형별 정답률을 집계하고 낮은 순으로 정렬', () => {
    const marks = [
      { no: 1, correct: true },
      { no: 2, correct: false },
      { no: 3, correct: true },
      { no: 4, correct: true },
    ];
    const stats = typeStatsForResult(exam, marks);
    const density = stats.find((s) => s.type === '밀도')!;
    const photo = stats.find((s) => s.type === '광합성')!;
    expect(density).toMatchObject({ total: 2, correct: 1, rate: 0.5 });
    expect(photo).toMatchObject({ total: 2, correct: 2, rate: 1 });
    // 낮은 정답률이 먼저
    expect(stats[0].type).toBe('밀도');
  });

  it('한 문항에 유형이 여러 개면 각 유형에 모두 집계된다', () => {
    const multi: Exam = {
      id: 'e2',
      title: 't2',
      subject: '수학',
      date: '2026-09-19',
      questions: [
        { no: 1, type: '표현 해석' },
        { no: 2, type: '표현 해석;다단계 해결' },
        { no: 3, type: '다단계 해결' },
      ],
    };
    const stats = typeStatsForResult(multi, [
      { no: 1, correct: true },
      { no: 2, correct: false },
      { no: 3, correct: true },
    ]);
    // 2번은 두 유형 모두에 오답으로 반영된다
    expect(stats.find((s) => s.type === '표현 해석')).toMatchObject({ total: 2, correct: 1 });
    expect(stats.find((s) => s.type === '다단계 해결')).toMatchObject({ total: 2, correct: 1 });
    // 유형별 문항 수의 합(4)은 실제 문항 수(3)보다 크다
    expect(stats.reduce((a, s) => a + s.total, 0)).toBe(4);
  });

  it('scoreOf: 전체 점수/정답률', () => {
    const s = scoreOf([
      { no: 1, correct: true },
      { no: 2, correct: false },
      { no: 3, correct: true },
    ]);
    expect(s).toEqual({ correct: 2, total: 3, rate: 2 / 3 });
  });
});
