import { useState } from 'react';
import SetupPage  from './pages/SetupPage';
import SimPage    from './pages/SimPage';
import ReportPage from './pages/ReportPage';
import { createSession, startSession, endSession, connectWS, disconnectWS } from './services/claudeApi';

const INITIAL_SIM_STATE = {
  // 설정값
  type:          'academic',
  audience:      'professor',
  audienceCount: 15,
  difficulty:    'medium',
  duration:      3,
  interrupt:     true,
  script:        '',
  // 런타임
  elapsed:       0,
  transcript:    '',
  wordCount:     0,
  fillerCount:   0,
  wpmHistory:    [],
  interruptLog:  [],
  // 백엔드 연동
  sessionId:     null,
  backendMetrics: null,
};

export default function App() {
  const [page, setPage]         = useState('setup');
  const [simState, setSimState] = useState(INITIAL_SIM_STATE);

  async function handleStart(config) {
    let sessionId = null;

    try {
      const session = await createSession(config);
      sessionId = session.session_id;
      await startSession(sessionId);

      connectWS(sessionId, {
        onMetrics:         (msg) => setSimState(prev => ({ ...prev, backendMetrics: msg })),
        onAudienceReaction:(msg) => setSimState(prev => ({ ...prev, audienceReaction: msg.reaction })),
        onSessionState:    (msg) => console.log('[WS] 세션 상태:', msg.state),
      });
    } catch (e) {
      console.warn('[API] 백엔드 연결 실패, 로컬 모드로 진행:', e.message);
    }

    setSimState({ ...INITIAL_SIM_STATE, ...config, sessionId });
    setPage('sim');
  }

  async function handleStop(runtimeData) {
    const sessionId = simState.sessionId;
    if (sessionId) {
      try {
        await endSession(sessionId);
      } catch (e) {
        console.warn('[API] 세션 종료 실패:', e.message);
      }
      disconnectWS();
    }
    setSimState(prev => ({ ...prev, ...runtimeData }));
    setPage('report');
  }

  function handleRestart() {
    setSimState(INITIAL_SIM_STATE);
    setPage('setup');
  }

  return (
    <>
      {page === 'setup'  && <SetupPage  onStart={handleStart} />}
      {page === 'sim'    && <SimPage    simState={simState} onStop={handleStop} />}
      {page === 'report' && <ReportPage simState={simState} onRestart={handleRestart} />}
    </>
  );
}
