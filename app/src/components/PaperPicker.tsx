import { useMemo, useState } from 'react';
import { ATTACH_LABEL, AttachKind } from '../lib/assessment';
import { SitePaper, fmtSize, useSitePapers } from '../lib/papers';

/**
 * 시험지에 붙일 인쇄물을 고르는 창.
 *
 * 사이트의 papers/ 에 올려 둔 파일만 나온다. 시험지에는 파일 이름만 저장되므로
 * 다른 데이터와 함께 동기화되고, 다른 기기에서도 그대로 열린다.
 * 새 파일은 app/public/papers/ 에 넣고 push 하면 다음 배포부터 여기에 보인다.
 */
export default function PaperPicker({
  kind,
  examTitle,
  onPick,
  onClose,
}: {
  kind: AttachKind;
  examTitle: string;
  onPick: (file: string) => void;
  onClose: () => void;
}) {
  const papers = useSitePapers();
  const [q, setQ] = useState('');

  const rows = useMemo(() => {
    if (!papers) return [];
    const needle = q.trim().toLowerCase();
    const hit = (p: SitePaper) =>
      !needle || p.file.toLowerCase().includes(needle) || p.group.toLowerCase().includes(needle);
    // 고르려는 종류, 그리고 이 시험지 이름과 맞는 것부터 보여준다.
    const score = (p: SitePaper) =>
      (p.kind === ATTACH_LABEL[kind] ? 0 : 2) + (p.group && examTitle.startsWith(p.group) ? 0 : 1);
    return papers.filter(hit).sort((a, b) => score(a) - score(b) || a.file.localeCompare(b.file, 'ko'));
  }, [papers, q, kind, examTitle]);

  return (
    <div className="pick-back" onClick={onClose}>
      <div className="pick-box" onClick={(e) => e.stopPropagation()}>
        <div className="pick-head">
          <b>{ATTACH_LABEL[kind]} 고르기</b>
          <span className="hint">{examTitle}</span>
          <button className="del" style={{ marginLeft: 'auto' }} onClick={onClose} title="닫기">
            ✕
          </button>
        </div>

        <input
          className="pick-search"
          type="search"
          value={q}
          placeholder="파일 이름으로 찾기"
          autoFocus
          onChange={(e) => setQ(e.target.value)}
        />

        {papers === null ? (
          <p className="muted">목록을 읽는 중…</p>
        ) : rows.length === 0 ? (
          <p className="muted">
            {papers.length === 0
              ? '사이트에 올려 둔 파일이 없습니다.'
              : '찾는 파일이 없습니다.'}
          </p>
        ) : (
          <ul className="pick-list">
            {rows.map((p) => (
              <li key={p.file}>
                <button onClick={() => onPick(p.file)}>
                  <span className="pick-name">{p.file}</span>
                  <span className="pick-meta">
                    {p.kind && p.kind !== p.file && <em>{p.kind}</em>}
                    {fmtSize(p.size)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <p className="hint pick-foot">
          새 파일은 <code>app/public/papers/</code> 에 넣고 push 하면 다음 배포부터 여기에 보입니다.
        </p>
      </div>
    </div>
  );
}
