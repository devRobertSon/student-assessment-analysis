# -*- coding: utf-8 -*-
"""학년 진단평가(중1 · 중2 · 중3)를 두 학기 시험지에서 추려 만든다.

    python yearpaper.py 중1          정해 둔 30문항을 검사하고 확정 구성 · 승인 문서 · 스펙을 쓴다
    python yearpaper.py 중1 --보기    검사만 하고 아무것도 쓰지 않는다
    python yearpaper.py 중1 --새로    PICKED 없이 새 조합을 찾아 보인다(쓰지 않는다)

2026-10-15 원장님 말씀. 학기별 진단평가는 학생이 두 장을 봐야 해 시간이 모자란다.
한 학년을 한 장(30문항)으로 만든다. 각 학기 시험지에서 추려 만들어도 된다고 하셨다.

그래서 문항 풀이 아니라 **이미 확정된 학기 시험지 두 장의 60문항**에서 고른다.
60문항은 모두 원장님 검수를 지난 문항이고 정답 · 풀이 · '틀렸다면' 글 · 선지를 뗀
그림이 다 있다. 고르는 기준은 `문항배정_순서.md` 와 pick.py 와 같다.

- 30문항, 두 학기에서 15문항씩
- 단원마다 학기 시험지 문항 수의 절반(반올림 위아래)
- 난이도 표준 5 · 상 15 · 최상 10
- 8유형 3~5문항. 부 유형으로 세는 문항은 가장 적게
- 주관식은 원래 주관식 5 + 학기 시험지에서 이미 선지를 뗀 것 5
- 같은 핵심 풀이 글은 한 문항, 같은 단원 같은 묶음은 한 문항
- 단원마다 표준은 한 문항까지, 최상은 한 문항 이상 절반까지
- 원래 주관식은 한 단원에 한 문항까지
- 위를 다 지키는 조합 가운데 입학 심화형이 많은 쪽(가장 낮은 우선순위)

핵심 풀이 글은 달라도 풀이가 닮은 문항은 사람이 보고 `APART` 에 적었다. 1점 더
받는 5문항은 풀이를 읽고 골라 `BONUS` 에 적었다. 둘 다 13단계에서 승인받는다.

쓰는 것
- `{학년}_문항분석/_단계별_결과/_시험지_확정.json`   check:papers 가 읽는다
- `{학년}_문항분석/_단계별_결과/_승인.json`          승인받을 것과 까닭
- `{학년}_문항분석/_단계별_결과/13_검수용_시험지.md`  원장님께 드리는 문서
- `생성기/spec_m1.json` (m2 · m3)                    paper.py · solution.py · mkcsv.py 가 읽는다
"""
import collections
import io
import json
import math
import os
import re
import sys

import pulp

import 경로

YEARS = {'중1': ['중1-1', '중1-2'], '중2': ['중2-1', '중2-2'], '중3': ['중3-1', '중3-2']}
SEM_CODE = {'중1-1': 'm11', '중1-2': 'm12', '중2-1': 'm21', '중2-2': 'm22', '중3-1': 'm31', '중3-2': 'm32'}
YEAR_CODE = {'중1': 'm1', '중2': 'm2', '중3': 'm3'}
TYPES = ['연산 처리', '공식 활용', '개념 이해', '표현 해석', '규칙 발견', '근거 제시', '단계별 해결', '식 설정']
LEVELS = ['표준', '상', '최상']
LEVEL_TARGET = (5, 15, 10)
BASE = {'표준': 2, '상': 3, '최상': 4}

