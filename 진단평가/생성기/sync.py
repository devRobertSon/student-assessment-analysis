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
빼는길 = re.compile(r'_문항분석/[0-9]+_[^/]+\.md$')
챙기는확장자 = ('.md', '.py', '.json')
# 확장자가 달라도 챙기는 것. 우리가 만든 로고라 저장소에 있어야 head.py 가 돈다.
더챙기는것 = {'생성기/_로고.png', '생성기/_로고a.png'}

# 옮길 것에 이런 말이 있으면 교재 본문이 섞인 것으로 보고 멈춘다
본문 = re.compile(r'(다음 중|옳은 것은|옳지 않은|구하시오|몇 개인가|무엇인가|\*\*문항\*\*)')
# 우리가 쓴 글이라 걸려도 되는 자리. 이 스크립트 자신은 위 낱말을 담고 있다.
봐주는곳 = {'_남은세학기_진행.md', '_네학기더_진행.md', os.path.basename(__file__)}


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
    for rel in rels:
        if os.path.basename(rel) in 봐주는곳:
            continue
        if not rel.endswith(('.md', '.py', '.json')):
            continue
        t = io.open(os.path.join(src, rel), encoding='utf-8').read()
        n = len(본문.findall(t))
        # 풀이 단계에 '옳은 것은 ㄱ, ㄷ' 처럼 한두 번 나오는 것은 본문이 아니다
        if n > 3:
            걸림.append((rel, n))
    return 걸림


def main(argv):
    조용히 = '--조용히' in argv
    볼래만 = '--볼래만' in argv
    src, dst = 경로.자료(), os.path.join(저장소(), 안)
    rels = 옮길것(src)

    걸림 = 훑는다(src, rels)
    if 걸림:
        print('교재 본문이 섞인 것 같아 멈춘다. 옮긴 것은 없다.')
        for rel, n in 걸림:
            print('  %-50s %d군데' % (rel, n))
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
