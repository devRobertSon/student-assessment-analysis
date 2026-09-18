import { TypeStat } from '../lib/assessment';
import { rateColor, rateTag } from './TypeRadar';

// 유형별 정답률 막대. 색 옆에 항상 '약점/보통/강점' 글자를 붙여
// 색각 이상이나 흑백 인쇄에서도 구분이 남게 한다.
export default function TypeBars({ stats }: { stats: TypeStat[] }) {
  if (stats.length === 0) return <p className="muted">표시할 데이터가 없습니다.</p>;
  return (
    <div className="type-bars">
      {stats.map((s) => {
        const tag = rateTag(s.rate);
        return (
          <div key={s.type} className="type-bar-row">
            <div className="type-bar-label" title={s.type}>
              {s.type}
            </div>
            <div className="type-bar-track">
              <div
                className="type-bar-fill"
                style={{ width: `${Math.round(s.rate * 100)}%`, background: rateColor(s.rate) }}
              />
            </div>
            <div className="type-bar-val">{Math.round(s.rate * 100)}%</div>
            <div className="type-bar-count">
              {s.correct}/{s.total}
            </div>
            <div className={`type-bar-tag ${tag.cls}`}>{tag.label}</div>
          </div>
        );
      })}
    </div>
  );
}
