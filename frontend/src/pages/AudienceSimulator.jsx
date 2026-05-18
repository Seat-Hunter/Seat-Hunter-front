import { useEffect, useRef, useCallback } from 'react';
import './AudienceSimulator.css';

const CHAR_PROFILES = [
  {gender:'M', hair:'short',    glasses:false, glassesStyle:'rect',  skin:'#FDBCB4', hairColor:'#2C1A0E'},
  {gender:'F', hair:'long',     glasses:false, glassesStyle:'round', skin:'#F5C87A', hairColor:'#C8860A'},
  {gender:'M', hair:'short',    glasses:true,  glassesStyle:'rect',  skin:'#C68642', hairColor:'#1C0F00'},
  {gender:'F', hair:'bob',      glasses:true,  glassesStyle:'round', skin:'#FFD0A0', hairColor:'#3D2000'},
  {gender:'M', hair:'curly',    glasses:false, glassesStyle:'rect',  skin:'#A0785A', hairColor:'#0D0500'},
  {gender:'F', hair:'ponytail', glasses:false, glassesStyle:'round', skin:'#FDBCB4', hairColor:'#8B4513'},
  {gender:'M', hair:'short',    glasses:false, glassesStyle:'rect',  skin:'#FFD0A0', hairColor:'#2C1A0E'},
  {gender:'F', hair:'medium',   glasses:true,  glassesStyle:'rect',  skin:'#C68642', hairColor:'#1A0A00'},
  {gender:'M', hair:'short',    glasses:true,  glassesStyle:'round', skin:'#FDBCB4', hairColor:'#111111'},
  {gender:'F', hair:'wavy',     glasses:false, glassesStyle:'round', skin:'#F5C87A', hairColor:'#5C3010'},
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
    tieColor: ties[i%ties.length], hairColor: p.hairColor,
    hair: p.hair, glasses: p.glasses, glassesStyle: p.glassesStyle, gender: p.gender,
  }));
}

/* ── 앞모습 머리카락 ── */
function makeHairFront(style, hc, skin) {
  switch(style) {
    case 'short':
      return `
        <path d="M8 14 Q8 1 20 1 Q32 1 32 14 Q27 8 20 8 Q13 8 8 14Z" fill="${hc}"/>
        <rect x="7.5" y="12" width="4.5" height="4" rx="1.5" fill="${hc}"/>
        <rect x="28" y="12" width="4.5" height="4" rx="1.5" fill="${hc}"/>
        <path d="M8.5 11 Q14 11 20 9 Q26 11 31.5 11Z" fill="${hc}"/>`;
    case 'long':
      return `
        <path d="M8 14 Q8 1 20 1 Q32 1 32 14 Q27 8 20 8 Q13 8 8 14Z" fill="${hc}"/>
        <rect x="6.5" y="11" width="5.5" height="30" rx="2.5" fill="${hc}"/>
        <rect x="28" y="11" width="5.5" height="30" rx="2.5" fill="${hc}"/>
        <path d="M8.5 11 Q15 11 18 11 Q22 11 31.5 11Z" fill="${hc}"/>
        <path d="M7 34 Q7 40 9 44" stroke="${hc}" stroke-width="4" stroke-linecap="round" fill="none"/>
        <path d="M33 34 Q33 40 31 44" stroke="${hc}" stroke-width="4" stroke-linecap="round" fill="none"/>`;
    case 'bob':
      return `
        <path d="M8 14 Q8 1 20 1 Q32 1 32 14 Q27 8 20 8 Q13 8 8 14Z" fill="${hc}"/>
        <rect x="6.5" y="11" width="5.5" height="20" rx="2.5" fill="${hc}"/>
        <rect x="28" y="11" width="5.5" height="20" rx="2.5" fill="${hc}"/>
        <path d="M7.5 11 Q20 11 32.5 11Z" fill="${hc}"/>
        <rect x="6.5" y="29" width="27" height="4" rx="2" fill="${hc}"/>`;
    case 'medium':
      return `
        <path d="M8 14 Q8 1 20 1 Q32 1 32 14 Q27 8 20 8 Q13 8 8 14Z" fill="${hc}"/>
        <rect x="6.5" y="11" width="5.5" height="24" rx="2.5" fill="${hc}"/>
        <rect x="28" y="11" width="5.5" height="24" rx="2.5" fill="${hc}"/>
        <path d="M8 11 Q14 11 20 10 Q26 11 32 11Z" fill="${hc}"/>`;
    case 'ponytail':
      return `
        <path d="M8 14 Q8 1 20 1 Q32 1 32 14 Q27 8 20 8 Q13 8 8 14Z" fill="${hc}"/>
        <rect x="7.5" y="12" width="4.5" height="5" rx="1.5" fill="${hc}"/>
        <rect x="28" y="12" width="4.5" height="5" rx="1.5" fill="${hc}"/>
        <path d="M8 11 Q13 11 20 11 Q27 11 32 11Z" fill="${hc}"/>
        <ellipse cx="20" cy="3" rx="6" ry="2.5" fill="${hc}"/>
        <rect x="18" y="0.5" width="5" height="18" rx="2.5" fill="${hc}"/>`;
    case 'wavy':
      return `
        <path d="M8 14 Q8 1 20 1 Q32 1 32 14 Q27 8 20 8 Q13 8 8 14Z" fill="${hc}"/>
        <rect x="6.5" y="11" width="5.5" height="16" rx="2.5" fill="${hc}"/>
        <rect x="28" y="11" width="5.5" height="16" rx="2.5" fill="${hc}"/>
        <path d="M8 11 Q20 11 32 11Z" fill="${hc}"/>
        <path d="M7 26 Q5 32 8 38 Q6 42 8 46" stroke="${hc}" stroke-width="5" stroke-linecap="round" fill="none"/>
        <path d="M33 26 Q35 32 32 38 Q34 42 32 46" stroke="${hc}" stroke-width="5" stroke-linecap="round" fill="none"/>`;
    case 'curly':
      return `
        <ellipse cx="20" cy="5" rx="13" ry="8" fill="${hc}"/>
        <circle cx="9" cy="9" r="5.5" fill="${hc}"/>
        <circle cx="31" cy="9" r="5.5" fill="${hc}"/>
        <circle cx="13" cy="5" r="4.5" fill="${hc}"/>
        <circle cx="27" cy="5" r="4.5" fill="${hc}"/>
        <circle cx="20" cy="2" r="4" fill="${hc}"/>
        <path d="M9 11 Q14 11 20 11 Q26 11 31 11Z" fill="${hc}"/>`;
    default:
      return `<path d="M8 14 Q8 1 20 1 Q32 1 32 14 Q27 8 20 8 Q13 8 8 14Z" fill="${hc}"/>`;
  }
}

