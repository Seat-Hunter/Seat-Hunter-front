// AudienceSimulator.jsx
// SimPage의 .sim-stage 안에 드롭인으로 사용하는 청중 시뮬레이터 컴포넌트
// 사용법:
//   <AudienceSimulator
//     roomType="classroom"          // 'interview'|'audiovisual'|'classroom'|'meeting'
//     audienceType="general"        // 'professor'|'investor'|'boss'|'general'
//     count={8}                     // 인원 수 (고정 장소는 무시됨)
//     mood="neutral"                // 전체 mood (외부에서 제어할 때)
//     selectedIdx={null}            // 특정 인덱스만 반응 (null이면 전체)
//   />

import { useEffect, useRef, useCallback } from 'react';
import './AudienceSimulator.css';

/* ── 캐릭터 프로필 (10명 고정) ── */
const CHAR_PROFILES = [
  {gender:'M', hair:'short_dark',  glasses:false, glassesStyle:'rect',  skin:'#FDBCB4', hairColor:'#2C1A0E'},
  {gender:'F', hair:'long',        glasses:false, glassesStyle:'round', skin:'#F9C74F', hairColor:'#1A1008'},
  {gender:'M', hair:'short_wavy',  glasses:true,  glassesStyle:'rect',  skin:'#C68642', hairColor:'#1C0F00'},
  {gender:'F', hair:'bob',         glasses:true,  glassesStyle:'round', skin:'#FFD0A0', hairColor:'#3D2000'},
  {gender:'M', hair:'curly',       glasses:false, glassesStyle:'rect',  skin:'#A0785A', hairColor:'#0D0500'},
  {gender:'F', hair:'ponytail',    glasses:false, glassesStyle:'round', skin:'#FDBCB4', hairColor:'#8B4513'},
  {gender:'M', hair:'side_part',   glasses:false, glassesStyle:'rect',  skin:'#FFD0A0', hairColor:'#2C1A0E'},
  {gender:'F', hair:'medium',      glasses:true,  glassesStyle:'rect',  skin:'#C68642', hairColor:'#1A0A00'},
  {gender:'M', hair:'slick_back',  glasses:true,  glassesStyle:'round', skin:'#FDBCB4', hairColor:'#111111'},
  {gender:'F', hair:'wavy_long',   glasses:false, glassesStyle:'round', skin:'#F9C74F', hairColor:'#5C3010'},
];

const AUDIENCE_SHIRTS = {
  professor: ['#1A237E','#283593','#303F9F','#3949AB','#3F51B5','#1565C0','#0D47A1','#1976D2','#283593','#1A237E'],
  investor:  ['#1B5E20','#2E7D32','#1A237E','#4A148C','#311B92','#006064','#1B5E20','#283593','#4A148C','#2E7D32'],
  boss:      ['#212121','#424242','#37474F','#263238','#455A64','#1C1C1C','#333333','#37474F','#212121','#424242'],
  general:   ['#5C6BC0','#EF5350','#26A69A','#7E57C2','#FF7043','#388E3C','#0288D1','#AD1457','#F57C00','#00838F'],
};
const AUDIENCE_TIES = {
  professor: ['#C62828','#B71C1C','#AD1457','#880E4F','#E53935','#D32F2F','#C2185B','#E91E63','#C62828','#B71C1C'],
  investor:  ['#B71C1C','#1A237E','#4A148C','#1B5E20','#311B92','#B71C1C','#006064','#880E4F','#1B5E20','#4A148C'],
  boss:      ['#B71C1C','#880E4F','#1A237E','#C62828','#AD1457','#B71C1C','#880E4F','#1A237E','#B71C1C','#C62828'],
  general:   ['#C62828','#1A237E','#880E4F','#1B5E20','#4A148C','#B71C1C','#AD1457','#C62828','#1B5E20','#4A148C'],
};
const CHAIR_COLORS = {
  interview:   { back:'#6D4C41', desk:'#8D6E63', deskTop:'#A1887F' },
  audiovisual: { back:'#8B1A1A', desk:null,      deskTop:null },
  classroom:   { back:'#4E342E', desk:'#6B9B6B', deskTop:'#7AB87A' },
  meeting:     { back:'#37474F', desk:'#78909C', deskTop:'#90A4AE' },
};

function shadeColor(hex, pct) {
  const num = parseInt(hex.replace('#',''), 16);
  const r = Math.min(255, Math.max(0, (num >> 16) + pct));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + pct));
  const b = Math.min(255, Math.max(0, (num & 0xff) + pct));
  return '#' + (r << 16 | g << 8 | b).toString(16).padStart(6,'0');
}

function getColors(audienceType) {
  const shirts = AUDIENCE_SHIRTS[audienceType] || AUDIENCE_SHIRTS.general;
  const ties   = AUDIENCE_TIES[audienceType]   || AUDIENCE_TIES.general;
  return CHAR_PROFILES.map((p, i) => ({
    skin: p.skin, shirt: shirts[i%shirts.length],
    armL: shirts[i%shirts.length], armR: shirts[i%shirts.length],
    tieColor: ties[i%ties.length], hairColor: p.hairColor,
    hair: p.hair, glasses: p.glasses, glassesStyle: p.glassesStyle, gender: p.gender,
  }));
}

