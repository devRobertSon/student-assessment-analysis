# -*- coding: utf-8 -*-
"""문항 이미지를 '지면에 놓인 위치' 기준으로 뽑는다.

pypdf의 page.images는 리소스 사전 순서라 지면 순서와 다르다(앞서 뒤집혀 나왔다).
콘텐츠 스트림의 cm/Do를 따라가 각 이미지의 좌표를 구한 뒤
왼쪽 단 위→아래, 오른쪽 단 위→아래 순으로 정렬해 문항 번호와 짝짓는다.
"""
import os
import re
import sys
from pypdf import PdfReader
from pypdf.generic import ContentStream


def placements(reader, page):
    """페이지에 그려진 이미지들의 (이름, x, y, 폭, 높이)를 그린 순서대로 돌려준다."""
    cs = ContentStream(page.get_contents(), reader)
    ctm = [1, 0, 0, 1, 0, 0]
    stack = []
    out = []
    for operands, op in cs.operations:
        o = op.decode() if isinstance(op, bytes) else op
        if o == 'q':
            stack.append(list(ctm))
        elif o == 'Q':
            ctm = stack.pop() if stack else [1, 0, 0, 1, 0, 0]
        elif o == 'cm':
            a, b, c, d, e, f = [float(x) for x in operands]
            A, B, C, D, E, F = ctm
            ctm = [a * A + b * C, a * B + b * D, c * A + d * C,
                   c * B + d * D, e * A + f * C + E, e * B + f * D + F]
        elif o == 'Do':
            out.append((str(operands[0]), ctm[4], ctm[5], ctm[0], ctm[3]))
    return out


def extract(path, outdir, tag):
    reader = PdfReader(path)
    by_name = {}
    saved = 0
    for page in reader.pages:
        text = page.extract_text() or ''
        nums = re.findall(r'^\s*(\d{2})\s*$', text, re.M)
        if not nums:
            continue  # 정답·해설 쪽
        by_name = {im.name: im.data for im in page.images}
        mid = float(page.mediabox.width) / 2
        items = []
        for name, x, y, w, h in placements(reader, page):
            # 콘텐츠 스트림은 '/img2', pypdf는 'img2.png'로 부른다
            key = name.lstrip('/')
            data = by_name.get(key + '.png') or by_name.get(key) or by_name.get(name)
            if data is None or len(data) <= 5000:
                continue  # 로고·장식
            items.append((0 if x < mid else 1, -y, data))
        items.sort(key=lambda t: (t[0], t[1]))
        for k, (_, _, data) in enumerate(items):
            if k >= len(nums):
                break
            with open(os.path.join(outdir, '%s_%s.png' % (tag, nums[k])), 'wb') as f:
                f.write(data)
            saved += 1
    return saved


if __name__ == '__main__':
    outdir = sys.argv[1]
    os.makedirs(outdir, exist_ok=True)
    jobs = []
    for sem in ['중1-1', '중1-2', '중2-1', '중2-2']:
        for src, t in [('심화형', 'A'), ('심화', 'B'), ('응용', 'C'), ('기본', 'E')]:
            jobs.append(('%s (%s).pdf' % (sem, src), '%s_%s' % (sem, t)))
    log = []
    for path, tag in jobs:
        if not os.path.exists(path):
            continue
        log.append('%s: %d문항' % (tag, extract(path, outdir, tag)))
    with open(os.path.join(outdir, '_log.txt'), 'w', encoding='utf-8') as f:
        f.write('\n'.join(log))
