import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, BarChart, Bar } from "recharts";
import { Target, TrendingUp, BookOpen, Settings, Plus, Download, Upload, ChevronRight, Flame, ArrowRight, Check, X, RotateCcw, Calendar, Zap, Award, BarChart3, Play, Pause, ChevronDown, ChevronUp, Trash2, Edit3, Save, FileJson, AlertCircle, Globe, Package, CalendarDays, ChevronLeft, Link, RefreshCw, Monitor, Smartphone, Volume2, SkipForward, ListChecks, GripVertical, ArrowUp, ArrowDown, Users, User, UserPlus, Cloud, CloudOff, Crosshair } from "lucide-react";
import { storage as remoteStorage, isTauri } from "./storage-adapter";
import { pushBundle, pullBundle, makeSyncBundle, applySyncBundle } from "./sync";

// ─── SOUND SYSTEM ─────────────────────────────────────────────────────────────
let audioCtx = null;
function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}
function playAlarmSound() {
  try {
    const ctx = getAudioCtx(); const now = ctx.currentTime;
    [660, 880, 1100].forEach((freq, i) => {
      const osc = ctx.createOscillator(); const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = "sine"; osc.frequency.value = freq;
      const s = now + i * 0.35;
      gain.gain.setValueAtTime(0.35, s); gain.gain.exponentialRampToValueAtTime(0.01, s + 0.3);
      osc.start(s); osc.stop(s + 0.32);
    });
    const o2 = ctx.createOscillator(); const g2 = ctx.createGain();
    o2.connect(g2); g2.connect(ctx.destination); o2.type = "sine"; o2.frequency.value = 1100;
    const s2 = now + 1.2;
    g2.gain.setValueAtTime(0.3, s2); g2.gain.exponentialRampToValueAtTime(0.01, s2 + 0.8);
    o2.start(s2); o2.stop(s2 + 0.85);
  } catch (e) { console.warn("Audio:", e); }
}
function playTickSound() {
  try {
    const ctx = getAudioCtx(); const osc = ctx.createOscillator(); const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination); osc.type = "sine"; osc.frequency.value = 440;
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.1);
  } catch (e) {}
}

// ─── DRILLS DATABASE ──────────────────────────────────────────────────────────
const DEFAULT_DRILLS = [
  { id:"d_t20", title:"T20 Scoring Serie", category:"scoring", level:"beginner", duration:15, description:"Konstantes Scoring auf Triple 20 aufbauen", steps:["Warm-up: 20 lockere Darts auf S20","60 Darts auf T20 – Treffer zählen","Ziel: Anfänger 8+, Amateur 15+, Profi 25+","Notiere dein Ergebnis"], targetField:"T20", omniCompatible:true },
  { id:"d_t19", title:"T19 Alternative", category:"scoring", level:"amateur", duration:15, description:"Alternative Scoring-Route über Triple 19", steps:["30 Darts auf T19","30 Darts Wechsel T20/T19","Notiere Trefferquote"], targetField:"T19", omniCompatible:true },
  { id:"d_doubles_atc", title:"Doubles Around the Clock", category:"doubles", level:"beginner", duration:20, description:"Alle Doppelfelder systematisch trainieren", steps:["Start bei D1, bis D20","3 Darts pro Doppel","Markiere getroffene Doppel","Ziel: Runde unter 15 Min"], targetField:"D1-D20", omniCompatible:true },
  { id:"d_d20d16", title:"D20/D16 Fokus", category:"doubles", level:"beginner", duration:10, description:"Die zwei wichtigsten Checkoutdoppel", steps:["30 Darts auf D20","30 Darts auf D16","Trefferquote notieren","Ziel: 30%+ / 45%+"], targetField:"D20/D16", omniCompatible:true },
  { id:"d_bobs27", title:"Bob's 27", category:"doubles", level:"amateur", duration:20, description:"Der Klassiker für Doppel-Training", steps:["Start mit 27 Punkten","3 Darts pro Doppel (D1–D20+Bull)","Treffer: +Doppelwert, Fehlwurf: −Doppelwert","Ziel: Positiver Score"], targetField:"D1-Bull", omniCompatible:true },
  { id:"d_checkout60", title:"Checkouts 40–80", category:"checkouts", level:"beginner", duration:15, description:"Einfache Finishes verinnerlichen", steps:["Checkouts: 40, 48, 56, 64, 72, 80","3 Darts pro Checkout","Notiere Treffer","Visualisiere VOR dem Wurf"], targetField:"Mixed", omniCompatible:true },
  { id:"d_checkout100", title:"Checkouts 80–120", category:"checkouts", level:"amateur", duration:15, description:"Mittlere Finishes sicher machen", steps:["81, 88, 95, 100, 104, 112, 120","3 Darts pro Versuch","Standard-Wege","Erfolgsquote notieren"], targetField:"Mixed", omniCompatible:true },
  { id:"d_checkout170", title:"High Checkouts 121–170", category:"checkouts", level:"advanced", duration:20, description:"Hohe Finishes für Fortgeschrittene", steps:["121, 130, 140, 150, 160, 164, 167, 170","2-Dart und 3-Dart Wege","Vollständige Finishes zählen"], targetField:"Mixed", omniCompatible:true },
  { id:"d_100darts", title:"100-Darts Challenge", category:"scoring", level:"beginner", duration:25, description:"100 Darts werfen, Gesamtscore messen", steps:["100 Darts auf T20/S20","Jeden Wurf addieren","Ø pro 3 Darts berechnen","Anfänger: 35+, Profi: 65+"], targetField:"T20/S20", omniCompatible:true },
  { id:"d_shanghai", title:"Shanghai", category:"scoring", level:"beginner", duration:15, description:"Single, Double, Triple eines Feldes", steps:["Wähle Feld (z.B. 20)","Single, Double, Triple werfen","Shanghai = alle 3","Wiederhole 20, 19, 18"], targetField:"Variable", omniCompatible:true },
  { id:"d_501", title:"501 Leg Practice", category:"match", level:"beginner", duration:20, description:"Komplette 501 Legs spielen", steps:["501 runterspielen","Finish auf Doppel","Darts pro Leg zählen","Checkout-Versuche notieren"], targetField:"Full Board", omniCompatible:true },
  { id:"d_pressure", title:"Drucksituation Training", category:"mental", level:"amateur", duration:15, description:"Checkout unter Druck simulieren", steps:["Entscheidendes Leg vorstellen","3 Darts für Checkout (z.B. 72)","Bewusst Pause, atmen","10x verschiedene Checkouts"], targetField:"Mixed", omniCompatible:false },
  { id:"d_routine", title:"Wurfroutine Training", category:"technique", level:"beginner", duration:10, description:"Identische Vorbereitung vor jedem Wurf", steps:["3-Schritt Routine definieren","50 Darts gleiche Routine","Timing, Atmung, Blick","Qualität > Geschwindigkeit"], targetField:"Any", omniCompatible:false },
  { id:"d_cricket", title:"Cricket Training", category:"match", level:"amateur", duration:20, description:"Cricket-Felder gezielt trainieren", steps:["Serien auf 20, 19, 18, 17, 16, 15, Bull","10 Darts pro Feld","Triples/Doubles extra zählen","Gesamtscore notieren"], targetField:"15-20+Bull", omniCompatible:true },
  // Interaktive Target-Trainer: Treffer pro Wurf eingeben, App rechnet aus
  { id:"d_target_doubles", title:"Doppel-Trainer (interaktiv)", category:"target", level:"beginner", duration:15, description:"1-5 Doppelfelder wählen, Würfe definieren, Treffer per Tap eintragen", steps:["Felder wählen (1-5 Doppel)","Würfe pro Feld festlegen","Pro Wurf: Treffer / Daneben","Auswertung am Ende"], targetField:"Doubles", omniCompatible:false, targetConfig:{ type:"double", defaultFields:[20,16,18], defaultThrows:9 } },
  { id:"d_target_singles", title:"Single-Trainer (interaktiv)", category:"target", level:"beginner", duration:10, description:"1-5 Felder wählen, Würfe definieren, Treffer eintragen", steps:["Felder wählen (1-5 Singles)","Würfe pro Feld festlegen","Pro Wurf: Treffer / Daneben","Auswertung am Ende"], targetField:"Singles", omniCompatible:false, targetConfig:{ type:"single", defaultFields:[20,19,18], defaultThrows:9 } },
  { id:"d_target_triples", title:"Triple-Trainer (interaktiv)", category:"target", level:"amateur", duration:15, description:"1-5 Triples wählen, Würfe definieren, Treffer eintragen", steps:["Felder wählen (1-5 Triples)","Würfe pro Feld festlegen","Pro Wurf: Treffer / Daneben","Auswertung am Ende"], targetField:"Triples", omniCompatible:false, targetConfig:{ type:"triple", defaultFields:[20,19,18], defaultThrows:9 } },
];
const COMMUNITY_PACKS = [
  { id:"pack_advanced_scoring", name:"Advanced Scoring Pack", version:"1.0", author:"DartTrainer Community", description:"5 fortgeschrittene Scoring-Übungen", drills:[
    { id:"ap_170down", title:"170 Countdown", category:"scoring", level:"advanced", duration:20, description:"Von 170 runterzählen", steps:["Start bei 170","Optimale Aufnahmen","T20-T20-Bull","Unter 9 Darts"], targetField:"Full Board", omniCompatible:true },
    { id:"ap_rotation", title:"Triple Rotation", category:"scoring", level:"amateur", duration:15, description:"Schnelle Umstellung zwischen Triples", steps:["10 Darts T20, T19, T18","Ohne Pause","Treffer notieren","3 Runden"], targetField:"T20/T19/T18", omniCompatible:true },
    { id:"ap_cover", title:"Cover-Shot Training", category:"scoring", level:"advanced", duration:15, description:"Ausweichfelder bei Blockern", steps:["3 Darts T20","Blocker: T19","Entscheidungstempo","30 Aufnahmen"], targetField:"T20/T19", omniCompatible:true },
    { id:"ap_180practice", title:"180 Jagd", category:"scoring", level:"advanced", duration:20, description:"Gezielte 180er-Versuche", steps:["Nur T20","50 Aufnahmen","180er+140+ zählen","Gleicher Rhythmus"], targetField:"T20", omniCompatible:true },
    { id:"ap_bullfinish", title:"Bull-Finish Training", category:"checkouts", level:"advanced", duration:15, description:"Bullseye als Checkout", steps:["Restscores auf Bull: 50, 82, 110","20 Versuche","Bull-Quote notieren"], targetField:"Bull", omniCompatible:true },
  ]},
  { id:"pack_mental", name:"Mental Game Pack", version:"1.0", author:"DartTrainer Community", description:"Mentale Stärke", drills:[
    { id:"mg_clutch", title:"Clutch Moments", category:"mental", level:"amateur", duration:15, description:"Entscheidende Würfe", steps:["D16 zum Sieg","1 Versuch","10 Situationen","Bewusst atmen"], targetField:"Mixed", omniCompatible:false },
    { id:"mg_comeback", title:"Comeback Training", category:"mental", level:"amateur", duration:20, description:"Rückstand aufholen", steps:["501 mit 200 Rückstand","Konzentriert spielen","Positive Selbstgespräche","Gefühl notieren"], targetField:"Full Board", omniCompatible:true },
    { id:"mg_reset", title:"Fehler-Reset", category:"mental", level:"beginner", duration:10, description:"Nach Fehlwürfen resetten", steps:["Absichtlich S1","Routine durchlaufen","Nächster Wurf T20","Reset üben"], targetField:"Any", omniCompatible:false },
  ]},
  { id:"pack_checkout_mastery", name:"Checkout Mastery", version:"1.0", author:"DartTrainer Community", description:"Systematisches Checkout-Training", drills:[
    { id:"cm_2dart", title:"2-Dart Finishes", category:"checkouts", level:"amateur", duration:15, description:"Alle 2-Dart Checkouts", steps:["Checkouts 41-60","Standard-Wege","Setup-Dart Fokus","15 Finishes"], targetField:"Mixed", omniCompatible:true },
    { id:"cm_bogey", title:"Bogey Numbers", category:"checkouts", level:"advanced", duration:15, description:"Bogey-Zahlen vermeiden", steps:["159, 162, 163, 165, 166, 168, 169","Aufnahmen die Bogeys umgehen","Strategische Wege","Checkout-Tabelle"], targetField:"Mixed", omniCompatible:false },
    { id:"cm_madhouse", title:"Madhouse (D1)", category:"doubles", level:"amateur", duration:10, description:"Doppel 1 üben", steps:["50 Darts auf D1","Quote notieren","S1 Setup","Normal wie jedes Doppel"], targetField:"D1", omniCompatible:true },
  ]}
];

