# -*- coding: utf-8 -*-
"""확정 구성에서 조판 스펙을 만든다. 2026-10-03 뒤에 만드는 시험지용이다.

    python mkspec.py 초6

읽는 것
- `{학기}_문항분석/_단계별_결과/_시험지_확정.json`  고른 30문항
- `{학기}_문항분석/_단계별_결과/_승인.json`         바꾼 주관식의 답칸 꼴, 손본 답과 글
- 문항 풀(pool.py)

쓰는 것: `생성기/spec_{코드}.json`. 코드는 초6-1 → e61, 초6 → e6, 초5 → e5.

바꾼 주관식은 선지를 뗀 `_주관식.png` 를 쓴다(nochoice.py 로 먼저 만든다). 답에서
선지 번호를 떼고, `_승인.json` 의 `form` 으로 정답칸 꼴을 붙인다. 원래 주관식은
답 끝의 단위를 보고 정답칸 꼴을 짐작한다. 짐작이 안 되는 답(`13/4 cm (= 3 1/4 cm)`
처럼 두 꼴을 함께 적은 것)은 `_승인.json` 의 `answers` 에 적는다.

바꾼 문항의 '틀렸다면' 글이 선지 번호를 가리키면 멈춘다. `_승인.json` 의 `miss`
에 고친 글을 적는다.
"""
import json
import os
import re
import sys

import pool as P
import 경로

CODE = {'초6-1': 'e61', '초6': 'e6', '초5': 'e5', '초6-2': 'e62', '초5-1': 'e51', '초5-2': 'e52'}
NAME = {'A': '입학 심화형', 'B': '총괄 심화', 'C': '총괄 응용', 'D': '입학 일반형', 'E': '총괄 기본'}
UNIT = r'(cm²|cm³|m²|m³|km|cm|mm|m|kg|g|mL|L|개|명|권|장|번|원|시간|분|초|°|배|자루|그루|층|대|마리|살|쪽|가지|송이|병|봉지|상자|도막|모|cm\^2|cm\^3)'
CIRCLED = '①②③④⑤'


def src_name(grade, q):
    """출처 이름. 한 해짜리는 학기를 붙인다."""
    sem = q.get('sem', grade)
    if q['letter'] in NAME:
        name = NAME[q['letter']]
        # 학기 시험지의 총괄은 학기를 적지 않는다(초6-1 과 같게). 입학은 적는다
        if grade not in P.YEAR and name.startswith('총괄'):
            return name
        return '%s %s' % (sem, name)
    k = 'FGHIJK'.index(q['letter']) + 1
    return ('%s 단원 TEST %d' % (sem, k)) if grade in P.YEAR else '단원 TEST %d' % k


def guess_form(answer):
    a = answer.replace('`', '').strip()
    if '(' in a or '=' in a or ',' in a:
        return None, False
    m = re.fullmatch(r'(.+?)\s*' + UNIT, a)
    if not m:
        return None, True
    sep = '' if m.group(2)[0] in '개명권장번원분초°배자그층대마살쪽가송병봉상도모' else ' '
    return '{}' + sep + m.group(2), True


def build(grade):
    d = os.path.join(경로.안('%s_문항분석' % grade), '_단계별_결과')
    paper = json.load(open(os.path.join(d, '_시험지_확정.json'), encoding='utf-8'))
    ok = json.load(open(os.path.join(d, '_승인.json'), encoding='utf-8'))
    pool = {q['id']: q for q in P.load(grade)}
    answers = ok.get('answers', {})
    misses = ok.get('miss', {})
    adds = ok.get('stepsAdd', {})
    bad, qs = [], []
    for p in paper:
        s = pool[p['src']]
        conv = ok['convert'].get(p['src'])
        q = {
            'img': s['img'].replace('.png', '_주관식.png') if conv else s['img'],
            'src': src_name(grade, s), 'srcno': s['no'], 'unit': p['unit'], 'type': p['type'],
            'subType': p['subType'], 'countAs': p['countAs'], 'level': p['level'], 'points': p['points'],
            'essay': p['format'] == '주관식', 'answer': s['answer'], 'steps': list(s['steps']),
            'miss': misses.get(p['src'], s['why']),
        }
        if p['src'] in answers:
            q['answer'], form = answers[p['src']]
            if form:
                q['ansForm'] = form
        elif conv:
            q['answer'] = re.sub(r'^[①②③④⑤]\s*', '', s['answer'])
            if conv.get('form'):
                q['ansForm'] = '{} ' + conv['form'] if conv['form'][0].isascii() else '{}' + conv['form']
        elif q['essay']:
            form, sure = guess_form(q['answer'])
            if not sure:
                bad.append('%d번 %s: 정답 %r 의 정답칸 꼴을 정하지 못했다. _승인.json answers 에 적는다'
                           % (p['no'], p['src'], q['answer']))
            if form:
                q['ansForm'] = form
        # 풀이 줄이 문항 문장을 그대로 옮겨 sync 가 멈출 때 고쳐 쓴 풀이로 바꾼다
        if p['src'] in ok.get('steps', {}):
            q['steps'] = list(ok['steps'][p['src']])
        if p['src'] in adds:
            q['steps'][-1] += ' ' + adds[p['src']]
        if conv and any(c in q['miss'] for c in CIRCLED):
            bad.append('%d번 %s: 바꾼 문항의 틀렸다면 글이 선지 번호를 가리킨다. _승인.json miss 에 고친 글을 적는다'
                       % (p['no'], p['src']))
        if conv and not os.path.exists(경로.그림(q['img'])):
            bad.append('%d번 %s: %s 이 없다. nochoice.py 로 만든다' % (p['no'], p['src'], q['img']))
        qs.append(q)
    if bad:
        raise SystemExit('\n'.join(bad))
    spec = {'title': '%s 진단평가' % grade, 'grade': grade, 'bonusBy': '풀이', 'questions': qs}
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'spec_%s.json' % CODE[grade])
    json.dump(spec, open(out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    return out, qs


if __name__ == '__main__':
    out, qs = build(sys.argv[1])
    print(out)
    for n, q in enumerate(qs, 1):
        if q['essay']:
            print('  %2d %-28s %-22s %s' % (n, os.path.basename(q['img']), q['answer'], q.get('ansForm', '')))