function makeHairFront(style, hc) {
  switch(style) {
    case 'short_dark': return `
      <path d="M11 13 Q11 3 20 3 Q29 3 29 13 Q27 6 20 6 Q13 6 11 13Z" fill="${hc}"/>
      <path d="M11 13 Q10 8 11 5" stroke="${hc}" stroke-width="3" stroke-linecap="round" fill="none"/>
      <path d="M29 13 Q30 8 29 5" stroke="${hc}" stroke-width="3" stroke-linecap="round" fill="none"/>`;
    case 'short_wavy': return `
      <path d="M11 13 Q10 4 16 2 Q20 1 24 2 Q30 4 29 13 Q27 6 20 5 Q13 6 11 13Z" fill="${hc}"/>
      <path d="M13 6 Q15 4 17 6 Q19 4 22 6" stroke="${hc}" stroke-width="1.4" fill="none" opacity="0.55" stroke-linecap="round"/>
      <path d="M11 13 Q10 9 11 6" stroke="${hc}" stroke-width="2.5" stroke-linecap="round" fill="none"/>
      <path d="M29 13 Q30 9 29 6" stroke="${hc}" stroke-width="2.5" stroke-linecap="round" fill="none"/>`;
    case 'slick_back': return `
      <path d="M11 12 Q12 3 20 3 Q28 3 29 12 Q28 5 20 5 Q12 5 11 12Z" fill="${hc}"/>
      <path d="M12 8 Q16 4 20 4 Q24 4 28 8" stroke="${hc}" stroke-width="1.2" fill="none" opacity="0.4"/>
      <path d="M11 12 Q10.5 8 11 5" stroke="${hc}" stroke-width="2.5" stroke-linecap="round" fill="none"/>
      <path d="M29 12 Q29.5 8 29 5" stroke="${hc}" stroke-width="2.5" stroke-linecap="round" fill="none"/>`;
    case 'side_part': return `
      <path d="M11 13 Q11 3 20 3 Q29 3 29 13 Q27 6 20 6 Q13 6 11 13Z" fill="${hc}"/>
      <path d="M11 13 Q10 8 11 5" stroke="${hc}" stroke-width="3" stroke-linecap="round" fill="none"/>
      <path d="M29 13 Q30 8 29 5" stroke="${hc}" stroke-width="3" stroke-linecap="round" fill="none"/>
      <path d="M18 5 Q19 3.5 20 3" stroke="rgba(255,255,255,0.35)" stroke-width="1" fill="none" stroke-linecap="round"/>
      <path d="M11 9 Q14 5 18 5 Q16 7 13 9" fill="${hc}" opacity="0.6"/>`;
    case 'curly': return `
      <circle cx="14" cy="8"  r="3.8" fill="${hc}"/>
      <circle cx="20" cy="5"  r="4"   fill="${hc}"/>
      <circle cx="26" cy="8"  r="3.8" fill="${hc}"/>
      <circle cx="11" cy="12" r="3"   fill="${hc}"/>
      <circle cx="29" cy="12" r="3"   fill="${hc}"/>
      <circle cx="17" cy="5.5" r="3.2" fill="${hc}"/>
      <circle cx="23" cy="5.5" r="3.2" fill="${hc}"/>`;
    case 'long': return `
      <path d="M11 13 Q11 3 20 3 Q29 3 29 13 Q26 5 20 5 Q14 5 11 13Z" fill="${hc}"/>
      <path d="M11 13 Q10 8 11 5" stroke="${hc}" stroke-width="3" stroke-linecap="round" fill="none"/>
      <path d="M29 13 Q30 8 29 5" stroke="${hc}" stroke-width="3" stroke-linecap="round" fill="none"/>
      <path d="M11 13 Q8 22 9 33 Q10 38 11 42" stroke="${hc}" stroke-width="5" stroke-linecap="round" fill="none"/>
      <path d="M29 13 Q32 22 31 33 Q30 38 29 42" stroke="${hc}" stroke-width="5" stroke-linecap="round" fill="none"/>
      <path d="M11 20 Q9.5 27 10 34" stroke="${hc}" stroke-width="2.5" fill="none" opacity="0.45" stroke-linecap="round"/>
      <path d="M29 20 Q30.5 27 30 34" stroke="${hc}" stroke-width="2.5" fill="none" opacity="0.45" stroke-linecap="round"/>`;
    case 'bob': return `
      <path d="M11 13 Q11 3 20 3 Q29 3 29 13 Q26 5 20 5 Q14 5 11 13Z" fill="${hc}"/>
      <path d="M11 13 Q10 8 11 5" stroke="${hc}" stroke-width="3" stroke-linecap="round" fill="none"/>
      <path d="M29 13 Q30 8 29 5" stroke="${hc}" stroke-width="3" stroke-linecap="round" fill="none"/>
      <path d="M11 13 Q9 20 10 27 Q12 31 20 31 Q28 31 30 27 Q31 20 29 13" fill="${hc}"/>
      <path d="M11 27 Q12 30 20 30 Q28 30 29 27" stroke="${hc}" stroke-width="0.8" fill="none" opacity="0.5"/>`;
    case 'medium': return `
      <path d="M11 13 Q11 3 20 3 Q29 3 29 13 Q26 5 20 5 Q14 5 11 13Z" fill="${hc}"/>
      <path d="M11 13 Q10 8 11 5" stroke="${hc}" stroke-width="3" stroke-linecap="round" fill="none"/>
      <path d="M29 13 Q30 8 29 5" stroke="${hc}" stroke-width="3" stroke-linecap="round" fill="none"/>
      <path d="M11 13 Q8 20 9 30 Q10 34 13 36" stroke="${hc}" stroke-width="5.5" stroke-linecap="round" fill="none"/>
      <path d="M29 13 Q32 20 31 30 Q30 34 27 36" stroke="${hc}" stroke-width="5.5" stroke-linecap="round" fill="none"/>`;
    case 'ponytail': return `
      <path d="M11 13 Q11 3 20 3 Q29 3 29 13 Q26 5 20 5 Q14 5 11 13Z" fill="${hc}"/>
      <path d="M11 13 Q10 8 11 5" stroke="${hc}" stroke-width="3" stroke-linecap="round" fill="none"/>
      <path d="M29 13 Q30 8 29 5" stroke="${hc}" stroke-width="3" stroke-linecap="round" fill="none"/>
      <ellipse cx="20" cy="4" rx="4.5" ry="2" fill="${hc}"/>
      <path d="M20 3 Q23 3 24 1 Q26 -1 24 2 Q22 5 20 6" fill="${hc}"/>
      <path d="M23.5 2 Q27 0 28 3 Q29 7 27 11 Q29 6 28 2 Q27 -1 23.5 0Z" fill="${hc}" opacity="0.7"/>`;
    case 'wavy_long': return `
      <path d="M11 13 Q11 3 20 3 Q29 3 29 13 Q26 5 20 5 Q14 5 11 13Z" fill="${hc}"/>
      <path d="M11 13 Q10 8 11 5" stroke="${hc}" stroke-width="3" stroke-linecap="round" fill="none"/>
      <path d="M29 13 Q30 8 29 5" stroke="${hc}" stroke-width="3" stroke-linecap="round" fill="none"/>
      <path d="M11 13 Q8 20 10 26 Q12 32 9 38 Q11 44 12 46" stroke="${hc}" stroke-width="5" stroke-linecap="round" fill="none"/>
      <path d="M29 13 Q32 20 30 26 Q28 32 31 38 Q29 44 28 46" stroke="${hc}" stroke-width="5" stroke-linecap="round" fill="none"/>
      <path d="M11.5 17 Q9.5 23 11 29 Q13 35 10.5 41" stroke="${hc}" stroke-width="2" fill="none" opacity="0.4" stroke-linecap="round"/>
      <path d="M28.5 17 Q30.5 23 29 29 Q27 35 29.5 41" stroke="${hc}" stroke-width="2" fill="none" opacity="0.4" stroke-linecap="round"/>`;
    default: return `<path d="M11 13 Q11 3 20 3 Q29 3 29 13 Q26 6 20 6 Q14 6 11 13Z" fill="${hc}"/>`;
  }
}

