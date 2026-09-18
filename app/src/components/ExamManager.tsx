import { Fragment, useRef, useState } from 'react';
import {
  AssessmentData,
  Exam,
  ExamQuestion,
  downloadText,
  examQuestionsFromCsv,
  paperHref,
  fmtPoints,
  isEssay,
  newId,
  pointsOf,
  splitTypes,
  todayStr,
} from '../lib/assessment';

// 업로드 예시(양식) — 받아서 내용만 바꿔 다시 올리면 됩니다.
const SAMPLE_EXAM_CSV = `시험지,과목,문항번호,단원,유형,난이도,형식,배점,정답,출처,원문항,문제지,해설
중2 1차 진단,수학,1,식의 계산,연산·식 정리,표준,객관식,3,③,심화,7,중2-1_문제지.pdf,중2-1_해설.pdf
중2 1차 진단,수학,2,식의 계산,개념 이해,상,객관식,3,①,응용,12
중2 1차 진단,수학,3,부등식,표현 해석,상,객관식,3,⑤,심화,5
중2 1차 진단,수학,4,방정식,다단계 해결,최상,서술형,6,12,심화형,9
중2 1차 진단,수학,5,일차함수,논증·정당화,최상,서술형,6,-4,심화,30`;

interface Props {
  data: AssessmentData;
  setData: (d: AssessmentData) => void;
}

interface Draft {
  key: string;
  filename: string;
  title: string;
  subject: string;
  date: string;
  questions: ExamQuestion[];
  paper?: string;
  solution?: string;
  errors: string[];
}

