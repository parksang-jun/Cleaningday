// tools/assets-b64/*.b64 → 바이너리 자산 복원 (npm install 뒤 자동 실행). 이미 같은 내용이면 건너뛴다.
// 사용: node scripts/unpack-assets.mjs [--force]
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const dir = resolve(root, 'tools/assets-b64');
const manifestPath = resolve(dir, 'manifest.json');
if (!existsSync(manifestPath)) process.exit(0);
const force = process.argv.includes('--force');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
let restored = 0;
for (const entry of manifest.files) {
  const target = resolve(root, entry.path);
  if (!force && existsSync(target)) {
    const have = createHash('sha256').update(readFileSync(target)).digest('hex');
    if (have === entry.sha256) continue;
  }
  const buf = Buffer.from(readFileSync(resolve(dir, entry.b64), 'utf8').replace(/\s+/g, ''), 'base64');
  const got = createHash('sha256').update(buf).digest('hex');
  if (got !== entry.sha256) {
    console.error(`sha256 mismatch for ${entry.path} — tools/assets-b64 가 손상됐거나 manifest 와 어긋남`);
    process.exit(1);
  }
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, buf);
  restored++;
  console.log(`restored ${entry.path} (${buf.length} B)`);
}
if (restored) console.log(`${restored} asset(s) restored`);
