// 실제 판매 제품(제휴 추천) — 쇼호스트가 소개하는 "진짜 제품"
//  원칙
//   1) 시험 성적이 없으므로 게임 성능은 일반 기준 제품과 같다(lab: []). 소개는 "제품 라벨에 있는 용도·주의"만 말한다 — 효능 수치·비교 주장 금지.
//   2) 수익은 구매 수수료(쿠팡 파트너스·Amazon Associates·楽天)다. 링크는 운영자가 각 제휴 사이트에서 만든 것을 관리자 패널에 붙여 넣는다.
//      붙여 넣기 전에는 마켓 검색 링크(수수료 없음, 동작은 함)로 연다.
//   3) 카드에는 "제휴 추천" 배지와 고지 문구(공정위 표시·광고법)를 반드시 붙인다. 브랜드 로고·공식 이미지는 쓰지 않는다(아이콘만).
//   4) 유료 광고주(SponsorProduct, 시험 성적 있음)가 같은 카테고리에 활성 상태면 그쪽이 먼저 나온다(priority).
import type { DetergentId, ToolId } from './catalog';
import type { SponsorProduct } from './sponsor';

export interface RealProductDef {
  id: string;
  base: ToolId | DetergentId;
  kind: 'tool' | 'detergent';
  /** 어느 마켓(언어권)에서 파는 제품인지 */
  market: 'coupang' | 'amazon_us' | 'amazon_jp';
  brand: string;
  name: string;
  /** 마켓 검색어 (정확한 제품명) */
  query: string;
  /** 라벨 기준 용도 한 줄 (쇼호스트 멘트에 그대로) */
  use: string;
  /** 라벨 기준 주의 한 줄 (없으면 생략) */
  caution?: string;
  chemistry?: SponsorProduct['chemistry'];
  cautions?: SponsorProduct['cautions'];
}

/**
 * 시작용 실제 제품 목록 — 널리 팔리는 대표 제품만 (브랜드·제품명은 공식 표기, 설명은 라벨 용도).
 * 운영자는 관리자 패널에서 제휴 링크를 붙이고, 다른 제품으로 바꾸거나 지울 수 있다.
 */
