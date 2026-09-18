import { useEffect, useRef, useState } from 'react';
import { exportAssessmentJson, loadAssessment, parseAssessmentJson, saveAssessment } from './lib/assessment';
import { CLOUD_DOC, useCloudDoc } from './lib/cloud';
import { buildSeedExams } from './lib/seed';
import Logo from './components/Logo';
import CloudBar from './components/CloudBar';
import HomePage, { HomeTarget } from './components/HomePage';
import StudentManager from './components/StudentManager';
import ExamManager from './components/ExamManager';
import GradingPanel from './components/GradingPanel';
import TypeReport from './components/TypeReport';
import ManualPage from './components/ManualPage';

type View = 'home' | 'students' | 'exams' | 'grading' | 'report' | 'manual';

// 리포트는 학생 화면에서 열리므로 메뉴에 두지 않는다.
const NAV: { key: View; label: string }[] = [
  { key: 'home', label: '홈' },
  { key: 'students', label: '학생' },
  { key: 'exams', label: '시험지' },
  { key: 'grading', label: '채점' },
  { key: 'manual', label: '사용법' },
];

export default function App() {
  const { value: data, setValue: setData, status: cloudStatus } = useCloudDoc(
    CLOUD_DOC,
    loadAssessment,
    saveAssessment
  );
  const [view, setView] = useState<View>('home');
  // 학생 선택은 학생 화면·채점·리포트가 함께 쓰므로 여기에서 들고 있는다.
  const [studentId, setStudentId] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  // 사이트에 같이 올려 둔 진단평가를 처음 한 번 시험지 목록에 넣는다.
  // 넣고 나면 표시해 두어, 지운 시험지가 다시 살아나지 않게 한다.
  const dataRef = useRef(data);
  dataRef.current = data;
  const seedTried = useRef(false);
  useEffect(() => {
    if (seedTried.current || data.seeded) return;
    seedTried.current = true;
    buildSeedExams(data.exams).then(({ ok, exams }) => {
      // 목록을 못 읽었으면(오프라인 등) 표시하지 않고 다음 실행에 다시 해 본다.
      if (!ok) {
        seedTried.current = false;
        return;
      }
      // 받아 오는 사이에 사용자가 뭔가 했을 수 있으니 최신 값 위에 얹는다.
      const cur = dataRef.current;
      setData({ ...cur, exams: [...cur.exams, ...exams], seeded: true });
    });
  }, [data, setData]);

  const importJson = async (file: File) => {
    try {
      setData(parseAssessmentJson(await file.text()));
      alert('불러왔습니다.');
    } catch (e) {
      alert('JSON을 읽지 못했습니다: ' + (e as Error).message);
    }
  };

  const goHome = (target: HomeTarget) => setView(target === 'report' ? 'students' : target);
  const navActive = (key: View) => (view === 'report' ? key === 'students' : view === key);

  return (
    <div className="app">
      <header className="app-header no-print">
        <div className="brand">
          <Logo size={32} />
          <button className="brand-title" onClick={() => setView('home')}>
            알파학원 진단평가 분석
          </button>
        </div>

        <nav className="assess-tabs">
          {NAV.map((t) => (
            <button key={t.key} className={navActive(t.key) ? 'active' : ''} onClick={() => setView(t.key)}>
              {t.label}
            </button>
          ))}
        </nav>

        <div className="admin-toolbar">
          <CloudBar status={cloudStatus} />
          <button className="mini ghost" onClick={() => exportAssessmentJson(data)}>
            <span className="lbl-long">JSON </span>내보내기
          </button>
          <button className="mini ghost" onClick={() => fileRef.current?.click()}>
            <span className="lbl-long">JSON </span>가져오기
          </button>
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
      </header>

      {view === 'home' && <HomePage data={data} onGo={goHome} />}

      {view === 'students' && (
        <main className="pane">
          <StudentManager
            data={data}
            setData={setData}
            selectedId={studentId}
            setSelectedId={setStudentId}
            onOpenReport={() => setView('report')}
            onOpenGrading={() => setView('grading')}
          />
        </main>
      )}

      {view === 'exams' && (
        <main className="pane">
          <section className="assess-card">
            <ExamManager data={data} setData={setData} />
          </section>
        </main>
      )}

      {view === 'grading' && (
        <main className="pane">
          <section className="assess-card">
            <GradingPanel data={data} setData={setData} />
          </section>
        </main>
      )}

      {view === 'manual' && (
        <main className="pane">
          <ManualPage />
        </main>
      )}

      {view === 'report' && (
        <main className="pane">
          <TypeReport
            data={data}
            studentId={studentId}
            setStudentId={setStudentId}
            onBack={() => setView('students')}
          />
        </main>
      )}
    </div>
  );
}
