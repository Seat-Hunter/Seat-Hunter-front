import { useState, useEffect } from 'react';
import './HomePage.css';

const API = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';

const LOGO = (
  <svg viewBox="0 0 16 16" fill="none">
    <rect x="3" y="7" width="10" height="7" rx="2" fill="white" opacity="0.9"/>
    <path d="M6 7V5a2 2 0 0 1 4 0v2" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
    <circle cx="8" cy="10.5" r="1" fill="#2563eb"/>
  </svg>
);

const ENVS = [
  {
    type: 'interview',
    img: '/images/env_interview.jpg',
    emoji: '🏛️',
    name: '심사위원실 · 면접',
    desc: '교수·투자자·면접관이 정면에서 날카롭게 평가. 즉각적인 질문과 높은 압박이 특징.',
    tags: ['고강도', '2–6명', '즉각 질문'], hi: '고강도',
    preset: { type: 'interview', audience: 'boss', difficulty: 'hard', interrupt: true },
  },
  {
    type: 'academic',
    img: '/images/env_audiovisual.jpg',
    emoji: '🎭',
    name: '강당 · 학술발표',
    desc: '다수 청중 앞 대규모 발표. 흐름 관리와 시간 조절 능력을 키운다.',
    tags: ['중강도', '10–30명', 'Q&A 세션'],
    preset: { type: 'academic', audience: 'professor', difficulty: 'medium', interrupt: true },
  },
  {
    type: 'school',
    img: '/images/env_classroom.jpg',
    emoji: '🏫',
    name: '강의실 · 학교발표',
    desc: '수업·세미나 환경. 다양한 반응과 돌발 질문에 자연스럽게 대응하는 훈련.',
    tags: ['중강도', '10–20명', '자유 질의'],
    preset: { type: 'school', audience: 'professor', difficulty: 'medium', interrupt: true },
  },
  {
    type: 'meeting',
    img: '/images/env_meeting.jpg',
    emoji: '💼',
    name: '회의실 · 비즈니스',
    desc: '소규모 실무 미팅 환경. 팀원·상사·클라이언트 반응까지 시뮬레이션.',
    tags: ['저~중강도', '3–8명', '실무 시뮬'],
    preset: { type: 'meeting', audience: 'boss', difficulty: 'easy', interrupt: false },
  },
];

const FEATS = [
  { title: '실시간 STT 분석', desc: 'Deepgram 기반 음성 인식. 말 속도·필러·침묵 구간을 발표 중 즉시 추적.', icon: '🎙️' },
  { title: 'AI 청중 시뮬레이션', desc: '교수·투자자·면접관 페르소나. 인원 수와 반응 강도를 직접 조절.', icon: '👥' },
  { title: '돌발 질문 인터럽트', desc: '발표 내용 기반으로 실시간 생성되는 AI 질문으로 반응력 강화.', icon: '⚡' },
  { title: '스크립트 기반 훈련', desc: '원고 업로드 시 예상 질문 자동 생성 및 커버리지 분석.', icon: '📄' },
  { title: '세션 분석 리포트', desc: '유창성·구조·질문 대응력 상세 분석. 강점과 약점을 데이터로 확인.', icon: '📊' },
  { title: '성장 추적 히스토리', desc: '회차별 지표 변화 시각화. 어느 세션에서 성장했는지 한눈에 파악.', icon: '📈' },
];

