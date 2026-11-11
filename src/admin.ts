// 운영자(관리자) 모드 — 게임과 분리된 운영 화면
//  · 광고 제품(캠페인) 등록·수정·일시정지·삭제, 시험 성적·소구점·리뷰·쇼호스트 멘트·노출 위치·국가·기간
//  · 쇼호스트 전역 설정(이름, 재노출 간격, 등장 조건)
//  · 집계(노출·클릭·체험·구매 링크·근거 열람, 스테이지 시작/완료/실패)
//  · 설정 JSON 내보내기/가져오기 — 실서비스에선 이 JSON 을 원격 설정으로 배포한다
import { BASE_DETERGENTS, BASE_TOOLS, DIRT_TYPES, SURFACES, type Chemistry, type DirtType, type SurfaceType } from './game/catalog';
import { isProSponsor, performanceRatios, REFERENCE_REMOVAL, type SponsorProduct } from './game/sponsor';
import { avatarHtml } from './avatar';
import { pitchLines, type Placement } from './host';
import { deleteMedia, photoToDataUrl, putMedia } from './media';
import { getLang, t } from './i18n';
import { BASE_CHOICES, blankSponsor, counterRows, exportConfig, findSponsor, hostConfig, importConfig, removeSponsor, resetCounters, saveHostConfig, saveSponsor, setSponsorStatus, sponsorIssues, sponsorList, sumCounter } from './ops';
import { getStore } from './storage';
import { iconFor } from './ui/icons';

export interface AdminHooks {
  onExit: () => void;
  onChange: () => void;
  preview: (p: SponsorProduct, placement: Placement) => void;
}

type Tab = 'campaigns' | 'edit' | 'host' | 'stats' | 'export';

