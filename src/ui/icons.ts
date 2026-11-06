// 아이템 아이콘 — 인라인 SVG (이미지 자산 없음). 스폰서 제품도 같은 계열(base) 아이콘을 쓴다.
const svg = (body: string) => `<svg viewBox="0 0 48 48" aria-hidden="true">${body}</svg>`;

function bottle(color: string, label = ''): string {
  return svg(
    `<rect x="18" y="4" width="12" height="7" rx="2" fill="#607d8b"/><path d="M14 11h20l3 10v20a4 4 0 0 1-4 4H15a4 4 0 0 1-4-4V21z" fill="${color}"/><rect x="16" y="24" width="16" height="12" rx="2" fill="rgba(255,255,255,0.75)"/>${label ? `<text x="24" y="33" font-size="9" font-weight="700" text-anchor="middle" fill="#37474f">${label}</text>` : ''}<path d="M30 6l8-3v5" stroke="#607d8b" stroke-width="2" fill="none"/>`,
  );
}

function star(): string {
  return '<path d="M39 3l1.6 3.4L44 8l-3.4 1.6L39 13l-1.6-3.4L34 8l3.4-1.6z" fill="#ffb300"/>';
}

export const ICONS: Record<string, string> = {
  cloth: svg('<path d="M8 14c6-4 12 4 18 0s10-4 14 0v20c-4-4-8-4-14 0s-12-4-18 0z" fill="#7ec8e3"/><path d="M8 20c6-4 12 4 18 0s10-4 14 0" stroke="#4f9dbb" stroke-width="2" fill="none"/>'),
  vacuum: svg('<rect x="22" y="6" width="6" height="26" rx="3" fill="#90a4ae"/><rect x="12" y="30" width="26" height="9" rx="4" fill="#5c6bc0"/><circle cx="16" cy="41" r="3" fill="#37474f"/><circle cx="34" cy="41" r="3" fill="#37474f"/>'),
  lintroller: svg('<rect x="8" y="22" width="22" height="12" rx="6" fill="#ef9a9a"/><rect x="8" y="22" width="22" height="12" rx="6" fill="none" stroke="#c62828" stroke-width="2"/><rect x="30" y="25" width="12" height="6" rx="3" fill="#8d6e63"/><path d="M12 26h14M12 30h14" stroke="#fff" stroke-width="1.5"/>'),
  sponge: svg('<rect x="8" y="14" width="32" height="20" rx="5" fill="#ffd54a"/><rect x="8" y="27" width="32" height="7" rx="3" fill="#4caf50"/><circle cx="16" cy="20" r="2" fill="#e6b800"/><circle cx="27" cy="19" r="1.6" fill="#e6b800"/><circle cx="33" cy="23" r="1.8" fill="#e6b800"/>'),
  scrubpad: svg('<rect x="8" y="16" width="32" height="18" rx="4" fill="#8bc34a"/><path d="M10 20l28 10M10 26l24 8M14 18l26 12" stroke="#33691e" stroke-width="1.5"/>'),
  tilebrush: svg('<rect x="10" y="22" width="28" height="9" rx="3" fill="#8d6e63"/><g stroke="#ffb74d" stroke-width="2.4"><path d="M13 31v8M18 31v8M23 31v8M28 31v8M33 31v8"/></g><rect x="20" y="8" width="8" height="15" rx="3" fill="#6d4c41"/>'),
  squeegee: svg('<rect x="22" y="6" width="4" height="22" rx="2" fill="#8d6e63"/><rect x="8" y="28" width="32" height="6" rx="2" fill="#546e7a"/><rect x="8" y="34" width="32" height="4" rx="1" fill="#263238"/><path d="M12 40l24-1" stroke="#4fc3f7" stroke-width="2"/>'),
  deckbrush: svg('<rect x="21" y="4" width="4" height="26" rx="2" fill="#8d6e63"/><rect x="8" y="28" width="32" height="8" rx="3" fill="#5d4037"/><g stroke="#c5a46d" stroke-width="2.4"><path d="M11 36v7M17 36v7M23 36v7M29 36v7M35 36v7"/></g>'),
  hose: svg('<path d="M8 36c0-10 8-14 16-14s14-4 14-12" stroke="#43a047" stroke-width="5" fill="none" stroke-linecap="round"/><rect x="34" y="4" width="8" height="8" rx="2" fill="#ffb300"/><path d="M42 8l4-3M42 8l4 3" stroke="#4fc3f7" stroke-width="2"/>'),
  washer: svg('<rect x="6" y="20" width="16" height="16" rx="4" fill="#fbc02d"/><rect x="20" y="24" width="20" height="5" rx="2" fill="#455a64"/><path d="M40 22l6-4M40 26h7M40 30l6 4" stroke="#4fc3f7" stroke-width="2.4" stroke-linecap="round"/>'),
  mitt: svg('<path d="M14 40V20a10 10 0 0 1 20 0v20z" fill="#80cbc4"/><path d="M14 22l-5-6M34 22l5-8" stroke="#80cbc4" stroke-width="6" stroke-linecap="round"/><rect x="14" y="34" width="20" height="8" rx="2" fill="#4db6ac"/>'),
  wheelbrush: svg('<circle cx="26" cy="26" r="12" fill="none" stroke="#546e7a" stroke-width="4"/><rect x="22" y="4" width="8" height="16" rx="3" fill="#8d6e63"/><g stroke="#ffb74d" stroke-width="2"><path d="M18 36l-3 5M26 38v6M34 36l3 5"/></g>'),
  rinse: svg('<path d="M24 6c6 9 11 15 11 22a11 11 0 0 1-22 0c0-7 5-13 11-22z" fill="#4fc3f7"/><path d="M18 30a6 6 0 0 0 6 6" stroke="#fff" stroke-width="2.4" stroke-linecap="round" fill="none"/>'),
  // 프리미엄
  cordlessvac: svg('<rect x="20" y="4" width="8" height="28" rx="4" fill="#ff7043"/><rect x="10" y="30" width="28" height="9" rx="4" fill="#263238"/><rect x="21" y="8" width="6" height="10" rx="2" fill="#ffccbc"/>' + star()),
  scrubber: svg('<rect x="16" y="6" width="16" height="14" rx="5" fill="#26a69a"/><rect x="21" y="20" width="6" height="8" fill="#455a64"/><circle cx="24" cy="34" r="9" fill="#ffd54a"/><path d="M18 34h12M24 28v12" stroke="#f9a825" stroke-width="2"/>' + star()),
  drillbrush: svg('<rect x="6" y="18" width="20" height="10" rx="3" fill="#f4511e"/><rect x="10" y="28" width="7" height="12" rx="2" fill="#bf360c"/><circle cx="34" cy="23" r="9" fill="#8d6e63"/><g stroke="#ffb74d" stroke-width="2"><path d="M34 14v-4M43 23h4M34 32v4M25 23h-2"/></g>' + star()),
  steamer: svg('<rect x="10" y="22" width="24" height="16" rx="5" fill="#5c6bc0"/><rect x="14" y="14" width="8" height="8" rx="2" fill="#3949ab"/><path d="M30 18c2-3 0-5 2-8M36 20c2-3 0-5 2-8" stroke="#b3e5fc" stroke-width="2.4" fill="none" stroke-linecap="round"/>' + star()),
  magiceraser: svg('<rect x="9" y="15" width="30" height="18" rx="4" fill="#fafafa" stroke="#bdbdbd" stroke-width="2"/><path d="M14 20l6 0M14 24l10 0M14 28l5 0" stroke="#e0e0e0" stroke-width="2"/><path d="M34 8l2 3 3 1-3 1-2 3-1-3-3-1 3-1z" fill="#ffd54a"/>' + star()),
  // 세정제
  allpurpose: bottle('#4fc3f7'),
  glass: bottle('#29b6f6', '유리'),
  degreaser: bottle('#ff9800'),
  descaler: bottle('#66bb6a'),
  bathroom: bottle('#26c6da', '욕실'),
  moldremover: bottle('#9575cd'),
  fabric: bottle('#f06292', '섬유'),
  deckcleaner: bottle('#a1887f', '데크'),
  mossremover: bottle('#7cb342', '이끼'),
  carshampoo: bottle('#42a5f5', 'CAR'),
  wheelcleaner: bottle('#78909c', '휠'),
  tarremover: bottle('#424242', 'TAR'),
  interior: bottle('#ab47bc', '실내'),
  heavydegreaser: bottle('#ef6c00', '강력') .replace('</svg>', star() + '</svg>'),
  limescalegel: bottle('#2e7d32', 'GEL').replace('</svg>', star() + '</svg>'),
};

export function iconFor(base: string): string {
  return ICONS[base] ?? ICONS.cloth;
}
