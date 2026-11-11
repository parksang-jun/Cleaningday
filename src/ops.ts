// 운영(관리자) 데이터 — 광고 제품 목록 관리, 쇼호스트 설정, 이벤트 집계, 설정 내보내기/가져오기
// 실서비스: 이 JSON 을 원격 설정(CDN/Supabase)에 올리고 앱이 시작 시 받아오면 같은 구조로 그대로 동작한다.
import { Capacitor } from '@capacitor/core';
import { onTrack } from './analytics';
import { BASE_DETERGENTS, BASE_TOOLS, DIRT_TYPES, type DirtType } from './game/catalog';
import { realSponsors } from './game/realProducts';
import { SAMPLE_SPONSORS, validateSponsor, type SponsorProduct } from './game/sponsor';
import { DEFAULT_HOST, getStore, persist, type HostConfig } from './storage';

/** 내장 제품 = 실제 판매 제품(제휴 추천) + 가상 샘플 광고주 */
export function builtInSponsors(): SponsorProduct[] {
  return [...realSponsors(import.meta.env as unknown as Record<string, string | undefined>), ...SAMPLE_SPONSORS];
}

/** 내장(실제 제품·샘플) + 덮어쓰기 + 운영자 추가 제품 (id 중복이면 운영자 제품이 우선). 우선순위 높은 순 */
export function sponsorList(): SponsorProduct[] {
  const ops = getStore().ops;
  const custom = new Map(ops.sponsors.map((p) => [p.id, { ...p, custom: true }]));
  const builtIn = builtInSponsors()
    .filter((p) => !custom.has(p.id))
    .map((p) => ({ ...p, ...(ops.overrides[p.id] ?? {}), links: { ...(p.links ?? {}), ...(ops.overrides[p.id]?.links ?? {}) } }));
  return [...builtIn, ...custom.values()].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
}

export function findSponsor(id: string): SponsorProduct | undefined {
  return sponsorList().find((p) => p.id === id);
}

/** 저장 — 내장 제품이면 덮어쓰기로, 아니면 운영자 제품으로 */
export function saveSponsor(p: SponsorProduct): void {
  const ops = getStore().ops;
  const builtIn = builtInSponsors().find((b) => b.id === p.id);
  if (builtIn && !p.custom) {
    const { custom: _c, ...rest } = p;
    ops.overrides[p.id] = rest;
  } else {
    const i = ops.sponsors.findIndex((x) => x.id === p.id);
    const next = { ...p, custom: true };
    if (i >= 0) ops.sponsors[i] = next;
    else ops.sponsors.push(next);
  }
  persist();
}

export function removeSponsor(id: string): void {
  const ops = getStore().ops;
  ops.sponsors = ops.sponsors.filter((p) => p.id !== id);
  delete ops.overrides[id];
  persist();
}

export function setSponsorStatus(id: string, status: 'active' | 'paused'): void {
  const p = findSponsor(id);
  if (!p) return;
  saveSponsor({ ...p, status });
}

export function hostConfig(): HostConfig {
  return getStore().ops.host;
}

export function saveHostConfig(h: Partial<HostConfig>): void {
  Object.assign(getStore().ops.host, h);
  persist();
}

// ---------- 관리자 테스트 플레이 ----------
/** 모든 판 열기 토글 (관리자 모드 빌드에서만 효력) */
export function setTestUnlock(on: boolean): void {
  getStore().ops.testUnlock = on;
  persist();
}
/** 테스트용 지급: 코인·부스터·프리미엄 장비 */
export function grantForTest(kind: 'coins' | 'boosters' | 'premium' | 'premiumOff'): void {
  const st = getStore();
  if (kind === 'coins') st.coins += 1000;
  else if (kind === 'boosters') for (const k of Object.keys(st.boosters) as (keyof typeof st.boosters)[]) st.boosters[k] += 5;
  else if (kind === 'premium') {
    for (const id of Object.keys(BASE_TOOLS)) if (BASE_TOOLS[id as keyof typeof BASE_TOOLS].premium && !st.owned.includes(id)) st.owned.push(id);
    for (const id of Object.keys(BASE_DETERGENTS)) if (BASE_DETERGENTS[id as keyof typeof BASE_DETERGENTS].premium && !st.owned.includes(id)) st.owned.push(id);
  } else {
    const prem = new Set([...Object.keys(BASE_TOOLS).filter((id) => BASE_TOOLS[id as keyof typeof BASE_TOOLS].premium), ...Object.keys(BASE_DETERGENTS).filter((id) => BASE_DETERGENTS[id as keyof typeof BASE_DETERGENTS].premium)]);
    st.owned = st.owned.filter((id) => !prem.has(id));
  }
  persist();
}