export default function ExamManager({ data, setData }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dragging, setDragging] = useState(false);

  const draftFromCsv = (file: File, text: string): Draft | null => {
    const res = examQuestionsFromCsv(text);
    if (res.questions.length === 0) return null;
    const base = file.name.replace(/\.csv$/i, '');
    return {
      key: newId('draft'),
      filename: file.name,
      title: res.title || base,
      subject: res.subject || '과학',
      date: todayStr(),
      questions: res.questions,
      paper: res.paper,
      solution: res.solution,
      errors: res.errors,
    };
  };

  const onFiles = async (files: File[]) => {
    const csv = files.filter((f) => /\.csv$/i.test(f.name) || f.type === 'text/csv');
    if (csv.length === 0) {
      alert('CSV 파일만 올릴 수 있습니다.');
      return;
    }
    const parsed = await Promise.all(csv.map(async (f) => draftFromCsv(f, await f.text())));
    const ok = parsed.filter((d): d is Draft => d !== null);
    const failed = csv.filter((_, i) => parsed[i] === null).map((f) => f.name);
    if (ok.length) setDrafts((prev) => [...prev, ...ok]);
    if (failed.length) alert('문항을 읽지 못한 파일: ' + failed.join(', '));
  };

  const updateDraft = (key: string, patch: Partial<Draft>) =>
    setDrafts((prev) => prev.map((d) => (d.key === key ? { ...d, ...patch } : d)));
  const removeDraft = (key: string) => setDrafts((prev) => prev.filter((d) => d.key !== key));

  const saveAll = () => {
    if (drafts.length === 0) return;
    const newExams: Exam[] = drafts.map((d) => ({
      id: newId('exam'),
      title: d.title.trim() || '제목 없음',
      subject: d.subject.trim() || '과학',
      date: d.date,
      questions: d.questions,
      paper: d.paper?.trim() || undefined,
      solution: d.solution?.trim() || undefined,
    }));
    setData({ ...data, exams: [...data.exams, ...newExams] });
    setDrafts([]);
  };

  const removeExam = (id: string) => {
    const e = data.exams.find((x) => x.id === id);
    const cnt = data.results.filter((r) => r.examId === id).length;
    if (!confirm(`"${e?.title}" 시험지를 삭제할까요?${cnt ? ` (채점 결과 ${cnt}건도 함께 삭제)` : ''}`)) return;
    setData({
      ...data,
      exams: data.exams.filter((x) => x.id !== id),
      results: data.results.filter((r) => r.examId !== id),
    });
    setSelected((prev) => {
      const n = new Set(prev);
      n.delete(id);
      return n;
    });
  };

  const removeSelected = () => {
    if (selected.size === 0) return;
    const cnt = data.results.filter((r) => selected.has(r.examId)).length;
    if (!confirm(`선택한 시험지 ${selected.size}개를 삭제할까요?${cnt ? ` (채점 결과 ${cnt}건도 함께 삭제)` : ''}`)) return;
    setData({
      ...data,
      exams: data.exams.filter((x) => !selected.has(x.id)),
      results: data.results.filter((r) => !selected.has(r.examId)),
    });
    setSelected(new Set());
  };

  const toggle = (id: string) =>
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const allSelected = data.exams.length > 0 && selected.size === data.exams.length;
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(data.exams.map((e) => e.id)));

  return (
    <div className="assess-pane">
      <div className="screen-head">
        <div>
          <h1>시험지 관리</h1>
          <p className="muted">
            CSV 한 개가 시험지 한 개입니다. 유형은 필수이고, 단원·난이도를 함께 적으면 그 축으로도 분석됩니다.
          </p>
        </div>
        <div className="assess-row">
          {/* 엑셀이 UTF-8로 열도록 BOM을 붙인다. 화면에 보여주는 쪽은 BOM 없이 그대로 쓴다. */}
          <button className="ghost" onClick={() => downloadText('시험지_예시.csv', '﻿' + SAMPLE_EXAM_CSV)}>
            예시 CSV
          </button>
          <button className="primary" onClick={() => fileRef.current?.click()}>
            ＋ CSV 업로드
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            multiple
            style={{ display: 'none' }}
            onChange={(e) => {
              const fs = Array.from(e.target.files ?? []);
              if (fs.length) onFiles(fs);
              e.target.value = '';
            }}
          />
        </div>
      </div>

      <div
        className={`dropzone ${dragging ? 'on' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          onFiles(Array.from(e.dataTransfer.files));
        }}
      >
        <span className="dz-icon" aria-hidden>
          <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 16V4" />
            <path d="M7 9l5-5 5 5" />
            <path d="M4 18v2h16v-2" />
          </svg>
        </span>
        <div>
          <div className="dz-title">여기로 CSV 파일을 끌어다 놓거나 [＋ CSV 업로드]를 누르세요</div>
          <div className="hint">
            필수 열 <b>문항번호</b>, <b>유형</b> · 선택 열 시험지, 과목, 단원, 난이도, 형식, 배점, 정답, 출처, 원문항, 문제지, 해설 ·
            여러 개 동시 업로드 가능
          </div>
        </div>
      </div>

      <details className="csv-help">
        <summary>CSV 어떻게 만드나요?</summary>
        <p>
          엑셀·구글 시트에서 <b>CSV 한 개 = 시험지 한 개</b>로 만들어 <b>CSV로 저장</b>해 올리거나, <b>[예시 CSV]</b>{' '}
          버튼으로 양식을 받아 내용만 바꿔 올리세요.
        </p>
        <ul>
          <li>
            <b>문항번호</b> — 1, 2, 3… (필수)
          </li>
          <li>
            <b>유형</b> — 문항 유형. 이 값이 강점·약점 분석의 기준이 됩니다 (필수).
            평가원과 같이 <b>문항당 하나</b>만 적습니다
          </li>
          <li>
            <b>시험지</b> — 시험지 이름 (선택, 없으면 파일명 사용)
          </li>
          <li>
            <b>형식</b> — <b>서술형</b>이라고 적으면 채점 화면에서 O/X 대신 <b>부분점수</b>를 입력합니다.
            비워두거나 다른 값이면 객관식으로 봅니다 (선택)
          </li>
          <li>
            <b>단원</b> — 적어 두면 채점 화면에서 <b>단원별</b>로도 집계됩니다. 유형이 "어디서 막히는가"라면
            단원은 "무엇을 안 배웠는가"입니다 (선택)
          </li>
          <li>
            <b>난이도</b> — <b>표준 · 상 · 최상</b>으로 적으면 그 순서대로 집계됩니다. 기초가 무너진 것인지
            응용에서만 멈추는 것인지 갈립니다 (선택)
          </li>
          <li>
            <b>과목·정답·배점</b> — 선택 (배점은 3.5처럼 소수점 가능). 배점을 적지 않으면 모든 문항을 1점으로 봅니다
          </li>
          <li>
            <b>출처·원문항</b> — 교재 이름과 그 교재에서의 번호. 약점 문항과 비슷한 문제를 다시 낼 때
            찾아가는 용도입니다 (선택)
          </li>
          <li>
            <b>문제지·해설</b> — 그 시험의 PDF 파일 이름. 적어 두면 목록에서 바로 내려받습니다.
            파일은 <code>docs/papers/</code>에 올려 둔 것을 쓰고, 다른 곳에 있으면 <code>https://…</code>{' '}
            주소를 그대로 적어도 됩니다. 시험지마다 하나씩이므로 <b>첫 줄에만 적으면</b> 됩니다 (선택)
          </li>
        </ul>
        <pre className="manual-code">{SAMPLE_EXAM_CSV}</pre>
        <p className="hint">열 순서는 무관하고 헤더 이름으로 인식합니다.</p>
      </details>

      {drafts.length > 0 && (
        <div className="assess-card draft">
          <div className="report-pick-head">
            <h3 style={{ margin: 0 }}>업로드 미리보기 · {drafts.length}개 시험지</h3>
            <span className="report-pick-actions">
              <button className="primary mini" onClick={saveAll}>
                모두 저장
              </button>
              <button className="ghost mini" onClick={() => setDrafts([])}>
                모두 취소
              </button>
            </span>
          </div>
          {drafts.map((d) => {
            const typeCount = new Set(d.questions.map((q) => q.type)).size;
            const essays = d.questions.filter(isEssay).length;
            const full = d.questions.reduce((a, q) => a + pointsOf(q), 0);
            return (
              <div key={d.key} className="draft-item">
                <div className="draft-item-head">
                  <b>{d.filename}</b>
                  <span className="hint">
                    {d.questions.length}문항 · 유형 {typeCount}종
                    {essays > 0 && ` · 서술형 ${essays}문항`} · 만점 {fmtPoints(full)}점
                  </span>
                  <button className="del" style={{ marginLeft: 'auto' }} onClick={() => removeDraft(d.key)} title="이 파일 제외">
                    ✕
                  </button>
                </div>
                <div className="assess-row wrap">
                  <label className="assess-field">
                    시험지명
                    <input type="text" value={d.title} onChange={(e) => updateDraft(d.key, { title: e.target.value })} />
                  </label>
                  <label className="assess-field">
                    과목
                    <input type="text" value={d.subject} onChange={(e) => updateDraft(d.key, { subject: e.target.value })} />
                  </label>
                  <label className="assess-field">
                    등록일
                    <input type="date" value={d.date} onChange={(e) => updateDraft(d.key, { date: e.target.value })} />
                  </label>
                </div>
                {/* 사이트의 papers/ 에 올려 둔 파일 이름을 적는다. 주소를 그대로 적어도 된다. */}
                <div className="assess-row wrap">
                  <label className="assess-field grow">
                    문제지 PDF
                    <input
                      type="text"
                      value={d.paper ?? ''}
                      placeholder="예: 중1-1_진단평가_문제지.pdf (없으면 비워 둠)"
                      onChange={(e) => updateDraft(d.key, { paper: e.target.value })}
                    />
                  </label>
                  <label className="assess-field grow">
                    해설지 PDF
                    <input
                      type="text"
                      value={d.solution ?? ''}
                      placeholder="예: 중1-1_진단평가_해설.pdf"
                      onChange={(e) => updateDraft(d.key, { solution: e.target.value })}
                    />
                  </label>
                </div>
                {d.errors.length > 0 && (
                  <div className="assess-warn">
                    ⚠ {d.errors.slice(0, 5).join(' / ')}
                    {d.errors.length > 5 ? ' …' : ''}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {data.exams.length === 0 ? (
        <p className="muted">등록된 시험지가 없습니다. CSV를 업로드하세요.</p>
      ) : (
        <>
          <div className="assess-row">
            <span className="hint">
              {data.exams.length}개 시험지 · {selected.size}개 선택됨
            </span>
            <span style={{ marginLeft: 'auto' }} />
            <button className="del-btn mini" disabled={selected.size === 0} onClick={removeSelected}>
              선택 삭제{selected.size > 0 ? ` (${selected.size})` : ''}
            </button>
          </div>
          <table className="assess-table">
            <thead>
              <tr>
                <th style={{ width: 34, textAlign: 'center' }}>
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="전체 선택" />
                </th>
                <th>시험지</th>
                <th style={{ width: 84 }}>과목</th>
                <th style={{ width: 118 }}>등록일</th>
                <th style={{ width: 70, textAlign: 'center' }}>문항</th>
                <th style={{ width: 62 }}>유형</th>
                <th style={{ width: 62 }}>단원</th>
                <th style={{ width: 124 }}>인쇄물</th>
                <th style={{ width: 92 }}></th>
                <th style={{ width: 44 }}></th>
              </tr>
            </thead>
            <tbody>
              {data.exams.map((ex) => (
                <Fragment key={ex.id}>
                  <tr className={selected.has(ex.id) ? 'row-selected' : ''}>
                    <td style={{ textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={selected.has(ex.id)}
                        onChange={() => toggle(ex.id)}
                        aria-label={`${ex.title} 선택`}
                      />
                    </td>
                    <td>{ex.title}</td>
                    <td>{ex.subject}</td>
                    <td>{ex.date}</td>
                    <td style={{ textAlign: 'center' }}>{ex.questions.length}</td>
                    <td>{new Set(ex.questions.flatMap((q) => splitTypes(q.type))).size}종</td>
                    <td>
                      {(() => {
                        const n = new Set(ex.questions.map((q) => q.unit).filter(Boolean)).size;
                        return n ? `${n}개` : '—';
                      })()}
                    </td>
                    <td className="ex-files">
                      {ex.paper && (
                        <a className="file-link" href={paperHref(ex.paper)} download target="_blank" rel="noopener">
                          문제지
                        </a>
                      )}
                      {ex.solution && (
                        <a className="file-link" href={paperHref(ex.solution)} download target="_blank" rel="noopener">
                          해설
                        </a>
                      )}
                      {!ex.paper && !ex.solution && <span className="hint">—</span>}
                    </td>
                    <td>
                      <button className="mini ghost" onClick={() => setOpenId(openId === ex.id ? null : ex.id)}>
                        {openId === ex.id ? '접기' : '유형 보기'}
                      </button>
                    </td>
                    <td>
                      <button className="del" onClick={() => removeExam(ex.id)} title="삭제">
                        ✕
                      </button>
                    </td>
                  </tr>
                  {openId === ex.id && (
                    <tr>
                      <td colSpan={10}>
                        <div className="hint" style={{ marginBottom: 7 }}>
                          {ex.title} · 문항별 유형 · 만점{' '}
                          {fmtPoints(ex.questions.reduce((a, q) => a + pointsOf(q), 0))}점
                          {(() => {
                            const n = ex.questions.filter(isEssay).length;
                            return n > 0 ? ` · 서술형 ${n}문항` : '';
                          })()}
                        </div>
                        <div className="assess-preview-grid">
                          {ex.questions.map((q) => (
                            <span key={q.no} className="assess-chip">
                              <b>{q.no}</b> {q.type}
                              {isEssay(q) && <span className="q-fmt">서술형</span>}
                              {q.level ? <span className="q-lv">{q.level}</span> : null}
                              {q.unit ? ` · ${q.unit}` : ''}
                              {q.answer ? ` · 답 ${q.answer}` : ''}
                              {q.source ? ` · ${q.source}${q.sourceNo ? ' ' + q.sourceNo + '번' : ''}` : ''}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
