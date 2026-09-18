import { CloudStatus, signInWithGoogle, signOutCloud, useAuthUser } from '../lib/cloud';

const STATUS_TEXT: Record<CloudStatus, string> = {
  off: '',
  signedout: '',
  syncing: '동기화 중…',
  synced: '동기화됨 ✓',
  denied: '⚠ 접근 권한 없음',
  error: '⚠ 동기화 오류',
};

// 헤더에 들어가는 로그인/동기화 바. status는 동기화 문서 상태(선택).
export default function CloudBar({ status }: { status?: CloudStatus }) {
  const { user, enabled } = useAuthUser();
  if (!enabled) return null;

  if (!user) {
    return (
      <div className="cloud-bar">
        <button className="cloud-login" onClick={() => signInWithGoogle().catch(() => alert('로그인에 실패했습니다.'))}>
          ☁ 구글 로그인
        </button>
        <span className="hint">로그인하면 기기 간 자동 공유됩니다.</span>
      </div>
    );
  }

  const st = status && status !== 'signedout' && status !== 'off' ? status : 'synced';
  return (
    <div className="cloud-bar">
      <span className={`cloud-status ${st}`}>☁ {STATUS_TEXT[st]}</span>
      <span className="cloud-email" title={user.email ?? ''}>{user.email}</span>
      <button className="cloud-logout" onClick={() => signOutCloud()}>로그아웃</button>
    </div>
  );
}
