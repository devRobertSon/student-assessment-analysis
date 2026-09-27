# -*- coding: utf-8 -*-
"""정답지에서 '번호 + 정답' 한 줄만 띠로 잘라 모은다.

번호가 글자가 아니라 그림인 정답지가 있어 좌표로 번호를 맞히려다 계속 어긋났다.
띠 안에 번호가 그대로 찍혀 있으니, 잘라만 놓고 눈으로 읽으면 틀릴 일이 없다.
"""
import os
import re
import sys

import pypdfium2 as pdfium
from pypdf import PdfReader
from PIL import Image, ImageDraw, ImageFont

SCALE = 2.2
SRC = {'A': '심화형', 'B': '심화', 'C': '응용', 'E': '기본'}
FONT = ImageFont.truetype('C:/Windows/Fonts/malgunbd.ttf', 20)


def labels(page):
    out = []

    def visit(text, cm, tm, font, size):
        if text.strip() == '정답':
            out.append((tm[4], tm[5]))
    page.extract_text(visitor_text=visit)
    mid = float(page.mediabox.width) / 2
    out.sort(key=lambda t: (0 if t[0] < mid else 1, -t[1]))
    return out


def strips(sem, tag):
    path = '%s (%s).pdf' % (sem, SRC[tag])
    rd = PdfReader(path)
    doc = pdfium.PdfDocument(path)
    got = []
    for i, page in enumerate(rd.pages):
        if not re.search(r'\d{2}\s*정답', page.extract_text() or ''):
            continue
        labs = labels(page)
        if not labs:
            continue
        H = float(page.mediabox.height)
        img = doc[i].render(scale=SCALE).to_pil()
        for lx, ly in labs:
            x0 = int(max(0, lx - 62) * SCALE)
            x1 = int(min(float(page.mediabox.width), lx + 250) * SCALE)
            y0 = int((H - ly - 26) * SCALE)
            y1 = int((H - ly + 12) * SCALE)
            y0 = max(0, min(y0, img.height - 20))
            y1 = max(y0 + 20, min(y1, img.height))
            x1 = max(x0 + 40, min(x1, img.width))
            got.append(img.crop((x0, y0, x1, y1)))
    return got


if __name__ == '__main__':
    outdir = sys.argv[1]
    os.makedirs(outdir, exist_ok=True)
    jobs = []
    for sem in ['중1-1', '중1-2', '중2-1', '중2-2']:
        for tag in 'ABCE':
            if os.path.exists('%s (%s).pdf' % (sem, SRC[tag])):
                jobs.append((sem, tag))
    sheet, n = [], 0
    for sem, tag in jobs:
        items = strips(sem, tag)
        print('%s_%s: %d' % (sem, tag, len(items)))
        for k in range(0, len(items), 15):
            grp = items[k:k + 15]
            W = max(t.width for t in grp) + 150
            Hh = sum(t.height + 6 for t in grp) + 34
            c = Image.new('RGB', (W, Hh), 'white')
            d = ImageDraw.Draw(c)
            d.text((8, 6), '%s  %s' % (sem, SRC[tag]), fill='#16224e', font=FONT)
            y = 32
            for t in grp:
                c.paste(t, (8, y))
                y += t.height + 6
                d.line([(0, y - 3), (W, y - 3)], fill='#dcdfe6')
            n += 1
            c.save(os.path.join(outdir, 's%02d_%s_%s.png' % (n, sem, tag)))
    print('띠 묶음 %d장' % n)
