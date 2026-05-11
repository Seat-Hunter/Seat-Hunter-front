import { useState } from 'react';
import './SetupPage.css';

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

function ChipGroup({ options, value, onChange }) {
  return (
    <div className="chip-group">
      {options.map(opt => (
        <button
          key={opt.val}
          className={`chip${value === opt.val ? ' chip--active' : ''}`}
          onClick={() => onChange(opt.val)}
          type="button"
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function RangeSlider({ id, min, max, step = 1, value, onChange, disabled = false }) {
  return (
    <div className="range-row">
      <input
        id={id}
        type="range"
        className="range-row__input"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        disabled={disabled}
        style={{ opacity: disabled ? 0.4 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}
      />
      <span className="range-row__val">
        {disabled ? `${value}명 (고정)` : value}
      </span>
    </div>
  );
}

export default function SetupPage({ onStart, onLogout }) {
  const [type, setType]             = useState('interview');
  const [audience, setAudience]     = useState('boss');
  const [audienceCount, setCount]   = useState(4);
  const [difficulty, setDifficulty] = useState('medium');
  const [duration, setDuration]     = useState(3);
  const [interrupt, setInterrupt]   = useState('on');
  const [script, setScript]         = useState('');

  function handleTypeChange(val) {
    const cfg = TYPE_OPTIONS.find(t => t.val === val);
    setType(val);
    if (cfg.fixedCount) {
      setCount(cfg.maxCount);
    } else {
      setCount(prev => Math.min(prev, cfg.maxCount));
    }
  }

  function buildConfig(demoMode = false) {
    const cfg = TYPE_OPTIONS.find(t => t.val === type);
    return {
      type,
      audience,
      audienceCount: cfg.fixedCount ? cfg.maxCount : audienceCount,
      difficulty,
      duration,
      interrupt: interrupt === 'on',
      script,
      demoMode,
    };
  }

  const currentTypeCfg = TYPE_OPTIONS.find(t => t.val === type);

  return (
    <div className="setup-page">
      {/* 로고 + 로그아웃 */}
      <div className="logo-row">
        <div className="logo">
          PressurePoint
          <span className="logo__sub">// 스피치 압박 트레이너</span>
        </div>
        {onLogout && (
          <button className="btn-logout" onClick={onLogout}>
            로그아웃
          </button>
        )}
      </div>

      <div className="setup-grid">
        <div className="field">
          <label className="field__label">발표 유형</label>
          <ChipGroup options={TYPE_OPTIONS} value={type} onChange={handleTypeChange} />
        </div>

        <div className="field">
          <label className="field__label">청자 유형</label>
          <ChipGroup options={AUDIENCE_OPTIONS} value={audience} onChange={setAudience} />
        </div>

        <div className="field">
          <label className="field__label">청중 수</label>
          <RangeSlider
            id="audienceCount"
            min={1}
            max={currentTypeCfg.maxCount}
            step={1}
            value={audienceCount}
            onChange={setCount}
            disabled={currentTypeCfg.fixedCount}
          />
        </div>

        <div className="field">
          <label className="field__label">압박 강도</label>
          <ChipGroup options={DIFF_OPTIONS} value={difficulty} onChange={setDifficulty} />
        </div>

        <div className="field">
          <label className="field__label">발표 시간 (분)</label>
          <RangeSlider id="duration" min={1} max={10} value={duration} onChange={setDuration} />
        </div>

        <div className="field">
          <label className="field__label">돌발 질문</label>
          <ChipGroup options={INTERRUPT_OPTIONS} value={interrupt} onChange={setInterrupt} />
        </div>

        <div className="field field--full">
          <label className="field__label">발표 스크립트 (선택)</label>
          <textarea
            className="setup-textarea"
            value={script}
            onChange={e => setScript(e.target.value)}
            placeholder="발표 내용을 붙여넣으세요. 없으면 자유 발표로 진행됩니다."
          />
        </div>
      </div>

      <div className="btn-group">
        <button className="btn-primary" onClick={() => onStart(buildConfig(false))}>
          발표 시작
        </button>
        <button className="btn-demo" onClick={() => onStart(buildConfig(true))}>
          데모 모드
        </button>
      </div>
    </div>
  );
}
