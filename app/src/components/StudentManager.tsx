import { useEffect, useMemo, useState } from 'react';
import {
  AssessmentData,
  MEMO_MAX,
  Sibling,
  Student,
  TARGET_SCHOOLS,
  counselText,
  newId,
  scoreOf,
  statsCumulative,
} from '../lib/assessment';
import { STEADY } from './TypeRadar';
import TypeRadar from './TypeRadar';
import TypeBars from './TypeBars';
import ConfirmDialog from './ConfirmDialog';
import CounselCopy from './CounselCopy';
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
  /**
   * 학생 목록을 펼쳤는가. 접은 채로 연다.
   *
   * 이 화면은 학부모님과 같이 본다. 옆에 다른 집 아이들의 이름과 점수가
   * 늘어서 있으면 안 된다. 고를 때만 펼치고, 고르면 바로 다시 접는다.
   */
  const [sideOpen, setSideOpen] = useState(false);
  // 지우기 전에 한 번 묻는다.
  const [pending, setPending] = useState<
    { kind: 'student' } | { kind: 'result'; id: string; label: string } | null
  >(null);
  /** 상담내용 창을 띄웠는가. */
  const [copying, setCopying] = useState(false);

  const student = data.students.find((s) => s.id === selectedId);

  const pick = (id: string) => {
    setSelectedId(id);
    setSideOpen(false);
  };

  const shown = data.students.filter((s) => s.name.includes(query.trim()));

  const studentResults = useMemo(
    () => data.results.filter((r) => r.studentId === selectedId).sort((a, b) => a.date.localeCompare(b.date)),
    [data.results, selectedId]
  );

  /**
   * 아래 점수와 유형별 성취에 넣을 응시. 기본은 전부다.
   *
   * 여러 번 본 학생은 시험마다 결과가 다르다. 체크를 풀면 그 시험을 빼고
   * 다시 센다. 채점 기록 자체는 건드리지 않는다.
   */
  const [pickedIds, setPickedIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    setPickedIds(new Set(studentResults.map((r) => r.id)));
  }, [selectedId, studentResults.length]);
  const picked = useMemo(
    () => studentResults.filter((r) => pickedIds.has(r.id)),
    [studentResults, pickedIds]
  );
  const togglePicked = (id: string) =>
    setPickedIds((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  /**
   * 유형별 성취를 과목마다 따로 낸다.
   *
   * 수학 여덟 유형과 과학 여덟 유형은 재는 것이 다르다. 한 그림에 같이 그리면
   * 축이 열다섯이 되어 사분면 묶음이 깨지고, 이름이 같은 `개념 이해` 가 두
   * 과목에서 한 막대로 합쳐진다. 그래서 과목별로 한 벌씩 그린다.
   */
  const bySubject = useMemo(() => {
    if (!selectedId) return [];
    const examById = new Map(data.exams.map((e) => [e.id, e]));
    const groups = new Map<string, typeof picked>();
    for (const r of picked) {
      const subject = examById.get(r.examId)?.subject ?? '기타';
      const cur = groups.get(subject);
      if (cur) cur.push(r);
      else groups.set(subject, [r]);
    }
    return [...groups].map(([subject, rs]) => {
      const stats = statsCumulative(data.exams, rs);
      return {
        subject,
        count: rs.length,
        score: scoreOf(rs.flatMap((r) => r.marks)),
        stats,
        // 선생님이 보는 화면이라 자리 잡은 쪽과 손봐야 하는 쪽을 함께 둔다.
        strong: stats.filter((s) => s.rate >= STEADY).length,
        weak: stats.filter((s) => s.rate < 0.5).length,
      };
    });
  }, [selectedId, data.exams, picked]);

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
    pick(id);
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
    <div className={`split ${sideOpen ? '' : 'side-shut'}`}>
      {copying && student && (
        <CounselCopy
          name={`${student.name} · ${student.grade}`}
          text={counselText(student)}
          onClose={() => setCopying(false)}
        />
      )}
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
              : '이 응시 하나만 지웁니다. 시험지와 학생은 남습니다.'
          }
          onYes={() => (pending.kind === 'student' ? doRemoveStudent() : doRemoveResult(pending.id))}
          onNo={() => setPending(null)}
        />
      )}
      {/* 목록을 여는 단추. 학부모님과 같이 보는 화면이라 목록은 접어 둔다.
          좁은 창에서 목록이 본문 위로 쌓이므로 단추는 늘 맨 윗줄에 둔다. */}
      <div className="side-toggle">
        <button className="mini" aria-expanded={sideOpen} onClick={() => setSideOpen((o) => !o)}>
          {sideOpen ? '◂ 학생 목록 접기' : '▸ 학생 목록 펼치기'}
        </button>
        <span className="hint">{data.students.length}명</span>
      </div>

      {sideOpen && (
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
            shown.map((s) => (
              <button
                key={s.id}
                className={`side-item ${s.id === selectedId ? 'on' : ''}`}
                onClick={() => pick(s.id)}
              >
                <span className="nm">{s.name}</span>
                {/* 학부모님과 같이 보는 화면이라 점수는 적지 않는다. 동명이인을
                    가리는 데 필요한 학교와 학년만 오른쪽에 둔다. */}
                <span className="gr">{[s.school, s.grade].filter(Boolean).join(' ')}</span>
              </button>
            ))
          )}
        </div>
      </aside>
      )}

      <div className="main">
        {!student ? (
          <div className="assess-card empty-state">
            <p className="muted">[학생 목록 펼치기]를 눌러 학생을 고르면 진단 결과가 나옵니다.</p>
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
              </div>

              <div className="stu-actions">
                <button className="mini" onClick={() => setCopying(true)}>
                  상담내용 복사
                </button>
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
                {/* 학년·학교 다음에 형제 재원 여부를 두어 윗줄에서 학생을 가리는
                    것이 끝나고, 아랫줄이 연락처 둘이 된다. */}
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
                  <span>학생 연락처</span>
                  <input type="tel" value={student.contact ?? ''} onChange={(e) => update({ contact: e.target.value })} />
                </label>
                <label className="fld">
                  <span>학부모 연락처</span>
                  {/* 안내 문구는 두지 않는다. 카드 머리글이 이미 같은 말을 하고,
                      여섯 칸 중 이 칸에만 붙어 있으면 값이 적힌 것처럼 보인다. */}
                  <input
                    type="tel"
                    value={student.parentContact ?? ''}
                    onChange={(e) => update({ parentContact: e.target.value })}
                  />
                </label>
              </div>

              {/* 한 줄 칸이던 것을 넓혔다. 상담에서 나온 말을 그대로 적어 두면
                  리포트의 [상담 메모 · 특이사항]에 그대로 실린다. 글자 수도 그
                  칸과 같게 막는다. 넘치면 인쇄에서 잘린다. */}
              <label className="fld" style={{ marginTop: 12 }}>
                <span className="fld-head">
                  메모
                  <em>리포트의 [상담 메모 · 특이사항]에 그대로 들어갑니다</em>
                  <i>
                    {(student.memo ?? '').length}/{MEMO_MAX}자
                  </i>
                </span>
                <textarea
                  className="stu-memo"
                  rows={5}
                  maxLength={MEMO_MAX}
                  value={student.memo ?? ''}
                  onChange={(e) => update({ memo: e.target.value })}
                  placeholder="상담에서 나온 말, 눈여겨볼 점을 적어 두세요."
                />
              </label>

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
                {/* 좁은 창에서 표가 카드 밖으로 밀려 나간다. 감싸서 가로로 밀어 보게 한다. */}
                <div className="table-scroll">
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
            </div>

            {studentResults.length > 0 && (
              <div className="assess-card">
                <div className="res-head">
                  <h3>응시 결과</h3>
                  <span className="hint">
                    체크한 {picked.length}/{studentResults.length}개가 아래 [유형별 성취]에 들어갑니다
                  </span>
                  {studentResults.length > 1 && (
                    <span className="res-head-acts">
                      <button
                        className="mini ghost"
                        onClick={() => setPickedIds(new Set(studentResults.map((r) => r.id)))}
                      >
                        전체 선택
                      </button>
                      <button className="mini ghost" onClick={() => setPickedIds(new Set())}>
                        전체 해제
                      </button>
                    </span>
                  )}
                </div>
                {/* 시험지 이름이 좁은 창에서 글자마다 끊기지 않게 감싼다. */}
                <div className="table-scroll">
                <table className="assess-table res-table">
                  <thead>
                    <tr>
                      <th style={{ width: 36 }}></th>
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
                      const on = pickedIds.has(r.id);
                      return (
                        <tr key={r.id} className={on ? '' : 'res-off'}>
                          <td>
                            <input
                              type="checkbox"
                              className="res-check"
                              checked={on}
                              onChange={() => togglePicked(r.id)}
                              aria-label={`${ex?.title ?? '시험'} ${r.date} 결과 넣기`}
                            />
                          </td>
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
              </div>
            )}

            <div className="assess-card grow">
              {studentResults.length === 0 ? (
                /* 채점한 것이 없으면 위의 [응시 결과] 카드도 안 나온다. 그 자리를
                   이 카드가 대신하므로 제목도 그 이름으로 단다. */
                <>
                  <h3>응시 결과</h3>
                  <p className="muted">채점된 시험이 없습니다. [채점 입력]에서 O/X를 누르면 여기에 결과가 나옵니다.</p>
                </>
              ) : (
                <>
                  {/* 리포트의 같은 칸과 이름을 맞춘다. */}
                  <h3>유형별 성취</h3>
                  {picked.length === 0 ? (
                    /* 고른 것이 없으면 그리지 않는다. 그리면 온통 0인 그림이 나와
                       못하는 학생처럼 보인다. */
                    <p className="muted">위 [응시 결과]에서 시험을 하나 이상 체크하세요.</p>
                  ) : (
                    bySubject.map((g) => (
                      <div key={g.subject} className="subject-block">
                        {/* 점수·강점·보완은 그림 바로 위에 둔다. 과목마다 따로 낸 값이라
                            그림과 떨어뜨리면 어느 과목 숫자인지 흐려진다. 과목 이름은
                            과목이 둘 이상일 때만 단다. */}
                        <div className="subject-head">
                          {bySubject.length > 1 && <b>{g.subject}</b>}
                          <div className="stu-stats">
                            <div>
                              {/* 응시가 여러 번이면 문항을 다 합쳐 낸 값이라 평균이라고
                                  밝힌다. 리포트 머리칸도 같은 말로 바뀐다. */}
                              <span className="hint">{g.count > 1 ? '평균 점수' : '점수'}</span>
                              <b>{Math.round(g.score.rate * 100)}점</b>
                            </div>
                            <div>
                              <span className="hint">강점 유형</span>
                              <b>
                                {g.strong}/{g.stats.length}
                              </b>
                            </div>
                            <div>
                              <span className="hint">보완 유형</span>
                              <b>
                                {g.weak}/{g.stats.length}
                              </b>
                            </div>
                          </div>
                          <span className="hint">시험 {g.count}개</span>
                        </div>
                        <div className="type-bars-wrap">
                          <div className="type-radar-wrap">
                            <TypeRadar stats={g.stats} plain />
                          </div>
                          <TypeBars stats={g.stats} showTag={false} />
                        </div>
                      </div>
                    ))
                  )}
                </>
              )}
            </div>
          </>
        )}
      </div>

    </div>
  );
}
