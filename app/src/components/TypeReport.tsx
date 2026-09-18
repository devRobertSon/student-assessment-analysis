import { useEffect, useMemo, useRef, useState } from 'react';
import { toJpeg } from 'html-to-image';
import {
  AssessmentData,
  TARGET_SCHOOLS,
  TypeStat,
  scoreOf,
  todayStr,
  typeStatsCumulative,
} from '../lib/assessment';
import { logoUrl, sealUrl } from '../lib/brand';
import TypeRadar from './TypeRadar';
import TypeBars from './TypeBars';

const SUMMARY_MAX = 130;
const NOTE_MAX = 170;
const MEMO_MAX = 200;

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
function autoSummary(stats: TypeStat[], correct: number, total: number): string {
  if (stats.length === 0 || total === 0) return '';
  const name = (list: TypeStat[]) => list.slice(0, 3).map((s) => s.type).join(', ');
  const weak = stats.filter((s) => s.rate < 0.5);
  const strong = stats.filter((s) => s.rate >= 0.8);
  const wrong = total - correct;
  const weakWrong = weak.reduce((a, s) => a + (s.total - s.correct), 0);

  const parts: string[] = [];
  if (weak.length > 0) {
    parts.push(`${name(weak)} 유형에서 실점이 집중되었습니다.`);
    if (wrong > 0 && weakWrong > 0) parts.push(`오답 ${wrong}문항 중 ${weakWrong}문항이 여기에서 나왔습니다.`);
  } else {
    parts.push('특별히 약한 유형 없이 고르게 맞혔습니다.');
  }
  if (strong.length > 0) parts.push(`${name(strong)}은(는) 안정적입니다.`);
  const text = parts.join(' ');
  return text.length > SUMMARY_MAX ? text.slice(0, SUMMARY_MAX - 1) + '…' : text;
}

interface Props {
  data: AssessmentData;
  studentId: string;
  setStudentId: (id: string) => void;
  onBack: () => void;
}

// 인쇄물에만 쓰이고 저장하지 않는 입력들
interface SessionFields {
  summary: string;
  note: string;
  consultDate: string;
  memo: string;
  signDate: string;
  signName: string;
}
const EMPTY_SESSION: SessionFields = { summary: '', note: '', consultDate: '', memo: '', signDate: '', signName: '' };