// 운영 화면 문구 (ko/en — 운영 도구라 두 언어만)
const KO: Record<string, string> = {
  title: '관리자 모드 · 싹싹 클린 운영',
  toGame: '게임 모드로',
  campaigns: '광고 제품',
  edit: '편집',
  host: '쇼호스트',
  stats: '통계',
  export: '배포 JSON',
  newProduct: '＋ 새 광고 제품',
  active: '진행중',
  paused: '일시정지',
  pause: '일시정지',
  resume: '재개',
  remove: '삭제',
  preview: '미리보기',
  save: '저장',
  cancel: '취소',
  pro: '고성능(PRO)',
  issues: '노출 안 됨',
  ok: '노출 중',
  sample: '샘플',
  custom: '운영자 등록',
  shows: '노출',
  trials: '체험',
  buys: '구매 클릭',
  evidence: '근거 열람',
  ctr: '반응률',
  basic: '기본 정보',
  labTitle: '시험 성적 (제거율 %, 비우면 없음)',
  labNote: '게임 성능은 이 수치만으로 정해지고, 기준 제품 대비 0.5~1.8배로 제한됩니다. 기준 제품이 닦는 오염만 반영됩니다.',
  evidenceTitle: '성적서(근거)',
  campaignTitle: '캠페인',
  pitchTitle: '쇼호스트 멘트',
  pitchNote: '비우면 시험 성적·소구점·리뷰로 자동 생성. 한 줄에 한 멘트. {brand} {name} {host} 치환. 표시·광고법: 근거 자료가 있는 문구만 입력하세요 (예: "곰팡이 99.9% 제거"는 시험 성적서가 있을 때만).',
  claims: '소구점 (한 줄에 하나, 최대 3개 노출)',
  reviews: '리뷰',
  reviewCount: '리뷰 수',
  rating: '평점',
  source: '출처',
  placements: '노출 위치',
  plIntro: '판 시작 소개',
  plStruggle: '막혔을 때',
  plResult: '결과 화면',
  plShop: '상점 LIVE',
  countries: '노출 국가 (없으면 전부)',
  status: '상태',
  priority: '우선순위 (높을수록 먼저)',
  cautions: '사용 금지 재질 (라벨)',
  links: '구매 링크',
  linksNote: '제휴 사이트(쿠팡 파트너스 · Amazon Associates)에서 만든 제품 링크를 붙여 넣으세요. 비우면 마켓 검색 링크로 열리고 수수료는 없어요.',
  affiliate: '제휴 추천 (실제 판매 제품 — 시험 성적 없음, 게임 성능 변화 없음)',
  affiliateTag: '제휴',
  affiliateList: '실제 판매 제품 (제휴 추천)',
  affiliateListNote: '유료 광고주가 없는 자리에 쇼호스트가 소개하는 실제 제품이에요. "수정"에서 쿠팡 파트너스·Amazon 제휴 링크를 붙이면 구매 수수료가 들어와요. 라벨에 있는 용도·주의만 쓰고 효능 수치는 쓰지 마세요.',
  affiliateOn: '실제 판매 제품(제휴 추천) 소개 켜기',
  affiliateNote: '유료 광고주가 없는 자리에 쇼호스트가 실제 판매 제품을 소개하고, 구매 링크 수수료(쿠팡 파트너스·Amazon Associates)로 수익이 나요. 카드에 제휴 배지와 고지 문구가 자동으로 붙어요.',
  audioTitle: '쇼호스트 음성 (사람 목소리)',
  audioNote: '"멘트 복사"로 대본을 복사해 TTS 서비스(네이버 클로바 더빙 · 타입캐스트 · ElevenLabs · Google Cloud TTS)에서 mp3를 만든 뒤 언어별로 올리세요. 있으면 브라우저 기계음 대신 이 음성이 나와요. 터미널에서는 `npm run voice -- <제품id> <언어>` 로도 만들 수 있어요.',
  audioUrl: '음성 URL (https mp3)',
  audioFile: 'mp3 올리기 (이 기기 전용)',
  audioClear: '음성 지우기',
  audioUploaded: '업로드된 음성 사용 중',
  autoPitch: '자동 생성 멘트 미리보기',
  hostTitle: '쇼호스트 설정',
  hostEnabled: '쇼호스트 켜기',
  hostName: '쇼호스트 이름',
  introCooldown: '같은 제품 재노출 간격(분)',
  introFrom: '판 시작 소개를 시작할 스테이지',
  struggleAfter: '막혔을 때 등장 조건 (틀린 시도 횟수)',
  resultOn: '매 판 끝 결과 화면에서 이번 판에 쓴 제품 소개',
  realHost: '실사 쇼호스트 (사진·영상)',
  realHostNote: '사진을 넣으면 내장 초상 대신 실제 사람 얼굴이 라이브 카드에 나옵니다(목소리는 기기 TTS). 제품마다 소개 영상을 넣으면 영상이 재생되고 영상 음성이 목소리가 됩니다 — 영상은 "편집" 화면에서 제품별로.',
  howToReal: '실사 영상 만드는 법',
  howToRealSteps: '① 편집 화면의 "멘트 복사"로 대본(한/영/일)을 복사 → ② HeyGen · D-ID · Synthesia 같은 AI 아바타 서비스(또는 실제 모델 촬영)에서 같은 인물로 제품별 영상(mp4, 세로 1:1 권장, 20~40초)을 만든다 → ③ 영상을 CDN 에 올려 https URL 을 제품의 "소개 영상 URL"에 넣거나, 테스트용으로 파일을 직접 올린다(이 기기에만 저장) → ④ 같은 인물의 정면 사진 1장을 아래 "사진"에 넣으면 영상이 없는 제품도 같은 얼굴로 소개한다.',
  photo: '사진',
  photoUrl: '사진 URL (https)',
  photoFile: '사진 파일 올리기',
  photoClear: '사진 지우기',
  photoSaved: '사진 저장됨',
  videoTitle: '이 제품 소개 영상 (실사 쇼호스트)',
  videoUrl: '소개 영상 URL (https mp4/webm)',
  videoFile: '영상 파일 올리기 (이 기기 전용)',
  videoClear: '영상 지우기',
  videoUploaded: '업로드된 영상 사용 중',
  hostPhotoUrl: '이 제품 전용 쇼호스트 사진 URL (비우면 공통 사진)',
  copyScript: '멘트 복사 (한/영/일 대본)',
  scriptCopied: '대본을 복사했어요 — HeyGen 등에 붙여넣으세요',
  copyFailed: '복사 실패 — 아래 자동 생성 멘트를 직접 복사하세요',
  statsTitle: '집계 (이 기기, 출시 후엔 서버 집계로 교체)',
  reset: '집계 초기화',
  game: '게임',
  levelStart: '스테이지 시작',
  levelDone: '완료',
  levelFail: '실패',
  coins: '보유 코인',
  exportTitle: '원격 설정으로 배포할 JSON',
  exportNote: '이 JSON 을 CDN/Supabase 에 올리고 앱이 시작 시 받아오면 같은 구조로 동작합니다. 복사해 운영 저장소에 커밋하세요.',
  copy: '복사',
  copied: '복사됨',
  importTitle: '가져오기 (붙여넣고 적용 — 현재 제품 목록을 대체)',
  apply: '적용',
  imported: '제품 {n}개 적용됨',
  saved: '저장됨',
  deleted: '삭제됨',
  confirmDelete: '정말 삭제할까요? (내장 샘플은 일시정지만 가능)',
  kindTool: '도구',
  kindDet: '세정제',
  base: '기준 제품(계열)',
  chemistry: '화학 계열',
  coverage: '분당 닦는 면적(m², 도구)',
  tagline: '한 줄 소개',
  brand: '브랜드',
  name: '제품명',
  id: 'ID',
  lab: '시험기관',
  report: '성적서 번호',
  date: '시험일',
  protocol: '시험 방법',
  url: '성적서 URL',
  start: '시작일',
  end: '종료일',
  issue_no_evidence: '성적서(시험기관·번호) 없음',
  issue_campaign_inactive: '캠페인 기간 밖',
  issue_bad_lab_value: '제거율 값 오류(0~100)',
  issue_kind_mismatch: '종류/기준 제품 불일치(프리미엄 계열 불가)',
  issue_no_lab_results: '시험 성적 없음',
  issue_paused: '일시정지',
  issue_bad_base: '기준 제품 없음',
  placementIntro: '소개',
  placementStruggle: '막힘',
  placementResult: '결과',
  placementShop: '상점',
  total: '합계',
};
const EN: Record<string, string> = {
  title: 'Operator mode · Sparkle Clean ops',
  toGame: 'Back to game',
  campaigns: 'Sponsored products',
  edit: 'Edit',
  host: 'Live host',
  stats: 'Stats',
  export: 'Config JSON',
  newProduct: '+ New sponsored product',
  active: 'Active',
  paused: 'Paused',
  pause: 'Pause',
  resume: 'Resume',
  remove: 'Delete',
  preview: 'Preview',
  save: 'Save',
  cancel: 'Cancel',
  pro: 'PRO grade',
  issues: 'Not shown',
  ok: 'Live',
  sample: 'Sample',
  custom: 'Custom',
  shows: 'Shows',
  trials: 'Trials',
  buys: 'Buy clicks',
  evidence: 'Evidence views',
  ctr: 'Response',
  basic: 'Basics',
  labTitle: 'Lab results (removal %, blank = none)',
  labNote: 'In-game performance comes only from these figures, clamped to 0.5–1.8× the standard product. Only soils the base product cleans count.',
  evidenceTitle: 'Evidence (report)',
  campaignTitle: 'Campaign',
  pitchTitle: 'Live host script',
  pitchNote: 'Leave empty to auto-generate from lab results, claims and reviews. One line per sentence. {brand} {name} {host} are replaced. Advertising law: only enter claims you can substantiate.',
  claims: 'Claims (one per line, first 3 shown)',
  reviews: 'Reviews',
  reviewCount: 'Review count',
  rating: 'Rating',
  source: 'Source',
  placements: 'Placements',
  plIntro: 'Stage intro',
  plStruggle: 'When stuck',
  plResult: 'Result screen',
  plShop: 'Shop LIVE',
  countries: 'Countries (empty = all)',
  status: 'Status',
  priority: 'Priority (higher first)',
  cautions: 'Do-not-use surfaces (label)',
  links: 'Buy links',
  linksNote: 'Paste product links made on the affiliate site (Coupang Partners, Amazon Associates). Left blank, the card opens a market search link and earns no commission.',
  affiliate: 'Affiliate pick (a real retail product — no lab results, no change to game performance)',
  affiliateTag: 'Affiliate',
  affiliateList: 'Real retail products (affiliate picks)',
  affiliateListNote: 'Real products the host presents where no paid advertiser applies. Paste Coupang Partners / Amazon affiliate links under Edit to earn commissions. Keep the copy to label facts — no efficacy numbers.',
  affiliateOn: 'Present real retail products (affiliate picks)',
  affiliateNote: 'Where no paid advertiser applies, the host presents a real product and the buy link earns a commission (Coupang Partners, Amazon Associates). The card gets the affiliate badge and disclosure automatically.',
  audioTitle: 'Host voice (recorded, human-like)',
  audioNote: 'Use "Copy script" and make an mp3 with a TTS service (ElevenLabs, Google Cloud TTS, Naver Clova Dubbing, Typecast), then upload it per language. When present it replaces the browser voice. From a terminal: `npm run voice -- <product id> <lang>`.',
  audioUrl: 'Voice URL (https mp3)',
  audioFile: 'Upload mp3 (this device only)',
  audioClear: 'Remove voice',
  audioUploaded: 'Using uploaded voice',
  autoPitch: 'Auto-generated script preview',
  hostTitle: 'Live host settings',
  hostEnabled: 'Enable live host',
  hostName: 'Host name',
  introCooldown: 'Same-product cooldown (min)',
  introFrom: 'Stage intros start at stage',
  struggleAfter: 'Appear when stuck after N wrong tries',
  resultOn: 'Every stage end: present a product used in that stage',
  realHost: 'Real-person host (photo · video)',
  realHostNote: 'Add a photo and the live card shows a real face instead of the built-in portrait (voice = device TTS). Add a per-product video and it plays with its own voice — videos are set per product in "Edit".',
  howToReal: 'How to make real-person videos',
  howToRealSteps: '① Copy the script (ko/en/ja) with "Copy script" in Edit → ② Generate one video per product with the same presenter on an AI avatar service (HeyGen, D-ID, Synthesia) or film a model (mp4, 1:1, 20–40 s) → ③ Host it on a CDN and paste the https URL into the product\'s "Video URL", or upload the file for testing (stored on this device only) → ④ Add one frontal photo of the same presenter below so products without a video use the same face.',
  photo: 'Photo',
  photoUrl: 'Photo URL (https)',
  photoFile: 'Upload photo',
  photoClear: 'Remove photo',
  photoSaved: 'Photo saved',
  videoTitle: 'Product video (real-person host)',
  videoUrl: 'Video URL (https mp4/webm)',
  videoFile: 'Upload video file (this device only)',
  videoClear: 'Remove video',
  videoUploaded: 'Using uploaded video',
  hostPhotoUrl: 'Host photo URL for this product only (blank = shared photo)',
  copyScript: 'Copy script (ko/en/ja)',
  scriptCopied: 'Script copied — paste it into HeyGen etc.',
  copyFailed: 'Copy failed — copy the auto-generated lines below',
  statsTitle: 'Counters (this device; replace with server analytics at launch)',
  reset: 'Reset counters',
  game: 'Game',
  levelStart: 'Stage starts',
  levelDone: 'Completed',
  levelFail: 'Failed',
  coins: 'Coins',
  exportTitle: 'JSON to publish as remote config',
  exportNote: 'Host this JSON (CDN/Supabase) and fetch it at app start; the app uses the same structure. Copy it into your ops repo.',
  copy: 'Copy',
  copied: 'Copied',
  importTitle: 'Import (paste and apply — replaces the current list)',
  apply: 'Apply',
  imported: '{n} products applied',
  saved: 'Saved',
  deleted: 'Deleted',
  confirmDelete: 'Delete this product? (built-in samples can only be paused)',
  kindTool: 'Tool',
  kindDet: 'Cleaner',
  base: 'Base product (family)',
  chemistry: 'Chemistry',
  coverage: 'Coverage m²/min (tools)',
  tagline: 'Tagline',
  brand: 'Brand',
  name: 'Product name',
  id: 'ID',
  lab: 'Lab',
  report: 'Report no.',
  date: 'Test date',
  protocol: 'Protocol',
  url: 'Report URL',
  start: 'Start',
  end: 'End',
  issue_no_evidence: 'No evidence (lab / report no.)',
  issue_campaign_inactive: 'Outside campaign dates',
  issue_bad_lab_value: 'Bad removal value (0–100)',
  issue_kind_mismatch: 'Kind/base mismatch (premium bases not allowed)',
  issue_no_lab_results: 'No lab results',
  issue_paused: 'Paused',
  issue_bad_base: 'Unknown base product',
  placementIntro: 'Intro',
  placementStruggle: 'Stuck',
  placementResult: 'Result',
  placementShop: 'Shop',
  total: 'Total',
};
function A(key: string, params?: Record<string, string | number>): string {
  const d = getLang() === 'ko' ? KO : EN;
  let s = d[key] ?? EN[key] ?? key;
  if (params) for (const [k, v] of Object.entries(params)) s = s.replace(`{${k}}`, String(v));
  return s;
}
const esc = (s: string) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