/* ── 앞모습 안경 ── */
function makeGlassesFront(style) {
  if(style==='round') return `
    <circle cx="15.5" cy="14" r="4.2" fill="none" stroke="#222" stroke-width="1.8"/>
    <circle cx="24.5" cy="14" r="4.2" fill="none" stroke="#222" stroke-width="1.8"/>
    <line x1="19.7" y1="14" x2="20.3" y2="14" stroke="#222" stroke-width="1.8"/>
    <line x1="11.3" y1="13.5" x2="9.5" y2="13" stroke="#222" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="28.7" y1="13.5" x2="30.5" y2="13" stroke="#222" stroke-width="1.5" stroke-linecap="round"/>`;
  return `
    <rect x="11" y="10.5" width="8" height="6.5" rx="1.5" fill="none" stroke="#222" stroke-width="1.8"/>
    <rect x="21" y="10.5" width="8" height="6.5" rx="1.5" fill="none" stroke="#222" stroke-width="1.8"/>
    <line x1="19" y1="13.8" x2="21" y2="13.8" stroke="#222" stroke-width="1.8"/>
    <line x1="11" y1="13.5" x2="9.5" y2="13" stroke="#222" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="29" y1="13.5" x2="30.5" y2="13" stroke="#222" stroke-width="1.5" stroke-linecap="round"/>`;
}

/* ── 옆모습 머리카락 ── */
function makeSideHair(style, hc) {
  switch(style) {
    case 'short':
      return `
        <path d="M4 16 Q3 1 20 1 Q31 1 33 11 Q34 14 32 16 Q29 9 24 7 Q18 6 14 8 Q10 11 11 16Z" fill="${hc}"/>
        <path d="M4 15 Q4 24 13 25 Q10 21 11 16 Z" fill="${hc}"/>
        <path d="M22 4 Q33 5 32 10 Q28 8 22 7 Z" fill="${hc}"/>`;
    case 'long': case 'medium':
      return `
        <path d="M4 16 Q3 1 20 1 Q31 1 33 11 Q34 14 32 16 Q29 9 24 7 Q18 6 14 8 Q10 11 11 16Z" fill="${hc}"/>
        <path d="M4 15 Q3 ${style==='medium'?'35':'45'} 13 ${style==='medium'?'36':'46'} Q11 ${style==='medium'?'28':'38'} 11 16Z" fill="${hc}"/>
        <path d="M22 4 Q33 5 32 11 Q28 8 22 7 Z" fill="${hc}"/>`;
    case 'bob':
      return `
        <path d="M4 16 Q3 1 20 1 Q31 1 33 11 Q34 14 32 16 Q29 9 24 7 Q18 6 14 8 Q10 11 11 16Z" fill="${hc}"/>
        <path d="M4 15 Q3 30 13 32 Q10 26 11 16Z" fill="${hc}"/>
        <path d="M4 30 Q12 32 21 32 Q13 33 4 31Z" fill="${hc}"/>
        <path d="M22 4 Q33 5 32 10 Q28 8 22 7 Z" fill="${hc}"/>`;
    case 'ponytail':
      return `
        <path d="M4 16 Q3 1 20 1 Q31 1 33 11 Q34 14 32 16 Q29 9 24 7 Q18 6 14 8 Q11 12 16Z" fill="${hc}"/>
        <path d="M4 15 Q4 24 13 25 Q10 21 11 16 Z" fill="${hc}"/>
        <rect x="2" y="4" width="5" height="24" rx="2.5" fill="${hc}"/>
        <path d="M22 4 Q33 5 32 10 Q28 8 22 7 Z" fill="${hc}"/>`;
    case 'wavy':
      return `
        <path d="M4 16 Q3 1 20 1 Q31 1 33 11 Q34 14 32 16 Q29 9 24 7 Q18 6 14 8 Q10 11 11 16Z" fill="${hc}"/>
        <path d="M4 15 Q2 26 5 34 Q3 40 5 46 Q10 38 11 16Z" fill="${hc}"/>
        <path d="M22 4 Q33 5 32 11 Q28 8 22 7 Z" fill="${hc}"/>`;
    case 'curly':
      return `
        <circle cx="14" cy="5"   r="6" fill="${hc}"/>
        <circle cx="22" cy="3"   r="5.5" fill="${hc}"/>
        <circle cx="29" cy="6"   r="5.5" fill="${hc}"/>
        <circle cx="33" cy="11"  r="5" fill="${hc}"/>
        <circle cx="9"  cy="10"  r="5.5" fill="${hc}"/>
        <circle cx="7"  cy="17"  r="5" fill="${hc}"/>
        <path d="M4 15 Q3 24 12 25 Q10 20 11 16Z" fill="${hc}"/>
        <path d="M21 5 Q31 7 30 11 L25 8Z" fill="${hc}"/>`;
    default:
      return `<path d="M4 16 Q3 1 20 1 Q31 1 33 11 Q34 14 32 16 Q29 9 24 7 Q18 6 14 8 Q10 11 11 16Z" fill="${hc}"/>`;
  }
}

