import { afterEach, describe, expect, it, vi } from 'vitest';
import { BASE_DETERGENTS, BASE_TOOLS } from './catalog';
import { grantsUpTo } from './levels';
import { restorePendingNewItems, splitNewItems } from './newItems';
import { getStore, loadStore, persist, resetStore } from '../storage';

describe('알림 대기 저장 — 앱을 껐다 켜도 미룬 알림이 이어진다', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('깨진 값·중복·보유하지 않은 아이템은 버린다', () => {
    expect(restorePendingNewItems(undefined, ['sponge'])).toEqual([]);
    expect(restorePendingNewItems('sponge', ['sponge'])).toEqual([]);
    expect(restorePendingNewItems(['sponge', 'sponge', 3, 'ghost'], ['sponge'])).toEqual(['sponge']);
  });

  it('저장했다가 다시 불러오면 알림 대기 목록이 남아 있다 (재현: 전에는 메모리에만 있어 사라졌다)', async () => {
    const mem = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) });
    vi.useFakeTimers();
    resetStore();
    const st = getStore();
    st.owned = ['cloth', 'vacuum', 'sponge', 'det_all'];
    st.pendingNewItems = ['sponge', 'det_all'];
    persist();
    vi.advanceTimersByTime(500);
    st.pendingNewItems = []; // 앱 종료 = 메모리 내용 사라짐
    const loaded = await loadStore();
    expect(loaded.pendingNewItems).toEqual(['sponge', 'det_all']);
    resetStore();
    vi.advanceTimersByTime(500);
  });

  it('옛 저장(칸 없음)을 불러와도 빈 목록', async () => {
    vi.stubGlobal('localStorage', { getItem: () => JSON.stringify({ owned: ['cloth'] }), setItem: () => {} });
    expect((await loadStore()).pendingNewItems).toEqual([]);
    resetStore();
  });
});

describe('splitNewItems — 새 아이템 알림은 이 판에서 쓰는 것만', () => {
  it('이번 판 도구 칸에 없는 아이템은 알리지 않고 미룬다', () => {
    const r = splitNewItems([], ['cloth', 'det_all'], new Set(['cloth']));
    expect(r.announce).toEqual(['cloth']);
    expect(r.later).toEqual(['det_all']);
  });

  it('미뤄 둔 아이템은 도구 칸에 처음 나오는 판에서 알린다', () => {
    const r = splitNewItems(['det_all'], [], new Set(['cloth', 'det_all']));
    expect(r.announce).toEqual(['det_all']);
    expect(r.later).toEqual([]);
  });

  it('같은 아이템을 두 번 알리지 않는다', () => {
    const r = splitNewItems(['sponge'], ['sponge'], new Set(['sponge']));
    expect(r.announce).toEqual(['sponge']);
  });

  it('도구 칸에 아무것도 해당 없으면 알림 없음', () => {
    expect(splitNewItems([], ['det_all'], new Set()).announce).toEqual([]);
  });

  it('1판: 처음 받는 아이템 중 도구 칸(걸레·청소기)에 없는 것은 알림에서 빠진다', () => {
    const granted = grantsUpTo(1);
    const known = new Set([...Object.keys(BASE_TOOLS), ...Object.keys(BASE_DETERGENTS)]);
    for (const id of granted) expect(known.has(id), `${id} is a real item`).toBe(true);
    expect(granted.length).toBeGreaterThan(2); // 1판에서 쓰지 않는 것도 함께 지급된다 — 그래서 걸러야 한다
    const r = splitNewItems([], granted, new Set(['cloth', 'vacuum']));
    expect(r.announce.sort()).toEqual(['cloth', 'vacuum']);
    expect(r.later.length).toBe(granted.length - 2);
  });
});
