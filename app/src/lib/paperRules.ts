// src/lib/paperRules.ts
//
// 진단평가 시험지를 만들 때 지키는 기준.
//
// 문항은 사람이 고른다. 고르고 나면 난이도 개수나 배점 합처럼 세어 봐야 아는
// 것이 틀어지기 쉬워서, 기준을 값으로 적어 두고 checkPaper() 로 한 번 훑는다.
// 이미 만든 시험지를 이 기준에 억지로 맞추려는 것이 아니라, 새로 만드는
// 시험지가 기준에 닿았는지 보는 자리다.
//
// **문항을 고르는 차례.** 검사기는 다 골라 놓은 시험지를 보는 자리이고,
// 고르는 차례는 따로 있다. 자세한 것은 자료 폴더의 `문항배정_순서.md` 에 있다.
// 요약하면 이렇다.
//
//   1. 문항 풀을 모두 읽어 풀이·유형·난이도·단원·근거를 붙인다
//   2. 단원 안에서 쓰는 개념의 조합이 같은 것끼리 묶는다. 한 묶음에서 한 문항만 쓴다.
//      문항 수가 많은 단원은 두 문항까지 쓰되 뼈대가 서로 달라야 한다
//   3. 묶음을 하나씩만 세어 유형 × 난이도 표를 만든다
//   4. 유형마다 3문항이 되는지 보고, 모자라면 그 유형에만 앞 학기 문항을
//      모자란 만큼 가져온다. 앞 학기 문항이 5개를 넘으면 멈추고 알린다
//   5. 유형별 목표 수를 정하고(합 30, 각 3~5) 적은 유형부터 채운다.
//      개수는 주 유형으로 세고, 주 유형만으로 3문항이 안 되는 유형만
//      부 유형이 그 유형인 문항으로 채운다
//   6. 난이도를 붙이고(표준 4~5·상 15~17·최상 9~10), 서술형 5문항을 고른다
//   7. 단원 배분을 ±1 안으로 맞춘다
//   8. 배점을 붙이고 checkPaper() 로 검사한다
//
// 기준끼리 부딪히면 **유형·난이도·형식은 못 바꾸고, 단원은 ±1 까지 봐 주며,
// 출처는 자유다.** 난이도와 형식을 어기면 배점 합이 100이 안 되고, 유형은
// 이 시험지를 만드는 목적 그 자체다.
//
// 여기서 세지 않는 것도 있다. 서술형을 몇 번에 두는지, 서술형을 어느 난이도로
// 낼지, 단원마다 몇 문항을 넣을지, 한 단원 안에서 난이도를 어떤 차례로 놓을지는
// 정해 두지 않았다. 문제를 보고 그때 고른다.

export type Level = '표준' | '상' | '최상';
export type Format = '객관식' | '서술형';

export const LEVELS: Level[] = ['표준', '상', '최상'];
export const FORMATS: Format[] = ['객관식', '서술형'];

/**
 * 수학 8유형. 차례는 [유형 분석] 화면의 표, 그리고 리포트 레이더와 같다.
 * 계산 · 이해 · 추론 · 문제 해결 네 영역이 둘씩 짝을 이룬다.
 *
 * **유형은 학생이 틀리는 이유로 가른다.** 한 문항을 푸는 데 여러 능력이 쓰여도,
 * 그 문항을 틀린 학생이 못 한 것은 대개 하나다. 그 하나를 유형으로
 * 삼는다. 답을 내기 직전에 무엇을 했는지로 정하지 않는다. 그렇게 하면
 * 어려운 문항은 마지막이 대개 계산이라 연산 처리로 몰려 버린다.
 *
 * 이 시험지는 학생이 무엇을 못 하는지 보려고 만드는 것이라 이 기준을 쓴다.
 */
export const MATH_TYPES = [
  '연산 처리',
  '공식 활용',
  '개념 이해',
  '표현 해석',
  '규칙 발견',
  '근거 제시',
  '단계별 해결',
  '식 설정',
];

export interface Band {
  min: number;
  max: number;
}

export interface PaperRules {
  count: number;
  total: number;
  levels: Record<Level, Band>;
  formats: Record<Format, number>;
  points: Record<Format, Record<Level, number>>;
  perType: { min: number; max: number };
}