# 핵심 풀이 글은 다른데 풀이가 닮은 문항들. (상한, [문항]) 은 그 가운데 상한까지,
# ('>=', n, [문항]) 은 n 문항 이상. 학기 시험지에서는 함께 들어간 짝도 있지만,
# 한 학년 30문항에서는 단원마다 문항이 절반이라 같은 것을 두 번 묻는 값이 더 크다.
APART = {
    '중1': [
        (1, ['중1-2:26', '중1-2:30'], '둘 다 평균 식에 중앙값을 함께 쓴다'),
        ('>=', 1, ['중1-2:10', '중1-2:14', '중1-2:16'], '평면도형 네 문항이 모두 원 · 부채꼴로 쏠리지 않게 다각형 문항을 하나 넣는다'),
        (1, ['중1-2:18', '중1-2:21'], '입체도형 세 문항 중 둘이 회전체가 되지 않게'),
    ],
    '중2': [
        (1, ['중2-1:19', '중2-1:20'], '괄호를 풀어 연립방정식을 푸는 같은 한 수에 비례식 한 단계만 더 붙었다'),
        (3, ['중2-2:9', '중2-2:12', '중2-2:13', '중2-2:14', '중2-2:21', '중2-2:22'],
         '도형의 닮음 여덟 문항 중 피타고라스 정리 계열을 셋까지'),
    ],
    '중3': [
        (1, ['중3-2:4', '중3-2:14'], '둘 다 수선을 그어 이등분한 뒤 피타고라스 정리를 쓴다'),
        (1, ['중3-1:22', '중3-1:25', '중3-1:27'], '셋 다 지나는 점을 넣어 이차함수의 상수를 구한다'),
        (1, ['중3-2:13', '중3-2:14', '중3-2:15'], '셋 다 현의 길이를 구한다'),
        (1, ['중3-2:1', '중3-2:7'], '둘 다 피타고라스 정리로 변을 구해 삼각비를 낸다'),
        (2, ['중3-2:1', '중3-2:4', '중3-2:7', '중3-2:14'], '삼각비 · 원에서 피타고라스 정리 계열을 둘까지'),
        (1, ['중3-1:14', '중3-2:30'], '둘 다 곱셈 공식의 변형으로 제곱의 합을 구한다. 핵심 풀이 규칙을 만든 계기와 같은 한 수다'),
    ],
}

# 사람이 보고 정한 30문항. 기준을 다 지키는 조합은 여럿이라(입학 심화형 수만
# 같으면 모두 같은 값) 풀 때마다 달라질 수 있다. 문항 그림과 풀이를 보고 고른 조합을
# 여기 적어 두고, 풀이기는 이 조합이 기준을 다 지키는지 다시 본다. 새 조합을 보려면
# `--새로` 를 준다.
PICKED = {
    '중1': ['중1-1:1', '중1-1:2', '중1-1:6', '중1-1:7', '중1-1:9', '중1-1:11', '중1-1:14', '중1-1:17',
           '중1-1:19', '중1-1:20', '중1-1:23', '중1-1:24', '중1-1:28', '중1-1:29', '중1-1:30',
           '중1-2:1', '중1-2:2', '중1-2:4', '중1-2:7', '중1-2:11', '중1-2:13', '중1-2:15', '중1-2:16',
           '중1-2:17', '중1-2:20', '중1-2:21', '중1-2:25', '중1-2:28', '중1-2:29', '중1-2:30'],
    '중2': ['중2-1:1', '중2-1:2', '중2-1:5', '중2-1:7', '중2-1:9', '중2-1:11', '중2-1:13', '중2-1:15',
           '중2-1:17', '중2-1:18', '중2-1:19', '중2-1:22', '중2-1:24', '중2-1:29', '중2-1:30',
           '중2-2:2', '중2-2:4', '중2-2:5', '중2-2:7', '중2-2:9', '중2-2:10', '중2-2:13', '중2-2:16',
           '중2-2:17', '중2-2:18', '중2-2:20', '중2-2:21', '중2-2:26', '중2-2:28', '중2-2:30'],
    '중3': ['중3-1:1', '중3-1:2', '중3-1:6', '중3-1:7', '중3-1:10', '중3-1:11', '중3-1:13', '중3-1:15',
           '중3-1:18', '중3-1:20', '중3-1:21', '중3-1:23', '중3-1:24', '중3-1:27', '중3-1:29',
           '중3-2:1', '중3-2:3', '중3-2:4', '중3-2:8', '중3-2:9', '중3-2:11', '중3-2:12', '중3-2:15',
           '중3-2:16', '중3-2:19', '중3-2:20', '중3-2:26', '중3-2:28', '중3-2:29', '중3-2:30'],
}

