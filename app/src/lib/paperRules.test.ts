// src/lib/paperRules.test.ts
import { describe, expect, it } from 'vitest';
import { LEVELS, Level, MATH_TYPES, PAPER_RULES, PaperQuestion, REASON_MIN, checkPaper, heavyUnits, pointsFor } from './paperRules';

/**
 * 기준에 맞는 시험지 하나를 만들어 두고, 한 군데씩 망가뜨려 가며 검사기가
 * 잡아내는지 본다. 만들어 둔 시험지 파일을 읽지 않는 이유는, 그 파일이
 * 바뀔 때마다 여기가 같이 깨져서 검사기 자체를 못 믿게 되기 때문이다.
 */
function paper(): PaperQuestion[] {
  // 앞에서부터 표준 5 · 상 15 · 최상 10. 최상이 표준보다 5개 많아 총점이 100이다.
  const levels: Level[] = [
    ...Array<Level>(5).fill('표준'),
    ...Array<Level>(15).fill('상'),
    ...Array<Level>(10).fill('최상'),
  ];
  // 서술형 자리는 정해 두지 않았다. 세 난이도에 걸치게 흩어 배점을 함께 본다.
  const essay = new Set([1, 9, 15, 23, 30]);
  // 유형은 8개가 다 나오고 3~5문항 사이. 4문항 여섯에 3문항 둘이면 30이 된다.
  const plan: [string, number][] = [
    ['연산 처리', 4],
    ['공식 활용', 4],
    ['개념 이해', 4],
    ['표현 해석', 4],
    ['규칙 발견', 4],
    ['근거 제시', 4],
    ['단계별 해결', 3],
    ['식 설정', 3],
  ];
  const types = plan.flatMap(([t, n]) => Array<string>(n).fill(t));

  return levels.map((level, i) => {
    const no = i + 1;
    const format = essay.has(no) ? '서술형' : '객관식';
    return {
      no,
      unit: `${Math.floor(i / 6) + 1}단원`,
      type: types[i],
      level,
      format,
      points: pointsFor(format, level),
      group: `뼈대-${no}`,
      reason: `${no}번은 ${types[i]}를 못 해서 틀린다. 앞 단계는 대부분 넘어간다.`,
    };
  });
}

/** 어긋난 것 중에 이 기준이 들어 있는가. */
const hit = (qs: PaperQuestion[], rule: string) => checkPaper(qs).some((x) => x.rule === rule);

describe('PAPER_RULES', () => {
  it('난이도 폭 안에서 문항 수를 맞출 수 있다', () => {
    const R = PAPER_RULES;
    expect(LEVELS.reduce((a, l) => a + R.levels[l].min, 0)).toBeLessThanOrEqual(R.count);
    expect(LEVELS.reduce((a, l) => a + R.levels[l].max, 0)).toBeGreaterThanOrEqual(R.count);
    expect(R.formats.객관식 + R.formats.서술형).toBe(R.count);
  });

  it('난이도 폭이 표준 대 상 대 최상 = 1 대 4 대 3 을 담는다', () => {
    const R = PAPER_RULES;
    expect(R.levels.표준.min).toBeLessThanOrEqual(5);
    expect(R.levels.표준.max).toBeGreaterThanOrEqual(5);
    expect(R.levels.상.min).toBeLessThanOrEqual(15);
    expect(R.levels.상.max).toBeGreaterThanOrEqual(15);
    expect(R.levels.최상.min).toBeLessThanOrEqual(10);
    expect(R.levels.최상.max).toBeGreaterThanOrEqual(10);
  });

  it('유형 8개를 최소·최대 안에서 문항 수에 맞출 수 있다', () => {
    const { min, max } = PAPER_RULES.perType;
    expect(MATH_TYPES.length * min).toBeLessThanOrEqual(PAPER_RULES.count);
    expect(MATH_TYPES.length * max).toBeGreaterThanOrEqual(PAPER_RULES.count);
  });

  it('배점은 난이도와 형식만으로 정해진다', () => {
    const R = PAPER_RULES;
    for (const l of LEVELS) {
      expect(R.points.객관식[l]).toBeGreaterThan(0);
      expect(R.points.서술형[l]).toBeGreaterThan(R.points.객관식[l]);
    }
    // 난이도가 오르면 배점도 오른다
    expect(R.points.객관식.표준).toBeLessThan(R.points.객관식.상);
    expect(R.points.객관식.상).toBeLessThan(R.points.객관식.최상);
  });

  it('서술형은 같은 난이도 객관식보다 1점 더 받는다', () => {
    for (const l of LEVELS) expect(pointsFor('서술형', l) - pointsFor('객관식', l)).toBe(1);
  });

  it('최상이 표준보다 5개 많으면 총점이 100이다', () => {
    const R = PAPER_RULES;
    for (const s of [4, 5]) {
      const u = s + 5;
      const t2 = R.count - s - u;
      const base = s * R.points.객관식.표준 + t2 * R.points.객관식.상 + u * R.points.객관식.최상;
      const premium = (R.points.서술형.표준 - R.points.객관식.표준) * R.formats.서술형;
      expect(base + premium).toBe(R.total);
    }
  });
});

