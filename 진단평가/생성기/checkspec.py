# -*- coding: utf-8 -*-
"""시험지 스펙이 설계 조건을 지키는지 본다."""
import collections, json, os, sys

def check(f):
    spec = json.load(open(f, encoding='utf-8'))
    qs = spec['questions']
    units = collections.Counter(q['unit'] for q in qs)
    types = collections.Counter(q['type'] for q in qs)
    levels = collections.Counter(q['level'] for q in qs)
    adv = sum(1 for q in qs if '심화형' in q['src'])
    ess = [q for q in qs if q['essay']]
    pts = sum(q['points'] for q in qs)
    miss = [q['img'] for q in qs if not os.path.exists(q['img'])]
    dup = [k for k, v in collections.Counter(q['img'] for q in qs).items() if v > 1]
    bad = [q['img'] for q in qs if not q.get('answer') or not q.get('steps') or not q.get('miss')]

    print('\n=== %s (%s) ===' % (spec['title'], f))
    ok = lambda c: 'OK ' if c else '!! '
    print('%s문항 %d' % (ok(len(qs) == 30), len(qs)))
    print('%s배점 %d' % (ok(pts == 100), pts))
    print('   입학 심화형 %d' % adv)
    # 서술형 수는 시험지마다 다르게 설계했다(중1-1 은 7, 나머지는 5).
    want = 7 if '중1-1' in spec['title'] else 5
    print('%s서술형 %d (%d점)' % (ok(len(ess) == want), len(ess), sum(q['points'] for q in ess)))
    print('%s8유형 최소 %d  %s' % (ok(min(types.values()) >= 3 and len(types) == 8),
                                min(types.values()), dict(types)))
    print('   단원 %s' % dict(units))
    print('   난이도 %s' % dict(levels))
    if dup:  print('!! 중복 %s' % dup)
    if miss: print('!! 그림 없음 %s' % miss)
    if bad:  print('!! 정답/풀이/오답 빠짐 %s' % bad)

for f in sys.argv[1:]:
    check(f)
