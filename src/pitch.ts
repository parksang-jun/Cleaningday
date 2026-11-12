// 쇼호스트 멘트 생성 — DOM·에셋 의존 없음 (tools/host-voice.mjs 에서도 그대로 쓴다)
import type { DirtType, SurfaceType } from './game/catalog';
import { performanceRatios, type SponsorProduct } from './game/sponsor';
import { expertLine } from './game/tips';
import { realItemSpec, realSpecNote, realSpeedup } from './game/realProducts';
import { t, type Lang } from './i18n';

export type Placement = 'intro' | 'struggle' | 'result' | 'shop' | 'preview';
/** 결과 화면에서 이 제품을 어떻게 골랐나 — 멘트가 달라진다 */
export type PitchContext = 'used' | 'category' | 'dirt' | 'generic';

export const LANG_TAG: Record<Lang, string> = { ko: 'ko-KR', en: 'en-US', ja: 'ja-JP' };


function fmt(n: number, lang: Lang): string {
  try {
    return n.toLocaleString(LANG_TAG[lang]);
  } catch {
    return String(n);
  }
}

function baseName(p: SponsorProduct): string {
  return t(`item_${p.base}`);
}

/** 가장 좋은 시험 결과 (지정 오염이 있으면 그것, 없으면 제거율이 가장 높은 것) */
export function bestLab(p: SponsorProduct, dirt?: DirtType): { dirt: DirtType; removalPct: number; ratio: number } | null {
  const ratios = performanceRatios(p);
  const pick = (dirt && p.lab.find((l) => l.dirt === dirt)) || [...p.lab].sort((a, b) => b.removalPct - a.removalPct)[0];
  if (!pick) return null;
  return { dirt: pick.dirt, removalPct: pick.removalPct, ratio: ratios[pick.dirt] };
}

/** 제휴 추천(실제 판매 제품) 멘트 — 인사 → 꿀팁 → 라벨 용도·주의(운영자 입력) → 구매 링크 안내 + 수수료 고지. 효능 수치·비교 주장은 없다 */
function affiliateLines(p: SponsorProduct, lang: Lang, opts: { hostName: string; placement: Placement; dirt?: DirtType; surface?: SurfaceType }, custom: string[]): string[] {
  const lines: string[] = [];
  const note = realSpecNote(p.id);
  const x = realSpeedup(realItemSpec(p));
  const feel =
    lang === 'ko'
      ? `게임에서도 이 제품 그대로 써 볼 수 있어요${note ? ` — ${note}를 반영해서` : ''}${x > 1.05 ? ` 기본 도구보다 ${x}배 빨리 닦여요` : ''}. 광고 보고 이번 판에 체험해 보세요.`
      : lang === 'ja'
        ? `ゲームでもこの製品をそのまま試せます${note ? ` — ${note}を反映` : ''}${x > 1.05 ? `、基本の道具より${x}倍速く落ちます` : ''}。広告を見てこのステージで体験してみてください。`
        : `You can try this exact product in the game${note ? ` — tuned to its ${note}` : ''}${x > 1.05 ? `, cleaning ${x}× faster than the basic tool` : ''}. Watch an ad to use it this stage.`;
  const expert = opts.dirt ? expertLine(opts.dirt, lang, opts.surface) : undefined;
  const dirtName = (d: DirtType) => t(`dirt_${d}`);
  if (lang === 'ko') {
    lines.push(`안녕하세요, 청소 전문가 ${opts.hostName}예요. 오늘은 실제로 파는 제품 하나 소개할게요 — ${p.brand} ${p.name}.`);
    if (expert) lines.push(expert);
    lines.push(...custom);
    if (opts.placement === 'struggle' && opts.dirt) lines.push(`지금 막힌 ${dirtName(opts.dirt)}이(가) 바로 이 제품이 맡는 종류예요. 게임에선 ${t(`item_${p.base}`)}로 닦으시면 돼요.`);
    lines.push(feel);
    lines.push(`가격이랑 후기는 구매 링크에서 직접 확인해 보세요.`);
  } else if (lang === 'ja') {
    lines.push(`こんにちは、お掃除の専門家の${opts.hostName}です。今日は実際に売っている製品をひとつ — ${p.brand} ${p.name}。`);
    if (expert) lines.push(expert);
    lines.push(...custom);
    if (opts.placement === 'struggle' && opts.dirt) lines.push(`今つまずいている${dirtName(opts.dirt)}は、まさにこの製品の担当です。ゲームでは${t(`item_${p.base}`)}で落とせます。`);
    lines.push(feel);
    lines.push(`価格とレビューは購入リンクで確認してください。`);
  } else {
    lines.push(`Hi, I'm ${opts.hostName}, a cleaning specialist. Today it's a real product you can buy — the ${p.brand} ${p.name}.`);
    if (expert) lines.push(expert);
    lines.push(...custom);
    if (opts.placement === 'struggle' && opts.dirt) lines.push(`The ${dirtName(opts.dirt)} you're stuck on is exactly what this product is for. In the game, use the ${t(`item_${p.base}`)}.`);
    lines.push(feel);
    lines.push(`Check the price and reviews at the link.`);
  }
  return lines;
}

