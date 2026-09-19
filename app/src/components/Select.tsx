import { useEffect, useRef, useState } from 'react';

/**
 * 고르는 칸.
 *
 * <select> 의 펼침 목록은 브라우저가 그리는 창이라 앱과 생김새가 따로 논다.
 * 글자 크기도 줄 높이도 CSS 로 손댈 수 없다. 그래서 직접 그린다.
 * DatePicker 와 같은 규칙으로 연다. 바깥을 누르거나 Esc 로 닫힌다.
 */
export interface Option {
  value: string;
  label: string;
  /** 오른쪽에 흐리게 붙는 곁말. 학년이나 문항 수처럼 고르는 데 도움이 되는 값. */
  note?: string;
}

export default function Select({
  value,
  onChange,
  options,
  placeholder = '선택',
  disabled,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Option[];
  placeholder?: string;
  disabled?: boolean;
  /** 화면에는 안 보이고 읽어 주는 데만 쓰는 이름. */
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const boxRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const picked = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  // 펼칠 때는 지금 고른 줄에서 시작하고, 목록이 길면 그 줄이 보이게 굴린다.
  useEffect(() => {
    if (!open) return;
    const i = options.findIndex((o) => o.value === value);
    setActive(i);
    const el = listRef.current?.children[Math.max(0, i)] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [open, value, options]);

  const choose = (v: string) => {
    onChange(v);
    setOpen(false);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (!open && (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown')) {
      e.preventDefault();
      setOpen(true);
      return;
    }
    if (!open) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const step = e.key === 'ArrowDown' ? 1 : -1;
      const next = Math.min(options.length - 1, Math.max(0, active + step));
      setActive(next);
      (listRef.current?.children[next] as HTMLElement | undefined)?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (options[active]) choose(options[active].value);
    }
  };

  return (
    <div className="sel" ref={boxRef}>
      <button
        type="button"
        className={`sel-field ${picked ? '' : 'empty'}`}
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="listbox"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={onKey}
      >
        <span>{picked ? picked.label : placeholder}</span>
        <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
          <path d="M4 6.2 8 10l4-3.8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>

      {open && !disabled && (
        <div className="sel-pop" role="listbox" aria-label={label} ref={listRef}>
          {options.length === 0 && <p className="sel-none">고를 것이 없습니다.</p>}
          {options.map((o, i) => (
            <button
              type="button"
              key={o.value}
              role="option"
              aria-selected={o.value === value}
              className={`sel-opt ${o.value === value ? 'on' : ''} ${i === active ? 'active' : ''}`}
              onMouseEnter={() => setActive(i)}
              onClick={() => choose(o.value)}
            >
              <span>{o.label}</span>
              {o.note && <em>{o.note}</em>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
