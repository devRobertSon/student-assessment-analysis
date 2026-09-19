// src/lib/assessment.test.ts
import { describe, expect, it } from 'vitest';
import {
  Exam,
  examQuestionsFromCsv,
  parseCsv,
  hasAxis,
  isFullMark,
  makeMark,
  paperHref,
  DEFAULT_GRADE_LADDER,
  gradeFromLevels,
  levelGaps,
  retakeCheck,
  parseGradingCsv,
  pointsOf,
  scoreOf,
  statsForResult,
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

describe('statsForResult', () => {
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
    const marks = exam.questions.map((q, i) => makeMark(q, i === 1 ? 0 : 1));
    const stats = statsForResult(exam, marks);
    const density = stats.find((s) => s.type === '밀도')!;
    const photo = stats.find((s) => s.type === '광합성')!;
    expect(density).toMatchObject({ total: 2, correct: 1, rate: 0.5 });
    expect(photo).toMatchObject({ total: 2, correct: 2, rate: 1 });
    // 낮은 정답률이 먼저
    expect(stats[0].type).toBe('밀도');
  });

  it('실수로 유형을 둘 적어도 하나로 묶이지 않고 각 유형에 집계된다', () => {
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
    const stats = statsForResult(
      multi,
      multi.questions.map((q, i) => makeMark(q, i === 1 ? 0 : 1))
    );
    // 2번은 두 유형 모두에 오답으로 반영된다
    expect(stats.find((s) => s.type === '표현 해석')).toMatchObject({ total: 2, correct: 1 });
    expect(stats.find((s) => s.type === '다단계 해결')).toMatchObject({ total: 2, correct: 1 });
    // 유형별 문항 수의 합(4)은 실제 문항 수(3)보다 크다
    expect(stats.reduce((a, s) => a + s.total, 0)).toBe(4);
  });

  it('scoreOf: 배점을 안 적은 시험지는 한 문항 1점이라 득점률과 정답률이 같다', () => {
    const qs = [1, 2, 3].map((no) => ({ no, type: '밀도' }));
    const s = scoreOf(qs.map((q, i) => makeMark(q, i === 1 ? 0 : 1)));
    expect(s).toEqual({ correct: 2, total: 3, earned: 2, points: 3, rate: 2 / 3 });
  });
});

describe('서술형', () => {
  const exam: Exam = {
    id: 'e3',
    title: '중1-1 진단평가',
    subject: '수학',
    date: '2026-09-19',
    questions: [
      { no: 1, type: '규칙 발견', format: '객관식', points: 3 },
      { no: 2, type: '규칙 발견', format: '서술형', points: 5 },
    ],
  };

  it('서술형도 O/X만 구분한다. 배점을 다 받아야 맞은 것이다', () => {
    const stats = statsForResult(exam, [
      makeMark(exam.questions[0], 3),
      makeMark(exam.questions[1], 5),
    ]);
    expect(stats[0]).toMatchObject({ type: '규칙 발견', total: 2, correct: 2, earned: 8, points: 8 });
  });

  it('틀리면 배점이 커도 0점이다', () => {
    const stats = statsForResult(exam, [
      makeMark(exam.questions[0], 3),
      makeMark(exam.questions[1], 0),
    ]);
    expect(stats[0]).toMatchObject({ total: 2, correct: 1, earned: 3, points: 8 });
    expect(stats[0].rate).toBeCloseTo(3 / 8);
  });

  it('CSV의 형식 열을 읽어 서술형을 구분한다', () => {
    const { questions } = examQuestionsFromCsv(
      '문항번호,유형,형식,배점\n1,규칙 발견,객관식,3\n2,규칙 발견,서술형,5\n3,개념 이해,,4'
    );
    expect(questions.map((q) => q.format)).toEqual(['객관식', '서술형', undefined]);
    expect(questions[1].points).toBe(5);
  });

  it('득점은 0~배점 사이로 잘려서 기록된다', () => {
    const q = exam.questions[1]; // 5점짜리 서술형
    expect(makeMark(q, 99)).toEqual({ no: 2, earned: 5, points: 5 });
    expect(makeMark(q, -3)).toEqual({ no: 2, earned: 0, points: 5 });
    expect(isFullMark(makeMark(q, 5))).toBe(true);
    expect(isFullMark(makeMark(q, 4.5))).toBe(false);
  });
});

describe('parseGradingCsv', () => {
  it('OX 열을 읽는다. O는 맞음, X는 틀림, 빈칸은 미입력', () => {
    const { earned, date } = parseGradingCsv(
      '응시일,문항번호,배점,OX\n2026-09-19,1,3,O\n2026-09-19,2,5,X\n2026-09-19,3,3,'
    );
    expect(date).toBe('2026-09-19');
    // O가 몇 점인지는 시험지의 배점이 정한다. 3번은 미입력이라 빠진다.
    expect(earned).toEqual({ 1: 'full', 2: 0 });
  });

  it("'O'는 그 문항의 배점을 다 받는다", () => {
    const q = { no: 1, type: '계산', points: 3 };
    const { earned } = parseGradingCsv('문항번호,OX\n1,O');
    expect(earned[1]).toBe('full');
    const v = earned[1] === 'full' ? pointsOf(q) : earned[1];
    expect(makeMark(q, v)).toEqual({ no: 1, earned: 3, points: 3 });
  });

  it('득점 열이 있는 예전 표는 배점을 다 받았을 때만 O로 접는다', () => {
    const { earned } = parseGradingCsv(
      '문항번호,배점,득점,OX\n1,5,5,\n2,5,3,\n3,5,0,'
    );
    expect(earned).toEqual({ 1: 'full', 2: 0, 3: 0 });
  });
});

