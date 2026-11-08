#!/usr/bin/env python3
"""쇼호스트 '민서' 초상 생성기 — 사진풍(페인팅) 반신 초상을 레이어별 WebP 로 만든다.

  python3 tools/host-portrait.py            → src/assets/host/*.webp (600×600, 투명 배경)
  python3 tools/host-portrait.py --preview  → scratch/host-preview.png (합성본)

레이어: base(몸·목·피부·머리) · eyes-open / eyes-half / eyes-closed · brows · mouth-closed / mouth-mid / mouth-open · overlay(헤드셋·잔머리)
앱(host.ts)은 이 레이어를 겹쳐 깜빡임·입 모양·눈썹 강조를 애니메이션한다.
조명은 높이맵(얼굴 볼륨: 두개골 타원체 + 코·광대·입술·턱·눈두덩) 의 법선으로 계산한 램버트+블린퐁이라 그라데이션이 아니라 '빛을 받는 얼굴'로 보인다.
"""
from __future__ import annotations

import math
import os
import random
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

K = 3  # 슈퍼샘플 배율 (600 → 1800 에서 그린 뒤 축소)
OUT = 600
S = OUT * K
rng = random.Random(7)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEST = os.path.join(ROOT, 'src', 'assets', 'host')

# ---------- 좌표 (600 기준) ----------
HEAD_C = (300.0, 268.0)
HEAD_A, HEAD_B = 104.0, 129.0  # 얼굴 타원 반경
SKULL_C = (300.0, 252.0)
SKULL_A, SKULL_B = 116.0, 153.0  # 머리(머리카락 포함) 타원
EYE_Y = 262.0
EYE_L, EYE_R = 264.0, 336.0
EYE_W = 22.0
NOSE_TIP = (300.0, 304.0)
MOUTH_Y = 341.0
MOUTH_HW = 31.0
NECK_HW = 44.0

Yg, Xg = np.mgrid[0:S, 0:S].astype(np.float32)
Xf = Xg / K
Yf = Yg / K


def gauss(cx, cy, sx, sy, amp, rot=0.0):
    dx = Xf - cx
    dy = Yf - cy
    if rot:
        c, s = math.cos(rot), math.sin(rot)
        dx, dy = dx * c + dy * s, -dx * s + dy * c
    return amp * np.exp(-0.5 * ((dx / sx) ** 2 + (dy / sy) ** 2))


def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def to_img(rgb, alpha):
    """float RGB(0..1) + alpha(0..1) → RGBA uint8 (S×S)"""
    a = np.clip(alpha, 0, 1)
    out = np.zeros((S, S, 4), np.uint8)
    out[..., :3] = np.clip(rgb * 255, 0, 255).astype(np.uint8)
    out[..., 3] = (a * 255).astype(np.uint8)
    return Image.fromarray(out, 'RGBA')


def new_layer():
    return Image.new('RGBA', (S, S), (0, 0, 0, 0))


def P(x, y):
    return (x * K, y * K)


def blur(img, r):
    return img.filter(ImageFilter.GaussianBlur(r * K))


def alpha_mul(img, f):
    a = np.asarray(img)[..., 3].astype(np.float32) * f
    arr = np.asarray(img).copy()
    arr[..., 3] = np.clip(a, 0, 255).astype(np.uint8)
    return Image.fromarray(arr, 'RGBA')


def ellipse_mask(cx, cy, a, b, taper=0.0):
    """얼굴형: 아래로 갈수록 좁아지는 타원 (taper) — 0..1 소프트 마스크"""
    dy = (Yf - cy) / b
    t = np.clip(dy, 0, 1)
    ax = a * (1 - taper * t * t)
    dx = (Xf - cx) / ax
    r = np.sqrt(dx * dx + dy * dy)
    return 1 - smoothstep(0.985, 1.0, r), r


# ---------- 피부: 높이맵 → 법선 → 조명 ----------
def face_height():
    m, r = ellipse_mask(*HEAD_C, HEAD_A, HEAD_B, taper=0.30)
    z = np.sqrt(np.clip(1 - r * r, 0, 1)) * 150.0  # 두개골 볼륨
    h = z
    # 눈두덩(움푹) · 미간 · 눈썹뼈
    for ex in (EYE_L, EYE_R):
        h = h - gauss(ex, EYE_Y - 2, 24, 13, 9)
        h = h + gauss(ex, EYE_Y - 24, 26, 8, 5)  # 눈썹뼈
    # 콧대 → 콧등 → 코끝 → 콧방울
    for yy in np.linspace(244, 300, 30):
        tt = (yy - 244) / 56
        w = 9 + tt * 6
        amp = 4 + tt * 9
        h = h + gauss(300, yy, w, 3.0, amp)
    h = h + gauss(*NOSE_TIP, 12, 10, 12)
    h = h + gauss(285, 309, 7.5, 6, 6) + gauss(315, 309, 7.5, 6, 6)  # 콧방울
    h = h - gauss(290, 317, 3.2, 2.2, 4) - gauss(310, 317, 3.2, 2.2, 4)  # 콧구멍
    # 광대 · 볼
    h = h + gauss(244, 296, 30, 22, 6) + gauss(356, 296, 30, 22, 6)
    # 인중 · 입술 · 턱
    h = h - gauss(300, 326, 3.5, 7, 3)
    h = h + gauss(300, 336, 26, 5, 4)  # 윗입술 융기
    h = h + gauss(300, 350, 20, 6, 6)  # 아랫입술
    h = h - gauss(300, 366, 20, 4, 5)  # 턱 주름(이순)
    h = h + gauss(300, 386, 34, 18, 9)  # 턱끝
    return h, m


