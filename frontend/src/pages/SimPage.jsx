import { useEffect, useRef, useState } from 'react';
import './SimPage.css';
import AudienceSimulator from './AudienceSimulator';
import { startSession, endSession, connectSessionWS } from '../services/claudeApi';

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

export default function SimPage({ simState, onStop }) {
  const { type, audience, audienceCount, duration, sessionId } = simState;

  const config       = PRESENTATION_CONFIG[type] ?? DEFAULT_CONFIG;
  const roomType     = config.roomType;
  const audienceType = audience || config.audienceType;
  const totalSec     = duration * 60;
  const memberCount  = ['interview', 'meeting'].includes(roomType)
    ? config.memberCount
    : Math.min(audienceCount ?? config.memberCount, config.memberCount);

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
  const [liveFeedback, setLiveFeedback]     = useState(null);

  const startTimeRef       = useRef(Date.now());
  const transcriptRef      = useRef('');
  const wordCountRef       = useRef(0);
  const fillerCountRef     = useRef(0);
  const wpmHistoryRef      = useRef([]);
  const interruptLogRef    = useRef([]);
  const recognitionRef     = useRef(null);
  const timerIntervalRef   = useRef(null);
  const transcriptBoxRef   = useRef(null);
  const interruptLogBoxRef = useRef(null);
  const stoppedRef         = useRef(false);
  const wsRef              = useRef(null);
  const audioRef           = useRef(null);
  const memberCountRef     = useRef(memberCount);
  const totalSecRef        = useRef(totalSec);
  const onStopRef          = useRef(onStop);
  onStopRef.current        = onStop;

  function processText(text) {
    transcriptRef.current += text + ' ';
    const words = text.trim().split(/\s+/);
    wordCountRef.current += words.length;
    words.forEach(w => {
      if (FILLERS.includes(w.replace(/[^가-힣a-z]/gi, '')))
        fillerCountRef.current++;
    });
    setTranscriptWords(
      transcriptRef.current.split(/\s+/).slice(-60).map(w => ({
        text: w,
        isFiller: FILLERS.includes(w.replace(/[^가-힣a-z]/gi, '')),
      }))
    );
    setFillerCount(fillerCountRef.current);
    const elapsedMin = (Date.now() - startTimeRef.current) / 60000;
    const currentWpm = elapsedMin > 0 ? Math.round(wordCountRef.current / elapsedMin) : 0;
    wpmHistoryRef.current.push(currentWpm);
    setWpm(currentWpm);
  }

  function showInterrupt(question) {
    interruptLogRef.current.push(question);
    setInterruptCount(c => c + 1);
    setInterruptLog([...interruptLogRef.current]);
    setBubbleText(question);
    setBubbleVisible(true);
    setAudienceMoods(computeMoods('question', memberCountRef.current));
    setTimeout(() => setBubbleVisible(false), 12000);
  }

  const stopSimRef = useRef(null);
  stopSimRef.current = function stopSim() {
    if (stoppedRef.current) return;
    stoppedRef.current = true;
    clearInterval(timerIntervalRef.current);
    if (recognitionRef.current) recognitionRef.current.stop();
    if (wsRef.current)          wsRef.current.close();
    if (audioRef.current)       { audioRef.current.pause(); audioRef.current = null; }
    if (sessionId)              endSession(sessionId).catch(console.error);
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

  function handleWsMessage(msg) {
    if (stoppedRef.current) return;
    switch (msg.type) {
      case 'live_metrics':
        setWpm(msg.wpm ?? 0);
        setFillerCount(msg.filler_count ?? 0);
        break;
      case 'live_feedback':
        setLiveFeedback(msg.message);
        setTimeout(() => setLiveFeedback(null), 5000);
        break;
      case 'audience_reaction': {
        const moodMap = {
          nodding: 'nodding', cold: 'cold', interested: 'interested',
          confused: 'cold',   applause: 'applause', raising: 'question',
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
            if (wsRef.current?.readyState === WebSocket.OPEN) {
              wsRef.current.send(JSON.stringify({
                type: 'tts_finished',
                question_id: msg.question_id ?? 'q',
              }));
            }
          };
          audio.play().catch(console.error);
        } catch (e) {
          console.error('[TTS] 재생 오류:', e);
        }
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

  useEffect(() => {
    startTimeRef.current = Date.now();

    timerIntervalRef.current = setInterval(() => {
      const elapsedSec = Math.floor((Date.now() - startTimeRef.current) / 1000);
      setElapsed(elapsedSec);
      if (elapsedSec >= totalSecRef.current) stopSimRef.current();
    }, 1000);

    // WebSocket 연결
    startSession(sessionId)
      .then(() => {
        const ws = connectSessionWS(sessionId, handleWsMessage);
        wsRef.current = ws;
      })
      .catch(console.error);

    // Web Speech API STT
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SR) {
      const r = new SR();
      r.lang           = 'ko-KR';
      r.continuous     = true;
      r.interimResults = true;
      recognitionRef.current = r;
      r.onresult = (e) => {
        let final = '', interim = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          if (e.results[i].isFinal) final += e.results[i][0].transcript + ' ';
          else interim += e.results[i][0].transcript;
        }
        if (final) {
          setInterimText('');
          processText(final);
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
              type: 'partial_transcript', text: final.trim(),
              is_final: true, timestamp_ms: Date.now(),
            }));
          }
        }
        if (interim) setInterimText(interim);
      };
      r.onerror = (err) => {
        console.warn('[STT] 오류:', err.error);
        setListenLabel('마이크 오류');
      };
      r.onend = () => { if (!stoppedRef.current) r.start(); };
      r.start();
      setListenLabel('마이크 듣는 중...');
    } else {
      setListenLabel('STT 미지원 브라우저');
    }

    return () => {
      stoppedRef.current = true;
      clearInterval(timerIntervalRef.current);
      if (recognitionRef.current) recognitionRef.current.stop();
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

  const remaining = totalSec - elapsed;
  const timerPct  = Math.max(0, (remaining / totalSec) * 100);
  const isUrgent  = remaining < 30;
  const mm        = String(Math.floor(elapsed / 60));
  const ss        = String(elapsed % 60).padStart(2, '0');
  const wpmPct    = Math.min(wpm / 200, 1) * 100;
  const wpmColor  = wpm < 80 || wpm > 160 ? 'stat-val--red' : 'stat-val--green';

  return (
    <div className="sim-page">
      <div className={`sim-stage ${roomType}`}>
        <div className={`interrupt-bubble${bubbleVisible ? ' interrupt-bubble--show' : ''}`}>
          <div className="interrupt-bubble__from">청중 질문</div>
          {bubbleText}
        </div>
        <AudienceSimulator
          roomType={roomType}
          audienceType={audienceType}
          count={memberCount}
          memberMoods={audienceMoods}
        />
      </div>

      <div className="hud">
        <div className="hud__title">// 실시간 분석</div>
        <div className="listening-indicator">
          <div className="dot dot--active" />
          <span>{listenLabel}</span>
        </div>
        <div>
          <div className="timer-bar">
            <div
              className={`timer-bar__fill${isUrgent ? ' timer-bar__fill--urgent' : ''}`}
              style={{ width: `${timerPct}%` }}
            />
          </div>
          <div className="timer-meta">
            <span className="timer-meta__text">경과</span>
            <span className="timer-meta__text">{mm}:{ss}</span>
          </div>
        </div>
        <div className="stat-block">
          <div className={`stat-val ${wpmColor}`}>{wpm}</div>
          <div className="stat-label">WPM // 말하기 속도</div>
          <div className="wpm-bar-wrap">
            <div className="wpm-bar" style={{ width: `${wpmPct}%` }} />
          </div>
        </div>
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
        {liveFeedback && <div className="live-feedback">{liveFeedback}</div>}
        <div>
          <div className="hud__title">// 발화 텍스트</div>
          <div className="transcript-box" ref={transcriptBoxRef}>
            {transcriptWords.length === 0 && !interimText ? (
              <span>대기 중...</span>
            ) : (
              <>
                {transcriptWords.map((w, i) => (
                  <span key={i} className={w.isFiller ? 'transcript-box__filler' : 'transcript-box__word'}>
                    {w.text}{' '}
                  </span>
                ))}
                {interimText && <span className="transcript-box__interim">{interimText}</span>}
              </>
            )}
          </div>
        </div>
        <div>
          <div className="hud__title" style={{ marginBottom: '8px' }}>// 인터럽트 기록</div>
          <div className="interrupt-log" ref={interruptLogBoxRef}>
            {interruptLog.map((q, i) => (
              <div key={i} className="log-item">Q{i + 1}: {q}</div>
            ))}
          </div>
        </div>
        <button className="btn-stop" onClick={() => stopSimRef.current()}>발표 종료</button>
      </div>
    </div>
  );
}