export const PAPER_RULES: PaperRules = {
  /** 문항 수. 문항번호는 1부터 이 수까지 빠짐없이 한 번씩 붙는다. */
  count: 30,

  /** 만점. */
  total: 100,

  /**
   * 난이도별 문항 수. 딱 떨어지는 수가 아니라 폭으로 둔다.
   *
   * 입학 TEST 와 비슷하게 표준 : 상 : 최상 이 대략 1 : 4 : 3 이면 된다.
   * 유형을 고르게 담는 것이 먼저이고 난이도는 그 다음이다.
   *
   * 폭 안이어도 아무 수나 되는 것은 아니다. 아래 배점으로 총점을 100 에
   * 맞추려면 **최상이 표준보다 정확히 5개 많아야** 한다. 그래서 실제로 쓸 수
   * 있는 것은 표준 5 · 상 15 · 최상 10 과 표준 4 · 상 17 · 최상 9 둘이다.
   * 2026-09-20 에 원장님이 정했다.
   */
  levels: { 표준: { min: 4, max: 5 }, 상: { min: 15, max: 17 }, 최상: { min: 9, max: 10 } },

  /** 형식별 문항 수. */
  formats: { 객관식: 25, 서술형: 5 },

  /**
   * 배점. 난이도가 한 칸 오르면 1점 오르고, 서술형은 같은 난이도 객관식보다
   * 1점 더 받는다.
   *
   * 웃돈이 난이도마다 같은 것이 중요하다. 그래서 서술형 5문항을 어느 난이도에
   * 두든 총점이 100 그대로다. 서술형 난이도를 문제에 맞게 고를 수 있는 것이
   * 이 덕분이다.
   */
  points: {
    객관식: { 표준: 2, 상: 3, 최상: 4 },
    서술형: { 표준: 3, 상: 4, 최상: 5 },
  },

  /**
   * 유형별 문항 수. 8유형이 하나도 빠지지 않는다.
   *
   * 아래를 3으로 잡은 이유가 있다. 2문항짜리 유형은 하나만 틀려도 성취도가
   * 50퍼센트로 떨어져, 리포트가 약점이라고 짚은 것이 정말 약점인지 한두 문제
   * 운인지 가릴 수 없다.
   */
  perType: { min: 3, max: 5 },
};

/** 난이도와 형식이 정해지면 배점도 정해진다. 시험지를 만들 때 쓴다. */
export function pointsFor(format: Format, level: Level): number {
  return PAPER_RULES.points[format][level];
}

/** 단원마다 몇 문항을 낼지. 중1-1 은 소인수분해 6 · 정수와 유리수 8 · 문자와 식 10 · 그래프와 비례 6 이다. */
export type UnitPlan = Record<string, number>;

/**
 * 문항 수가 많은 단원. 평균보다 많이 내는 단원을 말한다.
 *
 * 이런 단원은 학원이 중히 보는 내용이라 같은 방법으로 푸는 문항을 두 번
 * 물어볼 값이 있다. 그래서 한 묶음에서 두 문항까지 낸다. 나머지 단원은
 * 한 묶음에 한 문항이다.
 *
 * 단원마다 똑같이 배분한 학기는 평균을 넘는 단원이 없으므로 아무 단원도
 * 두 문항을 못 낸다. 그때는 어느 단원도 더 중하지 않다는 뜻이다.
 */
export function heavyUnits(plan: UnitPlan): string[] {
  const units = Object.keys(plan);
  if (units.length === 0) return [];
  const avg = units.reduce((a, u) => a + plan[u], 0) / units.length;
  return units.filter((u) => plan[u] > avg);
}