# 풀이가 가장 복잡해 1점 더 받는 5문항. 풀이 단계가 많고 단계마다 앞 단계의
# 결과를 받아 쓰는 문항이다. 보기마다 하나씩 따지는 문항은 단계가 많아도 뺐다.
BONUS = {
    '중1': {
        '중1-1:6': '나머지를 뺀 세 수 → 공약수 → 최대공약수 → 나머지보다 큰지 확인. 네 단계가 이어진다',
        '중1-1:14': '두 곱의 부호에서 부호 관계를 얻고, b 의 부호로 경우를 나눠 대소 조건으로 하나를 버린다',
        '중1-1:23': '양변 정리 → x 를 a 의 식으로 → 자연수 조건 → a 나열 → 두 번째로 큰 값. 다섯 단계가 이어진다',
        '중1-2:16': '두 정다각형의 외각 → 맞붙은 꼭짓점의 각 → 사각형 내각의 합 → 평각에서 빼기. 다섯 단계가 이어진다',
        '중1-2:30': '자료를 늘어놓고 중앙값 자리로 a 를 정한 뒤 그 값을 넣어 평균 식으로 b 를 구한다',
    },
    '중2': {
        '중2-1:5': '순환마디 길이 → 자릿수를 마디 길이로 나눈 몫 · 나머지 → 마디의 합 → 전체 합. 네 단계가 이어진다',
        '중2-1:22': '상수만 있는 두 식으로 해를 구하고, 그 해를 넣어 만든 연립방정식을 다시 푼다. 연립을 두 번 한다',
        '중2-2:7': '합동으로 같은 각 → 외각으로 각의 관계 → 내각의 합 방정식 → 답. 앞 결과를 받아 이어 간다',
        '중2-2:20': '보조선 → 두 무게중심 찾기 → 두 삼각형에서 각각 1/6 넓이 → 합. 다섯 단계가 이어진다',
        '중2-2:30': '한 번의 확률 → 회차마다 앞의 실패를 곱한 확률 → 더하기. 경우를 나눠 이어 간다',
    },
    '중3': {
        '중3-1:27': '꼭짓점 꼴 → 지나는 점으로 a → 옮기기 전 꼭짓점 → 평행이동 거리 → 합. 다섯 단계가 이어진다',
        '중3-1:29': '좌표축 잡기 → 지나는 점으로 식 → 다른 자리의 값 → 수심. 상황을 식으로 세운 뒤 이어 간다',
        '중3-2:19': '접선의 길이가 같음 → 둘레를 접선의 합으로 → 이등변 조건 → 뺄셈. 네 단계가 이어진다',
        '중3-2:20': '호의 비 → 원주각 나누기 → 중심각 → 부채꼴 호의 길이로 반지름. 네 개념을 이어 쓴다',
        '중3-2:30': '평균에서 a+b → 분산 식 → 전개 → a+b 를 넣어 제곱의 합. 네 단계가 이어진다',
    },
}