let tab: Tab = 'campaigns';
let editing: SponsorProduct | null = null;
let flash = '';
/** 복사에 실패했을 때 직접 복사하라고 보여 주는 대본 */
let scriptText = '';

export function renderAdmin(app: HTMLElement, hooks: AdminHooks): void {
  const tabs: Tab[] = ['campaigns', 'edit', 'host', 'stats', 'export'];
  app.innerHTML = `
    <div class="admin" data-testid="admin">
      <header class="admin__top">
        <div class="admin__title">🛠 ${esc(A('title'))}</div>
        <button class="btn btn--sm" data-act="exit" data-testid="admin-exit">🎮 ${esc(A('toGame'))}</button>
      </header>
      <nav class="tabs admin__tabs" role="tablist">${tabs.map((k) => `<button class="tab${tab === k ? ' is-on' : ''}" data-tab="${k}" data-testid="admin-tab-${k}">${esc(A(k))}</button>`).join('')}</nav>
      ${flash ? `<p class="admin__flash" data-testid="admin-flash">${esc(flash)}</p>` : ''}
      <section class="admin__panel" data-el="panel"></section>
    </div>`;
  flash = '';
  app.querySelector('[data-act="exit"]')!.addEventListener('click', hooks.onExit);
  app.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((b) =>
    b.addEventListener('click', () => {
      tab = b.dataset.tab as Tab;
      if (tab === 'edit' && !editing) editing = blankSponsor();
      renderAdmin(app, hooks);
    }),
  );
  const panel = app.querySelector<HTMLElement>('[data-el="panel"]')!;
  switch (tab) {
    case 'campaigns':
      renderCampaigns(panel, app, hooks);
      break;
    case 'edit':
      renderEdit(panel, app, hooks);
      break;
    case 'host':
      renderHost(panel, app, hooks);
      break;
    case 'stats':
      renderStats(panel, app, hooks);
      break;
    case 'export':
      renderExport(panel, app, hooks);
      break;
  }
}

