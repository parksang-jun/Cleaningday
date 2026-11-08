// 실제 제품 판매몰 — 게임 속 도구·세제 계열별로 실제 쇼핑몰(제휴 링크)로 연결한다.
// 수익: 쿠팡 파트너스(한국)·Amazon Associates(미국·일본)·라쿠텐 어필리에이트(일본) 구매 수수료.
// 원칙: 모든 링크에 "광고/제휴" 표시, 가격·재고는 판매몰 기준(앱에 표시하지 않음), 포털(Poki/CrazyGames) 빌드는 기본 꺼짐.
import type { DetergentId, DirtType, ToolId } from './game/catalog';
import type { SponsorProduct } from './game/sponsor';
import type { Lang } from './i18n';

export type Market = 'coupang' | 'amazon_us' | 'amazon_jp' | 'rakuten';
export const MARKETS: Market[] = ['coupang', 'amazon_us', 'amazon_jp', 'rakuten'];

export const MARKET_LABEL: Record<Market, string> = { coupang: '쿠팡', amazon_us: 'Amazon', amazon_jp: 'Amazon.co.jp', rakuten: '楽天' };

/** 언어별 기본 마켓 */
export function defaultMarket(lang: Lang): Market {
  if (lang === 'ko') return 'coupang';
  if (lang === 'ja') return 'amazon_jp';
  return 'amazon_us';
}

export function marketsFor(lang: Lang): Market[] {
  if (lang === 'ko') return ['coupang', 'amazon_us'];
  if (lang === 'ja') return ['amazon_jp', 'rakuten'];
  return ['amazon_us', 'coupang'];
}

/** 판매몰 노출 여부 — 포털 빌드는 외부 링크 제한으로 기본 꺼짐 */
export function mallEnabled(): boolean {
  const env = import.meta.env;
  if (env.VITE_MALL_ENABLED === 'false') return false;
  if (env.VITE_MALL_ENABLED === 'true') return true;
  return env.VITE_AD_PROVIDER !== 'poki' && env.VITE_AD_PROVIDER !== 'crazygames';
}

/** 제휴 코드가 설정된 마켓인지 (없어도 링크는 열리지만 수수료가 없음) */
export function marketConfigured(m: Market): boolean {
  const env = import.meta.env;
  if (m === 'coupang') return Boolean(env.VITE_COUPANG_LPTAG);
  if (m === 'amazon_us') return Boolean(env.VITE_AMAZON_TAG_US);
  if (m === 'amazon_jp') return Boolean(env.VITE_AMAZON_TAG_JP);
  return false; // 라쿠텐은 생성된 링크만 사용
}

