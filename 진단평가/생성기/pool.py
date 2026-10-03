# -*- coding: utf-8 -*-
"""한 학기 문항 풀(`{학기}_문항분석/*.md`)을 읽어 점검하고 통계를 낸다.

    python pool.py 초6-1

문항 분석 문서의 꼴은 `{학기}_문항분석/_읽는법.md` 에 있다. 이 스크립트는
1단계(풀 읽기)를 마친 뒤 돌린다. 빠진 칸이나 모르는 유형 이름이 있으면 짚고,
3단계에 쓸 표(단원 × 난이도, 유형별 개수, A~E 다섯 벌의 단원 배분)를 낸다.

다른 스크립트가 `load(학기)` 로 문항 목록을 가져다 쓴다.
"""
import collections
import io
import os
import re
import sys

import 경로

TYPES = ['연산 처리', '공식 활용', '개념 이해', '표현 해석', '규칙 발견', '근거 제시', '단계별 해결', '식 설정']
LEVELS = ['표준', '상', '최상']
# A~E 파일 이름과 글자. 단원 TEST 파일은 앞 번호 차례대로 F, G, H … 다
MIXED = {'입학_심화형': 'A', '총괄_심화': 'B', '총괄_응용': 'C', '입학_일반형': 'D', '총괄_기본': 'E'}
UNIT_LETTERS = 'FGHIJK'


def _field(body, name):
    m = re.search(r'\*\*%s\*\*[ \t]*(.*)' % re.escape(name), body)
    return m.group(1).strip() if m else ''


def _block(body, start, end):
    m = re.search(r'\*\*%s\*\*\s*(.*?)\n\s*\n\*\*%s' % (start, end), body, re.S)
    return ' '.join(m.group(1).split()) if m else ''


def files(grade):
    """(파일 경로, 글자, 단원 이름 또는 None) 을 파일 번호 차례로."""
    d = 경로.안('%s_문항분석' % grade)
    out = []
    names = sorted((f for f in os.listdir(d) if re.match(r'^\d+_.*\.md$', f)),
                   key=lambda f: int(f.split('_')[0]))
    k = 0
    for f in names:
        stem = f[f.index('_') + 1:-3]
        if stem in MIXED:
            out.append((os.path.join(d, f), MIXED[stem], None))
        else:
            out.append((os.path.join(d, f), UNIT_LETTERS[k], stem.replace('_', ' ')))
            k += 1
    return out


def concepts(path):
    """단원 TEST 파일 머리의 개념 목록."""
    raw = io.open(path, encoding='utf-8').read()
    m = re.search(r'이 단원의 개념은 이렇다\.\s*\n\s*\n(.*?)\n\s*\n', raw, re.S)
    return [c.strip() for c in ' '.join(m.group(1).split()).split('·')] if m else []


def load(grade):
    """문항 목록. 문항마다 dict 하나."""
    out = []
    for path, letter, unit in files(grade):
        raw = io.open(path, encoding='utf-8').read()
        for part in re.split(r'\n## ', raw)[1:]:
            head, body = part.split('\n', 1)
            head = head.strip()
            bits = head.split(' · ')
            qid = bits[0].replace('(주관식)', '').strip()
            u = (bits[1].replace('(주관식)', '').strip() if len(bits) > 1 else unit)
            no = int(re.search(r'(\d+)$', qid).group(1))
            sol = re.search(r'\*\*풀이\*\*\s*\n(.*?)\n\s*\n\*\*주 유형', body, re.S)
            steps = [re.sub(r'^\d+\.\s*', '', ' '.join(s.split()))
                     for s in re.split(r'\n(?=\d+\. )', sol.group(1).strip())] if sol else []
            why = re.search(r'\*\*주 유형\*\*[^\n]*\n\s*\n(.*?)\n\s*\n\*\*부 유형', body, re.S)
            skel = re.search(r'\(뼈대:\s*(.*?)\)', body, re.S)
            out.append({
                'id': qid, 'no': no, 'letter': letter, 'unit': u, 'file': os.path.basename(path),
                'img': '../문항/%s_%s_%02d.png' % (grade, letter, no),
                'essay': '주관식' in head,
                'q': _block(body, '문항', '답'),
                'answer': _field(body, '답'),
                'steps': steps,
                'main': _field(body, '주 유형'),
                'why': ' '.join(why.group(1).split()) if why else '',
                'sub': _field(body, '부 유형'),
                'level': _field(body, '난이도'),
                'group': _field(body, '묶음'),
                'overlap': _field(body, '겹침 표시'),
                'method': _field(body, '핵심 풀이'),
                'skel': ' '.join(skel.group(1).split()) if skel else '',
            })
    return out