function placementCounts(id: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const pl of ['intro', 'struggle', 'result', 'shop', 'preview']) out[pl] = sumCounter('host_show', id, pl);
  return out;
}

function renderCampaigns(panel: HTMLElement, app: HTMLElement, hooks: AdminHooks) {
  const all = sponsorList();
  const list = all.filter((p) => !p.affiliate);
  const affiliates = all.filter((p) => p.affiliate);
  const today = new Date().toISOString().slice(0, 10);
  const row = (p: SponsorProduct) => {
          const issues = sponsorIssues(p, today);
          const live = issues.length === 0;
          const shows = sumCounter('host_show', p.id);
          const trials = sumCounter('host_cta_trial', p.id);
          const buys = sumCounter('host_cta_buy', p.id) + sumCounter('mall_click', p.id);
          const pro = isProSponsor(p);
          return `<li class="admin__item${live ? '' : ' is-off'}" data-testid="admin-item-${esc(p.id)}">
            <div class="shop__icon">${iconFor(p.base)}</div>
            <div class="admin__body">
              <div class="admin__name"><b>${esc(p.brand)} ${esc(p.name)}</b> <span class="pill${live ? ' pill--ok' : ' pill--off'}">${live ? esc(A('ok')) : esc(A('issues'))}</span>${pro ? `<span class="pill pill--premium">${esc(A('pro'))}</span>` : ''}${p.affiliate ? `<span class="tag-affiliate">${esc(A('affiliateTag'))}</span>` : ''}${p.sample ? `<span class="tag-sample">${esc(A('sample'))}</span>` : ''}${p.custom ? `<span class="pill">${esc(A('custom'))}</span>` : ''}</div>
              <div class="small muted">${esc(p.kind === 'tool' ? A('kindTool') : A('kindDet'))} · ${esc(t(`item_${p.base}`))} · ${esc(p.campaign.start)} ~ ${esc(p.campaign.end)} · ${p.countries?.length ? esc(p.countries.join(',')) : 'ALL'} · ${p.status === 'paused' ? esc(A('paused')) : esc(A('active'))}</div>
              ${issues.length ? `<div class="small warn">${issues.map((i) => esc(A(`issue_${i}`))).join(' · ')}</div>` : ''}
              <div class="small">${esc(A('shows'))} ${shows} · ${esc(A('trials'))} ${trials} · ${esc(A('buys'))} ${buys} · ${esc(A('ctr'))} ${shows ? Math.round(((trials + buys) / shows) * 100) : 0}%</div>
            </div>
            <div class="admin__act">
              <button class="btn btn--sm" data-edit="${esc(p.id)}" data-testid="admin-edit-${esc(p.id)}">${esc(A('edit'))}</button>
              <button class="btn btn--sm" data-preview="${esc(p.id)}" data-testid="admin-preview-${esc(p.id)}">▶ ${esc(A('preview'))}</button>
              <button class="btn btn--sm" data-toggle="${esc(p.id)}" data-testid="admin-toggle-${esc(p.id)}">${p.status === 'paused' ? esc(A('resume')) : esc(A('pause'))}</button>
              ${p.custom ? `<button class="btn btn--sm btn--danger" data-remove="${esc(p.id)}">${esc(A('remove'))}</button>` : ''}
            </div>
          </li>`;
  };
  panel.innerHTML = `
    <div class="row"><h3>${esc(A('campaigns'))} (${list.length})</h3><button class="btn btn--sm btn--primary" data-act="new" data-testid="admin-new">${esc(A('newProduct'))}</button></div>
    <ul class="admin__list" data-testid="admin-list">${list.map(row).join('')}</ul>
    <details class="admin__auto" data-testid="admin-affiliates"><summary>${esc(A('affiliateList'))} (${affiliates.length})</summary>
      <p class="small muted">${esc(A('affiliateListNote'))}</p>
      <ul class="admin__list" data-testid="admin-affiliate-list">${affiliates.map(row).join('')}</ul>
    </details>`;
  panel.querySelector('[data-act="new"]')!.addEventListener('click', () => {
    editing = blankSponsor();
    tab = 'edit';
    renderAdmin(app, hooks);
  });
  panel.querySelectorAll<HTMLButtonElement>('[data-edit]').forEach((b) =>
    b.addEventListener('click', () => {
      editing = structuredClone(findSponsor(b.dataset.edit!)!);
      tab = 'edit';
      renderAdmin(app, hooks);
    }),
  );
  panel.querySelectorAll<HTMLButtonElement>('[data-preview]').forEach((b) => b.addEventListener('click', () => hooks.preview(findSponsor(b.dataset.preview!)!, 'preview')));
  panel.querySelectorAll<HTMLButtonElement>('[data-toggle]').forEach((b) =>
    b.addEventListener('click', () => {
      const p = findSponsor(b.dataset.toggle!)!;
      setSponsorStatus(p.id, p.status === 'paused' ? 'active' : 'paused');
      hooks.onChange();
      renderAdmin(app, hooks);
    }),
  );
  panel.querySelectorAll<HTMLButtonElement>('[data-remove]').forEach((b) =>
    b.addEventListener('click', () => {
      // 뷰어는 confirm() 을 막으므로 두 번 누르면 삭제
      if (b.dataset.armed) {
        removeSponsor(b.dataset.remove!);
        flash = A('deleted');
        hooks.onChange();
        renderAdmin(app, hooks);
      } else {
        b.dataset.armed = '1';
        b.textContent = `${A('remove')}?`;
      }
    }),
  );
}

function field(label: string, inner: string): string {
  return `<label class="admin__field"><span>${esc(label)}</span>${inner}</label>`;
}
function input(name: string, value: string | number | undefined, type = 'text', extra = ''): string {
  return `<input name="${name}" type="${type}" value="${esc(value === undefined ? '' : String(value))}" ${extra}>`;
}

