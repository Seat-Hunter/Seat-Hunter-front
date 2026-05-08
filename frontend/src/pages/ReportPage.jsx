import { useEffect, useState } from 'react';
import './ReportPage.css';
import { generateFeedback } from '../services/claudeApi';

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

function generateDemoFeedback({ avgWpm, fillerCount, interruptCount, elapsed }) {
  const strengths = [];
  const weaknesses = [];
  const improvements = [];

  if (avgWpm >= 80 && avgWpm <= 160)
    strengths.push('말하기 속도가 적절합니다. 안정적인 발화 속도를 유지했습니다.');
  if (fillerCount === 0)
    strengths.push('필러 단어가 감지되지 않았습니다. 매우 깔끔한 발화였습니다.');
  else if (fillerCount < 5)
    strengths.push(`필러 단어가 ${fillerCount}회로 전반적으로 양호한 수준입니다.`);
  if (strengths.length === 0)
    strengths.push('끝까지 발표를 유지한 점이 좋습니다.');

  if (avgWpm > 160) {
    weaknesses.push('말하기 속도가 다소 빠릅니다. 청중이 내용을 소화하기 어려울 수 있습니다.');
    improvements.push('핵심 문장마다 짧은 pause를 두고 일정한 속도로 말하는 연습이 필요합니다.');
  } else if (avgWpm < 80) {
    weaknesses.push('말하기 속도가 다소 느립니다. 발표에 리듬감이 부족합니다.');
    improvements.push('좀 더 활기찬 발화 속도를 유지하는 연습을 해보세요.');
  }
  if (fillerCount >= 5) {
    weaknesses.push(`필러 단어가 ${fillerCount}회 감지되었습니다. 발표 매끄러움이 떨어집니다.`);
    improvements.push('"어", "음", "그" 등의 필러 단어 사용을 줄이는 연습을 해보세요.');
  }
  if (interruptCount >= 2) {
    weaknesses.push(`${interruptCount}번의 돌발 질문이 있었습니다. 질문 대응 연습이 필요합니다.`);
    improvements.push('다양한 질문 유형에 대한 답변 템플릿을 미리 준비해보세요.');
  }
  if (weaknesses.length === 0)
    weaknesses.push('뚜렷한 약점은 없지만 세부 표현을 다듬을 여지가 있습니다.');
  if (improvements.length === 0)
    improvements.push('다음 세션에서는 표현을 더 자연스럽게 다듬는 연습을 해보세요.');

  const elapsedMin = Math.floor(elapsed / 60);
  return {
    strengths,
    weaknesses,
    improvements,
    curriculum_next: `총 ${elapsedMin}분 ${elapsed % 60}초 발표 완료 — 종합 발표 안정화 훈련 추천`,
  };
}

export default function ReportPage({ simState, onRestart }) {
  const { type, audience, difficulty, elapsed, fillerCount, wpmHistory, interruptLog, transcript, demoMode } = simState;

  const [reportData, setReportData] = useState(null);
  const [backendReport, setBackendReport] = useState(null);

  const avgWpm = wpmHistory.length
    ? Math.round(wpmHistory.reduce((a, b) => a + b, 0) / wpmHistory.length)
    : 0;

  const localScore = calcScore(fillerCount, interruptLog.length, avgWpm);
  const score = backendReport?.overall_score ?? localScore;
  const recoveryScore = backendReport?.recovery_score ?? null;

  const mm   = String(Math.floor(elapsed / 60)).padStart(1, '0');
  const ss   = String(elapsed % 60).padStart(2, '0');
  const meta = `${new Date().toLocaleString('ko-KR')} · ${type} · ${difficulty}`;

  useEffect(() => {
    if (demoMode) {
      setReportData(generateDemoFeedback({ avgWpm, fillerCount, interruptCount: interruptLog.length, elapsed }));
    } else {
      generateFeedback({ type, audience, difficulty, elapsed, avgWpm, fillerCount, interruptLog, transcript, score: localScore })
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
        .catch(() => setReportData({ strengths: [], weaknesses: [], improvements: [], curriculum_next: '피드백을 불러오지 못했습니다.' }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const displayAvgWpm         = backendReport?.avg_wpm        ?? avgWpm;
  const displayFillerCount    = backendReport?.filler_count   ?? fillerCount;
  const displayInterruptCount = backendReport?.interrupt_count ?? interruptLog.length;

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
          <div className="metric-num" style={{ color: 'var(--accent2)' }}>{displayFillerCount}</div>
          <div className="metric-label">필러 횟수</div>
        </div>
        <div className="metric-card">
          <div className="metric-num" style={{ color: 'var(--accent2)' }}>{displayInterruptCount}</div>
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
          <div className="feedback-text feedback-text--loading">피드백 분석 중...</div>
        </div>
      ) : (
        <>
          <div className="feedback-section">
            <div className="feedback-section__title">
              {demoMode ? '데모 피드백' : 'AI 종합 피드백'} — 강점
            </div>
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