def load_sem(sem):
    """학기 시험지 하나. 확정 구성(묶음 · 핵심 풀이 · 근거)과 스펙(그림 · 풀이)을 잇는다."""
    d = os.path.join(경로.안('%s_문항분석' % sem), '_단계별_결과')
    fixed = json.load(io.open(os.path.join(d, '_시험지_확정.json'), encoding='utf-8'))
    spec = json.load(io.open(os.path.join(경로.안('생성기'), 'spec_%s.json' % SEM_CODE[sem]), encoding='utf-8'))
    qs = spec['questions']
    if len(fixed) != len(qs):
        raise SystemExit('%s: 확정 구성 %d문항, 스펙 %d문항' % (sem, len(fixed), len(qs)))
    out = []
    for f, s in zip(fixed, qs):
        if (f['unit'], f['type'], f['level']) != (s['unit'], s['type'], s['level']):
            raise SystemExit('%s %s번: 확정 구성과 스펙이 다른 문항을 가리킨다' % (sem, f['no']))
        conv = s['img'].endswith('_주관식.png')
        out.append(dict(
            key='%s:%s' % (sem, f['no']), sem=sem, no=int(f['no']), src=f['src'], unit=f['unit'],
            type=f['type'], subType=f.get('subType') or None, level=f['level'],
            converted=conv, orig_essay=bool(s.get('essay')) and not conv,
            group=f['group'], skeleton=f.get('skeleton', ''), method=f['method'], reason=f['reason'], spec=s,
        ))
    return out


def solve(year, fresh=False):
    sems = YEARS[year]
    items = [q for s in sems for q in load_sem(s)]
    index = {q['key']: i for i, q in enumerate(items)}
    units = list(dict.fromkeys(q['unit'] for q in items))
    sem_n = collections.Counter(q['unit'] for q in items)

    prob = pulp.LpProblem('year', pulp.LpMaximize)
    x = [pulp.LpVariable('x%d' % i, cat='Binary') for i in range(len(items))]
    c = {}
    for i, q in enumerate(items):
        opts = [q['type']] + ([q['subType']] if q['subType'] in TYPES else [])
        for t in opts:
            c[i, t] = pulp.LpVariable('c%d_%d' % (i, TYPES.index(t)), cat='Binary')
        prob += pulp.lpSum(c[i, t] for t in opts) == x[i]
    sub_use = pulp.lpSum(v for (i, t), v in c.items() if t != items[i]['type'])
    a_count = pulp.lpSum(x[i] for i, q in enumerate(items) if '심화형' in q['src'])
    prob += -100 * sub_use + a_count

    sel = lambda hit: pulp.lpSum(x[i] for i, q in enumerate(items) if hit(q))
    prob += pulp.lpSum(x) == 30
    for s in sems:
        prob += sel(lambda q, s=s: q['sem'] == s) == 15
    for u in units:
        prob += sel(lambda q, u=u: q['unit'] == u) >= math.floor(sem_n[u] / 2)
        prob += sel(lambda q, u=u: q['unit'] == u) <= math.ceil(sem_n[u] / 2)
        prob += sel(lambda q, u=u: q['unit'] == u and q['level'] == '표준') <= 1
        prob += sel(lambda q, u=u: q['unit'] == u and q['level'] == '최상') >= 1
        prob += 2 * sel(lambda q, u=u: q['unit'] == u and q['level'] == '최상') <= sel(lambda q, u=u: q['unit'] == u) + 1
        prob += sel(lambda q, u=u: q['unit'] == u and q['orig_essay']) <= 1
    for lv, n in zip(LEVELS, LEVEL_TARGET):
        prob += sel(lambda q, lv=lv: q['level'] == lv) == n
    for t in TYPES:
        s_ = pulp.lpSum(v for (i, tt), v in c.items() if tt == t)
        prob += s_ >= 3
        prob += s_ <= 5
    prob += sel(lambda q: q['orig_essay']) == 5
    prob += sel(lambda q: q['converted']) == 5
    by = collections.defaultdict(list)
    for i, q in enumerate(items):
        g = tuple(sorted(p.strip() for p in q['group'].split('+') if p.strip()))
        by['g', q['unit'], g].append(i)
        by['m', re.sub(r'\s+', '', q['method'])].append(i)
    for ids in by.values():
        if len(ids) > 1:
            prob += pulp.lpSum(x[i] for i in ids) <= 1
    for e in APART.get(year, []):
        if e[0] == '>=':
            prob += pulp.lpSum(x[index[k]] for k in e[2]) >= e[1]
        else:
            prob += pulp.lpSum(x[index[k]] for k in e[1]) <= e[0]
    if not fresh:
        for k in PICKED.get(year, []):
            prob += x[index[k]] == 1

    prob.solve(pulp.PULP_CBC_CMD(msg=False, timeLimit=60))
    if pulp.LpStatus[prob.status] != 'Optimal':
        why = '정해 둔 30문항(PICKED)이 기준을 어긴다' if PICKED.get(year) and not fresh else '기준을 다 지키는 조합이 없다'
        raise SystemExit('%s: %s (%s)' % (year, why, pulp.LpStatus[prob.status]))
    counted = {i: t for (i, t), v in c.items() if v.value() > 0.5}
    order = {u: k for k, u in enumerate(units)}
    chosen = sorted((i for i in range(len(items)) if x[i].value() > 0.5),
                    key=lambda i: (order[items[i]['unit']], LEVELS.index(items[i]['level']), items[i]['no']))
    out = []
    for i in chosen:
        q = dict(items[i])
        q['countAs'] = counted[i] if counted[i] != q['type'] else None
        out.append(q)
    return out


