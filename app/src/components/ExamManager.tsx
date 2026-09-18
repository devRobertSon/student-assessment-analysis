import { Fragment, useRef, useState } from 'react';
import {
  AssessmentData,
  Exam,
  ExamQuestion,
  downloadText,
  examQuestionsFromCsv,
  newId,
  todayStr,
} from '../lib/assessment';

// 업로드 예시(양식) — 받아서 내용만 바꿔 다시 올리면 됩니다.
const SAMPLE_EXAM_CSV = `시험지,과목,문항번호,유형,정답,배점
중2 1차 진단,과학,1,자료 해석,3,3.5
중2 1차 진단,과학,2,분석·추론,①,4`;

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
  errors: string[];
}

export default function ExamManager({ data, setData }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

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
      errors: res.errors,
    };
  };

  const onFiles = async (files: File[]) => {
    const parsed = await Promise.all(files.map(async (f) => draftFromCsv(f, await f.text())));
    const ok = parsed.filter((d): d is Draft => d !== null);
    const failed = files.filter((_, i) => parsed[i] === null).map((f) => f.name);
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
      <div className="assess-row">
        <button className="primary" onClick={() => fileRef.current?.click()}>＋ CSV 시험지 업로드</button>
        <button className="ghost" onClick={() => downloadText('시험지_예시.csv', SAMPLE_EXAM_CSV)}>예시 CSV</button>
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
        <span className="hint">여러 CSV를 한 번에 올릴 수 있습니다. CSV 한 개 = 시험지 한 개.</span>
      </div>
      <details className="csv-help">
        <summary>CSV 어떻게 만드나요?</summary>
        <p>
          엑셀·구글 시트에서 <b>CSV 한 개 = 시험지 한 개</b>로 만들어 <b>CSV로 저장</b>해 올리거나, <b>[예시 CSV]</b> 버튼으로 양식을 받아 내용만 바꿔 올리세요.
        </p>
        <ul>
          <li><b>문항번호</b> — 1, 2, 3… (필수)</li>
          <li><b>유형</b> — 문항 유형. 과학은 6종(개념 이해·자료 해석·적용·계산·분석·추론·탐구·실험 설계·비교·분류) (필수)</li>
          <li><b>시험지</b> — 시험지 이름 (선택, 없으면 파일명 사용)</li>
          <li><b>과목·정답·배점</b> — 선택 (배점은 3.5처럼 소수점 가능)</li>
        </ul>
        <pre className="manual-code">{SAMPLE_EXAM_CSV}</pre>
        <p className="muted">열 순서는 무관하고 헤더 이름으로 인식합니다.</p>
      </details>

      {drafts.length > 0 && (
        <div className="assess-card draft">
          <div className="report-pick-head">
            <h3 style={{ margin: 0 }}>업로드 미리보기 · {drafts.length}개 시험지</h3>
            <span className="report-pick-actions">
              <button className="primary" onClick={saveAll}>모두 저장</button>
              <button className="ghost" onClick={() => setDrafts([])}>모두 취소</button>
            </span>
          </div>
          {drafts.map((d) => {
            const typeCount = new Set(d.questions.map((q) => q.type)).size;
            return (
              <div key={d.key} className="draft-item">
                <div className="draft-item-head">
                  <b>{d.filename}</b>
                  <span className="muted">{d.questions.length}문항 · 유형 {typeCount}종</span>
                  <button className="del" onClick={() => removeDraft(d.key)} title="이 파일 제외">✕</button>
                </div>
                <div className="assess-row wrap">
                  <label className="assess-field">
                    시험지명
                    <input value={d.title} onChange={(e) => updateDraft(d.key, { title: e.target.value })} />
                  </label>
                  <label className="assess-field">
                    과목
                    <input value={d.subject} onChange={(e) => updateDraft(d.key, { subject: e.target.value })} />
                  </label>
                  <label className="assess-field">
                    날짜
                    <input type="date" value={d.date} onChange={(e) => updateDraft(d.key, { date: e.target.value })} />
                  </label>
                </div>
                {d.errors.length > 0 && (
                  <div className="assess-warn">⚠ {d.errors.slice(0, 5).join(' / ')}{d.errors.length > 5 ? ' …' : ''}</div>
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
            <span className="hint">{data.exams.length}개 시험지 · {selected.size}개 선택됨</span>
            <span style={{ marginLeft: 'auto' }} />
            <button className="del-btn" disabled={selected.size === 0} onClick={removeSelected}>
              선택 삭제{selected.size > 0 ? ` (${selected.size})` : ''}
            </button>
          </div>
          <table className="assess-table">
            <thead>
              <tr>
                <th style={{ width: 28, textAlign: 'center' }}>
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} title="전체 선택" />
                </th>
                <th>시험지</th>
                <th>과목</th>
                <th>날짜</th>
                <th>문항</th>
                <th></th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.exams.map((ex) => (
                <Fragment key={ex.id}>
                  <tr className={selected.has(ex.id) ? 'row-selected' : ''}>
                    <td style={{ textAlign: 'center' }}>
                      <input type="checkbox" checked={selected.has(ex.id)} onChange={() => toggle(ex.id)} />
                    </td>
                    <td>{ex.title}</td>
                    <td>{ex.subject}</td>
                    <td>{ex.date}</td>
                    <td style={{ textAlign: 'center' }}>{ex.questions.length}</td>
                    <td>
                      <button className="mini" onClick={() => setOpenId(openId === ex.id ? null : ex.id)}>
                        {openId === ex.id ? '접기' : '유형 보기'}
                      </button>
                    </td>
                    <td>
                      <button className="del" onClick={() => removeExam(ex.id)} title="삭제">✕</button>
                    </td>
                  </tr>
                  {openId === ex.id && (
                    <tr>
                      <td colSpan={7}>
                        <div className="assess-preview-grid">
                          {ex.questions.map((q) => (
                            <span key={q.no} className="assess-chip">
                              <b>{q.no}</b> {q.type}{q.answer ? ` · 답 ${q.answer}` : ''}
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
