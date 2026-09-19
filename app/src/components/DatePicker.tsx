import { useEffect, useRef, useState } from 'react';

/**
 * 날짜 고르는 달력.
 *
 * <input type="date"> 의 달력은 브라우저가 그리는 창이라 앱과 생김새가 따로
 * 논다. 글자 크기도 색도 CSS 로 손댈 수 없다. 그래서 직접 그린다.
 *
 * 값은 'YYYY-MM-DD' 문자열이다. 빈 문자열이면 고르지 않은 것이고, 리포트에는
 * 밑줄만 인쇄되어 손으로 적는 자리가 된다.
 */
const DAYS = ['일', '월', '화', '수', '목', '금', '토'];

const pad = (n: number) => String(n).padStart(2, '0');
const key = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

export default function DatePicker({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  /** 열림 버튼에 붙는 이름. 화면에는 안 보이고 읽어 주는 데만 쓴다. */
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const today = new Date();
  const picked = /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : '';
  // 고른 날이 있으면 그 달을, 없으면 이번 달을 펼친다.
  const [ym, setYm] = useState(() => {
    const [y, m] = picked ? picked.split('-').map(Number) : [today.getFullYear(), today.getMonth() + 1];
    return { y, m: m - 1 };
  });

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const openAt = () => {
    const [y, m] = picked ? picked.split('-').map(Number) : [today.getFullYear(), today.getMonth() + 1];
    setYm({ y, m: m - 1 });
    setOpen(true);
  };

  const move = (step: number) => {
    const d = new Date(ym.y, ym.m + step, 1);
    setYm({ y: d.getFullYear(), m: d.getMonth() });
  };

  const pick = (v: string) => {
    onChange(v);
    setOpen(false);
  };

  // 1일이 무슨 요일인지에 맞춰 앞을 비우고, 그 달의 날짜만 채운다.
  const first = new Date(ym.y, ym.m, 1).getDay();
  const last = new Date(ym.y, ym.m + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(first).fill(null),
    ...Array.from({ length: last }, (_, i) => i + 1),
  ];
  while (cells.length % 7) cells.push(null);

  const todayKey = key(today.getFullYear(), today.getMonth(), today.getDate());

  return (
    <div className="dp" ref={boxRef}>
      <button type="button" className={`dp-field ${picked ? '' : 'empty'}`} aria-label={label} onClick={openAt}>
        <span>{picked || '날짜 고르기'}</span>
        <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
          <rect x="1.5" y="3" width="13" height="11.5" rx="2" fill="none" stroke="currentColor" strokeWidth="1.3" />
          <path d="M1.5 6.5h13M5 1.6v2.6M11 1.6v2.6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <div className="dp-pop" role="dialog" aria-label={`${label} 달력`}>
          <div className="dp-head">
            <button type="button" className="dp-move" onClick={() => move(-1)} aria-label="이전 달">
              ‹
            </button>
            <b>
              {ym.y}년 {ym.m + 1}월
            </b>
            <button type="button" className="dp-move" onClick={() => move(1)} aria-label="다음 달">
              ›
            </button>
          </div>

          <div className="dp-grid">
            {DAYS.map((d, i) => (
              <span key={d} className={`dp-dow ${i === 0 ? 'sun' : i === 6 ? 'sat' : ''}`}>
                {d}
              </span>
            ))}
            {cells.map((d, i) => {
              if (d === null) return <span key={`b${i}`} className="dp-blank" />;
              const k = key(ym.y, ym.m, d);
              const dow = i % 7;
              return (
                <button
                  type="button"
                  key={k}
                  className={`dp-day ${dow === 0 ? 'sun' : dow === 6 ? 'sat' : ''} ${k === picked ? 'on' : ''} ${
                    k === todayKey ? 'today' : ''
                  }`}
                  onClick={() => pick(k)}
                >
                  {d}
                </button>
              );
            })}
          </div>

          <div className="dp-foot">
            <button type="button" className="mini ghost" onClick={() => pick(todayKey)}>
              오늘
            </button>
            <button type="button" className="mini ghost" onClick={() => pick('')}>
              비우기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