export const REAL_PRODUCTS: RealProductDef[] = [
  // ---- 한국 (쿠팡) ----
  { id: 'kr-yuhanrox', base: 'moldremover', kind: 'detergent', market: 'coupang', brand: '유한락스', name: '레귤러', query: '유한락스 레귤러', use: '염소계 살균·표백제예요. 욕실 곰팡이, 배수구, 흰 빨래 표백에 쓰는 제품이고, 물에 희석해서 쓰라고 라벨에 적혀 있어요.', caution: '산성 세제(식초·구연산·물때 제거제)와 절대 섞지 마세요. 염소 가스가 나와요. 환기하고 장갑 끼고요.', chemistry: 'chlorine', cautions: ['wood', 'fabric', 'paint', 'metal'] },
  { id: 'kr-homestar-mold', base: 'moldremover', kind: 'detergent', market: 'coupang', brand: '홈스타', name: '곰팡이싹 젤', query: '홈스타 곰팡이싹 젤', use: '실리콘·타일 줄눈 곰팡이에 바르는 젤 타입이에요. 흘러내리지 않아서 세로면 곰팡이에 쓰기 좋아요.', caution: '염소계라 산성 제품과 섞지 말고, 금속·나무에는 쓰지 마세요.', chemistry: 'chlorine', cautions: ['wood', 'fabric', 'paint', 'metal'] },
  { id: 'kr-pigeon-bath', base: 'bathroom', kind: 'detergent', market: 'coupang', brand: '피죤', name: '무균무때 욕실용', query: '피죤 무균무때 욕실용', use: '욕실 바닥·벽 타일, 세면대의 물때와 비누때용 욕실 세정제예요. 뿌리고 잠시 두었다가 문지르면 돼요.', caution: '대리석 같은 천연석에는 쓰지 마세요. 다른 세제와 섞지 마세요.', chemistry: 'acid', cautions: ['stone', 'wood', 'fabric'] },
  { id: 'kr-scotchbrite', base: 'scrubpad', kind: 'tool', market: 'coupang', brand: '3M 스카치브라이트', name: '다목적 수세미', query: '3M 스카치브라이트 수세미', use: '설거지와 주방 기름때용 수세미예요. 거친 면과 스펀지 면이 같이 있어서 눌어붙은 때는 거친 면으로 닦아요.', caution: '코팅 프라이팬이나 유리엔 거친 면을 쓰면 흠집이 나요.', cautions: ['glass', 'paint', 'vinyl'] },
  { id: 'kr-magic-block', base: 'magiceraser', kind: 'tool', market: 'coupang', brand: '매직블럭', name: '멜라민 스펀지', query: '매직블럭 멜라민 스펀지', use: '물만 묻혀서 벽·싱크대·운동화 밑창의 찌든 때를 지우는 멜라민 스펀지예요. 세제 없이 쓰는 게 특징이에요.', caution: '아주 고운 사포 같은 원리라 광택 있는 표면·코팅·자동차 도장에는 쓰지 마세요.', cautions: ['paint', 'glass'] },
  { id: 'kr-dyson-v12', base: 'cordlessvac', kind: 'tool', market: 'coupang', brand: '다이슨', name: 'V12 디텍트 슬림', query: '다이슨 V12 디텍트 슬림', use: '무선 스틱 청소기예요. 바닥 먼지와 머리카락을 빨아들이고, 레이저로 먼지를 비춰 주는 헤드가 달려 있어요.', caution: '물이나 젖은 오염은 빨아들이지 마세요.', cautions: [] },
  { id: 'kr-karcher-k2', base: 'washer', kind: 'tool', market: 'coupang', brand: '카처', name: 'K2 고압세척기', query: '카처 K2 고압세척기', use: '가정용 고압세척기예요. 테라스, 외벽, 자동차 하부의 진흙·먼지를 물의 압력으로 걷어내요.', caution: '나무 데크·유리·도장면에 가까이 쏘면 상해요. 거리를 두고 넓게 쏘세요.', cautions: ['wood', 'fabric', 'glass'] },
  { id: 'kr-haan-steam', base: 'steamer', kind: 'tool', market: 'coupang', brand: '한경희', name: '스팀청소기', query: '한경희 스팀청소기', use: '고온 스팀으로 바닥의 찌든 때를 불려 닦는 청소기예요. 세제 없이 물만 써요.', caution: '원목 마루·왁스 바닥엔 스팀이 스며들 수 있으니 제조사 안내를 확인하세요.', cautions: ['wood', 'paint'] },
  // ---- 미국 (Amazon.com) ----
  { id: 'us-magic-eraser', base: 'magiceraser', kind: 'tool', market: 'amazon_us', brand: 'Mr. Clean', name: 'Magic Eraser', query: 'Mr. Clean Magic Eraser', use: 'A melamine foam sponge: wet it and rub away scuffs and grime on walls, sinks and sneakers, no cleaner needed.', caution: 'It works like a very fine abrasive, so keep it off glossy, coated or painted surfaces and car paint.', cautions: ['paint', 'glass'] },
  { id: 'us-scotch-brite', base: 'scrubpad', kind: 'tool', market: 'amazon_us', brand: 'Scotch-Brite', name: 'Heavy Duty Scour Pads', query: 'Scotch-Brite Heavy Duty Scour Pads', use: 'Heavy-duty scouring pads for baked-on grease on pots, grills and stovetops.', caution: 'Will scratch non-stick coatings, glass and painted surfaces.', cautions: ['glass', 'paint', 'vinyl'] },
  { id: 'us-clr', base: 'descaler', kind: 'detergent', market: 'amazon_us', brand: 'CLR', name: 'Calcium, Lime & Rust Remover', query: 'CLR Calcium Lime Rust Remover', use: 'An acid-based remover for limescale, hard-water spots and rust stains on tubs, sinks and tiles.', caution: 'Not for natural stone, wood or fabric. Never mix with bleach or other cleaners.', chemistry: 'acid', cautions: ['stone', 'wood', 'fabric', 'metal'] },
  { id: 'us-windex', base: 'glass', kind: 'detergent', market: 'amazon_us', brand: 'Windex', name: 'Original Glass Cleaner', query: 'Windex Original Glass Cleaner', use: 'Ammonia-based glass and window cleaner. Spray, then wipe with a lint-free cloth or squeegee.', caution: 'Do not mix with bleach.', chemistry: 'neutral', cautions: [] },
  { id: 'us-tilex', base: 'moldremover', kind: 'detergent', market: 'amazon_us', brand: 'Tilex', name: 'Mold & Mildew Remover', query: 'Tilex Mold and Mildew Remover', use: 'A bleach-based spray for mold and mildew on bathroom tile, grout and shower doors.', caution: 'Never mix with acids or ammonia. Ventilate and wear gloves. Keep off metal, wood and fabric.', chemistry: 'chlorine', cautions: ['wood', 'fabric', 'paint', 'metal'] },
  { id: 'us-dyson-v8', base: 'cordlessvac', kind: 'tool', market: 'amazon_us', brand: 'Dyson', name: 'V8 Cordless Vacuum', query: 'Dyson V8 cordless vacuum', use: 'A cordless stick vacuum for dust and hair on floors and upholstery.', caution: 'Dry pickup only.', cautions: [] },
  { id: 'us-karcher-k1700', base: 'washer', kind: 'tool', market: 'amazon_us', brand: 'Kärcher', name: 'K1700 Electric Pressure Washer', query: 'Karcher K1700 pressure washer', use: 'An electric pressure washer for patios, siding and car exteriors.', caution: 'Keep distance from wood decking, glass and painted surfaces.', cautions: ['wood', 'fabric', 'glass'] },
  { id: 'us-meguiars', base: 'carshampoo', kind: 'detergent', market: 'amazon_us', brand: "Meguiar's", name: 'Gold Class Car Wash', query: "Meguiar's Gold Class Car Wash Shampoo", use: 'A pH-balanced car wash shampoo and conditioner for paint. Dilute in a bucket and wash with a mitt.', chemistry: 'neutral', cautions: [] },
  { id: 'us-bissell-steamshot', base: 'steamer', kind: 'tool', market: 'amazon_us', brand: 'Bissell', name: 'SteamShot Handheld Steam Cleaner', query: 'Bissell SteamShot steam cleaner', use: 'A handheld steam cleaner that loosens grime on tile, grout and stovetops with hot steam, no chemicals.', caution: 'Check the maker’s guidance before using steam on sealed wood or painted surfaces.', cautions: ['wood', 'paint'] },
  // ---- 일본 (Amazon.co.jp) ----
  { id: 'jp-magiclean', base: 'degreaser', kind: 'detergent', market: 'amazon_jp', brand: '花王', name: 'マジックリン キッチン用', query: '花王 マジックリン キッチン用', use: 'コンロや換気扇の油汚れ用のアルカリ性キッチンクリーナーです。吹きかけて少し置いてから拭き取ります。', caution: '木製品・塗装面・アルミには使わないでください。', chemistry: 'alkaline', cautions: ['wood', 'vinyl', 'fabric', 'paint'] },
  { id: 'jp-kabikiller', base: 'moldremover', kind: 'detergent', market: 'amazon_jp', brand: 'ジョンソン', name: 'カビキラー', query: 'ジョンソン カビキラー', use: '浴室のゴムパッキンやタイル目地のカビ用の塩素系カビ取り剤です。', caution: '酸性タイプの製品と絶対に混ぜないでください。換気し、手袋をつけて使います。', chemistry: 'chlorine', cautions: ['wood', 'fabric', 'paint', 'metal'] },
  { id: 'jp-gekiochi', base: 'magiceraser', kind: 'tool', market: 'amazon_jp', brand: 'レック', name: '激落ちくん メラミンスポンジ', query: 'レック 激落ちくん メラミンスポンジ', use: '水だけで汚れを落とすメラミンスポンジです。洗面台やシンク、壁の黒ずみに。', caution: '光沢のある面や塗装面、コーティング面は傷つくので使えません。', cautions: ['paint', 'glass'] },
  { id: 'jp-mogi', base: 'descaler', kind: 'detergent', market: 'amazon_jp', brand: '茂木和哉', name: '水アカ洗剤', query: '茂木和哉 水アカ洗剤', use: '鏡や蛇口のウロコ状の水アカ用の研磨成分入り洗剤です。', caution: '塩素系と混ぜないでください。目立たない所で試してから使います。', chemistry: 'acid', cautions: ['stone', 'wood', 'fabric'] },
  { id: 'jp-glass-magiclean', base: 'glass', kind: 'detergent', market: 'amazon_jp', brand: '花王', name: 'ガラスマジックリン', query: '花王 ガラスマジックリン', use: '窓ガラスや鏡の手あか・ほこり用のガラスクリーナーです。', chemistry: 'neutral', cautions: [] },
  { id: 'jp-karcher-k2', base: 'washer', kind: 'tool', market: 'amazon_jp', brand: 'ケルヒャー', name: 'K2 高圧洗浄機', query: 'ケルヒャー K2 高圧洗浄機', use: '家庭用の高圧洗浄機です。外壁やベランダ、車の泥汚れを水圧で落とします。', caution: '木製デッキやガラス、塗装面には近づけすぎないでください。', cautions: ['wood', 'fabric', 'glass'] },
  { id: 'jp-surluster', base: 'carshampoo', kind: 'detergent', market: 'amazon_jp', brand: 'シュアラスター', name: 'カーシャンプー', query: 'シュアラスター カーシャンプー', use: '塗装にやさしい中性のカーシャンプーです。バケツで薄めてミットで洗います。', chemistry: 'neutral', cautions: [] },
  { id: 'jp-scotch-brite', base: 'scrubpad', kind: 'tool', market: 'amazon_jp', brand: '3M スコッチ・ブライト', name: 'キッチンスポンジ', query: '3M スコッチブライト スポンジ', use: '焦げ付きや油汚れ用のたわし面付きスポンジです。', caution: 'フッ素加工やガラス、塗装面には研磨面を使わないでください。', cautions: ['glass', 'paint', 'vinyl'] },
];

