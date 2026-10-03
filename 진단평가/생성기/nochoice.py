# -*- coding: utf-8 -*-
"""객관식 문항 조각에서 선지 줄을 떼어 주관식 조각을 만든다.

2026년 10월 3일에 원장님이 객관식 몇 문항을 선지만 떼어 주관식으로 바꾸기로
했다. 원본 조각은 그대로 두고 `{이름}_주관식.png` 를 새로 만든다. 스펙의 `img`
를 그것으로 바꾼다.

선지는 조각 맨 아래에 있고 위 글과 넓게 떨어져 있다. 글자가 있는 줄을 띠로
묶어 맨 아래 띠를 선지 줄 수만큼 떼어 낸다. 3개·2개로 두 줄인 선지가 흔해서
기본은 두 줄이다. 한 줄에 다섯이면 `:1`, 한 줄에 하나씩이면 `:5` 를 붙인다.

**뗀 그림은 꼭 눈으로 본다.** 띠를 세는 것이라 줄 수를 잘못 주면 문항 글이
잘리거나 선지가 남는다.

    python nochoice.py 중1-1_F_04 중1-1_F_15
    python nochoice.py 중1-1_A_20:1
"""
import os
import sys

from PIL import Image

import 경로

INK = 160          # 이보다 어두우면 글자로 본다
# 수 카드 테두리처럼 연한 색 선은 INK 로는 글자로 안 보여 잘린다. 2026-10-03 초6-1
# 단원1-16 에서 카드 아래 절반이 잘렸다. 띠로 자를 자리를 정한 뒤 선지 바로 위까지
# 이보다 어두운 것이 있으면 그 아래까지 남긴다.
LIGHT = 235
MARGIN = 1         # 위아래 흰 여백. 꺼낸 조각과 같게 1px 를 남긴다
WIDE = 50          # 선지 위 빈 줄이 이보다 좁으면 줄 수를 잘못 준 것일 수 있다


def bands(im):
    """글자가 있는 줄을 위에서부터 [시작, 끝) 으로 묶는다."""
    w, h = im.size
    px = im.load()
    rows = [any(px[x, y] < INK for x in range(w)) for y in range(h)]
    out, y = [], 0
    while y < h:
        if rows[y]:
            s = y
            while y < h and rows[y]:
                y += 1
            out.append((s, y))
        y += 1
    return out


def cut(name, lines=2):
    src = 경로.안('문항', name + '.png')
    im = Image.open(src)
    b = bands(im.convert('L'))
    if len(b) <= lines:
        raise SystemExit('%s: 글자 띠가 %d개뿐이라 선지 %d줄을 뗄 수 없다' % (name, len(b), lines))
    keep = b[-lines - 1][1] + MARGIN
    g, (w, _) = im.convert('L').load(), im.size
    light = [y for y in range(keep, b[-lines][0] - 6) if any(g[x, y] < LIGHT for x in range(w))]
    if light:
        keep = light[-1] + 1 + MARGIN
    gap = b[-lines][0] - keep
    out = 경로.안('문항', name + '_주관식.png')
    im.crop((0, 0, im.size[0], keep)).save(out)
    note = '' if gap >= WIDE else '  !! 선지 위 빈 줄이 %dpx 로 좁다. 줄 수를 확인하라' % gap
    print('%s  %d → %dpx  선지 %d줄 · 위 빈 줄 %dpx%s'
          % (os.path.basename(out), im.size[1], keep, lines, gap, note))


if __name__ == '__main__':
    if len(sys.argv) < 2:
        raise SystemExit(__doc__)
    for arg in sys.argv[1:]:
        name, _, n = arg.partition(':')
        cut(name, int(n) if n else 2)