function renderEdit(panel: HTMLElement, app: HTMLElement, hooks: AdminHooks) {
  const p = editing ?? blankSponsor();
  editing = p;
  const isBuiltIn = !p.custom;
  const bases = BASE_CHOICES[p.kind];
  const refDirts = Object.keys(REFERENCE_REMOVAL[p.base] ?? {});
  const chems: Chemistry[] = ['neutral', 'alkaline', 'acid', 'chlorine', 'solvent'];
  const lines = pitchLines(p, getLang(), { hostName: hostConfig().name, placement: 'intro' });
  panel.innerHTML = `
    <form class="admin__form" data-testid="admin-form">
      <h3>${esc(A('basic'))}</h3>
      <div class="admin__grid">
        ${field(A('id'), input('id', p.id, 'text', isBuiltIn ? 'readonly' : 'required'))}
        ${field(A('brand'), input('brand', p.brand, 'text', 'required'))}
        ${field(A('name'), input('name', p.name, 'text', 'required'))}
        ${field(A('tagline'), input('tagline', p.tagline))}
        ${field(A('kindTool') + '/' + A('kindDet'), `<select name="kind"><option value="tool" ${p.kind === 'tool' ? 'selected' : ''}>${esc(A('kindTool'))}</option><option value="detergent" ${p.kind === 'detergent' ? 'selected' : ''}>${esc(A('kindDet'))}</option></select>`)}
        ${field(A('base'), `<select name="base">${bases.map((b) => `<option value="${b}" ${p.base === b ? 'selected' : ''}>${esc(t(`item_${b}`))} (${b})</option>`).join('')}</select>`)}
        ${p.kind === 'detergent' ? field(A('chemistry'), `<select name="chemistry">${chems.map((c) => `<option value="${c}" ${(p.chemistry ?? BASE_DETERGENTS[p.base as keyof typeof BASE_DETERGENTS]?.chemistry) === c ? 'selected' : ''}>${c}</option>`).join('')}</select>`) : field(A('coverage'), input('coverageM2PerMin', p.coverageM2PerMin, 'number', 'step="0.1" min="0"'))}
      </div>
      <h3>${esc(A('labTitle'))}</h3>
      <p class="small muted">${esc(A('labNote'))}</p>
      <div class="admin__grid admin__grid--lab">
        ${DIRT_TYPES.map((d) => {
          const v = p.lab.find((l) => l.dirt === d)?.removalPct;
          const ref = REFERENCE_REMOVAL[p.base]?.[d];
          return field(`${t(`dirt_${d}`)}${ref ? ` (std ${ref}%)` : ''}`, input(`lab_${d}`, v, 'number', `min="0" max="100" step="1" ${refDirts.includes(d) ? '' : 'disabled'}`));
        }).join('')}
      </div>
      <h3>${esc(A('cautions'))}</h3>
      <div class="admin__checks">${SURFACES.map((s) => `<label><input type="checkbox" name="caution_${s}" ${p.cautions.includes(s) ? 'checked' : ''}> ${esc(t(`surf_${s}`))}</label>`).join('')}</div>
      <h3>${esc(A('evidenceTitle'))}</h3>
      <div class="admin__grid">
        ${field(A('lab'), input('ev_lab', p.evidence?.lab))}
        ${field(A('report'), input('ev_report', p.evidence?.reportId))}
        ${field(A('date'), input('ev_date', p.evidence?.date, 'date'))}
        ${field(A('url'), input('ev_url', p.evidence?.url, 'url'))}
      </div>
      ${field(A('protocol'), `<textarea name="ev_protocol" rows="2">${esc(p.evidence?.protocol ?? '')}</textarea>`)}
      <h3>${esc(A('campaignTitle'))}</h3>
      <div class="admin__grid">
        ${field(A('start'), input('c_start', p.campaign.start, 'date'))}
        ${field(A('end'), input('c_end', p.campaign.end, 'date'))}
        ${field(A('status'), `<select name="status"><option value="active" ${p.status !== 'paused' ? 'selected' : ''}>${esc(A('active'))}</option><option value="paused" ${p.status === 'paused' ? 'selected' : ''}>${esc(A('paused'))}</option></select>`)}
        ${field(A('priority'), input('priority', p.priority ?? 0, 'number'))}
      </div>
      <label class="setting"><span>${esc(A('affiliate'))}</span><input type="checkbox" name="affiliate" ${p.affiliate ? 'checked' : ''} data-testid="admin-affiliate-flag"></label>
      <div class="admin__checks"><span class="small muted">${esc(A('countries'))}</span>${['KR', 'US', 'JP'].map((c) => `<label><input type="checkbox" name="country_${c}" ${p.countries?.includes(c) ? 'checked' : ''}> ${c}</label>`).join('')}</div>
      <div class="admin__checks"><span class="small muted">${esc(A('placements'))}</span>
        ${(['intro', 'struggle', 'result', 'shop'] as const).map((k) => `<label><input type="checkbox" name="pl_${k}" ${p.placements?.[k] !== false ? 'checked' : ''}> ${esc(A(`pl${k[0].toUpperCase()}${k.slice(1)}`))}</label>`).join('')}
      </div>
      <h3>${esc(A('pitchTitle'))}</h3>
      <p class="small muted">${esc(A('pitchNote'))}</p>
      ${field(A('claims'), `<textarea name="claims" rows="3" data-testid="admin-claims">${esc((p.claims ?? []).join('\n'))}</textarea>`)}
      <div class="admin__grid">
        ${field(A('reviewCount'), input('rv_count', p.reviews?.count ?? 0, 'number', 'min="0"'))}
        ${field(A('rating'), input('rv_rating', p.reviews?.rating ?? 0, 'number', 'min="0" max="5" step="0.1"'))}
        ${field(A('source'), input('rv_source', p.reviews?.source))}
      </div>
      ${(['ko', 'en', 'ja'] as const).map((l) => field(`${A('pitchTitle')} (${l})`, `<textarea name="host_${l}" rows="3">${esc((p.hostLines?.[l] ?? []).join('\n'))}</textarea>`)).join('')}
      <details class="admin__auto"><summary>${esc(A('autoPitch'))}</summary><ol>${lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ol></details>
      ${scriptText ? `<textarea class="admin__script" rows="8" readonly data-testid="admin-script">${esc(scriptText)}</textarea>` : ''}
      <h3>${esc(A('videoTitle'))}</h3>
      <div class="admin__grid">
        ${field(A('videoUrl'), input('hostVideo', p.hostVideo?.startsWith('idb:') ? '' : p.hostVideo, 'url', 'data-testid="admin-video-url"'))}
        ${field(A('hostPhotoUrl'), input('hostPhoto', p.hostPhoto, 'url'))}
      </div>
      <div class="btn-row admin__media-row">
        <label class="btn btn--sm">${esc(A('videoFile'))}<input type="file" name="videoFile" accept="video/mp4,video/webm" hidden data-testid="admin-video-file"></label>
        ${p.hostVideo?.startsWith('idb:') ? `<span class="small muted" data-testid="admin-video-state">✓ ${esc(A('videoUploaded'))}</span><button class="btn btn--sm" type="button" data-act="video-clear">${esc(A('videoClear'))}</button>` : ''}
        <button class="btn btn--sm" type="button" data-act="copy-script" data-testid="admin-copy-script">📋 ${esc(A('copyScript'))}</button>
      </div>
      <h3>${esc(A('audioTitle'))}</h3>
      <p class="small muted">${esc(A('audioNote'))}</p>
      ${(['ko', 'en', 'ja'] as const)
        .map(
          (l) => `<div class="admin__grid admin__audio-row">
        ${field(`${A('audioUrl')} (${l})`, input(`audio_${l}`, p.hostAudio?.[l]?.startsWith('idb:') ? '' : p.hostAudio?.[l], 'url', `data-testid="admin-audio-url-${l}"`))}
        <div class="btn-row">
          <label class="btn btn--sm">${esc(A('audioFile'))} (${l})<input type="file" name="audioFile_${l}" accept="audio/mpeg,audio/mp4,audio/ogg,audio/wav" hidden data-testid="admin-audio-file-${l}"></label>
          ${p.hostAudio?.[l]?.startsWith('idb:') ? `<span class="small muted" data-testid="admin-audio-state-${l}">✓ ${esc(A('audioUploaded'))}</span><button class="btn btn--sm" type="button" data-act="audio-clear" data-lang="${l}">${esc(A('audioClear'))}</button>` : ''}
        </div>
      </div>`,
        )
        .join('')}
      <h3>${esc(A('links'))}</h3>
      <p class="small muted">${esc(A('linksNote'))}</p>
      <div class="admin__grid">
        ${field('productUrl', input('productUrl', p.productUrl, 'url'))}
        ${field('coupang', input('link_coupang', p.links?.coupang, 'url'))}
        ${field('amazon_us', input('link_amazon_us', p.links?.amazon_us, 'url'))}
        ${field('amazon_jp', input('link_amazon_jp', p.links?.amazon_jp, 'url'))}
        ${field('rakuten', input('link_rakuten', p.links?.rakuten, 'url'))}
      </div>
      <div class="btn-row">
        <button class="btn btn--primary" type="submit" data-testid="admin-save">${esc(A('save'))}</button>
        <button class="btn" type="button" data-act="preview" data-testid="admin-preview-edit">▶ ${esc(A('preview'))}</button>
        <button class="btn" type="button" data-act="cancel">${esc(A('cancel'))}</button>
      </div>
    </form>`;
  const form = panel.querySelector<HTMLFormElement>('form')!;
  const read = (): SponsorProduct => {
    const f = new FormData(form);
    const g = (k: string) => String(f.get(k) ?? '').trim();
    const kind = g('kind') as 'tool' | 'detergent';
    const base = g('base') as SponsorProduct['base'];
    const lab = DIRT_TYPES.filter((d) => g(`lab_${d}`) !== '').map((d) => ({ dirt: d, removalPct: Number(g(`lab_${d}`)) }));
    const next: SponsorProduct = {
      ...p,
      id: g('id') || p.id,
      brand: g('brand'),
      name: g('name'),
      tagline: g('tagline') || undefined,
      kind,
      base,
      lab,
      chemistry: kind === 'detergent' ? (g('chemistry') as Chemistry) : undefined,
      coverageM2PerMin: kind === 'tool' && g('coverageM2PerMin') ? Number(g('coverageM2PerMin')) : undefined,
      cautions: SURFACES.filter((s) => f.get(`caution_${s}`)) as SurfaceType[],
      evidence: { lab: g('ev_lab'), reportId: g('ev_report'), date: g('ev_date'), protocol: g('ev_protocol'), url: g('ev_url') || undefined },
      campaign: { start: g('c_start'), end: g('c_end') },
      status: g('status') as 'active' | 'paused',
      priority: Number(g('priority') || 0),
      countries: ['KR', 'US', 'JP'].filter((c) => f.get(`country_${c}`)),
      placements: { intro: Boolean(f.get('pl_intro')), struggle: Boolean(f.get('pl_struggle')), result: Boolean(f.get('pl_result')), shop: Boolean(f.get('pl_shop')) },
      claims: g('claims').split('\n').map((x) => x.trim()).filter(Boolean),
      reviews: { count: Number(g('rv_count') || 0), rating: Number(g('rv_rating') || 0), source: g('rv_source') || undefined },
      hostLines: Object.fromEntries((['ko', 'en', 'ja'] as const).map((l) => [l, g(`host_${l}`).split('\n').map((x) => x.trim()).filter(Boolean)])),
      hostVideo: g('hostVideo') || (p.hostVideo?.startsWith('idb:') ? p.hostVideo : undefined),
      hostAudio: Object.fromEntries((['ko', 'en', 'ja'] as const).map((l) => [l, g(`audio_${l}`) || (p.hostAudio?.[l]?.startsWith('idb:') ? p.hostAudio[l] : undefined)])),
      affiliate: Boolean(f.get('affiliate')) || undefined,
      hostPhoto: g('hostPhoto') || undefined,
      productUrl: g('productUrl') || undefined,
      links: { coupang: g('link_coupang') || undefined, amazon_us: g('link_amazon_us') || undefined, amazon_jp: g('link_amazon_jp') || undefined, rakuten: g('link_rakuten') || undefined },
    };
    return next;
  };
  form.querySelector<HTMLSelectElement>('[name="kind"]')!.addEventListener('change', () => {
    const next = read();
    next.base = BASE_CHOICES[next.kind][0] as SponsorProduct['base'];
    editing = next;
    renderAdmin(app, hooks);
  });
  form.querySelector<HTMLSelectElement>('[name="base"]')!.addEventListener('change', () => {
    editing = read();
    renderAdmin(app, hooks);
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const next = read();
    saveSponsor(next);
    editing = null;
    flash = `${A('saved')} · ${next.brand} ${next.name}`;
    tab = 'campaigns';
    hooks.onChange();
    renderAdmin(app, hooks);
  });
  form.querySelector('[data-act="preview"]')!.addEventListener('click', () => {
    editing = read();
    hooks.preview(editing, 'preview');
  });
  // 실사 영상 파일 → IndexedDB (이 기기 전용), 설정에는 idb: 참조만
  form.querySelector<HTMLInputElement>('[name="videoFile"]')!.addEventListener('change', async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const next = read();
    const key = `sponsor-video:${next.id || 'new'}`;
    if (await putMedia(key, file)) {
      next.hostVideo = `idb:${key}`;
      editing = next;
      flash = `${A('saved')} · ${A('videoUploaded')}`;
      renderAdmin(app, hooks);
    }
  });
  form.querySelector('[data-act="video-clear"]')?.addEventListener('click', async () => {
    const next = read();
    if (next.hostVideo?.startsWith('idb:')) await deleteMedia(next.hostVideo.slice(4));
    next.hostVideo = undefined;
    editing = next;
    renderAdmin(app, hooks);
  });
  // 쇼호스트 음성(mp3) 파일 → IndexedDB, 설정에는 idb: 참조만 (언어별)
  for (const l of ['ko', 'en', 'ja'] as const) {
    form.querySelector<HTMLInputElement>(`[name="audioFile_${l}"]`)!.addEventListener('change', async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const next = read();
      const key = `sponsor-audio:${next.id || 'new'}:${l}`;
      if (await putMedia(key, file)) {
        next.hostAudio = { ...(next.hostAudio ?? {}), [l]: `idb:${key}` };
        editing = next;
        flash = `${A('saved')} · ${A('audioUploaded')}`;
        renderAdmin(app, hooks);
      }
    });
  }
  form.querySelectorAll<HTMLButtonElement>('[data-act="audio-clear"]').forEach((b) =>
    b.addEventListener('click', async () => {
      const l = b.dataset.lang as 'ko' | 'en' | 'ja';
      const next = read();
      const cur = next.hostAudio?.[l];
      if (cur?.startsWith('idb:')) await deleteMedia(cur.slice(4));
      next.hostAudio = { ...(next.hostAudio ?? {}), [l]: undefined };
      editing = next;
      renderAdmin(app, hooks);
    }),
  );
  // 대본 복사: 세 언어 자동 생성(또는 직접 쓴) 멘트 — AI 아바타 영상 제작용
  form.querySelector('[data-act="copy-script"]')!.addEventListener('click', async () => {
    const next = read();
    const name = hostConfig().name;
    const text = (['ko', 'en', 'ja'] as const)
      .map((l) => `[${l}] ${next.brand} ${next.name}\n` + pitchLines(next, l, { hostName: name, placement: 'result', context: 'used' }).join('\n'))
      .join('\n\n');
    let ok = false;
    try {
      await navigator.clipboard.writeText(text);
      ok = true;
    } catch {
      // 클립보드 API 가 막힌 환경(웹뷰·권한 없음): 숨은 textarea + execCommand
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;left:-9999px;top:0';
      document.body.appendChild(ta);
      ta.select();
      try {
        ok = document.execCommand('copy');
      } catch {
        ok = false;
      }
      ta.remove();
    }
    flash = ok ? A('scriptCopied') : A('copyFailed');
    scriptText = ok ? '' : text;
    editing = next;
    renderAdmin(app, hooks);
  });
  form.querySelector('[data-act="cancel"]')!.addEventListener('click', () => {
    editing = null;
    tab = 'campaigns';
    renderAdmin(app, hooks);
  });
}

