import { AssessmentData, countTypes } from '../lib/assessment';

// 숫자가 적을 때는 보여주지 않는다. 학부모 앞에서 여는 화면이라
// "시험지 3개"처럼 빈약한 숫자는 오히려 안 보이는 편이 낫다.
const EXAM_MIN = 20;
const STUDENT_MIN = 50;

export type HomeTarget = 'students' | 'exams' | 'grading' | 'report';

const CARDS: { n: string; t: string; d: string; go: HomeTarget; accent?: boolean }[] = [
  { n: '01', t: '학생 관리', d: '이름과 학년을 등록하거나 CSV로 한 번에 불러옵니다.', go: 'students' },
  { n: '02', t: '시험지 관리', d: '시험지와 문제지·해설·출제표를 한자리에서 봅니다.', go: 'exams' },
  { n: '03', t: '채점 입력', d: 'O/X만 누르면 유형·단원·난이도로 자동 집계됩니다.', go: 'grading' },
  { n: '04', t: '리포트', d: '강점·약점을 레이더 차트로 보고 PDF로 저장합니다.', go: 'report', accent: true },
];

export default function HomePage({
  data,
  onGo,
}: {
  data: AssessmentData;
  onGo: (target: HomeTarget) => void;
}) {
  const types = countTypes(data.exams);
  const exams = data.exams.length;
  const students = data.students.length;

  const stats: { n: number; label: string }[] = [];
  if (types > 0) stats.push({ n: types, label: '분석 유형' });
  if (exams >= EXAM_MIN) stats.push({ n: exams, label: '진단 시험지' });
  if (students >= STUDENT_MIN) stats.push({ n: students, label: '진단 학생' });

  return (
    <div className="home">
      <div className="home-hero">
        <h1>
          정확한 진단에서
          <br />
          정확한 학습이 시작됩니다
        </h1>
        {stats.length > 0 && (
          <div className="home-stats">
            {stats.map((s) => (
              <div key={s.label} className="home-stat">
                <b>{s.n}</b>
                <span>{s.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="home-cards">
        {CARDS.map((c) => (
          <button key={c.n} className={`home-card ${c.accent ? 'accent' : ''}`} onClick={() => onGo(c.go)}>
            <span className="n">{c.n}</span>
            <span className="t">{c.t}</span>
            <span className="d">{c.d}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
