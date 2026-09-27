# -*- coding: utf-8 -*-
"""해설에 쓴 수학 기호를 인쇄 글꼴이 가진 글자로만 바꾼다.

맑은 고딕에는 위 첨자 ⁰⁵⁶⁷⁸⁹ 와 ≈, 그리고 순환소수의 점(U+0307)이 없다.
없는 글자는 오류 없이 빈칸으로 인쇄되어, 2⁵ 은 2 로, 0.5̇ 은 0.5 로 나온다.
해설의 식이 소리 없이 틀리는 것이라 표기 자체를 바꾼다.

위 첨자 ²³⁴ 는 글꼴에 있으므로 cm² 처럼 그대로 두어도 된다. 다만 한 문항 안에
2⁴ 과 2^7 이 섞이면 읽기 나쁘므로, 없는 첨자를 쓴 문항만 통째로 ^n 으로 맞춘다.
"""
import json
import re
import sys

SUP = {'\u2070': '0', '\u00b9': '1', '\u00b2': '2', '\u00b3': '3', '\u2074': '4',
       '\u2075': '5', '\u2076': '6', '\u2077': '7', '\u2078': '8', '\u2079': '9'}
PLAIN = {'\u27e8': '\u3008', '\u27e9': '\u3009',   # ⟨⟩ → 〈〉
         '\u2248': '\u2252',                       # ≈  → ≒
         '\u22ef': '\u2026',                       # ⋯  → …
         '\u2212': '-'}                            # −  → -

SUP_RUN = re.compile('[%s]+' % ''.join(SUP))
MISSING = '⁰⁵⁶⁷⁸⁹'   # 맑은 고딕에 없는 위 첨자
# 0.1̇5̇ 처럼 소수점 뒤 숫자 일부에 순환점이 찍힌 꼴
REPEAT = re.compile(r'(\d+)\.((?:\d\u0307?)+)')


def unsup(s):
    return SUP_RUN.sub(lambda m: '^' + ''.join(SUP[c] for c in m.group()), s)


def unrepeat(s):
    """0.5̇ → 0.555…  /  0.1̇5̇ → 0.151515…  (순환마디를 세 번 펴 준다)"""
    def one(m):
        head, body = m.group(1), m.group(2)
        if '\u0307' not in body:
            return m.group()
        digits = [(body[i], i + 1 < len(body) and body[i + 1] == '\u0307')
                  for i in range(len(body)) if body[i] != '\u0307']
        first = next(i for i, (_, d) in enumerate(digits) if d)
        last = len(digits) - 1 - next(i for i, (_, d) in enumerate(reversed(digits)) if d)
        pre = ''.join(c for c, _ in digits[:first])
        cyc = ''.join(c for c, _ in digits[first:last + 1])
        return '%s.%s%s\u2026' % (head, pre, cyc * 3)
    return REPEAT.sub(one, s)


def fix(s, sup):
    for a, b in PLAIN.items():
        s = s.replace(a, b)
    s = unrepeat(s)
    return unsup(s) if sup else s


def walk(o, sup):
    if isinstance(o, str):
        return fix(o, sup)
    if isinstance(o, list):
        return [walk(v, sup) for v in o]
    if isinstance(o, dict):
        return {k: (v if k == 'img' else walk(v, sup)) for k, v in o.items()}
    return o


def fix_question(q):
    """없는 위 첨자를 하나라도 쓴 문항이면 그 문항의 첨자를 전부 ^n 으로."""
    blob = json.dumps(q, ensure_ascii=False)
    return walk(q, any(c in MISSING for c in blob))


if __name__ == '__main__':
    for f in sys.argv[1:]:
        spec = json.load(open(f, encoding='utf-8'))
        after = dict(spec, questions=[fix_question(q) for q in spec['questions']])
        n = sum(1 for a, b in zip(json.dumps(spec, ensure_ascii=False).split('","'),
                                  json.dumps(after, ensure_ascii=False).split('","'))
                if a != b)
        json.dump(after, open(f, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        print('%s  고친 문자열 %d개' % (f, n))
