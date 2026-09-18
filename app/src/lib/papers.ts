// src/lib/papers.ts
//
// 사이트에 같이 올려 둔 인쇄물 목록.
//
// GitHub Pages는 폴더 목록을 보여주지 않으므로 빌드 때 만든 papers/index.json을
// 읽는다(scripts/papers-manifest.mjs). 한 번 읽고 모듈에 들고 있어, 시험지 줄마다
// 다시 받지 않는다.

import { useEffect, useState } from 'react';

export interface SitePaper {
  /** papers/ 안의 파일 이름. 시험지에 저장되는 값이 이것이다. */
  file: string;
  /** 문제지 PDF 처럼 사람이 읽는 이름. */
  label: string;
  /** 어느 시험지 묶음인지. 규칙에 안 맞는 파일은 '기타'. */
  group: string;
  kind: string;
  ext: string;
  size: number;
}

interface ManifestGroup {
  name: string;
  files: Omit<SitePaper, 'group'>[];
}

let cache: SitePaper[] | null = null;
let inflight: Promise<SitePaper[]> | null = null;

export function loadSitePapers(): Promise<SitePaper[]> {
  if (cache) return Promise.resolve(cache);
  if (inflight) return inflight;
  inflight = fetch(`${import.meta.env.BASE_URL}papers/index.json`)
    .then((r) => (r.ok ? r.json() : { groups: [] }))
    .then((d: { groups?: ManifestGroup[] }) => {
      const list = (d.groups ?? []).flatMap((g) => g.files.map((f) => ({ ...f, group: g.name })));
      cache = list;
      return list;
    })
    .catch(() => {
      // 목록을 못 읽어도 앱은 그대로 쓴다. 다음에 다시 해 볼 수 있게 캐시는 두지 않는다.
      inflight = null;
      return [];
    });
  return inflight;
}

export function useSitePapers(): SitePaper[] | null {
  const [papers, setPapers] = useState<SitePaper[] | null>(cache);
  useEffect(() => {
    if (papers) return;
    let alive = true;
    loadSitePapers().then((p) => alive && setPapers(p));
    return () => {
      alive = false;
    };
  }, [papers]);
  return papers;
}

export function fmtSize(bytes: number): string {
  if (!bytes) return '';
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
  return `${Math.max(1, Math.round(bytes / 1024))}KB`;
}
