import { useEffect, useRef, useState } from 'react';
import './SimPage.css';
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
// nodding   : 전체 끄덕임
// cold      : 전체 파란색
// interested: 전체 빨간색
// question  : 랜덤 1명만 raising (초록), 나머지 null
// applause  : 전체 박수 (금색)
// neutral   : 전체 null
function computeMoods(mood, count) {
  if (mood === 'question') {
    const idx = Math.floor(Math.random() * count);
    return Array.from({ length: count }, (_, i) => i === idx ? 'raising' : null);
  }
  if (mood === 'applause') {
    return Array.from({ length: count }, () => 'applause');
  }
  return Array.from({ length: count }, () => {
    if (mood === 'nodding')    return 'nodding';
    if (mood === 'cold')       return 'cold';
    if (mood === 'interested') return 'interested';
    return null;
  });
}

// ── mood 지속시간 규칙 ─────────────────────────────────
// nodding   : 1.5초 후 neutral 복귀
// applause  : 2초 후 neutral 복귀 (stopSim에서 직접 처리)
// raising   : tts_finished / stop_tts 시 neutral 복귀
// cold      : 다음 mood 올 때까지 유지
// interested: 다음 mood 올 때까지 유지
const MOOD_DURATION = {
  nodding:  1500,
  applause: 2000,
};

function AudienceMember({ mood }) {
  const cls = ['audience-member', mood ? `audience-member--${mood}` : ''].join(' ');
  return (
    <div className={cls}>
      <div className="audience-member__head" />
      <div className="audience-member__body" />
    </div>
  );
}

