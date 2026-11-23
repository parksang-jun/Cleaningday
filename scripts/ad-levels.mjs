// 홍보 영상용 판 정보 — 그 판의 오염과 듣는 조합(세제+도구)을 보여 준다: node scripts/ad-levels.mjs 1 26 73
import { createServer } from 'vite';
const vite = await createServer({ root: process.cwd(), server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
const { LEVELS } = await vite.ssrLoadModule('/src/game/levels.ts');
const { RECIPES } = await vite.ssrLoadModule('/src/game/catalog.ts');
for (const id of process.argv.slice(2).map(Number)) {
  const l = LEVELS.find((x) => x.id === id);
  const kinds = [...new Set(l.patches.flatMap((p) => [p.type, p.under].filter(Boolean)))];
  console.log(id, l.area, l.scene, l.surface, l.mode, 'kinds', kinds.join(','), '| recipes', kinds.map((k) => k + ':' + (RECIPES[k] || []).slice(0, 2).map((r) => `${r.cleaner || '-'}+${r.tools.join('/')}`).join(' or ')).join(' ; '));
}
await vite.close();
