import type { CapacitorConfig } from '@capacitor/cli';

// 앱 ID 확정(2026-11-10): GitHub 도메인 기반. 스토어 등록 후에는 바꿀 수 없다.
const config: CapacitorConfig = {
  appId: 'io.github.parksangjun.cleaningday',
  appName: 'Sparkle Clean',
  webDir: 'dist',
  backgroundColor: '#e9f7f6',
  android: { allowMixedContent: false },
  ios: { contentInset: 'never' },
};

export default config;