/* ── 옆모습 안경 ── */
function makeSideGlasses(style) {
  if(style==='round') return `
    <circle cx="28" cy="15" r="4" fill="none" stroke="#222" stroke-width="1.6"/>
    <line x1="32" y1="14.5" x2="34.5" y2="14" stroke="#222" stroke-width="1.3" stroke-linecap="round"/>`;
  return `
    <rect x="23" y="12" width="9" height="6" rx="1.3" fill="none" stroke="#222" stroke-width="1.6"/>
    <line x1="32" y1="14.5" x2="34.5" y2="14" stroke="#222" stroke-width="1.3" stroke-linecap="round"/>`;
}

function makeTieFront(tieColor) {
  const dk = shadeColor(tieColor, -30);
  return `
    <polygon points="18,23 22,23 22.5,27 20,28.5 17.5,27" fill="${dk}"/>
    <polygon points="17.6,27 22.4,27 21.2,37 20,38.5 18.8,37" fill="${tieColor}"/>`;
}

function makeTieSide(tieColor) {
  const dk = shadeColor(tieColor, -30);
  return `
    <polygon points="21,24 24,24 24,28 22.5,29 21,28" fill="${dk}"/>
    <polygon points="21.2,28 24,28 23.5,38 22.5,39 21.5,38" fill="${tieColor}"/>`;
}

