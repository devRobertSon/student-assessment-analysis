import { AREAS } from './TypeRadar';

/**
 * 홈 화면의 8각형 레이더.
 *
 * 리포트가 무엇을 그려 주는지 처음 여는 사람에게 미리 보여 주는 그림이다.
 * 정답률은 지어낸 예시 값이고, 아래 글로 예시라고 밝힌다. 학부모 앞에서
 * 여는 화면이라 실제 학생 값으로 오해되면 안 된다.
 *
 * 여덟 자리와 영역 색은 리포트의 레이더(TypeRadar)와 같다. 리포트는 눈금이
 * 원이지만 여기는 8각형으로 그린다(2026-10-14 원장님 말씀).
 */
const SAMPLE = [0.9, 0.82, 0.86, 0.72, 0.6, 0.66, 0.7, 0.78];

const W = 520;
const H = 400;
const CX = W / 2;
const CY = 198;
const R = 150;
const LABEL_R = R + 16;
/** 8각형 변의 가운데까지 거리. 영역 경계(0° · 90° …)가 꼭짓점이 아니라 변 위에 온다. */
const EDGE_MID = R * Math.cos(Math.PI / 8);

const TYPES = AREAS.flatMap((a) => a.types);
/** i 번째 유형의 각도. 리포트와 같이 맨 위에서 22.5° 비켜 45°씩 돈다. */
const deg = (i: number) => -67.5 + i * 45;
const at = (d: number, r: number): [number, number] => [
  CX + r * Math.cos((d * Math.PI) / 180),
  CY + r * Math.sin((d * Math.PI) / 180),
];
const pts = (list: [number, number][]) => list.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
const ring = (r: number) => pts(TYPES.map((_, i) => at(deg(i), r)));

/** 한 영역의 바탕. 중심에서 두 꼭짓점을 감싸고 양쪽 변의 가운데까지 간다. */
const areaShape = (g: number) =>
  pts([
    [CX, CY],
    at(-90 + g * 90, EDGE_MID),
    at(deg(g * 2), R),
    at(deg(g * 2 + 1), R),
    at(g * 90, EDGE_MID),
  ]);

export default function HomeRadar() {
  const shape = SAMPLE.map((v, i) => at(deg(i), R * v));
  return (
    <figure className="home-radar">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="수학 8유형 레이더 차트 예시">
        {AREAS.map((a, g) => (
          <polygon key={`bg-${a.name}`} points={areaShape(g)} fill={a.bg} />
        ))}
        {[0.25, 0.5, 0.75, 1].map((ratio) => (
          <polygon
            key={ratio}
            points={ring(R * ratio)}
            fill="none"
            stroke="#d6dae2"
            strokeWidth={ratio === 1 ? 1.4 : 0.8}
          />
        ))}
        {TYPES.map((_, i) => {
          const [x, y] = at(deg(i), R);
          return <line key={`axis-${i}`} x1={CX} y1={CY} x2={x} y2={y} stroke="#e2e5ea" strokeWidth={0.8} />;
        })}
        {/* 영역 경계는 흰 선으로 나눠 바탕색끼리 붙지 않게 한다. */}
        {[0, 1, 2, 3].map((g) => {
          const [x, y] = at(-90 + g * 90, EDGE_MID);
          return <line key={`cut-${g}`} x1={CX} y1={CY} x2={x} y2={y} stroke="#fff" strokeWidth={1.6} />;
        })}

        <polygon points={pts(shape)} fill="rgba(22,34,78,0.14)" stroke="#16224e" strokeWidth={2.2} strokeLinejoin="round" />
        {shape.map(([x, y], i) => (
          <circle key={`dot-${i}`} cx={x} cy={y} r={4.5} fill="#16224e" stroke="#fff" strokeWidth={1.6} />
        ))}

        {/* 영역 이름은 도형 위에 얹는다. 뒤에 깔면 도형이 덮은 곳만 흐려진다.
            예시 값이 가장 낮은 곳도 반지름의 0.6 이라, 그보다 안쪽(0.38)에 두어
            도형의 선과 겹치지 않게 한다. 예시 값을 낮추면 '문제 해결' 이 선에 닿는다. */}
        {AREAS.map((a, g) => {
          const [x, y] = at(-45 + g * 90, R * 0.38);
          return (
            <text
              key={`in-${a.name}`}
              x={x.toFixed(1)}
              y={(y + 7).toFixed(1)}
              textAnchor="middle"
              fontSize={19}
              fontWeight={700}
              fill={a.ink}
              opacity={0.42}
            >
              {a.name}
            </text>
          );
        })}

        {TYPES.map((t, i) => {
          const a = (deg(i) * Math.PI) / 180;
          const [x, y] = at(deg(i), LABEL_R);
          const anchor = Math.abs(Math.cos(a)) < 0.35 ? 'middle' : Math.cos(a) > 0 ? 'start' : 'end';
          const dy = Math.sin(a) < -0.35 ? -6 : Math.sin(a) > 0.35 ? 14 : 4;
          return (
            <text key={`label-${t}`} className="rl" x={x} y={y + dy} textAnchor={anchor} fontSize={13} fontWeight={700} fill="#16181c">
              {t}
            </text>
          );
        })}
      </svg>
      <figcaption>
        리포트 예시입니다. 수학 여덟 유형을 평가원 행동 영역 넷으로 묶어, 학생의 유형별 정답률을 이 자리에 그립니다.
      </figcaption>
    </figure>
  );
}
