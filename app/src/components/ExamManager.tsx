import { Fragment, useState } from 'react';
import {
  AssessmentData,
  fmtPoints,
  isEssay,
  pointsOf,
  splitTypes,
} from '../lib/assessment';
import ExamFiles from './ExamFiles';
import ConfirmDialog from './ConfirmDialog';

interface Props {
  data: AssessmentData;
  setData: (d: AssessmentData) => void;
}

export default function ExamManager({ data, setData }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // 지우기 전에 한 번 묻는다. 무엇을 지울지만 담아 두고 실제 삭제는 [예]에서 한다.
  const [pending, setPending] = useState<{ ids: string[]; title: string } | null>(null);

  const askRemove = (ids: string[], title: string) => {
    if (ids.length > 0) setPending({ ids, title });
  };

  const doRemove = () => {
    if (!pending) return;
    const gone = new Set(pending.ids);
    const titles = data.exams.filter((x) => gone.has(x.id)).map((x) => x.title);
    setData({
      ...data,
      exams: data.exams.filter((x) => !gone.has(x.id)),
      results: data.results.filter((r) => !gone.has(r.examId)),
      // 저장소에 CSV가 남아 있어도 다시 들어오지 않게 이름을 적어 둔다.
      dismissed: [...(data.dismissed ?? []), ...titles].filter(Boolean),
    });
    setSelected((prev) => {
      const n = new Set(prev);
      gone.forEach((id) => n.delete(id));
      return n;
    });
    setPending(null);
  };

  const removeSelected = () => askRemove([...selected], `선택한 시험지 ${selected.size}개`);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const allSelected = data.exams.length > 0 && selected.size === data.exams.length;
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(data.exams.map((e) => e.id)));

  return (
    <div className="assess-pane">
      <div className="screen-head">
        <div>
          <h1>시험지 관리</h1>
        </div>
      </div>

      {pending && (
        <ConfirmDialog
          title="시험지 삭제"
          message={`${pending.title} 시험지를 삭제할까요?`}
          detail={(() => {
            const gone = new Set(pending.ids);
            const cnt = data.results.filter((r) => gone.has(r.examId)).length;
            return cnt
              ? `채점 결과 ${cnt}건도 함께 지워집니다. 되돌릴 수 없습니다.`
              : '되돌릴 수 없습니다. 저장소에 CSV가 남아 있어도 다시 들어오지 않습니다.';
          })()}
          onYes={doRemove}
          onNo={() => setPending(null)}
        />
      )}

      {data.exams.length === 0 ? (
        <p className="muted">등록된 시험지가 없습니다.</p>
      ) : (
        <>
          <div className="assess-row">
            <span className="hint">
              {data.exams.length}개 시험지 · {selected.size}개 선택됨
            </span>
            <span style={{ marginLeft: 'auto' }} />
            <button className="del-btn mini" disabled={selected.size === 0} onClick={removeSelected}>
              선택 삭제{selected.size > 0 ? ` (${selected.size})` : ''}
            </button>
          </div>
          {/* 표가 화면보다 넓다. 휴대폰에서 칸이 카드 밖으로 삐져나오지 않게 감싼다. */}
          <div className="table-scroll">
          <table className="assess-table">
            <thead>
              <tr>
                <th style={{ width: 34, textAlign: 'center' }}>
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="전체 선택" />
                </th>
                {/* 이름이 짜부라지지 않을 만큼은 잡아 둔다. 이보다 좁아지면
                    표가 가로로 넘어간다(.table-scroll). */}
                <th style={{ minWidth: 150 }}>시험지</th>
                <th style={{ width: 66 }}>과목</th>
                <th style={{ width: 96 }}>등록일</th>
                <th style={{ width: 56, textAlign: 'center' }}>문항</th>
                <th style={{ width: 52 }}>유형</th>
                <th style={{ width: 52 }}>단원</th>
                {/* width 1 은 '내용만큼만' 이라는 뜻이다. 자동 배치 표에서 남는
                    폭을 이 칸이 아니라 시험지 이름 칸이 가져가게 한다. */}
                <th style={{ width: 1 }}>인쇄물</th>
                <th style={{ width: 92 }}></th>
                <th style={{ width: 44 }}></th>
              </tr>
            </thead>
            <tbody>
              {data.exams.map((ex) => (
                <Fragment key={ex.id}>
                  <tr className={selected.has(ex.id) ? 'row-selected' : ''}>
                    <td style={{ textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={selected.has(ex.id)}
                        onChange={() => toggle(ex.id)}
                        aria-label={`${ex.title} 선택`}
                      />
                    </td>
                    <td>{ex.title}</td>
                    <td>{ex.subject}</td>
                    <td>{ex.date}</td>
                    <td style={{ textAlign: 'center' }}>{ex.questions.length}</td>
                    <td>{new Set(ex.questions.flatMap((q) => splitTypes(q.type))).size}종</td>
                    <td>
                      {(() => {
                        const n = new Set(ex.questions.map((q) => q.unit).filter(Boolean)).size;
                        return n ? `${n}개` : '—';
                      })()}
                    </td>
                    <td>
                      <ExamFiles
                        exam={ex}
                        onChange={(files) =>
                          setData({
                            ...data,
                            exams: data.exams.map((x) => (x.id === ex.id ? { ...x, files } : x)),
                          })
                        }
                      />
                    </td>
                    <td>
                      <button className="mini ghost" onClick={() => setOpenId(openId === ex.id ? null : ex.id)}>
                        {openId === ex.id ? '접기' : '유형 보기'}
                      </button>
                    </td>
                    <td>
                      <button className="del" onClick={() => askRemove([ex.id], `"${ex.title}"`)} title="삭제">
                        ✕
                      </button>
                    </td>
                  </tr>
                  {openId === ex.id && (
                    <tr>
                      <td colSpan={10}>
                        <div className="hint" style={{ marginBottom: 7 }}>
                          {ex.title} · 문항별 유형 · 만점{' '}
                          {fmtPoints(ex.questions.reduce((a, q) => a + pointsOf(q), 0))}점
                          {(() => {
                            const n = ex.questions.filter(isEssay).length;
                            return n > 0 ? ` · 서술형 ${n}문항` : '';
                          })()}
                        </div>
                        <div className="assess-preview-grid">
                          {ex.questions.map((q) => (
                            <span key={q.no} className="assess-chip">
                              <b>{q.no}</b> {q.type}
                              {isEssay(q) && <span className="q-fmt">서술형</span>}
                              {q.level ? <span className="q-lv">{q.level}</span> : null}
                              {q.unit ? ` · ${q.unit}` : ''}
                              {q.answer ? ` · 답 ${q.answer}` : ''}
                              {q.source ? ` · ${q.source}${q.sourceNo ? ' ' + q.sourceNo + '번' : ''}` : ''}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
          </div>
        </>
      )}
    </div>
  );
}
