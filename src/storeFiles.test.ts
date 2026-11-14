import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// store/app-ads.txt 가 AdMob 형식에 맞고, 앱에 박힌 AdMob 앱 ID 와 같은 게시자 계정을 가리키는지 확인한다.
const root = new URL('../', import.meta.url);
const read = (p: string) => readFileSync(new URL(p, root), 'utf8');

const TEST_PUBLISHER = 'pub-3940256099942544'; // Google 테스트 계정

function publisherFromAppId(src: string, label: string): string {
  const m = src.match(/ca-app-pub-(\d{16})~\d+/);
  if (!m) throw new Error(`${label}: AdMob 앱 ID 를 찾지 못함`);
  return `pub-${m[1]}`;
}

describe('store/app-ads.txt', () => {
  const lines = read('store/app-ads.txt')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));

  it('AdMob 형식(google.com, pub-…, DIRECT, f08c47fec0942fa0) 한 줄', () => {
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(/^google\.com, pub-\d{16}, DIRECT, f08c47fec0942fa0$/);
  });

  it('게시자 ID 가 Android·iOS 앱 ID 와 같은 계정이고 테스트 계정이 아님', () => {
    const pub = lines[0].split(',')[1].trim();
    expect(pub).not.toBe(TEST_PUBLISHER);
    expect(publisherFromAppId(read('android/app/src/main/AndroidManifest.xml'), 'Android')).toBe(pub);
    expect(publisherFromAppId(read('ios/App/App/Info.plist'), 'iOS')).toBe(pub);
  });
});
