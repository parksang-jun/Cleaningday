#!/usr/bin/env python3
"""쇼호스트 '민서' 초상 생성기 — 예쁘고 친근한 스타일(세미 리얼 일러스트) 반신 초상을 레이어별 WebP 로 만든다.

  python3 tools/host-portrait.py            → src/assets/host/*.webp (600×600, 투명 배경)
  python3 tools/host-portrait.py --preview  → scratch/host-preview-*.png (합성본·얼굴 확대)

레이어: base(뒷머리·몸·목·피부·앞머리) · eyes-open / eyes-half / eyes-closed · brows · mouth-closed / mouth-mid / mouth-open · overlay(헤드셋·잔머리)
앱(avatar.ts)은 이 레이어를 겹쳐 깜빡임·입 모양·눈썹 강조를 애니메이션한다.

스타일 메모 — 사진 흉내(언캐니)가 아니라 **호감형 캐릭터**:
  · 피부는 도자기처럼 매끈하게(조명은 약하게, 볼륨만 살짝), 볼 홍조
  · 눈은 크고 홍채가 큼(눈 폭의 60%), 하이라이트 2~3개, 윗꺼풀이 홍채 위를 살짝 덮어 편안한 인상, 애교살
  · 코는 작게 — 선 하나 없이 그늘과 하이라이트 점만
  · 입은 작고 도톰하게, 살짝 미소, 글로시
  · 긴 생머리 + 시스루 뱅, 머릿결 하이라이트(엔젤 링), 턱선은 V 라인
  · 실제 인물을 본뜨지 않은 창작 캐릭터
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
rng = random.Random(11)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEST = os.path.join(ROOT, 'src', 'assets', 'host')

# ---------- 좌표 (600 기준) ----------
HEAD_C = (300.0, 262.0)
HEAD_A, HEAD_B = 98.0, 114.0  # 얼굴 타원 반경 (아래로 갈수록 좁아지는 V 라인)
SKULL_C = (300.0, 246.0)
SKULL_A, SKULL_B = 106.0, 146.0  # 두피(머리카락 뿌리) 타원
EYE_Y = 278.0
EYE_L, EYE_R = 262.0, 338.0
EYE_W = 27.0
NOSE_TIP = (300.0, 309.0)
MOUTH_Y = 335.0
MOUTH_HW = 19.5
NECK_HW = 30.0
HAIRLINE = 188.0  # 이마 헤어라인(가운데)

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


def mask_alpha(img):
    return np.asarray(img)[..., 3].astype(np.float32) / 255


def with_mask(img, m):
    arr = np.asarray(img).astype(np.float32)
    arr[..., 3] *= m
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), 'RGBA')


def ellipse_mask(cx, cy, a, b, taper=0.0):
    """얼굴형: 아래로 갈수록 좁아지는 타원 — 0..1 소프트 마스크와 정규화 반경"""
    dy = (Yf - cy) / b
    t = np.clip(dy, 0, 1)
    ax = a * (1 - taper * t * t)
    dx = (Xf - cx) / ax
    r = np.sqrt(dx * dx + dy * dy)
    return 1 - smoothstep(0.985, 1.0, r), r


# ---------- 피부 ----------
def face_height():
    m, r = ellipse_mask(*HEAD_C, HEAD_A, HEAD_B, taper=0.62)
    h = np.sqrt(np.clip(1 - r * r, 0, 1)) * 120.0
    for ex in (EYE_L, EYE_R):
        h = h - gauss(ex, EYE_Y - 1, 24, 12, 5)
    # 작은 코: 콧대 아주 얕게 + 코끝
    for yy in np.linspace(266, 305, 22):
        tt = (yy - 266) / 39
        h = h + gauss(300, yy, 6 + tt * 4, 3.0, 2 + tt * 5)
    h = h + gauss(*NOSE_TIP, 8, 7, 6)
    h = h + gauss(292, 312, 5, 4, 2.5) + gauss(308, 312, 5, 4, 2.5)
    # 볼 · 입술 · 턱
    h = h + gauss(252, 304, 26, 20, 5) + gauss(348, 304, 26, 20, 5)
    h = h + gauss(300, 345, 14, 5, 3)
    h = h + gauss(300, 368, 22, 12, 4)
    return h, m


def shade(albedo, h, key=(-0.4, -0.5, 0.77), fill=(0.6, 0.1, 0.8), amb=0.77, kd=0.25, kf=0.08, spec=0.03, shin=70):
    gy, gx = np.gradient(h)
    gx = gx * K
    gy = gy * K
    n = np.stack([-gx, -gy, np.ones_like(h)], -1)
    n /= np.linalg.norm(n, axis=-1, keepdims=True) + 1e-6
    L = np.array(key, np.float32)
    L /= np.linalg.norm(L)
    F = np.array(fill, np.float32)
    F /= np.linalg.norm(F)
    H = L + np.array([0, 0, 1], np.float32)
    H /= np.linalg.norm(H)
    dl = np.clip((n * L).sum(-1), 0, 1)
    df = np.clip((n * F).sum(-1), 0, 1)
    sp = np.clip((n * H).sum(-1), 0, 1) ** shin
    light = amb + kd * dl + kf * df
    rgb = albedo * light[..., None]
    sss = np.clip(1.0 - light, 0, 1)[..., None] * np.array([0.16, 0.04, 0.0])
    rgb = rgb + sss + (spec * sp)[..., None] * np.array([1.0, 0.97, 0.95])
    return np.clip(rgb, 0, 1)


def skin_albedo():
    base = np.array([1.0, 0.925, 0.885], np.float32)
    alb = np.ones((S, S, 3), np.float32) * base
    # 볼 홍조(복숭아빛) · 코끝 아주 살짝 · 눈가 약간
    # 복숭아빛 블러셔: 광대에서 콧등까지 넓고 옅게
    cheek = gauss(252, 308, 30, 15, 1.0, rot=0.25) + gauss(348, 308, 30, 15, 1.0, rot=-0.25) + 0.4 * gauss(300, 300, 22, 6, 1.0)
    alb += cheek[..., None] * np.array([0.0, -0.085, -0.05])
    nose = gauss(*NOSE_TIP, 9, 7, 1.0)
    alb += nose[..., None] * np.array([0.0, -0.03, -0.025])
    return np.clip(alb, 0, 1)


def hairline_y(x):
    return HAIRLINE + 0.0024 * (x - 300) ** 2


# ---------- 머리카락 ----------
HAIR_DARK = (36, 28, 30)
HAIR_MID = (64, 50, 50)


def hair_color(lum, a=1.0):
    r = int(min(255, 34 + 165 * lum))
    g = int(min(255, 26 + 125 * lum))
    b = int(min(255, 28 + 125 * lum))
    return (r, g, b, int(255 * a))


def draw_back_hair():
    """몸 뒤로 떨어지는 긴 머리 (뒷머리) — 어깨 뒤쪽 실루엣"""
    layer = new_layer()
    d = ImageDraw.Draw(layer)
    pts = []
    # 두피 타원 위쪽 → 양옆으로 길게 내려가는 실루엣
    for k in range(41):
        t = k / 40
        a = math.pi + math.pi * t
        pts.append(P(SKULL_C[0] + (SKULL_A + 10) * math.cos(a), SKULL_C[1] + (SKULL_B + 6) * math.sin(a)))
    right = [P(300 + 118 + 14 * math.sin((y - 250) / 90), y) for y in np.linspace(250, 600, 20)]
    left = [P(300 - 118 - 14 * math.sin((y - 250) / 90), y) for y in np.linspace(600, 250, 20)]
    poly = left[-1:] + pts + right + [P(300 + 150, 600), P(300 - 150, 600)] + left[:-1]
    d.polygon(poly, fill=HAIR_DARK + (255,))
    # 결
    s = new_layer()
    sd = ImageDraw.Draw(s)
    for i in range(900):
        x0 = rng.uniform(182, 418)
        y0 = rng.uniform(250, 300)
        pts2 = []
        x = x0
        for y in np.linspace(y0, 600, 12):
            x += math.copysign(1, x0 - 300) * 0.9 + rng.uniform(-0.5, 0.5)
            pts2.append(P(x, y))
        sd.line(pts2, fill=hair_color(rng.uniform(0.0, 0.35), rng.uniform(0.2, 0.5)), width=max(1, int(K * rng.uniform(0.5, 1.2))))
    s = with_mask(blur(s, 0.2), mask_alpha(layer))
    layer.alpha_composite(s)
    return blur(layer, 0.3)


def draw_front_hair():
    """정수리·옆머리·시스루 뱅 — 얼굴 위에 올라가는 앞머리"""
    layer = new_layer()
    # 영역: 두피 타원 ∩ (헤어라인 위) + 양옆으로 떨어지는 앞쪽 머릿단
    m = new_layer()
    md = ImageDraw.Draw(m)
    md.ellipse([P(SKULL_C[0] - SKULL_A, SKULL_C[1] - SKULL_B), P(SKULL_C[0] + SKULL_A, SKULL_C[1] + SKULL_B)], fill=(255, 255, 255, 255))
    cut = new_layer()
    cd = ImageDraw.Draw(cut)
    pts = [P(x, hairline_y(x)) for x in np.linspace(190, 410, 60)] + [P(410, 600), P(190, 600)]
    cd.polygon(pts, fill=(255, 255, 255, 255))
    face = new_layer()
    ImageDraw.Draw(face).ellipse([P(HEAD_C[0] - HEAD_A + 6, HEAD_C[1] - HEAD_B), P(HEAD_C[0] + HEAD_A - 6, HEAD_C[1] + HEAD_B)], fill=(255, 255, 255, 255))
    ma = mask_alpha(m) * (1 - mask_alpha(cut) * mask_alpha(face))
    # 옆머리 단: 얼굴 양옆을 감싸며 어깨 앞으로 떨어지는 두 가닥
    side = new_layer()
    sd = ImageDraw.Draw(side)
    for sgn in (-1, 1):
        poly = []
        for y in np.linspace(230, 600, 24):
            dyn = (y - HEAD_C[1]) / HEAD_B
            tap = 1 - 0.62 * min(1.0, max(0.0, dyn)) ** 2
            face_x = HEAD_A * tap * math.sqrt(max(0.0, 1 - dyn * dyn)) if abs(dyn) < 1 else 0.0
            # 얼굴 안쪽으로 살짝(10px) 겹쳐 얼굴 옆선을 덮고, 턱 아래로는 목 옆을 따라 내려간다
            inner_x = (300 + sgn * (face_x - 2 + 2 * math.sin((y - 230) / 22))) if y < 362 else 300 + sgn * (26 + (y - 362) * 0.1)
            poly.append(P(inner_x, y))
        for y in np.linspace(600, 230, 24):
            outer = 300 + sgn * (104 + 9 * math.sin((y - 230) / 110) + max(0, y - 420) * 0.05)
            poly.append(P(outer, y))
        sd.polygon(poly, fill=(255, 255, 255, 255))
    sa = mask_alpha(side)
    # 옆머리는 두피 타원 바깥(y>230)만 — 정수리와 합친다
    total = np.clip(ma + sa * (Yf > 232), 0, 1)
    # 기본색 (뿌리 어둡고 결 따라 밝아짐)
    base = np.ones((S, S, 3), np.float32) * np.array(HAIR_DARK, np.float32) / 255
    edge = smoothstep(0.0, 0.5, 1 - np.sqrt(((Xf - SKULL_C[0]) / SKULL_A) ** 2 + ((Yf - SKULL_C[1]) / SKULL_B) ** 2))
    base *= (0.85 + 0.25 * edge)[..., None]
    hair = to_img(base, total)
    # 결: 가르마(약간 왼쪽, x=284)에서 양쪽으로 넘어가 옆머리로 흘러내린다
    strands = new_layer()
    sd = ImageDraw.Draw(strands)
    part_x = 284.0
    for i in range(4200):
        sgn = -1 if rng.random() < 0.48 else 1
        rf = 0.80 + rng.random() ** 0.6 * 0.21
        A, B = SKULL_A * rf, SKULL_B * rf
        a0 = math.radians(-96 + (part_x - 300) / SKULL_A * 40 + rng.uniform(-5, 5))
        a1 = math.radians(-176 if sgn < 0 else -4) + math.radians(rng.uniform(-6, 6))
        pts2 = []
        for k in range(14):
            t = k / 13
            a = a0 + (a1 - a0) * t
            pts2.append(P(SKULL_C[0] + A * math.cos(a) + rng.uniform(-0.3, 0.3), SKULL_C[1] + B * math.sin(a) + rng.uniform(-0.3, 0.3)))
        # 두피 끝에서 아래로 흘러내림
        x_end, y_end = pts2[-1][0] / K, pts2[-1][1] / K
        drift = rng.uniform(-0.6, 0.6)
        for y in np.linspace(y_end + 10, 600, 14):
            x_end += sgn * 0.35 + drift * 0.3 + math.sin((y - 250) / 60) * 0.4 * sgn
            pts2.append(P(x_end, y))
        v = rng.random()
        # 엔젤 링: 정수리 아래 띠 + 옆머리 중간 띠
        shine_top = max(0.0, 1 - abs(rf - 0.92) / 0.06)
        lum = 0.05 + v * 0.22 + shine_top * rng.uniform(0.2, 0.75)
        sd.line(pts2, fill=hair_color(lum, rng.uniform(0.25, 0.6)), width=max(1, int(K * rng.uniform(0.4, 0.9))))
    strands = with_mask(blur(strands, 0.2), total)
    hair.alpha_composite(strands)
    # 옆머리 광택 띠(y≈330~400 부근, 머리카락이 어깨 앞으로 꺾이는 곳)
    gl = new_layer()
    gd = ImageDraw.Draw(gl)
    for sgn in (-1, 1):
        for k in range(60):
            x = 300 + sgn * rng.uniform(78, 118)
            y = 340 + rng.uniform(-14, 14) + abs(x - 300 - sgn * 98) * 0.5
            gd.line([P(x, y - 18), P(x + sgn * 1.2, y + 18)], fill=hair_color(rng.uniform(0.45, 0.8), rng.uniform(0.12, 0.3)), width=max(1, int(K * rng.uniform(0.5, 1.0))))
    hair.alpha_composite(with_mask(blur(gl, 0.6), total))
    # 옆으로 넘긴 앞머리(사이드 스웹 프린지): 왼쪽 가르마(x≈272)에서 오른쪽 아래로 쓸어 넘겨 이마 오른쪽을 비스듬히 덮는다
    fringe = new_layer()
    frd = ImageDraw.Draw(fringe)
    under = new_layer()
    und = ImageDraw.Draw(under)
    sweep = []
    for k in range(40):
        t = k / 39
        x = 268 + 112 * t
        y = hairline_y(268) - 8 + 78 * t ** 1.1 + 4 * math.sin(t * 3.0)
        sweep.append((x, y))
    # 밑면(반투명) — 가르마에서 시작해 쓸어 넘긴 머리의 두께
    poly = [P(x, hairline_y(x) - 12) for x in np.linspace(268, 380, 30)] + [P(*pt) for pt in sweep[::-1]]
    und.polygon(poly, fill=hair_color(0.1, 0.9))
    fringe.alpha_composite(blur(under, 1.2))
    for i in range(260):
        t0 = rng.random() ** 0.8
        x0 = 268 + 16 * t0 + rng.uniform(-3, 3)
        y0 = hairline_y(x0) - 12 + rng.uniform(-4, 2)
        reach = rng.uniform(0.55, 1.0)
        pts3 = [P(x0, y0)]
        for k in range(1, 12):
            t = k / 11 * reach
            x = x0 + 112 * t + rng.uniform(-0.3, 0.3)
            y = y0 + 4 + 78 * t ** 1.1 + 4 * math.sin(t * 3.0) + rng.uniform(-0.3, 0.3) + 10 * t0
            pts3.append(P(x, y))
        frd.line(pts3, fill=hair_color(rng.uniform(0.0, 0.3), rng.uniform(0.6, 0.95)), width=max(1, int(K * rng.uniform(0.7, 1.5))))
    # 왼쪽으로 짧게 넘어가는 몇 가닥 (관자놀이 덮기)
    for i in range(40):
        x0 = 268 + rng.uniform(-4, 4)
        y0 = hairline_y(x0) - 10 + rng.uniform(-3, 3)
        pts3 = [P(x0, y0)]
        for k in range(1, 8):
            t = k / 7
            pts3.append(P(x0 - 48 * t - rng.uniform(0, 0.4), y0 + 2 + 26 * t ** 1.4 + rng.uniform(-0.3, 0.3)))
        frd.line(pts3, fill=hair_color(rng.uniform(0.0, 0.3), rng.uniform(0.6, 0.95)), width=max(1, int(K * rng.uniform(0.7, 1.4))))
    hair.alpha_composite(blur(fringe, 0.25))
    baby = new_layer()
    bbd = ImageDraw.Draw(baby)
    for i in range(80):
        x0 = rng.uniform(214, 386)
        y0 = hairline_y(x0) + rng.uniform(-1, 3)
        dirx = (x0 - 300) / 90 + rng.uniform(-0.5, 0.5)
        pts3 = [P(x0, y0), P(x0 + dirx * 3, y0 - 3 - rng.uniform(0, 3)), P(x0 + dirx * 7, y0 - 6 - rng.uniform(0, 5))]
        bbd.line(pts3, fill=hair_color(rng.uniform(0.05, 0.3), rng.uniform(0.25, 0.6)), width=max(1, int(K * 0.6)))
    hair.alpha_composite(blur(baby, 0.2))
    # 윤곽 밖 잔머리
    fly = new_layer()
    fd = ImageDraw.Draw(fly)
    for i in range(70):
        a0 = math.radians(rng.uniform(-170, -10))
        rf0 = 1.0 + rng.uniform(-0.01, 0.03)
        span = math.radians(rng.uniform(5, 14)) * (1 if rng.random() < 0.5 else -1)
        pts4 = []
        for k in range(8):
            t = k / 7
            a = a0 + span * t
            rf = rf0 + 0.02 * math.sin(math.pi * t)
            pts4.append(P(SKULL_C[0] + SKULL_A * rf * math.cos(a), SKULL_C[1] + SKULL_B * rf * math.sin(a)))
        fd.line(pts4, fill=hair_color(rng.uniform(0.1, 0.4), rng.uniform(0.15, 0.45)), width=max(1, int(K * rng.uniform(0.4, 0.8))))
    hair.alpha_composite(blur(fly, 0.25))
    return hair


def draw_base():
    layer = new_layer()
    layer.alpha_composite(draw_back_hair())
    # --- 목 ---
    nx = (Xf - 300) / NECK_HW
    neck_mask = (np.abs(nx) < 1) & (Yf > 330) & (Yf < 470)
    nh = np.where(neck_mask, np.sqrt(np.clip(1 - nx * nx, 0, 1)) * 40, 0)
    neck_rgb = shade(skin_albedo() * 0.985, nh, amb=0.74, kd=0.2)
    shadow = 1 - 0.20 * np.clip(1 - (Yf - 378) / 34, 0, 1) * (Yf > 366)
    neck_rgb *= shadow[..., None]
    layer.alpha_composite(to_img(neck_rgb, neck_mask.astype(np.float32)))
    # --- 블라우스 + 앞치마 (어깨는 좁고 둥글게) ---
    cloth = new_layer()
    cd = ImageDraw.Draw(cloth)
    shoulder = [P(150, 600), P(152, 528)] + [P(152 + 148 * (1 - math.cos(math.pi / 2 * t)), 528 - 82 * math.sin(math.pi / 2 * t)) for t in np.linspace(0, 1, 16)] + [P(300, 458)] + [P(448 - 148 * (1 - math.cos(math.pi / 2 * t)), 528 - 82 * math.sin(math.pi / 2 * t)) for t in np.linspace(1, 0, 16)] + [P(448, 528), P(450, 600)]
    cd.polygon(shoulder, fill=(250, 249, 248, 255))
    cl = np.asarray(cloth).astype(np.float32)
    grad = 1 - 0.14 * np.clip((Xf - 170) / 280, 0, 1) - 0.10 * np.clip((Yf - 450) / 150, 0, 1)
    fold = 0.08 * np.exp(-0.5 * ((Xf - 246 + (Yf - 450) * 0.06) / 9) ** 2) + 0.08 * np.exp(-0.5 * ((Xf - 354 - (Yf - 450) * 0.06) / 9) ** 2)
    cl[..., :3] *= (grad - fold)[..., None]
    layer.alpha_composite(Image.fromarray(np.clip(cl, 0, 255).astype(np.uint8), 'RGBA'))
    v = new_layer()
    ImageDraw.Draw(v).polygon([P(270, 446), P(300, 478), P(330, 446), P(323, 444), P(300, 468), P(277, 444)], fill=(222, 224, 228, 255))
    layer.alpha_composite(blur(v, 0.4))
    apron = new_layer()
    ad = ImageDraw.Draw(apron)
    ad.polygon([P(242, 600), P(246, 474), P(300, 490), P(354, 474), P(358, 600)], fill=(52, 170, 158, 255))
    ap = np.asarray(apron).astype(np.float32)
    agrad = 1 - 0.18 * np.clip((Xf - 246) / 112, 0, 1) + 0.05 * np.sin((Yf - 470) / 9.0) * np.clip((Yf - 480) / 60, 0, 1)
    ap[..., :3] *= agrad[..., None]
    layer.alpha_composite(Image.fromarray(np.clip(ap, 0, 255).astype(np.uint8), 'RGBA'))
    sd = ImageDraw.Draw(layer)
    for sx, ex in ((246, 272), (354, 328)):
        sd.line([P(sx, 474), P(ex, 420)], fill=(40, 146, 136, 255), width=int(5 * K))
    sd.rounded_rectangle([P(284, 530), P(316, 544)], radius=2 * K, fill=(252, 252, 252, 255), outline=(32, 128, 118, 255), width=int(1.1 * K))
    sd.ellipse([P(288, 534), P(294, 540)], fill=(52, 170, 158, 255))
    sd.rounded_rectangle([P(298, 534), P(312, 537)], radius=1 * K, fill=(150, 160, 165, 255))
    sd.rounded_rectangle([P(298, 539), P(308, 541)], radius=1 * K, fill=(170, 180, 185, 255))
    # --- 얼굴 피부 ---
    h, m = face_height()
    _, r_face = ellipse_mask(*HEAD_C, HEAD_A, HEAD_B, taper=0.62)
    rgb = shade(skin_albedo(), h)
    # 앞머리·옆머리 그늘 (이마 윗부분, 얼굴 양옆)
    hl = hairline_y(Xf)
    rgb *= (1 - 0.10 * np.clip((hl + 12 - Yf) / 12, 0, 1) * (Yf > hl - 2))[..., None]
    # 쓸어 넘긴 앞머리 아래 그늘 (이마 오른쪽, 비스듬히)
    fr_y = hairline_y(268) - 8 + 78 * np.clip((Xf - 268) / 112, 0, 1) ** 1.1
    rgb *= (1 - 0.12 * np.clip((fr_y + 10 - Yf) / 10, 0, 1) * (Yf > fr_y - 30) * (Xf > 272))[..., None]
    side_sh = np.clip((np.abs(Xf - 300) - 62) / 36, 0, 1) * (Yf < 372) * (Yf > 200)
    rgb *= (1 - 0.12 * side_sh)[..., None]
    # 턱선 둥글게: 얼굴 아래쪽 가장자리로 갈수록 살짝 어둡게
    jaw = np.clip((r_face - 0.72) / 0.28, 0, 1) * np.clip((Yf - 300) / 60, 0, 1)
    rgb *= (1 - 0.14 * jaw)[..., None]
    # 코: 왼쪽 콧대 그늘 선(아주 옅게) + 코 아래 그늘
    rgb *= (1 - 0.07 * gauss(293, 290, 2.6, 15, 1.0, rot=0.08))[..., None]
    rgb *= (1 - 0.12 * gauss(300, 319, 7, 2.6, 1.0))[..., None]
    rgb *= (1 - 0.06 * gauss(300, 352, 12, 3, 1.0))[..., None]
    # 도자기 피부: 살짝 블러
    face_img = to_img(rgb, m)
    layer.alpha_composite(face_img)
    # 코끝·콧방울 하이라이트, 콧구멍은 점 두 개만
    nos = new_layer()
    nd = ImageDraw.Draw(nos)
    nd.ellipse([P(297.5, 304.5), P(302.5, 308.5)], fill=(255, 245, 240, 120))
    for sgn in (-1, 1):
        nd.ellipse([P(300 + sgn * 6.5 - 1.6, 314.5), P(300 + sgn * 6.5 + 1.6, 316.7)], fill=(170, 110, 105, 110))
    layer.alpha_composite(blur(nos, 0.7))
    # 물광 하이라이트: 광대·콧등·이마·턱
    hi = new_layer()
    hd = ImageDraw.Draw(hi)
    hd.ellipse([P(234, 292), P(260, 306)], fill=(255, 250, 248, 40))
    hd.ellipse([P(340, 292), P(366, 306)], fill=(255, 250, 248, 40))
    hd.line([P(300, 266), P(300, 298)], fill=(255, 250, 246, 34), width=int(2 * K))
    hd.ellipse([P(293, 360), P(307, 366)], fill=(255, 248, 244, 55))
    layer.alpha_composite(blur(hi, 3.2))
    # --- 앞머리 ---
    layer.alpha_composite(draw_front_hair())
    return layer


# ---------- 눈 ----------
def eye_curves(cx, side, o):
    """o=뜬 정도 0..1. side -1 왼눈 +1 오른눈(바깥쪽 방향). 바깥 끝이 살짝 올라간 아몬드형"""
    w = EYE_W
    hu = 13.5 * o
    hl = 7.0 * (0.5 + 0.5 * o)
    inner = (cx - w * side, EYE_Y + 3.0)
    outer = (cx + w * side, EYE_Y - 3.0 - 1.0 * o)
    up, lo = [], []
    for k in range(41):
        t = k / 40
        u = -1 + 2 * t
        x = inner[0] + (outer[0] - inner[0]) * t
        base_y = inner[1] + (outer[1] - inner[1]) * t
        f = max(0.0, 1 - u * u) ** 0.65 * (1 + 0.16 * u)
        up.append((x, base_y - hu * f))
        g = max(0.0, 1 - u * u) ** 0.85
        lo.append((x, base_y + hl * g))
    return up, lo


def draw_eyes(o):
    layer = new_layer()
    for cx, side in ((EYE_L, -1), (EYE_R, 1)):
        up, lo = eye_curves(cx, side, o)
        poly = [P(*p) for p in (up + lo[::-1])]
        clip = new_layer()
        ImageDraw.Draw(clip).polygon(poly, fill=(255, 255, 255, 255))
        ca = mask_alpha(clip)
        # 흰자: 밝고 깨끗하게, 윗꺼풀 아래 옅은 그늘
        sc = np.ones((S, S, 3), np.float32) * np.array([0.985, 0.975, 0.98])
        top_y = min(p[1] for p in up)
        sc *= (1 - 0.16 * np.clip(1 - (Yf - top_y) / 8, 0, 1))[..., None]
        sc *= (0.94 + 0.06 * np.clip(1 - np.abs(Xf - cx) / EYE_W, 0, 1))[..., None]
        layer.alpha_composite(to_img(sc, ca))
        # 홍채: 크게(눈 폭의 60%), 따뜻한 갈색, 아래쪽이 밝은 그라데이션
        icx, icy, r = cx + 0.6 * side, EYE_Y + 1.2, 15.2
        dx, dy = Xf - icx, Yf - icy
        rr = np.sqrt(dx * dx + dy * dy) / r
        ang = np.arctan2(dy, dx)
        inside = (rr <= 1.0).astype(np.float32)
        fibers = 0.5 + 0.5 * np.sin(ang * 34 + rr * 5) * np.sin(ang * 9 + 0.7)
        lum = 0.55 + 0.55 * np.clip((dy / r + 1) / 2, 0, 1)  # 아래 밝음
        lum = lum * (0.85 + 0.3 * fibers * np.clip(1 - np.abs(rr - 0.6) / 0.4, 0, 1))
        lum *= 1 - 0.6 * smoothstep(0.86, 1.0, rr)  # 테두리 어둡게
        lum *= 1 - 0.3 * np.clip(1 - (Yf - (icy - r)) / 7, 0, 1)  # 윗꺼풀 그늘
        iris = np.stack([0.34 * lum * 1.1, 0.21 * lum * 1.0, 0.17 * lum * 1.0], -1)
        # 홍채 아래쪽에 갈색 반사
        iris += (np.clip(dy / r - 0.25, 0, 1) * 0.30 * inside)[..., None] * np.array([0.40, 0.24, 0.12])
        ir = to_img(np.clip(iris, 0, 1), inside * ca)
        pd = ImageDraw.Draw(ir)
        pr = 6.2
        pd.ellipse([P(icx - pr, icy - pr), P(icx + pr, icy + pr)], fill=(18, 10, 10, 255))
        # 하이라이트: 큰 타원(위 왼쪽) + 작은 점(아래 오른쪽) + 아래 초승달 반사
        pd.ellipse([P(icx - 8.2, icy - 9.4), P(icx - 1.2, icy - 3.2)], fill=(255, 255, 255, 240))
        pd.ellipse([P(icx + 4.0, icy + 3.4), P(icx + 7.2, icy + 6.6)], fill=(255, 255, 255, 190))
        pd.ellipse([P(icx - 2.5, icy + 8.5), P(icx + 5.5, icy + 12.0)], fill=(255, 246, 236, 90))
        layer.alpha_composite(with_mask(ir, ca))
        # 속눈썹 라인(부드러운 다크 브라운) + 바깥쪽 긴 속눈썹 몇 가닥
        lash = new_layer()
        ld = ImageDraw.Draw(lash)
        ld.line([P(*p) for p in up], fill=(48, 30, 30, 240), width=int(1.9 * K))
        ld.line([P(*up[-1]), P(up[-1][0] + 4.5 * side, up[-1][1] - 2.4)], fill=(58, 34, 30, 220), width=int(1.5 * K))
        for k in range(14, 40, 3):
            x, y = up[k]
            u = -1 + 2 * (k / 40)
            ang2 = math.radians(-90 + side * (20 + 42 * u))
            ln = (4.5 + 6.0 * max(0.0, u)) * (0.5 + 0.5 * o)
            xm = x + math.cos(ang2) * ln * 0.5
            ym = y + math.sin(ang2) * ln * 0.55
            x2 = x + math.cos(ang2) * ln + side * 0.8
            y2 = y + math.sin(ang2) * ln * 0.75
            ld.line([P(x, y), P(xm, ym), P(x2, y2)], fill=(50, 30, 26, 215), width=max(1, int(K * 0.8)))
        # 아랫꺼풀: 아주 옅은 선 + 애교살(밝은 띠 + 그 아래 옅은 그늘)
        ld.line([P(*p) for p in lo[3:38]], fill=(205, 150, 140, 90), width=int(1.0 * K))
        layer.alpha_composite(blur(lash, 0.18))
        aeg = new_layer()
        ad = ImageDraw.Draw(aeg)
        ad.line([P(x, y + 3.2) for (x, y) in lo[5:36]], fill=(255, 236, 230, 95), width=int(3.2 * K))
        ad.line([P(x, y + 6.2) for (x, y) in lo[6:35]], fill=(215, 160, 150, 60), width=int(1.6 * K))
        layer.alpha_composite(blur(aeg, 1.2))
        # 쌍꺼풀 라인(옅게)
        crease = new_layer()
        ImageDraw.Draw(crease).line([P(x, y - 4.5 - 1.0 * (1 - o)) for (x, y) in up[4:37]], fill=(190, 135, 125, int(70 + 40 * o)), width=int(1.3 * K))
        layer.alpha_composite(blur(crease, 0.8))
    return layer


def draw_eyes_closed():
    layer = new_layer()
    for cx, side in ((EYE_L, -1), (EYE_R, 1)):
        up, lo = eye_curves(cx, side, 0.0)
        d = ImageDraw.Draw(layer)
        pts = [P(x, y + 2.4) for (x, y) in lo]
        d.line(pts, fill=(62, 38, 34, 225), width=int(1.7 * K))
        for k in range(16, 40, 3):
            x, y = lo[k]
            u = -1 + 2 * (k / 40)
            ang = math.radians(90 - side * (18 + 28 * u))
            ln = 3.5 + 3.0 * max(0.0, u)
            d.line([P(x, y + 2.4), P(x + math.cos(ang) * ln, y + 2.4 + math.sin(ang) * ln)], fill=(50, 30, 26, 200), width=max(1, int(K * 0.8)))
        lid = new_layer()
        ImageDraw.Draw(lid).ellipse([P(cx - 22, EYE_Y - 9), P(cx + 22, EYE_Y + 4)], fill=(250, 214, 205, 70))
        layer.alpha_composite(blur(lid, 1.6))
    return blur(layer, 0.15)


def draw_brows():
    """일자에 가까운 부드러운 눈썹 — 연한 브라운, 채운 형태 + 결"""
    layer = new_layer()
    for cx, side in ((EYE_L, -1), (EYE_R, 1)):
        pts = []
        for k in range(31):
            t = k / 30
            x = cx + side * (-20 + 46 * t)
            y = EYE_Y - 26 - 3.0 * math.sin(math.pi * min(1, t * 1.1)) + 4 * max(0, t - 0.75) * 3
            pts.append((x, y))
        under = new_layer()
        ud = ImageDraw.Draw(under)
        for k in range(30):
            w = (3.2 - 1.6 * max(0, (k / 30) - 0.5) * 2) * K
            ud.line([P(*pts[k]), P(*pts[k + 1])], fill=(96, 68, 60, 200), width=max(1, int(w)))
        layer.alpha_composite(blur(under, 1.1))
        d = ImageDraw.Draw(layer)
        for i in range(120):
            t = rng.random() ** 0.9
            x = cx + side * (-20 + 46 * t) + rng.uniform(-0.6, 0.6)
            y = EYE_Y - 26 - 3.0 * math.sin(math.pi * min(1, t * 1.1)) + 4 * max(0, t - 0.75) * 3 + rng.uniform(-1.2, 1.2)
            ang = math.radians((-70 + 80 * t) if t < 0.5 else (8 + 14 * (t - 0.5)))
            if side < 0:
                ang = math.pi - ang
            ln = (3.0 + 2.5 * (1 - abs(t - 0.4))) * rng.uniform(0.7, 1.1)
            x2 = x + math.cos(ang) * ln
            y2 = y - abs(math.sin(ang)) * ln * (0.8 if t < 0.5 else 0.3)
            d.line([P(x, y), P(x2, y2)], fill=(96, 66, 54, int(255 * rng.uniform(0.35, 0.7))), width=max(1, int(K * rng.uniform(0.5, 0.9))))
    return blur(layer, 0.15)


# ---------- 입 ----------
def draw_mouth(state):
    layer = new_layer()
    gap = {'closed': 0.0, 'mid': 4.0, 'open': 8.5}[state]
    hw = MOUTH_HW + (0 if state == 'closed' else 1.0)
    cy = MOUTH_Y
    corner_up = 3.4 if state == 'closed' else 2.2
    lc = (300 - hw, cy - corner_up)
    rc = (300 + hw, cy - corner_up)
    up_top, up_bot, lo_top, lo_bot = [], [], [], []
    for k in range(41):
        t = k / 40
        x = lc[0] + (rc[0] - lc[0]) * t
        u = abs(-1 + 2 * t)
        bow = math.exp(-((u - 0.28) / 0.17) ** 2)
        up_top.append((x, cy - corner_up - 5.2 * (1 - u ** 1.7) + 1.3 * bow - 0.5 * (1 - u) ** 6))
        up_bot.append((x, cy - 0.8 * (1 - u * u) - gap * 0.35 * (1 - u * u) ** 0.6))
        lo_top.append((x, cy + (0.5 + gap) * (1 - u * u) ** 0.7))
        lo_bot.append((x, cy + (8.8 + gap * 0.45) * (1 - u * u) ** 0.5))
    if gap > 0:
        inner = new_layer()
        ImageDraw.Draw(inner).polygon([P(*p) for p in (up_bot + lo_top[::-1])], fill=(96, 40, 48, 255))
        teeth = new_layer()
        td = ImageDraw.Draw(teeth)
        tt = [(x, y - 0.2) for (x, y) in up_bot]
        tb = [(x, min(y + 0.2 + 3.6 * (1 - abs(-1 + 2 * k / 40) ** 2) ** 0.5, lo_top[k][1] - 0.6)) for k, (x, y) in enumerate(up_bot)]
        td.polygon([P(*p) for p in (tt + tb[::-1])], fill=(250, 246, 240, 255))
        ta = np.asarray(teeth).astype(np.float32)
        ta[..., :3] *= (1 - 0.22 * np.clip(np.abs(Xf - 300) / hw, 0, 1) ** 2)[..., None]
        teeth = Image.fromarray(np.clip(ta, 0, 255).astype(np.uint8), 'RGBA')
        tdd = ImageDraw.Draw(teeth)
        for tx in (-9.5, -5.6, -1.9, 1.9, 5.6, 9.5):
            tdd.line([P(300 + tx, cy - 0.8), P(300 + tx * 1.05, cy + 3.0)], fill=(200, 180, 175, 70), width=max(1, int(K * 0.5)))
        inner.alpha_composite(teeth)
        if state == 'open':
            tongue = new_layer()
            ImageDraw.Draw(tongue).ellipse([P(291, cy + 4.2), P(309, cy + 11.5)], fill=(205, 100, 115, 255))
            inner.alpha_composite(with_mask(blur(tongue, 0.5), mask_alpha(inner)))
        layer.alpha_composite(inner)
    # 입술: 코랄 핑크, 글로시
    lips = new_layer()
    ld = ImageDraw.Draw(lips)
    ld.polygon([P(*p) for p in (up_top + up_bot[::-1])], fill=(238, 142, 140, 255))
    ld.polygon([P(*p) for p in (lo_top + lo_bot[::-1])], fill=(246, 160, 156, 255))
    la = np.asarray(lips).astype(np.float32)
    upper = Yf < cy - gap * 0.2
    sh = np.where(upper, 1 - 0.14 * np.clip((Yf - (cy - 6)) / 6, 0, 1), 1.0)
    low_hi = np.exp(-0.5 * (((Xf - 300) / 7) ** 2 + ((Yf - (cy + 3.6 + gap * 0.45)) / 2.0) ** 2))
    sh = sh * (1 + 0.40 * low_hi * (~upper)) * np.where(~upper, 1 - 0.22 * np.clip((Yf - (cy + 5 + gap * 0.45)) / 5, 0, 1), 1)
    sh = sh * (1 - 0.30 * np.clip((np.abs(Xf - 300) - hw * 0.6) / (hw * 0.4), 0, 1))
    la[..., :3] *= sh[..., None]
    # 그라데이션 립: 안쪽(입선 근처)은 진한 코랄, 바깥은 피부로 번지듯
    core = np.exp(-0.5 * (((Xf - 300) / (hw * 0.55)) ** 2 + ((Yf - cy - gap * 0.2) / 4.5) ** 2))
    la[..., 0] = la[..., 0] * (1 - 0.02 * core)
    la[..., 1] = la[..., 1] * (1 - 0.30 * core)
    la[..., 2] = la[..., 2] * (1 - 0.28 * core)
    la[..., 3] *= 1 - 0.35 * np.clip((np.abs(Xf - 300) - hw * 0.7) / (hw * 0.3), 0, 1)
    lips = blur(Image.fromarray(np.clip(la, 0, 255).astype(np.uint8), 'RGBA'), 0.8)
    layer.alpha_composite(lips)
    line = new_layer()
    lnd = ImageDraw.Draw(line)
    if gap == 0:
        lnd.line([P(x, y) for (x, y) in up_bot[3:38]], fill=(160, 70, 80, 190), width=int(1.1 * K))
    for sgn in (-1, 1):
        lnd.ellipse([P(300 + sgn * hw - 1.4, cy - corner_up - 1.0), P(300 + sgn * hw + 1.4, cy - corner_up + 1.0)], fill=(150, 75, 82, 120))
    layer.alpha_composite(blur(line, 0.5))
    hi = new_layer()
    hd = ImageDraw.Draw(hi)
    hd.ellipse([P(294, cy + 2.5 + gap * 0.45), P(306, cy + 5.5 + gap * 0.45)], fill=(255, 240, 238, 120))
    hd.line([P(x, y - 1.0) for (x, y) in up_top[14:27]], fill=(255, 235, 230, 70), width=int(1.2 * K))
    hd.line([P(x, y + 1.6) for (x, y) in lo_bot[10:31]], fill=(170, 110, 100, 60), width=int(2.0 * K))
    layer.alpha_composite(blur(hi, 0.8))
    return layer


# ---------- 헤드셋 · 잔머리 (맨 위) ----------
def draw_overlay():
    layer = new_layer()
    d = ImageDraw.Draw(layer)
    # 가는 헤드밴드(머리 위를 살짝 지나는 호) — 로즈골드 톤
    pts = []
    for k in range(61):
        t = k / 60
        a = math.pi + math.pi * t
        pts.append(P(300 + (SKULL_A + 2) * math.cos(a), SKULL_C[1] + (SKULL_B + 2) * math.sin(a) * 0.99))
    d.line(pts[8:53], fill=(178, 132, 118, 255), width=int(2.2 * K))
    d.line(pts[10:30], fill=(238, 206, 196, 150), width=int(0.8 * K))
    # 이어피스(왼쪽, 머리카락 위) + 마이크 붐
    cup = new_layer()
    cd = ImageDraw.Draw(cup)
    cd.rounded_rectangle([P(198, 252), P(216, 288)], radius=6 * K, fill=(70, 62, 60, 255))
    cd.rounded_rectangle([P(202, 258), P(212, 282)], radius=4 * K, fill=(190, 150, 138, 255))
    cd.line([P(204, 260), P(204, 280)], fill=(240, 215, 205, 150), width=int(0.9 * K))
    layer.alpha_composite(cup)
    # 마이크 붐: 볼을 가로지르지 않고 턱선을 따라 내려온다
    boom = []
    for k in range(31):
        t = k / 30
        boom.append(P(212 + (258 - 212) * t - 10 * math.sin(math.pi * t), 288 + (368 - 288) * t))
    d.line(boom, fill=(120, 96, 90, 235), width=int(1.3 * K))
    d.line(boom[2:16], fill=(230, 205, 195, 120), width=int(0.5 * K))
    d.ellipse([P(254.5, 366.5), P(262.5, 374.5)], fill=(90, 74, 70, 255))
    d.ellipse([P(256.5, 368.5), P(259.2, 371.2)], fill=(225, 200, 190, 190))
    return layer


def finish(img, soften):
    if soften:
        img = img.filter(ImageFilter.GaussianBlur(soften * K / 2))
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
    small = {k: finish(v, 0.4 if k == 'base' else 0.25) for k, v in layers.items()}
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
        comp.crop((170, 110, 430, 410)).resize((780, 900), Image.LANCZOS).save(os.path.join(outdir, 'host-preview-face.png'))
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
