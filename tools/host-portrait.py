#!/usr/bin/env python3
"""쇼호스트 마스코트 '뽀득이' 생성기 — 청소 거품(비누 거품 구름) 캐릭터를 레이어별 WebP 로 만든다.

  python3 tools/host-portrait.py            → src/assets/host/*.webp (600×600, 투명 배경)
  python3 tools/host-portrait.py --preview  → scratch/host-preview-*.png (합성본·얼굴 확대)

레이어: base(몸·팔·분무기·볼터치·거품) · eyes-open / eyes-half / eyes-closed · brows · mouth-closed / mouth-mid / mouth-open · overlay(헤드셋·반짝이)
앱(avatar.ts)은 이 레이어를 겹쳐 깜빡임·입 모양·눈썹 강조를 애니메이션한다.

캐릭터 메모:
  · 사람 얼굴이 아니라 **청소 거품 구름** — 뽀글뽀글 솟은 흰 거품 덩어리에 큰 눈, 분홍 볼, 미소
  · 청소 소품: 민트색 분무기(왼손), 노란 고무장갑(오른손), 헤드셋(쇼호스트), 반짝이(뽀득 광택)
  · 만화 스타일: 진청록 외곽선, 평면 채색 + 아래쪽 옅은 하늘색 음영
  · 기존 브랜드 마스코트(단일 비눗방울+솔 등)와 겹치지 않는 창작 캐릭터
"""
from __future__ import annotations

import math
import os
import random
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

K = 3
OUT = 600
S = OUT * K
rng = random.Random(3)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEST = os.path.join(ROOT, 'src', 'assets', 'host')

INK = (38, 86, 96, 255)  # 외곽선
WHITE = (253, 254, 255, 255)
SHADE = (206, 228, 238)  # 거품 음영
MINT = (72, 190, 176, 255)
MINT_DARK = (40, 140, 130, 255)
PINK = (255, 150, 165, 165)
YELLOW = (255, 206, 72, 255)
YELLOW_DARK = (214, 160, 40, 255)

# 거품 구름 덩어리 (cx, cy, r) — 600 좌표
LOBES = [
    (300, 318, 132),
    (212, 282, 74), (390, 276, 78),
    (248, 212, 66), (338, 204, 70), (294, 186, 60),
    (222, 376, 68), (378, 380, 66), (300, 402, 74),
]
EYE_L, EYE_R, EYE_Y = 254.0, 346.0, 292.0

Yg, Xg = np.mgrid[0:S, 0:S].astype(np.float32)
Xf = Xg / K
Yf = Yg / K


def new_layer():
    return Image.new('RGBA', (S, S), (0, 0, 0, 0))


def P(x, y):
    return (x * K, y * K)


def box(cx, cy, rx, ry=None):
    ry = rx if ry is None else ry
    return [P(cx - rx, cy - ry), P(cx + rx, cy + ry)]


def blur(img, r):
    return img.filter(ImageFilter.GaussianBlur(r * K))


def mask_alpha(img):
    return np.asarray(img)[..., 3].astype(np.float32) / 255


def with_mask(img, m):
    arr = np.asarray(img).astype(np.float32)
    arr[..., 3] *= m
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), 'RGBA')


def star(d, cx, cy, r, fill, outline=None, points=4, inner=0.42, width=1):
    pts = []
    for i in range(points * 2):
        a = -math.pi / 2 + i * math.pi / points
        rr = r if i % 2 == 0 else r * inner
        pts.append(P(cx + math.cos(a) * rr, cy + math.sin(a) * rr))
    d.polygon(pts, fill=fill, outline=outline, width=width)


