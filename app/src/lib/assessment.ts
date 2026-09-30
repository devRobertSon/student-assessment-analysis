// src/lib/assessment.ts: 진단평가 데이터(학생·시험지·채점) + CSV 임포트 + 집계
// 저장: localStorage 단일 키 + JSON 백업
// 채점은 시험지마다 두 칸(O/X)이거나 세 칸(O/△/X)이다. Exam.grading 이 고른다.
export type QFormat = '객관식' | '주관식';

export interface ExamQuestion {
  no: number;
  type: string; // 유형. 어떤 능력이 모자라 틀리는지 (행동영역)
  format?: QFormat; // 없으면 객관식
  answer?: string;
  points?: number;
  // 아래 넷은 선택이다. 적어 두면 유형 말고 다른 축으로도 집계된다.
  unit?: string; // 단원. 어느 단원을 안 배웠는지
  level?: string; // 난이도. 어느 난이도부터 틀리는지 (표준·상·최상)
  source?: string; // 출처 교재
  sourceNo?: string; // 그 교재에서의 문항 번호
}

export function isEssay(q: ExamQuestion): boolean {
  return q.format === '주관식';
}

// 배점을 안 적은 시험지는 한 문항 1점으로 본다. 그러면 득점률이 곧 정답률이 된다.
export function pointsOf(q: ExamQuestion): number {
  return typeof q.points === 'number' && q.points > 0 ? q.points : 1;
}

// 4, 3.5처럼 필요한 자리까지만 보여준다
export function fmtPoints(v: number): string {
  return Number.isInteger(v) ? String(v) : String(Math.round(v * 10) / 10);
}

/**
 * 채점 칸을 몇 개 둘지.
 *
 * `ox`  맞음·틀림 두 칸. 수학 진단평가가 쓴다.
 * `half` 맞음·절반·틀림 세 칸. 과학 영재성평가처럼 전부 서술형인 시험지가 쓴다.
 *
 * **왜 시험지마다 정하나.** 형식(주관식)으로 정하면 수학 진단평가의 주관식
 * 다섯 문항도 함께 바뀐다. 그쪽은 답이 맞거나 틀리거나 둘뿐이라 절반이 없다.
 * 과목으로 정하면 O·X 로 매기고 싶은 과학 시험지를 만들 길이 없다.
 */
export type GradeMode = 'ox' | 'half';

/** 세 칸 채점의 가운데 값. 배점의 절반이다. */
export function halfOf(q: ExamQuestion): number {
  return pointsOf(q) / 2;
}

/**
 * 채점 화면에 재수강·기초 미흡·심화 미흡 판정을 보일지.
 *
 * 세 판정은 **수학 진단평가 한 장에 맞춰 둔 값**이다. 30문항에 표준 5·상 15·
 * 최상 10, 벌점 8·5·40 이 그 시험지 구성에서 나온 수다. 영재성평가는 문항 수도
 * 구성도 달라 같은 수를 쓸 수 없다.
 *
 * 세 칸 채점이 곧 영재성평가라는 표다. 전부 서술형인 시험지만 세 칸을 쓴다.
 * 나중에 세 칸이면서 판정도 쓰고 싶은 시험지가 생기면 그때 따로 표를 둔다.
 */
export function showsVerdicts(exam: Exam): boolean {
  return exam.grading !== 'half';
}

/** 시험지에 딸린 인쇄물 세 가지. */
export type AttachKind = 'paper' | 'solution' | 'blueprint';
export const ATTACH_KINDS: AttachKind[] = ['paper', 'solution', 'blueprint'];
export const ATTACH_LABEL: Record<AttachKind, string> = {
  paper: '문제지',
  solution: '해설',
  blueprint: '출제표',
};

/** 파일 이름 끝에 붙여 쓰는 종류. papers/ 의 이름 규칙과 같은 낱말이다. */
const ATTACH_WORDS = ['문제지', '해설', '정답', '출제표'];

/**
 * 인쇄물 칸에 보일 이름.
 *
 * 붙은 파일이 `중2_과학_영재성평가_정답.pdf` 처럼 종류로 끝나면 그 낱말을 쓴다.
 * 수학은 풀이를 실은 해설이고 과학 영재성평가는 답과 세 칸 채점 기준을 실은
 * 정답이라, 같은 solution 칸이라도 파일에 따라 다르게 불러야 한다.
 */
export function attachLabel(kind: AttachKind, file?: string): string {
  const word = /_([^_./\\]+)\.[a-z0-9]+$/i.exec(file ?? '')?.[1];
  return word && ATTACH_WORDS.includes(word) ? word : ATTACH_LABEL[kind];
}

