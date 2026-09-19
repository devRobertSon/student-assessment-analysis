import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { toJpeg } from 'html-to-image';
import {
  AssessmentData,
  TARGET_SCHOOLS,
  TypeStat,
  scaledScore,
  gradeFromLevels,
  scoreOf,
  todayStr,
  statsCumulative,
} from '../lib/assessment';
import { logoUrl, sealUrl } from '../lib/brand';
import { notify } from '../lib/notice';
import TypeRadar, { FAIR, STEADY } from './TypeRadar';
import TypeBars from './TypeBars';
import DatePicker from './DatePicker';
import Select from './Select';

// styles.css의 .report-capture min-height와 같은 값. A4 한 쪽(96dpi)이다.
const PAGE_H = 1123;

const SUMMARY_MAX = 130;
const NOTE_MAX = 170;
const MEMO_MAX = 200;

/**
 * 손으로 적을 날짜 칸. '20    년    월    일'처럼 공백을 여러 개 넣으면
 * HTML이 공백을 하나로 합쳐 버려서 인쇄했을 때 적을 자리가 남지 않는다.
 * 폭을 가진 빈 칸을 끼워 넣어 실제 여백을 만든다.
 */
const DateBlank = () => (
  <span className="rp-date">
    20<span className="rp-gap" />년<span className="rp-gap" />월<span className="rp-gap" />일
  </span>
);

const SEAL_ROWS = [
  ['알', '파', '학'],
  ['원', '교', '육'],
  ['연', '구', '소'],
];
const SEAL_CELL = [32, 66, 100];
const SEAL_RED = '#C0392B';

function SealStamp() {
  return (
    <svg viewBox="0 0 132 132" className="report-seal-svg" role="img" aria-label="알파학원 교육연구소 직인">
      <rect x="6" y="6" width="120" height="120" rx="7" fill="rgba(192,57,43,0.05)" stroke={SEAL_RED} strokeWidth="5" />
      <rect x="15" y="15" width="102" height="102" rx="3" fill="none" stroke={SEAL_RED} strokeWidth="1.3" />
      {SEAL_ROWS.map((row, r) =>
        row.map((ch, c) => (
          <text key={`${r}-${c}`} x={SEAL_CELL[c]} y={SEAL_CELL[r] + 10} textAnchor="middle" fontSize="27" fontWeight="800" fill={SEAL_RED}>
            {ch}
          </text>
        ))
      )}
    </svg>
  );
}

// 유형별 결과에서 종합 의견 초안을 만든다. 선생님이 그대로 쓰거나 고쳐 쓴다.
/**
 * 받침에 맞는 조사를 고른다. '정리는', '해석은'처럼 나오게 한다.
 * 이걸 안 하면 '표현 해석은(는)'처럼 괄호가 그대로 인쇄된다.
 */
function josa(text: string, withBatchim: string, without: string): string {
  const last = text.trim().slice(-1);
  const code = last.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return without;
  return (code - 0xac00) % 28 ? withBatchim : without;
}

/**
 * 종합 의견 초안. 학부모가 읽는 글이라 본 대로만 적는다.
 * 어느 유형에서 틀렸는지, 그게 오답의 몇 문항인지, 어느 유형의 정답률이 높은지.
 * '안정적입니다', '실점이 많았습니다' 처럼 무엇을 가리키는지 흐린 말은 쓰지 않는다.
 * 문장에 쓰는 50%·80% 는 화면의 보완·강점 구분선과 같은 값이라 표와 어긋나지 않는다.
 * 해석이나 처방은 선생님이 [선생님 의견]에 직접 쓴다.
 */
