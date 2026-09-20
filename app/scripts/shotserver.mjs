#!/usr/bin/env node
// 사용법 캡쳐를 받는 서버. 브라우저가 html-to-image 로 만든 PNG 를 여기로 보낸다.
//
//   node app/scripts/shotserver.mjs
//   POST http://localhost:5199/<이름>.png  →  app/public/manual/<이름>.png
//
// 화면이나 시험지를 바꾸면 public/manual/*.png 가 낡는다. 그때만 쓰는 도구라
// 빌드에는 끼지 않는다. 찍는 순서는 아래 주석에 적어 둔다.
//
// 1. npm run dev --prefix app
// 2. 뷰포트를 1320×1400 으로 맞춘다. 창이 좁아도 DOM 은 1320px 로 잡힌다
// 3. 자료가 필요한 캡쳐는 localStorage 의 sda.assess.v1 에 심고 reload
// 4. jsdelivr 의 html-to-image 를 <script> 로 넣는다. 페이지를 다시 읽으면
//    사라지니 찍기 직전에 다시 넣는다
// 5. await document.fonts.ready 뒤에
//    toBlob(el, { pixelRatio: 2, backgroundColor: '#ffffff' })
// 6. blob 을 http://localhost:5199/<이름>.png 로 POST
// 7. localStorage 를 비우고 npm run build 로 docs/ 에 옮긴다
//
// 찍는 자리
//   exams.png        시험지 화면의 .assess-pane
//   report.png       리포트 화면의 첫 .report-capture
//   report-hand.png  같은 자리에서 [손으로 적기] 를 켠 뒤
//   students.png     학생 화면의 .split (뷰포트 1256)
//   grading.png      채점 화면의 .assess-pane (뷰포트 1193)
//
// 걸려 넘어지는 것 둘
//   - 찍기 전에 input 의 값을 setAttribute('value', ...) 로 옮긴다.
//     안 하면 빈 칸으로 찍힌다.
//   - 웹폰트는 Google Fonts <link> 에 crossorigin="anonymous" 가 있어야 박힌다.
//     없으면 cssRules 가 던지고 @font-face 가 0개로 잡혀 대체 폰트로 찍힌다.
import { createServer } from 'node:http';
import { writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'manual');
const PORT = 5199;

createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') return res.writeHead(204).end();
  if (req.method !== 'POST') return res.writeHead(405).end('POST 만 받는다');

  // 이름을 그대로 경로에 붙이므로 글자를 좁게 막는다.
  const name = decodeURIComponent(req.url.replace(/^\//, ''));
  if (!/^[A-Za-z0-9_-]+\.png$/.test(name)) {
    return res.writeHead(400).end('파일 이름이 이상하다: ' + name);
  }
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const buf = Buffer.concat(chunks);
  await writeFile(join(OUT, name), buf);
  console.log('%s  %d바이트', name, buf.length);
  res.writeHead(200).end(String(buf.length));
}).listen(PORT, () => console.log('찍은 것을 받는다. http://localhost:%d → %s', PORT, OUT));
