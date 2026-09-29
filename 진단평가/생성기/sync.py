# -*- coding: utf-8 -*-
"""자료 폴더에서 고친 것을 저장소로 옮긴다.

    python sync.py            무엇이 달라지는지 보여 주고 옮긴다
    python sync.py --조용히    달라진 것이 있을 때만 한 줄 적는다
    python sync.py --볼래만    옮기지 않고 무엇이 달라졌는지만 적는다

저장소가 공개라 **교재 원문은 옮기지 않는다.** 옮기기 전에 옮길 것을 한 번 더
훑어 문항 본문이 섞였으면 아무것도 옮기지 않고 멈춘다.

저장소 자리는 환경 변수 `SDA_REPO` 로 정한다. 없으면 흔히 두는 자리를 찾는다.
"""
import filecmp
import io
import os
import re
import shutil
import sys

import 경로

REPO_ENV = 'SDA_REPO'
REPO_GUESS = [
    '~/Documents/student-assessment-analysis',
    '~/student-assessment-analysis',
    '~/OneDrive/Documents/student-assessment-analysis',
]
안 = '진단평가'                       # 저장소 안에서 이 폴더로 들어간다

# 교재 원문이 든 곳. 통째로 두고 온다.
빼는폴더 = {'원본', '문항', '해설', '글꼴', '_수식', '__pycache__', '새시험지'}
# 문항 본문이 그대로 적힌 파일
빼는파일 = re.compile(r'13_검수용_시험지\.md$')
# 과학영재의 `_교재_*.md` 는 교재 문제의 요지를 훑어 만든 색인이다. 하이탑 서술형을
# 모은 `_교재_서술형.md` 와 영재·과학고 대비 교재를 모은 `_교재_영재대비.md` 가 있다.
# 나머지(원장님이 쓴 문제와 학습 목표)는 저장소로 옮겨 이력을 남긴다.
빼는길 = re.compile(r'_문항분석/[0-9]+_[^/]+\.md$|^과학영재/중[123]/_교재_[^/]+\.md$')
챙기는확장자 = ('.md', '.py', '.json')
# 확장자가 달라도 챙기는 것. 우리가 만든 로고라 저장소에 있어야 head.py 가 돈다.
더챙기는것 = {'생성기/_로고.png', '생성기/_로고a.png'}

# 옮길 것에 이런 말이 있으면 교재 본문이 섞인 것으로 보고 멈춘다
본문 = re.compile(r'(다음 중|옳은 것은|옳지 않은|구하시오|몇 개인가|무엇인가|\*\*문항\*\*)')
# 우리가 쓴 글이라 걸려도 되는 자리. 이 스크립트 자신은 위 낱말을 담고 있다.
봐주는곳 = {'_남은세학기_진행.md', '_네학기더_진행.md', os.path.basename(__file__)}

# 과학영재는 낱말 세기로 가릴 수 없다. 문제를 모아 둔 글이라 '구하시오' 가 여러 번
# 나오는 것이 당연하다. 교재에서 온 것은 색인 표뿐이므로 그것만 본다. 하이탑 표는
# `번호 … Keyword`, 영재대비 표는 `출처 | 요지` 로 시작한다.
과학영재 = re.compile(r'^과학영재/')
교재표 = re.compile(r'^\|\s*(번호\s*\|[^\n]*Keyword|출처\s*\|\s*요지)', re.M)

# 위의 낱말 세기는 어림이라 한두 줄만 베낀 것은 놓친다. 2026년 9월 29일에
# mk_m12_csv.py 가 문항 한 줄을 담은 채 저장소에 들어가 있는 것을 찾았다.
# 그래서 분석 문서의 문항 글을 그대로 가져다 대어 본다. 한 조각만 걸려도 멈춘다.
토막길이 = 20


def 다듬는다(s):
    return ' '.join(s.replace('`', '').split())


def 문항토막(src):
    """분석 문서의 문항 글에서 앞 토막을 모은다."""
    토막 = set()
    for g in sorted(os.listdir(src)):
        if not g.endswith('_문항분석') or not os.path.isdir(os.path.join(src, g)):
            continue
        for f in sorted(os.listdir(os.path.join(src, g))):
            if not f.endswith('.md') or f.startswith('_'):
                continue
            t = io.open(os.path.join(src, g, f), encoding='utf-8').read()
            for m in re.finditer(r'\*\*문항\*\*\s*(.+)', t):
                글 = 다듬는다(m.group(1))
                if len(글) >= 토막길이:
                    토막.add(글[:토막길이])
    return 토막


