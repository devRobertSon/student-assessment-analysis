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
  // 시험지는 저장소의 papers/ 에서만 들어온다.
  const dataRef = useRef(data);
  dataRef.current = data;
  const setDataRef = useRef(setData);
  setDataRef.current = setData;
  /**
   * 열 때 한 번, 클라우드 상태가 바뀔 때, 그리고 시험지 수가 달라질 때 맞춘다.
   *
   * 로그인한 사람은 화면이 뜬 뒤에 클라우드 문서가 내려와 자료를 통째로
   * 덮어쓴다. 열 때 한 번만 맞추면, 저장소에 새로 올린 시험지가 그 덮어쓰기에
   * 묻혀 목록에서 사라진다. 다른 기기에서 옛 자료를 올려도 마찬가지다.
   * 그래서 덮어써진 뒤에 다시 맞춘다.
   *
   * 되돌이에 빠지지 않는다. 맞출 것이 없으면 null 이라 저장도 동기화도
   * 일어나지 않고, 한 번 채워 넣으면 그다음 번에 null 이 되어 멈춘다.
   */
  useEffect(() => {
    let alive = true;
    syncExamsFromPapers(dataRef.current).then((exams) => {
      if (alive && exams) setDataRef.current({ ...dataRef.current, exams });
    });
    return () => {
      alive = false;
    };
  }, [cloudStatus, data.exams.length]);

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
          <TypeReport data={data} studentId={studentId} setStudentId={setStudentId} />
        </main>
      )}
      <NoticeHost />
    </div>
  );
}
