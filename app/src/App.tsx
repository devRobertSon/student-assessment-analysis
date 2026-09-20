import { useEffect, useRef, useState } from 'react';
import { exportAssessmentJson, loadAssessment, parseAssessmentJson, saveAssessment } from './lib/assessment';
import { CLOUD_DOC, useCloudDoc } from './lib/cloud';
import { syncExamsFromPapers } from './lib/papersync';
import { NoticeHost, notify } from './lib/notice';
import Logo from './components/Logo';
import CloudBar from './components/CloudBar';
import HomePage, { HomeTarget } from './components/HomePage';
import StudentManager from './components/StudentManager';
import ExamManager from './components/ExamManager';
import GradingPanel from './components/GradingPanel';
import TypeReport from './components/TypeReport';
import ManualPage from './components/ManualPage';
import TypesPage from './components/TypesPage';
import { canLeave } from './lib/leaveGuard';

type View = 'home' | 'students' | 'exams' | 'grading' | 'report' | 'types' | 'manual';

const NAV: { key: View; label: string }[] = [
  { key: 'home', label: '홈' },
  { key: 'students', label: '학생' },
  { key: 'exams', label: '시험지' },
  { key: 'grading', label: '채점' },
  { key: 'report', label: '리포트' },
  { key: 'types', label: '유형 분석' },
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
  // 시험지는 저장소의 papers/ 에서만 들어온다. 열 때 한 번 맞춰 준다.
  const dataRef = useRef(data);
  dataRef.current = data;
  const synced = useRef(false);
  useEffect(() => {
    if (synced.current) return;
    synced.current = true;
    syncExamsFromPapers(dataRef.current).then((exams) => {
      // 바뀐 게 없으면 null이라 저장도 동기화도 일어나지 않는다.
      if (exams) setData({ ...dataRef.current, exams });
    });
  }, [setData]);

  const importJson = async (file: File) => {
    try {
      setData(parseAssessmentJson(await file.text()));
      notify('가져오기', '불러왔습니다.');
    } catch (e) {
      notify('가져오기', 'JSON을 읽지 못했습니다.', (e as Error).message);
    }
  };

  // 채점 화면에 저장 안 한 입력이 있으면 떠나기 전에 한 번 묻는다.
  const go = async (target: View) => {
    if (target === view) return;
    if (await canLeave()) setView(target);
  };
  const goHome = (target: HomeTarget) => void go(target);
  const navActive = (key: View) => view === key;

  return (
    <div className="app">
      <header className="app-header no-print">
        <div className="brand">
          <Logo size={32} />
          <button className="brand-title" onClick={() => void go('home')}>
            알파학원 진단평가 분석
          </button>
        </div>

        <nav className="assess-tabs">
          {NAV.map((t) => (
            <button key={t.key} className={navActive(t.key) ? 'active' : ''} onClick={() => void go(t.key)}>
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
            <ExamManager data={data} />
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

      {view === 'types' && (
        <main className="pane">
          <TypesPage />
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
      <NoticeHost />
    </div>
  );
}
