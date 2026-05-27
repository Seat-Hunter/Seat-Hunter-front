import { useEffect, useState, useMemo } from 'react';
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

// 꺾은선 그래프 컴포넌트
function ScoreChart({ sessions }) {
  if (sessions.length < 2) return null;

  const W = 700, H = 160, PAD = { top: 16, right: 24, bottom: 32, left: 36 };
  const iW = W - PAD.left - PAD.right;
  const iH = H - PAD.top - PAD.bottom;

  // 최신순 → 오래된순 정렬 (그래프는 왼쪽=오래된것)
  const data = [...sessions].reverse().map((s, i) => ({
    x: i,
    y: Math.round(s.overall_score ?? 0),
    label: s.created_at ? new Date(s.created_at).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' }) : '',
  }));

  const maxY = 100, minY = 0;
  const xStep = iW / (data.length - 1);
  const toX = i => PAD.left + i * xStep;
  const toY = v => PAD.top + iH - ((v - minY) / (maxY - minY)) * iH;

  const linePath = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${toX(i)},${toY(d.y)}`).join(' ');
  const areaPath = `${linePath} L${toX(data.length - 1)},${PAD.top + iH} L${toX(0)},${PAD.top + iH} Z`;

  const yTicks = [0, 25, 50, 75, 100];

  return (
    <div className="chart-wrap">
      <div className="chart-title">점수 추이</div>
      <svg viewBox={`0 0 ${W} ${H}`} className="chart-svg" preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2563eb" stopOpacity="0.15"/>
            <stop offset="100%" stopColor="#2563eb" stopOpacity="0"/>
          </linearGradient>
        </defs>

        {/* y 그리드 */}
        {yTicks.map(v => (
          <g key={v}>
            <line x1={PAD.left} x2={PAD.left + iW} y1={toY(v)} y2={toY(v)}
              stroke="#e5e7eb" strokeWidth="1" strokeDasharray={v === 0 ? '0' : '3,3'}/>
            <text x={PAD.left - 6} y={toY(v) + 4} fontSize="10" fill="#9ca3af" textAnchor="end">{v}</text>
          </g>
        ))}

        {/* 영역 */}
        <path d={areaPath} fill="url(#areaGrad)"/>

        {/* 선 */}
        <path d={linePath} fill="none" stroke="#2563eb" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"/>

        {/* 점 + x 라벨 (최대 10개만) */}
        {data.map((d, i) => {
          const skip = data.length > 10 && i % Math.ceil(data.length / 10) !== 0 && i !== data.length - 1;
          return (
            <g key={i}>
              <circle cx={toX(i)} cy={toY(d.y)} r="3.5" fill="white" stroke="#2563eb" strokeWidth="2"/>
              {!skip && (
                <text x={toX(i)} y={H - 4} fontSize="9" fill="#9ca3af" textAnchor="middle">{d.label}</text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export default function HistoryPage({ onHome, onSetup, onLogout, onDetail }) {
  const [sessions, setSessions] = useState([]);
  const [loading,  setLoading]  = useState(true);

  // 필터 상태
  const [filterType, setFilterType] = useState('all');
  const [filterAud,  setFilterAud]  = useState('all');
  const [sortBy,     setSortBy]     = useState('date'); // date | score

  useEffect(() => {
    fetch(`${API}/api/v1/users/1/sessions`)
      .then(r => r.json())
      .then(data => setSessions(Array.isArray(data) ? data : []))
      .catch(() => setSessions([]))
      .finally(() => setLoading(false));
  }, []);

  // 필터 적용
  const filtered = useMemo(() => {
    let list = [...sessions];
    if (filterType !== 'all') list = list.filter(s => s.presentation_type === filterType);
    if (filterAud  !== 'all') list = list.filter(s => s.audience_type     === filterAud);
    if (sortBy === 'score') list.sort((a, b) => (b.overall_score ?? 0) - (a.overall_score ?? 0));
    return list;
  }, [sessions, filterType, filterAud, sortBy]);

  const total      = sessions.length;
  const avgScore   = total > 0 ? Math.round(sessions.reduce((a, s) => a + (s.overall_score ?? 0), 0) / total) : 0;
  const bestScore  = total > 0 ? Math.round(Math.max(...sessions.map(s => s.overall_score ?? 0))) : 0;
  const firstScore = total > 0 ? Math.round(sessions[sessions.length - 1]?.overall_score ?? 0) : 0;
  const growth     = bestScore - firstScore;

  const typeOptions = ['all', ...new Set(sessions.map(s => s.presentation_type).filter(Boolean))];
  const audOptions  = ['all', ...new Set(sessions.map(s => s.audience_type).filter(Boolean))];

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
            <div className="stat-c"><div className={`sc-v ${growth >= 0 ? 'green' : ''}`}>{growth >= 0 ? '+' : ''}{growth}</div><div className="sc-l">첫 세션 대비 성장</div></div>
          </div>
        )}

        {/* 꺾은선 그래프 */}
        {sessions.length >= 2 && <ScoreChart sessions={sessions} />}

        {/* 필터 바 */}
        {total > 0 && (
          <div className="filter-bar">
            <div className="filter-group">
              <span className="filter-label">유형</span>
              <div className="filter-chips">
                {typeOptions.map(v => (
                  <button key={v}
                    className={`filter-chip${filterType === v ? ' on' : ''}`}
                    onClick={() => setFilterType(v)}>
                    {v === 'all' ? '전체' : TYPE_LABEL[v] ?? v}
                  </button>
                ))}
              </div>
            </div>
            <div className="filter-group">
              <span className="filter-label">청중</span>
              <div className="filter-chips">
                {audOptions.map(v => (
                  <button key={v}
                    className={`filter-chip${filterAud === v ? ' on' : ''}`}
                    onClick={() => setFilterAud(v)}>
                    {v === 'all' ? '전체' : AUD_LABEL[v] ?? v}
                  </button>
                ))}
              </div>
            </div>
            <div className="filter-group" style={{ marginLeft: 'auto' }}>
              <span className="filter-label">정렬</span>
              <div className="filter-chips">
                <button className={`filter-chip${sortBy === 'date'  ? ' on' : ''}`} onClick={() => setSortBy('date')}>최신순</button>
                <button className={`filter-chip${sortBy === 'score' ? ' on' : ''}`} onClick={() => setSortBy('score')}>점수순</button>
              </div>
            </div>
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
        ) : filtered.length === 0 ? (
          <div className="history-empty">
            <div className="he-icon">🔍</div>
            <div className="he-title">해당 조건의 세션이 없습니다</div>
            <div className="he-desc">필터를 변경해보세요.</div>
          </div>
        ) : (
          <div className="history-list">
            {filtered.map((s, i) => {
              const score  = Math.round(s.overall_score ?? 0);
              const type   = TYPE_LABEL[s.presentation_type] ?? s.presentation_type ?? '—';
              const aud    = AUD_LABEL[s.audience_type]      ?? s.audience_type      ?? '—';
              const diff   = DIFF_LABEL[s.pressure_level]    ?? s.pressure_level     ?? '—';
              const date   = s.created_at ? new Date(s.created_at).toLocaleDateString('ko-KR') : '—';
              const dur    = s.duration_seconds ? `${Math.round(s.duration_seconds / 60)}분` : '—';
              const isBest = score === bestScore && total > 1;
              return (
                <div className="hi" key={s.session_id ?? s.id} onClick={() => onDetail?.(s.session_id ?? s.id)}>
                  <div className="hi-num">#{filtered.length - i}</div>
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
