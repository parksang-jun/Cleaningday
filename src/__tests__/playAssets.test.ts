// Google Play 등록 그림 규격 검사 (Play Console 도움말 answer/9866151)
// - 휴대전화 스크린샷: 각 변 320~3840px, 긴 변 ≤ 짧은 변 × 2, 언어마다 2~8장
// - 그래픽 이미지: 정확히 1024×500, JPEG(투명 없음)
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const dir = resolve(__dirname, '../../store-assets')

function pngSize(buf: Buffer): [number, number] {
  expect(buf.subarray(1, 4).toString('latin1')).toBe('PNG')
  return [buf.readUInt32BE(16), buf.readUInt32BE(20)]
}

function jpegSize(buf: Buffer): [number, number] {
  expect(buf[0] === 0xff && buf[1] === 0xd8).toBe(true)
  let i = 2
  while (i < buf.length) {
    if (buf[i] !== 0xff) { i++; continue }
    const m = buf[i + 1]
    const len = buf.readUInt16BE(i + 2)
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return [buf.readUInt16BE(i + 7), buf.readUInt16BE(i + 5)]
    i += 2 + len
  }
  throw new Error('no SOF marker')
}

// ko·en 은 필수, 그 밖의 언어(ja 등)는 만들어 둔 것만 검사
const LANGS = [...new Set(['ko', 'en', ...(existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('-1080x1920')).map((f) => f.split('-')[0]) : [])])]

describe('Play store assets', () => {
  for (const lang of LANGS) {
    it(`${lang}: 9:16 phone screenshots fit Play rules`, () => {
      const d = resolve(dir, `${lang}-1080x1920`)
      expect(existsSync(d), `${d} exists (npm run store:play)`).toBe(true)
      const files = readdirSync(d).filter((f) => f.endsWith('.png'))
      expect(files.length).toBeGreaterThanOrEqual(2)
      expect(files.length).toBeLessThanOrEqual(8)
      for (const f of files) {
        const [w, h] = pngSize(readFileSync(resolve(d, f)))
        expect(Math.min(w, h), f).toBeGreaterThanOrEqual(320)
        expect(Math.max(w, h), f).toBeLessThanOrEqual(3840)
        expect(Math.max(w, h) / Math.min(w, h), f).toBeLessThanOrEqual(2)
      }
    })
    it(`${lang}: feature graphic is a 1024x500 JPEG`, () => {
      const f = resolve(dir, `${lang}-feature-1024x500.jpg`)
      expect(existsSync(f), `${f} exists`).toBe(true)
      expect(jpegSize(readFileSync(f))).toEqual([1024, 500])
    })
  }
})