function renderHost(panel: HTMLElement, app: HTMLElement, hooks: AdminHooks) {
  const h = hostConfig();
  panel.innerHTML = `
    <form class="admin__form" data-testid="admin-host">
      <h3>${esc(A('hostTitle'))}</h3>
      <label class="setting"><span>${esc(A('hostEnabled'))}</span><input type="checkbox" name="enabled" ${h.enabled ? 'checked' : ''}></label>
      ${field(A('hostName'), input('name', h.name))}
      ${field(A('introCooldown'), input('introCooldownMin', h.introCooldownMin, 'number', 'min="0"'))}
      ${field(A('introFrom'), input('introFromStage', h.introFromStage, 'number', 'min="1" max="96"'))}
      ${field(A('struggleAfter'), input('struggleAfterTries', h.struggleAfterTries, 'number', 'min="1"'))}
      <label class="setting"><span>${esc(A('resultOn'))}</span><input type="checkbox" name="result" ${h.result ? 'checked' : ''}></label>
      <label class="setting"><span>${esc(A('affiliateOn'))}</span><input type="checkbox" name="affiliate" ${h.affiliate ? 'checked' : ''} data-testid="admin-affiliate"></label>
      <p class="small muted">${esc(A('affiliateNote'))}</p>
      <h3>${esc(A('realHost'))}</h3>
      <p class="small muted">${esc(A('realHostNote'))}</p>
      <div class="admin__media">
        <div class="admin__media-preview" data-testid="admin-host-preview">${avatarHtml({ photo: h.photo }, { small: true })}</div>
        <div class="admin__media-fields">
          ${field(A('photoUrl'), input('photo', h.photo?.startsWith('data:') ? '' : h.photo, 'url', 'placeholder="https://…/host.jpg"'))}
          <div class="btn-row">
            <label class="btn btn--sm">${esc(A('photoFile'))}<input type="file" name="photoFile" accept="image/*" hidden data-testid="admin-photo-file"></label>
            ${h.photo ? `<button class="btn btn--sm" type="button" data-act="photo-clear" data-testid="admin-photo-clear">${esc(A('photoClear'))}</button>` : ''}
          </div>
        </div>
      </div>
      <details class="admin__auto"><summary>${esc(A('howToReal'))}</summary><p class="small">${esc(A('howToRealSteps'))}</p></details>
      <div class="btn-row"><button class="btn btn--primary" type="submit" data-testid="admin-host-save">${esc(A('save'))}</button></div>
    </form>`;
  const form = panel.querySelector('form')!;
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const f = new FormData(e.target as HTMLFormElement);
    const url = String(f.get('photo') || '').trim();
    saveHostConfig({
      enabled: Boolean(f.get('enabled')),
      name: String(f.get('name') || '뽀득이'),
      introCooldownMin: Number(f.get('introCooldownMin') || 0),
      introFromStage: Number(f.get('introFromStage') || 1),
      struggleAfterTries: Number(f.get('struggleAfterTries') || 2),
      result: Boolean(f.get('result')),
      affiliate: Boolean(f.get('affiliate')),
      photo: url || (h.photo?.startsWith('data:') ? h.photo : undefined),
    });
    flash = A('saved');
    hooks.onChange();
    renderAdmin(app, hooks);
  });
  form.querySelector<HTMLInputElement>('[name="photoFile"]')!.addEventListener('change', async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
      const data = await photoToDataUrl(file);
      saveHostConfig({ photo: data });
      flash = A('photoSaved');
      hooks.onChange();
      renderAdmin(app, hooks);
    } catch {
      flash = A('copyFailed');
      renderAdmin(app, hooks);
    }
  });
  form.querySelector('[data-act="photo-clear"]')?.addEventListener('click', () => {
    saveHostConfig({ photo: undefined });
    hooks.onChange();
    renderAdmin(app, hooks);
  });
}