const PHASES = [
  { id:1, name:"Fundament", months:[7,8,9], color:"#38bdf8", focus:"Technik, Stand, Wurfbewegung", levelRange:"Anfänger" },
  { id:2, name:"Stabilität", months:[10,11,12], color:"#4ade80", focus:"Konstanz, Rhythmus, Matchsim.", levelRange:"Fortgeschritten" },
  { id:3, name:"Ambition", months:[1,2,3], color:"#facc15", focus:"Checkouts, Druck, Mental", levelRange:"Amateur" },
  { id:4, name:"Feinschliff", months:[4,5,6], color:"#f97373", focus:"Turniermodus, Profi-Vorbereitung", levelRange:"Semi-Profi" },
];
const CATEGORIES = [
  { id:"scoring", label:"Scoring", icon:"🎯", color:"#22c55e" },
  { id:"doubles", label:"Doubles", icon:"🔴", color:"#ef4444" },
  { id:"checkouts", label:"Checkouts", icon:"✅", color:"#3b82f6" },
  { id:"target", label:"Target", icon:"🎯", color:"#06b6d4" },
  { id:"match", label:"Match", icon:"🏆", color:"#f59e0b" },
  { id:"mental", label:"Mental", icon:"🧠", color:"#8b5cf6" },
  { id:"technique", label:"Technik", icon:"⚙️", color:"#06b6d4" },
];
const LEVELS = [
  { id:"beginner", label:"Anfänger", avgTarget:40, doubleTarget:20 },
  { id:"amateur", label:"Amateur", avgTarget:55, doubleTarget:35 },
  { id:"advanced", label:"Fortgeschritten", avgTarget:65, doubleTarget:45 },
  { id:"pro", label:"Profi", avgTarget:80, doubleTarget:55 },
];
const DAY_NAMES=["Mo","Di","Mi","Do","Fr","Sa","So"];
const DAY_NAMES_FULL=["Montag","Dienstag","Mittwoch","Donnerstag","Freitag","Samstag","Sonntag"];

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const genId=()=>`${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
const todayStr=()=>new Date().toISOString().split("T")[0];
const fmtDate=(d)=>{if(!d)return"";const p=d.split("-");return`${p[2]}.${p[1]}.${p[0]}`;};
const daysBetween=(a,b)=>Math.floor((new Date(b)-new Date(a))/(1000*60*60*24));
function getPhaseForDate(date){const m=new Date(date).getMonth()+1;return PHASES.find(p=>p.months.includes(m))||PHASES[0];}
function getWeekDates(offset=0){
  const now=new Date();const day=now.getDay();
  const mon=new Date(now);mon.setDate(now.getDate()-(day===0?6:day-1)+(offset*7));
  return Array.from({length:7},(_,i)=>{const d=new Date(mon);d.setDate(mon.getDate()+i);return d.toISOString().split("T")[0];});
}
function getWeekNumber(d){const date=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));date.setUTCDate(date.getUTCDate()+4-(date.getUTCDay()||7));const ys=new Date(Date.UTC(date.getUTCFullYear(),0,1));return Math.ceil((((date-ys)/86400000)+1)/7);}
function calcStreak(sessions){const s=[...sessions].filter(s=>s.status==="completed").sort((a,b)=>b.date.localeCompare(a.date));if(!s.length)return 0;let streak=1;for(let i=1;i<s.length;i++){if(daysBetween(s[i].date,s[i-1].date)<=3)streak++;else break;}return streak;}
function calcStats(sessions){
  const c=sessions.filter(s=>s.status==="completed");
  if(!c.length)return{totalSessions:0,avgScore:0,avgDouble:0,bestAvg:0,totalTime:0,streak:0};
  const avgScore=c.reduce((a,s)=>a+(s.scores?.average||0),0)/c.length;
  const avgDouble=c.reduce((a,s)=>a+(s.scores?.doublePercent||0),0)/c.length;
  return{totalSessions:c.length,avgScore:Math.round(avgScore*10)/10,avgDouble:Math.round(avgDouble*10)/10,bestAvg:Math.round(Math.max(...c.map(s=>s.scores?.average||0))*10)/10,totalTime:c.reduce((a,s)=>a+(s.duration||0),0),streak:calcStreak(sessions)};
}
function calcWeekStats(sessions,weekDates){
  const c=sessions.filter(s=>s.status==="completed"&&weekDates.includes(s.date));
  if(!c.length)return{count:0,avg:0,dbl:0,time:0};
  return{count:c.length,avg:Math.round(c.reduce((a,s)=>a+(s.scores?.average||0),0)/c.length*10)/10,dbl:Math.round(c.reduce((a,s)=>a+(s.scores?.doublePercent||0),0)/c.length*10)/10,time:c.reduce((a,s)=>a+(s.duration||0),0)};
}

// Deterministic drill assignment (date-hash)
function hashDate(ds){let h=0;for(let i=0;i<ds.length;i++){h=((h<<5)-h)+ds.charCodeAt(i);h|=0;}return Math.abs(h);}
function getDrillsForDay(date,dayIdx,sessionDuration,level,library){
  const lvlIdx=LEVELS.findIndex(l=>l.id===level);
  const suitable=library.filter(d=>{const dL=LEVELS.findIndex(l=>l.id===d.level);return dL<=lvlIdx+1;});
  if(!suitable.length)return[];
  const num=sessionDuration<=30?2:sessionDuration<=60?3:4;
  const seed=hashDate(date);const drills=[];const used=new Set();
  for(let i=0;i<num;i++){
    const cat=CATEGORIES[(seed+dayIdx*3+i)%CATEGORIES.length];
    let pool=suitable.filter(d=>d.category===cat.id&&!used.has(d.id));
    if(!pool.length)pool=suitable.filter(d=>!used.has(d.id));
    if(!pool.length)break;
    const pick=pool[(seed+i*7)%pool.length];drills.push(pick);used.add(pick.id);
  }
  return drills;
}

// Week plan with shift logic
function generateWeekPlan(dates,sessionsPerWeek,level,sessionDuration,library,existingSessions,weekPlanOverrides){
  const patterns={2:[0,3],3:[0,2,4],4:[0,1,3,4],5:[0,1,2,3,4],6:[0,1,2,3,4,5],7:[0,1,2,3,4,5,6]};
  const tdi=patterns[Math.min(sessionsPerWeek,7)]||patterns[4];
  const today=todayStr();
  const origPlan={};
  tdi.forEach(dayIdx=>{
    const date=dates[dayIdx];const manual=weekPlanOverrides?.[date];
    if(manual&&Array.isArray(manual)&&manual.length)origPlan[date]=manual.map(id=>library.find(d=>d.id===id)).filter(Boolean);
    else if(manual&&typeof manual==="string"){const d=library.find(dr=>dr.id===manual);origPlan[date]=d?[d]:getDrillsForDay(date,dayIdx,sessionDuration,level,library);}
    else origPlan[date]=getDrillsForDay(date,dayIdx,sessionDuration,level,library);
  });
  // Shift: collect uncompleted from past
  const missed=[];
  dates.forEach((date,idx)=>{
    if(!tdi.includes(idx)||date>=today)return;
    const planned=origPlan[date]||[];const done=existingSessions.filter(s=>s.date===date&&s.status==="completed");
    const doneIds=new Set(done.map(s=>s.drillId));
    planned.forEach(drill=>{if(!doneIds.has(drill.id))missed.push({...drill,shiftedFrom:date});});
  });
  const shifted={};dates.forEach(d=>{shifted[d]={original:origPlan[d]||[],shifted:[]};});
  if(missed.length>0){
    const future=dates.filter(d=>d>=today);let mIdx=0;
    for(const fd of future){if(mIdx>=missed.length)break;const batch=missed.slice(mIdx,mIdx+2);shifted[fd].shifted.push(...batch);mIdx+=batch.length;}
  }
  return dates.map((date,dayIdx)=>{
    const isOrig=tdi.includes(dayIdx);const plan=shifted[date];
    const allDrills=[...plan.shifted,...plan.original];const hasShift=plan.shifted.length>0;
    const isTraining=isOrig||hasShift;
    const done=existingSessions.filter(s=>s.date===date&&s.status==="completed");
    const completedIds=new Set(done.map(s=>s.drillId));
    const isPast=date<today;const isToday=date===today;
    const total=allDrills.length;const completedCount=allDrills.filter(d=>completedIds.has(d.id)).length;
    let status="rest";
    if(total>0){if(completedCount>=total)status="done";else if(completedCount>0)status="partial";else if(isPast)status="missed";else status="planned";}
    return{date,dayIdx,dayName:DAY_NAMES[dayIdx],dayNameFull:DAY_NAMES_FULL[dayIdx],isTrainingDay:isTraining,isOriginalTrainingDay:isOrig,isPast,isToday,hasShifted:hasShift,completed:done,completedIds,drills:allDrills,shiftedDrills:plan.shifted,originalDrills:plan.original,totalDrills:total,completedCount,status};
  });
}

// ─── DEFAULT STATE ───────────────────────────────────────────────────────────
const STORAGE_KEY = "dart-trainer-state-v2"; // kept stable for back-compat (we migrate inside)
const APP_VERSION = "3.0.0";
const newPlayer = (name, opts={}) => ({
  id: "pl_"+genId(),
  name: name||"Spieler",
  level: opts.level||"beginner",
  startDate: opts.startDate||todayStr(),
  sessionsPerWeek: opts.sessionsPerWeek||4,
  sessionDuration: opts.sessionDuration||60,
  createdAt: new Date().toISOString(),
});
const DEFAULT_STATE = {
  version: APP_VERSION,
  players: [],
  activePlayerId: null,
  sessions: [],                  // [{id, playerId, date, drillId, drillTitle, category, duration, scores, status}]
  weekPlanByPlayer: {},          // {[playerId]: {[date]: [drillId,...]}}
  library: [...DEFAULT_DRILLS],
  installedPacks: [],
  settings: {
    showOmniMode: true,
    autoAdvance: true,
    soundEnabled: true,
    autoStartTimer: false,
    syncEnabled: false,
    syncUrl: "",
    syncKey: "",
    lastSyncAt: null,
  },
};

// v2 → v3 migration: profile -> first player, sessions get playerId, weekPlan moved
function migrateState(raw){
  if(!raw) return null;
  // already v3?
  if(Array.isArray(raw.players) && raw.players.length>=0 && raw.weekPlanByPlayer!==undefined){
    // Backfill missing settings
    raw.settings = { ...DEFAULT_STATE.settings, ...(raw.settings||{}) };
    if(!raw.library) raw.library = [...DEFAULT_DRILLS];
    if(!raw.installedPacks) raw.installedPacks = [];
    // make sure all target drills exist
    const ids = new Set(raw.library.map(d=>d.id));
    DEFAULT_DRILLS.filter(d=>!ids.has(d.id)).forEach(d=>raw.library.push(d));
    raw.version = APP_VERSION;
    return raw;
  }
  // v2.x migration
  const players = [];
  if(raw.profile && raw.profile.name){
    const p = newPlayer(raw.profile.name, {
      level: raw.profile.level,
      startDate: raw.profile.startDate,
      sessionsPerWeek: raw.profile.sessionsPerWeek,
      sessionDuration: raw.profile.sessionDuration,
    });
    players.push(p);
  }
  const activeId = players[0]?.id || null;
  const sessions = (raw.sessions||[]).map(s => ({ ...s, playerId: s.playerId || activeId }));
  const weekPlanByPlayer = {};
  if(activeId && raw.weekPlan){
    const wp = {};
    Object.keys(raw.weekPlan).forEach(d=>{
      const v = raw.weekPlan[d];
      wp[d] = Array.isArray(v) ? v : (typeof v === "string" ? [v] : []);
    });
    weekPlanByPlayer[activeId] = wp;
  }
  const library = raw.library && raw.library.length ? [...raw.library] : [...DEFAULT_DRILLS];
  const libIds = new Set(library.map(d=>d.id));
  DEFAULT_DRILLS.filter(d=>!libIds.has(d.id)).forEach(d=>library.push(d));
  return {
    version: APP_VERSION,
    players, activePlayerId: activeId,
    sessions, weekPlanByPlayer,
    library,
    installedPacks: raw.installedPacks||[],
    settings: { ...DEFAULT_STATE.settings, ...(raw.settings||{}) },
  };
}

// ─── MAIN APP ────────────────────────────────────────────────────────────────
export default function DartTrainerPro() {
  const [appState,setAppState]=useState(DEFAULT_STATE);
  const [activeTab,setActiveTab]=useState("dashboard");
  const [loaded,setLoaded]=useState(false);
  const [notification,setNotification]=useState(null);
  const [editingDrill,setEditingDrill]=useState(null);
  const [showImport,setShowImport]=useState(false);
  const [filterCat,setFilterCat]=useState("all");
  const [expandedSession,setExpandedSession]=useState(null);
  const [weekOffset,setWeekOffset]=useState(0);

  // Day Training
  const [dayTraining,setDayTraining]=useState(null);
  const [sessionScores,setSessionScores]=useState({average:0,doublePercent:0,checkoutPercent:0,s180:0,s140:0,s100:0,notes:"",bobs27Score:0});

  // Player modal: null | "picker" | "add"
  const [showPlayerModal,setShowPlayerModal]=useState(null);
  // First-time daily-plan splash on app start
  const [showDailySplash,setShowDailySplash]=useState(false);
  const splashShownRef = useRef(false);

  // ─── APP-LEVEL TIMER (survives tab switches) ────────────────────────────
  const [timerRemaining,setTimerRemaining]=useState(0);
  const [timerTotal,setTimerTotal]=useState(0);
  const [timerActive,setTimerActive]=useState(false);
  const [timerFinished,setTimerFinished]=useState(false);
  const timerRef=useRef(null);

  useEffect(()=>{
    if(timerRef.current)clearInterval(timerRef.current);
    if(!timerActive||timerFinished)return;
    timerRef.current=setInterval(()=>{
      setTimerRemaining(prev=>{
        if(prev<=1){
          clearInterval(timerRef.current);
          setTimerActive(false);setTimerFinished(true);
          if(appState.settings.soundEnabled!==false)playAlarmSound();
          return 0;
        }
        if(prev<=11&&prev>1&&appState.settings.soundEnabled!==false)playTickSound();
        return prev-1;
      });
    },1000);
    return()=>{if(timerRef.current)clearInterval(timerRef.current);};
  },[timerActive,timerFinished,appState.settings.soundEnabled]);

  const initTimer=(drill)=>{setTimerRemaining(drill.duration*60);setTimerTotal(drill.duration*60);setTimerActive(false);setTimerFinished(false);};

  // Persistence (Tauri native FS via storage-adapter, else window.storage / localStorage)
  useEffect(()=>{(async()=>{
    try{
      const loaded = await remoteStorage.load();
      const migrated = migrateState(loaded);
      if(migrated) setAppState(migrated);
    }catch(e){ console.warn("load",e); }
    setLoaded(true);
  })();},[]);

  const saveState=useCallback(async(ns)=>{
    setAppState(ns);
    try{ await remoteStorage.save(ns); }catch(e){ console.warn("save",e); }
  },[]);
  const notify=(msg,type="success")=>{setNotification({msg,type});setTimeout(()=>setNotification(null),3500);};

  // Active player + per-player derived data
  const activePlayer = useMemo(()=>appState.players.find(p=>p.id===appState.activePlayerId)||null,[appState.players,appState.activePlayerId]);

  // Show daily-plan splash once after load (if there's a plan today and player exists)
  useEffect(()=>{
    if(!loaded || !activePlayer || splashShownRef.current) return;
    splashShownRef.current = true;
    setShowDailySplash(true);
  },[loaded, activePlayer]);
  const playerSessions = useMemo(()=>activePlayer ? appState.sessions.filter(s=>s.playerId===activePlayer.id) : [],[appState.sessions,activePlayer]);
  const playerWeekPlan = useMemo(()=>activePlayer ? (appState.weekPlanByPlayer[activePlayer.id]||{}) : {},[appState.weekPlanByPlayer,activePlayer]);

  // Player management
  const addPlayer = useCallback(async (data) => {
    const p = newPlayer(data.name, data);
    const ns = { ...appState, players:[...appState.players, p], activePlayerId: p.id };
    await saveState(ns);
    return p;
  },[appState,saveState]);
  const setActivePlayer = useCallback(async (id) => {
    await saveState({ ...appState, activePlayerId: id });
    setDayTraining(null);
  },[appState,saveState]);
  const updatePlayer = useCallback(async (id, patch) => {
    await saveState({ ...appState, players: appState.players.map(p=>p.id===id?{...p,...patch}:p) });
  },[appState,saveState]);
  const deletePlayer = useCallback(async (id) => {
    if(appState.players.length<=1){ notify("Mindestens ein Spieler nötig","error"); return; }
    const nextActive = appState.activePlayerId===id ? appState.players.find(p=>p.id!==id)?.id||null : appState.activePlayerId;
    const wp = {...appState.weekPlanByPlayer}; delete wp[id];
    await saveState({
      ...appState,
      players: appState.players.filter(p=>p.id!==id),
      sessions: appState.sessions.filter(s=>s.playerId!==id),
      weekPlanByPlayer: wp,
      activePlayerId: nextActive,
    });
    notify("Spieler gelöscht");
  },[appState,saveState]);

  // Derived (per active player)
  const stats=useMemo(()=>calcStats(playerSessions),[playerSessions]);
  const currentPhase=useMemo(()=>getPhaseForDate(todayStr()),[]);
  const progressData=useMemo(()=>{const c=playerSessions.filter(s=>s.status==="completed").sort((a,b)=>a.date.localeCompare(b.date));return c.slice(-30).map((s,i)=>({nr:i+1,avg:s.scores?.average||0,dbl:s.scores?.doublePercent||0,date:fmtDate(s.date)}));},[playerSessions]);
  const categoryStats=useMemo(()=>{const c=playerSessions.filter(s=>s.status==="completed");return CATEGORIES.map(cat=>({category:cat.label,count:c.filter(s=>s.category===cat.id).length,fullMark:Math.max(c.length/3,5)}));},[playerSessions]);

  const weekDates=useMemo(()=>getWeekDates(weekOffset),[weekOffset]);
  const weekPlanData=useMemo(()=>{
    if(!activePlayer) return null;
    return generateWeekPlan(weekDates,activePlayer.sessionsPerWeek,activePlayer.level,activePlayer.sessionDuration,appState.library,playerSessions,playerWeekPlan);
  },[weekDates,activePlayer,appState.library,playerSessions,playerWeekPlan]);

  // Week comparison data
  const weekComparison=useMemo(()=>{
    const tw=calcWeekStats(playerSessions,getWeekDates(0));
    const lw=calcWeekStats(playerSessions,getWeekDates(-1));
    return{thisWeek:tw,lastWeek:lw};
  },[playerSessions]);

  // Cross-player progression (for compare dashboard)
  const playersProgress = useMemo(()=>appState.players.map(p=>{
    const ps = appState.sessions.filter(s=>s.playerId===p.id);
    return { player:p, stats: calcStats(ps), recent: ps.filter(s=>s.status==="completed").slice(-10) };
  }),[appState.players,appState.sessions]);

  // Actions
  const resetScores=()=>setSessionScores({average:0,doublePercent:0,checkoutPercent:0,s180:0,s140:0,s100:0,notes:"",bobs27Score:0});

  const startDayTraining=(drills,dayDate)=>{
    try{getAudioCtx();}catch(e){}
    setDayTraining({drills:[...drills],currentIndex:0,completedIndices:new Set(),dayDate:dayDate||todayStr()});
    resetScores();initTimer(drills[0]);setActiveTab("training");
  };
  const startSingleDrill=(drill)=>{
    try{getAudioCtx();}catch(e){}
    setDayTraining({drills:[drill],currentIndex:0,completedIndices:new Set(),dayDate:todayStr()});
    resetScores();initTimer(drill);setActiveTab("training");
  };
  const completeDrill=async(extraScores)=>{
    if(!dayTraining||!activePlayer)return;
    const drill=dayTraining.drills[dayTraining.currentIndex];
    const scores={...sessionScores,...(extraScores||{})};
    const session={id:genId(),playerId:activePlayer.id,date:dayTraining.dayDate,drillId:drill.id,drillTitle:drill.title,category:drill.category,duration:drill.duration,scores,status:"completed"};
    const ns={...appState,sessions:[...appState.sessions,session]};await saveState(ns);
    const nc=new Set(dayTraining.completedIndices);nc.add(dayTraining.currentIndex);
    const next=dayTraining.currentIndex+1;
    if(next<dayTraining.drills.length){
      setDayTraining({...dayTraining,currentIndex:next,completedIndices:nc});
      resetScores();
      const nextDrill=dayTraining.drills[next];
      initTimer(nextDrill);
      if(appState.settings.autoStartTimer && nextDrill.category!=="target") setTimerActive(true);
      notify(`✓ ${drill.title} – weiter zu Drill ${next+1}/${dayTraining.drills.length}`);
    }else{setDayTraining(null);setTimerActive(false);setTimerFinished(false);notify("🎉 Tagestraining komplett!");}
  };
  const skipDrill=async()=>{
    if(!dayTraining||!activePlayer)return;
    const drill=dayTraining.drills[dayTraining.currentIndex];
    await saveState({...appState,sessions:[...appState.sessions,{id:genId(),playerId:activePlayer.id,date:dayTraining.dayDate,drillId:drill.id,drillTitle:drill.title,category:drill.category,duration:0,scores:{},status:"skipped"}]});
    const next=dayTraining.currentIndex+1;
    if(next<dayTraining.drills.length){setDayTraining({...dayTraining,currentIndex:next});resetScores();initTimer(dayTraining.drills[next]);}
    else{setDayTraining(null);setTimerActive(false);}
  };
  const reorderDrills=(newDrills)=>{if(dayTraining)setDayTraining({...dayTraining,drills:newDrills});};

  const deleteSession=async(id)=>{await saveState({...appState,sessions:appState.sessions.filter(s=>s.id!==id)});notify("Session gelöscht");};
  const exportData=()=>{const b=new Blob([JSON.stringify(appState,null,2)],{type:"application/json"});const u=URL.createObjectURL(b);const a=document.createElement("a");a.href=u;a.download=`darttrainer_backup_${todayStr()}.json`;a.click();URL.revokeObjectURL(u);notify("Export erfolgreich!");};
  const importData=(jsonStr)=>{try{const d=JSON.parse(jsonStr);if(d.profile&&d.sessions){if(!d.library)d.library=[...DEFAULT_DRILLS];if(!d.weekPlan)d.weekPlan={};if(!d.installedPacks)d.installedPacks=[];saveState(d);notify("Import erfolgreich!");setShowImport(false);}else notify("Ungültig","error");}catch(e){notify("JSON Fehler","error");}};
  const addCustomDrill=async(drill)=>{await saveState({...appState,library:[...appState.library,{...drill,id:"custom_"+genId(),isCustom:true}]});setEditingDrill(null);notify("Hinzugefügt!");};
  const deleteDrill=async(id)=>{await saveState({...appState,library:appState.library.filter(d=>d.id!==id)});notify("Gelöscht");};
  const installPack=async(pack)=>{if(appState.installedPacks.includes(pack.id))return notify("Bereits installiert","error");const eIds=new Set(appState.library.map(d=>d.id));const nd=pack.drills.filter(d=>!eIds.has(d.id));await saveState({...appState,library:[...appState.library,...nd],installedPacks:[...appState.installedPacks,pack.id]});notify(`${nd.length} Drills installiert!`);};
  const importDrillsFromJson=async(jsonStr)=>{try{const data=JSON.parse(jsonStr);let drills=Array.isArray(data)?data:data.drills||[];const eIds=new Set(appState.library.map(d=>d.id));const nd=drills.filter(d=>d.title&&d.category&&!eIds.has(d.id)).map(d=>({...d,id:d.id||"imp_"+genId(),isCustom:true}));if(!nd.length)return notify("Keine neuen","error");await saveState({...appState,library:[...appState.library,...nd]});notify(`${nd.length} importiert!`);}catch(e){notify("JSON Fehler","error");}};
  const assignDrillsToDay=async(date,ids)=>{
    if(!activePlayer)return;
    const wp = appState.weekPlanByPlayer[activePlayer.id]||{};
    await saveState({...appState,weekPlanByPlayer:{...appState.weekPlanByPlayer,[activePlayer.id]:{...wp,[date]:ids}}});
  };
  const removeDrillFromDay=async(date)=>{
    if(!activePlayer)return;
    const wp = {...(appState.weekPlanByPlayer[activePlayer.id]||{})}; delete wp[date];
    await saveState({...appState,weekPlanByPlayer:{...appState.weekPlanByPlayer,[activePlayer.id]:wp}});
  };
  const updateProfile=async(u)=>{ if(activePlayer) await updatePlayer(activePlayer.id, u); };
  const updateSettings=async(u)=>saveState({...appState,settings:{...appState.settings,...u}});
  const resetAll=async()=>{if(confirm("Alle Daten (alle Spieler) zurücksetzen?")){await saveState(DEFAULT_STATE);notify("Zurückgesetzt");}};
  const levelProgress=useMemo(()=>{
    if(!activePlayer) return {percent:0,nextLevel:null};
    const n=LEVELS[LEVELS.findIndex(l=>l.id===activePlayer.level)+1];
    if(!n||!stats.totalSessions)return{percent:0,nextLevel:null};
    const a=Math.min(100,(stats.avgScore/n.avgTarget)*100),d=Math.min(100,(stats.avgDouble/n.doubleTarget)*100),s=Math.min(100,(stats.totalSessions/50)*100);
    return{percent:Math.round((a+d+s)/3),nextLevel:n,avgProgress:Math.round(a),dblProgress:Math.round(d),sessProgress:Math.round(s)};
  },[activePlayer,stats]);

  // Sync (push/pull JSON bundle to configurable URL)
  const [syncBusy,setSyncBusy]=useState(false);
  const doSyncPush=useCallback(async()=>{
    setSyncBusy(true);
    try{
      const bundle = makeSyncBundle(appState);
      await pushBundle(appState.settings.syncUrl, appState.settings.syncKey, bundle);
      await saveState({...appState, settings:{...appState.settings, lastSyncAt:new Date().toISOString()}});
      notify("Sync abgeschlossen ☁");
    }catch(e){ notify("Sync fehlgeschlagen: "+e.message,"error"); }
    setSyncBusy(false);
  },[appState,saveState]);
  const doSyncPull=useCallback(async()=>{
    setSyncBusy(true);
    try{
      const bundle = await pullBundle(appState.settings.syncUrl, appState.settings.syncKey);
      const merged = applySyncBundle(appState, bundle);
      await saveState({...merged, settings:{...merged.settings, lastSyncAt:new Date().toISOString()}});
      notify("Daten vom Server geholt");
    }catch(e){ notify("Pull fehlgeschlagen: "+e.message,"error"); }
    setSyncBusy(false);
  },[appState,saveState]);

  if(!loaded)return(<div style={{height:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#0a0e1a",color:"#e5e7eb",fontFamily:"'DM Sans',system-ui,sans-serif"}}><div style={{textAlign:"center"}}><div style={{width:48,height:48,border:"3px solid #22c55e",borderTopColor:"transparent",borderRadius:"50%",animation:"spin 1s linear infinite",margin:"0 auto 16px"}}/><p style={{color:"#9ca3af"}}>Lade...</p></div><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div>);
  // No players yet → first-player setup
  if(appState.players.length===0) return <SetupScreen first onComplete={async(p)=>{await addPlayer(p);}}/>;
  // Players exist but none selected → picker
  if(!activePlayer) return <PlayerPickerScreen players={appState.players} onSelect={setActivePlayer} onAdd={()=>setShowPlayerModal("add")} onDelete={deletePlayer}/>;

  const tabs=[{id:"dashboard",label:"Dashboard",icon:BarChart3},{id:"weekplan",label:"Woche",icon:CalendarDays},{id:"training",label:"Training",icon:Target},{id:"results",label:"Ergebnisse",icon:TrendingUp},{id:"library",label:"Bibliothek",icon:BookOpen},{id:"settings",label:"Setup",icon:Settings}];
  // Timer indicator for header
  const timerIndicator=timerActive&&dayTraining?`${Math.floor(timerRemaining/60)}:${String(timerRemaining%60).padStart(2,"0")}`:null;

  return(
    <div style={{minHeight:"100vh",background:"linear-gradient(180deg,#0a0e1a 0%,#0f1629 50%,#0a0e1a 100%)",color:"#e5e7eb",fontFamily:"'DM Sans',system-ui,-apple-system,sans-serif",paddingBottom:80}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&family=JetBrains+Mono:wght@400;500&display=swap');*{box-sizing:border-box;margin:0;padding:0}::-webkit-scrollbar{width:6px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:#374151;border-radius:3px}input,select,textarea{font-family:inherit}@keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}@keyframes slideUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}@keyframes pulse{0%,100%{opacity:1}50%{opacity:.6}}@keyframes timerFlash{0%,100%{border-color:rgba(239,68,68,.6)}50%{border-color:rgba(239,68,68,.15)}}.fade-in{animation:fadeIn .4s ease-out both}.slide-up{animation:slideUp .5s ease-out both}.timer-done{animation:timerFlash 1s ease-in-out infinite}`}</style>
      {notification&&<div style={{position:"fixed",top:16,left:"50%",transform:"translateX(-50%)",zIndex:999,padding:"10px 20px",borderRadius:12,background:notification.type==="error"?"#7f1d1d":"#14532d",border:`1px solid ${notification.type==="error"?"#dc2626":"#22c55e"}`,color:"#fff",fontSize:14,fontWeight:500,animation:"slideUp .3s ease-out",boxShadow:"0 8px 32px rgba(0,0,0,.5)",maxWidth:"90%",textAlign:"center"}}>{notification.msg}</div>}
      <header style={{padding:"12px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:"1px solid rgba(55,65,81,.4)",gap:8,flexWrap:"wrap"}}>
        <div style={{display:"flex",alignItems:"center",gap:10,minWidth:0,flex:"1 1 auto"}}>
          <div style={{width:34,height:34,borderRadius:10,background:"linear-gradient(135deg,#22c55e,#16a34a)",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 0 20px rgba(34,197,94,.35)",flexShrink:0}}><Target size={18} color="#fff"/></div>
          <div style={{minWidth:0,overflow:"hidden"}}><h1 style={{fontSize:16,fontWeight:700,letterSpacing:"-.02em",color:"#f9fafb",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>DartTrainer Pro</h1><p style={{fontSize:10,color:"#6b7280",fontWeight:500}}>v{APP_VERSION} · {LEVELS.find(l=>l.id===activePlayer.level)?.label}</p></div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
          {timerIndicator&&<button onClick={()=>setActiveTab("training")} style={{display:"flex",alignItems:"center",gap:3,padding:"4px 9px",borderRadius:20,background:"rgba(34,197,94,.15)",border:"1px solid rgba(34,197,94,.3)",cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:"'JetBrains Mono',monospace",color:"#22c55e",animation:"pulse 2s ease-in-out infinite",minHeight:30}}><Play size={11}/>{timerIndicator}</button>}
          {stats.streak>0&&<div style={{display:"flex",alignItems:"center",gap:3,padding:"4px 8px",borderRadius:20,background:"rgba(249,115,22,.15)",border:"1px solid rgba(249,115,22,.3)",minHeight:30}}><Flame size={12} color="#f97316"/><span style={{fontSize:11,fontWeight:600,color:"#f97316"}}>{stats.streak}</span></div>}
          <button onClick={()=>setShowPlayerModal("picker")} title="Spieler wechseln" style={{display:"flex",alignItems:"center",gap:5,padding:"6px 10px",borderRadius:20,background:"rgba(34,197,94,.12)",border:"1px solid rgba(34,197,94,.35)",cursor:"pointer",color:"#22c55e",fontSize:12,fontWeight:600,minHeight:30,maxWidth:140,overflow:"hidden"}}>
            <User size={12} style={{flexShrink:0}}/><span style={{whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{activePlayer.name}</span>{appState.players.length>1&&<ChevronDown size={11} style={{flexShrink:0}}/>}
          </button>
        </div>
      </header>
      <main style={{maxWidth:960,margin:"0 auto",padding:"14px 14px 0"}}>
        {activeTab==="dashboard"&&<DashboardTab stats={stats} progressData={progressData} categoryStats={categoryStats} levelProgress={levelProgress} currentPhase={currentPhase} profile={activePlayer} weekPlanData={weekPlanData} weekComparison={weekComparison} onStartDay={startDayTraining} onStartDrill={startSingleDrill} playersProgress={playersProgress} onSwitchPlayer={()=>setShowPlayerModal("picker")}/>}
        {activeTab==="weekplan"&&<WeekPlanTab weekPlanData={weekPlanData} weekOffset={weekOffset} setWeekOffset={setWeekOffset} weekDates={weekDates} library={appState.library} profile={activePlayer} onAssign={assignDrillsToDay} onRemove={removeDrillFromDay} onStartDay={startDayTraining} sessions={playerSessions}/>}
        {activeTab==="training"&&<TrainingTab dayTraining={dayTraining} sessionScores={sessionScores} setSessionScores={setSessionScores} timerRemaining={timerRemaining} timerTotal={timerTotal} timerActive={timerActive} setTimerActive={setTimerActive} timerFinished={timerFinished} onComplete={completeDrill} onSkip={skipDrill} onReorder={reorderDrills} onStartDrill={startSingleDrill} library={appState.library} profile={activePlayer} settings={appState.settings} weekPlanData={weekPlanData} onStartDay={startDayTraining}/>}
        {activeTab==="results"&&<ResultsTab sessions={playerSessions} expandedSession={expandedSession} setExpandedSession={setExpandedSession} onDelete={deleteSession} progressData={progressData}/>}
        {activeTab==="library"&&<LibraryTab library={appState.library} filterCat={filterCat} setFilterCat={setFilterCat} onStartDrill={startSingleDrill} onAdd={addCustomDrill} onDelete={deleteDrill} editingDrill={editingDrill} setEditingDrill={setEditingDrill} profile={activePlayer} installedPacks={appState.installedPacks} onInstallPack={installPack} onImportDrills={importDrillsFromJson}/>}
        {activeTab==="settings"&&<SettingsTab profile={activePlayer} settings={appState.settings} onUpdateProfile={updateProfile} onUpdateSettings={updateSettings} onExport={exportData} onImport={importData} showImport={showImport} setShowImport={setShowImport} onReset={resetAll} stats={stats} players={appState.players} onAddPlayer={()=>setShowPlayerModal("add")} onDeletePlayer={deletePlayer} onTestSound={()=>playAlarmSound()} syncBusy={syncBusy} onSyncPush={doSyncPush} onSyncPull={doSyncPull}/>}
      </main>
      {showDailySplash&&weekPlanData&&<DailyPlanSplash plan={weekPlanData.find(d=>d.isToday)} player={activePlayer} onStart={(drills,date)=>{setShowDailySplash(false);startDayTraining(drills,date);}} onClose={()=>setShowDailySplash(false)}/>}
      {showPlayerModal==="picker"&&<PlayerSwitcherModal players={appState.players} activeId={activePlayer.id} sessions={appState.sessions} onSelect={async(id)=>{await setActivePlayer(id);setShowPlayerModal(null);}} onAdd={()=>setShowPlayerModal("add")} onClose={()=>setShowPlayerModal(null)}/>}
      {showPlayerModal==="add"&&<AddPlayerModal onAdd={async(p)=>{await addPlayer(p);setShowPlayerModal(null);notify(`Spieler "${p.name}" angelegt`);}} onClose={()=>setShowPlayerModal(null)}/>}
      <nav style={{position:"fixed",bottom:0,left:0,right:0,background:"rgba(10,14,26,.96)",backdropFilter:"blur(20px)",borderTop:"1px solid rgba(55,65,81,.5)",display:"flex",justifyContent:"center",padding:"4px 0 env(safe-area-inset-bottom,6px)",zIndex:100}}>
        <div style={{display:"flex",maxWidth:560,width:"100%",justifyContent:"space-around"}}>
          {tabs.map(t=>{const Icon=t.icon;const active=activeTab===t.id;const badge=t.id==="training"&&dayTraining;return(
            <button key={t.id} onClick={()=>setActiveTab(t.id)} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:1,padding:"5px 8px",background:active?"rgba(34,197,94,.12)":"transparent",border:"none",borderRadius:8,cursor:"pointer",transition:"all .2s",position:"relative"}}>
              <Icon size={18} color={active?"#22c55e":"#6b7280"} strokeWidth={active?2.2:1.8}/><span style={{fontSize:9,fontWeight:active?600:400,color:active?"#22c55e":"#6b7280"}}>{t.label}</span>
              {badge&&<div style={{position:"absolute",top:2,right:4,width:6,height:6,borderRadius:3,background:"#ef4444"}}/>}
            </button>
          );})}
        </div>
      </nav>
    </div>
  );
}

// ─── SETUP (Erst-Einrichtung: erster Spieler) ────────────────────────────────
function SetupScreen({onComplete,first}){
  const [name,setName]=useState("");const [level,setLevel]=useState("beginner");
  const [dur,setDur]=useState(60);const [spw,setSpw]=useState(4);
  return(<div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"linear-gradient(180deg,#0a0e1a,#0f1629)",fontFamily:"'DM Sans',system-ui,sans-serif",padding:20}}>
    <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');`}</style>
    <div className="slide-up" style={{maxWidth:400,width:"100%",textAlign:"center"}}>
      <div style={{width:64,height:64,borderRadius:16,background:"linear-gradient(135deg,#22c55e,#16a34a)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 20px",boxShadow:"0 0 40px rgba(34,197,94,.4)"}}><Target size={32} color="#fff"/></div>
      <h1 style={{fontSize:28,fontWeight:700,color:"#f9fafb",marginBottom:6}}>DartTrainer Pro</h1>
      <p style={{color:"#6b7280",marginBottom:32,fontSize:14}}>{first?"Lege deinen ersten Spieler an":"Neuer Spieler"}</p>
      <div style={{textAlign:"left",marginBottom:16}}><label style={{fontSize:13,color:"#9ca3af",marginBottom:6,display:"block"}}>Name des Spielers</label><input value={name} onChange={e=>setName(e.target.value)} placeholder="z. B. Max" style={{width:"100%",padding:"12px 16px",borderRadius:10,border:"1px solid #374151",background:"#111827",color:"#e5e7eb",fontSize:15,outline:"none"}}/></div>
      <div style={{textAlign:"left",marginBottom:16}}><label style={{fontSize:13,color:"#9ca3af",marginBottom:8,display:"block"}}>Level</label><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>{LEVELS.map(l=><button key={l.id} onClick={()=>setLevel(l.id)} style={{padding:"14px 12px",borderRadius:10,border:`2px solid ${level===l.id?"#22c55e":"#374151"}`,background:level===l.id?"rgba(34,197,94,.1)":"#111827",color:level===l.id?"#22c55e":"#9ca3af",cursor:"pointer",fontSize:14,fontWeight:level===l.id?600:400,textAlign:"left"}}><div style={{fontWeight:600,marginBottom:2}}>{l.label}</div><div style={{fontSize:11,opacity:.7}}>Ø {l.avgTarget} · {l.doubleTarget}%</div></button>)}</div></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,textAlign:"left",marginBottom:24}}>
        <div><label style={{fontSize:13,color:"#9ca3af",marginBottom:6,display:"block"}}>Sessions/Woche</label><select value={spw} onChange={e=>setSpw(+e.target.value)} style={{width:"100%",padding:"12px",borderRadius:10,border:"1px solid #374151",background:"#111827",color:"#e5e7eb",fontSize:14,outline:"none"}}>{[2,3,4,5,6,7].map(n=><option key={n} value={n}>{n}x</option>)}</select></div>
        <div><label style={{fontSize:13,color:"#9ca3af",marginBottom:6,display:"block"}}>Session-Dauer</label><select value={dur} onChange={e=>setDur(+e.target.value)} style={{width:"100%",padding:"12px",borderRadius:10,border:"1px solid #374151",background:"#111827",color:"#e5e7eb",fontSize:14,outline:"none"}}>{[30,45,60,75,90,120].map(n=><option key={n} value={n}>{n} Min</option>)}</select></div>
      </div>
      <button onClick={()=>name.trim()&&onComplete({name:name.trim(),level,sessionsPerWeek:spw,sessionDuration:dur})} disabled={!name.trim()} style={{width:"100%",padding:"14px",borderRadius:12,border:"none",background:name.trim()?"linear-gradient(135deg,#22c55e,#16a34a)":"#374151",color:name.trim()?"#fff":"#6b7280",fontSize:16,fontWeight:600,cursor:name.trim()?"pointer":"not-allowed",boxShadow:name.trim()?"0 4px 20px rgba(34,197,94,.4)":"none"}}>Training starten <ArrowRight size={18} style={{verticalAlign:"middle",marginLeft:6}}/></button>
    </div>
  </div>);
}

