# -*- coding: utf-8 -*-
"""문항 분석 문서의 수식 표기를 LaTeX 로 옮기고 그림으로 그린다.

문서에는 백틱 안에 `(2a+7)/5`, `√(36 + 16)`, `x²`, `P(4, 2)` 처럼 적는다.
사람이 읽고 고치기 쉬운 표기이지만 인쇄물에서는 분수가 한 줄로 누워 나온다.
여기서 그것을 `\\frac{2a+7}{5}` 같은 LaTeX 로 바꾸고 matplotlib 의 mathtext
로 그린다. 글꼴은 조판에 쓰는 노토 그대로라 한글 본문과 서체가 어긋나지 않는다.

**못 바꾸는 것은 바꾸지 않는다.** `tex()` 는 확신이 없으면 None 을 돌려주고,
조판기는 그때 지금까지 쓰던 글자 조판으로 되돌아간다. 인쇄물에 틀린 식이
나가는 것보다 한 줄로 누운 식이 낫다.
"""
import hashlib
import io
import os
import re
import warnings

import matplotlib
matplotlib.use('Agg')
from matplotlib import font_manager, mathtext, rcParams  # noqa: E402
from matplotlib.backends.backend_agg import FigureCanvasAgg  # noqa: E402
from matplotlib.figure import Figure  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
FONTDIR = os.path.join(HERE, '글꼴')
CACHE = os.path.join(HERE, '_수식')

_READY = False


def setup():
    """조판에 쓰는 노토 두 벌을 mathtext 글꼴로 앉힌다.

    윈도에도 같은 이름의 노토가 깔려 있어 이름만으로 고르면 그쪽이 잡힌다.
    우리가 고친 파일이어야 `≒` 와 순환소수 점이 나오므로 이름을 바꿔 단다.
    """
    global _READY
    if _READY:
        return
    from fontTools.ttLib import TTFont
    os.makedirs(CACHE, exist_ok=True)
    names = {}
    for w, src in (('rm', 'NotoSansKR-Regular.ttf'), ('bf', 'NotoSansKR-Bold.ttf')):
        out = os.path.join(CACHE, '_mt_%s.ttf' % w)
        if not os.path.exists(out):
            f = TTFont(os.path.join(FONTDIR, src))
            fam = '진단평가 %s' % w
            for rec in f['name'].names:
                if rec.nameID in (1, 4, 16):
                    rec.string = fam
            f.save(out)
        font_manager.fontManager.addfont(out)
        names[w] = font_manager.FontProperties(fname=out).get_name()
    rcParams['mathtext.fontset'] = 'custom'
    rcParams['mathtext.rm'] = names['rm']
    rcParams['mathtext.it'] = names['rm']
    rcParams['mathtext.sf'] = names['rm']
    rcParams['mathtext.tt'] = names['rm']
    rcParams['mathtext.cal'] = names['rm']
    rcParams['mathtext.bf'] = names['bf']
    rcParams['mathtext.default'] = 'regular'
    _READY = True


# ── 표기를 LaTeX 로 ──────────────────────────────────────────────

SUPS = {'²': '2', '³': '3', '⁴': '4'}
# mathtext 가 이름으로 아는 기호. 글자를 그대로 두면 자리를 잘못 잡는 것들이다.
NAMED = {'∽': r'\sim', '…': r'\ldots', '⋯': r'\cdots'}
# 수식 안에 오지만 수학 기호가 아닌 글자. 이런 것이 있으면 손대지 않는다.
REFUSE = re.compile(r'[　-〿＀-￯]')
HANGUL = re.compile(r'[가-힣]+(?:\s+[가-힣]+)*')
NUM = re.compile(r'\d+(?:\.\d+)?')
WORD = re.compile(r'[A-Za-zα-ωΑ-Ω]+')


class Fail(Exception):
    """확신이 없을 때 던진다. 부르는 쪽은 글자 조판으로 되돌아간다."""


# mathtext 가 관계 기호로 모르는 것. 양옆을 띄워 줘야 식이 붙어 보이지 않는다.
LOOSE = '≒≠≡∽≈∥⊥∈∉⊂⊆⊇⊄∪∩→⇒⇔'


def _esc(ch):
    if ch == '|':
        return r'\,|\,'
    if ch in LOOSE:
        return r'\,%s\,' % ch
    if ch in '{}':
        return '\\' + ch
    if ch in '%$#&':
        return '\\' + ch
    return NAMED.get(ch, ch)


