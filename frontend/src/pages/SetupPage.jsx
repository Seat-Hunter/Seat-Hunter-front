import { useState } from 'react';
import './SetupPage.css';

const LOGO = <span style={{ fontSize: 14 }}>🙋</span>;

const TYPE_OPTIONS = [
  { val: 'interview', label: '면접',      maxCount: 4,  fixedCount: true  },
  { val: 'academic',  label: '학술발표',  maxCount: 20, fixedCount: false },
  { val: 'school',    label: '학교 발표', maxCount: 18, fixedCount: false },
  { val: 'meeting',   label: '회의',      maxCount: 5,  fixedCount: true  },
];
const AUDIENCE_OPTIONS = [
  { val: 'professor', label: '교수' },
  { val: 'investor',  label: '투자자' },
  { val: 'boss',      label: '상사' },
  { val: 'general',   label: '일반 청중' },
];
const DIFF_OPTIONS = [
  { val: 'easy',   label: '약함' },
  { val: 'medium', label: '보통' },
  { val: 'hard',   label: '강함' },
  { val: 'brutal', label: '극한' },
];
const INTERRUPT_OPTIONS = [
  { val: 'on',  label: '켜기' },
  { val: 'off', label: '끄기' },
];

function ChipGroup({ options, value, onChange, error }) {
  return (
    <div>
      <div className="chip-group">
        {options.map(opt => (
          <button key={opt.val}
            className={`chip${value === opt.val ? ' chip--active' : ''}${error ? ' chip--error' : ''}`}
            onClick={() => onChange(opt.val)} type="button">
            {opt.label}
          </button>
        ))}
      </div>
      {error && <div className="field-error">{error}</div>}
    </div>
  );
}

function RangeSlider({ id, min, max, step = 1, value, onChange, disabled = false }) {
  return (
    <div className="range-row">
      <input id={id} type="range" className="range-row__input"
        min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        disabled={disabled}
        style={{ opacity: disabled ? 0.4 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }} />
      <span className="range-row__val">
        {disabled ? `${value}명 (고정)` : value}
      </span>
    </div>
  );
}

