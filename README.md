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
docs/         빌드 결과물 (GitHub Pages가 서빙. 직접 편집하지 말 것)
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

[`app/src/lib/firebase.ts`](app/src/lib/firebase.ts)의 `firebaseConfig`는 공개 식별자라 저장소에
그대로 두어도 됩니다. **실질적인 접근 통제는 전적으로 보안 규칙이 담당합니다.**

#### 시험지와 인쇄물은 저장소에서만 들어옵니다

앱에는 올리는 길이 없습니다. 시험지도 문제지·해설·출제표도 `app/public/papers/`
에 넣고 push 합니다. 그러면 어느 기기에서 열어도 같은 시험지가 보입니다.

1. `app/public/papers/` 에 파일을 넣는다. 이름은 `<시험지이름>_<종류>.<확장자>`
   (종류: `시험지` `문제지` `해설` `출제표` `채점표`)
2. `npm run build` 후 커밋 · push (약 1분 뒤 배포)
3. `_시험지.csv` 는 목록에 **저절로** 나타난다. 인쇄물은 [시험지] 탭에서
   **[＋문제지]** 를 눌러 고른다

CSV를 고쳐 push 하면 같은 이름의 시험지가 그 내용으로 바뀝니다. 시험지 id는
그대로라 **이미 저장된 채점 결과가 끊기지 않습니다.**

앱에서 시험지를 지우면 저장소에 CSV가 남아 있어도 다시 들어오지 않습니다.

목록은 빌드할 때 폴더를 훑어 만듭니다([`app/scripts/papers-manifest.mjs`](app/scripts/papers-manifest.mjs)).

`papers/` 는 공개 사이트로 그대로 나갑니다. 학생 이름이 든 파일을 두지 마세요.

#### 쓰는 사람이 바뀌면

1. [`firestore.rules`](firestore.rules)의 이메일 목록을 고친다
2. Firebase 콘솔 → Firestore Database → 규칙 에 같은 내용을 붙여넣고 **게시**
3. 두 곳이 어긋나면 콘솔 쪽이 실제로 적용되는 값이다

목록에 없는 계정은 로그인에 성공해도 앱에 `⚠ 접근 권한 없음`이 표시되고 데이터를 읽지 못합니다.

## CSV 형식

**시험지**: CSV 한 개 = 시험지 한 개

```
시험지,과목,문항번호,유형,정답,배점
중2 1차 진단,과학,1,자료 해석,3,3.5
중2 1차 진단,과학,2,분석·추론,①,4
```

필수는 `문항번호`, `유형`입니다. `유형`이 강점·약점 분석의 기준이 됩니다.

**학생 목록**은 `이름`, `학년` 열을 사용합니다. 같은 이름이 있으면 학년만 갱신하고 채점 결과는 보존합니다.
