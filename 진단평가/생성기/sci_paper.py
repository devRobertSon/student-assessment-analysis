# -*- coding: utf-8 -*-
"""과학 영재성평가 문제지와 정답·채점 기준을 뽑는다.

    python sci_paper.py <spec.json>

spec.json 옆에 세 파일을 만든다.

    <학년>_과학_영재성평가_문제지.pdf     학생에게 나눠 주는 것
    <학년>_과학_영재성평가_정답.pdf       정답과 세 칸 채점 기준, 유형·난이도
    <학년>_과학_영재성평가_시험지.csv     앱에 올리는 시험지
    <학년>_과학_영재성평가_출제표.csv     소문항마다 단원·유형·난이도·배점·답을 적은 표

이름 앞부분이 앱의 시험지 이름과 같아야 사이트 자료 목록에서 한 묶음으로 모인다
(app/scripts/papers-manifest.mjs).

문제 글은 spec.json 에만 있다. spec.json 은 교재에서 고쳐 쓴 문제라 저장소 밖
(`원본/과학/`)에 두고, 이 스크립트만 저장소에 들어간다.

## 대문항 하나를 한 쪽에

문제지는 대문항마다 새 쪽에서 시작한다. 쪽이 남으면 답 칸을 1.5 배까지 키우고,
한 쪽에 들어가지 않으면 답 칸과 그림을 조금씩 줄여 다시 재 본다. 들어가는 가장
큰 크기를 쓴다. 가장 작게 줄여도 넘치면 다음 쪽으로 넘기되 소문항은 쪼개지 않는다.
뽑을 때 대문항마다 쓴 비율을 찍는다.

## spec 의 꼴

    grade, word, range, minutes, notice
    items[]  no, title, unit, stem[], parts[]
    stem 한 칸  {"p": 글} {"list": [줄…]} {"box": [줄…]} {"table": [[칸…]…]}
               {"figs": [[파일, 폭mm]…]}
               {"row": [[폭mm, [칸…]], …]}   여러 칸을 옆으로 나란히
    parts[]  text, pts, box(답 칸 높이 mm, 0 이면 칸 없음), note(글 또는 글 목록), table,
             fig, boxfig, side, type, level, answer, full, half, zero
             side 가 참이면 fig 를 답 칸 오른쪽에 둔다.
그림 파일은 spec 옆 `그림/` 에서 찾는다.
"""
import csv
import io
import json
import os
import sys
from xml.sax.saxutils import escape

from PIL import Image as PILImage
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (BaseDocTemplate, Flowable, Frame, Image, KeepTogether,
                                PageBreak, PageTemplate, Paragraph, Spacer, Table, TableStyle)

import head

HERE = os.path.dirname(os.path.abspath(__file__))
FONTDIR = os.path.join(HERE, '글꼴')
for 이름, 파일 in [('KR', 'NotoSansKR-Regular.ttf'), ('KRB', 'NotoSansKR-Bold.ttf')]:
    p = os.path.join(FONTDIR, 파일)
    if not os.path.exists(p):
        raise SystemExit('글꼴이 없다: %s. mkfont.py 를 먼저 돌려라.' % p)
    pdfmetrics.registerFont(TTFont(이름, p))
pdfmetrics.registerFontFamily('KR', normal='KR', bold='KRB', italic='KR', boldItalic='KRB')

PW, PH = A4
ML = MR = 40
MT, MB = 40, 48
W = PW - ML - MR
MIN_BOX = 16 * mm                     # 답 칸을 줄여도 이보다 낮게 하지 않는다

# 맞추는 차례. (그림 비율, 답 칸 비율) 를 앞에서부터 해 보고 들어가면 멈춘다.
# 쪽이 남으면 답 칸을 1.5 배까지 키우고, 모자라면 그림과 답 칸을 함께 줄인다.
STEPS = [(1.0, 1.5), (1.0, 1.4), (1.0, 1.3), (1.0, 1.2), (1.0, 1.1),
         (1.0, 1.0), (1.0, 0.9), (0.95, 0.85), (0.9, 0.8), (0.9, 0.72), (0.85, 0.66),
         (0.8, 0.6), (0.75, 0.55), (0.7, 0.5)]

