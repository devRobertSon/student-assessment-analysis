// src/lib/papersync.ts
//
// 시험지는 저장소의 papers/ 에서만 들어온다.
//
// app/public/papers/ 에 <이름>_시험지.csv 를 넣고 push 하면 다음 배포부터
// 앱의 시험지 목록에 나타난다. 앱에서 올리는 길은 없다 — 시험지가 늘 저장소와
// 같은 상태가 되고, 어느 기기에서 열어도 똑같이 보인다.
//
// 목록은 빌드 때 만든 papers/index.json에서 나온다(scripts/papers-manifest.mjs).

import { AssessmentData, Exam, examQuestionsFromCsv, newId, todayStr } from './assessment';
import { loadSitePapers } from './papers';

/** 시험지 하나를 두 번 읽지 않도록 만들어 둔다. CSV 내용은 배포 사이에 바뀌지 않는다. */
const parsed = new Map<string, Exam | null>();

async function examFromSheet(file: string): Promise<Exam | null> {
  if (parsed.has(file)) return parsed.get(file) ?? null;
  let made: Exam | null = null;
  try {
    const r = await fetch(`${import.meta.env.BASE_URL}papers/${encodeURIComponent(file)}`);
    if (r.ok) {
      const res = examQuestionsFromCsv(await r.text());
      if (res.questions.length > 0) {
        made = {
          id: '', // 붙일 때 정한다 — 이미 있는 시험지면 그 id를 이어 쓴다
          title: (res.title || file.replace(/_?시험지\.csv$/i, '').replace(/_/g, ' ')).trim(),
          subject: res.subject || '수학',
          date: todayStr(),
          questions: res.questions,
          files: res.files,
        };
      }
    }
  } catch {
    // 한 개가 실패해도 나머지는 읽는다.
  }
  parsed.set(file, made);
  return made;
}

/** 시험지에서 저장소가 정하는 부분. 이게 같으면 다시 쓸 필요가 없다. */
const shape = (e: Exam) => JSON.stringify([e.title, e.subject, e.questions, e.files ?? null]);

/**
 * papers/ 의 시험지를 앱 목록에 맞춘다.
 *
 * - 없던 시험지는 넣는다
 * - 있던 시험지는 문항·인쇄물을 저장소 내용으로 맞춘다 (id는 그대로 두어
 *   이미 저장된 채점 결과가 끊기지 않게 한다)
 * - 손으로 지운 시험지(dismissed)는 다시 넣지 않는다
 * - 저장소에서 빠진 시험지는 지우지 않는다 — 채점 결과가 딸려 있을 수 있다
 *
 * 바뀐 게 없으면 null. 그래야 열 때마다 쓸데없이 저장·동기화되지 않는다.
 */
export async function syncExamsFromPapers(data: AssessmentData): Promise<Exam[] | null> {
  const papers = await loadSitePapers();
  const sheets = papers.filter((p) => p.kind === '시험지');
  if (sheets.length === 0) return null;

  const dismissed = new Set(data.dismissed ?? []);
  const byTitle = new Map(data.exams.map((e) => [e.title.trim(), e]));
  const next = [...data.exams];
  let changed = false;

  for (const sheet of sheets) {
    const made = await examFromSheet(sheet.file);
    if (!made || dismissed.has(made.title)) continue;

    const have = byTitle.get(made.title);
    if (!have) {
      next.push({ ...made, id: newId('exam') });
      changed = true;
      continue;
    }
    // 이미 있다면 저장소 내용으로만 맞춘다. 등록일은 처음 들어온 날을 지킨다.
    if (shape(have) !== shape(made)) {
      const merged: Exam = { ...made, id: have.id, date: have.date };
      next[next.indexOf(have)] = merged;
      changed = true;
    }
  }
  return changed ? next : null;
}