function autoSummary(stats: TypeStat[], correct: number, total: number): string {
  if (stats.length === 0 || total === 0) return '';
  const label = (list: TypeStat[]) => list.map((s) => s.type).join(', ');
  // stats는 약한 순으로 들어온다. 보완할 것은 앞에서, 강점은 뒤에서 세 개를 고른다.
  const worst = stats.filter((s) => s.rate < FAIR).slice(0, 3);
  const best = stats.filter((s) => s.rate >= STEADY).slice(-3).reverse();
  const wrong = total - correct;
  // 이름을 댄 유형만 센다. 그래야 문장 안에서 숫자와 유형이 어긋나지 않는다.
  const worstWrong = worst.reduce((a, s) => a + (s.total - s.correct), 0);

  const parts: string[] = [];
  if (worst.length > 0) {
    parts.push(`${label(worst)} 유형에서 틀린 문항이 많습니다.`);
    if (wrong > 0 && worstWrong > 0) parts.push(`오답 ${wrong}문항 중 ${worstWrong}문항이 이 유형입니다.`);
  } else {
    parts.push(`정답률이 ${FAIR * 100}%에 못 미치는 유형은 없습니다.`);
  }
  if (best.length > 0) {
    const g = label(best);
    parts.push(`${g}${josa(g, '은', '는')} 정답률 ${STEADY * 100}% 이상입니다.`);
  }
  const text = parts.join(' ');
  return text.length > SUMMARY_MAX ? text.slice(0, SUMMARY_MAX - 1) + '…' : text;
}

interface Props {
  data: AssessmentData;
  studentId: string;
  setStudentId: (id: string) => void;
  onBack: () => void;
}

/** 기간 고르는 방식. custom 일 때만 날짜 두 칸이 나온다. */
type RangeMode = 'all' | 'm3' | 'm6' | 'year' | 'custom';

// 인쇄물에만 쓰이고 저장하지 않는 입력들
interface SessionFields {
  summary: string;
  note: string;
  consultDate: string;
  memo: string;
  signName: string;
}
const EMPTY_SESSION: SessionFields = { summary: '', note: '', consultDate: '', memo: '', signName: '' };

