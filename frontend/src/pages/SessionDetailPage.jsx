import { useEffect, useState } from 'react';
import './SessionDetailPage.css';

const LOGO = <span style={{ fontSize: 14 }}>🙋</span>;
const API = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';

const TYPE_LABEL = { interview: '면접', academic: '학술발표', school: '학교발표', meeting: '회의' };
const DIFF_LABEL = { low: '약함', medium: '보통', high: '강함', brutal: '극한' };
const AUD_LABEL  = { professor: '교수', investor: '투자자', boss: '상사', general: '일반 청중' };

function scoreColor(s) {
  if (s >= 70) return 'var(--blue)';
  if (s >= 40) return 'var(--amber)';
  return 'var(--red)';
}

function ScriptToggle({ sessionId }) {
  const [open,     setOpen]     = useState(false);
  const [script,   setScript]   = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [fetched,  setFetched]  = useState(false);

  async function handleToggle() {
    setOpen(prev => !prev);
    if (!fetched) {
      setLoading(true);
      try {
        const res = await fetch(`${API}/api/v1/sessions/${sessionId}/scripts`);
        if (res.ok) {
          const data = await res.json();
          setScript(data);
        } else {
          setScript({ full_script: '', segments: [] });
        }
      } catch {
        setScript({ full_script: '', segments: [] });
      } finally {
        setLoading(false);
        setFetched(true);
      }
    }
  }

  const hasScript = script && (script.full_script || script.segments?.length > 0);

  return (
    <div className="script-toggle-card">
      <button className="script-toggle-btn" onClick={handleToggle}>
        <span className="script-toggle-left">
          <span className="script-toggle-icon">📝</span>
          <span className="script-toggle-label">발표 대본</span>
        </span>
        <span className={`script-chevron${open ? ' open' : ''}`}>▾</span>
      </button>

      {open && (
        <div className="script-body">
          {loading ? (
            <div className="script-loading">대본 불러오는 중...</div>
          ) : !hasScript ? (
            <div className="script-empty">저장된 대본이 없습니다.</div>
          ) : (
            <div className="script-full">{script.full_script}</div>
          )}
        </div>
      )}
    </div>
  );
}

