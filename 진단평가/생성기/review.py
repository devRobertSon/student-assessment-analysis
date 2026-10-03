# -*- coding: utf-8 -*-
"""13단계 검수 문서를 만든다. 2026-10-03 뒤에 만드는 시험지용이다.

    python review.py 초6-1

읽는 것
- `{학기}_문항분석/_단계별_결과/_시험지_확정.json`  고른 30문항(번호 차례)
- `{학기}_문항분석/_단계별_결과/_승인.json`         승인받을 것과 그 까닭
- `{학기}_문항분석/*.md`                            문항 풀(pool.py)

쓰는 것
- `{학기}_문항분석/_단계별_결과/13_검수용_시험지.md`

문서 차례는 `문항배정_순서.md` 13단계를 따른다. 맨 앞에 승인받을 두 가지
(주관식으로 바꿀 5문항, 1점 더 받는 5문항)를 두고, 그다음 묶음이 겹치는 짝과
풀이가 닮아 보이는 짝, 끝으로 30문항마다 풀이와 근거를 둔다.

문항 본문이 들어가므로 이 문서는 저장소로 옮기지 않는다(sync.py 가 뺀다).
"""
import collections
import io
import json
import os
import re
import sys

import pool as P
import 경로


def _plain(ans):
    """객관식 답에서 선지 번호를 뗀다. '④ 12 cm' → '12 cm'"""
    return re.sub(r'^[①②③④⑤](,\s*[①②③④⑤])*\s*', '', ans).strip()