def _scan(s, i, close, bars=False):
    """`close` 가 나올 때까지 조각 목록을 만든다. (조각들, 다음 자리)

    `bars` 는 세로줄을 절댓값 짝으로 볼지 여부다. 식 안의 세로줄 개수가
    짝수일 때만 켠다. `{x | x > 0}` 처럼 홀수면 그냥 기호로 둔다.
    """
    items = []
    while i < len(s):
        ch = s[i]
        if close and ch == close:
            return items, i + 1
        if ch.isspace():
            items.append({'k': 'sp'})
            i += 1
        elif ch == '(':
            inner, i = _scan(s, i + 1, ')', bars)
            # 괄호는 분자·분모나 근호 안에서 벗겨도 뜻이 같다. 절댓값 막대만
            # 벗기면 뜻이 달라지므로 그쪽에는 이 표를 달지 않는다.
            items.append({'k': 'atom', 'tex': '(%s)' % _join(inner),
                          'bare': _join(inner), 'shed': True})
        elif ch == '{':
            # 중괄호는 우리 글에서 묶음 괄호로 쓴다. 분자·분모나 근호 전체를
            # 감쌌으면 벗긴다. 안 벗기면 집합 기호로 인쇄돼 뜻이 달라진다.
            inner, i = _scan(s, i + 1, '}', bars)
            items.append({'k': 'atom', 'tex': r'\{%s\}' % _join(inner),
                          'bare': _join(inner), 'shed': True})
        elif ch == '|' and bars:
            inner, i = _scan(s, i + 1, '|', bars)
            body = _join(inner)
            items.append({'k': 'atom', 'tex': r'\left|%s\right|' % body, 'bare': body})
        elif ch == '√':
            items.append({'k': 'root'})
            i += 1
        elif ch == '/':
            items.append({'k': 'slash'})
            i += 1
        elif ch in '^_':
            if s[i + 1:i + 2] in ('(', '{'):
                shut = ')' if s[i + 1] == '(' else '}'
                inner, i = _scan(s, i + 2, shut, bars)
                items.append({'k': 'mark', 'tex': '%s{%s}' % (ch, _join(inner))})
                continue
            m = re.match(r'[\^_](-?[0-9A-Za-z]+)', s[i:])
            if not m:
                raise Fail('%s 뒤에 올릴 것이 없다' % ch)
            items.append({'k': 'mark', 'tex': '%s{%s}' % (ch, m.group(1))})
            i += m.end()
        elif ch in SUPS:
            items.append({'k': 'mark', 'tex': '^{%s}' % SUPS[ch]})
            i += 1
        elif ch == '̇':
            if not items or items[-1]['k'] != 'atom' or not items[-1]['tex'][-1:].isalnum():
                raise Fail('순환소수 점 앞이 숫자가 아니다')
            prev = items.pop()
            head, last = prev['tex'][:-1], prev['tex'][-1]
            if head:
                items.append({'k': 'atom', 'tex': head, 'bare': head})
            items.append({'k': 'atom', 'tex': r'\dot{%s}' % last,
                          'bare': r'\dot{%s}' % last})
            i += 1
        else:
            m = NUM.match(s, i) or WORD.match(s, i)
            if m:
                items.append({'k': 'atom', 'tex': m.group(0), 'bare': m.group(0)})
                i = m.end()
            else:
                if REFUSE.match(ch):
                    raise Fail('다룰 수 없는 글자 %r' % ch)
                items.append({'k': 'op', 'tex': _esc(ch)})
                i += 1
    if close:
        raise Fail('%r 짝이 없다' % close)
    return items, i


def _take_right(items, k):
    """k 자리부터 오른쪽 피연산자 하나를 뗀다. 붙어 있는 조각은 함께 가져온다."""
    while k < len(items) and items[k]['k'] == 'sp':
        k += 1
    if k >= len(items) or items[k]['k'] not in ('atom', 'root'):
        raise Fail('오른쪽 피연산자가 없다')
    j = k
    if items[j]['k'] == 'root':                 # √ 가 먼저 오면 그 근호까지
        j += 1
        while j < len(items) and items[j]['k'] == 'sp':
            j += 1
        if j >= len(items) or items[j]['k'] != 'atom':
            raise Fail('근호 안이 없다')
    j += 1
    while j < len(items) and items[j]['k'] == 'mark':   # 지수·아래 첨자
        j += 1
    return k, j


def _take_left(items, k):
    """k 자리 바로 앞에서 왼쪽 피연산자 하나를 뗀다.

    띄어쓰기 없이 붙어 있는 조각은 한 덩이로 본다. `3√3/8` 의 분자는 `3√3`,
    `2x/3` 의 분자는 `2x` 다. 띄어쓰기나 연산 기호가 나오면 거기서 끊는다.
    """
    j = k
    while j > 0 and items[j - 1]['k'] == 'sp':
        j -= 1
    end = j
    if j == 0 or items[j - 1]['k'] not in ('atom', 'mark'):
        raise Fail('왼쪽 피연산자가 없다')
    while j > 0 and items[j - 1]['k'] in ('atom', 'mark'):
        j -= 1
    return j, end


