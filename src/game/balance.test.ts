// 난이도 검증 — 숙련자 봇이 96단계를 모두 깰 수 있고(보유 아이템·레시피로), 단계·구역 평균 시간이 올라가는지
import { appendFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { kitFor, PAR_REACH, premiumKitFor, resolveTiming, simulateBot } from './bot'
import { BASE_DETERGENTS, BASE_TOOLS, DIRT_SURFACES, DIRT_TYPES, recipesFor } from './catalog'
import { LEVELS, MESS_FROM, TIERS, WORLDS } from './levels'

describe('recipes', () => {
  it('every dirt on every allowed surface has a recipe using basic (non-premium) items', () => {
    const baseTools = Object.values(BASE_TOOLS).filter((t) => !t.premium)
    const baseDets = Object.values(BASE_DETERGENTS).filter((d) => !d.premium)
    for (const d of DIRT_TYPES) {
      for (const s of DIRT_SURFACES[d]) {
        const ok = recipesFor(d, s).some(
          (r) => baseTools.some((t) => r.tools.some((f) => t.families.includes(f)) && !t.harms.includes(s) && (!t.onlyOn || t.onlyOn.includes(s))) && (!r.cleaner || baseDets.some((c) => c.family === r.cleaner && !c.harms.includes(s))),
        )
        expect(ok, `${d} on ${s} has a safe basic recipe`).toBe(true)
      }
    }
  })
})

describe('difficulty curve', () => {
  it('96 stages in 3 worlds, every stage clearable by the recipe-aware bot within its limit, difficulty rises by tier and by area', () => {
    expect(LEVELS).toHaveLength(96)
    expect(WORLDS.map((w) => w.areas.map((a) => a.levelIds.length))).toEqual([[12, 12, 12, 12], [24], [12, 12]])
    const rows: string[] = []
    const tierSum = new Map<number, number[]>()
    const areaAvg: number[] = []
    for (const w of WORLDS) {
      for (const a of w.areas) {
        let sum = 0
        for (const id of a.levelIds) {
          const lv = LEVELS[id - 1]
          const r = simulateBot(lv)
          const timing = resolveTiming(lv)
          const row = `${String(lv.id).padStart(2)} T${lv.tier} ${a.id.padEnd(8)} ${lv.scene.padEnd(11)} bot ${r.time.toFixed(1).padStart(5)}s par ${String(timing.parSec).padStart(3)} limit ${timing.limitSec ?? '-'} pass ${lv.passClean} hz ${r.hazard} dmg ${r.damage.toFixed(2)}${r.stuck ? ' STUCK ' + r.stuck : ''}`
          rows.push(row)
          appendFileSync('/tmp/balance-live.txt', row + '\n')
          expect(r.stuck, `level ${lv.id} every dirt has an owned recipe`).toBeUndefined()
          expect(r.passed, `level ${lv.id} clearable`).toBe(true)
          expect(r.hazard, `level ${lv.id} bot avoids hazards`).toBe(false)
          expect(r.damage, `level ${lv.id} bot avoids damage`).toBeLessThan(0.15)
          if (timing.limitSec) expect(r.time * 1.5, `level ${lv.id} limit leaves room`).toBeLessThan(timing.limitSec)
          sum += r.time
          const arr = tierSum.get(lv.tier) ?? []
          arr.push(r.time)
          tierSum.set(lv.tier, arr)
        }
        areaAvg.push(sum / a.levelIds.length)
      }
    }
    const tierAvg = TIERS.map((t) => {
      const arr = tierSum.get(t.id) ?? [0]
      return arr.reduce((x, y) => x + y, 0) / arr.length
    })
    appendFileSync('/tmp/balance.txt', rows.join('\n') + '\n' + `tier avg: ${tierAvg.map((a) => a.toFixed(1)).join(' → ')}\narea avg: ${areaAvg.map((a) => a.toFixed(1)).join(' → ')}\n`)
    for (let i = 1; i < tierAvg.length; i++) expect(tierAvg[i], `tier ${i + 1} harder than ${i}`).toBeGreaterThan(tierAvg[i - 1])
    for (let i = 1; i < areaAvg.length; i++) expect(areaAvg[i], `area ${i + 1} harder than ${i}`).toBeGreaterThan(areaAvg[i - 1])
    expect(tierAvg[tierAvg.length - 1]).toBeGreaterThan(tierAvg[0] * 2)
  }, 60_000)

  it('3 stars stay reachable: the basic-gear expert bot beats every target time with a small margin, even while being messed up', () => {
    // 2026-11-13 제품개선팀: 끝 단계(목표시간 배수 1.1~1.2 + 재오염 절반 반영)에서 숙련 봇도 목표시간을 넘겨 별 3개가 불가능한 판이 있었다(84·85·88·90)
    for (const lv of LEVELS) {
      const r = simulateBot(lv)
      const { parSec } = resolveTiming(lv)
      expect(r.time * PAR_REACH, `level ${lv.id} par ${parSec}s reachable (bot ${r.time.toFixed(1)}s)`).toBeLessThanOrEqual(parSec)
    }
  }, 60_000)

  it('every stage is at least as tough as the one before: grime resistance never drops, time factors never loosen within a mode, re-soiling comes faster', () => {
    for (let i = 1; i < LEVELS.length; i++) {
      const a = LEVELS[i - 1]
      const b = LEVELS[i]
      expect(b.resistMul, `level ${b.id} resist`).toBeGreaterThanOrEqual(a.resistMul)
      if (a.limitFactor && b.limitFactor) expect(b.limitFactor, `level ${b.id} limit`).toBeLessThanOrEqual(a.limitFactor)
    }
    expect(LEVELS[95].resistMul).toBeGreaterThan(LEVELS[0].resistMul * 1.8)
    const messy = LEVELS.filter((l) => l.mess && l.mode === 'clean' && l.mess.kind === 'kids')
    expect(messy[messy.length - 1].mess!.every).toBeLessThan(messy[0].mess!.every)
  })

  it('re-soiling: every stage from 4 (except rush) gets a themed mess-maker; it costs the basic-gear bot real time and premium gear cuts most of it', () => {
    let withMess = 0
    const kinds = new Set<string>()
    let base = 0
    let messy = 0
    let pro = 0
    for (const lv of LEVELS) {
      if (lv.id < MESS_FROM || lv.mode === 'rush') {
        expect(lv.mess, `level ${lv.id} stays quiet`).toBeUndefined()
        continue
      }
      expect(lv.mess, `level ${lv.id} has a mess-maker`).toBeDefined()
      expect(lv.patches.flatMap((p) => [p.type, ...(p.under ? [p.under] : [])]), `level ${lv.id} mess dirt is one the stage already has`).toContain(lv.mess!.type)
      expect(['mold', 'moss', 'iron']).not.toContain(lv.mess!.type)
      withMess++
      kinds.add(lv.mess!.kind)
      const off = simulateBot(lv, 900, kitFor(lv), { mess: false })
      const on = simulateBot(lv, 900, kitFor(lv), { mess: true })
      const premium = simulateBot(lv, 900, premiumKitFor(lv), { mess: true })
      expect(on.passed && !on.stuck, `level ${lv.id} still clearable while being messed up`).toBe(true)
      if (off.time > lv.mess!.after + 1) expect(on.messCount, `level ${lv.id} actually got messed up`).toBeGreaterThanOrEqual(1)
      expect(on.messCount).toBeLessThanOrEqual(Math.ceil(lv.mess!.cap / lv.mess!.amount))
      base += off.time
      messy += on.time
      pro += premium.time
    }
    expect(withMess).toBeGreaterThan(70)
    expect([...kinds].sort()).toEqual(['birds', 'drift', 'kids', 'leaves', 'pet', 'splash', 'splatter'])
    // 기본 장비 봇: 재오염으로 10% 이상 느려진다. 프리미엄 장비는 재오염이 있어도 조용할 때의 기본 장비보다 빠르다.
    expect(messy).toBeGreaterThan(base * 1.1)
    expect(pro).toBeLessThan(base)
    appendFileSync('/tmp/balance.txt', `mess: basic quiet ${base.toFixed(0)}s → messy ${messy.toFixed(0)}s (+${((messy / base - 1) * 100).toFixed(0)}%), premium messy ${pro.toFixed(0)}s\n`)
  }, 120_000)

  it('premium gear makes stages clearly easier and leaves a polished finish (basic gear: no polish)', () => {
    // 각 구역에서 두 판씩 — 기본 지급품 vs 프리미엄 전부
    const sample = [5, 11, 18, 24, 30, 36, 43, 48, 60, 72, 80, 94]
    let basicSum = 0
    let proSum = 0
    for (const id of sample) {
      const lv = LEVELS[id - 1]
      const basic = simulateBot(lv)
      const pro = simulateBot(lv, 900, premiumKitFor(lv))
      expect(pro.passed, `level ${id} premium clear`).toBe(true)
      expect(pro.hazard).toBe(false)
      expect(pro.damage).toBeLessThan(0.15)
      expect(basic.polish, `level ${id} basic gear leaves no polish`).toBe(0)
      expect(pro.polish, `level ${id} premium polish`).toBeGreaterThan(0.3)
      basicSum += basic.time
      proSum += pro.time
      appendFileSync('/tmp/balance.txt', `premium ${String(id).padStart(2)} basic ${basic.time.toFixed(1)}s pro ${pro.time.toFixed(1)}s polish ${(pro.polish * 100).toFixed(0)}%\n`)
    }
    appendFileSync('/tmp/balance.txt', `premium speedup ×${(basicSum / proSum).toFixed(2)}\n`)
    expect(basicSum / proSum, 'premium gear ≥ 1.5× faster on average').toBeGreaterThan(1.5)
  }, 60_000)
})
