import { useEffect, useState } from 'react';
import './ReportPage.css';
import { generateFeedback } from '../services/claudeApi';

// ── 점수 계산 ────────────────────────────────────────
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

// ── 데모 피드백 생성 (로컬 규칙 기반) ─────────────────
function generateDemoFeedback({ avgWpm, fillerCount, interruptCount, elapsed }) {
  const lines = [];

  if (avgWpm > 160)
    lines.push('말하기 속도가 다소 빠릅니다. 청중이 내용을 소화할 수 있도록 조금 더 천천히 말씀해보세요.');
  else if (avgWpm < 80)
    lines.push('말하기 속도가 다소 느립니다. 발표에 더 리듬감을 주면 집중력을 높일 수 있습니다.');
  else
    lines.push('말하기 속도는 적절한 편입니다. 전반적으로 안정적인 발화 속도를 유지했습니다.');

  if (fillerCount >= 5)
    lines.push(`필러 단어가 ${fillerCount}회 감지되었습니다. "어", "음", "그" 등의 사용을 줄이면 더 명확한 발표가 됩니다.`);
  else if (fillerCount > 0)
    lines.push(`필러 단어가 ${fillerCount}회 감지되었습니다. 전반적으로 양호한 수준입니다.`);
  else
    lines.push('필러 단어가 감지되지 않았습니다. 매우 깔끔한 발화였습니다.');

  if (interruptCount >= 2)
    lines.push(`총 ${interruptCount}번의 돌발 질문이 있었습니다. 질문 대응 연습을 통해 더 자신감 있는 답변을 준비해보세요.`);
  else if (interruptCount === 1)
    lines.push('돌발 질문 1회에 대응했습니다. 앞으로 더 다양한 질문 유형에 대비해보세요.');

  const elapsedMin = Math.floor(elapsed / 60);
  lines.push(`총 ${elapsedMin}분 ${elapsed % 60}초 동안 발표를 진행했습니다.`);

  return lines.join('\n\n');
}

// ── ReportPage ───────────────────────────────────────
export default function ReportPage({ simState, onRestart }) {
  const { type, audience, difficulty, elapsed, fillerCount, wpmHistory, interruptLog, transcript, demoMode } = simState;

  const [feedbackText, setFeedbackText] = useState(null);

  const avgWpm = wpmHistory.length
    ? Math.round(wpmHistory.reduce((a, b) => a + b, 0) / wpmHistory.length)
    : 0;

  const score = calcScore(fillerCount, interruptLog.length, avgWpm);
  const mm    = String(Math.floor(elapsed / 60)).padStart(1, '0');
  const ss    = String(elapsed % 60).padStart(2, '0');
  const meta  = `${new Date().toLocaleString('ko-KR')} · ${type} · ${difficulty}`;

  useEffect(() => {
    if (demoMode) {
      // 데모 모드 — 로컬 규칙 기반 피드백
      const text = generateDemoFeedback({ avgWpm, fillerCount, interruptCount: interruptLog.length, elapsed });
      setFeedbackText(text);
    } else {
      // 실행 모드 — 백엔드 AI 피드백 (미구현 시 오류 메시지)
      generateFeedback({ type, audience, difficulty, elapsed, avgWpm, fillerCount, interruptLog, transcript, score })
        .then(text => setFeedbackText(text ?? '피드백을 불러오지 못했습니다.'))
        .catch(()  => setFeedbackText('피드백을 불러오지 못했습니다.'));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="report-page">
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

      <div className="feedback-section">
        <div className="feedback-section__title">
          {demoMode ? '데모 피드백' : 'AI 종합 피드백'}
        </div>
        {feedbackText === null ? (
          <div className="feedback-text feedback-text--loading">피드백 분석 중...</div>
        ) : (
          <div className="feedback-text" style={{ whiteSpace: 'pre-line' }}>{feedbackText}</div>
        )}
      </div>

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