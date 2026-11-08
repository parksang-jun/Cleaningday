// 진짜 청소 꿀팁 — 유명 살림 기사·유튜브·전문가 가이드에서 확인한 방법만 담는다.
// 게임의 조합(레시피)은 이 팁을 그대로 따른다: 어떤 오염에 어떤 집안 재료·도구를 어떻게 쓰는지, 주의할 점(섞으면 안 되는 것)까지.
// 문장은 모두 우리가 다시 쓴 요약이며, 출처는 링크로만 안내한다.
import type { DirtType, ItemId, SurfaceType } from './catalog';
import type { Lang } from '../i18n';

export interface TipSource {
  name: string;
  url: string;
  kind: 'article' | 'youtube' | 'guide' | 'official';
  date?: string;
}

export interface CleaningTip {
  id: string;
  dirts: DirtType[];
  /** 조합이 아니라 "하지 말 것"을 알려 주는 팁 (게임 레시피 없음) */
  caution_only?: boolean;
  /** 두 재료를 섞어 써야 하는 팁 (게임에서는 겹쳐 뿌리면 혼합물이 된다) */
  mix?: 'soapsoda' | 'soapvinegar';
  /** 비우면 모든 표면 */
  surfaces?: SurfaceType[];
  /** 이 팁을 이루는 게임 아이템 — 수첩·결과에서 조합과 맞춰 보여준다 */
  items: ItemId[];
  title: Record<Lang, string>;
  steps: Record<Lang, string[]>;
  caution?: Record<Lang, string>;
  /** 쇼호스트(청소 전문가)가 말하는 한 줄 원리 */
  expert: Record<Lang, string>;
  sources: TipSource[];
}

const WIKITREE_STOVE: TipSource = { name: '위키트리 [위키꿀팁] 가스레인지 청소', url: 'https://www.wikitree.co.kr/articles/1169964', kind: 'article', date: '2026-10-31' };
const WIKITREE_GROUT: TipSource = { name: '위키트리 [위키꿀팁] 욕실 줄눈 곰팡이', url: 'https://www.wikitree.co.kr/articles/1170254', kind: 'article', date: '2026-10-31' };
const WIKITREE_PET: TipSource = { name: '위키트리 — 반려동물 털, 고무장갑', url: 'https://www.wikitree.co.kr/articles/1137321', kind: 'article', date: '2026-05-19' };
const WIKITREE_TOOTH: TipSource = { name: '위키트리 — 치약으로 헤드라이트', url: 'https://www.wikitree.co.kr/articles/1135211', kind: 'article', date: '2026-05-06' };
const WIKITREE_BLEACH: TipSource = { name: '위키트리 [생활꿀팁] 락스에 식초 섞으면 위험', url: 'https://www.wikitree.co.kr/articles/1168477', kind: 'article' };
const GQ_CITRIC: TipSource = { name: 'GQ Korea — 구연산 활용법 9', url: 'https://www.gqkorea.co.kr/?p=308557', kind: 'article', date: '2024-11-23' };
const GQ_WINDOW: TipSource = { name: 'GQ Korea — 얼룩진 유리창 닦는 법 6', url: 'https://www.gqkorea.co.kr/?p=316158', kind: 'article', date: '2025-02-13' };
const GQ_PET: TipSource = { name: 'GQ Korea — 반려동물 털 치우기', url: 'https://www.gqkorea.co.kr/?p=319121', kind: 'article', date: '2025-03-18' };
const KHAN_SINK: TipSource = { name: '레이디경향 — 스테인리스 싱크대, 결이 중요해', url: 'https://lady.khan.co.kr/living/article/202605081422001', kind: 'article', date: '2026-05-08' };
const KHAN_OVEN: TipSource = { name: '레이디경향 — 오븐 기름때, 베이킹소다로 불려 닦으세요', url: 'https://lady.khan.co.kr/cooking/article/202610271127011', kind: 'article', date: '2026-10-27' };
const KHAN_GAS: TipSource = { name: '레이디경향 — 표백제+식초, 유독가스', url: 'https://lady.khan.co.kr/health/article/202302011737011', kind: 'article', date: '2023-02-01' };
const OHOU_SODA: TipSource = { name: '오늘의집 — 만능 베이킹소다 활용팁', url: 'https://ohou.se/advices/6184', kind: 'article', date: '2022-04-23' };
const AJD_PERCARB: TipSource = { name: '아정당 — 과탄산소다 활용법', url: 'https://www.ajd.co.kr/contents/basic-tip/detail/%EA%B3%BC%ED%83%84%EC%82%B0%EC%86%8C%EB%8B%A4_%ED%99%9C%EC%9A%A9%EB%B2%95_%EC%82%B4%EB%A6%BC_%EB%85%B8%ED%95%98%EC%9A%B0_%EC%95%8C%EB%A0%A4%EB%93%9C%EB%A6%BD%EB%8B%88%EB%8B%A4-76678', kind: 'article', date: '2025-11-14' };
const YT_MIX: TipSource = { name: 'YouTube — 이건 섞지 마세요! 천연세제 베이킹소다·구연산·과탄산소다', url: 'https://www.youtube.com/watch?v=qkWibz7vx9I', kind: 'youtube' };
const YT_DIFF: TipSource = { name: 'YouTube — 천연세제(베이킹소다·구연산·과탄산소다) 차이점과 사용법', url: 'https://www.youtube.com/watch?v=yTtJIAHA5QM', kind: 'youtube' };
const YT_EIGHT: TipSource = { name: 'YouTube — 헷갈리는 살림템 8가지 올바른 사용법', url: 'https://www.youtube.com/watch?v=eLO9KSC2w_0', kind: 'youtube' };
const JALOPNIK_TAR: TipSource = { name: 'Jalopnik — How to get tar off your car', url: 'https://www.jalopnik.com/2058191/how-to-get-tar-off-car-without-damaging-paint/', kind: 'article', date: '2025-12-28' };
const WD40_TAR: TipSource = { name: 'WD-40 — How to remove tar from a car', url: 'https://wd40.com.au/how-to/how-to-remove-tar-from-a-car', kind: 'guide' };
const DANAWA_CLAY: TipSource = { name: '다나와 DPG — 셀프세차 #5 클레이바', url: 'https://dpg.danawa.com/mobile/news/view?boardSeq=62&listSeq=2716142', kind: 'guide', date: '2014-08-19' };
const HB_DECK: TipSource = { name: 'Homebuilding & Renovating — Fastest way to remove algae from decking', url: 'https://www.homebuilding.co.uk/advice/fastest-way-to-remove-algae-from-decking', kind: 'article', date: '2025-04-11' };
const BELLEVUE: TipSource = { name: 'City of Bellevue — 친환경 청소 레시피 (한국어, 공공기관)', url: 'https://bellevuewa.gov/sites/default/files/media/pdf_document/2024/utl-24-114132-cleangreenrecipes-ko.pdf', kind: 'official' };
const KHAN_VS: TipSource = { name: '레이디경향 — 식초 vs 베이킹소다, 진정한 청소 강자는?', url: 'https://lady.khan.co.kr/living/article/202601131039001', kind: 'article', date: '2026-01-13' };
const WIKITREE_TRACK: TipSource = { name: '위키트리 — 창틀 먼지, 휴지와 주방세제 물', url: 'https://www.wikitree.co.kr/articles/1147300', kind: 'article', date: '2026-07-20' };
const HUNKER_OXY: TipSource = { name: 'Hunker — Green algae on concrete: oxygen bleach', url: 'https://www.hunker.com/1971953/how-to-get-rid-of-green-algae-concrete-cement-oxygen-bleach/', kind: 'article' };

