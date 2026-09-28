# -*- coding: utf-8 -*-
"""해설 조판 — A4 2단, 교사용.

규칙은 자료 폴더의 `조판규칙.md` 에 있다. 값을 고치면 거기도 함께 고친다.

문제지와 같은 판형이되 학생이 쓸 자리는 필요 없으므로 촘촘히 놓는다.
한 문항은 통째로 한 단에 들어가고, 남는 세로 공간은 항목 사이에 조금씩
나눠 단 아래에 구멍이 남지 않게 한다.
1쪽 맨 위에는 채점할 때 바로 쓰는 정답 일람표를 넣는다.
"""
import json
import os
import re
import sys

try:
    import mathtex
except Exception:                 # matplotlib 이 없는 곳에서도 돌아가야 한다
    mathtex = None

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfgen import canvas as pdfcanvas
from reportlab.platypus import Paragraph

import head

from paper import (ML, MR, MT, MB, PW, PH, GUTTER, COLW, INNER,
                   NAVY, MUTED, INK, HAIR, unit_colors)

# 단원 띠. 해설지에만 있다. 문제지에서는 2026-09-28 에 뺐다.
UNIT_H = 17

# 지수와 아래 첨자는 글자로 쓰지 않는다. 노토 산스 KR 에 위 첨자 0·5~9 와
# 아래 첨자가 없어 네모로 인쇄되기 때문이다. 스펙에 `2^3`, `a_1` 로 적고
# 여기서 올려·내려 그린다. 크기와 높이는 `조판규칙.md` 5번에 있다.
SUP_SIZE, SUP_RISE, SUB_RISE = 0.65, 0.32, 0.18

# 근호 덧줄. `mkfont.py` 가 `√` 의 윗막대를 떼어 냈으므로 근호 안 글자 위에
# 덧줄을 여기서 그린다. 높이와 두께는 갈고리 꼭대기(0.880 em)와 원래 막대
# 두께(0.041 em)에서 가져왔다.
ROOT_Y, ROOT_W = 0.86, 0.041
# 덧줄은 근호 안 글자보다 조금 더 나가야 교과서처럼 보인다. 줄바꿈이 일어나면
# 안 되므로 자리를 띄우는 데 줄 안 바뀌는 공백(U+00A0)을 쓴다. reportlab 은
# 이 글자에서 줄을 안 나눈다.
ROOT_PAD = ' '


def split_root(text):
    """`√` 뒤의 근호 안 글자를 갈라 [(글자, 덧줄 여부), ...] 로 돌려준다.

    `√(9 - x²)` 처럼 괄호로 묶은 것은 괄호를 떼고 덧줄로 바꾼다. 덧줄이
    괄호와 같은 일을 하므로 둘 다 두면 겹쳐 읽힌다.
    """
    out, buf, i = [], '', 0
    while i < len(text):
        ch = text[i]
        if ch != '√':
            buf += ch
            i += 1
            continue
        j = i + 1
        if j < len(text) and text[j] == '(':      # 괄호로 묶은 것
            depth, k = 0, j
            while k < len(text):
                if text[k] == '(':
                    depth += 1
                elif text[k] == ')':
                    depth -= 1
                    if depth == 0:
                        break
                k += 1
            if depth != 0:                         # 짝이 안 맞으면 손대지 않는다
                buf += ch
                i += 1
                continue
            inner, nxt = text[j + 1:k], k + 1
        else:                                      # 글자나 숫자가 이어진 만큼
            k = j
            while k < len(text) and (text[k].isalnum() or text[k] == '.'):
                k += 1
            if k == j:
                buf += ch
                i += 1
                continue
            inner, nxt = text[j:k], k
        out.append((buf + ch, False))
        out.append((inner + ROOT_PAD, True))
        buf, i = '', nxt
    if buf:
        out.append((buf, False))
    return out


def roots(text, base):
    """근호 안 글자를 덧줄 태그로 감싼다."""
    if '√' not in text:
        return text
    tag = '<u offset="%.2f" width="%.2f">' % (base * ROOT_Y, base * ROOT_W)
    return ''.join(tag + s + '</u>' if bar else s for s, bar in split_root(text))


