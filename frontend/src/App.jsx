import { useState, useEffect, useCallback } from 'react';
import LoginPage         from './pages/LoginPage';
import HomePage          from './pages/HomePage';
import SetupPage         from './pages/SetupPage';
import SimPage           from './pages/SimPage';
import ReportPage        from './pages/ReportPage';
import HistoryPage       from './pages/HistoryPage';
import SessionDetailPage from './pages/SessionDetailPage';
import { createSession } from './services/claudeApi';

const INITIAL_SIM = {
  type: 'interview', audience: 'boss', audienceCount: 4,
  difficulty: 'medium', duration: 3, interrupt: true, script: '',
  elapsed: 0, transcript: '', wordCount: 0, fillerCount: 0,
  wpmHistory: [], interruptLog: [], answerLog: [], sessionId: null,
};

// sim 중 뒤로가기는 막음 (발표 중 실수 방지)
const NO_BACK_PAGES = ['sim'];

export default function App() {
  const [token,     setToken]     = useState(() => localStorage.getItem('token'));
  const [page, setPage] = useState('home');
  const [simState,  setSimState]  = useState(INITIAL_SIM);
  const [loading,   setLoading]   = useState(false);
  const [startError, setStartError] = useState(null);
  const [detailId,  setDetailId]  = useState(null);
  const [simPreset, setSimPreset] = useState(null);

  // 페이지 이동 — 브라우저 히스토리에 등록
  const go = useCallback((p, opts = {}) => {
    setStartError(null);
    setPage(p);
    if (!opts.replace) {
      window.history.pushState({ page: p }, '', `#${p}`);
    } else {
      window.history.replaceState({ page: p }, '', `#${p}`);
    }
  }, []);

  // 초기 진입 시 히스토리 상태 설정
  useEffect(() => {
    window.history.replaceState({ page: 'home' }, '', '#home');
  }, []);

  // 브라우저 뒤로/앞으로 가기 처리
  useEffect(() => {
    function handlePopState(e) {
      const p = e.state?.page;
      if (!p) return;
      // 발표 중엔 뒤로가기 무시
      setPage(prev => {
        if (NO_BACK_PAGES.includes(prev)) {
          window.history.pushState({ page: prev }, '', `#${prev}`);
          return prev;
        }
        return p;
      });
    }
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  function handleLogin(data) {
    setToken(data.access_token);
    go('home');
  }

  function handleLogout() {
    localStorage.removeItem('token');
    setToken(null);
    setSimState(INITIAL_SIM);
    go('login', { replace: true });
  }

  async function handleStart(config) {
    setLoading(true);
    setStartError(null);
    try {
      const session = await createSession(config);
      setSimState({ ...INITIAL_SIM, ...config, sessionId: session.session_id });
      go('sim');
    } catch (e) {
      console.error('[API] 세션 생성 실패:', e.message);
      setStartError('서버에 연결할 수 없습니다. 백엔드가 실행 중인지 확인해주세요.');
    } finally {
      setLoading(false);
    }
  }

  function handleStop(runtimeData) {
    setSimState(prev => ({ ...prev, ...runtimeData }));
    go('report', { replace: true }); // sim → report는 뒤로가기로 sim 복귀 방지
  }

  function handleRestart() {
    setSimState(INITIAL_SIM);
    go('setup');
  }

  const [loginConfirm, setLoginConfirm] = useState(false);

  function handleSetup(preset = null) {
    if (!token) { setLoginConfirm(true); return; }
    setSimPreset(preset);
    go('setup');
  }

  function handleDetail(sessionId) {
    setDetailId(sessionId);
    go('detail');
  }

  return (
    <>
      {loading && (
        <div style={{
          position:'fixed',inset:0,background:'rgba(255,255,255,0.88)',
          display:'flex',flexDirection:'column',alignItems:'center',
          justifyContent:'center',gap:12,zIndex:999,
        }}>
          <div style={{
            width:32,height:32,border:'2px solid #e5e7eb',
            borderTopColor:'#2563eb',borderRadius:'50%',
            animation:'spin 0.8s linear infinite',
          }}/>
          <span style={{fontSize:13,color:'#6b7280'}}>세션 생성 중...</span>
        </div>
      )}

      {startError && (
        <div style={{
          position:'fixed',bottom:24,left:'50%',transform:'translateX(-50%)',
          background:'#fef2f2',border:'1px solid rgba(220,38,38,0.2)',
          color:'#dc2626',padding:'10px 18px',borderRadius:7,
          fontSize:13,zIndex:999,whiteSpace:'nowrap',
        }}>
          {startError}
        </div>
      )}

      {page === 'home'    && (
        <HomePage
          token={token}
          onLogin={() => go('login')}
          onLogout={handleLogout}
          onSetup={handleSetup}
          onHistory={() => go('history')}
        />
      )}
      {page === 'login'   && <LoginPage onLogin={handleLogin} onBack={() => go('home')} />}
      {page === 'setup'   && (
        <SetupPage
          preset={simPreset}
          onStart={handleStart}
          onLogout={handleLogout}
          onHome={() => go('home')}
          onHistory={() => go('history')}
        />
      )}
      {page === 'sim'     && <SimPage simState={simState} onStop={handleStop} onCancel={() => go('setup', { replace: true })} />}
      {page === 'report'  && (
        <ReportPage
          simState={simState}
          onRestart={handleRestart}
          onHome={() => go('home')}
          onHistory={() => go('history')}
        />
      )}
      {page === 'history' && (
        <HistoryPage
          onHome={() => go('home')}
          onSetup={() => token ? go('setup') : setLoginConfirm(true)}
          onLogout={handleLogout}
          onDetail={handleDetail}
          token={token}
          onLogin={() => go('login')}
        />
      )}
      {page === 'detail'  && (
        <SessionDetailPage
          sessionId={detailId}
          onBack={() => go('history')}
          onHome={() => go('home')}
          onSetup={() => token ? go('setup') : go('login')}
        />
      )}
      {loginConfirm && (
        <div style={{
          position:'fixed', inset:0, background:'rgba(0,0,0,0.4)',
          display:'flex', alignItems:'center', justifyContent:'center', zIndex:999,
        }}>
          <div style={{
            background:'white', borderRadius:12, padding:'28px 32px',
            width:320, boxShadow:'0 8px 32px rgba(0,0,0,0.15)',
          }}>
            <div style={{ fontSize:16, fontWeight:700, marginBottom:8 }}>로그인이 필요합니다</div>
            <div style={{ fontSize:13, color:'var(--ink2)', marginBottom:24, lineHeight:1.6 }}>
              발표 연습을 시작하려면 로그인하세요.
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={() => setLoginConfirm(false)} style={{
                flex:1, padding:'10px', borderRadius:7, fontSize:13,
                border:'1px solid var(--border2)', background:'white',
                cursor:'pointer', fontFamily:'var(--sans)', fontWeight:500,
              }}>취소</button>
              <button onClick={() => { setLoginConfirm(false); go('login'); }} style={{
                flex:1, padding:'10px', borderRadius:7, fontSize:13,
                border:'none', background:'var(--blue)', color:'white',
                cursor:'pointer', fontFamily:'var(--sans)', fontWeight:700,
              }}>로그인하기</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
