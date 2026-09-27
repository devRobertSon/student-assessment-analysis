# -*- coding: utf-8 -*-
"""진단평가 문제지 / 해설 HTML 생성기.
spec JSON 하나로 두 파일을 만든다. 문제 이미지는 base64로 박아 넣어
파일 하나만 있으면 어디서든 열리고 바로 인쇄된다."""
import base64, json, os, sys

CSS_COMMON = """
@page { size: A4; margin: 14mm 12mm 16mm; }
:root{--navy:#16224e;--ink:#16181c;--ink-2:#41454d;--ink-3:#8a8f99;--line:#d9dce2;--tint:#eef1f7;}
*{box-sizing:border-box;}
body{margin:0;padding:0;background:#f4f5f7;color:var(--ink);
 font-family:'Noto Sans KR',-apple-system,BlinkMacSystemFont,'Malgun Gothic',sans-serif;}
.sheet{max-width:820px;margin:0 auto;padding:26px 30px 40px;background:#fff;}
.head{display:flex;align-items:flex-end;gap:14px;padding-bottom:12px;border-bottom:2px solid var(--navy);}
.head h1{margin:0;font-size:21px;letter-spacing:-.02em;}
.head .sub{margin-left:auto;font-size:13px;color:var(--ink-2);text-align:right;line-height:1.55;}
.namebar{display:flex;gap:10px;margin:14px 0 22px;}
.namebar .box{flex:1;display:flex;align-items:center;gap:8px;padding:9px 12px;
 border:1px solid var(--line);border-radius:7px;font-size:13px;color:var(--ink-3);}
.namebar .box b{color:var(--ink-2);font-weight:600;}
.q{padding:16px 0 18px;border-bottom:1px dashed var(--line);break-inside:avoid;page-break-inside:avoid;}
.q:last-child{border-bottom:0;}
.qhead{display:flex;align-items:center;gap:8px;margin-bottom:9px;}
.qno{display:inline-flex;align-items:center;justify-content:center;min-width:27px;height:27px;
 padding:0 7px;font-size:14px;font-weight:700;color:#fff;background:var(--navy);border-radius:6px;}
.tag{padding:2px 7px;font-size:10.5px;font-weight:700;border-radius:4px;
 color:var(--navy);background:var(--tint);border:1px solid #cfd8e8;}
.pt{margin-left:auto;font-size:12px;color:var(--ink-3);}
.q img{display:block;max-width:100%;height:auto;}
.note{margin-top:18px;font-size:12px;color:var(--ink-3);line-height:1.7;}
@media print{body{background:#fff;}.sheet{max-width:none;padding:0;}}
"""

CSS_SOLVE = """
.q{border-bottom:1px solid var(--line);}
.meta{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px;}
.meta span{padding:2px 7px;font-size:11px;border-radius:4px;background:#f2f4f7;color:var(--ink-2);}
.meta .lv{background:var(--tint);color:var(--navy);font-weight:700;}
.ans{margin:8px 0 6px;padding:8px 12px;font-size:14px;font-weight:700;color:var(--navy);
 background:var(--tint);border-left:3px solid var(--navy);border-radius:0 5px 5px 0;}
.steps{margin:0;padding-left:19px;font-size:13.5px;line-height:1.85;color:var(--ink);}
.steps li{margin-bottom:3px;}
.miss{margin-top:9px;padding:8px 11px;font-size:12.5px;line-height:1.65;color:var(--ink-2);
 background:#fbfbfc;border:1px solid var(--line);border-radius:6px;}
.miss b{color:var(--navy);}
.sumtbl{width:100%;margin:16px 0 4px;border-collapse:collapse;font-size:12.5px;}
.sumtbl th,.sumtbl td{padding:6px 8px;border:1px solid var(--line);text-align:center;}
.sumtbl th{background:#f2f4f7;font-weight:600;}
"""

def b64img(path):
    with open(path, 'rb') as f:
        return 'data:image/png;base64,' + base64.b64encode(f.read()).decode()

