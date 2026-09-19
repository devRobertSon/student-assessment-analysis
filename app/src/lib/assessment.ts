// src/lib/assessment.ts: 진단평가 데이터(학생·시험지·채점) + CSV 임포트 + 집계
// 저장: localStorage 단일 키 + JSON 백업
// 채점은 서술형도 O/X만 구분한다. 배점을 다 받으면 O, 아니면 X다.
export type QFormat = '객관식' | '서술형';

export interface ExamQuestion {
  no: number;
  type: string; // 유형. 어떤 능력에서 막히는지 (행동영역)
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
  return q.format === '서술형';
}

// 배점을 안 적은 시험지는 한 문항 1점으로 본다. 그러면 득점률이 곧 정답률이 된다.
export function pointsOf(q: ExamQuestion): number {
  return typeof q.points === 'number' && q.points > 0 ? q.points : 1;
}

// 4, 3.5처럼 필요한 자리까지만 보여준다
export function fmtPoints(v: number): string {
  return Number.isInteger(v) ? String(v) : String(Math.round(v * 10) / 10);
}

/** 시험지에 딸린 인쇄물 세 가지. */
export type AttachKind = 'paper' | 'solution' | 'blueprint';
export const ATTACH_KINDS: AttachKind[] = ['paper', 'solution', 'blueprint'];
export const ATTACH_LABEL: Record<AttachKind, string> = {
  paper: '문제지',
  solution: '해설',
  blueprint: '출제표',
};

