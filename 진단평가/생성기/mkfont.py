# -*- coding: utf-8 -*-
"""조판에 쓸 글꼴 두 개를 만든다.

윈도에 깔린 노토 산스 KR 은 가변 서체 한 파일이고 기본 굵기가 Thin 이다.
reportlab 은 가변 서체의 굵기를 고를 수 없으므로 Regular 와 Bold 를 미리
뽑아 파일로 만들어 둔다.

    python mkfont.py

만들어지는 곳은 이 파일 옆의 `글꼴/` 이다.

## 뽑은 뒤에 글자 셋을 고친다

노토에 없거나 자리가 어긋나는 수학 기호 셋을 여기서 손본다. 고친 내용은
`조판규칙.md` 에도 적어 둔다.

1. `≒` (U+2252) 를 새로 그린다. 노토에 아예 없어 빈칸으로 인쇄된다.
   `=` 의 두 막대에 점 둘을 얹는데, 위 점은 왼쪽 아래 점은 오른쪽이다.
   맑은 고딕 · 바탕 · 굴림 셋 다 그렇게 그리므로 그 비율을 따랐다.
2. 순환소수 점 `U+0307` 을 앞 글자 위로 옮긴다. 원래는 폭이 0이면서 그림이
   오른쪽에 있어 `0.3̇` 이 `0.3 ̇` 처럼 3 옆에 찍힌다. 숫자 폭의 절반만큼
   왼쪽으로, 숫자 높이 위로 옮겨 숫자 한가운데 위에 오게 한다.
3. `√` (U+221A) 의 윗막대를 잘라 낸다. 원래 글리프는 갈고리 뒤에 1 em 까지
   막대가 붙어 있어 `√5` 가 `√ 5` 처럼 빈 막대 뒤에 5 가 오는 꼴이 된다.
   막대를 떼고 폭을 갈고리에 맞추면, 덧줄은 `solution.py` 가 근호 안 글자
   길이에 맞춰 그린다.
"""
import os
import sys

from fontTools.pens.recordingPen import RecordingPen
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

SRC = 'C:/Windows/Fonts/NotoSansKR-VF.ttf'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '글꼴')
WEIGHTS = [(400, 'NotoSansKR-Regular.ttf'), (700, 'NotoSansKR-Bold.ttf')]

# `≒` 의 비율. 맑은 고딕(그리고 바탕·굴림)을 재서 얻었다.
DOT_X = (0.108, 0.888)   # 막대 왼쪽 끝에서부터 위·아래 점의 가운데 자리
DOT_GAP = 0.048          # 막대와 점 사이 (em)
DOT_SIZE = {400: 1.72, 700: 1.44}   # 점 지름 ÷ 막대 두께

RADICAL_NUB = 26         # 갈고리 꼭대기에서 오른쪽으로 남길 막대 길이
REPEAT_DOT = 0.75        # 순환소수 점을 원래 결합 점의 몇 배로 그릴까
REPEAT_GAP = 40          # 숫자 꼭대기와 점 사이


def _codes(f):
    cm = {}
    for t in f['cmap'].tables:
        cm.update(t.cmap)
    return cm


def _contours(glyphset, name):
    """글리프를 윤곽 목록으로 읽는다. 각 윤곽은 (연산, 점들) 목록이다."""
    rp = RecordingPen()
    glyphset[name].draw(rp)
    out, cur = [], []
    for op, args in rp.value:
        if op == 'moveTo' and cur:
            out.append(cur)
            cur = []
        cur.append((op, args))
    if cur:
        out.append(cur)
    return out


def _replay(pen, contours, dx=0.0, dy=0.0, scale=1.0, cx=0.0, cy=0.0):
    """윤곽을 (cx, cy) 기준으로 scale 배 하고 (dx, dy) 만큼 옮겨 그린다."""
    def m(p):
        return (round((p[0] - cx) * scale + cx + dx),
                round((p[1] - cy) * scale + cy + dy))
    for cont in contours:
        for op, args in cont:
            pts = tuple(m(a) for a in args if isinstance(a, tuple))
            getattr(pen, op)(*pts) if pts else pen.closePath()


