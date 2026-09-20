import { TypeStat, fmtPoints } from '../lib/assessment';
import { rateColor, rateTag } from './TypeRadar';

/**
 * 유형별 정답률 막대. 색 옆에 '보완/보통/강점' 글자를 붙여 색각 이상이나
 * 흑백 인쇄에서도 구분이 남게 한다.
 *
 * showTag 를 false 로 주면 그 글자를 뺀다. 학생 화면은 아래 표에 같은 값이
 * 또 있어 두 번 읽게 된다. 인쇄로 나가는 리포트에서는 붙인 채로 둔다.
 */
export default function TypeBars({ stats, showTag = true }: { stats: TypeStat[]; showTag?: boolean }) {
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
            {/* 왼쪽 %는 문항 개수로 잰 정답률이고, 여기는 배점까지 반영한 득점이다.
                어려운 문항을 틀렸는지가 이 칸에서 드러난다. */}
            <div className="type-bar-count">
              {fmtPoints(s.earned)}/{fmtPoints(s.points)}점
            </div>
            {showTag && <div className={`type-bar-tag ${tag.cls}`}>{tag.label}</div>}
          </div>
        );
      })}
    </div>
  );
}
