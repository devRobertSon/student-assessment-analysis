import { Exam, fmtPoints, isEssay, pointsOf, splitTypes } from '../lib/assessment';

/**
 * 시험지 한 장이 무엇으로 짜였는지 한눈에 보는 칸.
 *
 * 문항을 하나씩 늘어놓으면 30줄을 읽어야 구성이 보인다. 대신 영역·단원·난이도
 * 세 축으로 세어 띠와 막대로 그린다. 시험지를 고를 때 보는 것은 "어느 단원이
 * 몇 문항인가"이지 "17번 답이 무엇인가"가 아니다.
 */

/** 띠와 막대에 돌려 쓰는 색. 뜻이 없는 구분용이라 숫자를 항상 함께 적는다. */
const HUES = ['#16224e', '#3c5a9a', '#5b8fc9', '#7fb5d8', '#9c8fc4', '#c08bb0', '#d9a066', '#8aa87a'];

/** 난이도는 순서가 정해져 있고 색에 뜻이 있다. 쉬움에서 어려움으로 간다. */
const LEVEL_ORDER = ['표준', '상', '최상'];
const LEVEL_HUE: Record<string, string> = { 표준: '#4f9e58', 상: '#e0a32c', 최상: '#c2473f' };

interface Slice {
  key: string;
  n: number;
  points: number;
  hue: string;
}

function Block({ title, note, slices, total }: { title: string; note: string; slices: Slice[]; total: number }) {
  if (slices.length === 0) return null;
  return (
    <div className="xc-block">
      <div className="xc-head">
        <b>{title}</b>
        <span className="hint">{note}</span>
      </div>
      {/* 띠 하나로 비율을 먼저 보여주고, 아래 막대에서 이름과 개수를 읽는다. */}
      <div className="xc-stack" role="img" aria-label={`${title} 비율`}>
        {slices.map((s) => (
          <span key={s.key} style={{ width: `${(s.n / total) * 100}%`, background: s.hue }} title={`${s.key} ${s.n}문항`} />
        ))}
      </div>
      <div className="xc-rows">
        {slices.map((s) => (
          <div key={s.key} className="xc-row">
            <span className="xc-dot" style={{ background: s.hue }} />
            <span className="xc-name" title={s.key}>
              {s.key}
            </span>
            <span className="xc-track">
              <span className="xc-fill" style={{ width: `${(s.n / total) * 100}%`, background: s.hue }} />
            </span>
            <span className="xc-n">{s.n}문항</span>
            <span className="xc-pct">{Math.round((s.n / total) * 100)}%</span>
            <span className="xc-pt">{fmtPoints(s.points)}점</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ExamComposition({ exam }: { exam: Exam }) {
  const total = exam.questions.length;
  const fullPoints = exam.questions.reduce((a, q) => a + pointsOf(q), 0);
  const essay = exam.questions.filter(isEssay).length;

  /** 한 축으로 세어 많은 것부터 늘어놓는다. order 를 주면 그 차례를 지킨다. */
  const tally = (of: (q: Exam['questions'][number]) => string[], order?: string[]): Slice[] => {
    const n = new Map<string, number>();
    const pt = new Map<string, number>();
    for (const q of exam.questions) {
      for (const k of of(q)) {
        n.set(k, (n.get(k) ?? 0) + 1);
        pt.set(k, (pt.get(k) ?? 0) + pointsOf(q));
      }
    }
    const keys = [...n.keys()].sort((a, b) =>
      order ? order.indexOf(a) - order.indexOf(b) : (n.get(b) ?? 0) - (n.get(a) ?? 0) || a.localeCompare(b, 'ko')
    );
    return keys.map((key, i) => ({
      key,
      n: n.get(key) ?? 0,
      points: pt.get(key) ?? 0,
      hue: order ? LEVEL_HUE[key] ?? HUES[i % HUES.length] : HUES[i % HUES.length],
    }));
  };

  const types = tally((q) => splitTypes(q.type));
  const units = tally((q) => (q.unit ? [q.unit] : []));
  // 난이도를 안 적은 문항이 있으면 그 줄을 따로 세워 합이 문항 수와 맞게 둔다.
  const levels = tally((q) => [q.level?.trim() || '적지 않음'], [...LEVEL_ORDER, '적지 않음']);
  const typeTotal = types.reduce((a, s) => a + s.n, 0);
  const unitTotal = units.reduce((a, s) => a + s.n, 0);

  return (
    <div className="xc">
      <div className="hint xc-top">
        {exam.title} · {total}문항 · 만점 {fmtPoints(fullPoints)}점
        {essay > 0 ? ` · 서술형 ${essay}문항` : ''}
      </div>
      <div className="xc-grid">
        <Block title="영역별 구성" note={`${types.length}종`} slices={types} total={typeTotal || 1} />
        <Block title="단원별 구성" note={`${units.length}개 단원`} slices={units} total={unitTotal || 1} />
        <Block title="난이도별 구성" note={`${levels.length}단계`} slices={levels} total={total || 1} />
      </div>
    </div>
  );
}
