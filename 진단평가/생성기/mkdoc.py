# -*- coding: utf-8 -*-
"""과학영재 자료의 마크다운을 PDF 로 뽑는다.

    python mkdoc.py

`과학영재/` 의 md 를 읽어 같은 폴더에 PDF 세 개를 만든다.

    과학영재_중1.pdf    중1 Ⅱ~Ⅶ 여섯 단원
    과학영재_중2.pdf    중2 Ⅰ~Ⅷ 여덟 단원
    과학영재_중3.pdf    중3 (16)~(21) 여섯 단원
    과학영재_대조표.pdf  목차 대조표와 출처 코드

## 왜 마크다운 라이브러리를 안 쓰나

`markdown` 패키지가 깔려 있지 않고, 깔더라도 HTML 을 다시 reportlab 이 읽는
꼴로 바꿔야 한다. 우리가 쓰는 문법이 여덟 가지뿐이라 바로 읽는 편이 짧다.

    # ## ###   제목
    | … |      표
    1. - 　     번호 목록과 글머리표
    > 　        인용
    ---        가로줄
    **굵게**  `코드`  [글](주소)

`**문제 1.**` 으로 시작하는 줄은 문제 머리로 따로 잡아 한 줄을 차지하게 한다.
"""
import glob
import io
import os
import re
import sys

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (BaseDocTemplate, Frame, NextPageTemplate, PageBreak,
                                PageTemplate, Paragraph, Spacer, Table, TableStyle)

HERE = os.path.dirname(os.path.abspath(__file__))
자료 = os.path.abspath(os.path.join(HERE, '..', '과학영재'))
글꼴 = os.path.join(HERE, '글꼴')

for 이름, 파일 in [('KR', 'NotoSansKR-Regular.ttf'), ('KRB', 'NotoSansKR-Bold.ttf')]:
    p = os.path.join(글꼴, 파일)
    if not os.path.exists(p):
        raise SystemExit('글꼴이 없다: %s. mkfont.py 를 먼저 돌려라.' % p)
    pdfmetrics.registerFont(TTFont(이름, p))
# <b> 가 굵은 글꼴로 바뀌려면 한 식구로 묶어 두어야 한다. 이것을 빠뜨리면
# **굵게** 가 조용히 보통 글씨로 나온다.
pdfmetrics.registerFontFamily('KR', normal='KR', bold='KRB',
                              italic='KR', boldItalic='KRB')

# ── 색 ────────────────────────────────────────────────
먹 = colors.HexColor('#1a1a1a')
흐림 = colors.HexColor('#6b6b6b')
줄색 = colors.HexColor('#c8c8c8')
표머리 = colors.HexColor('#eef1f5')
코드색 = colors.HexColor('#2f4a86')
띠 = colors.HexColor('#3a6ea5')

# ── 쪽 ────────────────────────────────────────────────
쪽폭, 쪽높이 = A4
여백 = 20 * mm
위여백 = 22 * mm
아래여백 = 18 * mm
본문폭 = 쪽폭 - 여백 * 2

# ── 글 모양 ───────────────────────────────────────────
def 모양(이름, 크기, 줄간, **kw):
    kw.setdefault('fontName', 'KR')
    kw.setdefault('textColor', 먹)
    kw.setdefault('alignment', TA_LEFT)
    kw.setdefault('wordWrap', 'CJK')
    return ParagraphStyle(이름, fontSize=크기, leading=줄간, **kw)


