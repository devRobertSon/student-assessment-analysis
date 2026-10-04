# -*- coding: utf-8 -*-
"""한 학기 문항 풀(`{학기}_문항분석/*.md`)을 읽어 점검하고 통계를 낸다.

    python pool.py 초6-1

문항 분석 문서의 꼴은 `{학기}_문항분석/_읽는법.md` 에 있다. 이 스크립트는
1단계(풀 읽기)를 마친 뒤 돌린다. 빠진 칸이나 모르는 유형 이름이 있으면 짚고,
3단계에 쓸 표(단원 × 난이도, 유형별 개수, A~E 다섯 벌의 단원 배분)를 낸다.

다른 스크립트가 `load(학기)` 로 문항 목록을 가져다 쓴다.

한 해짜리(초5 · 초6)는 두 학기 풀과 한 해짜리 입학 TEST 의 새 문항을 합친다.
문항 이름 앞에 학기를 붙여 `6-1 단원1-07` · `6-2 심화형-12` · `6 심화형-13` 처럼
가른다. 두 학기에 같은 이름의 단원(초6 의 분수의 나눗셈 · 소수의 나눗셈)은
`분수의 나눗셈(1학기)` 처럼 학기를 붙인다. 한 해짜리 입학 TEST 에서 학기 교재와
그림까지 같은 문항은 다시 읽지 않고 파일 머리의 표로 짝만 적는다.
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
# 한 해짜리 시험지와 그 두 학기
YEAR = {'초5': ['초5-1', '초5-2'], '초6': ['초6-1', '초6-2']}
# 문항 이름. 한 해짜리에서는 앞에 `6-1 ` 같은 학기가 붙는다
ID = r'(?:(?<![\d-])(\d-\d|\d) )?((?:단원\d+|심화형|심화|응용|일반형|기본)-\d+)'


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
    # 굵은 글씨(**…**)로 적은 목록도 있다. 표시는 떼고 이름만 쓴다
    return [c.strip().strip('*').strip() for c in ' '.join(m.group(1).split()).split('·')] if m else []


def overlap_ids(text, prefix=''):
    """겹침 표시 글에서 문항 이름을 뽑는다. 학기가 없는 이름에는 prefix 를 붙인다."""
    out = []
    for sem, k in re.findall(ID, text or ''):
        out.append(('%s %s' % (sem, k)) if sem else (prefix + k))
    return out


def load(grade):
    """문항 목록. 문항마다 dict 하나."""
    if grade in YEAR:
        return load_year(grade)
    return load_plain(grade)


def load_plain(grade):
    """{학기}_문항분석 폴더 하나를 그대로 읽는다."""
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
            out[-1]['overlap_ids'] = overlap_ids(out[-1]['overlap'])
    return out


def sem_units(sem):
    return [u for _, _, u in files(sem) if u]


def year_unit(grade, sem, u):
    """한 해짜리 시험지에 쓰는 단원 이름. 두 학기에 같은 이름이 있으면 학기를 붙인다."""
    a, b = (sem_units(x) for x in YEAR[grade])
    if u in a and u in b:
        return '%s(%s학기)' % (u, sem[-1])
    return u


def year_same(grade):
    """한 해짜리 입학 TEST 에서 학기 교재와 같은 문항. {(글자, 번호): '6-1 심화형-02'}"""
    out = {}
    for path, letter, _ in files(grade):
        raw = io.open(path, encoding='utf-8').read()
        for no, other in re.findall(r'^\|\s*\S+-(\d+)\s*\|\s*(\d-\d \S+-\d+)\s*\|', raw, re.M):
            out[letter, int(no)] = other
    return out


def load_year(grade):
    out = []
    for sem in YEAR[grade]:
        tag = sem[1:]
        for q in load(sem):
            q = dict(q)
            q['id'] = '%s %s' % (tag, q['id'])
            q['sem'] = sem
            q['unit'] = year_unit(grade, sem, q['unit'])
            q['unitSem'] = sem
            q['overlap_ids'] = overlap_ids(q['overlap'], tag + ' ')
            out.append(q)
    tag = grade[1:]
    for q in load_plain(grade):
        q = dict(q)
        m = re.match(r'(\d-\d) (.+)$', q['unit'])
        sem = '초' + m.group(1) if m else None
        q['id'] = '%s %s' % (tag, q['id'])
        q['sem'] = grade
        q['unit'] = year_unit(grade, sem, m.group(2)) if m else q['unit']
        q['unitSem'] = sem
        q['overlap_ids'] = overlap_ids(q['overlap'], tag + ' ')
        out.append(q)
    return out


def unit_concepts(grade):
    """{단원 이름: 개념 목록}. 단원 차례대로."""
    out = {}
    for sem in YEAR.get(grade, [grade]):
        for path, letter, unit in files(sem):
            if unit:
                out[year_unit(grade, sem, unit) if grade in YEAR else unit] = concepts(path)
    return out


def plan(grade, items=None):
    """단원별 문항 수(합 30). (단원 차례, {단원: 수}, {단원: 평균}) 을 돌려준다.

    학기 시험지는 A~E 다섯 벌의 평균이다. 한 해짜리는 한 해짜리 입학 TEST 두 벌과,
    두 학기의 같은 글자를 이어 붙여 반으로 줄인 다섯 벌, 모두 일곱 벌의 평균이다.
    한 해짜리 입학 TEST 에서 학기 교재와 같은 문항은 짝지은 학기 문항의 단원으로 센다.
    """
    items = items if items is not None else load(grade)
    units = list(unit_concepts(grade))
    sets = []
    if grade in YEAR:
        same = year_same(grade)
        byid = {q['id']: q for q in items}
        for L in 'AD':
            c = collections.Counter(q['unit'] for q in items if q['sem'] == grade and q['letter'] == L)
            for (l, no), other in same.items():
                if l == L and other in byid:
                    c[byid[other]['unit']] += 1
            sets.append((c, 1.0))
        for L in 'ABCDE':
            c = collections.Counter(q['unit'] for q in items
                                    if q['sem'] in YEAR[grade] and q['letter'] == L)
            if c:
                sets.append((c, 0.5))
    else:
        for L in 'ABCDE':
            c = collections.Counter(q['unit'] for q in items if q['letter'] == L)
            if c:
                sets.append((c, 1.0))
    n = len(sets) or 1
    raw = {u: sum(c[u] * w for c, w in sets) / n for u in units}
    cnt = {u: int(v) for u, v in raw.items()}
    for u in sorted(units, key=lambda u: -(raw[u] - cnt[u]))[:30 - sum(cnt.values())]:
        cnt[u] += 1
    return units, cnt, raw


def check(grade):
    pool = load(grade)
    bad = []
    units = unit_concepts(grade)
    for u, cs in units.items():
        if not cs:
            bad.append('%s: 개념 목록이 없다' % u)
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
    order, cnt, raw = plan(grade, pool)
    print('\n단원 배분 (30문항 환산, 큰 나머지부터 올림)')
    for u in order:
        print('   %-18s 평균 %4.1f → %d' % (u, raw[u], cnt[u]))
    print('\n점검: %s' % ('어긋난 것 없음' if not bad else '%d건' % len(bad)))
    for b in bad:
        print('   !! ' + b)
    return not bad


if __name__ == '__main__':
    ok = report(sys.argv[1] if len(sys.argv) > 1 else '초6-1')
    sys.exit(0 if ok else 1)