export default function HomePage({ token, onLogin, onLogout, onSetup, onHistory }) {
  const [tab, setTab] = useState('env');
  const [userCount, setUserCount] = useState(null);

  useEffect(() => {
    fetch(`${API}/auth/user-count`)
      .then(r => r.json())
      .then(d => setUserCount(d.count))
      .catch(() => {});
  }, []);

  function handleEnvClick(env) {
    onSetup(env.preset);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: 'var(--bg)' }}>
      {/* NAV */}
      <nav className="nav" style={{ flexWrap: 'nowrap', gap: 8 }}>
        <div className="nav-logo" style={{ flexShrink: 0 }}>
          <div className="logo-icon">{LOGO}</div>
          <span className="logo-text">SpeechLab</span>
        </div>
        <div className="nav-right" style={{ marginLeft: 'auto', flexShrink: 0, flexWrap: 'nowrap', gap: 6 }}>
          {token ? (
            <>
              <button className="btn-line" onClick={onHistory}>히스토리</button>
              <button className="btn-blue" onClick={() => onSetup()}>발표 시작</button>
              <button className="btn-line" onClick={onLogout}>로그아웃</button>
            </>
          ) : (
            <>
              <button className="btn-line" onClick={onLogin}>로그인</button>
              <button className="btn-blue" onClick={() => onSetup()}>시작하기</button>
            </>
          )}
        </div>
      </nav>

      {/* 히어로 */}
      <div className="home-hero">
        <div>
          <div className="hero-eyebrow">
            <span className="ey-dot" />
            AI 기반 발표 트레이닝 — 자신 있는 발표로
          </div>
          <h1 className="hero-h1">
            발표 불안,<br /><span className="blue">자신으로</span><br />이긴다
          </h1>
          <p className="hero-desc">
            AI 청중이 실시간으로 반응하고 질문을 던진다.<br />실전 긴장은 압박 속에서 연습하고, 데이터로 성장을 확인한다.
          </p>
          <div className="hero-btns">
            <button className="hb-main" onClick={() => onSetup()}>시작하기</button>
            <button className="hb-sub" onClick={onHistory}>히스토리 보기</button>
          </div>
          <div className="hero-proof">
            <div className="proof-avatars">
              {['😊','😄','🙂','😁'].map((e,i) => <div key={i} className="pa">{e}</div>)}
            </div>
            <span className="proof-text"><strong>{userCount !== null ? `${userCount.toLocaleString()}명` : '...'}</strong> 이상 연습 중</span>
          </div>
        </div>

        {/* 프리뷰 카드 */}
        <div className="session-card">
          <div className="sc-header">
            <div className="sc-live"><span className="sc-live-dot"/>세션 진행 중</div>
            <span className="sc-timer">04:22 / 10:00</span>
          </div>
          <div className="sc-body">
            <div className="sc-metrics">
              <div className="sc-m"><div className="sc-m-label">종합 점수</div><div className="sc-m-val blue">91</div></div>
              <div className="sc-m"><div className="sc-m-label">WPM</div><div className="sc-m-val green">138</div></div>
              <div className="sc-m"><div className="sc-m-label">필러 단어</div><div className="sc-m-val amber">1</div></div>
              <div className="sc-m"><div className="sc-m-label">인터럽트</div><div className="sc-m-val" style={{color:'var(--ink2)'}}>2</div></div>
            </div>
            <div className="sc-alert blue-bg">
              <span className="sa-icon">🎙️</span>
              <div className="sa-text">음성 인식 중...</div>
            </div>
            <div className="sc-alert amber-bg">
              <span className="sa-icon">⚠️</span>
              <div className="sa-text"><strong>AI 실시간 피드백</strong>말하기 속도가 다소 빠릅니다. 도입부 속도를 조절해보세요.</div>
            </div>
          </div>
        </div>
      </div>

      <hr style={{ border: 'none', borderTop: '1px solid var(--border)', maxWidth: 1100, margin: '0 auto', width: '100%' }} />

      {/* 탭 섹션 */}
      <div className="home-tabs-section" id="home-tabs">
        <div className="home-tabs-inner">
          <div className="tabs-row">
            <button className={`tab-btn${tab === 'env' ? ' on' : ''}`} onClick={() => setTab('env')}>발표 환경</button>
            <button className={`tab-btn${tab === 'feat' ? ' on' : ''}`} onClick={() => setTab('feat')}>핵심 기능</button>
          </div>

          {tab === 'env' && (
            <div className="env-grid">
              {ENVS.map(env => (
                <div className="env-card" key={env.name} onClick={() => handleEnvClick(env)}>
                  <div className="env-img">
                    {env.img ? (
                      <img
                        src={env.img}
                        alt={env.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                      />
                    ) : null}
                    <span className="env-emoji" style={{ display: env.img ? 'none' : 'flex' }}>{env.emoji}</span>
                  </div>
                  <div className="env-info">
                    <div className="env-name">{env.name}</div>
                    <div className="env-desc">{env.desc}</div>
                    <div className="env-tags">
                      {env.tags.map(t => (
                        <span key={t} className={`env-tag${t === env.hi ? ' blue' : ''}`}>{t}</span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === 'feat' && (
            <>
              <div className="feat-grid">
                {FEATS.map(f => (
                  <div className="feat-item" key={f.title}>
                    <div className="fi-icon" style={{ fontSize: 16 }}>{f.icon}</div>
                    <div className="fi-title">{f.title}</div>
                    <div className="fi-desc">{f.desc}</div>
                  </div>
                ))}
              </div>
              <div className="home-cta-bar">
                <div className="hcb-text">
                  <h3>나의 발표 성장 기록 보기</h3>
                  <p>모든 세션의 지표와 흐름을 한눈에 확인하세요.</p>
                </div>
                <button className="btn-blue" onClick={onHistory} style={{ padding: '10px 20px', fontSize: 13 }}>
                  히스토리 보러 가기 →
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}