describe('문제지 · 해설 · 출제표', () => {
  it('CSV의 인쇄물 열을 시험지 정보로 읽는다 (첫 줄에만 적어도 된다)', () => {
    const r = examQuestionsFromCsv(
      [
        '시험지,문항번호,유형,문제지,해설,출제표',
        '중1-1 진단평가,1,연산·식 정리,중1-1_문제지.pdf,중1-1_해설.pdf,중1-1_출제표.csv',
        '중1-1 진단평가,2,개념 이해,,,',
      ].join('\n')
    );
    expect(r.errors).toEqual([]);
    expect(r.files).toEqual({
      paper: '중1-1_문제지.pdf',
      solution: '중1-1_해설.pdf',
      blueprint: '중1-1_출제표.csv',
    });
  });

  it('열이 없으면 비어 있다', () => {
    const r = examQuestionsFromCsv('문항번호,유형\n1,계산');
    expect(r.files).toBeUndefined();
  });

  it('paperHref: 파일 이름은 papers/ 아래로, 주소는 그대로', () => {
    expect(paperHref('중1-1 문제지.pdf', '/app/')).toBe('/app/papers/%EC%A4%911-1%20%EB%AC%B8%EC%A0%9C%EC%A7%80.pdf');
    // papers/ 를 같이 적었거나 앞에 슬래시를 붙였어도 한 번만 붙는다
    expect(paperHref('papers/a.pdf', '/app/')).toBe('/app/papers/a.pdf');
    expect(paperHref('/papers/a.pdf', '/app/')).toBe('/app/papers/a.pdf');
    // 외부 주소는 손대지 않는다
    expect(paperHref('https://drive.example/x.pdf', '/app/')).toBe('https://drive.example/x.pdf');
  });
});

const lvExam = (): Exam => {
  const mk = (n: number, level: string) => ({ no: n, type: '계산', points: 1, level });
  return {
    id: 'e', title: 't', subject: '수학', date: '',
    questions: [
      ...[1, 2, 3, 4, 5].map((n) => mk(n, '표준')),
      ...[6, 7, 8, 9].map((n) => mk(n, '상')),
      ...[10, 11, 12, 13].map((n) => mk(n, '최상')),
    ],
  };
};

describe('학원 기준 재수강 판정', () => {
  const exam = lvExam();
  const marks = (wrong: number[]) =>
    exam.questions.map((q) => makeMark(q, wrong.includes(q.no) ? 0 : 1));

  it('난이도를 가리지 않고 틀린 개수만 센다', () => {
    // 최상만 4개를 틀리든 표준만 4개를 틀리든 판정은 같다
    expect(retakeCheck(exam, marks([10, 11, 12, 13]))!).toMatchObject({ wrong: 4, pass: true });
    expect(retakeCheck(exam, marks([1, 2, 3, 4]))!).toMatchObject({ wrong: 4, pass: true });
    // 5개부터 재수강
    expect(retakeCheck(exam, marks([1, 2, 3, 4, 5]))!).toMatchObject({ wrong: 5, pass: false });
  });

  it('기준을 바꾸면 판정도 바뀐다', () => {
    expect(retakeCheck(exam, marks([1, 2, 3]), 3)!.pass).toBe(false);
    expect(retakeCheck(exam, marks([1, 2, 3]), 4)!.pass).toBe(true);
  });

  it('채점한 문항이 없으면 판정하지 않는다', () => {
    expect(retakeCheck(exam, [])).toBeNull();
  });
});

describe('기초 미달 · 심화 미달', () => {
  const exam = lvExam();
  const marks = (wrong: number[]) =>
    exam.questions.map((q) => makeMark(q, wrong.includes(q.no) ? 0 : 1));

  it('표준은 80%, 최상은 50%를 밑돌면 미달', () => {
    // 표준 5문항 중 1개 틀림 = 80% → 기준에 걸치므로 충족
    expect(levelGaps(exam, marks([1])).basic).toMatchObject({ wrong: 1, short: false });
    expect(levelGaps(exam, marks([1, 2])).basic).toMatchObject({ wrong: 2, short: true });
    // 최상 4문항 중 2개 틀림 = 50% → 충족
    expect(levelGaps(exam, marks([10, 11])).advanced).toMatchObject({ short: false });
    expect(levelGaps(exam, marks([10, 11, 12])).advanced).toMatchObject({ short: true });
  });

  it('두 미달은 서로 독립이다', () => {
    // 최상을 전부 틀린 학생 — 기초는 멀쩡하고 심화만 비었다
    const top = levelGaps(exam, marks([10, 11, 12, 13]));
    expect(top.basic!.short).toBe(false);
    expect(top.advanced!.short).toBe(true);
    // 표준만 흘린 학생 — 정반대
    const base = levelGaps(exam, marks([1, 2, 3]));
    expect(base.basic!.short).toBe(true);
    expect(base.advanced!.short).toBe(false);
  });

  it('그 난이도를 채점하지 않았으면 그 자리는 null', () => {
    const noTop: Exam = { ...exam, questions: exam.questions.filter((q) => q.level !== '최상') };
    expect(levelGaps(noTop, marks([1])).advanced).toBeNull();
  });
});

