# -*- coding: utf-8 -*-
"""스펙 하나에서 시험지 · 출제표 CSV 두 개를 만든다.

표를 코드에 따로 적어 두면 스펙을 고칠 때 한쪽만 바뀌어 어긋난다.
정답도 단원도 스펙에만 적고, 인쇄물은 전부 여기서 뽑는다.

엑셀이 한글을 깨뜨리지 않도록 BOM을 붙인다. 줄끝은 .gitattributes 가
어차피 LF 로 맞추므로 처음부터 LF 로 쓴다.
"""
import io
import json
import os
import sys


def q(v):
    """쉼표나 따옴표가 들어 있으면 감싼다. 수식 표시 백틱은 뗀다."""
    s = str(v).replace('`', '')
    return '"%s"' % s.replace('"', '""') if any(c in s for c in ',"\n') else s


def counted(x):
    """세는 유형. 비워 두면 주 유형이다. 앱의 리포트가 이 열을 쓴다."""
    return x.get('countAs') or x['type']


def write(path, rows):
    body = '\n'.join(','.join(q(c) for c in r) for r in rows) + '\n'
    io.open(path, 'w', encoding='utf-8-sig', newline='').write(body)
    return os.path.basename(path)


def build(spec, outdir):
    title = spec['title']
    base = title.replace(' ', '_')
    names = {k: '%s_%s.%s' % (base, k, 'pdf' if k in ('문제지', '해설') else 'csv')
             for k in ('문제지', '해설', '출제표')}
    qs = spec['questions']
    made = []

    # 시험지 — 앱이 읽어 시험지를 등록하는 파일. 인쇄물 이름은 첫 줄에만 적는다.
    rows = [['시험지', '과목', '문항번호', '단원', '유형', '주유형', '부유형',
             '난이도', '형식', '배점', '정답', '출처', '원문항',
             '문제지', '해설', '출제표']]
    for i, x in enumerate(qs, 1):
        fmt = '주관식' if x['essay'] else '객관식'
        tail = [names['문제지'], names['해설'], names['출제표']] if i == 1 else ['', '', '']
        rows.append([title, '수학', i, x['unit'], counted(x), x['type'],
                     x.get('subType') or '', x['level'], fmt,
                     x['points'], x['answer'], x['src'], x['srcno']] + tail)
    made.append(write(os.path.join(outdir, '%s_시험지.csv' % base), rows))

    # 출제표 — 사람이 보는 표.
    rows = [['문항', '단원', '유형', '주유형', '부유형', '난이도', '형식', '배점',
             '출처', '원문항', '정답']]
    for i, x in enumerate(qs, 1):
        rows.append([i, x['unit'], counted(x), x['type'], x.get('subType') or '',
                     x['level'], '주관식' if x['essay'] else '객관식',
                     x['points'], x['src'], x['srcno'], x['answer']])
    made.append(write(os.path.join(outdir, '%s_출제표.csv' % base), rows))
    return made


if __name__ == '__main__':
    spec = json.load(open(sys.argv[1], encoding='utf-8'))
    print(' · '.join(build(spec, sys.argv[2])))
