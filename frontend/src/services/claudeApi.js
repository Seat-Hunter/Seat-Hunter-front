// services/claudeApi.js
// ── API 연동 미정 — 추후 이 파일만 수정하면 됩니다 ──

// ── 인터럽트 질문 생성 ─────────────────────────────────
// SimPage에서 호출
// payload: { audience, type, difficulty, context }
// return:  string | null
export async function generateInterruptQuestion({ audience, type, difficulty, context }) {
  // TODO: API 결정 후 여기에 구현
  // 예시)
  // const res = await fetch('/api/interrupt', {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify({ audience, type, difficulty, context }),
  // });
  // const data = await res.json();
  // return data.question ?? null;

  return null;
}

// ── 종합 피드백 생성 ───────────────────────────────────
// ReportPage에서 호출
// payload: { type, audience, difficulty, elapsed, avgWpm, fillerCount, interruptLog, transcript, score }
// return:  string | null
export async function generateFeedback({ type, audience, difficulty, elapsed, avgWpm, fillerCount, interruptLog, transcript, score }) {
  // TODO: API 결정 후 여기에 구현
  // 예시)
  // const res = await fetch('/api/feedback', {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify({ type, audience, difficulty, elapsed, avgWpm, fillerCount, interruptLog, transcript, score }),
  // });
  // const data = await res.json();
  // return data.feedback ?? null;

  return null;
}