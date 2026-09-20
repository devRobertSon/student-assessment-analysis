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
  scaledScore,
  gradeFromLevels,
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
  const run = (from: number, count: number, level: string) =>
    Array.from({ length: count }, (_, i) => mk(from + i, level));
  // 실제 진단평가와 같은 모양. 표준 1~8, 상 9~22, 최상 23~30.
  return {
    id: 'e', title: 't', subject: '수학', date: '',
    questions: [...run(1, 8, '표준'), ...run(9, 14, '상'), ...run(23, 8, '최상')],
  };
};

describe('학원 기준 재수강 판정', () => {
  const exam = lvExam();
  const marks = (wrong: number[]) =>
    exam.questions.map((q) => makeMark(q, wrong.includes(q.no) ? 0 : 1));

  // 기본 눈금은 표준·상 8점 · 최상 5점 · 40점부터 재수강
  it('표준·상은 5개부터 재수강', () => {
    expect(retakeCheck(exam, marks([1, 2, 3, 4]))!).toMatchObject({ points: 32, pass: true });
    expect(retakeCheck(exam, marks([1, 2, 3, 4, 5]))!).toMatchObject({ points: 40, pass: false });
  });

  it('최상은 8개부터 재수강. 일곱 개까지는 봐 준다', () => {
    expect(retakeCheck(exam, marks([23, 24, 25, 26, 27, 28, 29]))!)
      .toMatchObject({ wrongTop: 7, points: 35, pass: true });
    expect(retakeCheck(exam, marks([23, 24, 25, 26, 27, 28, 29, 30]))!)
      .toMatchObject({ wrongTop: 8, points: 40, pass: false });
  });

  it('섞여 틀리면 점수를 더해서 본다. 개수가 적어도 쉬운 쪽이 무겁다', () => {
    // 6개를 틀렸어도 넷이 최상이면 36점이라 통과
    expect(retakeCheck(exam, marks([1, 2, 23, 24, 25, 26]))!)
      .toMatchObject({ wrongBase: 2, wrongTop: 4, points: 36, pass: true });
    // 표준·상이 하나 더 늘면 44점이라 재수강
    expect(retakeCheck(exam, marks([1, 2, 3, 23, 24, 25, 26]))!)
      .toMatchObject({ points: 44, pass: false });
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

describe('심화 미달', () => {
  const exam = lvExam();
  const marks = (wrong: number[]) =>
    exam.questions.map((q) => makeMark(q, wrong.includes(q.no) ? 0 : 1));

  it('최상을 5개부터 미달로 본다', () => {
    expect(advancedGap(exam, marks([23, 24, 25, 26]))).toMatchObject({ wrong: 4, short: false });
    expect(advancedGap(exam, marks([23, 24, 25, 26, 27]))).toMatchObject({ wrong: 5, short: true });
  });

  it('표준·상을 아무리 틀려도 심화 미달로는 안 잡힌다', () => {
    // 기초 쪽은 재수강 판정이 먼저 걸리므로 여기서 다시 세지 않는다.
    expect(advancedGap(exam, marks([1, 2, 3, 4, 5, 6, 7, 8]))).toMatchObject({ wrong: 0, short: false });
  });

  it('재수강이 아니어도 심화 미달은 따로 뜬다', () => {
    // 최상 5개 = 25점이라 재수강은 아니지만 심화는 비어 있다
    const m = marks([23, 24, 25, 26, 27]);
    expect(retakeCheck(exam, m)!.pass).toBe(true);
    expect(advancedGap(exam, m)!.short).toBe(true);
  });

  it('기준을 바꾸면 미달선도 바뀐다', () => {
    expect(advancedGap(exam, marks([23, 24, 25]), 3)!.short).toBe(true);
  });

  it('최상 문항을 채점하지 않았으면 null', () => {
    const noTop: Exam = { ...exam, questions: exam.questions.filter((q) => q.level !== '최상') };
    expect(advancedGap(noTop, marks([1]))).toBeNull();
  });
});

describe('예상 등급 (난이도 환산점수)', () => {
  /** 난이도마다 10문항. 무게 만점은 10×1 + 10×2 + 10×3 = 60점이다. */
  const lv = (표준: number, 상: number, 최상: number) =>
    [
      ['표준', 표준],
      ['상', 상],
      ['최상', 최상],
    ].map(([type, pct]) => ({
      type: type as string,
      total: 10,
      correct: ((pct as number) / 10),
      points: 10,
      earned: 0,
      rate: (pct as number) / 100,
    }));

  it('환산점수는 난이도 무게로 매기고 50~100 사이에 편다', () => {
    expect(scaledScore(lv(100, 100, 100))).toBe(100);
    expect(scaledScore(lv(0, 0, 0))).toBe(50);
    // 표준 10 + 상 20 + 최상 24 = 54 → 50 + 50×54/60
    expect(scaledScore(lv(100, 100, 80))).toBe(95);
  });

  it('위에서부터 내려오며 처음 걸리는 칸이 등급이다', () => {
    expect(gradeFromLevels(lv(100, 100, 100))).toBe(1);
    expect(gradeFromLevels(lv(100, 100, 80))).toBe(1);
    expect(gradeFromLevels(lv(100, 100, 50))).toBe(2);
    expect(gradeFromLevels(lv(100, 90, 40))).toBe(3);
    expect(gradeFromLevels(lv(100, 70, 20))).toBe(4);
    expect(gradeFromLevels(lv(90, 50, 10))).toBe(5);
  });

  it('많이 틀려도 5~6등급에서 멈춘다', () => {
    // 시험지가 어려워서 원점수가 낮아도 바닥까지 떨어지지 않는다
    expect(gradeFromLevels(lv(60, 30, 10))).toBe(6);
  });

  it('표준을 못 맞히면 환산점수가 높아도 위로 못 올라간다', () => {
    // 무게가 최상 쪽에 실려 있어 환산점수만 보면 1등급이 된다
    expect(scaledScore(lv(50, 100, 100))).toBeGreaterThan(93);
    expect(gradeFromLevels(lv(50, 100, 100))).toBe(4);
    expect(gradeFromLevels(lv(30, 100, 100))).toBe(6);
  });

  it('표준 상한은 화면에 보이는 정답률(배점 기준)을 그대로 쓴다', () => {
    // 10문항 중 6개를 맞혀도 배점이 큰 것을 틀리면 정답률은 60%에 못 미친다.
    // 그때는 개수로 60%를 채웠어도 4등급 위로 올라가지 못한다.
    const levels = [
      { type: '표준', total: 10, correct: 6, points: 40, earned: 22, rate: 22 / 40 },
      { type: '상', total: 10, correct: 10, points: 30, earned: 30, rate: 1 },
      { type: '최상', total: 10, correct: 10, points: 30, earned: 30, rate: 1 },
    ];
    expect(levels[0].correct / levels[0].total).toBe(0.6);
    expect(levels[0].rate).toBeLessThan(0.6);
    expect(gradeFromLevels(levels)).toBe(4);
    // 같은 개수라도 배점이 큰 것을 맞혀 정답률이 60%를 넘으면 막지 않는다
    const ok = [{ ...levels[0], earned: 26, rate: 26 / 40 }, levels[1], levels[2]];
    expect(gradeFromLevels(ok)).toBe(1);
  });

  it('난이도를 안 적은 시험지는 등급을 지어내지 않는다', () => {
    expect(gradeFromLevels([])).toBeNull();
    expect(scaledScore([])).toBeNull();
  });

  it('없는 난이도는 무게 만점에서도 빠진다', () => {
    // 최상 문항이 아예 없는 시험지. 만점은 10×1 + 10×2 = 30점이다.
    const only = [
      { type: '표준', total: 10, correct: 9, points: 10, earned: 0, rate: 0.9 },
      { type: '상', total: 10, correct: 9, points: 10, earned: 0, rate: 0.9 },
    ];
    expect(scaledScore(only)).toBe(95);
    expect(gradeFromLevels(only)).toBe(1);
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
