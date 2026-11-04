import { appendFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { resolveTiming, simulateBot } from './bot'
import { LEVELS, TIERS, WORLDS } from './levels'

describe('difficulty curve', () => {
  it('48 stages in 3 worlds, every stage clearable by the bot within its limit, difficulty rises by tier and by area', () => {
    expect(LEVELS).toHaveLength(48)
    expect(WORLDS.map((w) => w.areas.map((a) => a.levelIds.length))).toEqual([[6, 6, 6, 6], [12], [6, 6]])
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
          rows.push(`${String(lv.id).padStart(2)} T${lv.tier} ${a.id.padEnd(8)} ${lv.scene.padEnd(11)} bot ${r.time.toFixed(1).padStart(5)}s par ${String(timing.parSec).padStart(3)} limit ${timing.limitSec ?? '-'} pass ${lv.passClean} hz ${r.hazard} dmg ${r.damage.toFixed(2)}`)
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
  })
})
