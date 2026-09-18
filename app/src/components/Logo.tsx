import { logoUrl } from '../lib/brand';

// 원본 로고는 정사각형 안에 α 마크 아래로 '알파학원' 글자가 붙어 있다.
// 헤더 크기(30~36px)로 줄이면 그 글자가 뭉개져 오히려 지저분하므로 α 마크만 잘라 쓴다.
// 아래 세 값은 원본 이미지에서 마크가 차지하는 영역의 비율.
const MARK_SCALE = 0.455;
const MARK_LEFT = 0.27;
const MARK_TOP = 0.165;

export default function Logo({ size = 32 }: { size?: number }) {
  if (logoUrl) {
    const img = Math.round(size / MARK_SCALE);
    return (
      <span className="brand-mark" style={{ width: size, height: size }}>
        <img
          src={logoUrl}
          alt="알파학원 로고"
          style={{
            width: img,
            height: img,
            left: -Math.round(img * MARK_LEFT),
            top: -Math.round(img * MARK_TOP),
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
