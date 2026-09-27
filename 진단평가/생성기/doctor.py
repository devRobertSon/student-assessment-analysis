# -*- coding: utf-8 -*-
"""새 폴더에서 시험지를 찍을 수 있는 상태인지 짚어 본다.

    python doctor.py

모자란 것마다 무엇을 하면 되는지 함께 적는다. 다 갖춰지면 마지막 줄이
`다 됐다` 가 된다.
"""
import os
import sys

import 경로

HERE = os.path.dirname(os.path.abspath(__file__))
칸 = '  %-4s %-22s %s'
탈 = []


def 본다(이름, 된다, 될때, 안될때):
    탈.append(not 된다)
    print(칸 % ('됐다' if 된다 else '모자람', 이름, 될때 if 된다 else 안될때))


print('진단평가 찍을 준비')
print()

# 1. 자료 폴더
d = 경로.자료(조용히=True)
본다('자료 폴더', bool(d), d or '',
     '환경 변수 %s 에 자료 폴더를 적는다. 그 안에 `문항/` 이 있어야 한다.'
     % 경로.ENV)

if d:
    for 이름, 쓰임 in (('문항', '문항 조각'), ('원본', '교재 원본'),
                      ('해설', '해설 조각')):
        p = os.path.join(d, 이름)
        n = len(os.listdir(p)) if os.path.isdir(p) else 0
        본다(이름 + '/', n > 0, '%d개 · %s' % (n, 쓰임),
             '자료 폴더에 없다. 원장님 컴퓨터에서 가져온다.')
    있는분석 = [x for x in os.listdir(d) if x.endswith('_문항분석')]
    본다('문항분석', len(있는분석) == 8, '여덟 학기',
         '%d학기뿐이다. `poolsheet.py` 는 이것이 있어야 돈다.' % len(있는분석))

# 2. 글꼴
글꼴 = os.path.join(HERE, '글꼴')
둘 = [os.path.join(글꼴, 'NotoSansKR-%s.ttf' % x) for x in ('Regular', 'Bold')]
본다('글꼴', all(os.path.exists(x) for x in 둘), '글꼴/ 에 두 벌',
     '`python mkfont.py` 를 돌린다. 원본 가변 글꼴이 있어야 한다.')

# 3. 파이썬 꾸러미
for 꾸러미, 쓰임 in (('reportlab', 'PDF 조판'), ('PIL', '그림 크기'),
                    ('fontTools', '글꼴 고치기'), ('matplotlib', '분수 그리기'),
                    ('pypdfium2', 'PDF 읽기')):
    try:
        __import__(꾸러미)
        본다(꾸러미, True, 쓰임, '')
    except ImportError:
        본다(꾸러미, False, '', 'pip install %s'
             % {'PIL': 'pillow', 'fontTools': 'fonttools'}.get(꾸러미, 꾸러미))

# 4. 스펙
스펙 = [x for x in os.listdir(HERE) if x.startswith('spec_') and x.endswith('.json')]
본다('스펙 JSON', len(스펙) == 8, '여덟 벌',
     '%d벌뿐이다. 저장소의 `진단평가/생성기/` 에서 가져온다.' % len(스펙))

print()
if any(탈):
    print('모자란 것 %d가지. 위에 적은 대로 채우고 다시 돌린다.' % sum(1 for x in 탈 if x))
    sys.exit(1)
print('다 됐다. `python paper.py spec_m11.json <폴더>` 로 찍어 본다.')
