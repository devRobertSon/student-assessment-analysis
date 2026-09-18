import { useEffect, useMemo, useRef, useState } from 'react';
import { toJpeg } from 'html-to-image';
import { AssessmentData, TypeStat, scoreOf, todayStr, typeStatsCumulative } from '../lib/assessment';
import { logoUrl, sealUrl } from '../lib/brand';

// 리포트 뒤 상담 카드에 넣을 목표 고등학교 선택지
const TARGET_SCHOOLS = ['영재학교', '과학고', '외고', '국제고', '전사고', '의대 준비'];

// 자동 생성 직인(도장) — assets/brand/seal.* 이미지가 없을 때 사용.
// 일반 회사·연구소 원형 직인 형태: 기관명이 원을 따라 곡선으로 둘러싸고,
// 좌우 구분 마름모, 중앙 별, 하단 짧은 라벨.
const SEAL_RED = '#C0392B';
// 사각 직인(전각 인장) — 기관명 9자를 3×3 격자로, 이중 사각 테두리.
const SEAL_ROWS = [
  ['알', '파', '학'],
  ['원', '교', '육'],
  ['연', '구', '소'],
];
const SEAL_CELL = [32, 66, 100];
function SealStamp() {
  return (
    <svg viewBox="0 0 132 132" className="report-seal-svg" role="img" aria-label="알파학원 교육연구소 직인">
      {/* 이중 사각 테두리 */}
      <rect x="6" y="6" width="120" height="120" rx="7" fill="rgba(192,57,43,0.05)" stroke={SEAL_RED} strokeWidth="5" />
      <rect x="15" y="15" width="102" height="102" rx="3" fill="none" stroke={SEAL_RED} strokeWidth="1.3" />
      {/* 기관명 3×3 격자(좌→우, 위→아래) */}
      {SEAL_ROWS.map((row, r) =>
        row.map((ch, c) => (
          <text
            key={`${r}-${c}`}
            x={SEAL_CELL[c]}
            y={SEAL_CELL[r] + 10}
            textAnchor="middle"
            fontSize="27"
            fontWeight="800"
            fill={SEAL_RED}
          >
            {ch}
          </text>
        ))
      )}
    </svg>
  );
}

interface Props {
  data: AssessmentData;
}

// 이 문제 수 이상인 유형만 차트(막대·레이더)에 표시. 그 미만은 아래 비고 표로.
// 1로 두면 문항이 1개인 유형도 모두 차트에 포함(비고 표는 사실상 생략).
const MIN_CHART_TOTAL = 1;

function rateColor(rate: number): string {
  if (rate >= 0.8) return '#2C79D0';
  if (rate >= 0.5) return '#E3A72E';
  return '#D6443B';
}