const LANG_OF: Record<RealProductDef['market'], 'ko' | 'en' | 'ja'> = { coupang: 'ko', amazon_us: 'en', amazon_jp: 'ja' };
const COUNTRY_OF: Record<RealProductDef['market'], string> = { coupang: 'KR', amazon_us: 'US', amazon_jp: 'JP' };

/** 마켓 검색 링크 (제휴 코드가 설정돼 있으면 붙인다). 운영자가 제휴 사이트에서 만든 링크가 있으면 그것이 우선 */
export function realSearchUrl(p: RealProductDef, env: Record<string, string | undefined> = {}): string {
  const q = encodeURIComponent(p.query);
  if (p.market === 'coupang') {
    const tag = env.VITE_COUPANG_LPTAG ? `&lptag=${encodeURIComponent(env.VITE_COUPANG_LPTAG)}${env.VITE_COUPANG_SUBID ? `&subid=${encodeURIComponent(env.VITE_COUPANG_SUBID)}` : ''}` : '';
    return `https://www.coupang.com/np/search?q=${q}&channel=user${tag}`;
  }
  if (p.market === 'amazon_us') return `https://www.amazon.com/s?k=${q}${env.VITE_AMAZON_TAG_US ? `&tag=${encodeURIComponent(env.VITE_AMAZON_TAG_US)}` : ''}`;
  return `https://www.amazon.co.jp/s?k=${q}${env.VITE_AMAZON_TAG_JP ? `&tag=${encodeURIComponent(env.VITE_AMAZON_TAG_JP)}` : ''}`;
}

/** 실제 제품 → 쇼호스트 파이프라인이 쓰는 SponsorProduct (제휴 추천, 시험 성적 없음) */
export function toSponsor(p: RealProductDef, env: Record<string, string | undefined> = {}): SponsorProduct {
  const lang = LANG_OF[p.market];
  const lines = [p.use, ...(p.caution ? [p.caution] : [])];
  return {
    id: p.id,
    brand: p.brand,
    name: p.name,
    kind: p.kind,
    base: p.base,
    lab: [],
    chemistry: p.chemistry,
    cautions: p.cautions ?? [],
    campaign: { start: '2026-01-01', end: '2099-12-31' },
    affiliate: true,
    sample: false,
    hostLines: { [lang]: lines },
    links: { [p.market]: realSearchUrl(p, env) },
    countries: [COUNTRY_OF[p.market]],
    priority: 1,
    status: 'active',
  };
}

export function realSponsors(env: Record<string, string | undefined> = {}): SponsorProduct[] {
  return REAL_PRODUCTS.map((p) => toSponsor(p, env));
}