function renderStats(panel: HTMLElement, app: HTMLElement, hooks: AdminHooks) {
  const st = getStore();
  const list = sponsorList();
  const rows = list
    .map((p) => {
      const pc = placementCounts(p.id);
      const shows = sumCounter('host_show', p.id);
      const trials = sumCounter('host_cta_trial', p.id);
      const buys = sumCounter('host_cta_buy', p.id) + sumCounter('mall_click', p.id);
      const ev = sumCounter('sponsor_evidence_view', p.id);
      return `<tr><td>${esc(p.brand)} ${esc(p.name)}</td><td>${shows}<br><span class="small muted">${esc(A('placementIntro'))} ${pc.intro} · ${esc(A('placementStruggle'))} ${pc.struggle} · ${esc(A('placementResult'))} ${pc.result} · ${esc(A('placementShop'))} ${pc.shop}</span></td><td>${trials}</td><td>${buys}</td><td>${ev}</td><td>${shows ? Math.round(((trials + buys) / shows) * 100) : 0}%</td></tr>`;
    })
    .join('');
  const starts = sumCounter('level_start');
  const done = sumCounter('level_complete');
  const fails = sumCounter('level_fail');
  panel.innerHTML = `
    <h3>${esc(A('statsTitle'))}</h3>
    <div class="admin__kpis">
      <div class="kpi"><b>${starts}</b><span>${esc(A('levelStart'))}</span></div>
      <div class="kpi"><b>${done}</b><span>${esc(A('levelDone'))}</span></div>
      <div class="kpi"><b>${fails}</b><span>${esc(A('levelFail'))}</span></div>
      <div class="kpi"><b>${st.stats.gamesPlayed}</b><span>${esc(A('game'))}</span></div>
      <div class="kpi"><b>${st.coins}</b><span>${esc(A('coins'))}</span></div>
    </div>
    <div class="admin__tablewrap"><table class="ev-table admin__table" data-testid="admin-stats">
      <thead><tr><th>${esc(A('campaigns'))}</th><th>${esc(A('shows'))}</th><th>${esc(A('trials'))}</th><th>${esc(A('buys'))}</th><th>${esc(A('evidence'))}</th><th>${esc(A('ctr'))}</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
    <details><summary>raw (${counterRows().length})</summary><pre class="admin__pre">${esc(counterRows().map((r) => `${r.event}|${r.sponsor}|${r.placement}: ${r.n}`).join('\n'))}</pre></details>
    <div class="btn-row"><button class="btn btn--sm btn--danger" data-act="reset">${esc(A('reset'))}</button></div>`;
  panel.querySelector('[data-act="reset"]')!.addEventListener('click', () => {
    resetCounters();
    renderAdmin(app, hooks);
  });
}

