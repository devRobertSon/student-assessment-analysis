import { Exam, ExamQuestion, fmtPoints, isEssay, pointsOf, splitTypes } from '../lib/assessment';

/**
 * 시험지 한 장이 무엇으로 짜였는지 보는 칸.
 *
 * 문항을 하나씩 늘어놓으면 30줄을 읽어야 구성이 보인다. 축 하나씩 막대로
 * 그려도 마찬가지다. 영역은 유형마다 3문항 이상이 되도록 일부러 고르게
 * 배분한 축이라 막대가 여덟 줄 다 같아 보인다.
 *
 * 그래서 두 가지만 그린다.
 * - 교차표: 단원과 난이도를 겹쳐 본다. '소인수분해에 표준이 없다'처럼
 *   한 축만으로는 안 보이는 쏠림이 여기서 보인다.
 * - 문항 지도: 시험지 차례대로 놓아 어려운 문제가 어디에 몰렸는지 본다.
 */

/** 난이도는 차례가 정해져 있고 색에 뜻이 있다. 쉬움에서 어려움으로 간다. */
const LEVEL_ORDER = ['표준', '상', '최상'];
const NO_LEVEL = '적지 않음';
const LEVEL_HUE: Record<string, [string, string]> = {
  표준: ['#8fbf95', '#1d3d22'],
  상: ['#e8c069', '#4a3400'],
  최상: ['#d78b84', '#4d1410'],
  [NO_LEVEL]: ['#e4e6ea', '#5b606b'],
};

/** 단원 띠에 돌려 쓰는 색. 뜻이 없는 구분용이라 이름을 항상 함께 적는다. */
const UNIT_HUES = ['#16224e', '#3c5a9a', '#5b8fc9', '#8fb5d8', '#bcd3e8', '#9c8fc4', '#c08bb0', '#d9a066'];

const levelOf = (q: ExamQuestion) => q.level?.trim() || NO_LEVEL;
const unitOf = (q: ExamQuestion) => q.unit?.trim() || '단원 없음';

export default function ExamComposition({ exam }: { exam: Exam }) {
  const qs = exam.questions;
  const total = qs.length;
  const fullPoints = qs.reduce((a, q) => a + pointsOf(q), 0);
  const essay = qs.filter(isEssay).length;

  // 단원은 시험지에 나온 차례를 지킨다. 시험지가 단원 순으로 짜여 있다.
  const units: string[] = [];
  for (const q of qs) if (!units.includes(unitOf(q))) units.push(unitOf(q));
  const unitHue = new Map(units.map((u, i) => [u, UNIT_HUES[i % UNIT_HUES.length]]));

  const levels = [...LEVEL_ORDER, NO_LEVEL].filter((lv) => qs.some((q) => levelOf(q) === lv));

  const cell = (u: string, lv: string) => qs.filter((q) => unitOf(q) === u && levelOf(q) === lv).length;
  const rowSum = (u: string) => qs.filter((q) => unitOf(q) === u).length;
  const colSum = (lv: string) => qs.filter((q) => levelOf(q) === lv).length;
  const peak = Math.max(1, ...units.flatMap((u) => levels.map((lv) => cell(u, lv))));

  // 영역은 고르게 배분한 축이라 표로 그리지 않고 폭만 한 줄로 적는다.
  const typeCount = new Map<string, number>();
  for (const q of qs) for (const t of splitTypes(q.type)) typeCount.set(t, (typeCount.get(t) ?? 0) + 1);
  const typeNs = [...typeCount.values()];
  const typeLine = typeNs.length
    ? `영역 ${typeCount.size}종이 ${Math.min(...typeNs)}~${Math.max(...typeNs)}문항씩 들어 있습니다.`
    : '';

  return (
    <div className="xc">
      <div className="hint xc-top">
        {exam.title} · {total}문항 · 만점 {fmtPoints(fullPoints)}점
        {essay > 0 ? ` · 서술형 ${essay}문항` : ''}
      </div>

      <div className="xc-grid">
        <div className="xc-block">
          <div className="xc-head">
            <b>단원 · 난이도 구성</b>
            <span className="hint">
              {units.length}개 단원{levels.length > 0 ? ` · ${levels.length}단계` : ''}
            </span>
          </div>
          <table className="xc-cross">
            <thead>
              <tr>
                <th className="xc-cross-unit">단원</th>
                {levels.map((lv) => (
                  <th key={lv}>{lv}</th>
                ))}
                <th>계</th>
              </tr>
            </thead>
            <tbody>
              {units.map((u) => (
                <tr key={u}>
                  <td className="xc-cross-unit" title={u}>
                    {u}
                  </td>
                  {levels.map((lv) => {
                    const n = cell(u, lv);
                    return (
                      <td
                        key={lv}
                        // 0은 숫자 대신 · 로 두어 빈 곳이 먼저 눈에 띈다.
                        style={n ? { background: `rgba(60,90,154,${(0.1 + 0.3 * (n / peak)).toFixed(2)})` } : undefined}
                      >
                        {n || <span className="xc-zero">·</span>}
                      </td>
                    );
                  })}
                  <td className="xc-sum">{rowSum(u)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td className="xc-cross-unit">계</td>
                {levels.map((lv) => (
                  <td key={lv}>{colSum(lv)}</td>
                ))}
                <td className="xc-sum">{total}</td>
              </tr>
            </tfoot>
          </table>
          {typeLine && <div className="xc-note">{typeLine}</div>}
        </div>

        <div className="xc-block">
          <div className="xc-head">
            <b>문항 지도</b>
            <span className="hint">시험지 차례</span>
          </div>
          <div className="xc-map">
            {qs.map((q) => {
              const [bg, ink] = LEVEL_HUE[levelOf(q)] ?? LEVEL_HUE[NO_LEVEL];
              return (
                <div
                  key={q.no}
                  className={`xc-cellq${isEssay(q) ? ' essay' : ''}`}
                  title={`${q.no}번 · ${unitOf(q)} · ${levelOf(q)}${isEssay(q) ? ' · 서술형' : ''}`}
                >
                  <span className="xc-ubar" style={{ background: unitHue.get(unitOf(q)) }} />
                  <span className="xc-no" style={{ background: bg, color: ink }}>
                    {q.no}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="xc-legend">
            {levels.map((lv) => (
              <span key={lv}>
                <i style={{ background: LEVEL_HUE[lv]?.[0] }} />
                {lv}
              </span>
            ))}
            <span>
              <i className="essay" />
              서술형
            </span>
          </div>
          <div className="xc-legend">
            {units.map((u) => (
              <span key={u}>
                <i style={{ background: unitHue.get(u) }} />
                {u}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
