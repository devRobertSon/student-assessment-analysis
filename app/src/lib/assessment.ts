// src/lib/assessment.ts — 진단평가 데이터(학생·시험지·채점) + CSV 임포트 + 집계
// 저장: localStorage 단일 키 + JSON 백업
// 채점 방식이 갈린다. 객관식은 O/X, 서술형은 0점~배점 사이의 부분점수를 준다.
export type QFormat = '객관식' | '서술형';

export interface ExamQuestion {
  no: number;
  type: string; // 유형 — 무엇을 하다 막히는가 (행동영역)
  format?: QFormat; // 없으면 객관식
  answer?: string;
  points?: number;
  // 아래 넷은 선택이다. 적어 두면 유형 말고 다른 축으로도 집계된다.
  unit?: string; // 단원 — 무엇을 안 배웠는가
  level?: string; // 난이도 — 어디서 멈추는가 (표준·상·최상)
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

export interface Exam {
  id: string;
  title: string;
  subject: string;
  date: string; // 등록일 YYYY-MM-DD (응시일은 채점 결과 Result.date에 학생별로 기록된다)
  questions: ExamQuestion[];
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
  // 이미 저장된 채점의 점수가 흔들리지 않는다.
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

export interface AssessmentData {
  students: Student[];
  exams: Exam[];
  results: Result[];
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
};

// 서술형/논술형/서답형만 부분점수 대상으로 보고 나머지(객관식·단답형)는 O/X로 채점한다.
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
  const extra: [string, number][] = (['unit', 'level', 'source', 'sourceNo'] as const)
    .map((k) => [k, header.indexOf(k)] as [string, number])
    .filter(([, i]) => i !== -1);

  let title: string | undefined;
  let subject: string | undefined;
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
    const existing = questions.findIndex((x) => x.no === no);
    if (existing !== -1) questions[existing] = q;
    else questions.push(q);
  }

  questions.sort((a, b) => a.no - b.no);
  return { questions, title, subject, errors };
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

// ── 학생 목록 CSV ────────────────────────────────────────
export function studentsToCsv(students: Student[]): string {
  const lines = ['이름,학년'];
  for (const s of students) {
    lines.push([csvEscape(s.name), csvEscape(s.grade)].join(','));
  }
  return '﻿' + lines.join('\r\n');
}

export interface StudentDraft {
  name: string;
  grade: string;
}

export function parseStudentsCsv(text: string): { drafts: StudentDraft[]; errors: string[] } {
  const rows = parseCsv(text);
  const errors: string[] = [];
  if (rows.length < 2) return { drafts: [], errors: ['CSV에 데이터 행이 없습니다.'] };
  const header = rows[0];
  const idxName = findCol(header, ['이름', '학생', '학생이름', 'name']);
  const idxGrade = findCol(header, ['학년', 'grade']);
  if (idxName === -1) {
    errors.push('이름 열을 찾지 못했습니다. (헤더에 "이름" 필요)');
    return { drafts: [], errors };
  }
  const drafts: StudentDraft[] = [];
  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r];
    const name = (cells[idxName] ?? '').trim();
    if (!name) continue;
    const grade = (idxGrade >= 0 ? (cells[idxGrade] ?? '').trim() : '') || '중1';
    drafts.push({ name, grade });
  }
  return { drafts, errors };
}

