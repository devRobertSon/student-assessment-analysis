const EXAM_CSV = `시험지,과목,문항번호,유형,정답,배점
중2 1차 진단,과학,1,자료 해석,3,3.5
중2 1차 진단,과학,2,분석·추론,①,4
중2 1차 진단,과학,3,개념 이해,4,3`;

const STUDENT_CSV = `이름,학년
홍길동,중2
김서준,중2
이하윤,중3`;

const GRADING_CSV = `학생,시험지,응시일,문항번호,OX
홍길동,중2 1차 진단,2026-09-18,1,O
홍길동,중2 1차 진단,2026-09-18,2,X`;

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
        <ol className="flow">
          <li>
            <b>학생 등록</b>
            <span>[학생]에서 이름과 학년을 넣거나 CSV로 한 번에 불러옵니다.</span>
          </li>
          <li>
            <b>시험지 올리기</b>
            <span>[시험지]에서 문항별 유형이 적힌 CSV를 올립니다. CSV 한 개가 시험지 한 개입니다.</span>
          </li>
          <li>
            <b>채점</b>
            <span>[채점]에서 학생과 시험지를 고르고 문항마다 O/X를 누릅니다.</span>
          </li>
          <li>
            <b>리포트</b>
            <span>[학생]에서 학생을 고르고 [리포트 열기] → 의견을 적고 PDF로 저장합니다.</span>
          </li>
        </ol>
      </section>

      <section className="assess-card">
        <h3>시험지 CSV</h3>
        <p className="muted">
          엑셀·구글 시트에서 만들어 <b>CSV로 저장</b>해 올립니다. [시험지] 화면의 <b>[예시 CSV]</b> 버튼으로 양식을 받을
          수 있습니다.
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
                <b>이 값이 강점·약점 분석의 기준</b>입니다. 같은 이름끼리 묶여 정답률이 계산됩니다.
              </td>
            </tr>
            <tr>
              <td>시험지</td>
              <td>선택</td>
              <td>시험지 이름. 없으면 파일명을 씁니다.</td>
            </tr>
            <tr>
              <td className="nowrap">과목 · 정답 · 배점</td>
              <td>선택</td>
              <td>배점은 3.5처럼 소수점도 됩니다.</td>
            </tr>
          </tbody>
        </table>
        <p className="hint">열 순서는 상관없고 헤더 이름으로 알아봅니다. 모르는 열은 무시합니다.</p>
      </section>

      <section className="assess-card">
        <h3>유형을 어떻게 나눌까</h3>
        <p className="muted">
          유형 이름은 <b>글자가 정확히 같아야</b> 한 묶음이 됩니다. <code>자료 해석</code>과 <code>자료해석</code>은 다른
          유형으로 잡히니, 분류표를 하나 정해두고 CSV마다 복사해 쓰시는 편이 안전합니다.
        </p>
        <ul className="bullets">
          <li>한 시험지에 유형이 3개 이상이어야 레이더 차트가 그려집니다.</li>
          <li>유형당 문항이 1~2개면 정답률이 0% 또는 100%로만 나와 판단이 어렵습니다. 3문항 이상을 권합니다.</li>
          <li>유형 분류를 바꾸면 홈 화면의 &apos;분석 유형&apos; 숫자도 저절로 따라갑니다. 코드를 고칠 필요가 없습니다.</li>
        </ul>
      </section>

      <section className="assess-card">
        <h3>채점</h3>
        <ul className="bullets">
          <li>학생 → 시험지 순으로 고르면 문항 목록이 나옵니다.</li>
          <li>
            이미 채점한 조합을 다시 고르면 <b>저장된 채점을 불러옵니다.</b> 고쳐서 다시 저장하면 덮어씁니다.
          </li>
          <li>같은 버튼을 한 번 더 누르면 미입력으로 되돌아갑니다.</li>
          <li>일부만 입력해도 저장됩니다. 입력한 문항만으로 정답률을 계산합니다.</li>
          <li>오른쪽 유형별 집계는 입력하는 즉시 갱신됩니다. 저장해야 리포트에 반영됩니다.</li>
        </ul>
        <p className="muted" style={{ marginTop: 12 }}>
          종이 채점표를 따로 쓰신다면 <b>[채점 CSV 내려받기]</b>로 빈 표를 받아 적은 뒤 <b>[채점 CSV 올리기]</b>로 한 번에
          넣을 수 있습니다.
        </p>
        <pre className="manual-code">{GRADING_CSV}</pre>
        <p className="hint">OX 열에는 O/X 외에 1/0, 맞음/틀림, ○/× 도 인식합니다. 빈칸은 미입력으로 둡니다.</p>
      </section>

      <section className="assess-card">
        <h3>학생 CSV</h3>
        <pre className="manual-code">{STUDENT_CSV}</pre>
        <p className="hint">
          같은 이름이 이미 있으면 학년만 갱신하고 <b>채점 결과는 그대로 둡니다.</b> 학교·연락처·목표 고등학교·진도는 학생을
          고른 뒤 [학생 정보]에서 적습니다.
        </p>
      </section>

      <section className="assess-card">
        <h3>리포트와 인쇄</h3>
        <ul className="bullets">
          <li>[학생]에서 학생을 고르고 [리포트 열기]를 누릅니다.</li>
          <li>응시가 여러 번이면 리포트에 넣을 시험을 고르거나 기간으로 선택할 수 있습니다.</li>
          <li>
            <b>종합 의견</b>은 채점 결과에서 초안이 자동으로 만들어집니다. 그대로 쓰거나 고쳐 쓰세요.
          </li>
          <li>
            <b>선생님 의견</b>은 비워두면 인쇄에서 빠집니다.
          </li>
          <li>
            <b>2쪽 상담 카드</b>는 [학생 정보]에 적어둔 값이 채워지고, 비운 항목은 밑줄만 인쇄돼 손으로 적습니다.
          </li>
          <li>[PDF 저장]을 누르면 2쪽짜리 A4 PDF가 받아집니다.</li>
        </ul>
        <div className="assess-warn" style={{ marginTop: 12 }}>
          ⚠ 상담일·상담 메모·서명란과 의견 칸은 <b>저장되지 않는 임시 입력</b>입니다. 학생을 바꾸거나 새로고침하면
          비워지니, 적었다면 그 자리에서 PDF로 저장하세요.
        </div>
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
              <td>CSV를 올렸는데 문항을 못 읽음</td>
              <td>
                <b>문항번호</b> 또는 <b>유형</b> 열이 없습니다. 헤더 이름을 확인하세요.
              </td>
            </tr>
            <tr>
              <td>레이더 차트가 안 나옴</td>
              <td>유형이 3개 미만입니다. 막대 그래프는 그대로 나옵니다.</td>
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
              <td>시험지 20개, 학생 50명을 넘어야 표시됩니다. 분석 유형은 1개 이상이면 나옵니다.</td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  );
}