function makeSideHair(style, hc, dir) {
  const flip = dir==='left' ? 'scale(-1,1) translate(-40,0)' : '';
  let inner = '';
  switch(style) {
    case 'short_dark': case 'short_wavy': case 'side_part': case 'slick_back':
      inner = `<path d="M16 14 Q15 6 20 4 Q25 3 28 6 Q30 10 29 16 Q29 10 27 6 Q23 3 20 5 Q17 6 16 14Z" fill="${hc}"/>
               <path d="M16 14 Q15 9 16 6" stroke="${hc}" stroke-width="3" stroke-linecap="round" fill="none"/>`;
      if(style==='short_wavy') inner+=`<path d="M19 5 Q21 3.5 23 5 Q25 3.5 27 5" stroke="${hc}" stroke-width="1.2" fill="none" opacity="0.5" stroke-linecap="round"/>`;
      if(style==='slick_back') inner+=`<path d="M17 9 Q20 5 24 5 Q27 5 28 8" stroke="${hc}" stroke-width="1.1" fill="none" opacity="0.4"/>`;
      break;
    case 'curly':
      inner = `<circle cx="20" cy="5" r="3.5" fill="${hc}"/><circle cx="24" cy="4" r="3.2" fill="${hc}"/>
               <circle cx="27" cy="6" r="3" fill="${hc}"/><circle cx="29" cy="10" r="2.8" fill="${hc}"/>
               <circle cx="17" cy="7" r="3" fill="${hc}"/><circle cx="16" cy="12" r="2.5" fill="${hc}"/>`;
      break;
    case 'long': case 'wavy_long':
      inner = `<path d="M16 14 Q15 6 20 4 Q25 3 28 6 Q30 10 29 16 Q29 10 27 6 Q23 3 20 5 Q17 6 16 14Z" fill="${hc}"/>
               <path d="M16 14 Q15 9 16 6" stroke="${hc}" stroke-width="3" stroke-linecap="round" fill="none"/>
               <path d="M16 14 Q13 22 14 32 Q15 38 15 44" stroke="${hc}" stroke-width="5.5" stroke-linecap="round" fill="none"/>`;
      if(style==='wavy_long') inner+=`<path d="M16 20 Q14 26 15 33 Q16 39 15 44" stroke="${hc}" stroke-width="2.5" fill="none" opacity="0.4" stroke-linecap="round"/>`;
      break;
    case 'bob':
      inner = `<path d="M16 14 Q15 6 20 4 Q25 3 28 6 Q30 10 29 16 Q29 10 27 6 Q23 3 20 5 Q17 6 16 14Z" fill="${hc}"/>
               <path d="M16 14 Q15 9 16 6" stroke="${hc}" stroke-width="3" stroke-linecap="round" fill="none"/>
               <path d="M16 14 Q13 21 14 27 Q15 30 16 31" stroke="${hc}" stroke-width="5.5" stroke-linecap="round" fill="none"/>`;
      break;
    case 'medium':
      inner = `<path d="M16 14 Q15 6 20 4 Q25 3 28 6 Q30 10 29 16 Q29 10 27 6 Q23 3 20 5 Q17 6 16 14Z" fill="${hc}"/>
               <path d="M16 14 Q15 9 16 6" stroke="${hc}" stroke-width="3" stroke-linecap="round" fill="none"/>
               <path d="M16 14 Q13 21 14 30 Q15 35 16 37" stroke="${hc}" stroke-width="6" stroke-linecap="round" fill="none"/>`;
      break;
    case 'ponytail':
      inner = `<path d="M16 14 Q15 6 20 4 Q25 3 28 6 Q30 10 29 16 Q29 10 27 6 Q23 3 20 5 Q17 6 16 14Z" fill="${hc}"/>
               <path d="M16 14 Q15 9 16 6" stroke="${hc}" stroke-width="3" stroke-linecap="round" fill="none"/>
               <path d="M29 8 Q33 5 35 9 Q37 14 34 18 Q36 12 35 8 Q33 4 29 6Z" fill="${hc}"/>
               <path d="M34 14 Q36 20 34 26" stroke="${hc}" stroke-width="3.5" stroke-linecap="round" fill="none"/>`;
      break;
    default:
      inner = `<path d="M16 14 Q15 6 20 4 Q25 3 28 6 Q30 10 29 16 Q29 10 27 6 Q23 3 20 5 Q17 6 16 14Z" fill="${hc}"/>`;
  }
  return `<g transform="${flip}">${inner}</g>`;
}