export const TIPS: CleaningTip[] = [
  {
    id: 'grease-bakingsoda',
    dirts: ['grease'],
    surfaces: ['steel', 'ceramic', 'tile', 'glass', 'metal'],
    items: ['bakingsoda', 'sponge', 'scrubpad'],
    title: { ko: '기름때는 베이킹소다 반죽으로 불려서', en: 'Baked-on grease: baking-soda paste, then wait', ja: '油汚れは重曹ペーストでふやかす' },
    steps: {
      ko: ['베이킹소다 2 : 물 1로 되직한 반죽을 만든다', '기름때 위에 두껍게 바르고 키친타월을 덮어 물을 뿌린 뒤 랩으로 20~30분', '플라스틱 주걱으로 밀어내고 젖은 스펀지로 여러 번 닦는다', '하얀 가루가 남으면 식초물(1:1) 묻힌 천으로 마무리'],
      en: ['Mix baking soda and water about 2:1 into a thick paste', 'Spread it thick, cover with a paper towel, mist, wrap in plastic for 20–30 min', 'Push the softened grime off with a plastic spatula, wipe with a wet sponge', 'White residue? Finish with a cloth dipped in 1:1 vinegar water'],
      ja: ['重曹2：水1でペーストを作る', '厚く塗ってキッチンペーパーとラップで20〜30分', 'プラスチックのへらで押し出し、濡れスポンジで拭く', '白い粉が残ったら酢水で仕上げ'],
    },
    caution: { ko: '베이킹소다와 식초를 한 번에 섞으면 서로 중화돼 효과가 떨어져요 — 베이킹소다 먼저, 식초는 마무리에만.', en: 'Don’t mix baking soda and vinegar in one go — they neutralize each other. Soda first, vinegar last.', ja: '重曹と酢を同時に混ぜると中和して効果が落ちます。重曹→仕上げに酢。' },
    expert: { ko: '기름때는 산성 지방이라 알칼리가 분해해요. 베이킹소다 반죽을 발라 20분만 불리면 힘 안 들이고 밀려 나옵니다.', en: 'Grease is fatty acid, so an alkali breaks it down. Twenty minutes under a baking-soda paste and it pushes right off.', ja: '油汚れは酸性の脂なのでアルカリが分解します。重曹ペーストで20分ふやかすと力を入れずに落ちます。' },
    sources: [WIKITREE_STOVE, KHAN_OVEN, OHOU_SODA],
  },
  {
    id: 'grease-percarbonate',
    dirts: ['grease'],
    surfaces: ['steel', 'metal'],
    items: ['percarbonate', 'scrubpad', 'tilebrush'],
    title: { ko: '삼발이·후드 필터는 과탄산소다 물에 담가 두기', en: 'Grates & hood filters: soak in warm percarbonate water', ja: '五徳・フィルターは過炭酸ナトリウムに浸ける' },
    steps: {
      ko: ['40~60℃ 물 2L에 과탄산소다 2~3큰술을 녹인다', '삼발이·필터를 30~60분 담근다 (심하면 하룻밤)', '솔로 문지르고 헹군 뒤 완전히 말린다'],
      en: ['Dissolve 2–3 tbsp percarbonate in 2 L of 40–60 °C water', 'Soak grates and filters 30–60 min (overnight if heavy)', 'Scrub, rinse, dry completely'],
      ja: ['40〜60℃の湯2Lに過炭酸ナトリウム大さじ2〜3', '五徳・フィルターを30〜60分浸ける', 'ブラシでこすり、すすいで乾かす'],
    },
    caution: { ko: '알루미늄 부품은 알칼리에 오래 담그면 검게 변해요 — 주방세제 물에 잠깐만.', en: 'Aluminum parts darken in alkaline soaks — dish soap only, briefly.', ja: 'アルミ部品はアルカリで黒ずむので中性洗剤で短時間だけ。' },
    expert: { ko: '과탄산소다는 따뜻한 물에서 산소 거품을 내며 눌어붙은 기름을 들어 올려요. 담가 두는 게 일이에요, 문지르는 게 아니라.', en: 'Percarbonate releases oxygen in warm water and lifts baked-on grease. The soak does the work, not the scrubbing.', ja: '過炭酸ナトリウムは温水で酸素の泡を出し、焦げ付いた油を浮かせます。' },
    sources: [WIKITREE_STOVE, AJD_PERCARB],
  },
  {
    id: 'mold-percarbonate',
    dirts: ['mold'],
    items: ['percarbonate', 'toothbrush', 'tilebrush'],
    title: { ko: '줄눈 곰팡이: 과탄산소다 페이스트 + 칫솔', en: 'Grout mold: percarbonate paste + an old toothbrush', ja: '目地のカビ：過炭酸ペースト＋歯ブラシ' },
    steps: {
      ko: ['줄눈의 물기를 수건으로 먼저 닦는다 (물이 남으면 세정력이 희석)', '과탄산소다를 40~60℃ 물에 되직하게 개어 줄눈에 두껍게 바른다', '20~30분 뒤 헌 칫솔로 문지르고 샤워기로 헹군다', '욕실 타일은 과탄산소다 2큰술/뜨거운 물 1L를 뿌려 10분 뒤 솔질'],
      en: ['Dry the grout first — standing water dilutes the cleaner', 'Mix percarbonate with 40–60 °C water into a thick paste and spread it on the grout', 'After 20–30 min scrub with an old toothbrush and rinse with the shower', 'For tiles, spray 2 tbsp per 1 L hot water, wait 10 min, brush'],
      ja: ['目地の水気を先に拭く', '過炭酸ナトリウムを温水で練って厚く塗る', '20〜30分後に歯ブラシでこすり、シャワーで流す'],
    },
    caution: { ko: '염소계(락스)와 절대 같이 쓰지 마세요 — 유해가스. 알루미늄·구리는 변색.', en: 'Never combine with chlorine bleach — toxic gas. Discolors aluminum and copper.', ja: '塩素系漂白剤と絶対に併用しないこと。' },
    expert: { ko: '곰팡이는 뿌리가 줄눈 속에 있어서 겉만 닦으면 돌아와요. 산소계 페이스트를 20분 올려 두면 색소까지 분해됩니다.', en: 'Mold roots sit inside the grout, so surface wiping brings it back. Twenty minutes under an oxygen paste breaks down the pigment too.', ja: 'カビは目地の中に根があるので、酸素系ペーストを20分置いて色素まで分解します。' },
    sources: [WIKITREE_GROUT, AJD_PERCARB],
  },
  {
    id: 'mold-bleach',
    dirts: ['mold'],
    surfaces: ['tile', 'ceramic', 'glass', 'stone', 'steel', 'brick'],
    items: ['moldremover', 'tilebrush', 'sponge', 'rinse'],
    title: { ko: '검은 곰팡이: 락스 적신 휴지 습포 30분~1시간', en: 'Black mold: bleach-soaked tissue compress, 30–60 min', ja: '黒カビ：漂白剤を含ませたティッシュで湿布' },
    steps: {
      ko: ['줄눈 너비로 접은 휴지에 곰팡이 제거제(락스 계열)를 적셔 붙이고 랩으로 덮는다', '30분~1시간 뒤 떼고 샤워기로 충분히 헹군다', '창문·환풍기 켜고 장갑·마스크 착용, 닫힌 욕실에 머물지 말 것'],
      en: ['Fold tissue to the grout width, soak in the mold remover, press on, cover with wrap', 'Peel after 30–60 min and rinse thoroughly', 'Window open, fan on, gloves and mask; don’t stay in the closed bathroom'],
      ja: ['目地幅に折ったティッシュに漂白剤を含ませ貼り、ラップで覆う', '30〜60分後にはがして十分にすすぐ', '換気・手袋・マスク'],
    },
    caution: { ko: '락스에 식초·구연산·물때 제거제(산성)를 섞거나 연달아 쓰면 염소가스가 나와요. 산성 제품을 쓰려면 물로 헹구고 냄새가 빠진 뒤에.', en: 'Bleach + vinegar, citric acid or acidic descalers releases chlorine gas. Rinse with water and air out before any acidic product.', ja: '漂白剤に酢・クエン酸・酸性洗剤を混ぜると塩素ガス。酸性を使う前に水で流し換気。' },
    expert: { ko: '습포가 핵심이에요. 뿌리고 흘러내리면 접촉 시간이 몇 초뿐인데, 휴지에 적셔 붙이면 30분을 머물러요.', en: 'The compress is the trick: a spray runs off in seconds, but a soaked tissue keeps the cleaner on the spot for 30 minutes.', ja: '湿布が鍵。スプレーは数秒で流れますが、ティッシュなら30分留まります。' },
    sources: [WIKITREE_GROUT, KHAN_GAS, WIKITREE_BLEACH],
  },
  {
    id: 'scale-citric',
    dirts: ['scale'],
    items: ['citric', 'sponge', 'toothbrush', 'descaler'],
    title: { ko: '물때·석회는 구연산 물로 10~15분', en: 'Limescale: citric-acid water, 10–15 min', ja: '水垢はクエン酸水で10〜15分' },
    steps: {
      ko: ['따뜻한 물 500ml에 구연산 1~2스푼을 녹여 분무기에', '유리·타일·수전에 고루 뿌리고 10~15분 둔다', '젖은 스펀지로 문지르고 헹군다', '샤워기 헤드는 비닐봉지에 구연산물(2스푼/500ml)을 담아 1시간 담갔다 헹굼'],
      en: ['Dissolve 1–2 spoons of citric acid in 500 ml warm water in a sprayer', 'Spray glass, tiles and taps; wait 10–15 min', 'Scrub with a wet sponge and rinse', 'Shower head: bag it in citric water (2 spoons/500 ml) for an hour, then rinse'],
      ja: ['ぬるま湯500mlにクエン酸1〜2杯', 'ガラス・タイル・蛇口に吹きかけ10〜15分', '濡れスポンジでこすって流す'],
    },
    caution: { ko: '대리석·천연석에는 산성이 상처를 내요. 락스와 혼합 금지.', en: 'Acid etches marble and natural stone. Never mix with bleach.', ja: '大理石など天然石には使わない。漂白剤と混ぜない。' },
    expert: { ko: '물때는 수돗물의 칼슘이 굳은 거라 산으로 녹여야 해요. 구연산은 물때 제거제의 천연 버전이고, 핵심은 10분 기다리는 거예요.', en: 'Limescale is hardened calcium from tap water, so it needs an acid. Citric acid is the natural descaler — the secret is the 10-minute wait.', ja: '水垢は水道水のカルシウム。酸で溶かすのが基本で、クエン酸は天然の水垢落としです。' },
    sources: [GQ_CITRIC, YT_DIFF],
  },
  {
    id: 'toilet-citric',
    dirts: ['scale', 'stain'],
    surfaces: ['ceramic'],
    items: ['citric', 'tilebrush', 'sponge'],
    title: { ko: '변기 때·냄새: 구연산 1~2스푼 넣고 10분', en: 'Toilet stains & odor: 1–2 spoons citric acid, 10 min', ja: '便器の汚れ：クエン酸を入れて10分' },
    steps: {
      ko: ['변기 물에 구연산 1~2스푼을 넣는다', '10분쯤 두었다가 변기솔로 문지른다', '물을 내려 헹군다'],
      en: ['Add 1–2 spoons of citric acid to the bowl', 'Wait about 10 min, scrub with the brush', 'Flush'],
      ja: ['便器にクエン酸1〜2杯', '10分置いてブラシでこする', '流す'],
    },
    caution: { ko: '락스 계열 변기 세정제와 같이 쓰면 안 돼요.', en: 'Don’t combine with chlorine toilet cleaners.', ja: '塩素系トイレ洗剤と併用しない。' },
    expert: { ko: '변기 테두리의 누런 때는 요석과 물때라 산성이 정답이에요. 넣고 10분 기다린 뒤 솔질하면 힘이 반으로 줄어요.', en: 'The yellow ring is urine scale plus limescale, so acid is the answer — drop it in, wait ten minutes, then brush.', ja: '便器の黄ばみは尿石と水垢。酸性が正解で、10分待ってからブラシ。' },
    sources: [GQ_CITRIC],
  },
  {
    id: 'sink-grain',
    dirts: ['scale', 'stain'],
    surfaces: ['steel'],
    items: ['bakingsoda', 'sponge', 'cloth', 'vinegar'],
    title: { ko: '스테인리스 싱크대는 결 방향으로, 베이킹소다 살살', en: 'Stainless sink: with the grain, gentle baking soda', ja: 'ステンレスは目に沿って、重曹でやさしく' },
    steps: {
      ko: ['음식물·물기를 먼저 치우고 부드러운 스펀지로 닦는다', '물자국엔 베이킹소다를 살짝 뿌려 결 방향으로 살살 문지른다', '식초를 뿌려 미네랄을 녹인 뒤 바로 헹군다 (오래 두지 말 것)', '극세사로 물기를 닦아 말리면 광이 유지된다'],
      en: ['Clear scraps and water, wipe with a soft sponge', 'For water spots sprinkle baking soda and rub gently with the grain', 'Spray vinegar to dissolve minerals, then rinse right away', 'Dry with microfiber to keep the shine'],
      ja: ['生ごみと水気を取り、柔らかいスポンジで', '水跡には重曹を少量、目に沿ってやさしく', '酢を吹いてすぐ流す', 'マイクロファイバーで水気を拭く'],
    },
    caution: { ko: '철수세미·거친 연마 패드, 반복적인 락스 사용은 미세 흠집과 변색을 남겨요.', en: 'Steel wool, harsh pads and repeated bleach leave micro-scratches and discoloration.', ja: '金属たわし・強い研磨・塩素系の繰り返しは傷と変色のもと。' },
    expert: { ko: '스테인리스엔 결이 있어요. 결을 거슬러 문지르면 흠집이 더 보이고, 결대로 베이킹소다로 살살 닦으면 새것처럼 돌아옵니다.', en: 'Stainless has a grain. Rub across it and scratches show; rub along it with a little baking soda and it comes back like new.', ja: 'ステンレスには目があります。目に沿って重曹でやさしく磨くと新品のように。' },
    sources: [KHAN_SINK, OHOU_SODA],
  },
  {
    id: 'hair-glove',
    dirts: ['hair'],
    surfaces: ['fabric'],
    items: ['rubberglove', 'squeegee', 'lintroller'],
    title: { ko: '소파 털은 살짝 적신 고무장갑으로 한 방향', en: 'Sofa hair: a damp rubber glove, one direction', ja: 'ソファの毛は湿らせたゴム手袋で一方向に' },
    steps: {
      ko: ['고무장갑에 물을 살짝 뿌린다 (소파에 뿌리지 말 것)', '한 방향으로 가볍게 쓸면 털이 뭉쳐 나온다 — 솔기·틈은 손가락 끝으로', '평평한 등받이·쿠션은 깨끗한 스퀴지를 비스듬히 한 방향으로 끌어 모은다', '정전기로 붙은 털은 섬유유연제 1티스푼/물 500ml를 30cm 거리에서 뿌리고 3~5분 뒤 청소기'],
      en: ['Lightly mist the glove — not the sofa', 'Stroke in one direction; hair clumps up. Use fingertips for seams', 'Flat backs and cushions: pull a clean squeegee at an angle, one direction', 'Static hair: mist 1 tsp softener in 500 ml water from 30 cm, wait 3–5 min, vacuum'],
      ja: ['ゴム手袋に軽く霧吹き', '一方向に撫でると毛がまとまる', '平らな面はスキージーを一方向に引く'],
    },
    caution: { ko: '돌돌이는 표면 털만 집고 실 사이 털은 못 잡아요. 소파를 적시면 속까지 스며 곰팡이·냄새가 날 수 있어요.', en: 'Lint rollers only lift surface hair. Don’t soak the sofa — moisture reaches the padding.', ja: '粘着ローラーは表面だけ。ソファを濡らさない。' },
    expert: { ko: '젖은 고무가 털을 끌어모으는 원리예요. 돌돌이보다 깊이 박힌 털까지 뭉쳐 나오니까, 반려동물 집에선 이게 제일 빨라요.', en: 'Damp rubber grabs hair and balls it up — it reaches deeper than a lint roller, which is why it’s the fastest fix in a pet home.', ja: '湿ったゴムが毛を集める原理。粘着ローラーより深い毛まで取れます。' },
    sources: [WIKITREE_PET, GQ_PET],
  },
  {
    id: 'glass-vinegar',
    dirts: ['film'],
    surfaces: ['glass'],
    items: ['vinegar', 'newspaper', 'squeegee', 'cloth', 'glass'],
    title: { ko: '유리 유막·지문: 식초물 + 신문지 또는 스퀴지', en: 'Glass film & prints: vinegar water + newspaper or squeegee', ja: 'ガラスの油膜：酢水＋新聞紙かスキージー' },
    steps: {
      ko: ['식초물(또는 알코올)을 뿌리고 극세사·신문지로 닦는다 — 보풀이 없고 잉크의 기름이 잔여물을 잡아 준다', '스퀴지는 한 방향으로 끌고 날은 매번 닦는다', '물 자국이 남으면 레몬즙·구연산물로 한 번 더'],
      en: ['Spray vinegar water (or alcohol) and wipe with microfiber or newspaper — lint-free, and the ink’s oil breaks down residue', 'Pull the squeegee one way and wipe the blade each pass', 'Water spots left? Go over with lemon or citric water'],
      ja: ['酢水（またはアルコール）を吹き、マイクロファイバーか新聞紙で拭く', 'スキージーは一方向に、刃は毎回拭く'],
    },
    expert: { ko: '유막은 기름막이라 물만으론 번져요. 산이나 알코올이 막을 끊고, 보풀 없는 신문지·스퀴지가 줄 자국 없이 마무리합니다.', en: 'Film is an oil layer, so water alone just smears it. Acid or alcohol cuts the film; lint-free newspaper or a squeegee finishes streak-free.', ja: '油膜は水だけでは広がるだけ。酸かアルコールで膜を切り、新聞紙で筋なく仕上げます。' },
    sources: [GQ_WINDOW],
  },
  {
    id: 'headlight-toothpaste',
    dirts: ['film'],
    surfaces: ['plastic'],
    items: ['toothpaste', 'cloth', 'sponge', 'magiceraser'],
    title: { ko: '헤드라이트 황변은 흰 치약으로 5~10분', en: 'Yellowed headlights: white toothpaste, 5–10 min', ja: 'ヘッドライトの黄ばみは白い歯みがき粉で' },
    steps: {
      ko: ['먼지·모래를 씻어내고 말린다 (남으면 긁힘)', '흰색 불투명 치약을 얇게 펴 바른다 — 젤·굵은 스크럽 타입은 X', '마른 천이나 멜라민 스펀지로 5~10분 원을 그리며 문지른다 (마르면 물을 살짝)', '물로 헹구고 말린 뒤 UV 차단 코팅이나 왁스로 마무리'],
      en: ['Wash off grit and dry (leftover grit scratches)', 'Spread a thin layer of plain white toothpaste — no gels, no coarse scrubs', 'Rub in circles 5–10 min with a dry cloth or melamine sponge, misting if it dries', 'Rinse, dry, then seal with a UV coating or wax'],
      ja: ['砂を洗い流して乾かす', '白い不透明な歯みがき粉を薄く', '5〜10分円を描いてこする', '洗い流してUVコートかワックス'],
    },
    caution: { ko: '치약이 UV 코팅까지 벗기니 코팅·왁스를 안 하면 몇 달 안에 다시 누레져요. 내부 습기는 치약으로 못 고쳐요.', en: 'Toothpaste removes the UV coat too — reseal or it yellows again in months. It won’t fix moisture inside the lamp.', ja: 'UVコートもはがれるので仕上げにコーティングを。' },
    expert: { ko: '치약 속 실리카·탄산칼슘이 아주 고운 연마제예요. 산화된 폴리카보네이트 표면을 한 겹 벗겨 내는 거라, 마무리 코팅이 꼭 필요해요.', en: 'The silica and calcium carbonate in toothpaste are a very fine abrasive — it takes off the oxidized polycarbonate layer, which is why a sealant afterwards matters.', ja: '歯みがき粉のシリカが微細な研磨剤。酸化した層を削るので仕上げのコートが必要です。' },
    sources: [WIKITREE_TOOTH],
  },
  {
    id: 'tar-soak',
    dirts: ['tar'],
    surfaces: ['paint', 'glass', 'plastic', 'metal'],
    items: ['tarremover', 'cookingoil', 'cloth', 'mitt'],
    title: { ko: '타르는 불려서 떼어내기 — 마른 천으로 문지르지 말 것', en: 'Tar: soften, then lift — never rub it dry', ja: 'タールはふやかしてから：乾拭き厳禁' },
    steps: {
      ko: ['먼저 세차로 모래·먼지를 씻어낸다', '전용 타르 리무버는 차가 아니라 극세사에 뿌려서 닦는다', '집에 있는 걸로 하려면 WD-40·식용유를 타르에 발라 10~30분 불린 뒤 극세사로 닦고 세차로 씻어낸다', '마무리로 왁스를 올려 도장을 보호'],
      en: ['Wash the grit off first', 'Spray dedicated tar remover onto a microfiber cloth, not the car, and wipe', 'Household option: WD-40 or cooking oil on the tar for 10–30 min, wipe with microfiber, then wash it off', 'Wax afterwards to protect the paint'],
      ja: ['先に洗車', 'タールリムーバーはクロスに吹いて拭く', '家にあるものならWD-40や食用油で10〜30分ふやかす', '仕上げにワックス'],
    },
    caution: { ko: '마른 극세사로 문지르면 도장에 흠집. 아이스 스크레이퍼·면도날 금지.', en: 'A dry microfiber scratches the paint. No ice scrapers or razor blades.', ja: '乾いたクロスでこすると塗装に傷。' },
    expert: { ko: '타르는 석유계라 기름이 기름을 녹여요. 리무버든 식용유든 10분 불리면 문지를 필요 없이 밀려 나와요.', en: 'Tar is petroleum, and oil dissolves oil. Remover or cooking oil, ten minutes of dwell, and it slides off without scrubbing.', ja: 'タールは石油系。油が油を溶かすので、10分ふやかせばこすらず落ちます。' },
    sources: [JALOPNIK_TAR, WD40_TAR],
  },
  {
    id: 'iron-claybar',
    dirts: ['iron', 'tar'],
    surfaces: ['paint', 'glass'],
    items: ['claybar', 'carshampoo', 'wheelcleaner'],
    title: { ko: '세차 후 까끌하면 클레이바 — 윤활제와 함께 가볍게', en: 'Rough paint after a wash? Clay bar with lubricant, light pressure', ja: '洗車後ざらつくならクレイバー' },
    steps: {
      ko: ['세차 후 얇은 비닐장갑을 끼고 도장을 쓸어 까끌하면 철분·타르가 박힌 것', '클레이를 반죽해 매끈하게 만들고 30×30cm 구역씩, 희석 카샴푸나 전용 윤활제를 뿌린다', '힘 빼고 가로·세로로 미끄러뜨린다 — 거친 소리가 안 날 때까지', '클레이가 더러워지면 접어 새 면으로, 바닥에 떨어뜨리면 버린다'],
      en: ['After washing, run a thin plastic glove over the paint — if it feels gritty, iron and tar are bonded on', 'Knead the clay smooth, work 30×30 cm sections, spray diluted car shampoo or clay lube', 'Glide lightly side to side and up and down until the grit sound stops', 'Fold to a clean face when dirty; if you drop it, throw it away'],
      ja: ['洗車後にビニール手袋で触ってざらつくなら', '30×30cmずつ潤滑剤を吹いて軽く滑らせる', '落としたら捨てる'],
    },
    caution: { ko: '세게 누르면 잔기스. 초보는 가장 부드러운 등급부터.', en: 'Pressing hard causes marring. Start with the softest grade.', ja: '強く押すと傷。柔らかいグレードから。' },
    expert: { ko: '도장에 박힌 철분은 세차로 안 빠져요. 윤활 위에서 클레이가 미끄러지며 박힌 입자를 집어 올리는 거라, 힘이 아니라 윤활이 핵심입니다.', en: 'Iron particles bonded to the paint won’t wash off. Clay glides on lubricant and plucks them out — the lubricant, not pressure, does the work.', ja: '塗装に刺さった鉄粉は洗車では落ちません。潤滑の上でクレイが拾い上げます。' },
    sources: [DANAWA_CLAY, JALOPNIK_TAR],
  },
  {
    id: 'deck-moss',
    dirts: ['moss', 'mold'],
    surfaces: ['wood', 'stone', 'brick', 'tile'],
    items: ['washer', 'percarbonate', 'vinegar', 'deckbrush'],
    title: { ko: '데크·벽돌 이끼: 저압 세척, 식초물 또는 산소계로 불려 부드러운 솔', en: 'Deck & brick algae: low pressure, vinegar or oxygen bleach, soft brush', ja: 'デッキの苔：低圧洗浄、酢水か酸素系で' },
    steps: {
      ko: ['낙엽·먼지를 쓸어낸다', '고압세척기는 낮은~중간 압력으로 (세게 쏘면 나무 결이 일어난다)', '식초 1컵/물 한 양동이를 뿌려 10~20분 두고 부드러운 솔로 문지른다 — 녹조·검은 반점은 산소계(과탄산소다)가 더 잘 듣는다', '충분히 헹구고 마른 뒤 보호제(실러)를 발라 둔다'],
      en: ['Sweep off leaves and dust', 'Pressure-wash on low to medium — high pressure raises the wood grain', 'Mix one cup of vinegar into a bucket of water, soak 10–20 min, scrub with a soft brush; green algae and black spots respond better to oxygen bleach', 'Rinse well, let dry, apply a sealer'],
      ja: ['落ち葉を掃く', '高圧洗浄は低〜中圧で', '酢1カップ／バケツで10〜20分、柔らかいブラシ。緑藻には酸素系', 'よくすすいで乾いたらシーラー'],
    },
    caution: { ko: '염소계 락스·강산 세제는 나무를 상하게 하고 식물도 죽여요.', en: 'Chlorine bleach and strong acids damage the wood and kill plants.', ja: '塩素系や強酸は木材を傷め植物も枯らす。' },
    expert: { ko: '이끼는 뿌리를 내리니까 불려서 들어 올려야지, 압력으로 밀면 나무 결까지 일어나요. 식초물 15분이 고압보다 안전하고 깨끗해요.', en: 'Moss roots in, so soften and lift it — blasting it off tears up the wood grain. Fifteen minutes of vinegar water beats high pressure.', ja: '苔は根を張るのでふやかして浮かせる。高圧で押すと木目が荒れます。' },
    sources: [HB_DECK, HUNKER_OXY],
  },
  {
    id: 'three-powders',
    dirts: ['grease', 'scale', 'mold', 'soap'],
    items: ['bakingsoda', 'citric', 'percarbonate'],
    title: { ko: '살림 3대장: 베이킹소다·구연산·과탄산소다는 섞지 말고 역할대로', en: 'The three powders: soda, citric, percarbonate — never mixed, each for its job', ja: '重曹・クエン酸・過炭酸は混ぜず役割どおり' },
    steps: {
      ko: ['베이킹소다(약알칼리): 기름때·연마·냄새', '구연산(산성): 물때·석회·비누때', '과탄산소다(산소계 표백): 곰팡이·찌든 때·세탁 — 40~60℃ 물에서 가장 잘 듣는다', '섞으면 중화돼 효과가 사라지니 하나 쓰고 헹군 뒤 다음 것'],
      en: ['Baking soda (mild alkali): grease, gentle abrasion, odor', 'Citric acid (acid): limescale, soap scum', 'Percarbonate (oxygen bleach): mold, baked-on grime, laundry — works best at 40–60 °C', 'Mixing neutralizes them; use one, rinse, then the next'],
      ja: ['重曹：油汚れ・研磨・消臭', 'クエン酸：水垢・石けんカス', '過炭酸：カビ・こびりつき・洗濯（40〜60℃）', '混ぜると中和。1つ使ってすすいでから次'],
    },
    caution: { ko: '어느 것이든 염소계(락스)와는 절대 섞지 마세요.', en: 'None of them may ever be mixed with chlorine bleach.', ja: 'どれも塩素系とは絶対に混ぜない。' },
    expert: { ko: '세 가루를 다 뿌리는 집이 많은데, 산과 알칼리를 섞으면 거품만 나고 서로 중화돼요. 오염이 산성인지 알칼리성인지 보고 하나만 고르는 게 전문가 방식이에요.', en: 'Plenty of people throw all three at a stain, but acid plus alkali just fizzes and cancels out. The pro move is to read whether the dirt is acidic or alkaline and pick one.', ja: '酸とアルカリを混ぜると泡が出て中和するだけ。汚れの性質を見て1つ選ぶのがプロのやり方。' },
    sources: [YT_MIX, YT_DIFF, YT_EIGHT, WIKITREE_STOVE],
  },
  {
    id: 'soapsoda-paste',
    mix: 'soapsoda',
    dirts: ['grease', 'stain', 'soap'],
    surfaces: ['steel', 'ceramic', 'tile', 'glass', 'metal'],
    items: ['bakingsoda', 'dishsoap', 'sponge', 'tilebrush'],
    title: { ko: '섞어 쓰기: 베이킹소다 + 주방세제 = 욕조·싱크·변기 연마 페이스트', en: 'Mix it: baking soda + liquid soap = scrub paste for tub, sink, toilet', ja: '混ぜて使う：重曹＋食器用洗剤＝浴槽・シンク・便器のペースト' },
    steps: {
      ko: ['도자기·법랑 표면에 베이킹소다를 뿌리고 젖은 천으로 닦는다', '천에 액체 비누(주방세제)를 조금 묻히면 닦는 힘이 세진다 — 그다음 잘 헹군다', '변기: 베이킹소다를 뿌리고 세제 몇 방울 → 변기솔', '오븐: 바닥을 적시고 베이킹소다를 하얗게 덮어 하룻밤 → 남은 건 비눗물 스펀지로'],
      en: ['Sprinkle baking soda on ceramic fixtures and wipe with a damp cloth', 'Add a little liquid soap to the cloth for extra scrubbing power, then rinse well', 'Toilet: baking soda in the bowl, a few drops of soap, scrub with the brush', 'Oven: wet the floor, cover it white with soda overnight, finish with a soapy sponge'],
      ja: ['陶器に重曹をふり、濡れた布で拭く', '布に液体石けんを少し付けると落ちやすい。よくすすぐ', '便器：重曹＋洗剤数滴→ブラシ'],
    },
    expert: { ko: '베이킹소다 혼자는 연마만 하고 주방세제 혼자는 기름만 띄우는데, 둘을 합치면 띄운 기름을 긁어내는 페이스트가 돼요. 이건 섞어야 제맛인 조합이에요.', en: 'Soda alone only abrades and soap alone only lifts grease; together they make a paste that lifts and scrubs at once. This is a combo that has to be mixed.', ja: '重曹は研磨だけ、洗剤は油を浮かすだけ。合わせると浮かせて削るペーストになります。' },
    sources: [BELLEVUE, KHAN_VS],
  },
  {
    id: 'soapvinegar-glass',
    mix: 'soapvinegar',
    dirts: ['film'],
    surfaces: ['glass'],
    items: ['vinegar', 'dishsoap', 'squeegee', 'cloth'],
    title: { ko: '섞어 쓰기: 식초 3큰술 + 주방세제 1/4작은술 + 물 2컵 = 유리·거울 세정제', en: 'Mix it: 3 tbsp vinegar + ¼ tsp liquid soap + 2 cups water = window & mirror cleaner', ja: '混ぜて使う：酢大さじ3＋洗剤小さじ1/4＋水2カップ＝ガラス用' },
    steps: {
      ko: ['분무기에 물 2컵, 식초 3큰술, 주방세제(액체 비누) 1/4작은술을 넣고 흔든다 — 라벨을 붙인다', '유리에 뿌리고 스퀴지를 한 방향으로, 또는 극세사·신문지로 닦는다', '세제 한 방울이 전에 쓰던 제품의 기름기 잔여물을 녹여 줄 자국을 막는다'],
      en: ['Shake 2 cups water, 3 tbsp vinegar and ¼ tsp liquid soap in a labeled spray bottle', 'Spray the glass, pull a squeegee one way or wipe with microfiber or newspaper', 'The drop of soap dissolves oily residue from previous products so it dries streak-free'],
      ja: ['水2カップ・酢大さじ3・洗剤小さじ1/4を混ぜる', '吹いてスキージーを一方向に', '洗剤ひと滴が油膜の残りを溶かす'],
    },
    expert: { ko: '식초만 쓰면 유막이 남고 세제만 쓰면 줄이 가요. 식초에 세제를 딱 한 방울만 섞는 게 유리 전문가들 레시피예요.', en: 'Vinegar alone leaves film, soap alone leaves streaks. One drop of soap in the vinegar water is the glass cleaner recipe pros use.', ja: '酢だけだと膜が残り、洗剤だけだと筋。酢に洗剤をひと滴だけが正解。' },
    sources: [BELLEVUE, GQ_WINDOW],
  },
  {
    id: 'fizz-myth',
    caution_only: true,
    dirts: ['grease', 'scale', 'soap', 'stain'],
    items: ['bakingsoda', 'vinegar', 'citric'],
    title: { ko: '섞지 마세요: 베이킹소다 + 식초(구연산) = 거품만 나고 서로 중화', en: 'Don’t mix: baking soda + vinegar (or citric) = fizz, then they cancel out', ja: '混ぜないで：重曹＋酢（クエン酸）＝泡が出て中和' },
    steps: {
      ko: ['기름때·냄새는 베이킹소다(알칼리), 물때·석회는 식초·구연산(산) — 각자 잘 듣는 데 따로 쓴다', '둘을 한 번에 섞으면 거품이 나면서 중화돼 세정력이 사라진다', '예외는 배수구: 베이킹소다 1/2컵 → 식초 1/2컵 → 몇 분 거품 → 끓는 물 — 거품이 찌꺼기를 밀어낸다', '알루미늄 창틀엔 산이 부식을 일으키니 세제 물(10:1)로'],
      en: ['Baking soda (alkali) for grease and odor, vinegar or citric acid for limescale — use each where it works', 'Mixed at once they fizz and neutralize, so the cleaning power is gone', 'Exception — drains: ½ cup soda, ½ cup vinegar, let it fizz a few minutes, then boiling water', 'On aluminum window tracks acid corrodes the frame — use 10:1 soapy water instead'],
      ja: ['重曹は油・臭い、酢・クエン酸は水垢。別々に使う', '同時に混ぜると泡が出て中和し洗浄力が消える', '例外は排水口：重曹→酢→数分→熱湯'],
    },
    caution: { ko: '게임에서도 둘을 겹쳐 뿌리면 거품만 나고 그 자리는 세정력이 0이 돼요.', en: 'In the game too, layering them just fizzes and leaves zero cleaning power on that spot.', ja: 'ゲームでも重ねると泡だけで洗浄力ゼロになります。' },
    expert: { ko: '베이킹소다와 식초를 같이 뿌리면 거품 쇼는 멋지지만 산과 알칼리가 서로 중화돼 남는 게 없어요. 배수구 뚫을 때만 그 거품을 쓰세요.', en: 'Soda plus vinegar makes a great fizz show, but acid and alkali cancel each other and nothing is left to clean. Save that fizz for drains.', ja: '重曹と酢を一緒に吹くと泡は派手ですが中和して何も残りません。排水口だけで。' },
    sources: [KHAN_VS, WIKITREE_TRACK, BELLEVUE],
  },
];