// ─── PLAYER SCREENS / MODALS ─────────────────────────────────────────────────
function PlayerPickerScreen({players,onSelect,onAdd,onDelete}){
  return(<div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"linear-gradient(180deg,#0a0e1a,#0f1629)",fontFamily:"'DM Sans',system-ui,sans-serif",padding:20}}>
    <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');`}</style>
    <div className="slide-up" style={{maxWidth:420,width:"100%"}}>
      <div style={{textAlign:"center",marginBottom:24}}>
        <div style={{width:60,height:60,borderRadius:14,background:"linear-gradient(135deg,#22c55e,#16a34a)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 14px"}}><Users size={28} color="#fff"/></div>
        <h1 style={{fontSize:22,fontWeight:700,color:"#f9fafb",marginBottom:4}}>Wer trainiert heute?</h1>
        <p style={{fontSize:12,color:"#6b7280"}}>Wähle einen Spieler oder lege einen neuen an</p>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:14}}>
        {players.map(p=>(
          <div key={p.id} style={{display:"flex",alignItems:"center",gap:8,padding:"12px 14px",borderRadius:12,border:"1px solid #374151",background:"#111827"}}>
            <button onClick={()=>onSelect(p.id)} style={{flex:1,display:"flex",alignItems:"center",gap:10,background:"transparent",border:"none",color:"#fff",cursor:"pointer",textAlign:"left"}}>
              <div style={{width:36,height:36,borderRadius:18,background:"rgba(34,197,94,.15)",border:"1px solid rgba(34,197,94,.35)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,color:"#22c55e"}}>{p.name.slice(0,1).toUpperCase()}</div>
              <div><div style={{fontWeight:600,fontSize:14}}>{p.name}</div><div style={{fontSize:11,color:"#6b7280"}}>{LEVELS.find(l=>l.id===p.level)?.label} · {p.sessionsPerWeek}×/Woche</div></div>
            </button>
            <button onClick={()=>{ if(confirm(`Spieler "${p.name}" inkl. aller Sessions löschen?`)) onDelete(p.id); }} style={{padding:6,borderRadius:8,border:"1px solid #ef444430",background:"transparent",color:"#ef4444",cursor:"pointer"}}><Trash2 size={14}/></button>
          </div>
        ))}
      </div>
      <button onClick={onAdd} style={{width:"100%",padding:"12px",borderRadius:12,border:"1px dashed #22c55e",background:"rgba(34,197,94,.08)",color:"#22c55e",fontWeight:600,fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
        <UserPlus size={16}/>Neuen Spieler anlegen
      </button>
    </div>
  </div>);
}

function ModalShell({onClose,title,icon:Icon,children}){
  return(<div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.7)",backdropFilter:"blur(6px)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
    <div onClick={e=>e.stopPropagation()} className="slide-up" style={{maxWidth:440,width:"100%",background:"linear-gradient(160deg,#111827,#0a0e1a)",border:"1px solid rgba(55,65,81,.6)",borderRadius:16,padding:18,maxHeight:"90vh",overflowY:"auto"}}>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}>
        {Icon&&<Icon size={18} color="#22c55e"/>}
        <h2 style={{fontSize:16,fontWeight:700,color:"#f9fafb",flex:1}}>{title}</h2>
        <button onClick={onClose} style={{background:"transparent",border:"none",color:"#9ca3af",cursor:"pointer"}}><X size={18}/></button>
      </div>
      {children}
    </div>
  </div>);
}