def draw_math(c, x, y, text, font, size):
    """표처럼 문단을 안 쓰는 자리. 글자를 찍고 덧줄은 선으로 긋는다."""
    c.setLineWidth(size * ROOT_W)
    for s, bar in split_root(text):
        c.drawString(x, y, s)
        w = c.stringWidth(s, font, size)
        if bar:
            c.line(x, y + size * ROOT_Y, x + w, y + size * ROOT_Y)
        x += w
    return x


def math_width(c, text, font, size):
    return sum(c.stringWidth(s, font, size) for s, _ in split_root(text))


def marks(text, base):
    """`2^3` 을 올려 그린 지수로, `a_1` 을 내려 그린 아래 첨자로 바꾼다.

    `f^-1` 처럼 음의 부호가 붙은 것도 올려 그린다. 위 첨자 마이너스 글자가
    글꼴에 없어 역함수를 달리 적을 길이 없다.

    `2^(2a)` 처럼 괄호로 묶은 것도 받는다. 안 받으면 캐럿이 그대로 인쇄된다.
    2026년 9월 28일에 중2-1 6번에서 보고 고쳤다.
    """
    def pick(m):
        for g in m.groups():
            if g is not None:
                return g
        return ''

    text = re.sub(r'\^(?:\{([^}]*)\}|\(([^)]*)\)|(-?[0-9A-Za-z]+))',
                  lambda m: '<super rise="%.2f" size="%.2f">%s</super>'
                  % (base * SUP_RISE, base * SUP_SIZE, pick(m)), text)
    return re.sub(r'_(?:\{([^}]*)\}|\(([^)]*)\)|(-?[0-9A-Za-z]+))',
                  lambda m: '<sub rise="%.2f" size="%.2f">%s</sub>'
                  % (base * SUB_RISE, base * SUP_SIZE, pick(m)), text)


def head_line(q):
    """첫 줄. 부 유형으로 센 문항만 세는 유형을 앞에 붙인다."""
    counted = q.get('countAs') or q['type']
    kinds = q['type'] if counted == q['type'] else '%s · %s' % (counted, q['type'])
    return '%s · %s · %s %s번' % (kinds, q['level'], q['src'], q['srcno'])

HEAD_H = 17
GAP = 15              # 항목 사이 최소 간격
MAX_EXTRA = 30        # 남는 공간을 한 틈에 몰아줄 수 있는 상한
BOTTOM = 8
TABLE_H = 150         # 정답 일람표 — 6칸 5줄
HEAD_GAP = 20         # 머리말과 정답표 이름 사이

ST_META = ParagraphStyle('m', fontName='KR', fontSize=9.2, leading=13.2,
                         textColor=colors.HexColor('#8a8f99'))
ST_ANS = ParagraphStyle('a', fontName='KRB', fontSize=12.5, leading=17.6,
                        textColor=NAVY, leftIndent=7)
ST_STEP = ParagraphStyle('s', fontName='KR', fontSize=11, leading=16.8,
                         leftIndent=9, firstLineIndent=-9,
                         textColor=colors.HexColor('#16181c'), alignment=TA_LEFT)
ST_MISS = ParagraphStyle('x', fontName='KR', fontSize=10, leading=15.4,
                         textColor=colors.HexColor('#5f6470'))


def esc(t):
    return t.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')


# 수식을 쪼갤 자리. 등호나 부등호 뒤에서 끊으면 줄이 넘어갈 수 있다.
BREAK = re.compile(r'(?<=[=<>≤≥≠≒])\s+')