def shade(albedo, h, mask, key=(-0.45, -0.55, 0.7), fill=(0.65, 0.15, 0.74), amb=0.54, kd=0.52, kf=0.16, spec=0.10, shin=60):
    gy, gx = np.gradient(h)
    gx = gx * K
    gy = gy * K
    n = np.stack([-gx, -gy, np.ones_like(h) * 1.0], -1)
    n /= np.linalg.norm(n, axis=-1, keepdims=True) + 1e-6
    L = np.array(key, np.float32)
    L /= np.linalg.norm(L)
    F = np.array(fill, np.float32)
    F /= np.linalg.norm(F)
    V = np.array([0, 0, 1], np.float32)
    H = L + V
    H /= np.linalg.norm(H)
    dl = np.clip((n * L).sum(-1), 0, 1)
    df = np.clip((n * F).sum(-1), 0, 1)
    sp = np.clip((n * H).sum(-1), 0, 1) ** shin
    light = amb + kd * dl + kf * df
    rgb = albedo * light[..., None]
    # 그늘에 붉은 기(피하 산란)
    sss = np.clip(0.75 - light, 0, 1)[..., None] * np.array([0.12, 0.03, 0.0])
    rgb = rgb + sss
    rgb = rgb + (spec * sp)[..., None] * np.array([1.0, 0.96, 0.9])
    return np.clip(rgb, 0, 1)


def skin_albedo():
    base = np.array([0.975, 0.845, 0.76], np.float32)
    alb = np.ones((S, S, 3), np.float32) * base
    # 볼·코끝·귀 홍조, 눈가 약간 어둡게, 턱 아래 약간 차갑게
    cheek = gauss(246, 300, 27, 17, 1.0) + gauss(354, 300, 27, 17, 1.0)
    alb += cheek[..., None] * np.array([0.03, -0.075, -0.07])
    nose = gauss(*NOSE_TIP, 12, 9, 1.0)
    alb += nose[..., None] * np.array([0.02, -0.04, -0.04])
    sock = gauss(EYE_L, EYE_Y + 6, 22, 9, 1.0) + gauss(EYE_R, EYE_Y + 6, 22, 9, 1.0)
    alb += sock[..., None] * np.array([-0.04, -0.06, -0.03])
    # 피부 결 (아주 약한 노이즈)
    noise = np.asarray(Image.effect_noise((S, S), 60)).astype(np.float32) / 255 - 0.5
    noise = np.asarray(Image.fromarray(np.uint8((noise + 0.5) * 255)).filter(ImageFilter.GaussianBlur(0.6 * K))).astype(np.float32) / 255 - 0.5
    alb *= (1 + noise * 0.05)[..., None]
    return np.clip(alb, 0, 1)


