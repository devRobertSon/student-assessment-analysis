// scripts/papers-manifest.mjs
//
// public/papers/ 안을 훑어 목록 파일(index.json)을 만든다.
// GitHub Pages는 폴더 목록을 보여주지 않으므로, 앱이 이 파일을 읽어
// "받을 수 있는 자료"를 그린다. 파일을 넣고 빼면 다음 빌드에 그대로 따라온다.
//
// 이름 규칙: <시험지이름>_<종류>.<확장자>  (예: 중1-1_진단평가_문제지.pdf)
// 규칙에 안 맞는 파일은 '기타'로 모은다.

import { readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, dirname, extname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'papers');
const OUT = join(DIR, 'index.json');

// 파일 이름 끝의 종류 → 목록에 보일 이름. 여기 없는 종류는 이름을 그대로 쓴다.
const LABELS = {
  문제지: '문제지 PDF',
  해설: '해설 PDF',
  시험지: '시험지 CSV',
  출제표: '출제표 CSV',
};
// 한 줄 안에서 늘 같은 차례로 보이도록.
const ORDER = ['시험지', '문제지', '해설', '출제표'];

let names = [];
try {
  names = readdirSync(DIR).filter((n) => n !== 'index.json' && !n.startsWith('.'));
} catch {
  // 폴더가 없으면 만들 목록도 없다. 빌드를 막지는 않는다.
  console.warn('[papers] public/papers 가 없어 목록을 건너뜁니다.');
  process.exit(0);
}

const groups = new Map();
for (const name of names.sort()) {
  const ext = extname(name).slice(1).toLowerCase();
  const stem = basename(name, extname(name));
  const cut = stem.lastIndexOf('_');
  const kind = cut === -1 ? '' : stem.slice(cut + 1);
  const known = Object.prototype.hasOwnProperty.call(LABELS, kind);
  const group = known ? stem.slice(0, cut).replace(/_/g, ' ') : '기타';
  if (!groups.has(group)) groups.set(group, []);
  groups.get(group).push({
    kind,
    label: known ? LABELS[kind] : name,
    file: name,
    ext,
    size: statSync(join(DIR, name)).size,
  });
}

const rank = (k) => {
  const i = ORDER.indexOf(k);
  return i === -1 ? ORDER.length : i;
};
// 가나다 순으로 놓으면 '공통수학' 이 '중' 보다 앞에 온다. 배우는 차례대로 놓는다.
const GRADES = ['중1', '중2', '중3', '공통수학'];
const grade = (name) => {
  const i = GRADES.findIndex((g) => name.startsWith(g));
  return i === -1 ? GRADES.length : i;
};

const list = [...groups.entries()]
  .map(([name, files]) => ({ name, files: files.sort((a, b) => rank(a.kind) - rank(b.kind)) }))
  // '기타'는 늘 마지막
  .sort((a, b) => {
    if (a.name === '기타' || b.name === '기타') return a.name === '기타' ? 1 : -1;
    return grade(a.name) - grade(b.name) || a.name.localeCompare(b.name, 'ko');
  });

writeFileSync(OUT, JSON.stringify({ groups: list }, null, 2) + '\n', 'utf8');
console.log('[papers] %d묶음 %d개 파일 → public/papers/index.json', list.length, names.length);
