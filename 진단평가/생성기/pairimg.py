# -*- coding: utf-8 -*-
"""후보 문항과 그 정답 크롭을 위아래로 붙여 한 장으로 만든다.
정답은 크롭 맨 위에 있으므로 아래쪽 해설은 잘라 낸다."""
import sys
from PIL import Image, ImageDraw
W, KEYH = 700, 150
sem = sys.argv[1]
nums = [int(x) for x in sys.argv[2].split(',')]
out = sys.argv[3]
parts = []
for n in nums:
    for lab, p, cap in (('문항', 'p3/%s_A_%02d.png' % (sem, n), None),
                        ('정답', 'key/%s_A_%02d.png' % (sem, n), KEYH)):
        try:
            im = Image.open(p).convert('RGB')
        except FileNotFoundError:
            continue
        # 정답 크롭은 원래 작아서 크게 늘리면 글자가 화면을 넘는다. 2배까지만.
        scale = min(W / im.width, 2.0) if cap else W / im.width
        im = im.resize((int(im.width * scale), int(im.height * scale)))
        if cap and im.height > cap:
            im = im.crop((0, 0, im.width, cap))
        parts.append(('A%02d %s' % (n, lab), im))
h = sum(i.height for _, i in parts) + 26 * len(parts)
c = Image.new('RGB', (W, h), (236, 236, 236))
d = ImageDraw.Draw(c)
y = 2
for lab, im in parts:
    d.text((6, y + 4), lab, fill='red')
    y += 18
    c.paste(im, (0, y))
    y += im.height + 8
c.save(out)
print(out, c.size)
