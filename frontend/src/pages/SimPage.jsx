import { useEffect, useRef, useState, useCallback } from 'react';
import './SimPage.css';

// ── 상수 ───────────────────────────────────────────────
const FILLERS = ['어', '음', '그', '저', '뭐', '그냥', '좀', '아', '에', '이'];
const INTERRUPT_INTERVALS = { easy: 90, medium: 50, hard: 30, brutal: 18 };

const AUDIENCE_MAP  = { professor: '교수', investor: '투자자', boss: '상사', general: '청중' };
const TYPE_MAP      = { academic: '학술 발표', pitch: 'IR 피칭', report: '사내 보고', interview: '면접' };
const DIFF_MAP      = { easy: '부드럽게', medium: '날카롭게', hard: '매우 날카롭게', brutal: '극도로 공격적으로' };

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

// ── 청중 멤버 ────────────────────────────────────────
function AudienceMember({ mood }) {
  const cls = ['audience-member', mood ? `audience-member--${mood}` : ''].join(' ');
  return (
    <div className={cls}>
      <div className="audience-member__head" />
      <div className="audience-member__body" />
    </div>
  );
}

// ── SimPage ──────────────────────────────────────────
export default function SimPage({ simState, onStop }) {
  const { type, audience, audienceCount, difficulty, duration, interrupt: interruptOn } = simState;

  // ── runtime state
  const [elapsed, setElapsed]           = useState(0);
  const [wpm, setWpm]                   = useState(0);
  const [fillerCount, setFillerCount]   = useState(0);
  const [interruptCount, setInterruptCount] = useState(0);
  const [interruptLog, setInterruptLog] = useState([]);
  const [transcriptWords, setTranscriptWords] = useState([]);  // [{text, isFiller}]
  const [audienceMoods, setAudienceMoods]     = useState([]);
  const [bubbleText, setBubbleText]           = useState('');
  const [bubbleVisible, setBubbleVisible]     = useState(false);
  const [listenLabel, setListenLabel]         = useState('마이크 듣는 중...');
  const [isLoading, setIsLoading]             = useState(false);

  // ── refs (변경돼도 리렌더 불필요한 값)
  const startTimeRef        = useRef(Date.now());
  const transcriptRef       = useRef('');
  const wordCountRef        = useRef(0);
  const fillerCountRef      = useRef(0);
  const wpmHistoryRef       = useRef([]);
  const interruptLogRef     = useRef([]);
  const interruptPendingRef = useRef(false);
  const interruptCooldownRef= useRef(false);
  const recognitionRef      = useRef(null);
  const demoTimerRef        = useRef(null);
  const demoIdxRef          = useRef(0);
  const timerIntervalRef    = useRef(null);
  const transcriptBoxRef    = useRef(null);
  const interruptLogBoxRef  = useRef(null);
  const stoppedRef          = useRef(false);

  const totalSec = duration * 60;
  const memberCount = Math.min(audienceCount, 20);

  // ── 청중 무드 계산
  function computeMoods(mood, count) {
    return Array.from({ length: count }, (_, i) => {
      if (mood === 'nodding'   && i % 3 === 0) return 'nodding';
      if (mood === 'cold')                      return 'cold';
      if (mood === 'interested'&& i % 2 === 0) return 'interested';
      if (mood === 'question'  && i === 0)      return 'raising';
      return null;
    });
  }

  // ── 텍스트 처리
  const processNewText = useCallback((text) => {
    transcriptRef.current += text;
    const words = text.trim().split(/\s+/);
    wordCountRef.current += words.length;

    words.forEach(w => {
      const clean = w.replace(/[^가-힣a-z]/gi, '');
      if (FILLERS.includes(clean)) fillerCountRef.current++;
    });

    // 최근 60단어만 표시
    const allWords = transcriptRef.current.split(/\s+/).slice(-60);
    const parsed = allWords.map(w => {
      const clean = w.replace(/[^가-힣a-z]/gi, '');
      return { text: w, isFiller: FILLERS.includes(clean) };
    });
    setTranscriptWords(parsed);
    setFillerCount(fillerCountRef.current);

    // WPM
    const elapsedMin = (Date.now() - startTimeRef.current) / 60000;
    const currentWpm = elapsedMin > 0 ? Math.round(wordCountRef.current / elapsedMin) : 0;
    wpmHistoryRef.current.push(currentWpm);
    setWpm(currentWpm);

    // 청중 반응
    if (currentWpm > 80 && currentWpm < 160 && fillerCountRef.current < 5) {
      setAudienceMoods(computeMoods('nodding', memberCount));
    } else if (currentWpm > 160 || fillerCountRef.current > 8) {
      setAudienceMoods(computeMoods('cold', memberCount));
    } else {
      setAudienceMoods(computeMoods('interested', memberCount));
    }
  }, [memberCount]);

  // ── 인터럽트 생성
  const generateQuestion = useCallback(async () => {
    const context = transcriptRef.current.slice(-400);
    const prompt = `당신은 ${AUDIENCE_MAP[audience]}입니다. 지금 ${TYPE_MAP[type]} 중입니다.
발표자의 최근 발화: "${context}"

${DIFF_MAP[difficulty]} 한 문장으로 날카로운 질문을 던지세요. 발표 내용에 근거하고, 발표자가 당황할 만한 질문이어야 합니다.
질문만 출력하고 다른 말은 하지 마세요.`;

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      const data = await res.json();
      return data.content?.[0]?.text?.trim() || null;
    } catch {
      return null;
    }
  }, [audience, type, difficulty]);

  const maybeInterrupt = useCallback(async () => {
    if (!interruptOn) return;
    if (interruptCooldownRef.current || interruptPendingRef.current) return;
    if (transcriptRef.current.length < 80) return;

    interruptPendingRef.current = true;
    interruptCooldownRef.current = true;

    const question = await generateQuestion();
    if (!question || stoppedRef.current) {
      interruptPendingRef.current = false;
      return;
    }

    interruptLogRef.current.push(question);
    setInterruptCount(c => c + 1);
    setInterruptLog([...interruptLogRef.current]);

    setBubbleText(question);
    setBubbleVisible(true);
    setAudienceMoods(computeMoods('question', memberCount));

    setTimeout(() => {
      setBubbleVisible(false);
      interruptPendingRef.current = false;
    }, 12000);

    setTimeout(() => {
      interruptCooldownRef.current = false;
    }, INTERRUPT_INTERVALS[difficulty] * 1000);
  }, [interruptOn, difficulty, generateQuestion, memberCount]);

  // ── 종료
  const stopSim = useCallback(() => {
    if (stoppedRef.current) return;
    stoppedRef.current = true;

    clearInterval(timerIntervalRef.current);
    if (recognitionRef.current) recognitionRef.current.stop();
    if (demoTimerRef.current) clearInterval(demoTimerRef.current);

    const finalElapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
    setIsLoading(true);

    onStop({
      elapsed:      finalElapsed,
      transcript:   transcriptRef.current,
      wordCount:    wordCountRef.current,
      fillerCount:  fillerCountRef.current,
      wpmHistory:   wpmHistoryRef.current,
      interruptLog: interruptLogRef.current,
    });
  }, [onStop]);

  // ── 마운트 시 타이머 + 음성인식 시작
  useEffect(() => {
    setAudienceMoods(computeMoods('neutral', memberCount));

    // 타이머
    timerIntervalRef.current = setInterval(() => {
      const elapsedSec = Math.floor((Date.now() - startTimeRef.current) / 1000);
      setElapsed(elapsedSec);
      if (elapsedSec >= totalSec) {
        stopSim();
        return;
      }
      if (elapsedSec % 5 === 0) maybeInterrupt();
    }, 1000);

    // 음성 인식
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SR) {
      const r = new SR();
      r.lang = 'ko-KR';
      r.continuous = true;
      r.interimResults = true;
      recognitionRef.current = r;

      r.onresult = (e) => {
        let final = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          if (e.results[i].isFinal) final += e.results[i][0].transcript + ' ';
        }
        if (final) processNewText(final);
      };

      r.onerror = () => startDemo();
      r.onend   = () => { if (!stoppedRef.current) r.start(); };
      r.start();
    } else {
      startDemo();
    }

    return () => {
      stoppedRef.current = true;
      clearInterval(timerIntervalRef.current);
      if (recognitionRef.current) recognitionRef.current.stop();
      if (demoTimerRef.current) clearInterval(demoTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function startDemo() {
    setListenLabel('데모 모드 (마이크 없음)');
    demoTimerRef.current = setInterval(() => {
      if (demoIdxRef.current < DEMO_TEXTS.length && !stoppedRef.current) {
        processNewText(DEMO_TEXTS[demoIdxRef.current++]);
      }
    }, 4000);
  }

  // ── transcript 스크롤
  useEffect(() => {
    if (transcriptBoxRef.current) {
      transcriptBoxRef.current.scrollTop = transcriptBoxRef.current.scrollHeight;
    }
  }, [transcriptWords]);

  // ── interrupt log 스크롤
  useEffect(() => {
    if (interruptLogBoxRef.current) {
      interruptLogBoxRef.current.scrollTop = interruptLogBoxRef.current.scrollHeight;
    }
  }, [interruptLog]);

  // ── 파생 값
  const remaining   = totalSec - elapsed;
  const timerPct    = (remaining / totalSec) * 100;
  const isUrgent    = remaining < 30;
  const mm          = String(Math.floor(elapsed / 60)).padStart(1, '0');
  const ss          = String(elapsed % 60).padStart(2, '0');
  const wpmPct      = Math.min(wpm / 200, 1) * 100;
  const wpmColor    = wpm < 80 || wpm > 160 ? 'stat-val--red' : 'stat-val--green';
  const cols        = Math.min(Math.ceil(Math.sqrt(memberCount)), 5);

  return (
    <>
      {isLoading && (
        <div className="loading-overlay">
          <div className="spinner" />
          <div className="loading-overlay__msg">AI 종합 피드백 생성 중...</div>
        </div>
      )}

      <div className="sim-page">
        {/* ── 스테이지 ── */}
        <div className="sim-stage">
          {/* 인터럽트 말풍선 */}
          <div className={`interrupt-bubble${bubbleVisible ? ' interrupt-bubble--show' : ''}`}>
            <div className="interrupt-bubble__from">청중 질문</div>
            {bubbleText}
          </div>

          {/* 청중 그리드 */}
          <div
            className="audience"
            style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
          >
            {Array.from({ length: memberCount }, (_, i) => (
              <AudienceMember key={i} mood={audienceMoods[i] || null} />
            ))}
          </div>
        </div>

        {/* ── HUD ── */}
        <div className="hud">
          <div className="hud__title">// 실시간 분석</div>

          {/* 마이크 상태 */}
          <div className="listening-indicator">
            <div className="dot dot--active" />
            <span>{listenLabel}</span>
          </div>

          {/* 타이머 */}
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

          {/* WPM */}
          <div className="stat-block">
            <div className={`stat-val ${wpmColor}`}>{wpm}</div>
            <div className="stat-label">WPM // 말하기 속도</div>
            <div className="wpm-bar-wrap">
              <div className="wpm-bar" style={{ width: `${wpmPct}%` }} />
            </div>
          </div>

          {/* 필러 / 인터럽트 */}
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

          {/* 발화 텍스트 */}
          <div>
            <div className="hud__title">// 발화 텍스트</div>
            <div className="transcript-box" ref={transcriptBoxRef}>
              {transcriptWords.length === 0 ? (
                <span>대기 중...</span>
              ) : (
                transcriptWords.map((w, i) => (
                  <span
                    key={i}
                    className={w.isFiller ? 'transcript-box__filler' : 'transcript-box__word'}
                  >
                    {w.text}{' '}
                  </span>
                ))
              )}
            </div>
          </div>

          {/* 인터럽트 기록 */}
          <div>
            <div className="hud__title" style={{ marginBottom: '8px' }}>// 인터럽트 기록</div>
            <div className="interrupt-log" ref={interruptLogBoxRef}>
              {interruptLog.map((q, i) => (
                <div key={i} className="log-item">Q{i + 1}: {q}</div>
              ))}
            </div>
          </div>

          <button className="btn-stop" onClick={stopSim}>발표 종료</button>
        </div>
      </div>
    </>
  );
}