# ---------- 몸 ----------
def draw_base():
    layer = new_layer()
    d = ImageDraw.Draw(layer)
    # 바닥 그림자 (살짝)
    sh = new_layer()
    ImageDraw.Draw(sh).ellipse(box(300, 478, 120, 16), fill=(60, 110, 120, 70))
    layer.alpha_composite(blur(sh, 3))
    # 외곽선: 덩어리들을 조금 크게 잉크로, 그 위에 흰색 — 합집합 윤곽만 남는다
    for cx, cy, r in LOBES:
        d.ellipse(box(cx, cy, r + 3.2), fill=INK)
    fill = new_layer()
    fd = ImageDraw.Draw(fill)
    for cx, cy, r in LOBES:
        fd.ellipse(box(cx, cy, r), fill=WHITE)
    fa = np.asarray(fill).astype(np.float32)
    m = fa[..., 3] / 255
    # 음영: 아래·오른쪽으로 갈수록 옅은 하늘색, 위 왼쪽은 흰색
    t = np.clip(((Yf - 170) / 300) * 0.75 + ((Xf - 300) / 300) * 0.25, 0, 1) ** 1.6
    for i, c in enumerate(SHADE):
        fa[..., i] = fa[..., i] * (1 - t) + c * t
    fill = Image.fromarray(np.clip(fa, 0, 255).astype(np.uint8), 'RGBA')
    layer.alpha_composite(fill)
    # 덩어리마다 가장자리로 갈수록 옅은 하늘색 — 뭉게뭉게 볼륨
    puff = np.zeros((S, S), np.float32)
    for cx, cy, r in LOBES:
        dist = np.sqrt((Xf - cx) ** 2 + (Yf - cy) ** 2) / r
        ring = np.clip((dist - 0.62) / 0.38, 0, 1) ** 2 * (dist <= 1.0)
        puff = np.maximum(puff, ring)
    # 중앙 덩어리는 얼굴이라 약하게
    cx0, cy0, r0 = LOBES[0]
    puff *= 1 - 0.55 * (np.sqrt((Xf - cx0) ** 2 + (Yf - cy0) ** 2) / r0 < 0.9)
    pf = np.zeros((S, S, 4), np.uint8)
    for i, c in enumerate(SHADE):
        pf[..., i] = c
    pf[..., 3] = (np.clip(puff * 0.55, 0, 1) * 255 * m).astype(np.uint8)
    layer.alpha_composite(blur(Image.fromarray(pf, 'RGBA'), 1.5))
    # 몸 안의 비눗방울 (투명한 동그라미 + 림 하이라이트)
    bub = new_layer()
    bd = ImageDraw.Draw(bub)
    for cx, cy, r in [(396, 392, 20), (206, 398, 13), (340, 160, 11), (262, 428, 10), (405, 226, 9)]:
        bd.ellipse(box(cx, cy, r), outline=(150, 195, 212, 170), width=int(1.8 * K))
        bd.arc(box(cx, cy, r - 4), start=200, end=290, fill=(255, 255, 255, 230), width=int(2.2 * K))
        bd.ellipse(box(cx + r * 0.35, cy + r * 0.35, r * 0.18), fill=(255, 255, 255, 200))
    layer.alpha_composite(with_mask(bub, m))
    # 윗부분 하이라이트
    hi = new_layer()
    hd = ImageDraw.Draw(hi)
    hd.ellipse(box(262, 180, 26, 12), fill=(255, 255, 255, 200))
    hd.ellipse(box(236, 236, 10, 6), fill=(255, 255, 255, 180))
    layer.alpha_composite(with_mask(blur(hi, 1.2), m))
    # 볼터치 + 작은 하이라이트 선
    ch = new_layer()
    chd = ImageDraw.Draw(ch)
    chd.ellipse(box(222, 330, 22, 13), fill=PINK)
    chd.ellipse(box(378, 330, 22, 13), fill=PINK)
    layer.alpha_composite(blur(ch, 1.6))
    for cx in (222, 378):
        for k in (-6, 0, 6):
            d.line([P(cx + k - 1.5, 325), P(cx + k + 1.5, 335)], fill=(255, 255, 255, 190), width=int(1.4 * K))
    # --- 오른팔: 노란 고무장갑 (손 흔들기) ---
    arm = new_layer()
    ad = ImageDraw.Draw(arm)
    ad.line([P(410, 350), P(452, 300)], fill=INK, width=int(26 * K))
    ad.line([P(410, 350), P(452, 300)], fill=WHITE, width=int(19 * K))
    layer.alpha_composite(arm)
    glove = new_layer()
    gd = ImageDraw.Draw(glove)
    gd.ellipse(box(462, 284, 24, 26), fill=INK)
    gd.ellipse(box(462, 284, 21, 23), fill=YELLOW)
    for fx, fy in [(448, 258), (460, 254), (472, 257), (482, 266)]:
        gd.ellipse(box(fx, fy, 7.5, 9.5), fill=INK)
        gd.ellipse(box(fx, fy, 5.5, 7.5), fill=YELLOW)
    gd.ellipse(box(486, 288, 7, 6), fill=INK)
    gd.ellipse(box(486, 288, 5, 4), fill=YELLOW)
    gd.rounded_rectangle([P(441, 296), P(483, 310)], radius=4 * K, fill=INK)
    gd.rounded_rectangle([P(443, 298), P(481, 308)], radius=3 * K, fill=YELLOW_DARK)
    gd.ellipse(box(454, 278, 6, 4), fill=(255, 240, 180, 200))
    layer.alpha_composite(glove)
    # --- 왼팔 + 민트 분무기 ---
    arm2 = new_layer()
    a2 = ImageDraw.Draw(arm2)
    a2.line([P(195, 352), P(160, 392)], fill=INK, width=int(26 * K))
    a2.line([P(195, 352), P(160, 392)], fill=WHITE, width=int(19 * K))
    layer.alpha_composite(arm2)
    bottle = new_layer()
    bd2 = ImageDraw.Draw(bottle)
    bd2.rounded_rectangle([P(118, 356), P(172, 470)], radius=14 * K, fill=INK)
    bd2.rounded_rectangle([P(121, 359), P(169, 467)], radius=12 * K, fill=MINT)
    bd2.rounded_rectangle([P(128, 396), P(162, 440)], radius=4 * K, fill=(255, 255, 255, 240))
    bd2.rounded_rectangle([P(134, 406), P(156, 410)], radius=1 * K, fill=MINT_DARK)
    bd2.rounded_rectangle([P(134, 416), P(152, 419)], radius=1 * K, fill=(150, 200, 195, 255))
    bd2.rounded_rectangle([P(134, 424), P(156, 427)], radius=1 * K, fill=(150, 200, 195, 255))
    star(bd2, 150, 432, 4, fill=MINT)
    bd2.rounded_rectangle([P(133, 332), P(157, 362)], radius=4 * K, fill=INK)
    bd2.rounded_rectangle([P(136, 335), P(154, 360)], radius=3 * K, fill=MINT_DARK)
    bd2.polygon([P(126, 318), P(172, 316), P(182, 328), P(170, 340), P(130, 342)], fill=INK)
    bd2.polygon([P(130, 321), P(170, 319), P(178, 328), P(168, 337), P(133, 339)], fill=MINT_DARK)
    bd2.rounded_rectangle([P(176, 322), P(192, 332)], radius=2 * K, fill=INK)
    bd2.rounded_rectangle([P(178, 324), P(190, 330)], radius=1.5 * K, fill=(90, 100, 110, 255))
    bd2.line([P(142, 342), P(136, 366)], fill=INK, width=int(5 * K))
    bd2.line([P(142, 342), P(136, 366)], fill=MINT, width=int(2.6 * K))
    bd2.ellipse(box(160, 372, 9, 8), fill=INK)
    bd2.ellipse(box(160, 372, 6.6, 5.6), fill=WHITE)
    bd2.ellipse(box(158, 388, 9, 8), fill=INK)
    bd2.ellipse(box(158, 388, 6.6, 5.6), fill=WHITE)
    for mx, my, mr in [(206, 322, 3.5), (218, 314, 2.8), (214, 332, 2.4), (230, 324, 2.0), (226, 306, 1.8)]:
        bd2.ellipse(box(mx, my, mr), outline=(140, 200, 210, 220), width=int(1.2 * K), fill=(255, 255, 255, 120))
    layer.alpha_composite(bottle)
    return layer