export default function TypeReport({ data, studentId, setStudentId, onBack }: Props) {
  const [session, setSession] = useState<SessionFields>(EMPTY_SESSION);
  const [summaryTouched, setSummaryTouched] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [rangeMode, setRangeMode] = useState<RangeMode>('all');
  const [busy, setBusy] = useState(false);
  const page1Ref = useRef<HTMLDivElement>(null);
  const notesPageRef = useRef<HTMLDivElement>(null);
  const page2Ref = useRef<HTMLDivElement>(null);
  const movedRef = useRef<HTMLDivElement>(null);
  const analysisRef = useRef<HTMLElement>(null);
  // 응시 이력이 길어지면 의견 두 칸이 1쪽에 들어가지 않는다. 그때만 쪽을 하나 더 낸다.
  const [splitNotes, setSplitNotes] = useState(false);
  const pageCount = splitNotes ? 3 : 2;

  const student = data.students.find((s) => s.id === studentId);
  const examById = useMemo(() => new Map(data.exams.map((e) => [e.id, e])), [data.exams]);

  const studentResults = useMemo(
    () => data.results.filter((r) => r.studentId === studentId).sort((a, b) => a.date.localeCompare(b.date)),
    [data.results, studentId]
  );

  useEffect(() => {
    setFromDate('');
    setToDate('');
    setRangeMode('all');
    setSelectedIds(new Set(studentResults.map((r) => r.id)));
  }, [studentId, studentResults.length]);

  useEffect(() => {
    setSession(EMPTY_SESSION);
    setSummaryTouched(false);
  }, [studentId]);

  const applyRange = (from: string, to: string) => {
    setFromDate(from);
    setToDate(to);
    const inRange = studentResults.filter((r) => (!from || r.date >= from) && (!to || r.date <= to));
    setSelectedIds(new Set(inRange.map((r) => r.id)));
  };

  /** 오늘에서 몇 달 뒤로 물러난 날. 'YYYY-MM-DD' 로 돌려준다. */
  const monthsAgo = (n: number) => {
    const d = new Date();
    d.setMonth(d.getMonth() - n);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  // 기간은 거의 늘 '전체' 아니면 '최근 몇 개월' 이다. 단추 하나로 끝내고,
  // 날짜를 꼭 짚어야 할 때만 [직접 고르기] 로 두 칸을 펼친다.
  const PRESETS: { key: RangeMode; label: string; run: () => void }[] = [
    { key: 'all', label: '전체', run: () => applyRange('', '') },
    { key: 'm3', label: '최근 3개월', run: () => applyRange(monthsAgo(3), todayStr()) },
    { key: 'm6', label: '최근 6개월', run: () => applyRange(monthsAgo(6), todayStr()) },
    { key: 'year', label: '올해', run: () => applyRange(`${new Date().getFullYear()}-01-01`, todayStr()) },
  ];

  const selectedResults = useMemo(
    () => studentResults.filter((r) => selectedIds.has(r.id)),
    [studentResults, selectedIds]
  );
  const stats: TypeStat[] = useMemo(
    () => (studentId ? statsCumulative(data.exams, selectedResults) : []),
    [studentId, data.exams, selectedResults]
  );
  const total = scoreOf(selectedResults.flatMap((r) => r.marks));
  // 난이도를 적어 둔 시험지에서만 나온다. 기초가 무너진 것인지 응용에서만 멈추는지 갈린다.
  const levels = useMemo(
    () => (studentId ? statsCumulative(data.exams, selectedResults, 'level') : []),
    [studentId, data.exams, selectedResults]
  );

  // 선생님이 손대기 전까지는 자동 문안을 따라간다.
  // 예상 등급 기준은 학원이 정한 고정값이다. 화면에서 고치지 않는다.
  const grade = gradeFromLevels(levels);
  const scaled = scaledScore(levels);
  // 리포트 머리에는 '몇 개가 모자라는가'가 아니라 '몇 개가 자리 잡았는가'를 적는다.
  // 같은 사실이라도 학부모가 먼저 읽는 숫자는 딛고 설 곳이어야 한다.
  const steady = stats.filter((s) => s.rate >= STEADY).length;

  const draftSummary = useMemo(() => autoSummary(stats, total.correct, total.total), [stats, total.correct, total.total]);
  const summary = summaryTouched ? session.summary : draftSummary;

  const set = (patch: Partial<SessionFields>) => setSession((s) => ({ ...s, ...patch }));

  const toggle = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const today = todayStr();
  const lastExam = selectedResults.length ? examById.get(selectedResults[selectedResults.length - 1].examId) : undefined;
  const lastDate = selectedResults.length ? selectedResults[selectedResults.length - 1].date : '';
  const questionCount = selectedResults.reduce((a, r) => a + r.marks.length, 0);

  /*
   * 1쪽이 A4를 넘으면 응시 이력과 의견을 통째로 다음 쪽으로 보낸다.
   *
   * 나뉘고 나면 1쪽은 분석 전용이 되어 레이더가 커지고 막대가 붙는다.
   * 그 상태를 그대로 재면 합쳤을 때 들어가는지 알 수 없으므로,
   * 유형 섹션을 좁은 배치였을 때의 높이로 되돌려 놓고 잰다.
   * 그래서 이 값은 지금 나뉘어 있는지와 무관하고, 나눔과 합침을 오가지 않는다.
   */
  useLayoutEffect(() => {
    const page = page1Ref.current;
    const sec = analysisRef.current;
    const moved = movedRef.current;
    const svg = sec?.querySelector('svg');
    if (!page || !sec || !moved || !svg) return;

    const H = (el: Element) => el.getBoundingClientRect().height;
    const cs = getComputedStyle(page);
    const gap = parseFloat(cs.rowGap) || 0;

    const box = svg.viewBox.baseVal;
    const narrowRadarH = (parseFloat(cs.getPropertyValue('--radar-w')) * box.height) / box.width;
    const bars = sec.querySelector('.type-bars');
    const secGap = parseFloat(getComputedStyle(sec).rowGap) || 0;
    const narrowSecH = H(sec) - H(svg) + narrowRadarH - (bars ? H(bars) + secGap : 0);

    const stable = [...page.children]
      .filter((el) => el !== sec && el !== moved)
      .reduce((a, el) => a + H(el), 0);

    // 좁은 배치의 1쪽은 여섯 칸이다. 레터헤드·제목·학생·유형·이동그룹·푸터. 사이는 다섯 칸.
    const whole =
      stable + narrowSecH + H(moved) + gap * 5 + parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    setSplitNotes(whole > PAGE_H);
  }, [splitNotes, summary, session.note, selectedResults, stats, levels, student]);

  const downloadPdf = async () => {
    if (!page1Ref.current || !student) return;
    setBusy(true);
    try {
      const { jsPDF } = await import('jspdf');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      // 쪽 가장자리 여백. 이 안쪽은 전부 리포트 그림이고, 그림에도 제 여백이
      // 있어 글자는 종이 끝에서 13mm 쯤부터 시작한다. 그래서 여기는 좁게 잡아도
      // 인쇄에서 글자가 잘리지 않는다.
      const MARGIN = 6;
      const contentW = pageW - MARGIN * 2;
      const contentH = pageH - MARGIN * 2;

      const addCapture = async (el: HTMLElement, startNewPage: boolean) => {
        const url = await toJpeg(el, { backgroundColor: '#ffffff', quality: 0.92, pixelRatio: 2, cacheBust: true });
        const props = pdf.getImageProperties(url);
        const imgH = (props.height * contentW) / props.width;
        const nPages = Math.max(1, Math.ceil((imgH - 0.5) / contentH));
        for (let k = 0; k < nPages; k++) {
          if (startNewPage || k > 0) pdf.addPage();
          pdf.addImage(url, 'JPEG', MARGIN, MARGIN - k * contentH, contentW, imgH);
          pdf.setFillColor(255, 255, 255);
          pdf.rect(0, 0, pageW, MARGIN, 'F');
          pdf.rect(0, pageH - MARGIN, pageW, MARGIN, 'F');
        }
      };

      await addCapture(page1Ref.current, false);
      if (notesPageRef.current) await addCapture(notesPageRef.current, true);
      if (page2Ref.current) await addCapture(page2Ref.current, true);
      pdf.save(`리포트_${student.name}_${today}.pdf`);
    } catch (e) {
      console.error(e);
      notify('PDF 저장', 'PDF 저장에 실패했습니다. 다시 시도해 주세요.');
    } finally {
      setBusy(false);
    }
  };

  const Letterhead = ({ title, page }: { title?: string; page: string }) => (
    <div className="report-letterhead">
      {logoUrl ? <img src={logoUrl} className="report-lh-logo" alt="" /> : null}
      <div className="report-lh-text">
        <div className="report-lh-org">알파학원 교육연구소</div>
        {title && <div className="report-lh-title">{title}</div>}
      </div>
      <span style={{ flexGrow: 1 }} />
      <span className="report-footer-date">발행일 {today}</span>
      <span className="report-footer-date">{page}</span>
    </div>
  );

  const PlainFooter = () => (
    <div className="report-footer">
      <div className="report-footer-left">
        <div className="report-footer-org">알파학원 교육연구소</div>
        <div className="report-footer-en">ALPHA ACADEMY · Education Research Institute</div>
      </div>
    </div>
  );

  // 1쪽에 그대로 두거나, 자리가 없으면 통째로 다음 쪽으로 옮긴다.
  const movableBlocks = (
    <div ref={movedRef} className="rp-movable">
      <section className="report-sec">
        <span className="report-sec-h">응시 이력</span>
        <table className="report-info-table rp-history">
          <thead>
            <tr>
              <th>시험지</th>
              <th style={{ width: 120 }}>응시일</th>
              <th style={{ width: 150 }}>점수</th>
            </tr>
          </thead>
          <tbody>
            {selectedResults.map((r) => {
              const ex = examById.get(r.examId);
              const sc = scoreOf(r.marks);
              return (
                <tr key={r.id}>
                  <td>{ex?.title ?? '—'}</td>
                  <td>{r.date}</td>
                  <td>
                    {Math.round(sc.rate * 100)}점 · {sc.correct}/{sc.total}문항
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {summary.trim() && (
        <section className="report-sec">
          <span className="report-sec-h">종합 의견</span>
          <p className="report-note-body">{summary}</p>
        </section>
      )}
      {session.note.trim() && (
        <section className="report-sec">
          <span className="report-sec-h">선생님 의견</span>
          <p className="report-note-body rp-note-3">{session.note}</p>
        </section>
      )}
    </div>
  );

  return (
    <div className="assess-pane">
      <div className="screen-head no-print">
        <div className="assess-row">
          <button className="mini ghost" onClick={onBack}>
            ← 학생
          </button>
          {/* '학생' 이라는 라벨은 옆의 [← 학생] 단추와 겹치는 말이라 뺀다.
              라벨이 없어지면 단추와 높이도 저절로 맞는다. */}
          <Select
            label="학생"
            value={studentId}
            onChange={setStudentId}
            placeholder="학생 고르기"
            options={data.students.map((s) => ({ value: s.id, label: s.name, note: s.grade }))}
          />
        </div>
        {student && selectedResults.length > 0 && (
          <button className="primary" onClick={downloadPdf} disabled={busy}>
            {busy ? '저장 중…' : `📄 PDF 저장 (${pageCount}쪽)`}
          </button>
        )}
      </div>

      {!studentId ? (
        <p className="muted">위에서 학생을 고르면 리포트가 나옵니다.</p>
      ) : studentResults.length === 0 ? (
        <p className="muted">이 학생의 채점 결과가 없습니다. [채점]에서 먼저 채점하세요.</p>
      ) : (
        <>
          <div className="assess-card no-print">
            <div className="report-pick-head">
              <h3 style={{ margin: 0 }}>리포트에 포함할 시험</h3>
              {/* 개수는 제목 옆에 둔다. 버튼 옆에 붙이면 버튼 이름처럼 읽힌다. */}
              <span className="hint">
                {selectedResults.length}/{studentResults.length}개 선택
              </span>
              <span className="report-pick-actions">
                <button className="mini ghost" onClick={() => applyRange('', '')}>
                  전체 선택
                </button>
                <button className="mini ghost" onClick={() => setSelectedIds(new Set())}>
                  전체 해제
                </button>
              </span>
            </div>
            <div className="report-range">
              <span className="report-range-label">기간</span>
              {PRESETS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  className={`chip ${rangeMode === p.key ? 'on' : ''}`}
                  onClick={() => {
                    setRangeMode(p.key);
                    p.run();
                  }}
                >
                  {p.label}
                </button>
              ))}
              <button
                type="button"
                className={`chip ${rangeMode === 'custom' ? 'on' : ''}`}
                onClick={() => setRangeMode('custom')}
              >
                직접 고르기
              </button>
            </div>
            {rangeMode === 'custom' && (
              <div className="report-range-pick">
                <DatePicker label="시작일" value={fromDate} onChange={(v) => applyRange(v, toDate)} />
                <span>~</span>
                <DatePicker label="종료일" value={toDate} onChange={(v) => applyRange(fromDate, v)} />
              </div>
            )}
            <div className="report-exam-list">
              {studentResults.map((r) => {
                const ex = examById.get(r.examId);
                const sc = scoreOf(r.marks);
                return (
                  <label key={r.id} className={`report-exam-item ${selectedIds.has(r.id) ? 'on' : ''}`}>
                    <input type="checkbox" checked={selectedIds.has(r.id)} onChange={() => toggle(r.id)} />
                    <span className="report-exam-name">{ex?.title ?? '시험'}</span>
                    <span className="hint">
                      {r.date} · {Math.round(sc.rate * 100)}점 ({sc.correct}/{sc.total}문항)
                    </span>
                  </label>
                );
              })}
            </div>
          </div>


          <div className="assess-card no-print report-note-edit">
            <h3>인쇄 전 입력</h3>
            <p className="hint" style={{ marginBottom: 12 }}>
              여기에 적은 내용이 아래 미리보기와 PDF에 그대로 들어갑니다. 학생 정보·목표 고등학교·진도는 [학생]
              화면에 적어둔 값이 그대로 들어갑니다. 이 칸들은 저장되지 않는 임시 입력이라 학생을 바꾸면 비워집니다.
            </p>

            {/* 칸마다 테두리를 둘러 카드로 만든다. 한 줄에 놓이는 두 카드는 높이를
                같이 맞추고 글 상자가 남는 자리를 채운다. 그렇지 않으면 rows 가 다른
                상자끼리 아래가 들쭉날쭉해진다. */}
            <div className="edit-grid">
              <label className="fld wide">
                <span className="fld-head">
                  종합 의견
                  <em>자동 생성 · 고쳐 쓸 수 있습니다</em>
                  <i>
                    {summary.length}/{SUMMARY_MAX}자
                  </i>
                </span>
                <textarea
                  className="report-note-input"
                  rows={3}
                  maxLength={SUMMARY_MAX}
                  value={summary}
                  onChange={(e) => {
                    setSummaryTouched(true);
                    set({ summary: e.target.value });
                  }}
                />
                {summaryTouched && (
                  <button
                    className="mini ghost"
                    style={{ alignSelf: 'flex-start' }}
                    onClick={() => {
                      setSummaryTouched(false);
                      set({ summary: '' });
                    }}
                  >
                    자동 문안으로 되돌리기
                  </button>
                )}
              </label>

              <label className="fld">
                <span className="fld-head">
                  선생님 의견
                  <em>비워두면 인쇄에서 빠집니다 · 3줄까지 인쇄</em>
                  <i>
                    {session.note.length}/{NOTE_MAX}자
                  </i>
                </span>
                <textarea
                  className="report-note-input"
                  rows={4}
                  maxLength={NOTE_MAX}
                  placeholder="상담 내용이나 추천 수업을 적으세요."
                  value={session.note}
                  onChange={(e) => set({ note: e.target.value })}
                />
              </label>

              <label className="fld">
                <span className="fld-head">
                  상담 메모 · 특이사항
                  <em>2쪽에 인쇄</em>
                  <i>
                    {session.memo.length}/{MEMO_MAX}자
                  </i>
                </span>
                <textarea
                  className="report-note-input"
                  rows={4}
                  maxLength={MEMO_MAX}
                  placeholder="비워두면 빈칸으로 인쇄되어 손으로 적을 수 있습니다."
                  value={session.memo}
                  onChange={(e) => set({ memo: e.target.value })}
                />
              </label>

              <div className="fld wide">
                <span className="fld-head">
                  상담일과 서명란
                  <em>2쪽과 마지막 쪽에 인쇄</em>
                </span>
                <div className="fld-row">
                  <label className="assess-field">
                    상담일
                    {/* 상담일과 동의서 작성일은 같은 날이라 한 칸만 받아 두 곳에 쓴다. */}
                    <DatePicker
                      label="상담일"
                      value={session.consultDate}
                      onChange={(v) => set({ consultDate: v })}
                    />
                  </label>
                  <label className="assess-field">
                    성명
                    <input
                      type="text"
                      placeholder="비워두면 빈칸"
                      value={session.signName}
                      onChange={(e) => set({ signName: e.target.value })}
                    />
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div className="print-preview">
            {/* ── 1쪽 ── */}
            <div ref={page1Ref} className={`report-capture${splitNotes ? ' rp-wide' : ''}`}>
              <Letterhead page={`1 / ${pageCount}`} />

              <div className="rp-title-row">
                <h1 className="rp-title">진단평가 결과 리포트</h1>
                <div className="rp-title-meta">
                  <div>{lastExam?.title ?? '진단평가'}</div>
                  <div>
                    {lastDate} 응시 · {questionCount}문항
                  </div>
                </div>
              </div>

              <div className="rp-id-row">
                {/* 네 칸 모두 [라벨 · 큰 값 · 작은 값] 세 줄이다. 줄 높이를 못 박고
                    큰 값을 가운데 줄의 바닥에 붙여, 글자 크기가 달라도 한 선에 서게 한다. */}
                <div className="rp-id">
                  <span className="rp-cap">학생</span>
                  <div className="rp-val">
                    <b>{student?.name}</b>
                  </div>
                  <em className="rp-sub">{student?.school || ''}</em>
                </div>
                <div className="rp-year">
                  <span className="rp-cap">학년</span>
                  <div className="rp-val">
                    <b>{student?.grade}</b>
                  </div>
                  <em className="rp-sub" />
                </div>
                <div className="rp-score">
                  <span className="rp-cap">{selectedResults.length > 1 ? '평균 점수' : '점수'}</span>
                  <div className="rp-val">
                    <b>{Math.round(total.rate * 100)}</b>
                    <em>/ 100점</em>
                  </div>
                  {/* 여러 번 응시했으면 몇 회를 합친 평균인지 밝힌다. */}
                  <em className="rp-sub">
                    {selectedResults.length > 1 ? `${selectedResults.length}회 평균 · ` : ''}
                    {total.correct} / {total.total}문항
                  </em>
                </div>
                {stats.length > 0 && (
                  <div className="rp-grade">
                    <span className="rp-cap">강점 유형</span>
                    <div className="rp-val">
                      <b>{steady}</b>
                    </div>
                    <em className="rp-sub">/ {stats.length}개</em>
                  </div>
                )}
                {grade !== null && (
                  <div className="rp-grade">
                    <span className="rp-cap">예상 고교 등급</span>
                    <div className="rp-val">
                      <b>{grade}</b>
                    </div>
                    {/* 등급을 매긴 값이 무엇인지 함께 적는다. */}
                    <em className="rp-sub">환산 {scaled === null ? '—' : Math.round(scaled)}점</em>
                  </div>
                )}
              </div>

              <section ref={analysisRef} className="report-sec">
                <div className="rp-sec-row">
                  <span className="report-sec-h">유형별 성취</span>
                  {/* 난이도별 정답률은 여기 적지 않는다. 예상 고교 등급이 이미
                      난이도로 매긴 값이라 같은 것을 두 번 보여주게 된다. */}
                </div>
                {/* 막대를 옆에 세우면 레이더가 작아져 여덟 유형의 균형이 안 보인다.
                    쪽이 나뉘어 1쪽이 분석 전용이 될 때만 레이더를 키우고 막대를 아래에 붙인다. */}
                <div className="rp-radar-only">
                  <TypeRadar stats={stats} />
                </div>
                {splitNotes && <TypeBars stats={stats} />}
              </section>


              {!splitNotes && movableBlocks}

              <div className="report-footer">
                <div className="report-footer-left">
                  <div className="report-footer-org">알파학원 교육연구소</div>
                  <div className="report-footer-en">ALPHA ACADEMY · Education Research Institute</div>
                </div>
                <div className="report-footer-seal">
                  {sealUrl ? <img src={sealUrl} className="report-seal-img" alt="" /> : <SealStamp />}
                </div>
              </div>
            </div>

            {/* ── 기록·의견 쪽 (1쪽에 다 안 들어갈 때만) ── */}
            {splitNotes && (
              <div ref={notesPageRef} className="report-capture">
                <Letterhead title="응시 이력 · 의견" page={`2 / ${pageCount}`} />
                {movableBlocks}
                <PlainFooter />
              </div>
            )}

            {/* ── 마지막 쪽: 상담 카드 ── */}
            <div ref={page2Ref} className="report-capture">
              <Letterhead title="상담 카드 · 추가 정보" page={`${pageCount} / ${pageCount}`} />

              <section className="report-sec">
                <span className="report-sec-h">학생 정보</span>
                <div className="rp-fields">
                  <div>
                    <span>학생 성명</span>
                    <div className="rp-line">{student?.name}</div>
                  </div>
                  <div>
                    <span>학교 / 학년</span>
                    <div className="rp-line">{[student?.school, student?.grade].filter(Boolean).join(' / ')}</div>
                  </div>
                  <div>
                    <span>학생 연락처</span>
                    <div className="rp-line">{student?.contact ?? ''}</div>
                  </div>
                  <div>
                    <span>학부모 연락처</span>
                    <div className="rp-line">{student?.parentContact ?? ''}</div>
                  </div>
                  <div>
                    <span>형제 재원 여부</span>
                    <div className="rp-line rp-line-checks">
                      <span>{student?.sibling === '없음' ? '☑' : '☐'} 없음</span>
                      <span>{student?.sibling === '있음' ? '☑' : '☐'} 있음</span>
                    </div>
                  </div>
                  <div>
                    <span>상담일</span>
                    <div className="rp-line">{session.consultDate || <DateBlank />}</div>
                  </div>
                </div>
              </section>

              <section className="report-sec">
                <span className="report-sec-h">
                  목표 고등학교 <span className="rp-muted">(복수 선택 가능)</span>
                </span>
                <div className="rp-checks">
                  {TARGET_SCHOOLS.map((t) => (
                    <span key={t} className="rp-check">
                      {(student?.targetSchools ?? []).includes(t) ? '☑' : '☐'} {t}
                    </span>
                  ))}
                </div>
              </section>

              <section className="report-sec">
                <span className="report-sec-h">현재 진도 · 학습 내용</span>
                <table className="report-info-table">
                  <thead>
                    <tr>
                      <th style={{ width: 68 }}>과목</th>
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
                      <td className="rp-blank">{student?.mathProgress ?? ''}</td>
                      <td className="rp-blank">{student?.mathBooks ?? ''}</td>
                    </tr>
                    <tr>
                      <th>과학</th>
                      <td className="rp-blank">{student?.sciProgress ?? ''}</td>
                      <td className="rp-blank">{student?.sciBooks ?? ''}</td>
                    </tr>
                  </tbody>
                </table>
              </section>

              <section className="report-sec">
                <span className="report-sec-h">상담 메모 · 특이사항</span>
                <div className="rp-memo-box">{session.memo}</div>
              </section>

              <section className="report-sec">
                <span className="report-sec-h">개인정보 수집 · 이용 동의서</span>
                <ol className="rp-privacy">
                  <li>
                    <b>수집·이용 목적</b> : 학원 수강 상담, 학습 정보 제공, 공지사항 및 소식지 전달
                  </li>
                  <li>
                    <b>수집 항목</b> : 학생 성명, 학교/학년, 학생·학부모 휴대폰 번호, 성적 정보, 목표(희망) 고등학교, 형제
                    재원 여부, 학습 이력(진도·교재)
                  </li>
                  <li>
                    <b>보유·이용 기간</b> : 수집된 개인정보는 학원 등록 후 재원 기간 동안 보유하며 관계 법령에 따라 보존이
                    필요한 경우 해당 기간 동안 별도 보관합니다. 개인정보 제공자가 동의한 내용 외에 다른 목적으로 활용하지
                    않으며, 제공된 개인정보의 이용을 거부하고자 할 때에는 개인정보처리책임자를 통해 열람·정정·삭제를 요구할
                    수 있습니다.
                  </li>
                </ol>
                <p className="rp-agree">
                  「개인정보 보호법」 등 관련 법규에 의거하여, 상기 본인은 위와 같이 개인정보 수집 및 이용에 동의합니다.
                </p>
                <div className="rp-sign">
                  <div>
                    <span>작성일</span>
                    <div className="rp-line">{session.consultDate || <DateBlank />}</div>
                  </div>
                  <div style={{ flexGrow: 1 }}>
                    <span>성명 (서명/인)</span>
                    <div className="rp-line">{session.signName}</div>
                  </div>
                  <b>알파학원 귀하</b>
                </div>
              </section>

              <div className="report-footer">
                <div className="report-footer-left">
                  <div className="report-footer-org">알파학원 교육연구소</div>
                  <div className="report-footer-en">ALPHA ACADEMY · Education Research Institute</div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
