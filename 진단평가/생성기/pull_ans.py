# -*- coding: utf-8 -*-
"""정답지에서 문항별 정답을 뽑는다.

'NN  정답 …' 줄의 오른쪽에 정답이 온다. 객관식 번호(①②③④⑤)나 분수는 이미지로,
정수·간단한 값은 글자로 들어가 있어 둘 다 챙긴다.
결과는 JSON 한 개로 모으고, 이미지인 것만 따로 저장해 눈으로 확인한다.
"""
import json
import os
import re
import sys
from pypdf import PdfReader
from extract2 import placements

MISS = []


def answers(path, outdir, tag, out):
    reader = PdfReader(path)
    for page in reader.pages:
        raw = page.extract_text() or ''
        if not re.search(r'\d{2}\s*정답', raw):
            continue

        frags = []
        def visit(text, cm, tm, font, size):
            t = text.strip()
            if t:
                frags.append((tm[4], tm[5], t))
        page.extract_text(visitor_text=visit)

        labels = [(x, y) for x, y, t in frags if t == '정답']
        blocks = []
        for x, y, t in frags:
            if not re.fullmatch(r'\d{2}', t) or y < 100:
                continue
            same = [(lx, ly) for lx, ly in labels if abs(ly - y) < 12 and lx > x]
            if same:
                blocks.append((t, x, y, min(same)[0]))

        by_name = {im.name: im.data for im in page.images}
        imgs = []
        for name, ix, iy, w, h in placements(reader, page):
            d = by_name.get(name.lstrip('/') + '.png')
            if d is not None:
                imgs.append((ix, iy, d))

        for no, nx, ny, lx in blocks:
            key = '%s_%s' % (tag, no)
            # 같은 줄에서 '정답' 라벨 오른쪽에 오는 글자
            txt = [t for x, y, t in frags
                   if abs(y - ny) < 9 and x > lx + 8 and t != '정답']
            near = [(ix, d) for ix, iy, d in imgs if abs(iy - ny) < 16 and ix > lx + 8]
            rec = {'text': ' '.join(txt).strip()}
            if near:
                near.sort()
                fn = '%s.png' % key
                with open(os.path.join(outdir, fn), 'wb') as f:
                    f.write(near[0][1])
                rec['img'] = fn
            if not rec['text'] and 'img' not in rec:
                MISS.append(key)
            out[key] = rec


if __name__ == '__main__':
    outdir = sys.argv[1]
    os.makedirs(outdir, exist_ok=True)
    out = {}
    for sem in ['중1-1', '중1-2', '중2-1', '중2-2']:
        for src, t in [('심화형', 'A'), ('심화', 'B'), ('응용', 'C'), ('기본', 'E')]:
            p = '%s (%s).pdf' % (sem, src)
            if os.path.exists(p):
                answers(p, outdir, '%s_%s' % (sem, t), out)
    with open(os.path.join(outdir, '_ans.json'), 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=0, sort_keys=True)
    with open(os.path.join(outdir, '_log.txt'), 'w', encoding='utf-8') as f:
        f.write('수집 %d문항 · 글자 %d · 이미지 %d\n못 찾음(%d): %s'
                % (len(out),
                   sum(1 for v in out.values() if v['text']),
                   sum(1 for v in out.values() if 'img' in v),
                   len(MISS), ', '.join(MISS) if MISS else '없음'))
