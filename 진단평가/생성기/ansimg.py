# -*- coding: utf-8 -*-
"""원본 교재의 정답·해설 쪽을 좌우 반쪽씩 이미지로 뽑는다."""
import re, sys, pypdfium2 as pdfium
from pypdf import PdfReader

def pages(path):
    rd = PdfReader(path)
    out = []
    for i, p in enumerate(rd.pages):
        t = p.extract_text() or ''
        if len(re.findall(r'\d\d\s*정답', t)) >= 2:
            out.append(i)
    return out

def crop(path, i, tag, scale=2.0):
    doc = pdfium.PdfDocument(path)
    im = doc[i].render(scale=scale).to_pil()
    W, H = im.size
    names = []
    for k, (a, b) in enumerate(((0, W // 2), (W // 2, W))):
        n = '_c_%s_%d%s.png' % (tag, i + 1, 'LR'[k])
        im.crop((a, 0, b, H)).save(n)
        names.append(n)
    return names

if __name__ == '__main__':
    p = sys.argv[1]
    print(p, pages(p))
