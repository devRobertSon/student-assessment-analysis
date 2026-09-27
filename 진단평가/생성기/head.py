# -*- coding: utf-8 -*-
"""문제지·해설지 머리말. 원본 폴더의 `중등예시.pdf` · `고등예시.pdf` 를 따랐다.

중학교 시험지는 둥근 파란 카드, 고등학교 시험지는 흑백 줄표다.
문제지에는 학교·학년·이름·연락처·학부모 연락처·날짜·점수를 적는 자리를 두고,
해설지에는 시험지 이름과 단원 범위만 둔다.

m 에 넣는 것
    grade  중1-1, 공통수학1 같은 학기 이름
    word   진단평가, 진단평가 해설 같은 큰 글씨
    range  단원 범위
    stat   30문제 · 100점
    high   고등학교면 참
"""
import os

from PIL import Image as PILImage
from reportlab.lib import colors

HERE = os.path.dirname(os.path.abspath(__file__))
# 시험지에는 알파 표와 글자가 한 벌로 붙은 가로 로고를 쓴다. 글자는 학원
# 로고의 글꼴 그대로다. 표만 쓰는 `_로고a.png` 는 글자가 없는 자리에 쓴다.
LOGO = os.path.join(HERE, '_로고.png')
LOGO_AR = (lambda s: s[0] / float(s[1]))(PILImage.open(LOGO).size)

SKY = colors.HexColor('#00ABFF')             # 중등예시에서 잰 파랑
INK = colors.HexColor('#333333')
GREY = colors.HexColor('#8a8f99')
LABEL = colors.HexColor('#5f6470')
RULE = colors.HexColor('#111111')
THIN = colors.HexColor('#999999')
TINT = colors.HexColor('#dbeefb')
PALE = colors.HexColor('#cfeeff')   # 파란 띠 위의 연한 글자

# 머리말이 쓰는 높이. 문제지는 1쪽 단 높이를 이만큼 줄인다.
MID_FULL, MID_PLAIN = 132, 86
HIGH_FULL, HIGH_PLAIN = 110, 56
# 2쪽부터의 머리말. 중등은 파란 띠 42 에 아래 여유, 고등은 두 줄과 줄.
MID_RUN, HIGH_RUN = 52, 54
BAND_H = 42

ROW1 = ['학교', '학년', '이름']
ROW2 = ['연락처', '학부모 연락처']
HIROW = ['학교', '학년', '연락처', '학부모 연락처']


def height(m, fields=True):
    if m['high']:
        return HIGH_FULL if fields else HIGH_PLAIN
    return MID_FULL if fields else MID_PLAIN


def draw(c, top, m, fields=True):
    """top 을 위쪽 끝으로 삼아 그리고 쓴 높이를 돌려준다."""
    fn = _high if m['high'] else _mid
    fn(c, top, m, fields)
    return height(m, fields)


def _logo(c, right, y, h=13):
    """가로 로고를 오른쪽 끝에 맞춰 놓는다."""
    w = h * LOGO_AR
    c.drawImage(LOGO, right - w, y, width=w, height=h, mask='auto')


def _blank(c, x, y, w, lab, col, line_col, size=8):
    """라벨을 찍고 남는 폭에 적는 줄을 긋는다."""
    c.setFillColor(col)
    c.setFont('KRB', size)
    c.drawString(x, y, lab)
    lw = c.stringWidth(lab, 'KRB', size) + 7
    c.setStrokeColor(line_col)
    c.setLineWidth(0.7)
    c.line(x + lw, y - 2.5, x + w, y - 2.5)


# ── 중학교: 둥근 파란 카드 ───────────────────────────────────────

def _mid(c, top, m, fields):
    pw = c._pagesize[0]
    x0, x1 = 23, pw - 23
    cl, cr = x0 + 12, x1 - 12               # 흰 카드의 좌우
    card_top, card_h = top - 5, 76

    c.setFillColor(SKY)
    c.roundRect(x0, top - height(m, fields), x1 - x0,
                height(m, fields), 13, stroke=0, fill=1)
    c.setFillColor(colors.white)
    c.roundRect(cl, card_top - card_h, cr - cl, card_h, 9, stroke=0, fill=1)

    cx = pw / 2
    c.setFillColor(SKY)
    c.setFont('KRB', 10)
    c.drawCentredString(cx, card_top - 16, m['grade'])
    c.setFillColor(INK)
    c.setFont('KRB', 19)
    c.drawCentredString(cx, card_top - 40, m['word'])
    c.setFillColor(GREY)
    c.setFont('KRB', 9)
    c.drawCentredString(cx, card_top - 56, m['range'])
    _logo(c, cr - 12, card_top - 25)
    c.setFillColor(GREY)
    c.setFont('KR', 7.6)
    c.drawString(cl + 22, card_top - 16, m['stat'])

    if not fields:
        return

    # 날짜와 점수는 카드 안에 둔다. 선생님이 적는 자리다.
    _blank(c, cl + 22, card_top - 46, 118, '날짜', SKY, SKY)
    bx, bw, bh = cr - 12 - 96, 96, 26
    by = card_top - 62
    c.setStrokeColor(SKY)
    c.setLineWidth(1.1)
    c.roundRect(bx, by, bw, bh, 4, stroke=1, fill=0)
    c.setFillColor(SKY)
    c.setFont('KRB', 8)
    c.drawString(bx + 8, by + bh - 11, '점수')
    c.setFillColor(GREY)
    c.setFont('KR', 8.5)
    c.drawRightString(bx + bw - 8, by + 8, '/ 100')

    # 학생이 적는 칸은 파란 바탕 위에 흰 띠 두 줄로 나눈다.
    sy = card_top - card_h - 5
    for labs in (ROW1, ROW2):
        _strip(c, cl, sy - 19, cr - cl, 19, labs)
        sy -= 22