export interface Exam {
  id: string;
  title: string;
  subject: string;
  date: string; // 등록일 YYYY-MM-DD (응시일은 채점 결과 Result.date에 학생별로 기록된다)
  questions: ExamQuestion[];
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

export interface Mark {
  no: number;
  // 채점 당시의 값을 함께 적어둔다. 시험지를 나중에 고쳐도
  // 이미 저장된 채점의 점수가 바뀌지 않는다.
  earned: number; // 득점
  points: number; // 배점
}

/** 만점을 받았는가. 객관식은 O, 서술형은 배점을 다 받은 경우. */
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
 * 위에서부터 내려오며 처음 걸리는 칸이 그 학생의 등급이다. 최상까지 풀어내면
 * 1등급, 표준도 절반을 못 넘기면 8~9등급이다.
 *
 * 이 값은 예측이 아니라 학원이 정한 도달 기준이다. 시험지 난이도가 바뀌면
 * 같이 손봐야 한다.
 */
export interface GradeRung {
  level: string; // 어느 난이도를 보는가
  min: number; // 그 난이도 정답률이 이 값(%) 이상이면
  grade: number; // 이 등급
}

export const DEFAULT_GRADE_LADDER: GradeRung[] = [
  { level: '최상', min: 70, grade: 1 },
  { level: '최상', min: 40, grade: 2 },
  { level: '상', min: 80, grade: 3 },
  { level: '상', min: 60, grade: 4 },
  { level: '표준', min: 80, grade: 5 },
  { level: '표준', min: 60, grade: 6 },
  { level: '표준', min: 40, grade: 7 },
  { level: '표준', min: 20, grade: 8 },
];

/**
 * 난이도별 정답률에서 등급을 뽑는다.
 * 시험지에 난이도를 안 적었으면(=칸이 비었으면) null. 등급을 지어내지 않는다.
 */
export function gradeFromLevels(levels: TypeStat[], ladder: GradeRung[] = DEFAULT_GRADE_LADDER): number | null {
  if (levels.length === 0) return null;
  const rate = new Map(levels.map((l) => [l.type, l.rate * 100]));
  for (const rung of ladder) {
    const r = rate.get(rung.level);
    if (r !== undefined && r >= rung.min) return rung.grade;
  }
  return ladder.length + 1;
}

/**
 * 학원 기준 재수강 판정. 난이도마다 봐 주는 개수를 따로 두고 비율로 합친다.
 *
 * 쉬운 문제를 틀리는 것과 어려운 문제를 못 푸는 것은 뜻이 다르다. 그래서
 * 틀린 문항마다 난이도에 따라 점수를 붙이고, 그 합이 기준에 닿으면 재수강으로
 * 본다. 표준·상은 8점, 최상은 5점, 기준은 40점이다.
 *   표준·상 5개 = 40점            → 재수강
 *   최상 8개    = 40점            → 재수강
 *   표준·상 2 + 최상 3 = 16 + 15  → 31점, 통과
 *   표준·상 3 + 최상 4 = 24 + 20  → 44점, 재수강
 * 쉬운 문제 하나가 어려운 문제 1.6개만큼 무겁다.
 *
 * 숫자의 출처. 학원 규칙은 "입학 TEST 30문제 중 7문제를 틀리면 그 학기를
 * 다시 듣는다"이고 난이도를 가리지 않는다. 그런데 진단평가는 그 입학 TEST
 * 보다 쉽다. 입학 TEST 중1-1 은 30문제 중 표준이 1문제뿐인데(상 17, 최상 12)
 * 진단평가는 8문제다. 난이도 구성으로 환산하면 입학 TEST 에서 7개를 틀리는
 * 학생이 진단평가에서는 4.7~6.2개를 틀린다.
 *
 * 8·5·40 은 통과 상한이 총 4~8개(평균 6.0)라 그 환산값보다 한 문제쯤 무디다.
 * 더 조이려면 cut 을 32로 내리면 된다(평균 5.3). 학원이 정할 값이라 데이터에
 * 두었다.
 *
 * 이 판정은 등급과 성격이 다르다. 등급은 전국에서 어디쯤인가이고, 이것은
 * 이 학원이 "다음 학기로 보내도 되는가"를 정하는 내부 기준이다. 훨씬 엄격해서
 * 섞으면 잘하는 학생에게 낮은 등급이 찍힌다. 그래서 리포트에는 넣지 않는다.
 */
export interface RetakeScale {
  base: number; // 표준·상 한 문항을 틀릴 때 붙는 점수
  top: number; // 최상 한 문항을 틀릴 때 붙는 점수
  cut: number; // 이 점수에 닿으면 재수강
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
 * 위해서다. 표준인지 상인지는 사람마다 갈리지만 최상인지 아닌지는 덜 갈린다.
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
 * 기초 미달 · 심화 미달을 따로 본다.
 *
 * 재수강 판정은 틀린 개수만 세므로 어디가 비었는지는 말해 주지 않는다.
 * 같은 5개를 틀려도 표준을 흘린 학생과 최상만 못 푼 학생은 처방이 다르다.
 * 앞은 지난 학기를 다시 봐야 하고, 뒤는 더 어려운 문제를 줘야 한다.
 *
 * 학기를 정하는 것은 재수강 판정 쪽이고 이것은 눈길 줄 곳만 가리킨다.
 * 난이도가 문항마다 사람이 매긴 판단값이라, 라벨이 조금 흔들려도 학생의
 * 진로가 바뀌지 않도록 일부러 판정과 분리해 두었다.
 *
 * 재수강은 아니어도 심화가 비어 있으면 그것대로 알아야 하므로, 두 줄은
 * 판정과 상관없이 늘 나온다.
 *
 * 정답률이 아니라 개수로 잡는다. 시험지마다 표준이 7~9문항, 최상이 8~9문항이라
 * 정답률로 해도 같은 자리에 걸리지만, 개수로 적어 두면 선생님이 화면을 보고
 * 바로 셀 수 있다.
 */
export interface GapCuts {
  basic: number; // 표준을 이만큼 이상 틀리면 기초 미달
  top: number; // 최상을 이만큼 이상 틀리면 심화 미달
}

export const DEFAULT_GAP_CUTS: GapCuts = { basic: 2, top: 5 };

export interface LevelGap {
  level: string;
  total: number;
  wrong: number;
  cut: number; // 몇 개부터 미달인가
  short: boolean; // 미달인가
}

/** 그 난이도의 문항을 아직 채점하지 않았으면 그 자리는 null. */
export function levelGaps(
  exam: Exam,
  marks: Mark[],
  cuts: GapCuts = DEFAULT_GAP_CUTS
): { basic: LevelGap | null; advanced: LevelGap | null } {
  const pick = (level: string, cut: number): LevelGap | null => {
    const nos = new Set(
      exam.questions.filter((q) => q.level?.trim() === level).map((q) => q.no)
    );
    const mine = marks.filter((m) => nos.has(m.no));
    if (mine.length === 0) return null;
    const wrong = mine.filter((m) => !isFullMark(m)).length;
    return { level, total: mine.length, wrong, cut, short: wrong >= cut };
  };
  return { basic: pick('표준', cuts.basic), advanced: pick('최상', cuts.top) };
}

export interface AssessmentData {
  students: Student[];
  exams: Exam[];
  results: Result[];
  /** 손으로 지운 시험지 이름. papers/ 에 남아 있어도 다시 넣지 않는다. */
  dismissed?: string[];
  /** 예상 등급 사다리. 안 적었으면 DEFAULT_GRADE_LADDER 를 쓴다. */
  gradeLadder?: GradeRung[];
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
      dismissed: Array.isArray(p.dismissed) ? p.dismissed : [],
      // 판정 기준이 정답률 % → 오답 개수 → 난이도별 허용 개수로 두 번 바뀌었다.
      // 예전에 저장된 값을 그대로 읽으면 엉뚱한 기준이 되므로 모양이 맞을 때만 쓴다.
      retakeScale:
        p.retakeScale &&
        typeof p.retakeScale.base === 'number' &&
        typeof p.retakeScale.top === 'number' &&
        typeof p.retakeScale.cut === 'number'
          ? p.retakeScale
          : undefined,
      gradeLadder:
        Array.isArray(p.gradeLadder) && p.gradeLadder.length === DEFAULT_GRADE_LADDER.length
          ? p.gradeLadder
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
  paper: ['문제지', '문제지파일', 'paper'],
  solution: ['해설', '해설지', '해설지파일', 'solution'],
  blueprint: ['출제표', '출제표파일', 'blueprint'],
};

// 서술형/논술형/서답형은 형식만 다르게 표시한다. 채점은 객관식과 같은 O/X다.
const ESSAY_WORDS = ['서술', '논술', '서답'];

export function normalizeFormat(raw: string): QFormat {
  const v = raw.trim();
  return ESSAY_WORDS.some((w) => v.includes(w)) ? '서술형' : '객관식';
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
  // 인쇄물은 시험지 한 장에 하나뿐이라 문항이 아니라 시험지에 붙는다.
  const attachCols = ATTACH_KINDS.map((k) => [k, header.indexOf(k)] as [AttachKind, number]).filter(
    ([, i]) => i !== -1
  );
  const extra: [string, number][] = (['unit', 'level', 'source', 'sourceNo'] as const)
    .map((k) => [k, header.indexOf(k)] as [string, number])
    .filter(([, i]) => i !== -1);

  let title: string | undefined;
  let subject: string | undefined;
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

function findCol(header: string[], aliases: string[]): number {
  const low = header.map((h) => h.trim().toLowerCase());
  for (const a of aliases) {
    const i = low.indexOf(a.toLowerCase());
    if (i >= 0) return i;
  }
  return -1;
}

function csvEscape(v: string): string {
  return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
}

// ── 채점(O/X) CSV ────────────────────────────────────────
export function resultToCsv(
  studentName: string,
  examTitle: string,
  date: string,
  questions: ExamQuestion[],
  marks: Mark[]
): string {
  const byNo = new Map(marks.map((m) => [m.no, m]));
  const lines = ['학생,시험지,응시일,문항번호,형식,배점,OX'];
  for (const q of questions) {
    const m = byNo.get(q.no);
    // 서술형도 O/X로만 매긴다. 미입력 문항은 비워 둔다.
    const ox = m === undefined ? '' : isFullMark(m) ? 'O' : 'X';
    lines.push(
      [
        csvEscape(studentName),
        csvEscape(examTitle),
        csvEscape(date),
        String(q.no),
        isEssay(q) ? '서술형' : '객관식',
        fmtPoints(pointsOf(q)),
        ox,
      ].join(',')
    );
  }
  return '﻿' + lines.join('\r\n');
}

/**
 * 'full' = O, 0 = X. 맞았는지 틀렸는지만 담는다.
 * 몇 점인지는 시험지의 배점이 정하므로 여기서 짐작하지 않는다.
 */
export type GradedCell = number | 'full';

/**
 * 채점표 CSV를 읽는다. OX 열이 기준이다.
 *
 * '득점' 열이 있는 예전 표도 읽어 준다. 다만 서술형도 O/X로만 매기므로
 * 배점을 다 받았으면 O, 그 아래는 전부 X로 접는다.
 */
export function parseGradingCsv(text: string): {
  date?: string;
  earned: Record<number, GradedCell>;
  errors: string[];
} {
  const rows = parseCsv(text);
  const errors: string[] = [];
  if (rows.length < 2) return { earned: {}, errors: ['CSV에 데이터 행이 없습니다.'] };
  const header = rows[0];
  const idxNo = findCol(header, ['문항번호', '번호', '문항', '문제번호', 'no']);
  const idxOx = findCol(header, ['ox', 'o/x', '정답여부', '채점', 'result', '맞음']);
  const idxEarned = findCol(header, ['득점', '획득점수', '점수', 'earned']);
  const idxPoints = findCol(header, ['배점', 'points']);
  const idxDate = findCol(header, ['응시일', '날짜', 'date']);
  if (idxNo === -1 || (idxOx === -1 && idxEarned === -1)) {
    errors.push('문항번호와 OX 열을 찾지 못했습니다.');
    return { earned: {}, errors };
  }
  const earned: Record<number, GradedCell> = {};
  let date: string | undefined;
  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r];
    const no = Number((cells[idxNo] ?? '').replace(/[^0-9]/g, ''));
    if (!no) continue;
    if (idxDate >= 0 && !date && (cells[idxDate] ?? '').trim()) date = cells[idxDate].trim();

    const val = idxOx >= 0 ? (cells[idxOx] ?? '').trim().toUpperCase() : '';
    if (['O', '1', '맞음', '정답', 'TRUE', '○'].includes(val)) {
      earned[no] = 'full';
      continue;
    }
    if (['X', '0', '틀림', '오답', 'FALSE', '×'].includes(val)) {
      earned[no] = 0;
      continue;
    }

    const rawEarned = idxEarned >= 0 ? (cells[idxEarned] ?? '').trim() : '';
    if (rawEarned === '') continue; // 둘 다 비었으면 미입력
    const v = Number(rawEarned);
    if (!Number.isFinite(v) || v < 0) {
      errors.push(`${r + 1}행: 득점이 숫자가 아닙니다 ("${rawEarned}").`);
      continue;
    }
    const max = idxPoints >= 0 ? Number((cells[idxPoints] ?? '').trim()) : NaN;
    // 배점을 다 받았으면 O. 부분점수는 만점이 아니므로 X로 본다.
    earned[no] = Number.isFinite(max) && max > 0 ? (v >= max ? 'full' : 0) : v > 0 ? 'full' : 0;
  }
  return { date, earned, errors };
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
  rate: number; // 득점률 0~1 (배점이 다 같으면 정답률과 같다)
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
//   유형   어떤 능력에서 막히는지     약한 순
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

// 등록된 시험지들에 실제로 등장하는 문항 유형의 가짓수.
// 홈 화면의 '분석 유형' 숫자. 유형 분류를 바꿔도 이 값이 저절로 따라온다.
export function countTypes(exams: Exam[]): number {
  const seen = new Set<string>();
  for (const e of exams) for (const q of e.questions) for (const t of splitTypes(q.type)) seen.add(t);
  return seen.size;
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
