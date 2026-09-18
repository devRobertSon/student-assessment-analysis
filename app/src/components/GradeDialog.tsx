import { useEffect, useRef, useState } from 'react';
import { Exam, ExamQuestion, fmtPoints, isEssay, pointsOf } from '../lib/assessment';

type Cell = number | null;

/**
 * 한 문항씩 크게 띄워 손으로 채점하는 창.
 *
 * 아래 표에서도 채점할 수 있지만 30문항을 훑으려면 스크롤을 해야 한다.
 * 여기서는 O / X 를 누르면 바로 다음 문항으로 넘어가므로, 답안지를 보며
 * 같은 자리에서 손만 움직이면 된다. 키보드로도 같다 — O·X·숫자·Enter.
 */
export default function GradeDialog({
  exam,
  cells,
  onSet,
  onClose,
}: {
  exam: Exam;
  cells: Record<number, Cell>;
  onSet: (no: number, v: Cell) => void;
  onClose: () => void;
}) {
  const qs = exam.questions;
  // 처음 열 때 아직 안 매긴 첫 문항부터 시작한다. 이어서 채점할 때 편하다.
  const [i, setI] = useState(() => {
    const at = qs.findIndex((q) => cells[q.no] === null || cells[q.no] === undefined);
    return at === -1 ? 0 : at;
  });
  const boxRef = useRef<HTMLDivElement>(null);
  const scoreRef = useRef<HTMLInputElement>(null);

  const q: ExamQuestion | undefined = qs[i];
  const pts = q ? pointsOf(q) : 0;
  const essay = !!q && isEssay(q);
  const v = q ? cells[q.no] : null;

  const go = (d: number) => setI((n) => Math.min(qs.length - 1, Math.max(0, n + d)));
  const mark = (value: number) => {
    if (!q) return;
    onSet(q.no, value);
    // 서술형은 점수를 고쳐 적을 일이 많아 자동으로 넘기지 않는다.
    if (!essay) setTimeout(() => go(1), 90);
  };

  // 창이 열려 있는 동안 키를 받는다. 점수 칸에 숫자를 칠 때는 넘기지 않는다.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return onClose();
      const typing = document.activeElement === scoreRef.current;
      if (e.key === 'ArrowLeft') return go(-1);
      if (e.key === 'ArrowRight' || e.key === 'Enter') return go(1);
      if (typing) return;
      const k = e.key.toLowerCase();
      if (k === 'o' || k === 'ㅐ' || e.key === '1') return mark(pts);
      if (k === 'x' || k === 'ㅌ' || e.key === '0') return mark(0);
      if (e.key === 'Backspace' && q) return onSet(q.no, null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  useEffect(() => {
    boxRef.current?.focus();
  }, []);

  if (!q) return null;

  const done = qs.filter((x) => cells[x.no] !== null && cells[x.no] !== undefined).length;
  const earned = qs.reduce((a, x) => a + (typeof cells[x.no] === 'number' ? (cells[x.no] as number) : 0), 0);
  const seen = qs.reduce(
    (a, x) => a + (cells[x.no] === null || cells[x.no] === undefined ? 0 : pointsOf(x)),
    0
  );

  return (
    <div className="gd-back" onClick={onClose}>
      <div className="gd-box" ref={boxRef} tabIndex={-1} onClick={(e) => e.stopPropagation()}>
        <div className="gd-head">
          <b>직접 채점</b>
          <span className="hint">{exam.title}</span>
          <button className="del" style={{ marginLeft: 'auto' }} onClick={onClose} title="닫기 (Esc)">
            ✕
          </button>
        </div>

        <div className="gd-bar" aria-hidden>
          <span style={{ width: `${((i + 1) / qs.length) * 100}%` }} />
        </div>
        <div className="gd-count">
          {i + 1} / {qs.length}문항 · 입력 {done}개
        </div>

        <div className="gd-q">
          <div className="gd-no">
            {q.no}번
            <em>{fmtPoints(pts)}점</em>
            {essay && <span className="q-fmt">서술형</span>}
          </div>
          <div className="gd-type">{q.type}</div>
          <div className="gd-meta">
            {[q.unit, q.level].filter(Boolean).join(' · ')}
            {q.answer && <span className="gd-ans">정답 {q.answer}</span>}
          </div>
        </div>

        <div className="gd-btns">
          <button className={`gd-o ${v === pts ? 'on' : ''}`} onClick={() => mark(pts)}>
            O<em>{essay ? '만점' : '맞음'}</em>
          </button>
          {essay && (
            <label className="gd-score">
              <input
                ref={scoreRef}
                type="number"
                min={0}
                max={pts}
                step={0.5}
                value={v === null || v === undefined ? '' : v}
                placeholder="—"
                onChange={(e) => {
                  const raw = e.target.value;
                  if (raw.trim() === '') return onSet(q.no, null);
                  const n = Number(raw);
                  if (Number.isFinite(n)) onSet(q.no, Math.max(0, Math.min(pts, n)));
                }}
              />
              <span>/ {fmtPoints(pts)}점</span>
            </label>
          )}
          <button className={`gd-x ${v === 0 ? 'on' : ''}`} onClick={() => mark(0)}>
            X<em>{essay ? '0점' : '틀림'}</em>
          </button>
        </div>

        <div className="gd-nav">
          <button className="mini ghost" disabled={i === 0} onClick={() => go(-1)}>
            ← 이전
          </button>
          <span className="hint">
            O · X 키로 입력 · ← → 로 이동 · Backspace 지우기 · Esc 닫기
          </span>
          <button className="mini ghost" disabled={i === qs.length - 1} onClick={() => go(1)}>
            다음 →
          </button>
        </div>

        <div className="gd-foot">
          지금까지 <b>{fmtPoints(earned)}</b> / {fmtPoints(seen)}점
          <button className="primary mini" style={{ marginLeft: 'auto' }} onClick={onClose}>
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
