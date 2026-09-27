# -*- coding: utf-8 -*-
"""중3 · 공통수학 문항 조각을 뽑는다. 뽑는 방법은 extract2.py 와 같다.

출처 글자는 조판규칙과 같다. A 입학 심화형 · B 총괄 심화 · C 총괄 응용 ·
D 입학 일반형 · E 총괄 기본 · F 부터 그 학기의 첫 단원부터 차례로 붙인다.
한 해짜리 입학 TEST 는 학기 없이 `중3` · `공통수학` 으로 적는다.
"""
import io
import os
import sys

from extract2 import extract

ROMAN = {
    u'중3-1': u'ⅠⅡⅢⅣ',
    u'중3-2': u'ⅤⅥⅦ',
    u'공통수학1': u'ⅠⅡⅢⅣ',
    u'공통수학2': u'ⅠⅡⅢ',
}
SRC = [(u'심화형', 'A'), (u'심화', 'B'), (u'응용', 'C'), (u'일반형', 'D'), (u'기본', 'E')]


def jobs(src_dir):
    out = []
    for sem, rn in ROMAN.items():
        for name, tag in SRC:
            out.append((u'%s (%s).pdf' % (sem, name), u'%s_%s' % (sem, tag)))
        for i, r in enumerate(rn):
            for f in os.listdir(src_dir):
                if f.startswith(u'%s (%s_' % (sem, r)) and f.endswith('.pdf'):
                    out.append((f, u'%s_%s' % (sem, 'FGHIJ'[i])))
                    break
    # 한 해짜리 입학 TEST
    out.append((u'중3 (심화형).pdf', u'중3_A'))
    out.append((u'중3 (일반형).pdf', u'중3_D'))
    out.append((u'공통수학(1,2) (심화형).pdf', u'공통수학_A'))
    out.append((u'공통수학(1,2) (일반형).pdf', u'공통수학_D'))
    return out


if __name__ == '__main__':
    src_dir = os.path.abspath(sys.argv[1])
    outdir = os.path.abspath(sys.argv[2])
    os.makedirs(outdir, exist_ok=True)
    log = []
    for path, tag in jobs(src_dir):
        full = os.path.join(src_dir, path)
        if not os.path.exists(full):
            log.append(u'%s : 원본 없음 (%s)' % (tag, path))
            continue
        log.append(u'%s : %d문항' % (tag, extract(full, outdir, tag)))
    io.open(os.path.join(outdir, '_log3.txt'), 'w', encoding='utf-8').write(u'\n'.join(log))
    print(u'\n'.join(log))
