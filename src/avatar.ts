// 쇼호스트 얼굴 — 세 가지 소스
//  1) 운영자가 올린 실사 영상(제품별 소개 영상, HeyGen/D-ID 같은 AI 아바타 서비스나 실제 촬영본) → <video>
//  2) 운영자가 올린 실사 사진 → <img> + 말할 때 링 펄스
//  3) 내장 마스코트 '뽀득이'(tools/host-portrait.py 로 그린 청소 거품 캐릭터, 레이어 9장) → 깜빡임·입 모양·눈썹 강조를 레이어 교체로 애니메이션
import base from './assets/host/base.webp';
import brows from './assets/host/brows.webp';
import eyesClosed from './assets/host/eyes-closed.webp';
import eyesHalf from './assets/host/eyes-half.webp';
import eyesOpen from './assets/host/eyes-open.webp';
import mouthClosed from './assets/host/mouth-closed.webp';
import mouthMid from './assets/host/mouth-mid.webp';
import mouthOpen from './assets/host/mouth-open.webp';
import overlay from './assets/host/overlay.webp';

export interface HostMedia {
  /** 실사 사진 (https URL 또는 data URL) */
  photo?: string;
  /** 제품 소개 영상 (https URL 또는 blob: URL) — 있으면 TTS 대신 영상 음성 */
  video?: string;
}

export const PORTRAIT_LAYERS = { base, eyesOpen, eyesHalf, eyesClosed, brows, mouthClosed, mouthMid, mouthOpen, overlay };

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

/** 사진·영상 주소로 허용되는 것: https, data:image, blob: */
export function isMediaUrl(u: string | undefined, kind: 'photo' | 'video'): u is string {
  if (!u) return false;
  if (/^https:\/\//i.test(u)) return true;
  if (/^blob:/i.test(u)) return true;
  if (kind === 'photo' && /^data:image\/(png|jpe?g|webp);base64,/i.test(u)) return true;
  return false;
}

/** 아바타 마크업. small=목록용(애니메이션 없음) */
export function avatarHtml(media?: HostMedia, opts: { small?: boolean } = {}): string {
  const photo = isMediaUrl(media?.photo, 'photo') ? media!.photo! : undefined;
  const video = !opts.small && isMediaUrl(media?.video, 'video') ? media!.video! : undefined;
  if (video) {
    return `<div class="hav hav--video" data-el="avatar" data-mode="video">
      <video class="hav__video" playsinline preload="auto" ${photo ? `poster="${esc(photo)}"` : ''} src="${esc(video)}"></video>
      ${photo ? `<img class="hav__photo hav__photo--fallback" src="${esc(photo)}" alt="">` : `<div class="hav__fig hav__fig--fallback">${portraitLayers()}</div>`}
      <span class="hav__ring"></span>
    </div>`;
  }
  if (photo) {
    return `<div class="hav hav--photo" data-el="avatar" data-mode="photo"><img class="hav__photo" src="${esc(photo)}" alt=""><span class="hav__ring"></span></div>`;
  }
  return `<div class="hav hav--paint${opts.small ? ' hav--small' : ''}" data-el="avatar" data-mode="paint"><div class="hav__fig">${portraitLayers()}</div></div>`;
}

function portraitLayers(): string {
  const L = PORTRAIT_LAYERS;
  return `<img class="hav__l" src="${L.base}" alt="" draggable="false">
    <img class="hav__l hav__eyes is-on" data-eye="open" src="${L.eyesOpen}" alt="">
    <img class="hav__l hav__eyes" data-eye="half" src="${L.eyesHalf}" alt="">
    <img class="hav__l hav__eyes" data-eye="closed" src="${L.eyesClosed}" alt="">
    <img class="hav__l hav__brows" src="${L.brows}" alt="">
    <img class="hav__l hav__mouth is-on" data-mouth="closed" src="${L.mouthClosed}" alt="">
    <img class="hav__l hav__mouth" data-mouth="mid" src="${L.mouthMid}" alt="">
    <img class="hav__l hav__mouth" data-mouth="open" src="${L.mouthOpen}" alt="">
    <img class="hav__l" src="${L.overlay}" alt="">`;
}

export interface AvatarCtl {
  /** 말하기 시작/끝 — 내장 초상은 입 모양, 사진·영상은 링 펄스 */
  talking(on: boolean): void;
  /** 문장 시작 강조(눈썹) */
  emph(): void;
  /** 영상 재생 시도 — 소리 있는 자동재생이 막히면 음소거로 재생하고 false(→ TTS 로 대체) */
  playVideo(): Promise<boolean>;
  stop(): void;
}

/** 아바타 애니메이션 제어 — root 는 avatarHtml 이 만든 .hav */
export function animateAvatar(root: HTMLElement): AvatarCtl {
  let alive = true;
  let talk = false;
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const later = (fn: () => void, ms: number) => {
    const id = setTimeout(() => {
      timers.delete(id);
      if (alive) fn();
    }, ms);
    timers.add(id);
    return id;
  };
  const mode = root.dataset.mode;
  const video = root.querySelector<HTMLVideoElement>('video');
  const setEye = (s: 'open' | 'half' | 'closed') => root.querySelectorAll<HTMLElement>('[data-eye]').forEach((el) => el.classList.toggle('is-on', el.dataset.eye === s));
  const setMouth = (s: 'closed' | 'mid' | 'open') => root.querySelectorAll<HTMLElement>('[data-mouth]').forEach((el) => el.classList.toggle('is-on', el.dataset.mouth === s));
  const hasLayers = root.querySelector('[data-eye]') !== null && !root.querySelector('.hav__fig--fallback');
  // 깜빡임: 2.4~5.5초마다, 가끔 두 번 연속
  const blink = () => {
    const twice = Math.random() < 0.18;
    const seq = () => {
      setEye('half');
      later(() => {
        setEye('closed');
        later(() => {
          setEye('half');
          later(() => setEye('open'), 40);
        }, 70);
      }, 40);
    };
    seq();
    if (twice) later(seq, 260);
    later(blink, 2400 + Math.random() * 3100);
  };
  // 입: 말하는 동안 70~150ms 마다 모양 교체 (닫힘이 너무 자주 나오지 않게 가중)
  const mouthLoop = () => {
    if (!talk) return setMouth('closed');
    const r = Math.random();
    setMouth(r < 0.38 ? 'mid' : r < 0.78 ? 'open' : 'closed');
    later(mouthLoop, 70 + Math.random() * 80);
  };
  if (hasLayers) later(blink, 1800 + Math.random() * 1800);
  return {
    talking(on) {
      talk = on;
      root.classList.toggle('is-talking', on);
      if (hasLayers) {
        if (on) mouthLoop();
        else setMouth('closed');
      }
    },
    emph() {
      root.classList.add('is-emph');
      later(() => root.classList.remove('is-emph'), 520);
    },
    async playVideo() {
      if (!video || mode !== 'video') return false;
      const onFail = () => {
        root.classList.add('is-video-failed');
      };
      video.addEventListener('error', onFail, { once: true });
      video.addEventListener('ended', () => root.classList.add('is-video-ended'), { once: true });
      try {
        await video.play();
        return true;
      } catch {
        try {
          video.muted = true;
          await video.play();
        } catch {
          onFail();
        }
        return false; // 소리 없는 재생 → TTS 로 목소리를 입힌다
      }
    },
    stop() {
      alive = false;
      timers.forEach((id) => clearTimeout(id));
      timers.clear();
      try {
        video?.pause();
      } catch {
        /* ignore */
      }
    },
  };
}
