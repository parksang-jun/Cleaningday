import { defineConfig } from 'vitest/config';

// 모바일 WebView(Capacitor)와 웹 포털(Poki/CrazyGames) 양쪽에서 쓰는 단일 빌드
export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    outDir: 'dist',
    sourcemap: false,
    assetsInlineLimit: 8192,
  },
  server: { host: true, port: 5173 },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