S = {
    'h1': 모양('h1', 19, 26, fontName='KRB', spaceBefore=0, spaceAfter=10),
    'h2': 모양('h2', 13.5, 20, fontName='KRB', spaceBefore=14, spaceAfter=6,
               textColor=colors.HexColor('#24487a')),
    'h3': 모양('h3', 11, 17, fontName='KRB', spaceBefore=11, spaceAfter=4),
    'p': 모양('p', 9.5, 15.5, spaceAfter=5),
    # 문제 머리는 글꼴을 보통으로 둔다. 「문제 1.」 만 **굵게** 가 굵게 만들고
    # 뒤에 붙는 유형과 출처는 눈에 덜 띄어야 한다.
    'q머리': 모양('q머리', 9.5, 16, spaceBefore=9, spaceAfter=2),
    '목록': 모양('목록', 9.5, 15.5, spaceAfter=3),
    '인용': 모양('인용', 9.5, 15.5, leftIndent=10, spaceBefore=3, spaceAfter=5,
               textColor=colors.HexColor('#33444f')),
    '칸': 모양('칸', 8.4, 12.6),
    '칸굵': 모양('칸굵', 8.4, 12.6, fontName='KRB'),
    '표제': 모양('표제', 30, 40, fontName='KRB', spaceAfter=8),
    '표제부': 모양('표제부', 11, 18, textColor=흐림, spaceAfter=3),
    '차례': 모양('차례', 10, 18, spaceAfter=1),
    '차례들': 모양('차례들', 9, 15, leftIndent=14, textColor=흐림, spaceAfter=1),
}

# ── 글줄 안의 꾸밈 ────────────────────────────────────
def 새김(s):
    """마크다운 한 줄을 reportlab 이 읽는 꼴로 바꾼다."""
    s = s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
    s = re.sub(r'\[([^\]]*)\]\([^)]*\)', r'\1', s)          # 링크는 글만 남긴다
    s = re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', s)
    # `코드` 는 옅은 바탕을 깐 딱지로 그린다. 유형 표시가 둘씩 붙어 나오는데
    # 색만 입히면 「적용 결론·일반화」 가 한 낱말처럼 읽힌다.
    s = re.sub(r'`([^`]+)`',
               r'<font name="KRB" color="#24487a" backColor="#e7edf6">'
               r'&nbsp;\1&nbsp;</font>', s)
    return 아래첨자(s)


아래숫자 = '₀₁₂₃₄₅₆₇₈₉'
위숫자 = '⁰¹²³⁴⁵⁶⁷⁸⁹'


def 아래첨자(s):
    """H₂O 의 ₂ 처럼 유니코드 첨자를 reportlab 의 <sub>·<super> 로 바꾼다.

    노토 산스 KR 에 ₂(U+2082)와 ₃(U+2083)이 없어 그대로 두면 빈칸으로 나온다.
    화학식이 든 글에서 바로 드러난다. 글쓰기는 ₂ 가 읽기 쉬우므로 md 는 그대로
    두고 여기서 바꾼다.
    """
    for 글자들, 태그 in [(아래숫자, 'sub'), (위숫자, 'super')]:
        본 = {c: str(i) for i, c in enumerate(글자들)}
        틀 = re.compile('[%s]+' % re.escape(글자들))
        s = 틀.sub(lambda m: '<%s>%s</%s>'
                   % (태그, ''.join(본[c] for c in m.group()), 태그), s)
    return s


# ── 표 ────────────────────────────────────────────────
def 칸너비(줄들):
    """칸마다 든 글자 수에 비례해 너비를 나눈다. 좁은 칸은 바닥을 둔다."""
    칸수 = len(줄들[0])
    무게 = []
    for i in range(칸수):
        긴것 = max(len(r[i]) for r in 줄들)
        무게.append(max(긴것, 3) ** 0.75)
    합 = sum(무게)
    너비 = [본문폭 * w / 합 for w in 무게]
    바닥 = 13 * mm
    모자람 = sum(바닥 - w for w in 너비 if w < 바닥)
    if 모자람 > 0:
        남 = [i for i, w in enumerate(너비) if w >= 바닥]
        덜 = 모자람 / len(남) if 남 else 0
        너비 = [바닥 if w < 바닥 else w - 덜 for w in 너비]
    return 너비