INK = colors.HexColor('#16181c')
NAVY = colors.HexColor('#16224e')
MUTE = colors.HexColor('#6b6f78')
LINE = colors.HexColor('#9aa0aa')
TINT = colors.HexColor('#eef5fb')

S_BODY = ParagraphStyle('body', fontName='KR', fontSize=10, leading=15, textColor=INK)
S_PART = ParagraphStyle('part', parent=S_BODY, leftIndent=18, firstLineIndent=-18)
S_NOTE = ParagraphStyle('note', parent=S_BODY, fontSize=9.5, leading=14, leftIndent=18)
S_LIST = ParagraphStyle('list', parent=S_BODY, fontSize=9.5, leading=14)
S_CELL = ParagraphStyle('cell', parent=S_BODY, fontSize=9.5, leading=12.5, alignment=1)
S_CELLL = ParagraphStyle('celll', parent=S_CELL, alignment=0)
S_HEAD = ParagraphStyle('head', fontName='KRB', fontSize=12.5, leading=17, textColor=NAVY)
S_SMALL = ParagraphStyle('small', parent=S_BODY, fontSize=9, leading=13, textColor=MUTE)
NO_PAD = [('LEFTPADDING', (0, 0), (-1, -1), 0), ('RIGHTPADDING', (0, 0), (-1, -1), 0),
          ('TOPPADDING', (0, 0), (-1, -1), 0), ('BOTTOMPADDING', (0, 0), (-1, -1), 0)]


SUB = {chr(0x2080 + i): str(i) for i in range(10)}   # 글꼴에 ₀~₉ 가 없어 <sub> 로 쓴다


def t(s):
    """본문 글을 Paragraph 가 읽는 꼴로 바꾼다."""
    s = escape(s)
    for ch, d in SUB.items():
        s = s.replace(ch, '<sub>%s</sub>' % d)
    return s


def picture(folder, name, width_pt):
    path = os.path.join(folder, name)
    if not os.path.exists(path):
        raise SystemExit('그림이 없다: %s' % path)
    w, h = PILImage.open(path).size
    return Image(path, width=width_pt, height=width_pt * h / float(w))


SLOT_MIN = 10 * mm                    # 번호 칸 하나의 가장 낮은 높이


def slot_list(slots):
    """spec 의 slots 를 (이름, 높이 비율) 목록으로. 이름만 쓰면 비율은 1 이다."""
    return [(s, 1.0) if isinstance(s, str) else (s[0], float(s[1])) for s in (slots or [])]


class AnswerBox(Flowable):
    """답을 쓰는 둥근 칸. 안에 그림을 가운데 둘 수 있다. slots 를 주면 칸을 가로로 나누고
    왼쪽에 소문항 속 물음의 번호나 적을 것을 적어, 학생이 물음마다 답을 따로 쓰게 한다."""

    def __init__(self, width, height, pic=None, slots=None):
        Flowable.__init__(self)
        self.width, self.height, self.pic = width, height, pic
        self.slots = slot_list(slots)

    def wrap(self, aw, ah):
        return self.width, self.height

    def draw(self):
        c = self.canv
        if self.slots:
            lw = max(pdfmetrics.stringWidth(n, 'KRB', 9) for n, _ in self.slots) + 12
            c.saveState()
            path = c.beginPath()
            path.roundRect(0, 0, self.width, self.height, 4)
            c.clipPath(path, stroke=0, fill=0)
            c.setFillColor(TINT)
            c.rect(0, 0, lw, self.height, stroke=0, fill=1)
            c.restoreState()
            c.setStrokeColor(LINE)
            c.setLineWidth(0.5)
            c.line(lw, 0, lw, self.height)
            total = sum(w for _, w in self.slots)
            y = self.height
            for i, (name, w) in enumerate(self.slots):
                h = self.height * w / total
                c.setFillColor(INK)
                c.setFont('KRB', 9)
                c.drawString(6, y - 13, name)
                if i < len(self.slots) - 1:
                    c.line(0, y - h, self.width, y - h)
                y -= h
        c.setStrokeColor(LINE)
        c.setLineWidth(0.7)
        c.roundRect(0, 0, self.width, self.height, 4, stroke=1, fill=0)
        if self.pic is not None:
            pw, ph = self.pic.drawWidth, self.pic.drawHeight
            self.pic.drawOn(c, (self.width - pw) / 2, (self.height - ph) / 2)


