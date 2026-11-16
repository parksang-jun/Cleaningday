// 장면 사진 — 손그림 장면 대신 쓰는 실사 배경. src/assets/scenes/<장면>.webp(또는 .jpg) 가 있으면 그 사진을 쓰고, 없으면 기존 그림으로 그린다.
// 사진은 '깨끗한 상태'만 담는다(오염은 게임이 위에 덧그린다).
import type { SceneId } from '../game/levels';

const urls = import.meta.glob('../assets/scenes/*.{webp,jpg}', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const URL_OF = new Map<string, string>();
for (const [path, url] of Object.entries(urls)) URL_OF.set(path.split('/').pop()!.replace(/\.(webp|jpg)$/, ''), url);

// 재질 사진 — src/assets/materials/<재질>.webp(또는 .jpg). 무료 상업용(CC0) 사진만 넣는다(출처는 같은 폴더 README).
// 있으면 해당 재질의 결·무늬를 사진에서 가져오고, 없으면 지금처럼 캔버스로 만든 무늬를 쓴다. 키는 'mat:<재질>'.
export const MATERIAL_PHOTOS = ['wood', 'tile', 'steel'] as const;
export type MaterialPhoto = (typeof MATERIAL_PHOTOS)[number];
const matUrls = import.meta.glob('../assets/materials/*.{webp,jpg}', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
for (const [path, url] of Object.entries(matUrls)) URL_OF.set('mat:' + path.split('/').pop()!.replace(/\.(webp|jpg)$/, ''), url);

/** 불러온 재질 사진(없으면 null) */
export function materialPhoto(name: MaterialPhoto): HTMLImageElement | null {
  return loaded.get('mat:' + name) ?? null;
}

/** 저장소에 들어 있는 재질 사진 키 목록 — loadScenePhotos 에 그대로 넘긴다 */
export function materialPhotoKeys(): string[] {
  return MATERIAL_PHOTOS.map((m) => 'mat:' + m).filter((k) => URL_OF.has(k));
}

const loaded = new Map<string, HTMLImageElement>();
const loading = new Map<string, Promise<void>>();

/** 판 전용 사진의 이름 — src/assets/scenes/L<판 번호>.jpg. 있으면 장면 사진보다 먼저 쓴다(판마다 다른 사진) */
export function levelPhotoKey(id: number): string {
  return `L${id}`;
}

export function hasScenePhoto(scene: SceneId | string): boolean {
  return URL_OF.has(scene);
}

/** 이미 불러온 사진만 돌려준다(그리기는 동기라서) */
export function scenePhoto(scene: SceneId | string): HTMLImageElement | null {
  return loaded.get(scene) ?? null;
}

/** 필요한 장면 사진을 불러온다. 새로 불러온 것이 있으면 true */
export async function loadScenePhotos(scenes: (SceneId | string)[]): Promise<boolean> {
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
