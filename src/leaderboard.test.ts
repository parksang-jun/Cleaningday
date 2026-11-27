import { describe, expect, it, vi } from 'vitest';
import { createLeaderboard, LEADERBOARD_ID, rankScore, type LeaderboardNative } from './leaderboard';

function fake(over: Partial<LeaderboardNative> = {}) {
  const native: LeaderboardNative = {
    signIn: vi.fn(async () => ({ signedIn: true })),
    submitScore: vi.fn(async () => {}),
    show: vi.fn(async () => {}),
    ...over,
  };
  return native;
}

describe('랭킹 점수', () => {
  it('모은 별을 모두 더한다', () => {
    expect(rankScore({ 1: 3, 2: 2, 3: 1 })).toBe(6);
    expect(rankScore({})).toBe(0);
  });
});

describe('랭킹 연동', () => {
  it('웹(네이티브 없음)에서는 아무것도 하지 않고 false', async () => {
    const lb = createLeaderboard(null);
    expect(await lb.start(10)).toBe(false);
    expect(await lb.submit(10)).toBe(false);
    expect(await lb.show(10)).toBe(false);
  });

  it('켤 때는 조용히 로그인하고 현재 점수를 올린다', async () => {
    const n = fake();
    const lb = createLeaderboard(n);
    expect(await lb.start(12)).toBe(true);
    expect(n.signIn).toHaveBeenCalledWith({ interactive: false });
    expect(n.submitScore).toHaveBeenCalledWith({ leaderboardId: LEADERBOARD_ID, score: 12 });
  });

  it('로그인되지 않았으면 점수를 보내지 않는다', async () => {
    const n = fake({ signIn: vi.fn(async () => ({ signedIn: false })) });
    const lb = createLeaderboard(n);
    expect(await lb.start(12)).toBe(false);
    expect(await lb.submit(13)).toBe(false);
    expect(n.submitScore).not.toHaveBeenCalled();
  });

  it('점수가 늘었을 때만 다시 보낸다', async () => {
    const n = fake();
    const lb = createLeaderboard(n);
    await lb.start(12);
    expect(await lb.submit(12)).toBe(false);
    expect(await lb.submit(11)).toBe(false);
    expect(await lb.submit(15)).toBe(true);
    expect(n.submitScore).toHaveBeenCalledTimes(2);
  });

  it('전송이 실패하면 다음에 같은 점수를 다시 보낸다', async () => {
    let fail = true;
    const n = fake({
      submitScore: vi.fn(async () => {
        if (fail) throw new Error('offline');
      }),
    });
    const lb = createLeaderboard(n);
    await lb.start(12);
    fail = false;
    expect(await lb.submit(12)).toBe(true);
  });

  it('순위표를 열 때는 로그인 창을 띄울 수 있고, 로그인 실패면 열지 않는다', async () => {
    const ok = fake();
    expect(await createLeaderboard(ok).show(5)).toBe(true);
    expect(ok.signIn).toHaveBeenCalledWith({ interactive: true });
    expect(ok.show).toHaveBeenCalledWith({ leaderboardId: LEADERBOARD_ID });

    const no = fake({ signIn: vi.fn(async () => ({ signedIn: false })) });
    expect(await createLeaderboard(no).show(5)).toBe(false);
    expect(no.show).not.toHaveBeenCalled();
  });

  it('네이티브 호출이 던져도 게임 쪽으로 예외가 새지 않는다', async () => {
    const n = fake({
      signIn: vi.fn(async () => {
        throw new Error('x');
      }),
    });
    expect(await createLeaderboard(n).start(1)).toBe(false);
    const m = fake({
      show: vi.fn(async () => {
        throw new Error('x');
      }),
    });
    expect(await createLeaderboard(m).show(1)).toBe(false);
  });
});

// 네이티브 쪽은 이 환경에서 컴파일할 수 없으므로, 서로 맞물려야 하는 이름만이라도 어긋나지 않게 지킨다.
describe('랭킹 네이티브 연결', async () => {
  const { readFileSync } = await import('node:fs');
  const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
  const pkg = 'android/app/src/main/java/io/github/parksangjun/cleaningday';

  it('iOS: 스토리보드가 가리키는 화면이 플러그인을 등록하고, 플러그인 이름·메서드가 웹과 같다', () => {
    const swift = read('ios/App/App/AppDelegate.swift');
    expect(read('ios/App/App/Base.lproj/Main.storyboard')).toContain('customClass="MainViewController" customModule="App"');
    expect(swift).toContain('class MainViewController: CAPBridgeViewController');
    expect(swift).toContain('registerPluginInstance(LeaderboardPlugin())');
    expect(swift).toContain('jsName = "Leaderboard"');
    for (const m of ['signIn', 'submitScore', 'show']) expect(swift).toContain(`CAPPluginMethod(name: "${m}"`);
  });

  it('iOS: Game Center 권한 파일이 빌드 설정에 연결돼 있다', () => {
    expect(read('ios/App/App/App.entitlements')).toContain('com.apple.developer.game-center');
    expect(read('ios/App/App.xcodeproj/project.pbxproj').match(/CODE_SIGN_ENTITLEMENTS = App\/App\.entitlements;/g)).toHaveLength(2);
  });

  it('Android: 플러그인 등록·이름·의존성·설정 값이 모두 있다', () => {
    const java = read(`${pkg}/LeaderboardPlugin.java`);
    expect(read(`${pkg}/MainActivity.java`)).toContain('registerPlugin(LeaderboardPlugin.class)');
    expect(java).toContain('@CapacitorPlugin(name = "Leaderboard")');
    for (const m of ['signIn', 'submitScore', 'show']) expect(java).toMatch(new RegExp(`@PluginMethod\\s+public void ${m}\\(`));
    expect(read('android/app/build.gradle')).toContain('play-services-games-v2');
    expect(read('android/app/src/main/AndroidManifest.xml')).toContain('com.google.android.gms.games.APP_ID');
    const strings = read('android/app/src/main/res/values/strings.xml');
    expect(strings).toContain('name="game_services_project_id"');
    expect(strings).toContain('name="leaderboard_total_stars"');
  });
});
