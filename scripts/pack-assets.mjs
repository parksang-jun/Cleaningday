// 바이너리 자산 → tools/assets-b64/*.b64 (저장소에는 텍스트만 올리고, 클론 후 `npm run assets:unpack`(postinstall) 으로 복원)
// 사용: node scripts/pack-assets.mjs   — manifest.json 에 적힌 파일을 base64 로 저장하고 sha256 을 갱신한다
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const dir = resolve(root, 'tools/assets-b64');
const manifestPath = resolve(dir, 'manifest.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
for (const entry of manifest.files) {
  const buf = readFileSync(resolve(root, entry.path));
  entry.sha256 = createHash('sha256').update(buf).digest('hex');
  entry.bytes = buf.length;
  const out = resolve(dir, entry.b64);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, buf.toString('base64').replace(/(.{76})/g, '$1\n') + '\n');
  console.log(`packed ${entry.path} → ${entry.b64} (${buf.length} B)`);
}
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
