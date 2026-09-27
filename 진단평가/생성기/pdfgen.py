# -*- coding: utf-8 -*-
"""진단평가 문제지 / 해설 PDF 조판기 — A4 2단, 단원 색 구분형.

문항은 단원 색 세로선을 왼쪽에 두고, 단원이 바뀌는 자리에 색 띠와 이름을 넣는다.
서술형은 문항 아래에 풀이 쓸 빈칸이 따라붙는다.
"""
import json
import os
import sys

from PIL import Image as PILImage
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas as pdfcanvas
from reportlab.platypus import (BaseDocTemplate, Flowable, Frame, Image,
                                KeepTogether, NextPageTemplate, PageTemplate,
                                Paragraph, Spacer,
                                Table, TableStyle)

pdfmetrics.registerFont(TTFont('KR', 'C:/Windows/Fonts/malgun.ttf'))
pdfmetrics.registerFont(TTFont('KRB', 'C:/Windows/Fonts/malgunbd.ttf'))

PW, PH = A4
ML = MR = 34
MT, MB = 40, 44
GUTTER = 22
COLW = (PW - ML - MR - GUTTER) / 2
NAVY = colors.HexColor('#16224e')
MUTED = colors.HexColor('#b6bac4')
HAIR = colors.HexColor('#e6e8ec')

# 단원 색 — 띠·세로선용(진한 쪽)과 글자용(더 진한 쪽)
RAMPS = [('#378ADD', '#185FA5'), ('#1D9E75', '#0F6E56'), ('#7F77DD', '#534AB7'),
         ('#D85A30', '#993C1D'), ('#BA7517', '#854F0B'), ('#D4537E', '#993556')]
GRAY = ('#9a9a94', '#5F5E5A')


def unit_colors(units):
    """단원 이름 → (선 색, 글자 색). '복습'은 회색으로 빼 둔다."""
    out, k = {}, 0
    for u in units:
        if '복습' in u:
            out[u] = GRAY
        else:
            out[u] = RAMPS[k % len(RAMPS)]
            k += 1
    return out


class UnitBar(Flowable):
    """단원이 바뀌는 자리에 놓는 색 띠 + 단원 이름."""

    def __init__(self, label, bar, ink, width):
        Flowable.__init__(self)
        self.label, self.bar, self.ink, self.width = label, bar, ink, width
        self.height = 15

    def draw(self):
        c = self.canv
        c.setFillColor(colors.HexColor(self.bar))
        c.roundRect(0, 4, 11, 2.6, 1.3, stroke=0, fill=1)
        c.setFillColor(colors.HexColor(self.ink))
        c.setFont('KRB', 7.6)
        c.drawString(15, 3.4, self.label)


class AnswerBox(Flowable):
    """서술형 풀이를 쓰는 빈칸."""

    def __init__(self, width, height=74):
        Flowable.__init__(self)
        self.width, self.height = width, height

    def draw(self):
        c = self.canv
        c.setStrokeColor(HAIR)
        c.setLineWidth(0.5)
        c.roundRect(0, 0, self.width, self.height, 3, stroke=1, fill=0)
        c.setFont('KR', 5.8)
        c.setFillColor(MUTED)
        c.drawString(5, self.height - 9, '풀이')


def head_row(no, essay, points, ink, width):
    """번호 · 서술형 배지 · 배점이 한 줄에 놓인다."""
    left = '<font name="KRB" size="12" color="%s">%d</font>' % (ink, no)
    if essay:
        left += ('&nbsp;<font name="KRB" size="6" color="%s" backColor="#f1f3f7">'
                 '&nbsp;서술형&nbsp;</font>' % ink)
    st = ParagraphStyle('h', fontName='KR', fontSize=12, leading=13.5, alignment=TA_LEFT)
    rt = ParagraphStyle('p', fontName='KR', fontSize=6.5, leading=13.5,
                        alignment=2, textColor=MUTED)
    t = Table([[Paragraph(left, st), Paragraph('%d점' % points, rt)]],
              colWidths=[width - 34, 34])
    t.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'BOTTOM'),
                           ('LEFTPADDING', (0, 0), (-1, -1), 0),
                           ('RIGHTPADDING', (0, 0), (-1, -1), 0),
                           ('TOPPADDING', (0, 0), (-1, -1), 0),
                           ('BOTTOMPADDING', (0, 0), (-1, -1), 2)]))
    return t


def fit_image(path, maxw, maxh):
    w, h = PILImage.open(path).size
    tw = maxw
    th = tw * h / w
    if th > maxh:
        th = maxh
        tw = th * w / h
    return Image(path, width=tw, height=th)


