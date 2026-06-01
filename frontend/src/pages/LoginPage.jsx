import { useState } from 'react';
import './LoginPage.css';

const LOGO = <span style={{ fontSize: 14 }}>🙋</span>;

const FEATURES = [
  'Deepgram 기반 실시간 음성 인식 및 WPM 분석',
  'AI 청중 시뮬레이션 — 교수·투자자·면접관',
  '돌발 질문 인터럽트로 실전 반응력 강화',
  '세션 종료 후 AI 피드백 리포트 자동 생성',
];

export default function LoginPage({ onLogin, onBack }) {
  const [mode,     setMode]     = useState('login');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  async function handleSubmit() {
    setError('');
    setLoading(true);
    try {
      const url  = mode === 'login'
        ? 'http://localhost:8000/auth/login'
        : 'http://localhost:8000/auth/signup';
      const body = mode === 'login'
        ? { email, password }
        : { email, password, nickname };
      const res  = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.detail || '오류가 발생했습니다.'); return; }
      if (mode === 'login') {
        localStorage.setItem('token', data.access_token);
        onLogin(data);
      } else {
        setMode('login'); setError(''); setNickname('');
      }
    } catch {
      setError('서버에 연결할 수 없습니다.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <nav className="nav">
        <div className="nav-logo" onClick={onBack} style={{ cursor: 'pointer' }}>
          <div className="logo-icon">{LOGO}</div>
          <span className="logo-text">SpeechLab</span>
        </div>
        <div className="nav-right">
          {onBack && <button className="btn-line" onClick={onBack}>← 홈으로</button>}
        </div>
      </nav>

      <div className="login-split">
        {/* 왼쪽 — 홍보 패널 */}
        <div className="login-left">
          <div className="ll-top">
            <div className="ll-headline">
              발표 불안,<br />
              <span className="accent">데이터로</span><br />
              극복한다
            </div>
            <p className="ll-desc">
              AI 청중이 실시간으로 반응하고 질문을 던진다.
              압박 속에서 연습하고, 데이터로 성장을 확인한다.
            </p>
            <div className="ll-features">
              {FEATURES.map((f, i) => (
                <div className="ll-feat" key={i}>
                  <span className="ll-feat-dot" />
                  <span className="ll-feat-text">{f}</span>
                </div>
              ))}
            </div>
          </div>

            <div className="ll-bottom">
            <div className="ll-stat">
              <div className="ll-stat-val">99%</div>
              <div className="ll-stat-label">실전 유사도</div>
            </div>
            <div className="ll-stat">
              <div className="ll-stat-val">3x</div>
              <div className="ll-stat-label">빠른 성장</div>
            </div>
            <div className="ll-stat">
              <div className="ll-stat-val">24/7</div>
              <div className="ll-stat-label">언제든 연습</div>
            </div>
          </div>
        </div>

        {/* 오른쪽 — 로그인 폼 */}
        <div className="login-right">
          <div className="login-card">
            <div className="login-card-title">
              {mode === 'login' ? '로그인' : '회원가입'}
            </div>
            <div className="login-card-sub">
              {mode === 'login'
                ? '발표 훈련을 이어가려면 로그인하세요'
                : '지금 시작하면 첫 세션 무료'}
            </div>

            <div className="login-tabs">
              <button
                className={`login-tab${mode === 'login' ? ' login-tab--active' : ''}`}
                onClick={() => { setMode('login'); setError(''); }}>
                로그인
              </button>
              <button
                className={`login-tab${mode === 'signup' ? ' login-tab--active' : ''}`}
                onClick={() => { setMode('signup'); setError(''); }}>
                회원가입
              </button>
            </div>

            {error && <div className="login-error" style={{ marginBottom: 16 }}>{error}</div>}

            <div className="login-form">
              {mode === 'signup' && (
                <div className="login-field">
                  <label className="login-label">닉네임</label>
                  <input className="login-input" type="text" placeholder="닉네임 입력"
                    value={nickname} onChange={e => setNickname(e.target.value)} />
                </div>
              )}
              <div className="login-field">
                <label className="login-label">이메일</label>
                <input className="login-input" type="email" placeholder="이메일 주소"
                  value={email} onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
              </div>
              <div className="login-field">
                <label className="login-label">비밀번호</label>
                <input className="login-input" type="password"
                  placeholder={mode === 'signup' ? '8자 이상, 영문+숫자+특수문자' : '비밀번호'}
                  value={password} onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
                {mode === 'signup' && (
                  <span className="login-hint">8자 이상, 영문+숫자+특수문자(!@#$ 등) 포함</span>
                )}
              </div>
              <button className="login-btn" onClick={handleSubmit} disabled={loading}>
                {loading ? '처리 중...' : mode === 'login' ? '로그인' : '회원가입'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
