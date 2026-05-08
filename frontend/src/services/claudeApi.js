// services/claudeApi.js
// 백엔드(Seat-Hunter-back) 연동 서비스

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';
const WS_BASE  = import.meta.env.VITE_WS_BASE_URL  ?? 'ws://localhost:8000';

// ── 모듈 레벨 WebSocket 상태 ──────────────────────────────
let _sessionId = null;
let _ws        = null;
const _interruptQueue = [];  // 백엔드에서 수신된 질문 버퍼

// ── 난이도 매핑 ────────────────────────────────────────────
function mapDifficulty(d) {
  return { easy: 'low', medium: 'medium', hard: 'high', brutal: 'extreme' }[d] ?? 'medium';
}

// ── 세션 관리 ─────────────────────────────────────────────

// SetupPage에서 "발표 시작" 시 호출
// config: { type, audience, audienceCount, difficulty, duration, interrupt, script }
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
  const data = await res.json();
  _sessionId = data.session_id;
  return data; // { session_id, state: 'READY', ... }
}

// SimPage 마운트 직후 호출 (READY → RUNNING)
export async function startSession(sessionId = _sessionId) {
  const res = await fetch(`${API_BASE}/api/v1/sessions/${sessionId}/start`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error(`세션 시작 실패: ${res.status}`);
  return res.json();
}

// SimPage 종료 시 호출
export async function endSession(sessionId = _sessionId) {
  const res = await fetch(`${API_BASE}/api/v1/sessions/${sessionId}/end`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error(`세션 종료 실패: ${res.status}`);
  return res.json();
}

// ReportPage에서 리포트 데이터 조회
export async function getReport(sessionId = _sessionId) {
  if (!sessionId) return null;
  const res = await fetch(`${API_BASE}/api/v1/sessions/${sessionId}/report`);
  if (!res.ok) throw new Error(`리포트 조회 실패: ${res.status}`);
  return res.json();
}

// ── WebSocket ─────────────────────────────────────────────

// App.jsx에서 세션 시작 후 호출 (handlers 방식)
// handlers: { onMetrics, onInterrupt, onTTSAudio, onAudienceReaction, onSessionState }
export function connectWS(sessionId = _sessionId, handlers = {}) {
  if (_ws) _ws.close();
  _interruptQueue.length = 0;

  _ws = new WebSocket(`${WS_BASE}/ws/sessions/${sessionId}`);

  _ws.onmessage = (event) => {
    let msg;
    try { msg = JSON.parse(event.data); }
    catch { return; }

    switch (msg.type) {
      case 'live_metrics':
        handlers.onMetrics?.(msg);
        break;
      case 'interrupt_question':
        _interruptQueue.push(msg.question_text ?? msg.text ?? '');
        handlers.onInterrupt?.(msg);
        break;
      case 'tts_audio':
        handlers.onTTSAudio?.(msg);
        break;
      case 'audience_reaction':
        handlers.onAudienceReaction?.(msg);
        break;
      case 'session_state':
        handlers.onSessionState?.(msg);
        break;
    }
  };

  _ws.onerror = (e) => console.error('[WS] 오류:', e);

  return _ws;
}

// SimPage에서 사용하는 단일 콜백 방식 WebSocket 연결
export function connectSessionWS(sessionId, onMessage) {
  const ws = new WebSocket(`${WS_BASE}/ws/sessions/${sessionId}`);
  ws.onopen    = () => console.log('[WS] connected');
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

export function disconnectWS() {
  _ws?.close();
  _ws = null;
}

// 오디오 청크 전송 (MediaRecorder → base64)
export function sendAudioChunk(audioBase64) {
  if (_ws?.readyState === WebSocket.OPEN) {
    _ws.send(JSON.stringify({
      type:         'audio_chunk',
      timestamp_ms: Date.now(),
      audio_base64: audioBase64,
    }));
  }
}

// 전사 텍스트 동기화 (Web Speech API 사용 시 백엔드에 transcript 전달)
export function sendTranscript(text, isFinal = false) {
  if (_ws?.readyState === WebSocket.OPEN) {
    _ws.send(JSON.stringify({
      type:         'partial_transcript',
      text,
      is_final:     isFinal,
      timestamp_ms: Date.now(),
    }));
  }
}

// ── SimPage / ReportPage 호환 함수 ────────────────────────

// SimPage에서 타이머마다 호출 — 백엔드가 큐에 넣은 질문을 꺼내거나 null 반환
export async function generateInterruptQuestion({ audience, type, difficulty, context }) {
  if (_interruptQueue.length > 0) {
    return _interruptQueue.shift();
  }
  sendTranscript(context, true);
  return null;
}

// ReportPage에서 마운트 시 호출 — 백엔드 리포트 전체 객체 반환 (최대 20초 재시도)
export async function generateFeedback({ type, audience, difficulty, elapsed, avgWpm, fillerCount, interruptLog, transcript, score }) {
  if (!_sessionId) return null;
  for (let i = 0; i < 4; i++) {
    try {
      const report = await getReport();
      if (report) return report;
    } catch (e) {
      console.warn(`[API] 리포트 조회 재시도 ${i + 1}/4:`, e.message);
    }
    await new Promise(r => setTimeout(r, 5000));
  }
  return null;
}
