import { describe, expect, it } from 'vitest';
import { autoSummary } from './summary';
import { TypeStat } from './assessment';

/** rate 만 보면 되는 함수라 나머지는 자리만 채운다. stats 는 약한 차례로 들어온다. */
const 유형 = (type: string, rate: number): TypeStat => ({
  type,
  rate,
  correct: Math.round(rate * 10),
  total: 10,
  earned: Math.round(rate * 10),
  points: 10,
});
const 줄세움 = (list: TypeStat[]) => [...list].sort((a, b) => a.rate - b.rate);

const 수학8 = (r: Record<string, number>) =>
  줄세움(Object.entries(r).map(([t, v]) => 유형(t, v)));

describe('종합 의견 초안', () => {
  it('강점이 둘이면 점수가 높은 둘을 이름과 내용으로 적는다', () => {
    const s = 수학8({
      '연산 처리': 0.95, '공식 활용': 0.9, '개념 이해': 0.7, '표현 해석': 0.7,
      '규칙 발견': 0.7, '근거 제시': 0.7, '단계별 해결': 0.7, '식 설정': 0.6,
    });
    const t = autoSummary('수학', s, 400);
    // 계산 영역(연산 처리·공식 활용) 둘이 다 강점이라 영역 내용으로 묶인다
    expect(t).toContain('식을 정확히 계산하고 알맞은 공식을 고르는 것을 잘합니다');
    // 유형 이름도 영역 이름도 대지 않는다. 레이더에 이미 다 있다
    expect(t).not.toContain('연산 처리');
    expect(t).not.toContain('계산 영역');
    expect(t).toContain('못 미치는 유형은 없습니다');
  });

  it('영역이 나뉘면 유형 둘의 내용으로 적는다', () => {
    const s = 수학8({
      '연산 처리': 0.95, '공식 활용': 0.7, '개념 이해': 0.9, '표현 해석': 0.7,
      '규칙 발견': 0.7, '근거 제시': 0.7, '단계별 해결': 0.7, '식 설정': 0.7,
    });
    const t = autoSummary('수학', s, 400);
    expect(t).toContain('식을 정확히 계산하는 것, 정의와 성질을 아는 것을 잘합니다');
    expect(t).not.toContain('연산 처리');
    expect(t).not.toContain('영역');
  });

  it('약점은 내용과 훈련까지 적는다', () => {
    const s = 수학8({
      '연산 처리': 0.9, '공식 활용': 0.9, '개념 이해': 0.7, '표현 해석': 0.7,
      '규칙 발견': 0.2, '근거 제시': 0.7, '단계별 해결': 0.3, '식 설정': 0.7,
    });
    const t = autoSummary('수학', s, 400);
    expect(t).toContain('나열하고 관찰해 규칙을 찾는 것, 두 단계 이상을 엮어 끝내는 것이 부족합니다');
    expect(t).not.toContain('규칙 발견');
    // 훈련 문장이 두 유형 몫 다 들어간다
    expect(t).toContain('작은 수부터 손으로 써서 표를 만들게');
    expect(t).toContain('무엇을 먼저 구해야 하나');
  });

  it('한 영역의 두 유형이 다 약하면 영역으로 묶고 영역 훈련을 적는다', () => {
    const s = 수학8({
      '연산 처리': 0.9, '공식 활용': 0.9, '개념 이해': 0.7, '표현 해석': 0.7,
      '규칙 발견': 0.2, '근거 제시': 0.3, '단계별 해결': 0.7, '식 설정': 0.7,
    });
    const t = autoSummary('수학', s, 400);
    expect(t).toContain('규칙을 찾고 근거를 대는 것이 부족합니다');
    expect(t).toContain('답이 맞아도 「왜」를 한 번 더 물어 주세요');
    // 묶은 유형은 따로 또 적지 않고, 이름도 대지 않는다
    expect(t).not.toContain('규칙 발견');
    expect(t).not.toContain('추론 영역');
  });

  it('과학은 영역으로 묶지 않고 유형으로만 적는다', () => {
    const s = 줄세움([
      유형('개념 이해', 0.95), 유형('적용', 0.9), 유형('문제 인식·가설', 0.2),
      유형('탐구 설계', 0.3), 유형('탐구 수행', 0.7), 유형('자료 변환·해석', 0.7),
      유형('결론·일반화', 0.7), 유형('의사소통', 0.7),
    ]);
    const t = autoSummary('과학', s, 400);
    expect(t).toContain('과학 개념과 용어의 뜻을 아는 것, 배운 개념을 새로운 장면에 쓰는 것을 잘합니다');
    expect(t).toContain('알아볼 것을 정하고 가설을 세우는 것');
    expect(t).not.toContain('탐구 설계');
    expect(t).not.toContain('영역');
    // 과학 풀이를 쓴다. 수학의 `개념 이해` 풀이가 섞이면 안 된다
    expect(t).toContain('과학 개념과 용어의 뜻을 아는 것');
    expect(t).not.toContain('정의와 성질을 아는 것');
  });

  it('강점이 하나뿐이면 그 하나만 적는다', () => {
    const s = 수학8({
      '연산 처리': 0.95, '공식 활용': 0.7, '개념 이해': 0.7, '표현 해석': 0.7,
      '규칙 발견': 0.7, '근거 제시': 0.7, '단계별 해결': 0.7, '식 설정': 0.7,
    });
    const t = autoSummary('수학', s, 400);
    expect(t).toContain('식을 정확히 계산하는 것을 잘합니다');
    expect(t).not.toContain('연산 처리');
  });

  it('강점이 없으면 강점 줄을 적지 않는다', () => {
    const s = 수학8({
      '연산 처리': 0.7, '공식 활용': 0.7, '개념 이해': 0.7, '표현 해석': 0.7,
      '규칙 발견': 0.7, '근거 제시': 0.7, '단계별 해결': 0.7, '식 설정': 0.4,
    });
    const t = autoSummary('수학', s, 400);
    expect(t).not.toContain('잘합니다');
    expect(t).toContain('문장에서 미지수를 정하고 식을 세우는 것이 부족합니다');
  });

  it('한도를 넘으면 문장 단위로 버린다', () => {
    const s = 수학8({
      '연산 처리': 0.95, '공식 활용': 0.9, '개념 이해': 0.7, '표현 해석': 0.7,
      '규칙 발견': 0.2, '근거 제시': 0.3, '단계별 해결': 0.7, '식 설정': 0.7,
    });
    const t = autoSummary('수학', s, 60);
    expect(t.length).toBeLessThanOrEqual(60);
    // 말이 끊긴 채로 끝나지 않는다
    expect(t.endsWith('.')).toBe(true);
  });

  it('영역이 셋까지 걸려도 이름은 둘만 댄다', () => {
    // 계산·이해·문제 해결 여섯 유형이 다 강점이다
    const s = 수학8({
      '연산 처리': 0.95, '공식 활용': 0.94, '개념 이해': 0.9, '표현 해석': 0.88,
      '규칙 발견': 0.2, '근거 제시': 0.3, '단계별 해결': 0.85, '식 설정': 0.82,
    });
    const t = autoSummary('수학', s, 400);
    // 점수가 높은 두 영역만, 높은 차례로
    expect(t).toContain(
      '식을 정확히 계산하고 알맞은 공식을 고르는 것, 정의를 알고 그래프와 표를 읽는 것을 잘합니다'
    );
    // 세 번째 영역(문제 해결)의 내용은 들어가지 않는다
    expect(t).not.toContain('여러 단계를 엮고 문장을 식으로 옮기는 것');
  });

  it('유형이 없으면 빈 글', () => {
    expect(autoSummary('수학', [], 400)).toBe('');
  });
});
