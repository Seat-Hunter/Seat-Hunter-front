import { useState } from 'react';
import SetupPage  from './pages/SetupPage';
import SimPage    from './pages/SimPage';
import ReportPage from './pages/ReportPage';
import LoginPage  from './pages/LoginPage';
import { createSession } from './services/claudeApi';

const INITIAL_SIM_STATE = {
  type:          'interview',
  audience:      'boss',
  audienceCount: 4,
  difficulty:    'medium',
  duration:      3,
  interrupt:     true,
  script:        '',
  elapsed:       0,
  transcript:    '',
  wordCount:     0,
  fillerCount:   0,
  wpmHistory:    [],
  interruptLog:  [],
  sessionId:     null,
  demoMode:      false,
};

export default function App() {
  // 로그인 상태: localStorage에 토큰 있으면 이미 로그인된 것으로 간주
  const [token, setToken]       = useState(() => localStorage.getItem('token'));
  const [page, setPage]         = useState('setup');
  const [simState, setSimState] = useState(INITIAL_SIM_STATE);
  const [loading, setLoading]   = useState(false);

  function handleLogin(data) {
    setToken(data.access_token);
    setPage('setup');
  }

  function handleLogout() {
    localStorage.removeItem('token');
    setToken(null);
    setPage('setup');
    setSimState(INITIAL_SIM_STATE);
  }

  async function handleStart(config) {
    setLoading(true);
    let sessionId = null;
    try {
      const session = await createSession(config);
      sessionId = session.session_id;
    } catch (e) {
      console.warn('[API] 백엔드 연결 실패, 로컬 모드로 진행:', e.message);
    } finally {
      setLoading(false);
    }
    setSimState({ ...INITIAL_SIM_STATE, ...config, sessionId });
    setPage('sim');
  }

  function handleStop(runtimeData) {
    setSimState(prev => ({ ...prev, ...runtimeData }));
    setPage('report');
  }

  function handleRestart() {
    setSimState(INITIAL_SIM_STATE);
    setPage('setup');
  }

  // 로그인 안 된 경우 → LoginPage 표시
  if (!token) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <>
      {loading && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontFamily: 'monospace', letterSpacing: '2px', zIndex: 999
        }}>
          세션 생성 중...
        </div>
      )}
      {page === 'setup'  && <SetupPage  onStart={handleStart} onLogout={handleLogout} />}
      {page === 'sim'    && <SimPage    simState={simState} onStop={handleStop} />}
      {page === 'report' && <ReportPage simState={simState} onRestart={handleRestart} />}
    </>
  );
}
