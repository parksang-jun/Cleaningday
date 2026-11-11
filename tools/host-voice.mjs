#!/usr/bin/env node
// 쇼호스트 음성 생성 — 제품 멘트(대본)를 신경망 TTS 로 mp3 로 만들어 public/voice/<제품id>-<언어>.mp3 에 저장한다.
//   npm run voice -- <제품id> <ko|en|ja> [--dry]
//   예) npm run voice -- kr-yuhanrox ko
// 제공자(환경변수로 선택, 둘 다 없으면 대본만 출력):
//   ELEVENLABS_API_KEY  → ElevenLabs eleven_multilingual_v2 (ELEVENLABS_VOICE_ID 로 목소리 지정, 기본 'Rachel')
//   GOOGLE_TTS_API_KEY  → Google Cloud Text-to-Speech (ko-KR-Neural2-A / en-US-Neural2-F / ja-JP-Neural2-B)
// 만든 파일은 관리자 패널 "쇼호스트 음성 URL" 에 /voice/<파일명> 으로 넣거나, 제품 정의(hostAudio)에 바로 적는다.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const [id, lang = 'ko', ...flags] = process.argv.slice(2);
if (!id) {
  console.error('usage: npm run voice -- <product id> <ko|en|ja> [--dry]');
  process.exit(1);
}
const dry = flags.includes('--dry');

// 대본: 게임이 쓰는 것과 같은 생성기 — Vite 로 TS 모듈을 불러온다 (에셋·env 처리 포함)
const { createServer } = await import('vite');
const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
const { pitchLines } = await vite.ssrLoadModule('/src/pitch.ts');
const { REAL_PRODUCTS, toSponsor } = await vite.ssrLoadModule('/src/game/realProducts.ts');
const { SAMPLE_SPONSORS } = await vite.ssrLoadModule('/src/game/sponsor.ts');
const { setLang } = await vite.ssrLoadModule('/src/i18n.ts');
await vite.close();

setLang(lang);
const real = REAL_PRODUCTS.find((p) => p.id === id);
const product = real ? toSponsor(real) : SAMPLE_SPONSORS.find((p) => p.id === id);
if (!product) {
  console.error(`unknown product: ${id}`);
  process.exit(1);
}
const hostName = lang === 'ko' ? '뽀득이' : lang === 'ja' ? 'ピカリン' : 'Squeaky';
const lines = pitchLines(product, lang, { hostName, placement: 'shop' });
const script = lines.join('\n');
console.log(`--- ${product.brand} ${product.name} (${lang}) ---\n${script}\n`);
if (dry) process.exit(0);

const outDir = resolve('public/voice');
mkdirSync(outDir, { recursive: true });
const out = resolve(outDir, `${id}-${lang}.mp3`);

if (process.env.ELEVENLABS_API_KEY) {
  const voice = process.env.ELEVENLABS_VOICE_ID ?? '21m00Tcm4TlvDq8ikWAM'; // Rachel
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ text: script, model_id: 'eleven_multilingual_v2', voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.35 } }),
  });
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${await res.text()}`);
  writeFileSync(out, Buffer.from(await res.arrayBuffer()));
} else if (process.env.GOOGLE_TTS_API_KEY) {
  const voices = { ko: { languageCode: 'ko-KR', name: 'ko-KR-Neural2-A' }, en: { languageCode: 'en-US', name: 'en-US-Neural2-F' }, ja: { languageCode: 'ja-JP', name: 'ja-JP-Neural2-B' } };
  const res = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${process.env.GOOGLE_TTS_API_KEY}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ input: { text: script }, voice: voices[lang], audioConfig: { audioEncoding: 'MP3', speakingRate: 1.0, pitch: 0 } }),
  });
  if (!res.ok) throw new Error(`Google TTS ${res.status}: ${await res.text()}`);
  const { audioContent } = await res.json();
  writeFileSync(out, Buffer.from(audioContent, 'base64'));
} else {
  console.log('no TTS key (ELEVENLABS_API_KEY or GOOGLE_TTS_API_KEY) — script printed above; paste it into Clova Dubbing / Typecast / ElevenLabs and upload the mp3 in the admin panel.');
  process.exit(0);
}
console.log(`saved ${out} → hostAudio.${lang} = "/voice/${id}-${lang}.mp3"`);
