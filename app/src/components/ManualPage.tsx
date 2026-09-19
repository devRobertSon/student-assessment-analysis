const SHOT = import.meta.env.BASE_URL + 'manual/';

/** 사용법 캡쳐. 화면을 그대로 담은 것이라 글로만 읽을 때보다 찾아가기 쉽다. */
function Shot({ src, alt, cap, narrow }: { src: string; alt: string; cap: string; narrow?: number }) {
  return (
    <figure className="shot" style={narrow ? { maxWidth: narrow } : undefined}>
      <img src={SHOT + src} alt={alt} loading="lazy" />
      <figcaption>{cap}</figcaption>
    </figure>
  );
}

const EXAM_CSV = `시험지,과목,문항번호,단원,유형,난이도,형식,배점,정답,출처,원문항,문제지,해설,출제표
중1-1 진단평가,수학,1,소인수분해,공식·절차 적용,상,객관식,3,④,심화,3,중1-1_진단평가_문제지.pdf,중1-1_진단평가_해설.pdf,중1-1_진단평가_출제표.csv
중1-1 진단평가,수학,2,소인수분해,논증·정당화,상,객관식,3,④,심화,4,,,
중1-1 진단평가,수학,6,소인수분해,규칙 발견,최상,서술형,5,42,심화,11,,,`;

const STUDENT_CSV = `이름,학년
홍길동,중2
김서준,중2
이하윤,중3`;

const GRADING_CSV = `학생,시험지,응시일,문항번호,형식,배점,OX
,중1-1 진단평가,2026-09-18,1,객관식,3,O
,중1-1 진단평가,2026-09-18,2,객관식,3,X
,중1-1 진단평가,2026-09-18,6,서술형,5,O`;

