import { TypeStat } from '../lib/assessment';

// 정답률 구간. 색만으로 뜻을 전하면 색각 이상·흑백 인쇄에서 구분이 사라지므로
// 화면에는 항상 rateTag()의 글자 라벨을 함께 붙인다.
/** 이 위는 이미 자리 잡은 유형. 리포트 머리의 '강점 유형 N개'도 같은 선을 쓴다. */
export const STEADY = 0.8;
/** 이 아래는 보완할 유형. 종합 의견 초안도 같은 선에서 문장을 가른다. */
export const FAIR = 0.5;

export function rateColor(rate: number): string {
  if (rate >= STEADY) return '#0ca30c';
  if (rate >= FAIR) return '#fab219';
  return '#d03b3b';
}

export function rateTag(rate: number): { label: string; cls: string } {
  if (rate >= STEADY) return { label: '강점', cls: 'tag-good' };
  if (rate >= FAIR) return { label: '보통', cls: 'tag-warn' };
  // '약점'은 아이를 재는 말이고 '보완'은 무엇을 할지 가리키는 말이다.
  return { label: '보완', cls: 'tag-bad' };
}

/**
 * 평가원 행동 영역 넷. 수학 8유형이 둘씩 여기에 묶인다.
 *
 * 차례는 [유형 분석] 화면의 표와 같다. 도형에서도 이 차례를 지켜야 짝이
 * 붙어 있어 한 영역이 사분면 하나를 차지한다.
 */
const AREAS: { name: string; types: [string, string]; bg: string; ink: string }[] = [
  { name: '계산', types: ['연산 처리', '공식 활용'], bg: '#eef2fa', ink: '#2f4a86' },
  { name: '이해', types: ['개념 이해', '표현 해석'], bg: '#eef7f1', ink: '#2b6b45' },
  { name: '추론', types: ['규칙 발견', '근거 제시'], bg: '#faf3ea', ink: '#8a5a1e' },
  { name: '문제 해결', types: ['단계별 해결', '식 설정'], bg: '#f7eff3', ink: '#8a3a5c' },
];
const MATH_ORDER = AREAS.flatMap((a) => a.types);

/**
 * 과학 8유형. 평가원 평가 목표의 행동 영역이 그대로 여덟이라 둘씩 묶이지
 * 않는다. 바탕은 칠하지 않고 차례만 고정한다. 학생마다 같은 자리에 같은
 * 유형이 와야 여러 리포트를 나란히 놓고 볼 수 있다.
 */
const SCIENCE_ORDER = [
  '개념 이해',
  '적용',
  '문제 인식·가설',
  '탐구 설계',
  '탐구 수행',
  '자료 변환·해석',
  '결론·일반화',
  '의사소통',
];

// 리포트 한가운데에 크게 놓는 도형이다. 글자를 키운 만큼 라벨이 길어지므로
// 가로를 넉넉히 잡고(560), 세로는 라벨이 실제로 차지하는 만큼만 남긴다.
const W = 560;
// 라벨이 두 줄(이름 + 정답률)일 때의 높이다. plain 은 한 줄이라 아래가 남는다.
const H = 380;
const H_PLAIN = 364;
const R = 140;
const LABEL_R = R + 18;

/**
 * plain 을 주면 꼭짓점에 영역 이름만 적고, 아니면 정답률까지 적는다.
 *
 * 학생 화면은 레이더 옆에 막대가 붙어 있어 정답률이 거기 있다. 레이더에 또
 * 적으면 같은 값이 두 번 나온다. 리포트 1쪽은 레이더만 나가므로 정답률을 적는다.
 * 강점·보완 글자는 양쪽 다 적지 않는다.
 */
