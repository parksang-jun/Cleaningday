// 장면 사진 — 손그림 장면 대신 쓰는 실사 배경. src/assets/scenes/<장면>.webp(또는 .jpg) 가 있으면 그 사진을 쓰고, 없으면 기존 그림으로 그린다.
// 사진은 '깨끗한 상태'만 담는다(오염은 게임이 위에 덧그린다).
import type { SceneId } from '../game/levels';

const urls = import.meta.glob('../assets/scenes/*.{webp,jpg}', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const URL_OF = new Map<string, string>();
for (const [path, url] of Object.entries(urls)) URL_OF.set(path.split('/').pop()!.replace(/\.(webp|jpg)$/, ''), url);

const loaded = new Map<string, HTMLImageElement>();
const loading = new Map<string, Promise<void>>();

export function hasScenePhoto(scene: SceneId): boolean {
  return URL_OF.has(scene);
}

/** 이미 불러온 사진만 돌려준다(그리기는 동기라서) */
export function scenePhoto(scene: SceneId): HTMLImageElement | null {
  return loaded.get(scene) ?? null;
}

/** 필요한 장면 사진을 불러온다. 새로 불러온 것이 있으면 true */
export async function loadScenePhotos(scenes: SceneId[]): Promise<boolean> {
  if (typeof Image === 'undefined') return false;
  let fresh = false;
  await Promise.all(
    [...new Set(scenes)].map((s) => {
      const url = URL_OF.get(s);
      if (!url || loaded.has(s)) return undefined;
      let p = loading.get(s);
      if (!p) {
        p = new Promise<void>((resolve) => {
          const img = new Image();
          img.decoding = 'async';
          img.onload = () => {
            loaded.set(s, img);
            fresh = true;
            resolve();
          };
          img.onerror = () => resolve();
          img.src = url;
        });
        loading.set(s, p);
      }
      return p;
    }),
  );
  return fresh;
}

/** 사진을 w×h 에 꽉 차게(가운데 기준으로 잘라) 그린다 */
export function drawCover(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, img: HTMLImageElement, w: number, h: number): void {
  const ir = img.naturalWidth / img.naturalHeight;
  const r = w / h;
  let sw = img.naturalWidth;
  let sh = img.naturalHeight;
  if (ir > r) sw = sh * r;
  else sh = sw / r;
  const sx = (img.naturalWidth - sw) / 2;
  const sy = (img.naturalHeight - sh) / 2;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
}