export interface Exam {
  id: string;
  title: string;
  subject: string;
  date: string; // 등록일 YYYY-MM-DD (응시일은 채점 결과 Result.date에 학생별로 기록된다)
  questions: ExamQuestion[];
  /** 채점 칸 수. 안 적으면 두 칸(O/X)이다. */
  grading?: GradeMode;
  /**
   * 딸린 인쇄물. 값은 사이트의 papers/ 에 올려 둔 파일 이름이거나 'http…' 주소다.
   * 짧은 문자열이라 다른 데이터와 함께 동기화된다.
   */
  files?: Partial<Record<AttachKind, string>>;
}

/**
 * 사이트에 같이 올려 둔 인쇄물의 주소를 만든다.
 * 'http…'는 그대로 두고, 그 밖의 값은 papers/ 아래 파일로 본다.
 * 한글 파일 이름이 그대로 들어오므로 주소로 만들 때 인코딩한다.
 */
export function paperHref(value: string, base = import.meta.env.BASE_URL): string {
  const v = value.trim();
  if (/^https?:\/\//i.test(v)) return v;
  const name = v.replace(/^\/*(papers\/)?/i, '');
  return `${base}papers/${encodeURIComponent(name)}`;
}

// 상담 카드의 '목표 고등학교' 선택지
export const TARGET_SCHOOLS = ['영재학교', '과학고', '외고', '국제고', '전사고', '의대 준비'];

export type Sibling = '' | '없음' | '있음';

export interface Student {
  id: string;
  name: string;
  grade: string;
  school?: string; // 학교(동명이인 구분용, 선택)
  contact?: string; // 학생 연락처(선택)
  memo?: string;
  // 아래 셋은 인쇄용 상담 카드에 자동으로 채워진다. 비워두면 빈칸으로 인쇄돼 손으로 적는다.
  parentContact?: string;
  sibling?: Sibling;
  targetSchools?: string[];
  // 상담 카드의 '현재 진도 · 학습 내용' 표 (수학·과학 2행)
  mathProgress?: string;
  mathBooks?: string;
  sciProgress?: string;
  sciBooks?: string;
}

/**
 * 메모에 적을 수 있는 글자 수.
 *
 * 학생의 메모가 리포트의 [상담 메모 · 특이사항]으로 그대로 넘어가고, 그 칸은
 * 2쪽에 정해진 높이로 인쇄된다. 두 곳이 같은 수를 써야 화면에서 다 보이던 글이
 * 인쇄에서 잘리지 않는다.
 */
export const MEMO_MAX = 200;

/**
 * 에듀오케이의 입학상담내용 칸에 붙여 넣을 글을 만든다.
 *
 * 적어 둔 것만 넣는다. 빈 항목은 이름표만 남기지 않고 통째로 뺀다. 빈 이름표가
 * 섞이면 붙여 넣은 뒤 지우는 손이 한 번 더 간다.
 *
 * 만든 글은 그대로 쓰는 것이 아니라 띄운 창에서 고칠 수 있다. 상담마다 덧붙일
 * 말이 다르므로 여기서는 적어 둔 값만 모아 첫 꼴을 내준다.
 */
export function counselText(s: Student): string {
  const blocks: string[] = [];

  const schools = (s.targetSchools ?? []).filter((t) => t.trim());
  if (schools.length) blocks.push(`[목표 고등학교] ${schools.join(', ')}`);

  // '진도 / 학습 내용' 인데 한쪽만 적혀 있으면 빗금 없이 적힌 쪽만 쓴다.
  const line = (name: string, progress?: string, books?: string) => {
    const both = [progress, books].map((v) => (v ?? '').trim()).filter(Boolean);
    return both.length ? `${name} : ${both.join(' / ')}` : '';
  };
  const rows = [
    line('수학', s.mathProgress, s.mathBooks),
    line('과학', s.sciProgress, s.sciBooks),
  ].filter(Boolean);
  if (rows.length) blocks.push(['[현재 진도]', ...rows].join('\n'));

  const memo = (s.memo ?? '').trim();
  if (memo) blocks.push(`[메모]\n${memo}`);

  return blocks.join('\n\n');
}

export interface Mark {
  no: number;
  // 채점 당시의 값을 함께 적어둔다. 시험지를 나중에 고쳐도
  // 이미 저장된 채점의 점수가 바뀌지 않는다.
  earned: number; // 득점
  points: number; // 배점
}

/** 만점을 받았는가. 객관식은 O, 주관식은 배점을 다 받은 경우. */
export function isFullMark(m: Mark): boolean {
  return m.earned >= m.points;
}

/**
 * 채점 한 칸을 기록으로 만든다. 득점은 0~배점 사이로 자른다.
 * 손으로 친 숫자든 CSV로 올린 값이든 여기를 지나므로, 저장된 뒤에는
 * 득점이 배점을 넘는 기록이 있을 수 없다.
 */
export function makeMark(q: ExamQuestion, earned: number): Mark {
  const points = pointsOf(q);
  return { no: q.no, points, earned: Math.max(0, Math.min(points, earned)) };
}

export interface Result {
  id: string;
  studentId: string;
  examId: string;
  date: string;
  marks: Mark[];
}

/**
 * 예상 등급 사다리.
 *
 * 학생들 점수를 모아 줄 세우는 상대평가가 아니다. 문항 난이도를 기준으로
 * '어느 수준까지 풀어내는가'를 본다. 난이도(표준·상·최상)는 시험지를 만들 때
 * 교재 위계(기본·응용·심화·입학 심화형)를 보고 붙인 값이라 근거가 있다.
 *
 * 위에서부터 내려오며 조건을 다 채운 첫 칸이 그 학생의 등급이다. 한 등급은
 * 자기 난이도만이 아니라 그 아래 난이도까지 함께 넘어야 한다. 최상만 보고
 * 등급을 주면 표준을 절반이나 틀린 학생에게도 1등급이 나온다.
 *
 * 이 값은 예측이 아니라 학원이 정한 도달 기준이다. 시험지 난이도가 바뀌면
 * 같이 손봐야 한다.
 */
/**
 * 시험지 점수. 배점을 그대로 더해 100점 만점으로 본다.
 *
 * 2026-09-29 까지는 난이도마다 무게(표준 1 · 상 2 · 최상 3)를 따로 주어
 * 50~100 구간의 환산점수를 만들었다. 그런데 **배점이 이미 난이도를 담고
 * 있다.** 객관식은 표준 2 · 상 3 · 최상 4, 주관식은 거기서 하나씩 더다.
 * 무게를 따로 두면 난이도 구성이 바뀔 때마다 화면에 적은 설명이 틀려진다.
 * 실제로 표준이 7문항에서 5문항으로 바뀌었을 때 반년 가까이 어긋나 있었다.
 *
 * 배점만 쓰면 규칙이 고정이라 구성이 바뀌어도 이 계산은 안 틀린다. 선생님이
 * 채점 화면에서 보는 점수와 등급을 매긴 값이 같아지는 것도 이롭다.
 */
export function paperScore(levels: TypeStat[]): number | null {
  let earned = 0;
  let points = 0;
  for (const l of levels) {
    earned += l.earned;
    points += l.points;
  }
  if (points === 0) return null;
  return (100 * earned) / points;
}

/**
 * 점수를 등급으로 바꾸는 칸. 위에서부터 내려오며 처음 걸리는 칸이 등급이다.
 *
 * 고르게 틀리면 한 문항이 평균 3.33점이라 오답 수와 이렇게 이어진다.
 *   1등급 0~4개 · 2등급 5~7개 · 3등급 8~12개 · 4등급 13~18개
 *   5등급 19~24개 · 6등급 25개 · 7등급 26~27개 · 8등급 28개 · 9등급 29~30개
 *
 * 1~5등급은 재수강 통과 상한(오답 7개)을 2등급 끝에 두고 나머지를 고르게 나눈
 * 값이다. 학원 학생이 재수강 경계에 서면 전국에서는 2등급쯤이라고 본다. 학원
 * 기준이 전국 기준보다 높기 때문이다.
 *
 * 6등급 아래는 15 · 10 · 5점으로 촘촘하다. 거의 다 틀린 학생들끼리도 나누어
 * 보려고 2026-09-30 에 원장님이 정했다.
 */
export const GRADE_CUTS: { grade: number; min: number }[] = [
  { grade: 1, min: 85 },
  { grade: 2, min: 75 },
  { grade: 3, min: 60 },
  { grade: 4, min: 40 },
  { grade: 5, min: 20 },
  { grade: 6, min: 15 },
  { grade: 7, min: 10 },
  { grade: 8, min: 5 },
];

/** 가장 낮은 등급. 어느 칸에도 안 걸리면 여기로 내려앉는다. */
export const LOWEST_GRADE = 9;

/**
 * 표준 문항을 못 맞히면 위로 올라가지 못하게 하는 선.
 *
 * 점수만 보면 표준 다섯 문항(10점)을 다 틀려도 90점이라 1등급이 된다. 기초가
 * 서지 않은 채 어려운 문제만 맞히는 것을 위로 쳐 주지 않는다.
 *
 * **배점이 아니라 개수로 잰다.** 표준이 다섯 문항뿐이라 배점으로 재면 3점짜리
 * 주관식이 섞인 시험지(중2-1·중2-2)에서만 선이 먼저 걸렸다. 같은 두 문항을
 * 틀리고도 시험지에 따라 등급이 달라졌다. 개수로 재면 여덟 장이 같아지고
 * "다섯 개 중 세 개는 맞혀야 한다"로 설명도 단순해진다.
 *
 * 못 맞힌 개수만큼 선을 낮춘다. 2026-09-30 에 원장님이 셋으로 나눴다.
 */
const BASE_CAPS: { under: number; worst: number }[] = [
  { under: 60, worst: 3 }, // 다섯 중 두 개 이하 → 3등급까지
  { under: 40, worst: 4 }, // 다섯 중 한 개 이하 → 4등급까지
  { under: 20, worst: 5 }, // 하나도 못 맞히면 → 5등급까지
];

/**
 * 난이도별 집계에서 등급을 뽑는다.
 * 시험지에 난이도를 안 적었으면(=칸이 비었으면) null. 등급을 지어내지 않는다.
 */
export function gradeFromLevels(levels: TypeStat[]): number | null {
  const score = paperScore(levels);
  if (score === null) return null;
  let grade = GRADE_CUTS.find((c) => score >= c.min)?.grade ?? LOWEST_GRADE;
  const std = levels.find((l) => l.type === '표준');
  if (std && std.total > 0) {
    const rate = (100 * std.correct) / std.total;
    for (const cap of BASE_CAPS) if (rate < cap.under) grade = Math.max(grade, cap.worst);
  }
  return grade;
}

/**
 * 학원 기준 재수강 판정. 난이도마다 봐 주는 개수를 따로 두고 점수로 합친다.
 *
 * 쉬운 문제를 틀리는 것과 어려운 문제를 못 푸는 것은 뜻이 다르다. 그래서
 * 틀린 문항마다 난이도에 따라 점수를 붙이고, 그 합이 기준이 되면 재수강으로
 * 본다. 표준·상은 8점, 최상은 5점, 기준은 40점이다.
 *   표준·상 5개 = 40점            → 재수강
 *   최상 8개    = 40점            → 재수강
 *   표준·상 2 + 최상 3 = 16 + 15  → 31점, 통과
 *   표준·상 3 + 최상 4 = 24 + 20  → 44점, 재수강
 * 쉬운 문제 하나가 어려운 문제 1.6개만큼 무겁다.
 *
 * **시험지 점수로 재지 않는 이유.** 2026-09-29 에 등급을 점수로 옮기면서 이
 * 판정도 점수(75점)로 모아 봤다. 그러자 쉬운 문제는 배점이 작아 오히려 가볍게
 * 세어졌다. 표준을 다섯 개 다 틀리고 싼 상을 다섯 개 더 틀려도 75점이라 통과가
 * 됐다. 기초가 빈 학생을 다음 학기로 보내는 셈이라 같은 날 되돌렸다.
 *
 * 이 판정은 등급과 성격이 다르다. 등급은 전국에서 어디쯤인가이고, 이것은
 * 이 학원이 "다음 학기로 보내도 되는가"를 정하는 내부 기준이다. 훨씬 엄격해서
 * 섞으면 잘하는 학생에게 낮은 등급이 찍힌다. 그래서 리포트에는 넣지 않는다.
 */
export interface RetakeScale {
  base: number; // 표준·상 한 문항을 틀릴 때 붙는 점수
  top: number; // 최상 한 문항을 틀릴 때 붙는 점수
  cut: number; // 이 점수가 되면 재수강
}

export const DEFAULT_RETAKE_SCALE: RetakeScale = { base: 8, top: 5, cut: 40 };

export interface RetakeCheck {
  total: number; // 채점한 문항 수
  wrongBase: number; // 표준·상 오답
  wrongTop: number; // 최상 오답
  points: number; // 쌓인 점수
  scale: RetakeScale;
  pass: boolean;
}

/**
 * 난이도를 최상과 그 나머지 둘로만 가른다.
 *
 * 표준과 상을 굳이 나누지 않은 것은 판정이 기대는 경계를 하나로 줄이기
 * 위해서다. 표준인지 상인지는 사람마다 다르게 보지만 최상인지 아닌지는 덜 그렇다.
 * 난이도를 안 적은 문항은 표준·상 쪽으로 센다. 난이도가 아예 없는 시험지도
 * 그러면 "다섯 개부터 재수강"이라는 단순한 규칙으로 자연스럽게 내려앉는다.
 */
const isTop = (q: ExamQuestion) => q.level?.trim() === '최상';

/** 아직 채점한 문항이 없으면 null. 판정을 지어내지 않는다. */
export function retakeCheck(
  exam: Exam,
  marks: Mark[],
  scale: RetakeScale = DEFAULT_RETAKE_SCALE
): RetakeCheck | null {
  const top = new Set(exam.questions.filter(isTop).map((q) => q.no));
  const nos = new Set(exam.questions.map((q) => q.no));
  const mine = marks.filter((m) => nos.has(m.no));
  if (mine.length === 0) return null;
  const wrong = mine.filter((m) => !isFullMark(m));
  const wrongTop = wrong.filter((m) => top.has(m.no)).length;
  const wrongBase = wrong.length - wrongTop;
  const points = wrongBase * scale.base + wrongTop * scale.top;
  return { total: mine.length, wrongBase, wrongTop, points, scale, pass: points < scale.cut };
}

/**
 * 기초 미흡·심화 미흡. 양 끝 난이도를 몇 개나 놓쳤는지 따로 본다.
 *
 * 재수강 판정은 난이도를 표준·상과 최상 둘로만 가른다. 그래서 표준만 골라
 * 틀린 학생과 상만 골라 틀린 학생이 같은 판정을 받는다. 어느 쪽인지는 따로
 * 알아야 가르칠 것을 정할 수 있다.
 *
 * 기초는 **표준 다섯 문항 중 세 개 이상**을 틀리면 켠다. 예상 고교 등급에서
 * 3등급 위로 올라가지 못하게 하는 선과 같은 조건이라, 켜지면 등급도 함께 낮아진다.
 *
 * 심화는 **최상 열 문항 중 다섯 개 이상**을 틀리면 켠다. 최상은 한 문항이
 * 5점이라 여덟 개를 놓쳐야 재수강이 된다. 통과한 학생 중에도 심화를 여러 개
 * 놓친 경우가 생기고, 그것은 따로 알아야 한다.
 *
 * 둘 다 정답률이 아니라 개수로 잡는다. 선생님이 화면을 보고 바로 셀 수 있다.
 */
export const DEFAULT_BASIC_CUT = 3;
export const DEFAULT_ADVANCED_CUT = 5;

export interface LevelGap {
  level: string;
  total: number;
  wrong: number;
  cut: number; // 몇 개부터 미흡인가
  short: boolean; // 미흡인가
}

function levelGap(exam: Exam, marks: Mark[], level: string, cut: number): LevelGap | null {
  const nos = new Set(
    exam.questions.filter((q) => q.level?.trim() === level).map((q) => q.no)
  );
  const mine = marks.filter((m) => nos.has(m.no));
  if (mine.length === 0) return null;
  const wrong = mine.filter((m) => !isFullMark(m)).length;
  return { level, total: mine.length, wrong, cut, short: wrong >= cut };
}

/** 표준 문항을 아직 채점하지 않았으면 null. */
export function basicGap(
  exam: Exam,
  marks: Mark[],
  cut: number = DEFAULT_BASIC_CUT
): LevelGap | null {
  return levelGap(exam, marks, '표준', cut);
}

/** 최상 문항을 아직 채점하지 않았으면 null. */
export function advancedGap(
  exam: Exam,
  marks: Mark[],
  cut: number = DEFAULT_ADVANCED_CUT
): LevelGap | null {
  return levelGap(exam, marks, '최상', cut);
}

export interface AssessmentData {
  students: Student[];
  exams: Exam[];
  results: Result[];
  /** 재수강 판정에서 봐 주는 개수. 안 적었으면 DEFAULT_RETAKE_BUDGET. */
  retakeScale?: RetakeScale;
}

const KEY = 'sda.assess.v1';

export function emptyAssessment(): AssessmentData {
  return { students: [], exams: [], results: [] };
}

export function loadAssessment(): AssessmentData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyAssessment();
    const p = JSON.parse(raw) as Partial<AssessmentData>;
    return {
      students: Array.isArray(p.students) ? p.students : [],
      exams: Array.isArray(p.exams) ? p.exams : [],
      results: Array.isArray(p.results) ? p.results : [],
      // 판정 기준이 여러 번 바뀌었다. 예전에 저장된 값을 그대로 읽으면 엉뚱한
      // 기준이 되므로 지금 모양일 때만 쓴다. 아니면 기본값으로 돌아간다.
      retakeScale:
        p.retakeScale &&
        typeof p.retakeScale.base === 'number' &&
        typeof p.retakeScale.top === 'number' &&
        typeof p.retakeScale.cut === 'number'
          ? p.retakeScale
          : undefined,
    };
  } catch {
    return emptyAssessment();
  }
}

export function saveAssessment(d: AssessmentData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(d));
  } catch {
    /* 저장 실패 무시 */
  }
}

