# -*- coding: utf-8 -*-
"""스펙과 인쇄물이 어긋나지 않았는지 대조한다.

문제지·해설은 PDF 라 눈으로 봐야 하지만, 출제표와 시험지 CSV 는 스펙에서
바로 나온 값이라 글자 단위로 맞출 수 있다. 스펙만 고치고 CSV 를 다시 뽑는 것을
잊으면 여기서 걸린다.
"""
import csv, io, json, sys

P = 'C:/Users/quddn/Documents/student-assessment-analysis/app/public/papers/'

for tag, g in (('m11', '중1-1'), ('m12', '중1-2'), ('m21', '중2-1'), ('m22', '중2-2')):
    spec = json.load(open('spec_%s.json' % tag, encoding='utf-8'))
    qs = spec['questions']
    bad = []
    for name, cols in (('출제표', ['단원', '유형', '난이도', '형식', '배점', '출처', '원문항', '정답']),
                       ('시험지', ['단원', '유형', '난이도', '형식', '배점', '정답', '출처', '원문항'])):
        rows = list(csv.DictReader(io.open('%s%s_진단평가_%s.csv' % (P, g, name), encoding='utf-8-sig')))
        if len(rows) != len(qs):
            bad.append('%s 행 수 %d != %d' % (name, len(rows), len(qs)))
            continue
        for i, (r, q) in enumerate(zip(rows, qs), 1):
            want = {'단원': q['unit'], '유형': q['type'], '난이도': q['level'],
                    '형식': '서술형' if q['essay'] else '객관식',
                    '배점': str(q['points']), '출처': q['src'],
                    '원문항': str(q['srcno']), '정답': q['answer']}
            for c in cols:
                if r[c] != want[c]:
                    bad.append('%s %d번 %s: 표 %r vs 스펙 %r' % (name, i, c, r[c], want[c]))
    print('%-6s %s' % (g, '모두 일치' if not bad else '어긋남 %d곳' % len(bad)))
    for b in bad[:6]:
        print('   ', b)
