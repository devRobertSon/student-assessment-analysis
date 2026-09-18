// src/lib/brand.ts — 업로드된 로고를 자동으로 사용
// app/src/assets/brand/ 폴더에 logo.png / logo.svg / logo.jpg 등이 있으면
// 그 파일을 앱 로고로 씁니다. 파일이 없으면 null → 컴포넌트가 기본 SVG로 대체.
const found = import.meta.glob(
  '../assets/brand/logo.{png,jpg,jpeg,svg,webp,PNG,JPG,JPEG,SVG,WEBP}',
  { eager: true, query: '?url', import: 'default' }
);

export const logoUrl: string | null = (Object.values(found)[0] as string | undefined) ?? null;

// 리포트 하단 직인(도장). app/src/assets/brand/seal.{png,svg,...}이 있으면 그 이미지를,
// 없으면 컴포넌트가 자동 생성 도장(SVG)으로 대체.
const sealFound = import.meta.glob(
  '../assets/brand/seal.{png,jpg,jpeg,svg,webp,PNG,JPG,JPEG,SVG,WEBP}',
  { eager: true, query: '?url', import: 'default' }
);
export const sealUrl: string | null = (Object.values(sealFound)[0] as string | undefined) ?? null;
