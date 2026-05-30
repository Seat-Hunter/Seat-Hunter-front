import { useEffect, useRef, useState } from 'react';
import './SimPage.css';
import AudienceSimulator from './AudienceSimulator';
import { startSession, endSession, cancelSession, connectSessionWS } from '../services/claudeApi';

const LOGO = (
  <svg viewBox="0 0 16 16" fill="none">
    <rect x="3" y="7" width="10" height="7" rx="2" fill="white" opacity="0.9"/>
    <path d="M6 7V5a2 2 0 0 1 4 0v2" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
    <circle cx="8" cy="10.5" r="1" fill="#2563eb"/>
  </svg>
);

const FILLERS = ['어', '음', '그', '저', '뭐', '그냥', '좀', '아', '에', '이'];

function computeMoods(mood, count) {
  return Array.from({ length: count }, (_, i) => {
    if (mood === 'nodding')    return 'nodding';
    if (mood === 'cold')       return 'cold';
    if (mood === 'interested') return 'interested';
    if (mood === 'applause')   return 'applause';
    if (mood === 'question')   return i % 3 === 0 ? 'raising' : 'neutral';
    return 'neutral';
  });
}

const PRESENTATION_CONFIG = {
  interview: { roomType: 'interview',   audienceType: 'boss',      memberCount: 4  },
  academic:  { roomType: 'audiovisual', audienceType: 'professor', memberCount: 20 },
  school:    { roomType: 'classroom',   audienceType: 'professor', memberCount: 18 },
  meeting:   { roomType: 'meeting',     audienceType: 'boss',      memberCount: 5  },
};
const DEFAULT_CONFIG = { roomType: 'classroom', audienceType: 'general', memberCount: 8 };

