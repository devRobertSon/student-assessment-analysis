# -*- coding: utf-8 -*-
"""문제지 조판 — A4 2단, 단원 색 구분형.

규칙은 자료 폴더의 `조판규칙.md` 에 있다. 값을 고치면 거기도 함께 고친다.

문항은 절대 줄이지 않는다. 원본 크기로 단 폭에 맞춰 놓고,
단에 안 들어가면 통째로 다음 단·다음 쪽으로 넘긴다.
그러고 남는 세로 공간은 문항 사이에 고르게 나눠 학생이 풀 자리로 쓴다.
"""
import json
import os
import re
import sys

from PIL import Image as PILImage
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas as pdfcanvas

import head
import 경로

FONTDIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '글꼴')
REG = os.path.join(FONTDIR, 'NotoSansKR-Regular.ttf')
BOLD = os.path.join(FONTDIR, 'NotoSansKR-Bold.ttf')
for _p in (REG, BOLD):
    if not os.path.exists(_p):
        raise SystemExit('글꼴이 없다: %s. mkfont.py 를 먼저 돌려라.' % _p)
pdfmetrics.registerFont(TTFont('KR', REG))
pdfmetrics.registerFont(TTFont('KRB', BOLD))

PW, PH = A4
ML = MR = 34
MT, MB = 40, 44
GUTTER = 22
COLW = (PW - ML - MR - GUTTER) / 2
INNER = COLW - 9              # 색 세로선 오른쪽의 실제 문항 폭
HEAD_H = 16                   # 번호·배점 줄
PER_COL = 2                   # 한 단에 두 문항. 한 쪽은 두 단이라 네 문항이다
ANSBOX = 24                   # 주관식 정답칸. 풀이는 그 아래 빈 자리에 쓴다
FORM_SIZE = 9                 # 정답칸에 미리 찍는 단위·기호
FORM_SLANT = 12               # 그 안의 영문자를 기울이는 각도
MIN_GAP = 40                  # 문항 사이 최소 간격
BOTTOM_GAP = 0                # 남는 자리는 아래에서 문항마다 똑같이 나눈다
HEAD_GAP = 7                  # 머리말과 첫 문항 사이. 1쪽과 뒤쪽이 같다

NAVY = colors.HexColor('#16224e')
MUTED = colors.HexColor('#b6bac4')
# 배점은 학생이 봐야 하는 값이라 흐리게 두지 않는다.
INK = colors.HexColor('#16181c')
HAIR = colors.HexColor('#e6e8ec')
RAMPS = [('#378ADD', '#185FA5'), ('#1D9E75', '#0F6E56'), ('#7F77DD', '#534AB7'),
         ('#D85A30', '#993C1D'), ('#BA7517', '#854F0B'), ('#D4537E', '#993556')]
GRAY = ('#9a9a94', '#5F5E5A')


def unit_colors(units):
    out, k = {}, 0
    for u in units:
        if '복습' in u:
            out[u] = GRAY
        else:
            out[u] = RAMPS[k % len(RAMPS)]
            k += 1
    return out


def col_height(idx, top1, topn):
    """idx번째 단의 높이. 0·1번 단은 1쪽이라 머리말이 커서 짧다."""
    return PH - MT - MB - (top1 if idx < 2 else topn) - 14


def col_top(idx, top1, topn):
    return PH - MT - (top1 if idx < 2 else topn)


def measure(q):
    """문항 한 덩어리의 높이. 그림은 단 폭에 맞춘 원래 비율 그대로다."""
    w, h = PILImage.open(경로.그림(q['img'])).size
    imgh = INNER * h / w
    total = HEAD_H + 3 + imgh
    if q['essay']:
        total += 5 + ANSBOX
    return total, imgh


