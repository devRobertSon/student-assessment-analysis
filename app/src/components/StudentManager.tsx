import { useRef, useState } from 'react';
import {
  AssessmentData,
  Student,
  downloadText,
  newId,
  parseStudentsCsv,
  studentsToCsv,
  todayStr,
  upsertStudents,
} from '../lib/assessment';

const GRADES = ['초3', '초4', '초5', '초6', '중1', '중2', '중3', '고1', '고2', '고3'];
const DEFAULT_GRADE = '중1';

interface Props {
  data: AssessmentData;
  setData: (d: AssessmentData) => void;
}

export default function StudentManager({ data, setData }: Props) {
  const [name, setName] = useState('');
  const [grade, setGrade] = useState(DEFAULT_GRADE);
  const fileRef = useRef<HTMLInputElement>(null);

  const add = () => {
    const nm = name.trim();
    if (!nm) return;
    if (data.students.some((s) => s.name === nm) && !confirm(`"${nm}" 학생이 이미 있습니다. 그래도 추가할까요?`)) return;
    setData({ ...data, students: [...data.students, { id: newId('stu'), name: nm, grade }] });
    setName('');
  };

  const update = (id: string, patch: Partial<Student>) =>
    setData({ ...data, students: data.students.map((s) => (s.id === id ? { ...s, ...patch } : s)) });

  const remove = (id: string) => {
    const s = data.students.find((x) => x.id === id);
    const cnt = data.results.filter((r) => r.studentId === id).length;
    if (!confirm(`${s?.name} 학생을 삭제할까요?${cnt ? ` (채점 결과 ${cnt}건도 함께 삭제)` : ''}`)) return;
    setData({
      ...data,
      students: data.students.filter((x) => x.id !== id),
      results: data.results.filter((r) => r.studentId !== id),
    });
  };

  const exportCsv = () => downloadText(`학생목록_${todayStr()}.csv`, studentsToCsv(data.students));

  const importCsv = async (file: File) => {
    const { drafts, errors } = parseStudentsCsv(await file.text());
    if (errors.length) alert(errors.join('\n'));
    if (!drafts.length) return;
    const { data: next, added, updated } = upsertStudents(data, drafts);
    setData(next);
    alert(`추가 ${added}명 · 갱신 ${updated}명`);
  };

  return (
    <div className="assess-pane">
      <div className="assess-row">
        <input
          value={name}
          placeholder="학생 이름"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
        />
        <select value={grade} onChange={(e) => setGrade(e.target.value)}>
          {GRADES.map((g) => (<option key={g} value={g}>{g}</option>))}
        </select>
        <button onClick={add} disabled={!name.trim()}>학생 추가</button>
        <span style={{ flex: 1 }} />
        <button className="ghost" onClick={() => fileRef.current?.click()}>CSV 가져오기</button>
        <button className="ghost" onClick={exportCsv} disabled={!data.students.length}>CSV 내려받기</button>
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
      <p className="hint">CSV는 <code>이름, 학년</code> 열을 사용합니다. 같은 이름이 있으면 학년을 갱신하고, 채점 결과는 보존합니다.</p>

      {data.students.length === 0 ? (
        <p className="muted">아직 등록된 학생이 없습니다. 위에서 이름을 입력해 추가하거나 CSV로 가져오세요.</p>
      ) : (
        <table className="assess-table">
          <thead>
            <tr>
              <th>이름</th>
              <th>학년</th>
              <th>학교</th>
              <th>연락처</th>
              <th>메모</th>
              <th>채점</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {data.students.map((s) => (
              <tr key={s.id}>
                <td>
                  <input value={s.name} onChange={(e) => update(s.id, { name: e.target.value })} />
                </td>
                <td>
                  <select value={s.grade} onChange={(e) => update(s.id, { grade: e.target.value })}>
                    {GRADES.map((g) => (<option key={g} value={g}>{g}</option>))}
                  </select>
                </td>
                <td>
                  <input value={s.school ?? ''} placeholder="(선택)" onChange={(e) => update(s.id, { school: e.target.value })} />
                </td>
                <td>
                  <input value={s.contact ?? ''} placeholder="(선택)" onChange={(e) => update(s.id, { contact: e.target.value })} />
                </td>
                <td>
                  <input
                    className="wide"
                    value={s.memo ?? ''}
                    placeholder="메모"
                    onChange={(e) => update(s.id, { memo: e.target.value })}
                  />
                </td>
                <td style={{ textAlign: 'center' }}>{data.results.filter((r) => r.studentId === s.id).length}건</td>
                <td>
                  <button className="del" onClick={() => remove(s.id)} title="삭제">✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