def src_of(q):
    """한 학년짜리에서는 어느 학기 시험지에서 왔는지 붙인다. '중1 입학 일반형' 처럼
    이미 학년 · 학기가 붙은 것은 그대로 둔다."""
    s = q['spec']['src']
    return s if s.startswith('중') else '%s %s' % (q['sem'], s)


def build(year, write=True, fresh=False):
    out = solve(year, fresh)
    bonus = BONUS[year]
    keys = [q['key'] for q in out]
    missing = [k for k in bonus if k not in keys]
    if missing:
        raise SystemExit('%s: 1점 더 받을 문항이 고른 30문항에 없다: %s' % (year, missing))
    for n, q in enumerate(out, 1):
        q['n'] = n
        q['points'] = BASE[q['level']] + (1 if q['key'] in bonus else 0)
    show(year, out)
    if not write:
        return
    d = os.path.join(경로.안('%s_문항분석' % year), '_단계별_결과')
    os.makedirs(d, exist_ok=True)

    fixed = [dict(
        no=q['n'], src='%s %s' % (q['sem'], q['src']), unit=q['unit'], type=q['type'],
        subType=q['subType'], countAs=q['countAs'], level=q['level'],
        format='주관식' if (q['orig_essay'] or q['converted']) else '객관식',
        converted=q['converted'], points=q['points'], group=q['group'], skeleton=q['skeleton'],
        method=q['method'], reason=q['reason'],
    ) for q in out]
    dump(os.path.join(d, '_시험지_확정.json'), fixed)

    num = {q['key']: q['n'] for q in out}
    approve = {
        '학년': year,
        '만든 날': '2026-10-15',
        '어디서': '%s 진단평가 두 장(60문항)에서 추렸다' % ' · '.join(YEARS[year]),
        'converted': {str(num[q['key']]): '%s %d번에서 이미 선지를 뗀 문항' % (q['sem'], q['no'])
                      for q in out if q['converted']},
        'bonus': {str(num[k]): why for k, why in bonus.items()},
        'apart': [{'문항': e[-2] if e[0] != '>=' else e[2], '까닭': e[-1]} for e in APART.get(year, [])],
    }
    dump(os.path.join(d, '_승인.json'), approve)

    spec = {'title': '%s 진단평가' % year, 'grade': year, 'bonusBy': '풀이', 'questions': []}
    for q in out:
        s = dict(q['spec'])
        s['src'] = src_of(q)
        s['countAs'] = q['countAs']
        s['points'] = q['points']
        s['essay'] = bool(q['orig_essay'] or q['converted'])
        spec['questions'].append(s)
    dump(os.path.join(경로.안('생성기'), 'spec_%s.json' % YEAR_CODE[year]), spec)

    io.open(os.path.join(d, '13_검수용_시험지.md'), 'w', encoding='utf-8').write(review(year, out, approve))
    print('썼다: _시험지_확정.json · _승인.json · 13_검수용_시험지.md · spec_%s.json' % YEAR_CODE[year])


