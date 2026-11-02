import type { CapacitorConfig } from '@capacitor/cli';

// TODO(출시 전): appId 최종 확정. 변경 시 android/ios 프로젝트를 다시 생성해야 함.
const config: CapacitorConfig = {
  appId: 'com.sparkleclean.app',
  appName: 'Sparkle Clean',
  webDir: 'dist',
  backgroundColor: '#e9f7f6',
  android: { allowMixedContent: false },
  ios: { contentInset: 'never' },
};

export default config;
