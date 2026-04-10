// services/claudeApi.js

const BASE = 'http://localhost:8000';

// ── 세션 생성 ──────────────────────────────────────────
// SetupPage에서 호출
export async function createSession(config) {
  const res = await fetch(`${BASE}/api/v1/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: 1,
      presentation_type: config.type,
      audience_type: config.audience,
      audience_count: config.audienceCount,
      pressure_level: config.difficulty === 'brutal' ? 'high'
                    : config.difficulty === 'hard'   ? 'high'
                    : config.difficulty === 'medium' ? 'medium' : 'low',
      duration_seconds: config.duration * 60,
      interrupt_enabled: config.interrupt,
      script_text: config.script || null,
    }),
  });
  const data = await res.json();
  return data.session_id;
}

// ── 세션 시작 ──────────────────────────────────────────
export async function startSession(sessionId) {
  await fetch(`${BASE}/api/v1/sessions/${sessionId}/start`, { method: 'POST' });
}

// ── 세션 종료 ──────────────────────────────────────────
export async function endSession(sessionId) {
  await fetch(`${BASE}/api/v1/sessions/${sessionId}/end`, { method: 'POST' });
}

// ── WebSocket 연결 ─────────────────────────────────────
// onMessage: 서버에서 오는 메시지 콜백
// return: ws 인스턴스
export function connectSessionWS(sessionId, onMessage) {
  const ws = new WebSocket(`ws://localhost:8000/ws/sessions/${sessionId}`);
  ws.onopen = () => console.log('[WS] connected');
  ws.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data);
      onMessage(msg);
    } catch {
      console.error('[WS] parse error', e.data);
    }
  };
  ws.onclose = () => console.log('[WS] disconnected');
  ws.onerror = (e) => console.error('[WS] error', e);
  return ws;
}

// ── 인터럽트 질문 생성 ─────────────────────────────────
// 현재는 백엔드 B 담당(Question Engine) 미구현
// 구현되면 아래 주석 해제
export async function generateInterruptQuestion({ audience, type, difficulty, context }) {
  // const res = await fetch(`${BASE}/api/v1/interrupt-question`, {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify({ audience, type, difficulty, context }),
  // });
  // const data = await res.json();
  // return data.question ?? null;
  return null;
}

// ── 종합 피드백 생성 ───────────────────────────────────
// 현재는 백엔드 B 담당(Report Generator) 미구현
export async function generateFeedback({ type, audience, difficulty, elapsed, avgWpm, fillerCount, interruptLog, transcript, score }) {
  // const res = await fetch(`${BASE}/api/v1/sessions/${sessionId}/report`);
  // const data = await res.json();
  // return data ?? null;
  return null;
}