def 표만들기(줄들):
    머리 = 줄들[0]
    몸 = 줄들[1:]
    머리있음 = any(c.strip() for c in 머리)
    칸들 = []
    for i, r in enumerate(줄들):
        모 = S['칸굵'] if (i == 0 and 머리있음) else S['칸']
        칸들.append([Paragraph(새김(c), 모) for c in r])
    t = Table(칸들, colWidths=칸너비(줄들), repeatRows=1 if 머리있음 else 0)
    꾸밈 = [
        ('GRID', (0, 0), (-1, -1), 0.4, 줄색),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
        ('TOPPADDING', (0, 0), (-1, -1), 3.5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3.5),
    ]
    if 머리있음:
        꾸밈.append(('BACKGROUND', (0, 0), (-1, 0), 표머리))
    else:
        # 머리가 빈 표는 첫 줄을 아예 없앤다
        칸들 = 칸들[1:]
        t = Table(칸들, colWidths=칸너비(줄들))
        꾸밈 = [x for x in 꾸밈 if x[0] != 'BACKGROUND']
        꾸밈.append(('BACKGROUND', (0, 0), (0, -1), 표머리))
        t.setStyle(TableStyle(꾸밈))
        return t
    t.setStyle(TableStyle(꾸밈))
    return t


# ── 가로줄 ────────────────────────────────────────────
class 가로줄(Spacer):
    def __init__(self):
        Spacer.__init__(self, 본문폭, 11)

    def draw(self):
        self.canv.setStrokeColor(줄색)
        self.canv.setLineWidth(0.5)
        self.canv.line(0, 5.5, 본문폭, 5.5)


# ── 마크다운 읽기 ─────────────────────────────────────
표줄 = re.compile(r'^\s*\|(.+)\|\s*$')
가름줄 = re.compile(r'^\s*\|[\s:|-]+\|\s*$')
번호 = re.compile(r'^(\s*)(\d+)\.\s+(.*)$')
글머리 = re.compile(r'^(\s*)-\s+(.*)$')


def 칸나누기(줄):
    return [c.strip() for c in 표줄.match(줄).group(1).split('|')]