def draw_base():
    layer = new_layer()
    d = ImageDraw.Draw(layer)
    # --- 뒷머리(낮은 묶음) ---
    bun = new_layer()
    bd = ImageDraw.Draw(bun)
    bd.ellipse([P(372, 292), P(428, 348)], fill=(34, 23, 18, 255))
    bd.ellipse([P(380, 300), P(416, 334)], fill=(52, 36, 28, 255))
    bun = blur(bun, 0.6)
    layer.alpha_composite(bun)
    # --- 목 ---
    neck = np.zeros((S, S), np.float32)
    nx = (Xf - 300) / NECK_HW
    neck_mask = (np.abs(nx) < 1) & (Yf > 330) & (Yf < 476)
    nz = np.sqrt(np.clip(1 - nx * nx, 0, 1)) * 60
    nh = np.where(neck_mask, nz, 0)
    neck_rgb = shade(skin_albedo() * 0.96, nh, neck_mask.astype(np.float32), amb=0.34, kd=0.6)
    # 턱 그림자
    shadow = 1 - 0.36 * np.clip(1 - (Yf - 396) / 30, 0, 1) * (Yf > 384)
    neck_rgb *= shadow[..., None]
    neck_img = to_img(neck_rgb, neck_mask.astype(np.float32))
    layer.alpha_composite(neck_img)
    # --- 블라우스 + 앞치마 ---
    cloth = new_layer()
    cd = ImageDraw.Draw(cloth)
    shoulder = [P(118, 600), P(120, 520)] + [P(120 + 180 * (1 - math.cos(math.pi / 2 * t)), 520 - 86 * math.sin(math.pi / 2 * t)) for t in np.linspace(0, 1, 16)] + [P(300, 452)] + [P(480 - 180 * (1 - math.cos(math.pi / 2 * t)), 520 - 86 * math.sin(math.pi / 2 * t)) for t in np.linspace(1, 0, 16)] + [P(480, 520), P(482, 600)]
    cd.polygon(shoulder, fill=(246, 246, 244, 255))
    # 옷 주름·음영 (좌측 밝음)
    cl = np.asarray(cloth).astype(np.float32)
    grad = 1 - 0.18 * np.clip((Xf - 150) / 330, 0, 1) - 0.12 * np.clip((Yf - 440) / 160, 0, 1)
    fold = 0.10 * np.exp(-0.5 * ((Xf - 232 + (Yf - 440) * 0.08) / 10) ** 2) + 0.10 * np.exp(-0.5 * ((Xf - 368 - (Yf - 440) * 0.08) / 10) ** 2)
    cl[..., :3] *= (grad - fold)[..., None]
    cloth = Image.fromarray(np.clip(cl, 0, 255).astype(np.uint8), 'RGBA')
    layer.alpha_composite(cloth)
    # V넥 안쪽 (목선 그림자)
    v = new_layer()
    vd = ImageDraw.Draw(v)
    vd.polygon([P(262, 432), P(300, 470), P(338, 432), P(330, 430), P(300, 458), P(270, 430)], fill=(214, 216, 220, 255))
    layer.alpha_composite(blur(v, 0.4))
    apron = new_layer()
    ad = ImageDraw.Draw(apron)
    ad.polygon([P(232, 600), P(238, 462), P(300, 480), P(362, 462), P(368, 600)], fill=(38, 152, 142, 255))
    ap = np.asarray(apron).astype(np.float32)
    agrad = 1 - 0.22 * np.clip((Xf - 238) / 130, 0, 1) + 0.06 * np.sin((Yf - 460) / 9.0) * np.clip((Yf - 470) / 60, 0, 1)
    ap[..., :3] *= agrad[..., None]
    apron = Image.fromarray(np.clip(ap, 0, 255).astype(np.uint8), 'RGBA')
    layer.alpha_composite(apron)
    sd = ImageDraw.Draw(layer)
    for sx, ex in ((238, 262), (362, 338)):
        sd.line([P(sx, 462), P(ex, 404)], fill=(30, 128, 120, 255), width=int(6 * K))
        sd.line([P(sx + (1 if sx < 300 else -1), 462), P(ex + (1 if sx < 300 else -1), 404)], fill=(70, 180, 170, 200), width=int(1.4 * K))
    # 명찰
    sd.rounded_rectangle([P(282, 520), P(318, 536)], radius=2 * K, fill=(252, 252, 252, 255), outline=(28, 120, 112, 255), width=int(1.2 * K))
    sd.ellipse([P(287, 525), P(293, 531)], fill=(38, 152, 142, 255))
    sd.rounded_rectangle([P(297, 525), P(313, 528)], radius=1 * K, fill=(150, 160, 165, 255))
    sd.rounded_rectangle([P(297, 530), P(309, 532)], radius=1 * K, fill=(170, 180, 185, 255))
    # --- 귀 ---
    for ex, side in ((202, -1), (398, 1)):
        ear = new_layer()
        ed = ImageDraw.Draw(ear)
        ed.ellipse([P(ex - 9, 250), P(ex + 9, 288)], fill=(226, 176, 150, 255))
        ed.ellipse([P(ex - 5 + 2 * side, 258), P(ex + 5 + 2 * side, 282)], fill=(196, 140, 118, 255))
        ed.ellipse([P(ex - 3 + 2 * side, 262), P(ex + 3 + 2 * side, 278)], fill=(222, 170, 146, 255))
        layer.alpha_composite(blur(ear, 0.5))
    # --- 얼굴 피부 ---
    h, m = face_height()
    rgb = shade(skin_albedo(), h, m)
    # 머리카락 그림자 (이마)
    hair_line = 178 + 0.0028 * (Xf - 300) ** 2
    hs = np.clip((hair_line + 14 - Yf) / 14, 0, 1) * (Yf > hair_line - 2)
    rgb *= (1 - 0.22 * hs)[..., None]
    # 코 아래 · 아랫입술 아래 · 콧방울 옆 그림자
    rgb *= (1 - 0.20 * gauss(300, 320, 9, 3.2, 1.0))[..., None]
    rgb *= (1 - 0.10 * gauss(300, 366, 18, 3.5, 1.0))[..., None]
    rgb *= (1 - 0.10 * (gauss(279, 312, 3, 5, 1.0) + gauss(321, 312, 3, 5, 1.0)))[..., None]
    # 팔자(아주 약하게)
    for sgn in (-1, 1):
        rgb *= (1 - 0.05 * gauss(300 + sgn * 20, 332, 2.4, 14, 1.0, rot=-sgn * 0.35))[..., None]
    face_img = to_img(rgb, m)
    layer.alpha_composite(face_img)
    # 콧구멍
    nos = new_layer()
    nd = ImageDraw.Draw(nos)
    for sgn in (-1, 1):
        # 콧구멍: 바깥쪽이 두꺼운 쉼표 모양
        for k in range(6):
            t = k / 5
            x = 300 + sgn * (6.5 + 4.5 * t)
            y = 312.5 + 1.2 * math.sin(math.pi * t) - 0.6 * t
            r = 1.2 + 1.3 * math.sin(math.pi * t * 0.9)
            nd.ellipse([P(x - r, y - r * 0.8), P(x + r, y + r * 0.8)], fill=(118, 66, 58, 170))
        # 콧방울 옆 그늘
        nd.ellipse([P(300 + sgn * 15 - 2.2, 304), P(300 + sgn * 15 + 2.2, 314)], fill=(150, 95, 80, 60))
    layer.alpha_composite(blur(nos, 0.7))
    # 코끝 하이라이트
    tip = new_layer()
    ImageDraw.Draw(tip).ellipse([P(297, 300), P(303, 305)], fill=(255, 240, 230, 110))
    layer.alpha_composite(blur(tip, 1.2))
    # --- 머리카락 (앞·위·옆) ---
    layer.alpha_composite(draw_hair())
    return layer


def hair_mask_img():
    """머리카락 영역: 두개골 타원 ∩ (헤어라인 위 ∪ 옆머리) — 얼굴 안쪽 이마는 제외"""
    m = new_layer()
    d = ImageDraw.Draw(m)
    d.ellipse([P(SKULL_C[0] - SKULL_A, SKULL_C[1] - SKULL_B), P(SKULL_C[0] + SKULL_A, SKULL_C[1] + SKULL_B)], fill=(255, 255, 255, 255))
    # 이마 영역을 파낸다 (헤어라인 아래 + 얼굴 안쪽)
    cut = new_layer()
    cd = ImageDraw.Draw(cut)
    pts = []
    for x in np.linspace(188, 412, 60):
        y = 178 + 0.0028 * (x - 300) ** 2 + 1.2 * math.sin((x - 300) / 14.0)
        pts.append(P(x, y))
    pts += [P(412, 600), P(188, 600)]
    cd.polygon(pts, fill=(255, 255, 255, 255))
    # 옆머리는 남긴다: 얼굴 타원 바깥은 그대로 머리카락
    face = new_layer()
    fd = ImageDraw.Draw(face)
    fd.ellipse([P(HEAD_C[0] - HEAD_A + 3, HEAD_C[1] - HEAD_B), P(HEAD_C[0] + HEAD_A - 3, HEAD_C[1] + HEAD_B)], fill=(255, 255, 255, 255))
    cut_arr = np.asarray(cut)[..., 3].astype(np.float32) / 255 * (np.asarray(face)[..., 3].astype(np.float32) / 255)
    # 옆머리는 귀 위(y<300)까지만
    side_keep = (Yf < 302).astype(np.float32)
    arr = np.asarray(m).astype(np.float32)
    arr[..., 3] *= (1 - cut_arr) * side_keep
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), 'RGBA')