export function tipsFor(dirt: DirtType, surface?: SurfaceType): CleaningTip[] {
  return TIPS.filter((t) => t.dirts.includes(dirt) && (!surface || !t.surfaces || t.surfaces.includes(surface)));
}

/** 발견한 조합(도구·세정제)에 해당하는 팁 — 아이템이 팁에 들어 있으면 그 팁 */
export function tipForCombo(dirt: DirtType, surface: SurfaceType | undefined, toolId: string, cleanerId?: string | null): CleaningTip | undefined {
  // "하지 말 것" 팁은 조합 발견에 붙이지 않는다
  const cands = tipsFor(dirt, surface).filter((t) => !t.caution_only);
  // 세정제를 썼으면 그 세정제가 들어 있는 팁만 (수세미 하나 겹친다고 베이킹소다 팁을 붙이지 않는다)
  // 단일 세정제 팁이 섞어 쓰기 팁보다 먼저 — 섞어 쓰기 팁은 두 재료를 다 썼을 때 tipForItems 로 붙는다
  if (cleanerId) {
    const hits = cands.filter((t) => t.items.includes(cleanerId as ItemId));
    return hits.find((t) => !t.mix) ?? hits[0];
  }
  return cands.find((t) => t.items.includes(toolId as ItemId));
}

/** 여러 재료를 함께 쓴 조합(섞어 쓰기)에 해당하는 팁 — 재료가 모두 팁에 들어 있어야 한다 */
export function tipForItems(dirt: DirtType, surface: SurfaceType | undefined, itemIds: string[]): CleaningTip | undefined {
  const cands = tipsFor(dirt, surface).filter((t) => !t.caution_only);
  return cands.find((t) => itemIds.every((i) => t.items.includes(i as ItemId)));
}

/** 섞으면 안 되는 조합을 설명하는 팁 (예: 베이킹소다 + 식초 중화) */
export function cautionTipFor(itemIds: string[]): CleaningTip | undefined {
  return TIPS.find((t) => t.caution_only && itemIds.every((i) => t.items.includes(i as ItemId)));
}

/** 쇼호스트용 전문가 한 줄 (이 오염에 대해) */
export function expertLine(dirt: DirtType, lang: Lang, surface?: SurfaceType): string | undefined {
  const t = tipsFor(dirt, surface)[0] ?? tipsFor(dirt)[0];
  return t?.expert[lang];
}