def 읽는다(글):
    """마크다운 한 편을 reportlab 조각 목록으로 바꾼다."""
    줄들 = 글.replace('\r\n', '\n').split('\n')
    조각 = []
    i = 0
    n = len(줄들)
    while i < n:
        줄 = 줄들[i]
        벗 = 줄.strip()

        if not 벗:
            i += 1
            continue

        if 벗 == '---':
            조각.append(가로줄())
            i += 1
            continue

        if 벗.startswith('### '):
            조각.append(Paragraph(새김(벗[4:]), S['h3']))
            i += 1
            continue
        if 벗.startswith('## '):
            조각.append(Paragraph(새김(벗[3:]), S['h2']))
            i += 1
            continue
        if 벗.startswith('# '):
            조각.append(Paragraph(새김(벗[2:]), S['h1']))
            i += 1
            continue

        # 표
        if 표줄.match(줄):
            모은것 = []
            while i < n and 표줄.match(줄들[i]):
                if not 가름줄.match(줄들[i]):
                    모은것.append(칸나누기(줄들[i]))
                i += 1
            칸수 = max(len(r) for r in 모은것)
            모은것 = [r + [''] * (칸수 - len(r)) for r in 모은것]
            조각.append(표만들기(모은것))
            조각.append(Spacer(1, 7))
            continue

        # 인용
        if 벗.startswith('>'):
            모은것 = []
            while i < n and 줄들[i].strip().startswith('>'):
                모은것.append(줄들[i].strip()[1:].strip())
                i += 1
            # 왼쪽에 세로줄을 그어야 인용인 줄 안다. 문단 테두리는 네 면을
            # 다 그리므로 한 칸짜리 표를 쓴다.
            조각.append(Table(
                [[Paragraph(새김(' '.join(x for x in 모은것 if x)), S['인용'])]],
                colWidths=[본문폭 - 6 * mm],
                hAlign='RIGHT',
                style=TableStyle([
                    ('LINEBEFORE', (0, 0), (0, -1), 1.6, 띠),
                    ('LEFTPADDING', (0, 0), (-1, -1), 8),
                    ('RIGHTPADDING', (0, 0), (-1, -1), 0),
                    ('TOPPADDING', (0, 0), (-1, -1), 3),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
                ])))
            조각.append(Spacer(1, 6))
            continue

        # 목록
        if 번호.match(줄) or 글머리.match(줄):
            항목 = []      # (라벨, 글)
            while i < n:
                줄 = 줄들[i]
                if not 줄.strip():
                    # 빈 줄 다음이 목록이면 이어진다
                    j = i + 1
                    while j < n and not 줄들[j].strip():
                        j += 1
                    if j < n and (번호.match(줄들[j]) or 글머리.match(줄들[j])
                                  or 줄들[j].startswith('   ')):
                        i = j
                        continue
                    break
                m = 번호.match(줄)
                b = 글머리.match(줄)
                if m:
                    항목.append([m.group(2) + '.', m.group(3)])
                    i += 1
                elif b:
                    항목.append(['•', b.group(2)])
                    i += 1
                elif 줄.startswith('   ') and 항목:
                    항목[-1][1] += ' ' + 줄.strip()
                    i += 1
                else:
                    break
            for 라벨, 글줄 in 항목:
                조각.append(Table(
                    [[Paragraph('<font color="#5a6b7d">%s</font>' % 라벨, S['목록']),
                      Paragraph(새김(글줄), S['목록'])]],
                    colWidths=[9 * mm, 본문폭 - 9 * mm],
                    style=TableStyle([
                        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                        ('LEFTPADDING', (0, 0), (0, -1), 4),
                        ('LEFTPADDING', (1, 0), (1, -1), 0),
                        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
                        ('TOPPADDING', (0, 0), (-1, -1), 1),
                        ('BOTTOMPADDING', (0, 0), (-1, -1), 2.5),
                    ])))
            조각.append(Spacer(1, 4))
            continue

        # 문제 머리는 한 줄을 따로 쓴다
        if 벗.startswith('**문제 '):
            조각.append(Paragraph(새김(벗), S['q머리']))
            i += 1
            continue

        # 보통 문단
        모은것 = []
        while i < n:
            줄 = 줄들[i]
            벗 = 줄.strip()
            if (not 벗 or 벗 == '---' or 벗.startswith('#') or 표줄.match(줄)
                    or 벗.startswith('>') or 번호.match(줄) or 글머리.match(줄)
                    or 벗.startswith('**문제 ')):
                break
            모은것.append(벗)
            i += 1
        if 모은것:
            조각.append(Paragraph(새김(' '.join(모은것)), S['p']))
    return 조각


