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
} from '../lib/assessment';

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

  const changeStudent = (id: string) => {
    setStudentId(id);
    setExamId('');
  };

  // 학생·시험 바뀌면 기존 채점 불러오기(없으면 빈칸)
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

  const setCell = (no: number, v: Cell) => setCells((c) => ({ ...c, [no]: v }));
  const setAll = (v: Cell) => {
    if (!exam) return;
    const map: Record<number, Cell> = {};
    exam.questions.forEach((q) => (map[q.no] = v));
    setCells(map);
  };

  const marks: Mark[] = exam
    ? exam.questions.filter((q) => cells[q.no] !== null && cells[q.no] !== undefined).map((q) => ({ no: q.no, correct: cells[q.no] === true }))
    : [];
  const answered = marks.length;
  const score = scoreOf(marks);

  const save = () => {
    if (!studentId || !exam) {
      alert('학생과 시험지를 모두 선택하세요.');
      return;
    }
    const res: Result = {
      id: existing?.id ?? newId('res'),
      studentId,
      examId,
      date,
      marks,
    };
    const others = data.results.filter((r) => !(r.studentId === studentId && r.examId === examId));
    setData({ ...data, results: [...others, res] });
    alert('채점을 저장했습니다.');
  };

  const exportGradingCsv = () => {
    if (!exam || !student) {
      alert('학생과 시험지를 선택하세요.');
      return;
    }
    const csv = resultToCsv(student.name, exam.title, date, exam.questions, marks);
    downloadText(`채점_${student.name}_${exam.title}_${date}.csv`, csv);
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
      {!canGrade ? (
        <p className="muted">먼저 [학생]과 [시험지]를 등록하세요.</p>
      ) : (
        <>
          <div className="assess-row wrap">
            <label className="assess-field">
              학생
              <select value={studentId} onChange={(e) => changeStudent(e.target.value)}>
                <option value="">선택</option>
                {data.students.map((s) => (
                  <option key={s.id} value={s.id}>{s.name} ({s.grade})</option>
                ))}
              </select>
            </label>
            <label className="assess-field">
              시험지
              <select value={examId} onChange={(e) => setExamId(e.target.value)} disabled={!studentId}>
                <option value="">선택</option>
                {data.exams.map((ex) => (
                  <option key={ex.id} value={ex.id}>{ex.title} ({ex.questions.length}문항)</option>
                ))}
              </select>
            </label>
            <label className="assess-field">
              응시일
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
          </div>

          {!studentId && <p className="muted">먼저 학생을 선택하세요.</p>}

          {exam && (
            <>
              <div className="assess-row">
                <button className="mini" onClick={() => setAll(true)}>전체 O</button>
                <button className="mini" onClick={() => setAll(false)}>전체 X</button>
                <button className="mini ghost" onClick={() => setAll(null)}>초기화</button>
                {existing && <span className="assess-badge">저장된 채점 불러옴</span>}
                <span style={{ marginLeft: 'auto' }} />
                <button className="mini" onClick={exportGradingCsv}>채점 CSV 내려받기</button>
                <button className="mini" onClick={() => csvRef.current?.click()}>채점 CSV 올리기</button>
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
                      <div className="ox-no" title={q.type}>{q.no}</div>
                      <div className="ox-btns">
                        <button
                          className={`ox-o ${v === true ? 'on' : ''}`}
                          onClick={() => setCell(q.no, v === true ? null : true)}
                        >O</button>
                        <button
                          className={`ox-x ${v === false ? 'on' : ''}`}
                          onClick={() => setCell(q.no, v === false ? null : false)}
                        >X</button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="assess-scorebar">
                <span>맞은 개수 <b>{score.correct}</b> / {exam.questions.length}</span>
                <span>정답률 <b>{Math.round(score.rate * 100)}%</b></span>
                <span className="muted">입력 {answered}/{exam.questions.length}</span>
                <button className="primary" onClick={save}>채점 저장</button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