// 이름 기준 업서트(있으면 갱신, 없으면 추가) — 채점 결과 보존
export function upsertStudents(
  data: AssessmentData,
  drafts: StudentDraft[]
): { data: AssessmentData; added: number; updated: number } {
  const students = [...data.students];
  let added = 0;
  let updated = 0;
  for (const d of drafts) {
    const idx = students.findIndex((s) => s.name === d.name);
    if (idx >= 0) {
      students[idx] = { ...students[idx], grade: d.grade };
      updated += 1;
    } else {
      students.push({ id: newId('stu'), name: d.name, grade: d.grade });
      added += 1;
    }
  }
  return { data: { ...data, students }, added, updated };
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
  const lines = ['학생,시험지,응시일,문항번호,형식,배점,득점,OX'];
  for (const q of questions) {
    const m = byNo.get(q.no);
    // 서술형은 득점 칸을, 객관식은 OX 칸을 채운다. 미입력 문항은 둘 다 비워 둔다.
    const ox = m === undefined ? '' : isFullMark(m) ? 'O' : 'X';
    const earned = m === undefined ? '' : fmtPoints(m.earned);
    lines.push(
      [
        csvEscape(studentName),
        csvEscape(examTitle),
        csvEscape(date),
        String(q.no),
        isEssay(q) ? '서술형' : '객관식',
        fmtPoints(pointsOf(q)),
        earned,
        ox,
      ].join(',')
    );
  }
  return '﻿' + lines.join('\r\n');
}

// 문항번호 → 득점. 서술형은 '득점' 열을, 객관식은 'OX' 열을 읽는다.
// 둘 다 있으면 득점을 우선한다(부분점수가 더 구체적인 정보라서).
/** 'full' = O 표시. 몇 점인지는 시험지의 배점이 정하므로 여기서 짐작하지 않는다. */
export type GradedCell = number | 'full';

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
  const idxDate = findCol(header, ['응시일', '날짜', 'date']);
  if (idxNo === -1 || (idxOx === -1 && idxEarned === -1)) {
    errors.push('문항번호와 OX(또는 득점) 열을 찾지 못했습니다.');
    return { earned: {}, errors };
  }
  const earned: Record<number, GradedCell> = {};
  let date: string | undefined;
  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r];
    const no = Number((cells[idxNo] ?? '').replace(/[^0-9]/g, ''));
    if (!no) continue;
    if (idxDate >= 0 && !date && (cells[idxDate] ?? '').trim()) date = cells[idxDate].trim();

    const rawEarned = idxEarned >= 0 ? (cells[idxEarned] ?? '').trim() : '';
    if (rawEarned !== '') {
      const v = Number(rawEarned);
      if (Number.isFinite(v) && v >= 0) {
        earned[no] = v;
        continue;
      }
      errors.push(`${r + 1}행: 득점이 숫자가 아닙니다 ("${rawEarned}").`);
    }

    const val = idxOx >= 0 ? (cells[idxOx] ?? '').trim().toUpperCase() : '';
    if (['O', '1', '맞음', '정답', 'TRUE', '○'].includes(val)) earned[no] = 'full';
    else if (['X', '0', '틀림', '오답', 'FALSE', '×'].includes(val)) earned[no] = 0;
    // 그 외(빈칸 등)는 미입력으로 둔다
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
  rate: number; // 득점률 0~1 (배점·서술형 부분점수가 없으면 정답률과 같다)
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
    // 유형은 약한 것부터 — 리포트의 레이더·막대가 이 순서를 그대로 쓴다
    return rows.sort((a, b) => a.rate - b.rate || b.total - a.total);
  }
  const rank = new Map(order.map((k, i) => [k, i]));
  return rows.sort((a, b) => (rank.get(a.type) ?? 999) - (rank.get(b.type) ?? 999));
}

// ── 집계 축 ──────────────────────────────────────────────
// 한 시험에서 세 가지를 읽는다.
//   유형   무엇을 하다 막히는가   — 약한 순
//   단원   무엇을 안 배웠는가     — 시험지에 나온 순(교육과정 순)
//   난이도 어디서 멈추는가        — 표준 → 상 → 최상
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

/** 그 축을 쓸 수 있는 시험지인지 — 단원·난이도를 안 적었으면 탭을 숨긴다. */
export function hasAxis(exam: Exam, axis: Axis): boolean {
  return exam.questions.some((q) => keysOf(q, axis).length > 0);
}

// 등록된 시험지들에 실제로 등장하는 문항 유형의 가짓수.
// 홈 화면의 '분석 유형' 숫자 — 유형 분류를 바꿔도 이 값이 저절로 따라온다.
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
