// 아이템 아이콘 (인라인 SVG, 저작권 자산 불필요)
const svg = (body: string) => `<svg viewBox="0 0 48 48" aria-hidden="true">${body}</svg>`;

export const ICONS: Record<string, string> = {
  cloth: svg('<path d="M8 14c6-4 12 4 18 0s10-4 14 0v20c-4-4-8-4-14 0s-12-4-18 0z" fill="#7ec8e3"/><path d="M8 20c6-4 12 4 18 0s10-4 14 0" stroke="#4f9dbb" stroke-width="2" fill="none"/>'),
  sponge: svg('<rect x="8" y="14" width="32" height="20" rx="5" fill="#ffd54a"/><rect x="8" y="27" width="32" height="7" rx="3" fill="#4caf50"/><circle cx="16" cy="20" r="2" fill="#e6b800"/><circle cx="27" cy="19" r="1.6" fill="#e6b800"/><circle cx="33" cy="23" r="1.8" fill="#e6b800"/>'),
  brush: svg('<rect x="10" y="22" width="28" height="9" rx="3" fill="#8d6e63"/><g stroke="#ffb74d" stroke-width="2.4"><path d="M13 31v8M18 31v8M23 31v8M28 31v8M33 31v8"/></g><rect x="20" y="8" width="8" height="15" rx="3" fill="#6d4c41"/>'),
  vacuum: svg('<rect x="22" y="6" width="6" height="26" rx="3" fill="#90a4ae"/><rect x="12" y="30" width="26" height="9" rx="4" fill="#5c6bc0"/><circle cx="16" cy="41" r="3" fill="#37474f"/><circle cx="34" cy="41" r="3" fill="#37474f"/>'),
  washer: svg('<rect x="6" y="20" width="16" height="16" rx="4" fill="#fbc02d"/><rect x="20" y="24" width="20" height="5" rx="2" fill="#455a64"/><path d="M40 22l6-4M40 26h7M40 30l6 4" stroke="#4fc3f7" stroke-width="2.4" stroke-linecap="round"/>'),
  rinse: svg('<path d="M24 6c6 9 11 15 11 22a11 11 0 0 1-22 0c0-7 5-13 11-22z" fill="#4fc3f7"/><path d="M18 30a6 6 0 0 0 6 6" stroke="#fff" stroke-width="2.4" stroke-linecap="round" fill="none"/>'),
  allpurpose: bottle('#4fc3f7'),
  degreaser: bottle('#ff9800'),
  descaler: bottle('#66bb6a'),
  moldremover: bottle('#9575cd'),
};

function bottle(color: string): string {
  return svg(
    `<rect x="14" y="16" width="20" height="26" rx="5" fill="${color}"/><rect x="18" y="8" width="10" height="9" rx="2" fill="#eceff1"/><path d="M28 10h10l-3 4h-7z" fill="#cfd8dc"/><rect x="18" y="24" width="12" height="8" rx="2" fill="#fff" opacity=".85"/>`,
  );
}

export function iconFor(base: string): string {
  return ICONS[base] ?? ICONS.cloth;
}