/** 쇼호스트(청소 전문가) 멘트 생성 — 인사 → 오염의 원리(꿀팁) → 시험 수치 → 소구점 → 리뷰 → 라벨 주의 → 제안 */
export function pitchLines(p: SponsorProduct, lang: Lang, opts: { hostName: string; placement: Placement; dirt?: DirtType; surface?: SurfaceType; context?: PitchContext; usedItem?: string }): string[] {
  const lines: string[] = [];
  const ctx = opts.placement === 'result' ? opts.context : undefined;
  const custom = p.hostLines?.[lang]?.map((l) => l.replace(/\{brand\}/g, p.brand).replace(/\{name\}/g, p.name).replace(/\{host\}/g, opts.hostName)).filter(Boolean) ?? [];
  if (p.affiliate) return affiliateLines(p, lang, opts, custom);
  const lab = bestLab(p, opts.dirt);
  const x = lab && lab.ratio > 1.05 ? Math.round(lab.ratio * 10) / 10 : 0;
  const dirtName = (d: DirtType) => t(`dirt_${d}`);
  const cautions = p.cautions.map((s: SurfaceType) => t(`surf_${s}`)).join(', ');
  const review = p.reviews && p.reviews.count > 0 && p.reviews.rating > 0 ? p.reviews : null;
  const claims = (p.claims ?? []).filter(Boolean).slice(0, 3);
  const expert = opts.dirt ? expertLine(opts.dirt, lang, opts.surface) : undefined;
  if (lang === 'ko') {
    lines.push(`안녕하세요, 청소 전문가 ${opts.hostName}입니다. 오늘은 ${p.brand} ${p.name} 이야기를 해볼게요.`);
    if (ctx === 'used') lines.push(`방금 이 판에서 직접 써 보셨죠? 손에 느껴진 차이, 수치로도 증명된 제품이에요.`);
    else if (ctx === 'category' && opts.usedItem) lines.push(`이번 판에 ${opts.usedItem} 쓰셨죠? 같은 종류인데 이 제품은 뭐가 다른지 보여드릴게요.`);
    if (expert) lines.push(expert);
    if (custom.length) lines.push(...custom);
    else {
      if (lab) lines.push(`수치부터 볼게요. 공인 시험에서 ${dirtName(lab.dirt)}를 ${lab.removalPct}% 제거했어요${x ? ` — 일반 ${baseName(p)}보다 ${x}배 빠른 결과예요.` : '.'}`);
      for (const c of claims) lines.push(`✔ ${c}`);
      if (review) lines.push(`리뷰 ${fmt(review.count, lang)}개에 평점 ${review.rating}점${review.source ? ` (${review.source})` : ''} — 실사용 평도 좋은 편이에요.`);
    }
    if (cautions) lines.push(`단, ${cautions}에는 쓰지 마세요. 라벨에 있는 그대로 말씀드리는 거예요.`);
    switch (opts.placement) {
      case 'struggle':
        lines.push(`지금 막힌 ${opts.dirt ? dirtName(opts.dirt) : '오염'}에 딱 맞는 제품이에요. 이번 판에서 바로 써 보세요.`);
        break;
      case 'result':
        lines.push(`다음 판에서 무료로 써 보실 수 있어요. 마음에 들면 구매 링크도 있습니다.`);
        break;
      case 'intro':
        lines.push(`이번 판에서 무료로 써 볼 수 있어요. 광고 한 편이면 됩니다.`);
        break;
      default:
        lines.push(`한번 써 보시고 판단하세요.`);
    }
  } else if (lang === 'ja') {
    lines.push(`こんにちは、お掃除の専門家の${opts.hostName}です。今日は ${p.brand} ${p.name} のお話をします。`);
    if (ctx === 'used') lines.push(`さっきこのステージで実際に使いましたよね？手で感じた違いは、数値でも証明されています。`);
    else if (ctx === 'category' && opts.usedItem) lines.push(`このステージで${opts.usedItem}を使いましたね。同じ種類でも、この製品は何が違うのかお見せします。`);
    if (expert) lines.push(expert);
    if (custom.length) lines.push(...custom);
    else {
      if (lab) lines.push(`まず数値から。公的試験で${dirtName(lab.dirt)}を${lab.removalPct}%除去${x ? ` — 一般の${baseName(p)}より${x}倍速い結果です。` : '。'}`);
      for (const c of claims) lines.push(`✔ ${c}`);
      if (review) lines.push(`レビュー${fmt(review.count, lang)}件、評価${review.rating}点${review.source ? `（${review.source}）` : ''} — 実際の評判も良いです。`);
    }
    if (cautions) lines.push(`ただし、${cautions}には使わないでください。ラベルどおりにお伝えしています。`);
    switch (opts.placement) {
      case 'struggle':
        lines.push(`今つまずいている${opts.dirt ? dirtName(opts.dirt) : '汚れ'}にぴったりの製品です。このステージで使ってみてください。`);
        break;
      case 'result':
        lines.push(`次のステージで無料で試せます。気に入ったら購入リンクもあります。`);
        break;
      case 'intro':
        lines.push(`このステージで無料で試せます。広告1本でOKです。`);
        break;
      default:
        lines.push(`まず使ってみて判断してください。`);
    }
  } else {
    lines.push(`Hi, I'm ${opts.hostName}, a cleaning specialist. Let's talk about the ${p.brand} ${p.name}.`);
    if (ctx === 'used') lines.push(`You just used it in this stage — the difference you felt is backed by the numbers.`);
    else if (ctx === 'category' && opts.usedItem) lines.push(`You used a ${opts.usedItem} this stage. Same category — here's what makes this one different.`);
    if (expert) lines.push(expert);
    if (custom.length) lines.push(...custom);
    else {
      if (lab) lines.push(`Numbers first: in certified lab tests it removed ${lab.removalPct}% of ${dirtName(lab.dirt)}${x ? ` — ${x}× faster than a standard ${baseName(p)}.` : '.'}`);
      for (const c of claims) lines.push(`✔ ${c}`);
      if (review) lines.push(`${fmt(review.count, lang)} reviews at ${review.rating} stars${review.source ? ` (${review.source})` : ''} — real users rate it well.`);
    }
    if (cautions) lines.push(`One caveat: don't use it on ${cautions}. That's straight from the label.`);
    switch (opts.placement) {
      case 'struggle':
        lines.push(`It's the right product for the ${opts.dirt ? dirtName(opts.dirt) : 'mess'} you're stuck on. Try it this stage.`);
        break;
      case 'result':
        lines.push(`You can try it free in the next stage — and there's a buy link if you like it.`);
        break;
      case 'intro':
        lines.push(`You can try it free in this stage. One ad, that's all.`);
        break;
      default:
        lines.push(`Try it and judge for yourself.`);
    }
  }
  return lines;
}
