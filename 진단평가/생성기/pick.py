# -*- coding: utf-8 -*-
"""풀에서 규칙을 다 지키는 30문항 조합을 찾는다. 4~11단계를 돕는다.

    python pick.py 초6-1
    python pick.py 초6-1 --seed 3 --countas 규칙 발견 --out 후보.json

`문항배정_순서.md` 의 기준을 정수계획으로 풀어 조합 하나를 낸다. 어느 문항이
좋은지는 사람이 본다. 이 스크립트는 기준을 다 지키는 조합이 있는지, 있다면
어떤 꼴인지를 빨리 보여 주는 데까지다. `--seed` 를 바꾸면 다른 조합이 나온다.

지키는 것
- 30문항. 단원별 문항 수는 A~E 다섯 벌 평균(pool.py 가 내는 값)
- 난이도 표준 5 · 상 15 · 최상 10
- 유형마다 3~5. 주 유형으로 센다. `--countas` 로 준 유형만 부 유형으로도 센다
- 원래 주관식 5문항
- 한 단원 안에서 묶음은 한 번. 문항 수가 평균보다 많은 단원은 두 번까지 쓰되 뼈대가 달라야 한다
- 핵심 풀이는 시험지 전체에서 한 번
- 겹침 표시로 이어진 문항은 하나만
- 한 출처(A~K)에서 `--per-source` 문항을 넘지 않는다(주지 않으면 상한 없음)

사람이 보고 고칠 때 쓰는 것
- `--spread` 단원마다 표준은 한 문항까지, 최상은 한 문항 이상 단원 문항 수의
  절반까지. 앞의 여덟 장이 모두 단원마다 표준으로 열고 최상으로 닫았다
- `--pin 문항 …` 꼭 넣는다. `--drop 문항 …` 뺀다
- `--apart "문항,문항,…" …` 묶음이나 핵심 풀이 글은 달라도 풀이가 닮은 문항들.
  한 무리에서 하나만 넣는다. `"2:문항,문항,…"` 처럼 앞에 수를 붙이면 그만큼까지
"""
import argparse
import collections
import json
import random
import re

import pulp

import pool as P

LEVEL_TARGET = {'표준': 5, '상': 15, '최상': 10}
TYPE_MIN, TYPE_MAX = 3, 5
ESSAYS = 5
PER_SOURCE = 30


def plan_of(grade, items):
    units = list(dict.fromkeys(u for _, _, u in P.files(grade) if u))
    mixed = [q for q in items if q['letter'] in 'ABCDE']
    cnt = collections.Counter(q['unit'] for q in mixed)
    sets = len({q['letter'] for q in mixed}) or 1
    raw = {u: cnt[u] / sets for u in units}
    plan = {u: int(v) for u, v in raw.items()}
    for u in sorted(units, key=lambda u: -(raw[u] - plan[u]))[:30 - sum(plan.values())]:
        plan[u] += 1
    return units, plan