function MinorNote({ stats }: { stats: TypeStat[] }) {
  if (stats.length === 0) return null;
  return (
    <div className="type-minor">
      <div className="type-minor-head">
        참고 · 문제 수가 적은 유형 (각 {MIN_CHART_TOTAL}문제 미만이라 차트에서 제외)
      </div>
      <table className="type-minor-table">
        <thead>
          <tr><th>유형</th><th>정답률</th><th>문항</th></tr>
        </thead>
        <tbody>
          {stats.map((s) => (
            <tr key={s.type}>
              <td>{s.type}</td>
              <td style={{ color: rateColor(s.rate), fontWeight: 700 }}>{Math.round(s.rate * 100)}%</td>
              <td className="muted">{s.correct}/{s.total}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TypeBars({ stats }: { stats: TypeStat[] }) {
  if (stats.length === 0) return <p className="muted">표시할 데이터가 없습니다.</p>;
  return (
    <div className="type-bars">
      {stats.map((s) => (
        <div key={s.type} className="type-bar-row">
          <div className="type-bar-label" title={s.type}>{s.type}</div>
          <div className="type-bar-track">
            <div className="type-bar-fill" style={{ width: `${Math.round(s.rate * 100)}%`, background: rateColor(s.rate) }} />
          </div>
          <div className="type-bar-val">
            {Math.round(s.rate * 100)}% <span className="muted">({s.correct}/{s.total})</span>
          </div>
        </div>
      ))}
    </div>
  );
}

const RADAR_W = 480;
const RADAR_H = 390;
const RADAR_R = 128;

function TypeRadar({ stats }: { stats: TypeStat[] }) {
  if (stats.length < 3) {
    return <p className="muted">레이더 차트는 유형이 3개 이상일 때 표시됩니다.</p>;
  }
  const cx = RADAR_W / 2;
  const cy = RADAR_H / 2 + 8;
  const n = stats.length;
  // 각 유형이 차지하는 각도(부채꼴)를 문제 수에 비례하게 — 단, 균등 배치와
  // 섞어(BLEND) 한 유형이 각을 독차지해 도형이 지나치게 찌그러지는 것을 방지.
  const totalQ = stats.reduce((sum, s) => sum + s.total, 0) || 1;
  const BLEND = 0.5; // 0=완전 균등, 1=문제 수 완전 비례
  const share = stats.map((s) => (1 - BLEND) / n + BLEND * (s.total / totalQ));
  // 각 유형의 스포크(축)를 자기 부채꼴의 중앙에 배치
  let acc = 0;
  const centerFrac = stats.map((_, i) => {
    const c = acc + share[i] / 2;
    acc += share[i];
    return c;
  });
  const angleOf = (i: number) => -Math.PI / 2 + 2 * Math.PI * centerFrac[i];
  const ptOf = (i: number, r: number): [number, number] => [
    cx + r * Math.cos(angleOf(i)),
    cy + r * Math.sin(angleOf(i)),
  ];
  const dataPoly = stats
    .map((s, i) => ptOf(i, RADAR_R * s.rate).map((v) => v.toFixed(1)).join(','))
    .join(' ');
  const shorten = (t: string) => (t.length > 12 ? t.slice(0, 11) + '…' : t);

  return (
    <svg
      className="type-radar"
      viewBox={`0 0 ${RADAR_W} ${RADAR_H}`}
      role="img"
      aria-label="유형별 정답률 레이더 차트"
    >
      {/* 배경 격자는 중심(cx,cy) 고정 동심원 — 중앙이 움직이지 않고 25/50/75/100 눈금이 항상 원 위에 정확히 위치 */}
      {[0.25, 0.5, 0.75, 1].map((ratio) => (
        <circle
          key={ratio}
          cx={cx}
          cy={cy}
          r={RADAR_R * ratio}
          fill={ratio === 1 ? '#F3F7FD' : 'none'}
          stroke="#D5DFF0"
          strokeWidth={ratio === 1 ? 1.2 : 0.8}
        />
      ))}
      {stats.map((_, i) => {
        const [x, y] = ptOf(i, RADAR_R);
        return <line key={`axis-${i}`} x1={cx} y1={cy} x2={x} y2={y} stroke="#D5DFF0" strokeWidth={0.8} />;
      })}
      {[0.25, 0.5, 0.75, 1].map((ratio) => (
        <text
          key={`ring-label-${ratio}`}
          x={cx + 4}
          y={cy - RADAR_R * ratio - 2}
          fontSize={8.5}
          fill="#8894AB"
        >
          {Math.round(ratio * 100)}
        </text>
      ))}

      <polygon points={dataPoly} fill="rgba(44,121,208,0.22)" stroke="#2C79D0" strokeWidth={2} strokeLinejoin="round" />
      {stats.map((s, i) => {
        const [x, y] = ptOf(i, RADAR_R * s.rate);
        return (
          <circle key={`dot-${i}`} cx={x} cy={y} r={3.5} fill={rateColor(s.rate)} stroke="#fff" strokeWidth={1.2}>
            <title>{`${s.type} ${Math.round(s.rate * 100)}% (${s.correct}/${s.total})`}</title>
          </circle>
        );
      })}

      {stats.map((s, i) => {
        const a = angleOf(i);
        const cos = Math.cos(a);
        const sin = Math.sin(a);
        const [x, y] = ptOf(i, RADAR_R + 16);
        const anchor = Math.abs(cos) < 0.35 ? 'middle' : cos > 0 ? 'start' : 'end';
        const dy = sin < -0.35 ? -8 : sin > 0.35 ? 10 : 0;
        return (
          <g key={`label-${i}`} textAnchor={anchor}>
            <text x={x} y={y + dy} fontSize={11} fontWeight={600} fill="#16224E">
              {shorten(s.type)}
              <title>{s.type}</title>
            </text>
            <text x={x} y={y + dy + 13} fontSize={10} fill={rateColor(s.rate)} fontWeight={700}>
              {Math.round(s.rate * 100)}%
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export default function TypeReport({ data }: Props) {
  const [studentId, setStudentId] = useState('');
  // 선생님 종합 의견은 저장하지 않는 임시 입력 — 학생을 바꾸면 비워짐
  const [note, setNote] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [busy, setBusy] = useState(false);
  const captureRef = useRef<HTMLDivElement>(null);
  const appendRef = useRef<HTMLDivElement>(null);

  const student = data.students.find((s) => s.id === studentId);
  const examById = useMemo(() => new Map(data.exams.map((e) => [e.id, e])), [data.exams]);

  const studentResults = useMemo(
    () => data.results.filter((r) => r.studentId === studentId).sort((a, b) => a.date.localeCompare(b.date)),
    [data.results, studentId]
  );

  // 학생이 바뀌면 기간 초기화 + 그 학생의 모든 응시를 기본 선택
  useEffect(() => {
    setFromDate('');
    setToDate('');
    setSelectedIds(new Set(studentResults.map((r) => r.id)));
  }, [studentId, studentResults.length]);

  // 학생이 바뀌면 선생님 의견 칸 비움(저장하지 않음)
  useEffect(() => {
    setNote('');
  }, [studentId]);

  // 기간을 정하면 그 기간에 응시한 시험을 선택(날짜 문자열 YYYY-MM-DD 사전순 비교)
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
  const mainStats = useMemo(() => stats.filter((s) => s.total >= MIN_CHART_TOTAL), [stats]);
  const minorStats = useMemo(() => stats.filter((s) => s.total < MIN_CHART_TOTAL), [stats]);

  const toggle = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const selectAll = () => applyRange('', '');
  const clearAll = () => {
    setFromDate('');
    setToDate('');
    setSelectedIds(new Set());
  };

  const today = todayStr();

  const downloadPdf = async () => {
    if (!captureRef.current || !student) return;
    setBusy(true);
    try {
      const { jsPDF } = await import('jspdf');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const MARGIN = 12; // 상하좌우 여백(mm) — 인쇄 시 잘림 방지
      const contentW = pageW - MARGIN * 2;
      const contentH = pageH - MARGIN * 2;

      // 캡처 영역(div)을 이미지로 만들어 여백 안쪽에 페이지 단위로 배치
      const addCapture = async (el: HTMLElement, startNewPage: boolean) => {
        const url = await toJpeg(el, { backgroundColor: '#ffffff', quality: 0.92, pixelRatio: 2, cacheBust: true });
        const props = pdf.getImageProperties(url);
        const imgH = (props.height * contentW) / props.width;
        // -0.5mm 여유: 딱 한 페이지 높이일 때 부동소수 오차로 빈 페이지가 더 생기는 것 방지
        const nPages = Math.max(1, Math.ceil((imgH - 0.5) / contentH));
        for (let k = 0; k < nPages; k++) {
          if (startNewPage || k > 0) pdf.addPage();
          pdf.addImage(url, 'JPEG', MARGIN, MARGIN - k * contentH, contentW, imgH);
          // 인접 구간이 상·하 여백으로 넘쳐 보이지 않도록 여백 영역을 흰색으로 덮음
          pdf.setFillColor(255, 255, 255);
          pdf.rect(0, 0, pageW, MARGIN, 'F');
          pdf.rect(0, pageH - MARGIN, pageW, MARGIN, 'F');
        }
      };

      await addCapture(captureRef.current, false); // 1페이지~: 리포트
      if (appendRef.current) await addCapture(appendRef.current, true); // 뒤: 상담 카드(3개 표)

      pdf.save(`리포트_${student.name}_${today}.pdf`);
    } catch (e) {
      console.error(e);
      alert('PDF 저장에 실패했습니다. 다시 시도해 주세요.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="assess-pane">
      <div className="assess-row wrap">
        <label className="assess-field">
          학생
          <select value={studentId} onChange={(e) => setStudentId(e.target.value)}>
            <option value="">선택</option>
            {data.students.map((s) => (
              <option key={s.id} value={s.id}>{s.name} ({s.grade})</option>
            ))}
          </select>
        </label>
        {studentId && studentResults.length > 0 && (
          <button className="primary" onClick={downloadPdf} disabled={busy || selectedResults.length === 0}>
            {busy ? '저장 중…' : '📄 리포트 PDF 저장'}
          </button>
        )}
      </div>

      {!studentId ? (
        <p className="muted">학생을 선택하면 유형별 정답률이 표시됩니다.</p>
      ) : studentResults.length === 0 ? (
        <p className="muted">이 학생의 채점 결과가 없습니다. [채점 입력]에서 먼저 채점하세요.</p>
      ) : (
        <>
          <div className="assess-card">
            <div className="report-pick-head">
              <b>리포트에 포함할 시험</b>
              <span className="report-pick-actions">
                <button className="mini" onClick={selectAll}>전체 선택</button>
                <button className="mini ghost" onClick={clearAll}>전체 해제</button>
                <span className="muted">{selectedResults.length}/{studentResults.length}개 선택</span>
              </span>
            </div>
            <div className="report-range">
              <span className="report-range-label">기간으로 선택</span>
              <input type="date" value={fromDate} max={toDate || undefined} onChange={(e) => applyRange(e.target.value, toDate)} />
              <span>~</span>
              <input type="date" value={toDate} min={fromDate || undefined} onChange={(e) => applyRange(fromDate, e.target.value)} />
              <span className="muted">기간을 정하면 그 기간에 응시한 시험이 선택됩니다. (개별 체크로 조정 가능)</span>
            </div>
            <div className="report-exam-list">
              {studentResults.map((r) => {
                const ex = examById.get(r.examId);
                const sc = scoreOf(r.marks);
                return (
                  <label key={r.id} className={`report-exam-item ${selectedIds.has(r.id) ? 'on' : ''}`}>
                    <input type="checkbox" checked={selectedIds.has(r.id)} onChange={() => toggle(r.id)} />
                    <span className="report-exam-name">{ex?.title ?? '시험'}</span>
                    <span className="muted">{r.date} · {sc.correct}/{sc.total} ({Math.round(sc.rate * 100)}%)</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="assess-card no-print report-note-edit">
            <h3>✍ 선생님 종합 의견 · 추천 수업</h3>
            <p className="muted">상담 결과, 추천 수업 등을 적으면 아래 리포트와 <b>PDF 출력에 함께</b> 나옵니다. (저장되지 않는 임시 입력 — 학생을 바꾸면 비워집니다)</p>
            <textarea
              className="report-note-input"
              rows={5}
              placeholder="예) 자료 해석·분석 추론 유형이 약해 원자료 해석 훈련이 필요합니다. 다음 학기에는 '수학 중2-1'과 '과학 중2-1' 수강을 추천합니다."
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          {selectedResults.length === 0 ? (
            <p className="muted">시험을 하나 이상 선택하세요.</p>
          ) : (
            <div ref={captureRef} className="report-capture">
              <div className="report-letterhead">
                {logoUrl && <img src={logoUrl} className="report-lh-logo" alt="" />}
                <div className="report-lh-text">
                  <div className="report-lh-org">알파학원 교육연구소</div>
                  <div className="report-lh-title">학생 개별 평가 리포트</div>
                </div>
              </div>

              <table className="report-info-table">
                <tbody>
                  <tr>
                    <th>학생</th><td>{student?.name}</td>
                    <th>학년</th><td>{student?.grade}</td>
                  </tr>
                  <tr>
                    <th>학교</th><td>{student?.school || '—'}</td>
                    <th>발행일</th><td>{today}</td>
                  </tr>
                  <tr>
                    <th>대상 기간</th><td>{fromDate || toDate ? `${fromDate || '처음'} ~ ${toDate || '끝'}` : '전체'}</td>
                    <th>대상 시험</th><td>{selectedResults.length}개</td>
                  </tr>
                </tbody>
              </table>

              <div className="assess-card">
                <h3>유형별 정답률</h3>
                {mainStats.length === 0 ? (
                  <p className="muted">
                    {stats.length === 0
                      ? '표시할 데이터가 없습니다.'
                      : `문제 수가 ${MIN_CHART_TOTAL}개 이상인 유형이 없어 차트를 생략합니다. (아래 참고 표)`}
                  </p>
                ) : (
                  <>
                    <div className="type-radar-wrap">
                      <TypeRadar stats={mainStats} />
                    </div>
                    <div className="type-bars-wrap">
                      <TypeBars stats={mainStats} />
                    </div>
                  </>
                )}
                <MinorNote stats={minorStats} />
              </div>

              <div className="assess-card">
                <h3>응시 이력 (선택한 시험)</h3>
                {(() => {
                  // 응시이력이 10개를 넘으면 한 줄에 2개씩 배치해 세로 길이를 절반으로 줄임
                  const twoCol = selectedResults.length > 10;
                  const cells = (r: (typeof selectedResults)[number]) => {
                    const ex = examById.get(r.examId);
                    const sc = scoreOf(r.marks);
                    return (
                      <>
                        <td>{ex?.title ?? '—'}</td>
                        <td>{r.date}</td>
                        <td>{sc.correct}/{sc.total} · {Math.round(sc.rate * 100)}%</td>
                      </>
                    );
                  };
                  if (!twoCol) {
                    return (
                      <table className="assess-table">
                        <thead>
                          <tr><th>시험지</th><th>응시일</th><th>정답률</th></tr>
                        </thead>
                        <tbody>
                          {selectedResults.map((r) => <tr key={r.id}>{cells(r)}</tr>)}
                        </tbody>
                      </table>
                    );
                  }
                  const half = Math.ceil(selectedResults.length / 2);
                  const left = selectedResults.slice(0, half);
                  const right = selectedResults.slice(half);
                  return (
                    <table className="assess-table exam-2col">
                      <thead>
                        <tr>
                          <th>시험지</th><th>응시일</th><th>정답률</th>
                          <th>시험지</th><th>응시일</th><th>정답률</th>
                        </tr>
                      </thead>
                      <tbody>
                        {left.map((r, i) => {
                          const rr = right[i];
                          return (
                            <tr key={r.id}>
                              {cells(r)}
                              {rr ? cells(rr) : <><td /><td /><td /><td /></>}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  );
                })()}
              </div>

              {note.trim() && (
                <div className="assess-card report-note-print">
                  <h3>선생님 종합 의견 · 추천 수업</h3>
                  <div className="report-note-body">{note}</div>
                </div>
              )}

              <div className="report-footer">
                <div className="report-footer-left">
                  <div className="report-footer-org">알파학원 교육연구소</div>
                  <div className="report-footer-en">ALPHA ACADEMY · Education Research Institute</div>
                  <div className="report-footer-date">발행일 {today}</div>
                </div>
                <div className="report-footer-seal">
                  {sealUrl ? <img src={sealUrl} className="report-seal-img" alt="직인" /> : <SealStamp />}
                </div>
              </div>
            </div>
          )}

          {/* 뒤 페이지: 상담 카드 — 화면에는 숨기고(래퍼 클리핑) PDF 출력에만 추가 */}
          {selectedResults.length > 0 && (
            <div className="report-append-wrap" aria-hidden>
            <div ref={appendRef} className="report-capture report-append">
              <div className="report-letterhead">
                {logoUrl && <img src={logoUrl} className="report-lh-logo" alt="" />}
                <div className="report-lh-text">
                  <div className="report-lh-org">알파학원 교육연구소</div>
                  <div className="report-lh-title">상담 카드 · 추가 정보</div>
                </div>
              </div>

              <div className="assess-card">
                <h3>목표 고등학교 <span className="rp-muted">(복수 선택 가능)</span></h3>
                <div className="rp-checks">
                  {TARGET_SCHOOLS.map((o) => (
                    <span key={o} className="rp-check">☐ {o}</span>
                  ))}
                </div>
              </div>

              <div className="assess-card">
                <h3>현재 진도 · 학습 내용</h3>
                <table className="report-info-table rp-progress">
                  <thead>
                    <tr>
                      <th>과목</th>
                      <th>현재 진도 <span className="rp-eg">(예시: 중 3-2, 대수)</span></th>
                      <th>학습 내용 <span className="rp-eg">(문제집 예시: 중등 - 쎈, 고등 - 수학의 정석)</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr><th>수학</th><td className="rp-blank" /><td className="rp-blank" /></tr>
                    <tr><th>과학</th><td className="rp-blank" /><td className="rp-blank" /></tr>
                  </tbody>
                </table>
              </div>

              <div className="assess-card rp-memo">
                <h3>상담 메모 · 특이사항</h3>
                <div className="rp-memo-box" />
              </div>

              <div className="assess-card">
                <h3>개인정보 수집 · 이용 동의서</h3>
                <ol className="rp-privacy">
                  <li><b>수집·이용 목적</b> : 학원 수강 상담, 학습 정보 제공, 공지사항 및 소식지 전달</li>
                  <li><b>수집 항목</b> : 학생 성명, 학교/학년, 학생·학부모 휴대폰 번호, 성적 정보, 목표(희망) 고등학교, 형제 재원 여부, 학습 이력(진도·교재)</li>
                  <li><b>보유·이용 기간</b> : 수집된 개인정보는 학원 등록 후 재원 기간 동안 보유하며 관계 법령에 따라 보존이 필요한 경우 해당 기간 동안 별도 보관합니다. 개인정보 제공자가 동의한 내용 외에 다른 목적으로 활용하지 않으며, 제공된 개인정보의 이용을 거부하고자 할 때에는 개인정보처리책임자를 통해 열람·정정·삭제를 요구할 수 있습니다.</li>
                </ol>
                <p className="rp-agree">「개인정보 보호법」 등 관련 법규에 의거하여, 상기 본인은 위와 같이 개인정보 수집 및 이용에 동의합니다.</p>
                <div className="rp-sign">
                  <span>20 _____ 년 _____ 월 _____ 일</span>
                  <span>성명 : ______________ (서명/인)</span>
                  <span>알파학원 귀하</span>
                </div>
              </div>
            </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
