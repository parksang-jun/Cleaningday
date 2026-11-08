// 진짜 꿀팁 ↔ 게임 조합 정합성: 팁의 아이템은 실제 존재하고, 팁이 말하는 오염을 그 아이템 조합으로 실제로 지울 수 있어야 한다
import { describe, expect, it } from 'vitest'
import { BASE_DETERGENTS, BASE_TOOLS, isHazardMix, matchRecipe, SURFACES, type DetergentSpec, type SurfaceType, type ToolSpec } from './catalog'
import { expertLine, TIPS, tipForCombo, tipsFor } from './tips'

describe('real cleaning tips', () => {
  it('every tip has 3 languages, at least one source link and existing items', () => {
    for (const tip of TIPS) {
      for (const lang of ['ko', 'en', 'ja'] as const) {
        expect(tip.title[lang].length, `${tip.id} title ${lang}`).toBeGreaterThan(3)
        expect(tip.steps[lang].length, `${tip.id} steps ${lang}`).toBeGreaterThan(0)
        expect(tip.expert[lang].length, `${tip.id} expert ${lang}`).toBeGreaterThan(10)
      }
      expect(tip.sources.length, `${tip.id} sources`).toBeGreaterThan(0)
      for (const s of tip.sources) expect(s.url.startsWith('https://'), `${tip.id} ${s.url}`).toBe(true)
      for (const id of tip.items) expect(id in BASE_TOOLS || id in BASE_DETERGENTS, `${tip.id} item ${id}`).toBe(true)
    }
  })

  it('each tip is playable: its items form a working recipe for each of its dirts on a listed surface', () => {
    for (const tip of TIPS) {
      const tools = tip.items.filter((i) => i in BASE_TOOLS).map((i) => BASE_TOOLS[i as keyof typeof BASE_TOOLS] as ToolSpec)
      const dets = tip.items.filter((i) => i in BASE_DETERGENTS).map((i) => BASE_DETERGENTS[i as keyof typeof BASE_DETERGENTS] as DetergentSpec)
      const surfaces: SurfaceType[] = tip.surfaces ?? SURFACES
      for (const dirt of tip.dirts) {
        let ok = false
        for (const surface of surfaces) {
          // 팁의 세정제(있으면) + 팁의 도구, 또는 팁의 도구만. 도구가 없는 팁(3대장)은 기본 도구 전부로 본다
          const toolPool = tools.length ? tools : (Object.values(BASE_TOOLS) as ToolSpec[]).filter((t) => !t.premium)
          for (const tool of toolPool) {
            if (tool.onlyOn && !tool.onlyOn.includes(surface)) continue
            if (tool.harms.includes(surface)) continue
            if (dets.length) for (const d of dets) if (!d.harms.includes(surface) && matchRecipe(dirt, surface, tool, d.family)) ok = true
            if (!dets.length && matchRecipe(dirt, surface, tool, null)) ok = true
          }
          if (ok) break
        }
        expect(ok, `${tip.id}: ${dirt} is cleanable with ${tip.items.join('+')}`).toBe(true)
      }
    }
  })

  it('discovered combos map back to the right tip (cleaner must match, a shared tool is not enough)', () => {
    expect(tipForCombo('grease', 'steel', 'scrubpad', 'bakingsoda')?.id).toBe('grease-bakingsoda')
    expect(tipForCombo('grease', 'steel', 'scrubpad', 'degreaser')).toBeUndefined()
    expect(tipForCombo('hair', 'fabric', 'rubberglove', null)?.id).toBe('hair-glove')
    expect(tipForCombo('mold', 'tile', 'toothbrush', 'percarbonate')?.id).toBe('mold-percarbonate')
    expect(tipForCombo('mold', 'tile', 'tilebrush', 'moldremover')?.id).toBe('mold-bleach')
    expect(tipForCombo('film', 'plastic', 'cloth', 'toothpaste')?.id).toBe('headlight-toothpaste')
    expect(tipForCombo('film', 'glass', 'newspaper', 'vinegar')?.id).toBe('glass-vinegar')
    expect(tipsFor('scale', 'steel').map((t) => t.id)).toContain('sink-grain')
    expect(expertLine('grease', 'ko')).toContain('알칼리')
  })

  it('household chemistry hazards follow the real warnings: bleach with acid (vinegar, citric) or oxygen bleach', () => {
    expect(isHazardMix('chlorine', 'acid')).toBe(true)
    expect(isHazardMix('chlorine', 'oxygen')).toBe(true)
    expect(isHazardMix('acid', 'alkaline')).toBe(false)
    expect(isHazardMix('oxygen', 'acid')).toBe(false)
    expect(BASE_DETERGENTS.vinegar.chemistry).toBe('acid')
    expect(BASE_DETERGENTS.citric.chemistry).toBe('acid')
    expect(BASE_DETERGENTS.percarbonate.chemistry).toBe('oxygen')
    expect(BASE_DETERGENTS.moldremover.chemistry).toBe('chlorine')
  })

  it('household items are real alternatives but not faster than the dedicated product', () => {
    const cloth = BASE_TOOLS.sponge
    const pro = matchRecipe('grease', 'steel', cloth, 'degreaser')!
    const diy = matchRecipe('grease', 'steel', cloth, 'bakingsoda')!
    expect(diy.speed).toBeLessThan(pro.speed)
    expect(matchRecipe('film', 'plastic', BASE_TOOLS.cloth, 'polish')).not.toBeNull()
    expect(matchRecipe('film', 'paint', BASE_TOOLS.cloth, 'polish')).toBeNull() // 치약은 헤드라이트(플라스틱)에만
    expect(matchRecipe('iron', 'paint', BASE_TOOLS.claybar, 'carshampoo')).not.toBeNull()
    expect(matchRecipe('iron', 'paint', BASE_TOOLS.claybar, null)).toBeNull() // 윤활 없이는 안 됨
    expect(BASE_TOOLS.newspaper.onlyOn).toEqual(['glass'])
  })
})