WRAPPED = []   # 자리가 모자라 글이 꺾인 표. main 이 알려 준다.


def col_widths(table, width):
    """표 칸 너비. 글이 한 줄에 들어가는 너비를 먼저 주고, 자리가 남으면 칸마다
    고르게 넓힌다. 자리가 모자라면 짧은 칸은 그대로 두고 긴 칸끼리 남은 자리를 나눈다."""
    n = len(table[0])
    need = [max(pdfmetrics.stringWidth(str(r[j]), 'KR', S_CELL.fontSize) for r in table) + 14
            for j in range(n)]
    room = width - 8
    if sum(need) <= room:
        base = min(room, 60 + 70 * (n - 1))   # 너무 좁은 표를 만들지 않는다
        extra = max(0, base - sum(need)) / n
        return [w + extra for w in need]
    WRAPPED.append(table[0][0])
    out, left, k = [0] * n, room, n
    for j in sorted(range(n), key=lambda j: need[j]):
        out[j] = min(need[j], left / k)
        left -= out[j]
        k -= 1
    return out


def stem_flow(block, figdir, width, fs):
    """제시문 한 칸을 width 안에 들어가게 만든다. fs 는 그림 비율."""
    if 'p' in block:
        return [Paragraph(t(block['p']), S_BODY)]
    if 'list' in block:
        return [Paragraph(t(line), S_LIST) for line in block['list']]
    if 'box' in block:
        rows = [[Paragraph(t(line), S_CELLL)] for line in block['box']]
        tb = Table(rows, colWidths=[width - 30])
        # 줄과 줄 사이에 칸 여백을 두지 않아, 한 줄이 두 줄로 꺾여도 줄 간격이 같다.
        tb.setStyle(TableStyle([
            ('BOX', (0, 0), (-1, -1), 0.7, LINE),
            ('BACKGROUND', (0, 0), (-1, -1), TINT),
            ('LEFTPADDING', (0, 0), (-1, -1), 10),
            ('TOPPADDING', (0, 0), (-1, -1), 0),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
            ('TOPPADDING', (0, 0), (-1, 0), 4),
            ('BOTTOMPADDING', (0, -1), (-1, -1), 5),
        ]))
        return [tb]
    if 'table' in block:
        rows = [[Paragraph(t(c), S_CELL) for c in r] for r in block['table']]
        tb = Table(rows, colWidths=col_widths(block['table'], width))
        tb.setStyle(TableStyle([
            ('GRID', (0, 0), (-1, -1), 0.6, LINE),
            ('BACKGROUND', (0, 0), (-1, 0), TINT),
            ('BACKGROUND', (0, 0), (0, -1), TINT),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 0), (-1, -1), 2),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ]))
        return [tb]
    if 'figs' in block:
        gap = 16
        want = [w * mm * fs for _, w in block['figs']]
        k = min(1.0, (width - gap * len(want)) / sum(want))
        pics = [picture(figdir, f, w * k) for (f, _), w in zip(block['figs'], want)]
        if len(pics) == 1:
            return [pics[0]]
        tb = Table([pics], colWidths=[p.drawWidth + gap for p in pics])
        tb.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'BOTTOM'),
                                ('ALIGN', (0, 0), (-1, -1), 'CENTER')] + NO_PAD))
        return [tb]
    if 'row' in block:
        cells, widths = [], []
        for w_mm, subs in block['row']:
            cw = w_mm * mm
            flows = []
            for b in subs:
                flows += stem_flow(b, figdir, cw - 8, fs) + [Spacer(1, 4)]
            cells.append(flows)
            widths.append(cw)
        tb = Table([cells], colWidths=widths)
        tb.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP'),
                                ('ALIGN', (0, 0), (-1, -1), 'CENTER')] + NO_PAD))
        return [tb]
    raise SystemExit('모르는 제시문 칸: %r' % block)


