import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 소스는 app/ 에 두고, 빌드 결과물은 레포의 docs/ 로 출력한다.
// GitHub Pages는 "Deploy from a branch → main / docs" 설정으로 그대로 서빙한다.
// base: 프로젝트 페이지이므로 레포명이 하위 경로가 된다.
export default defineConfig({
  plugins: [react()],
  base: '/student-assessment-analysis/',
  build: {
    outDir: '../docs',
    emptyOutDir: false, // docs/.nojekyll 을 지우지 않도록
    rollupOptions: {
      output: {
        // 해시 없는 고정 파일명 → 매 빌드마다 덮어써 docs/에 잔여 파일이 쌓이지 않게 함
        entryFileNames: 'assets/index.js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: (info) =>
          info.name && /\.css$/i.test(info.name) ? 'assets/index.css' : 'assets/[name].[ext]',
      },
    },
  },
});