# ---------- 눈 ----------
def draw_eyes(o):
    layer = new_layer()
    d = ImageDraw.Draw(layer)
    for cx, side in ((EYE_L, -1), (EYE_R, 1)):
        rx, ry = 31.0, 34.0
        d.ellipse(box(cx, EYE_Y, rx + 2.4, ry + 2.4), fill=INK)
        d.ellipse(box(cx, EYE_Y, rx, ry), fill=WHITE)
        ir = new_layer()
        idr = ImageDraw.Draw(ir)
        icx, icy, r = cx + 1.5 * side, EYE_Y + 3.5, 20.5
        idr.ellipse(box(icx, icy, r), fill=(26, 96, 108, 255))
        idr.ellipse(box(icx, icy + 3, r * 0.78), fill=(40, 150, 150, 255))
        idr.ellipse(box(icx, icy + 6, r * 0.5), fill=(70, 190, 180, 255))
        idr.ellipse(box(icx, icy, 10.5), fill=(22, 34, 40, 255))
        idr.ellipse(box(icx - 7.5, icy - 8.5, 7.5, 6.3), fill=(255, 255, 255, 245))
        idr.ellipse(box(icx + 7.5, icy + 7.5, 3.6), fill=(255, 255, 255, 220))
        idr.ellipse(box(icx - 1, icy + 14, 6, 2.2), fill=(255, 255, 255, 110))
        clip = new_layer()
        ImageDraw.Draw(clip).ellipse(box(cx, EYE_Y, rx, ry), fill=(255, 255, 255, 255))
        layer.alpha_composite(with_mask(ir, mask_alpha(clip)))
        if o < 1.0:
            lid_y = EYE_Y - ry - 3 + (2 * ry + 6) * (1 - o) * 0.6
            lid = new_layer()
            ImageDraw.Draw(lid).rectangle([P(cx - rx - 4, EYE_Y - ry - 6), P(cx + rx + 4, lid_y)], fill=WHITE)
            layer.alpha_composite(with_mask(lid, mask_alpha(clip)))
            d.arc(box(cx, lid_y - ry * 0.25 + 2, rx, ry * 0.25 + 2), start=0, end=180, fill=INK, width=int(3.2 * K))
        d.arc(box(cx, EYE_Y, rx + 1.2, ry + 1.2), start=200, end=340, fill=INK, width=int(4.2 * K))
        for ang, ln in ((-28, 9), (-8, 7)):
            a = math.radians(ang) if side > 0 else math.radians(180 - ang)
            x0 = cx + math.cos(a) * (rx + 1)
            y0 = EYE_Y + math.sin(a) * (ry + 1)
            d.line([P(x0, y0), P(x0 + math.cos(a - 0.5 * side) * ln, y0 + math.sin(a - 0.5 * side) * ln)], fill=INK, width=int(3.0 * K))
    return layer