def solve(grade, seed=0, countas=(), plan=None, per_source=PER_SOURCE,
          spread=False, pin=(), drop=(), apart=()):
    items = P.load(grade)
    units, auto = plan_of(grade, items)
    plan = plan or auto
    rnd = random.Random(seed)
    avg = sum(plan.values()) / len(plan)
    heavy = {u for u, n in plan.items() if n > avg}

    prob = pulp.LpProblem('pick', pulp.LpMaximize)
    x = [pulp.LpVariable('x%d' % i, cat='Binary') for i in range(len(items))]
    # 어느 유형으로 세는가. 주 유형은 늘, 부 유형은 --countas 에 든 유형만
    c = {}
    for i, q in enumerate(items):
        opts = [q['main']] + ([q['sub']] if q['sub'] in countas else [])
        for t in opts:
            c[i, t] = pulp.LpVariable('c%d_%d' % (i, P.TYPES.index(t)), cat='Binary')
        prob += pulp.lpSum(c[i, t] for t in opts) == x[i]

    # 문항이 좋은지는 사람이 본다. 여기서는 기준을 다 지키는 조합 가운데 입학
    # TEST 심화형(A)이 많은 쪽을 고른다. 학생들이 전에 본 시험이라 많을수록
    # 좋다고 원장님이 하셨다. 다만 가장 낮은 우선순위라 기준을 어기면서까지
    # 넣지는 않는다(2026-10-03). 씨앗마다 다른 조합이 나오게 작은 흔들림을 준다.
    prob += pulp.lpSum(((2 if q['letter'] == 'A' else 1) + 0.5 * rnd.random()) * x[i]
                       for i, q in enumerate(items))

    prob += pulp.lpSum(x) == 30
    for u, n in plan.items():
        prob += pulp.lpSum(x[i] for i, q in enumerate(items) if q['unit'] == u) == n
    for lv, n in LEVEL_TARGET.items():
        prob += pulp.lpSum(x[i] for i, q in enumerate(items) if q['level'] == lv) == n
    for t in P.TYPES:
        s = pulp.lpSum(v for (i, tt), v in c.items() if tt == t)
        prob += s >= TYPE_MIN
        prob += s <= TYPE_MAX
    prob += pulp.lpSum(x[i] for i, q in enumerate(items) if q['essay']) == ESSAYS
    for L in {q['letter'] for q in items}:
        prob += pulp.lpSum(x[i] for i, q in enumerate(items) if q['letter'] == L) <= per_source

    by = collections.defaultdict(list)
    for i, q in enumerate(items):
        # 묶음은 개념의 조합이라 적은 차례는 뜻이 없다. 괄호로 시작하는 이름을
        # 사람마다 다르게 늘어놓아도 같은 묶음으로 본다.
        g = tuple(sorted(c.strip() for c in q['group'].split('+') if c.strip()))
        by['g', q['unit'], g].append(i)
        by['s', q['unit'], g, q['skel']].append(i)
        if q['method']:
            by['m', re.sub(r'\s+', '', q['method'])].append(i)
    for k, ids in by.items():
        if len(ids) < 2:
            continue
        cap = (2 if k[1] in heavy else 1) if k[0] == 'g' else 1
        prob += pulp.lpSum(x[i] for i in ids) <= cap

    index = {q['id']: i for i, q in enumerate(items)}
    unknown = [k for k in list(pin) + list(drop) + [k for _, a in apart for k in a] if k not in index]
    if unknown:
        raise SystemExit('풀에 없는 문항: %s' % ', '.join(unknown))
    for k in pin:
        prob += x[index[k]] == 1
    for k in drop:
        prob += x[index[k]] == 0
    for cap, a in apart:
        prob += pulp.lpSum(x[index[k]] for k in a) <= cap
    if spread:
        for u, n in plan.items():
            lv = lambda L: pulp.lpSum(x[i] for i, q in enumerate(items) if q['unit'] == u and q['level'] == L)
            prob += lv('표준') <= 1
            prob += lv('최상') >= 1
            prob += lv('최상') <= max(1, n // 2)
    for i, q in enumerate(items):
        for other in re.split(r'[,\s·]+', q['overlap']):
            j = index.get(other.strip())
            if j is not None and j != i:
                prob += x[i] + x[j] <= 1

    prob.solve(pulp.PULP_CBC_CMD(msg=False, timeLimit=60))
    status = pulp.LpStatus[prob.status]
    if status != 'Optimal':
        return status, plan, []
    chosen = [i for i in range(len(items)) if x[i].value() > 0.5]
    counted = {i: t for (i, t), v in c.items() if v.value() > 0.5}
    out = []
    order = {u: k for k, u in enumerate(units)}
    for i in sorted(chosen, key=lambda i: (order[items[i]['unit']], P.LEVELS.index(items[i]['level']))):
        q = dict(items[i])
        q['countAs'] = counted[i] if counted[i] != q['main'] else None
        out.append(q)
    return status, plan, out


def parse_apart(g):
    cap, _, ids = g.rpartition(':')
    return int(cap or 1), [k.strip() for k in ids.split(',') if k.strip()]


def show(status, plan, out):
    print('결과', status, '· 단원', plan)
    if not out:
        return
    for n, q in enumerate(out, 1):
        print('%2d %-10s %-12s %-3s %s %-6s/%-6s%s | %s | %s'
              % (n, q['id'], q['unit'], q['level'], '주' if q['essay'] else '객', q['main'], q['sub'],
                 (' →' + q['countAs']) if q['countAs'] else '', q['group'], q['method']))
    t = collections.Counter(q['countAs'] or q['main'] for q in out)
    print('유형', dict(t))
    print('출처', dict(collections.Counter(q['letter'] for q in out)))


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('grade')
    ap.add_argument('--seed', type=int, default=0)
    ap.add_argument('--countas', nargs='*', default=[])
    ap.add_argument('--out')
    ap.add_argument('--per-source', type=int, default=PER_SOURCE)
    ap.add_argument('--spread', action='store_true')
    ap.add_argument('--pin', nargs='*', default=[])
    ap.add_argument('--drop', nargs='*', default=[])
    ap.add_argument('--apart', nargs='*', default=[])
    a = ap.parse_args()
    st, plan, out = solve(a.grade, a.seed, tuple(a.countas), per_source=a.per_source, spread=a.spread,
                          pin=a.pin, drop=a.drop, apart=[parse_apart(g) for g in a.apart])
    show(st, plan, out)
    if a.out and out:
        json.dump(out, open(a.out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
