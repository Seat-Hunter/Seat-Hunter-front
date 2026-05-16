import { useEffect, useState } from 'react';
import './ReportPage.css';
import { pollReport } from '../services/claudeApi';

function calcLocalScore(fillerCount, interruptCount, avgWpm) {
  let score = 100;
  score -= fillerCount * 3;
  score -= Math.max(0, interruptCount - 1) * 5;
  if (avgWpm < 60 || avgWpm > 180) score -= 15;
  return Math.max(10, Math.min(99, score));
}

function scoreColor(score) {
  if (score >= 70) return 'var(--accent)';
  if (score >= 40) return 'var(--accent3)';
  return 'var(--accent2)';
}

export default function ReportPage({ simState, onRestart }) {
  const { type, difficulty, elapsed, fillerCount, wpmHistory, interruptLog, sessionId } = simState;

  const [reportData, setReportData]       = useState(null);
  const [backendReport, setBackendReport] = useState(null);

  const avgWpm     = wpmHistory.length
    ? Math.round(wpmHistory.reduce((a, b) => a + b, 0) / wpmHistory.length)
    : 0;
  const localScore = calcLocalScore(fillerCount, interruptLog.length, avgWpm);
  const score      = backendReport?.overall_score ?? localScore;
  const recoveryScore = backendReport?.recovery_score ?? null;

  const mm   = String(Math.floor(elapsed / 60)).padStart(1, '0');
  const ss   = String(elapsed % 60).padStart(2, '0');
  const meta = `${new Date().toLocaleString('ko-KR')} · ${type} · ${difficulty}`;

  useEffect(() => {
    if (!sessionId) {
      setReportData({ strengths: [], weaknesses: [], improvements: [], curriculum_next: '세션 ID 없음' });
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
      .catch(() => setReportData({ strengths: [], weaknesses: [], improvements: [], curriculum_next: '리포트 조회 중 오류가 발생했습니다.' }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const displayAvgWpm     = backendReport?.avg_wpm         ?? avgWpm;
  const displayFiller     = backendReport?.filler_count    ?? fillerCount;
  const displayInterrupts = backendReport?.interrupt_count ?? interruptLog.length;

  return (
    <div className="report-page">
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

      <div className="metrics-row">
        <div className="metric-card">
          <div className="metric-num" style={{ color: 'var(--accent3)' }}>{displayAvgWpm}</div>
          <div className="metric-label">평균 WPM</div>
        </div>
        <div className="metric-card">
          <div className="metric-num" style={{ color: 'var(--accent2)' }}>{displayFiller}</div>
          <div className="metric-label">필러 횟수</div>
        </div>
        <div className="metric-card">
          <div className="metric-num" style={{ color: 'var(--accent2)' }}>{displayInterrupts}</div>
          <div className="metric-label">인터럽트</div>
        </div>
        <div className="metric-card">
          <div className="metric-num" style={{ color: 'var(--accent)' }}>{mm}:{ss}</div>
          <div className="metric-label">발표 시간</div>
        </div>
        {recoveryScore !== null && (
          <div className="metric-card">
            <div className="metric-num" style={{ color: 'var(--accent)' }}>{Math.round(recoveryScore)}</div>
            <div className="metric-label">회복 점수</div>
          </div>
        )}
      </div>

      {reportData === null ? (
        <div className="feedback-section">
          <div className="feedback-text feedback-text--loading">AI 피드백 분석 중...</div>
        </div>
      ) : (
        <>
          <div className="feedback-section">
            <div className="feedback-section__title">AI 종합 피드백 — 강점</div>
            <ul className="feedback-list feedback-list--strength">
              {reportData.strengths.map((s, i) => <li key={i}>{s}</li>)}
            </ul>
          </div>
          <div className="feedback-section">
            <div className="feedback-section__title">약점</div>
            <ul className="feedback-list feedback-list--weakness">
              {reportData.weaknesses.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          </div>
          <div className="feedback-section">
            <div className="feedback-section__title">개선 방법</div>
            <ul className="feedback-list feedback-list--improvement">
              {reportData.improvements.map((imp, i) => <li key={i}>{imp}</li>)}
            </ul>
          </div>
          {reportData.curriculum_next && (
            <div className="feedback-section feedback-section--curriculum">
              <div className="feedback-section__title">다음 훈련 추천</div>
              <div className="curriculum-text">{reportData.curriculum_next}</div>
            </div>
          )}
        </>
      )}

      <div className="feedback-section">
        <div className="feedback-section__title">발생한 인터럽트 질문</div>
        <div className="qa-list">
          {interruptLog.length === 0 ? (
            <div className="qa-empty">인터럽트 없음</div>
          ) : (
            interruptLog.map((q, i) => (
              <div key={i} className="qa-item">
                <div className="qa-item__label">질문 {i + 1}</div>
                {q}
              </div>
            ))
          )}
        </div>
      </div>

      <button className="btn-restart" onClick={onRestart}>다시 시작</button>
    </div>
  );
}