/* ── 앞모습 SVG ── */
function makeSVG(mood, c, ch, delay=0, hasDesk=true, scale=1) {
  const isCold=mood==='cold', isApplause=mood==='applause', isRaising=mood==='raising';
  const isBored=mood==='bored', isConfused=mood==='confused', isPhone=mood==='phone';
  const isInterested=mood==='interested', isNodding=mood==='nodding';
  const isFemale = c.gender==='F';

  let eyes='', mouth='', brow='';
  const EY = 14;
  const ELX=16, ERX=24;

  if(isCold) {
    eyes = `<circle cx="${ELX}" cy="${EY}" r="2" fill="#333"/>
            <circle cx="${ERX}" cy="${EY}" r="2" fill="#333"/>
            <line x1="${ELX-3}" y1="${EY-2}" x2="${ELX+2.5}" y2="${EY-2}" stroke="#333" stroke-width="1.3" stroke-linecap="round"/>
            <line x1="${ERX-2.5}" y1="${EY-2}" x2="${ERX+3}" y2="${EY-2}" stroke="#333" stroke-width="1.3" stroke-linecap="round"/>`;
    mouth = `<path d="M16 20 Q20 18.5 24 20" stroke="#666" stroke-width="1.3" fill="none" stroke-linecap="round"/>`;
  } else if(isApplause) {
    eyes = `<path d="M${ELX-3} ${EY} Q${ELX} ${EY-3} ${ELX+3} ${EY}" stroke="#333" stroke-width="2" fill="none" stroke-linecap="round"/>
            <path d="M${ERX-3} ${EY} Q${ERX} ${EY-3} ${ERX+3} ${EY}" stroke="#333" stroke-width="2" fill="none" stroke-linecap="round"/>`;
    mouth = `<path d="M14 19.5 Q20 25 26 19.5" stroke="#333" stroke-width="1.5" fill="none" stroke-linecap="round"/>`;
    brow = `<path d="M13.5 11 Q${ELX} 9.5 18.5 11" stroke="#555" stroke-width="1.1" fill="none" stroke-linecap="round"/>
            <path d="M21.5 11 Q${ERX} 9.5 26.5 11" stroke="#555" stroke-width="1.1" fill="none" stroke-linecap="round"/>`;
  } else if(isRaising) {
    eyes = `<circle cx="${ELX}" cy="${EY}" r="2.2" fill="#222"/>
            <circle cx="${ELX+0.5}" cy="${EY-0.8}" r="0.7" fill="white"/>
            <circle cx="${ERX}" cy="${EY}" r="2.2" fill="#222"/>
            <circle cx="${ERX+0.5}" cy="${EY-0.8}" r="0.7" fill="white"/>`;
    mouth = `<ellipse cx="20" cy="20.5" rx="2.5" ry="1.8" fill="#C62828"/>`;
    brow = `<path d="M13.5 10.5 Q${ELX} 9 18.5 10.5" stroke="#444" stroke-width="1.2" fill="none" stroke-linecap="round"/>
            <path d="M21.5 10.5 Q${ERX} 9 26.5 10.5" stroke="#444" stroke-width="1.2" fill="none" stroke-linecap="round"/>`;
  } else if(isBored) {
    eyes = `<path d="M${ELX-2.5} ${EY-0.5} Q${ELX} ${EY+2} ${ELX+2.5} ${EY-0.5}" stroke="#aaa" stroke-width="1.8" fill="none" stroke-linecap="round"/>
            <path d="M${ERX-2.5} ${EY-0.5} Q${ERX} ${EY+2} ${ERX+2.5} ${EY-0.5}" stroke="#aaa" stroke-width="1.8" fill="none" stroke-linecap="round"/>`;
    mouth = `<path d="M16.5 20 Q20 20.8 23.5 20" stroke="#ccc" stroke-width="1.2" fill="none" stroke-linecap="round"/>`;
  } else if(isConfused) {
    eyes = `<circle cx="${ELX}" cy="${EY}" r="2" fill="#444"/>
            <circle cx="${ERX}" cy="${EY}" r="2" fill="#444"/>`;
    mouth = `<path d="M16 20 Q18 22 21 19.5 Q23 18.5 25 20" stroke="#666" stroke-width="1.3" fill="none" stroke-linecap="round"/>`;
    brow = `<path d="M14 11.5 Q${ELX} 10.5 18.5 11.5" stroke="#666" stroke-width="1" fill="none" stroke-linecap="round"/>
            <path d="M21.5 11 Q${ERX} 12 26.5 11" stroke="#666" stroke-width="1" fill="none" stroke-linecap="round"/>`;
  } else if(isPhone) {
    eyes = `<circle cx="${ELX}" cy="${EY+1}" r="1.8" fill="#555"/>
            <circle cx="${ERX}" cy="${EY+1}" r="1.8" fill="#555"/>`;
    mouth = `<path d="M16.5 20 Q20 21 23.5 20" stroke="#888" stroke-width="1.2" fill="none" stroke-linecap="round"/>`;
  } else if(isInterested||isNodding) {
    eyes = `<circle cx="${ELX}" cy="${EY}" r="2.2" fill="#222"/>
            <circle cx="${ELX+0.6}" cy="${EY-0.7}" r="0.7" fill="white"/>
            <circle cx="${ERX}" cy="${EY}" r="2.2" fill="#222"/>
            <circle cx="${ERX+0.6}" cy="${EY-0.7}" r="0.7" fill="white"/>`;
    mouth = `<path d="M15.5 19.5 Q20 23.5 24.5 19.5" stroke="#444" stroke-width="1.3" fill="none" stroke-linecap="round"/>`;
    brow = `<path d="M14 11.5 Q${ELX} 10.5 18.5 11.5" stroke="#555" stroke-width="1" fill="none" stroke-linecap="round"/>
            <path d="M21.5 11.5 Q${ERX} 10.5 26.5 11.5" stroke="#555" stroke-width="1" fill="none" stroke-linecap="round"/>`;
  } else {
    eyes = `<circle cx="${ELX}" cy="${EY}" r="2" fill="#333"/>
            <circle cx="${ELX+0.5}" cy="${EY-0.6}" r="0.6" fill="white"/>
            <circle cx="${ERX}" cy="${EY}" r="2" fill="#333"/>
            <circle cx="${ERX+0.5}" cy="${EY-0.6}" r="0.6" fill="white"/>`;
    mouth = `<path d="M16 19.5 Q20 23 24 19.5" stroke="#555" stroke-width="1.3" fill="none" stroke-linecap="round"/>`;
    brow = `<path d="M14 11.5 Q${ELX} 10.5 18.5 11.5" stroke="#777" stroke-width="0.9" fill="none" stroke-linecap="round"/>
            <path d="M21.5 11.5 Q${ERX} 10.5 26.5 11.5" stroke="#777" stroke-width="0.9" fill="none" stroke-linecap="round"/>`;
  }

  const zzz = isBored ? `
    <text class="zzz-1" x="27" y="10" font-size="7" fill="#90A4AE" font-weight="500">z</text>
    <text class="zzz-2" x="31" y="6"  font-size="9" fill="#90A4AE" font-weight="500">z</text>
    <text class="zzz-3" x="35" y="2"  font-size="11" fill="#90A4AE" font-weight="500">z</text>` : '';

  const BX=10, BY=28, BW=20, BH=14;
  const ALX=BX-5, ARX=BX+BW;

  let armL='', armR='';
  if(isCold) {
    armL=`<rect x="${ALX}" y="${BY+1}" width="5" height="9" rx="2.5" fill="${c.shirt}"/>`;
    armR=`<rect x="${ARX}" y="${BY+1}" width="5" height="9" rx="2.5" fill="${c.shirt}"/>
          <rect x="${BX+1}" y="${BY+7}" width="${BW-2}" height="4.5" rx="2" fill="${shadeColor(c.shirt,-25)}"/>`;
  } else if(isApplause) {
    armL=`<rect x="${ALX-2}" y="${BY+2}" width="5" height="9" rx="2.5" fill="${c.shirt}"/>
          <circle cx="${ALX}" cy="${BY+12}" r="3.5" fill="${c.skin}"/>`;
    armR=`<rect x="${ARX+2}" y="${BY+2}" width="5" height="9" rx="2.5" fill="${c.shirt}"/>
          <circle cx="${ARX+4}" cy="${BY+12}" r="3.5" fill="${c.skin}"/>`;
  } else if(isRaising) {
    armL=`<rect x="${ALX}" y="${BY+1}" width="5" height="10" rx="2.5" fill="${c.shirt}"/>`;
    armR=`<rect x="${ARX}" y="${BY-10}" width="5" height="15" rx="2.5" fill="${c.shirt}"/>
          <circle cx="${ARX+2.5}" cy="${BY-11}" r="3.5" fill="${c.skin}"/>`;
  } else if(isPhone) {
    armL=`<rect x="${ALX}" y="${BY+1}" width="5" height="10" rx="2.5" fill="${c.shirt}"/>`;
    armR=`<rect x="${ARX}" y="${BY+1}" width="5" height="7" rx="2.5" fill="${c.shirt}"/>
          <rect x="${ARX-1}" y="${BY+5}" width="7.5" height="10" rx="1.5" fill="#2a2a2a"/>`;
  } else {
    armL=`<rect x="${ALX}" y="${BY+1}" width="5" height="10" rx="2.5" fill="${c.shirt}"/>`;
    armR=`<rect x="${ARX}" y="${BY+1}" width="5" height="10" rx="2.5" fill="${c.shirt}"/>`;
  }

  const earring = isFemale
    ? `<circle cx="9.5" cy="17.5" r="1.5" fill="#E8C84A"/>
       <circle cx="30.5" cy="17.5" r="1.5" fill="#E8C84A"/>` : '';

  const deskHTML = hasDesk && ch.desk ? `
    <rect x="0" y="42" width="40" height="18" rx="2" fill="${ch.desk}"/>
    <rect x="0" y="40" width="40" height="4" rx="1" fill="${ch.deskTop}"/>` : '';

  const w = Math.round(54*scale), h = Math.round(68*scale);
  return `<svg class="mood-${mood}" width="${w}" height="${h}" viewBox="0 0 40 60" fill="none">
    <rect x="5" y="26" width="30" height="14" rx="3" fill="${ch.back}"/>
    ${isRaising?'':`<rect x="${ARX}" y="${BY+1}" width="5" height="10" rx="2.5" fill="${c.shirt}"/>`}
    ${isRaising?'':(isApplause?`<rect x="${ARX+2}" y="${BY+2}" width="5" height="9" rx="2.5" fill="${c.shirt}"/>
          <circle cx="${ARX+4}" cy="${BY+12}" r="3.5" fill="${c.skin}"/>`:
      isPhone?`<rect x="${ARX}" y="${BY+1}" width="5" height="7" rx="2.5" fill="${c.shirt}"/>
          <rect x="${ARX-1}" y="${BY+5}" width="7.5" height="10" rx="1.5" fill="#2a2a2a"/>`:
      isCold?`<rect x="${ARX}" y="${BY+1}" width="5" height="9" rx="2.5" fill="${c.shirt}"/>`:
      '')}
    <rect x="${BX}" y="${BY}" width="${BW}" height="${BH}" rx="3" fill="${c.shirt}"/>
    <rect x="17.5" y="22.5" width="5" height="6.5" rx="1" fill="${c.skin}"/>
    ${armL}
    ${isRaising?`<rect x="${ARX}" y="${BY-10}" width="5" height="15" rx="2.5" fill="${c.shirt}"/>
                 <circle cx="${ARX+2.5}" cy="${BY-11}" r="3.5" fill="${c.skin}"/>` : ''}
    <g class="am-face" style="animation-delay:${delay}ms">
      <circle cx="20" cy="14" r="11.5" fill="${c.skin}"/>
      ${earring}
      ${brow}${eyes}${mouth}
      ${c.glasses ? makeGlassesFront(c.glassesStyle) : ''}
      ${makeHairFront(c.hair, c.hairColor, c.skin)}
    </g>
    ${makeTieFront(c.tieColor)}
    ${zzz}${deskHTML}
    ${isCold?`<rect x="${BX+1}" y="${BY+7}" width="${BW-2}" height="4.5" rx="2" fill="${shadeColor(c.shirt,-25)}"/>`:''}
  </svg>`;
}