def item_parts(it, figdir, fs, bs):
    """머리와 제시문, 소문항 목록을 따로 돌려준다."""
    total = sum(p['pts'] for p in it['parts'])
    headrow = Table([[Paragraph('%d.&nbsp;&nbsp;%s' % (it['no'], t(it['title'])), S_HEAD),
                      Paragraph('[%d점]' % total, ParagraphStyle('r', parent=S_HEAD, alignment=2,
                                                                 textColor=INK, fontSize=10.5))]],
                    colWidths=[W - 60, 60])
    headrow.setStyle(TableStyle([
        ('LINEBELOW', (0, 0), (-1, 0), 1.2, NAVY),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
    ]))
    lead = [headrow, Spacer(1, 6)]
    for b in it['stem']:
        lead += stem_flow(b, figdir, W, fs) + [Spacer(1, 4)]

    parts = []
    for k, p in enumerate(it['parts']):
        blk = [Paragraph('<b>(%d)</b>&nbsp;&nbsp;%s&nbsp;&nbsp;<b>[%d점]</b>' % (k + 1, t(p['text']), p['pts']),
                         S_PART)]
        if p.get('note'):
            notes = p['note'] if isinstance(p['note'], list) else [p['note']]
            blk += [Spacer(1, 1)] + [Paragraph(t(n), S_NOTE) for n in notes]
        if p.get('table'):
            blk += [Spacer(1, 3)] + stem_flow({'table': p['table']}, figdir, W - 18, fs)
        box_h = max(MIN_BOX, p['box'] * mm * bs) if p.get('box') else 0
        slots = p.get('slots')
        if slots and box_h:
            box_h = max(box_h, SLOT_MIN * len(slots))
        if p.get('fig') and p.get('side'):
            # 그림을 답 칸 오른쪽에 둔다. 답 칸은 그림 높이까지 늘인다.
            pic = picture(figdir, p['fig'][0], p['fig'][1] * mm * fs)
            box_w = W - 18 - pic.drawWidth - 12
            row = Table([[AnswerBox(box_w, max(box_h, pic.drawHeight), slots=slots), pic]],
                        colWidths=[box_w + 12, pic.drawWidth])
            row.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP')] + NO_PAD))
            blk += [Spacer(1, 4), Table([[row]], colWidths=[W - 18], style=NO_PAD)]
        else:
            if p.get('fig'):
                blk += [Spacer(1, 3), picture(figdir, p['fig'][0], p['fig'][1] * mm * fs)]
            if box_h:
                pic = (picture(figdir, p['boxfig'][0], p['boxfig'][1] * mm * fs)
                       if p.get('boxfig') else None)
                if pic is not None:
                    box_h = max(box_h, pic.drawHeight + 8)
                blk += [Spacer(1, 4), AnswerBox(W - 18, box_h, pic, slots)]
        blk.append(Spacer(1, 8))
        parts.append(blk)
    return lead, parts


def height_of(flows):
    total = 0
    for f in flows:
        total += f.wrap(W, PH)[1]
    return total


def fit_item(it, figdir, avail):
    """avail 안에 들어가는 가장 큰 크기를 찾는다. (lead, parts, 비율, 높이, 들어갔나)"""
    last = None
    for fs, bs in STEPS:
        lead, parts = item_parts(it, figdir, fs, bs)
        h = height_of(lead + [f for b in parts for f in b])
        last = (lead, parts, (fs, bs), h, h <= avail - 4)
        if last[4]:
            return last
    return last


def meta_of(spec, word):
    n_parts = sum(len(it['parts']) for it in spec['items'])
    pts = sum(p['pts'] for it in spec['items'] for p in it['parts'])
    return {
        'name': '%s %s' % (spec['grade'], word),
        'grade': spec['grade'],
        'word': word,
        'range': spec['range'],
        'stat': '대문항 %d · 소문항 %d · %d점 · %d분' % (len(spec['items']), n_parts, pts, spec['minutes']),
        'high': False,
        'band': '%sㅣ%s' % (spec['grade'], word),
        'foot': '알파학원 교육연구소',
    }