def draw_hair():
    mask = hair_mask_img()
    mask = blur(mask, 0.9)
    ma = np.asarray(mask)[..., 3].astype(np.float32) / 255
    # 기본 색: 어두운 갈색, 가장자리 더 어둡게, 왼쪽 위 하이라이트 띠
    base = np.ones((S, S, 3), np.float32) * np.array([0.16, 0.11, 0.085])
    hl = gauss(258, 150, 72, 24, 1.0, rot=0.55) * 0.55 + gauss(332, 126, 60, 14, 1.0, rot=-0.3) * 0.25
    base += hl[..., None] * np.array([0.34, 0.25, 0.18])
    edge = smoothstep(0.0, 0.5, 1 - np.sqrt(((Xf - SKULL_C[0]) / SKULL_A) ** 2 + ((Yf - SKULL_C[1]) / SKULL_B) ** 2))
    base *= (0.6 + 0.4 * edge)[..., None]
    # 헤어라인 근처는 살짝 비치게 (피부로 자연스럽게 이어지도록)
    hair_line = 178 + 0.0028 * (Xf - 300) ** 2
    fade = 1 - 0.35 * np.clip(1 - (hair_line - Yf) / 7, 0, 1) * (Yf > hair_line - 7) * (np.abs(Xf - 300) < 96)
    hair = to_img(base, ma * fade)
    # 결: 가르마(270,170)에서 두피를 따라 뒤로 넘어가는 호
    strands = new_layer()
    sd = ImageDraw.Draw(strands)
    for i in range(3400):
        side = -1 if rng.random() < 0.46 else 1
        rf = 0.82 + rng.random() ** 0.6 * 0.19
        A, B = SKULL_A * rf, SKULL_B * rf
        a0 = math.radians(-104 + rng.uniform(-6, 6))
        a1 = math.radians(-178 if side < 0 else -2) + math.radians(rng.uniform(-12, 10))
        if rng.random() < 0.08:
            a0 = math.radians(rng.uniform(-150, -60))
            a1 = a0 + side * math.radians(rng.uniform(15, 40))
        pts = []
        n = 18
        for k in range(n + 1):
            t = k / n
            a = a0 + (a1 - a0) * t
            x = SKULL_C[0] + A * math.cos(a) + rng.uniform(-0.4, 0.4)
            y = SKULL_C[1] + B * math.sin(a) + rng.uniform(-0.4, 0.4)
            pts.append(P(x, y))
        v = rng.random()
        shine = max(0.0, 1 - abs(rf - 0.93) / 0.06) * (1 if -140 < math.degrees(a0) < -85 else 0.3)
        lum = 0.12 + v * 0.20 + shine * 0.5 * rng.random()
        col = (int(255 * min(1, lum * 1.15)), int(255 * min(1, lum * 0.82)), int(255 * min(1, lum * 0.62)), int(255 * (0.22 + 0.45 * rng.random())))
        sd.line(pts, fill=col, width=max(1, int(K * (0.4 + rng.random() * 0.6))))
    strands = blur(strands, 0.25)
    sa = np.asarray(strands).astype(np.float32)
    sa[..., 3] *= ma
    strands = Image.fromarray(np.clip(sa, 0, 255).astype(np.uint8), 'RGBA')
    hair.alpha_composite(strands)
    # 가르마 (왼쪽으로 치우친 밝은 선)
    part = new_layer()
    pd = ImageDraw.Draw(part)
    ppts = []
    for k in range(20):
        t = k / 19
        a = math.radians(-104 - 20 * t)
        ppts.append(P(SKULL_C[0] + SKULL_A * (0.995 - 0.16 * t) * math.cos(a) + 4, SKULL_C[1] + SKULL_B * (0.995 - 0.16 * t) * math.sin(a) + 2))
    pd.line(ppts, fill=(190, 150, 125, 110), width=int(1.2 * K))
    pa = np.asarray(blur(part, 0.6)).astype(np.float32)
    pa[..., 3] *= ma
    hair.alpha_composite(Image.fromarray(np.clip(pa, 0, 255).astype(np.uint8), 'RGBA'))
    # 헤어라인 잔머리 (아기 머리)
    baby = new_layer()
    bd = ImageDraw.Draw(baby)
    for i in range(110):
        x = rng.uniform(200, 400)
        y = 178 + 0.0028 * (x - 300) ** 2 + rng.uniform(-1, 3)
        dirx = (x - 300) / 100 + rng.uniform(-0.4, 0.4)
        pts = [P(x, y), P(x + dirx * 4, y - 3 - rng.uniform(0, 4)), P(x + dirx * 8, y - 7 - rng.uniform(0, 5))]
        bd.line(pts, fill=(60, 40, 30, int(255 * rng.uniform(0.25, 0.6))), width=max(1, int(K * 0.6)))
    hair.alpha_composite(blur(baby, 0.2))
    # 머리 윤곽 밖으로 삐져나온 잔머리 (윤곽이 딱딱하지 않게)
    fly = new_layer()
    fd = ImageDraw.Draw(fly)
    for i in range(90):
        a0 = math.radians(rng.uniform(-175, -5))
        rf0 = 1.0 + rng.uniform(-0.01, 0.025)
        span = math.radians(rng.uniform(6, 18)) * (1 if rng.random() < 0.5 else -1)
        pts = []
        for k in range(8):
            t = k / 7
            a = a0 + span * t
            rf = rf0 + 0.02 * math.sin(math.pi * t) * rng.uniform(0.5, 1.5)
            pts.append(P(SKULL_C[0] + SKULL_A * rf * math.cos(a), SKULL_C[1] + SKULL_B * rf * math.sin(a)))
        fd.line(pts, fill=(52, 36, 28, int(255 * rng.uniform(0.18, 0.5))), width=max(1, int(K * rng.uniform(0.4, 0.8))))
    hair.alpha_composite(blur(fly, 0.25))
    return hair


