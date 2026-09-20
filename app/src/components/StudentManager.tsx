import { useMemo, useState } from 'react';
import {
  AssessmentData,
  Sibling,
  Student,
  TARGET_SCHOOLS,
  newId,
  scoreOf,
  statsCumulative,
} from '../lib/assessment';
import { STEADY } from './TypeRadar';
import TypeRadar from './TypeRadar';
import TypeBars from './TypeBars';
import ConfirmDialog from './ConfirmDialog';
import Select from './Select';
import { ask } from '../lib/notice';

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
  // 지우기 전에 한 번 묻는다.
  const [pending, setPending] = useState<
    { kind: 'student' } | { kind: 'result'; id: string; label: string } | null
  >(null);

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
  // 선생님이 보는 화면이라 자리 잡은 쪽과 손봐야 하는 쪽을 함께 둔다.
  const strongCount = stats.filter((s) => s.rate >= STEADY).length;
  const weakCount = stats.filter((s) => s.rate < 0.5).length;
  const lastExam = studentResults.length
    ? data.exams.find((e) => e.id === studentResults[studentResults.length - 1].examId)
    : undefined;
  const lastDate = studentResults.length ? studentResults[studentResults.length - 1].date : '';

  const add = async () => {
    const nm = newName.trim();
    if (!nm) return;
    if (
      data.students.some((s) => s.name === nm) &&
      !(await ask('학생 추가', `"${nm}" 학생이 이미 있습니다. 그래도 추가할까요?`, { yesLabel: '예, 추가합니다' }))
    ) {
      return;
    }
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
  const doRemoveResult = (resultId: string) => {
    setData({ ...data, results: data.results.filter((x) => x.id !== resultId) });
    setPending(null);
  };

  const doRemoveStudent = () => {
    if (!student) return;
    setData({
      ...data,
      students: data.students.filter((s) => s.id !== student.id),
      results: data.results.filter((r) => r.studentId !== student.id),
    });
    setSelectedId('');
    setPending(null);
  };

  return (
    <div className="split">
      {pending && (
        <ConfirmDialog
          title={pending.kind === 'student' ? '학생 삭제' : '채점 결과 삭제'}
          message={
            pending.kind === 'student'
              ? `${student?.name ?? ''} 학생을 삭제할까요?`
              : `${pending.label} 채점 결과를 삭제할까요?`
          }
          detail={
            pending.kind === 'student'
              ? (() => {
                  const cnt = data.results.filter((r) => r.studentId === student?.id).length;
                  return cnt
                    ? `채점 결과 ${cnt}건도 함께 지워집니다. 되돌릴 수 없습니다.`
                    : '되돌릴 수 없습니다.';
                })()
              : '이 응시 하나만 지웁니다. 시험지와 학생은 그대로 남습니다.'
          }
          onYes={() => (pending.kind === 'student' ? doRemoveStudent() : doRemoveResult(pending.id))}
          onNo={() => setPending(null)}
        />
      )}
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
              <Select
                label="새 학생 학년"
                value={newGrade}
                onChange={setNewGrade}
                options={GRADES.map((g) => ({ value: g, label: g }))}
              />
              <button className="primary mini" onClick={add} disabled={!newName.trim()}>
                추가
              </button>
              {/* Esc 로도 닫히지만 그것만으로는 나가는 길이 보이지 않는다. */}
              <button
                className="mini ghost"
                onClick={() => {
                  setNewName('');
                  setAdding(false);
                }}
              >
                취소
              </button>
            </div>
          ) : (
            <div className="assess-row">
              <button className="mini wide" onClick={() => setAdding(true)}>
                ＋ 학생 추가
              </button>
            </div>
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
                  {/* 점수로 적는다. 채점·리포트와 같은 값, 같은 단위다. */}
                  <span className="rt">{r === null || r === undefined ? '—' : `${Math.round(r * 100)}점`}</span>
                </button>
              );
            })
          )}
        </div>
      </aside>

      <div className="main">
        {!student ? (
          <div className="assess-card empty-state">
            <p className="muted">왼쪽에서 학생을 고르면 진단 결과가 나옵니다.</p>
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
                      {/* 응시가 여러 번이면 문항을 다 합쳐 낸 값이라 평균이라고 밝힌다.
                          리포트 머리칸도 같은 말로 바뀐다. */}
                      <span className="hint">{studentResults.length > 1 ? '평균 점수' : '점수'}</span>
                      <b>{Math.round(total.rate * 100)}점</b>
                    </div>
                    <div>
                      <span className="hint">강점 유형</span>
                      <b>
                        {strongCount}/{stats.length}
                      </b>
                    </div>
                    <div>
                      <span className="hint">보완 유형</span>
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
                <button className="del-btn mini" onClick={() => setPending({ kind: 'student' })}>
                  학생 삭제
                </button>
              </div>
            </div>

            <div className="assess-card">
              <div className="stu-info-head">
                <h3>학생 정보</h3>
                <span className="hint">적어두면 상담 카드에 자동으로 채워집니다. 비워두면 인쇄할 때 빈칸으로 나옵니다.</span>
              </div>

              <div className="field-grid">
                <label className="fld">
                  <span>학년</span>
                  <Select
                    label="학년"
                    value={student.grade}
                    onChange={(v) => update({ grade: v })}
                    options={GRADES.map((g) => ({ value: g, label: g }))}
                  />
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
                  <Select
                    label="형제 재원 여부"
                    value={student.sibling ?? ''}
                    onChange={(v) => update({ sibling: v as Sibling })}
                    placeholder="선택 안 함"
                    options={[
                      { value: '', label: '선택 안 함' },
                      { value: '없음', label: '없음' },
                      { value: '있음', label: '있음' },
                    ]}
                  />
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
                        현재 진도 <span className="rp-eg">(예: 중3-2, 대수)</span>
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
                            {Math.round(sc.rate * 100)}점 · {sc.correct}/{sc.total}문항
                          </td>
                          <td>
                            <button
                              className="del-btn mini"
                              onClick={() => setPending({ kind: 'result', id: r.id, label: `${ex?.title ?? '시험'} · ${r.date}` })}
                            >
                              삭제
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className="assess-card grow">
              {studentResults.length === 0 ? (
                <p className="muted">채점된 시험이 없습니다. [채점 입력]에서 O/X를 누르면 여기에 결과가 나옵니다.</p>
              ) : (
                <>
                  <h3>유형별 정답률</h3>
                  <div className="type-bars-wrap">
                    <div className="type-radar-wrap">
                      <TypeRadar stats={stats} plain />
                    </div>
                    <TypeBars stats={stats} showTag={false} />
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>

    </div>
  );
}
