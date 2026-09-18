import { logoUrl } from '../lib/brand';

// 업로드된 로고가 있으면 그 이미지를, 없으면 기본 알파(α) SVG를 렌더링
export default function Logo({ size = 48 }: { size?: number }) {
  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        width={size}
        height={size}
        alt="알파학원 로고"
        style={{ objectFit: 'contain', display: 'block' }}
      />
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