export default function SessionDetailPage({ sessionId, onBack, onHome, onSetup }) {
  const [report,     setReport]     = useState(null);
  const [interrupts, setInterrupts] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);

  useEffect(() => {
    if (!sessionId) return;

    async function load() {
      try {
        const reportRes = await fetch(`${API}/api/v1/sessions/${sessionId}/report`);
        if (reportRes.ok) {
          const r = await reportRes.json();
          setReport(r);
        } else if (reportRes.status === 404) {
          setReport(null);
        }

        const intRes = await fetch(`${API}/api/v1/sessions/${sessionId}/interrupts`);
        if (intRes.ok) {
          const arr = await intRes.json();
          setInterrupts(Array.isArray(arr) ? arr : []);
        }
      } catch (e) {
        setError('데이터를 불러오지 못했습니다.');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [sessionId]);

  const score = report?.overall_score ?? null;

  return (
    <div className="detail-page">
      <nav className="nav">
        <div className="nav-logo" onClick={onHome} style={{ cursor: 'pointer' }}>
          <div className="logo-icon">{LOGO}</div>
          <span className="logo-text">SpeechLab</span>
        </div>
        <div className="nav-links">
          <button className="nav-a" onClick={onHome}>홈</button>
          <button className="nav-a" onClick={onBack}>← 히스토리</button>
          <button className="nav-a on">세션 상세</button>
        </div>
        <div className="nav-right">
          <button className="btn-blue" onClick={onSetup}>새 세션</button>
        </div>
      </nav>

      <div className="detail-wrap">
        {loading && (
          <div style={{ textAlign: 'center', padding: '60px', color: 'var(--ink3)', fontSize: 13 }}>
            불러오는 중...
          </div>
        )}

        {error && (
          <div style={{ background: 'var(--red-s)', border: '1px solid rgba(220,38,38,0.2)', color: 'var(--red)', borderRadius: 8, padding: '14px 18px', fontSize: 13 }}>
            {error}
          </div>
        )}

        {!loading && !error && (
          <>
            {/* 헤더 */}
            <div className="detail-header">
              <div>
                <div className="detail-eyebrow">세션 ID · {sessionId}</div>
                <div className="detail-title">
                  {report ? `${TYPE_LABEL[report.presentation_type] ?? '발표'} 세션` : '세션 상세'}
                </div>
                <div className="detail-meta">
                  {report?.created_at
                    ? new Date(report.created_at).toLocaleString('ko-KR')
                    : '날짜 정보 없음'}
                </div>
              </div>
              {score !== null && (
                <div className="detail-score-wrap">
                  <div className="detail-score" style={{ color: scoreColor(score) }}>{Math.round(score)}</div>
                  <div className="detail-score-label">종합 점수</div>
                </div>
              )}
            </div>

            {/* 지표 */}
            {report && (
              <div className="detail-metrics">
                <div className="dm-card">
                  <div className="dm-val" style={{ color: 'var(--blue)' }}>{Math.round(report.avg_wpm ?? 0)}</div>
                  <div className="dm-label">평균 WPM</div>
                </div>
                <div className="dm-card">
                  <div className="dm-val" style={{ color: (report.filler_count ?? 0) >= 5 ? 'var(--red)' : 'var(--green)' }}>
                    {report.filler_count ?? 0}
                  </div>
                  <div className="dm-label">필러 횟수</div>
                </div>
                <div className="dm-card">
                  <div className="dm-val" style={{ color: 'var(--amber)' }}>{report.interrupt_count ?? interrupts.length}</div>
                  <div className="dm-label">인터럽트</div>
                </div>
                <div className="dm-card">
                  <div className="dm-val" style={{ color: 'var(--blue)' }}>
                    {report.recovery_score != null ? Math.round(report.recovery_score) : '—'}
                  </div>
                  <div className="dm-label">회복 점수</div>
                </div>
              </div>
            )}

            {/* 세션 정보 */}
            {report && (
              <div className="info-card">
                <div className="info-title">세션 정보</div>
                <div className="info-grid">
                  <div className="ig-item">
                    <div className="ig-label">발표 유형</div>
                    <div className="ig-val">{TYPE_LABEL[report.presentation_type] ?? report.presentation_type ?? '—'}</div>
                  </div>
                  <div className="ig-item">
                    <div className="ig-label">청중 유형</div>
                    <div className="ig-val">{AUD_LABEL[report.audience_type] ?? report.audience_type ?? '—'}</div>
                  </div>
                  <div className="ig-item">
                    <div className="ig-label">압박 강도</div>
                    <div className="ig-val">{DIFF_LABEL[report.pressure_level] ?? report.pressure_level ?? '—'}</div>
                  </div>
                </div>
              </div>
            )}

            {/* 발표 대본 토글 */}
            {report && <ScriptToggle sessionId={sessionId} />}

            {/* 리포트 없음 */}
            {!report && !loading && (
              <div style={{
                background: 'var(--bg2)', border: '1px solid var(--border)',
                borderRadius: 10, padding: '32px', textAlign: 'center',
              }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>📋</div>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>리포트가 아직 생성되지 않았습니다</div>
                <div style={{ fontSize: 13, color: 'var(--ink2)' }}>세션이 종료되지 않았거나 분석 중입니다.</div>
              </div>
            )}

            {/* AI 피드백 */}
            {report && (
              <>
                {(report.strengths_json ?? report.strengths ?? []).length > 0 && (
                  <div className="fb-card">
                    <div className="fb-title">강점</div>
                    <ul className="fb-list str">
                      {(report.strengths_json ?? report.strengths).map((s, i) => <li key={i}>{s}</li>)}
                    </ul>
                  </div>
                )}
                {(report.weaknesses_json ?? report.weaknesses ?? []).length > 0 && (
                  <div className="fb-card">
                    <div className="fb-title">개선 포인트</div>
                    <ul className="fb-list weak">
                      {(report.weaknesses_json ?? report.weaknesses).map((w, i) => <li key={i}>{w}</li>)}
                    </ul>
                  </div>
                )}
                {(report.improvements_json ?? report.improvements ?? []).length > 0 && (
                  <div className="fb-card">
                    <div className="fb-title">실천 방법</div>
                    <ul className="fb-list imp">
                      {(report.improvements_json ?? report.improvements).map((imp, i) => <li key={i}>{imp}</li>)}
                    </ul>
                  </div>
                )}
                {report.curriculum_next && (
                  <div className="curriculum-box">
                    <div className="info-title">다음 훈련 추천</div>
                    <div className="curriculum-val">{report.curriculum_next}</div>
                  </div>
                )}
              </>
            )}

            {/* 인터럽트 로그 */}
            <div className="qa-card">
              <div className="fb-title">돌발 질문 기록</div>
              {interrupts.length === 0 ? (
                <div className="qa-empty">이 세션에서 돌발 질문이 없었습니다.</div>
              ) : (
                interrupts.map((item, i) => (
                  <div className="qa-item" key={i}>
                    <div className="qa-num">질문 {i + 1}</div>
                    <div className="qa-text">{item.question_text ?? item}</div>
                  </div>
                ))
              )}
            </div>

            {/* 액션 */}
            <div className="detail-actions">
              <button className="da da-line" onClick={onBack}>← 히스토리</button>
              <button className="da da-blue" onClick={onSetup}>다시 연습하기</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
