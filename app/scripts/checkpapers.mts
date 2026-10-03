// scripts/checkpapers.mts
//
// 여덟 장 진단평가의 확정 구성을 checkPaper() 로 한 번에 검사한다.
//
//   npm run check:papers
//
// 확정 구성은 저장소의 진단평가/{학기}_문항분석/_단계별_결과/_시험지_확정.json 이다.
// 자료 폴더에서 고친 것을 sync.py 로 옮긴 뒤 돌린다. 어긋난 것이 하나라도 있으면
// 끝 코드 1 로 끝난다.
//
// 단원 계획은 확정 구성의 단원별 문항 수를 그대로 쓴다. 계획과 실제가 ±1 안에서
// 다를 수 있지만, 문항 수가 많은 단원(heavyUnits)을 가리는 데는 이것으로 족하다.

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, readFileSync } from 'node:fs';
import { checkPaper, type BonusRule, type PaperQuestion, type UnitPlan } from '../src/lib/paperRules.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '진단평가');
// 2026-10-03 전에 만든 여덟 장은 주관식이 1점 더 받는다. 그 뒤의 것은 풀이가
// 복잡한 문항이 1점 더 받는다. 원장님이 기존 여덟 장은 그대로 두기로 했다.
const GRADES: [string, BonusRule][] = [
  ['중1-1', '주관식'], ['중1-2', '주관식'], ['중2-1', '주관식'], ['중2-2', '주관식'],
  ['중3-1', '주관식'], ['중3-2', '주관식'], ['공통수학1', '주관식'], ['공통수학2', '주관식'],
  ['초6-1', '풀이'], ['초6', '풀이'], ['초5', '풀이'],
];

// 원장님이 넘기기로 한 것. 문항배정_순서.md 에 까닭이 있다.
const ALLOWED: Record<string, RegExp[]> = {
  '중3-1': [/^'식 설정'이 7문항입니다/],
};

let failed = 0;
for (const [grade, bonusBy] of GRADES) {
  const path = join(ROOT, `${grade}_문항분석`, '_단계별_결과', '_시험지_확정.json');
  if (!existsSync(path)) {
    console.log(`${grade}  아직 확정 구성이 없다`);
    continue;
  }
  const raw = JSON.parse(readFileSync(path, 'utf8')) as (PaperQuestion & { countAs?: string | null; subType?: string | null })[];
  // 2026-09-21 전에 만든 확정 구성은 주관식을 '서술형'으로 적었다
  const qs: PaperQuestion[] = raw.map((q) => ({
    ...q,
    format: q.format === '서술형' ? '주관식' : q.format,
    subType: q.subType ?? undefined,
    countAs: q.countAs ?? undefined,
  }));
  const plan: UnitPlan = {};
  for (const q of qs) plan[q.unit] = (plan[q.unit] ?? 0) + 1;
  const allowed = ALLOWED[grade] ?? [];
  const v = checkPaper(qs, plan, bonusBy).filter((x) => !allowed.some((re) => re.test(x.detail)));
  console.log(`${grade}  ${v.length ? `어긋난 것 ${v.length}` : '어긋난 것 없음'}`);
  for (const x of v) console.log(`  [${x.rule}] ${x.detail}`);
  failed += v.length;
}
process.exit(failed ? 1 : 0);
