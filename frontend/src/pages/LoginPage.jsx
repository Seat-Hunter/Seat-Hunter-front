import { useState } from 'react';
import './LoginPage.css';

export default function LoginPage({ onLogin }) {
  const [mode, setMode]         = useState('login'); // 'login' | 'signup'
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
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.detail || '오류가 발생했습니다.');
        return;
      }

      if (mode === 'login') {
        // JWT 토큰 저장 후 다음 페이지로
        localStorage.setItem('token', data.access_token);
        onLogin(data);
      } else {
        // 회원가입 성공 → 로그인 모드로 전환
        setMode('login');
        setError('');
        setNickname('');
      }
    } catch (e) {
      setError('서버에 연결할 수 없습니다.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        {/* 로고 */}
        <div className="login-logo">
          PressurePoint
          <span className="login-logo__sub">// 스피치 압박 트레이너</span>
        </div>

        {/* 탭 */}
        <div className="login-tabs">
          <button
            className={`login-tab${mode === 'login' ? ' login-tab--active' : ''}`}
            onClick={() => { setMode('login'); setError(''); }}
          >
            로그인
          </button>
          <button
            className={`login-tab${mode === 'signup' ? ' login-tab--active' : ''}`}
            onClick={() => { setMode('signup'); setError(''); }}
          >
            회원가입
          </button>
        </div>

        {/* 입력 폼 */}
        <div className="login-form">
          {mode === 'signup' && (
            <div className="login-field">
              <label className="login-label">닉네임</label>
              <input
                className="login-input"
                type="text"
                placeholder="닉네임"
                value={nickname}
                onChange={e => setNickname(e.target.value)}
              />
            </div>
          )}
          <div className="login-field">
            <label className="login-label">이메일</label>
            <input
              className="login-input"
              type="email"
              placeholder="이메일"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            />
          </div>
          <div className="login-field">
            <label className="login-label">비밀번호</label>
            <input
              className="login-input"
              type="password"
              placeholder="비밀번호"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            />
            {mode === 'signup' && (
              <span style={{ fontSize: '11px', color: 'var(--muted)', fontFamily: 'var(--mono)' }}>
                8자 이상, 영문+숫자+특수문자(!@#$ 등) 포함
              </span>
            )}
          </div>

          {error && <div className="login-error">{error}</div>}

          <button
            className="login-btn"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? '처리 중...' : mode === 'login' ? '로그인' : '회원가입'}
          </button>
        </div>
      </div>
    </div>
  );
}