let _seq = 0;
export function newId(prefix: string): string {
  _seq += 1;
  return `${prefix}_${Date.now().toString(36)}_${_seq}`;
}

export function todayStr(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

// ── CSV 파싱 ─────────────────────────────────────────────
// 따옴표·쉼표·CRLF·BOM 처리하는 간단 파서
export function parseCsv(text: string): string[][] {
  const s = text.replace(/^﻿/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += c;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

const HEADER_ALIASES: Record<string, string[]> = {
  no: ['문항번호', '번호', '문항', '문제번호', 'no', 'q', 'question'],
  type: ['유형', '유형명', '분류', '문제유형', 'type', 'category'],
  subject: ['과목', 'subject'],
  answer: ['정답', 'answer', 'ans'],
  points: ['배점', '점수', 'points', 'score'],
  format: ['형식', '문항형식', '유형구분', '문제형식', 'format'],
  unit: ['단원', '영역', '대단원', 'unit'],
  level: ['난이도', '수준', 'level'],
  source: ['출처', '교재', '원교재', 'source'],
  sourceNo: ['원문항', '원문항번호', '교재문항', 'sourceno'],
  title: ['시험지', '시험', '시험지명', '시험명', 'title', 'exam'],
  grading: ['채점', '채점방식', '채점칸', 'grading'],
  paper: ['문제지', '문제지파일', 'paper'],
  solution: ['해설', '해설지', '해설지파일', 'solution'],
  blueprint: ['출제표', '출제표파일', 'blueprint'],
};

// 주관식·서술형·논술형·서답형은 형식만 다르게 표시한다. 채점 칸 수는 형식이
// 아니라 시험지가 정한다(Exam.grading). 2026-09-21 에 이름을 '주관식' 으로
// 바꾸기 전에 받아 둔 자료가 있어 예전 낱말도 그대로 받는다.
const ESSAY_WORDS = ['주관', '서술', '논술', '서답'];

export function normalizeFormat(raw: string): QFormat {
  const v = raw.trim();
  return ESSAY_WORDS.some((w) => v.includes(w)) ? '주관식' : '객관식';
}

// 채점 칸을 세 개로 두라는 말. 그 밖의 값은 모두 두 칸으로 본다.
const HALF_WORDS = ['세칸', '세 칸', '3칸', '3', 'half', '절반', '부분'];

export function normalizeGrading(raw: string): GradeMode {
  const v = raw.trim().toLowerCase();
  return HALF_WORDS.some((w) => v.includes(w)) ? 'half' : 'ox';
}

function matchHeader(header: string): string | null {
  const h = header.trim().toLowerCase();
  for (const key of Object.keys(HEADER_ALIASES)) {
    if (HEADER_ALIASES[key].some((a) => a.toLowerCase() === h)) return key;
  }
  return null;
}

export interface CsvParseResult {
  questions: ExamQuestion[];
  title?: string;
  subject?: string;
  grading?: GradeMode;
  files?: Partial<Record<AttachKind, string>>;
  errors: string[];
}

export function examQuestionsFromCsv(text: string): CsvParseResult {
  const rows = parseCsv(text);
  const errors: string[] = [];
  if (rows.length < 2) {
    return { questions: [], errors: ['CSV에 데이터 행이 없습니다. (헤더 + 최소 1행 필요)'] };
  }
  const header = rows[0].map(matchHeader);
  const idxNo = header.indexOf('no');
  const idxType = header.indexOf('type');
  if (idxNo === -1 || idxType === -1) {
    errors.push('필수 열(문항번호, 유형)을 찾지 못했습니다. 헤더 이름을 확인하세요.');
    return { questions: [], errors };
  }
  const idxSubject = header.indexOf('subject');
  const idxAnswer = header.indexOf('answer');
  const idxPoints = header.indexOf('points');
  const idxFormat = header.indexOf('format');
  const idxTitle = header.indexOf('title');
  const idxGrading = header.indexOf('grading');
  // 인쇄물은 시험지 한 장에 하나뿐이라 문항이 아니라 시험지에 붙는다.
  const attachCols = ATTACH_KINDS.map((k) => [k, header.indexOf(k)] as [AttachKind, number]).filter(
    ([, i]) => i !== -1
  );
  const extra: [string, number][] = (['unit', 'level', 'source', 'sourceNo'] as const)
    .map((k) => [k, header.indexOf(k)] as [string, number])
    .filter(([, i]) => i !== -1);

  let title: string | undefined;
  let subject: string | undefined;
  let grading: GradeMode | undefined;
  const files: Partial<Record<AttachKind, string>> = {};
  const questions: ExamQuestion[] = [];
  const seen = new Set<number>();

  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r];
    const noRaw = (cells[idxNo] ?? '').trim();
    const type = (cells[idxType] ?? '').trim();
    if (noRaw === '' && type === '') continue;
    const no = Number(noRaw.replace(/[^0-9]/g, ''));
    if (!Number.isFinite(no) || no <= 0) {
      errors.push(`${r + 1}행: 문항번호가 올바르지 않습니다 ("${noRaw}").`);
      continue;
    }
    if (!type) {
      errors.push(`${r + 1}행: 유형이 비어 있습니다 (문항 ${no}).`);
      continue;
    }
    if (seen.has(no)) {
      errors.push(`문항번호 ${no}이(가) 중복되어 마지막 값으로 덮어씁니다.`);
    }
    seen.add(no);
    const q: ExamQuestion = { no, type };
    if (idxAnswer !== -1 && (cells[idxAnswer] ?? '').trim()) q.answer = cells[idxAnswer].trim();
    if (idxPoints !== -1) {
      const p = Number((cells[idxPoints] ?? '').trim());
      if (Number.isFinite(p)) q.points = p;
    }
    if (idxFormat !== -1 && (cells[idxFormat] ?? '').trim()) {
      q.format = normalizeFormat(cells[idxFormat]);
    }
    for (const [key, idx] of extra) {
      const v = (cells[idx] ?? '').trim();
      if (v) (q as unknown as Record<string, string>)[key] = v;
    }
    if (idxTitle !== -1 && !title && (cells[idxTitle] ?? '').trim()) title = cells[idxTitle].trim();
    if (idxSubject !== -1 && !subject && (cells[idxSubject] ?? '').trim()) subject = cells[idxSubject].trim();
    if (idxGrading !== -1 && !grading && (cells[idxGrading] ?? '').trim()) {
      grading = normalizeGrading(cells[idxGrading]);
    }
    for (const [kind, idx] of attachCols) {
      const v = (cells[idx] ?? '').trim();
      if (v && !files[kind]) files[kind] = v;
    }
    const existing = questions.findIndex((x) => x.no === no);
    if (existing !== -1) questions[existing] = q;
    else questions.push(q);
  }

  questions.sort((a, b) => a.no - b.no);
  return {
    questions,
    title,
    subject,
    grading,
    files: Object.keys(files).length ? files : undefined,
    errors,
  };
}

// ── 파일 다운로드 ────────────────────────────────────────
export function downloadText(filename: string, text: string, mime = 'text/csv;charset=utf-8'): void {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
// ── 집계 ─────────────────────────────────────────────────
// 한 문항에 유형을 여러 개 붙일 수 있다. CSV의 유형 칸에 '표현 해석;다단계 해결'처럼 적는다.
// 평가원은 문항당 행동영역을 하나만 붙이므로 기본은 하나를 권장하고, 이 함수는 예외를 허용할 뿐이다.
export function splitTypes(raw: string): string[] {
  return raw
    .split(/[;|]/)
    .map((t) => t.trim())
    .filter(Boolean);
}

export interface TypeStat {
  type: string;
  total: number; // 문항 수
  correct: number; // 만점 문항 수
  points: number; // 배점 합
  earned: number; // 득점 합
  /**
   * 정답률 0~1. 배점으로 잰다(earned / points).
   *
   * 그래서 5문항 중 4개를 맞혀도 어느 문항을 틀렸느냐에 따라 74%가 되기도
   * 80%가 되기도 한다. 어려운(배점이 큰) 문항을 틀린 것을 더 무겁게 보는
   * 것이다. 화면에서는 이 값 옆에 득점(14/19점)을 같이 적어 어긋나 보이지
   * 않게 한다.
   */
  rate: number;
}

interface TypeAcc {
  total: number;
  correct: number;
  points: number;
  earned: number;
}

function accumulate(acc: Map<string, TypeAcc>, types: string[], m: Mark): void {
  for (const type of types) {
    const a = acc.get(type) ?? { total: 0, correct: 0, points: 0, earned: 0 };
    a.total += 1;
    if (isFullMark(m)) a.correct += 1;
    a.points += m.points;
    a.earned += m.earned;
    acc.set(type, a);
  }
}

function finishStats(acc: Map<string, TypeAcc>, order?: string[]): TypeStat[] {
  const rows = [...acc.entries()].map(([type, a]) => ({
    ...a,
    type,
    rate: a.points ? a.earned / a.points : 0,
  }));
  if (!order) {
    // 유형은 약한 것부터. 리포트의 레이더·막대가 이 순서를 그대로 쓴다
    return rows.sort((a, b) => a.rate - b.rate || b.total - a.total);
  }
  const rank = new Map(order.map((k, i) => [k, i]));
  return rows.sort((a, b) => (rank.get(a.type) ?? 999) - (rank.get(b.type) ?? 999));
}

// ── 집계 축 ──────────────────────────────────────────────
// 한 시험에서 세 가지를 읽는다.
//   유형   어떤 능력이 모자라 틀리는지  약한 순
//   단원   어느 단원을 안 배웠는지   시험지에 나온 순(교육과정 순)
//   난이도 어느 난이도부터 틀리는지 표준 → 상 → 최상
export type Axis = 'type' | 'unit' | 'level';

const LEVEL_ORDER = ['표준', '상', '최상'];

function keysOf(q: ExamQuestion, axis: Axis): string[] {
  if (axis === 'type') return splitTypes(q.type);
  const v = (axis === 'unit' ? q.unit : q.level)?.trim();
  return v ? [v] : [];
}

/** 축에 따른 정렬 기준. 유형은 undefined(약한 순), 나머지는 고정 순서. */
function orderFor(exams: Exam[], axis: Axis): string[] | undefined {
  if (axis === 'type') return undefined;
  if (axis === 'level') return LEVEL_ORDER;
  const seen: string[] = [];
  for (const e of exams) {
    for (const q of e.questions) {
      for (const k of keysOf(q, axis)) if (!seen.includes(k)) seen.push(k);
    }
  }
  return seen;
}

export function statsForResult(exam: Exam, marks: Mark[], axis: Axis = 'type'): TypeStat[] {
  const byNo = new Map<number, string[]>();
  exam.questions.forEach((q) => byNo.set(q.no, keysOf(q, axis)));
  const acc = new Map<string, TypeAcc>();
  for (const m of marks) accumulate(acc, byNo.get(m.no) ?? [], m);
  return finishStats(acc, orderFor([exam], axis));
}

// 학생의 여러 시험 결과를 한 축으로 누적
export function statsCumulative(exams: Exam[], results: Result[], axis: Axis = 'type'): TypeStat[] {
  const examById = new Map(exams.map((e) => [e.id, e]));
  const acc = new Map<string, TypeAcc>();
  const used: Exam[] = [];
  for (const res of results) {
    const exam = examById.get(res.examId);
    if (!exam) continue;
    used.push(exam);
    const byNo = new Map<number, string[]>();
    exam.questions.forEach((q) => byNo.set(q.no, keysOf(q, axis)));
    for (const m of res.marks) accumulate(acc, byNo.get(m.no) ?? [], m);
  }
  return finishStats(acc, orderFor(used, axis));
}

/** 그 축을 쓸 수 있는 시험지인지. 단원·난이도를 안 적었으면 탭을 숨긴다. */
export function hasAxis(exam: Exam, axis: Axis): boolean {
  return exam.questions.some((q) => keysOf(q, axis).length > 0);
}

/**
 * 한 과목을 몇 가지 유형으로 재는가. 홈 화면의 '분석 유형' 숫자다.
 *
 * 과목마다 따로 센 뒤 가장 큰 값을 낸다. 수학도 여덟, 과학도 여덟이면 여덟이다.
 * 과목을 가리지 않고 이름을 한 자루에 담아 세면 `개념 이해` 가 두 과목에 다
 * 있어서 8 + 8 이 15가 된다. 학생은 한 과목을 여덟 유형으로 진단받으므로
 * 여덟이 맞는 숫자다. 유형 분류를 바꿔도 이 값이 저절로 따라온다.
 */
export function countTypes(exams: Exam[]): number {
  const bySubject = new Map<string, Set<string>>();
  for (const e of exams) {
    let seen = bySubject.get(e.subject);
    if (!seen) bySubject.set(e.subject, (seen = new Set<string>()));
    for (const q of e.questions) for (const t of splitTypes(q.type)) seen.add(t);
  }
  return Math.max(0, ...[...bySubject.values()].map((s) => s.size));
}

// total·correct는 문항 수, points·earned는 점수.
export function scoreOf(marks: Mark[]): {
  correct: number;
  total: number;
  earned: number;
  points: number;
  rate: number;
} {
  const total = marks.length;
  const correct = marks.filter(isFullMark).length;
  let earned = 0;
  let points = 0;
  for (const m of marks) {
    earned += m.earned;
    points += m.points;
  }
  return { correct, total, earned, points, rate: points ? earned / points : 0 };
}

export function exportAssessmentJson(d: AssessmentData): void {
  const blob = new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `알파학원_학생평가_${todayStr()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function parseAssessmentJson(text: string): AssessmentData {
  const p = JSON.parse(text) as Partial<AssessmentData>;
  return {
    students: Array.isArray(p.students) ? p.students : [],
    exams: Array.isArray(p.exams) ? p.exams : [],
    results: Array.isArray(p.results) ? p.results : [],
  };
}
