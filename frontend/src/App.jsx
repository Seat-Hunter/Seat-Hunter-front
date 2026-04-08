import { useState } from 'react';
import SetupPage from './pages/SetupPage';
// 나중에 추가할 페이지들 (구현 시 주석 해제)
// import SimPage    from './pages/SimPage';
// import ReportPage from './pages/ReportPage';

// 전역 simState 초기값 — Sim → Report 간 공유
const INITIAL_SIM_STATE = {
  // 설정값 (Setup에서 넘어옴)
  type:          'academic',
  audience:      'professor',
  audienceCount: 15,
  difficulty:    'medium',
  duration:      3,
  interrupt:     true,
  script:        '',
  // 런타임 (Sim 중 갱신)
  startTime:     null,
  elapsed:       0,
  transcript:    '',
  wordCount:     0,
  fillerCount:   0,
  wpmHistory:    [],
  interruptLog:  [],
};

export default function App() {
  // 현재 화면: 'setup' | 'sim' | 'report'
  const [page, setPage] = useState('setup');

  // Sim ↔ Report 간 공유 상태
  const [simState, setSimState] = useState(INITIAL_SIM_STATE);

  // Setup → Sim 전환
  function handleStart(config) {
    setSimState({ ...INITIAL_SIM_STATE, ...config });
    setPage('sim');
  }

  // Sim → Report 전환
  function handleStop(runtimeData) {
    setSimState(prev => ({ ...prev, ...runtimeData }));
    setPage('report');
  }

  // Report → Setup 재시작
  function handleRestart() {
    setSimState(INITIAL_SIM_STATE);
    setPage('setup');
  }

  return (
    <>
      {page === 'setup' && (
        <SetupPage onStart={handleStart} />
      )}

      {/* 구현 후 주석 해제 */}
      {/* {page === 'sim' && (
        <SimPage simState={simState} onStop={handleStop} />
      )} */}

      {/* {page === 'report' && (
        <ReportPage simState={simState} onRestart={handleRestart} />
      )} */}
    </>
  );
}