def _fit(src, base, bold, room):
    """수식 한 토막을 그림 태그로 바꾼다. 못 그리면 None."""
    pieces = [x for x in BREAK.split(src) if x.strip()] or [src]
    if len(pieces) > 1 and sum(len(x) for x in pieces) != len(src.replace(' ', '')) + 0:
        pass                                   # 쪼개다 글자가 사라지면 아래에서 걸린다
    out = []
    for piece in pieces:
        latex = mathtex.checked(piece)
        if not latex:
            return None
        try:
            png, w, h, d = mathtex.render(latex, base, bold)
        except Exception:
            return None
        if w > room:
            return None
        out.append('<img src="%s" width="%.2f" height="%.2f" valign="%.2f"/>'
                   % (png.replace('\\', '/'), w, h, -d))
    # 그림마다 좌우에 여백이 있어 따로 띄우지 않는다
    return ''.join(out)


손글씨기호 = [('<=', '≤'), ('>=', '≥'), ('!=', '≠')]


def 기호고침(text):
    """글로 적은 셈 기호를 인쇄 기호로 바꾼다.

    `<=` 는 글자 조판에서도 mathtex 에서도 그대로 두 글자로 인쇄된다. 스펙에
    `≤` 로 적는 것이 맞지만, 놓친 것이 있어도 여기서 걸러 준다.
    """
    for a, b in 손글씨기호:
        text = text.replace(a, b)
    return text


def mathed(text, base, bold=False, room=INNER):
    """백틱 안은 수식 그림으로, 밖은 지금까지 하던 글자 조판으로 만든다.

    **분수가 든 수식만 그림으로 그린다.** 분수는 위아래로 쌓아야 하는데 글자
    조판으로는 `21/2` 처럼 한 줄로 누울 수밖에 없다. 그 밖의 것은 글자 조판이
    더 낫다. mathtext 의 큰 근호가 노토에 없어 `√49` 의 갈고리와 덧줄이
    어긋나는데, 우리 `roots()` 는 그 자리를 정확히 맞춘다.

    **근호가 들어 있어도 분수가 있으면 그림으로 간다.** 2026년 9월 28일에
    근호가 깨지는 줄 알고 글자로 돌렸다가, 실제로 그려 보니 갈고리와 덧줄이
    제대로 맞물려 되돌렸다. mathtext 가 `\\__radicalbig__` 를 못 찾는다고
    적는 것은 경고일 뿐이고, 근호 한 벌을 늘려 그려 모양이 멀쩡하다.
    """
    text = 기호고침(text)
    if '`' not in text:
        return marks(roots(esc(text), base), base)
    out = []
    for n, part in enumerate(text.split('`')):
        if not part:
            continue
        if n % 2 == 0 or '/' not in part or mathtex is None:
            out.append(marks(roots(esc(part), base), base))
            continue
        got = _fit(part, base, bold, room)
        out.append(got if got else marks(roots(esc(part), base), base))
    return ''.join(out)


def col_height(i, top1, topn):
    return PH - MT - MB - (top1 if i < 2 else topn) - 14 - BOTTOM


def col_top(i, top1, topn):
    return PH - MT - (top1 if i < 2 else topn)


IMGH = re.compile(r'height="([0-9.]+)"')


def 벌린다(html, style):
    """수식 그림이 줄 높이를 넘으면 그 문단만 줄 간격을 늘린다.

    분수나 근호가 든 그림은 글자보다 키가 크다. 줄 간격을 그대로 두면 위아래
    줄과 붙어 보인다. 2026년 9월 28일에 공통수학2 28번에서 보고 고쳤다.
    """
    키 = [float(x) for x in IMGH.findall(html)]
    필요 = max(키) + 2 if 키 else 0
    if 필요 <= style.leading:
        return style
    return ParagraphStyle(style.name + '+', parent=style, leading=필요)