# ── 쪽 꾸미기 ─────────────────────────────────────────
class 문서(BaseDocTemplate):
    def __init__(self, 경로, 제목):
        BaseDocTemplate.__init__(
            self, 경로, pagesize=A4, title=제목, author='알파학원',
            leftMargin=여백, rightMargin=여백,
            topMargin=위여백, bottomMargin=아래여백)
        틀 = Frame(여백, 아래여백, 본문폭,
                  쪽높이 - 위여백 - 아래여백, id='본문',
                  leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
        self.머리 = 제목
        self.addPageTemplates([
            PageTemplate(id='표지', frames=[틀]),
            PageTemplate(id='본문', frames=[틀], onPage=self.꾸민다),
        ])

    def 꾸민다(self, c, doc):
        c.saveState()
        c.setFont('KR', 8)
        c.setFillColor(흐림)
        c.drawString(여백, 쪽높이 - 위여백 + 8, self.머리)
        c.drawRightString(쪽폭 - 여백, 아래여백 - 11, '%d' % c.getPageNumber())
        c.setStrokeColor(줄색)
        c.setLineWidth(0.4)
        c.line(여백, 쪽높이 - 위여백 + 4, 쪽폭 - 여백, 쪽높이 - 위여백 + 4)
        c.restoreState()

    def afterFlowable(self, flowable):
        """제목을 책갈피로 남긴다."""
        if not isinstance(flowable, Paragraph):
            return
        이름 = flowable.style.name
        if 이름 not in ('h1', 'h2'):
            return
        글 = re.sub(r'<[^>]+>', '', flowable.getPlainText())
        키 = '%s-%d' % (이름, self.page * 1000 + id(flowable) % 1000)
        self.canv.bookmarkPage(키)
        self.canv.addOutlineEntry(글, key=키, level=0 if 이름 == 'h1' else 1)


def 표지(제목, 부제, 줄들):
    조각 = [Spacer(1, 62 * mm), Paragraph(제목, S['표제'])]
    조각.append(Spacer(1, 2 * mm))
    조각.append(Paragraph(부제, S['표제부']))
    조각.append(Spacer(1, 10 * mm))
    for x in 줄들:
        조각.append(Paragraph(새김(x), S['표제부']))
    return 조각


def 차례(파일들):
    조각 = [Paragraph('차례', S['h1']), Spacer(1, 3 * mm)]
    for p in 파일들:
        글 = io.open(p, encoding='utf-8').read()
        for 줄 in 글.split('\n'):
            벗 = 줄.strip()
            if 벗.startswith('# '):
                조각.append(Paragraph(새김(벗[2:]), S['차례']))
            elif 벗.startswith('## ') and not 벗.startswith('## 옮기면서'):
                조각.append(Paragraph(새김(벗[3:]), S['차례들']))
    return 조각


def 만든다(나갈이름, 제목, 부제, 표지줄, 파일들, 차례넣기=True):
    경로 = os.path.join(자료, 나갈이름)
    d = 문서(경로, 제목)
    조각 = 표지(제목, 부제, 표지줄)
    # 표지 다음 쪽부터 머리글과 쪽번호를 붙인다
    조각.append(NextPageTemplate('본문'))
    조각.append(PageBreak())
    if 차례넣기:
        조각 += 차례(파일들)
        조각.append(PageBreak())
    표 = 표읽기(os.path.dirname(파일들[0])) if 파일들 else {}
    for k, p in enumerate(파일들):
        if k:
            조각.append(PageBreak())
        조각 += 읽는다(표끼우기(io.open(p, encoding='utf-8').read(), 표))
    d.build(조각)
    print('%s  %d쪽' % (나갈이름, d.page))


def 차례대로(글자):
    """단원 md 만 고른다. `_` 로 시작하는 것은 자료가 아니라 곁들이다."""
    p = os.path.join(자료, 글자, '*.md')
    return sorted(x for x in glob.glob(p) if not os.path.basename(x).startswith('_'))


# ── 떼어 둔 교재 표 ───────────────────────────────────
표자리 = re.compile(r'^<!-- 교재표 (.+?) -->$', re.M)
표가리킴 = re.compile(r'\. 표는 \[`_교재_서술형\.md`\]\(_교재_서술형\.md\) 에 있다\.')


def 표읽기(폴더):
    """`_교재_서술형.md` 를 열쇠별 덩이로 나눈다. 없으면 빈 것을 돌려준다.

    이 파일은 저장소로 옮기지 않는다(sync 의 `빼는길`). 저장소만 받은 컴퓨터에는
    없으므로, 없으면 표 없이 뽑고 한 줄 알린다.
    """
    p = os.path.join(폴더, '_교재_서술형.md')
    if not os.path.exists(p):
        return {}
    표 = {}
    열쇠 = None
    모은것 = []
    for 줄 in io.open(p, encoding='utf-8').read().split('\n'):
        if 줄.startswith('## '):
            if 열쇠:
                표[열쇠] = 모은것
            열쇠, 모은것 = 줄[3:].strip(), []
        elif 열쇠 is not None:
            모은것.append(줄)
    if 열쇠:
        표[열쇠] = 모은것
    # 덩이의 첫 문단(쪽번호 안내)은 단원 md 에 이미 있다. 표부터 남긴다.
    깎은것 = {}
    for k, v in 표.items():
        i = 0
        while i < len(v) and not v[i].startswith('|'):
            i += 1
        끝 = len(v)
        while 끝 > 0 and v[끝 - 1].strip() in ('', '---'):
            끝 -= 1
        깎은것[k] = v[i:끝]
    return 깎은것


def 표끼우기(글, 표):
    """`<!-- 교재표 … -->` 자리에 표를 도로 넣는다."""
    def 바꾼다(m):
        덩이 = 표.get(m.group(1))
        if not 덩이:
            print('   교재 표를 못 찾았다: %s. 그 자리는 비워 둔다.' % m.group(1))
            return ''
        return '\n'.join(덩이)
    if 표:
        # PDF 에서는 표가 바로 아래 있으므로 가리키는 말은 뺀다
        글 = 표가리킴.sub('.', 글)
    return 표자리.sub(바꾼다, 글)


def 글자검사():
    """글꼴에 없는 글자가 있으면 알린다. 빈칸으로 인쇄되는 것을 막는다.

    fontTools 가 없으면 조용히 넘어간다. 조판 자체에는 필요 없는 검사다.
    """
    try:
        from fontTools.ttLib import TTFont
    except ImportError:
        return
    쓴것 = set()
    for p in (glob.glob(os.path.join(자료, '*.md'))
              + glob.glob(os.path.join(자료, '*', '*.md'))):
        쓴것 |= set(io.open(p, encoding='utf-8').read())
    쓴것 -= set('\n') | set(아래숫자) | set(위숫자)   # 첨자는 <sub>로 바꾼다
    있음 = set()
    f = TTFont(os.path.join(글꼴, 'NotoSansKR-Regular.ttf'))
    for t in f['cmap'].tables:
        있음 |= set(t.cmap.keys())
    없 = sorted(c for c in 쓴것 if ord(c) not in 있음)
    if 없:
        print('!! 글꼴에 없는 글자 %d개. 빈칸으로 인쇄된다.' % len(없))
        for c in 없:
            print('   U+%04X %s' % (ord(c), c))


if __name__ == '__main__':
    if not os.path.isdir(자료):
        raise SystemExit('자료 폴더가 없다: %s' % 자료)
    글자검사()
    만든다('과학영재_중1.pdf', '중1 과학 영재성평가 자료',
          '2022 개정 교육과정 · 단원별 추가 학습 목표와 문제',
          ['하이탑 중학교 과학1 1권·2권(2022 개정)의 차례를 본으로 삼았다.',
           '통합 단원인 Ⅰ. 과학과 인류의 지속가능한 삶은 문제를 만들지 않아 빠져 있다.'],
          차례대로('중1'))
    만든다('과학영재_중2.pdf', '중2 과학 영재성평가 자료',
          '2022 개정 교육과정 · 단원별 추가 학습 목표와 문제',
          ['하이탑 중학교 과학2 1권·2권(2022 개정)의 차례를 본으로 삼았다.'],
          차례대로('중2'))
    만든다('과학영재_중3.pdf', '중3 과학 영재성평가 자료',
          '2022 개정 교육과정 · 단원별 추가 학습 목표와 문제',
          ['교과서가 2027년에 나온다. 대단원은 교육과정 문서의 단원 번호와 이름을 쓰고,',
           '소단원은 15개정 이름을 임시로 두었다.',
           '통합 단원인 (22) 재해·재난과 안전과 (23) 과학과 나의 미래는 문제를 만들지 않아 빠져 있다.'],
          차례대로('중3'))
    만든다('과학영재_대조표.pdf', '목차 대조표와 출처',
          '15개정 자료를 22개정 목차로 옮기면서 만든 표',
          ['단원이 어디로 갔는지, 문제가 어느 교재에서 왔는지 적어 둔 것이다.'],
          [os.path.join(자료, '_목차_대조표.md'), os.path.join(자료, '_출처.md')],
          차례넣기=False)
