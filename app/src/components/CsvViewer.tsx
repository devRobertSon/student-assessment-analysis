import { useEffect, useState } from 'react';
import { parseCsv } from '../lib/assessment';

/**
 * CSV를 앱 안에서 표로 띄운다.
 *
 * 브라우저는 CSV를 그리지 못하고 내려받아 버린다. 출제표를 훑어보려고
 * 파일을 받게 만들지 않으려고, 받아서 직접 표로 그린다. 휴대폰에서도 같다.
 */
export default function CsvViewer({
  title,
  name,
  href,
  onClose,
}: {
  title: string;
  name: string;
  href: string;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<string[][] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    fetch(href)
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(`${r.status}`))))
      .then((t) => alive && setRows(parseCsv(t)))
      .catch((e) => alive && setError((e as Error).message));
    return () => {
      alive = false;
    };
  }, [href]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const head = rows?.[0] ?? [];
  const body = rows?.slice(1) ?? [];

  return (
    <div className="pick-back" onClick={onClose}>
      <div className="csv-box" onClick={(e) => e.stopPropagation()}>
        <div className="pick-head">
          <b>{title}</b>
          <span className="hint">{name}</span>
          <span style={{ marginLeft: 'auto' }} />
          <a className="file-act" href={href} download={name}>
            다운로드
          </a>
          <button className="del" onClick={onClose} title="닫기 (Esc)">
            ✕
          </button>
        </div>

        {error ? (
          <p className="muted">파일을 읽지 못했습니다. ({error})</p>
        ) : !rows ? (
          <p className="muted">읽는 중…</p>
        ) : (
          <div className="csv-scroll">
            <table className="csv-table">
              <thead>
                <tr>
                  {head.map((h, i) => (
                    <th key={i}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {body.map((r, i) => (
                  <tr key={i}>
                    {head.map((_, k) => (
                      <td key={k}>{r[k] ?? ''}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {rows && <p className="hint csv-foot">{body.length}행 · {head.length}열</p>}
      </div>
    </div>
  );
}