def make(no, q, ink, new_unit):
    """한 문항의 조각들과 전체 높이."""
    parts = []
    h = UNIT_H if new_unit else 0
    h += HEAD_H
    for style, text, base in (
            (ST_META, head_line(q), 9.2),
            (ST_ANS, '정답 &nbsp;%s' % mathed(q['answer'], 12.5, True), 12.5)):
        글 = mathed(text, base) if style is ST_META else text
        p = Paragraph(글, 벌린다(글, style))
        ph = p.wrap(INNER, 10000)[1]
        parts.append((p, ph, 3 if style is ST_META else 4))
        h += ph + (3 if style is ST_META else 4)
    for s in q['steps']:
        글 = '· ' + mathed(s, 11)
        p = Paragraph(글, 벌린다(글, ST_STEP))
        ph = p.wrap(INNER, 10000)[1]
        parts.append((p, ph, 0))
        h += ph
    글 = ('<font name="KRB" color="%s">틀렸다면</font> &nbsp;%s'
          % (ink, mathed(q['miss'], 10)))
    p = Paragraph(글, 벌린다(글, ST_MISS))
    ph = p.wrap(INNER, 10000)[1]
    parts.append((p, ph, 5))
    h += ph + 5
    return parts, h


def pack(qs, ucol, top1, topn):
    cols, cur, used, seen = [], [], 0.0, None
    for i, q in enumerate(qs, 1):
        new_unit = q['unit'] != seen
        parts, h = make(i, q, ucol[q['unit']][1], new_unit)
        ch = col_height(len(cols), top1, topn)
        need = h + (GAP if cur else 0)
        if cur and used + need > ch:
            cols.append(cur)
            cur, used = [], 0.0
            need = h
        cur.append({'no': i, 'q': q, 'parts': parts, 'h': h, 'unit': new_unit})
        used += need
        seen = q['unit']
    if cur:
        cols.append(cur)
    return cols


def draw_entry(c, b, x, y, ucol):
    q, (bar, ink) = b['q'], ucol
    top = y
    if b['unit']:
        c.setFillColor(colors.HexColor(bar))
        c.roundRect(x, y - 10, 11, 2.8, 1.4, stroke=0, fill=1)
        c.setFillColor(colors.HexColor(ink))
        c.setFont('KRB', 10.5)
        c.drawString(x + 15, y - 11.5, q['unit'])
        y -= UNIT_H

    body_top = y
    tx = x + 9
    c.setFillColor(colors.HexColor(ink))
    c.setFont('KRB', 15)
    c.drawString(tx, y - 11.5, str(b['no']))
    if q['essay']:
        w = c.stringWidth(str(b['no']), 'KRB', 15)
        c.setFillColor(colors.HexColor('#eef1f7'))
        c.roundRect(tx + w + 5, y - 12.5, 31, 12.5, 2.5, stroke=0, fill=1)
        c.setFillColor(colors.HexColor(ink))
        c.setFont('KRB', 8.4)
        c.drawString(tx + w + 9, y - 9.3, '주관식')
    c.setFillColor(INK)
    c.setFont('KRB', 10)
    c.drawRightString(x + COLW, y - 11, '%d점' % q['points'])
    y -= HEAD_H

    for k, (p, ph, after) in enumerate(b['parts']):
        if k == 1:                      # 정답 줄 왼쪽에 굵은 표시
            c.setStrokeColor(colors.HexColor(bar))
            c.setLineWidth(2)
            c.line(tx + 1, y - 1, tx + 1, y - ph + 1)
        p.drawOn(c, tx, y - ph)
        y -= ph + after

    c.setStrokeColor(colors.HexColor(bar))
    c.setLineWidth(1.6)
    c.line(x, body_top - 1, x, y)
    return top - b['h']


