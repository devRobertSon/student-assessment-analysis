import { useRef, useState } from 'react';
import { ATTACH_KINDS, ATTACH_LABEL, AttachKind, Attachment, Exam, paperHref } from '../lib/assessment';
import { delExamFile, getExamFile, putExamFile, saveBlob } from '../lib/filestore';

/**
 * 시험지 한 줄의 인쇄물 칸 — 문제지 · 해설 · 출제표.
 *
 * 붙어 있으면 내려받기 단추, 없으면 올리기 단추다. 사이트에 같이 올려 둔
 * 것(src: 'site')과 여기서 올린 것(src: 'local')이 같은 모양으로 보인다.
 * 다른 점은 올린 파일은 이 브라우저에만 남는다는 것뿐이라, 그 표시만 남긴다.
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

  const attach = async (kind: AttachKind, file: File) => {
    setBusy(kind);
    try {
      await putExamFile(exam.id, kind, file);
      const next: Attachment = { name: file.name, src: 'local', size: file.size, type: file.type };
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
    const blob = await getExamFile(exam.id, kind);
    if (!blob) {
      alert('이 브라우저에 파일이 없습니다. 다시 올려 주세요.');
      return;
    }
    saveBlob(a.name, blob);
  };

  const detach = async (kind: AttachKind) => {
    const a = exam.files?.[kind];
    if (!a) return;
    if (!confirm(`${ATTACH_LABEL[kind]} "${a.name}"을(를) 뗄까요?`)) return;
    if (a.src === 'local') await delExamFile(exam.id, kind).catch(() => undefined);
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
        return (
          <span key={kind} className="file-chip">
            <button
              className="file-link"
              title={`${a.name}${a.src === 'local' ? ' (이 브라우저에만 있음)' : ''}`}
              onClick={() => download(kind, a)}
            >
              {ATTACH_LABEL[kind]}
              {a.src === 'local' && <i className="file-local" title="이 브라우저에만 있음" />}
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
