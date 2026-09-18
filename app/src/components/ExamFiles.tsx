import { useState } from 'react';
import { ATTACH_KINDS, ATTACH_LABEL, AttachKind, Exam, paperHref } from '../lib/assessment';
import PaperPicker from './PaperPicker';

/**
 * 시험지 한 줄의 인쇄물 칸 — 문제지 · 해설 · 출제표.
 *
 * 붙어 있으면 내려받기, 없으면 고르기다. 값은 사이트의 papers/ 에 올려 둔
 * 파일 이름뿐이라 시험지와 함께 동기화되고 어느 기기에서나 그대로 열린다.
 */
export default function ExamFiles({
  exam,
  onChange,
}: {
  exam: Exam;
  onChange: (files: Exam['files']) => void;
}) {
  const [picking, setPicking] = useState<AttachKind | null>(null);

  const pick = (kind: AttachKind, file: string) => {
    onChange({ ...exam.files, [kind]: file });
    setPicking(null);
  };

  const detach = (kind: AttachKind) => {
    const name = exam.files?.[kind];
    if (!name) return;
    if (!confirm(`${ATTACH_LABEL[kind]} "${name}"을(를) 뗄까요?\n(파일 자체는 지워지지 않습니다)`)) return;
    const next = { ...exam.files };
    delete next[kind];
    onChange(Object.keys(next).length ? next : undefined);
  };

  return (
    <span className="ex-files">
      {ATTACH_KINDS.map((kind) => {
        const name = exam.files?.[kind];
        if (!name) {
          return (
            <button
              key={kind}
              className="file-add"
              title={`${ATTACH_LABEL[kind]} 고르기`}
              onClick={() => setPicking(kind)}
            >
              ＋{ATTACH_LABEL[kind]}
            </button>
          );
        }
        return (
          <span key={kind} className="file-chip">
            <a className="file-link" href={paperHref(name)} title={name} download target="_blank" rel="noopener">
              {ATTACH_LABEL[kind]}
            </a>
            <button className="file-del" title="떼기" onClick={() => detach(kind)}>
              ✕
            </button>
          </span>
        );
      })}

      {picking && (
        <PaperPicker
          kind={picking}
          examTitle={exam.title}
          onPick={(file) => pick(picking, file)}
          onClose={() => setPicking(null)}
        />
      )}
    </span>
  );
}