function PlayerSwitcherModal({players,activeId,sessions,onSelect,onAdd,onClose}){
  return(<ModalShell onClose={onClose} title="Spieler wechseln" icon={Users}>
    <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:12}}>
      {players.map(p=>{
        const c = sessions.filter(s=>s.playerId===p.id && s.status==="completed").length;
        const isActive = p.id===activeId;
        return(
          <button key={p.id} onClick={()=>onSelect(p.id)} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:10,border:`1px solid ${isActive?"#22c55e":"#374151"}`,background:isActive?"rgba(34,197,94,.1)":"#0a0e1a",color:"#fff",cursor:"pointer",textAlign:"left"}}>
            <div style={{width:32,height:32,borderRadius:16,background:"rgba(34,197,94,.15)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,color:"#22c55e"}}>{p.name.slice(0,1).toUpperCase()}</div>
            <div style={{flex:1}}><div style={{fontSize:13,fontWeight:600}}>{p.name}{isActive&&" · aktiv"}</div><div style={{fontSize:10,color:"#6b7280"}}>{LEVELS.find(l=>l.id===p.level)?.label} · {c} Sessions</div></div>
            {isActive&&<Check size={14} color="#22c55e"/>}
          </button>
        );
      })}
    </div>
    <button onClick={onAdd} style={{width:"100%",padding:10,borderRadius:10,border:"1px dashed #22c55e",background:"rgba(34,197,94,.08)",color:"#22c55e",fontWeight:600,fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}><UserPlus size={14}/>Neuen Spieler hinzufügen</button>
  </ModalShell>);
}

function AddPlayerModal({onAdd,onClose}){
  const [name,setName]=useState("");const [level,setLevel]=useState("beginner");
  const [dur,setDur]=useState(60);const [spw,setSpw]=useState(4);
  return(<ModalShell onClose={onClose} title="Neuer Spieler" icon={UserPlus}>
    <div style={{marginBottom:12}}><label style={{fontSize:11,color:"#9ca3af",display:"block",marginBottom:4}}>Name</label><input value={name} onChange={e=>setName(e.target.value)} placeholder="z. B. Max" autoFocus style={{width:"100%",padding:"10px 12px",borderRadius:10,border:"1px solid #374151",background:"#0a0e1a",color:"#fff",fontSize:14,outline:"none"}}/></div>
    <div style={{marginBottom:12}}><label style={{fontSize:11,color:"#9ca3af",display:"block",marginBottom:6}}>Level</label><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>{LEVELS.map(l=><button key={l.id} onClick={()=>setLevel(l.id)} style={{padding:"10px",borderRadius:8,border:`1.5px solid ${level===l.id?"#22c55e":"#374151"}`,background:level===l.id?"rgba(34,197,94,.1)":"#0a0e1a",color:level===l.id?"#22c55e":"#d1d5db",cursor:"pointer",fontSize:12,fontWeight:600}}>{l.label}</button>)}</div></div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:14}}>
      <div><label style={{fontSize:11,color:"#9ca3af",display:"block",marginBottom:4}}>Sessions/Woche</label><select value={spw} onChange={e=>setSpw(+e.target.value)} style={{width:"100%",padding:"10px",borderRadius:8,border:"1px solid #374151",background:"#0a0e1a",color:"#fff",fontSize:13,outline:"none"}}>{[2,3,4,5,6,7].map(n=><option key={n} value={n}>{n}×</option>)}</select></div>
      <div><label style={{fontSize:11,color:"#9ca3af",display:"block",marginBottom:4}}>Dauer</label><select value={dur} onChange={e=>setDur(+e.target.value)} style={{width:"100%",padding:"10px",borderRadius:8,border:"1px solid #374151",background:"#0a0e1a",color:"#fff",fontSize:13,outline:"none"}}>{[30,45,60,75,90,120].map(n=><option key={n} value={n}>{n} Min</option>)}</select></div>
    </div>
    <button onClick={()=>name.trim()&&onAdd({name:name.trim(),level,sessionsPerWeek:spw,sessionDuration:dur})} disabled={!name.trim()} style={{width:"100%",padding:12,borderRadius:10,border:"none",background:name.trim()?"linear-gradient(135deg,#22c55e,#16a34a)":"#374151",color:name.trim()?"#fff":"#6b7280",fontWeight:600,fontSize:14,cursor:name.trim()?"pointer":"not-allowed"}}>Anlegen</button>
  </ModalShell>);
}

function DailyPlanSplash({plan,player,onStart,onClose}){
  if(!plan) return null;
  const isDone = plan.status==="done";
  const isRest = plan.status==="rest" || plan.drills.length===0;
  return(<ModalShell onClose={onClose} title={`Heute · ${plan.dayNameFull}`} icon={CalendarDays}>
    <div style={{textAlign:"center",marginBottom:12}}><div style={{fontSize:11,color:"#6b7280"}}>Trainingsplan für {player.name}</div></div>
    {isRest?<div style={{textAlign:"center",padding:"20px 0"}}><div style={{fontSize:40,marginBottom:8}}>🧘</div><div style={{fontWeight:600,color:"#f9fafb"}}>Ruhetag</div><div style={{fontSize:12,color:"#6b7280",marginTop:6}}>Erholung ist Teil des Trainings.</div></div>
    :isDone?<div style={{textAlign:"center",padding:"20px 0"}}><div style={{fontSize:40,marginBottom:8}}>🎉</div><div style={{fontWeight:600,color:"#22c55e"}}>Heute schon erledigt!</div><div style={{fontSize:12,color:"#6b7280",marginTop:6}}>{plan.completedCount} Drills abgeschlossen</div></div>
    :<div>
      <div style={{fontSize:11,color:"#9ca3af",marginBottom:8}}>{plan.totalDrills} Drills · ca. {plan.drills.reduce((a,d)=>a+d.duration,0)} Min</div>
      {plan.drills.map((d,i)=>{const cat=CATEGORIES.find(c=>c.id===d.category);const done=plan.completedIds.has(d.id);return(
        <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 10px",borderRadius:8,background:done?"rgba(34,197,94,.06)":"rgba(0,0,0,.2)",marginBottom:5,opacity:done?.55:1}}>
          <div style={{width:20,height:20,borderRadius:10,border:`2px solid ${done?"#22c55e":"#4b5563"}`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{done&&<Check size={11} color="#22c55e"/>}</div>
          <div style={{flex:1}}><div style={{fontSize:12,fontWeight:600,color:done?"#6b7280":"#f9fafb",textDecoration:done?"line-through":"none"}}>{d.title}</div><div style={{fontSize:10,color:"#6b7280"}}>{cat?.icon} {d.duration} Min</div></div>
        </div>
      );})}
      <button onClick={()=>onStart(plan.drills,plan.date)} style={{width:"100%",padding:12,borderRadius:10,border:"none",background:"linear-gradient(135deg,#22c55e,#16a34a)",color:"#fff",fontSize:14,fontWeight:600,cursor:"pointer",marginTop:10,display:"flex",alignItems:"center",justifyContent:"center",gap:6,boxShadow:"0 4px 16px rgba(34,197,94,.35)"}}><Play size={16}/>{plan.completedCount>0?"Tagestraining fortsetzen":"Tagestraining starten"}</button>
    </div>}
    <button onClick={onClose} style={{width:"100%",padding:8,borderRadius:8,border:"1px solid #374151",background:"transparent",color:"#9ca3af",fontSize:12,cursor:"pointer",marginTop:8}}>Später</button>
  </ModalShell>);
}

// ─── SHARED COMPONENTS ───────────────────────────────────────────────────────
function Card({children,style={},glow,className=""}){return <div className={`fade-in ${className}`} style={{background:"linear-gradient(145deg,rgba(17,24,39,.95),rgba(15,23,42,.9))",borderRadius:14,border:`1px solid ${glow?"rgba(34,197,94,.3)":"rgba(55,65,81,.6)"}`,padding:"16px 18px",boxShadow:glow?"0 0 30px rgba(34,197,94,.1)":"0 4px 24px rgba(0,0,0,.3)",...style}}>{children}</div>;}
function StatBox({icon:Icon,label,value,sub,color="#22c55e"}){return(<div style={{padding:"12px 14px",borderRadius:12,background:"rgba(17,24,39,.7)",border:"1px solid rgba(55,65,81,.5)",flex:"1 1 110px",minWidth:110}}><div style={{display:"flex",alignItems:"center",gap:5,marginBottom:5}}>{Icon&&<Icon size={13} color={color}/>}<span style={{fontSize:10,color:"#6b7280",fontWeight:500,textTransform:"uppercase",letterSpacing:".04em"}}>{label}</span></div><div style={{fontSize:20,fontWeight:700,color:"#f9fafb",fontFamily:"'JetBrains Mono',monospace"}}>{value}</div>{sub&&<div style={{fontSize:10,color:"#6b7280",marginTop:2}}>{sub}</div>}</div>);}
function FilterPill({active,onClick,label}){return <button onClick={onClick} style={{padding:"5px 11px",borderRadius:20,border:`1px solid ${active?"#22c55e":"#374151"}`,background:active?"rgba(34,197,94,.12)":"transparent",color:active?"#22c55e":"#9ca3af",cursor:"pointer",fontSize:11,fontWeight:active?600:400,whiteSpace:"nowrap"}}>{label}</button>;}
function ToggleSwitch({checked,onChange}){return <button onClick={()=>onChange(!checked)} style={{width:44,height:24,borderRadius:12,border:"none",background:checked?"#22c55e":"#374151",cursor:"pointer",position:"relative",transition:"background .2s"}}><div style={{width:18,height:18,borderRadius:9,background:"#fff",position:"absolute",top:3,left:checked?23:3,transition:"left .2s",boxShadow:"0 1px 3px rgba(0,0,0,.3)"}}/></button>;}
function ScoreInput({label,value,onChange,max=999,suffix="",color="#22c55e",integer=false,step=1}){return(<div><label style={{fontSize:11,color:"#6b7280",marginBottom:4,display:"block"}}>{label}</label><div style={{position:"relative"}}><input type="number" value={value||""} onChange={e=>{let v=integer?parseInt(e.target.value)||0:parseFloat(e.target.value)||0;onChange(Math.min(Math.max(0,v),max));}} placeholder="0" step={step} style={{width:"100%",padding:"10px 12px",paddingRight:suffix?28:12,borderRadius:8,border:`1px solid ${color}30`,background:"rgba(0,0,0,.3)",color:"#f9fafb",fontSize:16,fontWeight:600,fontFamily:"'JetBrains Mono',monospace",outline:"none",textAlign:"center"}}/>{suffix&&<span style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",fontSize:12,color:"#6b7280"}}>{suffix}</span>}</div></div>);}
function MiniStat({label,value}){return <div style={{padding:"6px 8px",borderRadius:8,background:"rgba(0,0,0,.2)",textAlign:"center"}}><div style={{fontSize:10,color:"#6b7280"}}>{label}</div><div style={{fontSize:14,fontWeight:700,color:"#f9fafb",fontFamily:"'JetBrains Mono',monospace"}}>{value}</div></div>;}

// ─── TARGET TRAINER (interaktiv: Singles/Doubles/Triples) ───────────────────
const TARGET_FIELDS = [20,19,18,17,16,15,14,13,12,11,10,9,8,7,6,5,4,3,2,1];
const TARGET_TYPES = {
  single:{ label:"Single", prefix:"S", color:"#22c55e", points:(f)=>f },
  double:{ label:"Doppel", prefix:"D", color:"#ef4444", points:(f)=>f*2 },
  triple:{ label:"Triple", prefix:"T", color:"#f59e0b", points:(f)=>f*3 },
};

function TargetTrainerSetup({config,onStart,onCancel}){
  const t = TARGET_TYPES[config.type];
  const [fields,setFields] = useState(config.defaultFields||[20,16,18]);
  const [throws,setThrows] = useState(config.defaultThrows||9);
  const toggleField = (f) => {
    setFields(prev => prev.includes(f) ? prev.filter(x=>x!==f) : (prev.length<5 ? [...prev,f] : prev));
  };
  return(<div>
    <div style={{padding:"10px 12px",borderRadius:10,background:`${t.color}15`,border:`1px solid ${t.color}40`,marginBottom:10}}>
      <div style={{fontSize:13,fontWeight:600,color:t.color,marginBottom:3}}><Crosshair size={12} style={{verticalAlign:"middle",marginRight:5}}/>{t.label}-Trainer</div>
      <div style={{fontSize:11,color:"#9ca3af"}}>Wähle 1-5 Felder und die Anzahl der Würfe pro Feld.</div>
    </div>
    <div style={{marginBottom:10}}>
      <label style={{fontSize:11,color:"#9ca3af",marginBottom:6,display:"block"}}>Felder (max. 5)</label>
      <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:4}}>
        {TARGET_FIELDS.map(f=>{const sel=fields.includes(f);return(
          <button key={f} onClick={()=>toggleField(f)} style={{padding:"8px 4px",borderRadius:8,border:`1.5px solid ${sel?t.color:"#374151"}`,background:sel?`${t.color}15`:"#0a0e1a",color:sel?t.color:"#9ca3af",cursor:"pointer",fontSize:13,fontWeight:600,fontFamily:"'JetBrains Mono',monospace"}}>{t.prefix}{f}</button>
        );})}
      </div>
      <div style={{fontSize:10,color:"#6b7280",marginTop:5}}>Gewählt: {fields.length} · {fields.map(f=>t.prefix+f).join(", ")||"–"}</div>
    </div>
    <div style={{marginBottom:14}}>
      <label style={{fontSize:11,color:"#9ca3af",marginBottom:6,display:"block"}}>Würfe pro Feld: <span style={{color:t.color,fontWeight:600}}>{throws}</span> (gesamt {fields.length*throws})</label>
      <input type="range" min="1" max="30" value={throws} onChange={e=>setThrows(+e.target.value)} style={{width:"100%",accentColor:t.color}}/>
      <div style={{display:"flex",gap:4,marginTop:6}}>{[3,6,9,15,21,30].map(n=><button key={n} onClick={()=>setThrows(n)} style={{flex:1,padding:"4px 0",borderRadius:6,border:`1px solid ${throws===n?t.color:"#374151"}`,background:throws===n?`${t.color}15`:"transparent",color:throws===n?t.color:"#9ca3af",fontSize:11,cursor:"pointer"}}>{n}</button>)}</div>
    </div>
    <div style={{display:"flex",gap:8}}>
      <button onClick={()=>fields.length>0 && onStart({type:config.type,fields:[...fields].sort((a,b)=>b-a),throws})} disabled={!fields.length} style={{flex:1,padding:12,borderRadius:10,border:"none",background:fields.length?`linear-gradient(135deg,${t.color},${t.color}dd)`:"#374151",color:fields.length?"#fff":"#6b7280",fontWeight:600,fontSize:13,cursor:fields.length?"pointer":"not-allowed",display:"flex",alignItems:"center",justifyContent:"center",gap:5}}><Play size={15}/>Starten</button>
      <button onClick={onCancel} style={{padding:"10px 14px",borderRadius:10,border:"1px solid #374151",background:"transparent",color:"#9ca3af",cursor:"pointer",fontSize:12}}>Abbrechen</button>
    </div>
  </div>);
}

function TargetTrainerRun({plan,onDone,onCancel,soundOn}){
  // results: array per field {field, hits, throws, log: ['hit'|'miss',...]}
  const [results,setResults] = useState(()=>plan.fields.map(f=>({field:f, throws:0, hits:0, log:[]})));
  const [fieldIdx,setFieldIdx] = useState(0);
  const t = TARGET_TYPES[plan.type];

  const cur = results[fieldIdx];
  const isFieldDone = cur && cur.throws>=plan.throws;
  const isAllDone = results.every(r=>r.throws>=plan.throws);

  const register = (hit) => {
    if(!cur || isFieldDone) return;
    try{ if(soundOn){ const ctx=getAudioCtx();const o=ctx.createOscillator();const g=ctx.createGain();o.connect(g);g.connect(ctx.destination);o.type="sine";o.frequency.value=hit?660:220;g.gain.setValueAtTime(.15,ctx.currentTime);g.gain.exponentialRampToValueAtTime(.01,ctx.currentTime+.08);o.start(ctx.currentTime);o.stop(ctx.currentTime+.1);} }catch(e){}
    setResults(r=>r.map((x,i)=>i===fieldIdx?{...x,throws:x.throws+1,hits:x.hits+(hit?1:0),log:[...x.log,hit?"hit":"miss"]}:x));
  };
  const undo = () => {
    if(!cur || cur.throws===0) return;
    setResults(r=>r.map((x,i)=>{if(i!==fieldIdx)return x;const lg=[...x.log];const last=lg.pop();return{...x,throws:Math.max(0,x.throws-1),hits:Math.max(0,x.hits-(last==="hit"?1:0)),log:lg};}));
  };
  const nextField = () => { if(fieldIdx<results.length-1) setFieldIdx(fieldIdx+1); };
  const prevField = () => { if(fieldIdx>0) setFieldIdx(fieldIdx-1); };

  const totalThrows = results.reduce((a,r)=>a+r.throws,0);
  const totalHits = results.reduce((a,r)=>a+r.hits,0);
  const grandTotal = plan.fields.length * plan.throws;
  const pct = totalThrows ? Math.round(totalHits/totalThrows*100) : 0;

  const finish = () => {
    const targetResults = results.map(r=>({field:r.field, type:plan.type, hits:r.hits, throws:r.throws, percent: r.throws?Math.round(r.hits/r.throws*100):0}));
    const overallPct = totalThrows ? Math.round(totalHits/totalThrows*100) : 0;
    onDone({ targetResults, targetType:plan.type, targetFields:plan.fields, targetHits:totalHits, targetThrows:totalThrows, targetPercent:overallPct, doublePercent: plan.type==="double"?overallPct:undefined });
  };

  return(<div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
      <div style={{fontSize:13,fontWeight:600,color:"#f9fafb"}}><Crosshair size={14} color={t.color} style={{verticalAlign:"middle",marginRight:5}}/>{t.label}-Trainer</div>
      <div style={{fontSize:11,color:"#9ca3af",fontFamily:"'JetBrains Mono',monospace"}}>{totalThrows}/{grandTotal} · {pct}%</div>
    </div>
    {/* Field tabs */}
    <div style={{display:"flex",gap:4,marginBottom:10,overflowX:"auto",paddingBottom:2}}>
      {results.map((r,i)=>{const active=i===fieldIdx;const done=r.throws>=plan.throws;return(
        <button key={i} onClick={()=>setFieldIdx(i)} style={{padding:"6px 10px",borderRadius:8,border:`1.5px solid ${active?t.color:done?"#22c55e":"#374151"}`,background:active?`${t.color}20`:done?"rgba(34,197,94,.08)":"transparent",color:active?t.color:done?"#22c55e":"#9ca3af",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"'JetBrains Mono',monospace",whiteSpace:"nowrap"}}>
          {t.prefix}{r.field} <span style={{opacity:.7,fontSize:10}}>{r.hits}/{r.throws}</span>
        </button>
      );})}
    </div>
    {/* Big target display */}
    <div style={{padding:"22px 16px",borderRadius:14,background:`linear-gradient(160deg,${t.color}18,#0a0e1a)`,border:`1.5px solid ${t.color}40`,textAlign:"center",marginBottom:12}}>
      <div style={{fontSize:11,color:"#9ca3af",marginBottom:4,letterSpacing:".06em"}}>FELD</div>
      <div style={{fontSize:48,fontWeight:800,color:t.color,fontFamily:"'JetBrains Mono',monospace",lineHeight:1}}>{t.prefix}{cur?.field}</div>
      <div style={{fontSize:11,color:"#6b7280",marginTop:6}}>Wurf {Math.min(cur?.throws+1||1,plan.throws)} / {plan.throws} · {t.points(cur?.field||0)} Pkt pro Treffer</div>
      {/* hit/miss log dots */}
      <div style={{display:"flex",gap:3,justifyContent:"center",marginTop:10,flexWrap:"wrap",maxWidth:280,marginLeft:"auto",marginRight:"auto"}}>
        {Array.from({length:plan.throws}).map((_,i)=>{const log=cur?.log[i];return <div key={i} style={{width:14,height:14,borderRadius:7,background:log==="hit"?t.color:log==="miss"?"#ef444450":"#37415140",border:`1px solid ${log?"transparent":"#374151"}`}}/>;})}
      </div>
    </div>
    {/* Hit/Miss buttons */}
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
      <button onClick={()=>register(true)} disabled={isFieldDone} style={{padding:"18px 8px",borderRadius:12,border:"none",background:isFieldDone?"#374151":`linear-gradient(135deg,${t.color},${t.color}cc)`,color:isFieldDone?"#6b7280":"#fff",fontSize:18,fontWeight:700,cursor:isFieldDone?"not-allowed":"pointer",boxShadow:isFieldDone?"none":`0 4px 20px ${t.color}50`}}>
        <Check size={22} style={{verticalAlign:"middle",marginRight:6}}/>Treffer
      </button>
      <button onClick={()=>register(false)} disabled={isFieldDone} style={{padding:"18px 8px",borderRadius:12,border:`1.5px solid ${isFieldDone?"#374151":"#ef4444"}`,background:isFieldDone?"#1f2937":"rgba(239,68,68,.1)",color:isFieldDone?"#6b7280":"#ef4444",fontSize:18,fontWeight:700,cursor:isFieldDone?"not-allowed":"pointer"}}>
        <X size={22} style={{verticalAlign:"middle",marginRight:6}}/>Daneben
      </button>
    </div>
    <div style={{display:"flex",gap:6,marginBottom:8}}>
      <button onClick={undo} disabled={!cur||cur.throws===0} style={{flex:1,padding:8,borderRadius:8,border:"1px solid #374151",background:"transparent",color:cur&&cur.throws>0?"#9ca3af":"#4b5563",fontSize:11,cursor:cur&&cur.throws>0?"pointer":"not-allowed",display:"flex",alignItems:"center",justifyContent:"center",gap:4}}><RotateCcw size={12}/>Zurück</button>
      <button onClick={prevField} disabled={fieldIdx===0} style={{padding:"8px 12px",borderRadius:8,border:"1px solid #374151",background:"transparent",color:fieldIdx>0?"#9ca3af":"#4b5563",fontSize:11,cursor:fieldIdx>0?"pointer":"not-allowed"}}><ChevronLeft size={14}/></button>
      <button onClick={nextField} disabled={fieldIdx>=results.length-1} style={{padding:"8px 12px",borderRadius:8,border:"1px solid #374151",background:"transparent",color:fieldIdx<results.length-1?"#9ca3af":"#4b5563",fontSize:11,cursor:fieldIdx<results.length-1?"pointer":"not-allowed"}}><ChevronRight size={14}/></button>
    </div>
    {/* Live summary */}
    <div style={{padding:"8px 10px",borderRadius:8,background:"rgba(0,0,0,.25)",marginBottom:8}}>
      <div style={{fontSize:10,color:"#6b7280",marginBottom:4,letterSpacing:".05em"}}>QUOTE PRO FELD</div>
      <div style={{display:"flex",flexDirection:"column",gap:3}}>
        {results.map((r,i)=>{const p=r.throws?Math.round(r.hits/r.throws*100):0;return(
          <div key={i} style={{display:"flex",alignItems:"center",gap:6,fontSize:11}}>
            <span style={{minWidth:36,color:t.color,fontFamily:"'JetBrains Mono',monospace",fontWeight:600}}>{t.prefix}{r.field}</span>
            <div style={{flex:1,height:5,borderRadius:3,background:"#1f2937",overflow:"hidden"}}><div style={{height:"100%",width:`${p}%`,background:t.color,transition:"width .2s"}}/></div>
            <span style={{minWidth:62,textAlign:"right",color:"#d1d5db",fontFamily:"'JetBrains Mono',monospace"}}>{r.hits}/{r.throws} · {p}%</span>
          </div>
        );})}
      </div>
    </div>
    <div style={{display:"flex",gap:6}}>
      <button onClick={finish} style={{flex:1,padding:11,borderRadius:10,border:isAllDone?"none":"1px solid #22c55e40",background:isAllDone?"linear-gradient(135deg,#22c55e,#16a34a)":"rgba(34,197,94,.15)",color:isAllDone?"#fff":"#22c55e",fontWeight:600,fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:5}}><Check size={14}/>{isAllDone?"Auswerten & Speichern":"Vorzeitig beenden"}</button>
      <button onClick={onCancel} style={{padding:"10px 12px",borderRadius:10,border:"1px solid #374151",background:"transparent",color:"#9ca3af",fontSize:12,cursor:"pointer"}}>Verwerfen</button>
    </div>
  </div>);
}

// ─── COUNTDOWN DISPLAY (pure display, timer lives in main app) ──────────────
function CountdownDisplay({remaining,totalSeconds,isDone}){
  const min=Math.floor(remaining/60);const sec=remaining%60;
  const progress=totalSeconds>0?remaining/totalSeconds:0;
  const isLow=remaining<60&&remaining>0;const isWarn=remaining<30&&remaining>0;
  const tc=isDone?"#ef4444":isWarn?"#ef4444":isLow?"#f59e0b":"#22c55e";
  return(<div style={{textAlign:"center"}}>
    <div className={isDone?"timer-done":""} style={{fontSize:52,fontWeight:700,fontFamily:"'JetBrains Mono',monospace",color:tc,lineHeight:1,padding:"12px 20px",borderRadius:16,border:`2px solid ${tc}30`,background:isDone?"rgba(239,68,68,.08)":"rgba(0,0,0,.2)",transition:"color .3s,border-color .3s"}}>
      {isDone?"00:00":`${String(min).padStart(2,"0")}:${String(sec).padStart(2,"0")}`}
    </div>
    <div style={{height:4,borderRadius:2,background:"rgba(55,65,81,.5)",overflow:"hidden",marginTop:8}}><div style={{height:"100%",borderRadius:2,width:`${progress*100}%`,background:tc,transition:"width 1s linear"}}/></div>
    {isDone&&<div style={{marginTop:8,fontSize:14,fontWeight:600,color:"#ef4444",animation:"pulse 1.5s ease-in-out infinite"}}>⏰ Zeit abgelaufen!</div>}
  </div>);
}

// ─── WEEK COMPARISON CARD ────────────────────────────────────────────────────
function WeekComparisonCard({thisWeek,lastWeek}){
  if(!thisWeek.count&&!lastWeek.count)return null;
  const delta=(cur,prev)=>{const d=cur-prev;return{val:d>0?`+${Math.round(d*10)/10}`:d===0?"±0":`${Math.round(d*10)/10}`,color:d>0?"#22c55e":d<0?"#ef4444":"#6b7280",icon:d>0?"↑":d<0?"↓":"→"};};
  const items=[
    {label:"Sessions",cur:thisWeek.count,prev:lastWeek.count},
    {label:"Ø Average",cur:thisWeek.avg,prev:lastWeek.avg},
    {label:"Ø Doppel %",cur:thisWeek.dbl,prev:lastWeek.dbl},
    {label:"Minuten",cur:thisWeek.time,prev:lastWeek.time},
  ];
  return(
    <Card>
      <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:10}}><TrendingUp size={14} color="#38bdf8"/><span style={{fontSize:13,fontWeight:600,color:"#f9fafb"}}>Wochenvergleich</span><span style={{fontSize:10,color:"#6b7280",marginLeft:"auto"}}>Diese KW vs. letzte KW</span></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:6}}>
        {items.map((it,i)=>{const d=delta(it.cur,it.prev);return(
          <div key={i} style={{padding:"8px 6px",borderRadius:8,background:"rgba(0,0,0,.2)",textAlign:"center"}}>
            <div style={{fontSize:9,color:"#6b7280",marginBottom:4,textTransform:"uppercase",letterSpacing:".03em"}}>{it.label}</div>
            <div style={{fontSize:16,fontWeight:700,color:"#f9fafb",fontFamily:"'JetBrains Mono',monospace"}}>{it.cur||0}</div>
            <div style={{fontSize:10,fontWeight:600,color:d.color,marginTop:2}}>{d.icon} {d.val}</div>
          </div>
        );})}
      </div>
      {lastWeek.count>0&&thisWeek.avg>lastWeek.avg&&<div style={{marginTop:8,padding:"6px 10px",borderRadius:8,background:"rgba(34,197,94,.08)",border:"1px solid rgba(34,197,94,.15)",fontSize:11,color:"#22c55e",textAlign:"center"}}>📈 Dein Average steigt – weiter so!</div>}
      {lastWeek.count>0&&thisWeek.count>lastWeek.count&&<div style={{marginTop:4,padding:"6px 10px",borderRadius:8,background:"rgba(59,130,246,.08)",border:"1px solid rgba(59,130,246,.15)",fontSize:11,color:"#3b82f6",textAlign:"center"}}>🔥 Mehr Sessions als letzte Woche!</div>}
    </Card>
  );
}

