import { useEffect, useState } from 'react';
import './ReportPage.css';
import { pollReport } from '../services/claudeApi';

const LOGO = (
  <svg viewBox="0 0 16 16" fill="none">
    <rect x="3" y="7" width="10" height="7" rx="2" fill="white" opacity="0.9"/>
    <path d="M6 7V5a2 2 0 0 1 4 0v2" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
    <circle cx="8" cy="10.5" r="1" fill="#2563eb"/>
  </svg>
);

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
  const recoveryScore = backendReport?.recovery_score ?? null;

  const mm   = String(Math.floor(elapsed / 60)).padStart(1, '0');
  const ss   = String(elapsed % 60).padStart(2, '0');
  const meta = `${new Date().toLocaleString('ko-KR')} · ${type} · ${difficulty}`;

  useEffect(() => {
    if (!sessionId) {
      setReportData({ strengths: [], weaknesses: [], improvements: [], curriculum_next: '' });
      return;
    }
    pollReport(sessionId)
      .then(report => {
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
      .catch(() => setReportData({ strengths: [], weaknesses: [], improvements: [], curriculum_next: '오류가 발생했습니다.' }));
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

      <div className="report-inner">
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
          {recoveryScore !== null && (
            <div className="metric-card">
              <div className="metric-num" style={{ color: 'var(--blue)' }}>{Math.round(recoveryScore)}</div>
              <div className="metric-label">회복 점수</div>
            </div>
          )}
        </div>

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
      </div>
    </div>
  );
}
