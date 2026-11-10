import { describe, expect, it } from 'vitest'
import { dominantDirt, premiumFor } from './gear'

describe('gear recommendation', () => {
  it('picks the premium tool that cleans this dirt on this surface fastest, skipping owned and harmful ones', () => {
    const dust = premiumFor('dust', 'wood', [])!
    expect(dust.spec.id).toBe('cordlessvac') // 먼지는 청소기 — 1.8배
    expect(dust.x).toBeCloseTo(1.5, 1) // 기본 청소기 1.2 → 1.8
    expect(dust.wide).toBe(true)
    expect(dust.noCleaner).toBe(false) // 먼지는 원래 세정제가 필요 없다 — "세정제 없이" 배지는 붙지 않는다
    expect(premiumFor('dust', 'wood', ['cordlessvac'])?.spec.id).not.toBe('cordlessvac') // 이미 가진 건 안 권한다
    const greaseTile = premiumFor('grease', 'tile', [])!
    expect(greaseTile.spec.kind).toBe('tool')
    expect(['scrubber', 'drillbrush', 'steamer']).toContain(greaseTile.spec.id)
    const greaseGlass = premiumFor('grease', 'glass', [])!
    expect(greaseGlass.spec.harms).not.toContain('glass') // 유리를 긁는 장비는 유리에 권하지 않는다
  })

  it('prefers a no-cleaner route (steam) where the basic recipe needs a cleaner, and falls back to a premium cleaner', () => {
    const film = premiumFor('film', 'glass', [])
    expect(film?.spec.id).toBe('steamer')
    expect(film?.noCleaner).toBe(true)
    const scale = premiumFor('scale', 'ceramic', ['scrubber', 'drillbrush', 'steamer', 'magiceraser', 'cordlessvac'])
    expect(scale?.spec.id).toBe('limescalegel')
    expect(scale?.x).toBeCloseTo(1.8, 1)
    expect(premiumFor('scale', 'ceramic', ['scrubber', 'drillbrush', 'steamer', 'magiceraser', 'cordlessvac', 'limescalegel'])).toBeNull()
  })

  it('dominant dirt is the kind with the most left', () => {
    const left: Record<string, number> = { dust: 3, grease: 12, hair: 0 }
    expect(dominantDirt(['dust', 'grease', 'hair'], (d) => left[d])).toBe('grease')
    expect(dominantDirt(['hair'], (d) => left[d])).toBeNull()
  })
})
