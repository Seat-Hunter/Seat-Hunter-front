import { useState } from 'react';
import SetupPage from './pages/SetupPage';
import SimPage   from './pages/SimPage';
// import ReportPage from './pages/ReportPage';  ← 다음 단계에서 해제

const INITIAL_SIM_STATE = {
  type:          'academic',
  audience:      'professor',
  audienceCount: 15,
  difficulty:    'medium',
  duration:      3,
  interrupt:     true,
  script:        '',
  // runtime (SimPage → ReportPage 공유)
  elapsed:       0,
  transcript:    '',
  wordCount:     0,
  fillerCount:   0,
  wpmHistory:    [],
  interruptLog:  [],
};

export default function App() {
  const [page, setPage]         = useState('setup');
  const [simState, setSimState] = useState(INITIAL_SIM_STATE);

  // Setup → Sim
  function handleStart(config) {
    setSimState({ ...INITIAL_SIM_STATE, ...config });
    setPage('sim');
  }

  // Sim → Report
  function handleStop(runtimeData) {
    setSimState(prev => ({ ...prev, ...runtimeData }));
    setPage('report');
  }

  // Report → Setup
  function handleRestart() {
    setSimState(INITIAL_SIM_STATE);
    setPage('setup');
  }

  return (
    <>
      {page === 'setup' && (
        <SetupPage onStart={handleStart} />
      )}

      {page === 'sim' && (
        <SimPage simState={simState} onStop={handleStop} />
      )}

      {/* 다음 단계에서 주석 해제 */}
      {/* {page === 'report' && (
        <ReportPage simState={simState} onRestart={handleRestart} />
      )} */}
    </>
  );
}