def fmt_of(q):
    return '원래 주관식' if q['orig_essay'] else ('바꾼 주관식' if q['converted'] else '객관식')


def review(year, out, approve):
    C = collections.Counter
    L = ['# %s 진단평가 검수 (13단계)' % year, '',
         '%s. 학기 시험지에서 이미 검수를 마친 문항만 썼다. 한 학년 30문항, 100점.' % approve['어디서'], '']
    L += ['## 승인받을 것 1. 주관식으로 바꾼 5문항', '',
          '모두 학기 시험지에서 원장님이 이미 선지를 떼기로 하신 문항이다. 그림도 그때 만든 것을 쓴다.', '',
          '| 번호 | 원래 자리 | 단원 | 난이도 |', '|---|---|---|---|']
    L += ['| %d | %s %d번 | %s | %s |' % (q['n'], q['sem'], q['no'], q['unit'], q['level']) for q in out if q['converted']]
    L += ['', '## 승인받을 것 2. 1점 더 받는 5문항', '', '| 번호 | 원래 자리 | 난이도 | 까닭 |', '|---|---|---|---|']
    L += ['| %d | %s %d번 | %s | %s |' % (q['n'], q['sem'], q['no'], q['level'], BONUS[year][q['key']])
          for q in out if q['key'] in BONUS[year]]
    L += ['', '## 함께 넣지 않은 문항', '',
          '핵심 풀이 글은 달라도 풀이가 닮아 함께 넣지 않았다. 학기 시험지의 핵심 풀이 겹침 11쌍은 같은 글이라 저절로 걸렀다.', '']
    L += ['- %s: %s' % (' · '.join(e['문항']), e['까닭']) for e in approve['apart']]
    L += ['', '## 구성', '',
          '- 단원 %s' % ' · '.join('%s %d' % kv for kv in C(q['unit'] for q in out).items()),
          '- 유형 %s' % ' · '.join('%s %d' % (t, C(q['countAs'] or q['type'] for q in out)[t]) for t in TYPES),
          '- 난이도 %s' % ' · '.join('%s %d' % (lv, C(q['level'] for q in out)[lv]) for lv in LEVELS),
          '- 형식 객관식 %d · 원래 주관식 %d · 바꾼 주관식 %d' % (
              sum(fmt_of(q) == '객관식' for q in out), sum(q['orig_essay'] for q in out), sum(q['converted'] for q in out)),
          '- 입학 심화형 %d문항' % sum('심화형' in q['src'] for q in out), '',
          '## 30문항', '',
          '| 번호 | 원래 자리 | 단원 | 유형 | 난이도 | 형식 | 배점 | 핵심 풀이 |', '|---|---|---|---|---|---|---|---|']
    L += ['| %d | %s %d번 | %s | %s | %s | %s | %d | %s |' % (
        q['n'], q['sem'], q['no'], q['unit'], q['countAs'] or q['type'], q['level'], fmt_of(q), q['points'], q['method'])
        for q in out]
    return '\n'.join(L) + '\n'


def show(year, out):
    print('== %s' % year)
    for q in out:
        mark = ' +1' if q['points'] > BASE[q['level']] else ''
        print('%2d. %s %2d번 | %s | %s | %s | %s | %d점%s' % (
            q['n'], q['sem'], q['no'], q['unit'], q['level'], fmt_of(q), q['countAs'] or q['type'], q['points'], mark))
    print('   총점 %d' % sum(q['points'] for q in out))


def dump(path, obj):
    io.open(path, 'w', encoding='utf-8', newline='\n').write(json.dumps(obj, ensure_ascii=False, indent=2) + '\n')


if __name__ == '__main__':
    args = sys.argv[1:]
    years = [a for a in args if a in YEARS] or list(YEARS)
    fresh = '--새로' in args
    for y in years:
        # 새 조합은 보기만 한다. 쓰려면 PICKED 를 고친다
        build(y, write='--보기' not in args and not fresh, fresh=fresh)