function makeGlassesFront(style) {
  if(style==='round') return `
    <circle cx="16" cy="12" r="3.8" fill="none" stroke="#1a1a1a" stroke-width="1.3"/>
    <circle cx="24" cy="12" r="3.8" fill="none" stroke="#1a1a1a" stroke-width="1.3"/>
    <line x1="19.8" y1="12" x2="20.2" y2="12" stroke="#1a1a1a" stroke-width="1.3"/>
    <line x1="12.2" y1="11.5" x2="10.5" y2="11" stroke="#1a1a1a" stroke-width="1.1" stroke-linecap="round"/>
    <line x1="27.8" y1="11.5" x2="29.5" y2="11" stroke="#1a1a1a" stroke-width="1.1" stroke-linecap="round"/>`;
  return `
    <rect x="12.2" y="9.2" width="7.5" height="5.5" rx="1.5" fill="none" stroke="#1a1a1a" stroke-width="1.3"/>
    <rect x="20.3" y="9.2" width="7.5" height="5.5" rx="1.5" fill="none" stroke="#1a1a1a" stroke-width="1.3"/>
    <line x1="19.7" y1="12" x2="20.3" y2="12" stroke="#1a1a1a" stroke-width="1.3"/>
    <line x1="12.2" y1="11.5" x2="10.5" y2="11" stroke="#1a1a1a" stroke-width="1.1" stroke-linecap="round"/>
    <line x1="27.8" y1="11.5" x2="29.5" y2="11" stroke="#1a1a1a" stroke-width="1.1" stroke-linecap="round"/>`;
}

function makeSideGlasses(style, dir) {
  const flip = dir==='left' ? 'scale(-1,1) translate(-40,0)' : '';
  const inner = style==='round'
    ? `<circle cx="26" cy="13" r="3.2" fill="none" stroke="#1a1a1a" stroke-width="1.2"/>
       <line x1="29.2" y1="12.5" x2="31" y2="12" stroke="#1a1a1a" stroke-width="1" stroke-linecap="round"/>`
    : `<rect x="22.8" y="10.2" width="6.4" height="5.2" rx="1.3" fill="none" stroke="#1a1a1a" stroke-width="1.2"/>
       <line x1="29.2" y1="12.8" x2="31" y2="12.2" stroke="#1a1a1a" stroke-width="1" stroke-linecap="round"/>`;
  return `<g transform="${flip}">${inner}</g>`;
}

function makeFemaleDetail(mood) {
  if(mood==='cold'||mood==='bored') return '';
  return `<path d="M5 6.8 Q7 5.6 9 6.5" stroke="#555" stroke-width="0.9" fill="none" opacity="0.7" stroke-linecap="round"/>
          <path d="M13 6.8 Q15 5.6 17 6.5" stroke="#555" stroke-width="0.9" fill="none" opacity="0.7" stroke-linecap="round"/>`;
}

function makeTieFront(tieColor) {
  const knotDark = shadeColor(tieColor, -25);
  return `<polygon points="18.5,22.5 21.5,22.5 22,26.5 20,27.5 18,26.5" fill="${knotDark}"/>
          <polygon points="18.2,26.5 21.8,26.5 21,35 20,36.5 19,35" fill="${tieColor}"/>
          <line x1="19.5" y1="23.5" x2="20.5" y2="23.5" stroke="rgba(255,255,255,0.18)" stroke-width="0.8" stroke-linecap="round"/>`;
}