export default function TypeRadar({ stats, plain }: { stats: TypeStat[]; plain?: boolean }) {
  if (stats.length < 3) {
    return <p className="muted">레이더 차트는 유형이 3개 이상일 때 표시됩니다.</p>;
  }
  const cx = W / 2;
  const h = plain ? H_PLAIN : H;
  // 위아래 라벨이 두 줄이라 아래가 더 길다. 그만큼 중심을 위로 올려 둔다.
  const cy = plain ? 182 : 186;
  const n = stats.length;

  // 아는 8유형이 그대로 다 있으면 차례를 고정한다. 수학은 평가원 영역 넷으로
  // 묶어 바탕까지 칠하고, 과학은 묶이지 않으므로 차례만 고정한다.
  const byType = new Map(stats.map((s) => [s.type, s]));
  const fits = (order: string[]) => n === order.length && order.every((t) => byType.has(t));
  const grouped = fits(MATH_ORDER);
  const fixed = grouped || fits(SCIENCE_ORDER);
  const order = grouped ? MATH_ORDER : SCIENCE_ORDER;
  const list = fixed ? order.map((t) => byType.get(t) as TypeStat) : stats;

  // 차례를 고정하지 않을 때는 각 유형이 차지하는 각도를 문제 수에 비례하게
  // 잡되, 균등 배치와 섞어(BLEND) 한 유형이 각을 독차지해 도형이 지나치게
  // 찌그러지는 것을 막는다.
  const totalQ = list.reduce((sum, s) => sum + s.total, 0) || 1;
  const BLEND = 0.5;
  const share = list.map((s) => (1 - BLEND) / n + BLEND * (s.total / totalQ));
  let acc = 0;
  const centerFrac = list.map((_, i) => {
    const c = acc + share[i] / 2;
    acc += share[i];
    return c;
  });
  // 고정할 때는 여덟 유형을 45°씩 똑같이 나눈다. 그래야 영역이 90°씩 반듯하게
  // 떨어진다. 문항 수 차이는 옆의 막대와 표에 남아 있다.
  const angleOf = (i: number) =>
    fixed ? ((-67.5 + i * 45) * Math.PI) / 180 : -Math.PI / 2 + 2 * Math.PI * centerFrac[i];
  const ptOf = (i: number, r: number): [number, number] => [
    cx + r * Math.cos(angleOf(i)),
    cy + r * Math.sin(angleOf(i)),
  ];
  const at = (deg: number, r: number): [number, number] => [
    cx + r * Math.cos((deg * Math.PI) / 180),
    cy + r * Math.sin((deg * Math.PI) / 180),
  ];
  const dataPoly = list
    .map((s, i) => ptOf(i, R * s.rate).map((v) => v.toFixed(1)).join(','))
    .join(' ');
  const shorten = (t: string) => (t.length > 12 ? t.slice(0, 11) + '…' : t);

  /** 중심에서 뻗은 90° 부채꼴. 영역 하나의 바탕이 된다. */
  const wedge = (from: number) => {
    const [x0, y0] = at(from, R);
    const [x1, y1] = at(from + 90, R);
    return `M${cx},${cy} L${x0.toFixed(1)},${y0.toFixed(1)} A${R},${R} 0 0 1 ${x1.toFixed(1)},${y1.toFixed(1)} Z`;
  };
  // 바깥 여백의 네 귀퉁이. 영역 이름을 여기에도 한 번 적는다.
  const CORNER: { x: number; y: number; anchor: 'start' | 'end' }[] = [
    { x: W - 10, y: 24, anchor: 'end' },
    { x: W - 10, y: h - 12, anchor: 'end' },
    { x: 10, y: h - 12, anchor: 'start' },
    { x: 10, y: 24, anchor: 'start' },
  ];

  return (
    <svg className="type-radar" viewBox={`0 0 ${W} ${h}`} role="img" aria-label="유형별 정답률 레이더 차트">
      {/* 영역 바탕은 도형 뒤에 깔린다. */}
      {grouped && AREAS.map((a, g) => <path key={`bg-${a.name}`} d={wedge(-90 + g * 90)} fill={a.bg} />)}
      {[0.25, 0.5, 0.75, 1].map((ratio) => (
        <circle
          key={ratio}
          cx={cx}
          cy={cy}
          r={R * ratio}
          fill="none"
          stroke="#dfe2e8"
          strokeWidth={ratio === 1 ? 1.2 : 0.8}
        />
      ))}
      {list.map((_, i) => {
        const [x, y] = ptOf(i, R);
        return <line key={`axis-${i}`} x1={cx} y1={cy} x2={x} y2={y} stroke="#e7e9ed" strokeWidth={0.8} />;
      })}
      {/* 영역 경계는 흰 선으로 갈라 바탕색끼리 맞닿지 않게 한다. */}
      {grouped &&
        [0, 1, 2, 3].map((g) => {
          const [x, y] = at(-90 + g * 90, R);
          return <line key={`cut-${g}`} x1={cx} y1={cy} x2={x} y2={y} stroke="#fff" strokeWidth={1.6} />;
        })}
      {[0.25, 0.5, 0.75, 1].map((ratio) => (
        <text key={`ring-${ratio}`} x={cx + 5} y={cy - R * ratio - 3} fontSize={10} fill="#8a8f99">
          {Math.round(ratio * 100)}
        </text>
      ))}

      <polygon points={dataPoly} fill="rgba(22,34,78,0.14)" stroke="#16224e" strokeWidth={2.2} strokeLinejoin="round" />

      {/* 영역 이름은 도형 위에 얹는다. 뒤에 깔면 도형이 덮은 사분면만 흐려져
          네 이름이 서로 다른 밝기로 보인다. */}
      {grouped &&
        AREAS.map((a, g) => {
          const [x, y] = at(-45 + g * 90, R * 0.58);
          return (
            <text
              key={`in-${a.name}`}
              x={x.toFixed(1)}
              y={(y + 8).toFixed(1)}
              textAnchor="middle"
              fontSize={24}
              fontWeight={700}
              fill={a.ink}
              opacity={0.42}
            >
              {a.name}
            </text>
          );
        })}

      {list.map((s, i) => {
        const [x, y] = ptOf(i, R * s.rate);
        return (
          <circle key={`dot-${i}`} cx={x} cy={y} r={5} fill={rateColor(s.rate)} stroke="#fff" strokeWidth={1.6}>
            <title>{`${s.type} ${Math.round(s.rate * 100)}% (${s.correct}/${s.total})`}</title>
          </circle>
        );
      })}

      {grouped &&
        AREAS.map((a, g) => (
          <text
            key={`co-${a.name}`}
            x={CORNER[g].x}
            y={CORNER[g].y}
            textAnchor={CORNER[g].anchor}
            fontSize={14}
            fontWeight={700}
            fill={a.ink}
          >
            {a.name}
          </text>
        ))}

      {list.map((s, i) => {
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
            {!plain && (
              <text x={x} y={y + dy + 17} fontSize={13.5} fontWeight={700} fill={rateColor(s.rate)}>
                {Math.round(s.rate * 100)}%
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
