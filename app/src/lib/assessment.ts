// src/lib/assessment.ts — 진단평가 데이터(학생·시험지·채점) + CSV 임포트 + 집계
// 저장: localStorage 단일 키 + JSON 백업
export interface ExamQuestion {
  no: number;
  type: string; // 유형
  answer?: string;
  points?: number;
}

export interface Exam {
  id: string;
  title: string;
  subject: string;
  date: string; // YYYY-MM-DD
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
  correct: boolean;
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
  title: ['시험지', '시험', '시험지명', '시험명', 'title', 'exam'],
};

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
  const idxTitle = header.indexOf('title');

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
  const byNo = new Map(marks.map((m) => [m.no, m.correct]));
  const lines = ['학생,시험지,응시일,문항번호,OX'];
  for (const q of questions) {
    const v = byNo.get(q.no);
    const ox = v === undefined ? '' : v ? 'O' : 'X';
    lines.push(
      [csvEscape(studentName), csvEscape(examTitle), csvEscape(date), String(q.no), ox].join(',')
    );
  }
  return '﻿' + lines.join('\r\n');
}

export function parseGradingCsv(text: string): { date?: string; ox: Record<number, boolean>; errors: string[] } {
  const rows = parseCsv(text);
  const errors: string[] = [];
  if (rows.length < 2) return { ox: {}, errors: ['CSV에 데이터 행이 없습니다.'] };
  const header = rows[0];
  const idxNo = findCol(header, ['문항번호', '번호', '문항', '문제번호', 'no']);
  const idxOx = findCol(header, ['ox', 'o/x', '정답여부', '채점', 'result', '맞음']);
  const idxDate = findCol(header, ['응시일', '날짜', 'date']);
  if (idxNo === -1 || idxOx === -1) {
    errors.push('문항번호·OX 열을 찾지 못했습니다.');
    return { ox: {}, errors };
  }
  const ox: Record<number, boolean> = {};
  let date: string | undefined;
  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r];
    const no = Number((cells[idxNo] ?? '').replace(/[^0-9]/g, ''));
    if (!no) continue;
    if (idxDate >= 0 && !date && (cells[idxDate] ?? '').trim()) date = cells[idxDate].trim();
    const val = (cells[idxOx] ?? '').trim().toUpperCase();
    if (['O', '1', '맞음', '정답', 'TRUE', '○'].includes(val)) ox[no] = true;
    else if (['X', '0', '틀림', '오답', 'FALSE', '×'].includes(val)) ox[no] = false;
    // 그 외(빈칸 등)는 미입력으로 둔다
  }
  return { date, ox, errors };
}

// ── 집계 ─────────────────────────────────────────────────
export interface TypeStat {
  type: string;
  total: number;
  correct: number;
  rate: number; // 0~1
}

export function typeStatsForResult(exam: Exam, marks: Mark[]): TypeStat[] {
  const typeByNo = new Map<number, string>();
  exam.questions.forEach((q) => typeByNo.set(q.no, q.type));
  const acc = new Map<string, { total: number; correct: number }>();
  for (const m of marks) {
    const type = typeByNo.get(m.no);
    if (!type) continue;
    const a = acc.get(type) ?? { total: 0, correct: 0 };
    a.total += 1;
    if (m.correct) a.correct += 1;
    acc.set(type, a);
  }
  return [...acc.entries()]
    .map(([type, a]) => ({ type, total: a.total, correct: a.correct, rate: a.total ? a.correct / a.total : 0 }))
    .sort((a, b) => a.rate - b.rate || b.total - a.total);
}

// 학생의 여러 시험 결과를 유형별로 누적
export function typeStatsCumulative(exams: Exam[], results: Result[]): TypeStat[] {
  const examById = new Map(exams.map((e) => [e.id, e]));
  const acc = new Map<string, { total: number; correct: number }>();
  for (const res of results) {
    const exam = examById.get(res.examId);
    if (!exam) continue;
    const typeByNo = new Map<number, string>();
    exam.questions.forEach((q) => typeByNo.set(q.no, q.type));
    for (const m of res.marks) {
      const type = typeByNo.get(m.no);
      if (!type) continue;
      const a = acc.get(type) ?? { total: 0, correct: 0 };
      a.total += 1;
      if (m.correct) a.correct += 1;
      acc.set(type, a);
    }
  }
  return [...acc.entries()]
    .map(([type, a]) => ({ type, total: a.total, correct: a.correct, rate: a.total ? a.correct / a.total : 0 }))
    .sort((a, b) => a.rate - b.rate || b.total - a.total);
}

// 등록된 시험지들에 실제로 등장하는 문항 유형의 가짓수.
// 홈 화면의 '분석 유형' 숫자 — 유형 분류를 바꿔도 이 값이 저절로 따라온다.
export function countTypes(exams: Exam[]): number {
  const seen = new Set<string>();
  for (const e of exams) for (const q of e.questions) if (q.type) seen.add(q.type);
  return seen.size;
}

export function scoreOf(marks: Mark[]): { correct: number; total: number; rate: number } {
  const total = marks.length;
  const correct = marks.filter((m) => m.correct).length;
  return { correct, total, rate: total ? correct / total : 0 };
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
