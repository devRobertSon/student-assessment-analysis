import { TypeStat } from '../lib/assessment';

// 정답률 구간. 색만으로 뜻을 전하면 색각 이상·흑백 인쇄에서 구분이 사라지므로
// 화면에는 항상 rateTag()의 글자 라벨을 함께 붙인다.
export function rateColor(rate: number): string {
  if (rate >= 0.8) return '#0ca30c';
  if (rate >= 0.5) return '#fab219';
  return '#d03b3b';
}

export function rateTag(rate: number): { label: string; cls: string } {
  if (rate >= 0.8) return { label: '강점', cls: 'tag-good' };
  if (rate >= 0.5) return { label: '보통', cls: 'tag-warn' };
  return { label: '약점', cls: 'tag-bad' };
}

// 리포트 한가운데에 크게 놓는 도형이다. 글자를 키운 만큼 라벨이 길어지므로
// 가로를 넉넉히 잡고(560), 세로는 라벨이 실제로 차지하는 만큼만 남긴다(380).
const W = 560;
const H = 380;
const R = 140;
const LABEL_R = R + 18;

export default function TypeRadar({ stats }: { stats: TypeStat[] }) {
  if (stats.length < 3) {
    return <p className="muted">레이더 차트는 유형이 3개 이상일 때 표시됩니다.</p>;
  }
  const cx = W / 2;
  // 위아래 라벨이 두 줄이라 아래가 더 길다. 그만큼 중심을 위로 올려 둔다.
  const cy = 186;
  const n = stats.length;
  // 각 유형이 차지하는 각도를 문제 수에 비례하게 — 단, 균등 배치와 섞어(BLEND)
  // 한 유형이 각을 독차지해 도형이 지나치게 찌그러지는 것을 막는다.
  const totalQ = stats.reduce((sum, s) => sum + s.total, 0) || 1;
  const BLEND = 0.5;
  const share = stats.map((s) => (1 - BLEND) / n + BLEND * (s.total / totalQ));
  let acc = 0;
  const centerFrac = stats.map((_, i) => {
    const c = acc + share[i] / 2;
    acc += share[i];
    return c;
  });
  const angleOf = (i: number) => -Math.PI / 2 + 2 * Math.PI * centerFrac[i];
  const ptOf = (i: number, r: number): [number, number] => [
    cx + r * Math.cos(angleOf(i)),
    cy + r * Math.sin(angleOf(i)),
  ];
  const dataPoly = stats
    .map((s, i) => ptOf(i, R * s.rate).map((v) => v.toFixed(1)).join(','))
    .join(' ');
  const shorten = (t: string) => (t.length > 12 ? t.slice(0, 11) + '…' : t);

  return (
    <svg className="type-radar" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="유형별 정답률 레이더 차트">
      {[0.25, 0.5, 0.75, 1].map((ratio) => (
        <circle
          key={ratio}
          cx={cx}
          cy={cy}
          r={R * ratio}
          fill={ratio === 1 ? '#fbfcfd' : 'none'}
          stroke="#dfe2e8"
          strokeWidth={ratio === 1 ? 1.2 : 0.8}
        />
      ))}
      {stats.map((_, i) => {
        const [x, y] = ptOf(i, R);
        return <line key={`axis-${i}`} x1={cx} y1={cy} x2={x} y2={y} stroke="#e7e9ed" strokeWidth={0.8} />;
      })}
      {[0.25, 0.5, 0.75, 1].map((ratio) => (
        <text key={`ring-${ratio}`} x={cx + 5} y={cy - R * ratio - 3} fontSize={10} fill="#8a8f99">
          {Math.round(ratio * 100)}
        </text>
      ))}

      <polygon points={dataPoly} fill="rgba(22,34,78,0.14)" stroke="#16224e" strokeWidth={2.2} strokeLinejoin="round" />

      {stats.map((s, i) => {
        const [x, y] = ptOf(i, R * s.rate);
        return (
          <circle key={`dot-${i}`} cx={x} cy={y} r={5} fill={rateColor(s.rate)} stroke="#fff" strokeWidth={1.6}>
            <title>{`${s.type} ${Math.round(s.rate * 100)}% (${s.correct}/${s.total})`}</title>
          </circle>
        );
      })}

      {stats.map((s, i) => {
        const a = angleOf(i);
        const cos = Math.cos(a);
        const sin = Math.sin(a);
        const [x, y] = ptOf(i, LABEL_R);
        const anchor = Math.abs(cos) < 0.35 ? 'middle' : cos > 0 ? 'start' : 'end';
        const dy = sin < -0.35 ? -9 : sin > 0.35 ? 12 : 0;
        return (
          <g key={`label-${i}`} textAnchor={anchor}>
            <text x={x} y={y + dy} fontSize={15} fontWeight={700} fill="#16181c">
              {shorten(s.type)}
              <title>{s.type}</title>
            </text>
            {/* 막대를 뺐으므로 강점/약점을 색으로만 알리게 된다.
                흑백 인쇄와 색각 이상에서도 읽히도록 글자 라벨을 % 옆에 붙인다. */}
            <text x={x} y={y + dy + 17} fontSize={13.5} fontWeight={700} fill={rateColor(s.rate)}>
              {Math.round(s.rate * 100)}%
              <tspan fontSize={11.5} fontWeight={600} fill="#5b606b">
                {' '}
                {rateTag(s.rate).label}
              </tspan>
            </text>
          </g>
        );
      })}
    </svg>
  );
}
