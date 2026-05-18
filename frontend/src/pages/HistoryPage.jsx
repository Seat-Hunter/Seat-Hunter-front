import { useEffect, useState } from 'react';
import './HistoryPage.css';

const LOGO = (
  <svg viewBox="0 0 16 16" fill="none">
    <rect x="3" y="7" width="10" height="7" rx="2" fill="white" opacity="0.9"/>
    <path d="M6 7V5a2 2 0 0 1 4 0v2" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
    <circle cx="8" cy="10.5" r="1" fill="#2563eb"/>
  </svg>
);

const API = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';
const TYPE_LABEL = { interview: '면접', academic: '학술발표', school: '학교발표', meeting: '회의' };
const DIFF_LABEL = { low: '약함', medium: '보통', high: '강함', brutal: '극한' };
const AUD_LABEL  = { professor: '교수', investor: '투자자', boss: '상사', general: '일반 청중' };

function scoreClass(s) {
  if (s >= 75) return 'hs-g';
  if (s >= 55) return 'hs-b';
  return 'hs-a';
}

export default function HistoryPage({ onHome, onSetup, onLogout, onDetail }) {
  const [sessions, setSessions] = useState([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    fetch(`${API}/api/v1/users/1/sessions`)
      .then(r => r.json())
      .then(data => setSessions(Array.isArray(data) ? data : []))
      .catch(() => setSessions([]))
      .finally(() => setLoading(false));
  }, []);

  const total      = sessions.length;
  const avgScore   = total > 0 ? Math.round(sessions.reduce((a, s) => a + (s.overall_score ?? 0), 0) / total) : 0;
  const bestScore  = total > 0 ? Math.round(Math.max(...sessions.map(s => s.overall_score ?? 0))) : 0;
  const firstScore = total > 0 ? Math.round(sessions[sessions.length - 1]?.overall_score ?? 0) : 0;
  const growth     = bestScore - firstScore;

  return (
    <div className="history-page">
      <nav className="nav">
        <div className="nav-logo" onClick={onHome} style={{ cursor: 'pointer' }}>
          <div className="logo-icon">{LOGO}</div>
          <span className="logo-text">SpeechLab</span>
        </div>
        <div className="nav-links">
          <button className="nav-a" onClick={onHome}>홈</button>
          <button className="nav-a on">히스토리</button>
        </div>
        <div className="nav-right">
          <button className="btn-blue" onClick={onSetup}>새 세션</button>
          {onLogout && <button className="btn-line" onClick={onLogout}>로그아웃</button>}
        </div>
      </nav>

      <div className="history-wrap">
        <div className="history-header">
          <div>
            <h1 className="history-h">발표 히스토리</h1>
            <div className="history-sub">총 {total}회 세션 · 항목을 클릭하면 상세 리포트를 볼 수 있습니다</div>
          </div>
        </div>

        {total > 0 && (
          <div className="stats-row">
            <div className="stat-c"><div className="sc-v">{total}</div><div className="sc-l">총 세션</div></div>
            <div className="stat-c"><div className="sc-v blue">{avgScore}</div><div className="sc-l">평균 점수</div></div>
            <div className="stat-c"><div className="sc-v green">{growth >= 0 ? '+' : ''}{growth}</div><div className="sc-l">첫 세션 대비 성장</div></div>
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--ink3)', fontSize: 13 }}>불러오는 중...</div>
        ) : total === 0 ? (
          <div className="history-empty">
            <div className="he-icon">🎤</div>
            <div className="he-title">아직 세션 기록이 없습니다</div>
            <div className="he-desc">첫 발표 연습을 시작해보세요!</div>
            <button className="btn-blue" onClick={onSetup}>첫 세션 시작하기</button>
          </div>
        ) : (
          <div className="history-list">
            {sessions.map((s, i) => {
              const score  = Math.round(s.overall_score ?? 0);
              const type   = TYPE_LABEL[s.presentation_type] ?? s.presentation_type ?? '—';
              const aud    = AUD_LABEL[s.audience_type]      ?? s.audience_type      ?? '—';
              const diff   = DIFF_LABEL[s.pressure_level]    ?? s.pressure_level     ?? '—';
              const date   = s.created_at ? new Date(s.created_at).toLocaleDateString('ko-KR') : '—';
              const dur    = s.duration_seconds ? `${Math.round(s.duration_seconds / 60)}분` : '—';
              const isBest = score === bestScore && total > 1;
              return (
                <div className="hi" key={s.session_id ?? s.id} onClick={() => onDetail?.(s.session_id ?? s.id)}>
                  <div className="hi-num">#{total - i}</div>
                  <div className="hi-info">
                    <div className="hi-title">{type} · {aud} · {diff}</div>
                    <div className="hi-meta">{date} · {dur} · {s.interrupt_enabled ? '돌발 질문' : '질문 없음'}</div>
                  </div>
                  <div className={`hi-score ${scoreClass(score)}`}>{score}</div>
                  <div className={`hi-badge${isBest ? ' best' : ''}`}>{isBest ? '🏆 최고' : '→'}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}