def _join(items):
    """조각 목록을 근호와 분수를 풀어 가며 LaTeX 한 줄로 만든다."""
    items = list(items)
    k = 0
    while k < len(items):                              # 근호부터
        if items[k]['k'] != 'root':
            k += 1
            continue
        a, b = _take_right(items, k + 1)
        body = ''.join(x['tex'] for x in items[a:b] if x['k'] != 'sp')
        if b - a == 1 and items[a]['k'] == 'atom' and items[a].get('shed'):
            body = items[a]['bare']
        items[k:b] = [{'k': 'atom', 'tex': r'\sqrt{%s}' % body, 'bare': r'\sqrt{%s}' % body}]
        k += 1
    k = 0
    while k < len(items):                              # 그다음 분수
        if items[k]['k'] != 'slash':
            k += 1
            continue
        la, lb = _take_left(items, k)
        ra, rb = _take_right(items, k + 1)
        def bare(lo, hi):
            if hi - lo == 1 and items[lo]['k'] == 'atom' and items[lo].get('shed'):
                return items[lo]['bare']
            return ''.join(x['tex'] for x in items[lo:hi] if x['k'] != 'sp')
        frac = r'\frac{%s}{%s}' % (bare(la, lb), bare(ra, rb))
        items[la:rb] = [{'k': 'atom', 'tex': frac, 'bare': frac, 'shed': True}]
        k = la + 1
    out = []
    for n, it in enumerate(items):
        if it['k'] == 'sp':
            prev = items[n - 1]['k'] if n else 'op'
            nxt = items[n + 1]['k'] if n + 1 < len(items) else 'op'
            if prev == 'atom' and nxt in ('atom', 'root'):
                out.append(r'\,')                      # 2 cm 처럼 붙은 낱말 사이
            continue
        out.append(it['tex'])
    return ''.join(out)


def tex(s):
    """수식 한 토막을 LaTeX 로 바꾼다. 확신이 없으면 None."""
    s = ' '.join(s.split())
    if not s or HANGUL.search(s):
        return None
    holes = []

    def hole(m):
        holes.append(m.group(0))
        return '\x00%d\x00' % (len(holes) - 1)

    s = HANGUL.sub(hole, s)
    try:
        items, _ = _scan(s, 0, None, bars=('|' in s and s.count('|') % 2 == 0))
        body = _join(items)
    except Fail:
        return None
    except Exception:
        return None
    for n, h in enumerate(holes):
        body = body.replace('\x00%d\x00' % n, r'\mathrm{%s}' % h.replace(' ', r'\,'))
    return body


# ── 검산 ────────────────────────────────────────────────────────

STRUCT = '/^_√()|{} ̇'


def symbols(s):
    """식에 든 기호만 차례대로 뽑는다. 바꾸기 전후가 같아야 한다."""
    for ch, name in NAMED.items():
        s = s.replace(name, ch)
    keep = {c: '\x01%d\x01' % n for n, c in enumerate(NAMED)}
    for ch, mark in keep.items():
        s = s.replace(ch, mark)
    s = re.sub(r'\\[a-zA-Z]+|[{}\\,]|\\ ', ' ', s)
    for ch, mark in keep.items():
        s = s.replace(mark, ch)
    out = []
    for ch in s:
        if ch in STRUCT or ch.isspace():
            continue
        out.append(SUPS.get(ch, NAMED.get(ch, ch)))
    return ''.join(out)


def checked(src):
    """바꾼 뒤에도 기호가 하나도 빠지거나 늘지 않았을 때만 돌려준다."""
    t = tex(src)
    if t is None:
        return None
    a = symbols(src)
    b = symbols(t)
    if a != b:
        return None
    return t


# ── 그리기 ──────────────────────────────────────────────────────

def render(latex, size, bold=False):
    """수식을 그림으로 그린다. (파일, 너비, 높이, 내려간 깊이) 를 돌려준다."""
    setup()
    key = hashlib.md5(('%s|%.2f|%d' % (latex, size, bold)).encode('utf-8')).hexdigest()[:16]
    png = os.path.join(CACHE, key + '.png')
    meta = png[:-4] + '.txt'
    if os.path.exists(png) and os.path.exists(meta):
        w, h, d = (float(x) for x in io.open(meta, encoding='utf-8').read().split())
        return png, w, h, d
    src = r'$\mathbf{%s}$' % latex if bold else '$%s$' % latex
    parser = mathtext.MathTextParser('path')
    with warnings.catch_warnings(record=True) as caught:
        warnings.simplefilter('always')
        w, h, d, _, _ = parser.parse(src, dpi=72, prop=font_manager.FontProperties(size=size))
    if any('dummy symbol' in str(x.message) for x in caught):
        raise Fail('글꼴에 없는 글자가 있다: %s' % latex)
    scale = 8.0                       # 인쇄 해상도. 72 × 8 = 576 dpi
    fig = Figure(figsize=((w + 2) / 72.0, (h + 2) / 72.0), dpi=72 * scale)
    fig.patch.set_alpha(0.0)
    fig.text(1.0 / (w + 2), (1.0 + d) / (h + 2), src, fontsize=size,
             va='baseline', ha='left', color='black')
    FigureCanvasAgg(fig)
    fig.savefig(png, transparent=True)
    io.open(meta, 'w', encoding='utf-8').write('%f %f %f' % (w + 2, h + 2, d + 1))
    return png, w + 2, h + 2, d + 1