// ─── DASHBOARD TAB ───────────────────────────────────────────────────────────
function DashboardTab({stats,progressData,categoryStats,levelProgress,currentPhase,profile,weekPlanData,weekComparison,onStartDay,onStartDrill,playersProgress,onSwitchPlayer}){
  const todayPlan=weekPlanData?.find(d=>d.isToday);
  return(
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <div style={{padding:"10px 12px",borderRadius:12,background:"linear-gradient(135deg,rgba(34,197,94,.1),rgba(34,197,94,.02))",border:"1px solid rgba(34,197,94,.25)",display:"flex",alignItems:"center",gap:10}}>
        <div style={{width:36,height:36,borderRadius:18,background:"rgba(34,197,94,.2)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,color:"#22c55e"}}>{profile.name.slice(0,1).toUpperCase()}</div>
        <div style={{flex:1}}><div style={{fontSize:14,fontWeight:700,color:"#f9fafb"}}>Hallo {profile.name} 👋</div><div style={{fontSize:11,color:"#9ca3af"}}>{LEVELS.find(l=>l.id===profile.level)?.label} · {profile.sessionsPerWeek}×/Woche · {profile.sessionDuration} Min</div></div>
        {playersProgress&&playersProgress.length>1&&<button onClick={onSwitchPlayer} style={{padding:"5px 10px",borderRadius:8,border:"1px solid rgba(34,197,94,.4)",background:"transparent",color:"#22c55e",fontSize:11,cursor:"pointer",display:"flex",alignItems:"center",gap:4}}><Users size={12}/>Wechseln</button>}
      </div>
      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
        <StatBox icon={Target} label="Sessions" value={stats.totalSessions} sub="abgeschlossen"/>
        <StatBox icon={TrendingUp} label="Ø Average" value={stats.avgScore} sub="pro Aufnahme" color="#3b82f6"/>
        <StatBox icon={Zap} label="Ø Doppel" value={`${stats.avgDouble}%`} sub="Trefferquote" color="#f59e0b"/>
        <StatBox icon={Flame} label="Streak" value={stats.streak} sub="Tage in Folge" color="#f97316"/>
      </div>
      {todayPlan&&(
        <Card glow>
          <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:10}}><CalendarDays size={14} color="#22c55e"/><span style={{fontSize:12,color:"#22c55e",fontWeight:600,textTransform:"uppercase",letterSpacing:".05em"}}>Heute – {todayPlan.dayNameFull}</span>{todayPlan.hasShifted&&<span style={{fontSize:9,padding:"1px 6px",borderRadius:10,background:"rgba(249,115,22,.15)",border:"1px solid rgba(249,115,22,.3)",color:"#f97316"}}>+Nachholtraining</span>}</div>
          {todayPlan.status==="done"?<div style={{textAlign:"center",padding:"10px 0"}}><div style={{fontSize:24,marginBottom:4}}>🎉</div><div style={{fontSize:16,fontWeight:600,color:"#22c55e"}}>Tagestraining abgeschlossen!</div><div style={{fontSize:12,color:"#6b7280",marginTop:2}}>{todayPlan.completedCount} Drills</div></div>
          :todayPlan.drills.length>0?<div>
            <div style={{fontSize:12,color:"#9ca3af",marginBottom:8}}>{todayPlan.totalDrills} Drills · ca. {todayPlan.drills.reduce((a,d)=>a+d.duration,0)} Min</div>
            {todayPlan.drills.map((drill,i)=>{const cat=CATEGORIES.find(c=>c.id===drill.category);const isDone=todayPlan.completedIds.has(drill.id);return(
              <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 8px",borderRadius:8,background:isDone?"rgba(34,197,94,.06)":"rgba(0,0,0,.15)",marginBottom:4,opacity:isDone?.6:1}}>
                <div style={{width:22,height:22,borderRadius:11,border:`2px solid ${isDone?"#22c55e":"#374151"}`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{isDone&&<Check size={12} color="#22c55e"/>}</div>
                <div style={{flex:1}}><div style={{fontSize:12,fontWeight:600,color:isDone?"#6b7280":"#f9fafb",textDecoration:isDone?"line-through":"none"}}>{drill.title}</div><div style={{fontSize:10,color:"#6b7280"}}>{cat?.icon} {drill.duration} Min{drill.shiftedFrom?" · nachgeholt":""}</div></div>
              </div>);})}
            <button onClick={()=>onStartDay(todayPlan.drills,todayPlan.date)} style={{width:"100%",padding:"11px",borderRadius:12,border:"none",background:"linear-gradient(135deg,#22c55e,#16a34a)",color:"#fff",fontSize:14,fontWeight:600,cursor:"pointer",marginTop:8,boxShadow:"0 4px 16px rgba(34,197,94,.35)",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}><Play size={16}/>{todayPlan.completedCount>0?"Fortsetzen":"Tagestraining starten"}</button>
          </div>:<div style={{textAlign:"center",padding:"10px 0"}}><div style={{fontSize:15,fontWeight:600,color:"#f9fafb"}}>Ruhetag 🧘</div></div>}
        </Card>
      )}
      {weekPlanData&&<Card>
        <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:10}}><CalendarDays size={14} color="#38bdf8"/><span style={{fontSize:13,fontWeight:600,color:"#f9fafb"}}>Diese Woche</span></div>
        <div style={{display:"flex",gap:4}}>{weekPlanData.map((d,i)=>{const sc=d.status==="done"?"#22c55e":d.status==="partial"?"#f59e0b":d.status==="missed"?"#ef4444":d.status==="planned"?"#3b82f6":"#374151";return(
          <div key={i} style={{flex:1,textAlign:"center",padding:"6px 2px",borderRadius:8,background:d.isToday?"rgba(34,197,94,.12)":"transparent",border:d.isToday?"1px solid rgba(34,197,94,.3)":"1px solid transparent"}}>
            <div style={{fontSize:10,color:d.isToday?"#22c55e":"#6b7280",fontWeight:d.isToday?600:400,marginBottom:4}}>{d.dayName}</div>
            <div style={{display:"flex",gap:2,justifyContent:"center"}}>{d.drills.length>0?d.drills.map((_,di)=><div key={di} style={{width:6,height:6,borderRadius:3,background:d.completedIds?.has(d.drills[di]?.id)?"#22c55e":sc}}/>):<div style={{width:6,height:6,borderRadius:3,background:"#374151"}}/>}</div>
            {d.totalDrills>0&&<div style={{fontSize:8,color:"#6b7280",marginTop:2}}>{d.completedCount}/{d.totalDrills}</div>}
          </div>);})}</div>
      </Card>}
      <WeekComparisonCard thisWeek={weekComparison.thisWeek} lastWeek={weekComparison.lastWeek}/>
      {levelProgress.nextLevel&&<Card>
        <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}><Award size={14} color="#f59e0b"/><span style={{fontSize:13,fontWeight:600,color:"#f9fafb"}}>Level</span><span style={{fontSize:11,color:"#6b7280",marginLeft:"auto"}}>{LEVELS.find(l=>l.id===profile.level)?.label} → {levelProgress.nextLevel.label}</span></div>
        <div style={{height:6,borderRadius:3,background:"rgba(55,65,81,.5)",overflow:"hidden",marginBottom:6}}><div style={{height:"100%",borderRadius:3,background:"linear-gradient(90deg,#22c55e,#16a34a)",width:`${levelProgress.percent}%`,transition:"width .5s"}}/></div>
        <div style={{display:"flex",gap:12,fontSize:10,color:"#6b7280"}}><span>Avg: {levelProgress.avgProgress}%</span><span>Doppel: {levelProgress.dblProgress}%</span><span>Sessions: {levelProgress.sessProgress}%</span></div>
      </Card>}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <Card style={{minWidth:0}}><h3 style={{fontSize:12,fontWeight:600,color:"#f9fafb",marginBottom:10}}>Scoring-Verlauf</h3>{progressData.length>1?<ResponsiveContainer width="100%" height={140}><LineChart data={progressData}><XAxis dataKey="nr" tick={{fontSize:9,fill:"#6b7280"}} axisLine={false} tickLine={false}/><YAxis tick={{fontSize:9,fill:"#6b7280"}} axisLine={false} tickLine={false} width={28}/><Tooltip contentStyle={{background:"#1f2937",border:"1px solid #374151",borderRadius:8,fontSize:11}}/><Line type="monotone" dataKey="avg" stroke="#22c55e" strokeWidth={2} dot={{r:2,fill:"#22c55e"}} name="Ø Score"/></LineChart></ResponsiveContainer>:<p style={{color:"#6b7280",fontSize:11,textAlign:"center",padding:"30px 0"}}>Starte dein erstes Training!</p>}</Card>
        <Card style={{minWidth:0}}><h3 style={{fontSize:12,fontWeight:600,color:"#f9fafb",marginBottom:10}}>Verteilung</h3>{categoryStats.some(c=>c.count>0)?<ResponsiveContainer width="100%" height={140}><RadarChart data={categoryStats} cx="50%" cy="50%" outerRadius="65%"><PolarGrid stroke="#374151"/><PolarAngleAxis dataKey="category" tick={{fontSize:9,fill:"#9ca3af"}}/><Radar dataKey="count" stroke="#22c55e" fill="#22c55e" fillOpacity={0.2}/></RadarChart></ResponsiveContainer>:<p style={{color:"#6b7280",fontSize:11,textAlign:"center",padding:"30px 0"}}>Trainiere für die Übersicht</p>}</Card>
      </div>
      <Card><div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}><Calendar size={14} color={currentPhase.color}/><span style={{fontSize:13,fontWeight:600,color:"#f9fafb"}}>{currentPhase.name}</span><span style={{fontSize:10,padding:"2px 6px",borderRadius:20,border:`1px solid ${currentPhase.color}40`,color:currentPhase.color}}>{currentPhase.levelRange}</span></div><p style={{fontSize:12,color:"#9ca3af"}}>Fokus: {currentPhase.focus}</p></Card>
      {playersProgress&&playersProgress.length>1&&<Card>
        <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:10}}><Users size={14} color="#8b5cf6"/><span style={{fontSize:13,fontWeight:600,color:"#f9fafb"}}>Spielervergleich</span></div>
        <div style={{display:"flex",flexDirection:"column",gap:5}}>
          {playersProgress.map(({player:p,stats:s})=>(
            <div key={p.id} style={{display:"grid",gridTemplateColumns:"22px 1fr auto auto auto",gap:8,padding:"6px 8px",borderRadius:8,background:p.id===profile.id?"rgba(34,197,94,.06)":"rgba(0,0,0,.18)",alignItems:"center"}}>
              <div style={{width:22,height:22,borderRadius:11,background:"rgba(139,92,246,.18)",color:"#a78bfa",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700}}>{p.name.slice(0,1).toUpperCase()}</div>
              <div style={{fontSize:12,color:"#f9fafb",fontWeight:600}}>{p.name}<span style={{fontSize:10,color:"#6b7280",fontWeight:400,marginLeft:5}}>{LEVELS.find(l=>l.id===p.level)?.label}</span></div>
              <div style={{fontSize:11,color:"#9ca3af",fontFamily:"'JetBrains Mono',monospace"}}>{s.totalSessions} S.</div>
              <div style={{fontSize:11,color:"#22c55e",fontFamily:"'JetBrains Mono',monospace"}}>Ø {s.avgScore}</div>
              <div style={{fontSize:11,color:"#f59e0b",fontFamily:"'JetBrains Mono',monospace"}}>D {s.avgDouble}%</div>
            </div>
          ))}
        </div>
      </Card>}
    </div>
  );
}

