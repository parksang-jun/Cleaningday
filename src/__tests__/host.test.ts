// 쇼호스트 멘트 생성 + 운영 데이터(광고 제품 등록·일시정지·내보내기/가져오기)
import { beforeEach, describe, expect, it } from 'vitest'
import { pitchLines } from '../host'
import { setLang } from '../i18n'
import { blankSponsor, exportConfig, findSponsor, importConfig, removeSponsor, saveSponsor, setSponsorStatus, sponsorIssues, sponsorList } from '../ops'
import { SAMPLE_SPONSORS } from '../game/sponsor'
import { activeSponsors } from '../game/items'
import { resetStore } from '../storage'

describe('live host pitch', () => {
  it('builds the pitch from lab results, claims, reviews and label cautions (ko)', () => {
    setLang('ko')
    const p = SAMPLE_SPONSORS[0] // BrightMax degreaser: grease 92% vs std 80 → 1.15x
    const lines = pitchLines(p, 'ko', { hostName: '반디', placement: 'struggle', dirt: 'grease' })
    expect(lines[0]).toContain('반디')
    expect(lines[0]).toContain('BrightMax')
    expect(lines.some((l) => l.includes('92%'))).toBe(true)
    expect(lines.some((l) => l.includes('1.2배'))).toBe(true)
    expect(lines.some((l) => l.startsWith('✔'))).toBe(true)
    expect(lines.some((l) => l.includes('12,480'))).toBe(true)
    expect(lines.some((l) => l.includes('원목') || l.includes('도장'))).toBe(true) // 주의 재질
    expect(lines[1]).toContain('알칼리') // 전문가 원리 설명 (진짜 꿀팁)
    expect(lines[lines.length - 1]).toContain('이번 판')
  })
  it('custom operator lines replace the auto pitch but cautions stay', () => {
    setLang('en')
    const p = { ...SAMPLE_SPONSORS[0], hostLines: { en: ['{brand} {name} melts grease on contact!', 'Loved by pros.'] } }
    const lines = pitchLines(p, 'en', { hostName: 'Bandi', placement: 'intro' })
    expect(lines[1]).toBe('BrightMax Kitchen Degreaser melts grease on contact!')
    expect(lines[2]).toBe('Loved by pros.')
    expect(lines.some((l) => l.includes('92%'))).toBe(false)
    expect(lines.some((l) => /don't use it on/.test(l))).toBe(true)
  })
})

describe('ops: sponsored product management', () => {
  beforeEach(() => resetStore())
  it('lists built-in samples, saves a custom product, pauses and deletes', () => {
    expect(sponsorList().map((p) => p.id)).toEqual(SAMPLE_SPONSORS.map((p) => p.id))
    const p = blankSponsor()
    p.id = 'waxco-mold'
    p.brand = 'WaxCo'
    p.name = 'Mold Wax'
    p.kind = 'detergent'
    p.base = 'moldremover'
    p.lab = [{ dirt: 'mold', removalPct: 95 }]
    p.evidence = { lab: 'KTR', reportId: 'KTR-2027-1', date: '2027-01-10', protocol: 'ASTM mold coupon' }
    saveSponsor(p)
    expect(findSponsor('waxco-mold')?.custom).toBe(true)
    expect(sponsorIssues(findSponsor('waxco-mold')!, '2027-02-01')).toEqual([])
    expect(activeSponsors(sponsorList(), '2027-02-01', 'KR').some((x) => x.id === 'waxco-mold')).toBe(true)
    setSponsorStatus('waxco-mold', 'paused')
    expect(sponsorIssues(findSponsor('waxco-mold')!, '2027-02-01')).toContain('paused')
    expect(activeSponsors(sponsorList(), '2027-02-01', 'KR').some((x) => x.id === 'waxco-mold')).toBe(false)
    // 내장 샘플은 덮어쓰기로 일시정지
    setSponsorStatus(SAMPLE_SPONSORS[0].id, 'paused')
    expect(findSponsor(SAMPLE_SPONSORS[0].id)?.status).toBe('paused')
    expect(findSponsor(SAMPLE_SPONSORS[0].id)?.custom).toBeFalsy()
    removeSponsor('waxco-mold')
    expect(findSponsor('waxco-mold')).toBeUndefined()
  })
  it('country targeting filters by viewer language', () => {
    const p = { ...blankSponsor(), id: 'jp-only', brand: 'Kao', name: 'X', countries: ['JP'], lab: [{ dirt: 'stain' as const, removalPct: 80 }], evidence: { lab: 'L', reportId: 'R', date: '2027-01-01', protocol: 'p' } }
    saveSponsor(p)
    expect(activeSponsors(sponsorList(), '2027-02-01', 'JP').some((x) => x.id === 'jp-only')).toBe(true)
    expect(activeSponsors(sponsorList(), '2027-02-01', 'KR').some((x) => x.id === 'jp-only')).toBe(false)
  })
  it('export → import round-trips products and host config', () => {
    const p = { ...blankSponsor(), id: 'rt-1', brand: 'RT', name: 'One', lab: [{ dirt: 'dust' as const, removalPct: 90 }] }
    saveSponsor(p)
    const json = exportConfig()
    resetStore()
    expect(findSponsor('rt-1')).toBeUndefined()
    const r = importConfig(json)
    expect(r.ok).toBe(true)
    expect(findSponsor('rt-1')?.brand).toBe('RT')
    expect(importConfig('{"nope":1}').ok).toBe(false)
  })
})
