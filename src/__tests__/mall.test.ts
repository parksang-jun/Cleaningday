import { describe, expect, it } from 'vitest';
import { affiliateDisclosure, MARKETS } from '../mall';

describe('affiliate disclosure (판매몰 수수료 고지)', () => {
  it('has a non-empty notice for every market and language', () => {
    for (const m of MARKETS) for (const lang of ['ko', 'en', 'ja'] as const) expect(affiliateDisclosure(m, lang).length).toBeGreaterThan(10);
  });

  it('uses the programs’ own wording for Coupang (ko) and Amazon.com (en)', () => {
    expect(affiliateDisclosure('coupang', 'ko')).toBe('이 게시물은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.');
    expect(affiliateDisclosure('amazon_us', 'en')).toBe('As an Amazon Associate I earn from qualifying purchases.');
  });

  it('makes no efficacy claims', () => {
    for (const m of MARKETS) for (const lang of ['ko', 'en', 'ja'] as const) expect(affiliateDisclosure(m, lang)).not.toMatch(/\d+%|\d+배/);
  });
});
