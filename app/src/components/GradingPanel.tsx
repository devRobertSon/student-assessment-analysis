import { useEffect, useMemo, useRef, useState } from 'react';
import { ask, notify } from '../lib/notice';
import { setLeaveGuard } from '../lib/leaveGuard';
import {
  AssessmentData,
  Axis,
  Mark,
  Result,
  fmtPoints,
  hasAxis,
  isEssay,
  makeMark,
  newId,
  pointsOf,
  DEFAULT_RETAKE_SCALE,
  advancedGap,
  retakeCheck,
  scoreOf,
  statsForResult,
  todayStr,
} from '../lib/assessment';
import { rateTag } from './TypeRadar';
import ConfirmDialog from './ConfirmDialog';
import Select from './Select';
import DatePicker from './DatePicker';

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

/** 문항 번호를 읽기 좋게 잇는다. 너무 길면 뒤를 접어 창이 길어지지 않게 한다. */
function listNos(nos: number[], max = 24): string {
  if (nos.length <= max) return nos.join(', ') + '번';
  return nos.slice(0, max).join(', ') + `번 외 ${nos.length - max}문항`;
}

export default function GradingPanel({ data, setData }: Props) {
  const [studentId, setStudentId] = useState('');
  const [examId, setExamId] = useState('');
  const [cells, setCells] = useState<Record<number, Cell>>({});
  const [date, setDate] = useState(todayStr());
  const [axis, setAxis] = useState<Axis>('type');
  const [askDelete, setAskDelete] = useState(false);

  const exam = data.exams.find((e) => e.id === examId);

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

  /** 저장된 채점(없으면 빈칸)을 지금 칸과 같은 모양으로 펼친 것. */
  const savedCells = useMemo(() => {
    const map: Record<number, Cell> = {};
    if (!exam) return map;
    exam.questions.forEach((q) => (map[q.no] = null));
    existing?.marks.forEach((m) => (map[m.no] = m.earned));
    return map;
  }, [exam, existing]);

  /** 저장한 것과 다른 입력이 있는가. 이것이 있으면 화면을 떠나기 전에 묻는다. */
  const dirty = !!exam && exam.questions.some((q) => (cells[q.no] ?? null) !== (savedCells[q.no] ?? null));
  const entered = exam ? exam.questions.filter((q) => cells[q.no] !== null && cells[q.no] !== undefined).length : 0;

  /**
   * 입력을 버려도 되는지 묻는다. 저장을 누르지 않으면 아무 데도 남지 않으므로
   * 칸을 바꾸는 길, 지우는 단추, 화면을 떠나는 길 모두 여기를 지난다.
   */
  const okToDiscard = async () => {
    if (!dirty) return true;
    return ask('저장하지 않은 채점이 있습니다', `${entered}문항을 입력했고 아직 저장하지 않았습니다.`, {
      detail: '지금 옮기면 입력한 것이 사라집니다. 남기려면 [아니요]를 누르고 [채점 저장]을 먼저 누르세요.',
      yesLabel: '예, 버립니다',
    });
  };

  // 위 메뉴로 다른 화면에 갈 때 App 이 이 함수를 먼저 부른다.
  useEffect(() => {
    setLeaveGuard(dirty ? okToDiscard : null);
    return () => setLeaveGuard(null);
  });

  /*
   * 새로고침과 탭 닫기도 막는다.
   *
   * 이 창만은 앱이 그릴 수 없다. 브라우저가 직접 띄우고 글귀도 브라우저가
   * 정해서, 우리가 적은 말은 나오지 않는다. 그래도 30문항이 말없이 날아가는
   * 것보다는 낫다. 크롬은 preventDefault 와 returnValue 를 둘 다 봐야 띄운다.
   */
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const setAll = async (v: 'full' | 'zero' | 'clear') => {
    if (!exam) return;
    if (entered > 0) {
      const ok = await ask(
        v === 'clear' ? '입력한 채점을 지웁니다' : '입력한 채점을 덮어씁니다',
        v === 'clear'
          ? `${entered}문항을 지웁니다.`
          : `${entered}문항에 넣은 것을 모두 ${v === 'full' ? 'O' : 'X'} 로 바꿉니다.`,
        { yesLabel: '예' }
      );
      if (!ok) return;
    }
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
  // 아직 O도 X도 누르지 않은 문항. 화면에도 표시하고 저장할 때도 묻는다.
  const blankNos = exam
    ? exam.questions.filter((q) => cells[q.no] === null || cells[q.no] === undefined).map((q) => q.no)
    : [];
  const score = scoreOf(marks);
  const stats = exam ? statsForResult(exam, marks, axis) : [];
  // 학원 기준 판정. 리포트에는 안 들어가고 이 화면에서만 본다.
  const retakeScale = data.retakeScale ?? DEFAULT_RETAKE_SCALE;
  const retake = exam ? retakeCheck(exam, marks, retakeScale) : null;
  // 재수강 판정과 별개로, 최상 난이도를 얼마나 놓쳤는지는 따로 알아야 한다.
  const gap = exam ? advancedGap(exam, marks) : null;
  const fullPoints = exam ? exam.questions.reduce((a, q) => a + pointsOf(q), 0) : 0;

  const save = async () => {
    if (!studentId || !exam) {
      notify('채점 저장', '학생과 시험지를 모두 고르세요.');
      return;
    }
    // 빈 문항이 있으면 어느 문항인지 보여주고 한 번 묻는다. 빈 채로 저장하면
    // 그 문항은 없는 셈이 되어 정답률이 실제보다 높게 나온다.
    if (blankNos.length > 0) {
      const ok = await ask('채점이 덜 되었습니다', `${blankNos.length}문항이 비어 있습니다. 그래도 저장할까요?`, {
        detail: `비어 있는 문항
${listNos(blankNos)}

빈 문항은 저장되지 않고, 입력한 문항만으로 점수를 냅니다.`,
        yesLabel: '예, 저장합니다',
      });
      if (!ok) return;
    }
    const res: Result = { id: existing?.id ?? newId('res'), studentId, examId, date, marks };
    const others = data.results.filter((r) => !(r.studentId === studentId && r.examId === examId));
    setData({ ...data, results: [...others, res] });
    notify('채점 저장', '채점을 저장했습니다.');
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

  // 저장된 채점을 불러왔는데 빈 문항이 있으면 한 번 알려 준다. 같은 학생·시험지를
  // 보고 있는 동안에는 다시 뜨지 않는다. 저장할 때마다 또 뜨면 성가시다.
  const toldFor = useRef('');
  useEffect(() => {
    if (!exam || !existing) return;
    const key = `${studentId}|${examId}`;
    if (toldFor.current === key) return;
    toldFor.current = key;
    const done = new Set(existing.marks.map((m) => m.no));
    const left = exam.questions.filter((q) => !done.has(q.no)).map((q) => q.no);
    if (left.length === 0) return;
    notify(
      '채점이 덜 된 시험지입니다',
      `${exam.title} · ${existing.date} 채점에 ${left.length}문항이 비어 있습니다.`,
      `비어 있는 문항
${listNos(left)}`
    );
  }, [exam, existing, studentId, examId]);

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
                <Select
                  label="학생"
                  value={studentId}
                  onChange={async (v) => {
                    if (!(await okToDiscard())) return;
                    setStudentId(v);
                    setExamId('');
                  }}
                  options={data.students.map((s) => ({ value: s.id, label: s.name, note: s.grade }))}
                />
              </label>
              <label className="assess-field">
                시험지
                <Select
                  label="시험지"
                  value={examId}
                  onChange={async (v) => {
                    if (await okToDiscard()) setExamId(v);
                  }}
                  disabled={!studentId}
                  options={data.exams.map((ex) => ({
                    value: ex.id,
                    label: ex.title,
                    note: `${ex.questions.length}문항`,
                  }))}
                />
              </label>
              <label className="assess-field">
                응시일
                <DatePicker label="응시일" value={date} onChange={setDate} />
              </label>
              {existing && (
                <span className="assess-row" style={{ alignSelf: 'flex-end', gap: 8 }}>
                  <span className="assess-badge">저장된 채점</span>
                  <button className="del-btn mini" onClick={() => setAskDelete(true)}>
                    채점 결과 삭제
                  </button>
                </span>
              )}
            </div>

            {/* 두 칸 다 고르기 전에는 어느 차례인지 말해 준다. */}
            {!studentId && <p className="muted" style={{ marginTop: 12 }}>먼저 학생을 선택하세요.</p>}
            {studentId && !exam && (
              <p className="muted" style={{ marginTop: 12 }}>
                채점할 시험지를 선택하세요.
              </p>
            )}

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
                  <button className="primary mini" onClick={save} disabled={answered === 0}>
                    채점 저장
                  </button>
                </div>

                <div className="ox-grid">
                  {exam.questions.map((q) => {
                    const v = cells[q.no];
                    const pts = pointsOf(q);
                    return (
                      <div
                        key={q.no}
                        /* 한 문항도 안 누른 처음에는 표시하지 않는다. 서른 개가
                           모두 켜지면 '안 누른 것'을 짚어 주는 뜻이 사라진다. */
                        className={`ox-item ${isEssay(q) ? 'essay' : ''} ${
                          entered > 0 && (v === null || v === undefined) ? 'blank' : ''
                        }`}
                      >
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
                {/* 큰 숫자는 시험지 만점을 기준으로 한 득점이다. 퍼센트는 적지 않는다.
                    아직 안 누른 문항이 있으면 그만큼 낮게 나오는데, 아래 '남음' 줄이 그것을 말해 준다.
                    한 문항도 안 눌렀을 때는 0 이 아니라 — 로 둔다. 0 은 다 틀렸다는 뜻으로 읽힌다. */}
                <div className="assess-row" style={{ alignItems: 'baseline', gap: 6 }}>
                  <span className="big">{entered === 0 ? '—' : fmtPoints(score.earned)}</span>
                  <span style={{ fontSize: 17, fontWeight: 500, color: 'var(--navy-pale)' }}>
                    / {fmtPoints(fullPoints)}점
                  </span>
                </div>
                {entered === 0 ? (
                  <div style={{ fontSize: 13, color: 'var(--navy-soft)', marginTop: 5 }}>
                    아직 입력한 문항이 없습니다
                  </div>
                ) : (
                  <>
                    <div style={{ fontSize: 13, color: 'var(--navy-soft)', marginTop: 5 }}>
                      맞은 문제 수 {score.correct}/{exam.questions.length}
                    </div>
                    {blankNos.length === 0 ? (
                      <div style={{ fontSize: 13, color: 'var(--navy-soft)', marginTop: 3 }}>
                        {exam.questions.length}문항 모두 입력 완료
                      </div>
                    ) : (
                      <div className="sb-blank">
                        <b>{blankNos.length}문항 남음</b>
                        <span>{listNos(blankNos, 12)}</span>
                      </div>
                    )}
                  </>
                )}
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
                        {/* 옆의 %는 문항 개수로 잰 정답률, 여기는 배점까지 반영한 득점이다. */}
                        <span className="c">
                          {fmtPoints(s.earned)}/{fmtPoints(s.points)}점
                        </span>
                        <span className="p">{Math.round(s.rate * 100)}%</span>
                        <span className="g">{rateTag(s.rate).label}</span>
                      </div>
                    ))}
                  </div>
                )}
                {/* 판정은 켜짐·꺼짐만 보여준다. 점수를 적어 두면 바로 위 점수 상자의
                    점수와 서로 다른 값이라 어느 쪽이 학생 점수인지 헷갈린다. */}
                {(retake || gap) && (
                  <div className="verdicts">
                    {retake && <span className={`verdict ${!retake.pass ? 'on' : ''}`}>재수강 권장</span>}
                    {gap && <span className={`verdict ${gap.short ? 'on' : ''}`}>심화 미달</span>}
                  </div>
                )}
              </div>

            </aside>
          )}
        </div>
      )}
    </div>
  );
}
