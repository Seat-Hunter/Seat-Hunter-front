import { useEffect, useState } from 'react';
import './ReportPage.css';
import { pollReport } from '../services/claudeApi';

const API = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';

const LOGO = <span style={{ fontSize: 14 }}>🙋</span>;

function ScriptToggle({ sessionId }) {
  const [open,    setOpen]    = useState(false);
  const [script,  setScript]  = useState(null);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);

  async function handleToggle() {
    setOpen(prev => !prev);
    if (!fetched) {
      setLoading(true);
      try {
        const res = await fetch(`${API}/api/v1/sessions/${sessionId}/scripts`);
        if (res.ok) setScript(await res.json());
        else setScript({ full_script: '' });
      } catch {
        setScript({ full_script: '' });
      } finally {
        setLoading(false);
        setFetched(true);
      }
    }
  }

  const hasScript = script?.full_script;

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
          {loading
            ? <div className="script-loading">대본 불러오는 중...</div>
            : !hasScript
              ? <div className="script-empty">저장된 대본이 없습니다.</div>
              : <div className="script-full">{script.full_script}</div>
          }
        </div>
      )}
    </div>
  );
}

function calcLocalScore(fillerCount, interruptCount, avgWpm) {
  let s = 100;
  s -= fillerCount * 3;
  s -= Math.max(0, interruptCount - 1) * 5;
  if (avgWpm < 60 || avgWpm > 180) s -= 15;
  return Math.max(10, Math.min(99, s));
}

function scoreColor(score) {
  if (score >= 70) return 'var(--blue)';
  if (score >= 40) return 'var(--amber)';
  return 'var(--red)';
}