def pack(qs):
    """문항을 두 개씩 한 단에 담는다. 한 쪽에 네 문항이 된다.

    담을 만큼만 담던 예전 방식은 쪽마다 문항 수가 들쭉날쭉했다. 이제는 자리를
    먼저 정하고 그 안에 맞춘다. 칸보다 큰 문항은 그림을 줄여 넣는다.
    """
    cols = []
    for i, q in enumerate(qs, 1):
        if (i - 1) % PER_COL == 0:
            cols.append([])
        h, imgh = measure(q)
        cols[-1].append({'no': i, 'q': q, 'h': h, 'imgh': imgh})
    # 마지막 쪽에 두 문항만 남으면 한 단에 하나씩 놓아 좌우를 맞춘다.
    if len(cols) % 2 == 1 and len(cols[-1]) == 2:
        last = cols.pop()
        cols += [[last[0]], [last[1]]]
    return cols


def draw_form(c, form, x0, x1, base):
    """정답칸에 단위와 기호를 미리 찍는다. 학생은 `{}` 자리에 숫자만 쓴다.

    `{}개` 는 칸 오른쪽 끝에 '개' 를 찍는다. `{} ≤ a ≤ {}` 는 가운데에
    '≤ a ≤' 를 찍고 양쪽을 비운다. 빈자리는 남는 폭을 똑같이 나눈다.
    2026년 10월 3일에 원장님이 정했다.

    영문자는 기울여 찍는다. 문항 그림의 `a` 가 수식 글자라 기울어 있어서,
    똑바로 세우면 다른 글자로 보인다. 노토에 기울인 글꼴이 없어 눕혀 그린다.
    """
    parts = form.split('{}')
    c.setFillColor(INK)
    c.setFont('KR', FORM_SIZE)
    used = sum(c.stringWidth(p, 'KR', FORM_SIZE) for p in parts)
    blank = (x1 - x0 - used) / max(len(parts) - 1, 1)
    x = x0
    for k, p in enumerate(parts):
        for run in re.findall(r'[A-Za-z]+|[^A-Za-z]+', p):
            if run[0].isascii() and run[0].isalpha():
                c.saveState()
                c.translate(x, base)
                c.skew(0, FORM_SLANT)
                c.drawString(0, 0, run)
                c.restoreState()
            else:
                c.drawString(x, base, run)
            x += c.stringWidth(run, 'KR', FORM_SIZE)
        if k < len(parts) - 1:
            x += blank


def draw_block(c, b, x, y, ucol):
    """y는 덩어리의 위쪽 좌표. 아래로 그려 내려간다.

    단원 이름은 적지 않는다. 단원은 번호·세로선·정답칸의 색으로만 나눈다.
    2026년 9월 28일에 수학 선생님 말씀을 듣고 원장님이 정했다.
    """
    q = b['q']
    bar, ink = ucol
    top = y

    body_top = y
    tx = x + 9
    # 번호는 옆 세로선·단원 띠와 같은 색이다. 단원이 눈으로 이어진다.
    c.setFillColor(colors.HexColor(bar))
    c.setFont('KRB', 12)
    c.drawString(tx, y - 11, str(b['no']))
    if q['essay']:
        w = c.stringWidth(str(b['no']), 'KRB', 12)
        c.setFillColor(colors.HexColor('#eef1f7'))
        c.roundRect(tx + w + 5, y - 12, 27, 11, 2.5, stroke=0, fill=1)
        c.setFillColor(colors.HexColor(ink))
        c.setFont('KRB', 6.2)
        c.drawString(tx + w + 8.5, y - 9.2, '주관식')
    c.setFillColor(INK)
    c.setFont('KRB', 7.2)
    c.drawRightString(x + COLW, y - 10.5, '%d점' % q['points'])
    y -= HEAD_H + 3

    c.drawImage(경로.그림(q['img']), tx, y - b['imgh'], width=INNER, height=b['imgh'],
                mask='auto')
    y -= b['imgh']

    if q['essay']:
        # 정답만 적는 칸이다. 풀이는 아래 빈 자리에 자유롭게 쓴다.
        y -= 5
        c.setStrokeColor(colors.HexColor(bar))
        c.setLineWidth(0.7)
        c.roundRect(tx, y - ANSBOX, INNER, ANSBOX, 3, stroke=1, fill=0)
        c.setFillColor(colors.HexColor(ink))
        c.setFont('KRB', 6.4)
        c.drawString(tx + 7, y - 15, '정답')
        if q.get('ansForm'):
            draw_form(c, q['ansForm'], tx + 7 + c.stringWidth('정답', 'KRB', 6.4) + 10,
                      tx + INNER - 10, y - 15.5)
        y -= ANSBOX

    c.setStrokeColor(colors.HexColor(bar))
    c.setLineWidth(1.6)
    c.line(x, body_top - 1, x, y)
    return top - b['h']