/* ── 옆모습 SVG ── */
function makeSideSVG(mood, c, ch, dir='right', scale=1) {
  if(dir==='front') return makeSVG(mood, c, ch, 0, false, scale);

  const isFemale = c.gender==='F';
  const isCold=mood==='cold', isApplause=mood==='applause';
  const isBored=mood==='bored', isInterested=mood==='interested';
  const isNodding=mood==='nodding', isPhone=mood==='phone', isRaising=mood==='raising';

  const flipX = dir==='left' ? 'scale(-1,1) translate(-44,0)' : '';

  const EX=29, EY=15;
  let eyeSVG='', mouthSVG='', browSVG='';
  if(isCold) {
    eyeSVG=`<circle cx="${EX}" cy="${EY}" r="1.8" fill="#333"/>
             <line x1="${EX-2.5}" y1="${EY-2}" x2="${EX+2}" y2="${EY-2}" stroke="#333" stroke-width="1.1" stroke-linecap="round"/>`;
    mouthSVG=`<path d="M25 21 Q28 19.5 31 21" stroke="#888" stroke-width="1.1" fill="none" stroke-linecap="round"/>`;
  } else if(isApplause||isInterested||isNodding) {
    eyeSVG=`<path d="M${EX-3} ${EY} Q${EX} ${EY-2.5} ${EX+3} ${EY}" stroke="#333" stroke-width="1.8" fill="none" stroke-linecap="round"/>`;
    mouthSVG=`<path d="M25 21 Q28 23.5 31 21" stroke="#555" stroke-width="1.1" fill="none" stroke-linecap="round"/>`;
    browSVG=`<path d="M${EX-3} ${EY-3.5} Q${EX} ${EY-5} ${EX+2} ${EY-3}" stroke="#666" stroke-width="1" fill="none" stroke-linecap="round"/>`;
  } else if(isBored) {
    eyeSVG=`<path d="M${EX-2.5} ${EY-0.5} Q${EX} ${EY+2} ${EX+2.5} ${EY-0.5}" stroke="#aaa" stroke-width="1.6" fill="none" stroke-linecap="round"/>`;
    mouthSVG=`<path d="M25 21 Q28 21.5 31 21" stroke="#ccc" stroke-width="1.1" fill="none" stroke-linecap="round"/>`;
  } else {
    eyeSVG=`<circle cx="${EX}" cy="${EY}" r="1.9" fill="#333"/>
             <circle cx="${EX+0.5}" cy="${EY-0.6}" r="0.6" fill="white"/>`;
    mouthSVG=`<path d="M25 21 Q28 23.5 31 21" stroke="#666" stroke-width="1.1" fill="none" stroke-linecap="round"/>`;
    browSVG=`<path d="M${EX-3} ${EY-3} Q${EX} ${EY-4.5} ${EX+2} ${EY-3}" stroke="#777" stroke-width="0.9" fill="none" stroke-linecap="round"/>`;
  }

  const noseSVG=`<path d="M31 17 Q34 19 31 22" stroke="${shadeColor(c.skin,-22)}" stroke-width="1.3" fill="none" stroke-linecap="round"/>`;
  const earSVG=`<ellipse cx="12" cy="17" rx="2.2" ry="3" fill="${shadeColor(c.skin,-15)}" stroke="${shadeColor(c.skin,-30)}" stroke-width="0.6"/>`;
  const sideEarring = isFemale ? `<circle cx="12" cy="20.5" r="1.4" fill="#E8C84A"/>` : '';
  const neckSVG=`<rect x="18" y="24" width="8" height="7" rx="1" fill="${c.skin}"/>`;
  const chairSVG=`<rect x="5" y="28" width="22" height="14" rx="3" fill="${ch.back}"/>`;

  const BY=30;
  const bodySVG=`<rect x="10" y="${BY}" width="20" height="13" rx="3" fill="${c.shirt}"/>`;

  let armFront='', armOver='';
  if(isApplause) {
    armOver=`<rect x="22" y="18" width="5" height="14" rx="2.5" fill="${c.shirt}"/>
             <circle cx="24.5" cy="17" r="3.5" fill="${c.skin}"/>`;
  } else if(isRaising) {
    armOver=`<rect x="25" y="9" width="5" height="18" rx="2.5" fill="${c.shirt}"/>
             <circle cx="27.5" cy="8" r="3.5" fill="${c.skin}"/>`;
  } else if(isCold) {
    armFront=`<rect x="10" y="${BY+2}" width="20" height="5" rx="2.5" fill="${shadeColor(c.shirt,-20)}"/>`;
  } else if(isPhone) {
    armOver=`<rect x="26" y="24" width="5" height="11" rx="2.5" fill="${c.shirt}"/>
             <rect x="24" y="22" width="8" height="6" rx="1.5" fill="#2a2a2a"/>`;
  } else {
    armFront=`<rect x="28" y="${BY}" width="5" height="12" rx="2.5" fill="${c.shirt}"/>`;
  }

  const zzz = isBored ? `
    <text class="zzz-1" x="34" y="10" font-size="6" fill="#90A4AE">z</text>
    <text class="zzz-2" x="37" y="7"  font-size="8" fill="#90A4AE">z</text>` : '';

  const w=Math.round(50*scale), h=Math.round(62*scale);

  return `<svg class="side-${mood}" width="${w}" height="${h}" viewBox="0 0 44 58" fill="none">
    <g transform="${flipX}">
      ${chairSVG}
      ${armFront}
      ${bodySVG}
      ${neckSVG}
      <ellipse cx="22" cy="15" rx="11" ry="11" fill="${c.skin}"/>
      ${earSVG}${sideEarring}
      ${noseSVG}${browSVG}${eyeSVG}${mouthSVG}
      ${c.glasses ? makeSideGlasses(c.glassesStyle) : ''}
      ${makeSideHair(c.hair, c.hairColor)}
      ${zzz}${armOver}
      ${makeTieSide(c.tieColor)}
    </g>
  </svg>`;
}

