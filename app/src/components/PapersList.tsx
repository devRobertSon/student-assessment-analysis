import { useEffect, useState } from 'react';
import { paperHref } from '../lib/assessment';

/**
 * 사이트에 같이 올려 둔 인쇄물·서식 목록.
 *
 * GitHub Pages는 폴더 목록을 보여주지 않으므로 빌드 때 만들어 둔
 * papers/index.json을 읽어 그린다 (scripts/papers-manifest.mjs).
 * 파일을 넣고 빼면 다음 빌드에 따라오므로 여기에 시험지 이름을 적지 않는다.
 */
interface PaperFile {
  kind: string;
  label: string;
  file: string;
  ext: string;
  size: number;
}
interface PaperGroup {
  name: string;
  files: PaperFile[];
}

function fmtSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
  return `${Math.max(1, Math.round(bytes / 1024))}KB`;
}

export default function PapersList() {
  const [groups, setGroups] = useState<PaperGroup[] | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`${import.meta.env.BASE_URL}papers/index.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => alive && setGroups(Array.isArray(d?.groups) ? d.groups : []))
      // 목록이 없어도 앱은 그대로 쓴다. 조용히 접어 둔다.
      .catch(() => alive && setGroups([]));
    return () => {
      alive = false;
    };
  }, []);

  if (!groups || groups.length === 0) return null;

  return (
    <details className="assess-card papers">
      <summary>
        받아 쓸 수 있는 시험지 · 인쇄물 <span className="hint">{groups.length}종</span>
      </summary>
      <p className="hint" style={{ margin: '8px 0 12px' }}>
        만들어 둔 진단평가입니다. <b>시험지 CSV</b>를 위에 올리면 시험지가 등록되고,{' '}
        <b>채점표 CSV</b>는 [채점] 화면에서 씁니다. 문제지와 해설은 그대로 인쇄하시면 됩니다.
      </p>
      <ul className="papers-list">
        {groups.map((g) => (
          <li key={g.name}>
            <b>{g.name}</b>
            <span className="papers-files">
              {g.files.map((f) => (
                <a key={f.file} className="file-link" href={paperHref(f.file)} download target="_blank" rel="noopener">
                  {f.label} <em>{fmtSize(f.size)}</em>
                </a>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}