// ─── WEEK PLAN TAB ───────────────────────────────────────────────────────────
function WeekPlanTab({weekPlanData,weekOffset,setWeekOffset,weekDates,library,profile,onAssign,onRemove,onStartDay,sessions}){
  const [assigningDay,setAssigningDay]=useState(null);
  const lvlIdx=LEVELS.findIndex(l=>l.id===profile.level);
  const suitable=library.filter(d=>{const dL=LEVELS.findIndex(l=>l.id===d.level);return dL<=lvlIdx+1;});
  const weekNum=getWeekNumber(new Date(weekDates[0]));const monthName=new Date(weekDates[0]).toLocaleDateString("de-DE",{month:"long",year:"numeric"});const isCur=weekOffset===0;
  const planned=weekPlanData.filter(d=>d.isTrainingDay).length;const done=weekPlanData.filter(d=>d.status==="done").length;
  return(<div style={{display:"flex",flexDirection:"column",gap:12}}>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
      <button onClick={()=>setWeekOffset(w=>w-1)} style={{padding:"6px 10px",borderRadius:8,border:"1px solid #374151",background:"transparent",color:"#9ca3af",cursor:"pointer"}}><ChevronLeft size={16}/></button>
      <div style={{textAlign:"center"}}><div style={{fontSize:15,fontWeight:600,color:"#f9fafb"}}>KW {weekNum} · {monthName}</div><div style={{fontSize:11,color:isCur?"#22c55e":"#6b7280"}}>{isCur?"Aktuelle Woche":`${fmtDate(weekDates[0])} – ${fmtDate(weekDates[6])}`}</div></div>
      <button onClick={()=>setWeekOffset(w=>w+1)} style={{padding:"6px 10px",borderRadius:8,border:"1px solid #374151",background:"transparent",color:"#9ca3af",cursor:"pointer"}}><ChevronRight size={16}/></button>
    </div>
    <Card><div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}><span style={{fontSize:12,fontWeight:600,color:"#f9fafb"}}>Wochenfortschritt</span><span style={{fontSize:12,color:"#22c55e",fontWeight:600}}>{done}/{planned} Tage</span></div><div style={{height:6,borderRadius:3,background:"rgba(55,65,81,.5)",overflow:"hidden"}}><div style={{height:"100%",borderRadius:3,background:"linear-gradient(90deg,#22c55e,#16a34a)",width:`${planned?Math.round(done/planned*100):0}%`}}/></div></Card>
    {weekPlanData.map(day=>{
      const sc={done:"#22c55e",partial:"#f59e0b",missed:"#ef4444",planned:"#3b82f6",rest:"#374151"};
      const sl={done:"Erledigt",partial:"Teilweise",missed:"Verpasst",planned:"Geplant",rest:"Ruhetag"};
      const isA=assigningDay===day.date;
      return(<Card key={day.date} style={{borderColor:day.isToday?"rgba(34,197,94,.4)":"rgba(55,65,81,.6)",background:day.isToday?"linear-gradient(145deg,rgba(34,197,94,.06),rgba(15,23,42,.95))":undefined}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10}}>
          <div style={{flex:1}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
              <span style={{fontSize:14,fontWeight:700,color:day.isToday?"#22c55e":"#f9fafb"}}>{day.dayNameFull}</span><span style={{fontSize:11,color:"#6b7280"}}>{fmtDate(day.date)}</span>
              {day.isToday&&<span style={{fontSize:9,padding:"1px 6px",borderRadius:10,background:"rgba(34,197,94,.2)",color:"#22c55e",fontWeight:600}}>HEUTE</span>}
              {day.hasShifted&&<span style={{fontSize:9,padding:"1px 6px",borderRadius:10,background:"rgba(249,115,22,.15)",color:"#f97316"}}>+Nachgeholt</span>}
            </div>
            <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}><div style={{width:8,height:8,borderRadius:4,background:sc[day.status]}}/><span style={{fontSize:12,color:sc[day.status],fontWeight:500}}>{sl[day.status]}</span>{day.totalDrills>0&&<span style={{fontSize:11,color:"#6b7280"}}>· {day.completedCount}/{day.totalDrills}</span>}</div>
            {day.drills.map((drill,di)=>{const cat=CATEGORIES.find(c=>c.id===drill.category);const isDone=day.completedIds?.has(drill.id);return(
              <div key={di} style={{display:"flex",alignItems:"center",gap:6,padding:"5px 8px",borderRadius:6,background:isDone?"rgba(34,197,94,.06)":"rgba(0,0,0,.15)",marginBottom:3,opacity:isDone?.65:1}}>
                <div style={{width:16,height:16,borderRadius:8,border:`1.5px solid ${isDone?"#22c55e":"#4b5563"}`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{isDone&&<Check size={9} color="#22c55e"/>}</div>
                <span style={{fontSize:11,fontWeight:500,color:isDone?"#6b7280":"#e5e7eb",flex:1,textDecoration:isDone?"line-through":"none"}}>{cat?.icon} {drill.title}</span><span style={{fontSize:10,color:"#6b7280"}}>{drill.duration}m</span>
              </div>);})}
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:4}}>
            {day.drills.length>0&&day.status!=="done"&&!day.isPast&&<button onClick={()=>onStartDay(day.drills,day.date)} style={{padding:"6px 12px",borderRadius:8,border:"none",background:"linear-gradient(135deg,#22c55e,#16a34a)",color:"#fff",fontSize:11,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",gap:3}}><Play size={12}/>Start</button>}
            {day.isOriginalTrainingDay&&day.status!=="done"&&<button onClick={()=>setAssigningDay(isA?null:day.date)} style={{padding:"5px 10px",borderRadius:8,border:"1px solid #374151",background:"transparent",color:"#9ca3af",fontSize:11,cursor:"pointer"}}><Edit3 size={11}/></button>}
          </div>
        </div>
        {isA&&<div style={{marginTop:10,padding:10,borderRadius:8,background:"rgba(0,0,0,.3)",border:"1px solid #374151"}}><div style={{fontSize:11,color:"#6b7280",marginBottom:6}}>Drills zuweisen:</div><DrillMultiSelect drills={suitable} onConfirm={ids=>{onAssign(day.date,ids);setAssigningDay(null);}} onCancel={()=>setAssigningDay(null)}/></div>}
      </Card>);
    })}
    {!isCur&&<button onClick={()=>setWeekOffset(0)} style={{padding:10,borderRadius:10,border:"1px solid rgba(34,197,94,.3)",background:"rgba(34,197,94,.08)",color:"#22c55e",fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}><CalendarDays size={14}/>Aktuelle Woche</button>}
  </div>);
}
function DrillMultiSelect({drills,onConfirm,onCancel}){
  const [sel,setSel]=useState([]);const toggle=id=>setSel(s=>s.includes(id)?s.filter(x=>x!==id):[...s,id]);
  return(<div><div style={{maxHeight:200,overflowY:"auto",display:"flex",flexDirection:"column",gap:3}}>{drills.map(d=>{const cat=CATEGORIES.find(c=>c.id===d.category);const isSel=sel.includes(d.id);return(<button key={d.id} onClick={()=>toggle(d.id)} style={{padding:"5px 8px",borderRadius:6,border:`1px solid ${isSel?"#22c55e":"#374151"}`,background:isSel?"rgba(34,197,94,.08)":"rgba(17,24,39,.8)",color:isSel?"#22c55e":"#e5e7eb",fontSize:11,cursor:"pointer",textAlign:"left",display:"flex",justifyContent:"space-between"}}><span>{cat?.icon} {d.title}</span><span style={{fontSize:10,color:"#6b7280"}}>{d.duration}m</span></button>);})}</div>
    <div style={{display:"flex",gap:6,marginTop:8}}><button onClick={()=>sel.length&&onConfirm(sel)} disabled={!sel.length} style={{flex:1,padding:6,borderRadius:6,border:"none",background:sel.length?"#22c55e":"#374151",color:sel.length?"#fff":"#6b7280",fontSize:11,fontWeight:600,cursor:sel.length?"pointer":"not-allowed"}}>{sel.length} zuweisen</button><button onClick={onCancel} style={{padding:"6px 10px",borderRadius:6,border:"1px solid #374151",background:"transparent",color:"#9ca3af",fontSize:11,cursor:"pointer"}}>×</button></div>
  </div>);
}

// ─── TRAINING TAB (COUNTDOWN + DAY MODE + DRAG & DROP + TARGET TRAINER) ─────
function TrainingTab({dayTraining,sessionScores,setSessionScores,timerRemaining,timerTotal,timerActive,setTimerActive,timerFinished,onComplete,onSkip,onReorder,onStartDrill,library,profile,settings,weekPlanData,onStartDay}){
  const updateScore=(k,v)=>setSessionScores(prev=>({...prev,[k]:v}));
  const [dragIdx,setDragIdx]=useState(null);const [dragOverIdx,setDragOverIdx]=useState(null);
  const [targetPlan,setTargetPlan]=useState(null); // {type,fields,throws} once user confirmed setup

  if(!dayTraining){
    const todayPlan=weekPlanData?.find(d=>d.isToday);const lvlIdx=LEVELS.findIndex(l=>l.id===profile.level);
    const quick=library.filter(d=>{const dL=LEVELS.findIndex(l=>l.id===d.level);return dL<=lvlIdx+1;}).slice(0,6);
    return(<div style={{display:"flex",flexDirection:"column",gap:12}}>
      <Card glow><div style={{textAlign:"center",padding:"16px 0"}}><Target size={36} color="#22c55e" style={{margin:"0 auto 10px",opacity:.8}}/><h2 style={{fontSize:17,fontWeight:600,color:"#f9fafb",marginBottom:4}}>Bereit zum Training?</h2><p style={{fontSize:12,color:"#9ca3af",marginBottom:14}}>Starte dein Tagestraining oder wähle einen Drill</p>
        {todayPlan&&todayPlan.drills.length>0&&todayPlan.status!=="done"&&<button onClick={()=>onStartDay(todayPlan.drills,todayPlan.date)} style={{padding:"12px 24px",borderRadius:12,border:"none",background:"linear-gradient(135deg,#22c55e,#16a34a)",color:"#fff",fontSize:15,fontWeight:600,cursor:"pointer",boxShadow:"0 4px 16px rgba(34,197,94,.35)",display:"inline-flex",alignItems:"center",gap:6}}><ListChecks size={18}/>Tagestraining ({todayPlan.drills.length} Drills)</button>}
      </div></Card>
      <h3 style={{fontSize:13,fontWeight:600,color:"#f9fafb"}}>Einzelne Drills</h3>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>{quick.map(d=><button key={d.id} onClick={()=>onStartDrill(d)} style={{padding:"10px 12px",borderRadius:10,border:"1px solid rgba(55,65,81,.6)",background:"rgba(17,24,39,.6)",cursor:"pointer",textAlign:"left"}}><div style={{fontSize:12,fontWeight:600,color:"#f9fafb",marginBottom:2}}>{d.title}</div><div style={{fontSize:10,color:"#6b7280"}}>{d.duration} Min · {CATEGORIES.find(c=>c.id===d.category)?.label}</div></button>)}</div>
    </div>);
  }

  const{drills,currentIndex,completedIndices}=dayTraining;const cur=drills[currentIndex];const cat=CATEGORIES.find(c=>c.id===cur?.category);const isMulti=drills.length>1;
  const isTargetDrill = !!cur?.targetConfig;
  // Reset target plan when drill index changes
  useEffect(()=>{ setTargetPlan(null); },[currentIndex]);

  // Drag & Drop handlers for reordering future drills
  const canDrag=(i)=>i>currentIndex&&!completedIndices.has(i);
  const handleDragStart=(e,i)=>{setDragIdx(i);e.dataTransfer.effectAllowed="move";e.dataTransfer.setData("text/plain",i);};
  const handleDragOver=(e,i)=>{e.preventDefault();if(canDrag(i)||i>currentIndex)setDragOverIdx(i);};
  const handleDrop=(e,targetIdx)=>{
    e.preventDefault();
    const fromIdx=dragIdx;setDragIdx(null);setDragOverIdx(null);
    if(fromIdx===null||fromIdx===targetIdx||fromIdx<=currentIndex||targetIdx<=currentIndex)return;
    const nd=[...drills];const [moved]=nd.splice(fromIdx,1);nd.splice(targetIdx,0,moved);onReorder(nd);
  };
  const moveDrill=(fromIdx,dir)=>{
    const toIdx=fromIdx+dir;if(toIdx<=currentIndex||toIdx>=drills.length||fromIdx<=currentIndex)return;
    const nd=[...drills];const [moved]=nd.splice(fromIdx,1);nd.splice(toIdx,0,moved);onReorder(nd);
  };

  return(<div style={{display:"flex",flexDirection:"column",gap:12}}>
    {isMulti&&(<Card>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}><div style={{display:"flex",alignItems:"center",gap:6}}><ListChecks size={14} color="#22c55e"/><span style={{fontSize:13,fontWeight:600,color:"#f9fafb"}}>Tagestraining</span></div><span style={{fontSize:12,color:"#22c55e",fontWeight:600,fontFamily:"'JetBrains Mono',monospace"}}>{currentIndex+1}/{drills.length}</span></div>
      <div style={{display:"flex",gap:4,marginBottom:6}}>{drills.map((d,i)=>{const isDone=completedIndices.has(i);const isCur=i===currentIndex;return <div key={i} style={{flex:1,height:6,borderRadius:3,background:isDone?"#22c55e":isCur?"#3b82f6":"rgba(55,65,81,.5)"}}/>;})}</div>
      {/* Draggable drill list */}
      <div style={{display:"flex",flexDirection:"column",gap:3}}>
        {drills.map((d,i)=>{const isDone=completedIndices.has(i);const isCur=i===currentIndex;const dCat=CATEGORIES.find(c=>c.id===d.category);const draggable=canDrag(i);
          return(<div key={i} draggable={draggable} onDragStart={e=>handleDragStart(e,i)} onDragOver={e=>handleDragOver(e,i)} onDragLeave={()=>setDragOverIdx(null)} onDrop={e=>handleDrop(e,i)}
            style={{display:"flex",alignItems:"center",gap:4,padding:"4px 8px",borderRadius:6,border:`1px solid ${isCur?"#3b82f6":isDone?"#22c55e30":dragOverIdx===i?"#f59e0b":"#374151"}`,background:isCur?"rgba(59,130,246,.1)":isDone?"rgba(34,197,94,.06)":dragOverIdx===i?"rgba(245,158,11,.08)":"transparent",cursor:draggable?"grab":"default",opacity:dragIdx===i?.4:1,transition:"opacity .15s,border-color .15s"}}>
            {draggable&&<GripVertical size={12} color="#6b7280" style={{flexShrink:0,cursor:"grab"}}/>}
            <span style={{fontSize:10,color:isCur?"#3b82f6":isDone?"#22c55e":"#6b7280",fontWeight:isCur?600:400,flex:1,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{isDone?"✓ ":isCur?"▸ ":""}{dCat?.icon} {d.title}</span>
            {draggable&&<div style={{display:"flex",flexDirection:"column",gap:0}}>
              <button onClick={()=>moveDrill(i,-1)} disabled={i<=currentIndex+1} style={{background:"none",border:"none",cursor:i>currentIndex+1?"pointer":"default",padding:0,lineHeight:1}}><ArrowUp size={10} color={i>currentIndex+1?"#9ca3af":"#374151"}/></button>
              <button onClick={()=>moveDrill(i,1)} disabled={i>=drills.length-1} style={{background:"none",border:"none",cursor:i<drills.length-1?"pointer":"default",padding:0,lineHeight:1}}><ArrowDown size={10} color={i<drills.length-1?"#9ca3af":"#374151"}/></button>
            </div>}
          </div>);
        })}
      </div>
    </Card>)}

    {/* Current Drill */}
    <Card glow style={{background:"linear-gradient(145deg,rgba(34,197,94,.04),rgba(15,23,42,.95))"}}>
      <div style={{marginBottom:12}}>
        <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:5}}><span style={{fontSize:11,padding:"2px 7px",borderRadius:20,background:`${cat?.color}20`,color:cat?.color,border:`1px solid ${cat?.color}30`}}>{cat?.icon} {cat?.label}</span><span style={{fontSize:10,color:"#6b7280"}}>{cur.duration} Min</span>{cur.omniCompatible&&<span style={{fontSize:9,padding:"2px 5px",borderRadius:10,background:"rgba(56,189,248,.1)",border:"1px solid rgba(56,189,248,.25)",color:"#38bdf8"}}>Omni</span>}</div>
        <h2 style={{fontSize:18,fontWeight:700,color:"#f9fafb",marginBottom:3}}>{cur.title}</h2>
        <p style={{fontSize:12,color:"#9ca3af"}}>{cur.description}</p>
      </div>
      <div style={{padding:10,borderRadius:10,background:"rgba(0,0,0,.2)",marginBottom:12}}>
        <div style={{fontSize:11,fontWeight:600,color:"#9ca3af",marginBottom:6,textTransform:"uppercase",letterSpacing:".04em"}}>Ablauf</div>
        {cur.steps.map((step,i)=><div key={i} style={{display:"flex",gap:6,padding:"4px 0",borderBottom:i<cur.steps.length-1?"1px solid rgba(55,65,81,.3)":"none"}}><span style={{fontSize:11,fontWeight:600,color:"#22c55e",minWidth:16}}>{i+1}.</span><span style={{fontSize:12,color:"#d1d5db"}}>{step}</span></div>)}
      </div>
      {!isTargetDrill&&<>
        <CountdownDisplay remaining={timerRemaining} totalSeconds={timerTotal} isDone={timerFinished}/>
        {!timerActive&&!timerFinished&&<button onClick={()=>setTimerActive(true)} style={{width:"100%",padding:12,borderRadius:12,border:"none",background:"linear-gradient(135deg,#22c55e,#16a34a)",color:"#fff",fontSize:14,fontWeight:600,cursor:"pointer",marginTop:10,boxShadow:"0 4px 16px rgba(34,197,94,.35)",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}><Play size={16}/>Timer starten</button>}
        {timerActive&&!timerFinished&&<button onClick={()=>setTimerActive(false)} style={{width:"100%",padding:12,borderRadius:12,border:"1px solid #374151",background:"rgba(0,0,0,.3)",color:"#9ca3af",fontSize:14,cursor:"pointer",marginTop:10,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}><Pause size={16}/>Pause</button>}
      </>}
    </Card>

    {isTargetDrill&&(<Card glow>
      {!targetPlan
        ? <TargetTrainerSetup config={cur.targetConfig} onStart={(plan)=>setTargetPlan(plan)} onCancel={onSkip}/>
        : <TargetTrainerRun plan={targetPlan} soundOn={settings.soundEnabled!==false} onDone={(scores)=>{ onComplete(scores); }} onCancel={()=>setTargetPlan(null)}/>
      }
    </Card>)}

    {!isTargetDrill&&(timerActive||timerFinished)&&(<Card className={timerFinished?"timer-done":""} style={timerFinished?{borderColor:"rgba(34,197,94,.5)",background:"linear-gradient(145deg,rgba(34,197,94,.08),rgba(15,23,42,.95))"}:{}}>
      <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:10}}><Zap size={14} color={timerFinished?"#22c55e":"#f59e0b"}/><h3 style={{fontSize:13,fontWeight:600,color:"#f9fafb"}}>{timerFinished?"Zeit um – Ergebnis eintragen!":"Ergebnis-Erfassung"}</h3></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
        <ScoreInput label="Ø Average" value={sessionScores.average} onChange={v=>updateScore("average",v)} max={180} step={0.1} color="#22c55e"/>
        <ScoreInput label="Doppel %" value={sessionScores.doublePercent} onChange={v=>updateScore("doublePercent",v)} max={100} suffix="%" color="#ef4444"/>
        <ScoreInput label="Checkout %" value={sessionScores.checkoutPercent} onChange={v=>updateScore("checkoutPercent",v)} max={100} suffix="%" color="#3b82f6"/>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginTop:8}}>
        <ScoreInput label="180er" value={sessionScores.s180} onChange={v=>updateScore("s180",v)} max={50} color="#f59e0b" integer/>
        <ScoreInput label="140+" value={sessionScores.s140} onChange={v=>updateScore("s140",v)} max={99} color="#f59e0b" integer/>
        <ScoreInput label="100+" value={sessionScores.s100} onChange={v=>updateScore("s100",v)} max={99} color="#f59e0b" integer/>
      </div>
      {cur.id==="d_bobs27"&&<div style={{marginTop:8}}><ScoreInput label="Bob's 27 Score" value={sessionScores.bobs27Score} onChange={v=>updateScore("bobs27Score",v)} max={999} color="#8b5cf6" integer/></div>}
      <div style={{marginTop:8}}><label style={{fontSize:11,color:"#6b7280",marginBottom:3,display:"block"}}>Notizen</label><textarea value={sessionScores.notes} onChange={e=>updateScore("notes",e.target.value)} placeholder="Gefühl, Besonderheiten..." style={{width:"100%",padding:"8px 10px",borderRadius:8,border:"1px solid #374151",background:"#0a0e1a",color:"#e5e7eb",fontSize:12,minHeight:50,resize:"vertical",outline:"none",fontFamily:"inherit"}}/></div>
      <div style={{display:"flex",gap:8,marginTop:12}}>
        <button onClick={onComplete} style={{flex:1,padding:11,borderRadius:10,border:"none",background:"linear-gradient(135deg,#22c55e,#16a34a)",color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:5}}><Check size={16}/>{isMulti&&currentIndex<drills.length-1?`Weiter (${currentIndex+2}/${drills.length})`:"Abschließen"}</button>
        <button onClick={onSkip} style={{padding:"11px 14px",borderRadius:10,border:"1px solid #374151",background:"transparent",color:"#9ca3af",fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",gap:4}}><SkipForward size={14}/>Skip</button>
      </div>
    </Card>)}
  </div>);
}

// ─── RESULTS TAB ─────────────────────────────────────────────────────────────
function ResultsTab({sessions,expandedSession,setExpandedSession,onDelete,progressData}){
  const sorted=useMemo(()=>[...sessions].sort((a,b)=>b.date.localeCompare(a.date)),[sessions]);
  const completed=sorted.filter(s=>s.status==="completed");
  return(<div style={{display:"flex",flexDirection:"column",gap:12}}>
    {progressData.length>1&&<Card><h3 style={{fontSize:12,fontWeight:600,color:"#f9fafb",marginBottom:8}}>Verlauf</h3><ResponsiveContainer width="100%" height={120}><LineChart data={progressData}><XAxis dataKey="nr" tick={{fontSize:9,fill:"#6b7280"}} axisLine={false} tickLine={false}/><YAxis tick={{fontSize:9,fill:"#6b7280"}} axisLine={false} tickLine={false} width={28}/><Tooltip contentStyle={{background:"#1f2937",border:"1px solid #374151",borderRadius:8,fontSize:11}}/><Line type="monotone" dataKey="avg" stroke="#22c55e" strokeWidth={2} dot={{r:2}} name="Average"/><Line type="monotone" dataKey="dbl" stroke="#ef4444" strokeWidth={2} dot={{r:2}} name="Doppel %"/></LineChart></ResponsiveContainer></Card>}
    <div style={{display:"flex",justifyContent:"space-between"}}><h3 style={{fontSize:13,fontWeight:600,color:"#f9fafb"}}>{sorted.length} Sessions</h3><span style={{fontSize:11,color:"#6b7280"}}>{completed.length} abgeschlossen</span></div>
    {!sorted.length?<Card><p style={{textAlign:"center",color:"#6b7280",padding:16,fontSize:12}}>Noch keine Ergebnisse.</p></Card>:sorted.map(s=>{
      const cat=CATEGORIES.find(c=>c.id===s.category);const exp=expandedSession===s.id;
      return(<Card key={s.id} style={{cursor:"pointer"}} onClick={()=>setExpandedSession(exp?null:s.id)}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}><div style={{width:32,height:32,borderRadius:8,background:`${cat?.color||"#374151"}15`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>{cat?.icon||"🎯"}</div><div><div style={{fontSize:13,fontWeight:600,color:"#f9fafb"}}>{s.drillTitle}</div><div style={{fontSize:10,color:"#6b7280"}}>{fmtDate(s.date)} · {s.duration}m</div></div></div>
          <div style={{display:"flex",alignItems:"center",gap:6}}>{s.status==="completed"&&s.scores?.average>0&&<span style={{fontSize:15,fontWeight:700,fontFamily:"'JetBrains Mono',monospace",color:"#22c55e"}}>{s.scores.average}</span>}<span style={{fontSize:10,padding:"2px 6px",borderRadius:20,border:`1px solid ${s.status==="completed"?"#22c55e30":"#f59e0b30"}`,color:s.status==="completed"?"#22c55e":"#f59e0b"}}>{s.status==="completed"?"✓":"skip"}</span>{exp?<ChevronUp size={14} color="#6b7280"/>:<ChevronDown size={14} color="#6b7280"/>}</div>
        </div>
        {exp&&s.scores&&<div style={{marginTop:10,paddingTop:10,borderTop:"1px solid rgba(55,65,81,.4)"}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6,marginBottom:6}}>{s.scores.average>0&&<MiniStat label="Average" value={s.scores.average}/>}{s.scores.doublePercent>0&&<MiniStat label="Doppel" value={`${s.scores.doublePercent}%`}/>}{s.scores.checkoutPercent>0&&<MiniStat label="Checkout" value={`${s.scores.checkoutPercent}%`}/>}{s.scores.s180>0&&<MiniStat label="180er" value={s.scores.s180}/>}{s.scores.s140>0&&<MiniStat label="140+" value={s.scores.s140}/>}{s.scores.s100>0&&<MiniStat label="100+" value={s.scores.s100}/>}{s.scores.targetPercent!==undefined&&<MiniStat label={`${(TARGET_TYPES[s.scores.targetType]||{}).label||"Target"}-%`} value={`${s.scores.targetPercent}%`}/>}{s.scores.targetThrows>0&&<MiniStat label="Treffer/Würfe" value={`${s.scores.targetHits}/${s.scores.targetThrows}`}/>}</div>
          {Array.isArray(s.scores.targetResults)&&s.scores.targetResults.length>0&&<div style={{padding:"6px 8px",borderRadius:8,background:"rgba(0,0,0,.25)",marginBottom:6}}>
            <div style={{fontSize:10,color:"#6b7280",marginBottom:4}}>{(TARGET_TYPES[s.scores.targetType]||{}).label} pro Feld</div>
            {s.scores.targetResults.map((r,ri)=>{const tt=TARGET_TYPES[r.type]||TARGET_TYPES.double;return(
              <div key={ri} style={{display:"flex",alignItems:"center",gap:6,fontSize:11,marginBottom:2}}>
                <span style={{minWidth:32,color:tt.color,fontWeight:600,fontFamily:"'JetBrains Mono',monospace"}}>{tt.prefix}{r.field}</span>
                <div style={{flex:1,height:4,borderRadius:2,background:"#1f2937",overflow:"hidden"}}><div style={{height:"100%",width:`${r.percent}%`,background:tt.color}}/></div>
                <span style={{minWidth:60,textAlign:"right",color:"#d1d5db",fontFamily:"'JetBrains Mono',monospace",fontSize:10}}>{r.hits}/{r.throws} · {r.percent}%</span>
              </div>
            );})}
          </div>}
          {s.scores.notes&&<p style={{fontSize:11,color:"#9ca3af",fontStyle:"italic",marginBottom:6}}>"{s.scores.notes}"</p>}
          <button onClick={e=>{e.stopPropagation();onDelete(s.id);}} style={{fontSize:10,color:"#ef4444",background:"none",border:"none",cursor:"pointer",display:"flex",alignItems:"center",gap:3}}><Trash2 size={11}/>Löschen</button>
        </div>}
      </Card>);
    })}
  </div>);
}

// ─── LIBRARY TAB ─────────────────────────────────────────────────────────────
function LibraryTab({library,filterCat,setFilterCat,onStartDrill,onAdd,onDelete,editingDrill,setEditingDrill,profile,installedPacks,onInstallPack,onImportDrills}){
  const [showPacks,setShowPacks]=useState(false);const [showImp,setShowImp]=useState(false);const [impJson,setImpJson]=useState("");const [urlIn,setUrlIn]=useState("");const [urlLoad,setUrlLoad]=useState(false);const [urlErr,setUrlErr]=useState("");
  const filtered=filterCat==="all"?library:library.filter(d=>d.category===filterCat);const lvlIdx=LEVELS.findIndex(l=>l.id===profile.level);
  const fetchUrl=async()=>{if(!urlIn.trim())return;setUrlLoad(true);setUrlErr("");try{const r=await fetch(urlIn.trim());if(!r.ok)throw new Error(`HTTP ${r.status}`);onImportDrills(await r.text());setUrlIn("");setShowImp(false);}catch(e){setUrlErr(e.message);}setUrlLoad(false);};
  return(<div style={{display:"flex",flexDirection:"column",gap:12}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}>
      <h2 style={{fontSize:15,fontWeight:600,color:"#f9fafb"}}>Bibliothek ({library.length})</h2>
      <div style={{display:"flex",gap:4}}>
        <button onClick={()=>setShowPacks(!showPacks)} style={{padding:"6px 10px",borderRadius:8,border:"1px solid #3b82f630",background:"rgba(59,130,246,.1)",color:"#3b82f6",fontSize:11,cursor:"pointer",display:"flex",alignItems:"center",gap:3}}><Package size={12}/>Pakete</button>
        <button onClick={()=>setShowImp(!showImp)} style={{padding:"6px 10px",borderRadius:8,border:"1px solid #8b5cf630",background:"rgba(139,92,246,.1)",color:"#8b5cf6",fontSize:11,cursor:"pointer",display:"flex",alignItems:"center",gap:3}}><Globe size={12}/>Import</button>
        <button onClick={()=>setEditingDrill({})} style={{padding:"6px 10px",borderRadius:8,border:"none",background:"linear-gradient(135deg,#22c55e,#16a34a)",color:"#fff",fontSize:11,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",gap:3}}><Plus size={12}/>Neu</button>
      </div>
    </div>
    {showPacks&&<Card style={{borderColor:"rgba(59,130,246,.3)"}}><div style={{display:"flex",alignItems:"center",gap:6,marginBottom:10}}><Package size={14} color="#3b82f6"/><h3 style={{fontSize:13,fontWeight:600,color:"#f9fafb"}}>Drill-Pakete</h3></div>{COMMUNITY_PACKS.map(pack=>{const inst=installedPacks.includes(pack.id);return(<div key={pack.id} style={{padding:"10px 12px",borderRadius:10,border:"1px solid #374151",background:"rgba(0,0,0,.2)",marginBottom:8}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><div><div style={{fontSize:13,fontWeight:600,color:"#f9fafb"}}>{pack.name}</div><div style={{fontSize:11,color:"#6b7280"}}>{pack.description}</div><div style={{fontSize:10,color:"#9ca3af",marginTop:4}}>{pack.drills.length} Drills · v{pack.version}</div></div><button onClick={()=>!inst&&onInstallPack(pack)} disabled={inst} style={{padding:"6px 14px",borderRadius:8,border:inst?"1px solid #22c55e30":"1px solid #3b82f630",background:inst?"rgba(34,197,94,.1)":"rgba(59,130,246,.1)",color:inst?"#22c55e":"#3b82f6",fontSize:12,cursor:inst?"default":"pointer"}}>{inst?<><Check size={12}/> ✓</>:<><Download size={12}/> Install</>}</button></div></div>);})}</Card>}
    {showImp&&<Card style={{borderColor:"rgba(139,92,246,.3)"}}><div style={{display:"flex",alignItems:"center",gap:6,marginBottom:10}}><Globe size={14} color="#8b5cf6"/><h3 style={{fontSize:13,fontWeight:600,color:"#f9fafb"}}>Import</h3></div>
      <div style={{marginBottom:12}}><label style={{fontSize:11,color:"#9ca3af",marginBottom:4,display:"block"}}>URL</label><div style={{display:"flex",gap:6}}><input value={urlIn} onChange={e=>setUrlIn(e.target.value)} placeholder="https://..." style={{flex:1,padding:"8px 10px",borderRadius:8,border:"1px solid #374151",background:"#0a0e1a",color:"#e5e7eb",fontSize:12,outline:"none"}}/><button onClick={fetchUrl} disabled={urlLoad||!urlIn.trim()} style={{padding:"8px 14px",borderRadius:8,border:"none",background:urlIn.trim()?"#8b5cf6":"#374151",color:urlIn.trim()?"#fff":"#6b7280",fontSize:12,cursor:urlIn.trim()?"pointer":"not-allowed"}}>{urlLoad?"...":"Laden"}</button></div>{urlErr&&<p style={{fontSize:11,color:"#f97373",marginTop:4}}>{urlErr}</p>}</div>
      <div><label style={{fontSize:11,color:"#9ca3af",marginBottom:4,display:"block"}}>JSON einfügen</label><textarea value={impJson} onChange={e=>setImpJson(e.target.value)} placeholder='[{"title":"..."}]' style={{width:"100%",padding:"8px",borderRadius:8,border:"1px solid #374151",background:"#0a0e1a",color:"#e5e7eb",fontSize:11,fontFamily:"'JetBrains Mono',monospace",minHeight:80,resize:"vertical",outline:"none"}}/><button onClick={()=>{if(impJson.trim()){onImportDrills(impJson);setImpJson("");setShowImp(false);}}} disabled={!impJson.trim()} style={{width:"100%",padding:8,borderRadius:8,border:"none",background:impJson.trim()?"#8b5cf6":"#374151",color:impJson.trim()?"#fff":"#6b7280",fontSize:12,cursor:impJson.trim()?"pointer":"not-allowed",marginTop:6}}>Importieren</button></div>
    </Card>}
    <div style={{display:"flex",gap:4,overflowX:"auto",paddingBottom:2}}><FilterPill active={filterCat==="all"} onClick={()=>setFilterCat("all")} label="Alle"/>{CATEGORIES.map(c=><FilterPill key={c.id} active={filterCat===c.id} onClick={()=>setFilterCat(c.id)} label={`${c.icon} ${c.label}`}/>)}</div>
    {editingDrill&&<DrillForm onSave={onAdd} onCancel={()=>setEditingDrill(null)}/>}
    {filtered.map(d=>{const cat=CATEGORIES.find(c=>c.id===d.category);const dLvl=LEVELS.findIndex(l=>l.id===d.level);const hard=dLvl>lvlIdx+1;return(
      <Card key={d.id} style={{opacity:hard?.5:1}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
        <div style={{flex:1}}><div style={{display:"flex",alignItems:"center",gap:5,marginBottom:3,flexWrap:"wrap"}}><span style={{fontSize:13,fontWeight:600,color:"#f9fafb"}}>{d.title}</span>{d.isCustom&&<span style={{fontSize:9,padding:"1px 5px",borderRadius:8,background:"rgba(139,92,246,.15)",color:"#8b5cf6"}}>Custom</span>}</div>
          <p style={{fontSize:11,color:"#9ca3af",marginBottom:4}}>{d.description}</p>
          <div style={{display:"flex",gap:4,flexWrap:"wrap"}}><span style={{fontSize:10,padding:"2px 6px",borderRadius:20,background:`${cat?.color}15`,color:cat?.color}}>{cat?.icon} {cat?.label}</span><span style={{fontSize:10,padding:"2px 6px",borderRadius:20,background:"rgba(55,65,81,.4)",color:"#9ca3af"}}>{d.duration}m</span><span style={{fontSize:10,padding:"2px 6px",borderRadius:20,background:"rgba(55,65,81,.4)",color:"#9ca3af"}}>{LEVELS.find(l=>l.id===d.level)?.label}</span>{d.omniCompatible&&<span style={{fontSize:9,padding:"2px 5px",borderRadius:20,background:"rgba(56,189,248,.1)",color:"#38bdf8"}}>Omni</span>}</div>
        </div>
        <div style={{display:"flex",gap:3}}><button onClick={()=>onStartDrill(d)} style={{padding:"6px 10px",borderRadius:8,border:"1px solid #22c55e30",background:"rgba(34,197,94,.1)",color:"#22c55e",cursor:"pointer",fontSize:11}}><Play size={13}/></button>{d.isCustom&&<button onClick={()=>onDelete(d.id)} style={{padding:"6px 8px",borderRadius:8,border:"1px solid #ef444430",background:"transparent",color:"#ef4444",cursor:"pointer"}}><Trash2 size={13}/></button>}</div>
      </div></Card>);})}
  </div>);
}
function DrillForm({onSave,onCancel}){
  const [f,setF]=useState({title:"",category:"scoring",level:"beginner",duration:15,description:"",steps:[""],omniCompatible:true});const u=(k,v)=>setF(p=>({...p,[k]:v}));
  return(<Card glow><h3 style={{fontSize:13,fontWeight:600,color:"#f9fafb",marginBottom:10}}>Neues Training</h3>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
      <div><label style={{fontSize:10,color:"#6b7280",marginBottom:3,display:"block"}}>Titel</label><input value={f.title} onChange={e=>u("title",e.target.value)} style={{width:"100%",padding:"7px 9px",borderRadius:8,border:"1px solid #374151",background:"#0a0e1a",color:"#e5e7eb",fontSize:12,outline:"none"}}/></div>
      <div><label style={{fontSize:10,color:"#6b7280",marginBottom:3,display:"block"}}>Kategorie</label><select value={f.category} onChange={e=>u("category",e.target.value)} style={{width:"100%",padding:"7px 9px",borderRadius:8,border:"1px solid #374151",background:"#0a0e1a",color:"#e5e7eb",fontSize:12,outline:"none"}}>{CATEGORIES.map(c=><option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}</select></div>
      <div><label style={{fontSize:10,color:"#6b7280",marginBottom:3,display:"block"}}>Level</label><select value={f.level} onChange={e=>u("level",e.target.value)} style={{width:"100%",padding:"7px 9px",borderRadius:8,border:"1px solid #374151",background:"#0a0e1a",color:"#e5e7eb",fontSize:12,outline:"none"}}>{LEVELS.map(l=><option key={l.id} value={l.id}>{l.label}</option>)}</select></div>
      <div><label style={{fontSize:10,color:"#6b7280",marginBottom:3,display:"block"}}>Dauer</label><input type="number" value={f.duration} onChange={e=>u("duration",parseInt(e.target.value)||15)} style={{width:"100%",padding:"7px 9px",borderRadius:8,border:"1px solid #374151",background:"#0a0e1a",color:"#e5e7eb",fontSize:12,outline:"none"}}/></div>
    </div>
    <div style={{marginBottom:8}}><label style={{fontSize:10,color:"#6b7280",marginBottom:3,display:"block"}}>Beschreibung</label><input value={f.description} onChange={e=>u("description",e.target.value)} style={{width:"100%",padding:"7px 9px",borderRadius:8,border:"1px solid #374151",background:"#0a0e1a",color:"#e5e7eb",fontSize:12,outline:"none"}}/></div>
    <div style={{marginBottom:8}}><label style={{fontSize:10,color:"#6b7280",marginBottom:3,display:"block"}}>Schritte</label><textarea value={f.steps.join("\n")} onChange={e=>u("steps",e.target.value.split("\n").filter(s=>s.trim()))} style={{width:"100%",padding:"7px 9px",borderRadius:8,border:"1px solid #374151",background:"#0a0e1a",color:"#e5e7eb",fontSize:12,minHeight:60,resize:"vertical",outline:"none",fontFamily:"inherit"}}/></div>
    <label style={{display:"flex",alignItems:"center",gap:5,fontSize:11,color:"#9ca3af",marginBottom:10}}><input type="checkbox" checked={f.omniCompatible} onChange={e=>u("omniCompatible",e.target.checked)}/>Omni kompatibel</label>
    <div style={{display:"flex",gap:6}}><button onClick={()=>f.title.trim()&&onSave(f)} disabled={!f.title.trim()} style={{flex:1,padding:8,borderRadius:8,border:"none",background:f.title.trim()?"linear-gradient(135deg,#22c55e,#16a34a)":"#374151",color:f.title.trim()?"#fff":"#6b7280",fontSize:12,fontWeight:600,cursor:f.title.trim()?"pointer":"not-allowed"}}><Save size={12} style={{verticalAlign:"middle",marginRight:3}}/>Speichern</button><button onClick={onCancel} style={{padding:"8px 14px",borderRadius:8,border:"1px solid #374151",background:"transparent",color:"#9ca3af",fontSize:12,cursor:"pointer"}}>×</button></div>
  </Card>);
}

// ─── SETTINGS TAB ────────────────────────────────────────────────────────────
function SettingsTab({profile,settings,onUpdateProfile,onUpdateSettings,onExport,onImport,showImport,setShowImport,onReset,stats,players,onAddPlayer,onDeletePlayer,onTestSound,syncBusy,onSyncPush,onSyncPull}){
  const [impTxt,setImpTxt]=useState("");
  return(<div style={{display:"flex",flexDirection:"column",gap:12}}>
    <h2 style={{fontSize:15,fontWeight:600,color:"#f9fafb"}}>Einstellungen</h2>

    <Card><h3 style={{fontSize:13,fontWeight:600,color:"#f9fafb",marginBottom:10,display:"flex",alignItems:"center",gap:5}}><Users size={14} color="#22c55e"/>Spieler ({players.length})</h3>
      <div style={{display:"flex",flexDirection:"column",gap:5,marginBottom:8}}>
        {players.map(p=>(
          <div key={p.id} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 9px",borderRadius:8,background:p.id===profile.id?"rgba(34,197,94,.08)":"rgba(0,0,0,.2)",border:`1px solid ${p.id===profile.id?"rgba(34,197,94,.3)":"#374151"}`}}>
            <div style={{width:24,height:24,borderRadius:12,background:"rgba(34,197,94,.15)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,color:"#22c55e",fontSize:11}}>{p.name.slice(0,1).toUpperCase()}</div>
            <div style={{flex:1}}><div style={{fontSize:12,color:"#f9fafb",fontWeight:600}}>{p.name}{p.id===profile.id&&" · aktiv"}</div><div style={{fontSize:10,color:"#6b7280"}}>{LEVELS.find(l=>l.id===p.level)?.label} · {p.sessionsPerWeek}×</div></div>
            {players.length>1&&<button onClick={()=>{ if(confirm(`Spieler "${p.name}" und alle Sessions löschen?`)) onDeletePlayer(p.id); }} style={{padding:5,borderRadius:6,border:"1px solid #ef444430",background:"transparent",color:"#ef4444",cursor:"pointer"}}><Trash2 size={11}/></button>}
          </div>
        ))}
      </div>
      <button onClick={onAddPlayer} style={{width:"100%",padding:9,borderRadius:8,border:"1px dashed #22c55e",background:"rgba(34,197,94,.08)",color:"#22c55e",fontWeight:600,fontSize:12,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:5}}><UserPlus size={13}/>Neuen Spieler hinzufügen</button>
    </Card>

    <Card><h3 style={{fontSize:13,fontWeight:600,color:"#f9fafb",marginBottom:10}}>Aktiver Spieler · Profil</h3>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
        <div><label style={{fontSize:10,color:"#6b7280",marginBottom:3,display:"block"}}>Name</label><input value={profile.name} onChange={e=>onUpdateProfile({name:e.target.value})} style={{width:"100%",padding:"7px 9px",borderRadius:8,border:"1px solid #374151",background:"#0a0e1a",color:"#e5e7eb",fontSize:12,outline:"none"}}/></div>
        <div><label style={{fontSize:10,color:"#6b7280",marginBottom:3,display:"block"}}>Level</label><select value={profile.level} onChange={e=>onUpdateProfile({level:e.target.value})} style={{width:"100%",padding:"7px 9px",borderRadius:8,border:"1px solid #374151",background:"#0a0e1a",color:"#e5e7eb",fontSize:12,outline:"none"}}>{LEVELS.map(l=><option key={l.id} value={l.id}>{l.label}</option>)}</select></div>
        <div><label style={{fontSize:10,color:"#6b7280",marginBottom:3,display:"block"}}>Sessions/Woche</label><select value={profile.sessionsPerWeek} onChange={e=>onUpdateProfile({sessionsPerWeek:+e.target.value})} style={{width:"100%",padding:"7px 9px",borderRadius:8,border:"1px solid #374151",background:"#0a0e1a",color:"#e5e7eb",fontSize:12,outline:"none"}}>{[2,3,4,5,6,7].map(n=><option key={n} value={n}>{n}x</option>)}</select></div>
        <div><label style={{fontSize:10,color:"#6b7280",marginBottom:3,display:"block"}}>Session-Dauer</label><select value={profile.sessionDuration} onChange={e=>onUpdateProfile({sessionDuration:+e.target.value})} style={{width:"100%",padding:"7px 9px",borderRadius:8,border:"1px solid #374151",background:"#0a0e1a",color:"#e5e7eb",fontSize:12,outline:"none"}}>{[30,45,60,75,90,120].map(n=><option key={n} value={n}>{n} Min</option>)}</select></div>
      </div>
    </Card>

    <Card><h3 style={{fontSize:13,fontWeight:600,color:"#f9fafb",marginBottom:10}}>Training</h3>
      <label style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"6px 0",borderBottom:"1px solid rgba(55,65,81,.3)"}}><span style={{fontSize:12,color:"#d1d5db"}}>Omni-Schnellmodus</span><ToggleSwitch checked={settings.showOmniMode} onChange={v=>onUpdateSettings({showOmniMode:v})}/></label>
      <label style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"6px 0",borderBottom:"1px solid rgba(55,65,81,.3)"}}><span style={{fontSize:12,color:"#d1d5db"}}>Auto-Nächstes Training</span><ToggleSwitch checked={settings.autoAdvance} onChange={v=>onUpdateSettings({autoAdvance:v})}/></label>
      <label style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"6px 0",borderBottom:"1px solid rgba(55,65,81,.3)"}}><span style={{fontSize:12,color:"#d1d5db"}}>Timer beim nächsten Drill auto-starten</span><ToggleSwitch checked={settings.autoStartTimer===true} onChange={v=>onUpdateSettings({autoStartTimer:v})}/></label>
      <label style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"6px 0"}}><div style={{display:"flex",alignItems:"center",gap:5}}><Volume2 size={14} color="#9ca3af"/><span style={{fontSize:12,color:"#d1d5db"}}>Timer-Sound</span></div>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <button onClick={onTestSound} style={{padding:"3px 9px",borderRadius:6,border:"1px solid #22c55e30",background:"rgba(34,197,94,.1)",color:"#22c55e",fontSize:10,cursor:"pointer"}}>Test</button>
          <ToggleSwitch checked={settings.soundEnabled!==false} onChange={v=>onUpdateSettings({soundEnabled:v})}/>
        </div>
      </label>
    </Card>

    <Card style={{borderColor:settings.syncEnabled?"rgba(34,197,94,.3)":"rgba(55,65,81,.6)"}}>
      <h3 style={{fontSize:13,fontWeight:600,color:"#f9fafb",marginBottom:10,display:"flex",alignItems:"center",gap:5}}>{settings.syncEnabled?<Cloud size={14} color="#22c55e"/>:<CloudOff size={14} color="#9ca3af"/>}Sync zur Handy-App</h3>
      <label style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"4px 0",marginBottom:8}}><span style={{fontSize:12,color:"#d1d5db"}}>Aktiviert</span><ToggleSwitch checked={settings.syncEnabled===true} onChange={v=>onUpdateSettings({syncEnabled:v})}/></label>
      <div style={{marginBottom:6}}><label style={{fontSize:10,color:"#6b7280",marginBottom:3,display:"block"}}>Sync-URL (PUT/GET JSON, z. B. jsonsilo.com)</label><input value={settings.syncUrl||""} onChange={e=>onUpdateSettings({syncUrl:e.target.value})} placeholder="https://..." style={{width:"100%",padding:"7px 9px",borderRadius:8,border:"1px solid #374151",background:"#0a0e1a",color:"#e5e7eb",fontSize:12,outline:"none",fontFamily:"'JetBrains Mono',monospace"}}/></div>
      <div style={{marginBottom:8}}><label style={{fontSize:10,color:"#6b7280",marginBottom:3,display:"block"}}>API-Key / Token (optional, als Bearer-Header)</label><input type="password" value={settings.syncKey||""} onChange={e=>onUpdateSettings({syncKey:e.target.value})} placeholder="••••" style={{width:"100%",padding:"7px 9px",borderRadius:8,border:"1px solid #374151",background:"#0a0e1a",color:"#e5e7eb",fontSize:12,outline:"none"}}/></div>
      <div style={{display:"flex",gap:6}}>
        <button onClick={onSyncPush} disabled={syncBusy||!settings.syncEnabled||!settings.syncUrl} style={{flex:1,padding:8,borderRadius:8,border:"none",background:settings.syncEnabled&&settings.syncUrl?"linear-gradient(135deg,#22c55e,#16a34a)":"#374151",color:settings.syncEnabled&&settings.syncUrl?"#fff":"#6b7280",fontSize:12,fontWeight:600,cursor:syncBusy?"wait":(settings.syncEnabled&&settings.syncUrl?"pointer":"not-allowed"),display:"flex",alignItems:"center",justifyContent:"center",gap:4}}><Upload size={12}/>{syncBusy?"...":"Push (hochladen)"}</button>
        <button onClick={onSyncPull} disabled={syncBusy||!settings.syncEnabled||!settings.syncUrl} style={{flex:1,padding:8,borderRadius:8,border:"1px solid #3b82f640",background:settings.syncEnabled&&settings.syncUrl?"rgba(59,130,246,.1)":"transparent",color:settings.syncEnabled&&settings.syncUrl?"#3b82f6":"#6b7280",fontSize:12,fontWeight:600,cursor:syncBusy?"wait":(settings.syncEnabled&&settings.syncUrl?"pointer":"not-allowed"),display:"flex",alignItems:"center",justifyContent:"center",gap:4}}><Download size={12}/>Pull (laden)</button>
      </div>
      <div style={{fontSize:10,color:"#6b7280",marginTop:8,lineHeight:1.5}}>
        Letzter Sync: {settings.lastSyncAt?new Date(settings.lastSyncAt).toLocaleString("de-DE"):"–"}<br/>
        Die Handy-App benutzt dieselbe URL + Key. Push lädt die Trainings-Updates hoch, Pull holt sie auf dem Handy ab.
      </div>
    </Card>

    <Card><h3 style={{fontSize:13,fontWeight:600,color:"#f9fafb",marginBottom:10,display:"flex",alignItems:"center",gap:5}}><FileJson size={14} color="#3b82f6"/>Daten</h3>
      <div style={{display:"flex",gap:6,marginBottom:10}}><button onClick={onExport} style={{flex:1,padding:8,borderRadius:8,border:"1px solid #3b82f630",background:"rgba(59,130,246,.1)",color:"#3b82f6",fontSize:12,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:4}}><Download size={13}/>Export</button><button onClick={()=>setShowImport(!showImport)} style={{flex:1,padding:8,borderRadius:8,border:"1px solid #f59e0b30",background:"rgba(245,158,11,.1)",color:"#f59e0b",fontSize:12,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:4}}><Upload size={13}/>Import</button></div>
      {showImport&&<div style={{marginBottom:10}}><textarea value={impTxt} onChange={e=>setImpTxt(e.target.value)} placeholder="JSON..." style={{width:"100%",padding:8,borderRadius:8,border:"1px solid #374151",background:"#0a0e1a",color:"#e5e7eb",fontSize:11,fontFamily:"'JetBrains Mono',monospace",minHeight:80,resize:"vertical",outline:"none"}}/><button onClick={()=>impTxt.trim()&&onImport(impTxt)} disabled={!impTxt.trim()} style={{width:"100%",padding:8,borderRadius:8,border:"none",background:impTxt.trim()?"#f59e0b":"#374151",color:impTxt.trim()?"#000":"#6b7280",fontSize:12,fontWeight:600,cursor:impTxt.trim()?"pointer":"not-allowed",marginTop:4}}>Import</button></div>}
      <div style={{padding:"8px 10px",borderRadius:8,background:"rgba(0,0,0,.2)",fontSize:11,color:"#6b7280"}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}><span>Sessions (aktiver Spieler):</span><span style={{color:"#e5e7eb"}}>{stats.totalSessions}</span></div><div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}><span>Zeit:</span><span style={{color:"#e5e7eb"}}>{Math.round(stats.totalTime/60)} Std</span></div><div style={{display:"flex",justifyContent:"space-between"}}><span>Version:</span><span style={{color:"#e5e7eb"}}>3.0.0</span></div></div>
    </Card>
    <Card style={{borderColor:"rgba(56,189,248,.25)"}}><h3 style={{fontSize:13,fontWeight:600,color:"#f9fafb",marginBottom:8,display:"flex",alignItems:"center",gap:5}}><Monitor size={14} color="#38bdf8"/>Plattform</h3><p style={{fontSize:11,color:"#6b7280",lineHeight:1.6,marginBottom:8}}>Multi-Player aktiv. Timer läuft im Hintergrund (Tab-Wechsel sicher). Drag&Drop. Vorbereitet für Tauri v2 Desktop + Android.</p><div style={{display:"flex",gap:6,flexWrap:"wrap"}}><span style={{fontSize:10,padding:"3px 8px",borderRadius:8,border:"1px solid #22c55e30",color:"#22c55e"}}>Web ✓</span><span style={{fontSize:10,padding:"3px 8px",borderRadius:8,border:"1px solid #38bdf830",color:"#38bdf8"}}><Monitor size={10} style={{verticalAlign:"middle",marginRight:3}}/>Windows</span><span style={{fontSize:10,padding:"3px 8px",borderRadius:8,border:"1px solid #a78bfa30",color:"#a78bfa"}}><Smartphone size={10} style={{verticalAlign:"middle",marginRight:3}}/>Android</span></div></Card>
    <Card style={{borderColor:"rgba(239,68,68,.25)"}}><h3 style={{fontSize:13,fontWeight:600,color:"#ef4444",marginBottom:6,display:"flex",alignItems:"center",gap:5}}><AlertCircle size={14}/>Gefahrenzone</h3><button onClick={onReset} style={{padding:"8px 14px",borderRadius:8,border:"1px solid #ef444440",background:"rgba(239,68,68,.1)",color:"#ef4444",fontSize:12,cursor:"pointer",display:"flex",alignItems:"center",gap:4}}><RotateCcw size={12}/>Komplett-Reset</button></Card>
  </div>);
}