function makeTieSide(tieColor, dir) {
  const knotDark = shadeColor(tieColor, -25);
  const flip = dir==='left' ? 'scale(-1,1) translate(-40,0)' : '';
  return `<g transform="${flip}">
    <polygon points="20,22.5 22.5,22.5 22.5,26 21.5,27 20,26" fill="${knotDark}"/>
    <polygon points="20.2,26 22.3,26 21.8,35 21,36.5 20.2,35" fill="${tieColor}"/>
  </g>`;
}

function makeSVG(mood, c, ch, delay=0, hasDesk=true, scale=1) {
  const isCold=mood==='cold', isApplause=mood==='applause', isRaising=mood==='raising';
  const isBored=mood==='bored', isConfused=mood==='confused', isPhone=mood==='phone';
  const isInterested=mood==='interested', isNodding=mood==='nodding';
  const isFemale = c.gender==='F';

  let eyes='', mouth='', extra='';
  if(isCold){
    eyes=`<circle cx="7" cy="8" r="1.6" fill="#111"/><circle cx="15" cy="8" r="1.6" fill="#111"/>
          <line x1="5" y1="6" x2="9" y2="6" stroke="#222" stroke-width="1" stroke-linecap="round"/>
          <line x1="13" y1="6" x2="17" y2="6" stroke="#222" stroke-width="1" stroke-linecap="round"/>`;
    mouth=`<path d="M6 13 Q11 11 16 13" stroke="#222" stroke-width="1" fill="none" stroke-linecap="round"/>`;
  }else if(isApplause){
    eyes=`<path d="M5 8 Q7 6 9 8" stroke="#111" stroke-width="1.3" fill="none" stroke-linecap="round"/>
          <path d="M13 8 Q15 6 17 8" stroke="#111" stroke-width="1.3" fill="none" stroke-linecap="round"/>`;
    mouth=`<path d="M5 12 Q11 17 17 12" stroke="#111" stroke-width="1.3" fill="none" stroke-linecap="round"/>`;
  }else if(isRaising){
    eyes=`<circle cx="7" cy="8" r="1.9" fill="#111"/><circle cx="15" cy="8" r="1.9" fill="#111"/>
          <circle cx="7.5" cy="7.5" r="0.6" fill="white"/><circle cx="15.5" cy="7.5" r="0.6" fill="white"/>`;
    mouth=`<ellipse cx="11" cy="13" rx="2.5" ry="1.5" fill="#C62828"/>`;
  }else if(isBored){
    eyes=`<path d="M5 8 Q7 9.5 9 8" stroke="#888" stroke-width="1.3" fill="none" stroke-linecap="round"/>
          <path d="M13 8 Q15 9.5 17 8" stroke="#888" stroke-width="1.3" fill="none" stroke-linecap="round"/>`;
    mouth=`<path d="M7 13 Q11 15 15 13" stroke="#aaa" stroke-width="1" fill="none" stroke-linecap="round"/>`;
  }else if(isConfused){
    eyes=`<circle cx="7" cy="8" r="1.6" fill="#444"/><circle cx="15" cy="8" r="1.6" fill="#444"/>`;
    mouth=`<path d="M7 12.5 Q9 14.5 13 11 Q15 10 17 12" stroke="#555" stroke-width="1" fill="none" stroke-linecap="round"/>`;
    extra=`<path d="M5 5.5 Q7 4 9 5.5" stroke="#666" stroke-width="1.1" fill="none" stroke-linecap="round"/>
           <path d="M13 4.5 Q15 6 17 4.5" stroke="#666" stroke-width="1.1" fill="none" stroke-linecap="round"/>`;
  }else if(isPhone){
    eyes=`<circle cx="8" cy="9" r="1.5" fill="#333"/><circle cx="16" cy="9" r="1.5" fill="#333"/>`;
    mouth=`<path d="M7 13 Q11 14.5 15 13" stroke="#555" stroke-width="1" fill="none" stroke-linecap="round"/>`;
    extra=`<path d="M5 5.5 Q7 4.5 9 5.5" stroke="#555" stroke-width="1" fill="none" stroke-linecap="round"/>
           <path d="M13 5.5 Q15 4.5 17 5.5" stroke="#555" stroke-width="1" fill="none" stroke-linecap="round"/>`;
  }else if(isInterested){
    eyes=`<circle cx="7" cy="8" r="1.9" fill="#111"/><circle cx="15" cy="8" r="1.9" fill="#111"/>
          <circle cx="7.5" cy="7.5" r="0.6" fill="white"/><circle cx="15.5" cy="7.5" r="0.6" fill="white"/>`;
    mouth=`<path d="M7 12 Q11 15 15 12" stroke="#333" stroke-width="1" fill="none" stroke-linecap="round"/>`;
  }else if(isNodding){
    eyes=`<circle cx="7" cy="8" r="1.6" fill="#222"/><circle cx="15" cy="8" r="1.6" fill="#222"/>`;
    mouth=`<path d="M7 12 Q11 14.5 15 12" stroke="#444" stroke-width="1" fill="none" stroke-linecap="round"/>`;
  }else{
    eyes=`<circle cx="7" cy="8" r="1.5" fill="#333"/><circle cx="15" cy="8" r="1.5" fill="#333"/>`;
    mouth=`<path d="M7 12.5 Q11 14.5 15 12.5" stroke="#555" stroke-width="1" fill="none" stroke-linecap="round"/>`;
  }

  const zzz = isBored ? `
    <text class="zzz-1" x="28" y="10" font-size="7" fill="#90A4AE" font-weight="500">z</text>
    <text class="zzz-2" x="32" y="6"  font-size="9" fill="#90A4AE" font-weight="500">z</text>
    <text class="zzz-3" x="36" y="2"  font-size="11" fill="#90A4AE" font-weight="500">z</text>` : '';

  const armL = isCold
    ? `<path class="am-arm-l" d="M11 27 Q6 31 10 35" stroke="${c.armL}" stroke-width="5" stroke-linecap="round" fill="none"/>`
    : isApplause
    ? `<path class="am-arm-l" d="M11 27 Q4 30 7 36" stroke="${c.armL}" stroke-width="5" stroke-linecap="round" fill="none"/>
       <circle class="am-arm-l" cx="7" cy="36" r="4" fill="${c.skin}"/>`
    : `<path class="am-arm-l" d="M11 27 Q7 33 9 38" stroke="${c.armL}" stroke-width="5" stroke-linecap="round" fill="none"/>`;

  const armR_n = isApplause
    ? `<path class="am-arm-r" d="M29 27 Q36 30 33 36" stroke="${c.armR}" stroke-width="5" stroke-linecap="round" fill="none"/>
       <circle class="am-arm-r" cx="33" cy="36" r="4" fill="${c.skin}"/>`
    : isCold
    ? `<path class="am-arm-r" d="M29 27 Q34 31 30 35" stroke="${c.armR}" stroke-width="5" stroke-linecap="round" fill="none"/>
       <path d="M10 32 Q20 28 30 32" stroke="${c.shirt}" stroke-width="4" stroke-linecap="round" fill="none"/>`
    : isPhone
    ? `<path class="am-arm-r" d="M29 27 Q34 29 32 34" stroke="${c.armR}" stroke-width="5" stroke-linecap="round" fill="none"/>
       <rect class="am-arm-r" x="27" y="31" width="8" height="9" rx="1.5" fill="#333"/>`
    : `<path class="am-arm-r" d="M29 27 Q33 33 31 38" stroke="${c.armR}" stroke-width="5" stroke-linecap="round" fill="none"/>`;

  const armR_raising = `<g class="am-arm-r">
    <path d="M29 25 Q33 14 32 8" stroke="${c.armR}" stroke-width="5" stroke-linecap="round" fill="none"/>
    <circle cx="32" cy="7" r="4" fill="${c.skin}"/>
  </g>`;

  const deskHTML = hasDesk && ch.desk ? `
    <rect x="0" y="40" width="40" height="20" rx="2" fill="${ch.desk}"/>
    <rect x="0" y="38" width="40" height="4" rx="1" fill="${ch.deskTop}"/>` : '';

  const bodyWidth = isFemale ? 16 : 18;
  const bodyX     = isFemale ? 12 : 11;
  const hairSVG    = makeHairFront(c.hair, c.hairColor);
  const glassesSVG = c.glasses ? makeGlassesFront(c.glassesStyle) : '';
  const femaleExtra= isFemale ? makeFemaleDetail(mood) : '';
  const earring    = isFemale ? `<circle cx="11" cy="16" r="1.4" fill="#E8C84A" opacity="0.95"/>
    <circle cx="29" cy="16" r="1.4" fill="#E8C84A" opacity="0.95"/>` : '';
  const tieSVG = makeTieFront(c.tieColor);

  const w = Math.round(54*scale), h = Math.round(68*scale);
  return `<svg class="mood-${mood}" width="${w}" height="${h}" viewBox="0 0 40 60" fill="none">
    <rect x="6" y="23" width="28" height="16" rx="3" fill="${ch.back}"/>
    ${isRaising?'':armR_n}
    <g class="am-face" style="animation-delay:${delay}ms">
      <ellipse cx="20" cy="13" rx="9" ry="10" fill="${c.skin}"/>
      ${hairSVG}
      ${earring}
      <g transform="translate(9,4)">${eyes}${mouth}${extra}${femaleExtra}</g>
      ${glassesSVG}
    </g>
    <rect x="17" y="22" width="6" height="4" fill="${c.skin}"/>
    <rect class="am-body" x="${bodyX}" y="24" width="${bodyWidth}" height="14" rx="4" fill="${c.shirt}" style="animation-delay:${delay}ms"/>
    ${armL}${isRaising?armR_raising:''}
    ${tieSVG}${zzz}${deskHTML}
  </svg>`;
}

