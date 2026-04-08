import { useEffect, useState } from 'react';
import './ReportPage.css';
import { generateFeedback } from '../services/claudeApi';

// ── 점수 계산 (원본 로직 그대로) ────────────────────────
function calcScore(fillerCount, interruptCount, avgWpm) {
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

// ── ReportPage ───────────────────────────────────────
export default function ReportPage({ simState, onRestart }) {
  const { type, audience, difficulty, elapsed, fillerCount, wpmHistory, interruptLog, transcript } = simState;

  const [feedbackText, setFeedbackText] = useState(null); // null = 로딩 중

  // ── 파생 값
  const avgWpm = wpmHistory.length
    ? Math.round(wpmHistory.reduce((a, b) => a + b, 0) / wpmHistory.length)
    : 0;

  const score = calcScore(fillerCount, interruptLog.length, avgWpm);
  const mm    = String(Math.floor(elapsed / 60)).padStart(1, '0');
  const ss    = String(elapsed % 60).padStart(2, '0');
  const meta  = `${new Date().toLocaleString('ko-KR')} · ${type} · ${difficulty}`;

  // ── 마운트 시 AI 피드백 요청
  useEffect(() => {
    generateFeedback({ type, audience, difficulty, elapsed, avgWpm, fillerCount, interruptLog, transcript, score })
      .then(text => setFeedbackText(text ?? '피드백을 불러오지 못했습니다.'))
      .catch(()  => setFeedbackText('피드백을 불러오지 못했습니다. 네트워크를 확인해주세요.'));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="report-page">
      {/* ── 헤더 ── */}
      <div className="report-header">
        <div>
          <div className="report-title">세션 리포트</div>
          <div className="report-meta">{meta}</div>
        </div>
        <div>
          <div className="score-badge" style={{ color: scoreColor(score) }}>{score}</div>
          <div className="score-label">압박 대응 점수</div>
        </div>
      </div>

      {/* ── 지표 카드 ── */}
      <div className="metrics-row">
        <div className="metric-card">
          <div className="metric-num" style={{ color: 'var(--accent3)' }}>{avgWpm}</div>
          <div className="metric-label">평균 WPM</div>
        </div>
        <div className="metric-card">
          <div className="metric-num" style={{ color: 'var(--accent2)' }}>{fillerCount}</div>
          <div className="metric-label">필러 횟수</div>
        </div>
        <div className="metric-card">
          <div className="metric-num" style={{ color: 'var(--accent2)' }}>{interruptLog.length}</div>
          <div className="metric-label">인터럽트</div>
        </div>
        <div className="metric-card">
          <div className="metric-num" style={{ color: 'var(--accent)' }}>{mm}:{ss}</div>
          <div className="metric-label">발표 시간</div>
        </div>
      </div>

      {/* ── AI 피드백 ── */}
      <div className="feedback-section">
        <div className="feedback-section__title">AI 종합 피드백</div>
        {feedbackText === null ? (
          <div className="feedback-text feedback-text--loading">AI 피드백 분석 중...</div>
        ) : (
          <div className="feedback-text">{feedbackText}</div>
        )}
      </div>

      {/* ── 인터럽트 질문 목록 ── */}
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

      {/* ── 재시작 ── */}
      <button className="btn-restart" onClick={onRestart}>다시 시작</button>
    </div>
  );
}
