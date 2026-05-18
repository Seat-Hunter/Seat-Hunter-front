import { useState } from 'react';
import './LoginPage.css';

const LOGO = (
  <svg viewBox="0 0 16 16" fill="none">
    <rect x="3" y="7" width="10" height="7" rx="2" fill="white" opacity="0.9"/>
    <path d="M6 7V5a2 2 0 0 1 4 0v2" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
    <circle cx="8" cy="10.5" r="1" fill="#2563eb"/>
  </svg>
);

export default function LoginPage({ onLogin, onBack }) {
  const [mode, setMode]         = useState('login');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

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

      <div className="login-wrap">
        <div className="login-card">
          <div className="login-logo">
            <div className="login-logo-icon">{LOGO}</div>
            <span className="login-logo-text">SpeechLab</span>
          </div>
          <div className="login-title">{mode === 'login' ? '로그인' : '회원가입'}</div>
          <div className="login-sub">
            {mode === 'login' ? '발표 훈련을 이어가려면 로그인하세요' : '지금 시작하면 첫 세션 무료'}
          </div>

          <div className="login-tabs">
            <button className={`login-tab${mode === 'login' ? ' login-tab--active' : ''}`}
              onClick={() => { setMode('login'); setError(''); }}>로그인</button>
            <button className={`login-tab${mode === 'signup' ? ' login-tab--active' : ''}`}
              onClick={() => { setMode('signup'); setError(''); }}>회원가입</button>
          </div>

          {error && <div className="login-error" style={{ marginBottom: 12 }}>{error}</div>}

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
              {mode === 'signup' && <span className="login-hint">8자 이상, 영문+숫자+특수문자(!@#$ 등) 포함</span>}
            </div>
            <button className="login-btn" onClick={handleSubmit} disabled={loading}>
              {loading ? '처리 중...' : mode === 'login' ? '로그인' : '회원가입'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