def esc(s):
    return (s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;'))

def build(spec, imgdir, outdir):
    title, grade = spec['title'], spec['grade']
    qs = spec['questions']
    total = sum(q['points'] for q in qs)
    n_essay = sum(1 for q in qs if q['essay'])

    # ── 문제지 ─────────────────────────────────────────
    rows = []
    for i, q in enumerate(qs, 1):
        tag = '<span class="tag">서술형</span>' if q['essay'] else ''
        rows.append(
            f'<div class="q"><div class="qhead"><span class="qno">{i}</span>{tag}'
            f'<span class="pt">{q["points"]}점</span></div>'
            f'<img src="{b64img(os.path.join(imgdir, q["img"]))}" alt="{i}번 문제"></div>'
        )
    paper = f"""<!doctype html><html lang="ko"><head><meta charset="utf-8">
<title>{esc(title)} 문제지</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;600;700&display=swap">
<style>{CSS_COMMON}</style></head><body><div class="sheet">
<div class="head"><h1>알파학원 진단평가 · {esc(grade)} 수학</h1>
<div class="sub">{len(qs)}문항 · {total}점 만점<br>서술형 {n_essay}문항</div></div>
<div class="namebar"><div class="box"><b>이름</b></div><div class="box"><b>학교 · 학년</b></div><div class="box"><b>응시일</b></div></div>
{''.join(rows)}
<p class="note">· 서술형은 답만 쓰면 점수를 받지 못합니다. 풀이 과정을 함께 쓰세요.<br>
· 계산기를 쓰지 않습니다.</p>
</div></body></html>"""
    p1 = os.path.join(outdir, title.replace(' ', '_') + '_문제지.html')
    open(p1, 'w', encoding='utf-8').write(paper)

    # ── 해설 ───────────────────────────────────────────
    rows = []
    for i, q in enumerate(qs, 1):
        tag = '<span class="tag">서술형</span>' if q['essay'] else ''
        steps = ''.join(f'<li>{esc(s)}</li>' for s in q['steps'])
        rows.append(
            f'<div class="q"><div class="qhead"><span class="qno">{i}</span>{tag}'
            f'<span class="pt">{q["points"]}점 · {esc(q["src"])} {q["srcno"]}번</span></div>'
            f'<div class="meta"><span>{esc(q["unit"])}</span><span>{esc(q["type"])}</span>'
            f'<span class="lv">{esc(q["level"])}</span></div>'
            f'<div class="ans">정답 {esc(q["answer"])}</div>'
            f'<ol class="steps">{steps}</ol>'
            f'<div class="miss"><b>틀렸다면</b> — {esc(q["miss"])}</div></div>'
        )
    # 유형별 요약표
    order = ['연산·식 정리','공식·절차 적용','개념 이해','표현 해석','규칙 발견','논증·정당화','다단계 해결','실생활 적용']
    cells = []
    for t in order:
        ns = [str(i) for i, q in enumerate(qs, 1) if q['type'] == t]
        pts = sum(q['points'] for q in qs if q['type'] == t)
        if ns:
            cells.append(f'<tr><td>{t}</td><td>{len(ns)}</td><td>{pts}</td><td>{", ".join(ns)}</td></tr>')
    solve = f"""<!doctype html><html lang="ko"><head><meta charset="utf-8">
<title>{esc(title)} 해설</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;600;700&display=swap">
<style>{CSS_COMMON}{CSS_SOLVE}</style></head><body><div class="sheet">
<div class="head"><h1>알파학원 진단평가 · {esc(grade)} 수학 해설</h1>
<div class="sub">{len(qs)}문항 · {total}점 만점<br>교사용</div></div>
<table class="sumtbl"><thead><tr><th>유형</th><th>문항 수</th><th>배점</th><th>문항 번호</th></tr></thead>
<tbody>{''.join(cells)}</tbody></table>
<p class="note" style="margin-top:6px">유형별 득점률이 리포트의 레이더 차트가 됩니다. 한 유형에서 절반 아래면 약점으로 표시됩니다.</p>
{''.join(rows)}
</div></body></html>"""
    p2 = os.path.join(outdir, title.replace(' ', '_') + '_해설.html')
    open(p2, 'w', encoding='utf-8').write(solve)
    return p1, p2, total, n_essay

if __name__ == '__main__':
    spec = json.load(open(sys.argv[1], encoding='utf-8'))
    p1, p2, total, ne = build(spec, sys.argv[2], sys.argv[3])
    print('%s / %s : %d점, 서술형 %d문항' % (os.path.basename(p1), os.path.basename(p2), total, ne))