def _strip(c, x, y, w, h, labs):
    c.setFillColor(colors.white)
    c.roundRect(x, y, w, h, 5, stroke=0, fill=1)
    cw = w / len(labs)
    for k, lab in enumerate(labs):
        if k:
            c.setStrokeColor(TINT)
            c.setLineWidth(0.6)
            c.line(x + k * cw, y + 3, x + k * cw, y + h - 3)
        c.setFillColor(LABEL)
        c.setFont('KRB', 7.8)
        c.drawString(x + k * cw + 10, y + 6.5, lab)


# ── 고등학교: 흑백 줄표 ─────────────────────────────────────────

def _high(c, top, m, fields):
    pw = c._pagesize[0]
    x0, x1 = 34, pw - 34
    w = x1 - x0
    c.setStrokeColor(RULE)
    c.setLineWidth(0.9)

    if not fields:
        c.rect(x0, top - HIGH_PLAIN, w, HIGH_PLAIN, stroke=1, fill=0)
        c.setFillColor(RULE)
        c.setFont('KRB', 17)
        c.drawCentredString(pw / 2, top - 26, '%s %s' % (m['grade'], m['word']))
        c.setFillColor(colors.HexColor('#555555'))
        c.setFont('KR', 9)
        c.drawCentredString(pw / 2, top - 42, m['range'])
        c.drawRightString(x1 - 8, top - 13, m['stat'])
        return

    top_h, mid_h, bot_h = 42, 44, 24
    c.rect(x0, top - HIGH_FULL, w, HIGH_FULL, stroke=1, fill=0)
    c.line(x0, top - top_h, x1, top - top_h)
    c.line(x0, top - top_h - mid_h, x1, top - top_h - mid_h)

    lw1, lw3 = 150, 110                      # 왼쪽 칸과 오른쪽 칸의 폭
    ax, bx = x0 + lw1, x1 - lw3
    c.line(ax, top, ax, top - top_h)
    c.line(bx, top, bx, top - top_h)
    c.line(x0, top - 21, ax, top - 21)

    _blank(c, x0 + 8, top - 14, lw1 - 16, '실시일자', RULE, THIN, 8.4)
    c.setFillColor(colors.HexColor('#444444'))
    c.setFont('KR', 8)
    c.drawString(x0 + 8, top - 35, m['stat'])
    c.setFillColor(RULE)
    c.setFont('KRB', 18)
    c.drawCentredString((ax + bx) / 2, top - 27, m['grade'])
    _blank(c, bx + 8, top - 14, lw3 - 16, '이름', RULE, THIN, 8.4)
    c.setFillColor(RULE)
    c.setFont('KRB', 8.4)
    c.drawString(bx + 8, top - 33, '점수')
    c.setFillColor(GREY)
    c.setFont('KR', 8.5)
    c.drawRightString(x1 - 8, top - 33, '/ 100')

    ty = top - top_h
    c.setFillColor(RULE)
    c.setFont('KRB', 18)
    c.drawCentredString(pw / 2, ty - 25, m['word'])
    c.setFillColor(colors.HexColor('#555555'))
    c.setFont('KR', 9)
    c.drawCentredString(pw / 2, ty - 39, m['range'])

    by = ty - mid_h
    cw = w / len(HIROW)
    for k, lab in enumerate(HIROW):
        x = x0 + k * cw
        if k:
            c.setStrokeColor(RULE)
            c.setLineWidth(0.9)
            c.line(x, by, x, by - bot_h)
        _blank(c, x + 7, by - 15, cw - 15, lab, RULE, THIN, 8.2)


# ── 2쪽부터의 머리말 ──────────────────────────

def run_height(m):
    return HIGH_RUN if m['high'] else MID_RUN


def draw_run(c, top, m):
    """2쪽부터의 머리말. 예시 2쪽을 따랐다.

    중등은 둔근 파란 띠에 흰 글씨 한 줄, 고등은 두 줄과 귵은 가로줄이다.
    m['band'] 에 띠에 적을 글을 넣는다.
    """
    pw = c._pagesize[0]
    if m['high']:
        x0, x1 = 34, pw - 34
        c.setFillColor(RULE)
        c.setFont('KRB', 16)
        c.drawString(x0, top - 12, m['band'])
        c.setFillColor(GREY)
        c.setFont('KR', 10)
        c.drawString(x0, top - 29, m['range'])
        c.setStrokeColor(RULE)
        c.setLineWidth(1.0)
        c.line(x0, top - 46, x1, top - 46)
    else:
        x0, x1 = 23, pw - 23
        c.setFillColor(SKY)
        c.roundRect(x0, top - BAND_H, x1 - x0, BAND_H, 13, stroke=0, fill=1)
        c.setFillColor(colors.white)
        c.setFont('KRB', 12)
        c.drawString(x0 + 15, top - 18, m['band'])
        c.setFillColor(PALE)
        c.setFont('KR', 8.5)
        c.drawString(x0 + 15, top - 31, m['range'])
    return run_height(m)