def question_block(no, q, ucol, inner):
    """단원 색 세로선을 두른 문항 한 덩어리."""
    ink = ucol[1]
    body = [head_row(no, q['essay'], q['points'], ink, inner),
            Spacer(1, 3),
            fit_image(q['img'], inner, 300)]
    if q['essay']:
        body += [Spacer(1, 5), AnswerBox(inner)]
    t = Table([[body]], colWidths=[inner + 9])
    t.setStyle(TableStyle([
        ('LINEBEFORE', (0, 0), (0, 0), 1.6, colors.HexColor(ucol[0])),
        ('LEFTPADDING', (0, 0), (-1, -1), 9),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
        ('TOPPADDING', (0, 0), (-1, -1), 0),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 0)]))
    return t


class Numbered(pdfcanvas.Canvas):
    """머리글·바닥글은 전체 쪽수를 알아야 해서 두 번에 나눠 그린다."""

    meta = {}

    def __init__(self, *a, **kw):
        pdfcanvas.Canvas.__init__(self, *a, **kw)
        self._saved = []

    def showPage(self):
        self._saved.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        total = len(self._saved)
        for st in self._saved:
            self.__dict__.update(st)
            self.draw_frame(total)
            pdfcanvas.Canvas.showPage(self)
        pdfcanvas.Canvas.save(self)

    def draw_frame(self, total):
        m = self.meta
        n = self._pageNumber
        if n == 1:
            self.setFillColor(NAVY)
            self.setFont('KRB', 14)
            self.drawString(ML, PH - MT - 4, m['title'])
            self.setFillColor(colors.HexColor('#8a8f99'))
            self.setFont('KR', 7.8)
            self.drawString(ML, PH - MT - 17, m['range'])
            self.setFont('KR', 7.8)
            self.drawRightString(PW - MR, PH - MT - 4, m['stat'])
            y = PH - MT - 30
            self.setStrokeColor(HAIR)
            self.setLineWidth(0.5)
            for lab, x, w in ([] if m.get('teacher') else
                              [('이름', ML, 120), ('학교 · 학년', ML + 140, 130),
                               ('응시일', ML + 300, 110)]):
                self.setFillColor(colors.HexColor('#8a8f99'))
                self.setFont('KR', 7)
                self.drawString(x, y, lab)
                self.line(x + 42, y - 1.5, x + w, y - 1.5)
            self.setStrokeColor(NAVY)
            self.setLineWidth(1.4)
            self.line(ML, PH - MT - 40, PW - MR, PH - MT - 40)
        else:
            self.setFillColor(colors.HexColor('#8a8f99'))
            self.setFont('KR', 7.6)
            self.drawString(ML, PH - MT + 4, m['title'])
            self.setStrokeColor(HAIR)
            self.setLineWidth(0.5)
            self.line(ML, PH - MT - 2, PW - MR, PH - MT - 2)

        # 단 사이 세로 실선
        self.setStrokeColor(HAIR)
        self.setLineWidth(0.5)
        top = PH - MT - (46 if n == 1 else 10)
        self.line(PW / 2, MB + 16, PW / 2, top)

        # 바닥글 — 진행 막대
        self.setFillColor(colors.HexColor('#aab0ba'))
        self.setFont('KR', 6.6)
        self.drawString(ML, MB - 12, m['foot'])
        self.drawRightString(PW - MR, MB - 12, '%d / %d' % (n, total))
        bx, bw = PW / 2 - 55, 110
        self.setFillColor(HAIR)
        self.roundRect(bx, MB - 11, bw, 2.4, 1.2, stroke=0, fill=1)
        self.setFillColor(NAVY)
        self.roundRect(bx, MB - 11, bw * n / total, 2.4, 1.2, stroke=0, fill=1)


def build_paper(spec, path):
    qs = spec['questions']
    ucol = unit_colors(dict.fromkeys(q['unit'] for q in qs))
    units = list(dict.fromkeys(q['unit'] for q in qs))
    total = sum(q['points'] for q in qs)

    Numbered.meta = {
        'title': '알파학원 진단평가 · %s 수학' % spec['grade'],
        'range': ' ~ '.join([units[0], units[-1]]),
        'stat': '%d문제 · %d점' % (len(qs), total),
        'foot': '알파학원 교육연구소',
    }

    doc = BaseDocTemplate(path, pagesize=A4, leftMargin=ML, rightMargin=MR,
                          topMargin=MT, bottomMargin=MB, title=spec['title'])
    inner = COLW - 9

    def frames(top_gap):
        h = PH - MT - MB - top_gap - 14
        return [Frame(ML, MB + 14, COLW, h, id='l', showBoundary=0,
                      leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0),
                Frame(ML + COLW + GUTTER, MB + 14, COLW, h, id='r', showBoundary=0,
                      leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)]

    doc.addPageTemplates([
        PageTemplate(id='first', frames=frames(52)),
        PageTemplate(id='rest', frames=frames(14)),
    ])

    # 1쪽은 큰 머리글, 2쪽부터는 얇은 머리글을 쓴다
    story = [NextPageTemplate('rest')]
    seen = None
    for i, q in enumerate(qs, 1):
        blk = []
        if q['unit'] != seen:
            blk.append(UnitBar(q['unit'], ucol[q['unit']][0], ucol[q['unit']][1], inner))
            seen = q['unit']
        blk.append(question_block(i, q, ucol[q['unit']], inner))
        blk.append(Spacer(1, 11))
        story.append(KeepTogether(blk))

    doc.build(story, canvasmaker=Numbered)
    return path