export default function TypeReport({ data, studentId, setStudentId, onBack }: Props) {
  const [session, setSession] = useState<SessionFields>(EMPTY_SESSION);
  const [summaryTouched, setSummaryTouched] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [busy, setBusy] = useState(false);
  const page1Ref = useRef<HTMLDivElement>(null);
  const page2Ref = useRef<HTMLDivElement>(null);

  const student = data.students.find((s) => s.id === studentId);
  const examById = useMemo(() => new Map(data.exams.map((e) => [e.id, e])), [data.exams]);

  const studentResults = useMemo(
    () => data.results.filter((r) => r.studentId === studentId).sort((a, b) => a.date.localeCompare(b.date)),
    [data.results, studentId]
  );

  useEffect(() => {
    setFromDate('');
    setToDate('');
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

  const selectedResults = useMemo(
    () => studentResults.filter((r) => selectedIds.has(r.id)),
    [studentResults, selectedIds]
  );
  const stats: TypeStat[] = useMemo(
    () => (studentId ? typeStatsCumulative(data.exams, selectedResults) : []),
    [studentId, data.exams, selectedResults]
  );
  const total = scoreOf(selectedResults.flatMap((r) => r.marks));

  // 선생님이 손대기 전까지는 자동 문안을 따라간다.
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

  const downloadPdf = async () => {
    if (!page1Ref.current || !student) return;
    setBusy(true);
    try {
      const { jsPDF } = await import('jspdf');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const MARGIN = 12;
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
      if (page2Ref.current) await addCapture(page2Ref.current, true);
      pdf.save(`리포트_${student.name}_${today}.pdf`);
    } catch (e) {
      console.error(e);
      alert('PDF 저장에 실패했습니다. 다시 시도해 주세요.');
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

  return (
    <div className="assess-pane">
      <div className="screen-head no-print">
        <div className="assess-row">
          <button className="mini ghost" onClick={onBack}>
            ← 학생
          </button>
          <label className="assess-field">
            학생
            <select value={studentId} onChange={(e) => setStudentId(e.target.value)}>
              <option value="">선택</option>
              {data.students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.grade})
                </option>
              ))}
            </select>
          </label>
        </div>
        {student && selectedResults.length > 0 && (
          <button className="primary" onClick={downloadPdf} disabled={busy}>
            {busy ? '저장 중…' : '📄 PDF 저장 (2쪽)'}
          </button>
        )}
      </div>

      {!studentId ? (
        <p className="muted">학생을 선택하면 리포트가 표시됩니다.</p>
      ) : studentResults.length === 0 ? (
        <p className="muted">이 학생의 채점 결과가 없습니다. [채점]에서 먼저 채점하세요.</p>
      ) : (
        <>
          <div className="assess-card no-print">
            <div className="report-pick-head">
              <h3 style={{ margin: 0 }}>리포트에 포함할 시험</h3>
              <span className="report-pick-actions">
                <button className="mini ghost" onClick={() => applyRange('', '')}>
                  전체 선택
                </button>
                <button className="mini ghost" onClick={() => setSelectedIds(new Set())}>
                  전체 해제
                </button>
                <span className="hint">
                  {selectedResults.length}/{studentResults.length}개 선택
                </span>
              </span>
            </div>
            <div className="report-range">
              <span className="report-range-label">기간으로 선택</span>
              <input type="date" value={fromDate} onChange={(e) => applyRange(e.target.value, toDate)} aria-label="시작일" />
              <span>~</span>
              <input type="date" value={toDate} onChange={(e) => applyRange(fromDate, e.target.value)} aria-label="종료일" />
            </div>
            <div className="report-exam-list">
              {studentResults.map((r) => {
                const ex = examById.get(r.examId);
                const sc = scoreOf(r.marks);
                return (
                  <label key={r.id} className={`report-exam-item ${selectedIds.has(r.id) ? 'on' : ''}`}>
                    <input type="checkbox" checked={selectedIds.has(r.id)} onChange={() => toggle(r.id)} />
                    <span className="report-exam-name">{ex?.title ?? '시험'}</span>
                    <span className="hint">
                      {r.date} · {sc.correct}/{sc.total} ({Math.round(sc.rate * 100)}%)
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="assess-card no-print report-note-edit">
            <h3>인쇄 전 입력</h3>
            <p className="hint" style={{ marginBottom: 12 }}>
              여기에 적은 내용이 아래 미리보기와 PDF에 그대로 들어갑니다. (저장되지 않는 임시 입력 — 학생을 바꾸면 비워집니다)
            </p>

            <div className="edit-grid">
              <label className="fld">
                <span>
                  종합 의견 <span className="hint">자동 생성 · 고쳐 쓸 수 있습니다 · {summary.length}/{SUMMARY_MAX}자</span>
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
                <span>
                  선생님 의견 <span className="hint">비워두면 인쇄에서 빠집니다 · {session.note.length}/{NOTE_MAX}자</span>
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
                <span>
                  상담 메모 · 특이사항 <span className="hint">2쪽 · {session.memo.length}/{MEMO_MAX}자</span>
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

              <div className="fld">
                <span>2쪽 · 상담일과 서명란</span>
                <div className="assess-row wrap">
                  <label className="assess-field">
                    상담일
                    <input type="text" placeholder={today} value={session.consultDate} onChange={(e) => set({ consultDate: e.target.value })} />
                  </label>
                  <label className="assess-field">
                    동의서 작성일
                    <input type="text" placeholder={today} value={session.signDate} onChange={(e) => set({ signDate: e.target.value })} />
                  </label>
                  <label className="assess-field">
                    성명
                    <input type="text" placeholder="비워두면 빈칸" value={session.signName} onChange={(e) => set({ signName: e.target.value })} />
                  </label>
                </div>
                <p className="hint">학생 정보·목표 고등학교·진도는 [학생] 화면에 적어둔 값이 그대로 들어갑니다.</p>
              </div>
            </div>
          </div>

          <div className="print-preview">
            {/* ── 1쪽 ── */}
            <div ref={page1Ref} className="report-capture">
              <Letterhead page="1 / 2" />

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
                <div className="rp-id">
                  <div>
                    <span>학생</span>
                    <b>{student?.name}</b>
                  </div>
                  <div>
                    <span>학년</span>
                    <b>{student?.grade}</b>
                  </div>
                  {student?.school && (
                    <div>
                      <span>학교</span>
                      <b>{student.school}</b>
                    </div>
                  )}
                </div>
                <div className="rp-score">
                  <span>전체 정답률</span>
                  <div>
                    <b>{Math.round(total.rate * 100)}</b>
                    <em>
                      % · {total.correct}/{total.total}
                    </em>
                  </div>
                </div>
              </div>

              <section className="report-sec">
                <div className="rp-sec-row">
                  <span className="report-sec-h">유형별 강점과 약점</span>
                  <span className="hint">정답률이 낮은 유형부터</span>
                </div>
                <div className="type-bars-wrap">
                  <div className="type-radar-wrap">
                    <TypeRadar stats={stats} />
                  </div>
                  <TypeBars stats={stats} />
                </div>
              </section>

              <section className="report-sec">
                <span className="report-sec-h">응시 이력</span>
                <table className="report-info-table">
                  <thead>
                    <tr>
                      <th>시험지</th>
                      <th style={{ width: 120 }}>응시일</th>
                      <th style={{ width: 150 }}>정답률</th>
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
                            {sc.correct}/{sc.total} · {Math.round(sc.rate * 100)}%
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
                  <p className="report-note-body">{session.note}</p>
                </section>
              )}

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

            {/* ── 2쪽 ── */}
            <div ref={page2Ref} className="report-capture">
              <Letterhead title="상담 카드 · 추가 정보" page="2 / 2" />

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
                    <div className="rp-line">{session.consultDate || '20        년        월        일'}</div>
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
                    <div className="rp-line">{session.signDate || '20        년        월        일'}</div>
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
