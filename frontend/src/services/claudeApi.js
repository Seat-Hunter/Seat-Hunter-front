// services/claudeApi.js
// 백엔드(Seat-Hunter-back) 실제 모드 전용 — 데모 모드는 이 파일을 전혀 사용하지 않음

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';
const WS_BASE  = import.meta.env.VITE_WS_BASE_URL  ?? 'ws://localhost:8000';

// ── 난이도 매핑 ────────────────────────────────────────────
function mapDifficulty(d) {
  return { easy: 'low', medium: 'medium', hard: 'high', brutal: 'high' }[d] ?? 'medium';
}

// ── 세션 관리 ─────────────────────────────────────────────

export async function createSession(config) {
  const res = await fetch(`${API_BASE}/api/v1/sessions`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      user_id:           1,
      presentation_type: config.type,
      audience_type:     config.audience,
      audience_count:    config.audienceCount,
      pressure_level:    mapDifficulty(config.difficulty),
      duration_seconds:  config.duration * 60,
      interrupt_enabled: config.interrupt,
      script_text:       config.script || null,
    }),
  });
  if (!res.ok) throw new Error(`세션 생성 실패: ${res.status}`);
  return res.json(); // { session_id, state }
}

export async function startSession(sessionId) {
  const res = await fetch(`${API_BASE}/api/v1/sessions/${sessionId}/start`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error(`세션 시작 실패: ${res.status}`);
  return res.json();
}

export async function endSession(sessionId) {
  const res = await fetch(`${API_BASE}/api/v1/sessions/${sessionId}/end`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error(`세션 종료 실패: ${res.status}`);
  return res.json();
}

export async function cancelSession(sessionId) {
  const res = await fetch(`${API_BASE}/api/v1/sessions/${sessionId}/cancel`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error(`세션 취소 실패: ${res.status}`);
  return res.json();
}

export async function getReport(sessionId) {
  const res = await fetch(`${API_BASE}/api/v1/sessions/${sessionId}/report`);
  if (!res.ok) throw new Error(`리포트 조회 실패: ${res.status}`);
  return res.json();
}

// 리포트 폴링 (최대 20초, 4회 재시도)
export async function pollReport(sessionId) {
  for (let i = 0; i < 4; i++) {
    try {
      const report = await getReport(sessionId);
      if (report) return report;
    } catch (e) {
      console.warn(`[API] 리포트 재시도 ${i + 1}/4:`, e.message);
    }
    await new Promise(r => setTimeout(r, 5000));
  }
  return null;
}

// ── WebSocket ─────────────────────────────────────────────

// SimPage에서 사용 — 단일 콜백 방식
export function connectSessionWS(sessionId, onMessage) {
  const ws = new WebSocket(`${WS_BASE}/ws/sessions/${sessionId}`);
  ws.onopen    = () => console.log('[WS] connected:', sessionId);
  ws.onmessage = (e) => {
    try { onMessage(JSON.parse(e.data)); }
    catch { console.error('[WS] parse error', e.data); }
  };
  ws.onclose = () => console.log('[WS] disconnected');
  ws.onerror = (e) => console.error('[WS] error', e);
  return ws;
}