# ── 해설 ──────────────────────────────────────────────

def esc(t):
    return t.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')


def build_solution(spec, path):
    qs = spec['questions']
    ucol = unit_colors(dict.fromkeys(q['unit'] for q in qs))
    units = list(dict.fromkeys(q['unit'] for q in qs))
    total = sum(q['points'] for q in qs)

    Numbered.meta = {
        'title': '%s 해설 · 교사용' % spec['title'],
        'range': ' ~ '.join([units[0], units[-1]]),
        'stat': '%d문제 · %d점' % (len(qs), total),
        'foot': '알파학원 교육연구소 · 교사용',
        'teacher': True,
    }

    doc = BaseDocTemplate(path, pagesize=A4, leftMargin=ML, rightMargin=MR,
                          topMargin=MT, bottomMargin=MB, title=spec['title'] + ' 해설')
    inner = COLW - 9

    def frames(top_gap):
        h = PH - MT - MB - top_gap - 14
        return [Frame(ML, MB + 14, COLW, h, id='l', leftPadding=0, rightPadding=0,
                      topPadding=0, bottomPadding=0),
                Frame(ML + COLW + GUTTER, MB + 14, COLW, h, id='r', leftPadding=0,
                      rightPadding=0, topPadding=0, bottomPadding=0)]

    doc.addPageTemplates([PageTemplate(id='first', frames=frames(52)),
                          PageTemplate(id='rest', frames=frames(14))])

    meta_st = ParagraphStyle('m', fontName='KR', fontSize=6.4, leading=9,
                             textColor=colors.HexColor('#8a8f99'))
    ans_st = ParagraphStyle('a', fontName='KRB', fontSize=8.6, leading=12,
                            textColor=NAVY)
    step_st = ParagraphStyle('s', fontName='KR', fontSize=7.4, leading=11.4,
                             leftIndent=9, firstLineIndent=-9,
                             textColor=colors.HexColor('#16181c'))
    miss_st = ParagraphStyle('x', fontName='KR', fontSize=6.8, leading=10,
                             textColor=colors.HexColor('#5f6470'))

    story = [NextPageTemplate('rest')]
    seen = None
    for i, q in enumerate(qs, 1):
        bar, ink = ucol[q['unit']]
        blk = []
        if q['unit'] != seen:
            blk.append(UnitBar(q['unit'], bar, ink, inner))
            seen = q['unit']
        body = [head_row(i, q['essay'], q['points'], ink, inner),
                Paragraph('%s · %s · %s %s번' % (esc(q['type']), esc(q['level']),
                                                 esc(q['src']), q['srcno']), meta_st),
                Spacer(1, 4),
                Paragraph('정답 &nbsp;%s' % esc(q['answer']), ans_st),
                Spacer(1, 3)]
        for s_ in q['steps']:
            body.append(Paragraph('· ' + esc(s_), step_st))
        body += [Spacer(1, 4),
                 Paragraph('<font name="KRB" color="%s">틀렸다면</font> &nbsp;%s'
                           % (ink, esc(q['miss'])), miss_st)]
        t = Table([[body]], colWidths=[inner + 9])
        t.setStyle(TableStyle([
            ('LINEBEFORE', (0, 0), (0, 0), 1.6, colors.HexColor(bar)),
            ('LEFTPADDING', (0, 0), (-1, -1), 9),
            ('RIGHTPADDING', (0, 0), (-1, -1), 0),
            ('TOPPADDING', (0, 0), (-1, -1), 0),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 0)]))
        blk += [t, Spacer(1, 12)]
        story.append(KeepTogether(blk))

    doc.build(story, canvasmaker=Numbered)
    return path


if __name__ == '__main__':
    spec = json.load(open(sys.argv[1], encoding='utf-8'))
    base = os.path.join(sys.argv[2], spec['title'].replace(' ', '_'))
    build_paper(spec, base + '_문제지.pdf')
    build_solution(spec, base + '_해설.pdf')
    print(os.path.basename(base))
