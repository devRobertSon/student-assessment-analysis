import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AssessmentData,
  Axis,
  Mark,
  Result,
  downloadText,
  fmtPoints,
  hasAxis,
  isEssay,
  makeMark,
  newId,
  parseGradingCsv,
  pointsOf,
  resultToCsv,
  DEFAULT_RETAKE_MISSES,
  levelGaps,
  retakeCheck,
  scoreOf,
  statsForResult,
  todayStr,
} from '../lib/assessment';
import { rateTag } from './TypeRadar';
import GradeDialog from './GradeDialog';
import ConfirmDialog from './ConfirmDialog';

interface Props {
  data: AssessmentData;
  setData: (d: AssessmentData) => void;
}

// 칸에 담기는 값은 '득점'이다. 객관식은 0 아니면 배점,
// 서술형은 그 사이 아무 값이나 올 수 있다. null은 미입력.
type Cell = number | null;

// 한 시험에서 읽어 내는 세 가지 축
const AXES: { key: Axis; label: string }[] = [
  { key: 'type', label: '유형' },
  { key: 'unit', label: '단원' },
  { key: 'level', label: '난이도' },
];
const AXIS_LABEL: Record<Axis, string> = { type: '유형', unit: '단원', level: '난이도' };

export default function GradingPanel({ data, setData }: Props) {
  const [studentId, setStudentId] = useState('');
  const [examId, setExamId] = useState('');
  const [cells, setCells] = useState<Record<number, Cell>>({});
  const [date, setDate] = useState(todayStr());
  const [axis, setAxis] = useState<Axis>('type');
  const csvRef = useRef<HTMLInputElement>(null);
  const [dialog, setDialog] = useState(false);
  const [askDelete, setAskDelete] = useState(false);

  const exam = data.exams.find((e) => e.id === examId);
  const student = data.students.find((s) => s.id === studentId);

  const existing = useMemo(
    () => data.results.find((r) => r.studentId === studentId && r.examId === examId),
    [data.results, studentId, examId]
  );

  // 학생·시험이 바뀌면 기존 채점을 불러오고, 없으면 빈칸으로 시작한다.
  useEffect(() => {
    if (!exam) {
      setCells({});
      return;
    }
    const map: Record<number, Cell> = {};
    exam.questions.forEach((q) => (map[q.no] = null));
    if (existing) {
      existing.marks.forEach((m) => (map[m.no] = m.earned));
      setDate(existing.date);
    } else {
      setDate(todayStr());
    }
    setCells(map);
  }, [examId, studentId, exam, existing]);

  // 같은 값을 다시 누르면 미입력으로 되돌린다(O를 잘못 눌렀을 때 지우는 길).
  const setCell = (no: number, v: number) => setCells((c) => ({ ...c, [no]: c[no] === v ? null : v }));
  // 팝업에서 쓰는 setter. 표의 setCell은 같은 값을 다시 누르면 지우는 토글이지만
  // 여기서는 누른 값을 그대로 넣는다(넘어간 뒤 되돌아와도 값이 바뀌지 않게).
  const putCell = (no: number, v: Cell) => setCells((c) => ({ ...c, [no]: v }));

  const setAll = (v: 'full' | 'zero' | 'clear') => {
    if (!exam) return;
    const map: Record<number, Cell> = {};
    exam.questions.forEach((q) => {
      map[q.no] = v === 'clear' ? null : v === 'full' ? pointsOf(q) : 0;
    });
    setCells(map);
  };

  const marks: Mark[] = exam
    ? exam.questions
        .filter((q) => cells[q.no] !== null && cells[q.no] !== undefined)
        .map((q) => makeMark(q, cells[q.no] as number))
    : [];
  const answered = marks.length;
  const score = scoreOf(marks);
  const stats = exam ? statsForResult(exam, marks, axis) : [];
  // 학원 기준 판정. 리포트에는 안 들어가고 이 화면에서만 본다.
  const retakeMisses = data.retakeMisses ?? DEFAULT_RETAKE_MISSES;
  const retake = exam ? retakeCheck(exam, marks, retakeMisses) : null;
  // 다 채점하기 전에는 '통과'라고 단정하지 않는다. 이미 기준을 넘긴 경우만 확정이다.
  const graded = !!exam && answered === exam.questions.length;
  // 판정과 별개로, 구멍이 기초 쪽인지 심화 쪽인지 가려서 보여 준다.
  const gaps = exam ? levelGaps(exam, marks) : null;
  const fullPoints = exam ? exam.questions.reduce((a, q) => a + pointsOf(q), 0) : 0;
  const essayCount = exam ? exam.questions.filter(isEssay).length : 0;
  // 배점이나 서술형이 있는 시험지인지. 둘 다 없으면 한 문항 1점이라 점수 = 문항 수다.
  const scoredExam = !!exam && (essayCount > 0 || fullPoints !== exam.questions.length);

  const save = () => {
    if (!studentId || !exam) {
      alert('학생과 시험지를 모두 선택하세요.');
      return;
    }
    const res: Result = { id: existing?.id ?? newId('res'), studentId, examId, date, marks };
    const others = data.results.filter((r) => !(r.studentId === studentId && r.examId === examId));
    setData({ ...data, results: [...others, res] });
    alert('채점을 저장했습니다.');
  };

  /** 불러온 채점 결과를 지운다. 화면의 입력칸도 같이 비워 다시 저장되지 않게 한다. */
  const removeSaved = () => {
    if (!existing || !exam) return;
    setData({ ...data, results: data.results.filter((r) => r.id !== existing.id) });
    const map: Record<number, Cell> = {};
    exam.questions.forEach((q) => (map[q.no] = null));
    setCells(map);
    setDate(todayStr());
    setAskDelete(false);
  };

  const exportGradingCsv = () => {
    if (!exam || !student) {
      alert('학생과 시험지를 선택하세요.');
      return;
    }
    downloadText(
      `채점_${student.name}_${exam.title}_${date}.csv`,
      resultToCsv(student.name, exam.title, date, exam.questions, marks)
    );
  };

  const importGradingCsv = async (file: File) => {
    if (!exam) {
      alert('먼저 학생과 시험지를 선택하세요.');
      return;
    }
    const { date: d, earned, errors } = parseGradingCsv(await file.text());
    const map: Record<number, Cell> = {};
    exam.questions.forEach((q) => {
      const v = earned[q.no];
      map[q.no] = v === undefined ? null : makeMark(q, v === 'full' ? pointsOf(q) : v).earned;
    });
    setCells(map);
    if (d) setDate(d);
    alert('채점표를 불러왔습니다. 확인 후 [채점 저장]을 누르세요.' + (errors.length ? '\n\n주의:\n' + errors.join('\n') : ''));
  };

  const canGrade = data.students.length > 0 && data.exams.length > 0;

  return (
    <div className="assess-pane">
      {askDelete && existing && exam && (
        <ConfirmDialog
          title="채점 결과 삭제"
          message={`${exam.title} · ${existing.date} 채점 결과를 삭제할까요?`}
          detail="화면의 입력칸도 같이 비워집니다. 되돌릴 수 없습니다."
          onYes={removeSaved}
          onNo={() => setAskDelete(false)}
        />
      )}
      <div className="screen-head">
        <div>
          <h1>채점 입력</h1>
          <p className="muted">
            문항마다 O나 X만 누르면 됩니다. 서술형도 같습니다. 배점을 다 받으면 O, 답이 틀렸으면 X입니다.
          </p>
        </div>
      </div>

      {!canGrade ? (
        <p className="muted">
          먼저 [학생]과 [시험지]를 등록하세요.
          {data.students.length === 0 && ' 등록된 학생이 없습니다.'}
          {data.exams.length === 0 && ' 등록된 시험지가 없습니다.'}
        </p>
      ) : (
        <div className="grade-layout">
          <div className="assess-card">
            <div className="assess-row wrap">
              <label className="assess-field">
                학생
                <select
                  value={studentId}
                  onChange={(e) => {
                    setStudentId(e.target.value);
                    setExamId('');
                  }}
                >
                  <option value="">선택</option>
                  {data.students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.grade})
                    </option>
                  ))}
                </select>
              </label>
              <label className="assess-field">
                시험지
                <select value={examId} onChange={(e) => setExamId(e.target.value)} disabled={!studentId}>
                  <option value="">선택</option>
                  {data.exams.map((ex) => (
                    <option key={ex.id} value={ex.id}>
                      {ex.title} ({ex.questions.length}문항)
                    </option>
                  ))}
                </select>
              </label>
              <label className="assess-field">
                응시일
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </label>
              {existing && (
                <span className="assess-row" style={{ alignSelf: 'flex-end', gap: 8 }}>
                  <span className="assess-badge">저장된 채점 불러옴</span>
                  <button className="del-btn mini" onClick={() => setAskDelete(true)}>
                    채점 결과 삭제
                  </button>
                </span>
              )}
            </div>

            {!studentId && <p className="muted" style={{ marginTop: 12 }}>먼저 학생을 선택하세요.</p>}

            {exam && (
              <>
                <div className="assess-row grade-tools">
                  <button className="mini" onClick={() => setAll('full')}>
                    전체 O
                  </button>
                  <button className="mini" onClick={() => setAll('zero')}>
                    전체 X
                  </button>
                  <button className="mini ghost" onClick={() => setAll('clear')}>
                    초기화
                  </button>
                  <span style={{ marginLeft: 'auto' }} />
                  <button className="mini" onClick={() => setDialog(true)}>
                    직접 입력
                  </button>
                  <button className="mini ghost" onClick={exportGradingCsv}>
                    채점 CSV 내려받기
                  </button>
                  <button className="mini ghost" onClick={() => csvRef.current?.click()}>
                    채점 CSV 올리기
                  </button>
                  <input
                    ref={csvRef}
                    type="file"
                    accept=".csv,text/csv"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) importGradingCsv(f);
                      e.target.value = '';
                    }}
                  />
                </div>

                {dialog && (
                  <GradeDialog exam={exam} cells={cells} onSet={putCell} onClose={() => setDialog(false)} />
                )}

                <div className="ox-grid">
                  {exam.questions.map((q) => {
                    const v = cells[q.no];
                    const pts = pointsOf(q);
                    return (
                      <div key={q.no} className={`ox-item ${isEssay(q) ? 'essay' : ''}`}>
                        <span className="ox-no">{q.no}</span>
                        <span className="ox-btns">
                          <button
                            className={`ox-o ${v === pts ? 'on' : ''}`}
                            onClick={() => setCell(q.no, pts)}
                            aria-label={`${q.no}번 ${q.type} 맞음`}
                            aria-pressed={v === pts}
                          >
                            O
                          </button>
                          <button
                            className={`ox-x ${v === 0 ? 'on' : ''}`}
                            onClick={() => setCell(q.no, 0)}
                            aria-label={`${q.no}번 ${q.type} 틀림`}
                            aria-pressed={v === 0}
                          >
                            X
                          </button>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {exam && (
            <aside className="grade-side">
              <div className="assess-scorebar">
                <div className="lbl">입력 중인 점수</div>
                {/* 퍼센트와 분수는 둘 다 '입력한 문항'을 기준으로 한다.
                    전체 만점은 아랫줄에 따로 적어 두 수가 서로 어긋나 보이지 않게 한다. */}
                <div className="assess-row" style={{ alignItems: 'baseline', gap: 8 }}>
                  <span className="big">{Math.round(score.rate * 100)}</span>
                  <span style={{ fontSize: 17, fontWeight: 500, color: 'var(--navy-pale)' }}>
                    % · {fmtPoints(score.earned)}/{fmtPoints(score.points)}점
                  </span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--navy-soft)', marginTop: 5 }}>
                  만점 {score.correct}/{exam.questions.length}문항 · 전체 {fmtPoints(fullPoints)}점
                </div>
                <div style={{ fontSize: 13, color: 'var(--navy-soft)', marginTop: 3 }}>
                  {answered === exam.questions.length
                    ? `${exam.questions.length}문항 모두 입력 완료`
                    : `${exam.questions.length - answered}문항 남음`}
                </div>
              </div>

              <div className="assess-card grow">
                <div className="tally-head">
                  <h3>집계</h3>
                  {/* 단원·난이도를 적어 둔 시험지에서만 그 축이 나온다 */}
                  <span className="axis-tabs">
                    {AXES.filter((a) => a.key === 'type' || hasAxis(exam, a.key)).map((a) => (
                      <button
                        key={a.key}
                        className={axis === a.key ? 'on' : ''}
                        onClick={() => setAxis(a.key)}
                        aria-pressed={axis === a.key}
                      >
                        {a.label}
                      </button>
                    ))}
                  </span>
                </div>
                {stats.length === 0 ? (
                  <p className="hint">O/X를 입력하면 {AXIS_LABEL[axis]}별로 집계됩니다.</p>
                ) : (
                  <div className="tally">
                    {stats.map((s) => (
                      <div key={s.type} className="tally-row">
                        <span className="t">{s.type}</span>
                        {/* 배점이나 서술형이 있으면 점수로, 아니면 문항 수로 보여준다 */}
                        <span className="c">
                          {scoredExam
                            ? `${fmtPoints(s.earned)}/${fmtPoints(s.points)}점`
                            : `${s.correct}/${s.total}`}
                        </span>
                        <span className="p">{Math.round(s.rate * 100)}%</span>
                        <span className="g">{rateTag(s.rate).label}</span>
                      </div>
                    ))}
                  </div>
                )}
                {retake && (
                  <div className={`retake ${!retake.pass ? 'no' : graded ? 'ok' : ''}`}>
                    <span className="rt-head">
                      학원 기준 <em>{retake.total}문항 채점</em>
                    </span>
                    <b>{retake.wrong}개 틀림</b>
                    <span className="rt-verdict">
                      {!retake.pass ? '재수강 권장' : graded ? '통과' : '채점 중'}
                    </span>
                    <span className="hint">{retake.misses}개부터 재수강</span>
                  </div>
                )}
                {gaps && (gaps.basic || gaps.advanced) && (
                  <div className="gaps">
                    {(
                      [
                        ['기초', gaps.basic, '지난 학기를 다시 봐야 한다'],
                        ['심화', gaps.advanced, '더 어려운 문제를 줘야 한다'],
                      ] as const
                    ).map(
                      ([label, g, why]) =>
                        g && (
                          <div key={label} className={`gap ${g.short ? 'short' : ''}`}>
                            <b>{label}</b>
                            <span className="gp-detail">
                              {g.level} {g.total}문항 중 {g.wrong}개 틀림
                            </span>
                            <span className="gp-verdict">{g.short ? '미달' : '충족'}</span>
                            {g.short && <span className="gp-why">{why}</span>}
                          </div>
                        )
                    )}
                  </div>
                )}
                <p className="hint" style={{ marginTop: 12 }}>
                  저장하면 리포트에 바로 반영됩니다. 위 판정은 학원 내부용이라 리포트에 안 나갑니다.
                </p>
              </div>

              <button className="primary grade-save" onClick={save} disabled={answered === 0}>
                채점 저장
              </button>
            </aside>
          )}
        </div>
      )}
    </div>
  );
}