function makeEmptySeatSVG(ch, hasDesk=true, scale=1) {
  const deskHTML = hasDesk&&ch.desk ? `
    <rect x="0" y="42" width="40" height="18" rx="2" fill="${ch.desk}" opacity="0.55"/>
    <rect x="0" y="40" width="40" height="4" rx="1" fill="${ch.deskTop}" opacity="0.55"/>` : '';
  const w=Math.round(54*scale), h=Math.round(68*scale);
  return `<svg width="${w}" height="${h}" viewBox="0 0 40 60" fill="none">
    <rect x="5" y="26" width="30" height="14" rx="3" fill="${ch.back}" opacity="0.45"/>
    <rect x="9" y="38" width="22" height="5" rx="2" fill="${ch.back}" opacity="0.3"/>
    ${deskHTML}
  </svg>`;
}

/* ── 소품 배경 레이어 함수 ── */
function makeBackgroundObjects(roomType) {
  let objs = '';
  if (roomType === 'classroom' || roomType === 'audiovisual') {
    objs = `
      <svg class="bg-curtain-l" style="position:absolute; left:2%; top:5%; width:90px; height:120px; opacity:0.15;" viewBox="0 0 60 100">
        <rect x="0" y="0" width="60" height="8" fill="#555"/>
        <rect x="4" y="10" width="52" height="2" fill="#888"/>
        <rect x="4" y="16" width="52" height="2" fill="#888"/>
        <rect x="4" y="22" width="52" height="2" fill="#888"/>
        <rect x="4" y="28" width="52" height="2" fill="#888"/>
        <rect x="4" y="34" width="52" height="2" fill="#888"/>
        <rect x="4" y="40" width="52" height="2" fill="#888"/>
        <line x1="54" y1="10" x2="54" y2="90" stroke="#666" stroke-width="1"/>
      </svg>
      <svg class="bg-plant-r" style="position:absolute; right:3%; bottom:8%; width:75px; height:150px; z-index:1" viewBox="0 0 50 100">
        <ellipse cx="25" cy="45" rx="14" ry="22" fill="#2E7D32" opacity="0.85"/>
        <ellipse cx="15" cy="50" rx="12" ry="18" fill="#1B5E20" opacity="0.9"/>
        <ellipse cx="33" cy="52" rx="11" ry="17" fill="#388E3C" opacity="0.85"/>
        <ellipse cx="24" cy="32" rx="10" ry="18" fill="#4CAF50" opacity="0.75"/>
        <line x1="25" y1="40" x2="25" y2="75" stroke="#5D4037" stroke-width="2.5"/>
        <polygon points="14,75 36,75 32,98 18,98" fill="#B0BEC5"/>
        <ellipse cx="25" cy="75" rx="11" ry="3" fill="#78909C"/>
      </svg>
    `;
  } else if (roomType === 'meeting' || roomType === 'interview') {
    objs = `
      <svg class="bg-cabinet-l" style="position:absolute; left:4%; bottom:5%; width:80px; height:110px;" viewBox="0 0 50 70">
        <rect x="2" y="25" width="46" height="42" rx="1" fill="#A1887F"/>
        <rect x="5" y="30" width="40" height="10" fill="#7E57C2" opacity="0.15"/>
        <circle cx="25" cy="35" r="2" fill="#4E342E"/>
        <rect x="5" y="44" width="40" height="10" fill="#7E57C2" opacity="0.15"/>
        <circle cx="25" cy="49" r="2" fill="#4E342E"/>
        <rect x="5" y="58" width="40" height="6" fill="#7E57C2" opacity="0.15"/>
        <rect x="20" y="15" width="10" height="10" fill="#D7CCC8"/>
        <path d="M22 15 Q20 5 25 2 Q30 5 28 15Z" fill="#2E7D32"/>
        <circle cx="22" cy="8" r="1.5" fill="#FF4081"/>
      </svg>
      <svg class="bg-curtain-r" style="position:absolute; right:2%; top:0; width:60px; height:100%; opacity:0.12;" viewBox="0 0 40 150">
        <path d="M0,0 Q10,75 0,150 L40,150 Q30,75 40,0 Z" fill="#3F51B5"/>
      </svg>
    `;
  }
  return objs;
}

