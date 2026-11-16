// Google Play 스토어 등록 정보 초안(store/play/listing.json) 점검
// - Play Console 글자 수 제한: 제목 30 · 간단한 설명 80 · 자세한 설명 4000 · 출시 노트 500
// - 앱 설정(패키지 이름·게임 속 앱 이름)과 어긋나지 않는지
// - 효능 수치·연락처 같은 넣으면 안 되는 내용이 없는지 (헌장: 제품 효능 수치 근거 없이 쓰지 않기)
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { LEVELS } from '../game/levels'

const root = new URL('../../', import.meta.url)
const read = (p: string) => readFileSync(new URL(p, root), 'utf8')

type Locale = { title: string; shortDescription: string; fullDescription: string; releaseNotes: string }
const listing = JSON.parse(read('store/play/listing.json')) as {
  developerName: string
  packageName: string
  privacyPolicyUrl: string
  containsAds: boolean
  locales: Record<string, Locale>
}
// Play 는 글자 수를 사람이 보는 글자 단위로 센다 → 코드 포인트 기준
const len = (s: string) => [...s].length

describe('Play store listing draft', () => {
  it('has ko, en and ja', () => {
    expect(Object.keys(listing.locales).sort()).toEqual(['en-US', 'ja-JP', 'ko-KR'])
  })

  for (const [loc, t] of Object.entries(listing.locales)) {
    it(`${loc}: fits Play Console length limits`, () => {
      expect(len(t.title)).toBeGreaterThan(0)
      expect(len(t.title)).toBeLessThanOrEqual(30)
      expect(len(t.shortDescription)).toBeLessThanOrEqual(80)
      expect(len(t.fullDescription)).toBeLessThanOrEqual(4000)
      expect(len(t.releaseNotes)).toBeLessThanOrEqual(500)
    })

    it(`${loc}: no efficacy numbers, contact details or brand names`, () => {
      const all = [t.title, t.shortDescription, t.fullDescription, t.releaseNotes].join('\n')
      expect(all).not.toMatch(/\d+\s*%/) // 세정력·성능 수치 금지
      expect(all).not.toMatch(/@|https?:\/\//) // 이메일·링크는 콘솔의 별도 칸에
      expect(all).not.toMatch(/쿠팡|Coupang|Amazon|楽天|Rakuten/i)
    })

    it(`${loc}: states the stage count the game actually has and mentions ads`, () => {
      expect(t.fullDescription).toContain(String(LEVELS.length))
      expect(t.fullDescription).toMatch(/광고|ads|広告/)
    })
  }

  it('matches the app config (package name, in-game names)', () => {
    expect(read('capacitor.config.ts')).toContain(`appId: '${listing.packageName}'`)
    expect(read('android/app/build.gradle')).toContain(`applicationId "${listing.packageName}"`)
    const i18n = read('src/i18n.ts')
    expect(listing.locales['ko-KR'].title.startsWith('싹싹 클린')).toBe(true)
    expect(listing.locales['en-US'].title.startsWith('Sparkle Clean')).toBe(true)
    expect(listing.locales['ja-JP'].title.startsWith('ピカピカクリーン')).toBe(true)
    for (const name of ['싹싹 클린', 'Sparkle Clean', 'ピカピカクリーン']) expect(i18n).toContain(`appName: '${name}'`)
  })

  it('declares ads and points to the privacy policy that ships in docs/', () => {
    expect(listing.containsAds).toBe(true)
    expect(listing.privacyPolicyUrl).toMatch(/\/privacy\.html$/)
    expect(read('docs/privacy.html')).toContain('AdMob')
    expect(listing.developerName.trim().length).toBeGreaterThan(0)
  })
})
