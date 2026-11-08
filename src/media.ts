// 운영자가 올린 미디어(쇼호스트 영상·사진 파일) 보관 — IndexedDB
// localStorage(≈5MB) 에는 영상이 들어가지 않으므로 파일은 여기에, 설정 JSON 에는 `idb:<key>` 참조만 저장한다.
// 실서비스에서는 CDN URL(https)을 쓰고 이 저장소는 운영자 로컬 테스트용이다.
const DB = 'sparkle-clean-media';
const STORE = 'files';

function open(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null);
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function putMedia(key: string, blob: Blob): Promise<boolean> {
  const db = await open();
  if (!db) return false;
  return new Promise((resolve) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(blob, key);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => resolve(false);
  });
}

export async function getMedia(key: string): Promise<Blob | null> {
  const db = await open();
  if (!db) return null;
  return new Promise((resolve) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve((req.result as Blob) ?? null);
    req.onerror = () => resolve(null);
  });
}

export async function deleteMedia(key: string): Promise<void> {
  const db = await open();
  if (!db) return;
  await new Promise<void>((resolve) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
  const u = urls.get(key);
  if (u) {
    URL.revokeObjectURL(u);
    urls.delete(key);
  }
}

const urls = new Map<string, string>();

/** `idb:<key>` 참조를 재생 가능한 blob: URL 로, https URL 은 그대로 */
export async function resolveMediaUrl(ref: string | undefined): Promise<string | undefined> {
  if (!ref) return undefined;
  if (!ref.startsWith('idb:')) return ref;
  const key = ref.slice(4);
  const cached = urls.get(key);
  if (cached) return cached;
  const blob = await getMedia(key);
  if (!blob) return undefined;
  const u = URL.createObjectURL(blob);
  urls.set(key, u);
  return u;
}

/** 사진 파일 → 정사각형으로 잘라 줄인 JPEG data URL (설정 JSON 에 그대로 들어갈 크기) */
export function photoToDataUrl(file: Blob, size = 420, quality = 0.86): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = size;
        c.height = size;
        const ctx = c.getContext('2d')!;
        const s = Math.min(img.naturalWidth, img.naturalHeight);
        const sx = (img.naturalWidth - s) / 2;
        const sy = Math.max(0, (img.naturalHeight - s) / 2 - s * 0.08); // 얼굴은 보통 위쪽
        ctx.drawImage(img, sx, sy, s, s, 0, 0, size, size);
        resolve(c.toDataURL('image/jpeg', quality));
      } catch (e) {
        reject(e);
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('image decode failed'));
    };
    img.src = url;
  });
}
