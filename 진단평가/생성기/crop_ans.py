# -*- coding: utf-8 -*-
"""정답지에서 문항별 '정답 + 해설' 덩어리를 잘라 낸다.

큰 문항 번호가 글자가 아니라 그림인 정답지가 있어, 번호 글자로 찾으면 어긋난다.
'정답'이라는 라벨은 어느 정답지에나 글자로 있으므로, 그 라벨을 지면 순서
(왼쪽 단 위→아래, 오른쪽 단)로 세어 1번부터 차례로 매긴다.
잘라 낸 그림에는 번호가 함께 찍혀 있어 눈으로 다시 확인할 수 있다.
"""
import collections
import json
import os
import re
import sys

import pypdfium2 as pdfium
from pypdf import PdfReader

SCALE = 1.9
SRC = {'A': '심화형', 'B': '심화', 'C': '응용', 'E': '기본'}


def label_positions(page):
    """'정답' 라벨의 (x, y) — 단의 왼쪽 끝에 붙은 것만 고른다."""
    frags = []

    def visit(text, cm, tm, font, size):
        if text.strip() == '정답':
            frags.append((round(tm[4], 1), tm[5]))
    page.extract_text(visitor_text=visit)
    # 라벨은 단마다 들여쓰기가 달라 x가 여러 값으로 나온다. 거르지 말고 모두 쓴다.
    mid = float(page.mediabox.width) / 2
    frags.sort(key=lambda t: (0 if t[0] < mid else 1, -t[1]))
    return frags


def crop_all(sem, tag, wanted, outdir):
    """wanted(번호 문자열 집합)에 해당하는 덩어리를 잘라 저장한다."""
    path = '%s (%s).pdf' % (sem, SRC[tag])
    rd = PdfReader(path)
    doc = pdfium.PdfDocument(path)
    made = {}
    for i, page in enumerate(rd.pages):
        raw = page.extract_text() or ''
        nums = re.findall(r'(\d{2})\s*정답', raw)
        if not nums:
            continue
        labs = label_positions(page)
        if len(labs) != len(nums):
            print('  %s %s %d쪽: 라벨 %d / 번호 %d — 건너뜀'
                  % (sem, tag, i + 1, len(labs), len(nums)))
            continue
        mid = float(page.mediabox.width) / 2
        H = float(page.mediabox.height)
        W = float(page.mediabox.width)
        img = None
        for (lx, ly), no in zip(labs, nums):
            if no not in wanted:
                continue
            same = [y for x, y in labs if (x < mid) == (lx < mid) and y < ly]
            bottom = max(same) + 8 if same else 46
            if img is None:
                img = doc[i].render(scale=SCALE).to_pil()
            x0 = int(max(0, lx - 44) * SCALE)
            x1 = int((mid - 6 if lx < mid else W - 20) * SCALE)
            y0 = int((H - ly - 20) * SCALE)
            y1 = int((H - bottom) * SCALE)
            if y1 - y0 < 60:            # 덩어리가 너무 얇으면 최소 높이를 준다
                y1 = y0 + 190
            y0 = max(0, min(y0, img.height - 40))
            y1 = max(y0 + 40, min(y1, img.height))
            x0 = max(0, min(x0, img.width - 40))
            x1 = max(x0 + 40, min(x1, img.width))
            out = os.path.join(outdir, '%s_%s_%s.png' % (sem, tag, no))
            img.crop((x0, y0, x1, y1)).save(out)
            made[no] = out
    return made


if __name__ == '__main__':
    outdir = sys.argv[1]
    os.makedirs(outdir, exist_ok=True)
    keys = json.load(open(sys.argv[2], encoding='utf-8'))
    by_src = collections.defaultdict(set)
    for k in keys:
        sem, tag, no = k.rsplit('_', 2)
        by_src[(sem, tag)].add(no)
    done = 0
    for (sem, tag), nos in sorted(by_src.items()):
        done += len(crop_all(sem, tag, nos, outdir))
    print('%d/%d' % (done, len(keys)))