describe('checkPaper', () => {
  it('기준에 맞는 시험지는 어긋난 것이 없다', () => {
    expect(checkPaper(paper())).toEqual([]);
  });

  it('문항 수가 모자라면 잡는다', () => {
    expect(hit(paper().slice(0, 29), '문항 수')).toBe(true);
  });

  it('문항번호가 빠지거나 겹치면 잡는다', () => {
    const qs = paper();
    qs[5].no = 7;
    const v = checkPaper(qs);
    expect(v.filter((x) => x.rule === '문항번호')).toHaveLength(2);
    expect(v.find((x) => x.detail.includes('6번이 없습니다'))).toBeTruthy();
    expect(v.find((x) => x.detail.includes('7번이 겹칩니다'))).toBeTruthy();
  });

  it('난이도가 폭을 벗어나면 잡는다', () => {
    const qs = paper();
    // 표준 다섯을 모두 상으로 바꾸면 표준 0, 상 20 으로 둘 다 폭 밖이다
    for (let i = 0; i < 5; i++) {
      qs[i].level = '상';
      qs[i].points = pointsFor(qs[i].format as '서술형', '상');
    }
    const v = checkPaper(qs);
    expect(v.filter((x) => x.rule === '난이도 구성')).toHaveLength(2);
  });

  it('난이도가 폭 안이면 난이도 구성으로는 안 걸린다', () => {
    const qs = paper();
    qs[0].level = '상'; // 표준 4, 상 16 으로 둘 다 폭 안이다
    qs[0].points = pointsFor(qs[0].format as '서술형', '상');
    expect(checkPaper(qs).some((x) => x.rule === '난이도 구성')).toBe(false);
  });

  it('형식 구성이 틀어지면 잡는다', () => {
    const qs = paper();
    qs[0].format = '객관식';
    qs[0].points = pointsFor('객관식', '표준');
    const v = checkPaper(qs);
    expect(v.filter((x) => x.rule === '형식 구성')).toHaveLength(2); // 객관식 26, 서술형 4
  });

  it('배점이 난이도·형식과 안 맞으면 잡는다', () => {
    const qs = paper();
    qs[10].points = 5; // 상 객관식은 3점
    const v = checkPaper(qs);
    expect(v.find((x) => x.rule === '배점')?.detail).toContain('11번(객관식 상)은 3점이어야 하는데 5점');
  });

  it('유형이 빠지거나 3문항에 못 미치면 잡는다', () => {
    const qs = paper();
    for (const q of qs) if (q.type === '식 설정') q.type = '연산 처리';
    const v = checkPaper(qs);
    expect(v.find((x) => x.detail.includes("'식 설정' 유형이 없습니다"))).toBeTruthy();
    expect(v.find((x) => x.detail.includes("'연산 처리'이 7문항"))).toBeTruthy();
  });

  it('유형이 5문항을 넘으면 잡는다', () => {
    const qs = paper();
    qs.find((q) => q.type === '식 설정')!.type = '연산 처리';
    qs.find((q) => q.type === '공식 활용')!.type = '연산 처리';
    const v = checkPaper(qs);
    expect(v.find((x) => x.detail.includes("'연산 처리'이 6문항"))).toBeTruthy();
    expect(v.find((x) => x.detail.includes("'식 설정'이 2문항"))).toBeTruthy();
  });

  it('같은 단원이 떨어져서 다시 나오면 잡는다', () => {
    const qs = paper();
    qs[29].unit = '1단원'; // 마지막 문항만 첫 단원으로 되돌린다
    expect(checkPaper(qs).find((x) => x.rule === '단원 묶음')?.detail).toContain('30번에서 다시 나옵니다');
  });

  it('같은 단원 안에서 풀이 뼈대가 겹치면 잡는다', () => {
    const qs = paper();
    qs[4].group = qs[2].group; // 3번과 5번은 같은 1단원이다
    const v = checkPaper(qs);
    expect(v.find((x) => x.rule === '풀이 묶음')?.detail).toContain('3, 5번이');
  });

  it('문항 수가 많은 단원은 한 묶음에서 두 문항까지 낸다', () => {
    const qs = paper();
    qs[4].group = qs[2].group; // 3번과 5번은 같은 1단원
    const plan = { '1단원': 10, '2단원': 6, '3단원': 6, '4단원': 4, '5단원': 4 };
    expect(heavyUnits(plan)).toEqual(['1단원']);
    expect(checkPaper(qs, plan).some((x) => x.rule === '풀이 묶음')).toBe(false);
    qs[0].group = qs[2].group; // 세 문항이 같은 묶음이면 넘어간다
    expect(checkPaper(qs, plan).some((x) => x.rule === '풀이 묶음')).toBe(true);
  });

  it('단원마다 고르게 낸 학기는 두 문항을 못 낸다', () => {
    expect(heavyUnits({ 가: 6, 나: 6, 다: 6 })).toEqual([]);
  });

  it('단원이 다르면 풀이 뼈대가 같아도 넘어간다', () => {
    const qs = paper();
    qs[8].group = qs[2].group; // 3번은 1단원, 9번은 2단원
    expect(qs[2].unit).not.toBe(qs[8].unit);
    expect(checkPaper(qs).some((x) => x.rule === '풀이 묶음')).toBe(false);
  });

  it('풀이 묶음이 비어 있으면 잡는다', () => {
    const qs = paper();
    qs[0].group = '';
    expect(checkPaper(qs).find((x) => x.detail.includes('1번에 풀이 묶음이 없습니다'))).toBeTruthy();
  });

  it('분류 근거가 없거나 너무 짧으면 잡는다', () => {
    const qs = paper();
    qs[0].reason = '';
    qs[1].reason = '계산 문제';
    const v = checkPaper(qs);
    expect(v.find((x) => x.detail.includes('1번에 유형을 왜'))).toBeTruthy();
    expect(v.find((x) => x.detail.includes('2번의 근거가'))).toBeTruthy();
    expect(REASON_MIN).toBeGreaterThan('계산 문제'.length);
  });

  it('모르는 난이도·형식·유형 이름을 잡는다', () => {
    const qs = paper();
    qs[0].level = '중';
    qs[1].format = '단답형';
    qs[2].type = '계산';
    const v = checkPaper(qs);
    expect(v.some((x) => x.rule === '난이도 값')).toBe(true);
    expect(v.some((x) => x.rule === '형식 값')).toBe(true);
    expect(v.some((x) => x.rule === '유형 값')).toBe(true);
  });

  it('부 유형이 주 유형과 같거나 8유형에 없으면 잡는다', () => {
    const qs = paper();
    qs[0].subType = qs[0].type;
    qs[1].subType = '계산';
    const v = checkPaper(qs).filter((x) => x.rule === '유형 값');
    expect(v.some((x) => x.detail.includes('1번은 주 유형과 부 유형이'))).toBe(true);
    expect(v.some((x) => x.detail.includes('2번의 부 유형이'))).toBe(true);
  });

  it('주 유형도 부 유형도 아닌 것으로 세면 잡는다', () => {
    const qs = paper();
    qs[0].subType = '식 설정';
    qs[0].countAs = '근거 제시';
    expect(checkPaper(qs).some((x) => x.detail.includes("1번을 '근거 제시'로 세려"))).toBe(true);
  });

  /**
   * 중1-1 처럼 주 유형으로는 규칙 발견이 한 문항밖에 없을 때, 그 문항의
   * 주 유형을 그대로 두고 부 유형으로 세어 3문항을 채운다.
   */
  it('주 유형으로 못 채우는 유형은 부 유형으로 채울 수 있다', () => {
    const qs = paper();
    // 규칙 발견 네 문항 중 셋을 다른 주 유형으로 바꾸고, 부 유형으로 되돌려 센다.
    const rule = qs.filter((q) => q.type === '규칙 발견');
    expect(rule.length).toBe(4);
    for (const q of rule.slice(0, 3)) {
      q.type = '단계별 해결';
      q.subType = '규칙 발견';
      q.countAs = '규칙 발견';
    }
    expect(checkPaper(qs)).toEqual([]);
  });

  it('주 유형으로 채울 수 있는데 부 유형으로 세면 잡는다', () => {
    const qs = paper();
    // 규칙 발견은 주 유형만으로 이미 네 문항이다. 여기에 한 문항을 더 얹으려 한다.
    const extra = qs.find((q) => q.type === '단계별 해결');
    expect(extra).toBeTruthy();
    extra!.subType = '규칙 발견';
    extra!.countAs = '규칙 발견';
    const v = checkPaper(qs);
    expect(v.some((x) => x.detail.includes("부 유형 '규칙 발견'로 셌는데"))).toBe(true);
  });

  /**
   * 중1-1 에서 등식의 성질을 같은 방법으로 묻는 두 문항이 함께 뽑힌 적이 있다.
   * 묶음만 보면 안 걸리므로 뼈대까지 본다.
   */
  it('묶음이 같은 짝은 뼈대가 달라야 한다', () => {
    const qs = paper();
    const plan = { '1단원': 6, '2단원': 6, '3단원': 6, '4단원': 6, '5단원': 6 };
    // 1단원 안에서 묶음을 겹치게 만든다. 평균을 넘는 단원이 없으므로
    // 겹치는 것 자체가 걸리도록, 문항 수가 많은 단원 계획을 따로 준다.
    const heavy = { '1단원': 10, '2단원': 5, '3단원': 5, '4단원': 5, '5단원': 5 };
    qs[0].group = '최대공약수';
    qs[1].group = '최대공약수';
    qs[0].skeleton = '나머지를 빼고 최대공약수 구하기';
    qs[1].skeleton = '나머지를 빼고 최대공약수 구하기';
    const v = checkPaper(qs, heavy);
    expect(v.some((x) => x.rule === '풀이 뼈대')).toBe(true);
    // 뼈대가 다르면 지나간다
    qs[1].skeleton = '빈틈없이 채우는 최대 한 변 구하기';
    expect(checkPaper(qs, heavy).some((x) => x.rule === '풀이 뼈대')).toBe(false);
    expect(checkPaper(qs, plan).some((x) => x.rule === '풀이 묶음')).toBe(true);
  });

  it('묶음이 겹치는데 뼈대를 안 적으면 잡는다', () => {
    const qs = paper();
    const heavy = { '1단원': 10, '2단원': 5, '3단원': 5, '4단원': 5, '5단원': 5 };
    qs[0].group = '최대공약수';
    qs[1].group = '최대공약수';
    const v = checkPaper(qs, heavy);
    expect(v.some((x) => x.detail.includes('풀이 뼈대가 없습니다'))).toBe(true);
  });

  it('묶음이 안 겹치면 뼈대는 안 봐도 된다', () => {
    const qs = paper();
    expect(qs.every((q) => q.skeleton === undefined)).toBe(true);
    expect(checkPaper(qs).some((x) => x.rule === '풀이 뼈대')).toBe(false);
  });

  it('부 유형을 안 적어도 검사는 그대로 지나간다', () => {
    const qs = paper();
    expect(qs.every((q) => q.subType === undefined)).toBe(true);
    expect(checkPaper(qs)).toEqual([]);
  });
});
