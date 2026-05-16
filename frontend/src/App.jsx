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
};

export default function App() {
  const [token, setToken]       = useState(() => localStorage.getItem('token'));
  const [page, setPage]         = useState('setup');
  const [simState, setSimState] = useState(INITIAL_SIM_STATE);
  const [loading, setLoading]   = useState(false);
  const [startError, setStartError] = useState(null);

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
    setStartError(null);
    try {
      const session = await createSession(config);
      setSimState({ ...INITIAL_SIM_STATE, ...config, sessionId: session.session_id });
      setPage('sim');
    } catch (e) {
      console.error('[API] 세션 생성 실패:', e.message);
      setStartError('서버에 연결할 수 없습니다. 백엔드가 실행 중인지 확인해주세요.');
    } finally {
      setLoading(false);
    }
  }

  function handleStop(runtimeData) {
    setSimState(prev => ({ ...prev, ...runtimeData }));
    setPage('report');
  }

  function handleRestart() {
    setSimState(INITIAL_SIM_STATE);
    setPage('setup');
  }

  if (!token) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <>
      {loading && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', gap: '12px', zIndex: 999,
        }}>
          <div style={{ width: 36, height: 36, border: '2px solid #333',
            borderTopColor: '#00c864', borderRadius: '50%',
            animation: 'spin 0.8s linear infinite' }} />
          <span style={{ color: '#fff', fontFamily: 'monospace',
            fontSize: 12, letterSpacing: '2px' }}>세션 생성 중...</span>
        </div>
      )}
      {startError && page === 'setup' && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          background: '#1a0000', border: '1px solid #ff4d4d', color: '#ff4d4d',
          padding: '12px 20px', borderRadius: 4, fontFamily: 'monospace',
          fontSize: 12, zIndex: 999,
        }}>
          {startError}
        </div>
      )}
      {page === 'setup'  && <SetupPage  onStart={handleStart} onLogout={handleLogout} />}
      {page === 'sim'    && <SimPage    simState={simState} onStop={handleStop} />}
      {page === 'report' && <ReportPage simState={simState} onRestart={handleRestart} />}
    </>
  );
}
