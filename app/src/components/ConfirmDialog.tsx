import { useEffect, useRef } from 'react';

/**
 * 지우기 전에 한 번 묻는 창.
 *
 * 브라우저 기본 confirm()을 쓰지 않는다. 생김새가 앱과 따로 놀고, 크롬은
 * 같은 창에서 여러 번 뜨면 '추가 대화상자 차단'으로 막아 버린다. 그러면
 * 묻지도 않고 지워지지 않는 상태가 된다.
 *
 * 처음 focus는 [아니요]에 둔다. Enter를 연달아 치다가 지워지지 않게.
 */
export default function ConfirmDialog({
  title,
  message,
  detail,
  yesLabel = '예, 삭제합니다',
  onYes,
  onNo,
}: {
  title: string;
  message: string;
  detail?: string;
  yesLabel?: string;
  onYes: () => void;
  onNo: () => void;
}) {
  const noRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    noRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onNo();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onNo]);

  return (
    <div className="pick-back" onClick={onNo}>
      <div className="cf-box" onClick={(e) => e.stopPropagation()} role="alertdialog" aria-label={title}>
        <b className="cf-title">{title}</b>
        <p className="cf-msg">{message}</p>
        {detail && <p className="cf-detail">{detail}</p>}
        <div className="cf-btns">
          <button ref={noRef} className="mini" onClick={onNo}>
            아니요
          </button>
          <button className="del-btn mini cf-yes" onClick={onYes}>
            {yesLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
