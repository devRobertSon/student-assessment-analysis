# -*- coding: utf-8 -*-
"""한 단원의 문항 풀을 그림째 한 벌로 찍는다. 선생님께 고르시라고 드리는 종이다.

    python poolsheet.py spec_h2.json "함수와 그래프" 21,25,28 <내보낼 폴더>

시험지에 이미 든 문항은 표시해 두고, 바꿀 자리마다 유형·난이도·형식이 맞아
그 자리에 그대로 넣을 수 있는 문항에 딱지를 붙인다. 교재 원문이 들어가므로
저장소에 넣지 않는다.
"""
import io
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

import 경로

HERE = os.path.dirname(os.path.abspath(__file__))
FONTDIR = os.path.join(HERE, '글꼴')
pdfmetrics.registerFont(TTFont('KR', os.path.join(FONTDIR, 'NotoSansKR-Regular.ttf')))
pdfmetrics.registerFont(TTFont('KRB', os.path.join(FONTDIR, 'NotoSansKR-Bold.ttf')))

PW, PH = A4
ML = MR = 34
MT, MB = 40, 40
GUTTER = 22
COLW = (PW - ML - MR - GUTTER) / 2
INNER = COLW - 9
TOPN = 26            # 1쪽 머리글은 안내 줄 수에 맞춰 잰다
LEAD = 12            # 안내 줄 간격
GAP = 16

NAVY = colors.HexColor('#16224e')
INK = colors.HexColor('#16181c')
GREY = colors.HexColor('#8a8f99')
HAIR = colors.HexColor('#e6e8ec')
USED = colors.HexColor('#c0392b')
FIT = colors.HexColor('#0F6E56')
NEAR = colors.HexColor('#6b7280')

# 분석 문서의 출처 이름과 문항 그림의 글자
LETTER = {'입학 심화형': 'A', '총괄 심화': 'B', '총괄 응용': 'C',
          '입학 일반형': 'D', '총괄 기본': 'E',
          '단원 TEST Ⅰ': 'F', '단원 TEST Ⅱ': 'G', '단원 TEST Ⅲ': 'H'}
FILES = {'1_도형의_방정식.md': '단원 TEST Ⅰ', '2_집합과_명제.md': '단원 TEST Ⅱ',
         '3_함수와_그래프.md': '단원 TEST Ⅲ', '4_입학_심화형.md': '입학 심화형',
         '5_총괄_심화.md': '총괄 심화', '6_총괄_응용.md': '총괄 응용',
         '7_입학_일반형.md': '입학 일반형', '8_총괄_기본.md': '총괄 기본'}
UNIT_OF = {'단원 TEST Ⅰ': '도형의 방정식', '단원 TEST Ⅱ': '집합과 명제',
           '단원 TEST Ⅲ': '함수와 그래프'}


def field(body, name):
    m = re.search(r'\*\*%s\*\*\s*(.*)' % name, body)
    return m.group(1).strip() if m else ''


def parse(path, src):
    out = []
    parts = re.split(r'\n## ', io.open(path, encoding='utf-8').read())
    for p in parts[1:]:
        head, body = p.split('\n', 1)
        head = head.strip()
        bits = head.split(' · ')
        # `단원Ⅰ-16 (주관식)` 처럼 형식이 제목 뒤에 붙기도 한다
        title = bits[0].replace('(주관식)', '').strip()
        unit = bits[1].replace('(주관식)', '').strip() if len(bits) > 1 else UNIT_OF[src]
        skel = re.search(r'\(뼈대:\s*(.*?)\)', body, re.S)
        out.append({
            'id': title,
            'no': int(re.search(r'(\d+)$', title).group(1)),
            'src': src,
            'unit': unit,
            'essay': '주관식' in head,
            'answer': field(body, '답'),
            'main': field(body, '주 유형'),
            'sub': field(body, '부 유형'),
            'level': field(body, '난이도'),
            'group': field(body, '묶음'),
            'skel': ' '.join(skel.group(1).split()) if skel else '',
        })
    return out


def load_pool(grade):
    adir = 경로.안('%s_문항분석' % grade)
    pool = []
    for f, src in FILES.items():
        p = os.path.join(adir, f)
        if os.path.exists(p):
            pool += parse(p, src)
    return pool


def img_of(grade, r):
    return 경로.안('문항', '%s_%s_%02d.png'
                  % (grade, LETTER[r['src']], r['no']))


def measure(r, grade):
    w, h = PILImage.open(img_of(grade, r)).size
    imgh = INNER * h / w
    return 30 + imgh + 11, imgh