# ---------- 눈 ----------
def eye_curves(cx, side, o):
    """위·아래 눈꺼풀 곡선 (600 좌표). o=뜬 정도 0..1. side -1 왼눈 +1 오른눈(바깥쪽 방향)"""
    w = EYE_W
    hu = 12.5 * o
    hl = 7.5 * (0.45 + 0.55 * o)
    inner = (cx - w * side, EYE_Y + 2.0)
    outer = (cx + w * side, EYE_Y - 0.5 - 1.5 * o)
    up, lo = [], []
    for k in range(41):
        t = k / 40
        u = -1 + 2 * t  # inner→outer
        x = inner[0] + (outer[0] - inner[0]) * t
        base_y = inner[1] + (outer[1] - inner[1]) * t
        f = max(0.0, 1 - u * u) ** 0.78
        f *= 1 + 0.18 * u  # 바깥쪽이 더 높다
        up.append((x, base_y - hu * f))
        g = max(0.0, 1 - u * u) ** 0.9
        lo.append((x, base_y + hl * g))
    return up, lo


def draw_eyes(o):
    layer = new_layer()
    for cx, side in ((EYE_L, -1), (EYE_R, 1)):
        up, lo = eye_curves(cx, side, o)
        poly = up + lo[::-1]
        # 흰자
        sclera = new_layer()
        sd = ImageDraw.Draw(sclera)
        sd.polygon([P(*p) for p in poly], fill=(247, 244, 242, 255))
        sc = np.asarray(sclera).astype(np.float32)
        # 윗꺼풀 그림자 · 구석 핑크
        top_y = np.array([p[1] for p in up]).mean()
        shade_v = 1 - 0.28 * np.clip(1 - (Yf - (top_y)) / 7, 0, 1)
        corner = np.clip(1 - np.abs(Xf - cx) / EYE_W, 0, 1)
        shade_c = 0.86 + 0.14 * corner
        sc[..., :3] *= (shade_v * shade_c)[..., None]
        sc[..., 0] += 10 * (1 - corner) * (sc[..., 3] > 0)
        sclera = Image.fromarray(np.clip(sc, 0, 255).astype(np.uint8), 'RGBA')
        layer.alpha_composite(sclera)
        # 홍채 (클립: 눈 모양)
        ir = new_layer()
        idr = ImageDraw.Draw(ir)
        icx, icy, r = cx + 0.6 * side, EYE_Y - 0.4, 11.0
        idr.ellipse([P(icx - r, icy - r), P(icx + r, icy + r)], fill=(74, 44, 30, 255))
        ia = np.asarray(ir).astype(np.float32)
        dx, dy = Xf - icx, Yf - icy
        rr = np.sqrt(dx * dx + dy * dy) / r
        ang = np.arctan2(dy, dx)
        fibers = 0.5 + 0.5 * np.sin(ang * 38 + rr * 6) * np.sin(ang * 11 + 1.3)
        radial = np.clip(1 - np.abs(rr - 0.55) / 0.45, 0, 1)
        lum = 0.75 + 0.55 * fibers * radial + 0.35 * np.clip(0.75 - rr, 0, 1)  # 안쪽 밝은 갈색
        lum *= 1 - 0.55 * smoothstep(0.82, 1.0, rr)  # 가장자리 어두운 테두리
        lum *= 1 - 0.35 * np.clip(1 - (Yf - (icy - r)) / 6, 0, 1)  # 윗꺼풀 그림자
        ia[..., 0] *= lum * 1.08
        ia[..., 1] *= lum * 0.95
        ia[..., 2] *= lum * 0.85
        ir = Image.fromarray(np.clip(ia, 0, 255).astype(np.uint8), 'RGBA')
        pd = ImageDraw.Draw(ir)
        pr = 4.6
        pd.ellipse([P(icx - pr, icy - pr), P(icx + pr, icy + pr)], fill=(14, 8, 6, 255))
        # 하이라이트
        pd.ellipse([P(icx - 5.4, icy - 6.2), P(icx - 1.2, icy - 2.0)], fill=(255, 255, 255, 240))
        pd.ellipse([P(icx + 3.0, icy + 2.4), P(icx + 5.4, icy + 4.8)], fill=(255, 250, 245, 150))
        # 눈 모양으로 클립
        clip = new_layer()
        ImageDraw.Draw(clip).polygon([P(*p) for p in poly], fill=(255, 255, 255, 255))
        ca = np.asarray(clip)[..., 3].astype(np.float32) / 255
        ia2 = np.asarray(ir).astype(np.float32)
        ia2[..., 3] *= ca
        layer.alpha_composite(Image.fromarray(np.clip(ia2, 0, 255).astype(np.uint8), 'RGBA'))
        # 속눈썹 라인 + 속눈썹
        lash = new_layer()
        ld = ImageDraw.Draw(lash)
        ld.line([P(*p) for p in up], fill=(36, 22, 18, 255), width=int(2.1 * K))
        # 바깥 끝 살짝 빼기
        ld.line([P(*up[-1]), P(up[-1][0] + 3.5 * side, up[-1][1] - 1.5)], fill=(42, 26, 20, 220), width=int(1.3 * K))
        for k in range(4, 40, 2):
            x, y = up[k]
            u = -1 + 2 * (k / 40)
            ang = math.radians(-90 + side * (28 + 30 * u))
            ln = 3.8 + 4.0 * max(0.0, u + 0.3) * o + rng.uniform(0, 1.4)
            x2 = x + math.cos(ang) * ln
            y2 = y + math.sin(ang) * ln * (0.6 + 0.4 * o)
            xm = x + math.cos(ang) * ln * 0.5 - side * 0.6
            ym = y + math.sin(ang) * ln * 0.55
            ld.line([P(x, y), P(xm, ym), P(x2, y2)], fill=(30, 18, 14, int(255 * rng.uniform(0.6, 0.95))), width=max(1, int(K * 0.75)))
        # 아랫꺼풀: 물기 라인 + 옅은 그림자 + 아래 속눈썹
        ld.line([P(*p) for p in lo], fill=(225, 190, 178, 110), width=int(1.2 * K))
        for k in range(10, 36, 5):
            x, y = lo[k]
            ld.line([P(x, y + 0.4), P(x + side * 0.6, y + 2.6)], fill=(60, 40, 32, 120), width=max(1, int(K * 0.6)))
        layer.alpha_composite(blur(lash, 0.18))
        # 쌍꺼풀 라인(위로 떠 있을수록 또렷)
        crease = new_layer()
        cd = ImageDraw.Draw(crease)
        cd.line([P(x, y - 5.5 - 1.5 * (1 - o)) for (x, y) in up[3:38]], fill=(165, 110, 92, int(90 + 50 * o)), width=int(1.5 * K))
        layer.alpha_composite(blur(crease, 0.8))
        # 애교살 그림자(아래)
        under = new_layer()
        ud = ImageDraw.Draw(under)
        ud.line([P(x, y + 3.5) for (x, y) in lo[4:37]], fill=(200, 150, 132, 70), width=int(2.2 * K))
        layer.alpha_composite(blur(under, 1.2))
    return layer


