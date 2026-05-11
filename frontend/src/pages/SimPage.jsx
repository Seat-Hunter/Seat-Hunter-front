import { useEffect, useRef, useState } from 'react';
import './SimPage.css';
import AudienceSimulator from './AudienceSimulator';
import { generateInterruptQuestion, startSession, endSession, connectSessionWS } from '../services/claudeApi';

// ── 상수 ───────────────────────────────────────────────
const FILLERS = ['어', '음', '그', '저', '뭐', '그냥', '좀', '아', '에', '이'];
const INTERRUPT_INTERVALS = { easy: 90, medium: 50, hard: 30, brutal: 18 };

const DEMO_TEXTS = [
  '안녕하세요, 저는 오늘 저희 서비스에 대해 발표하겠습니다.',
  '저희 서비스는 AI 기반 스피치 코칭 플랫폼으로서,',
  '어, 실시간으로 사용자의 발표를 분석하고 피드백을 제공합니다.',
  '주요 기능은 세 가지입니다. 첫째로 음성 분석, 둘째로 AI 인터럽트, 셋째로 종합 리포트입니다.',
  '음, 특히 실시간 STT와 LLM을 결합하여 자연스러운 압박 상황을 만들어냅니다.',
  '시장 규모는 연간 2조원 이상으로 추정되며, 성장률은 매년 15% 이상입니다.',
  '저희의 차별점은 단순 분석을 넘어 실제 압박 상황을 시뮬레이션한다는 점입니다.',
  '그, 이를 통해 사용자는 실전 경험을 쌓을 수 있습니다.',
  '비즈니스 모델은 SaaS 구독 형태이며, B2C와 B2B 두 가지 채널로 공략합니다.',
  '감사합니다. 질문 있으시면 말씀해주세요.',
];

// ── mood 배열 생성 ─────────────────────────────────────
// AudienceSimulator가 받는 memberMoods: string[] 형태
// null → 'neutral' 로 처리
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

// ── 발표 유형 → 장소 + 청중 자동 매핑 ────────────────────
// simState.type 값 기준:
//   'interview' : 면접      → 인터뷰실  + 상사
//   'academic'  : 학술발표  → 시청각실  + 교수
//   'school'    : 학교 발표 → 강의실    + 교수
//   'meeting'   : 회의      → 회의실    + 상사
const PRESENTATION_CONFIG = {
  interview: { roomType: 'interview',   audienceType: 'boss',      memberCount: 4  },
  academic:  { roomType: 'audiovisual', audienceType: 'professor', memberCount: 20 },
  school:    { roomType: 'classroom',   audienceType: 'professor', memberCount: 18 },
  meeting:   { roomType: 'meeting',     audienceType: 'boss',      memberCount: 5  },
};
const DEFAULT_CONFIG = { roomType: 'classroom', audienceType: 'general', memberCount: 8 };

