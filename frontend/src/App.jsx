import { useState } from 'react';
import SetupPage  from './pages/SetupPage';
import SimPage    from './pages/SimPage';
import ReportPage from './pages/ReportPage';

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
};

export default function App() {
  const [page, setPage]         = useState('setup');
  const [simState, setSimState] = useState(INITIAL_SIM_STATE);

  function handleStart(config) {
    setSimState({ ...INITIAL_SIM_STATE, ...config });
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

  return (
    <>
      {page === 'setup'  && <SetupPage  onStart={handleStart} />}
      {page === 'sim'    && <SimPage    simState={simState} onStop={handleStop} />}
      {page === 'report' && <ReportPage simState={simState} onRestart={handleRestart} />}
    </>
  );
}