def add_approx(f):
    """`≒` 를 `=` 의 막대와 점 둘로 그려 넣는다."""
    cm = _codes(f)
    if 0x2252 in cm:
        return None
    gs = f.getGlyphSet()
    upm = f['head'].unitsPerEm
    eq = cm[0x3D]
    bars = _contours(gs, eq)
    pts = [a for cont in bars for op, args in cont for a in args if isinstance(a, tuple)]
    x0, x1 = min(p[0] for p in pts), max(p[0] for p in pts)
    ys = sorted(set(p[1] for p in pts))
    lo_bot, lo_top, hi_bot, hi_top = ys[0], ys[1], ys[2], ys[3]
    thick = lo_top - lo_bot
    weight = 700 if 'Bold' in str(f['name'].getDebugName(2)) else 400
    r = round(thick * DOT_SIZE[weight] / 2)

    dot = _contours(gs, cm[0x0307])
    dpts = [a for cont in dot for op, args in cont for a in args if isinstance(a, tuple)]
    dcx = (min(p[0] for p in dpts) + max(p[0] for p in dpts)) / 2.0
    dcy = (min(p[1] for p in dpts) + max(p[1] for p in dpts)) / 2.0
    dr = (max(p[0] for p in dpts) - min(p[0] for p in dpts)) / 2.0

    gap = DOT_GAP * upm
    pen = TTGlyphPen(None)
    _replay(pen, bars)
    for frac, cy in ((DOT_X[0], hi_top + gap + r), (DOT_X[1], lo_bot - gap - r)):
        _replay(pen, dot, dx=x0 + frac * (x1 - x0) - dcx, dy=cy - dcy,
                scale=r / dr, cx=dcx, cy=dcy)

    name = 'approxequal'
    g = pen.glyph()
    g.recalcBounds(f['glyf'])
    f['glyf'][name] = g
    f['hmtx'][name] = (f['hmtx'][eq][0], g.xMin)
    for t in f['cmap'].tables:
        if t.isUnicode():
            t.cmap[0x2252] = name
    return name


def move_repeat_dot(f):
    """순환소수 점을 앞 숫자 한가운데 위로 옮긴다."""
    cm = _codes(f)
    gs = f.getGlyphSet()
    name = cm[0x0307]
    digit = cm[0x30]
    adv = f['hmtx'][digit][0]
    dtop = max(a[1] for op, args in _contours(gs, digit)[0] for a in args
               if isinstance(a, tuple))
    top = max(max(a[1] for a in args if isinstance(a, tuple))
              for cont in _contours(gs, name) for op, args in cont
              if any(isinstance(a, tuple) for a in args))
    dot = _contours(gs, name)
    dpts = [a for cont in dot for op, args in cont for a in args if isinstance(a, tuple)]
    cx = (min(p[0] for p in dpts) + max(p[0] for p in dpts)) / 2.0
    cy = (min(p[1] for p in dpts) + max(p[1] for p in dpts)) / 2.0
    r = (max(p[0] for p in dpts) - min(p[0] for p in dpts)) / 2.0 * REPEAT_DOT

    pen = TTGlyphPen(None)
    _replay(pen, dot, dx=-adv / 2.0 - cx, dy=(dtop + REPEAT_GAP + r) - cy,
            scale=REPEAT_DOT, cx=cx, cy=cy)
    g = pen.glyph()
    g.recalcBounds(f['glyf'])
    f['glyf'][name] = g
    f['hmtx'][name] = (0, g.xMin)
    return name


def trim_radical(f):
    """`√` 의 윗막대를 떼고 폭을 갈고리에 맞춘다."""
    cm = _codes(f)
    name = cm[0x221A]
    g = f['glyf'][name]
    g.expand(f['glyf'])
    xs = [int(g.coordinates[i][0]) for i in range(len(g.coordinates))]
    right = max(xs)
    hook = sorted(x for x in xs if x < right)[-1]      # 갈고리 꼭대기의 x
    cut = hook + RADICAL_NUB
    for i, x in enumerate(xs):
        if x == right:
            g.coordinates[i] = (cut, g.coordinates[i][1])
    g.recalcBounds(f['glyf'])
    f['hmtx'][name] = (cut, g.xMin)
    return cut


def patch(f):
    return (add_approx(f), move_repeat_dot(f), trim_radical(f))


if __name__ == '__main__':
    if not os.path.exists(SRC):
        sys.exit('가변 서체를 못 찾았다: %s' % SRC)
    os.makedirs(OUT, exist_ok=True)
    for w, name in WEIGHTS:
        f = TTFont(SRC)
        instancer.instantiateVariableFont(f, {'wght': w}, inplace=True,
                                          updateFontNames=True)
        made = patch(f)
        path = os.path.join(OUT, name)
        f.save(path)
        print('%s  %.1f MB  고친 것 %s' % (name, os.path.getsize(path) / 1e6, made))
