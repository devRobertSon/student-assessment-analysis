import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AssessmentData,
  Mark,
  Result,
  downloadText,
  newId,
  parseGradingCsv,
  resultToCsv,
  scoreOf,
  todayStr,
  typeStatsForResult,
} from '../lib/assessment';
import { rateTag } from './TypeRadar';

interface Props {
  data: AssessmentData;
  setData: (d: AssessmentData) => void;
}

type Cell = boolean | null; // true=O(맞음), false=X(틀림), null=미입력

export default function GradingPanel({ data, setData }: Props) {
  const [studentId, setStudentId] = useState('');
  const [examId, setExamId] = useState('');
  const [cells, setCells] = useState<Record<number, Cell>>({});
  const [date, setDate] = useState(todayStr());
  const csvRef = useRef<HTMLInputElement>(null);

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
      existing.marks.forEach((m) => (map[m.no] = m.correct));
      setDate(existing.date);
    } else {
      setDate(todayStr());
    }
    setCells(map);
  }, [examId, studentId, exam, existing]);

  const setCell = (no: number, v: Cell) => setCells((c) => ({ ...c, [no]: c[no] === v ? null : v }));
  const setAll = (v: Cell) => {
    if (!exam) return;
    const map: Record<number, Cell> = {};
    exam.questions.forEach((q) => (map[q.no] = v));
    setCells(map);
  };

  const marks: Mark[] = exam
    ? exam.questions
        .filter((q) => cells[q.no] !== null && cells[q.no] !== undefined)
        .map((q) => ({ no: q.no, correct: cells[q.no] === true }))
    : [];
  const answered = marks.length;
  const score = scoreOf(marks);
  const stats = exam ? typeStatsForResult(exam, marks) : [];

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
    const { date: d, ox, errors } = parseGradingCsv(await file.text());
    const map: Record<number, Cell> = {};
    exam.questions.forEach((q) => (map[q.no] = q.no in ox ? ox[q.no] : null));
    setCells(map);
    if (d) setDate(d);
    alert('채점표를 불러왔습니다. 확인 후 [채점 저장]을 누르세요.' + (errors.length ? '\n\n주의:\n' + errors.join('\n') : ''));
  };

  const canGrade = data.students.length > 0 && data.exams.length > 0;

  return (
    <div className="assess-pane">
      <div className="screen-head">
        <div>
          <h1>채점 입력</h1>
          <p className="muted">문항마다 O/X만 누르면 유형별 집계가 바로 갱신됩니다.</p>
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
              {existing && <span className="assess-badge" style={{ alignSelf: 'flex-end' }}>저장된 채점 불러옴</span>}
            </div>

            {!studentId && <p className="muted" style={{ marginTop: 12 }}>먼저 학생을 선택하세요.</p>}

            {exam && (
              <>
                <div className="assess-row grade-tools">
                  <button className="mini" onClick={() => setAll(true)}>
                    전체 O
                  </button>
                  <button className="mini" onClick={() => setAll(false)}>
                    전체 X
                  </button>
                  <button className="mini ghost" onClick={() => setAll(null)}>
                    초기화
                  </button>
                  <span style={{ marginLeft: 'auto' }} />
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

                <div className="ox-grid">
                  {exam.questions.map((q) => {
                    const v = cells[q.no];
                    return (
                      <div key={q.no} className="ox-item">
                        <span className="ox-no">{q.no}</span>
                        <span className="t">{q.type}</span>
                        <span className="ox-btns">
                          <button
                            className={`ox-o ${v === true ? 'on' : ''}`}
                            onClick={() => setCell(q.no, true)}
                            aria-label={`${q.no}번 맞음`}
                            aria-pressed={v === true}
                          >
                            O
                          </button>
                          <button
                            className={`ox-x ${v === false ? 'on' : ''}`}
                            onClick={() => setCell(q.no, false)}
                            aria-label={`${q.no}번 틀림`}
                            aria-pressed={v === false}
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
                <div className="assess-row" style={{ alignItems: 'baseline', gap: 8 }}>
                  <span className="big">{Math.round(score.rate * 100)}</span>
                  <span style={{ fontSize: 17, fontWeight: 500, color: 'var(--navy-pale)' }}>
                    % · {score.correct}/{exam.questions.length}
                  </span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--navy-soft)', marginTop: 5 }}>
                  {answered === exam.questions.length
                    ? `${exam.questions.length}문항 모두 입력 완료`
                    : `${exam.questions.length - answered}문항 남음`}
                </div>
              </div>

              <div className="assess-card grow">
                <h3>유형별 집계</h3>
                {stats.length === 0 ? (
                  <p className="hint">O/X를 입력하면 유형별로 집계됩니다.</p>
                ) : (
                  <div className="tally">
                    {stats.map((s) => (
                      <div key={s.type} className="tally-row">
                        <span className="t">{s.type}</span>
                        <span className="c">
                          {s.correct}/{s.total}
                        </span>
                        <span className="p">{Math.round(s.rate * 100)}%</span>
                        <span className="g">{rateTag(s.rate).label}</span>
                      </div>
                    ))}
                  </div>
                )}
                <p className="hint" style={{ marginTop: 12 }}>
                  저장하면 리포트에 바로 반영됩니다.
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
