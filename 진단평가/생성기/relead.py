# -*- coding: utf-8 -*-
"""문항 그림의 줄 간격을 고르게 다시 쌓는다.

매쓰플랫 원본은 선택지에 분수가 섞이면 그 줄만 키가 커진다. 그러면 분수가
없는 두 줄끼리는 중앙 간격이 30%쯤 좁아져 서로 붙어 보인다.

글자는 건드리지 않고, 가로로 잘라 낸 줄을 다시 쌓되
'줄 중앙 사이의 거리'를 그 묶음의 중간값으로 맞춘다.
다만 여백이 원래 있던 최소 여백보다 좁아지지는 않게 막는다.
그림·도형이 든 줄은 따로 떼어 두고 손대지 않는다.
"""
import os
import sys

import numpy as np
from PIL import Image

INK = 200          # 이보다 어두우면 글자로 본다
FIG = 150          # 이보다 키가 크면 그림으로 보고 건드리지 않는다
BREAK = 1.8        # 중간값보다 이만큼 큰 여백은 문단 구분으로 남긴다
TRIGGER = 0.82     # 중앙 간격이 중간값의 이 비율보다 좁은 쌍이 있어야 손을 댄다
MIN_LINES = 4      # 줄이 이보다 적으면 중간값을 믿을 수 없어 손대지 않는다
MAX_RATIO = 2.5    # 한 묶음 안 키 차이가 이보다 크면 성격이 다른 줄이 섞인 것이다


def find_bands(arr):
    rows = (arr < INK).sum(axis=1) > 0
    out, s = [], None
    for y, on in enumerate(rows):
        if on and s is None:
            s = y
        elif not on and s is not None:
            out.append((s, y - 1))
            s = None
    if s is not None:
        out.append((s, len(rows) - 1))
    return out


def plan(bs):
    """각 여백을 얼마로 바꿀지 정한다. 바꿀 게 없으면 None."""
    if len(bs) < 3:
        return None
    gaps = [bs[i][0] - bs[i - 1][1] - 1 for i in range(1, len(bs))]
    med_gap = sorted(gaps)[len(gaps) // 2]

    groups, cur = [], [0]
    for i, g in enumerate(gaps, 1):
        big = (bs[i][1] - bs[i][0] + 1) > FIG or (bs[i - 1][1] - bs[i - 1][0] + 1) > FIG
        if g > med_gap * BREAK or big:
            groups.append(cur)
            cur = [i]
        else:
            cur.append(i)
    groups.append(cur)

    new = dict(enumerate(gaps, 1))     # 여백 i = 띠 i-1과 i 사이
    touched = False
    for g in groups:
        if len(g) < MIN_LINES:
            continue
        hs = [bs[i][1] - bs[i][0] + 1 for i in g]
        if max(hs) > FIG or max(hs) > min(hs) * MAX_RATIO:
            continue
        # 줄 중앙 사이의 거리
        pit = [((bs[g[k + 1]][0] + bs[g[k + 1]][1]) - (bs[g[k]][0] + bs[g[k]][1])) / 2
               for k in range(len(g) - 1)]
        med_pit = sorted(pit)[(len(pit) - 1) // 2]   # 아래쪽 중간값
        if min(pit) >= med_pit * TRIGGER:
            continue                    # 이미 고르다
        floor = min(bs[g[k + 1]][0] - bs[g[k]][1] - 1 for k in range(len(g) - 1))
        for k in range(len(g) - 1):
            half = (hs[k] + hs[k + 1]) / 2
            new[g[k + 1]] = max(floor, round(med_pit - half))
        touched = True
    return new if touched else None


def relead(path):
    im = Image.open(path).convert('RGB')
    bs = find_bands(np.array(im.convert('L')))
    new = plan(bs)
    if not new:
        return False
    top = bs[0][0]
    total = top + sum(b - t + 1 for t, b in bs) + sum(new.values()) + top
    out = Image.new('RGB', (im.width, int(total)), 'white')
    y = top
    for i, (t, b) in enumerate(bs):
        if i:
            y += new[i]
        out.paste(im.crop((0, t, im.width, b + 1)), (0, int(round(y))))
        y += b - t + 1
    out.crop((0, 0, im.width, int(round(y)) + top)).save(path)
    return True


if __name__ == '__main__':
    d = sys.argv[1]
    done = []
    for f in sorted(os.listdir(d)):
        if f.endswith('.png') and relead(os.path.join(d, f)):
            done.append(f[:-4])
    print('%d개 손봄' % len(done))
    with open(os.path.join(d, '_relead.txt'), 'w', encoding='utf-8') as fh:
        fh.write('\n'.join(done))