/** 시험지 한 문항. CSV의 열 이름과 짝이 맞는다. */
export interface PaperQuestion {
  no: number; // 문항번호
  unit: string; // 단원
  /** 주 유형. 그 문항을 틀린 학생이 못 한 것 하나. */
  type: string;
  /**
   * 부 유형. 주 유형을 해낸 학생이 그다음으로 걸리는 것.
   *
   * 한 걸음으로 끝나는 문항은 부 유형이 없다. 그때는 비워 둔다.
   */
  subType?: string;
  /**
   * 유형별 개수를 셀 때 이 문항을 어느 유형으로 세는지. 비우면 주 유형이다.
   *
   * 주 유형으로 3문항을 채울 수 없는 유형이 있을 때만 부 유형으로 센다.
   * 중1-1 은 규칙 발견이 그렇다. 한 문항은 한 유형으로만 세므로 세는 유형의
   * 합은 늘 30이다.
   */
  countAs?: string;
  level: string; // 난이도
  format: string; // 형식
  points: number; // 배점
  /**
   * 풀이 묶음. 그 문항을 푸는 데 쓰는 **개념의 조합**을 적는다.
   *
   * 조합이 똑같아야 같은 묶음이다. 개념 하나가 겹치는 것만으로는 같은 묶음이
   * 아니다. 최소공배수와 제곱수 조건을 함께 쓰는 문항과 제곱수 조건만 쓰는
   * 문항은 다른 묶음이다.
   *
   * 개념은 굵게 나눈다. 단원에서 이름이 붙은 것만 세고, 사칙계산처럼 어느
   * 문항에나 들어가는 기본 계산은 세지 않는다. 중1-1 을 예로 들면 소수와
   * 합성수, 소인수분해, 약수의 개수, 최대공약수, 최소공배수, 제곱수 조건,
   * 수직선, 절댓값, 대소 관계, 역수 같은 것들이다.
   *
   * 적는 꼴은 개념을 `+` 로 이어 쓴다. 차례는 뜻이 없으므로 가나다 순으로
   * 적어 같은 조합이 늘 같은 글자가 되게 한다.
   *
   * **같은 단원 안에 같은 묶음이 둘 있으면 안 된다.** 다만 문항 수가 많은
   * 단원은 두 문항까지 낸다. heavyUnits() 를 보라.
   *
   * 원래 규칙은 이렇다. 한 단원에 같은 방법으로
   * 푸는 문항이 여럿이면 그 단원에서 학생이 무엇을 못 하는지 가릴 수 없다.
   *
   * 단원이 다르면 뼈대가 같아도 괜찮다. 단원마다 내용이 달라 학생이 겪는
   * 것도 다르고, 단원을 넘어 견주려면 문항 풀 전체를 한 번에 들고 있어야
   * 해서 실제로 하기도 어렵다.
   */
  group: string;
  /**
   * 풀이 뼈대. 이 문항을 푸는 **차례**를 한 줄로 적는다.
   *
   * 묶음이 쓰는 개념의 조합이라면 뼈대는 그 개념을 어떤 방법으로 묻는가다.
   * 묶음이 같아도 뼈대가 다르면 다른 문항이다. 등식의 성질로 다섯 명제의
   * 참거짓을 가리는 문항 둘은 묶음도 뼈대도 같다.
   *
   * **같은 단원에서 묶음이 같은 두 문항은 뼈대가 서로 달라야 한다.** 묶음만
   * 보면 같은 것을 같은 방법으로 두 번 묻는 것을 못 거른다. 2026년 9월 21일에
   * 조판한 시험지에서 그런 짝이 나와 규칙에 넣었다.
   *
   * 뼈대는 사람이 쓰는 글이라 말이 조금 달라도 같은 뼈대일 수 있다. 검사기는
   * 글자가 같은 것만 잡으므로, 묶음이 겹치는 짝은 13단계에서 눈으로 본다.
   */
  skeleton?: string;
  /**
   * 분류 근거. 이 문항을 틀린 학생이 무엇을 못 한 것인지 적는다.
   *
   * 문항마다 적어야 한다. 근거가 원장님을 납득시키지 못하면 그 문항은
   * 쓰지 않고 다른 문항을 고른다. 유형이 시험지의 뼈대이므로, 근거 없이
   * 붙인 유형 하나가 유형별 성취도 전체를 흐린다.
   *
   * 다른 선생님들도 읽는 글이다. 무엇을 보고 그 유형으로 봤는지가
   * 드러나야 한다.
   */
  reason: string;
}

/** 분류 근거로 쳐 주는 가장 짧은 길이. 이보다 짧으면 안 쓴 것으로 본다. */
export const REASON_MIN = 20;

export interface Violation {
  /** 어느 기준인지. 같은 기준에서 여러 개가 나올 수 있다. */
  rule: string;
  /** 무엇이 어긋났는지. 그대로 사람에게 보여 줄 수 있게 적는다. */
  detail: string;
}

const count = <T>(xs: T[], hit: (x: T) => boolean) => xs.filter(hit).length;

/**
 * 시험지가 기준에 맞는지 본다. 어긋난 것을 모두 모아 돌려준다.
 *
 * 첫 번째에서 멈추지 않는 이유가 있다. 문항을 고르다 보면 난이도와 유형이 함께
 * 틀어지는 일이 흔한데, 하나씩 고쳐 가며 다시 돌리면 그때마다 다음 것이 새로
 * 나온다. 한 번에 다 보여 주는 편이 고치기 쉽다.
 */