/** 게임 아이템 계열 → 각 마켓에서 검색할 말 (실제 판매 제품군) */
export const CATEGORY_QUERY: Record<ToolId | DetergentId, { ko: string; en: string; ja: string }> = {
  cloth: { ko: '극세사 청소 걸레', en: 'microfiber cleaning cloth', ja: 'マイクロファイバー クロス 掃除' },
  vacuum: { ko: '청소기', en: 'vacuum cleaner', ja: '掃除機' },
  lintroller: { ko: '돌돌이 테이프 클리너', en: 'lint roller', ja: '粘着クリーナー コロコロ' },
  sponge: { ko: '청소 스펀지', en: 'cleaning sponge', ja: '掃除 スポンジ' },
  scrubpad: { ko: '수세미 스카치브라이트', en: 'scouring pad', ja: 'スコッチブライト たわし' },
  tilebrush: { ko: '욕실 타일 청소솔', en: 'tile grout brush', ja: 'タイル ブラシ 浴室' },
  squeegee: { ko: '유리창 스퀴지', en: 'window squeegee', ja: 'スクイジー 窓' },
  deckbrush: { ko: '데크 브러시 긴 자루', en: 'deck scrub brush', ja: 'デッキブラシ' },
  hose: { ko: '정원 호스 릴', en: 'garden hose', ja: '散水ホース' },
  washer: { ko: '고압세척기', en: 'pressure washer', ja: '高圧洗浄機' },
  mitt: { ko: '세차 워시미트', en: 'car wash mitt', ja: '洗車 ミット' },
  wheelbrush: { ko: '휠 브러시 세차', en: 'wheel brush', ja: 'ホイールブラシ' },
  rinse: { ko: '욕실 샤워기 헤드', en: 'spray bottle for cleaning', ja: 'スプレーボトル 掃除用' },
  cordlessvac: { ko: '무선 스틱 청소기', en: 'cordless stick vacuum', ja: 'コードレス スティック掃除機' },
  scrubber: { ko: '전동 청소솔 욕실', en: 'electric spin scrubber', ja: '電動 お風呂 ブラシ' },
  drillbrush: { ko: '드릴 브러시 세트', en: 'drill brush attachment set', ja: 'ドリル ブラシ 掃除' },
  steamer: { ko: '스팀 청소기', en: 'steam cleaner', ja: 'スチームクリーナー' },
  magiceraser: { ko: '매직 스펀지 멜라민', en: 'melamine magic eraser sponge', ja: 'メラミンスポンジ' },
  allpurpose: { ko: '다목적 세정제', en: 'all purpose cleaner', ja: 'マルチクリーナー' },
  glass: { ko: '유리세정제', en: 'glass cleaner', ja: 'ガラスクリーナー' },
  degreaser: { ko: '주방 기름때 제거제', en: 'kitchen degreaser', ja: 'キッチン 油汚れ 洗剤' },
  descaler: { ko: '물때 제거제 구연산', en: 'limescale remover', ja: '水垢 洗剤 クエン酸' },
  bathroom: { ko: '욕실 세정제', en: 'bathroom cleaner', ja: '浴室 洗剤' },
  moldremover: { ko: '곰팡이 제거제', en: 'mold remover', ja: 'カビ取り剤' },
  fabric: { ko: '패브릭 클리너 소파', en: 'fabric upholstery cleaner', ja: 'ファブリック クリーナー' },
  deckcleaner: { ko: '데크 클리너 산소계', en: 'deck cleaner', ja: 'ウッドデッキ クリーナー' },
  mossremover: { ko: '이끼 제거제', en: 'moss remover', ja: 'コケ 除去剤' },
  carshampoo: { ko: '카샴푸', en: 'car wash shampoo', ja: 'カーシャンプー' },
  wheelcleaner: { ko: '휠 클리너 철분제거제', en: 'wheel cleaner iron remover', ja: 'ホイールクリーナー 鉄粉' },
  tarremover: { ko: '타르 제거제 벌레', en: 'bug and tar remover', ja: 'タール 虫 除去剤' },
  interior: { ko: '자동차 실내 클리너', en: 'car interior cleaner', ja: '車 内装 クリーナー' },
  heavydegreaser: { ko: '강력 기름때 제거제', en: 'heavy duty degreaser', ja: '強力 油汚れ 洗剤' },
  limescalegel: { ko: '물때 젤 세정제', en: 'limescale gel cleaner', ja: '水垢 ジェル 洗剤' },
  rubberglove: { ko: '고무장갑', en: 'rubber gloves', ja: 'ゴム手袋' },
  toothbrush: { ko: '틈새 청소솔 칫솔', en: 'grout cleaning brush', ja: '隙間 掃除 ブラシ' },
  newspaper: { ko: '유리 청소 극세사', en: 'glass cleaning microfiber', ja: 'ガラス クロス マイクロファイバー' },
  claybar: { ko: '클레이바 세차', en: 'clay bar kit', ja: 'クレイバー 洗車' },
  bakingsoda: { ko: '베이킹소다 청소용', en: 'baking soda cleaning', ja: '重曹 掃除用' },
  citric: { ko: '구연산 청소용', en: 'citric acid cleaner', ja: 'クエン酸 掃除用' },
  percarbonate: { ko: '과탄산소다', en: 'sodium percarbonate oxygen bleach', ja: '過炭酸ナトリウム' },
  vinegar: { ko: '청소용 식초', en: 'cleaning vinegar', ja: '掃除用 お酢' },
  toothpaste: { ko: '헤드라이트 복원제', en: 'headlight restoration kit', ja: 'ヘッドライト 黄ばみ取り' },
  cookingoil: { ko: '타르 제거제', en: 'tar remover', ja: 'タール 除去剤' },
  dishsoap: { ko: '주방세제', en: 'dish soap', ja: '食器用洗剤' },
};