function shuffle(arr) {
  const a=[...arr];
  for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}
  return a;
}

export default function AudienceSimulator({ roomType='classroom', audienceType='general', count=8, memberMoods=[] }) {
  const areaRef = useRef(null);
  const containerRef = useRef(null);

  const render = useCallback(() => {
    const area = areaRef.current;
    if(!area) return;
    area.innerHTML = '';
    const colors = getColors(audienceType);
    const ch = CHAIR_COLORS[roomType] || CHAIR_COLORS.classroom;
    
    if(roomType==='interview')       renderInterview(area, colors, ch, memberMoods);
    else if(roomType==='audiovisual') renderAudiovisual(area, colors, ch, count, memberMoods);
    else if(roomType==='classroom')   renderClassroom(area, colors, ch, count, memberMoods);
    else if(roomType==='meeting')     renderMeeting(area, colors, ch, memberMoods);
  }, [roomType, audienceType, count, memberMoods]);

  useEffect(() => { render(); }, [render]);

  return (
    <div ref={containerRef} className="audience-sim-container" style={{position:'relative', width:'100%', height:'100%', overflow:'visible', display:'flex', alignItems:'center'}}>
      <div dangerouslySetInnerHTML={{ __html: makeBackgroundObjects(roomType) }} />
      <div ref={areaRef} className="audience-sim-area" style={{position:'absolute', top:'50%', left:0, transform:'translateY(-42%)', width:'100%', height:'100%', zIndex:5, overflow:'visible'}} />
    </div>
  );
}

