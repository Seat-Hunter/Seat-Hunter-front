import { useEffect, useRef, useState } from 'react';
import './SimPage.css';
import { startSession, endSession, connectSessionWS } from '../services/claudeApi';
import AudienceSimulator from './AudienceSimulator';

// ── 상수 ───────────────────────────────────────────────
const FILLERS = ['어', '음', '그', '저', '뭐', '그냥', '좀', '아', '에', '이'];
const INTERRUPT_INTERVALS = { easy: 90, medium: 50, hard: 30, brutal: 18 };

function getQuestionNumberFromId(questionId) {
  const match = String(questionId ?? '').match(/q_(\d+)/);
  return match ? Number(match[1]) : null;
}

function getQuestionLabel(msg, fallbackNumber) {
  const parentNumber = getQuestionNumberFromId(msg.parent_question_id ?? msg.question_id) ?? fallbackNumber;
  if (msg.is_follow_up) {
    const followUpNumber =
      msg.follow_up_count ??
      Number(String(msg.question_id ?? '').match(/follow_up_(\d+)/)?.[1]) ??
      1;
    return `${parentNumber}-${followUpNumber}`;
  }
  return `${parentNumber}`;
}

function normalizeQuestionLogItem(item, index) {
  if (item && typeof item === 'object') {
    return {
      label: item.label ?? `${index + 1}`,
      text: item.text ?? item.question_text ?? '',
      isFollowUp: Boolean(item.isFollowUp ?? item.is_follow_up),
    };
  }
  return { label: `${index + 1}`, text: item, isFollowUp: false };
}

