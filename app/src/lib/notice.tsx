import { useEffect, useState } from 'react';
import ConfirmDialog from '../components/ConfirmDialog';

/**
 * 앱 어디서나 부르는 알림·확인 창.
 *
 * alert()·confirm() 은 브라우저가 그리는 창이라 앱과 생김새가 다르고, 크롬은
 * 여러 번 뜨면 아예 막아 버린다. 대신 화면 한 곳에 <NoticeHost /> 를 두고
 * 여기로 부른다. 부르는 쪽은 props 를 타고 내려보낼 필요가 없다.
 */
interface Req {
  title: string;
  message: string;
  detail?: string;
  yesLabel?: string;
  /** 묻는 창인지. 아니면 [확인] 하나짜리 알림창이다. */
  asks: boolean;
  resolve: (ok: boolean) => void;
}

let push: ((r: Req) => void) | null = null;

/** 알리고 [확인]을 기다린다. */
export function notify(title: string, message: string, detail?: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (!push) return resolve(true);
    push({ title, message, detail, asks: false, resolve });
  });
}

/** 묻고 [예]를 눌렀는지 돌려준다. */
export function ask(
  title: string,
  message: string,
  opts?: { detail?: string; yesLabel?: string }
): Promise<boolean> {
  return new Promise((resolve) => {
    if (!push) return resolve(false);
    push({ title, message, detail: opts?.detail, yesLabel: opts?.yesLabel, asks: true, resolve });
  });
}

/** 화면에 한 번만 둔다. 여러 개가 겹치면 부른 순서대로 하나씩 보여준다. */
export function NoticeHost() {
  const [queue, setQueue] = useState<Req[]>([]);

  useEffect(() => {
    push = (r) => setQueue((q) => [...q, r]);
    return () => {
      push = null;
    };
  }, []);

  const cur = queue[0];
  if (!cur) return null;

  const close = (ok: boolean) => {
    cur.resolve(ok);
    setQueue((q) => q.slice(1));
  };

  return (
    <ConfirmDialog
      title={cur.title}
      message={cur.message}
      detail={cur.detail}
      yesLabel={cur.yesLabel}
      onYes={cur.asks ? () => close(true) : undefined}
      onNo={() => close(false)}
    />
  );
}
