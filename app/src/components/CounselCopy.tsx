import { useEffect, useRef, useState } from 'react';

/**
 * 상담내용을 띄워 고치고 복사하는 창.
 *
 * 에듀오케이의 입학상담내용 칸에 붙여 넣으려고 만든다. 학생에 적어 둔 값으로
 * 첫 글을 만들어 주되, 상담마다 덧붙일 말이 다르므로 여기서 고칠 수 있게 한다.
 * 고친 글은 남기지 않는다. 남겨야 하는 말은 [학생]의 메모에 적는 자리다.
 */
export default function CounselCopy({
  name,
  text,
  onClose,
}: {
  name: string;
  text: string;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(text);
  /** 복사한 직후 잠깐 '복사했습니다' 로 바뀐다. 눌렀는지 알 길이 달리 없다. */
  const [copied, setCopied] = useState(false);
  /** 두 방법이 다 막혔는가. 막히면 손으로 복사하는 길을 알려 준다. */
  const [failed, setFailed] = useState(false);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(t);
  }, [copied]);

  const copy = async () => {
    const area = areaRef.current;
    const done = () => {
      setCopied(true);
      setFailed(false);
    };
    try {
      // 클립보드 권한이 없거나 http 로 연 화면이면 여기서 막힌다.
      await navigator.clipboard.writeText(draft);
      done();
      return;
    } catch {
      // 아래 옛 방법으로 한 번 더 해 본다.
    }
    // 둘 다 막히면 글자를 잡아만 둔다. 그 자리에서 Ctrl+C 로 복사하면 된다.
    area?.focus();
    area?.select();
    try {
      if (area && document.execCommand('copy')) {
        done();
        return;
      }
    } catch {
      // 아래에서 알려 준다.
    }
    setFailed(true);
  };

  return (
    <div className="pick-back" onClick={onClose}>
      <div className="counsel-box" onClick={(e) => e.stopPropagation()}>
        <div className="pick-head">
          <b>상담내용 복사</b>
          <span className="hint">{name}</span>
          <span style={{ marginLeft: 'auto' }} />
          <button className="del" onClick={onClose} title="닫기 (Esc)">
            ✕
          </button>
        </div>

        <p className="hint counsel-guide">
          에듀오케이의 입학상담내용 칸에 붙여 넣으세요. 목표 고등학교 · 현재 진도 · 메모를 [학생]에 적어 둔
          대로 모았습니다. 여기서 고쳐도 학생 정보는 바뀌지 않습니다.
        </p>

        <textarea
          ref={areaRef}
          className="counsel-area"
          aria-label="상담내용"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="학생에 적어 둔 내용이 없습니다. 여기에 바로 적어도 됩니다."
        />

        {failed && (
          <p className="counsel-fail">
            브라우저가 복사를 막았습니다. 글자를 잡아 두었으니 Ctrl+C 를 누르세요.
          </p>
        )}

        <div className="counsel-foot">
          <span className="hint">{draft.length}자</span>
          <button className="mini ghost" onClick={() => setDraft(text)} disabled={draft === text}>
            처음 글로 되돌리기
          </button>
          <button className="primary" onClick={copy} disabled={!draft.trim()}>
            {copied ? '복사했습니다' : '복사'}
          </button>
        </div>
      </div>
    </div>
  );
}