function renderInterview(area, colors, ch, moods) {
  area.style.cssText='width:100%;height:100%;position:absolute;display:flex;flex-direction:row;gap:4px;justify-content:center;align-items:center;padding:0 1rem;overflow:visible';
  for(let i=0;i<4;i++){
    const div=document.createElement('div');
    div.className='sim-member-wrap';
    div.innerHTML=`<div class="sim-svg-slot" style="overflow:visible; display:flex; align-items:center;">${makeSVG(moods[i]||'neutral',colors[i%colors.length],ch,0,true,1)}</div>`;
    area.appendChild(div);
  }
}

function renderAudiovisual(area, colors, ch, count, moods) {
  // 교정: 학술발표 청중 크기를 면접실 수준인 0.95로 키우고 캐릭터끼리 겹치지 않게 gap 조절
  area.style.cssText='width:100%;height:100%;position:absolute;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;padding:0 0.5rem;overflow:visible';
  const ROWS=4,COLS=5,TOTAL=ROWS*COLS;
  const seats=shuffle([...Array(TOTAL).keys()]);
  const occupied=new Set(seats.slice(0,count));
  let mi=0;
  for(let r=0;r<ROWS;r++){
    const rowEl=document.createElement('div');
    rowEl.style.cssText='display:flex;gap:8px;justify-content:center;overflow:visible;align-items:center;';
    for(let c=0;c<COLS;c++){
      const s=r*COLS+c;
      const div=document.createElement('div');
      div.style.cssText='display:flex;flex-direction:column;align-items:center;justify-content:center;overflow:visible';
      if(occupied.has(s)){
        div.className='sim-member-wrap';
        div.innerHTML=`<div class="sim-svg-slot" style="overflow:visible; display:flex; align-items:center;">${makeSVG(moods[mi]||'neutral',colors[mi%colors.length],ch,0,false,0.95)}</div>`;
        mi++;
      } else {
        div.className='sim-member-wrap empty-seat';
        div.innerHTML=`<div class="sim-svg-slot" style="overflow:visible; display:flex; align-items:center;">${makeEmptySeatSVG(ch,false,0.95)}</div>`;
      }
      rowEl.appendChild(div);
    }
    area.appendChild(rowEl);
  }
}

function renderClassroom(area, colors, ch, count, moods) {
  // 교정: 학교발표 청중 크기를 면접실 수준인 0.95로 키우고 캐릭터끼리 겹치지 않게 gap 조절
  area.style.cssText='width:100%;height:100%;position:absolute;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;padding:0 0.5rem;overflow:visible';
  const COLS=6,ROWS=3,TOTAL=COLS*ROWS;
  const seats=shuffle([...Array(TOTAL).keys()]);
  const occupied=new Set(seats.slice(0,count));
  let mi=0;
  for(let r=0;r<ROWS;r++){
    const rowEl=document.createElement('div');
    rowEl.style.cssText='display:flex;gap:8px;justify-content:center;overflow:visible;align-items:center;';
    for(let c=0;c<COLS;c++){
      const s=r*COLS+c;
      const div=document.createElement('div');
      div.style.cssText='display:flex;flex-direction:column;align-items:center;justify-content:center;overflow:visible';
      if(occupied.has(s)){
        div.className='sim-member-wrap';
        div.innerHTML=`<div class="sim-svg-slot" style="overflow:visible; display:flex; align-items:center;">${makeSVG(moods[mi]||'neutral',colors[mi%colors.length],ch,0,true,0.95)}</div>`;
        mi++;
      } else {
        div.className='sim-member-wrap empty-seat';
        div.innerHTML=`<div class="sim-svg-slot" style="overflow:visible; display:flex; align-items:center;">${makeEmptySeatSVG(ch,true,0.95)}</div>`;
      }
      rowEl.appendChild(div);
    }
    area.appendChild(rowEl);
  }
}

function renderMeeting(area, colors, ch, moods) {
  area.style.cssText='width:100%;height:100%;position:absolute;z-index:10;overflow:visible';
  const table=document.createElement('div');
  table.className='meeting-vtable';
  area.appendChild(table);
  // 교정: 크기가 1.1배로 커짐에 따라 인물들이 탁자 안쪽으로 너무 파고들지 않도록 left 구도를 자연스럽게 마진 확보
  const configs = [
    { idx: 0, left: '38.5%', top: '40%', dir: 'right' },
    { idx: 1, left: '38.5%', top: '58%', dir: 'right' },
    { idx: 2, left: '50%', top: '13%',  dir: 'front', transform: 'translateX(-50%)' },
    { idx: 3, left: '56%', top: '40%', dir: 'left' },
    { idx: 4, left: '56%', top: '58%', dir: 'left' },
  ];
  configs.forEach(cfg=>{
    const col=colors[cfg.idx%colors.length];
    const mood=moods[cfg.idx]||'neutral';
    const div=document.createElement('div');
    div.className='sim-member-wrap';
    div.style.cssText=`position:absolute;left:${cfg.left};top:${cfg.top};transform:${cfg.transform||''};z-index:10;overflow:visible; display:flex; align-items:center;`;
    // 교정: 회의실 청중들의 크기를 면접실 스케일보다도 큼직한 1.1 배율로 과감하게 확대
    const svg=cfg.dir==='front'
      ? makeSVG(mood,col,ch,0,false,1.1)
      : makeSideSVG(mood,col,ch,cfg.dir,1.1);
    div.innerHTML=`<div class="sim-svg-slot" style="overflow:visible">${svg}</div>`;
    area.appendChild(div);
  });
}