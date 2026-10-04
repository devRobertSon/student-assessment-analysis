// src/lib/examOrder.ts
//
// 시험지를 보여 줄 차례. 저장된 차례는 저장소에 들어온 차례라, 새 시험지가 늘
// 맨 뒤에 붙는다(초6-1 이 공통수학2 뒤에 왔다). 화면에서는 과목별로 모은 뒤
// 배우는 차례대로 놓는다. 저장된 차례는 건드리지 않는다.

import type { Exam } from './assessment';

/** 과목 차례. 여기 없는 과목은 뒤에 가나다 순으로 온다. */
const SUBJECTS = ['수학', '과학'];

/** 학교급 차례. 공통수학은 고1 과목이다. */
const LEVELS = ['초', '중', '고'];

/**
 * 시험지 이름에서 학교급 · 학년 · 학기를 읽는다. 읽지 못하면 null.
 *
 * `초6-1 진단평가` 는 초등 6학년 1학기, `초6 진단평가` 는 한 해짜리라 학기가 없다.
 * `중1 과학 영재성평가` 도 한 해짜리다. `공통수학1` 은 고1 1학기로 본다.
 */
export function gradeOf(title: string): { level: number; year: number; term: number | null } | null {
  const t = title.trim();
  const school = t.match(/^(초|중|고)\s*(\d)(?:-(\d))?/);
  if (school) {
    return {
      level: LEVELS.indexOf(school[1]),
      year: Number(school[2]),
      term: school[3] ? Number(school[3]) : null,
    };
  }
  const common = t.match(/^공통수학\s*(\d)/);
  if (common) return { level: LEVELS.indexOf('고'), year: 1, term: Number(common[1]) };
  return null;
}

function subjectRank(subject: string): number {
  const i = SUBJECTS.indexOf(subject.trim());
  return i === -1 ? SUBJECTS.length : i;
}

/**
 * 과목 → 학교급 → 학년 → 학기 차례로 견준다. 한 해짜리는 그 학년의 학기 시험지
 * 뒤에 온다(초6-1, 초6-2, 초6). 학년을 읽지 못한 시험지는 그 과목의 맨 뒤에
 * 이름 차례로 온다.
 */
export function compareExams(a: Exam, b: Exam): number {
  const bySubject = subjectRank(a.subject) - subjectRank(b.subject);
  if (bySubject) return bySubject;
  if (subjectRank(a.subject) === SUBJECTS.length) {
    const byName = a.subject.localeCompare(b.subject, 'ko');
    if (byName) return byName;
  }
  const ga = gradeOf(a.title);
  const gb = gradeOf(b.title);
  if (ga && !gb) return -1;
  if (!ga && gb) return 1;
  if (ga && gb) {
    const byGrade =
      ga.level - gb.level || ga.year - gb.year || (ga.term ?? 9) - (gb.term ?? 9);
    if (byGrade) return byGrade;
  }
  return a.title.localeCompare(b.title, 'ko');
}

/** 보여 줄 차례로 늘어놓은 새 배열. 받은 배열은 그대로 둔다. */
export function sortExams(exams: Exam[]): Exam[] {
  return [...exams].sort(compareExams);
}