/** 오염 → 그 오염에 맞는 아이템 계열 (결과 화면 추천용) */
export const DIRT_TO_ITEM: Record<DirtType, (ToolId | DetergentId)[]> = {
  dust: ['cordlessvac', 'cloth'],
  hair: ['lintroller', 'cordlessvac'],
  mud: ['sponge', 'washer'],
  grease: ['degreaser', 'scrubpad'],
  stain: ['allpurpose', 'fabric'],
  scale: ['descaler', 'scrubber'],
  soap: ['bathroom', 'scrubber'],
  mold: ['moldremover', 'tilebrush'],
  moss: ['mossremover', 'washer'],
  iron: ['wheelcleaner', 'wheelbrush'],
  tar: ['tarremover', 'mitt'],
  film: ['glass', 'squeegee'],
};

function queryFor(base: ToolId | DetergentId, m: Market): string {
  const q = CATEGORY_QUERY[base];
  return m === 'coupang' ? q.ko : m === 'amazon_us' ? q.en : q.ja;
}

/** 마켓별 검색 링크 (+ 제휴 코드) */
export function searchUrl(base: ToolId | DetergentId, m: Market): string {
  const env = import.meta.env;
  const q = encodeURIComponent(queryFor(base, m));
  switch (m) {
    case 'coupang': {
      // 쿠팡 파트너스: 파트너스 사이트에서 만든 링크(link.coupang.com/a/...)를 쓰는 것이 공식.
      // 검색 URL + lptag 는 보조 수단이며 추적 여부는 파트너스 대시보드로 확인할 것.
      const tag = env.VITE_COUPANG_LPTAG ? `&lptag=${encodeURIComponent(env.VITE_COUPANG_LPTAG)}${env.VITE_COUPANG_SUBID ? `&subid=${encodeURIComponent(env.VITE_COUPANG_SUBID)}` : ''}` : '';
      return `https://www.coupang.com/np/search?q=${q}&channel=user${tag}`;
    }
    case 'amazon_us':
      return `https://www.amazon.com/s?k=${q}${env.VITE_AMAZON_TAG_US ? `&tag=${encodeURIComponent(env.VITE_AMAZON_TAG_US)}` : ''}`;
    case 'amazon_jp':
      return `https://www.amazon.co.jp/s?k=${q}${env.VITE_AMAZON_TAG_JP ? `&tag=${encodeURIComponent(env.VITE_AMAZON_TAG_JP)}` : ''}`;
    case 'rakuten':
      return `https://search.rakuten.co.jp/search/mall/${q}/`;
  }
}

/** 운영자가 직접 고른 제품 (제휴 링크는 각 파트너 사이트에서 생성한 것을 그대로 입력) */
export interface MallProduct {
  id: string;
  base: ToolId | DetergentId;
  brand: string;
  name: string;
  /** 짧은 설명 — 효능 주장 없이 용도만 */
  note?: string;
  links: Partial<Record<Market, string>>;
  sample?: boolean;
}

/** 시작용 샘플(가상 브랜드). 실제 운영 시 교체 — 원격 설정(JSON)에서 받아오도록 바꾸는 것을 권장 */
export const MALL_PRODUCTS: MallProduct[] = [
  { id: 'sample-degreaser', base: 'degreaser', brand: 'BrightMax', name: 'Kitchen Degreaser 500ml', note: '주방 후드·가스레인지 기름때용', links: { coupang: 'https://example.com/brightmax', amazon_us: 'https://example.com/brightmax' }, sample: true },
  { id: 'sample-washer', base: 'washer', brand: 'AquaJet', name: 'Cordless Pressure Washer', note: '테라스·자동차·외벽용', links: { coupang: 'https://example.com/aquajet', amazon_us: 'https://example.com/aquajet' }, sample: true },
];

/** 스폰서 제품의 구매 링크 — 마켓별 링크가 있으면 그것, 없으면 공통 제품 페이지 */
export function sponsorBuyUrl(p: SponsorProduct, m: Market): string | undefined {
  return p.links?.[m] ?? p.productUrl;
}

/** 외부 URL 검증 (https 만) */
export function isSafeUrl(url: string | undefined): url is string {
  return typeof url === 'string' && /^https:\/\/[^\s]+$/.test(url);
}
