// src/lib/summary.ts
//
// 리포트 종합 의견을 유형별 성취에서 자동으로 짓는다.
//
// 원장님이 정하신 규칙(2026-10-01):
//  - 강점은 점수가 높은 두 유형을 들어 「~을 잘합니다」로 적는다
//  - 약점은 점수가 낮은 두 유형을 들어 「~이 부족합니다」로 적고 훈련까지 붙인다
//  - 둘씩 묶은 영역이 함께 강점이거나 약점이면 유형이 아니라 영역으로 적는다
//    (약점이면 영역 훈련까지 붙인다)
//
// 선생님이 손대기 전까지만 쓰인다. 한 글자라도 고치면 고친 글이 그대로 간다.

import { GIFTED_TEXT, MATH_SCALE, Scale, TypeStat } from './assessment';
import { AREA_GUIDE, guideOf, hasAreas } from './typeGuide';

/** 같은 말이 두 번 나오지 않게 추려 쉼표로 잇는다. */
function 이어(list: string[]): string {
  const 본: string[] = [];
  for (const x of list) if (x && !본.includes(x)) 본.push(x);
  // 「~하는 것과 ~하는 것」 으로 이으면 안의 '과' 와 헷갈린다. 쉼표로 잇는다.
  return 본.join(', ');
}

/** 문장에 넣을 한 덩어리. 영역을 묶은 것일 수도 있고 유형 하나일 수도 있다. */
interface Group {
  what: string;
  train: string;
}

/** 한 번에 이름을 대는 수. 원장님이 「가장 점수가 높은 2개」로 정하셨다. */
const 최대 = 2;

/**
 * 한쪽(강점 또는 약점)에 넣을 묶음을 고른다. 많아야 둘이다.
 *
 * 영역의 두 유형이 다 걸리면 그 영역 하나로 묶고, 그 유형들은 따로 적지 않는다.
 * 영역을 먼저 채우고 남은 자리에 유형을 붙인다. 강점은 점수가 높은 차례로,
 * 약점은 낮은 차례로 고른다.
 */
function 고른다(subject: string, hit: TypeStat[], all: TypeStat[], 강점: boolean): Group[] {
  const 걸린 = new Set(hit.map((s) => s.type));
  const groups: Group[] = [];
  const 쓴유형 = new Set<string>();

  if (hasAreas(subject)) {
    const 영역별 = new Map<string, TypeStat[]>();
    for (const s of all) {
      const area = guideOf(subject, s.type)?.area;
      if (!area) continue;
      const cur = 영역별.get(area);
      if (cur) cur.push(s);
      else 영역별.set(area, [s]);
    }
    const 후보 = [...영역별]
      // 그 영역의 유형이 시험지에 다 나왔고, 그 둘이 모두 걸렸을 때만 묶는다.
      .filter(([area, list]) => list.length >= 2 && list.every((s) => 걸린.has(s.type)) && AREA_GUIDE[area])
      .map(([area, list]) => ({ area, list, rate: list.reduce((a, s) => a + s.rate, 0) / list.length }));
    후보.sort((a, b) => (강점 ? b.rate - a.rate : a.rate - b.rate));
    for (const c of 후보.slice(0, 최대)) {
      const g = AREA_GUIDE[c.area];
      groups.push({ what: g.what, train: g.train });
      c.list.forEach((s) => 쓴유형.add(s.type));
    }
  }

  // hit 은 이미 점수 차례로 들어온다. 남은 자리에 유형을 붙인다.
  for (const s of hit) {
    if (groups.length >= 최대) break;
    if (쓴유형.has(s.type)) continue;
    const g = guideOf(subject, s.type);
    if (g) groups.push({ what: g.what, train: g.train });
  }
  return groups;
}

/**
 * 유형·영역 이름은 적지 않고 무엇을 잘하고 무엇이 모자라는지만 적는다.
 * 이름과 정답률은 바로 위 레이더에 다 나와 있어 두 번 적을 일이 아니다.
 */
function 문장(groups: Group[], 강점: boolean): string {
  if (groups.length === 0) return '';
  const 내용 = 이어(groups.map((g) => g.what));
  if (강점) return `${내용}을 잘합니다.`;
  const trains: string[] = [];
  for (const g of groups) if (!trains.includes(g.train)) trains.push(g.train);
  return `${내용}이 부족합니다. ${trains.join(' ')}`;
}

/**
 * 종합 의견 초안.
 *
 * @param subject 시험지 과목. 유형 풀이를 과목으로 가려낸다.
 * @param stats   유형별 성취. 약한 차례로 들어온다.
 * @param max     글자 수 한도. 넘으면 문장 단위로 잘라 낸다.
 * @param scale   강점·보완을 가르는 선. 시험지마다 다르다.
 * @param grade   영재성평가 등급(A·B·C). 주면 그 뜻을 첫 문장으로 붙인다.
 */
export function autoSummary(
  subject: string,
  stats: TypeStat[],
  max: number,
  scale: Scale = MATH_SCALE,
  grade?: string | null
): string {
  if (stats.length === 0) return '';
  const 강 = stats.filter((s) => s.rate >= scale.steady).slice().reverse();
  const 약 = stats.filter((s) => s.rate < scale.fair);

  const parts: string[] = [];
  // 등급이 있으면 그 뜻부터 적는다. 머리칸의 A·B·C 가 무슨 말인지 먼저 밝힌다.
  const 등급말 = grade ? GIFTED_TEXT[grade]?.own : undefined;
  if (등급말) parts.push(등급말);
  // 학부모가 먼저 읽는 줄에는 잘하는 것을 적는다. 그래서 강점을 앞에 둔다.
  if (강.length > 0) {
    parts.push(문장(고른다(subject, 강, stats, true), true));
  }

  if (약.length > 0) {
    parts.push(문장(고른다(subject, 약, stats, false), false));
  } else {
    parts.push(`정답률이 ${scale.fair * 100}%에 못 미치는 유형은 없습니다.`);
  }

  const text = parts.filter(Boolean).join(' ');
  if (text.length <= max) return text;
  // 자를 때는 문장 단위로 버린다. 말이 끊긴 채로 인쇄되면 안 된다.
  const 문장들 = text.split(/(?<=\.)\s+/);
  let out = '';
  for (const s of 문장들) {
    if ((out ? out.length + 1 : 0) + s.length > max) break;
    out = out ? `${out} ${s}` : s;
  }
  return out || text.slice(0, max);
}