function makeSideSVG(mood, c, ch, dir='right', scale=1) {
  if(dir==='front') return makeSVG(mood, c, ch, 0, false, scale);
  const isFemale = c.gender==='F';
  const isCold=mood==='cold', isApplause=mood==='applause', isNodding=mood==='nodding';
  const isBored=mood==='bored', isInterested=mood==='interested', isPhone=mood==='phone';
  const isRaising=mood==='raising';
  const flipX = dir==='left' ? 'scale(-1,1) translate(-40,0)' : '';

  let faceDetail='';
  if(isCold){
    faceDetail=`<circle cx="26" cy="13" r="1.5" fill="#111"/>
      <line x1="23" y1="11" x2="28" y2="11" stroke="#222" stroke-width="1" stroke-linecap="round"/>
      <path d="M22 17 Q25 15 28 17" stroke="#222" stroke-width="1" fill="none" stroke-linecap="round"/>`;
  }else if(isApplause||isInterested||isNodding){
    faceDetail=`<circle cx="26" cy="13" r="1.5" fill="#222"/>
      <circle cx="26.5" cy="12.5" r="0.5" fill="white"/>
      <path d="M22 17 Q25 19 28 17" stroke="#444" stroke-width="1" fill="none" stroke-linecap="round"/>`;
  }else if(isBored){
    faceDetail=`<path d="M24 13 Q26 14.5 28 13" stroke="#888" stroke-width="1.2" fill="none" stroke-linecap="round"/>
      <path d="M22 17 Q25 17.5 28 17" stroke="#aaa" stroke-width="1" fill="none" stroke-linecap="round"/>`;
  }else if(isPhone){
    faceDetail=`<circle cx="26" cy="14" r="1.5" fill="#333"/>
      <path d="M22 17.5 Q25 18.5 28 17.5" stroke="#555" stroke-width="1" fill="none" stroke-linecap="round"/>`;
  }else{
    faceDetail=`<circle cx="26" cy="13" r="1.5" fill="#333"/>
      <path d="M22 17 Q25 18.5 28 17" stroke="#555" stroke-width="1" fill="none" stroke-linecap="round"/>`;
  }

  const nose = `<path d="M28 14 Q30 16 28 18" stroke="${c.skin}" stroke-width="1.5" fill="none" stroke-linecap="round" opacity="0.6"/>`;
  const sideGlasses = c.glasses ? makeSideGlasses(c.glassesStyle, dir) : '';
  const sideEarring = isFemale ? `<circle cx="17.5" cy="18" r="1.2" fill="#E8C84A" opacity="0.85"/>` : '';
  const hairSVG    = makeSideHair(c.hair, c.hairColor, dir);
  const tieSideSVG = makeTieSide(c.tieColor, dir);

  let armHTML='', armOverHTML='';
  if(isApplause){
    armOverHTML=`<path class="am-arm-r" d="M24 27 Q26 20 25 13" stroke="${c.armR}" stroke-width="5" stroke-linecap="round" fill="none"/>
                 <circle cx="25" cy="12" r="3.5" fill="${c.skin}"/>`;
  }else if(isRaising){
    armOverHTML=`<g class="am-arm-r">
      <path d="M25 27 Q27 18 26 10" stroke="${c.armR}" stroke-width="5" stroke-linecap="round" fill="none"/>
      <circle cx="26" cy="9" r="3.5" fill="${c.skin}"/>
    </g>`;
  }else if(isCold){
    armHTML=`<path d="M16 29 Q24 31 32 29" stroke="${c.shirt}" stroke-width="5" stroke-linecap="round" fill="none"/>`;
  }else if(isPhone){
    armOverHTML=`<path class="am-arm-r" d="M25 27 Q28 24 27 19" stroke="${c.armR}" stroke-width="5" stroke-linecap="round" fill="none"/>
                 <rect x="23" y="16" width="7" height="5" rx="1" fill="#333"/>`;
  }else{
    armHTML=`<path class="am-arm-r" d="M25 27 Q28 32 26 38" stroke="${c.armR}" stroke-width="5" stroke-linecap="round" fill="none"/>`;
  }

  const zzz = isBored ? `<text class="zzz-1" x="30" y="8" font-size="6" fill="#90A4AE">z</text>
    <text class="zzz-2" x="33" y="5" font-size="8" fill="#90A4AE">z</text>` : '';
  const moodCls = isApplause?'side-applause':isRaising?'mood-raising':isBored?'side-bored':isNodding?'side-nodding':isInterested?'side-interested':`side-${mood}`;

  const w = Math.round(50*scale), h = Math.round(62*scale);
  return `<svg class="${moodCls}" width="${w}" height="${h}" viewBox="0 0 40 58" fill="none">
    <g transform="${flipX}">
      <rect x="6" y="24" width="26" height="14" rx="3" fill="${ch.back}"/>
      <rect class="am-body" x="14" y="25" width="16" height="13" rx="3" fill="${c.shirt}"/>
      <rect x="17" y="21" width="6" height="5" fill="${c.skin}"/>
      <g class="am-face">
        <ellipse cx="22" cy="14" rx="7" ry="8.5" fill="${c.skin}"/>
        ${sideEarring}${nose}${faceDetail}${sideGlasses}
      </g>
      ${hairSVG}${armHTML}${zzz}${armOverHTML}${tieSideSVG}
    </g>
  </svg>`;
}