export default function ReportPage({ simState, onRestart, onHome, onHistory }) {
  const { type, difficulty, elapsed, fillerCount, wpmHistory, interruptLog, sessionId } = simState;

  const [reportData, setReportData]       = useState(null);
  const [backendReport, setBackendReport] = useState(null);

  const avgWpm     = wpmHistory.length
    ? Math.round(wpmHistory.reduce((a, b) => a + b, 0) / wpmHistory.length) : 0;
  const localScore = calcLocalScore(fillerCount, interruptLog.length, avgWpm);
  const score      = backendReport?.overall_score ?? localScore;
  const responseScore = backendReport?.response_score ?? null;
  const criteriaScores = backendReport?.criteria_scores ?? [];

  const mm   = String(Math.floor(elapsed / 60)).padStart(1, '0');
  const ss   = String(elapsed % 60).padStart(2, '0');
  const meta = `${new Date().toLocaleString('ko-KR')} · ${type} · ${difficulty}`;

  const [isGenerating, setIsGenerating] = useState(true);

  useEffect(() => {
    // WS 종료 시 백엔드가 즉시 리포트를 생성하므로 pollReport가 바로 성공할 수 있다.
    // 최소 1.5초는 로딩 화면을 보여줘서 사용자가 생성 중임을 인지하도록 한다.
    const minDelay = new Promise(r => setTimeout(r, 1500));

    if (!sessionId) {
      minDelay.then(() => {
        setReportData({ strengths: [], weaknesses: [], improvements: [], curriculum_next: '' });
        setIsGenerating(false);
      });
      return;
    }

    Promise.all([pollReport(sessionId), minDelay])
      .then(([report]) => {
        if (report) {
          setBackendReport(report);
          setReportData({
            strengths:       report.strengths_json    ?? report.strengths    ?? [],
            weaknesses:      report.weaknesses_json   ?? report.weaknesses   ?? [],
            improvements:    report.improvements_json ?? report.improvements ?? [],
            curriculum_next: report.curriculum_next   ?? '',
          });
        } else {
          setReportData({ strengths: [], weaknesses: [], improvements: [], curriculum_next: '피드백을 불러오지 못했습니다.' });
        }
      })
      .catch(() => setReportData({ strengths: [], weaknesses: [], improvements: [], curriculum_next: '오류가 발생했습니다.' }))
      .finally(() => setIsGenerating(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const displayAvgWpm     = backendReport?.avg_wpm         ?? avgWpm;
  const displayFiller     = backendReport?.filler_count    ?? fillerCount;
  const displayInterrupts = backendReport?.interrupt_count ?? interruptLog.length;

  return (
    <div className="report-page">
      <nav className="nav">
        <div className="nav-logo" onClick={onHome} style={{ cursor: 'pointer' }}>
          <div className="logo-icon">{LOGO}</div>
          <span className="logo-text">SpeechLab</span>
        </div>
        <div className="nav-links">
          <button className="nav-a" onClick={onHome}>홈</button>
          <button className="nav-a on">세션 결과</button>
        </div>
        <div className="nav-right">
          {onHistory && <button className="btn-line" onClick={onHistory}>히스토리</button>}
          <button className="btn-blue" onClick={onRestart}>다시 연습</button>
        </div>
      </nav>

      {isGenerating ? (
        <div className="report-generating">
          <div className="report-generating-spinner" />
          <div className="report-generating-title">리포트 생성 중...</div>
          <div className="report-generating-sub">발표 데이터를 분석하고 있습니다</div>
        </div>
      ) : <div className="report-inner">
        {/* 헤더 */}
        <div className="report-header">
          <div>
            <div className="report-title">세션 리포트</div>
            <div className="report-meta">{meta}</div>
          </div>
          <div>
            <div className="score-badge" style={{ color: scoreColor(score) }}>{Math.round(score)}</div>
            <div className="score-label">종합 점수</div>
          </div>
        </div>

        {/* 지표 */}
        <div className="metrics-row">
          <div className="metric-card">
            <div className="metric-num" style={{ color: 'var(--blue)' }}>{displayAvgWpm}</div>
            <div className="metric-label">평균 WPM</div>
          </div>
          <div className="metric-card">
            <div className="metric-num" style={{ color: displayFiller >= 5 ? 'var(--red)' : 'var(--green)' }}>{displayFiller}</div>
            <div className="metric-label">필러 횟수</div>
          </div>
          <div className="metric-card">
            <div className="metric-num" style={{ color: 'var(--amber)' }}>{displayInterrupts}</div>
            <div className="metric-label">인터럽트</div>
          </div>
          <div className="metric-card">
            <div className="metric-num" style={{ color: 'var(--ink2)' }}>{mm}:{ss}</div>
            <div className="metric-label">발표 시간</div>
          </div>
          {responseScore !== null && (
            <div className="metric-card">
              <div className="metric-num" style={{ color: 'var(--blue)' }}>{Math.round(responseScore)}</div>
              <div className="metric-label">대응 점수</div>
            </div>
          )}
        </div>

        {/* 영역별 점수 */}
        {criteriaScores.length > 0 && (
          <div className="feedback-section">
            <div className="feedback-section__title">영역별 점수</div>
            <div className="criteria-scores">
              {criteriaScores.map((c, i) => (
                <div key={i} className="criteria-score-item">
                  <div className="criteria-score-row">
                    <span className="criteria-score-label">{c.label}</span>
                    <span className="criteria-score-value" style={{ color: scoreColor(c.score) }}>{c.score}</span>
                  </div>
                  <div className="criteria-score-bar">
                    <div className="criteria-score-fill" style={{ width: `${c.score}%`, background: scoreColor(c.score) }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* AI 피드백 */}
        {reportData === null ? (
          <div className="feedback-section">
            <div className="feedback-text feedback-text--loading">AI 피드백 분석 중...</div>
          </div>
        ) : (
          <>
            {reportData.strengths.length > 0 && (
              <div className="feedback-section">
                <div className="feedback-section__title">강점</div>
                <ul className="feedback-list feedback-list--strength">
                  {reportData.strengths.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              </div>
            )}
            {reportData.weaknesses.length > 0 && (
              <div className="feedback-section">
                <div className="feedback-section__title">개선 포인트</div>
                <ul className="feedback-list feedback-list--weakness">
                  {reportData.weaknesses.map((w, i) => <li key={i}>{w}</li>)}
                </ul>
              </div>
            )}
            {reportData.improvements.length > 0 && (
              <div className="feedback-section">
                <div className="feedback-section__title">실천 방법</div>
                <ul className="feedback-list feedback-list--improvement">
                  {reportData.improvements.map((imp, i) => <li key={i}>{imp}</li>)}
                </ul>
              </div>
            )}
            {reportData.curriculum_next && (
              <div className="feedback-section feedback-section--curriculum">
                <div className="feedback-section__title">다음 훈련 추천</div>
                <div className="curriculum-text">{reportData.curriculum_next}</div>
              </div>
            )}
          </>
        )}

        {/* 발표 대본 */}
        {sessionId && <ScriptToggle sessionId={sessionId} />}

        {/* 인터럽트 로그 */}
        <div className="feedback-section">
          <div className="feedback-section__title">돌발 질문 기록</div>
          <div className="qa-list">
            {interruptLog.length === 0
              ? <div className="qa-empty">이번 세션에서 돌발 질문이 없었습니다.</div>
              : interruptLog.map((q, i) => (
                  <div key={i} className="qa-item">
                    <div className="qa-item__label">질문 {i + 1}</div>
                    {q}
                  </div>
                ))
            }
          </div>
        </div>

        {/* 하단 액션 */}
        <div style={{ display: 'flex', gap: 10 }}>
          {onHome    && <button className="btn-restart" onClick={onHome}>← 홈으로</button>}
          {onHistory && <button className="btn-restart" onClick={onHistory}>히스토리 보기</button>}
          <button className="btn-restart" style={{ background: 'var(--blue)', color: 'white', borderColor: 'var(--blue)' }}
            onClick={onRestart}>다시 연습</button>
        </div>
      </div>}
    </div>
  );
}
