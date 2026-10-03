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

# 1점 더 받는 문항 수. 객관식에서 선지만 뗀 간단한 주관식은 객관식과 배점이
# 같아 세지 않는다. 2026년 10월 3일에 원장님이 정했다. 그 전에는 주관식이 늘 5였다.
#
# 같은 날 새로 만드는 시험지(초6-1 부터)는 규칙이 다르다. 스펙 맨 위에
# "bonusBy": "풀이" 를 적는다. 주관식은 원래 5 + 선지만 뗀 5 이고, 형식과
# 상관없이 풀이가 가장 복잡한 5문항이 1점 더 받는다. 기존 여덟 장은 그대로다.
웃돈주관식 = 5
원래주관식, 바꾼주관식 = 5, 5
객관식배점 = {'표준': 2, '상': 3, '최상': 4}
유형최소, 유형최대 = 3, 5
# 유형 상한을 넘겨도 되는 시험지. 중3-1 은 22·30번을 이차함수의 활용 문항으로
# 바꾸며 식 설정이 7문항이 되었다. 활용 문항이 모두 식 설정이라 피할 수 없어
# 2026년 10월 3일에 원장님이 이 장만 예외로 두기로 했다. `문항배정_순서.md` 끝을 본다.
유형예외 = {'중3-1 진단평가': {'식 설정': 7}}
# 정답칸에 학생이 쓰는 것. 숫자와 분수이고, π 와 √ 가 든 것도 수로 본다.
# `16π + 60` 처럼 π 가 든 넓이는 식째 쓴다. 칸에 `(□π + □)` 를 찍으면 답의
# 꼴을 알려 주게 된다. 보기에서 고르는 문항은 `ㄴ, ㄷ, ㅁ` 처럼 기호를 쓴다.
수 = r'[-−+×/().π√0-9 ]*[0-9π][-−+×/().π√0-9 ]*'
보기 = r'[ㄱ-ㅎ](?:, *[ㄱ-ㅎ])*'
# 스펙의 `cm^2` 와 정답칸에 찍는 `cm²` 를 같게 본다
첨자 = {'^2': '²', '^3': '³'}


def 칸에맞나(q):
    """주관식 정답이 정답칸의 꼴과 맞는지. 맞지 않으면 까닭을, 맞으면 None.

    학생은 정답칸에 숫자만 쓴다. 단위와 기호는 `ansForm` 으로 미리 찍는다.
    """
    a = q['answer'].replace('`', '')
    for k, v in 첨자.items():
        a = a.replace(k, v)
    form = q.get('ansForm') or '{}'
    pat = '(.+?)'.join(re.escape(p) for p in form.split('{}'))
    m = re.fullmatch(pat, a)
    if not m:
        return '정답 %r 이 정답칸 꼴 %r 과 안 맞는다' % (a, form)
    for g in m.groups():
        if not (re.fullmatch(수, g.strip()) or re.fullmatch(보기, g.strip())):
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
    if spec.get('bonusBy') == '풀이':
        conv = [q for q in ess if q['img'].endswith('_주관식.png')]
        hard = [n for n, q in enumerate(qs, 1)
                if q['points'] == 객관식배점.get(q['level'], 0) + 1]
        print('%s주관식 %d · 원래 %d · 선지 뗀 것 %d'
              % (ok(len(ess) - len(conv) == 원래주관식 and len(conv) == 바꾼주관식),
                 len(ess), len(ess) - len(conv), len(conv)))
        print('%s풀이가 복잡해 1점 더 받는 문항 %d %s'
              % (ok(len(hard) == 웃돈주관식), len(hard), hard))
    else:
        print('%s주관식 %d (%d점) · 그중 1점 더 받는 것 %d'
              % (ok(len(bonus) == 웃돈주관식), len(ess), sum(q['points'] for q in ess),
                 len(bonus)))
    상한 = dict.fromkeys(types, 유형최대)
    상한.update(유형예외.get(spec['title'], {}))
    맞다 = (len(types) == 8
          and min(types.values()) >= 유형최소
          and all(n <= 상한[t] for t, n in types.items()))
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