function makeEmptySeatSVG(ch, hasDesk=true, scale=1) {
  const deskHTML = hasDesk&&ch.desk ? `
    <rect x="0" y="40" width="40" height="20" rx="2" fill="${ch.desk}" opacity="0.55"/>
    <rect x="0" y="38" width="40" height="4" rx="1" fill="${ch.deskTop}" opacity="0.55"/>` : '';
  const w=Math.round(54*scale), h=Math.round(68*scale);
  return `<svg width="${w}" height="${h}" viewBox="0 0 40 60" fill="none">
    <rect x="6" y="23" width="28" height="16" rx="3" fill="${ch.back}" opacity="0.45"/>
    <rect x="9" y="36" width="22" height="5" rx="2" fill="${ch.back}" opacity="0.3"/>
    ${deskHTML}
  </svg>`;
}

function shuffle(arr) {
  const a=[...arr];
  for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}
  return a;
}

export default function AudienceSimulator({ roomType='classroom', audienceType='general', count=8, memberMoods=[] }) {
  const areaRef = useRef(null);
  const render = useCallback(() => {
    const area = areaRef.current;
    if(!area) return;
    area.innerHTML = '';
    const colors = getColors(audienceType);
    const ch     = CHAIR_COLORS[roomType] || CHAIR_COLORS.classroom;
    if(roomType==='interview')        renderInterview(area, colors, ch, memberMoods);
    else if(roomType==='audiovisual') renderAudiovisual(area, colors, ch, count, memberMoods);
    else if(roomType==='classroom')   renderClassroom(area, colors, ch, count, memberMoods);
    else if(roomType==='meeting')     renderMeeting(area, colors, ch, memberMoods);
  }, [roomType, audienceType, count, memberMoods]);
  useEffect(() => { render(); }, [render]);
  return <div ref={areaRef} className="audience-sim-area" />;
}

