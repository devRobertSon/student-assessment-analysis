import { logoUrl } from '../lib/brand';

// 원본 로고(3378×3378)는 정사각형 안에 α 마크가 있고 그 아래 '알파학원' 글자가 붙어 있다.
// 헤더 크기(30~36px)로 줄이면 글자가 뭉개지므로 α 마크만 잘라 쓴다.
//
// 아래 값은 눈대중이 아니라 원본 픽셀에서 잰 마크의 경계다.
//   x 923~2508 (폭 1586), y 602~2150 (높이 1549)
// 마크가 정사각형이 아니고 이미지 정중앙에 있지도 않아서,
// 긴 변(폭)을 기준으로 배율을 잡고 마크의 중심을 컨테이너 중심에 맞춘다.
const MARK_W = 1586 / 3378; // 0.4695
const CENTER_X = (923 + 2508) / 2 / 3378; // 0.5078
const CENTER_Y = (602 + 2150) / 2 / 3378; // 0.4073
const FILL = 0.9; // 가장자리 여백 — 반올림으로 1px 잘리는 것까지 방지

export default function Logo({ size = 32 }: { size?: number }) {
  if (logoUrl) {
    const img = Math.round((size * FILL) / MARK_W);
    return (
      <span className="brand-mark" style={{ width: size, height: size }}>
        <img
          src={logoUrl}
          alt="알파학원 로고"
          style={{
            width: img,
            height: img,
            left: Math.round(size / 2 - CENTER_X * img),
            top: Math.round(size / 2 - CENTER_Y * img),
          }}
        />
      </span>
    );
  }
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-label="알파학원 로고" role="img">
      <defs>
        <linearGradient id="brand-ag" x1="15" y1="80" x2="85" y2="20" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#1C2B70" />
          <stop offset="0.55" stopColor="#2C6FC4" />
          <stop offset="1" stopColor="#57B2E6" />
        </linearGradient>
      </defs>
      <path
        d="M62 30c-14-6-32-1-38 13-6 15 3 30 18 32 11 1 20-6 24-16l6-26 -7 34c-1 8 3 12 9 11"
        fill="none"
        stroke="url(#brand-ag)"
        strokeWidth="12"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