def draw_eyes_closed():
    layer = new_layer()
    for cx, side in ((EYE_L, -1), (EYE_R, 1)):
        up, lo = eye_curves(cx, side, 0.0)
        d = ImageDraw.Draw(layer)
        # 감은 선: 아래 곡선 쪽으로 처진 속눈썹 라인
        pts = [P(x, y + 3.0) for (x, y) in lo]
        d.line(pts, fill=(48, 30, 24, 230), width=int(1.7 * K))
        for k in range(4, 40, 2):
            x, y = lo[k]
            u = -1 + 2 * (k / 40)
            ang = math.radians(90 - side * (20 + 25 * u))
            ln = 3.5 + 2.5 * max(0.0, u + 0.3)
            d.line([P(x, y + 3.0), P(x + math.cos(ang) * ln, y + 3.0 + math.sin(ang) * ln)], fill=(30, 18, 14, 200), width=max(1, int(K * 0.75)))
        # 눈꺼풀 음영(둥근 느낌)
        lid = new_layer()
        ld = ImageDraw.Draw(lid)
        ld.ellipse([P(cx - 20, EYE_Y - 9), P(cx + 20, EYE_Y + 5)], fill=(232, 186, 164, 60))
        layer.alpha_composite(blur(lid, 1.5))
    return blur(layer, 0.15)


def draw_brows():
    layer = new_layer()
    for cx, side in ((EYE_L, -1), (EYE_R, 1)):
        under = new_layer()
        ud = ImageDraw.Draw(under)
        pts = []
        for k in range(31):
            t = k / 30
            x = cx + side * (-21 + 48 * t)
            y = EYE_Y - 21 - 7 * math.sin(math.pi * min(1, t * 1.15)) + 3 * max(0, t - 0.7) * 6
            pts.append((x, y))
        ud.line([P(*p) for p in pts], fill=(96, 66, 52, 170), width=int(4.2 * K))
        layer.alpha_composite(blur(under, 1.3))
        d = ImageDraw.Draw(layer)
        for i in range(230):
            t = rng.random() ** 0.85
            x = cx + side * (-21 + 48 * t) + rng.uniform(-0.8, 0.8)
            y = EYE_Y - 21 - 7 * math.sin(math.pi * min(1, t * 1.15)) + 3 * max(0, t - 0.7) * 6 + rng.uniform(-1.4, 1.4)
            ang = math.radians(-70 * side + 85 * t * side) if t < 0.55 else math.radians(-10 * side + 20 * (t - 0.55) * side)
            # 왼눈(side=-1)은 바깥이 왼쪽 → 각도 반전
            ang = math.radians((-78 + 95 * t) if t < 0.55 else (10 + 22 * (t - 0.55)))
            if side < 0:
                ang = math.pi - ang
            ln = (4.0 + 3.5 * (1 - abs(t - 0.4))) * rng.uniform(0.7, 1.1)
            x2 = x + math.cos(ang) * ln
            y2 = y - abs(math.sin(ang)) * ln * (0.9 if t < 0.55 else 0.35) + (0.6 if t > 0.55 else 0) * ln * 0.3
            c = int(255 * rng.uniform(0.6, 0.95))
            d.line([P(x, y), P(x2, y2)], fill=(52, 36, 28, c), width=max(1, int(K * rng.uniform(0.6, 1.1))))
    return blur(layer, 0.12)