export default function SimPage({ simState, onStop, onCancel }) {
  const { type, audience, audienceCount, duration, sessionId } = simState;

  const config       = PRESENTATION_CONFIG[type] ?? DEFAULT_CONFIG;
  const roomType     = config.roomType;
  const audienceType = audience || config.audienceType;
  const totalSec     = duration * 60;
  const memberCount  = ['interview', 'meeting'].includes(roomType)
    ? config.memberCount
    : Math.min(audienceCount ?? config.memberCount, config.memberCount);

  // ── UI state
  const [elapsed, setElapsed]               = useState(0);
  const [wpm, setWpm]                       = useState(0);
  const [fillerCount, setFillerCount]       = useState(0);
  const [interruptCount, setInterruptCount] = useState(0);
  const [interruptLog, setInterruptLog]     = useState([]);
  const [transcriptWords, setTranscriptWords] = useState([]);
  const [interimText, setInterimText]       = useState('');
  const [audienceMoods, setAudienceMoods]   = useState(() => computeMoods('neutral', memberCount));
  const [bubbleText, setBubbleText]         = useState('');
  const [bubbleVisible, setBubbleVisible]   = useState(false);
  const [listenLabel, setListenLabel]       = useState('마이크 연결 중...');
  const [sttActive, setSttActive]           = useState(false);
  const [liveFeedback, setLiveFeedback]     = useState(null);
  const [reportToast, setReportToast]       = useState(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  // ── refs
  const startTimeRef       = useRef(Date.now());
  const transcriptRef      = useRef('');
  const wordCountRef       = useRef(0);
  const fillerCountRef     = useRef(0);
  const wpmHistoryRef      = useRef([]);
  const interruptLogRef    = useRef([]);
  const recognitionRef     = useRef(null);
  const mediaRecorderRef   = useRef(null);
  const micStreamRef       = useRef(null);
  const timerIntervalRef   = useRef(null);
  const transcriptBoxRef   = useRef(null);
  const interruptLogBoxRef = useRef(null);
  const stoppedRef         = useRef(false);
  const wsRef              = useRef(null);
  const audioRef           = useRef(null);
  const memberCountRef     = useRef(memberCount);
  const totalSecRef        = useRef(totalSec);
  const onStopRef          = useRef(onStop);
  const onCancelRef        = useRef(onCancel);
  const lastInterimRef          = useRef('');
  const lastInterimWordCountRef = useRef(0);
  const wordTimestampsRef       = useRef([]);
  onStopRef.current        = onStop;
  onCancelRef.current      = onCancel;

  // ── 텍스트 처리
  function processText(text) {
    transcriptRef.current += text + ' ';
    const words = text.trim().split(/\s+/);
    wordCountRef.current += words.length;
    wordTimestampsRef.current.push({ ts: Date.now(), count: words.length });
    words.forEach(w => {
      if (FILLERS.includes(w.replace(/[^가-힣a-z]/gi, ''))) fillerCountRef.current++;
    });
    setTranscriptWords(
      transcriptRef.current.split(/\s+/).slice(-60).map(w => ({
        text: w,
        isFiller: FILLERS.includes(w.replace(/[^가-힣a-z]/gi, '')),
      }))
    );
    setFillerCount(fillerCountRef.current);
  }

  // ── 인터럽트 표시
  function showInterrupt(question) {
    interruptLogRef.current.push(question);
    setInterruptCount(c => c + 1);
    setInterruptLog([...interruptLogRef.current]);
    setBubbleText(question);
    setBubbleVisible(true);
    setAudienceMoods(computeMoods('question', memberCountRef.current));
    setTimeout(() => setBubbleVisible(false), 12000);
  }

  // ── 발표 종료
  const stopSimRef = useRef(null);
  stopSimRef.current = function stopSim() {
    if (stoppedRef.current) return;
    stoppedRef.current = true;
    clearInterval(timerIntervalRef.current);
    if (recognitionRef.current) recognitionRef.current.stop();
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive')
      mediaRecorderRef.current.stop();
    if (micStreamRef.current) micStreamRef.current.getTracks().forEach(t => t.stop());
    if (wsRef.current)    wsRef.current.close();
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    if (sessionId)        endSession(sessionId).catch(console.error);
    onStopRef.current({
      elapsed:      Math.floor((Date.now() - startTimeRef.current) / 1000),
      transcript:   transcriptRef.current,
      wordCount:    wordCountRef.current,
      fillerCount:  fillerCountRef.current,
      wpmHistory:   wpmHistoryRef.current,
      interruptLog: interruptLogRef.current,
      sessionId,
    });
  };

  // ── 발표 취소 (기록 없이)
  const cancelSimRef = useRef(null);
  cancelSimRef.current = async function cancelSim() {
    if (stoppedRef.current) return;
    stoppedRef.current = true;
    clearInterval(timerIntervalRef.current);
    if (recognitionRef.current) recognitionRef.current.stop();
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive')
      mediaRecorderRef.current.stop();
    if (micStreamRef.current) micStreamRef.current.getTracks().forEach(t => t.stop());
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    // WS를 닫기 전에 백엔드 상태를 CANCELLED로 먼저 변경 — 순서가 바뀌면
    // WebSocketDisconnect 핸들러가 RUNNING 상태를 보고 end_session()을 실행해버림
    if (sessionId) {
      try { await cancelSession(sessionId); } catch (e) { console.error(e); }
    }
    if (wsRef.current) wsRef.current.close();
    onCancelRef.current?.();
  };

  // ── WebSocket 메시지 처리
  function handleWsMessage(msg) {
    if (stoppedRef.current) return;
    switch (msg.type) {
      case 'report_saved':
        setReportToast(`리포트가 저장되었습니다 · 점수 ${Math.round(msg.overall_score ?? 0)}점`);
        setTimeout(() => setReportToast(null), 4000);
        break;
      case 'live_metrics':
        setFillerCount(msg.filler_count ?? 0);
        break;
      case 'live_feedback':
        setLiveFeedback(msg.message);
        setTimeout(() => setLiveFeedback(null), 5000);
        break;
      case 'audience_reaction': {
        const moodMap = {
          nodding: 'nodding', cold: 'cold', interested: 'interested',
          confused: 'cold', applause: 'applause', raising: 'question',
        };
        const mood = moodMap[msg.reaction];
        if (mood) setAudienceMoods(computeMoods(mood, memberCountRef.current));
        break;
      }
      case 'interrupt_question':
        showInterrupt(msg.question_text);
        break;
      case 'tts_audio': {
        try {
          const audio = new Audio(`data:audio/${msg.format ?? 'mp3'};base64,${msg.audio_base64}`);
          audioRef.current = audio;
          audio.onended = () => {
            audioRef.current = null;
            if (wsRef.current?.readyState === WebSocket.OPEN)
              wsRef.current.send(JSON.stringify({ type: 'tts_finished', question_id: msg.question_id ?? 'q' }));
          };
          audio.play().catch(console.error);
        } catch (e) { console.error('[TTS]', e); }
        break;
      }
      case 'stop_tts':
        if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
        break;
      case 'session_state':
        console.log('[세션 상태]', msg.state);
        break;
    }
  }

  // ── 마운트 시 초기화
  useEffect(() => {
    startTimeRef.current = Date.now();

    timerIntervalRef.current = setInterval(() => {
      const s = Math.floor((Date.now() - startTimeRef.current) / 1000);
      setElapsed(s);
      if (s >= totalSecRef.current) stopSimRef.current();
      if (s % 3 === 0 && s > 0) {
        const WINDOW_MS = 10000;
        const now = Date.now();
        wordTimestampsRef.current = wordTimestampsRef.current.filter(e => e.ts >= now - WINDOW_MS);
        const windowWords = wordTimestampsRef.current.reduce((sum, e) => sum + e.count, 0);
        const raw = Math.round(windowWords / (WINDOW_MS / 60000));
        setWpm(raw);
        wpmHistoryRef.current.push(raw);
      }
    }, 1000);

    // WebSocket 연결
    startSession(sessionId)
      .then(() => { wsRef.current = connectSessionWS(sessionId, handleWsMessage); })
      .catch(console.error);

    // MediaRecorder → Deepgram audio_chunk 전송
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(stream => {
        micStreamRef.current = stream;
        const recorder = new MediaRecorder(stream);
        mediaRecorderRef.current = recorder;
        recorder.ondataavailable = async (e) => {
          if (e.data.size === 0) return;
          if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
          if (stoppedRef.current) return;
          const buf = await e.data.arrayBuffer();
          const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
          wsRef.current.send(JSON.stringify({ type: 'audio_chunk', timestamp_ms: Date.now(), audio_base64: b64 }));
        };
        recorder.start(250);
      })
      .catch(err => console.warn('[MediaRecorder]', err));

    // Web Speech API (interim 자막용)
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SR) {
      const r = new SR();
      r.lang = 'ko-KR'; r.continuous = true; r.interimResults = true;
      recognitionRef.current = r;
      r.onresult = (e) => {
        let final = '', interim = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          if (e.results[i].isFinal) final += e.results[i][0].transcript + ' ';
          else interim += e.results[i][0].transcript;
        }
        if (interim) {
          const words = interim.trim().split(/\s+/).filter(Boolean);
          const processed = lastInterimWordCountRef.current;
          // 마지막 단어는 아직 입력 중일 수 있으므로 그 앞까지만 확정
          if (words.length - 1 > processed) {
            processText(words.slice(processed, words.length - 1).join(' '));
            lastInterimWordCountRef.current = words.length - 1;
          }
          // 현재 입력 중인 단어만 회색으로 표시
          setInterimText(words[words.length - 1] || '');
          lastInterimRef.current = interim;
        }
        if (final) {
          const finalWords = final.trim().split(/\s+/).filter(Boolean);
          const processed = lastInterimWordCountRef.current;
          if (finalWords.length > processed) {
            processText(finalWords.slice(processed).join(' '));
          }
          setInterimText('');
          lastInterimRef.current = '';
          lastInterimWordCountRef.current = 0;
          if (wsRef.current?.readyState === WebSocket.OPEN)
            wsRef.current.send(JSON.stringify({ type: 'partial_transcript', text: final.trim(), is_final: true, timestamp_ms: Date.now() }));
        }
      };
      r.onerror = (err) => { console.warn('[STT]', err.error); setListenLabel('마이크 오류'); setSttActive(false); };
      r.onend   = () => { if (!stoppedRef.current) r.start(); };
      r.start();
      setListenLabel('음성 인식 중...');
      setSttActive(true);
    } else {
      setListenLabel('STT 미지원 브라우저');
    }

    return () => {
      stoppedRef.current = true;
      clearInterval(timerIntervalRef.current);
      if (recognitionRef.current) recognitionRef.current.stop();
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive')
        mediaRecorderRef.current.stop();
      if (micStreamRef.current) micStreamRef.current.getTracks().forEach(t => t.stop());
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (transcriptBoxRef.current)
      transcriptBoxRef.current.scrollTop = transcriptBoxRef.current.scrollHeight;
  }, [transcriptWords]);

  useEffect(() => {
    if (interruptLogBoxRef.current)
      interruptLogBoxRef.current.scrollTop = interruptLogBoxRef.current.scrollHeight;
  }, [interruptLog]);

  // ── 파생값
  const remaining = totalSec - elapsed;
  const timerPct  = Math.max(0, (remaining / totalSec) * 100);
  const isUrgent  = remaining < 30;
  const mm        = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const ss        = String(elapsed % 60).padStart(2, '0');
  const remMm     = String(Math.floor(Math.max(0, remaining) / 60)).padStart(2, '0');
  const remSs     = String(Math.max(0, remaining) % 60).padStart(2, '0');
  const wpmPct    = Math.min(wpm / 200, 1) * 100;
  const wpmColor  = wpm === 0 ? '' : wpm < 80 || wpm > 160 ? 'stat-val--red' : 'stat-val--green';

  return (
    <div className="sim-page">
      {/* NAV */}
      <nav className="nav">
        <div className="nav-logo">
          <div className="logo-icon">{LOGO}</div>
          <span className="logo-text">SpeechLab</span>
        </div>
        <div className="nav-right">
          <div className="nav-rec">
            <span className="nav-rec-dot" />
            REC {mm}:{ss}
          </div>
        </div>
      </nav>

      <div className="sim-body">
        {/* 스테이지 */}
        <div className={`sim-stage ${roomType}`}>
          <div className={`interrupt-bubble${bubbleVisible ? ' interrupt-bubble--show' : ''}`}>
            <div className="interrupt-bubble__from">돌발 질문</div>
            <div style={{ fontSize: 14, color: 'var(--ink)', lineHeight: 1.5, fontWeight: 500 }}>{bubbleText}</div>
          </div>
          <AudienceSimulator
            roomType={roomType}
            audienceType={audienceType}
            count={memberCount}
            memberMoods={audienceMoods}
          />
        </div>

        {/* HUD */}
        <div className="hud">
          {/* 타이머 */}
          <div className="hud-section">
            <div className="hud__title">진행 시간</div>
            <div className="timer-bar">
              <div className={`timer-bar__fill${isUrgent ? ' timer-bar__fill--urgent' : ''}`}
                style={{ width: `${timerPct}%` }} />
            </div>
            <div className="timer-meta">
              <span className="timer-meta__text">남은 시간 {remMm}:{remSs}</span>
              <span className="timer-meta__text">{mm}:{ss} 경과</span>
            </div>
          </div>

          {/* STT */}
          <div className="hud-section">
            <div className="listening-indicator">
              <div className={`dot${sttActive ? ' dot--active' : ''}`} />
              <span style={{ fontSize: 12, color: 'var(--ink2)' }}>{listenLabel}</span>
            </div>
            {liveFeedback && <div className="live-feedback" style={{ marginTop: 10 }}>{liveFeedback}</div>}
          </div>

          {/* WPM */}
          <div className="hud-section">
            <div className="hud__title">실시간 지표</div>
            <div className="stat-block">
              <div className={`stat-val ${wpmColor}`}>{wpm}</div>
              <div className="stat-label">WPM · 말하기 속도</div>
              <div className="wpm-bar-wrap">
                <div className="wpm-bar" style={{ width: `${wpmPct}%` }} />
              </div>
            </div>
          </div>

          {/* 필러·인터럽트 */}
          <div className="hud-section">
            <div className="stat-block__grid">
              <div className="stat-block">
                <div className="stat-val stat-val--red">{fillerCount}</div>
                <div className="stat-label">필러 단어</div>
              </div>
              <div className="stat-block">
                <div className="stat-val stat-val--blue">{interruptCount}</div>
                <div className="stat-label">인터럽트</div>
              </div>
            </div>
          </div>

          {/* 발화 텍스트 */}
          <div className="hud-section">
            <div className="hud__title">발화 텍스트</div>
            <div className="transcript-box" ref={transcriptBoxRef}>
              {transcriptWords.length === 0 && !interimText
                ? <span>대기 중...</span>
                : <>
                    {transcriptWords.map((w, i) => (
                      <span key={i} className={w.isFiller ? 'transcript-box__filler' : 'transcript-box__word'}>{w.text} </span>
                    ))}
                    {interimText && <span className="transcript-box__interim">{interimText}</span>}
                  </>
              }
            </div>
          </div>

          {/* 인터럽트 로그 */}
          {interruptLog.length > 0 && (
            <div className="hud-section">
              <div className="hud__title">질문 기록</div>
              <div className="interrupt-log" ref={interruptLogBoxRef}>
                {interruptLog.map((q, i) => (
                  <div key={i} className="log-item">
                    <span style={{ fontWeight: 600, color: 'var(--red)' }}>Q{i + 1} </span>{q}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 버튼 */}
          <div className="hud-section" style={{ marginTop: 'auto' }}>
            <button className="btn-stop" onClick={() => stopSimRef.current()}>발표 종료</button>
            {onCancel && (
              <button
                onClick={() => setShowCancelConfirm(true)}
                style={{
                  width: '100%', marginTop: 8, padding: '9px', borderRadius: 6,
                  background: 'transparent', border: '1px solid var(--border2)',
                  color: 'var(--ink3)', fontSize: 12, cursor: 'pointer',
                  fontFamily: 'var(--sans)',
                }}
              >
                발표 취소 (기록 없음)
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 리포트 저장 완료 토스트 */}
      {reportToast && (
        <div style={{
          position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--green-s)', border: '1px solid rgba(5,150,105,0.25)',
          color: 'var(--green)', padding: '12px 20px', borderRadius: 8,
          fontSize: 13, fontWeight: 600, zIndex: 999,
          boxShadow: '0 4px 16px rgba(5,150,105,0.15)',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          ✓ {reportToast}
        </div>
      )}

      {/* 취소 확인 모달 */}
      {showCancelConfirm && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999,
        }}>
          <div style={{
            background: 'white', borderRadius: 12, padding: '28px 32px',
            width: 320, boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
          }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>발표를 취소할까요?</div>
            <div style={{ fontSize: 13, color: 'var(--ink2)', marginBottom: 24, lineHeight: 1.6 }}>
              지금까지의 기록이 저장되지 않습니다.<br />설정 화면으로 돌아갑니다.
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setShowCancelConfirm(false)}
                style={{
                  flex: 1, padding: '10px', borderRadius: 7, fontSize: 13,
                  border: '1px solid var(--border2)', background: 'white',
                  cursor: 'pointer', fontFamily: 'var(--sans)', fontWeight: 500,
                }}
              >계속 발표</button>
              <button
                onClick={() => cancelSimRef.current?.()}
                style={{
                  flex: 1, padding: '10px', borderRadius: 7, fontSize: 13,
                  border: 'none', background: 'var(--red)', color: 'white',
                  cursor: 'pointer', fontFamily: 'var(--sans)', fontWeight: 700,
                }}
              >취소하기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}