def draw_table(c, qs, ucol, y0):
    """1쪽 머리말 아래 정답 일람표."""
    x0 = ML
    w = PW - ML - MR
    # 10칸 3줄은 한 칸이 53pt라 글자를 키울 수 없었다. 6칸 5줄로 넓혀
    # 채점하며 훑을 수 있는 크기로 만든다.
    cols, rows = 6, 5
    cw, rh = w / cols, 26.0
    c.setFillColor(colors.HexColor('#8a8f99'))
    c.setFont('KRB', 9)
    c.drawString(x0, y0 + 6, '정답 한눈에 보기')
    c.setStrokeColor(HAIR)
    c.setLineWidth(0.5)
    for r in range(rows):
        for k in range(cols):
            i = r * cols + k
            if i >= len(qs):
                continue
            cx, cy = x0 + k * cw, y0 - (r + 1) * rh
            c.setFillColor(colors.HexColor('#fafbfc') if r % 2 == 0 else colors.white)
            c.rect(cx, cy, cw, rh, stroke=0, fill=1)
            c.setFillColor(colors.HexColor(ucol[qs[i]['unit']][1]))
            c.setFont('KRB', 10)
            c.drawString(cx + 6, cy + 8.5, '%d' % (i + 1))
            c.setFillColor(colors.HexColor('#16181c'))
            c.setFont('KRB', 12.5)
            # 객관식은 번호만으로 충분하고, 그 밖의 답은 넘치면 말줄임을 쓴다
            a = qs[i]['answer'].replace('`', '')
            circled = ''.join(ch for ch in a if ch in '①②③④⑤')
            if circled:
                a = circled
            elif math_width(c, a, 'KRB', 12.5) > cw - 34:
                while math_width(c, a + '…', 'KRB', 12.5) > cw - 34 and len(a) > 1:
                    a = a[:-1]
                a += '…'
            draw_math(c, cx + 32, cy + 8, a, 'KRB', 12.5)
    c.setStrokeColor(HAIR)
    c.rect(x0, y0 - rows * rh, w, rows * rh, stroke=1, fill=0)


def draw_chrome(c, n, total, meta, qs, ucol, top1, topn):
    if n == 1:
        h = head.draw(c, PH - MT, meta, fields=False)
        draw_table(c, qs, ucol, PH - MT - h - HEAD_GAP)
    else:
        head.draw_run(c, PH - MT, meta)

    c.setStrokeColor(HAIR)
    c.setLineWidth(0.5)
    c.line(PW / 2, MB + 12, PW / 2, PH - MT - ((top1 if n == 1 else topn) - 6))

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
        'name': '%s 해설' % spec['title'],
        'grade': grade,
        'word': '%s 해설' % (spec['title'][len(grade):].strip() or '진단평가'),
        'range': '%s ~ %s' % (units[0], units[-1]),
        'stat': '%d문제 · %d점 · 교사용' % (len(qs), sum(q['points'] for q in qs)),
        'high': not grade.startswith('중'),
        # 2쪽부터 머리말에 적는 글. 중등은 파란 띠 안, 고등은 첫 줄이다.
        'band': ('%s %s 해설' if not grade.startswith('중') else '%sㅣ%s 해설')
                % (grade, spec['title'][len(grade):].strip() or '진단평가'),
        'foot': '알파학원 교육연구소 · 교사용',
    }
    top1 = head.height(meta, fields=False) + HEAD_GAP + TABLE_H
    topn = head.run_height(meta)
    cols = pack(qs, ucol, top1, topn)
    pages = (len(cols) + 1) // 2

    c = pdfcanvas.Canvas(path, pagesize=A4)
    c.setTitle(spec['title'] + ' 해설')
    for ci, blocks in enumerate(cols):
        if ci % 2 == 0:
            if ci:
                c.showPage()
            draw_chrome(c, ci // 2 + 1, pages, meta, qs, ucol, top1, topn)
        x = ML + (ci % 2) * (COLW + GUTTER)
        ch = col_height(ci, top1, topn)
        body = sum(b['h'] for b in blocks)
        g = len(blocks) - 1
        extra = min(MAX_EXTRA, max(0.0, (ch - body - GAP * g) / g)) if g else 0
        y = col_top(ci, top1, topn)
        for k, b in enumerate(blocks):
            y = draw_entry(c, b, x, y, ucol[b['q']['unit']])
            if k < g:
                y -= GAP + extra
    c.showPage()
    c.save()
    return pages


if __name__ == '__main__':
    spec = json.load(open(sys.argv[1], encoding='utf-8'))
    out = os.path.join(sys.argv[2], spec['title'].replace(' ', '_') + '_해설.pdf')
    print('%s : %d쪽' % (os.path.basename(out), build(spec, out)))