describe('예상 등급 (난이도 사다리)', () => {
  const lv = (표준: number, 상: number, 최상: number) =>
    [
      { type: '표준', total: 10, correct: 0, points: 10, earned: 0, rate: 표준 / 100 },
      { type: '상', total: 10, correct: 0, points: 10, earned: 0, rate: 상 / 100 },
      { type: '최상', total: 10, correct: 0, points: 10, earned: 0, rate: 최상 / 100 },
    ];

  it('위에서부터 내려오며 처음 걸리는 칸이 등급이다', () => {
    // 최상 80%는 첫 칸(최상 70%)에 걸린다
    expect(gradeFromLevels(lv(100, 100, 80))).toBe(1);
    // 최상 50%는 둘째 칸(최상 40%)
    expect(gradeFromLevels(lv(100, 100, 50))).toBe(2);
    // 최상이 모자라면 상을 본다
    expect(gradeFromLevels(lv(100, 85, 10))).toBe(3);
    expect(gradeFromLevels(lv(100, 65, 10))).toBe(4);
  });

  it('표준만 풀어내면 5등급 아래로 떨어진다', () => {
    expect(gradeFromLevels(lv(85, 10, 0))).toBe(5);
    expect(gradeFromLevels(lv(45, 10, 0))).toBe(7);
  });

  it('어느 칸에도 안 걸리면 마지막 등급이다', () => {
    expect(gradeFromLevels(lv(10, 0, 0))).toBe(DEFAULT_GRADE_LADDER.length + 1);
  });

  it('난이도를 안 적은 시험지는 등급을 지어내지 않는다', () => {
    expect(gradeFromLevels([])).toBeNull();
  });

  it('없는 난이도 칸은 건너뛴다', () => {
    // 최상 문항이 아예 없는 시험지
    const only = [
      { type: '표준', total: 10, correct: 0, points: 10, earned: 0, rate: 0.9 },
      { type: '상', total: 10, correct: 0, points: 10, earned: 0, rate: 0.9 },
    ];
    expect(gradeFromLevels(only)).toBe(3);
  });
});

describe('단원·난이도 축', () => {
  const csv = [
    '시험지,과목,문항번호,단원,유형,난이도,형식,배점,정답,출처,원문항',
    '중2-1 진단평가,수학,1,식의 계산,연산·식 정리,표준,객관식,3,③,심화,7',
    '중2-1 진단평가,수학,2,식의 계산,개념 이해,상,객관식,3,①,응용,12',
    '중2-1 진단평가,수학,3,부등식,표현 해석,최상,서술형,5,-4,심화,30',
  ].join('\n');

  it('CSV의 단원·난이도·출처·원문항을 읽는다', () => {
    const { questions, errors } = examQuestionsFromCsv(csv);
    expect(errors).toEqual([]);
    expect(questions[0]).toMatchObject({
      unit: '식의 계산', level: '표준', source: '심화', sourceNo: '7',
    });
    expect(questions[2]).toMatchObject({ unit: '부등식', level: '최상', format: '서술형' });
  });

  it('단원은 시험지에 나온 순서, 난이도는 표준→상→최상 순으로 집계된다', () => {
    const { questions } = examQuestionsFromCsv(csv);
    const exam: Exam = { id: 'e', title: 't', subject: '수학', date: '2026-09-19', questions };
    const marks = [
      makeMark(questions[0], 3),
      makeMark(questions[1], 0),
      makeMark(questions[2], 2),
    ];
    expect(statsForResult(exam, marks, 'unit').map((s) => s.type)).toEqual(['식의 계산', '부등식']);
    expect(statsForResult(exam, marks, 'level').map((s) => s.type)).toEqual(['표준', '상', '최상']);
    const 식 = statsForResult(exam, marks, 'unit')[0];
    expect(식).toMatchObject({ total: 2, correct: 1, earned: 3, points: 6 });
    expect(statsForResult(exam, marks, 'level')[2].rate).toBeCloseTo(0.4); // 최상 2/5
  });

  it('단원을 안 적은 시험지는 그 축을 쓸 수 없다', () => {
    const { questions } = examQuestionsFromCsv('문항번호,유형\n1,계산\n2,추론');
    const exam: Exam = { id: 'e', title: 't', subject: '수학', date: '', questions };
    expect(hasAxis(exam, 'type')).toBe(true);
    expect(hasAxis(exam, 'unit')).toBe(false);
    expect(hasAxis(exam, 'level')).toBe(false);
  });
});