def draw_chrome(c, n, total, meta, top1, topn):
    if n == 1:
        head.draw(c, PH - MT, meta)
    else:
        head.draw_run(c, PH - MT, meta)

    c.setStrokeColor(HAIR)
    c.setLineWidth(0.5)
    c.line(PW / 2, MB + 16, PW / 2, PH - MT - ((top1 if n == 1 else topn) - 4))

    # 꼬리글은 가운데 쪽 번호 하나다.
    c.setFillColor(colors.HexColor('#8a8f99'))
    c.setFont('KR', 10)
    c.drawCentredString(PW / 2, MB - 14, '%d / %d' % (n, total))


def build(spec, path):
    qs = spec['questions']
    units = list(dict.fromkeys(q['unit'] for q in qs))
    ucol = unit_colors(units)
    grade = spec['grade']
    meta = {
        'name': spec['title'],
        'grade': grade,
        'word': spec['title'][len(grade):].strip() or '진단평가',
        'range': '%s ~ %s' % (units[0], units[-1]),
        'stat': '%d문제 · %d점' % (len(qs), sum(q['points'] for q in qs)),
        'high': not grade.startswith('중'),
        # 2쪽부터 머리말에 적는 글. 중등은 파란 띠 안, 고등은 첫 줄이다.
        'band': ('%s %s' if not grade.startswith('중') else '%sㅣ%s')
                % (grade, spec['title'][len(grade):].strip() or '진단평가'),
        'foot': '알파학원 교육연구소',
    }
    top1 = head.height(meta) + HEAD_GAP
    topn = head.run_height(meta)
    cols = pack(qs)
    pages = (len(cols) + 1) // 2

    c = pdfcanvas.Canvas(path, pagesize=A4)
    c.setTitle(spec['title'])
    for ci, blocks in enumerate(cols):
        page = ci // 2
        if ci % 2 == 0:
            if ci:
                c.showPage()
            draw_chrome(c, page + 1, pages, meta, top1, topn)
        x = ML + (ci % 2) * (COLW + GUTTER)
        ch = col_height(ci, top1, topn)
        # 칸보다 큰 문항은 그림을 줄여 넣는다
        for b in blocks:
            if b['h'] > ch / PER_COL:
                b['imgh'] -= b['h'] - ch / PER_COL
                b['h'] = ch / PER_COL
        # 단을 문항 수만큼 똑같이 나누고 각 문항을 제 칸 맨 위에 놓는다.
        # 남는 자리는 그 문항 아래에 그대로 남아 푸는 자리가 된다.
        slot = ch / PER_COL
        top = col_top(ci, top1, topn)
        for k, blk in enumerate(blocks):
            draw_block(c, blk, x, top - k * slot, ucol[blk['q']['unit']])
    c.showPage()
    c.save()
    return pages


if __name__ == '__main__':
    spec = json.load(open(sys.argv[1], encoding='utf-8'))
    out = os.path.join(sys.argv[2], spec['title'].replace(' ', '_') + '_문제지.pdf')
    print('%s : %d쪽' % (os.path.basename(out), build(spec, out)))
