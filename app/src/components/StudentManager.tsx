import { useMemo, useRef, useState } from 'react';
import {
  AssessmentData,
  Sibling,
  Student,
  TARGET_SCHOOLS,
  downloadText,
  newId,
  parseStudentsCsv,
  scoreOf,
  statsCumulative,
  studentsToCsv,
  todayStr,
  upsertStudents,
} from '../lib/assessment';
import { rateTag } from './TypeRadar';
import TypeRadar from './TypeRadar';
import TypeBars from './TypeBars';

const GRADES = ['초3', '초4', '초5', '초6', '중1', '중2', '중3', '고1', '고2', '고3'];
const DEFAULT_GRADE = '중1';

interface Props {
  data: AssessmentData;
  setData: (d: AssessmentData) => void;
  selectedId: string;
  setSelectedId: (id: string) => void;
  onOpenReport: () => void;
  onOpenGrading: () => void;
}

export default function StudentManager({
  data,
  setData,
  selectedId,
  setSelectedId,
  onOpenReport,
  onOpenGrading,
}: Props) {
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newGrade, setNewGrade] = useState(DEFAULT_GRADE);
  const fileRef = useRef<HTMLInputElement>(null);

  const student = data.students.find((s) => s.id === selectedId);

  const rateOf = useMemo(() => {
    const map = new Map<string, number | null>();
    for (const s of data.students) {
      const rs = data.results.filter((r) => r.studentId === s.id);
      if (rs.length === 0) {
        map.set(s.id, null);
        continue;
      }
      const marks = rs.flatMap((r) => r.marks);
      map.set(s.id, scoreOf(marks).rate);
    }
    return map;
  }, [data.students, data.results]);

  const shown = data.students.filter((s) => s.name.includes(query.trim()));

  const studentResults = useMemo(
    () => data.results.filter((r) => r.studentId === selectedId).sort((a, b) => a.date.localeCompare(b.date)),
    [data.results, selectedId]
  );
  const stats = useMemo(
    () => (selectedId ? statsCumulative(data.exams, studentResults) : []),
    [selectedId, data.exams, studentResults]
  );
  const total = scoreOf(studentResults.flatMap((r) => r.marks));
  const weakCount = stats.filter((s) => s.rate < 0.5).length;
  const lastExam = studentResults.length
    ? data.exams.find((e) => e.id === studentResults[studentResults.length - 1].examId)
    : undefined;
  const lastDate = studentResults.length ? studentResults[studentResults.length - 1].date : '';

  const add = () => {
    const nm = newName.trim();
    if (!nm) return;
    if (data.students.some((s) => s.name === nm) && !confirm(`"${nm}" 학생이 이미 있습니다. 그래도 추가할까요?`)) return;
    const id = newId('stu');
    setData({ ...data, students: [...data.students, { id, name: nm, grade: newGrade }] });
    setSelectedId(id);
    setNewName('');
    setAdding(false);
  };

  const update = (patch: Partial<Student>) => {
    if (!student) return;
    setData({ ...data, students: data.students.map((s) => (s.id === student.id ? { ...s, ...patch } : s)) });
  };

  const toggleTarget = (name: string) => {
    if (!student) return;
    const cur = student.targetSchools ?? [];
    update({ targetSchools: cur.includes(name) ? cur.filter((t) => t !== name) : [...cur, name] });
  };

  /** 채점 한 건을 지운다. 시험지와 학생은 그대로 두고 그 응시만 없앤다. */
  const removeResult = (resultId: string) => {
    const r = data.results.find((x) => x.id === resultId);
    if (!r) return;
    const ex = data.exams.find((e) => e.id === r.examId);
    if (!confirm(`${ex?.title ?? '시험'} · ${r.date} 채점 결과를 삭제할까요?`)) return;
    setData({ ...data, results: data.results.filter((x) => x.id !== resultId) });
  };

  const remove = () => {
    if (!student) return;
    const cnt = data.results.filter((r) => r.studentId === student.id).length;
    if (!confirm(`${student.name} 학생을 삭제할까요?${cnt ? ` (채점 결과 ${cnt}건도 함께 삭제)` : ''}`)) return;
    setData({
      ...data,
      students: data.students.filter((s) => s.id !== student.id),
      results: data.results.filter((r) => r.studentId !== student.id),
    });
    setSelectedId('');
  };

  const importCsv = async (file: File) => {
    const { drafts, errors } = parseStudentsCsv(await file.text());
    if (errors.length) alert(errors.join('\n'));
    if (!drafts.length) return;
    const { data: next, added, updated } = upsertStudents(data, drafts);
    setData(next);
    alert(`추가 ${added}명 · 갱신 ${updated}명`);
  };

  return (
    <div className="split">
      <aside className="side">
        <div className="side-head">
          <div className="side-title">
            <b>학생</b>
            <span className="hint">{data.students.length}명</span>
          </div>
          <input
            type="text"
            className="wide"
            placeholder="이름으로 검색"
            aria-label="학생 검색"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {adding ? (
            <div className="assess-row">
              <input
                type="text"
                className="wide"
                placeholder="학생 이름"
                aria-label="새 학생 이름"
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') add();
                  if (e.key === 'Escape') setAdding(false);
                }}
              />
              <select value={newGrade} onChange={(e) => setNewGrade(e.target.value)} aria-label="새 학생 학년">
                {GRADES.map((g) => (
                  <option key={g}>{g}</option>
                ))}
              </select>
              <button className="primary mini" onClick={add} disabled={!newName.trim()}>
                추가
              </button>
            </div>
          ) : (
            <>
              <div className="assess-row">
                <button className="mini wide" onClick={() => setAdding(true)}>
                  ＋ 학생 추가
                </button>
                <button className="mini wide" onClick={() => fileRef.current?.click()}>
                  CSV 가져오기
                </button>
                {data.students.length > 0 && (
                  <button
                    className="mini wide"
                    onClick={() => downloadText(`학생목록_${todayStr()}.csv`, studentsToCsv(data.students))}
                  >
                    내려받기
                  </button>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,text/csv"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) importCsv(f);
                    e.target.value = '';
                  }}
                />
              </div>
            </>
          )}
        </div>

        <div className="side-list">
          {shown.length === 0 ? (
            <p className="hint" style={{ padding: '10px 12px' }}>
              {data.students.length === 0 ? '등록된 학생이 없습니다.' : '검색 결과가 없습니다.'}
            </p>
          ) : (
            shown.map((s) => {
              const r = rateOf.get(s.id);
              return (
                <button
                  key={s.id}
                  className={`side-item ${s.id === selectedId ? 'on' : ''}`}
                  onClick={() => setSelectedId(s.id)}
                >
                  <span className="nm">
                    {s.name} <span className="gr">{s.grade}</span>
                  </span>
                  <span className="rt">{r === null || r === undefined ? '—' : `${Math.round(r * 100)}%`}</span>
                </button>
              );
            })
          )}
        </div>
      </aside>

      <div className="main">
        {!student ? (
          <div className="assess-card empty-state">
            <p className="muted">왼쪽에서 학생을 선택하면 진단 결과가 표시됩니다.</p>
          </div>
        ) : (
          <>
            <div className="assess-card stu-head">
              <div className="stu-id">
                <div className="stu-name">
                  <h1>{student.name}</h1>
                  <span className="muted">
                    {student.grade}
                    {student.school ? ` · ${student.school}` : ''}
                  </span>
                </div>
                <div className="hint">
                  {lastExam ? `${lastExam.title} · ${lastDate} 응시` : '아직 채점된 시험이 없습니다'}
                </div>
              </div>

              {studentResults.length > 0 && (
                <>
                  <div className="stu-div" />
                  <div className="stu-stats">
                    <div>
                      <span className="hint">전체 정답률</span>
                      <b>{Math.round(total.rate * 100)}%</b>
                    </div>
                    <div>
                      <span className="hint">약점 유형</span>
                      <b>
                        {weakCount}/{stats.length}
                      </b>
                    </div>
                    <div>
                      <span className="hint">응시</span>
                      <b>{studentResults.length}회</b>
                    </div>
                  </div>
                </>
              )}

              <div className="stu-actions">
                <button className="mini" onClick={onOpenGrading}>
                  채점 입력
                </button>
                <button className="primary mini" onClick={onOpenReport} disabled={studentResults.length === 0}>
                  리포트 열기
                </button>
                <button className="del" onClick={remove} title="학생 삭제">
                  ✕
                </button>
              </div>
            </div>

            <div className="assess-card">
              <div className="stu-info-head">
                <h3>학생 정보</h3>
                <span className="hint">적어두면 상담 카드에 자동으로 채워집니다. 비워두면 인쇄 시 빈칸으로 나옵니다.</span>
              </div>

              <div className="field-grid">
                <label className="fld">
                  <span>학년</span>
                  <select value={student.grade} onChange={(e) => update({ grade: e.target.value })}>
                    {GRADES.map((g) => (
                      <option key={g}>{g}</option>
                    ))}
                  </select>
                </label>
                <label className="fld">
                  <span>학교</span>
                  <input type="text" value={student.school ?? ''} onChange={(e) => update({ school: e.target.value })} />
                </label>
                <label className="fld">
                  <span>학생 연락처</span>
                  <input type="tel" value={student.contact ?? ''} onChange={(e) => update({ contact: e.target.value })} />
                </label>
                <label className="fld">
                  <span>학부모 연락처</span>
                  <input
                    type="tel"
                    placeholder="비워두면 빈칸으로 인쇄"
                    value={student.parentContact ?? ''}
                    onChange={(e) => update({ parentContact: e.target.value })}
                  />
                </label>
                <label className="fld">
                  <span>형제 재원 여부</span>
                  <select value={student.sibling ?? ''} onChange={(e) => update({ sibling: e.target.value as Sibling })}>
                    <option value="">선택 안 함</option>
                    <option value="없음">없음</option>
                    <option value="있음">있음</option>
                  </select>
                </label>
                <label className="fld">
                  <span>메모</span>
                  <input type="text" value={student.memo ?? ''} onChange={(e) => update({ memo: e.target.value })} />
                </label>
              </div>

              <div className="fld" style={{ marginTop: 12 }}>
                <span>목표 고등학교 (복수 선택)</span>
                <div className="chips">
                  {TARGET_SCHOOLS.map((t) => {
                    const on = (student.targetSchools ?? []).includes(t);
                    return (
                      <button key={t} className={`chip ${on ? 'on' : ''}`} onClick={() => toggleTarget(t)}>
                        {on ? '✓ ' : ''}
                        {t}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="fld" style={{ marginTop: 12 }}>
                <span>현재 진도 · 학습 내용</span>
                <table className="progress-table">
                  <thead>
                    <tr>
                      <th>과목</th>
                      <th>
                        현재 진도 <span className="rp-eg">(예: 중 3-2, 대수)</span>
                      </th>
                      <th>
                        학습 내용 <span className="rp-eg">(예: 중등 - 쎈)</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <th>수학</th>
                      <td>
                        <input
                          type="text"
                          aria-label="수학 현재 진도"
                          value={student.mathProgress ?? ''}
                          onChange={(e) => update({ mathProgress: e.target.value })}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          aria-label="수학 학습 내용"
                          value={student.mathBooks ?? ''}
                          onChange={(e) => update({ mathBooks: e.target.value })}
                        />
                      </td>
                    </tr>
                    <tr>
                      <th>과학</th>
                      <td>
                        <input
                          type="text"
                          aria-label="과학 현재 진도"
                          value={student.sciProgress ?? ''}
                          onChange={(e) => update({ sciProgress: e.target.value })}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          aria-label="과학 학습 내용"
                          value={student.sciBooks ?? ''}
                          onChange={(e) => update({ sciBooks: e.target.value })}
                        />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {studentResults.length > 0 && (
              <div className="assess-card">
                <h3>응시 결과</h3>
                <table className="assess-table">
                  <thead>
                    <tr>
                      <th>시험지</th>
                      <th style={{ width: 116 }}>응시일</th>
                      <th style={{ width: 150 }}>점수</th>
                      <th style={{ width: 44 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {studentResults.map((r) => {
                      const ex = data.exams.find((e) => e.id === r.examId);
                      const sc = scoreOf(r.marks);
                      return (
                        <tr key={r.id}>
                          <td>{ex?.title ?? '—'}</td>
                          <td>{r.date}</td>
                          <td>
                            {sc.correct}/{sc.total} · {Math.round(sc.rate * 100)}%
                          </td>
                          <td>
                            <button className="del" onClick={() => removeResult(r.id)} title="이 채점 결과 삭제">
                              ✕
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <p className="hint" style={{ marginTop: 8 }}>
                  지우면 위의 정답률과 리포트에서 바로 빠집니다. 시험지와 학생은 그대로 남습니다.
                </p>
              </div>
            )}

            <div className="assess-card grow">
              {studentResults.length === 0 ? (
                <p className="muted">채점된 시험이 없습니다. [채점 입력]에서 O/X를 입력하면 여기에 결과가 표시됩니다.</p>
              ) : (
                <>
                  <h3>유형별 정답률</h3>
                  <div className="type-bars-wrap">
                    <div className="type-radar-wrap">
                      <TypeRadar stats={stats} />
                    </div>
                    <TypeBars stats={stats} />
                  </div>
                  <p className="hint" style={{ marginTop: 10 }}>
                    {stats.length > 0 && stats[0].rate < 0.5
                      ? `우선 보강: ${stats
                          .filter((s) => s.rate < 0.5)
                          .map((s) => s.type)
                          .join(', ')}`
                      : `${rateTag(stats[0]?.rate ?? 0).label} 구간에서 시작합니다.`}
                  </p>
                </>
              )}
            </div>
          </>
        )}
      </div>

    </div>
  );
}
