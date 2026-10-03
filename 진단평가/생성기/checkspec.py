# -*- coding: utf-8 -*-
"""시험지 스펙이 설계 조건을 지키는지 본다.

유형은 countAs 가 있으면 그것으로 센다. 한 문항이 두 유형에 걸칠 때 어느
쪽으로 셀지 정해 둔 값이다. 이것을 안 세면 멀쩡한 시험지가 불합격으로
나온다. 2026년 9월 29일에 여덟 장을 훑다가 찾았다.
"""
import collections
import json
import os
import re
import sys

import 경로

# 1점 더 받는 주관식 수. 객관식에서 선지만 뗀 간단한 주관식은 객관식과 배점이
# 같아 세지 않는다. 2026년 10월 3일에 원장님이 정했다. 그 전에는 주관식이 늘 5였다.
웃돈주관식 = 5
객관식배점 = {'표준': 2, '상': 3, '최상': 4}
유형최소, 유형최대 = 3, 5
# 정답칸에 학생이 쓰는 것. 숫자와 분수만이다
수 = r'-?[0-9]+(?:\.[0-9]+)?(?:/[0-9]+)?'


def 칸에맞나(q):
    """주관식 정답이 정답칸의 꼴과 맞는지. 맞지 않으면 까닭을, 맞으면 None.

    학생은 정답칸에 숫자만 쓴다. 단위와 기호는 `ansForm` 으로 미리 찍는다.
    """
    a = q['answer'].replace('`', '')
    form = q.get('ansForm') or '{}'
    pat = '(.+?)'.join(re.escape(p) for p in form.split('{}'))
    m = re.fullmatch(pat, a)
    if not m:
        return '정답 %r 이 정답칸 꼴 %r 과 안 맞는다' % (a, form)
    for g in m.groups():
        if not re.fullmatch(수, g.strip()):
            return '정답칸에 숫자 말고 %r 를 써야 한다. ansForm 으로 미리 찍는다' % g.strip()
    return None


def check(f):
    spec = json.load(open(f, encoding='utf-8'))
    qs = spec['questions']
    units = collections.Counter(q['unit'] for q in qs)
    types = collections.Counter(q.get('countAs') or q['type'] for q in qs)
    levels = collections.Counter(q['level'] for q in qs)
    adv = sum(1 for q in qs if '심화형' in q['src'])
    ess = [q for q in qs if q['essay']]
    bonus = [q for q in ess if q['points'] == 객관식배점.get(q['level'], 0) + 1]
    form = [(n, why) for n, q in enumerate(qs, 1) if q['essay']
            for why in [칸에맞나(q)] if why]
    pts = sum(q['points'] for q in qs)
    miss = [q['img'] for q in qs if not os.path.exists(경로.그림(q['img']))]
    dup = [k for k, v in collections.Counter(q['img'] for q in qs).items()
           if v > 1]
    bad = [q['img'] for q in qs
           if not q.get('answer') or not q.get('steps') or not q.get('miss')]

    print('\n=== %s (%s) ===' % (spec['title'], f))
    def ok(c):
        return 'OK ' if c else '!! '
    print('%s문항 %d' % (ok(len(qs) == 30), len(qs)))
    print('%s배점 %d' % (ok(pts == 100), pts))
    print('   입학 심화형 %d' % adv)
    print('%s주관식 %d (%d점) · 그중 1점 더 받는 것 %d'
          % (ok(len(bonus) == 웃돈주관식), len(ess), sum(q['points'] for q in ess),
             len(bonus)))
    맞다 = (len(types) == 8
          and min(types.values()) >= 유형최소
          and max(types.values()) <= 유형최대)
    print('%s8유형 %d~%d  %s'
          % (ok(맞다), min(types.values()), max(types.values()), dict(types)))
    print('   단원 %s' % dict(units))
    print('   난이도 %s' % dict(levels))
    if dup:
        print('!! 중복 %s' % dup)
    if miss:
        print('!! 그림 없음 %s' % miss)
    if bad:
        print('!! 정답/풀이/오답 빠짐 %s' % bad)
    for n, why in form:
        print('!! %d번 %s' % (n, why))


for f in sys.argv[1:]:
    check(f)
