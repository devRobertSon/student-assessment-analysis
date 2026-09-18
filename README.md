# student-assessment-analysis

진단평가를 학생별로 채점하고, **유형별 강점·약점 리포트**를 만드는 웹앱입니다.

`alpha-sodam-academy-schedule`의 평가 기능만 떼어내 만들었습니다. 로드맵·시간표 기능은 포함하지 않습니다.

- 배포: https://devrobertson.github.io/student-assessment-analysis/
- 방식: GitHub Pages `Deploy from a branch` → `main` / `docs` (GitHub Actions 사용 안 함)

## 구조

```
app/          소스 (Vite + React + TypeScript)
  src/
    App.tsx           탭 4개: 학생 관리 · 시험지 관리 · 채점 입력 · 리포트
    components/       화면 컴포넌트
    lib/
      assessment.ts   데이터 모델 · CSV 파싱 · 유형별 집계
      cloud.ts        구글 로그인 + Firestore 동기화
      firebase.ts     Firebase 초기화
docs/         빌드 결과물 (GitHub Pages가 서빙 — 직접 편집하지 말 것)
```

`vite.config.ts`의 `outDir`이 `../docs`라서 `npm run build` 하면 `docs/`가 갱신됩니다.

## 개발

```
cd app
npm install
npm run dev      # 로컬 미리보기
npm test         # 단위 테스트
npm run build    # docs/ 에 빌드 → 커밋 후 push 하면 배포됨
```

Node.js 20 이상이 필요합니다.

## 데이터

| 저장소 | 위치 | 비고 |
| --- | --- | --- |
| 브라우저 | `localStorage` 키 `sda.assess.v1` | 로그인 없이도 동작 |
| 클라우드 | Firestore `sync/diagnostic-assessment` | 구글 로그인 시 기기 간 동기화 |

Firebase는 **이 앱 전용 프로젝트**를 씁니다 (`alpha-sodam-academy-schedule`의 `sodam-alpha`와 분리).

localStorage 키도 분리돼 있습니다. GitHub Pages 프로젝트 페이지는 모두 `devrobertson.github.io`
한 도메인을 쓰기 때문에, 키가 같으면 두 앱이 서로의 데이터를 덮어씁니다.

기존 앱의 평가 데이터를 옮기려면 기존 앱에서 **JSON 내보내기** → 이 앱에서 **JSON 가져오기** 하세요.

### Firebase

프로젝트 `student-assessment-analysis` (Spark 무료 요금제)를 씁니다. 설정은 완료되어 있습니다.

| 항목 | 값 |
| --- | --- |
| 로그인 | 구글 계정만 |
| 승인된 도메인 | `devrobertson.github.io`, `localhost` |
| Firestore 위치 | `asia-northeast3` (서울) |
| 접근 허용 | [`firestore.rules`](firestore.rules)의 이메일 목록 |
| 파일 보관 | Storage — [`storage.rules`](storage.rules)의 이메일 목록 (같은 목록으로 맞출 것) |

[`app/src/lib/firebase.ts`](app/src/lib/firebase.ts)의 `firebaseConfig`는 공개 식별자라 저장소에
그대로 두어도 됩니다. **실질적인 접근 통제는 전적으로 보안 규칙이 담당합니다.**

#### 시험지에 올린 문제지·해설·출제표

데이터는 Firestore 문서 하나로 동기화되는데, 그 문서는 **1MB가 한도**라 PDF가
들어가지 않습니다. 그래서 파일만 **Storage**에 두고 시험지에는 경로(짧은 문자열)만
적습니다. 경로는 데이터와 같이 동기화되므로 다른 기기는 그 경로로 받아 갑니다.

처음 한 번 콘솔에서 켜 주어야 합니다:

1. Firebase 콘솔 → **Storage** → 시작하기 (위치는 Firestore와 같은 `asia-northeast3`)
2. **규칙** 탭에 [`storage.rules`](storage.rules) 내용을 붙여넣고 **게시**

켜지 않으면 파일은 그 기기에만 남고, 올릴 때 그 사실을 알리는 안내가 뜹니다.
목록에서 아직 그 기기에만 있는 파일은 작은 주황 점으로 표시됩니다.

#### 쓰는 사람이 바뀌면

1. [`firestore.rules`](firestore.rules)와 [`storage.rules`](storage.rules)의 이메일 목록을 고친다 — **두 파일을 같게**
2. Firebase 콘솔 → Firestore Database → 규칙, Storage → 규칙 에 각각 붙여넣고 **게시**
3. 두 곳이 어긋나면 콘솔 쪽이 실제로 적용되는 값이다
4. 한쪽만 고치면 데이터는 동기화되는데 파일만 안 보이는 상태가 된다

목록에 없는 계정은 로그인에 성공해도 앱에 `⚠ 접근 권한 없음`이 표시되고 데이터를 읽지 못합니다.

## CSV 형식

**시험지** — CSV 한 개 = 시험지 한 개

```
시험지,과목,문항번호,유형,정답,배점
중2 1차 진단,과학,1,자료 해석,3,3.5
중2 1차 진단,과학,2,분석·추론,①,4
```

필수는 `문항번호`, `유형`입니다. `유형`이 강점·약점 분석의 기준이 됩니다.

**학생 목록** — `이름`, `학년` 열을 사용합니다. 같은 이름이 있으면 학년만 갱신하고 채점 결과는 보존합니다.
