import { useRef, useState } from 'react';
import { ATTACH_KINDS, ATTACH_LABEL, AttachKind, Attachment, Exam, paperHref } from '../lib/assessment';
import { pullFromCloud, removeFromCloud, uploadToCloud } from '../lib/cloudfiles';
import { useAuthUser } from '../lib/cloud';
import { delExamFile, getExamFile, putExamFile, saveBlob } from '../lib/filestore';

/**
 * 시험지 한 줄의 인쇄물 칸 — 문제지 · 해설 · 출제표.
 *
 * 붙어 있으면 내려받기 단추, 없으면 올리기 단추다. 사이트에 같이 올려 둔
 * 것(src: 'site')과 여기서 올린 것(src: 'local')이 같은 모양으로 보인다.
 *
 * 올린 파일은 이 기기(IndexedDB)와 클라우드(Storage) 양쪽에 둔다. 로그인 전에
 * 올렸다면 클라우드 자리가 비는데, 로그인하면 App이 뒤늦게 올려 준다.
 * 아직 이 기기에만 있는 파일은 점으로 표시한다.
 */
export default function ExamFiles({
  exam,
  onChange,
}: {
  exam: Exam;
  onChange: (files: Exam['files']) => void;
}) {
  const pickRef = useRef<HTMLInputElement>(null);
  const [picking, setPicking] = useState<AttachKind | null>(null);
  const [busy, setBusy] = useState<AttachKind | null>(null);
  const { user } = useAuthUser();

  const attach = async (kind: AttachKind, file: File) => {
    setBusy(kind);
    try {
      await putExamFile(exam.id, kind, file);
      const next: Attachment = { name: file.name, src: 'local', size: file.size, type: file.type };
      if (user) {
        // 클라우드에 못 올려도 이 기기에는 남는다. 로그인 상태가 되면 다시 시도된다.
        try {
          next.remote = await uploadToCloud(exam.id, kind, file);
        } catch (e) {
          alert(
            `파일은 이 기기에 저장했지만 클라우드에 올리지 못했습니다.\n다른 기기에서는 안 보입니다.\n\n${(e as Error).message}`
          );
        }
      }
      onChange({ ...exam.files, [kind]: next });
    } catch (e) {
      alert('파일을 저장하지 못했습니다: ' + (e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const download = async (kind: AttachKind, a: Attachment) => {
    if (a.src === 'site') {
      window.open(paperHref(a.name), '_blank', 'noopener');
      return;
    }
    setBusy(kind);
    try {
      let blob = await getExamFile(exam.id, kind).catch(() => null);
      // 다른 기기에서 올린 파일이면 이 기기에는 없다. 클라우드에서 받아 둔다.
      if (!blob && a.remote) blob = await pullFromCloud(exam.id, kind, a.remote);
      if (!blob) {
        alert('파일을 찾지 못했습니다. 다시 올려 주세요.');
        return;
      }
      saveBlob(a.name, blob);
    } catch (e) {
      alert('파일을 받지 못했습니다: ' + (e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const detach = async (kind: AttachKind) => {
    const a = exam.files?.[kind];
    if (!a) return;
    if (!confirm(`${ATTACH_LABEL[kind]} "${a.name}"을(를) 뗄까요?`)) return;
    if (a.src === 'local') {
      await delExamFile(exam.id, kind).catch(() => undefined);
      if (a.remote) await removeFromCloud(a.remote);
    }
    const next = { ...exam.files };
    delete next[kind];
    onChange(Object.keys(next).length ? next : undefined);
  };

  return (
    <span className="ex-files">
      {ATTACH_KINDS.map((kind) => {
        const a = exam.files?.[kind];
        if (!a) {
          return (
            <button
              key={kind}
              className="file-add"
              disabled={busy === kind}
              title={`${ATTACH_LABEL[kind]} 올리기`}
              onClick={() => {
                setPicking(kind);
                pickRef.current?.click();
              }}
            >
              ＋{ATTACH_LABEL[kind]}
            </button>
          );
        }
        const onlyHere = a.src === 'local' && !a.remote;
        return (
          <span key={kind} className="file-chip">
            <button
              className="file-link"
              disabled={busy === kind}
              title={`${a.name}${onlyHere ? ' — 이 기기에만 있음' : ''}`}
              onClick={() => download(kind, a)}
            >
              {ATTACH_LABEL[kind]}
              {onlyHere && <i className="file-local" title="이 기기에만 있음" />}
            </button>
            <button className="file-del" title="떼기" onClick={() => detach(kind)}>
              ✕
            </button>
          </span>
        );
      })}
      <input
        ref={pickRef}
        type="file"
        accept=".pdf,.csv,.png,.jpg,.jpeg,application/pdf,text/csv,image/*"
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f && picking) attach(picking, f);
          e.target.value = '';
          setPicking(null);
        }}
      />
    </span>
  );
}
