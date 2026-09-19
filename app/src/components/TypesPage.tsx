/**
 * 유형 분석 탭.
 *
 * 리포트 레이더의 여덟 꼭짓점이 무엇인지, 어디서 나온 구분인지, 그리고
 * 어느 유형의 정답률이 낮을 때 무엇을 시키면 되는지를 모아 둔다. 사용법이 아니라
 * 수업에 쓰는 내용이라 탭을 따로 뒀다.
 */
export default function TypesPage() {
  return (
    <div className="assess-pane manual">
      <div className="screen-head">
        <div>
          <h1>유형 분석</h1>
          <p className="muted">
            리포트의 레이더 차트에 나오는 여덟 유형입니다. 각 유형이 무엇을 평가하는지와, 정답률이 낮을 때
            무엇을 연습시키면 되는지를 적었습니다.
          </p>
        </div>
      </div>

      <section className="assess-card">
        <h3>수학 유형 8가지</h3>
        <p className="muted">
          한국교육과정평가원이 수능 수학 문항에 붙이는 <b>행동 영역</b>은 <b>계산 · 이해 · 추론 · 문제 해결</b> 넷입니다.
          넷만으로는 한 영역에 문항이 몰려 무엇을 못하는지 좁혀지지 않습니다. 각 영역을{' '}
          <b>서로 다른 두 능력</b>으로 나누어 여덟 가지로 씁니다. 중학교에서 쓰다가 고등·수능까지 그대로 이어집니다.
        </p>
        <table className="assess-table manual-table">
          <thead>
            <tr>
              <th style={{ width: 92 }}>평가원 영역</th>
              <th>구분 기준</th>
              <th style={{ width: 186 }}>두 유형</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="nowrap"><b>계산</b></td>
              <td>식을 정확히 계산하는 능력과, 쓸 공식을 고르는 능력</td>
              <td className="nowrap">연산 처리 / 공식 활용</td>
            </tr>
            <tr>
              <td className="nowrap"><b>이해</b></td>
              <td>정의를 아는 능력과, 그래프·표·기호를 읽는 능력</td>
              <td className="nowrap">개념 이해 / 표현 해석</td>
            </tr>
            <tr>
              <td className="nowrap"><b>추론</b></td>
              <td>관찰로 규칙을 찾는 능력(귀납)과, 근거로 판단하는 능력(연역)</td>
              <td className="nowrap">규칙 발견 / 근거 제시</td>
            </tr>
            <tr>
              <td className="nowrap"><b>문제 해결</b></td>
              <td>여러 단계를 이어 푸는 능력과, 문장으로 된 상황을 식으로 옮기는 능력</td>
              <td className="nowrap">단계별 해결 / 식 설정</td>
            </tr>
          </tbody>
        </table>

        <h4 className="manual-h4">유형별 설명과 훈련법</h4>
        <ul className="bullets type-guide">
          <li>
            <b>연산 처리</b> <span className="tg-area">계산</span>
            <p>연산 법칙과 성질을 써서 식을 정확히 계산하는 능력입니다. 방법은 알면서 계산에서 틀리는 경우입니다.</p>
            <p className="tg-train">
              <b>훈련</b> 틀린 문제를 다시 풀리지 말고 <b>어느 줄에서 틀렸는지 찾게</b> 하세요. 부호인지 분배인지
              통분인지를 학생이 짚어야 합니다. 열 문항을 빨리 푸는 것보다 다섯 문항을 검산까지 하는 편이 낫습니다.
            </p>
          </li>
          <li>
            <b>공식 활용</b> <span className="tg-area">계산</span>
            <p>어떤 공식이나 풀이 절차를 쓸지 고르고, 그대로 적용하는 능력입니다.</p>
            <p className="tg-train">
              <b>훈련</b> 공식을 외우게 하지 말고 <b>언제 쓰는지</b>를 묻습니다. 단원이 끝나면 공식을 적고 그 옆에
              &apos;이런 말이 나오면 이걸 쓴다&apos;를 한 줄씩 붙이게 하세요.
            </p>
          </li>
          <li>
            <b>개념 이해</b> <span className="tg-area">이해</span>
            <p>정의와 성질을 알면 바로 풀리는 문항입니다. 교과서 기본 예제 수준입니다.</p>
            <p className="tg-train">
              <b>훈련</b> 정의를 <b>말로 설명하게</b> 합니다. &apos;소수가 뭐야?&apos;에 &apos;1과 자기 자신만 약수인
              수&apos;까지 나와야 합니다. 반례를 하나 들어 보라고 하면 이해했는지 외웠는지 구분됩니다.
            </p>
          </li>
          <li>
            <b>표현 해석</b> <span className="tg-area">이해</span>
            <p>
              그래프·표·전개도·새로 정의된 기호처럼 <b>이미 수학으로 적혀 있는 것</b>을 읽는 능력입니다. 문장으로 된
              상황을 식으로 옮기는 것은 여기가 아니라 <b>식 설정</b>입니다.
            </p>
            <p className="tg-train">
              <b>훈련</b> 풀기 전에 <b>그림에서 읽히는 것을 말로 적게</b> 하세요. 축이 무엇인지, 한 칸이 얼마인지부터
              적습니다. 새 기호가 나오면 문제에 딸린 예시에 넣어 검산해 보는 것이 먼저입니다.
            </p>
          </li>
          <li>
            <b>규칙 발견</b> <span className="tg-area">추론</span>
            <p>나열하고 관찰해서 규칙을 찾아야 풀리는 문항입니다.</p>
            <p className="tg-train">
              <b>훈련</b> 답을 알려주지 말고 <b>작은 수부터 직접 써 보게</b> 합니다. 1, 2, 3을 손으로 적어 표를 만들면
              규칙이 보입니다. 이 과정을 건너뛰면 식을 세우지 못합니다.
            </p>
          </li>
          <li>
            <b>근거 제시</b> <span className="tg-area">추론</span>
            <p>참·거짓을 판단하고 그 근거를 대는 능력입니다. 반례 찾기, 증명을 읽고 결론 내기가 여기 속합니다.</p>
            <p className="tg-train">
              <b>훈련</b> 답이 맞아도 <b>&apos;왜?&apos;를 한 번 더</b> 묻습니다. 틀린 선지에는 반례를 하나씩 들게
              하세요. 반례를 대지 못하면 답이 맞았어도 근거 없이 고른 것입니다.
            </p>
          </li>
          <li>
            <b>단계별 해결</b> <span className="tg-area">문제 해결</span>
            <p>두 단계 이상을 거치거나 두 개념 이상을 엮어야 끝나는 문항입니다.</p>
            <p className="tg-train">
              <b>훈련</b> 풀기 전에 <b>&apos;무엇을 먼저 구해야 하나&apos;를 적게</b> 합니다. 중간에 멈추는 학생은
              대개 첫 단계가 아니라 두 번째 단계를 떠올리지 못합니다. 풀이를 단계로 나누어 번호를 붙이게 하면 도움이 됩니다.
            </p>
          </li>
          <li>
            <b>식 설정</b> <span className="tg-area">문제 해결</span>
            <p>
              문장으로 된 상황에서 미지수를 정하고 식을 세우는 능력입니다. 강당에 의자를 놓는 문제, 왕복 속력
              문제가 여기 속합니다.
            </p>
            <p className="tg-train">
              <b>훈련</b> 답까지 가지 말고 <b>식만 세우는 연습</b>을 따로 합니다. 문장제 다섯 개를 주고 &apos;x를
              무엇으로 둘지&apos;와 &apos;식 한 줄&apos;까지만 쓰게 하세요. 계산은 빼도 됩니다.
            </p>
          </li>
        </ul>
        <p className="hint">
          진단평가 네 시험지는 유형마다 3문항 이상이 되도록 배분했습니다. 한 유형이 두 문항이면 하나를 실수로 틀렸을 때
          정답률이 50%로 찍혀 보완할 곳처럼 보입니다.
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
          차트에는 왼쪽의 짧은 이름으로 나옵니다. 오른쪽은 평가원이 쓰는 원래 이름입니다.
        </p>
      </section>
    </div>
  );
}
