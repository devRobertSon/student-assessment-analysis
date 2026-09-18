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

기존 시간표 앱과 **같은 도메인**(`devrobertson.github.io`)에 배포되므로 localStorage가 공유됩니다.
그래서 키(`sda.assess.v1`)와 Firestore 문서 이름(`diagnostic-assessment`)을 기존 앱과 다르게 분리했습니다.
기존 데이터를 가져오려면 기존 앱에서 **JSON 내보내기** → 이 앱에서 **JSON 가져오기** 하세요.

접근 통제는 Firestore 보안 규칙(허용 이메일)으로 합니다. `firebaseConfig` 값은 공개용 식별자입니다.

## CSV 형식

**시험지** — CSV 한 개 = 시험지 한 개

```
시험지,과목,문항번호,유형,정답,배점
중2 1차 진단,과학,1,자료 해석,3,3.5
중2 1차 진단,과학,2,분석·추론,①,4
```

필수는 `문항번호`, `유형`입니다. `유형`이 강점·약점 분석의 기준이 됩니다.

**학생 목록** — `이름`, `학년` 열을 사용합니다. 같은 이름이 있으면 학년만 갱신하고 채점 결과는 보존합니다.
