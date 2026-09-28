# -*- coding: utf-8 -*-
"""스펙에 쓴 글자 중 인쇄 글꼴에 없는 것을 찾는다.

글꼴에 없는 글자는 오류 없이 그냥 빈칸으로 인쇄된다. 해설에서 기호 하나가
사라지면 문장이 통째로 말이 안 되므로, 만들기 전에 한 번 훑는다.

보는 글꼴은 paper.py·solution.py 가 실제로 등록하는 것과 같아야 한다.
2026년 9월 29일까지는 맑은 고딕을 보고 있어서, 노토에만 없는 글자를 써도
없다고 말해 주지 못했다.
"""
import collections
import json
import os
import sys

from reportlab.pdfbase.ttfonts import TTFontFile

FONTDIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '글꼴')
FONTS = {'KR': os.path.join(FONTDIR, 'NotoSansKR-Regular.ttf'),
         'KRB': os.path.join(FONTDIR, 'NotoSansKR-Bold.ttf')}
for _이름, _길 in FONTS.items():
    if not os.path.exists(_길):
        raise SystemExit('글꼴이 없다: %s. mkfont.py 를 먼저 돌려라.' % _길)
MAPS = {n: TTFontFile(p).charToGlyph for n, p in FONTS.items()}


def walk(o, path=''):
    if isinstance(o, str):
        yield path, o
    elif isinstance(o, list):
        for i, v in enumerate(o):
            yield from walk(v, '%s[%d]' % (path, i))
    elif isinstance(o, dict):
        for k, v in o.items():
            if k == 'img':
                continue
            yield from walk(v, '%s.%s' % (path, k))


bad = collections.defaultdict(list)
for f in sys.argv[1:]:
    spec = json.load(open(f, encoding='utf-8'))
    for i, q in enumerate(spec['questions'], 1):
        for path, s in walk(q):
            for ch in s:
                if ch in '\n\t ':
                    continue
                if any(m.get(ord(ch), 0) == 0 for m in MAPS.values()):
                    bad[ch].append('%s %d번%s' % (f, i, path))

if not bad:
    print('없는 글자 없음')
for ch, where in sorted(bad.items()):
    print('U+%04X %r — %d곳' % (ord(ch), ch, len(where)))
    for w in where[:6]:
        print('   ', w)
