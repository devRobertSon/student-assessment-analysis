import { useRef, useState } from 'react';
import { exportAssessmentJson, loadAssessment, parseAssessmentJson, saveAssessment } from './lib/assessment';
import { useCloudDoc } from './lib/cloud';
import Logo from './components/Logo';
import CloudBar from './components/CloudBar';
import StudentManager from './components/StudentManager';
import ExamManager from './components/ExamManager';
import GradingPanel from './components/GradingPanel';
import TypeReport from './components/TypeReport';

type Tab = 'students' | 'exams' | 'grading' | 'report';

const TABS: { key: Tab; label: string }[] = [
  { key: 'students', label: '학생 관리' },
  { key: 'exams', label: '시험지 관리' },
  { key: 'grading', label: '채점 입력' },
  { key: 'report', label: '리포트' },
];

// 기존 시간표 앱과 같은 도메인(devrobertson.github.io)에 배포되므로
// Firestore 문서 이름을 분리해 데이터가 섞이지 않게 한다.
const CLOUD_DOC = 'diagnostic-assessment';

export default function App() {
  const { value: data, setValue: setData, status: cloudStatus } = useCloudDoc(
    CLOUD_DOC,
    loadAssessment,
    saveAssessment
  );
  const [tab, setTab] = useState<Tab>('students');
  const fileRef = useRef<HTMLInputElement>(null);

  const importJson = async (file: File) => {
    try {
      setData(parseAssessmentJson(await file.text()));
      alert('불러왔습니다.');
    } catch (e) {
      alert('JSON을 읽지 못했습니다: ' + (e as Error).message);
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <div className="brand-title">
            <Logo size={36} />
            <h1>진단평가 분석</h1>
          </div>
          <div className="admin-toolbar" style={{ margin: 0 }}>
            <CloudBar status={cloudStatus} />
            <button onClick={() => exportAssessmentJson(data)}>JSON 내보내기</button>
            <button onClick={() => fileRef.current?.click()}>JSON 가져오기</button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              style={{ display: 'none' }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) importJson(f);
                e.target.value = '';
              }}
            />
          </div>
        </div>
        <p>진단평가를 학생별로 채점하고, 유형별 강점·약점 리포트를 확인합니다. (브라우저 자동 저장 · 로그인 시 기기 간 동기화)</p>
      </header>

      <nav className="assess-tabs">
        {TABS.map((t) => (
          <button key={t.key} className={tab === t.key ? 'active' : ''} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </nav>

      <section className="card">
        {tab === 'students' && <StudentManager data={data} setData={setData} />}
        {tab === 'exams' && <ExamManager data={data} setData={setData} />}
        {tab === 'grading' && <GradingPanel data={data} setData={setData} />}
        {tab === 'report' && <TypeReport data={data} />}
      </section>
    </div>
  );
}