export default function SimPage({ simState, onStop }) {
  const { type, audience, audienceCount, difficulty, duration, interrupt: interruptOn, sessionId, demoMode } = simState;

  const totalSec    = duration * 60;
  const memberCount = Math.min(audienceCount, 20);

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
  const [bubbleResolved, setBubbleResolved]   = useState(false);
  const [listenLabel, setListenLabel]         = useState('마이크 듣는 중...');
  const [liveFeedback, setLiveFeedback]       = useState(null);
  const [demoCurrentText, setDemoCurrentText] = useState('');

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
  const moodTimerRef         = useRef(null);
  const interimConfirmedRef  = useRef('');    // interim에서 이미 확정 처리한 텍스트
  const currentMoodRef       = useRef('neutral'); // 현재 베이스 mood 추적
  const isDemoRef            = useRef(demoMode);  // 데모 모드 여부 (prop으로 초기화)

  // ── 베이스 mood 적용 (전체 청중)
  const applyMoodRef = useRef(null);
  applyMoodRef.current = function applyMood(mood) {
    if (mood === 'question') return; // question은 applyQuestion으로만
    if (moodTimerRef.current) clearTimeout(moodTimerRef.current);
    currentMoodRef.current = mood;
    setAudienceMoods(computeMoods(mood, memberCountRef.current));
    if (MOOD_DURATION[mood]) {
      moodTimerRef.current = setTimeout(() => {
        currentMoodRef.current = 'neutral';
        setAudienceMoods(computeMoods('neutral', memberCountRef.current));
      }, MOOD_DURATION[mood]);
    }
  };

  // ── 질문 적용 (현재 mood 유지하면서 랜덤 1명만 raising)
  const applyQuestionRef = useRef(null);
  applyQuestionRef.current = function applyQuestion() {
    const count = memberCountRef.current;
    const idx = Math.floor(Math.random() * count);
    setAudienceMoods(computeMoods(currentMoodRef.current, count).map(
      (m, i) => i === idx ? 'raising' : m
    ));
  };

  // ── 질문 종료 후 현재 mood로 복귀
  const clearQuestionRef = useRef(null);
  clearQuestionRef.current = function clearQuestion() {
    setAudienceMoods(computeMoods(currentMoodRef.current, memberCountRef.current));
  };

  // ── prop refs
  const onStopRef      = useRef(onStop);
  const interruptOnRef = useRef(interruptOn);
  const audienceRef    = useRef(audience);
  const typeRef        = useRef(type);
  const difficultyRef  = useRef(difficulty);
  const memberCountRef = useRef(memberCount);
  const totalSecRef    = useRef(totalSec);
  const sessionIdRef   = useRef(sessionId);
  onStopRef.current      = onStop;
  interruptOnRef.current = interruptOn;

  // ── 텍스트 처리
  function processNewText(text) {
    transcriptRef.current += text;

    // 데모 모드에선 백엔드로 transcript 전송 안 함 (인터럽트 판단 방지)
    if (!isDemoRef.current && wsRef.current?.readyState === WebSocket.OPEN) {
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

    // 실행 모드에서 transcriptWords는 백엔드 final_transcript로만 업데이트
    // 데모 모드에서만 로컬에서 직접 업데이트
    if (isDemoRef.current) {
      const allWords = transcriptRef.current.split(/\s+/).slice(-60);
      const parsed = allWords.map(w => {
        const clean = w.replace(/[^가-힣a-z]/gi, '');
        return { text: w, isFiller: FILLERS.includes(clean) };
      });
      setTranscriptWords(parsed);
    }
    setFillerCount(fillerCountRef.current);

    const elapsedMin = (Date.now() - startTimeRef.current) / 60000;
    const currentWpm = elapsedMin > 0 ? Math.round(wordCountRef.current / elapsedMin) : 0;
    wpmHistoryRef.current.push(currentWpm);
    setWpm(currentWpm);

    // 데모 모드에선 시나리오가 mood 담당 / 백엔드 WS 없을 때만 로컬 계산
    if (!isDemoRef.current && (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN)) {
      if (currentWpm > 80 && currentWpm < 160 && fillerCountRef.current < 5) {
        applyMoodRef.current('nodding');
      } else if (currentWpm > 160 || fillerCountRef.current > 8) {
        applyMoodRef.current('cold');
      } else {
        applyMoodRef.current('interested');
      }
    }
  }

  // ── 종료
  const stopSimRef = useRef(null);
  stopSimRef.current = function stopSim(withApplause = false) {
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

    const reportData = {
      elapsed:      Math.floor((Date.now() - startTimeRef.current) / 1000),
      transcript:   transcriptRef.current,
      wordCount:    wordCountRef.current,
      fillerCount:  fillerCountRef.current,
      wpmHistory:   wpmHistoryRef.current,
      interruptLog: interruptLogRef.current,
    };

    if (withApplause) {
      // 타이머 종료 시 박수 2초 후 리포트
      setAudienceMoods(computeMoods('applause', memberCountRef.current));
      // const applauseAudio = new Audio('/sounds/applause.mp3');
      // applauseAudio.play().catch(console.error);
      setTimeout(() => onStopRef.current(reportData), 2000);
    } else {
      // 종료 버튼 → 바로 리포트
      onStopRef.current(reportData);
    }
  };

  // ── 인터럽트 (백엔드 interrupt_question WS 메시지로 동작 — 로컬 로직 없음)
  const maybeInterruptRef = useRef(null);
  maybeInterruptRef.current = function maybeInterrupt() {
    // TODO: 백엔드 B 구현 후 여기서 처리 (현재는 WS interrupt_question 메시지로만 동작)
  };

  // ── 데모 시나리오 ─────────────────────────────────────
  // 각 텍스트에 대응하는 청중 반응 + 인터럽트 질문 정의
  const DEMO_SCENARIO = [
    { mood: null,         interrupt: null, feedback: null },                                                              // 0: 인사
    { mood: 'interested', interrupt: null, feedback: null },                                                              // 1: AI 기반 소개
    { mood: 'cold',       interrupt: null, feedback: '필러 단어가 늘고 있습니다. 잠깐 멈추고 정리 후 말씀해보세요.' },       // 2: 어~ 필러
    { mood: 'nodding',    interrupt: null, feedback: null },                                                              // 3: 주요 기능
    { mood: 'cold',       interrupt: '현재 시장에서 유사한 서비스와 차별점이 무엇인가요?', feedback: null },                // 4: 음~ 필러 → 질문
    { mood: 'nodding',    interrupt: null, feedback: null },                                                              // 5: 시장 규모
    { mood: 'interested', interrupt: null, feedback: null },                                                              // 6: 차별점
    { mood: 'cold',       interrupt: '그 실전 경험이 실제 발표력 향상에 얼마나 효과적인가요?', feedback: '말속도가 너무 빠릅니다. 천천히 말씀해보세요.' }, // 7: 그~ 필러 → 질문
    { mood: 'nodding',    interrupt: null, feedback: null },                                                              // 8: 비즈니스 모델
    { mood: 'applause',   interrupt: null, feedback: null },                                                              // 9: 감사합니다
  ];

  // ── 데모 모드
  function startDemo() {
    setListenLabel('데모 모드 (마이크 없음)');
    demoTimerRef.current = setInterval(() => {
      const idx = demoIdxRef.current;
      if (idx >= DEMO_TEXTS.length || stoppedRef.current) return;

      const scenario = DEMO_SCENARIO[idx];
      const demoText = DEMO_TEXTS[idx];

      // 0ms — 텍스트 표시
      processNewText(demoText);
      setDemoCurrentText(demoText);

      // 텍스트와 동시에 청중 반응 (0ms)
      if (scenario.mood) {
        applyMoodRef.current(scenario.mood);
      }

      // 2000ms — 피드백
      if (scenario.feedback) {
        setTimeout(() => {
          if (!stoppedRef.current) {
            setLiveFeedback(scenario.feedback);
            setTimeout(() => setLiveFeedback(null), 5000);
          }
        }, 2000);
      }

      // 2500ms — 인터럽트 질문
      if (scenario.interrupt && interruptOnRef.current && !interruptCooldownRef.current) {
        interruptCooldownRef.current = true;
        const question = scenario.interrupt;

        setTimeout(() => {
          if (stoppedRef.current) return;
          interruptLogRef.current.push(question);
          setInterruptCount(c => c + 1);
          setInterruptLog([...interruptLogRef.current]);
          setBubbleText(question);
          setBubbleVisible(true);

          // mood 적용 후 raising 덮어씌움
          setTimeout(() => applyQuestionRef.current(), 0);

          // TTS
          const utter = new SpeechSynthesisUtterance(question);
          utter.lang = 'ko-KR';
          utter.rate = 0.85;

          const onDone = () => {
            clearTimeout(fallback);
            setBubbleVisible(false);
            clearQuestionRef.current();
            interruptCooldownRef.current = false;
          };
          const fallback = setTimeout(() => {
            speechSynthesis.cancel();
            onDone();
          }, 15000);
          utter.onend = onDone;

          speechSynthesis.cancel();
          speechSynthesis.speak(utter);
        }, 2500);
      }

      demoIdxRef.current++;
    }, 4000);
  }

  // ── WebSocket 연결 (백엔드 세션 시작)
  useEffect(() => {
    if (!sessionId) return;

    startSession(sessionId)
      .then(() => {
        const ws = connectSessionWS(sessionId, (msg) => {
          if (stoppedRef.current) return;
          switch (msg.type) {

            case 'final_transcript':
              // 백엔드 확정 자막 — 자막 표시는 Web Speech final이 담당
              // WPM/필러는 live_metrics로 수신
              break;

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
                confused: 'cold', applause: 'applause', raising: 'question',
                satisfied: 'nodding', impressed: 'applause', neutral: 'neutral',
              };
              const mood = moodMap[msg.reaction];
              if (mood) applyMoodRef.current(mood);
              break;
            }

            case 'interrupt_question':
              if (!msg.is_follow_up) {
                interruptLogRef.current.push(msg.question_text);
                setInterruptCount(c => c + 1);
                setInterruptLog([...interruptLogRef.current]);
              }
              setBubbleText(msg.question_text);
              setBubbleVisible(true);
              applyQuestionRef.current();
              break;

            case 'tts_audio': {
              if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
              const audio = new Audio(`data:audio/${msg.format ?? 'mp3'};base64,${msg.audio_base64}`);
              audioRef.current = audio;
              const fallback = setTimeout(() => {
                if (ws.readyState === WebSocket.OPEN)
                  ws.send(JSON.stringify({ type: 'tts_finished', question_id: msg.question_id ?? 'q' }));
              }, 15000);
              audio.onended = () => {
                clearTimeout(fallback);
                audioRef.current = null;
                setBubbleVisible(false);
                clearQuestionRef.current();
                if (ws.readyState === WebSocket.OPEN)
                  ws.send(JSON.stringify({ type: 'tts_finished', question_id: msg.question_id ?? 'q' }));
              };
              audio.onerror = () => {
                clearTimeout(fallback);
                audioRef.current = null;
                if (ws.readyState === WebSocket.OPEN)
                  ws.send(JSON.stringify({ type: 'tts_finished', question_id: msg.question_id ?? 'q' }));
              };
              audio.play().catch(() => {
                clearTimeout(fallback);
                if (ws.readyState === WebSocket.OPEN)
                  ws.send(JSON.stringify({ type: 'tts_finished', question_id: msg.question_id ?? 'q' }));
              });
              break;
            }

            case 'stop_tts':
              if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
              setBubbleVisible(false);
              clearQuestionRef.current();
              break;

            case 'question_resolved':
              setBubbleResolved(true);
              setTimeout(() => {
                setBubbleVisible(false);
                setBubbleResolved(false);
                clearQuestionRef.current();
              }, 1500);
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
  useEffect(() => {
    startTimeRef.current = Date.now();

    timerIntervalRef.current = setInterval(() => {
      const elapsedSec = Math.floor((Date.now() - startTimeRef.current) / 1000);
      setElapsed(elapsedSec);
      if (elapsedSec >= totalSecRef.current) {
        stopSimRef.current(true);
        return;
      }
      if (elapsedSec > 0 && elapsedSec % 5 === 0) {
        maybeInterruptRef.current();
      }
    }, 1000);

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
          // Web Speech final → 밝은색 확정 자막 + 백엔드 전송
          setInterimText('');
          processNewText(final);
        } else if (interim) {
          // interim → 어두운색 임시 자막 + 실시간 WPM/필러 로컬 계산
          setInterimText(interim);

          // 실시간 WPM 계산 (interim 기준)
          const allText = transcriptRef.current + interim;
          const totalWords = allText.trim().split(/\s+/).filter(Boolean).length;
          const elapsedMin = (Date.now() - startTimeRef.current) / 60000;
          if (elapsedMin > 0) setWpm(Math.round(totalWords / elapsedMin));

          // 실시간 필러 계산 (interim 기준)
          const interimWords = interim.trim().split(/\s+/);
          const interimFillers = interimWords.filter(w => {
            const clean = w.replace(/[^가-힣a-z]/gi, '');
            return FILLERS.includes(clean);
          }).length;
          setFillerCount(fillerCountRef.current + interimFillers);
        }
      };
      r.onerror = () => { if (!demoMode) console.warn('[STT] 마이크 오류'); };
      r.onend   = () => { if (!stoppedRef.current && !demoMode) r.start(); };
      if (demoMode) {
        r.abort?.();
        startDemo();
      } else {
        r.start();
      }
    } else {
      startDemo();
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
  const cols      = Math.min(Math.ceil(Math.sqrt(memberCount)), 5);

  return (
    <div className="sim-page">
      {/* ── 스테이지 ── */}
      <div className="sim-stage">
        <div className={`interrupt-bubble${bubbleVisible ? ' interrupt-bubble--show' : ''}${bubbleResolved ? ' interrupt-bubble--resolved' : ''}`}>
          {bubbleResolved ? (
            <>
              <div className="interrupt-bubble__from">해결됨</div>
              ✓ 답변이 충분합니다
            </>
          ) : (
            <>
              <div className="interrupt-bubble__from">청중 질문</div>
              {bubbleText}
            </>
          )}
        </div>

        <div className="audience" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
          {Array.from({ length: memberCount }, (_, i) => (
            <AudienceMember key={i} mood={audienceMoods[i] ?? null} />
          ))}
        </div>
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
            {demoMode ? (
              /* 데모 모드: 시나리오 텍스트 표시 */
              demoCurrentText
                ? <span className="transcript-box__word">{demoCurrentText}</span>
                : <span>대기 중...</span>
            ) : (
              /* 실행 모드: partial(어두운) + final(밝은) */
              transcriptWords.length === 0 && !interimText ? (
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
              )
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