def check(grade):
    pool = load(grade)
    bad = []
    units = {}
    for path, letter, unit in files(grade):
        if unit:
            units[unit] = concepts(path)
            if not units[unit]:
                bad.append('%s: 개념 목록이 없다' % os.path.basename(path))
    seen = collections.Counter(q['id'] for q in pool)
    for k, n in seen.items():
        if n > 1:
            bad.append('%s 가 %d번 나온다' % (k, n))
    for q in pool:
        where = '%s %s' % (q['file'], q['id'])
        for k in ('q', 'answer', 'main', 'why', 'level', 'group', 'method', 'skel'):
            if not q[k]:
                bad.append('%s: %s 칸이 비었다' % (where, k))
        if not q['steps']:
            bad.append('%s: 풀이가 없다' % where)
        if q['main'] and q['main'] not in TYPES:
            bad.append('%s: 주 유형 %r' % (where, q['main']))
        if q['sub'] and q['sub'] not in TYPES + ['없음']:
            bad.append('%s: 부 유형 %r' % (where, q['sub']))
        if q['sub'] == q['main']:
            bad.append('%s: 주 유형과 부 유형이 같다' % where)
        if q['level'] and q['level'] not in LEVELS:
            bad.append('%s: 난이도 %r' % (where, q['level']))
        if q['unit'] not in units:
            bad.append('%s: 단원 %r 이 단원 TEST 에 없다' % (where, q['unit']))
        else:
            for c in q['group'].split('+'):
                if c.strip() and c.strip() not in units[q['unit']]:
                    bad.append('%s: 묶음의 %r 이 %s 개념 목록에 없다' % (where, c.strip(), q['unit']))
        if not os.path.exists(경로.그림(q['img'])):
            bad.append('%s: 그림 %s 이 없다' % (where, q['img']))
        if q['essay'] == any(c in q['answer'] for c in '①②③④⑤'):
            bad.append('%s: 주관식 표시와 답의 꼴이 안 맞는다 (%s)' % (where, q['answer']))
    return pool, units, bad


def report(grade):
    pool, units, bad = check(grade)
    print('== %s 문항 %d · 파일 %d' % (grade, len(pool), len(files(grade))))
    for f, n in sorted(collections.Counter(q['file'] for q in pool).items(),
                       key=lambda x: int(x[0].split('_')[0])):
        print('   %-32s %d' % (f, n))
    print('\n단원 × 난이도 (주관식)')
    for u in units:
        qs = [q for q in pool if q['unit'] == u]
        lv = collections.Counter(q['level'] for q in qs)
        print('   %-18s 표준 %3d · 상 %3d · 최상 %3d · 계 %3d · 주관식 %d'
              % (u, lv['표준'], lv['상'], lv['최상'], len(qs), sum(q['essay'] for q in qs)))
    print('\n주 유형 · 부 유형')
    mains = collections.Counter(q['main'] for q in pool)
    subs = collections.Counter(q['sub'] for q in pool)
    for t in TYPES:
        print('   %-6s 주 %3d · 부 %3d' % (t, mains[t], subs[t]))
    mixed = [q for q in pool if q['letter'] in 'ABCDE']
    if mixed:
        print('\nA~E 다섯 벌의 단원 배분 (30문항 환산, 큰 나머지부터 올림)')
        cnt = collections.Counter(q['unit'] for q in mixed)
        sets = len({q['letter'] for q in mixed})
        raw = {u: cnt[u] / sets for u in units}
        plan = {u: int(v) for u, v in raw.items()}
        for u in sorted(units, key=lambda u: -(raw[u] - plan[u]))[:30 - sum(plan.values())]:
            plan[u] += 1
        for u in units:
            print('   %-18s 합 %3d · 평균 %4.1f → %d' % (u, cnt[u], raw[u], plan[u]))
    print('\n점검: %s' % ('어긋난 것 없음' if not bad else '%d건' % len(bad)))
    for b in bad:
        print('   !! ' + b)
    return not bad


if __name__ == '__main__':
    ok = report(sys.argv[1] if len(sys.argv) > 1 else '초6-1')
    sys.exit(0 if ok else 1)
