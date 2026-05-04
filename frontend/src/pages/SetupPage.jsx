import { useState } from 'react';
import './SetupPage.css';

const TYPE_OPTIONS = [
  { val: 'academic', label: '학술 발표' },
  { val: 'pitch',    label: 'IR 피칭' },
  { val: 'report',   label: '사내 보고' },
  { val: 'interview',label: '면접' },
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

function RangeSlider({ id, min, max, step = 1, value, onChange }) {
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
      />
      <span className="range-row__val">{value}</span>
    </div>
  );
}

export default function SetupPage({ onStart }) {
  const [type, setType]             = useState('academic');
  const [audience, setAudience]     = useState('professor');
  const [audienceCount, setCount]   = useState(15);
  const [difficulty, setDifficulty] = useState('medium');
  const [duration, setDuration]     = useState(3);
  const [interrupt, setInterrupt]   = useState('on');
  const [script, setScript]         = useState('');

  function buildConfig(demoMode = false) {
    return { type, audience, audienceCount, difficulty, duration, interrupt: interrupt === 'on', script, demoMode };
  }

  return (
    <div className="setup-page">
      <div className="logo">
        PressurePoint
        <span className="logo__sub">// 스피치 압박 트레이너</span>
      </div>

      <div className="setup-grid">
        <div className="field">
          <label className="field__label">발표 유형</label>
          <ChipGroup options={TYPE_OPTIONS} value={type} onChange={setType} />
        </div>
        <div className="field">
          <label className="field__label">청자 유형</label>
          <ChipGroup options={AUDIENCE_OPTIONS} value={audience} onChange={setAudience} />
        </div>
        <div className="field">
          <label className="field__label">청중 수</label>
          <RangeSlider id="audienceCount" min={5} max={50} step={5} value={audienceCount} onChange={setCount} />
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