export default function SimPage({ simState, onStop }) {
  const {
    type, audience, audienceCount, difficulty, duration,
    interrupt: interruptOn, sessionId, demoMode,
  } = simState;

  // 발표 유형으로 환경 자동 결정
  const config       = PRESENTATION_CONFIG[type] ?? DEFAULT_CONFIG;
  const roomType     = config.roomType;
  const audienceType = audience || config.audienceType;

  const totalSec = duration * 60;
  // 고정 인원 장소(interview=4, meeting=5)는 config.memberCount 우선
  // 그 외엔 simState.audienceCount 사용
  const memberCount = ['interview', 'meeting'].includes(roomType)
    ? config.memberCount
    : Math.min(audienceCount ?? config.memberCount, config.memberCount);

  // ── UI state
  const [elapsed, setElapsed]                 = useState(0);
  const [wpm, setWpm]                         = useState(0);
  const [fillerCount, setFillerCount]         = useState(0);
  const [interruptCount, setInterruptCount]   = useState(0);
  const [interruptLog, setInterruptLog]       = useState([]);
  const [transcriptWords, setTranscriptWords] = useState([]);
  const [interimText, setInterimText]         = useState('');
  const [audienceMoods, setAudienceMoods]     = useState(() => computeMoods('neutral', memberCount));
  const [bubbleText, setBubbleText]           = useState('');
  const [bubbleVisible, setBubbleVisible]     = useState(false);
  const [listenLabel, setListenLabel]         = useState('마이크 듣는 중...');
  const [liveFeedback, setLiveFeedback]       = useState(null);

  // ── 런타임 refs
  const startTimeRef         = useRef(Date.now());
  const transcriptRef        = useRef('');
  const wordCountRef         = useRef(0);
  const fillerCountRef       = useRef(0);
  const wpmHistoryRef        = useRef([]);
  const interruptLogRef      = useRef([]);
  const interruptPendingRef  = useRef(false);
  const interruptCooldownRef = useRef(false);
  const recognitionRef       = useRef(null);
  const demoTimerRef         = useRef(null);
  const demoIdxRef           = useRef(0);
  const timerIntervalRef     = useRef(null);
  const transcriptBoxRef     = useRef(null);
  const interruptLogBoxRef   = useRef(null);
  const stoppedRef           = useRef(false);
  const wsRef                = useRef(null);
  const audioRef             = useRef(null);

  // ── prop refs
  const onStopRef       = useRef(onStop);
  const interruptOnRef  = useRef(interruptOn);
  const audienceRef     = useRef(audience);
  const typeRef         = useRef(type);
  const difficultyRef   = useRef(difficulty);
  const memberCountRef  = useRef(memberCount);
  const totalSecRef     = useRef(totalSec);
  const sessionIdRef    = useRef(sessionId);
  onStopRef.current      = onStop;
  interruptOnRef.current = interruptOn;

  // ── 텍스트 처리
  function processNewText(text) {
    transcriptRef.current += text;

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'partial_transcript',
        text,
        is_final: true,
        timestamp_ms: Date.now(),
      }));
    }

    const words = text.trim().split(/\s+/);
    wordCountRef.current += words.length;

    words.forEach(w => {
      const clean = w.replace(/[^가-힣a-z]/gi, '');
      if (FILLERS.includes(clean)) fillerCountRef.current++;
    });

    const allWords = transcriptRef.current.split(/\s+/).slice(-60);
    const parsed = allWords.map(w => {
      const clean = w.replace(/[^가-힣a-z]/gi, '');
      return { text: w, isFiller: FILLERS.includes(clean) };
    });
    setTranscriptWords(parsed);
    setFillerCount(fillerCountRef.current);

    const elapsedMin = (Date.now() - startTimeRef.current) / 60000;
    const currentWpm = elapsedMin > 0 ? Math.round(wordCountRef.current / elapsedMin) : 0;
    wpmHistoryRef.current.push(currentWpm);
    setWpm(currentWpm);

    // 백엔드 WS 없을 때 로컬로 청중 반응 결정
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      const count = memberCountRef.current;
      if (currentWpm > 80 && currentWpm < 160 && fillerCountRef.current < 5) {
        setAudienceMoods(computeMoods('nodding', count));
      } else if (currentWpm > 160 || fillerCountRef.current > 8) {
        setAudienceMoods(computeMoods('cold', count));
      } else {
        setAudienceMoods(computeMoods('interested', count));
      }
    }
  }

  // ── 종료
  const stopSimRef = useRef(null);
  stopSimRef.current = function stopSim() {
    if (stoppedRef.current) return;
    stoppedRef.current = true;

    interruptPendingRef.current  = false;
    interruptCooldownRef.current = false;
    clearInterval(timerIntervalRef.current);
    if (recognitionRef.current) recognitionRef.current.stop();
    if (demoTimerRef.current)   clearInterval(demoTimerRef.current);
    if (wsRef.current)          wsRef.current.close();
    if (audioRef.current)       { audioRef.current.pause(); audioRef.current = null; }

    if (sessionIdRef.current) {
      endSession(sessionIdRef.current).catch(console.error);
    }

    onStopRef.current({
      elapsed:      Math.floor((Date.now() - startTimeRef.current) / 1000),
      transcript:   transcriptRef.current,
      wordCount:    wordCountRef.current,
      fillerCount:  fillerCountRef.current,
      wpmHistory:   wpmHistoryRef.current,
      interruptLog: interruptLogRef.current,
    });
  };

  // ── 인터럽트
  const maybeInterruptRef = useRef(null);
  maybeInterruptRef.current = async function maybeInterrupt() {
    if (!interruptOnRef.current) return;
    if (interruptCooldownRef.current || interruptPendingRef.current) return;
    if (transcriptRef.current.length < 80) return;
    if (stoppedRef.current) return;

    interruptPendingRef.current  = true;
    interruptCooldownRef.current = true;

    let question = null;
    try {
      question = await generateInterruptQuestion({
        audience:   audienceRef.current,
        type:       typeRef.current,
        difficulty: difficultyRef.current,
        context:    transcriptRef.current.slice(-400),
      });
    } catch {
      interruptPendingRef.current  = false;
      interruptCooldownRef.current = false;
      return;
    }

    if (!question || stoppedRef.current) {
      interruptPendingRef.current  = false;
      interruptCooldownRef.current = false;
      return;
    }

    interruptLogRef.current.push(question);
    setInterruptCount(c => c + 1);
    setInterruptLog([...interruptLogRef.current]);
    setBubbleText(question);
    setBubbleVisible(true);
    setAudienceMoods(computeMoods('question', memberCountRef.current));

    setTimeout(() => {
      setBubbleVisible(false);
      interruptPendingRef.current = false;
    }, 12000);

    setTimeout(() => {
      interruptCooldownRef.current = false;
    }, INTERRUPT_INTERVALS[difficultyRef.current] * 1000);
  };

  // ── 데모 모드
  function startDemo() {
    setListenLabel('데모 모드 (마이크 없음)');
    demoTimerRef.current = setInterval(() => {
      if (demoIdxRef.current < DEMO_TEXTS.length && !stoppedRef.current) {
        processNewText(DEMO_TEXTS[demoIdxRef.current++]);
      }
    }, 4000);
  }

  // ── WebSocket 연결
  useEffect(() => {
    if (!sessionId) return;

    startSession(sessionId)
      .then(() => {
        const ws = connectSessionWS(sessionId, (msg) => {
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
              // 백엔드 reaction → computeMoods mood 키로 매핑
              const moodMap = {
                nodding:    'nodding',
                cold:       'cold',
                interested: 'interested',
                confused:   'cold',
                applause:   'applause',
                raising:    'question',
              };
              const mood = moodMap[msg.reaction];
              if (mood) setAudienceMoods(computeMoods(mood, memberCountRef.current));
              break;
            }

            case 'interrupt_question':
              interruptLogRef.current.push(msg.question_text);
              setInterruptCount(c => c + 1);
              setInterruptLog([...interruptLogRef.current]);
              setBubbleText(msg.question_text);
              setBubbleVisible(true);
              setAudienceMoods(computeMoods('question', memberCountRef.current));
              setTimeout(() => setBubbleVisible(false), 12000);
              break;

            case 'tts_audio': {
              try {
                const audio = new Audio(`data:audio/${msg.format ?? 'mp3'};base64,${msg.audio_base64}`);
                audioRef.current = audio;
                audio.onended = () => {
                  audioRef.current = null;
                  if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ type: 'tts_finished', question_id: msg.question_id ?? 'q' }));
                  }
                };
                audio.play().catch(console.error);
              } catch (e) {
                console.error('[TTS] 재생 오류:', e);
              }
              break;
            }

            case 'stop_tts':
              if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
              }
              break;

            case 'session_state':
              console.log('[세션 상태]', msg.state);
              break;
          }
        });
        wsRef.current = ws;
      })
      .catch(console.error);

    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 마운트 시 1회 실행 (타이머 + 음성인식)
  // ── 마운트 시 1회 실행 (타이머 + 음성인식)
  useEffect(() => {
    startTimeRef.current = Date.now();

    timerIntervalRef.current = setInterval(() => {
      const elapsedSec = Math.floor((Date.now() - startTimeRef.current) / 1000);
      setElapsed(elapsedSec);
      if (elapsedSec >= totalSecRef.current) {
        stopSimRef.current();
        return;
      }
      if (elapsedSec > 0 && elapsedSec % 5 === 0) {
        maybeInterruptRef.current();
      }
    }, 1000);

    if (demoMode) {
      startDemo();
    } else {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SR) {
        const r = new SR();
        r.lang = 'ko-KR';
        r.continuous = true;
        r.interimResults = true;
        recognitionRef.current = r;
        r.onresult = (e) => {
          let final = '';
          let interim = '';
          for (let i = e.resultIndex; i < e.results.length; i++) {
            if (e.results[i].isFinal) final += e.results[i][0].transcript + ' ';
            else interim += e.results[i][0].transcript;
          }
          if (final) {
            setInterimText('');
            processNewText(final);
          }
          if (interim) setInterimText(interim);
        };
        r.onerror = () => startDemo();
        r.onend   = () => { if (!stoppedRef.current) r.start(); };
        r.start();
      } else {
        startDemo();
      }
    }

    return () => {
      stoppedRef.current = true;
      clearInterval(timerIntervalRef.current);
      if (recognitionRef.current) recognitionRef.current.stop();
      if (demoTimerRef.current)   clearInterval(demoTimerRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 스크롤
  useEffect(() => {
    if (transcriptBoxRef.current)
      transcriptBoxRef.current.scrollTop = transcriptBoxRef.current.scrollHeight;
  }, [transcriptWords]);

  useEffect(() => {
    if (interruptLogBoxRef.current)
      interruptLogBoxRef.current.scrollTop = interruptLogBoxRef.current.scrollHeight;
  }, [interruptLog]);

  // ── 파생 값
  const remaining = totalSec - elapsed;
  const timerPct  = Math.max(0, (remaining / totalSec) * 100);
  const isUrgent  = remaining < 30;
  const mm        = String(Math.floor(elapsed / 60));
  const ss        = String(elapsed % 60).padStart(2, '0');
  const wpmPct    = Math.min(wpm / 200, 1) * 100;
  const wpmColor  = wpm < 80 || wpm > 160 ? 'stat-val--red' : 'stat-val--green';

  return (
    <div className="sim-page">
      {/* ── 스테이지 ── */}
      {/*
        sim-stage에 roomType 클래스를 추가해서
        AudienceSimulator.css의 배경 스타일이 적용됨
        예: className="sim-stage classroom"
      */}
      <div className={`sim-stage ${roomType}`}>

        {/* 인터럽트 말풍선 */}
        <div className={`interrupt-bubble${bubbleVisible ? ' interrupt-bubble--show' : ''}`}>
          <div className="interrupt-bubble__from">청중 질문</div>
          {bubbleText}
        </div>

        {/*
          AudienceSimulator:
          - roomType: 장소 ('interview'|'audiovisual'|'classroom'|'meeting')
          - audienceType: 청중 유형 ('professor'|'investor'|'boss'|'general')
          - count: 인원 수
          - memberMoods: 각 멤버 mood 배열 — computeMoods()로 생성된 string[]
            예: ['nodding','nodding','cold','neutral',...]
        */}
        <AudienceSimulator
          roomType={roomType}
          audienceType={audienceType}
          count={memberCount}
          memberMoods={audienceMoods}
        />
      </div>

      {/* ── HUD ── */}
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

        {liveFeedback && (
          <div className="live-feedback">{liveFeedback}</div>
        )}

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
                {interimText && (
                  <span className="transcript-box__interim">{interimText}</span>
                )}
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