export function checkPaper(questions: PaperQuestion[], plan?: UnitPlan): Violation[] {
  const v: Violation[] = [];
  const add = (rule: string, detail: string) => v.push({ rule, detail });
  const R = PAPER_RULES;

  // 문항 수와 번호. 번호가 빠지거나 겹치면 뒤에서 세는 것이 다 어긋나므로 먼저 본다.
  if (questions.length !== R.count) {
    add('문항 수', `${R.count}문항이어야 하는데 ${questions.length}문항입니다.`);
  }
  const nos = questions.map((q) => q.no).sort((a, b) => a - b);
  const missing = [];
  for (let i = 1; i <= R.count; i++) if (!nos.includes(i)) missing.push(i);
  if (missing.length) add('문항번호', `${missing.join(', ')}번이 없습니다.`);
  const dup = nos.filter((n, i) => i > 0 && n === nos[i - 1]);
  if (dup.length) add('문항번호', `${[...new Set(dup)].join(', ')}번이 겹칩니다.`);

  // 난이도 · 형식에 모르는 값이 섞였는지. 섞여 있으면 개수도 배점도 못 센다.
  for (const q of questions) {
    if (!LEVELS.includes(q.level as Level)) {
      add('난이도 값', `${q.no}번의 난이도가 '${q.level}'입니다. ${LEVELS.join(' · ')} 중 하나여야 합니다.`);
    }
    if (!FORMATS.includes(q.format as Format)) {
      add('형식 값', `${q.no}번의 형식이 '${q.format}'입니다. ${FORMATS.join(' · ')} 중 하나여야 합니다.`);
    }
    if (!MATH_TYPES.includes(q.type)) {
      add('유형 값', `${q.no}번의 주 유형이 '${q.type}'입니다. 8유형에 없는 이름입니다.`);
    }
    if (q.subType && !MATH_TYPES.includes(q.subType)) {
      add('유형 값', `${q.no}번의 부 유형이 '${q.subType}'입니다. 8유형에 없는 이름입니다.`);
    }
    if (q.subType && q.subType === q.type) {
      add('유형 값', `${q.no}번은 주 유형과 부 유형이 '${q.type}'로 같습니다.`);
    }
    if (q.countAs && q.countAs !== q.type && q.countAs !== q.subType) {
      add('유형 값', `${q.no}번을 '${q.countAs}'로 세려 합니다. 주 유형이나 부 유형 중 하나여야 합니다.`);
    }
  }

  // 난이도 구성. 폭 안에 들면 된다.
  for (const lv of LEVELS) {
    const got = count(questions, (q) => q.level === lv);
    const b = R.levels[lv];
    if (got < b.min || got > b.max) {
      add('난이도 구성', `${lv} 문항이 ${b.min}~${b.max}개여야 하는데 ${got}개입니다.`);
    }
  }

  // 총점. 난이도 구성이 어긋나면 여기서도 걸린다.
  const sum = questions.reduce((a, q) => a + q.points, 0);
  if (sum !== R.total) {
    add('총점', `${R.total}점이어야 하는데 ${sum}점입니다. 최상 문항이 표준보다 5개 많아야 100점이 됩니다.`);
  }

  // 형식 구성.
  for (const f of FORMATS) {
    const got = count(questions, (q) => q.format === f);
    if (got !== R.formats[f]) add('형식 구성', `${f}이 ${R.formats[f]}문항이어야 하는데 ${got}문항입니다.`);
  }

  // 배점. 난이도와 형식이 정해지면 배점은 따라온다.
  for (const q of questions) {
    if (!LEVELS.includes(q.level as Level) || !FORMATS.includes(q.format as Format)) continue;
    const want = pointsFor(q.format as Format, q.level as Level);
    if (q.points !== want) {
      add('배점', `${q.no}번(${q.format} ${q.level})은 ${want}점이어야 하는데 ${q.points}점입니다.`);
    }
  }

  // 유형. 8개가 다 나오고, 하나에 몰리지도 모자라지도 않아야 한다.
  // 개수는 세는 유형(countAs, 비우면 주 유형)으로 센다.
  const countedType = (q: PaperQuestion) => q.countAs ?? q.type;
  for (const t of MATH_TYPES) {
    const got = count(questions, (q) => countedType(q) === t);
    if (got === 0) add('유형', `'${t}' 유형이 없습니다.`);
    else if (got < R.perType.min) add('유형', `'${t}'이 ${got}문항입니다. ${R.perType.min}문항 이상이어야 합니다.`);
    else if (got > R.perType.max) add('유형', `'${t}'이 ${got}문항입니다. ${R.perType.max}문항 이하여야 합니다.`);
  }

  // 부 유형으로 세는 것은 주 유형만으로 채울 수 없는 유형에만 허용한다.
  // 채울 수 있는데도 부 유형으로 세면 주 유형 쪽 개수가 흐려진다.
  for (const q of questions) {
    const t = countedType(q);
    if (t === q.type) continue;
    const byMain = count(questions, (x) => x.type === t);
    if (byMain >= R.perType.min) {
      add('유형', `${q.no}번을 부 유형 '${t}'로 셌는데, 그 유형은 주 유형 문항만 ${byMain}개라 채울 수 있습니다.`);
    }
  }

  // 풀이 묶음. 같은 단원 안에서 뼈대가 겹치면 안 된다. 단원이 다르면 괜찮다.
  const bag = new Map<string, number[]>();
  for (const q of questions) {
    const g = (q.group ?? '').trim();
    if (!g) add('풀이 묶음', `${q.no}번에 풀이 묶음이 없습니다.`);
    else {
      const key = `${q.unit}\0${g}`;
      bag.set(key, [...(bag.get(key) ?? []), q.no]);
    }
  }
  const heavy = new Set(plan ? heavyUnits(plan) : []);
  for (const [key, nos] of bag) {
    const [unit, g] = key.split('\0');
    const cap = heavy.has(unit) ? 2 : 1;
    if (nos.length > cap) {
      const tail = cap === 2 ? '문항 수가 많은 단원이라 두 문항까지입니다.' : '한 묶음에 한 문항입니다.';
      add('풀이 묶음', `${unit} 단원의 ${nos.join(', ')}번이 '${g}' 로 묶음이 같습니다. ${tail}`);
    }
  }

  // 묶음이 같은 짝은 뼈대가 달라야 한다. 같은 것을 같은 방법으로 두 번 묻지
  // 않으려는 것이다.
  for (const [key, nos] of bag) {
    if (nos.length < 2) continue;
    const [unit, g] = key.split(' ');
    const qs = nos.map((n) => questions.find((q) => q.no === n)!);
    const blank = qs.filter((q) => !(q.skeleton ?? '').trim()).map((q) => q.no);
    if (blank.length) {
      add('풀이 뼈대', `${unit} 단원의 ${blank.join(', ')}번에 풀이 뼈대가 없습니다. '${g}' 묶음이 겹쳐 뼈대를 봐야 합니다.`);
      continue;
    }
    const seen = new Map<string, number>();
    for (const q of qs) {
      const k = (q.skeleton ?? '').trim();
      const first = seen.get(k);
      if (first !== undefined) {
        add('풀이 뼈대', `${unit} 단원의 ${first}, ${q.no}번이 '${g}' 묶음에 뼈대까지 같습니다.`);
      } else seen.set(k, q.no);
    }
  }

  // 분류 근거. 있는지와 너무 짧지 않은지만 본다. 납득이 되는지는 사람이 읽고 정한다.
  for (const q of questions) {
    const r = (q.reason ?? '').trim();
    if (!r) add('분류 근거', `${q.no}번에 유형을 왜 그렇게 봤는지가 없습니다.`);
    else if (r.length < REASON_MIN) add('분류 근거', `${q.no}번의 근거가 ${r.length}자입니다. 한 줄로는 남이 읽고 판단할 수 없습니다.`);
  }

  // 단원 묶음. 단원마다 몇 문항인지는 정하지 않았고, 한 단원이 이어져 있는지만 본다.
  // 같은 단원이 떨어져서 다시 나오면 학생이 단원을 오갔다 돌아오게 된다.
  const seen = new Set<string>();
  let prev = '';
  for (const q of [...questions].sort((a, b) => a.no - b.no)) {
    if (q.unit === prev) continue;
    if (seen.has(q.unit)) add('단원 묶음', `'${q.unit}' 단원이 ${q.no}번에서 다시 나옵니다.`);
    seen.add(q.unit);
    prev = q.unit;
  }

  return v;
}