def draw(c, r, x, y, grade, imgh, mark, fits, near, clash):
    """y 는 덩어리 위쪽. 아래로 그린다."""
    top = y
    col = USED if mark else (FIT if fits else (NEAR if near else NAVY))
    c.setFillColor(col)
    c.setFont('KRB', 8.6)
    c.drawString(x + 9, y - 10, '%s · %s' % (r['id'], r['group'] or '묶음 없음'))
    tag = mark or ' · '.join(['%d번 자리' % n for n in fits]
                            + ['%d번 자리(부 유형 다름)' % n for n in near])
    if tag:
        c.setFillColor(col)
        c.setFont('KRB', 7.4)
        c.drawRightString(x + COLW, y - 10, tag)
    c.setFillColor(GREY)
    c.setFont('KR', 7)
    c.drawString(x + 9, y - 21,
                 '%s · %s · %s · %s · %s%s'
                 % (r['src'], r['main'], r['sub'], r['level'],
                    '주관식' if r['essay'] else '객관식',
                    ' · 묶음 겹침' if clash else ''))
    y -= 30
    c.drawImage(img_of(grade, r), x + 9, y - imgh, width=INNER, height=imgh,
                mask='auto')
    y -= imgh
    c.setFillColor(INK)
    c.setFont('KR', 7.4)
    c.drawString(x + 9, y - 9, '답 %s' % r['answer'].replace('`', ''))
    # 왼쪽 세로선. 딱지가 붙은 문항만 굵고 진하게 해서 눈에 띄게 한다.
    c.setStrokeColor(col if (mark or fits) else colors.HexColor('#dfe3e9'))
    c.setLineWidth(1.6 if (mark or fits) else 0.7)
    c.line(x, top - 2, x, y - 11)
    return y - 11


def top1_of(m):
    """1쪽 머리글 높이. 안내 줄이 늘면 같이 늘어난다."""
    return 24 + LEAD * len(m['lines']) + 18


def head1(c, m):
    c.setFillColor(NAVY)
    c.setFont('KRB', 16)
    c.drawString(ML, PH - MT - 8, m['title'])
    c.setFillColor(GREY)
    c.setFont('KR', 8.6)
    y = PH - MT - 24
    for line in m['lines']:
        c.drawString(ML, y, line)
        y -= LEAD
    c.setStrokeColor(NAVY)
    c.setLineWidth(1.2)
    c.line(ML, y + 6, PW - MR, y + 6)


def headn(c, m):
    c.setFillColor(GREY)
    c.setFont('KR', 7.6)
    c.drawString(ML, PH - MT + 4, m['title'])
    c.setStrokeColor(HAIR)
    c.setLineWidth(0.5)
    c.line(ML, PH - MT - 2, PW - MR, PH - MT - 2)