# ---------- 입 ----------
def draw_mouth(state):
    """state: 'closed' | 'mid' | 'open'"""
    layer = new_layer()
    gap = {'closed': 0.0, 'mid': 5.0, 'open': 11.0}[state]
    hw = MOUTH_HW + (0 if state == 'closed' else 1.5)
    cy = MOUTH_Y
    corner_up = 3.0 if state == 'closed' else 1.6
    lc = (300 - hw, cy - corner_up)
    rc = (300 + hw, cy - corner_up)
    up_top = []  # 윗입술 윗선 (큐피드 보우)
    for k in range(41):
        t = k / 40
        x = lc[0] + (rc[0] - lc[0]) * t
        u = abs(-1 + 2 * t)
        bow = math.exp(-((u - 0.25) / 0.16) ** 2)
        y = cy - corner_up - (7.5 * (1 - u ** 1.6)) + 1.6 * bow - 0.6 * (1 - u) ** 6
        up_top.append((x, y))
    up_bot = [(x, cy - (1.2 * (1 - abs(-1 + 2 * k / 40) ** 2)) - gap * 0.35 * (1 - abs(-1 + 2 * k / 40) ** 2) ** 0.6) for k, (x, _) in enumerate(up_top)]
    lo_top = [(x, cy + (0.6 + gap) * (1 - abs(-1 + 2 * k / 40) ** 2) ** 0.7) for k, (x, _) in enumerate(up_top)]
    lo_bot = [(x, cy + (11.5 + gap * 0.5) * (1 - abs(-1 + 2 * k / 40) ** 2) ** 0.55) for k, (x, _) in enumerate(up_top)]
    # 입 안
    if gap > 0:
        inner = new_layer()
        idr = ImageDraw.Draw(inner)
        idr.polygon([P(*p) for p in (up_bot + lo_top[::-1])], fill=(72, 30, 34, 255))
        # 윗니
        teeth = new_layer()
        td = ImageDraw.Draw(teeth)
        tt = [(x, y - 0.3) for (x, y) in up_bot]
        tb = [(x, min(y + 0.2 + 4.6 * (1 - abs(-1 + 2 * k / 40) ** 2) ** 0.5, lo_top[k][1] - 0.8)) for k, (x, y) in enumerate(up_bot)]
        td.polygon([P(*p) for p in (tt + tb[::-1])], fill=(246, 241, 232, 255))
        ta = np.asarray(teeth).astype(np.float32)
        tg = 1 - 0.25 * np.clip(np.abs(Xf - 300) / hw, 0, 1) ** 2 - 0.12 * np.clip((Yf - cy) / 5, 0, 1)
        ta[..., :3] *= tg[..., None]
        teeth = Image.fromarray(np.clip(ta, 0, 255).astype(np.uint8), 'RGBA')
        tdd = ImageDraw.Draw(teeth)
        for tx in (-13.5, -8.2, -2.8, 2.8, 8.2, 13.5):
            tdd.line([P(300 + tx, cy - 1), P(300 + tx * 1.05, cy + 4.5)], fill=(190, 170, 160, 90), width=max(1, int(K * 0.6)))
        inner.alpha_composite(teeth)
        if state == 'open':
            tongue = new_layer()
            ImageDraw.Draw(tongue).ellipse([P(287, cy + 5.5), P(313, cy + 15)], fill=(176, 84, 96, 255))
            tongue = blur(tongue, 0.5)
            ia = np.asarray(inner).astype(np.float32)
            ta2 = np.asarray(tongue).astype(np.float32)
            ta2[..., 3] *= ia[..., 3] / 255
            inner.alpha_composite(Image.fromarray(np.clip(ta2, 0, 255).astype(np.uint8), 'RGBA'))
        layer.alpha_composite(inner)
    # 입술
    lips = new_layer()
    ld = ImageDraw.Draw(lips)
    ld.polygon([P(*p) for p in (up_top + up_bot[::-1])], fill=(188, 98, 100, 255))
    ld.polygon([P(*p) for p in (lo_top + lo_bot[::-1])], fill=(220, 126, 124, 255))
    la = np.asarray(lips).astype(np.float32)
    # 음영: 윗입술 아래로 갈수록 어둡게, 아랫입술 중앙 하이라이트·아래 어둡게
    upper = (Yf < cy - gap * 0.2)
    sh = np.where(upper, 1 - 0.18 * np.clip((Yf - (cy - 8)) / 8, 0, 1), 1.0)
    low_hi = np.exp(-0.5 * (((Xf - 300) / 9) ** 2 + ((Yf - (cy + 4.5 + gap * 0.5)) / 2.6) ** 2))
    sh = sh * (1 + 0.34 * low_hi * (~upper)) * np.where(~upper, 1 - 0.22 * np.clip((Yf - (cy + 6 + gap * 0.5)) / 6, 0, 1), 1)
    sh = sh * (1 - 0.34 * np.clip((np.abs(Xf - 300) - hw * 0.65) / (hw * 0.35), 0, 1))  # 입꼬리 어둡게
    la[..., :3] *= sh[..., None]
    # 입술 결(세로 주름)
    wr = 0.5 + 0.5 * np.sin((Xf - 300) * 1.9 + 0.5 * np.sin(Yf * 0.7))
    la[..., :3] *= (1 - 0.022 * wr)[..., None]
    lips = Image.fromarray(np.clip(la, 0, 255).astype(np.uint8), 'RGBA')
    lips = blur(lips, 0.5)
    layer.alpha_composite(lips)
    # 입선 · 입꼬리
    line = new_layer()
    lnd = ImageDraw.Draw(line)
    if gap == 0:
        lnd.line([P(x, y) for (x, y) in up_bot[2:39]], fill=(128, 56, 60, 200), width=int(1.3 * K))
    for sgn in (-1, 1):
        lnd.ellipse([P(300 + sgn * hw - 1.8, cy - corner_up - 1.2), P(300 + sgn * hw + 1.8, cy - corner_up + 1.2)], fill=(120, 60, 62, 140))
    layer.alpha_composite(blur(line, 0.5))
    # 윗입술 위 하이라이트 (큐피드 보우 능선) · 아랫입술 아래 그림자
    hi = new_layer()
    hd = ImageDraw.Draw(hi)
    hd.line([P(x, y - 1.2) for (x, y) in up_top[12:29]], fill=(255, 235, 225, 70), width=int(1.4 * K))
    hd.line([P(x, y + 1.5) for (x, y) in lo_bot[8:33]], fill=(150, 95, 80, 80), width=int(2.4 * K))
    layer.alpha_composite(blur(hi, 1.0))
    return layer