def 저장소():
    p = os.environ.get(REPO_ENV)
    후보 = [p] if p else []
    후보 += REPO_GUESS
    for c in 후보:
        if not c:
            continue
        c = os.path.abspath(os.path.expanduser(c))
        if os.path.isdir(os.path.join(c, '.git')):
            return c
    raise SystemExit(
        '저장소를 찾지 못했다. 환경 변수 %s 에 저장소 폴더를 적어라.' % REPO_ENV)


def 옮길것(src):
    out = []
    for dirpath, dirs, files in os.walk(src):
        dirs[:] = [d for d in dirs if d not in 빼는폴더]
        for f in sorted(files):
            rel = os.path.relpath(os.path.join(dirpath, f), src)
            rel = rel.replace(os.sep, '/')
            if not f.endswith(챙기는확장자) and rel not in 더챙기는것:
                continue
            if 빼는파일.search(rel) or 빼는길.search(rel):
                continue
            out.append(rel)
    return out


def 훑는다(src, rels):
    """옮기기 전에 교재 본문이 섞였는지 본다. 걸린 곳을 돌려준다."""
    걸림 = []
    토막 = 문항토막(src)
    for rel in rels:
        if os.path.basename(rel) in 봐주는곳:
            continue
        if not rel.endswith(('.md', '.py', '.json')):
            continue
        t = io.open(os.path.join(src, rel), encoding='utf-8').read()
        if 과학영재.match(rel):
            if 교재표.search(t):
                걸림.append((rel, '교재 서술형 표가 남아 있다'))
            continue
        n = len(본문.findall(t))
        # 풀이 단계에 '옳은 것은 ㄱ, ㄷ' 처럼 한두 번 나오는 것은 본문이 아니다
        if n > 3:
            걸림.append((rel, '흔한 말 %d군데' % n))
            continue
        납작 = 다듬는다(t)
        걸린토막 = [x for x in 토막 if x in 납작]
        if 걸린토막:
            걸림.append((rel, '문항 %d조각 · %r'
                       % (len(걸린토막), sorted(걸린토막)[0])))
    return 걸림


def main(argv):
    조용히 = '--조용히' in argv
    볼래만 = '--볼래만' in argv
    src, dst = 경로.자료(), os.path.join(저장소(), 안)
    rels = 옮길것(src)

    걸림 = 훑는다(src, rels)
    if 걸림:
        print('교재 본문이 섞인 것 같아 멈춘다. 옮긴 것은 없다.')
        for rel, 까닭 in 걸림:
            print('  %-42s %s' % (rel, 까닭))
        return 1

    새것, 바뀐것 = [], []
    for rel in rels:
        a, b = os.path.join(src, rel), os.path.join(dst, rel)
        if not os.path.exists(b):
            새것.append(rel)
        elif not filecmp.cmp(a, b, shallow=False):
            바뀐것.append(rel)

    있던것 = set()
    if os.path.isdir(dst):
        for dirpath, dirs, files in os.walk(dst):
            dirs[:] = [d for d in dirs if d not in 빼는폴더]
            for f in files:
                r = os.path.relpath(os.path.join(dirpath, f), dst)
                있던것.add(r.replace(os.sep, '/'))
    지울것 = sorted(있던것 - set(rels) - {'README.md'})

    if not (새것 or 바뀐것 or 지울것):
        if not 조용히:
            print('저장소가 자료 폴더와 같다. 옮길 것 없다.')
        return 0

    if 볼래만:
        for 이름, 목록 in (('새것', 새것), ('바뀐 것', 바뀐것), ('지울 것', 지울것)):
            for rel in 목록:
                print('  %-8s %s' % (이름, rel))
        return 0

    for rel in 새것 + 바뀐것:
        b = os.path.join(dst, rel)
        os.makedirs(os.path.dirname(b), exist_ok=True)
        shutil.copy2(os.path.join(src, rel), b)
    for rel in 지울것:
        os.remove(os.path.join(dst, rel))

    if 조용히:
        print('진단평가 %d개를 저장소로 옮겼다 (새 %d · 바뀜 %d · 지움 %d)'
              % (len(새것) + len(바뀐것) + len(지울것),
                 len(새것), len(바뀐것), len(지울것)))
    else:
        for 이름, 목록 in (('새것', 새것), ('바뀜', 바뀐것), ('지움', 지울것)):
            for rel in 목록:
                print('  %-6s %s' % (이름, rel))
        print()
        print('%d개를 옮겼다. 저장소에서 커밋하면 된다.'
              % (len(새것) + len(바뀐것) + len(지울것)))
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