def draw_eyes_closed():
    """감은 눈: 행복한 ^ ^ 곡선"""
    layer = new_layer()
    d = ImageDraw.Draw(layer)
    for cx in (EYE_L, EYE_R):
        d.arc(box(cx, EYE_Y + 12, 30, 20), start=200, end=340, fill=INK, width=int(4.6 * K))
    return layer


def draw_brows():
    layer = new_layer()
    d = ImageDraw.Draw(layer)
    for cx, side in ((EYE_L, -1), (EYE_R, 1)):
        d.arc(box(cx + 2 * side, EYE_Y - 36, 24, 12), start=205, end=335, fill=INK, width=int(4.0 * K))
    return layer


# ---------- 입 ----------
def draw_mouth(state):
    layer = new_layer()
    d = ImageDraw.Draw(layer)
    cy = 360.0
    if state == 'closed':
        d.arc(box(300, cy - 16, 30, 20), start=20, end=160, fill=INK, width=int(4.2 * K))
        for sgn in (-1, 1):
            d.ellipse(box(300 + sgn * 30.5, cy - 9, 2.8), fill=INK)
        return layer
    w, h = (18, 12) if state == 'mid' else (28, 21)
    oy = 2 if state == 'open' else 0
    d.ellipse(box(300, cy + oy, w + 2.6, h + 2.6), fill=INK)
    d.ellipse(box(300, cy + oy, w, h), fill=(150, 50, 70, 255))
    tongue = new_layer()
    ImageDraw.Draw(tongue).ellipse(box(300, cy + h * 0.75 + oy, w * 0.62, h * 0.55), fill=(240, 120, 140, 255))
    clip = new_layer()
    ImageDraw.Draw(clip).ellipse(box(300, cy + oy, w, h), fill=(255, 255, 255, 255))
    layer.alpha_composite(with_mask(tongue, mask_alpha(clip)))
    if state == 'open':
        d.rounded_rectangle([P(286, cy - 18 + oy), P(314, cy - 12 + oy)], radius=2 * K, fill=(255, 255, 255, 235))
    return layer


