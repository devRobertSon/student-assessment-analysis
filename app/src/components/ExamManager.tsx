import { Fragment, useState } from 'react';
import { AssessmentData, splitTypes } from '../lib/assessment';
import ExamFiles from './ExamFiles';
import ExamComposition from './ExamComposition';

interface Props {
  data: AssessmentData;
  setData: (d: AssessmentData) => void;
}

/**
 * 시험지 관리. 보기 전용이다.
 *
 * 시험지 등록과 삭제는 관리자가 papers/ 에서 한다. 선생님 화면에 지우는 버튼을
 * 두면 실수로 누른 한 번에 그 시험지의 채점 결과까지 사라진다.
 */
export default function ExamManager({ data, setData }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="assess-pane">
      <div className="screen-head">
        <div>
          <h1>시험지 관리</h1>
        </div>
      </div>

      {data.exams.length === 0 ? (
        <p className="muted">등록된 시험지가 없습니다.</p>
      ) : (
        <>
          <div className="assess-row">
            <span className="hint">{data.exams.length}개 시험지</span>
          </div>
          {/* 표가 화면보다 넓다. 휴대폰에서 칸이 카드 밖으로 삐져나오지 않게 감싼다. */}
          <div className="table-scroll">
          <table className="assess-table exam-table">
            <thead>
              <tr>
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
              </tr>
            </thead>
            <tbody>
              {data.exams.map((ex) => (
                <Fragment key={ex.id}>
                  <tr>
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
                        {openId === ex.id ? '접기' : '구성 보기'}
                      </button>
                    </td>
                  </tr>
                  {openId === ex.id && (
                    <tr>
                      <td colSpan={8}>
                        <ExamComposition exam={ex} />
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
