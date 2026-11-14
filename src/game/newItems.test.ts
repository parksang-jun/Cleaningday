import { describe, expect, it } from 'vitest';
import { splitNewItems } from './newItems';

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
});
