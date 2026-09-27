# -*- coding: utf-8 -*-
"""재수강 판정과 예상 등급이 같은 방향을 가리키는지 재 본다."""
import statistics, collections
PAPERS = {'중1-1': {'표준':7,'상':14,'최상':9}, '중1-2': {'표준':7,'상':15,'최상':8},
          '중2-1': {'표준':7,'상':14,'최상':9}, '중2-2': {'표준':7,'상':14,'최상':9}}
BANDS = ((0,15,'통과·여유',1),(16,31,'통과',2),(32,39,'통과·경계',2),
         (40,47,'재수강·경계',2),(48,71,'재수강',3),(72,999,'재수강·많이',5))

def retake(w): return (w['표준']+w['상'])*8 + w['최상']*5
def rates(N,w): return {k:(N[k]-w[k])/N[k]*100 for k in N}
def grade(r,L):
    for g,need in L:
        if all(r.get(k,-1)>=v for k,v in need.items()): return g
    return 9

def report(L, title):
    rows=[]
    for N in PAPERS.values():
        for a in range(N['표준']+1):
            for b in range(N['상']+1):
                for c in range(N['최상']+1):
                    w={'표준':a,'상':b,'최상':c}
                    rows.append((retake(w), grade(rates(N,w),L)))
    print('\n===', title, '===')
    for lo,hi,tag,want in BANDS:
        sel=[g for s,g in rows if lo<=s<=hi]
        med=statistics.median(sel)
        c=collections.Counter(sel)
        top=', '.join('%d등급 %d%%'%(g,round(c[g]/len(sel)*100)) for g in sorted(c) if c[g]/len(sel)>=0.15)
        print('%3d~%-4s %-11s 목표 %d · 가운뎃값 %g %s  %s'
              % (lo, hi if hi<999 else '', tag, want, med, '✓' if med==want else '✗', top))
    N=PAPERS['중1-1']
    print('  경계 표본 (중1-1)')
    for w in ({'표준':0,'상':2,'최상':3},{'표준':1,'상':2,'최상':4},{'표준':0,'상':4,'최상':2},
              {'표준':1,'상':3,'최상':4},{'표준':2,'상':3,'최상':4},{'표준':2,'상':4,'최상':5}):
        r=rates(N,w); s=retake(w)
        print('    오답 %2d개 · %2d점 %s · 표%.0f/상%.0f/최%.0f → %d등급'
              % (sum(w.values()), s, '재수강' if s>=40 else '통과  ',
                 r['표준'],r['상'],r['최상'], grade(r,L)))
