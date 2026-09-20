/**
 * 화면을 떠나기 전에 한 번 붙잡는 자리.
 *
 * 채점 화면은 저장을 눌러야 기록이 남는다. 30문항을 다 넣고 위 메뉴를 누르면
 * 그대로 사라지므로, 떠나기 전에 물어볼 기회를 만든다. 붙잡을 것이 있는
 * 화면이 guard 를 걸어 두고, 옮기는 쪽(App)이 canLeave() 로 묻는다.
 *
 * 한 번에 하나만 걸린다. 화면은 한 번에 하나만 보이므로 그것으로 충분하다.
 */
type Guard = () => Promise<boolean> | boolean;

let guard: Guard | null = null;

/** 붙잡을 것이 생기면 걸고, 없어지면 null 로 푼다. */
export function setLeaveGuard(g: Guard | null) {
  guard = g;
}

/** 떠나도 되는가. 건 것이 없으면 늘 그렇다. */
export async function canLeave(): Promise<boolean> {
  return guard ? await guard() : true;
}