def build(grade, unit, slots, spec, out, only=False):
    pool = [r for r in load_pool(grade) if r['unit'] == unit]
    pool.sort(key=lambda r: (list(LETTER).index(r['src']), r['no']))

    used = {}
    for i, q in enumerate(spec['questions'], 1):
        src = q['src'].replace('%s ' % grade, '')
        used[(src, int(q['srcno']))] = i

    want = {}
    for n in slots:
        q = spec['questions'][n - 1]
        want[n] = (q['type'], q.get('subType'), q['level'], q['essay'], q['points'])

    # 바뀌어 나갈 문항의 묶음은 겹침으로 세지 않는다. 그 자리가 비기 때문이다.
    taken_group = {r0['group'] for (s, no), i in used.items() if i not in slots
                   for r0 in pool if (r0['src'], r0['no']) == (s, no)}

    rows = []
    for r in pool:
        at = used.get((r['src'], r['no']))
        mark = ('지금 %d번' % at) if at else ''
        fits, near = [], []
        for n, w in want.items():
            if at is not None:
                continue
            if (r['level'], r['essay']) != (w[2], w[3]) or r['main'] != w[0]:
                continue
            (fits if r['sub'] == w[1] else near).append(n)
        rows.append((r, mark, fits, near))

    nused = sum(1 for r, m, f, nr in rows if m)
    npick = sum(1 for r, m, f, nr in rows if f or nr)
    if only:
        lines = ['자리마다 유형·난이도·형식이 맞는 문항만 모았습니다. '
                 '%s %s %d문항 가운데 %d개입니다.' % (grade, unit, len(rows), npick)]
    else:
        lines = ['%s %s 문항 %d개. 시험지에 든 %d개는 빨강으로 적어 두었습니다.'
                 % (grade, unit, len(rows), nused)]
    lines.append('')
    for n in slots:
        w = want[n]
        ok = [r['id'] for r, m, f, nr in rows if n in f]
        so = [r['id'] for r, m, f, nr in rows if n in nr]
        lines.append('%d번 자리 — %s · %s · %s · %s · %d점'
                     % (n, w[0], w[1], w[2], '주관식' if w[3] else '객관식', w[4]))
        lines.append('    그대로 바꿔 넣을 수 있는 문항  %s'
                     % (', '.join(ok) if ok else '없음'))
        lines.append('    부 유형만 다른 문항  %s'
                     % (', '.join(so) if so else '없음'))
    lines.append('')
    lines.append('초록 딱지는 그대로 넣을 수 있는 문항, 회색 딱지는 부 유형만 다른')
    if only:
        lines.append('문항입니다. 부 유형은 개수를 세는 데 쓰지 않아 어느 쪽이든 됩니다.')
        lines.append('열두 문항을 하나씩 넣어 구성 검사기를 돌려 보았고 걸리는 것이')
        lines.append('없었습니다. 고르신 번호만 알려 주시면 됩니다.')
    else:
        lines.append('문항입니다. 딱지가 없는 문항을 고르시면 유형이나 난이도가 달라져')
        lines.append('시험지 구성을 다시 맞춰야 합니다. 묶음이 이미 쓰인 문항에는 「묶음 겹침」')
        lines.append('을 적어 두었습니다. 고르신 번호만 알려 주시면 됩니다.')
    meta = {'title': '%s %s 문항 풀' % (grade, unit), 'lines': lines}

    if only:
        rows = [(r, m, f, nr) for r, m, f, nr in rows if f or nr]
        rows.sort(key=lambda z: (min(z[2] + z[3]), 0 if z[2] else 1, z[0]['id']))
        meta['title'] = '%s %s · %s번에 넣을 수 있는 문항' % (
            grade, unit, '·'.join(str(n) for n in slots))

    blocks = []
    seen_slot = None
    for r, m, f, nr in rows:
        if only:
            s = min(f + nr)
            if s != seen_slot:
                w = want[s]
                blocks.append(('head', '%d번 자리 · %s · %s · %s · %s · %d점'
                               % (s, w[0], w[1], w[2],
                                  '주관식' if w[3] else '객관식', w[4]),
                               None, None, None, 24, 0))
                seen_slot = s
        clash = bool(r['group']) and r['group'] in taken_group
        blocks.append((r, m, f, nr, clash) + measure(r, grade))
    # 왼단을 위에서 아래로 채우고 넘치면 오른단, 그다음 쪽으로 간다
    c = pdfcanvas.Canvas(out, pagesize=A4)
    c.setTitle(meta['title'])
    top1 = top1_of(meta)
    page, ci = 1, 0
    head1(c, meta)
    y = PH - MT - top1
    x = ML
    for r, mark, fits, near, clash, h, imgh in blocks:
        if y - h < MB:
            ci += 1
            if ci % 2 == 0:
                c.showPage()
                page += 1
                headn(c, meta)
            x = ML + (ci % 2) * (COLW + GUTTER)
            y = PH - MT - (top1 if page == 1 else TOPN)
        if r == 'head':
            c.setFillColor(NAVY)
            c.rect(x, y - 17, COLW, 17, stroke=0, fill=1)
            c.setFillColor(colors.white)
            c.setFont('KRB', 8.4)
            c.drawString(x + 8, y - 12.5, mark)
            y -= 24
            continue
        y = draw(c, r, x, y, grade, imgh, mark, fits, near, clash) - GAP
    c.showPage()
    c.save()
    return sum(1 for b in blocks if b[0] != 'head'), page


if __name__ == '__main__':
    specpath, unit, slots, outdir = sys.argv[1:5]
    only = len(sys.argv) > 5 and sys.argv[5] == 'only'
    spec = json.load(io.open(specpath, encoding='utf-8'))
    grade = spec['grade']
    slots = [int(s) for s in slots.split(',')]
    out = os.path.join(outdir, '%s_%s_%s.pdf' % (
        grade, unit.replace(' ', '_'), '바꿀수있는문항' if only else '문항풀'))
    n, pages = build(grade, unit, slots, spec, out, only)
    print('%s : %d문항 %d쪽' % (os.path.basename(out), n, pages))
