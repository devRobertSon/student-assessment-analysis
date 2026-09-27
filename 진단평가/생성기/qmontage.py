# -*- coding: utf-8 -*-
"""해설을 검증할 때 쓰는 문항 묶음 그림. 스펙 순서대로 번호를 붙여 이어 붙인다."""
import json, sys
from PIL import Image, ImageDraw
spec, lo, hi, out = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), sys.argv[4]
qs = json.load(open(spec, encoding='utf-8'))['questions'][lo-1:hi]
W = 760
parts = []
for i, q in enumerate(qs, lo):
    im = Image.open(q['img']).convert('RGB')
    im = im.resize((W, int(im.height * W / im.width)))
    parts.append((i, im))
h = sum(i.height for _, i in parts) + 24 * len(parts)
c = Image.new('RGB', (W, h), (235, 235, 235))
d = ImageDraw.Draw(c); y = 2
for n, im in parts:
    d.text((6, y + 3), '%d번' % n, fill='red')
    y += 18
    c.paste(im, (0, y)); y += im.height + 6
c.save(out); print(out, c.size)
