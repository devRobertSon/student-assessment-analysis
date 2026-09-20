import { useState } from 'react';
import { ATTACH_KINDS, ATTACH_LABEL, AttachKind, Exam, paperHref } from '../lib/assessment';
import CsvViewer from './CsvViewer';

/** 브라우저가 새 탭에서 그려 주는 파일인지. */
const inlineable = (name: string) => /\.(pdf|png|jpe?g|gif|webp|svg)(\?|#|$)/i.test(name.trim());
/** CSV는 브라우저가 내려받아 버리므로 앱이 직접 표로 그린다. */
const isCsv = (name: string) => /\.csv(\?|#|$)/i.test(name.trim());

/**
 * 시험지 한 줄의 인쇄물 칸. 문제지 · 해설 · 출제표.
 *
 * 보기 전용이다. 어느 파일이 붙는지는 papers/ 의 시험지 CSV 에 적혀 있고,
 * 파일 자체도 관리자가 저장소에 직접 올린다. 이 화면에서 갈아 끼우는 길을
 * 두면 글자처럼 생긴 것을 눌렀다가 파일이 바뀐다.
 *
 * [보기]와 [다운로드]를 나눈 이유가 있다. a 태그에 download를 달면 휴대폰에서도
 * 무조건 내려받아 버린다. 보기는 download 없이 새 탭으로만 열어 브라우저가
 * 그대로 그리게 둔다.
 */
export default function ExamFiles({ exam }: { exam: Exam }) {
  const [viewingCsv, setViewingCsv] = useState<AttachKind | null>(null);
  const attached = ATTACH_KINDS.filter((k) => exam.files?.[k]);

  // 하나도 안 붙어 있으면 칸이 비어 보이지 않게 줄표를 둔다.
  if (attached.length === 0) return <span className="muted">—</span>;

  return (
    <span className="ex-files">
      {attached.map((kind) => {
        const name = exam.files?.[kind] as string;
        const href = paperHref(name);
        return (
          <span key={kind} className="file-chip">
            <span className="file-name" title={name}>
              {ATTACH_LABEL[kind]}
            </span>
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
    </span>
  );
}