# ---------- 헤드셋 · 반짝이 (맨 위) ----------
def draw_overlay():
    layer = new_layer()
    d = ImageDraw.Draw(layer)
    pts = []
    for k in range(61):
        t = k / 60
        a = math.radians(205 + 130 * t)
        pts.append(P(300 + 158 * math.cos(a), 300 + 150 * math.sin(a)))
    d.line(pts, fill=INK, width=int(7 * K))
    d.line(pts, fill=(70, 80, 90, 255), width=int(4 * K))
    d.line(pts[12:34], fill=(170, 180, 190, 200), width=int(1.3 * K))
    d.rounded_rectangle([P(150, 258), P(178, 302)], radius=8 * K, fill=INK)
    d.rounded_rectangle([P(153, 261), P(175, 299)], radius=6 * K, fill=(70, 80, 90, 255))
    d.rounded_rectangle([P(157, 266), P(171, 294)], radius=4 * K, fill=MINT)
    boom = []
    for k in range(31):
        t = k / 30
        boom.append(P(176 + (246 - 176) * t + 8 * math.sin(math.pi * t), 300 + (366 - 300) * t - 12 * math.sin(math.pi * t)))
    d.line(boom, fill=INK, width=int(5 * K))
    d.line(boom, fill=(70, 80, 90, 255), width=int(2.6 * K))
    d.ellipse(box(248, 368, 7.5), fill=INK)
    d.ellipse(box(248, 368, 5), fill=(70, 80, 90, 255))
    d.ellipse(box(246.5, 366.5, 1.8), fill=(200, 210, 220, 230))
    star(d, 420, 150, 20, fill=(255, 255, 255, 255), outline=INK, width=int(2.2 * K))
    star(d, 448, 190, 9, fill=(255, 255, 255, 255), outline=INK, width=int(1.8 * K))
    star(d, 176, 206, 11, fill=(255, 255, 255, 255), outline=INK, width=int(1.8 * K))
    star(d, 300, 128, 7, fill=MINT)
    for mx, my, mr in [(470, 250, 9), (140, 300, 6), (452, 420, 7), (120, 440, 5)]:
        d.ellipse(box(mx, my, mr), outline=(140, 200, 210, 230), width=int(1.6 * K), fill=(255, 255, 255, 90))
        d.arc(box(mx, my, mr - 2.5), start=200, end=290, fill=(255, 255, 255, 240), width=int(1.6 * K))
    return layer


def finish(img):
    return img.resize((OUT, OUT), Image.LANCZOS)


def main():
    preview = '--preview' in sys.argv
    layers = {
        'base': draw_base(),
        'eyes-open': draw_eyes(1.0),
        'eyes-half': draw_eyes(0.45),
        'eyes-closed': draw_eyes_closed(),
        'brows': draw_brows(),
        'mouth-closed': draw_mouth('closed'),
        'mouth-mid': draw_mouth('mid'),
        'mouth-open': draw_mouth('open'),
        'overlay': draw_overlay(),
    }
    small = {k: finish(v) for k, v in layers.items()}
    if preview:
        outdir = os.path.join(ROOT, 'scratch')
        os.makedirs(outdir, exist_ok=True)
        g = np.zeros((OUT, OUT, 4), np.uint8)
        yy, xx = np.mgrid[0:OUT, 0:OUT]
        rr = np.sqrt(((xx - 300) / 300) ** 2 + ((yy - 200) / 300) ** 2)
        for i, (c0, c1) in enumerate(((244, 210), (250, 231), (248, 226))):
            g[..., i] = np.clip(c0 + (c1 - c0) * rr, 0, 255)
        g[..., 3] = 255
        bg = Image.fromarray(g, 'RGBA')
        for variant, (eyes, mouth) in {'a': ('eyes-open', 'mouth-closed'), 'b': ('eyes-open', 'mouth-open'), 'c': ('eyes-half', 'mouth-mid'), 'd': ('eyes-closed', 'mouth-closed')}.items():
            comp = bg.copy()
            for k in ('base', eyes, 'brows', mouth, 'overlay'):
                comp.alpha_composite(small[k])
            comp.save(os.path.join(outdir, f'host-preview-{variant}.png'))
        comp = bg.copy()
        for k in ('base', 'eyes-open', 'brows', 'mouth-closed', 'overlay'):
            comp.alpha_composite(small[k])
        comp.crop((150, 130, 450, 430)).resize((900, 900), Image.LANCZOS).save(os.path.join(outdir, 'host-preview-face.png'))
        print('preview →', outdir)
        return
    os.makedirs(DEST, exist_ok=True)
    total = 0
    for k, v in small.items():
        path = os.path.join(DEST, f'{k}.webp')
        v.save(path, 'WEBP', quality=90, method=6, exact=False)
        total += os.path.getsize(path)
        print(f'{k:13s} {os.path.getsize(path) / 1024:6.1f} KB')
    print(f'total {total / 1024:.0f} KB →', DEST)


if __name__ == '__main__':
    main()
