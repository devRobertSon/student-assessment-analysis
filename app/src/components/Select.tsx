import { useEffect, useRef, useState } from 'react';

/**
 * 고르는 칸.
 *
 * <select> 의 펼침 목록은 브라우저가 그리는 창이라 앱과 생김새가 따로 논다.
 * 글자 크기도 줄 높이도 CSS 로 손댈 수 없다. 그래서 직접 그린다.
 * DatePicker 와 같은 규칙으로 연다. 바깥을 누르거나 Esc 로 닫힌다.
 *
 * searchable 을 주면 칸에 글자를 쳐서 찾는다. 학생이 늘면 목록을 굴려
 * 찾기보다 이름을 치는 편이 빠르다(2026-10-14 원장님 말씀). 친 글자가 이름에
 * 들어 있는 줄만 남기고, Enter 를 누르면 맨 위 줄을 고른다.
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
  searchable,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Option[];
  placeholder?: string;
  disabled?: boolean;
  /** 화면에는 안 보이고 읽어 주는 데만 쓰는 이름. */
  label: string;
  /** 칸에 글자를 쳐서 찾는다. */
  searchable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  /** 찾는 칸에 친 글자. searchable 일 때만 쓴다. */
  const [query, setQuery] = useState('');
  const boxRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const picked = options.find((o) => o.value === value);
  const q = query.trim();
  const shown = searchable && q ? options.filter((o) => o.label.includes(q)) : options;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) close();
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  // 펼칠 때는 지금 고른 줄에서 시작하고, 목록이 길면 그 줄이 보이게 굴린다.
  // 글자를 쳐서 찾는 중에는 맨 위 줄에 머문다(onChange 에서 맞춘다).
  useEffect(() => {
    if (!open || q) return;
    const i = options.findIndex((o) => o.value === value);
    setActive(i);
    const el = listRef.current?.children[Math.max(0, i)] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, value, options]);

  function close() {
    setOpen(false);
    setQuery('');
  }

  const choose = (v: string) => {
    onChange(v);
    close();
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (disabled) return;
    // 한글을 조합하는 중의 Enter 는 글자를 마무리하는 것이지 고르는 것이 아니다.
    if (e.nativeEvent.isComposing) return;
    if (e.key === 'Escape') {
      close();
      return;
    }
    // 찾는 칸에서는 띄어쓰기가 글자다. 여는 데는 쓰지 않는다.
    const opens = e.key === 'Enter' || e.key === 'ArrowDown' || (!searchable && e.key === ' ');
    if (!open && opens) {
      e.preventDefault();
      setOpen(true);
      return;
    }
    if (!open) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const step = e.key === 'ArrowDown' ? 1 : -1;
      const next = Math.min(shown.length - 1, Math.max(0, active + step));
      setActive(next);
      (listRef.current?.children[next] as HTMLElement | undefined)?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const o = shown[active] ?? (shown.length === 1 ? shown[0] : undefined);
      if (o) choose(o.value);
    }
  };

  const chevron = (
    <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
      <path d="M4 6.2 8 10l4-3.8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );

  return (
    <div className="sel" ref={boxRef}>
      {searchable ? (
        // 칸을 누르면 고른 이름이 흐린 안내 글로 물러나고 바로 칠 수 있다.
        // 아무것도 안 치고 나가면 고른 이름이 그대로 남는다.
        <div className={`sel-field sel-find ${disabled ? 'off' : ''}`}>
          <input
            type="text"
            role="combobox"
            aria-label={label}
            aria-expanded={open}
            aria-autocomplete="list"
            disabled={disabled}
            value={open ? query : picked?.label ?? ''}
            placeholder={open && picked ? picked.label : placeholder}
            onFocus={() => setOpen(true)}
            onClick={() => setOpen(true)}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
              setActive(0);
              listRef.current?.scrollTo({ top: 0 });
            }}
            onKeyDown={onKey}
            onBlur={(e) => {
              if (!boxRef.current?.contains(e.relatedTarget as Node)) close();
            }}
          />
          {chevron}
        </div>
      ) : (
        <button
          type="button"
          className={`sel-field ${picked ? '' : 'empty'}`}
          aria-label={label}
          aria-expanded={open}
          aria-haspopup="listbox"
          disabled={disabled}
          onClick={() => (open ? close() : setOpen(true))}
          onKeyDown={onKey}
        >
          <span>{picked ? picked.label : placeholder}</span>
          {chevron}
        </button>
      )}

      {open && !disabled && (
        <div className="sel-pop" role="listbox" aria-label={label} ref={listRef}>
          {shown.length === 0 && (
            <p className="sel-none">{q ? `'${q}' 이(가) 들어간 이름이 없습니다.` : '고를 것이 없습니다.'}</p>
          )}
          {shown.map((o, i) => (
            <button
              type="button"
              key={o.value}
              role="option"
              aria-selected={o.value === value}
              className={`sel-opt ${o.value === value ? 'on' : ''} ${i === active ? 'active' : ''}`}
              onMouseEnter={() => setActive(i)}
              // 누르는 동안 찾는 칸이 초점을 잃으면 목록이 먼저 닫혀 고르지 못한다.
              onMouseDown={(e) => e.preventDefault()}
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