function normalizeSpeechText(text) {
  return String(text ?? '')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function isLikelyQuestionEcho(text, questionText) {
  const spoken = normalizeSpeechText(text);
  const question = normalizeSpeechText(questionText);

  if (!spoken || !question) return false;
  if (question.includes(spoken) || spoken.includes(question)) return true;

  const spokenWords = spoken.split(' ').filter(w => w.length > 1);
  const questionWords = new Set(question.split(' ').filter(w => w.length > 1));
  if (spokenWords.length < 2 || questionWords.size === 0) return false;

  const overlapCount = spokenWords.filter(w => questionWords.has(w)).length;
  return overlapCount / spokenWords.length >= 0.7;
}

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

export default function SimPage({ simState, onStop, onCancel }) {
  const { type, audience, audienceCount, difficulty, duration, interrupt: interruptOn, sessionId, demoMode } = simState;

  const totalSec    = duration * 60;
  const memberCount = Math.min(audienceCount, 20);

  const PRESENTATION_CONFIG = {
    interview: { roomType: 'interview',   audienceType: 'boss',      memberCount: 4  },
    academic:  { roomType: 'audiovisual', audienceType: 'professor', memberCount: 20 },
    school:    { roomType: 'classroom',   audienceType: 'professor', memberCount: 18 },
    meeting:   { roomType: 'meeting',     audienceType: 'boss',      memberCount: 5  },
  };
  const DEFAULT_CONFIG = { roomType: 'classroom', audienceType: 'general', memberCount: 8 };
  const config       = PRESENTATION_CONFIG[type] ?? DEFAULT_CONFIG;
  const roomType     = config.roomType;
  const audienceType = audience || config.audienceType;
  const finalMemberCount = ['interview', 'meeting'].includes(roomType)
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
  const [bubbleLabel, setBubbleLabel]         = useState('');
  const [bubbleVisible, setBubbleVisible]     = useState(false);
  const [bubbleResolved, setBubbleResolved]   = useState(false);
  const [sessionPhase, setSessionPhase]       = useState('presenting');
  const [answerMicActive, setAnswerMicActive] = useState(false);
  const [acceptCountdown, setAcceptCountdown] = useState(10);
  const [listenLabel, setListenLabel]         = useState('마이크 듣는 중...');
  const [isFinishing, setIsFinishing]         = useState(false);

  // answerMicActive → ref 동기화
  useEffect(() => { answerMicActiveRef.current = answerMicActive; }, [answerMicActive]);
  const [liveFeedback, setLiveFeedback]       = useState(null);
  const [demoCurrentText, setDemoCurrentText] = useState('');

  // ── 런타임 refs
  const startTimeRef         = useRef(Date.now());
  const transcriptRef        = useRef('');
  const wordCountRef         = useRef(0);
  const fillerCountRef       = useRef(0);
  const wpmHistoryRef        = useRef([]);
  const interruptLogRef      = useRef([]);
  const questionBaseCountRef = useRef(0);
  const bubbleTextRef        = useRef('');
  const interruptPendingRef  = useRef(false);
  const interruptCooldownRef = useRef(false);
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
  const isTtsPlayingRef      = useRef(false);
  const ttsEndedAtRef        = useRef(0);
  const currentQuestionIdRef = useRef(null);
  const answerMicActiveRef   = useRef(false);
  const countdownTimerRef    = useRef(null);
  const mediaRecorderRef     = useRef(null);
  const micStreamRef         = useRef(null);

  useEffect(() => {
    bubbleTextRef.current = bubbleText;
  }, [bubbleText]);

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
    if (isTtsPlayingRef.current) return; // TTS 재생 중 차단
    transcriptRef.current += text;

    const isAnswering = answerMicActiveRef.current;

    if (!isDemoRef.current && wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'partial_transcript',
        text,
        is_final: true,
        timestamp_ms: Date.now(),
        is_answer: isAnswering, // 답변 모드 여부 전달
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
  stopSimRef.current = async function stopSim(withApplause = false) {
    if (stoppedRef.current) return;
    stoppedRef.current = true;
    setIsFinishing(true);

    interruptPendingRef.current  = false;
    interruptCooldownRef.current = false;
    clearInterval(timerIntervalRef.current);
    if (demoTimerRef.current)   clearInterval(demoTimerRef.current);
    if (wsRef.current)          wsRef.current.close();
    if (audioRef.current)       { audioRef.current.pause(); audioRef.current = null; }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive')
      mediaRecorderRef.current.stop();
    if (micStreamRef.current) micStreamRef.current.getTracks().forEach(t => t.stop());

    const endSessionPromise = sessionIdRef.current
      ? endSession(sessionIdRef.current)
      : Promise.resolve(null);

    const reportData = {
      elapsed:      Math.floor((Date.now() - startTimeRef.current) / 1000),
      transcript:   transcriptRef.current,
      wordCount:    wordCountRef.current,
      fillerCount:  fillerCountRef.current,
      wpmHistory:   wpmHistoryRef.current,
      interruptLog: interruptLogRef.current,
    };

    const finishAndShowReport = async () => {
      try {
        await endSessionPromise;
      } catch (e) {
        console.error('[API] 세션 종료/리포트 생성 실패:', e);
      }
      onStopRef.current(reportData);
    };

    if (withApplause) {
      // 타이머 종료 시 박수 2초 후 리포트
      setAudienceMoods(computeMoods('applause', memberCountRef.current));
      // const applauseAudio = new Audio('/sounds/applause.mp3');
      // applauseAudio.play().catch(console.error);
      setTimeout(() => { finishAndShowReport(); }, 2000);
    } else {
      // 종료 버튼 → 바로 리포트
      await finishAndShowReport();
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
          questionBaseCountRef.current += 1;
          interruptLogRef.current.push({ label: `${questionBaseCountRef.current}`, text: question, isFollowUp: false });
          setInterruptCount(c => c + 1);
          setInterruptLog([...interruptLogRef.current]);
          setBubbleLabel(`${questionBaseCountRef.current}`);
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

            case 'partial_transcript':
              // Deepgram interim — 회색 미리보기
              if (msg.text && !answerMicActiveRef.current) setInterimText(msg.text);
              break;

            case 'final_transcript':
              // Deepgram 확정 자막 — 화면 표시의 단일 소스
              if (msg.text) {
                const justAfterTts = Date.now() - ttsEndedAtRef.current < 1500;
                if (isTtsPlayingRef.current || (justAfterTts && isLikelyQuestionEcho(msg.text, bubbleTextRef.current))) {
                  break;
                }
                setInterimText('');
                processNewText(msg.text);
              }
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
              currentQuestionIdRef.current = msg.question_id;
              {
                const fallbackNumber = msg.is_follow_up
                  ? Math.max(questionBaseCountRef.current, 1)
                  : questionBaseCountRef.current + 1;
                const label = getQuestionLabel(msg, fallbackNumber);
                const logItem = {
                  label,
                  text: msg.question_text,
                  isFollowUp: Boolean(msg.is_follow_up),
                };
                interruptLogRef.current.push(logItem);
                setInterruptLog([...interruptLogRef.current]);
                setBubbleLabel(label);
              }
              if (!msg.is_follow_up) {
                const parsedNumber = getQuestionNumberFromId(msg.question_id);
                questionBaseCountRef.current = Math.max(
                  questionBaseCountRef.current + 1,
                  parsedNumber ?? 0,
                );
                setInterruptCount(c => c + 1);
              }
              setBubbleText(msg.question_text);
              setBubbleVisible(true);
              isTtsPlayingRef.current = true;
              setSessionPhase('waiting_question'); // 질문 받기 버튼 표시
              applyQuestionRef.current();
              break;

            case 'tts_audio': {
              if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
              if (msg.question_text) setBubbleText(msg.question_text);
              if (msg.question_id) {
                currentQuestionIdRef.current = msg.question_id;
                setBubbleLabel(getQuestionLabel(
                  msg,
                  msg.is_follow_up ? Math.max(questionBaseCountRef.current, 1) : questionBaseCountRef.current + 1,
                ));
              }
              isTtsPlayingRef.current = true;
              setSessionPhase('questioning'); // TTS 재생 중
              const audio = new Audio(`data:audio/${msg.format ?? 'mp3'};base64,${msg.audio_base64}`);
              audioRef.current = audio;
              const fallback = setTimeout(() => {
                isTtsPlayingRef.current = false;
                ttsEndedAtRef.current = Date.now();
                setSessionPhase('waiting_answer');
                if (ws.readyState === WebSocket.OPEN)
                  ws.send(JSON.stringify({ type: 'tts_finished', question_id: msg.question_id ?? 'q' }));
              }, 15000);
              audio.onended = () => {
                clearTimeout(fallback);
                audioRef.current = null;
                isTtsPlayingRef.current = false;
                ttsEndedAtRef.current = Date.now();
                setSessionPhase('waiting_answer'); // 답변하기 버튼 표시
                if (ws.readyState === WebSocket.OPEN)
                  ws.send(JSON.stringify({ type: 'tts_finished', question_id: msg.question_id ?? 'q' }));
              };
              audio.onerror = () => {
                clearTimeout(fallback);
                audioRef.current = null;
                isTtsPlayingRef.current = false;
                ttsEndedAtRef.current = Date.now();
                setSessionPhase('waiting_answer');
                if (ws.readyState === WebSocket.OPEN)
                  ws.send(JSON.stringify({ type: 'tts_finished', question_id: msg.question_id ?? 'q' }));
              };
              audio.play().catch(() => {
                clearTimeout(fallback);
                isTtsPlayingRef.current = false;
                ttsEndedAtRef.current = Date.now();
                setSessionPhase('waiting_answer');
                if (ws.readyState === WebSocket.OPEN)
                  ws.send(JSON.stringify({ type: 'tts_finished', question_id: msg.question_id ?? 'q' }));
              });
              break;
            }

            case 'waiting_for_answer':
              // 백엔드가 tts_finished 후 보내는 신호 — 이미 waiting_answer 상태이므로 무시
              break;

            case 'stop_tts':
              if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
              isTtsPlayingRef.current = false;
              setBubbleVisible(false);
              setSessionPhase('presenting');
              setAnswerMicActive(false);
              answerMicActiveRef.current = false;
              clearQuestionRef.current();
              break;

            case 'question_resolved':
              isTtsPlayingRef.current = false;
              setAnswerMicActive(false);
              answerMicActiveRef.current = false;
              setBubbleResolved(true);
              setSessionPhase('presenting');
              setTimeout(() => {
                setBubbleVisible(false);
                setBubbleResolved(false);
                setBubbleText('');
                setBubbleLabel('');
                clearQuestionRef.current();
              }, 1500);
              break;

            case 'session_state':
              console.log('[세션 상태]', msg.state);
              break;
          }
        });
        wsRef.current = ws;

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
              if (isTtsPlayingRef.current) return;
              const buf = await e.data.arrayBuffer();
              const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
              wsRef.current.send(JSON.stringify({ type: 'audio_chunk', timestamp_ms: Date.now(), audio_base64: b64 }));
            };
            recorder.start(250);
          })
          .catch(err => console.warn('[MediaRecorder]', err));
      })
      .catch(console.error);

    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive')
        mediaRecorderRef.current.stop();
      if (micStreamRef.current) micStreamRef.current.getTracks().forEach(t => t.stop());
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

    if (demoMode) {
      startDemo();
    }

    return () => {
      stoppedRef.current = true;
      clearInterval(timerIntervalRef.current);
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
      <nav className="nav">
        <div className="nav-logo">
          <div className="logo-icon"><span style={{ fontSize: 14 }}>🙋</span></div>
          <span className="logo-text">SpeechLab</span>
        </div>
        <div className="nav-right">
          <div className="nav-rec">
            <span className="nav-rec-dot" />
            REC {mm}:{ss}
          </div>
        </div>
      </nav>
      {isFinishing && (
        <div className="sim-finalizing">
          <div className="sim-finalizing__spinner" />
          <div className="sim-finalizing__title">리포트 생성 중...</div>
          <div className="sim-finalizing__sub">발표 분석이 완료되면 리포트로 이동합니다</div>
        </div>
      )}
      <div className="sim-body">
      {/* ── 스테이지 ── */}
      <div className={`sim-stage ${roomType}`}>
        {/* 질문/답변 인터랙티브 오버레이 */}
        {sessionPhase === 'waiting_question' && (
          <div className="phase-overlay phase-overlay--questioning">
            <div className="phase-overlay__icon">✋</div>
            <div className="phase-overlay__title">청중 질문</div>
            <div className="phase-overlay__sub" style={{ marginBottom: 12 }}>
              {bubbleLabel && <strong>Q{bubbleLabel} </strong>}
              {bubbleText}
            </div>
            <button className="phase-action-btn phase-action-btn--red" onClick={() => {
              if (wsRef.current?.readyState === WebSocket.OPEN)
                wsRef.current.send(JSON.stringify({ type: 'accept_question', question_id: currentQuestionIdRef.current }));
              setSessionPhase('questioning');
            }}>🎤 질문 받기</button>
          </div>
        )}
        {sessionPhase === 'questioning' && (
          <div className="phase-overlay phase-overlay--questioning">
            <div className="phase-overlay__icon">🎤</div>
            <div className="phase-overlay__title">질문 중</div>
            <div className="phase-overlay__sub">잠시 기다려주세요...</div>
          </div>
        )}
        {sessionPhase === 'waiting_answer' && (
          <div className="phase-overlay phase-overlay--answering">
            <div className="phase-overlay__icon">💬</div>
            <div className="phase-overlay__title">답변 준비</div>
            <div className="phase-overlay__sub" style={{ marginBottom: 12 }}>마이크를 켜고 답변하세요</div>
            <button className="phase-action-btn phase-action-btn--blue" onClick={() => {
              if (wsRef.current?.readyState === WebSocket.OPEN)
                wsRef.current.send(JSON.stringify({ type: 'answer_started', question_id: currentQuestionIdRef.current }));
              setSessionPhase('answering');
              setAnswerMicActive(true);
            }}>🎙 답변하기</button>
          </div>
        )}
        {sessionPhase === 'answering' && (
          <div className="phase-overlay phase-overlay--answering">
            <div className="phase-overlay__icon">🎙</div>
            <div className="phase-overlay__title">답변 중</div>
            <div className="phase-overlay__sub" style={{ marginBottom: 12 }}>마이크에 대고 답변하세요</div>
            <button className="phase-action-btn phase-action-btn--blue" onClick={() => {
              if (wsRef.current?.readyState === WebSocket.OPEN)
                wsRef.current.send(JSON.stringify({ type: 'answer_finished', question_id: currentQuestionIdRef.current }));
              setSessionPhase('evaluating');
              setAnswerMicActive(false);
            }}>✅ 답변 완료</button>
          </div>
        )}
        {sessionPhase === 'evaluating' && (
          <div className="phase-overlay phase-overlay--questioning">
            <div className="phase-overlay__icon">⏳</div>
            <div className="phase-overlay__title">평가 중</div>
            <div className="phase-overlay__sub">잠시만 기다려주세요...</div>
          </div>
        )}
        <div className={`interrupt-bubble${bubbleVisible ? ' interrupt-bubble--show' : ''}${bubbleResolved ? ' interrupt-bubble--resolved' : ''}`}>
          {bubbleResolved ? (
            <>
              <div className="interrupt-bubble__from">해결됨</div>
              ✓ 답변이 충분합니다
            </>
          ) : (
            <>
              <div className="interrupt-bubble__from">청중 질문{bubbleLabel ? ` Q${bubbleLabel}` : ''}</div>
              {bubbleText}
            </>
          )}
        </div>

        <AudienceSimulator
          roomType={roomType}
          audienceType={audienceType}
          count={finalMemberCount}
          memberMoods={audienceMoods}
        />
      </div>

      {/* ── HUD ── */}
      <div className="hud">
        <div className="hud-section">
          <div className="hud__title">진행 시간</div>
          <div className="timer-bar">
            <div
              className={`timer-bar__fill${isUrgent ? ' timer-bar__fill--urgent' : ''}`}
              style={{ width: `${timerPct}%` }}
            />
          </div>
          <div className="timer-meta">
            <span className="timer-meta__text">남은 시간 {String(Math.floor(Math.max(0, totalSec - elapsed) / 60)).padStart(2,'0')}:{String(Math.max(0, totalSec - elapsed) % 60).padStart(2,'0')}</span>
            <span className="timer-meta__text">{mm}:{ss} 경과</span>
          </div>
        </div>

        <div className="hud-section">
          {sessionPhase === 'presenting' && (
            <div className="listening-indicator">
              <div className="dot dot--active" />
              <span>{listenLabel}</span>
            </div>
          )}
          {sessionPhase === 'waiting_question' && (
            <div className="phase-badge phase-badge--questioning">
              <span className="phase-badge__icon">✋</span>
              <span>질문 대기 중 ({acceptCountdown}초)</span>
            </div>
          )}
          {sessionPhase === 'questioning' && (
            <div className="phase-badge phase-badge--questioning">
              <span className="phase-badge__icon">🎤</span>
              <span>질문 듣는 중</span>
            </div>
          )}
          {sessionPhase === 'waiting_answer' && (
            <div className="phase-badge phase-badge--answering">
              <span className="phase-badge__icon">💬</span>
              <span>답변 준비</span>
            </div>
          )}
          {sessionPhase === 'answering' && (
            <div className="phase-badge phase-badge--answering">
              <span className="phase-badge__icon">🎙</span>
              <span>답변 중 — 마이크 ON</span>
            </div>
          )}
          {sessionPhase === 'evaluating' && (
            <div className="phase-badge phase-badge--questioning">
              <span className="phase-badge__icon">⏳</span>
              <span>평가 중...</span>
            </div>
          )}
          {liveFeedback && <div className="live-feedback" style={{ marginTop: 10 }}>{liveFeedback}</div>}
        </div>

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

        <div className="hud-section">
          <div className="hud__title">발화 텍스트</div>
          <div className="transcript-box" ref={transcriptBoxRef}>
            {demoMode ? (
              demoCurrentText
                ? <span className="transcript-box__word">{demoCurrentText}</span>
                : <span>대기 중...</span>
            ) : (
              transcriptWords.length === 0 && !interimText ? (
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
              )
            )}
          </div>
        </div>

        {interruptLog.length > 0 && (
          <div className="hud-section">
            <div className="hud__title">질문 기록</div>
            <div className="interrupt-log" ref={interruptLogBoxRef}>
              {interruptLog.map((q, i) => {
                const item = normalizeQuestionLogItem(q, i);
                return (
                  <div key={i} className="log-item">
                    <span style={{
                      fontWeight: 600,
                      color: item.isFollowUp ? 'var(--amber)' : 'var(--red)',
                    }}>
                      Q{item.label}{' '}
                    </span>
                    {item.text}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="hud-section">
          <button className="btn-stop" onClick={() => stopSimRef.current()} disabled={isFinishing}>
            {isFinishing ? '리포트 생성 중...' : '발표 종료'}
          </button>
          {onCancel && (
            <button
              onClick={() => {
                if (window.confirm('발표를 취소할까요? 기록이 저장되지 않습니다.')) {
                  stoppedRef.current = true;
                  clearInterval(timerIntervalRef.current);
                                if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
                  if (wsRef.current) wsRef.current.close();
                  onCancel();
                }
              }}
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
    </div>
  );
}
