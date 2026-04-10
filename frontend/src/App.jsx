import { useState } from 'react';
import SetupPage  from './pages/SetupPage';
import SimPage    from './pages/SimPage';
import ReportPage from './pages/ReportPage';
import { createSession } from './services/claudeApi';

const INITIAL_SIM_STATE = {
  type:          'academic',
  audience:      'professor',
  audienceCount: 15,
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
  const [page, setPage]         = useState('setup');
  const [simState, setSimState] = useState(INITIAL_SIM_STATE);
  const [loading, setLoading]   = useState(false);

  async function handleStart(config) {
    setLoading(true);
    try {
      const sessionId = await createSession(config);
      setSimState({ ...INITIAL_SIM_STATE, ...config, sessionId });
      setPage('sim');
    } catch (e) {
      console.error('세션 생성 실패:', e);
      alert('서버 연결 실패. 백엔드가 실행 중인지 확인해주세요.');
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
      {page === 'setup'  && <SetupPage  onStart={handleStart} />}
      {page === 'sim'    && <SimPage    simState={simState} onStop={handleStop} />}
      {page === 'report' && <ReportPage simState={simState} onRestart={handleRestart} />}
    </>
  );
}