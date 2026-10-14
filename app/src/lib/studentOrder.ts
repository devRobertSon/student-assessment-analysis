// src/lib/studentOrder.ts
//
// 학생을 보여 줄 차례. 저장된 차례는 등록한 차례라, 학생이 늘수록 이름을
// 찾기 어렵다. 화면에서는 가나다 차례로 놓는다(2026-10-14 원장님 말씀).
// 저장된 차례는 건드리지 않는다.

import type { Student } from './assessment';

/**
 * 이름 → 학교 → 학년 차례로 견준다. 이름이 같으면(동명이인) 학교로, 학교도
 * 같으면 학년으로 가른다. 학교를 안 적은 학생은 적은 학생 뒤에 온다.
 */
export function compareStudents(a: Student, b: Student): number {
  const byName = a.name.trim().localeCompare(b.name.trim(), 'ko');
  if (byName) return byName;
  const sa = (a.school ?? '').trim();
  const sb = (b.school ?? '').trim();
  if (sa && !sb) return -1;
  if (!sa && sb) return 1;
  const bySchool = sa.localeCompare(sb, 'ko');
  if (bySchool) return bySchool;
  return a.grade.localeCompare(b.grade, 'ko', { numeric: true });
}

/** 가나다 차례로 늘어놓은 새 배열. 받은 배열은 그대로 둔다. */
export function sortStudents(students: Student[]): Student[] {
  return [...students].sort(compareStudents);
}