export default function ManualPage() {
  return (
    <div className="assess-pane manual">
      <div className="screen-head">
        <div>
          <h1>사용법</h1>
          <p className="muted">진단평가를 올리고 채점해 학생별 강점·약점 리포트를 만드는 순서입니다.</p>
        </div>
      </div>

      <section className="assess-card">
        <h3>전체 흐름</h3>
        <p className="muted">
          홈 화면의 카드 네 장이 이 순서 그대로입니다. 카드를 누르면 그 화면으로 바로 갑니다.
        </p>
        <ol className="flow">
          <li>
            <b>학생 등록</b>
            <span>[학생]에서 이름과 학년을 넣거나 CSV로 한 번에 불러옵니다.</span>
          </li>
          <li>
            <b>시험지 넣기</b>
            <span>
              저장소의 <code>app/public/papers/</code> 에 시험지 CSV를 넣고 push 합니다. 배포되면 [시험지] 목록에
              저절로 나타납니다.
            </span>
          </li>
          <li>
            <b>채점</b>
            <span>
              [채점]에서 학생과 시험지를 고르고 <b>[직접 입력]</b>으로 O/X를 찍거나, 채점 CSV를 올립니다.
            </span>
          </li>
          <li>
            <b>리포트</b>
            <span>[학생]에서 학생을 고르고 [리포트 열기] → 의견을 적고 PDF로 저장합니다.</span>
          </li>
        </ol>
        <Shot src="home.png" alt="홈 화면" cap="홈 화면. 카드를 누르면 그 화면으로 바로 갑니다." />
      </section>

      <section className="assess-card">
        <h3>학생</h3>
        <p className="muted">
          왼쪽 목록에서 학생을 고르면 오른쪽에 그 학생의 정보·응시 결과·정답률이 나옵니다. 목록의 이름 옆 숫자는{' '}
          <b>지금까지의 누적 정답률</b>입니다.
        </p>
        <ul className="bullets">
          <li>
            <b>[＋ 학생 추가]</b>는 이름과 학년만 넣으면 됩니다. 나머지는 나중에 채워도 됩니다.
          </li>
          <li>
            <b>[CSV 가져오기]</b>로 여러 명을 한 번에 넣습니다. <b>[내려받기]</b>는 지금 등록된 학생을 같은 형식의
            CSV로 받습니다.
          </li>
          <li>
            <b>학생 정보</b>에는 학교·연락처·학부모 연락처·형제 재원 여부·메모·목표 고등학교·과목별 진도를 적습니다.
            여기 적은 값이 <b>리포트 마지막 쪽 상담 카드</b>에 그대로 들어갑니다. 비워 두면 밑줄만 인쇄돼 손으로
            적습니다.
          </li>
          <li>
            <b>응시 결과</b>에 이 학생이 본 시험과 점수가 한 줄씩 나옵니다. 줄 끝 ✕ 로 그 응시만 지웁니다. 시험지와
            학생은 그대로 남습니다.
          </li>
          <li>
            <b>유형별 정답률</b>은 여러 번 응시했으면 <b>전부 합친</b> 결과입니다. 여기서는 레이더와 막대를 같이
            보여줍니다(리포트 1쪽은 레이더만).
          </li>
          <li>
            <b>[채점 입력]</b> · <b>[리포트 열기]</b> 로 바로 넘어갑니다. 리포트는 채점 결과가 하나라도 있어야
            눌립니다.
          </li>
        </ul>

        <p className="muted" style={{ marginTop: 14 }}>
          <b>학생 CSV</b>에 필요한 열은 <b>이름</b> 하나입니다. 학년은 없으면 비워 둡니다.
        </p>
        <pre className="manual-code">{STUDENT_CSV}</pre>
        <p className="hint">
          같은 이름이 이미 있으면 학년만 갱신하고 <b>채점 결과는 그대로 둡니다.</b> 학교·연락처처럼 나머지 정보는
          CSV로 못 넣습니다. 학생을 고른 뒤 [학생 정보]에서 적으세요.
        </p>
        <div className="assess-warn" style={{ marginTop: 12 }}>
          ⚠ 학생을 지우면 <b>그 학생의 채점 결과도 함께 지워집니다.</b> 응시 한 건만 지우려면 [응시 결과] 표의 ✕ 를
          쓰세요.
        </div>
        <Shot
          src="students.png"
          alt="학생 화면"
          cap="왼쪽 목록에서 학생을 고른 모습. 학생 정보 · 응시 결과 · 유형별 정답률이 차례로 나옵니다."
        />
      </section>

      <section className="assess-card">
        <h3>시험지 CSV</h3>
        <p className="muted">
          시험지는 <b>저장소에서만</b> 들어옵니다. 앱에 올리는 길은 없습니다. 엑셀·구글 시트에서 만들어{' '}
          <b>CSV로 저장</b>한 뒤 <code>app/public/papers/</code> 에{' '}
          <code>&lt;시험지이름&gt;_시험지.csv</code> 로 넣고 push 하면 목록에 나타납니다(배포까지 약 1분).
        </p>
        <pre className="manual-code">{EXAM_CSV}</pre>
        <table className="assess-table manual-table">
          <thead>
            <tr>
              <th style={{ width: 146 }}>열</th>
              <th style={{ width: 70 }}>필수</th>
              <th>설명</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <b>문항번호</b>
              </td>
              <td>필수</td>
              <td>1, 2, 3… 중복되면 마지막 값으로 덮어씁니다.</td>
            </tr>
            <tr>
              <td>
                <b>유형</b>
              </td>
              <td>필수</td>
              <td>
                <b>어떤 능력에서 막히는지</b> 봅니다. 같은 이름끼리 묶여 정답률이 계산되고, 리포트의 레이더 차트가 됩니다.
              </td>
            </tr>
            <tr>
              <td>단원</td>
              <td>선택</td>
              <td>
                <b>어느 단원을 안 배웠는지</b> 봅니다. 적으면 채점 화면 집계에 [단원] 탭이 생깁니다.
              </td>
            </tr>
            <tr>
              <td>난이도</td>
              <td>선택</td>
              <td>
                <b>어느 난이도부터 틀리는지</b> 봅니다. <code>표준</code> · <code>상</code> · <code>최상</code>으로 적으면 그 순서대로
                집계되고 리포트 제목 줄에 나옵니다.
              </td>
            </tr>
            <tr>
              <td>형식</td>
              <td>선택</td>
              <td>
                <code>서술형</code>으로 적으면 문항 칩과 채점 화면에 표시됩니다. 채점은 객관식과 같은 O/X입니다.
                비우면 객관식입니다.
              </td>
            </tr>
            <tr>
              <td className="nowrap">시험지 · 과목 · 정답 · 배점</td>
              <td>선택</td>
              <td>배점은 3.5처럼 소수점도 됩니다. 배점을 안 적으면 모든 문항을 1점으로 봅니다.</td>
            </tr>
            <tr>
              <td className="nowrap">출처 · 원문항</td>
              <td>선택</td>
              <td>교재 이름과 그 교재에서의 번호. 비슷한 문제를 다시 낼 때 찾아가는 용도입니다.</td>
            </tr>
            <tr>
              <td className="nowrap">문제지 · 해설 · 출제표</td>
              <td>선택</td>
              <td>
                같은 <code>papers/</code> 폴더의 파일 이름. 시험지 한 장에 하나씩이라 <b>첫 줄에만</b> 적으면 됩니다.
              </td>
            </tr>
          </tbody>
        </table>
        <p className="hint">
          열 순서는 상관없고 헤더 이름으로 알아봅니다. 모르는 열은 무시합니다. 같은 이름의 시험지를 고쳐 push 하면
          문항이 그 내용으로 바뀌고, <b>이미 저장된 채점 결과는 그대로 이어집니다.</b>
        </p>
        <Shot src="exams.png" alt="시험지 목록" cap="papers/ 에 넣은 시험지가 목록에 나타난 모습." />
      </section>

      <section className="assess-card">
        <h3>문제지 · 해설 · 출제표</h3>
        <p className="muted">
          시험지마다 인쇄물 세 가지를 붙일 수 있습니다. 파일은 시험지 CSV와 같은{' '}
          <code>app/public/papers/</code> 에 두고 push 합니다.
        </p>
        <ul className="bullets">
          <li>
            이름은 <code>&lt;시험지이름&gt;_문제지.pdf</code> · <code>_해설.pdf</code> · <code>_출제표.csv</code> 처럼
            붙입니다. 규칙에 안 맞아도 고르기 창의 <code>기타</code>에 나오므로 붙일 수는 있습니다.
          </li>
          <li>
            [시험지] 목록의 <b>인쇄물</b> 칸에서 <b>[＋문제지]</b>를 누르면 올려 둔 파일 목록이 뜹니다.
          </li>
          <li>
            고르고 나면 이름 아래에 <b>[보기]</b>와 <b>[다운로드]</b>가 생깁니다. <b>[보기]</b>는 열어 보기만 합니다.
            휴대폰에서도 내려받지 않습니다. 파일을 손에 넣으려면 <b>[다운로드]</b>를 누르세요.
            PDF는 새 탭에서 열리고, <b>출제표 같은 CSV는 앱 안에서 표로 뜹니다.</b> 브라우저가 CSV를 그리지 못하고
            내려받아 버리기 때문입니다.
          </li>
          <li>
            <b>이름을 누르면 고르기 창이 다시 열립니다.</b> 다른 파일로 바꿀 때 씁니다. 떼는 단추는 두지 않았습니다.
            옆에 있으면 누르려다 잘못 눌립니다.
          </li>
          <li>
            시험지에 저장되는 값은 <b>파일 이름 하나</b>입니다. 그래서 다른 기기에서도 같은 파일이 열립니다.
          </li>
        </ul>
        <div className="assess-warn" style={{ marginTop: 12 }}>
          ⚠ <code>papers/</code> 는 공개 사이트로 그대로 나갑니다. 학생 이름이 든 파일을 두지 마세요.
        </div>
        <Shot
          src="picker.png"
          alt="인쇄물 고르기 창"
          cap="[＋문제지]를 누르면 나오는 창. 고르려는 종류와 그 시험지에 맞는 파일이 위로 옵니다."
          narrow={420}
        />
      </section>

      <section className="assess-card">
        <h3>수학 유형 8가지</h3>
        <p className="muted">
          한국교육과정평가원이 수능 수학 문항에 붙이는 <b>행동 영역</b> 4개(계산·이해·추론·문제 해결)의 세부 항목 18개를
          성격이 같은 것끼리 8개로 묶은 것입니다. 중학교에서 쓰다가 고등·수능까지 그대로 이어집니다.
        </p>
        <table className="assess-table manual-table">
          <thead>
            <tr>
              <th style={{ width: 132 }}>유형</th>
              <th style={{ width: 92 }}>평가원 대영역</th>
              <th>이런 문항</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="nowrap"><b>연산·식 정리</b></td>
              <td>계산</td>
              <td>연산 법칙·성질을 적용해 식을 간단히 하는 문항</td>
            </tr>
            <tr>
              <td className="nowrap"><b>공식·절차 적용</b></td>
              <td>계산</td>
              <td>공식이나 정해진 풀이 절차를 그대로 적용하는 문항</td>
            </tr>
            <tr>
              <td className="nowrap"><b>개념 이해</b></td>
              <td>이해</td>
              <td>교과서 기본 예제 수준. 개념을 알면 바로 풀리는 문항</td>
            </tr>
            <tr>
              <td className="nowrap"><b>표현 해석</b></td>
              <td>이해</td>
              <td>그래프·표·기호의 의미를 읽거나, 상황을 식으로 바꾸는 문항</td>
            </tr>
            <tr>
              <td className="nowrap"><b>규칙 발견</b></td>
              <td>추론</td>
              <td>나열·관찰·유추로 규칙을 찾아야 풀리는 문항</td>
            </tr>
            <tr>
              <td className="nowrap"><b>논증·정당화</b></td>
              <td>추론</td>
              <td>참·거짓 판별, 반례 찾기, 증명 읽고 결론 내기</td>
            </tr>
            <tr>
              <td className="nowrap"><b>다단계 해결</b></td>
              <td>문제 해결</td>
              <td>두 개 이상의 개념을 엮거나, 두 단계 이상 거쳐야 하는 문항</td>
            </tr>
            <tr>
              <td className="nowrap"><b>실생활 적용</b></td>
              <td>문제 해결</td>
              <td>실생활이나 다른 과목 상황에 수학을 써서 푸는 문항</td>
            </tr>
          </tbody>
        </table>
        <p className="hint">
          문항 배분은 TIMSS 중2 권고 비중을 따르면 <b>연산·공식·개념 35% / 표현·규칙·논증 40% / 다단계·실생활 25%</b>{' '}
          정도가 됩니다.
        </p>
      </section>

      <section className="assess-card">
        <h3>과학 유형 8가지</h3>
        <p className="muted">
          2022 개정 교육과정 통합과학 기준 <b>평가 목표의 행동 영역</b>이 그대로 8개입니다. 따로 묶거나 쪼갤 필요가
          없습니다.
        </p>
        <table className="assess-table manual-table">
          <thead>
            <tr>
              <th style={{ width: 132 }}>유형 (차트 표기)</th>
              <th>평가원 원문</th>
            </tr>
          </thead>
          <tbody>
            <tr><td className="nowrap"><b>개념 이해</b></td><td>과학 지식 및 개념에 대한 이해</td></tr>
            <tr><td className="nowrap"><b>적용</b></td><td>적용</td></tr>
            <tr><td className="nowrap"><b>문제 인식·가설</b></td><td>문제 인식 및 가설 설정</td></tr>
            <tr><td className="nowrap"><b>탐구 설계</b></td><td>탐구 설계</td></tr>
            <tr><td className="nowrap"><b>탐구 수행</b></td><td>탐구 수행 및 자료 수집</td></tr>
            <tr><td className="nowrap"><b>자료 변환·해석</b></td><td>자료 변환 및 해석</td></tr>
            <tr><td className="nowrap"><b>결론·일반화</b></td><td>결론 도출 및 일반화</td></tr>
            <tr><td className="nowrap"><b>의사소통</b></td><td>의사소통</td></tr>
          </tbody>
        </table>
        <p className="hint">
          원문 이름이 길어 차트에서 잘리므로 왼쪽의 짧은 이름을 CSV에 쓰시기를 권합니다. 유형 이름은 CSV에 적은 글자
          그대로 묶이므로, 한번 정하면 바꾸지 말고 복사해 쓰세요.
        </p>
      </section>

      <section className="assess-card">
        <h3>유형을 어떻게 나눌까</h3>
        <p className="muted">
          유형 이름은 <b>글자가 정확히 같아야</b> 한 묶음이 됩니다. <code>자료 해석</code>과 <code>자료해석</code>은 다른
          유형으로 잡히니, 분류표를 하나 정해두고 CSV마다 복사해 쓰시는 편이 안전합니다.
        </p>
        <ul className="bullets">
          <li>
            <b>문항당 유형은 하나입니다.</b> 평가원도 수능 문항에 행동영역을 하나만 붙입니다. 둘을 붙이면 그 문항을
            틀렸을 때 어디서 막혔는지 모른 채 두 유형이 함께 내려가, 약점이 실제보다 넓게 보입니다. 고르기 어려우면
            &apos;이 문항을 틀린 학생은 무엇을 못한 것인가&apos;를 기준으로 하나만 고르세요.
          </li>
          <li>8개 유형으로 나누려면 문항이 <b>24개 이상</b>이어야 합니다. 유형당 3문항은 되어야 정답률이 의미를 가집니다.</li>
          <li>한 시험지에 유형이 3개 이상이어야 레이더 차트가 그려집니다. 리포트 1쪽에 이 차트가 들어갑니다.</li>
          <li>유형당 문항이 1~2개면 정답률이 0% 또는 100%로만 나와 판단이 어렵습니다. 3문항 이상을 권합니다.</li>
          <li>유형 분류를 바꾸면 홈 화면의 &apos;분석 유형&apos; 숫자도 저절로 따라갑니다. 코드를 고칠 필요가 없습니다.</li>
        </ul>
      </section>

      <section className="assess-card">
        <h3>채점</h3>
        <p className="muted">학생 → 시험지 순으로 고르면 문항 목록이 나옵니다. 넣는 길은 세 가지입니다.</p>
        <ul className="bullets">
          <li>
            <b>[직접 입력]</b>은 한 문항을 크게 띄웁니다. O나 X를 누르면 바로 다음 문항으로 넘어가므로 화면을
            내리지 않아도 됩니다. 키보드로도 같습니다. <code>O</code> <code>X</code>(한글 자판{' '}
            <code>ㅐ</code> <code>ㅌ</code>도) 또는 <code>1</code> <code>0</code>, <code>←</code> <code>→</code>{' '}
            이동, <code>Backspace</code> 지우기, <code>Esc</code> 닫기. 처음 열면 아직 안 매긴 첫 문항부터 시작합니다.
          </li>
          <li>
            <b>아래 표</b>에서는 문항마다 O/X를 직접 누릅니다. 몇 개만 고칠 때 빠릅니다. 같은 버튼을 한 번 더 누르면
            미입력으로 되돌아갑니다.
          </li>
          <li>
            <b>[채점 CSV 올리기]</b>는 다른 분이 채점해 왔을 때 씁니다. <b>[채점 CSV 내려받기]</b>로 빈 표를 받아
            넘기고, 채운 파일을 올리면 한 번에 들어갑니다.
          </li>
        </ul>
        <Shot
          src="dialog.png"
          alt="직접 입력 창"
          cap="[직접 입력] 창. O나 X를 누르면 바로 다음 문항으로 넘어갑니다."
          narrow={380}
        />
        <p className="muted" style={{ marginTop: 12 }}>
          <b>서술형도 O/X만 구분합니다.</b> 배점을 다 받으면 O, 답이 틀렸으면 X입니다. 부분점수는 없습니다. 배점은
          시험지에서 옵니다.
        </p>
        <pre className="manual-code">{GRADING_CSV}</pre>
        <p className="hint">
          필수는 <b>문항번호</b>와 <b>OX</b> 둘뿐입니다. OX 열에는 O/X 외에 1/0, 맞음/틀림, ○/× 도 인식합니다.
          빈칸은 미입력으로 둡니다. 예전에 쓰던 <b>득점</b> 열이 있는 표도 읽지만, 배점을 다 받았을 때만 O로 보고
          그 아래는 X로 접습니다.
        </p>
        <ul className="bullets" style={{ marginTop: 12 }}>
          <li>
            이미 채점한 조합을 다시 고르면 <b>저장된 채점을 불러옵니다.</b> 고쳐서 다시 저장하면 덮어씁니다.
          </li>
          <li>일부만 입력해도 저장됩니다. 입력한 문항만으로 정답률을 계산합니다.</li>
          <li>
            오른쪽 집계는 입력하는 즉시 갱신되고, <b>유형 · 단원 · 난이도</b> 탭으로 축을 바꿔 볼 수 있습니다. 단원과
            난이도는 시험지에 적어 둔 경우에만 나옵니다.
          </li>
          <li>
            <b>[채점 저장]</b>을 눌러야 리포트에 반영됩니다.
          </li>
          <li>
            잘못 저장했다면 그 조합을 다시 고른 뒤 <b>[채점 결과 삭제]</b>를 누릅니다. [학생] 화면의{' '}
            <b>응시 결과</b> 표에서도 한 건씩 지울 수 있습니다. 시험지와 학생은 그대로 남습니다.
          </li>
        </ul>
        <Shot
          src="grading.png"
          alt="채점 화면"
          cap="채점 화면. 왼쪽 표에서 바로 찍어도 되고, 오른쪽 집계는 입력하는 즉시 갱신됩니다."
        />
      </section>

      <section className="assess-card">
        <h3>리포트와 인쇄</h3>
        <ul className="bullets">
          <li>[학생]에서 학생을 고르고 [리포트 열기]를 누릅니다.</li>
          <li>응시가 여러 번이면 리포트에 넣을 시험을 고르거나 기간으로 선택할 수 있습니다.</li>
          <li>
            <b>1쪽</b>은 유형 레이더입니다. 여덟 유형의 정답률을 도형으로 보여주고, 각 꼭짓점에{' '}
            <code>25% 약점</code>처럼 글자를 함께 적어 흑백으로 인쇄해도 읽힙니다. 난이도는 제목 줄 오른쪽에{' '}
            <code>표준 63% · 상 79% · 최상 57%</code>처럼 함께 나옵니다.
          </li>
          <li>
            <b>종합 의견</b>은 채점 결과에서 초안이 자동으로 만들어집니다. 그대로 쓰거나 고쳐 쓰세요.
          </li>
          <li>
            <b>선생님 의견</b>은 비워두면 인쇄에서 빠집니다. 인쇄에는 <b>3줄까지</b> 나갑니다. 더 쓰면 미리보기에서
            잘린 채로 보이므로, 인쇄될 부분만 미리보기에 보입니다.
          </li>
          <li>
            응시 이력이 길어 1쪽에 다 안 들어가면 <b>이력과 의견이 2쪽으로 넘어가고 총 3쪽</b>이 됩니다. 그때 1쪽은
            분석 전용이 되어 레이더가 커지고 아래에 막대가 붙습니다.
          </li>
          <li>
            <b>마지막 쪽 상담 카드</b>는 [학생 정보]에 적어둔 값이 채워지고, 비운 항목은 밑줄만 인쇄돼 손으로 적습니다.
          </li>
          <li>[PDF 저장]을 누르면 A4 PDF가 받아집니다. 단추에 몇 쪽인지 적혀 있습니다.</li>
        </ul>
        <div className="assess-warn" style={{ marginTop: 12 }}>
          ⚠ 상담일·상담 메모·서명란과 의견 칸은 <b>저장되지 않는 임시 입력</b>입니다. 학생을 바꾸거나 새로고침하면
          비워지니, 적었다면 그 자리에서 PDF로 저장하세요.
        </div>
        <Shot
          src="report.png"
          alt="리포트 1쪽"
          cap="리포트 1쪽. 레이더 꼭짓점마다 정답률과 강점/약점이 글자로 함께 적혀 흑백으로 인쇄해도 읽힙니다."
          narrow={470}
        />
        <p className="hint" style={{ marginTop: 12 }}>
          미리보기 그대로 인쇄됩니다. 창이 좁으면 A4 크기라 가로로 넘칠 수 있지만, PDF는 똑같이 나옵니다.
        </p>
      </section>

      <section className="assess-card">
        <h3>데이터는 어디에 저장되나</h3>
        <ul className="bullets">
          <li>
            로그인하지 않아도 <b>이 브라우저에</b> 자동 저장됩니다. 다만 그 기기에서만 보입니다.
          </li>
          <li>
            오른쪽 위에서 <b>구글 로그인</b>을 하면 기기 간에 자동으로 동기화됩니다. <code>동기화됨 ✓</code> 표시를
            확인하세요.
          </li>
          <li>
            <code>⚠ 접근 권한 없음</code>이 뜨면 허용된 계정이 아닙니다. 관리자에게 계정 추가를 요청하세요.
          </li>
          <li>
            <b>[JSON 내보내기]</b>로 전체 데이터를 파일로 백업하고, <b>[JSON 가져오기]</b>로 되돌릴 수 있습니다.
          </li>
        </ul>
        <div className="assess-warn" style={{ marginTop: 12 }}>
          ⚠ [JSON 가져오기]는 현재 데이터를 <b>통째로 덮어씁니다.</b> 합치지 않습니다.
        </div>
      </section>

      <section className="assess-card">
        <h3>자주 막히는 곳</h3>
        <table className="assess-table manual-table">
          <thead>
            <tr>
              <th style={{ width: 240 }}>증상</th>
              <th>원인과 해결</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>push 했는데 시험지가 안 보임</td>
              <td>
                ① 배포가 아직 안 끝났습니다(약 1분). ② 파일 이름이 <code>_시험지.csv</code> 로 끝나야 합니다.
                ③ <b>문항번호</b> 또는 <b>유형</b> 열이 없습니다. ④ 앱에서 그 시험지를 ✕로 지운 적이 있으면 다시
                들어오지 않습니다.
              </td>
            </tr>
            <tr>
              <td>레이더 차트가 안 나옴</td>
              <td>유형이 3개 미만입니다.</td>
            </tr>
            <tr>
              <td>[＋문제지] 목록이 비어 있음</td>
              <td>
                <code>papers/</code> 에 파일이 없거나 배포 전입니다. 파일을 넣고 <code>npm run build</code> 후
                push 하세요.
              </td>
            </tr>
            <tr>
              <td>같은 유형인데 따로 집계됨</td>
              <td>띄어쓰기나 글자가 다릅니다. 예: 자료 해석 / 자료해석</td>
            </tr>
            <tr>
              <td>리포트 열기가 눌리지 않음</td>
              <td>그 학생의 채점 결과가 아직 없습니다. [채점]에서 먼저 저장하세요.</td>
            </tr>
            <tr>
              <td>홈 화면에 숫자가 안 보임</td>
              <td>
                일부러 숨긴 것입니다. 학부모 앞에서 여는 화면이라 &apos;시험지 3개&apos; 같은 숫자는 안 보이는 편이
                낫습니다. <b>시험지 20개</b>, <b>학생 50명</b>을 넘으면 나오고, <b>분석 유형</b>은 1개 이상이면 바로
                나옵니다.
              </td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  );
}