function renderExport(panel: HTMLElement, app: HTMLElement, hooks: AdminHooks) {
  const json = exportConfig();
  panel.innerHTML = `
    <h3>${esc(A('exportTitle'))}</h3>
    <p class="small muted">${esc(A('exportNote'))}</p>
    <textarea class="admin__json" rows="12" readonly data-testid="admin-export">${esc(json)}</textarea>
    <div class="btn-row"><button class="btn btn--sm" data-act="copy">${esc(A('copy'))}</button></div>
    <h3>${esc(A('importTitle'))}</h3>
    <textarea class="admin__json" rows="6" data-el="import" data-testid="admin-import" placeholder="{ &quot;sponsors&quot;: [ ... ] }"></textarea>
    <div class="btn-row"><button class="btn btn--sm btn--primary" data-act="import" data-testid="admin-import-apply">${esc(A('apply'))}</button></div>
    <p class="small warn" data-el="msg"></p>`;
  panel.querySelector('[data-act="copy"]')!.addEventListener('click', async (e) => {
    const b = e.currentTarget as HTMLButtonElement;
    try {
      await navigator.clipboard.writeText(json);
      b.textContent = A('copied');
    } catch {
      const ta = panel.querySelector<HTMLTextAreaElement>('[data-testid="admin-export"]')!;
      ta.focus();
      ta.select();
    }
  });
  panel.querySelector('[data-act="import"]')!.addEventListener('click', () => {
    const ta = panel.querySelector<HTMLTextAreaElement>('[data-el="import"]')!;
    const r = importConfig(ta.value);
    if (r.ok) {
      flash = A('imported', { n: r.count });
      tab = 'campaigns';
      hooks.onChange();
      renderAdmin(app, hooks);
    } else panel.querySelector('[data-el="msg"]')!.textContent = r.error;
  });
}

/** 테스트·문서용: 제품의 성능 환산 요약 */
export function sponsorSummary(p: SponsorProduct): { pro: boolean; ratios: Partial<Record<DirtType, number>> } {
  const r = performanceRatios(p);
  const ratios: Partial<Record<DirtType, number>> = {};
  for (const d of DIRT_TYPES) if (r[d] !== 1) ratios[d] = r[d];
  return { pro: isProSponsor(p), ratios };
}

export { BASE_TOOLS };