def build(grade):
    d = os.path.join(경로.안('%s_문항분석' % grade), '_단계별_결과')
    paper = json.load(io.open(os.path.join(d, '_시험지_확정.json'), encoding='utf-8'))
    ok = json.load(io.open(os.path.join(d, '_승인.json'), encoding='utf-8'))
    pool = {q['id']: q for q in P.load(grade)}
    no = {q['src']: q['no'] for q in paper}

    def tag(k):
        return '%d번 %s' % (no[k], k) if k in no else k

    L = ['# 13단계 검수용 %s 30문항' % grade, '',
         '승인받을 것 둘을 맨 앞에 두었다. 그다음 묶음이 겹치는 짝과 풀이가 닮아 보이는',
         '짝, 끝으로 문항마다 풀이와 근거다. 납득이 안 되는 문항은 버리고 7단계로 돌아간다.', '']

    # 승인 1
    L += ['## 승인받을 것 1 · 객관식에서 주관식으로 바꿀 5문항', '',
          '선지를 떼어도 문제가 그대로 서는 문항 가운데, 선지가 답을 거꾸로 맞춰 보게',
          '하거나 오답을 귀띔하는 것을 골랐다. 단위는 답칸에 미리 적는다.', '',
          '| 번호 | 출처 | 단원 | 난이도 | 답 | 답칸 | 까닭 |', '|---|---|---|---|---|---|---|']
    for q in paper:
        c = ok['convert'].get(q['src'])
        if c:
            L.append('| %d | %s | %s | %s | %s | %s | %s |' % (
                q['no'], q['src'], q['unit'], q['level'], _plain(pool[q['src']]['answer']),
                ('□ ' + c['form']) if c['form'] else '□', c['why']))
    L += ['', ok.get('convertNote', ''), '']
    if ok.get('convertOther'):
        L += ['선지만 떼면 되는 다른 문항: ' + ' · '.join(tag(k) for k in sorted(ok['convertOther'], key=lambda k: no.get(k, 99))) + '.', '']
    if ok.get('convertNo'):
        L += ['선지를 떼면 문제가 서지 않는 문항: ' + ' · '.join(
            '%s(%s)' % (tag(k), v) for k, v in ok['convertNo'].items()) + '.', '']

    # 승인 2
    L += ['## 승인받을 것 2 · 1점 더 받는 5문항', '',
          '형식이 아니라 풀이의 고비 수로 골랐다. 고비는 앞 단계를 해냈어도 새로 떠올려야',
          '하는 생각 하나다.', '',
          '| 번호 | 출처 | 난이도 | 배점 | 까닭 |', '|---|---|---|---|---|']
    for q in paper:
        why = ok['bonus'].get(q['src'])
        if why:
            L.append('| %d | %s | %s | %d → %d | %s |' % (q['no'], q['src'], q['level'],
                                                       q['points'] - 1, q['points'], why))
    if ok.get('bonusOther'):
        L += ['', '견줘 보고 뺀 것']
        L += ['- %s: %s' % (tag(k), v) for k, v in ok['bonusOther'].items()]
    cnt = collections.Counter((q['level'], q['points']) for q in paper)
    parts = ['%s %d점 %d문항' % (lv, p, n) for (lv, p), n in
             sorted(cnt.items(), key=lambda x: (P.LEVELS.index(x[0][0]), x[0][1]))]
    L += ['', '배점: %s. 합 %d점.' % (' · '.join(parts), sum(q['points'] for q in paper)), '']

    # 묶음 짝
    L += ['---', '', '## 묶음이 겹치는 짝', '',
          '같은 단원에서 묶음이 같은 문항은 뼈대가 서로 달라야 한다.', '',
          '| 단원 | 묶음 | 번호 | 출처 | 뼈대 |', '|---|---|---|---|---|']
    by = collections.defaultdict(list)
    for q in paper:
        g = ' + '.join(sorted(c.strip() for c in q['group'].split('+')))
        by[q['unit'], g].append(q)
    pairs = 0
    for (u, g), qs in by.items():
        if len(qs) > 1:
            pairs += 1
            for q in qs:
                L.append('| %s | %s | %d | %s | %s |' % (u, g, q['no'], q['src'], q['skeleton']))
    L += ['', '겹치는 짝 %d개' % pairs, '']

    L += ['## 풀이가 닮아 보이는 짝', '',
          '묶음과 핵심 풀이는 다르지만 나란히 놓고 보실 것. 다르다고 본 까닭을 적었다.', '',
          '| 문항 | 다르다고 본 까닭 |', '|---|---|']
    for a in ok.get('alike', []):
        L.append('| %s | %s |' % (' · '.join(tag(k) for k in a['ids']), a['why']))
    L += ['']

    if ok.get('apart'):
        L += ['## 함께 넣지 않은 무리', '',
              '묶음이나 핵심 풀이의 글은 달라도 풀이가 닮아, 한 무리에서 한 문항만 넣게 했다',
              '(`pick.py --apart`). 굵은 것이 시험지에 든 문항이다.', '',
              '| 풀이 | 문항 |', '|---|---|']
        for a in ok['apart']:
            cap = a.get('cap', 1)
            ids = ' · '.join(('**%s**' % tag(k)) if k in no else k for k in a['ids'])
            L.append('| %s%s | %s |' % (a['why'], '' if cap == 1 else ' (%d문항까지)' % cap, ids))
        L += ['']
    if ok.get('spread'):
        L += ['## 단원 안 난이도', '', ok['spread'], '']

    # 한눈에
    L += ['---', '', '## 한눈에 보기', '',
          '| 번호 | 출처 | 단원 | 묶음 | 주 유형 | 세는 | 난이도 | 형식 | 배점 |',
          '|---|---|---|---|---|---|---|---|---|']
    for q in paper:
        fmt = q['format'] + (' (바꿈)' if q.get('converted') else '')
        L.append('| %d | %s | %s | %s | %s | %s | %s | %s | %d |' % (
            q['no'], q['src'], q['unit'], q['group'], q['type'], q['countAs'] or '',
            q['level'], fmt, q['points']))
    src = collections.Counter(pool[q['src']]['letter'] for q in paper)
    L += ['', '출처: ' + ' · '.join('%s %d' % (k, src[k]) for k in sorted(src)) +
          '. A 입학 심화형 · B 총괄 심화 · C 총괄 응용 · D 입학 일반형 · E 총괄 기본 · F~K 단원 TEST.', '']

    # 문항마다
    for q in paper:
        s = pool[q['src']]
        conv = ok['convert'].get(q['src'])
        L += ['---', '', '## %d번 · %s · %s %d점%s' % (
            q['no'], q['unit'], q['format'], q['points'], ' (객관식에서 바꿈)' if conv else ''), '',
              '출처는 %s 다.' % q['src'], '']
        if conv:
            L += ['선지를 떼고 답칸에 `□%s` 를 둔다.' % ((' ' + conv['form']) if conv['form'] else ''), '']
        L += ['**문항** ' + s['q'], '',
              '**답** ' + (_plain(s['answer']) if conv else s['answer']), '', '**풀이**', '']
        L += ['%d. %s' % (i, t) for i, t in enumerate(s['steps'], 1)]
        L += ['', '**주 유형** %s%s' % (q['type'], (' (%s 로 센다)' % q['countAs']) if q['countAs'] else ''),
              '', s['why'], '', '**부 유형** %s' % (s['sub'] or '없음'), '',
              '**난이도** %s' % q['level'], '', '**묶음** %s' % q['group'], '',
              '**핵심 풀이** %s' % q['method'], '', '(뼈대: %s)' % q['skeleton'], '']
        if q['src'] in ok['bonus']:
            L += ['**1점 더** ' + ok['bonus'][q['src']], '']

    out = os.path.join(d, '13_검수용_시험지.md')
    io.open(out, 'w', encoding='utf-8').write('\n'.join(L).rstrip() + '\n')
    return out


if __name__ == '__main__':
    print(build(sys.argv[1] if len(sys.argv) > 1 else '초6-1'))
