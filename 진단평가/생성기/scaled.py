# -*- coding: utf-8 -*-
"""난이도 가중 환산점수와 등급 사다리를 재 본다."""
import statistics, collections
PAPERS = {'중1-1': {'표준':7,'상':14,'최상':9}, '중1-2': {'표준':7,'상':15,'최상':8},
          '중2-1': {'표준':7,'상':14,'최상':9}, '중2-2': {'표준':7,'상':14,'최상':9}}
WEIGHT = {'표준':1, '상':2, '최상':3}

def full(N): return sum(N[k]*WEIGHT[k] for k in N)
def earned(N,w): return sum((N[k]-w[k])*WEIGHT[k] for k in N)
def scaled(N,w): return 50 + 50*earned(N,w)/full(N)   # 50~100
def retake(w): return (w['표준']+w['상'])*8 + w['최상']*5
def base(N,w): return (N['표준']-w['표준'])/N['표준']*100

def grade(N, w, cuts, cap):
    s = scaled(N,w)
    g = next((i+1 for i,c in enumerate(cuts) if s >= c), len(cuts)+1)
    b = base(N,w)
    for lim, worst in cap:            # 표준을 못 맞히면 위로 못 올라간다
        if b < lim: g = max(g, worst)
    return g, s

def show(cuts, cap, title):
    print('\n===', title, '===')
    rows=[]
    for N in PAPERS.values():
        for a in range(N['표준']+1):
            for b in range(N['상']+1):
                for c in range(N['최상']+1):
                    w={'표준':a,'상':b,'최상':c}
                    rows.append((retake(w), grade(N,w,cuts,cap)[0]))
    for lo,hi,tag in ((0,15,'통과·여유'),(16,31,'통과'),(32,39,'통과·경계'),
                      (40,47,'재수강·경계'),(48,71,'재수강'),(72,999,'재수강·많이')):
        sel=[g for s,g in rows if lo<=s<=hi]
        c=collections.Counter(sel)
        top=', '.join('%d등급 %d%%'%(g,round(c[g]/len(sel)*100)) for g in sorted(c) if c[g]/len(sel)>=0.15)
        print('%3d~%-4s %-11s 가운뎃값 %g등급   %s' % (lo, hi if hi<999 else '', tag, statistics.median(sel), top))
    N=PAPERS['중1-1']
    print('  대표 학생 (중1-1 · 가중 만점 %d점)' % full(N))
    for w in ({'표준':0,'상':0,'최상':0},{'표준':0,'상':0,'최상':2},{'표준':0,'상':0,'최상':3},
              {'표준':0,'상':0,'최상':5},{'표준':1,'상':2,'최상':4},{'표준':1,'상':3,'최상':4},
              {'표준':2,'상':4,'최상':5},{'표준':3,'상':7,'최상':7},{'표준':5,'상':11,'최상':8},
              {'표준':7,'상':0,'최상':0},{'표준':7,'상':14,'최상':9}):
        g,s = grade(N,w,cuts,cap); r=retake(w)
        print('    오답 %2d개 (%2d/30) · %3d점 %s · 환산 %5.1f → %d등급'
              % (sum(w.values()), 30-sum(w.values()), r, '재수강' if r>=40 else '통과  ', s, g))
