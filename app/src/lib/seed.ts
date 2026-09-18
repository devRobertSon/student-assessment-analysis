// src/lib/seed.ts
//
// 사이트에 같이 올려 둔 진단평가를 처음 한 번 시험지 목록에 넣는다.
//
// 목록은 빌드 때 만든 papers/index.json에서 나온다(scripts/papers-manifest.mjs).
// 시험지 CSV를 받아 사용자가 [CSV 업로드]로 올렸을 때와 똑같은 함수로 읽으므로,
// 여기서 만든 시험지와 손으로 올린 시험지는 생김새가 같다.

import { Exam, examQuestionsFromCsv, newId, todayStr } from './assessment';

interface ManifestFile {
  kind: string;
  file: string;
}
interface ManifestGroup {
  name: string;
  files: ManifestFile[];
}

export interface SeedResult {
  /** 목록을 읽어 왔는가. 못 읽었으면(오프라인 등) 다음에 다시 시도해야 한다. */
  ok: boolean;
  exams: Exam[];
}

const url = (file: string) => `${import.meta.env.BASE_URL}papers/${encodeURIComponent(file)}`;

/**
 * 기본 진단평가를 시험지로 만든다. 이미 같은 이름이 있으면 건너뛴다.
 * 목록을 못 읽으면 ok: false — 앱은 그대로 쓰고 다음 실행에서 다시 해 본다.
 */
export async function buildSeedExams(have: Exam[]): Promise<SeedResult> {
  let groups: ManifestGroup[];
  try {
    const r = await fetch(`${import.meta.env.BASE_URL}papers/index.json`);
    if (!r.ok) return { ok: false, exams: [] };
    const d = (await r.json()) as { groups?: ManifestGroup[] };
    groups = Array.isArray(d.groups) ? d.groups : [];
  } catch {
    return { ok: false, exams: [] };
  }

  const titles = new Set(have.map((e) => e.title.trim()));
  const exams: Exam[] = [];

  for (const g of groups) {
    const sheet = g.files.find((f) => f.kind === '시험지');
    if (!sheet) continue;
    try {
      const r = await fetch(url(sheet.file));
      if (!r.ok) continue;
      const res = examQuestionsFromCsv(await r.text());
      const title = (res.title || g.name).trim();
      if (res.questions.length === 0 || titles.has(title)) continue;
      titles.add(title);
      exams.push({
        id: newId('exam'),
        title,
        subject: res.subject || '수학',
        date: todayStr(),
        questions: res.questions,
        files: res.files,
      });
    } catch {
      // 한 개가 실패해도 나머지는 넣는다.
    }
  }
  return { ok: true, exams };
}
