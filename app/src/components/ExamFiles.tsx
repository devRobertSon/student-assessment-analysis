import { useState } from 'react';
import { ATTACH_KINDS, ATTACH_LABEL, AttachKind, Exam, paperHref } from '../lib/assessment';
import PaperPicker from './PaperPicker';
import CsvViewer from './CsvViewer';

/** 브라우저가 새 탭에서 그려 주는 파일인지. */
const inlineable = (name: string) => /\.(pdf|png|jpe?g|gif|webp|svg)(\?|#|$)/i.test(name.trim());
/** CSV는 브라우저가 내려받아 버리므로 앱이 직접 표로 그린다. */
const isCsv = (name: string) => /\.csv(\?|#|$)/i.test(name.trim());

/**
 * 시험지 한 줄의 인쇄물 칸. 문제지 · 해설 · 출제표.
 *
 * 값은 사이트의 papers/ 에 올려 둔 파일 이름뿐이라 시험지와 함께 동기화되고
 * 어느 기기에서나 그대로 열린다.
 *
 * [보기]와 [받기]를 나눈 이유가 있다. a 태그에 download를 달면 휴대폰에서도
 * 무조건 내려받아 버린다. 보기는 download 없이 새 탭으로만 열어 브라우저가
 * 그대로 그리게 둔다.
 */
export default function ExamFiles({
  exam,
  onChange,
}: {
  exam: Exam;
  onChange: (files: Exam['files']) => void;
}) {
  const [picking, setPicking] = useState<AttachKind | null>(null);
  const [viewingCsv, setViewingCsv] = useState<AttachKind | null>(null);

  const pick = (kind: AttachKind, file: string) => {
    onChange({ ...exam.files, [kind]: file });
    setPicking(null);
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
        const href = paperHref(name);
        return (
          <span key={kind} className="file-chip">
            {/* 이름을 누르면 고르기 창이 다시 열려 다른 파일로 바꿀 수 있다. */}
            <button
              className="file-name"
              title={`${name}\n눌러서 다른 파일로 바꾸기`}
              onClick={() => setPicking(kind)}
            >
              {ATTACH_LABEL[kind]}
            </button>
            <span className="file-acts">
              {inlineable(name) && (
                <a className="file-act" href={href} target="_blank" rel="noopener" title={`${name} 보기`}>
                  보기
                </a>
              )}
              {isCsv(name) && (
                <button className="file-act" onClick={() => setViewingCsv(kind)} title={`${name} 보기`}>
                  보기
                </button>
              )}
              <a className="file-act" href={href} download={name} title={`${name} 내려받기`}>
                다운로드
              </a>
            </span>
          </span>
        );
      })}

      {viewingCsv && exam.files?.[viewingCsv] && (
        <CsvViewer
          title={ATTACH_LABEL[viewingCsv]}
          name={exam.files[viewingCsv] as string}
          href={paperHref(exam.files[viewingCsv] as string)}
          onClose={() => setViewingCsv(null)}
        />
      )}

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
