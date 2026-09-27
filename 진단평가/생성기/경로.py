# -*- coding: utf-8 -*-
"""교재 원문이 든 자료 폴더를 찾는다.

저장소에는 코드와 규칙만 있고 교재 원문은 없다. 그래서 새 폴더에 저장소를
받아도 자료 폴더가 어디인지 알려 주어야 돌아간다. 찾는 차례는 이렇다.

1. 환경 변수 `SDA_PAPERS`
2. 이 스크립트 바로 위 (자료 폴더 안에서 그대로 돌릴 때)
3. 흔히 두는 자리 몇 군데

`문항/` 이 있는 폴더를 자료 폴더로 본다.
"""
import os

HERE = os.path.dirname(os.path.abspath(__file__))
ENV = 'SDA_PAPERS'
# 자료 폴더라면 반드시 있는 것
MARK = '문항'
GUESS = [
    '~/OneDrive/Documents/claude/진단평가',
    '~/OneDrive/문서/claude/진단평가',
    '~/Documents/claude/진단평가',
]
안내 = """교재 자료 폴더를 찾지 못했다.

저장소에는 코드와 규칙만 있다. 교재 원본과 문항 조각은 저장소 밖에 있다.
자료 폴더를 어디에 두었는지 알려 달라. 그 안에 `문항/` 이 있어야 한다.

    Windows   set SDA_PAPERS=D:\\어딘가\\진단평가
    그 밖에    export SDA_PAPERS=/어딘가/진단평가

무엇이 모자란지는 `python doctor.py` 가 짚어 준다."""


def _ok(p):
    return p and os.path.isdir(os.path.join(p, MARK))


def 자료(조용히=False):
    """자료 폴더의 절대 경로. 못 찾으면 멈춘다."""
    p = os.environ.get(ENV)
    if p:
        p = os.path.abspath(os.path.expanduser(p))
        if _ok(p):
            return p
        raise SystemExit('%s 가 가리키는 곳에 `%s/` 가 없다: %s' % (ENV, MARK, p))

    up = os.path.abspath(os.path.join(HERE, '..'))
    if _ok(up):
        return up

    for g in GUESS:
        g = os.path.abspath(os.path.expanduser(g))
        if _ok(g):
            return g

    if 조용히:
        return None
    raise SystemExit(안내)


def 안(*이름):
    """자료 폴더 아래의 경로를 잇는다."""
    return os.path.join(자료(), *이름)


def 그림(경로):
    """스펙에 적힌 문항 그림 경로를 자료 폴더 기준으로 옮긴다.

    스펙에는 `../문항/중1-1_A_01.png` 처럼 적혀 있다. 자료 폴더 안에서 돌릴
    때는 그대로 맞지만 저장소에서 돌릴 때는 아니다. 어느 쪽이든 되게 한다.
    """
    경로 = 경로.replace('\\', '/')
    if os.path.isabs(경로):
        return 경로
    조각 = [x for x in 경로.split('/') if x not in ('.', '..')]
    return os.path.join(자료(), *조각)
