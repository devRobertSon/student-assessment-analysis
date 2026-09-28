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
  pointsOf,
  paperScore,
  gradeFromLevels,
  GRADE_CUTS,
  LOWEST_GRADE,
  DEFAULT_BASIC_CUT,
  basicGap,
  advancedGap,
  retakeCheck,
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

describe('주관식', () => {
  const exam: Exam = {
    id: 'e3',
    title: '중1-1 진단평가',
    subject: '수학',
    date: '2026-09-19',
    questions: [
      { no: 1, type: '규칙 발견', format: '객관식', points: 3 },
      { no: 2, type: '규칙 발견', format: '주관식', points: 5 },
    ],
  };

  it('주관식도 O/X만 구분한다. 배점을 다 받아야 맞은 것이다', () => {
    const stats = statsForResult(exam, [
      makeMark(exam.questions[0], 3),
      makeMark(exam.questions[1], 5),
    ]);
    expect(stats[0]).toMatchObject({ type: '규칙 발견', total: 2, correct: 2, earned: 8, points: 8 });
  });

  it('같은 문항 수를 맞혀도 배점이 큰 문항을 틀리면 정답률이 더 낮다', () => {
    // 정답률은 배점으로 잰다. 5문항 중 4개를 맞혀도 5점짜리를 틀렸으면 74%,
    // 3점짜리를 틀렸으면 80%다. 화면에서는 옆에 득점을 같이 적어 밝힌다.
    const { questions } = examQuestionsFromCsv(
      [
        '시험지,과목,문항번호,유형,배점,정답',
        ...[1, 2, 3, 4, 5].map((n) => `t,수학,${n},무거움,${n === 5 ? 5 : 3},①`),
        ...[6, 7, 8, 9, 10].map((n) => `t,수학,${n},가벼움,3,①`),
      ].join('\n')
    );
    const exam: Exam = { id: 'e', title: 't', subject: '수학', date: '2026-09-19', questions };
    // 무거움은 5점짜리를, 가벼움은 3점짜리를 하나씩 틀린다
    const marks = questions.map((q) => makeMark(q, q.no === 5 || q.no === 10 ? 0 : pointsOf(q)));
    const rows = statsForResult(exam, marks);
    const heavy = rows.find((s) => s.type === '무거움')!;
    const light = rows.find((s) => s.type === '가벼움')!;
    // 맞힌 문항 수는 둘 다 4/5
    expect(heavy.correct / heavy.total).toBe(light.correct / light.total);
    // 5점짜리를 틀린 쪽이 더 낮다
    expect(heavy).toMatchObject({ earned: 12, points: 17 });
    expect(light).toMatchObject({ earned: 12, points: 15 });
    expect(heavy.rate).toBeLessThan(light.rate);
    expect(light.rate).toBeCloseTo(0.8);
  });

  it('틀리면 배점이 커도 0점이다', () => {
    const stats = statsForResult(exam, [
      makeMark(exam.questions[0], 3),
      makeMark(exam.questions[1], 0),
    ]);
    expect(stats[0]).toMatchObject({ total: 2, correct: 1, earned: 3, points: 8 });
    expect(stats[0].rate).toBeCloseTo(3 / 8);
  });

  it('CSV의 형식 열을 읽어 주관식을 구분한다', () => {
    const { questions } = examQuestionsFromCsv(
      '문항번호,유형,형식,배점\n1,규칙 발견,객관식,3\n2,규칙 발견,주관식,5\n3,개념 이해,,4'
    );
    expect(questions.map((q) => q.format)).toEqual(['객관식', '주관식', undefined]);
    expect(questions[1].points).toBe(5);
  });

  // 2026-09-21 에 이름을 '주관식' 으로 바꾸기 전에 받아 둔 CSV 가 남아 있다.
  it('예전에 쓰던 서술형·논술형·서답형도 주관식으로 읽는다', () => {
    const { questions } = examQuestionsFromCsv(
      '문항번호,유형,형식,배점\n1,규칙 발견,서술형,5\n2,규칙 발견,논술형,5\n3,규칙 발견,서답형,5'
    );
    expect(questions.map((q) => q.format)).toEqual(['주관식', '주관식', '주관식']);
  });

  it('득점은 0~배점 사이로 잘려서 기록된다', () => {
    const q = exam.questions[1]; // 5점짜리 주관식
    expect(makeMark(q, 99)).toEqual({ no: 2, earned: 5, points: 5 });
    expect(makeMark(q, -3)).toEqual({ no: 2, earned: 0, points: 5 });
    expect(isFullMark(makeMark(q, 5))).toBe(true);
    expect(isFullMark(makeMark(q, 4.5))).toBe(false);
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
  const run = (from: number, count: number, level: string, points: number) =>
    Array.from({ length: count }, (_, i) => ({ no: from + i, type: '계산', points, level }));
  // 실제 진단평가와 같은 모양. 30문항 100점, 표준 5 · 상 15 · 최상 10.
  // 배점은 객관식 표준 2 · 상 3 · 최상 4 이고 주관식은 하나씩 더다.
  return {
    id: 'e', title: 't', subject: '수학', date: '',
    questions: [
      ...run(1, 5, '표준', 2), // 10점
      ...run(6, 13, '상', 3), // 39점
      ...run(19, 2, '상', 4), // 8점
      ...run(21, 7, '최상', 4), // 28점
      ...run(28, 3, '최상', 5), // 15점
    ],
  };
};

describe('학원 기준 재수강 판정', () => {
  const exam = lvExam();
  const marks = (wrong: number[]) =>
    exam.questions.map((q) => makeMark(q, wrong.includes(q.no) ? 0 : pointsOf(q)));

  // 기본 눈금은 표준·상 8점 · 최상 5점 · 40점부터 재수강
  it('표준·상은 5개부터 재수강', () => {
    expect(retakeCheck(exam, marks([1, 2, 3, 4]))!).toMatchObject({ points: 32, pass: true });
    expect(retakeCheck(exam, marks([1, 2, 3, 4, 5]))!).toMatchObject({ points: 40, pass: false });
  });

  it('최상은 8개부터 재수강. 일곱 개까지는 봐 준다', () => {
    expect(retakeCheck(exam, marks([21, 22, 23, 24, 25, 26, 27]))!)
      .toMatchObject({ wrongTop: 7, points: 35, pass: true });
    expect(retakeCheck(exam, marks([21, 22, 23, 24, 25, 26, 27, 28]))!)
      .toMatchObject({ wrongTop: 8, points: 40, pass: false });
  });

  it('섞여 틀리면 점수를 더해서 본다. 개수가 적어도 쉬운 쪽이 무겁다', () => {
    // 6개를 틀렸어도 넷이 최상이면 36점이라 통과
    expect(retakeCheck(exam, marks([1, 2, 21, 22, 23, 24]))!)
      .toMatchObject({ wrongBase: 2, wrongTop: 4, points: 36, pass: true });
    // 표준·상이 하나 더 늘면 44점이라 재수강
    expect(retakeCheck(exam, marks([1, 2, 3, 21, 22, 23, 24]))!)
      .toMatchObject({ points: 44, pass: false });
  });

  it('배점으로 재지 않는다. 싼 것만 틀려도 개수가 차면 재수강이다', () => {
    // 표준 다섯(10점) + 상 다섯(15점) = 25점이라 시험지 점수는 75점이지만,
    // 표준·상을 열 개나 틀렸으므로 재수강이다. 점수로 재던 것을 되돌린 자리다.
    const m = marks([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(retakeCheck(exam, m)!).toMatchObject({ wrongBase: 10, points: 80, pass: false });
  });

  it('눈금을 바꾸면 판정도 바뀐다', () => {
    const tight = { base: 8, top: 5, cut: 32 };
    expect(retakeCheck(exam, marks([1, 2, 3, 4]), tight)!.pass).toBe(false);
    expect(retakeCheck(exam, marks([1, 2, 3]), tight)!.pass).toBe(true);
  });

  it('난이도를 안 적은 문항은 표준·상 쪽으로 센다', () => {
    const plain: Exam = {
      ...exam,
      questions: [1, 2, 3, 4, 5].map((no) => ({ no, type: '계산', points: 1 })),
    };
    const all = plain.questions.map((q) => makeMark(q, 0));
    expect(retakeCheck(plain, all)!).toMatchObject({ wrongBase: 5, wrongTop: 0, pass: false });
  });

  it('채점한 문항이 없으면 판정하지 않는다', () => {
    expect(retakeCheck(exam, [])).toBeNull();
  });
});

describe('기초 미흡', () => {
  const exam = lvExam();
  const marks = (wrong: number[]) =>
    exam.questions.map((q) => makeMark(q, wrong.includes(q.no) ? 0 : pointsOf(q)));

  it('표준 다섯 중 세 개부터 미흡으로 본다', () => {
    expect(DEFAULT_BASIC_CUT).toBe(3);
    expect(basicGap(exam, marks([1, 2]))).toMatchObject({ wrong: 2, total: 5, short: false });
    expect(basicGap(exam, marks([1, 2, 3]))).toMatchObject({ wrong: 3, short: true });
  });

  it('예상 고교 등급이 막히는 자리와 같다', () => {
    const levels = (wrong: number[]) => statsForResult(exam, marks(wrong), 'level');
    expect(basicGap(exam, marks([1, 2]))!.short).toBe(false);
    expect(gradeFromLevels(levels([1, 2]))).toBe(1);
    expect(basicGap(exam, marks([1, 2, 3]))!.short).toBe(true);
    expect(gradeFromLevels(levels([1, 2, 3]))).toBe(3);
  });

  it('상·최상을 아무리 틀려도 기초 미흡으로는 안 잡힌다', () => {
    expect(basicGap(exam, marks([6, 7, 8, 9, 10, 21, 22, 23])))
      .toMatchObject({ wrong: 0, short: false });
  });

  it('표준 문항을 채점하지 않았으면 null', () => {
    const noBase: Exam = { ...exam, questions: exam.questions.filter((q) => q.level !== '표준') };
    expect(basicGap(noBase, marks([6]))).toBeNull();
  });
});

describe('심화 미흡', () => {
  const exam = lvExam();
  const marks = (wrong: number[]) =>
    exam.questions.map((q) => makeMark(q, wrong.includes(q.no) ? 0 : pointsOf(q)));

  it('최상을 5개부터 미달로 본다', () => {
    expect(advancedGap(exam, marks([21, 22, 23, 24]))).toMatchObject({ wrong: 4, short: false });
    expect(advancedGap(exam, marks([21, 22, 23, 24, 25]))).toMatchObject({ wrong: 5, short: true });
  });

  it('표준·상을 아무리 틀려도 심화 미흡으로는 안 잡힌다', () => {
    expect(advancedGap(exam, marks([1, 2, 3, 4, 5, 6, 7, 8]))).toMatchObject({ wrong: 0, short: false });
  });

  it('재수강이 아니어도 심화 미흡은 따로 뜬다', () => {
    // 최상 5개 = 25점이라 재수강은 아니지만 심화는 비어 있다
    const m = marks([21, 22, 23, 24, 25]);
    expect(retakeCheck(exam, m)!.pass).toBe(true);
    expect(advancedGap(exam, m)!.short).toBe(true);
  });

  it('기준을 바꾸면 미달선도 바뀐다', () => {
    expect(advancedGap(exam, marks([21, 22, 23]), 3)!.short).toBe(true);
  });

  it('최상 문항을 채점하지 않았으면 null', () => {
    const noTop: Exam = { ...exam, questions: exam.questions.filter((q) => q.level !== '최상') };
    expect(advancedGap(noTop, marks([1]))).toBeNull();
  });
});

describe('예상 등급 (시험지 점수)', () => {
  /** 표준은 다 맞히고 나머지로 점수를 맞춘 집계. 보정선이 걸리지 않는다. */
  const at = (score: number) => [
    { type: '표준', total: 5, correct: 5, points: 10, earned: 10, rate: 1 },
    { type: '상', total: 15, correct: 0, points: 45, earned: score - 10, rate: 0 },
    { type: '최상', total: 10, correct: 0, points: 45, earned: 0, rate: 0 },
  ];

  const exam = lvExam();
  /** 표준 다섯 문항 가운데 몇 개를 틀렸을 때의 집계. 나머지는 다 맞힌다. */
  const 표준틀림 = (n: number) =>
    statsForResult(
      exam,
      exam.questions.map((q) => makeMark(q, q.no <= n ? 0 : pointsOf(q))),
      'level'
    );

  it('점수는 배점을 그대로 더한 100점 만점이다', () => {
    expect(paperScore(at(100))).toBe(100);
    expect(paperScore(at(75))).toBe(75);
    expect(paperScore(표준틀림(5))).toBe(90); // 표준 10점만 잃었다
  });

  /** 표준까지 틀려 점수가 10점 아래인 경우. 보정선은 등급을 더 낮추기만 한다. */
  const low = (score: number) => [
    { type: '표준', total: 5, correct: 0, points: 10, earned: 0, rate: 0 },
    { type: '상', total: 15, correct: 0, points: 45, earned: score, rate: 0 },
    { type: '최상', total: 10, correct: 0, points: 45, earned: 0, rate: 0 },
  ];

  it('칸은 85 · 75 · 60 · 40 · 20 · 15 · 10 · 5 이고 그 아래는 9등급이다', () => {
    expect(GRADE_CUTS.map((c) => c.min)).toEqual([85, 75, 60, 40, 20, 15, 10, 5]);
    expect(LOWEST_GRADE).toBe(9);
  });

  it('위에서부터 내려오며 처음 걸리는 칸이 등급이다', () => {
    expect(gradeFromLevels(at(100))).toBe(1);
    expect(gradeFromLevels(at(85))).toBe(1);
    expect(gradeFromLevels(at(84))).toBe(2);
    expect(gradeFromLevels(at(75))).toBe(2);
    expect(gradeFromLevels(at(74))).toBe(3);
    expect(gradeFromLevels(at(60))).toBe(3);
    expect(gradeFromLevels(at(59))).toBe(4);
    expect(gradeFromLevels(at(40))).toBe(4);
    expect(gradeFromLevels(at(39))).toBe(5);
    expect(gradeFromLevels(at(20))).toBe(5);
    expect(gradeFromLevels(at(19))).toBe(6);
    expect(gradeFromLevels(at(15))).toBe(6);
    expect(gradeFromLevels(at(14))).toBe(7);
    expect(gradeFromLevels(at(10))).toBe(7);
    expect(gradeFromLevels(low(9))).toBe(8);
    expect(gradeFromLevels(low(5))).toBe(8);
    expect(gradeFromLevels(low(4))).toBe(9);
  });

  it('다 틀리면 0점이고 9등급이다', () => {
    const 전부틀림 = statsForResult(
      exam,
      exam.questions.map((q) => makeMark(q, 0)),
      'level'
    );
    expect(paperScore(전부틀림)).toBe(0);
    expect(gradeFromLevels(전부틀림)).toBe(9);
  });

  it('표준을 못 맞히면 점수가 높아도 위로 못 올라간다', () => {
    // 표준만 틀리면 점수는 94~90점이라 그대로 두면 1등급이 된다
    expect(paperScore(표준틀림(3))).toBe(94);
    expect(gradeFromLevels(표준틀림(2))).toBe(1); // 다섯 중 셋 맞힘
    expect(gradeFromLevels(표준틀림(3))).toBe(3); // 둘 맞힘
    expect(gradeFromLevels(표준틀림(4))).toBe(4); // 하나 맞힘
    expect(gradeFromLevels(표준틀림(5))).toBe(5); // 하나도 못 맞힘
  });

  it('보정선은 배점이 아니라 개수로 잰다', () => {
    // 표준에 3점짜리 주관식이 섞인 시험지. 배점으로 재면 두 개만 틀려도
    // 54.5%라 걸리지만, 개수로는 다섯 중 셋을 맞혔으므로 걸리지 않는다.
    const 섞인 = [
      { type: '표준', total: 5, correct: 3, points: 11, earned: 6, rate: 6 / 11 },
      { type: '상', total: 15, correct: 15, points: 45, earned: 45, rate: 1 },
      { type: '최상', total: 10, correct: 10, points: 44, earned: 44, rate: 1 },
    ];
    expect(섞인[0].rate).toBeLessThan(0.6);
    expect(섞인[0].correct / 섞인[0].total).toBe(0.6);
    expect(gradeFromLevels(섞인)).toBe(1);
  });

  it('난이도를 안 적은 시험지는 등급을 지어내지 않는다', () => {
    expect(gradeFromLevels([])).toBeNull();
    expect(paperScore([])).toBeNull();
  });
});

describe('단원·난이도 축', () => {
  const csv = [
    '시험지,과목,문항번호,단원,유형,난이도,형식,배점,정답,출처,원문항',
    '중2-1 진단평가,수학,1,식의 계산,연산·식 정리,표준,객관식,3,③,심화,7',
    '중2-1 진단평가,수학,2,식의 계산,개념 이해,상,객관식,3,①,응용,12',
    '중2-1 진단평가,수학,3,부등식,표현 해석,최상,주관식,5,-4,심화,30',
  ].join('\n');

  it('CSV의 단원·난이도·출처·원문항을 읽는다', () => {
    const { questions, errors } = examQuestionsFromCsv(csv);
    expect(errors).toEqual([]);
    expect(questions[0]).toMatchObject({
      unit: '식의 계산', level: '표준', source: '심화', sourceNo: '7',
    });
    expect(questions[2]).toMatchObject({ unit: '부등식', level: '최상', format: '주관식' });
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