def frame_heights(meta, fields):
    return (PH - MT - MB - head.height(meta, fields) - 12,
            PH - MT - MB - head.run_height(meta) - 10)


class Doc(BaseDocTemplate):
    def __init__(self, path, meta, fields):
        BaseDocTemplate.__init__(self, path, pagesize=A4, leftMargin=ML, rightMargin=MR,
                                 topMargin=MT, bottomMargin=MB, title=meta['name'])
        self.meta, self.fields, self.total = meta, fields, 0
        h1, hn = frame_heights(meta, fields)
        f1 = Frame(ML, MB, W, h1, id='f1', leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
        fn = Frame(ML, MB, W, hn, id='fn', leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
        self.addPageTemplates([PageTemplate('first', [f1], onPage=self.chrome, autoNextPageTemplate='rest'),
                               PageTemplate('rest', [fn], onPage=self.chrome)])

    def chrome(self, c, doc):
        n = c.getPageNumber()
        if n == 1:
            head.draw(c, PH - MT, self.meta, self.fields)
        else:
            head.draw_run(c, PH - MT, self.meta)
        c.setFillColor(MUTE)
        c.setFont('KR', 10)
        c.drawCentredString(PW / 2, MB - 24,
                            '%d / %d' % (n, self.total) if self.total else str(n))


def build(story_fn, path, meta, fields):
    # 쪽 수를 알려고 한 번 뽑고, 그 수를 넣어 다시 뽑는다.
    probe = Doc(io.BytesIO(), meta, fields)
    probe.build(story_fn())
    doc = Doc(path, meta, fields)
    doc.total = probe.page
    doc.build(story_fn())
    return doc.total


def paper_story(spec, figdir, meta, report):
    h1, hn = frame_heights(meta, True)

    def fn():
        notice = [Paragraph(t(spec['notice']), S_SMALL), Spacer(1, 8)]
        s = list(notice)
        report[:] = []
        for i, it in enumerate(spec['items']):
            avail = (h1 - height_of(notice)) if i == 0 else hn
            if i:
                s.append(PageBreak())
            lead, parts, (fs, bs), h, ok = fit_item(it, figdir, avail)
            report.append((it['no'], fs, bs, h / mm, avail / mm, ok))
            if ok:
                # 쪽이 남으면 소문항 사이를 벌려 쪽을 고르게 채운다.
                extra = avail - 4 - h
                gap = min(extra / len(parts), 22 * mm) if extra > 6 * mm else 0
                s += lead
                for b in parts:
                    s += ([Spacer(1, gap)] if gap else []) + b
            else:
                # 한 쪽에 안 들어가면 소문항을 쪼개지 않고 다음 쪽으로 넘긴다.
                s += [KeepTogether(lead + parts[0])] + [KeepTogether(b) for b in parts[1:]]
        return s
    return fn


def answer_story(spec):
    S_A = ParagraphStyle('a', parent=S_BODY, fontSize=9.5, leading=14)
    S_AB = ParagraphStyle('ab', parent=S_A, fontName='KRB')

    def fn():
        s = []
        for it in spec['items']:
            head_ = [Paragraph('%d.&nbsp;&nbsp;%s&nbsp;&nbsp;<font size="9" color="#6b6f78">%s</font>'
                               % (it['no'], t(it['title']), t(it['unit'])), S_HEAD), Spacer(1, 4)]
            for k, p in enumerate(it['parts']):
                rows = [
                    [Paragraph('(%d)' % (k + 1), S_AB),
                     Paragraph('%s · %s · %d점' % (t(p['type']), t(p['level']), p['pts']), S_AB)],
                    [Paragraph('답', S_AB), Paragraph(t(p['answer']), S_A)],
                    [Paragraph('만점', S_AB), Paragraph(t(p['full']), S_A)],
                    [Paragraph('절반', S_AB), Paragraph(t(p['half']), S_A)],
                    [Paragraph('0', S_AB), Paragraph(t(p['zero']), S_A)],
                ]
                tb = Table(rows, colWidths=[40, W - 40])
                tb.setStyle(TableStyle([
                    ('BOX', (0, 0), (-1, -1), 0.6, LINE),
                    ('LINEBELOW', (0, 0), (-1, 0), 0.6, LINE),
                    ('BACKGROUND', (0, 0), (-1, 0), TINT),
                    ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                    ('TOPPADDING', (0, 0), (-1, -1), 3),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
                ]))
                # 대문항 제목이 쪽 끝에 홀로 남지 않게 첫 소문항과 붙인다.
                s += [KeepTogether((head_ if k == 0 else []) + [tb]), Spacer(1, 6)]
            s.append(Spacer(1, 8))
        return s
    return fn


def write_csv(spec, path, base):
    """앱에 올리는 시험지 CSV. 문항번호는 정수만 받아서 소문항에 1 부터 번호를
    매기고, 대문항과 소문항은 원문항 칸에 `3-(2)` 꼴로 적는다. 세 칸 채점이다."""
    title = '%s %s' % (spec['grade'], spec['word'])
    cols = ['시험지', '과목', '문항번호', '단원', '유형', '난이도', '형식', '배점', '정답', '원문항',
            '채점', '문제지', '해설', '출제표']
    with io.open(path, 'w', encoding='utf-8-sig', newline='') as f:
        w = csv.writer(f)
        w.writerow(cols)
        n = 0
        for it in spec['items']:
            for k, p in enumerate(it['parts']):
                n += 1
                first = n == 1
                w.writerow([title, '과학', n, it['unit'], p['type'], p['level'], '서술형', p['pts'],
                            p['answer'], '%d-(%d)' % (it['no'], k + 1), '세 칸',
                            base + '_문제지.pdf' if first else '',
                            base + '_정답.pdf' if first else '',
                            base + '_출제표.csv' if first else ''])
    return n


def write_blueprint(spec, path):
    """출제표 CSV. 시험지 한 장이 어떻게 짜였는지 소문항 줄로만 보여 준다.

    수학 출제표와 읽는 법이 같고, 대문항이 있는 것만 다르다. 원출처는 넣지
    않는다. 과학은 장면을 모두 새로 써서 원출처가 그 문항이 아니다."""
    cols = ['문항', '대문항', '제목', '단원', '유형', '난이도', '형식', '배점', '정답']
    with io.open(path, 'w', encoding='utf-8-sig', newline='') as f:
        w = csv.writer(f)
        w.writerow(cols)
        n = 0
        for it in spec['items']:
            for k, p in enumerate(it['parts']):
                n += 1
                w.writerow([n, '%d-(%d)' % (it['no'], k + 1), it['title'], it['unit'],
                            p['type'], p['level'], '서술형', p['pts'], p['answer']])
    return n


def main(spec_path):
    spec = json.load(io.open(spec_path, encoding='utf-8'))
    here = os.path.dirname(os.path.abspath(spec_path))
    figdir = os.path.join(here, '그림')
    base = '%s_과학_영재성평가' % spec['grade']
    meta = meta_of(spec, spec['word'])
    report = []
    n1 = build(paper_story(spec, figdir, meta, report), os.path.join(here, base + '_문제지.pdf'),
               meta, True)
    n2 = build(answer_story(spec), os.path.join(here, base + '_정답.pdf'),
               meta_of(spec, spec['word'] + ' 정답'), False)
    n3 = write_csv(spec, os.path.join(here, base + '_시험지.csv'), base)
    n4 = write_blueprint(spec, os.path.join(here, base + '_출제표.csv'))
    for no, fs, bs, h, avail, ok in report:
        print('대문항 %2d  그림 %3d%%  답 칸 %3d%%  %3.0f / %3.0f mm  %s'
              % (no, fs * 100, bs * 100, h, avail, '' if ok else '넘침'))
    for first in sorted(set(WRAPPED)):
        print('자리가 모자라 글이 꺾인 표: 첫 칸이 "%s"' % first)
    print('문제지 %d쪽, 정답 %d쪽, 시험지 CSV %d문항, 출제표 %d줄' % (n1, n2, n3, n4))


if __name__ == '__main__':
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    main(sys.argv[1])