function renderInterview(area, colors, ch, moods) {
  area.style.cssText='width:100%;position:relative;z-index:10;display:flex;flex-direction:row;gap:4px;justify-content:center;align-items:flex-end;padding:0 1rem';
  for(let i=0;i<4;i++){
    const div=document.createElement('div');
    div.className='sim-member-wrap';
    div.innerHTML=`<div class="sim-svg-slot">${makeSVG(moods[i]||'neutral',colors[i%colors.length],ch,0,true,1)}</div>`;
    area.appendChild(div);
  }
}

function renderAudiovisual(area, colors, ch, count, moods) {
  area.style.cssText='width:100%;position:relative;z-index:10;display:flex;flex-direction:column;align-items:center;gap:1px;padding:0 0.5rem';
  const ROWS=4,COLS=5,TOTAL=ROWS*COLS;
  const seats=shuffle([...Array(TOTAL).keys()]);
  const occupied=new Set(seats.slice(0,count));
  let mi=0;
  for(let r=0;r<ROWS;r++){
    const rowEl=document.createElement('div');
    rowEl.style.cssText='display:flex;gap:2px;justify-content:center';
    for(let c=0;c<COLS;c++){
      const s=r*COLS+c;
      const div=document.createElement('div');
      div.style.cssText='display:flex;flex-direction:column;align-items:center';
      if(occupied.has(s)){
        div.className='sim-member-wrap';
        div.innerHTML=`<div class="sim-svg-slot">${makeSVG(moods[mi]||'neutral',colors[mi%colors.length],ch,0,false,0.62)}</div>`;
        mi++;
      }else{
        div.className='sim-member-wrap empty-seat';
        div.innerHTML=`<div class="sim-svg-slot">${makeEmptySeatSVG(ch,false,0.62)}</div>`;
      }
      rowEl.appendChild(div);
    }
    area.appendChild(rowEl);
  }
}

function renderClassroom(area, colors, ch, count, moods) {
  area.style.cssText='width:100%;position:relative;z-index:10;display:flex;flex-direction:column;align-items:center;gap:2px;padding:0 0.5rem';
  const COLS=6,ROWS=3,TOTAL=COLS*ROWS;
  const seats=shuffle([...Array(TOTAL).keys()]);
  const occupied=new Set(seats.slice(0,count));
  let mi=0;
  for(let r=0;r<ROWS;r++){
    const rowEl=document.createElement('div');
    rowEl.style.cssText='display:flex;gap:2px;justify-content:center';
    for(let c=0;c<COLS;c++){
      const s=r*COLS+c;
      const div=document.createElement('div');
      div.style.cssText='display:flex;flex-direction:column;align-items:center';
      if(occupied.has(s)){
        div.className='sim-member-wrap';
        div.innerHTML=`<div class="sim-svg-slot">${makeSVG(moods[mi]||'neutral',colors[mi%colors.length],ch,0,true,0.68)}</div>`;
        mi++;
      }else{
        div.className='sim-member-wrap empty-seat';
        div.innerHTML=`<div class="sim-svg-slot">${makeEmptySeatSVG(ch,true,0.68)}</div>`;
      }
      rowEl.appendChild(div);
    }
    area.appendChild(rowEl);
  }
}

function renderMeeting(area, colors, ch, moods) {
  area.style.cssText='width:100%;position:relative;z-index:10;min-height:260px';
  const table=document.createElement('div');
  table.className='meeting-vtable';
  area.appendChild(table);
  const configs=[
    {idx:0,left:'20%',top:'18%',dir:'right'},
    {idx:1,left:'20%',top:'56%',dir:'right'},
    {idx:2,left:'50%',top:'6%', dir:'front',transform:'translateX(-50%)'},
    {idx:3,left:'62%',top:'18%',dir:'left'},
    {idx:4,left:'62%',top:'56%',dir:'left'},
  ];
  configs.forEach(cfg=>{
    const c=colors[cfg.idx%colors.length];
    const mood=moods[cfg.idx]||'neutral';
    const div=document.createElement('div');
    div.className='sim-member-wrap';
    div.style.cssText=`position:absolute;left:${cfg.left};top:${cfg.top};transform:${cfg.transform||''};z-index:10`;
    const svg=cfg.dir==='front'?makeSVG(mood,c,ch,0,false,0.88):makeSideSVG(mood,c,ch,cfg.dir,0.88);
    div.innerHTML=`<div class="sim-svg-slot">${svg}</div>`;
    area.appendChild(div);
  });
}