export default function SetupPage({ onStart, onLogout, onHome, onHistory, preset }) {
  const [type,         setType]       = useState(preset?.type       ?? null);
  const [audience,     setAudience]   = useState(preset?.audience   ?? null);
  const [audienceCount, setCount]     = useState(preset?.type ? (TYPE_OPTIONS.find(t => t.val === preset.type)?.fixedCount ? TYPE_OPTIONS.find(t => t.val === preset.type)?.maxCount : 0) : 0);
  const [difficulty,   setDifficulty] = useState(preset?.difficulty ?? null);
  const [duration,     setDuration]   = useState(0);
  const [interrupt,    setInterrupt]  = useState(preset?.interrupt !== undefined ? (preset.interrupt ? 'on' : 'off') : null);
  const [script,       setScript]     = useState('');
  const [submitted, setSubmitted] = useState(false);

  const currentTypeCfg = TYPE_OPTIONS.find(t => t.val === type);

  const typeError          = submitted && !type                                               ? '발표 유형을 선택해주세요'      : null;
  const audienceError      = submitted && !audience                                           ? '청자 유형을 선택해주세요'      : null;
  const audienceCountError = submitted && !currentTypeCfg?.fixedCount && audienceCount === 0 ? '청중 수를 선택해주세요'        : null;
  const difficultyError    = submitted && !difficulty                                         ? '압박 강도를 선택해주세요'      : null;
  const durationError      = submitted && duration === 0                                      ? '발표 시간을 선택해주세요'      : null;
  const interruptError     = submitted && !interrupt                                          ? '돌발 질문 여부를 선택해주세요' : null;

  function handleTypeChange(val) {
    const cfg = TYPE_OPTIONS.find(t => t.val === val) ?? TYPE_OPTIONS[0];
    setType(val);
    if (cfg.fixedCount) setCount(cfg.maxCount);
    else setCount(prev => Math.min(prev, cfg.maxCount));
  }

  function handleStart() {
    setSubmitted(true);
    const countInvalid = !currentTypeCfg?.fixedCount && audienceCount === 0;
    if (!type || !audience || countInvalid || !difficulty || duration === 0 || !interrupt) {
      const firstMissing = !type ? 'type' : !audience ? 'audience' : countInvalid ? 'audienceCount' : !difficulty ? 'difficulty' : duration === 0 ? 'duration' : 'interrupt';
      document.getElementById(`field-${firstMissing}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    const cfg = TYPE_OPTIONS.find(t => t.val === type) ?? TYPE_OPTIONS[0];
    onStart({
      type, audience,
      audienceCount: cfg.fixedCount ? cfg.maxCount : audienceCount,
      difficulty, duration,
      interrupt: interrupt === 'on',
      script,
    });
  }

  return (
    <div className="setup-page">
      <nav className="nav">
        <div className="nav-logo" onClick={onHome} style={{ cursor: 'pointer' }}>
          <div className="logo-icon">{LOGO}</div>
          <span className="logo-text">SpeechLab</span>
        </div>
        <div className="nav-links">
          <button className="nav-a" onClick={onHome}>홈</button>
          <button className="nav-a on">발표 설정</button>
        </div>
        <div className="nav-right">
          {onHistory && <button className="btn-line" onClick={onHistory}>히스토리</button>}
          {onLogout  && <button className="btn-line" onClick={onLogout}>로그아웃</button>}
        </div>
      </nav>

      <div className="setup-wrap">
        <div className="logo-row">
          <div>
            <div className="logo">발표 설정</div>
            <span className="logo__sub">환경과 조건을 설정하면 맞춤 AI 청중이 생성됩니다</span>
          </div>
        </div>

        <div className="setup-section" id="field-type">
          <span className="ss-label">발표 유형</span>
          <ChipGroup
            options={TYPE_OPTIONS}
            value={type}
            onChange={handleTypeChange}
            error={typeError}
          />
        </div>

        <div className="setup-section" id="field-audience">
          <span className="ss-label">청자 유형</span>
          <ChipGroup
            options={AUDIENCE_OPTIONS}
            value={audience}
            onChange={v => setAudience(v)}
            error={audienceError}
          />
        </div>

        <div className="setup-section" id="field-audienceCount">
          <span className="ss-label">청중 수</span>
          <div className="range-block">
            <div className="range-header">
              <span className="range-title">
                {!type ? '발표 유형을 먼저 선택해주세요' : currentTypeCfg?.fixedCount ? '고정 인원' : '청중 인원 선택'}
              </span>
              <span className="range-value">{type ? (audienceCount === 0 ? '—' : `${audienceCount}명`) : '—'}</span>
            </div>
            <RangeSlider
              id="audienceCount"
              min={0}
              max={currentTypeCfg?.maxCount ?? 20}
              value={audienceCount}
              onChange={setCount}
              disabled={!type || currentTypeCfg?.fixedCount}
            />
          </div>
          {audienceCountError && <div className="field-error">{audienceCountError}</div>}
        </div>

        <div className="setup-section" id="field-difficulty">
          <span className="ss-label">압박 강도</span>
          <ChipGroup
            options={DIFF_OPTIONS}
            value={difficulty}
            onChange={v => setDifficulty(v)}
            error={difficultyError}
          />
        </div>

        <div className="setup-section" id="field-duration">
          <span className="ss-label">발표 시간 (분)</span>
          <div className="range-block">
            <div className="range-header">
              <span className="range-title">발표 총 시간</span>
              <span className="range-value">{duration === 0 ? '—' : `${duration}분`}</span>
            </div>
            <RangeSlider id="duration" min={0} max={10} value={duration} onChange={setDuration} />
          </div>
          {durationError && <div className="field-error">{durationError}</div>}
        </div>

        <div className="setup-section" id="field-interrupt">
          <span className="ss-label">돌발 질문</span>
          <ChipGroup
            options={INTERRUPT_OPTIONS}
            value={interrupt}
            onChange={v => setInterrupt(v)}
            error={interruptError}
          />
        </div>

        <div className="setup-section">
          <span className="ss-label">
            발표 스크립트 <span style={{ fontWeight: 400, color: 'var(--ink3)' }}>(선택)</span>
          </span>
          <textarea className="setup-textarea" value={script}
            onChange={e => setScript(e.target.value)}
            placeholder="발표 내용을 붙여넣으세요. 없으면 자유 발표로 진행됩니다." />
        </div>

        <div className="setup-footer">
          {onHome && <button className="btn-line" onClick={onHome} style={{ marginRight: 'auto' }}>← 홈으로</button>}
          <button className="btn-primary" onClick={handleStart}>
            <svg width="11" height="11" fill="white" viewBox="0 0 24 24"><path d="M5 3l14 9-14 9V3z"/></svg>
            발표 시작
          </button>
        </div>
      </div>
    </div>
  );
}
