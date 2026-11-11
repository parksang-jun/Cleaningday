import { describe, expect, it } from 'vitest'
import { BASE_DETERGENTS, BASE_TOOLS } from './catalog'
import { activeAffiliates, activeSponsors, affiliateEntry, strengths } from './items'
import { REAL_PRODUCTS, realItemSpec, realSearchUrl, realSpeedup, realSponsors, toSponsor } from './realProducts'
import { validateSponsor } from './sponsor'

describe('real retail products (affiliate picks)', () => {
  it('every product maps to a base item of the right kind, has label text, and is a valid affiliate sponsor', () => {
    expect(REAL_PRODUCTS.length).toBeGreaterThanOrEqual(20)
    for (const p of REAL_PRODUCTS) {
      const tool = p.base in BASE_TOOLS
      expect(tool || p.base in BASE_DETERGENTS, `${p.id} base`).toBe(true)
      expect(p.kind, `${p.id} kind`).toBe(tool ? 'tool' : 'detergent')
      expect(p.use.length, `${p.id} use`).toBeGreaterThan(10)
      // 효능 수치·비교 주장 금지: 숫자 %나 "배" 가 라벨 설명에 없어야 한다
      expect(p.use + (p.caution ?? ''), `${p.id} no claims`).not.toMatch(/\d+\s*%|\d+\s*배|\d+x faster/)
      const sp = toSponsor(p)
      expect(sp.affiliate).toBe(true)
      expect(sp.lab).toEqual([])
      expect(validateSponsor(sp, '2026-11-11')).toEqual([])
      expect(sp.hostLines?.[p.market === 'coupang' ? 'ko' : p.market === 'amazon_jp' ? 'ja' : 'en']?.length).toBeGreaterThanOrEqual(1)
      expect(sp.links?.[p.market]).toMatch(/^https:\/\/(www\.coupang\.com|www\.amazon\.com|www\.amazon\.co\.jp)\//)
    }
  })

  it('real products play in-game with their type spec × published spec ratio (Dyson V16 315AW → faster than basic vacuum)', () => {
    const v16 = toSponsor(REAL_PRODUCTS.find((p) => p.id === 'kr-dyson-v16')!)
    const spec = realItemSpec(v16)
    expect(spec.id).toBe('sp:kr-dyson-v16')
    expect(spec.kind === 'tool' && spec.power).toBeCloseTo(1.8 * 1.15, 2)
    expect(realSpeedup(spec)).toBeGreaterThan(1.5)
    const k4 = realItemSpec(toSponsor(REAL_PRODUCTS.find((p) => p.id === 'kr-karcher-k4')!))
    expect(k4.kind === 'tool' && k4.power).toBeCloseTo(1.6 * 1.18, 2)
    // 세정제는 유형 기준 그대로 (효능 배율 없음)
    const yuhan = realItemSpec(toSponsor(REAL_PRODUCTS.find((p) => p.id === 'kr-yuhanrox')!))
    expect(yuhan.kind === 'detergent' && Object.values(yuhan.mult).every((v) => v === 1)).toBe(true)
  })

  it('affiliate picks are presented for the dirt their base cleans', () => {
    const all = realSponsors()
    expect(activeSponsors(all, '2026-11-11', 'KR')).toEqual([]) // 게임 아이템 아님
    const kr = activeAffiliates(all, '2026-11-11', 'KR')
    expect(kr.length).toBeGreaterThanOrEqual(6)
    expect(kr.every((p) => p.countries?.includes('KR'))).toBe(true)
    const yuhan = affiliateEntry(kr.find((p) => p.id === 'kr-yuhanrox')!)
    expect(yuhan.spec.id).toBe('sp:kr-yuhanrox')
    expect(strengths(yuhan.spec)).toContain('mold')
    const us = activeAffiliates(all, '2026-11-11', 'US')
    expect(us.some((p) => p.id === 'us-windex')).toBe(true)
    expect(us.some((p) => p.id === 'kr-yuhanrox')).toBe(false)
  })

  it('search links carry the affiliate tags when configured', () => {
    const p = REAL_PRODUCTS.find((x) => x.id === 'kr-yuhanrox')!
    expect(realSearchUrl(p)).toBe('https://www.coupang.com/np/search?q=%EC%9C%A0%ED%95%9C%EB%9D%BD%EC%8A%A4%20%EB%A0%88%EA%B7%A4%EB%9F%AC&channel=user')
    expect(realSearchUrl(p, { VITE_COUPANG_LPTAG: 'AF123' })).toContain('&lptag=AF123')
    const w = REAL_PRODUCTS.find((x) => x.id === 'us-windex')!
    expect(realSearchUrl(w, { VITE_AMAZON_TAG_US: 'sparkle-20' })).toContain('&tag=sparkle-20')
  })
})