# ---------- 헤드셋 · 잔머리 (맨 위) ----------
def draw_overlay():
    layer = new_layer()
    d = ImageDraw.Draw(layer)
    # 밴드: 머리 위를 지나는 호
    pts = []
    for k in range(61):
        t = k / 60
        a = math.pi + math.pi * t  # 180° → 360°
        x = 300 + 118 * math.cos(a) * 0.99
        y = 254 + 150 * math.sin(a) * 0.985
        pts.append(P(x, y))
    d.line(pts, fill=(44, 48, 54, 255), width=int(3.0 * K))
    d.line(pts[6:30], fill=(120, 126, 134, 140), width=int(0.9 * K))
    # 이어컵 (왼쪽)
    cup = new_layer()
    cd = ImageDraw.Draw(cup)
    cd.rounded_rectangle([P(190, 240), P(212, 282)], radius=6 * K, fill=(40, 44, 50, 255))
    cd.rounded_rectangle([P(194, 246), P(208, 276)], radius=4 * K, fill=(58, 63, 70, 255))
    cd.line([P(196, 248), P(196, 272)], fill=(120, 126, 134, 120), width=int(1.0 * K))
    layer.alpha_composite(cup)
    # 마이크 붐
    boom = []
    for k in range(31):
        t = k / 30
        x = 206 + (262 - 206) * t + 14 * math.sin(math.pi * t)
        y = 278 + (352 - 278) * t - 10 * math.sin(math.pi * t)
        boom.append(P(x, y))
    d.line(boom, fill=(46, 50, 56, 255), width=int(2.0 * K))
    d.line(boom[2:16], fill=(130, 136, 144, 120), width=int(0.7 * K))
    d.ellipse([P(258, 350), P(268, 360)], fill=(36, 40, 46, 255))
    d.ellipse([P(260, 352), P(263.5, 355.5)], fill=(150, 156, 164, 180))
    # 귀 옆 흘러내린 잔머리
    s = new_layer()
    sd = ImageDraw.Draw(s)
    for i in range(14):
        x0 = 404 + rng.uniform(-3, 3)
        y0 = 236 + rng.uniform(0, 10)
        pts = [P(x0, y0)]
        x, y = x0, y0
        for k in range(6):
            x += rng.uniform(-1.6, 0.6) + 0.5
            y += 7 + rng.uniform(0, 3)
            pts.append(P(x, y))
        sd.line(pts, fill=(48, 32, 24, int(255 * rng.uniform(0.5, 0.9))), width=max(1, int(K * rng.uniform(0.6, 1.1))))
    for i in range(8):
        x0 = 196 + rng.uniform(-2, 2)
        y0 = 234 + rng.uniform(0, 6)
        pts = [P(x0, y0)]
        x, y = x0, y0
        for k in range(4):
            x += rng.uniform(-0.8, 1.2) - 0.4
            y += 6 + rng.uniform(0, 3)
            pts.append(P(x, y))
        sd.line(pts, fill=(48, 32, 24, int(255 * rng.uniform(0.5, 0.8))), width=max(1, int(K * rng.uniform(0.6, 1.0))))
    layer.alpha_composite(blur(s, 0.2))
    return layer


def finish(img, soften=0.45):
    """살짝 부드럽게 한 뒤 축소 (안티에일리어싱) — 페인팅 느낌"""
    if soften:
        img = img.filter(ImageFilter.GaussianBlur(soften * K / 2))
    return img.resize((OUT, OUT), Image.LANCZOS)


def main():
    preview = '--preview' in sys.argv
    layers = {
        'base': draw_base(),
        'eyes-open': draw_eyes(1.0),
        'eyes-half': draw_eyes(0.42),
        'eyes-closed': draw_eyes_closed(),
        'brows': draw_brows(),
        'mouth-closed': draw_mouth('closed'),
        'mouth-mid': draw_mouth('mid'),
        'mouth-open': draw_mouth('open'),
        'overlay': draw_overlay(),
    }
    small = {k: finish(v, soften=0.45 if k == 'base' else 0.3) for k, v in layers.items()}
    if preview:
        outdir = os.path.join(ROOT, 'scratch')
        os.makedirs(outdir, exist_ok=True)
        bg = Image.new('RGBA', (OUT, OUT), (0, 0, 0, 0))
        # 앱의 원형 배경과 비슷한 배경
        g = np.zeros((OUT, OUT, 4), np.uint8)
        yy, xx = np.mgrid[0:OUT, 0:OUT]
        rr = np.sqrt(((xx - 300) / 300) ** 2 + ((yy - 210) / 300) ** 2)
        for i, (c0, c1) in enumerate(((243, 207), (250, 230), (248, 225))):
            g[..., i] = np.clip(c0 + (c1 - c0) * rr, 0, 255)
        g[..., 3] = 255
        bg = Image.fromarray(g, 'RGBA')
        for variant, (eyes, mouth) in {'a': ('eyes-open', 'mouth-closed'), 'b': ('eyes-open', 'mouth-open'), 'c': ('eyes-half', 'mouth-mid'), 'd': ('eyes-closed', 'mouth-closed')}.items():
            comp = bg.copy()
            for k in ('base', eyes, 'brows', mouth, 'overlay'):
                comp.alpha_composite(small[k])
            comp.save(os.path.join(outdir, f'host-preview-{variant}.png'))
        # 얼굴 확대본
        comp = bg.copy()
        for k in ('base', 'eyes-open', 'brows', 'mouth-closed', 'overlay'):
            comp.alpha_composite(small[k])
        comp.crop((170, 120, 430, 420)).resize((780, 900), Image.LANCZOS).save(os.path.join(outdir, 'host-preview-face.png'))
        print('preview →', outdir)
        return
    os.makedirs(DEST, exist_ok=True)
    total = 0
    for k, v in small.items():
        path = os.path.join(DEST, f'{k}.webp')
        v.save(path, 'WEBP', quality=88, method=6, exact=False)
        total += os.path.getsize(path)
        print(f'{k:13s} {os.path.getsize(path) / 1024:6.1f} KB')
    print(f'total {total / 1024:.0f} KB →', DEST)


if __name__ == '__main__':
    main()