/** 쇼호스트·광고 관련 이벤트를 집계 (관리자 통계) */
const COUNTED = new Set(['host_show', 'host_cta_trial', 'host_cta_buy', 'host_close', 'sponsor_evidence_view', 'sponsor_item_select', 'mall_click', 'level_complete', 'level_fail', 'level_start', 'shop_buy', 'hint_revealed']);
export function installOpsCounters(): void {
  onTrack((name, params) => {
    if (!COUNTED.has(name)) return;
    const sponsor = String(params?.sponsor ?? params?.id ?? '');
    const place = String(params?.placement ?? params?.from ?? '');
    const key = `${name}|${sponsor}|${place}`;
    const c = getStore().ops.counters;
    c[key] = (c[key] ?? 0) + 1;
    persist();
  });
}

export interface CounterRow {
  event: string;
  sponsor: string;
  placement: string;
  n: number;
}
export function counterRows(): CounterRow[] {
  return Object.entries(getStore().ops.counters)
    .map(([k, n]) => {
      const [event, sponsor, placement] = k.split('|');
      return { event, sponsor, placement, n };
    })
    .sort((a, b) => b.n - a.n);
}
export function sumCounter(event: string, sponsor?: string, placement?: string): number {
  return counterRows()
    .filter((r) => r.event === event && (sponsor === undefined || r.sponsor === sponsor) && (placement === undefined || r.placement === placement))
    .reduce((a, r) => a + r.n, 0);
}
export function resetCounters(): void {
  getStore().ops.counters = {};
  persist();
}

/** 원격 설정으로 올릴 JSON (제품 전체 + 쇼호스트 설정) */
export function exportConfig(): string {
  return JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), host: hostConfig(), sponsors: sponsorList() }, null, 2);
}

export function importConfig(json: string): { ok: true; count: number } | { ok: false; error: string } {
  try {
    const data = JSON.parse(json) as { host?: Partial<HostConfig>; sponsors?: SponsorProduct[] };
    if (!Array.isArray(data.sponsors)) return { ok: false, error: 'sponsors 배열이 없습니다' };
    const ops = getStore().ops;
    ops.sponsors = [];
    ops.overrides = {};
    for (const p of data.sponsors) {
      if (!p || typeof p.id !== 'string' || !p.id) continue;
      saveSponsor(p);
    }
    if (data.host) ops.host = { ...DEFAULT_HOST, ...data.host };
    persist();
    return { ok: true, count: data.sponsors.length };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** 운영자 모드 사용 가능 여부 — 웹은 기본 켬, 앱(Android/iOS) 빌드는 기본 숨김. VITE_ADMIN=on|off 로 강제 */
export function adminEnabled(): boolean {
  const v = import.meta.env.VITE_ADMIN;
  if (v === 'on') return true;
  if (v === 'off') return false;
  return !Capacitor.isNativePlatform();
}
export function adminPin(): string {
  return String(import.meta.env.VITE_ADMIN_PIN ?? '1234');
}

/** 새 제품 템플릿 */
export function blankSponsor(): SponsorProduct {
  const today = new Date().toISOString().slice(0, 10);
  const end = new Date(Date.now() + 90 * 86400e3).toISOString().slice(0, 10);
  return {
    id: `sp-${Date.now().toString(36)}`,
    brand: '',
    name: '',
    kind: 'detergent',
    base: 'allpurpose',
    lab: [],
    cautions: [],
    evidence: { lab: '', reportId: '', date: today, protocol: '' },
    campaign: { start: today, end },
    claims: [],
    reviews: { count: 0, rating: 0 },
    placements: { intro: true, struggle: true, result: true, shop: true },
    status: 'active',
    priority: 0,
    custom: true,
  };
}

export const BASE_CHOICES = {
  tool: Object.values(BASE_TOOLS).filter((t) => !t.premium).map((t) => t.id),
  detergent: Object.values(BASE_DETERGENTS).filter((d) => !d.premium).map((d) => d.id),
};
export const DIRT_CHOICES: DirtType[] = [...DIRT_TYPES];

export function sponsorIssues(p: SponsorProduct, today = new Date().toISOString().slice(0, 10)): string[] {
  return validateSponsor(p, today);
}
