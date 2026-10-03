// PRIMA 紋戦 — 描画・操作・演出・画面
// 演算は sim.js（window.PRIMA_SIM）、数値と文章は data.js（window.PRIMA_DATA）。
// このファイルは1つの即時関数のまま保つ（scripts/smoke.cjs が末尾の })(); を差し替えて中身を取り出す）。
//
// ─── 目次（═══ NN. で検索） ───
// 01. 保存（位階・術・叫び・設定）   02. 画面とカメラ   03. 石畳と光の素材   04. 紋を描く
// 05. 入力   06. 演出（原理ごとの光・詠唱の陣・床の跡・吹き出し）   07. 音と声（残響・原理の音色・詠唱）
// 08. 世界の描画（儀式場・魔導士・術式・結界・糸・光）   09. 表示（HUD・修練場）   10. ロビーと術式台
// 11. 入場・散った・退出   12. 毎フレーム
(() => {
'use strict';
const D = window.PRIMA_DATA, S = window.PRIMA_SIM, W = D.WORLD;
const $ = id => document.getElementById(id);
// 光の色：インクのキーでも '#rrggbb' でも受け取る
const hex = k => typeof k === 'string' && k[0] === '#' ? k : (D.inks[k] || D.inks.pink).hex;
const TAU = Math.PI * 2;
const hyp = Math.hypot;
// ─── 言語：日本語・English・中文・한국어 ───
// 保存の lang（'auto' か言語のキー）→ ブラウザの言語の順で決める。対応しない言語は英語。
// lang.js（window.PRIMA_LANG）の data を D に重ね（術・現象・流派・台詞などの名前と説明）、ui は日本語の文をキーにした訳の表
const LANGS = window.PRIMA_LANG || {};
const LANG_NAMES = { ja: '日本語', en: 'English', zh: '中文', ko: '한국어' };
const LANG = (() => {
  let saved = '';
  try { saved = (JSON.parse(localStorage.getItem('prima-io-v1') || 'null') || {}).lang || ''; } catch { /* 保存が使えない */ }
  const ok = k => k === 'ja' || !!LANGS[k];
  if (saved && saved !== 'auto' && ok(saved)) return saved;
  const nv = typeof navigator !== 'undefined' ? navigator : {};
  const nav = String((nv.languages && nv.languages[0]) || nv.language || 'ja').slice(0, 2).toLowerCase();
  return ok(nav) ? nav : LANGS.en ? 'en' : 'ja';
})();
const LOCALE = { ja: 'ja-JP', en: 'en-US', zh: 'zh-CN', ko: 'ko-KR' }[LANG];
// 重ねる：オブジェクトは中へ、配列は要素ごと（要素がオブジェクトなら中へ、それ以外は置き換え）
function overlay(dst, src) {
  for (const k of Object.keys(src)) {
    const v = src[k];
    if (Array.isArray(v) && Array.isArray(dst[k])) {
      if (v.every(x => x && typeof x === 'object' && !Array.isArray(x))) v.forEach((x, i) => { if (dst[k][i]) overlay(dst[k][i], x); else dst[k][i] = x; });
      else dst[k] = v.slice();
    } else if (v && typeof v === 'object' && !Array.isArray(v) && dst[k] && typeof dst[k] === 'object') overlay(dst[k], v);
    else dst[k] = v;
  }
  return dst;
}
if (LANG !== 'ja' && LANGS[LANG].data) overlay(D, LANGS[LANG].data);
const UI = LANG === 'ja' ? {} : (LANGS[LANG].ui || {});
// 訳：日本語の文をキーに引き、{0} {1}… を差し込む。訳が無ければ日本語のまま
function L(ja, ...args) {
  let t = UI[ja] ?? ja;
  args.forEach((v, i) => { t = t.split(`{${i}}`).join(v); });
  return t;
}
// 画面の骨組み（index.html）の日本語の文字と属性を訳す
function translateDom(root) {
  if (LANG === 'ja') return;
  document.documentElement.lang = LANG;
  document.title = L(document.title);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const n of nodes) { const t = n.nodeValue.replace(/\s+/g, ' ').trim(); if (t && UI[t] !== undefined) n.nodeValue = n.nodeValue.replace(n.nodeValue.trim(), UI[t]); }
  for (const el of root.querySelectorAll('[title],[placeholder],[aria-label],[alt]')) for (const a of ['title', 'placeholder', 'aria-label', 'alt']) { const v = el.getAttribute(a); if (v && UI[v.trim()] !== undefined) el.setAttribute(a, UI[v.trim()]); }
  for (const m of document.querySelectorAll('meta[name="description"],meta[property^="og:"]')) { const v = m.getAttribute('content'); if (v && UI[v] !== undefined) m.setAttribute('content', UI[v]); }
}
translateDom(document.body);
const fmt = n => Math.floor(n).toLocaleString(LOCALE);

// ═══ 01. 保存（位階・術・叫び・設定） ═══════════════════════════
const SAVE_KEY = 'prima-io-v1';
function readKey(k) { try { return localStorage.getItem(k); } catch { return null; } }
function defaults() {
  return {
    name: '', ink: D.inkOrder[Math.floor(Math.random() * D.inkOrder.length)], crest: 'ring', room: 'ichi',
    spells: D.defaultSpells.map(r => S.normRecipe(r)),
    cries: { win: D.defaultCries.win, death: D.defaultCries.death },
    points: 0, best: 0, bestPlace: 0, kills: 0, runs: 0, time: 0, recent: [], sfx: true, bgm: true, voice: true,
    // 声：off（なし）/ name（技名だけ）/ all（技名と叫び）。音量は 0〜1。bloom は画面の光のにじみ
    voiceMode: 'all', voiceURI: '', sfxVol: 0.8, bgmVol: 0.55, bloom: true, lastTrack: '',
    // 言語：auto（ブラウザに合わせる）か ja / en / zh / ko
    lang: 'auto',
    // 画質：auto（スマホと重い端末は軽く）・high・low
    quality: 'auto',
    // 手ほどきを終えたか（初めての人にだけロビーで案内する）
    tutorial: false,
    // スペシャルステージ（演算の間）：越えた数・挑んで散った数
    special: { cleared: 0, deaths: 0 }
  };
}
function loadProfile() {
  const base = defaults();
  try {
    const raw = JSON.parse(readKey(SAVE_KEY) || 'null');
    if (raw && typeof raw === 'object') {
      const p = { ...base, ...raw };
      // 術は必ず4つ。normRecipe で正しい形に直してから使う
      const list = Array.isArray(raw.spells) ? raw.spells : [];
      p.spells = D.defaultSpells.map((d, i) => S.normRecipe(list[i] || d));
      p.cries = { ...base.cries, ...(raw.cries || {}) };
      p.special = { ...base.special, ...(raw.special && typeof raw.special === 'object' ? raw.special : {}) };
      p.special.cleared = Math.max(0, Math.min(D.special.at.length, Math.floor(Number(p.special.cleared) || 0)));
      p.special.deaths = Math.max(0, Math.floor(Number(p.special.deaths) || 0));
      // 声の設定が無い古い保存：声を切っていたら「なし」
      if (!['off', 'name', 'all'].includes(p.voiceMode)) p.voiceMode = raw.voice === false ? 'off' : 'all';
      p.voice = p.voiceMode !== 'off';
      // 手ほどきより前から遊んでいる人には案内を出さない
      if (typeof raw.tutorial !== 'boolean') p.tutorial = (raw.runs || 0) > 0;
      return p;
    }
  } catch { /* 保存が使えない環境でも遊べる */ }
  return base;
}
const profile = loadProfile();
function saveProfile() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(profile)); } catch { /* 無視 */ }
}

// ═══ 02. 画面とカメラ ═══════════════════════════════════════════
const canvas = $('stage'), ctx = canvas.getContext('2d');
const mini = $('mini'), mctx = mini.getContext('2d');
let vw = 1280, vh = 800, dpr = 1;
// 画質：low のときは解像度を1倍に抑え、靄・灰・色調・光のにじみ・床の照り返しを省き、火花を減らす
let LOW = false, perfLow = false;
function applyQuality() {
  const q = profile.quality || 'auto';
  LOW = q === 'low' || (q === 'auto' && (perfLow || touchy()));
  resize();
}
function resize() {
  dpr = LOW ? 1 : Math.min(2, window.devicePixelRatio || 1);
  vw = window.innerWidth || 1280; vh = window.innerHeight || 800;
  canvas.width = Math.round(vw * dpr); canvas.height = Math.round(vh * dpr);
}
window.addEventListener('resize', resize);
resize();
const cam = { x: 0, y: 0, z: 0.8, shake: 0, sx: 0, sy: 0 };
// 画面の大きさに合わせた基本の拡大率。体が大きくなるほど引いて見る
const baseZoom = () => Math.sqrt(vw * vh) / 960;
function screenToWorld(px, py) { return { x: (px - vw / 2) / cam.z + cam.x, y: (py - vh / 2) / cam.z + cam.y }; }

// ═══ 03. 石畳と光の素材 ═════════════════════════════════════════
const FLOOR = D.floor, BONE = D.bone;
function makeTile(size, paint) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  paint(c.getContext('2d'), size);
  return c;
}
function rgba(h, a) { const n = parseInt(h.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; }
// 床：磨かれた黒い粘板岩の大きな敷石。うすく藍を帯び、面ごとに明るさと石目が違う。
// 目地は深く、上と左の縁だけがかすかに光を拾う。表面には細かなざらつき（一度だけ計算する）
const SLAB = 160;
const floorTile = makeTile(SLAB * 4, (g, n) => {
  let seed = 11;
  const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  g.fillStyle = '#020205'; g.fillRect(0, 0, n, n);
  for (let row = 0; row < 4; row++) for (let col = 0; col < 4; col++) {
    const x = col * SLAB, y = row * SLAB, b = 15 + r() * 8;
    const gr = g.createLinearGradient(x, y, x + SLAB * 0.45, y + SLAB);
    gr.addColorStop(0, `rgb(${b * 0.82 + 3 | 0},${b * 0.88 + 4 | 0},${b * 1.3 + 8 | 0})`);
    gr.addColorStop(1, `rgb(${b * 0.5 | 0},${b * 0.54 | 0},${b * 0.8 + 3 | 0})`);
    g.fillStyle = gr; g.fillRect(x + 2, y + 2, SLAB - 4, SLAB - 4);
    // 石目：細くうねる淡い筋
    if (r() < 0.6) {
      g.strokeStyle = `rgba(140,152,200,${0.022 + r() * 0.03})`; g.lineWidth = 0.7 + r() * 0.9;
      let vx = x + 10 + r() * (SLAB - 20), vy = y + 3;
      g.beginPath(); g.moveTo(vx, vy);
      for (let s = 0; s < 5; s++) { const nx = vx + (r() - 0.5) * 44, ny = Math.min(y + SLAB - 3, vy + SLAB / 5); g.quadraticCurveTo(vx + (r() - 0.5) * 30, (vy + ny) / 2, nx, ny); vx = nx; vy = ny; }
      g.stroke();
    }
    // 磨り減った暗いしみ
    for (let i = 0; i < 3; i++) { g.fillStyle = `rgba(0,0,0,${0.05 + r() * 0.08})`; g.beginPath(); g.ellipse(x + 20 + r() * (SLAB - 40), y + 20 + r() * (SLAB - 40), 10 + r() * 26, 6 + r() * 16, r() * 3, 0, TAU); g.fill(); }
    // 縁：上と左はかすかに光を拾い、下と右は沈む
    g.fillStyle = 'rgba(165,180,230,.11)'; g.fillRect(x + 2, y + 2, SLAB - 4, 1); g.fillRect(x + 2, y + 2, 1, SLAB - 4);
    g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(x + 2, y + SLAB - 3, SLAB - 4, 1); g.fillRect(x + SLAB - 3, y + 2, 1, SLAB - 4);
    // まれに走る細いひび
    if (r() < 0.16) {
      g.strokeStyle = 'rgba(0,0,0,.55)'; g.lineWidth = 1;
      let cx = x + 8 + r() * (SLAB - 16), cy = y + 3; g.beginPath(); g.moveTo(cx, cy);
      for (let k = 0; k < 4; k++) { cx += (r() - 0.5) * 18; cy += SLAB / 6; g.lineTo(cx, cy); }
      g.stroke();
    }
  }
  const img = g.getImageData && g.getImageData(0, 0, n, n);
  if (img && img.data) {
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) { const v = (r() - 0.5) * 6; d[i] += v; d[i + 1] += v; d[i + 2] += v * 1.3; }
    g.putImageData(img, 0, 0);
  }
});
const floorPat = ctx.createPattern(floorTile, 'repeat');
// 画面のざらつき（フィルムの粒）：毎フレームずらして重ね、光の階調の段差をなじませる
const grainTile = makeTile(256, (g, n) => {
  const img = g.getImageData && g.createImageData && g.createImageData(n, n);
  if (!img || !img.data) return;
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) { const v = Math.random() * 255; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; }
  g.putImageData(img, 0, 0);
});
const grainPat = ctx.createPattern(grainTile, 'repeat');
// 魔素の粒の色：術者の色をそのまま撒かず、温かい白に寄せる（床が色紙の散らばりに見えないように）
const moteCache = {};
function moteGlow(k) {
  if (!moteCache[k]) {
    const n = parseInt(hex(k).slice(1), 16), mix = (v, w) => Math.round(v * 0.28 + w * 0.72);
    const c = '#' + [mix(n >> 16, 255), mix((n >> 8) & 255, 238), mix(n & 255, 210)].map(v => v.toString(16).padStart(2, '0')).join('');
    moteCache[k] = glow(c);
  }
  return moteCache[k];
}
// 光の粒：色ごとに一度だけ作る
const glowCache = {};
function glow(k) {
  if (!glowCache[k]) glowCache[k] = makeTile(64, g => {
    const c = hex(k), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, rgba(c, 1)); gr.addColorStop(0.22, rgba(c, 0.5)); gr.addColorStop(0.6, rgba(c, 0.1)); gr.addColorStop(1, rgba(c, 0));
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  });
  return glowCache[k];
}
// 白熱した光：芯が白く、外へ向かって色に変わる。弾の芯・閃光・光芒に使う
const hotCache = {};
function hotGlow(k) {
  if (!hotCache[k]) hotCache[k] = makeTile(64, g => {
    const c = hex(k), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,252,245,1)'); gr.addColorStop(0.12, 'rgba(255,250,240,.9)'); gr.addColorStop(0.26, rgba(c, 0.85)); gr.addColorStop(0.55, rgba(c, 0.22)); gr.addColorStop(1, rgba(c, 0));
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  });
  return hotCache[k];
}
// 煙の粒：縁の柔らかい暗い靄
const smokeTile = makeTile(64, g => {
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(8,6,12,.7)'); gr.addColorStop(0.5, 'rgba(8,6,12,.34)'); gr.addColorStop(1, 'rgba(8,6,12,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
});
// ルーン：陣の帯に刻む文字。7点の格子から線を選んで作る
const RUNES = Array.from({ length: 28 }, (_, i) => {
  let s = i * 7919 + 13;
  const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const pts = [[0, -1], [0, 1], [-0.6, -0.5], [0.6, -0.5], [-0.6, 0.5], [0.6, 0.5], [0, 0]];
  const segs = r() < 0.7 ? [[0, 1]] : [];
  const n = 2 + Math.floor(r() * 3);
  for (let k = 0; k < n; k++) { const a = Math.floor(r() * 7), b = Math.floor(r() * 7); if (a !== b) segs.push([a, b]); }
  return segs.map(([a, b]) => [pts[a], pts[b]]);
});
function drawRune(g, i, s) {
  g.beginPath();
  for (const [a, b] of RUNES[i % RUNES.length]) { g.moveTo(a[0] * s, a[1] * s); g.lineTo(b[0] * s, b[1] * s); }
  g.stroke();
}
// ルーンの輪：半径 r に n 文字を並べる（小さな陣・奥義・泉で使う）
function runeRing(g, r, n, size, offset = 0) {
  for (let i = 0; i < n; i++) {
    const a = i / n * TAU;
    g.save(); g.rotate(a); g.translate(0, -r); drawRune(g, i + offset, size); g.restore();
  }
}
// 画面の縁を暗く落とす（大きさが変わったら作り直す）
let vignette = null, vignetteKey = '';
function getVignette() {
  const key = vw + 'x' + vh;
  if (vignetteKey !== key) {
    vignetteKey = key;
    const g = ctx.createRadialGradient(vw / 2, vh / 2, Math.min(vw, vh) * 0.3, vw / 2, vh / 2, Math.hypot(vw, vh) * 0.62);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.55, 'rgba(2,1,4,.35)'); g.addColorStop(1, 'rgba(2,1,4,.88)');
    vignette = g;
  }
  return vignette;
}

// ═══ 04. 紋を描く ═══════════════════════════════════════════════
// 原点中心・半径 r に紋を描く。色は呼び出し側で決める
function drawCrest(g, key, r, color) {
  g.save();
  g.strokeStyle = color; g.fillStyle = color;
  g.lineWidth = Math.max(1, r * 0.17);
  g.lineCap = 'butt';
  const ring = (rr) => { g.beginPath(); g.arc(0, 0, rr, 0, TAU); g.stroke(); };
  switch (key) {
    case 'ring': ring(r * 0.86); g.beginPath(); g.arc(0, 0, r * 0.34, 0, TAU); g.fill(); break;
    case 'bar': ring(r * 0.86); g.fillRect(-r * 0.62, -r * 0.14, r * 1.24, r * 0.28); break;
    case 'cross': ring(r * 0.86); g.fillRect(-r * 0.62, -r * 0.1, r * 1.24, r * 0.2); g.fillRect(-r * 0.1, -r * 0.62, r * 0.2, r * 1.24); break;
    case 'lozenge':
      g.beginPath(); g.moveTo(0, -r); g.lineTo(r * 0.72, 0); g.lineTo(0, r); g.lineTo(-r * 0.72, 0); g.closePath(); g.stroke();
      g.beginPath(); g.moveTo(0, -r * 0.4); g.lineTo(r * 0.29, 0); g.lineTo(0, r * 0.4); g.lineTo(-r * 0.29, 0); g.closePath(); g.fill();
      break;
    case 'igeta':
      g.rotate(Math.PI / 4);
      for (const s of [-1, 1]) { g.fillRect(s * r * 0.26 - r * 0.09, -r * 0.8, r * 0.18, r * 1.6); g.fillRect(-r * 0.8, s * r * 0.26 - r * 0.09, r * 1.6, r * 0.18); }
      break;
    case 'scale': {
      const t = (cx, cy, s) => { g.beginPath(); g.moveTo(cx, cy - s); g.lineTo(cx + s * 0.95, cy + s * 0.6); g.lineTo(cx - s * 0.95, cy + s * 0.6); g.closePath(); g.fill(); };
      t(0, -r * 0.42, r * 0.44); t(-r * 0.44, r * 0.3, r * 0.44); t(r * 0.44, r * 0.3, r * 0.44);
      break;
    }
    case 'stars':
      for (let i = 0; i < 3; i++) { const a = -Math.PI / 2 + i * TAU / 3; g.beginPath(); g.arc(Math.cos(a) * r * 0.45, Math.sin(a) * r * 0.45, r * 0.3, 0, TAU); g.fill(); }
      break;
    case 'wheel':
      g.beginPath(); g.arc(-r * 0.3, 0, r * 0.55, 0, TAU); g.stroke();
      g.beginPath(); g.arc(r * 0.3, 0, r * 0.55, 0, TAU); g.stroke();
      break;
    default: ring(r * 0.8);
  }
  g.restore();
}

// ═══ 05. 入力 ═══════════════════════════════════════════════════
const keys = new Set();
const mouse = { x: vw / 2 + 100, y: vh / 2, down: false };
// タッチ：左半分は移動のスティック、右半分は狙いのスティック（はじいた向きへ放つ。触れて離すだけなら近くの敵へ自動で狙う）
const touch = { move: null, aim: null, active: false, tap: 0, target: null };
const typing = () => { const a = document.activeElement; return !!a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT') && a.type !== 'range' && a.type !== 'checkbox'; };
const MOVE_KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
// 術式台を開ける場面：ロビー・散った後・修練場の中
const canForge = () => mode !== 'play' || (world && world.room.practice);
window.addEventListener('keydown', e => {
  // ボタンのEnter・Spaceは、そのボタンを押す。ロビー入場や回避で横取りしない
  if (document.activeElement?.tagName === 'BUTTON' && ['Enter', 'Space'].includes(e.code)) return;
  if (typing()) { if (e.key === 'Enter' && mode === 'lobby' && document.activeElement === $('nameInput')) { e.preventDefault(); join(); } return; }
  unlockAudio();
  if (e.repeat && !MOVE_KEYS.includes(e.code)) return;
  keys.add(e.code);
  if (!$('settings').hidden) { if (e.code === 'Escape') closeSettings(); return; }
  if (forge.open) { if (e.code === 'Escape' || e.code === 'KeyT') closeForge(); return; }
  if (e.code === 'KeyT' && canForge()) { openForge(mode === 'play' ? heroSlot : 0); return; }
  if (mode === 'play') {
    const me = S.hero(world);
    if (e.code === 'Space') { e.preventDefault(); if (me && me.alive) me.input.dodge = true; }
    if (/^Digit[1-4]$/.test(e.code)) selectSlot(Number(e.code.slice(5)) - 1);
    // 糸：F で指示起爆、G で回収
    if (e.code === 'KeyF' && me) me.input.detonate = true;
    if (e.code === 'KeyG' && me) me.input.recall = true;
    if (e.code === 'Escape') leave();
  } else if (mode === 'dead') {
    if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); if (deathReady) join(); }
    if (e.code === 'Escape') toLobby();
  } else if (mode === 'lobby') {
    if (e.code === 'Enter' && $('how').hidden) join();
    if (e.code === 'Escape') $('how').hidden = true;
  }
  if (e.code === 'KeyM') toggleSfx();
  if (e.code === 'KeyN') toggleBgm();
  if (e.code === 'KeyV') toggleVoice();
  if (e.code === 'KeyB') nextTrack();
});
window.addEventListener('keyup', e => keys.delete(e.code));
window.addEventListener('blur', () => { keys.clear(); mouse.down = false; });
canvas.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
canvas.addEventListener('mousedown', e => {
  unlockAudio();
  mouse.x = e.clientX; mouse.y = e.clientY;
  if (e.button === 0) mouse.down = true;
  if (e.button === 2 && mode === 'play') { const me = S.hero(world); if (me) me.input.dodge = true; }
});
window.addEventListener('mouseup', e => { if (e.button === 0) mouse.down = false; });
canvas.addEventListener('contextmenu', e => e.preventDefault());
// 指で遊ぶ端末か（最初に触れる前から、案内の文言を出し分ける）
const touchy = () => touch.active || (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0 && !!window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
// ホイールで術を持ち替える
canvas.addEventListener('wheel', e => { if (mode !== 'play') return; e.preventDefault(); selectSlot((heroSlot + (e.deltaY > 0 ? 1 : 3)) % 4); }, { passive: false });
let heroSlot = 0;
function selectSlot(i) { if (heroSlot !== i) sfx('select', 1, i); heroSlot = i; }
canvas.addEventListener('touchstart', e => {
  unlockAudio();
  if (!touch.active) { touch.active = true; document.body.classList.add('touch-ui'); applyQuality(); }
  $('touch').hidden = mode !== 'play';
  for (const t of e.changedTouches) {
    const st = { id: t.identifier, ox: t.clientX, oy: t.clientY, x: t.clientX, y: t.clientY, t0: clock, far: 0 };
    if (t.clientX < vw * 0.5 && !touch.move) touch.move = st;
    else if (!touch.aim) touch.aim = st;
  }
  e.preventDefault();
}, { passive: false });
canvas.addEventListener('touchmove', e => {
  for (const t of e.changedTouches) {
    for (const st of [touch.move, touch.aim]) if (st && t.identifier === st.id) { st.x = t.clientX; st.y = t.clientY; st.far = Math.max(st.far, hyp(st.x - st.ox, st.y - st.oy)); }
  }
  e.preventDefault();
}, { passive: false });
const touchEnd = e => {
  for (const t of e.changedTouches) {
    if (touch.move && t.identifier === touch.move.id) touch.move = null;
    if (touch.aim && t.identifier === touch.aim.id) {
      // 触れて離しただけ（ほとんど動かさない）なら、近くの敵へ一回放つ
      if (touch.aim.far < STICK_DEAD && clock - touch.aim.t0 < 0.35) touch.tap = 0.2;
      touch.aim = null;
    }
  }
};
canvas.addEventListener('touchend', touchEnd);
canvas.addEventListener('touchcancel', touchEnd);
$('touchDodge').addEventListener('pointerdown', e => { e.preventDefault(); const me = S.hero(world); if (me) me.input.dodge = true; });
$('touchDetonate').addEventListener('pointerdown', e => { e.preventDefault(); const me = S.hero(world); if (me) me.input.detonate = true; });
$('touchRecall').addEventListener('pointerdown', e => { e.preventDefault(); const me = S.hero(world); if (me) me.input.recall = true; });
// スティックの遊びと、指を倒しきる距離（画面の点）
const STICK_DEAD = 16, STICK_FULL = 70;
// 起動時の画質（スマホなら最初から軽く）
if (touchy()) document.body.classList.add('touch-ui');
applyQuality();
// 狙いの補助：向き（あれば）に近く、届く範囲にいる相手を選び、動く先を読んで狙う
function autoTarget(me, ang) {
  let best = null, bs = 1e9;
  for (const u of world.units) {
    if (!S.visibleTo(me, u) || !u.alive || u === me) continue;
    const dx = u.x - me.x, dy = u.y - me.y, d = hyp(dx, dy);
    if (d > 820) continue;
    let sc = d;
    if (ang !== undefined) { const off = Math.abs(Math.atan2(Math.sin(Math.atan2(dy, dx) - ang), Math.cos(Math.atan2(dy, dx) - ang))); if (off > 0.42) continue; sc += off * 900; }
    if (sc < bs) { bs = sc; best = u; }
  }
  if (!best) return null;
  const lead = hyp(best.x - me.x, best.y - me.y) / 800;
  return { u: best, x: best.x + best.vx * lead, y: best.y + best.vy * lead };
}

function heroInput(me) {
  const ix = me.input;
  let mx = 0, my = 0;
  if (keys.has('KeyD') || keys.has('ArrowRight')) mx++;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) mx--;
  if (keys.has('KeyS') || keys.has('ArrowDown')) my++;
  if (keys.has('KeyW') || keys.has('ArrowUp')) my--;
  let cast = mouse.down, aimAt = screenToWorld(mouse.x, mouse.y);
  if (touch.move) {
    const dx = touch.move.x - touch.move.ox, dy = touch.move.y - touch.move.oy, d = hyp(dx, dy);
    if (d > STICK_DEAD * 0.5) { mx = dx / Math.max(d, STICK_FULL); my = dy / Math.max(d, STICK_FULL); }
  }
  touch.target = null;
  if (touch.active) {
    const st = touch.aim;
    if (st && hyp(st.x - st.ox, st.y - st.oy) >= STICK_DEAD) {
      // 狙いのスティックを倒している：その向きへ放ち続ける。倒した向きの近くに敵がいれば、そちらへ吸い付く
      const dx = st.x - st.ox, dy = st.y - st.oy, d = hyp(dx, dy), ang = Math.atan2(dy, dx);
      const tg = autoTarget(me, ang), reach = 160 + Math.min(1, d / STICK_FULL) * 480;
      aimAt = tg || { x: me.x + Math.cos(ang) * reach, y: me.y + Math.sin(ang) * reach };
      touch.target = tg; cast = true;
    } else if (st || touch.tap > 0) {
      // 触れているだけ・軽く叩いた：いちばん近い敵へ自動で狙って放つ（敵がいなければ放たない）
      const tg = autoTarget(me);
      if (tg) { aimAt = tg; touch.target = tg; cast = true; }
      else if (mx || my) aimAt = { x: me.x + mx * 300, y: me.y + my * 300 };
    } else if (mx || my) aimAt = { x: me.x + mx * 300, y: me.y + my * 300 };
  }
  ix.mx = mx; ix.my = my;
  ix.aim = Math.atan2(aimAt.y - me.y, aimAt.x - me.x);
  ix.tx = aimAt.x; ix.ty = aimAt.y;
  ix.cast = cast;
  ix.slot = heroSlot;
}

// ═══ 06. 演出（原理ごとの光・詠唱の陣・床の跡・吹き出し） ═══════════
// 床に残る跡（decals）は散逸して消える。数に上限を持つ
const decals = [], parts = [], texts = [], bubbles = [], castCircles = [];
let freeze = 0, punch = 0;
const rnd = (a, b) => a + Math.random() * (b - a);
function blobPts(n = 11) { const p = []; for (let i = 0; i < n; i++) p.push(rnd(0.7, 1.15)); return p; }
// 焦げ跡：命中した場所の石が黒ずみ、縁が少しだけ光って冷える
function stain(x, y, r, ink, life = 10) {
  decals.push({ kind: 'scorch', x, y, r, ink, t: 0, life, rot: rnd(0, TAU), pts: blobPts() });
  if (decals.length > 240) decals.shift();
}
// 亀裂（分）：床に走る光るひび
function crack(x, y, r, ink) {
  const lines = [];
  for (let i = 0; i < 5 + Math.floor(Math.random() * 3); i++) {
    let a = rnd(0, TAU), px = 0, py = 0; const pts = [[0, 0]];
    for (let k = 0; k < 4; k++) { a += rnd(-0.6, 0.6); const l = r * rnd(0.2, 0.35); px += Math.cos(a) * l; py += Math.sin(a) * l; pts.push([px, py]); }
    lines.push(pts);
  }
  decals.push({ kind: 'crack', x, y, r, ink, t: 0, life: 7, lines });
  if (decals.length > 240) decals.shift();
}
// 散った術者の紋が床に焼きつき、ゆっくり散逸する（① 紋 ③ 散逸）
function stamp(x, y, r, ink, crest) {
  decals.push({ kind: 'sigil', x, y, r, ink, crest, t: 0, life: 9, rot: rnd(0, TAU), rune: Math.floor(rnd(0, 28)) });
  if (decals.length > 240) decals.shift();
}
function spray(x, y, ink, n, speed, dir = null, spread = Math.PI, size = 4) {
  for (let i = 0; i < n; i++) {
    const a = dir === null ? rnd(0, TAU) : dir + rnd(-spread, spread), s = rnd(0.25, 1) * speed;
    parts.push({ kind: 'spark', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, r: rnd(0.5, 1.2) * size, ink, t: 0, life: rnd(0.3, 0.65) });
  }
}
// 宝石の欠片：面取りの石がはじけて舞い、ゆっくり回りながら光を返して消える
function gemBurst(x, y, ink, n, speed, size = 6, dir = null, spread = Math.PI) {
  if (REDUCED && n > 8) n = 8;
  for (let i = 0; i < n; i++) {
    const a = dir === null ? rnd(0, TAU) : dir + rnd(-spread, spread), s = rnd(0.3, 1) * speed;
    parts.push({ kind: 'gem', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, r: rnd(0.6, 1.25) * size, ink: i % 4 === 3 ? '#e9e6f3' : ink, rot: rnd(0, TAU), spin: rnd(-6, 6), n: 4 + (i % 4), t: 0, life: rnd(0.7, 1.4) });
  }
}
function ringFx(x, y, r0, r1, ink, life = 0.45, width = 5) { parts.push({ kind: 'ring', x, y, r0, r1, ink, t: 0, life, width }); }
function flash(x, y, r, ink, life = 0.25) { parts.push({ kind: 'flash', x, y, r, ink, t: 0, life }); }
function circleFx(x, y, r, ink, life = 0.6) { parts.push({ kind: 'circle', x, y, r, ink, t: 0, life, rot: rnd(0, TAU), rune: Math.floor(rnd(0, 28)) }); }
function lineFx(kind, x, y, x2, y2, ink, life, w = 3) { parts.push({ kind, x, y, x2, y2, ink, t: 0, life, w, seed: Math.random() * 99 }); }
function floatText(x, y, text, ink, size = 18) { texts.push({ x, y, text, ink, size, t: 0, life: 0.8, vx: rnd(-20, 20) }); if (texts.length > 60) texts.shift(); }
// 動きを減らす設定の人には、画面の揺れと閃光を弱くする
const REDUCED = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
function shake(v) { cam.shake = Math.min(18, cam.shake + v * (REDUCED ? 0.25 : 1)); }
// 衝撃波：明るい前縁と、内側に薄く残る熱の輪
function shockFx(x, y, r, ink, life = 0.4) { parts.push({ kind: 'shock', x, y, r, ink, t: 0, life }); }
// 光芒：強い光の横に伸びる筋（レンズの光芒）
function flareFx(x, y, len, ink, life = 0.3) { parts.push({ kind: 'flare', x, y, r: len, ink, t: 0, life }); }
// 火の粉：ゆっくり減速し、ちらつきながら消える
function embers(x, y, ink, n, speed, dir = null, spread = Math.PI) {
  for (let i = 0; i < n; i++) {
    const a = dir === null ? rnd(0, TAU) : dir + rnd(-spread, spread), s = rnd(0.2, 1) * speed;
    parts.push({ kind: 'ember', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, r: rnd(1, 2.4), ink, t: 0, life: rnd(0.4, 0.95) });
  }
}
// 電弧：一瞬だけ走るぎざぎざの光。描くたびに形が変わる
function arcFx(x, y, len, ink, life = 0.1) { const a = rnd(0, TAU), l = len * rnd(0.5, 1); lineFx('arc', x, y, x + Math.cos(a) * l, y + Math.sin(a) * l, ink, life, rnd(1, 2)); }
// 煙：暗い靄がふくらみながら立ちのぼる（光の足し算ではなく、上に重ねて暗くする）
const smokes = [];
function smokeFx(x, y, r, n = 4) {
  for (let i = 0; i < n; i++) smokes.push({ x: x + rnd(-r, r) * 0.5, y: y + rnd(-r, r) * 0.4, vx: rnd(-30, 30), vy: rnd(-45, -10), r: r * rnd(0.5, 1), t: 0, life: rnd(0.9, 1.8) });
  if (smokes.length > 90) smokes.splice(0, smokes.length - 90);
}
// 画面全体の閃光（自分が関わる大きな爆発・撃破）
const screenFx = { a: 0, col: '#ffffff' };
function flashScreen(ink, a) { a *= REDUCED ? 0.3 : 1; if (a > screenFx.a) { screenFx.a = a; screenFx.col = hex(ink); } }
// 原理ごとの光：どの原理の術かが一目で分かる、ひとつかふたつの印だけを出す（重ねすぎない）
function principleFx(a, x, y, r, col, dir, power = 1) {
  const n = Math.round(2 + power * 4);
  switch (a) {
    case 'motion':
      // 動：細い衝撃の輪と、向きへ吹き抜ける数本の風の筋
      ringFx(x, y, r * 0.2, r * 1.1, col, 0.32, 1.6);
      for (let i = 0; i < n; i++) { const an = (dir ?? rnd(0, TAU)) + rnd(-0.7, 0.7), d = r * rnd(0.2, 0.5), l = r * rnd(0.5, 0.9); lineFx('streak', x + Math.cos(an) * d, y + Math.sin(an) * d, x + Math.cos(an) * (d + l), y + Math.sin(an) * (d + l), col, rnd(0.16, 0.24), 1.4); }
      break;
    case 'bind':
      // 結：六角の格子が一瞬だけ閉じ、小さな欠片が少し散る
      parts.push({ kind: 'hex', x, y, r: r * 0.8, ink: col, t: 0, life: 0.34 });
      for (let i = 0; i < Math.ceil(n / 2); i++) { const an = rnd(0, TAU), sp = rnd(60, 180) * power; parts.push({ kind: 'shard', x, y, vx: Math.cos(an) * sp, vy: Math.sin(an) * sp, r: rnd(2, 4), ink: col, t: 0, life: rnd(0.4, 0.7), rot: rnd(0, TAU), spin: rnd(-6, 6) }); }
      break;
    case 'divide':
      // 分：床に走る細い亀裂と、一閃の斬線
      crack(x, y, Math.max(34, r), col);
      { const an = dir ?? rnd(0, TAU), l = r * rnd(0.7, 1.1); lineFx('slash', x - Math.cos(an + 1.3) * l, y - Math.sin(an + 1.3) * l, x + Math.cos(an + 1.3) * l, y + Math.sin(an + 1.3) * l, col, 0.18, 1.6); }
      break;
    case 'convert':
      // 換：光が渦を巻いて中心へ吸い込まれる
      for (let i = 0; i < n; i++) parts.push({ kind: 'swirl', x, y, r: r * rnd(0.7, 1.2), a0: rnd(0, TAU), ink: col, t: 0, life: rnd(0.4, 0.6), size: rnd(1.4, 2.4) });
      break;
    case 'grow':
      // 増：光の粒が柔らかくふくらんで、ゆっくり舞う
      for (let i = 0; i < n; i++) { const an = rnd(0, TAU), sp = rnd(30, 110) * power; parts.push({ kind: 'petal', x, y, vx: Math.cos(an) * sp, vy: Math.sin(an) * sp - 20, r: rnd(2, 3.6), ink: col, t: 0, life: rnd(0.7, 1.1), rot: rnd(0, TAU), spin: rnd(-4, 4) }); }
      break;
    case 'phase':
      // 相：わずかに色のずれた二つの輪
      ringFx(x - 3, y, r * 0.3, r * 1, '#ff5fa2', 0.3, 1.4); ringFx(x + 3, y, r * 0.3, r * 1, '#5aa9ff', 0.3, 1.4);
      break;
  }
}
// 放つ瞬間の小さな陣：杖先の前に、狙いの向きへ傾いた輪が開いて閉じる（前を向いた魔法陣）
function muzzleFx(x, y, aim, r, ink, life = 0.3) { parts.push({ kind: 'muzzle', x, y, a: aim, r, ink, t: 0, life, rune: Math.floor(rnd(0, 28)) }); }
// 当たった瞬間：白い芯・細い衝撃の輪・向きへ飛ぶ火花。大きさだけで強さを見せる
function impactFx(x, y, col, size, dir, solid = false) {
  flash(x, y, size * 1.6, col, 0.16);
  shockFx(x, y, size * 1.3, col, 0.26);
  spray(x, y, solid ? '#f2ece2' : col, Math.round(3 + Math.min(7, size / 7)), 300 + size * 5, dir, dir === null ? Math.PI : 0.65, solid ? 1.6 : 2);
}
// 吹き出し：術者の頭上に出る。散った術者は最後にいた場所に残る
function say(u, text, kind = 'cry', x, y) {
  if (!text) return;
  const id = u ? u.id : 0;
  for (let i = bubbles.length - 1; i >= 0; i--) if (id && bubbles[i].id === id) bubbles.splice(i, 1);
  bubbles.push({ id, text, kind, x: x ?? u.x, y: y ?? u.y, r: u ? u.r : 18, t: 0, life: kind === 'chant' ? 1.4 : 3, ink: u ? u.ink : 'yellow' });
  if (bubbles.length > 24) bubbles.shift();
}

// 世界から届いた出来事を演出・音・声・表示に変える
function consumeEvents() {
  const me = S.hero(world);
  const meId = world.heroId;
  const near = (x, y) => hyp(x - cam.x, y - cam.y) < (vw + vh) / cam.z * 0.6;
  const vol = (x, y) => Math.max(0, 1 - hyp(x - cam.x, y - cam.y) / ((vw + vh) / cam.z * 0.6));
  for (const e of world.events) {
    if (window.PRIMA_AUTO) window.PRIMA_AUTO.event(e, world, me);
    if (tutor.on) tutorEvent(e, meId);
    switch (e.type) {
      case 'chant': {
        // 詠唱：足元に大きな陣が開き、詠唱文が陣を巡る。重い術は声に出して唱える
        const u = S.unitById(world, e.id);
        if (!u || !near(u.x, u.y)) break;
        // 声に出すのは名前を付けた術の技名だけ。詠唱文は陣を巡る文字として見せる
        const r = u.spells[e.slot];
        const big = e.t >= D.chant.voiceAt || e.named;
        castCircles.push({ id: u.id, a: e.a, b: e.b, col: e.col, words: chantWords(r).join(L('・')), name: e.name, t: 0, life: e.t + 0.3, total: e.t, big, rot: rnd(0, TAU) });
        if (e.id === meId) {
          chantPad(u.id, S.lookOf(r, 0), e.t, 1);
          if (e.named) speak(`${e.name}！`, 'spell');
          if (big) say(u, `${e.name}！`, 'chant');
        } else if (big) {
          withPan(u.x, () => chantPad(u.id, S.lookOf(r, 0), e.t, 0.35 * vol(u.x, u.y)));
          if (Math.random() < 0.6) say(u, `${e.name}！`, 'chant');
        }
        break;
      }
      case 'cast': {
        const u = S.unitById(world, e.id);
        if (!u || !near(u.x, u.y)) break;
        const tip = staffTip(u), beam = e.beh === 'beam';
        // 放つ瞬間：杖先の前に小さな陣が開いて閉じ、白い芯がはじけ、狙いの向きへ火花が数本だけ走る
        muzzleFx(tip.x + Math.cos(e.aim) * 8, tip.y + Math.sin(e.aim) * 8, e.aim, beam ? 22 : 15, e.col, beam ? 0.42 : 0.3);
        flash(tip.x, tip.y, beam ? 48 : 30, e.col, 0.14);
        shockFx(tip.x, tip.y, beam ? 40 : 24, e.col, 0.2);
        spray(tip.x, tip.y, e.col, beam ? 6 : 4, 340, e.aim, 0.25, 2);
        if (beam) embers(tip.x, tip.y, e.col, 4, 200, e.aim, 0.6);
        if (!beam && e.form !== 'plane') sfxAt('cast', e.id === meId ? 1 : 0.3 * vol(u.x, u.y), e, u.x);
        else if (beam) sfxAt('beam', e.id === meId ? 1 : 0.35 * vol(u.x, u.y), e, u.x);
        if (e.id === meId) punch = Math.max(punch, beam ? 0.035 : 0.012);
        break;
      }
      case 'buff': {
        const u = S.unitById(world, e.id);
        if (u && near(u.x, u.y)) { circleFx(u.x, u.y + u.r * 0.3, u.r * 2.4, e.col, 0.8); ringFx(u.x, u.y, u.r, u.r * 2.8, e.col, 0.55, 3); principleFx(e.kind, u.x, u.y, u.r * 1.6, e.col, null, 0.6); }
        if (e.id === meId) { sfx('buff', 1); toast(L('纏：{0}', D.principles[e.kind].name), L('自分の紋の魔力を体へ書き込んだ')); }
        break;
      }
      case 'misfire': {
        const u = S.unitById(world, e.id);
        spray(e.x, e.y, 'red', 12, 340, null, Math.PI, 2.4);
        flash(e.x, e.y, 110, 'red', 0.3);
        shockFx(e.x, e.y, 110, 'red', 0.42);
        embers(e.x, e.y, 'red', 10, 280);
        smokeFx(e.x, e.y, 40, 4);
        crack(e.x, e.y, 70, '#ff5a5a');
        if (e.id === meId) { sfx('misfire', 1); shake(8); flashScreen('red', 0.12); toast(L('暴発'), L('「{0}」は制御容量を超えていた', e.name)); }
        if (u && near(e.x, e.y)) say(u, L('術式が…崩れる！'), 'cry');
        break;
      }
      case 'hit': {
        if (!near(e.x, e.y)) break;
        const mine = e.owner === meId, onMe = e.target === meId;
        const dir = Math.atan2(e.vy, e.vx);
        const size = 16 + Math.min(40, e.dmg * 1.1);
        if (e.shielded) { flash(e.x, e.y, 22, e.col, 0.12); ringFx(e.x, e.y, 4, 22, e.col, 0.2, 1.2); }
        else if (e.matter === 'solid') {
          // 固体：砕けた破片が少し飛び、白い火花と土煙。光は小さい
          for (let i = 0; i < 3 + Math.min(5, e.dmg / 5); i++) { const an = dir + rnd(-0.9, 0.9), sp = rnd(120, 320); parts.push({ kind: 'shard', x: e.x, y: e.y, vx: Math.cos(an) * sp, vy: Math.sin(an) * sp, r: rnd(2, 4.5), ink: i % 3 ? '#bdb6c6' : e.col, t: 0, life: rnd(0.35, 0.7), rot: rnd(0, TAU), spin: rnd(-12, 12) }); }
          impactFx(e.x, e.y, e.col, size * 0.7, dir, true);
          smokeFx(e.x, e.y, 12 + e.dmg * 0.4, 2);
        } else {
          // エネルギー：白い芯がはじけ、細い衝撃の輪、向きへ抜ける火花。強い一撃にだけ光芒と煙
          impactFx(e.x, e.y, e.col, size, dir);
          embers(e.x, e.y, e.col, 2 + Math.min(6, e.dmg / 5), 240, dir, 0.8);
          if (e.dmg > 18) flareFx(e.x, e.y, 60 + e.dmg * 1.6, e.col, 0.22);
          if (e.dmg > 16) smokeFx(e.x, e.y, 14 + e.dmg * 0.35, 2);
        }
        if (!e.shielded) principleFx(e.a, e.x, e.y, 22 + e.dmg * 0.6, e.col, dir, Math.min(1, 0.3 + e.dmg / 40));
        if (!e.shielded && (mine || onMe || Math.random() < 0.35)) stain(e.x, e.y, 8 + e.dmg * 0.45, e.col, 9);
        if (mine) { floatText(e.x, e.y - 10, e.shielded ? '0' : Math.round(e.dmg), e.col, 15 + Math.min(14, e.dmg * 0.4)); sfxAt('hit', 1, e, e.x); }
        else if (!onMe) sfxAt('hit', 0.25 * vol(e.x, e.y), e, e.x);
        if (onMe && !e.shielded) { shake(2 + e.dmg * 0.18); sfx('hurt', 1); flashScreen('#a3202f', Math.min(0.1, 0.03 + e.dmg * 0.003)); }
        break;
      }
      case 'splat': case 'fizzle':
        if (near(e.x, e.y)) { spray(e.x, e.y, e.col, e.type === 'fizzle' ? 4 : 7, 150, null, Math.PI, 2.2); flash(e.x, e.y, 22, e.col, 0.14); }
        break;
      case 'activate':
        if (!near(e.x, e.y)) break;
        // 起動：広がり方の大きさで光が開き、原理の光が重なる
        flash(e.x, e.y, e.r * 1.3, e.col, 0.3);
        ringFx(e.x, e.y, e.r * 0.25, e.r, e.col, 0.42, e.form === 'point' ? 1.4 : 2.4);
        principleFx(e.a, e.x, e.y, e.r, e.col, null, e.form === 'point' ? 0.5 : 1);
        if (e.form !== 'point') {
          // 広がる術の起動：白熱した芯 → 一枚の衝撃波 → 少しの火の粉と煙。大きな術にだけ光芒
          spray(e.x, e.y, e.col, 10, 340, null, Math.PI, 2.2);
          shockFx(e.x, e.y, e.r * 1.3, e.col, 0.46);
          flash(e.x, e.y, Math.min(70, e.r * 0.35), '#fffaf0', 0.1);
          if (e.r > 90) flareFx(e.x, e.y, e.r * 2, e.col, 0.3);
          embers(e.x, e.y, e.col, 10, e.r * 2.6);
          smokeFx(e.x, e.y, e.r * 0.4, 3);
          stain(e.x, e.y, e.r * 0.5, e.col, 10);
        }
        if (e.form !== 'point' || e.deploy === 'burst') {
          sfxAt('blast', e.owner === meId ? 1 : 0.5 * vol(e.x, e.y), e, e.x);
          shake(e.owner === meId ? 4.5 : 1);
          if (e.owner === meId || hyp(e.x - cam.x, e.y - cam.y) < 260) flashScreen(e.col, 0.06);
        }
        if (e.deploy === 'sprinkle') ringFx(e.x, e.y, 10, 90, 'yellow', 0.6, 2);
        break;
      case 'beam':
        if (!near(e.x1, e.y1) && !near(e.x2, e.y2) && !near((e.x1 + e.x2) / 2, (e.y1 + e.y2) / 2)) break;
        // 光線は一本の光だけで見せる（並走する線や流れる玉は足さない）。始点の光芒と、終点の衝撃
        parts.push({ kind: 'beam', x: e.x1, y: e.y1, x2: e.x2, y2: e.y2, w: e.w, ink: e.col, t: 0, life: 0.62, seed: rnd(0, 9) });
        if (near(e.x1, e.y1)) flareFx(e.x1, e.y1, 80, e.col, 0.26);
        if (near(e.x2, e.y2)) {
          const bd = Math.atan2(e.y2 - e.y1, e.x2 - e.x1);
          impactFx(e.x2, e.y2, e.col, 46, bd);
          flareFx(e.x2, e.y2, 110, e.col, 0.26);
          embers(e.x2, e.y2, e.col, 6, 260, bd, 1);
          principleFx(e.a, e.x2, e.y2, 44, e.col, bd, 0.7);
        }
        if (e.id === meId) { shake(3.5); flashScreen(e.col, 0.04); }
        break;
      case 'chain':
        lineFx('bolt', e.x1, e.y1, e.x2, e.y2, e.col, 0.24, 2.5);
        break;
      case 'blink':
        lineFx('streak', e.x1, e.y1, e.x2, e.y2, e.col, 0.35, 10);
        if (near(e.x2, e.y2)) { flash(e.x2, e.y2, 70, e.col, 0.25); circleFx(e.x2, e.y2, 60, e.col, 0.45); }
        break;
      case 'zone':
        if (near(e.x, e.y)) circleFx(e.x, e.y, e.r, e.col, 0.55);
        if (e.kind === 'blades' && near(e.x, e.y)) { principleFx('bind', e.x, e.y, e.r, e.col, null, 0.7); if (e.owner === meId) sfx('clang', 0.8); }
        if (e.kind === 'wall' && near(e.x, e.y)) sfxAt('ward', e.owner === meId ? 1 : 0.3 * vol(e.x, e.y), null, e.x);
        if (e.owner === meId && ['bulwark', 'shift', 'counter'].includes(e.rtype)) sfx('ward', 1);
        break;
      case 'wardBreak':
        if (near(e.x, e.y)) {
          principleFx('bind', e.x, e.y, e.big ? e.r : e.r * 2, e.col, null, e.big ? 1 : 0.6);
          shockFx(e.x, e.y, e.r * 2, e.col, 0.3);
          for (let i = 0; i < (e.big ? 10 : 5); i++) { const an = rnd(0, TAU), sp = rnd(90, 260); parts.push({ kind: 'shard', x: e.x, y: e.y, vx: Math.cos(an) * sp, vy: Math.sin(an) * sp, r: rnd(2.5, 5), ink: e.col, t: 0, life: rnd(0.5, 0.9), rot: rnd(0, TAU), spin: rnd(-8, 8) }); }
          sfxAt('shatter', vol(e.x, e.y), null, e.x);
          if (e.big) {
            // 結界が砕ける：割れた膜の破片が四方へ飛び、白い閃光
            flash(e.x, e.y, e.r * 1.4, '#fffaf0', 0.18); smokeFx(e.x, e.y, e.r * 0.4, 3); embers(e.x, e.y, e.col, 12, e.r * 2.6);
            floatText(e.x, e.y - e.r * 0.5, L('結界崩壊'), e.col, 20);
            if (hyp(e.x - cam.x, e.y - cam.y) < 500) { shake(7); flashScreen(e.col, 0.08); }
          }
        }
        break;
      case 'pierce':
        // 貫通：エネルギーが固体をすり抜ける。抜けた先へ光の筋
        if (near(e.x, e.y)) { flash(e.x, e.y, 30, e.col, 0.16); spray(e.x, e.y, e.col, 6, 320, null, Math.PI, 2); ringFx(e.x, e.y, 4, 22, '#fffaf0', 0.18, 1.5); if (Math.random() < 0.5) floatText(e.x, e.y - 18, L('貫通'), e.col, 13); sfxAt('pierce', 0.6 * vol(e.x, e.y), null, e.x); }
        break;
      case 'strip':
        // 剥離：固体がエネルギーの膜を引き剥がす。結晶の破片と裂ける光
        if (near(e.x, e.y)) { principleFx('divide', e.x, e.y, 26, e.col, null, 0.4); spray(e.x, e.y, e.col, 10, 260, null, Math.PI, 3); if (Math.random() < 0.5) floatText(e.x, e.y - 18, L('剥離'), e.col, 13); sfxAt('strip', 0.7 * vol(e.x, e.y), null, e.x); }
        break;
      case 'clash':
        // 固体どうしの衝突：火花が散り、金属が鳴る
        if (near(e.x, e.y)) { spray(e.x, e.y, '#fffaf0', 10, 420, null, Math.PI, 2); spray(e.x, e.y, e.col2 || e.col, 8, 300, null, Math.PI, 2.5); flash(e.x, e.y, 34, e.col, 0.14); shockFx(e.x, e.y, 26, e.col, 0.2); sfxAt('clang', vol(e.x, e.y), null, e.x); }
        break;
      case 'node':
        if (e.id === meId && e.k) toast(L('「{0}」の節点', D.principles[e.k].kanji), L('{0}を含む術が強まり（威力 ×{1}・消費 ×{2}）、輪の中では魔力が湧き出る', D.principles[e.k].name, W.node.power, W.node.cost));
        break;
      case 'center':
        if (e.id === meId) toast(L('要の陣'), L('ここに立つ間は制御容量が +{0}。重い術を暴発させずに扱える', W.center.capacity));
        break;
      case 'resonate':
        // 共鳴：自分の場を通った術が強まる
        if (near(e.x, e.y)) { ringFx(e.x, e.y, 8, 54, e.col, 0.35, 3); flash(e.x, e.y, 60, e.col2 || e.col, 0.2); if (e.owner === meId) { floatText(e.x, e.y - 20, L('共鳴'), e.col, 15); sfx('buff', 0.35); } }
        break;
      case 'cancel':
        // 相殺：エネルギーどうしが打ち消し合う
        if (near(e.x, e.y)) { flash(e.x, e.y, 70, e.col, 0.22); flash(e.x, e.y, 40, e.col2 || e.col, 0.18); shockFx(e.x, e.y, 60, '#fffaf0', 0.25); for (let i = 0; i < 4; i++) arcFx(e.x, e.y, 40, i % 2 ? e.col : (e.col2 || e.col), 0.12); if (Math.random() < 0.5) floatText(e.x, e.y - 16, L('相殺'), '#fffaf0', 13); sfxAt('pierce', 0.6 * vol(e.x, e.y), null, e.x); }
        break;
      case 'fuse':
        // 融合：自分のエネルギーの弾どうしが一つになる
        if (near(e.x, e.y)) { flash(e.x, e.y, 70, e.col, 0.25); ringFx(e.x, e.y, 30, 4, e.col2 || e.col, 0.3, 3); for (let i = 0; i < 3; i++) arcFx(e.x, e.y, 30, e.col, 0.1); if (e.owner === meId) { floatText(e.x, e.y - 20, L('融合'), e.col, 15); sfx('buff', 0.3); } }
        break;
      case 'enchant':
        // 魔装：エネルギーが自分の固体の弾に宿る
        if (near(e.x, e.y)) { flash(e.x, e.y, 50, e.col, 0.2); spray(e.x, e.y, e.col, 10, 200, null, Math.PI, 2); if (e.owner === meId) { floatText(e.x, e.y - 20, L('魔装'), e.col, 15); sfx('clang', 0.35); } }
        break;
      case 'chainBlast':
        // 誘爆：自分の罠が連鎖して起動する
        lineFx('bolt', e.x1, e.y1, e.x2, e.y2, e.col, 0.3, 3);
        if (near(e.x2, e.y2)) { floatText(e.x2, e.y2 - 30, L('誘爆'), e.col, 17); shake(3); }
        break;
      case 'catch':
        // 戻る術を受け止めると、魔力の一部が戻る
        if (near(e.x, e.y)) { spray(e.x, e.y, e.col, 6, 160, null, Math.PI, 2); ringFx(e.x, e.y, 4, 30, 'blue', 0.3, 2); }
        if (e.id === meId) { sfx('clang', 0.4); floatText(e.x, e.y - 24, L('+{0} 魔力', Math.round(e.refund || 0)), 'blue', 14); }
        break;
      case 'ricochet':
        if (near(e.x, e.y)) { spray(e.x, e.y, '#fffaf0', 7, 300, null, Math.PI, 2); flash(e.x, e.y, 22, e.col, 0.12); sfxAt('clang', 0.45 * vol(e.x, e.y), null, e.x); }
        break;
      case 'absorb':
        if (near(e.x, e.y)) {
          flash(e.x, e.y, 34, e.col, 0.2); ringFx(e.x, e.y, 4, 26, e.col, 0.25, 2); sfx('absorb', 0.5 * vol(e.x, e.y));
          // 完全の結界：金の波紋が広がり、何も通さない
          if (e.kind === 'perfect') { ringFx(e.x, e.y, 6, 46, '#ffe29a', 0.35, 3); spray(e.x, e.y, '#ffe29a', 8, 240, null, Math.PI, 2); sfxAt('clang', 0.5 * vol(e.x, e.y), null, e.x); }
        }
        break;
      case 'reflect':
        if (near(e.x, e.y)) { flash(e.x, e.y, 40, e.col, 0.2); ringFx(e.x, e.y, 6, 40, e.col, 0.3, 3); sfx('reflect', 0.7 * vol(e.x, e.y)); }
        break;
      case 'heal':
        if (Math.random() < 0.5) parts.push({ kind: 'petal', x: e.x + rnd(-14, 14), y: e.y, vx: rnd(-20, 20), vy: -60, r: 3, ink: 'green', t: 0, life: 0.8, rot: 0, spin: 3 });
        break;
      case 'sever':
        if (near(e.x, e.y)) spray(e.x, e.y, 'purple', 5, 120, null, Math.PI, 2);
        if (e.owner === meId) { sfx('sever', 1); if (e.why === 'far') toast(L('糸が切れた'), L('術者から離れすぎた')); else if (e.why === 'mp') toast(L('糸が切れた'), L('魔力が尽きた')); else if (e.why === 'cut') toast(L('糸を断たれた'), ''); }
        break;
      case 'detonate':
        if (e.id === meId) sfx('detonate', 1);
        break;
      case 'unravel':
        if (near(e.x, e.y)) { const o = S.unitById(world, e.owner); if (o) parts.push({ kind: 'drain', x: e.x, y: e.y, tx: o.x, ty: o.y, ink: e.col, t: 0, life: 0.45 }); }
        break;
      case 'recall':
        if (e.id === meId) { sfx('recall', 1); toast(L('回収 +{0} 魔力', Math.round(e.refund)), L('糸でつながった術式 {0} つをほどいた', e.n)); }
        break;
      case 'phased':
        if (near(e.x, e.y)) principleFx('phase', e.x, e.y, 30, '#ff5fa2', null, 0.3);
        break;
      case 'strikeWarn':
        if (near(e.x, e.y)) sfxAt('strikeWarn', 0.8 * vol(e.x, e.y), null, e.x);
        break;
      case 'strike':
        if (near(e.x, e.y)) {
          parts.push({ kind: 'beam', x: e.x, y: e.y - 900, x2: e.x, y2: e.y, w: 18, ink: '#e9e6ff', t: 0, life: 0.5 });
          flash(e.x, e.y, e.r * 1.8, '#e9e6ff', 0.32); shockFx(e.x, e.y, e.r * 1.5, '#ffffff', 0.5); ringFx(e.x, e.y, e.r * 0.3, e.r * 1.4, '#cfd8ff', 0.5, 4);
          spray(e.x, e.y, '#cfd8ff', 14, 420, null, Math.PI, 2.4); embers(e.x, e.y, '#cfd8ff', 12, 380); stain(e.x, e.y, e.r * 1.2, '#7a1f2b', 22);
          shake(8); flashScreen('#cfd8ff', 0.14);
          sfxAt('strike', vol(e.x, e.y), null, e.x);
        }
        break;
      case 'bossLearn':
        floatText(e.x, e.y - 100, L('解析：{0}', D.craft.vessels[e.vessel].name), '#b784ff', 18);
        toast(L('演算体が学習した'), L('「{0}」への対策を組んだ', D.craft.vessels[e.vessel].name));
        sfx('bossLearn');
        break;
      case 'bossDecoy':
        floatText(e.x, e.y - 100, L('欺瞞'), '#b784ff', 18);
        sfxAt('bossDecoy', vol(e.x, e.y), null, e.x);
        break;
      case 'decoyPop':
        if (near(e.x, e.y)) { flash(e.x, e.y, 60, e.col, 0.2); principleFx('phase', e.x, e.y, 46, '#ff5fa2', null, 0.5); spray(e.x, e.y, e.col, 10, 260, null, Math.PI, 2); floatText(e.x, e.y - 20, L('分身'), e.col, 13); sfxAt('shatter', 0.5 * vol(e.x, e.y), null, e.x); }
        break;
      case 'dodge':
        if (near(e.x, e.y)) { spray(e.x, e.y, e.ink, 12, 260, null, Math.PI, 3); ringFx(e.x, e.y, 16, 60, e.ink, 0.3, 2); shockFx(e.x, e.y, 50, e.ink, 0.25); }
        if (e.id === meId) sfx('dodge', 1);
        break;
      case 'dummyReset':
        if (near(e.x, e.y)) { ringFx(e.x, e.y, 20, 90, 'yellow', 0.5, 3); floatText(e.x, e.y - 60, L('構造崩壊'), 'yellow', 16); }
        break;
      case 'kill': {
        const involved = e.killer === meId || e.victim === meId;
        if (near(e.x, e.y)) {
          const victim = S.unitById(world, e.victim);
          // 散る：体の魔素がほどけて昇り、外套が崩れ、床に紋が焼きつく
          parts.push({ kind: 'defeat', x: e.x, y: e.y, r: e.r, ink: e.ink, t: 0, life: 2.2, dir: victim && victim.vx < 0 ? -1 : 1 });
          flash(e.x, e.y - e.r, e.r * 2, e.ink, 0.22);
          shockFx(e.x, e.y, e.r * 3, e.ink, 0.45);
          embers(e.x, e.y - e.r, e.ink, 16, 300);
          for (let i = 0; i < 10; i++) parts.push({ kind: 'rise', x: e.x + rnd(-e.r, e.r) * 0.7, y: e.y - rnd(0, e.r * 1.6), vx: rnd(-14, 14), vy: -rnd(60, 140), r: rnd(1.4, 2.6), ink: e.ink, t: 0, life: rnd(0.9, 1.6) });
          smokeFx(e.x, e.y, e.r, 4);
          stain(e.x, e.y, e.r * 1.5, e.ink, 16);
          stamp(e.x, e.y, e.r * 1.6, e.ink, victim ? victim.crest : 'ring');
          if (audio.ctx && profile.sfx && audio.ctx.state === 'running') {
            withPan(e.x, () => { playTexture('arc', 'impact', vol(e.x, e.y) * 0.4, 0.7); });
            sfxAt('defeat', (e.victim === meId ? 1 : 0.8) * vol(e.x, e.y), null, e.x);
          }
        }
        if (world.room.special && world.boss && e.victim === world.boss.id && mode === 'play' && !winT) specialWon();
        // 断末魔と勝利宣言
        const killer = e.killer && S.unitById(world, e.killer);
        if (e.victim === meId) { say(null, e.deathCry, 'death', e.x, e.y); speak(e.deathCry, 'death'); }
        else if (near(e.x, e.y) && Math.random() < 0.6) say(null, e.deathCry, 'death', e.x, e.y);
        if (killer) {
          if (e.killer === meId) { say(killer, e.winCry, 'win'); speakLater(e.winCry, 'win', 0.25); }
          else if (e.victim === meId) { say(killer, e.winCry, 'win'); speakLater(e.winCry, 'foe', 1.8); }
          else if (near(killer.x, killer.y) && Math.random() < 0.5) say(killer, e.winCry, 'win');
        }
        if (involved) { freeze = 0.08; shake(10); punch = 0.05; flashScreen(e.ink, 0.12); }
        if (e.killer === meId) { sfx('kill', 1); toast(L('{0} を散らした', e.victimName), L('+{0} 魔素', fmt(e.mass * W.death.killerShare + W.death.killerBase))); }
        else if (e.victim !== meId && near(e.x, e.y)) sfx('thud', 0.5 * vol(e.x, e.y));
        feedKill(e, meId);
        if (e.victim === meId) heroDown(e);
        break;
      }
      case 'level':
        if (e.id === meId && me) {
          circleFx(me.x, me.y, me.r * 2.6, 'yellow', 0.9); ringFx(me.x, me.y, me.r, me.r * 3.2, 'yellow', 0.6, 3); sfx('level', 1);
          toast(`LV ${e.level}`, e.capUp ? L('制御容量が {0} になった。より重い術を安定して放てる', e.cap) : L('次の制御容量まで育て'));
        }
        break;
      case 'surge':
        if (near(e.x, e.y)) { ringFx(e.x, e.y, 40, 360, 'yellow', 0.9, 6); flash(e.x, e.y, 260, 'yellow', 0.5); sfx('surge', 0.6 * vol(e.x, e.y)); }
        break;
      case 'pickup':
        pickupCombo = Math.min(24, pickupCombo + 1); pickupT = 0.4;
        sfx('pickup', Math.min(0.6, 0.25 + e.v * 0.08), pickupCombo);
        break;
    }
  }
  world.events.length = 0;
}
let pickupCombo = 0, pickupT = 0;
function updateFx(dt) {
  for (let i = decals.length - 1; i >= 0; i--) { const d = decals[i]; d.t += dt; if (d.t > d.life) decals.splice(i, 1); }
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.t += dt;
    if (p.t > p.life) { parts.splice(i, 1); continue; }
    if (p.vx !== undefined) {
      p.x += p.vx * dt; p.y += p.vy * dt;
      const f = Math.pow(p.kind === 'rise' || p.kind === 'petal' ? 0.5 : p.kind === 'gem' ? 0.22 : p.kind === 'ember' ? 0.14 : 0.04, dt); p.vx *= f; p.vy *= f;
      if (p.kind === 'petal') p.vy += 40 * dt;
    }
    if (p.spin) p.rot += p.spin * dt;
  }
  const cap = LOW ? 380 : 1100;
  if (parts.length > cap) parts.splice(0, parts.length - cap);
  for (let i = smokes.length - 1; i >= 0; i--) { const m = smokes[i]; m.t += dt; m.x += m.vx * dt; m.y += m.vy * dt; m.vx *= Math.pow(0.4, dt); m.vy *= Math.pow(0.5, dt); if (m.t > m.life) smokes.splice(i, 1); }
  screenFx.a = Math.max(0, screenFx.a - dt * 0.9);
  for (let i = castCircles.length - 1; i >= 0; i--) { const c = castCircles[i]; c.t += dt; const u = S.unitById(world, c.id); if (c.t > c.life || !u || !u.alive) castCircles.splice(i, 1); }
  for (let i = texts.length - 1; i >= 0; i--) { const t = texts[i]; t.t += dt; t.y -= 40 * dt; t.x += t.vx * dt; if (t.t > t.life) texts.splice(i, 1); }
  for (let i = bubbles.length - 1; i >= 0; i--) {
    const b = bubbles[i];
    b.t += dt;
    const u = b.id && S.unitById(world, b.id);
    if (u && u.alive) { b.x = u.x; b.y = u.y; b.r = u.r; }
    if (b.t > b.life) bubbles.splice(i, 1);
  }
  // 続く効果：詠唱中の光の粒、活性の光、毒の泡、加速の残光、泉から立ちのぼる魔素
  for (const u of world.units) {
    if (!u.alive || !S.visibleTo(S.hero(world), u) || hyp(u.x - cam.x, u.y - cam.y) > (vw + vh) / cam.z) continue;
    if (u.casting) {
      // 詠唱中：光が足元へ渦を巻いて集まり、杖先で電弧がはぜ、体から力が立ちのぼる
      const col = S.recipeResult(u.spells[u.casting.slot]).color;
      if (Math.random() < dt * 16) parts.push({ kind: 'swirl', x: u.x, y: u.y + u.r * 0.35, r: u.r * rnd(1.2, 2.2), a0: rnd(0, TAU), ink: col, t: 0, life: 0.6, size: rnd(1.2, 2.2) });
      if (Math.random() < dt * 7) parts.push({ kind: 'rise', x: u.x + rnd(-u.r, u.r) * 0.8, y: u.y + u.r * 0.3, vx: rnd(-8, 8), vy: -rnd(90, 170), r: rnd(1.4, 2.6), ink: col, t: 0, life: rnd(0.4, 0.8) });
    }
    if (u.vitalT > 0 && Math.random() < dt * 8) parts.push({ kind: 'petal', x: u.x + rnd(-u.r, u.r), y: u.y - u.r * rnd(0, 2), vx: rnd(-10, 10), vy: -40, r: rnd(2, 3.5), ink: 'green', t: 0, life: 0.9, rot: 0, spin: 3 });
    if (u.hasteT > 0 && Math.random() < dt * 14) { const a = Math.atan2(u.vy, u.vx) + Math.PI; parts.push({ kind: 'spark', x: u.x + rnd(-u.r, u.r) * 0.6, y: u.y + rnd(-u.r, u.r) * 0.6, vx: Math.cos(a) * 90, vy: Math.sin(a) * 90, r: 2, ink: 'orange', t: 0, life: 0.35 }); }
  }
  for (const s of world.springs) {
    if (hyp(s.x - cam.x, s.y - cam.y) > (vw + vh) / cam.z) continue;
    if (Math.random() < dt * 10) { const a = rnd(0, TAU), d = rnd(0, s.r); parts.push({ kind: 'rise', x: s.x + Math.cos(a) * d, y: s.y + Math.sin(a) * d, vx: 0, vy: -rnd(40, 90), r: rnd(1.5, 3.5), ink: 'yellow', t: 0, life: rnd(0.8, 1.6) }); }
  }
  punch = Math.max(0, punch - dt * 0.2);
  updateAsh(dt);
  updateThunder(dt);
  pickupT -= dt; if (pickupT <= 0) pickupCombo = 0;
  touch.tap = Math.max(0, touch.tap - dt);
}

// ═══ 07. 音と声 ═════════════════════════════════════════════════
// 効果音はその場で合成する。すべて残響（石の広間の響き）を通し、画面の左右に定位させる。原理ごとに音色が違う
const audio = { ctx: null, master: null, bus: null, verb: null, noise: null, shaper: null, out: null, last: {} };
function unlockAudio() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  if (!audio.ctx) {
    const a = audio.ctx = new AC();
    // 圧縮：大きな爆発でも割れず、小さな音も前に出る
    const comp = a.createDynamicsCompressor();
    if (comp.threshold) { comp.threshold.value = -18; comp.knee.value = 10; comp.ratio.value = 5; comp.attack.value = 0.003; comp.release.value = 0.2; }
    comp.connect(a.destination);
    audio.master = a.createGain(); audio.master.connect(comp);
    setSfxVolume();
    // 残響：石の広間。尾は短めで暗く、低域は響かせない（爆発の低音で全体が濁らないように）
    const len = Math.floor(a.sampleRate * 2.4), ir = a.createBuffer(2, len, a.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c); let lp = 0;
      // 尾は時間とともに高域から暗くなる
      for (let i = 0; i < len; i++) { const u = i / len; lp += ((Math.random() * 2 - 1) - lp) * (0.42 - 0.34 * Math.min(1, u * 1.4) + c * 0.03); d[i] = lp * Math.pow(1 - u, 3.6); }
      // 石壁からの初期反射（左右でずらす）
      for (const [ms, gn] of [[11, 0.6], [19, 0.42], [31, 0.36], [47, 0.26], [67, 0.18]]) d[Math.floor(a.sampleRate * (ms + c * 3.7) / 1000)] += gn * (c ? -1 : 1) * 0.6;
    }
    audio.verb = a.createConvolver(); audio.verb.buffer = ir;
    const wet = a.createGain(); wet.gain.value = 0.32;
    audio.verb.connect(wet); wet.connect(audio.master);
    const pre = a.createBiquadFilter(); pre.type = 'highpass'; pre.frequency.value = 240; pre.connect(audio.verb);
    audio.bus = a.createGain(); audio.bus.connect(audio.master); audio.bus.connect(pre);
    const nl = Math.floor(a.sampleRate * 1.2), nb = a.createBuffer(1, nl, a.sampleRate), ch = nb.getChannelData(0);
    for (let i = 0; i < nl; i++) ch[i] = Math.random() * 2 - 1;
    audio.noise = nb;
    // 亀裂・爆発のざらつきに使う歪み
    audio.dark = a.createBiquadFilter(); audio.dark.type = 'lowpass'; audio.dark.frequency.value = 780; audio.dark.Q.value = 0.9; audio.dark.connect(audio.bus);
    audio.shaper = a.createWaveShaper();
    const curve = new Float32Array(256); for (let i = 0; i < 256; i++) { const x = i / 128 - 1; curve[i] = Math.tanh(x * 4); }
    audio.shaper.curve = curve; audio.shaper.connect(audio.bus);
  }
  if (audio.ctx.state === 'suspended') audio.ctx.resume();
  if (!baked.size && !warmList.length) queueWarm();
  playBgm();
}
function setSfxVolume() { if (audio.master) audio.master.gain.value = 0.95 * profile.sfxVol; }
const outNode = o => o.dest || audio.out || audio.bus;
// 音の部品：発振と雑音。attack で立ち上がり、dur で消える
function osc(type, f0, f1, dur, vol, o = {}) {
  const a = audio.ctx, t = a.currentTime + (o.at || 0);
  const n = a.createOscillator(), g = a.createGain();
  n.type = type;
  n.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) n.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  if (o.detune) n.detune.value = o.detune;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + (o.attack || 0.006));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  n.connect(g); g.connect(outNode(o));
  n.start(t); n.stop(t + dur + 0.05);
  return n;
}
function hiss(type, f0, f1, q, dur, vol, o = {}) {
  const a = audio.ctx, t = a.currentTime + (o.at || 0);
  const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
  s.buffer = audio.noise;
  f.type = type; f.Q.value = q;
  f.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + (o.attack || 0.005));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(outNode(o));
  s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
}
// 打撃の芯：ごく短い立ち上がりの低音。体に響く「ドン」
function thump(f0, f1, dur, vol, at = 0) { osc('sine', f0, f1, dur, vol, { attack: 0.002, at }); }
// 電気のはぜる音：短い雑音の粒をばらまく
function crackle(dur, vol, n = 6) { for (let i = 0; i < n; i++) hiss('highpass', 3000 + Math.random() * 4000, 2500, 1.5, 0.018, vol * (0.4 + Math.random() * 0.6), { at: Math.random() * dur }); }
// 重低音：沈んでいく低い正弦波に、倍音（歪み）を足して小さなスピーカーでも聞こえるようにする
function sub(f0, f1, dur, vol, at = 0) {
  osc('sine', f0, f1, dur, vol, { attack: 0.004, at });
  osc('sine', f0 * 2, f1 * 2, dur * 0.7, vol * 0.55, { attack: 0.004, at, dest: audio.shaper });
  osc('triangle', f0 * 3, f1 * 3, dur * 0.4, vol * 0.18, { attack: 0.003, at, dest: audio.shaper });
}
// 轟き：低い雑音が重なって、うねりながら遠ざかる
function rumble(dur, vol, f0 = 360, at = 0) {
  hiss('lowpass', f0, 45, 0.8, dur, vol, { attack: 0.05, at });
  for (let i = 1; i <= 3; i++) hiss('lowpass', f0 * 0.7, 50, 0.9, dur * (0.5 + i * 0.15), vol * 0.5, { attack: 0.1 * i, at: at + i * dur * 0.18 });
}
// 空を割る直撃音：鋭い破裂、急降下する空気の裂け目、はぜる雷の粒、そして重い轟き
function skyCrack(v, at = 0) {
  hiss('lowpass', 1800, 900, 0.65, 0.035, 0.2 * v, { attack: 0.0008, at, dest: audio.shaper });
  hiss('lowpass', 1300, 300, 0.7, 0.18, 0.16 * v, { attack: 0.001, at, dest: audio.shaper });
  hiss('bandpass', 1800, 300, 1.2, 0.5, 0.16 * v, { attack: 0.01, at: at + 0.03 });
  for (let i = 0; i < 4; i++) hiss('lowpass', 700 + Math.random() * 500, 300, 0.7, 0.025, 0.04 * v * (0.4 + Math.random() * 0.6), { at: at + 0.02 + Math.random() * 0.4 });
  sub(70, 26, 1.3, 0.6 * v, at + 0.01);
  rumble(2.6, 0.4 * v, 430, at + 0.07);
}
// ばらつき：同じ術でも毎回少し違う音になる（音程と長さ）
const vary = (x, k = 0.08) => x * (1 + (Math.random() * 2 - 1) * k);
// 倒される：体を保てなくなる。崩れ落ちる重低音、ほどける息、力が抜けて落ちていく音程、灰の降る気配
function defeatSound(v) {
  sub(vary(62, 0.08), 20, 2.2, 0.62 * v);
  hiss('lowpass', 2200, 90, 0.8, 1.4, 0.3 * v, { attack: 0.004 });
  osc('sine', vary(330, 0.08), 80, 1.6, 0.07 * v, { attack: 0.05, detune: 8 });
  osc('sine', vary(332, 0.08), 82, 1.6, 0.07 * v, { attack: 0.05, detune: -8 });
  darkChord(55, v, 2.2, 0.05);
  rumble(2.2, 0.2 * v, 260, 0.1);
  for (let i = 0; i < 3; i++) hiss('lowpass', 850 - i * 160, 250, 0.7, 0.07, 0.025 * v, { at: 0.35 + i * 0.15 });
}
// 暗い和音：短調の和音が低く沈む
function darkChord(root, v, dur = 1.1, at = 0) {
  [1, 1.189, 1.498, 2].forEach(m => osc('sawtooth', root * m, root * m * 1.004, dur, 0.02 * v, { attack: 0.14, at, dest: audio.dark }));
}
// 結晶・ガラスの響き：割り切れない比の部分音が重なり、高いものほど速く消える（固体・砕ける音だけに使う）
const GLASS = [1, 2.76, 5.4, 8.93];
function chime(f, v, dur = 1.4, o = {}) { v *= 2.4; GLASS.forEach((m, i) => osc('sine', f * m, f * m * 0.998, dur / (1 + i * 0.9), v / (1 + i * 1.4), { attack: 0.0008 + i * 0.0006, at: o.at || 0, dest: o.dest })); }
const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
// 原理ごとの詠唱の響きの根音（Hz）
const ROOT = { motion: 220, bind: 164.8, divide: 146.8, convert: 130.8, grow: 196, phase: 185 };

// ─── 音の焼き込み ───
// 主な効果音（射出・光線・命中・被弾・魔素を拾う音）は、波形を一度だけ計算して素材にする。
// 鳴らすたびに発振器を何十個も組まないので、音が濁らず軽い。素材は原理ごとに3通り作り、再生速度のゆらぎと合わせて毎回少し違う音にする
const baked = new Map();
function noiseOf(seed) { let s = (Math.imul(seed | 0, 2654435761) >>> 0) || 1; return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2147483648 - 1; }
// 状態変数フィルタ：毎サンプル周波数を動かしても発散しない。mode 0 低域・1 帯域・2 高域
function svf() {
  let s1 = 0, s2 = 0, lf = -1, lq = -1, g = 0, k = 1, h = 1;
  return (x, fc, q, sr, mode = 0) => {
    // 係数は周波数が0.3%以上動いたときだけ計算しなおす（tan が重いので）
    if (Math.abs(fc - lf) > lf * 0.003 || q !== lq) { lf = fc; lq = q; g = Math.tan(Math.PI * Math.max(20, Math.min(fc, sr * 0.45)) / sr); k = 1 / q; h = 1 / (1 + g * (g + k)); }
    const v1 = (s1 + g * (x - s2)) * h, v2 = s2 + g * v1;
    s1 = 2 * v1 - s1; s2 = 2 * v2 - s2;
    return mode === 0 ? v2 : mode === 1 ? v1 : x - k * v1 - v2;
  };
}
// 焼き込み：大きさは「いちばん大きい50msの実効値」でそろえ（耳に聞こえる大きさが素材ごとにばらつかない）、頂点は0.92まで。尾は20msで閉じる
function bake(key, dur, render) {
  if (baked.has(key)) return baked.get(key);
  // 素材は 24kHz で作る（12kHz までの高域で足り、計算は半分ほどで済む）。再生時にブラウザが変換する
  const sr = Math.min(audio.ctx.sampleRate, 24000), n = Math.max(2, Math.ceil(sr * dur)), buf = audio.ctx.createBuffer(1, n, sr), out = buf.getChannelData(0);
  render(out, sr, n);
  const win = Math.max(1, Math.floor(sr * 0.05));
  let peak = 0, best = 0, acc = 0;
  for (let i = 0; i < n; i++) {
    if (!Number.isFinite(out[i])) out[i] = 0;
    const v = out[i];
    peak = Math.max(peak, Math.abs(v)); acc += v * v;
    if (i >= win) acc -= out[i - win] * out[i - win];
    if (acc > best) best = acc;
  }
  const k = Math.min(0.25 / (Math.sqrt(best / win) || 1e-6), 0.92 / (peak || 1)), fade = Math.min(n - 1, Math.floor(sr * 0.02));
  for (let i = 0; i < n; i++) out[i] *= k * (i > n - fade ? (n - i) / fade : 1);
  baked.set(key, buf);
  return buf;
}
function playBaked(buf, v, rate = 1, at = 0, dest) {
  if (v < 0.003) return;
  const a = audio.ctx, s = a.createBufferSource(), g = a.createGain();
  s.buffer = buf; s.playbackRate.value = rate; g.gain.value = v;
  s.connect(g); g.connect(dest || audio.out || audio.bus);
  s.onended = () => { s.disconnect(); g.disconnect(); };
  s.start(a.currentTime + at);
}
const pick3 = () => Math.floor(Math.random() * 3);
// 音の部品（焼き込み用）：毎サンプル呼ぶと次の値を返す。exp や pow を毎回計算しないので速い
//   ev：a 秒で立ち上がり、時定数 d 秒で消える包絡
//   glide：from から to へ、時定数 d 秒で寄っていく値（音程やフィルタの動き）
//   ph：周波数 f の正弦の位相を進める
function ev(sr, a, d) { const na = Math.max(1, Math.round(a * sr)), k = Math.exp(-1 / (d * sr)); let i = 0, e = 1; return () => i < na ? ++i / na : (e *= k); }
function glide(sr, from, to, d) { const k = Math.exp(-1 / (d * sr)); let e = 1; return () => to + (from - to) * (e *= k); }
// 圧の声色：ノイズで違いを作らず、立ち上がり・音程の曲がり・倍音・脈動で六原理を分ける
const PRESSURE = {
  motion:  { root: 155, bend: 2.8, attack: 0.003, decay: 0.065, overtone: 0.22, fm: 0.18, pulse: 0,    tail: 0.09 },
  bind:    { root: 92,  bend: 1.35,attack: 0.009, decay: 0.15,  overtone: 0.12, fm: 0.06, pulse: 0,    tail: 0.2 },
  divide:  { root: 235, bend: 2.1, attack: 0.002, decay: 0.04,  overtone: 0.28, fm: 0.32, pulse: 0,    tail: 0.055 },
  convert: { root: 118, bend: 0.5, attack: 0.022, decay: 0.11,  overtone: 0.18, fm: 0.24, pulse: 0,    tail: 0.13 },
  grow:    { root: 138, bend: 1.2, attack: 0.028, decay: 0.13,  overtone: 0.14, fm: 0.08, pulse: 0.07, tail: 0.18 },
  phase:   { root: 178, bend: 1.6, attack: 0.01,  decay: 0.09,  overtone: 0.16, fm: 0.45, pulse: 0.04, tail: 0.14 }
};
// 短い一撃・重い一撃・二段の脈動。直前と同じ素材を連続で選ばない
const soundLast = new Map();
function pickSound(key) {
  const last = soundLast.get(key), choices = [0, 1, 2].filter(k => k !== last);
  const k = choices[Math.floor(Math.random() * choices.length)]; soundLast.set(key, k); return k;
}
// エネルギーの共通素材：低中域の圧、短い芯、減衰する倍音。風の持続ノイズは重ねない
function pressureBuffer(stage, a, k) {
  const P = PRESSURE[a] || PRESSURE.motion, beam = stage === 'beam', hit = stage === 'hit' || stage === 'blast', heavy = stage === 'blast';
  const weight = [0.78, 1.12, 0.94][k], dur = (beam ? 0.82 : heavy ? 1.05 : 0.48) + P.tail * weight;
  return bake(`${stage}:${a}:${k}`, dur, (out, sr, n) => {
    const w0 = TAU / sr, fo = svf(), mass = svf(), nz = noiseOf(71 + k * 37 + a.length);
    const root = P.root * (beam ? 0.72 : hit ? 0.8 : 1) * [1.08, 0.86, 1][k];
    const decay = (beam ? 0.2 : heavy ? 0.2 : P.decay) * weight;
    const eB = ev(sr, P.attack, decay), eS = ev(sr, 0.006, heavy ? 0.32 : beam ? 0.22 : 0.11);
    const eT = ev(sr, 0.007, P.tail * weight), eC = ev(sr, 0.002, hit ? 0.009 : 0.012), eN = ev(sr, 0.005, heavy ? 0.2 : 0.025);
    const fp = glide(sr, root * P.bend * [1.15, 0.85, 1][k], root, hit ? 0.012 : beam ? 0.055 : 0.025);
    const fs = glide(sr, heavy ? 105 : 115, heavy ? 42 : 52, 0.035), fm = glide(sr, P.fm, 0, 0.07);
    const delay = Math.round((P.pulse || (k === 2 ? 0.045 : 0)) * sr), eP = ev(sr, 0.008, decay * 0.7);
    let ph = 0, ps = 0, pt = 0;
    for (let i = 0; i < n; i++) {
      ph += w0 * fp(); ps += w0 * fs(); pt += w0 * root * 2;
      const core = Math.sin(ph + fm() * Math.sin(ph * 2)) + P.overtone * Math.sin(ph * 2);
      const pulse = delay && i >= delay ? Math.sin(ph * 1.5) * eP() * (k === 2 ? 0.4 : 0.22) : 0;
      const bloom = Math.sin(pt) * eT() * (beam ? 0.18 : 0.1);
      const snap = Math.sin(w0 * (hit ? 720 : 560) * i) * eC() * (a === 'divide' ? 0.32 : 0.16);
      const texture = mass(nz(), heavy ? 180 : 420, 0.65, sr) * eN() * (heavy ? 0.5 : 0.08);
      out[i] = Math.tanh(fo(core * eB() * 0.8 + (Math.sin(ps) + 0.16 * Math.sin(ps * 2)) * eS() * 0.7 + pulse + bloom + snap + texture, 2800, 0.65, sr) * 0.9);
    }
  });
}
function castBuffer(a, k) { return pressureBuffer('cast', a, k); }
// 固体を放つ：重い射出の圧と刃の金属共振。高い部分音ほど早く消す
function solidCastBuffer(k) {
  return bake(`scast:${k}`, 0.5, (out, sr, n) => {
    const nz = noiseOf(77 + k * 31), f1 = svf(), f2 = svf(), fo = svf(), w0 = TAU / sr;
    const eT = ev(sr, 0.002, 0.06), eS = ev(sr, 0.002, [0.09, 0.13, 0.075][k]), eK = ev(sr, 0.0001, 0.003), fp = glide(sr, 160, 70, 0.02);
    const q2 = w0 * [740, 960, 1120][k], q3 = q2 * 2.76, sw = Math.PI / (0.34 * sr);
    let p1 = 0, p2 = 0, p3 = 0;
    for (let i = 0; i < n; i++) {
      const w = nz(), arc = i * sw < Math.PI ? Math.sin(i * sw) : 0;
      const swish = f1(w, 450 + 850 * arc, 0.7, sr, 1) * arc * Math.sqrt(arc) * 0.22;
      p1 += w0 * fp();
      p2 += q2; p3 += q3;
      const shing = (Math.sin(p2) + 0.22 * Math.sin(p3)) * eS() * 0.3;
      out[i] = Math.tanh(fo(swish + Math.sin(p1) * eT() * 0.7 + shing + f2(w, 1600, 0.65, sr, 1) * eK() * 0.1, 3200, 0.7, sr) * 1.2);
    }
  });
}
// 壁：低い二つの圧が合わさって定着する。三種類で広がる時間と重さが違う
function wardBuffer(k) {
  return bake(`ward:${k}`, [0.65, 0.85, 0.72][k], (out, sr, n) => {
    const fo = svf(), w0 = TAU / sr, eB = ev(sr, [0.012, 0.025, 0.018][k], [0.1, 0.18, 0.13][k]);
    const eR = ev(sr, 0.018, 0.12), fp = glide(sr, [180, 130, 210][k], [78, 62, 92][k], 0.045);
    const delay = Math.round([0.055, 0.085, 0.035][k] * sr);
    const eLow = ev(sr, 0.008, 0.17);
    let ph = 0, ps = 0, pl = 0;
    for (let i = 0; i < n; i++) {
      ph += w0 * fp(); ps += w0 * 116; pl += w0 * 52;
      const settle = i >= delay ? Math.sin(ps) * eR() * 0.4 : 0;
      out[i] = Math.tanh(fo((Math.sin(ph) + 0.12 * Math.sin(ph * 2)) * eB() + settle + Math.sin(pl) * eLow() * 0.38, 1800, 0.65, sr));
    }
  });
}
// 光線：立ち上がりの圧裂、太い低音、伸びる倍音の芯。持続するノイズを使わず力の流れを作る
function beamBuffer(a, k) {
  const P = PRESSURE[a] || PRESSURE.divide;
  return bake(`beam:${a}:${k}`, [1.05, 1.2, 1.12][k] + P.tail, (out, sr, n) => {
    const w0 = TAU / sr, fo = svf(), root = P.root * 0.85 * [1.08, 0.9, 1][k];
    const eBurst = ev(sr, 0.002, 0.038), eLow = ev(sr, 0.005, [0.22, 0.29, 0.25][k]);
    const fp = glide(sr, root * 1.9, root, 0.055), fs = glide(sr, 115, 43, 0.045), fb = glide(sr, 740, 170, 0.018);
    const cut = glide(sr, 3200, 1500, 0.17), index = glide(sr, 0.65 + P.fm, 0.18, 0.18);
    const attack = Math.round(0.01 * sr), hold = Math.round([0.19, 0.27, 0.23][k] * sr), kd = Math.exp(-1 / (0.17 * sr));
    let ph = 0, ps = 0, pb = 0, env = 0;
    for (let i = 0; i < n; i++) {
      ph += w0 * fp(); ps += w0 * fs(); pb += w0 * fb();
      env = i < attack ? i / attack : i < hold ? 1 : env * kd;
      const drive = Math.sin(ph + index() * Math.sin(ph * 2)) + 0.3 * Math.sin(ph * 2) + 0.14 * Math.sin(ph * 3);
      const flow = 0.92 + 0.08 * Math.sin(w0 * (a === 'phase' ? 11 : 5) * i);
      const burst = (Math.sin(pb) + 0.25 * Math.sin(pb * 2)) * eBurst() * 0.65;
      const low = (Math.sin(ps) + 0.18 * Math.sin(ps * 2)) * eLow() * 0.95;
      out[i] = Math.tanh(fo(drive * env * flow * 0.66 + low + burst, cut(), 0.65, sr) * 0.95);
    }
  });
}
// 命中は短い芯、炸裂は低い余韻
function hitBuffer(a, heavy, k) { return pressureBuffer(heavy ? 'blast' : 'hit', a, k); }
// 固体が当たる：鈍い打撃、金属と石の短い鳴り（不協和の部分音）、飛び散る破片の粒
function solidHitBuffer(heavy, k) {
  return bake(`shit:${heavy ? 1 : 0}:${k}`, heavy ? 1.1 : 0.6, (out, sr, n) => {
    const nz = noiseOf(211 + k * 29 + (heavy ? 3 : 0)), tr = noiseOf(5 + k), f1 = svf(), f2 = svf(), f3 = svf(), fo = svf(), w0 = TAU / sr;
    const base = [390, 470, 580][k], q = [1, 2.76, 5.4].map(m => w0 * base * m), ph = [0, 0, 0];
    const eC = ev(sr, 0.0001, 0.004), eT = ev(sr, 0.002, heavy ? 0.14 : 0.07), eD = ev(sr, 0.02, heavy ? 0.35 : 0.16), eR = ev(sr, 0.02, 0.5), fp = glide(sr, 116, 55, 0.02);
    const eM = [0, 1, 2].map(j => ev(sr, 0.001, (heavy ? 0.3 : 0.16) / (1 + j)));
    let pb = 0;
    for (let i = 0; i < n; i++) {
      const w = nz();
      pb += w0 * fp();
      let clank = 0;
      for (let j = 0; j < 3; j++) { ph[j] += q[j]; clank += Math.sin(ph[j]) * eM[j]() / (1 + j * 2.5); }
      const g = tr() > 0.993 ? (tr() > 0 ? 5 : -5) : 0;
      const x = f1(w, 1400, 0.65, sr, 1) * eC() * 0.15 + Math.sin(pb) * eT() * 0.9 + clank * 0.4 + f2(g, 850, 0.7, sr, 1) * eD() * 0.12 + (heavy ? f3(w, 260, 0.7, sr) * eR() * 2 : 0);
      out[i] = Math.tanh(fo(x, 3000, 0.65, sr) * 1.05);
    }
  });
}
// 被弾：鈍くこもった「ドッ」。高い音は鳴らさない
function hurtBuffer(k) {
  return bake(`hurt:${k}`, 0.45, (out, sr, n) => {
    const nz = noiseOf(41 + k * 7), f1 = svf(), fo = svf(), w0 = TAU / sr, base = 105 * (1 + (k - 1) * 0.06);
    const eB = ev(sr, 0.002, 0.12), eN = ev(sr, 0.002, 0.1), eS = ev(sr, 0.004, 0.2), fp = glide(sr, base * 1.6, base, 0.02);
    let pb = 0, ps = 0;
    for (let i = 0; i < n; i++) {
      pb += w0 * fp(); ps += w0 * 48;
      out[i] = Math.tanh(fo(Math.sin(pb) * eB() + f1(nz(), 380, 0.7, sr) * eN() * 1.6 + Math.sin(ps) * eS() * 0.6, 2400, 0.7, sr) * 1.2);
    }
  });
}
// 魔素を拾う：澄んだ小さな一音（拾い続けると五音音階で上がっていく）。柔らかい立ち上がりで、耳に刺さらない
function glintBuffer() {
  return bake('glint', 0.42, (out, sr, n) => {
    const nz = noiseOf(9), f = svf(), w0 = TAU / sr, e1 = ev(sr, 0.002, 0.1), e2 = ev(sr, 0.0015, 0.04), e3 = ev(sr, 0.001, 0.018);
    for (let i = 0; i < n; i++) {
      const b = e2();
      out[i] = Math.sin(w0 * 880 * i) * e1() + Math.sin(w0 * 1761 * i) * 0.28 * b + Math.sin(w0 * 2640 * i) * 0.08 * b + f(nz(), 1800, 0.65, sr, 1) * e3() * 0.02;
    }
  });
}
// 飛翔音（ループ）：エネルギーは低い唸りと揺らぐ空気、固体は回る刃の風切り。
// 1秒の素材の終わりを先頭へ重ねてつなぐので、継ぎ目で途切れない（音程は整数Hzで周期がそろう）
function flightBuffer(material) {
  const key = 'fly:' + material;
  if (baked.has(key)) return baked.get(key);
  const a = audio.ctx, sr = a.sampleRate, n = sr, m = Math.floor(sr * 0.12), tmp = new Float32Array(n + m);
  const nz = noiseOf(material.length * 19 + 3), f1 = svf(), f2 = svf(), metal = material === 'metal', orb = material === 'orb';
  for (let i = 0; i < n + m; i++) {
    const t = i / sr, w = nz();
    if (metal) {
      const spin = 0.5 + 0.5 * Math.sin(TAU * 7 * t);
      tmp[i] = f1(w, 400 + 500 * spin, 0.7, sr, 1) * (0.35 + 0.65 * spin * spin) * 0.2 + Math.sin(TAU * 96 * t) * 0.12;
    } else {
      const f0 = orb ? 82 : 123, wob = 1 + 0.25 * Math.sin(TAU * (orb ? 3 : 5) * t);
      tmp[i] = (Math.sin(TAU * f0 * t) * 0.5 + Math.sin(TAU * f0 * 2 * t) * 0.22 + Math.sin(TAU * f0 * 3 * t) * 0.08) * wob + f2(w, orb ? 350 : 600, 0.65, sr, 1) * 0.035;
    }
  }
  const buf = a.createBuffer(1, n, sr), out = buf.getChannelData(0);
  let peak = 0;
  for (let i = 0; i < n; i++) { const x = i < m ? tmp[i] * (i / m) + tmp[n + i] * (1 - i / m) : tmp[i]; out[i] = x; peak = Math.max(peak, Math.abs(x)); }
  for (let i = 0; i < n; i++) out[i] = Math.tanh(out[i] / (peak || 1) * 1.1) * 0.8;
  baked.set(key, buf);
  return buf;
}
// 素材の取り出し（確認画面とテストから使う）：flight はループ、それ以外は同じ材質の焼き込み素材
function textureBuffer(material, stage) {
  if (stage === 'flight') return flightBuffer(material);
  if (stage === 'ward') return wardBuffer(1);
  const metal = material === 'metal';
  if (stage === 'beam') return beamBuffer(material === 'orb' ? 'bind' : 'divide', 1);
  if (stage === 'impact') return metal ? solidHitBuffer(false, 1) : hitBuffer(material === 'orb' ? 'bind' : 'motion', false, 1);
  return metal ? solidCastBuffer(1) : castBuffer(material === 'orb' ? 'bind' : 'motion', 1);
}
function materialOf(r) { return r.matter === 'solid' || r.matter === 'perfect' ? 'metal' : r.shape === 'orb' || r.form === 'ring' ? 'orb' : 'arc'; }
function playTexture(material, stage, v, rate = 1, delay = 0) { playBaked(textureBuffer(material, stage), v, rate, delay); }
// 術の音：質（固体／エネルギー）と1段目の主な原理で素材を選ぶ。副原理は余韻の高さを少し動かす
function materialSound(r, v, impact = false, heavy = v > 0.8) {
  const solid = materialOf(r) === 'metal', a = r.a || 'motion', tilt = r.b && ROOT[r.b] ? 0.97 + (ROOT[r.b] / (ROOT[a] || 180)) * 0.03 : 1;
  if (impact) playBaked(solid ? solidHitBuffer(heavy, pickSound('solidHit')) : hitBuffer(a, heavy, pickSound('hit:' + a)), v * (heavy ? 0.85 : 0.6), vary(tilt, 0.04));
  else playBaked(solid ? solidCastBuffer(pickSound('solidCast')) : castBuffer(a, pickSound('cast:' + a)), v * 0.62, vary(tilt, 0.035));
}
// 最初の一発で計算が詰まらないように、音を出せるようになったら1フレームに1つずつ素材を作っておく
const warmList = [];
function queueWarm() {
  warmList.length = 0;
  for (const a of D.principleOrder) for (let k = 0; k < 3; k++) warmList.push(() => castBuffer(a, k), () => hitBuffer(a, false, k));
  for (let k = 0; k < 3; k++) warmList.push(() => solidCastBuffer(k), () => solidHitBuffer(false, k), () => solidHitBuffer(true, k), () => hurtBuffer(k));
  for (const a of D.principleOrder) for (let k = 0; k < 3; k++) warmList.push(() => beamBuffer(a, k), () => hitBuffer(a, true, k));
  for (let k = 0; k < 3; k++) warmList.push(() => wardBuffer(k));
  warmList.push(glintBuffer, () => flightBuffer('orb'), () => flightBuffer('arc'), () => flightBuffer('metal'));
}
function warmAudio() { if (audio.ctx && warmList.length) warmList.shift()(); }
function stopFlightVoice(s, voice) {
  const t = audio.ctx.currentTime;
  voice.gain.gain.cancelScheduledValues(t);
  voice.gain.gain.setTargetAtTime(0, t, 0.015);
  voice.source.stop(t + 0.08);
  flightVoices.delete(s);
}
function stopFlightAudio() { for (const [s, voice] of flightVoices) stopFlightVoice(s, voice); }
const flightVoices = new Map();
// 弾そのものに持続音を割り当てる。近い三発に限定し、位置・速度だけを滑らかに更新。
function flightAudio() {
  if (!audio.ctx) return;
  if (!profile.sfx || !profile.sfxVol || audio.ctx.state !== 'running' || mode !== 'play' || document.hidden || (forge.open && world.room.practice)) { stopFlightAudio(); return; }
  const now = audio.ctx.currentTime;
  const shots = world.spells.filter(s => !s.done && s.state === 'fly' && ['proj', 'lob'].includes(s.kind) && hyp(s.x - cam.x, s.y - cam.y) < 650)
    .sort((a, b) => hyp(a.x - cam.x, a.y - cam.y) - hyp(b.x - cam.x, b.y - cam.y)).slice(0, LOW ? 2 : 3);
  for (const [s, voice] of flightVoices) if (!shots.includes(s)) stopFlightVoice(s, voice);
  for (const s of shots) {
    let voice = flightVoices.get(s);
    if (!voice) {
      const source = audio.ctx.createBufferSource(), gain = audio.ctx.createGain();
      const pan = audio.ctx.createStereoPanner ? audio.ctx.createStereoPanner() : audio.ctx.createGain();
      source.buffer = textureBuffer(materialOf(s), 'flight'); source.loop = true;
      gain.gain.value = 0; source.connect(gain); gain.connect(pan); pan.connect(audio.bus);
      source.onended = () => { source.disconnect(); gain.disconnect(); pan.disconnect(); };
      source.start(audio.ctx.currentTime, Math.random() * 0.9); voice = { source, gain, pan }; flightVoices.set(s, voice);
    }
    const d = Math.max(1, hyp(s.x - cam.x, s.y - cam.y));
    const approach = -((s.x - cam.x) * s.vx + (s.y - cam.y) * s.vy) / d;
    voice.source.playbackRate.setTargetAtTime(Math.max(0.72, Math.min(1.35, 1 + approach / 3200)), now, 0.06);
    voice.gain.gain.setTargetAtTime((1 - d / 650) ** 2 * 0.08, now, 0.035);
    if (voice.pan.pan) voice.pan.pan.setTargetAtTime(Math.max(-1, Math.min(1, (s.x - cam.x) / 480)), now, 0.035);
  }
}
// 画面の中の位置 x から左右の定位を作り、その間に鳴らす音をそこへ置く
function withPan(x, play) {
  if (!audio.ctx || !audio.ctx.createStereoPanner || !profile.sfx || audio.ctx.state !== 'running') { play(); return; }
  const p = audio.ctx.createStereoPanner();
  p.pan.value = Math.max(-0.85, Math.min(0.85, (x - cam.x) * cam.z / (vw / 2) * 0.85));
  p.connect(audio.bus);
  audio.out = p;
  try { play(); } finally { audio.out = null; }
}
function sfxAt(name, vol, arg, x) { if (vol > 0.01) withPan(x, () => sfx(name, vol, arg)); }
function sfx(name, vol = 1, arg) {
  if (!audio.ctx || !profile.sfx || audio.ctx.state !== 'running') return;
  const now = audio.ctx.currentTime;
  const gap = { cast: 0.04, hit: 0.035, pickup: 0.045, hurt: 0.07, thud: 0.08, absorb: 0.06, reflect: 0.06, blast: 0.07, shatter: 0.06, defeat: 0.3, clang: 0.05, pierce: 0.05, strip: 0.06, beam: 0.05 }[name] || 0;
  if (gap && now - (audio.last[name] || 0) < gap) return;
  audio.last[name] = now;
  const v = vol;
  const recipe = d => typeof arg === 'object' && arg ? arg : { a: arg || d };
  switch (name) {
    case 'cast': materialSound(recipe('motion'), v); break;
    case 'beam': { const r = recipe('divide'); playBaked(beamBuffer(PRESSURE[r.a] ? r.a : 'divide', pickSound('beam:' + r.a)), v * 0.72, vary(1, 0.03)); break; }
    case 'hit': materialSound(recipe('motion'), v * 0.8, true, false); break;
    case 'blast': materialSound(recipe('motion'), v, true, true); break;
    // 被弾：鈍い。低い「ドッ」と、こもった息の詰まる音。高い音は鳴らさない（毎回少し違う）
    case 'hurt': playBaked(hurtBuffer(pick3()), 0.62 * v, vary(1, 0.06)); break;
    case 'thud': thump(85, 38, 0.35, 0.18 * v); break;
    case 'ward': playBaked(wardBuffer(pickSound('ward')), 0.62 * v, vary(1, 0.025)); break;
    case 'shatter': playBaked(solidHitBuffer(true, pickSound('shatter')), 0.42 * v, vary(0.85, 0.035)); break;
    case 'absorb': playBaked(castBuffer('convert', pickSound('absorb')), 0.28 * v, 1.15); break;
    // 固体どうしがぶつかる金属音（不協和な倍音）
    case 'clang': playBaked(solidHitBuffer(false, pickSound('clang')), 0.4 * v, vary(1.25, 0.035)); break;
    // エネルギーが固体を貫く：短く抜ける芯
    case 'pierce': playBaked(castBuffer('divide', pickSound('pierce')), 0.32 * v, vary(1.3, 0.035)); break;
    // 固体がエネルギーの膜を剥がす：短く沈む圧
    case 'strip': playBaked(hitBuffer('phase', false, pickSound('strip')), 0.4 * v, vary(0.85, 0.035)); break;
    // 遠雷：長く低いうなり
    case 'thunder': rumble(3.2, 0.3 * v, 420); sub(50, 24, 2.2, 0.36 * v, 0.1); break;
    case 'reflect': playBaked(castBuffer('phase', pickSound('reflect')), 0.32 * v, 1.1); break;
    case 'buff': playBaked(castBuffer('grow', pickSound('buff')), 0.35 * v); break;
    case 'misfire': osc('sawtooth', 180, 40, 0.5, 0.16, { dest: audio.shaper }); hiss('lowpass', 1500, 200, 0.8, 0.6, 0.3); thump(90, 30, 0.6, 0.4); crackle(0.5, 0.08, 8); break;
    case 'sever': playBaked(hitBuffer('divide', false, pickSound('sever')), 0.25 * v, 1.25); break;
    case 'detonate': osc('triangle', 220, 90, 0.08, 0.1); osc('sine', 1100, 1100, 0.05, 0.035, { at: 0.06 }); break;
    case 'recall': [12, 7, 0].forEach((n, i) => osc('sine', 660 * Math.pow(2, n / 12), 660 * Math.pow(2, n / 12), 0.35, 0.04, { at: i * 0.06 })); break;
    case 'dodge': playBaked(castBuffer('motion', pickSound('dodge')), 0.22 * v, 1.2); break;
    case 'select': osc('sine', 1100 + (arg || 0) * 150, 1100 + (arg || 0) * 150, 0.07, 0.03); osc('sine', 2200 + (arg || 0) * 300, 2200, 0.04, 0.012); break;
    case 'kill': sub(64, 24, 1.1, 0.46 * v); hiss('lowpass', 1600, 80, 0.8, 0.8, 0.2 * v, { attack: 0.004 }); break;
    // 魔素を拾う：小さな澄んだ一音。続けて拾うと五音音階で上がる
    case 'pickup': { const n = PENTA[Math.min(PENTA.length - 1, Math.floor((arg || 0) / 2))] - 5; playBaked(glintBuffer(), 0.3 * v, Math.pow(2, n / 12) * vary(1, 0.006)); break; }
    case 'level': playBaked(castBuffer('grow', pickSound('level')), 0.42 * v, 0.85); break;
    case 'surge': hiss('bandpass', 300, 1400, 0.8, 0.8, 0.12 * v, { attack: 0.3 }); thump(70, 35, 0.8, 0.22 * v, 0.3); break;
    case 'defeat': defeatSound(v); break;
    case 'down': hiss('lowpass', 700, 100, 0.6, 0.8, 0.1); thump(65, 25, 0.5, 0.2); break;
    // 落雷：予告の和音が上がり、白い雷が落ち、遠くへ轟く
    case 'strikeWarn': [0, 7, 12].forEach((n, i) => osc('sine', 880 * Math.pow(2, n / 12), 892 * Math.pow(2, n / 12), 0.5, 0.04 * v, { at: i * 0.18, attack: 0.02 }));  break;
    case 'strike': skyCrack(1.1 * v); break;
    // 演算の間：低い唸りの上を、機械の音が降りていく
    case 'bossCall': osc('sawtooth', 55, 40, 2.6, 0.1, { attack: 0.6, dest: audio.shaper }); sub(48, 22, 2.4, 0.5); darkChord(55, 1.4, 2.4); [0, 3, 6, 10, 13].forEach((n, i) => osc('square', 1320 * Math.pow(2, -n / 12), 1300 * Math.pow(2, -n / 12), 0.09, 0.03, { at: 0.3 + i * 0.07 })); hiss('lowpass', 500, 180, 0.7, 1.2, 0.025, { attack: 0.4 }); break;
    case 'bossLearn': [0, 4, 7].forEach((n, i) => osc('sine', 330 * Math.pow(2, n / 12), 300 * Math.pow(2, n / 12), 0.09, 0.025 * v, { at: i * 0.07, attack: 0.006 })); break;
    case 'bossDecoy': playBaked(hitBuffer('phase', true, pickSound('bossDecoy')), 0.42 * v, 0.8); break;
    case 'join': [0, 7, 12].forEach((n, i) => osc('sine', 392 * Math.pow(2, n / 12), 392 * Math.pow(2, n / 12), 0.9, 0.04, { at: i * 0.08, attack: 0.02 })); playBaked(castBuffer('bind', pickSound('join')), 0.22, 0.8); thump(90, 40, 0.6, 0.28, 0.6); break;
  }
}
// 詠唱の音：力が溜まっていく。柔らかい波形を、少しずつ開くフィルタに通して音程をせり上げ、放つ瞬間に止まる
function chantPad(id, a, dur, vol) {
  if (!audio.ctx || !profile.sfx || audio.ctx.state !== 'running' || dur < 0.2) return;
  const recipe = typeof a === 'object' ? a : { a };
  const ac = audio.ctx, t = ac.currentTime, root = (ROOT[recipe.a] || 196) / 2, end = t + dur;
  const out = ac.createGain();
  out.gain.setValueAtTime(0.0001, t);
  out.gain.exponentialRampToValueAtTime(0.075 * vol, end);
  out.gain.exponentialRampToValueAtTime(0.0001, end + 0.1);
  const lp = ac.createBiquadFilter();
  lp.type = 'lowpass'; lp.Q.value = 0.65;
  lp.frequency.setValueAtTime(220, t); lp.frequency.exponentialRampToValueAtTime(1400, end);
  lp.connect(out); out.connect(audio.out || audio.bus);
  const interval = ROOT[recipe.b] ? ROOT[recipe.b] / (root * 2) * 1.5 : 1.5;
  for (const [m, det, type] of [[1, -6, 'triangle'], [interval, 6, 'sine'], [0.5, 0, 'sine'], [2, 4, 'sine']]) {
    const o = ac.createOscillator();
    o.type = type; o.detune.value = det;
    o.frequency.setValueAtTime(root * m, t); o.frequency.exponentialRampToValueAtTime(root * m * 1.4, end);
    o.connect(lp);
    o.start(t); o.stop(end + 0.15);
  }

}

// 音楽：2つの audio を交差フェードで切り替える。前回と同じ曲は避けて、毎回ちがう曲で始まる
const BGM = {
  lobby: ['assets/bgm/waiting.mp3', 'assets/bgm/opening.mp3'],
  play: ['assets/bgm/battle.mp3', 'assets/bgm/battle-2.mp3', 'assets/bgm/battle-3.mp3', 'assets/bgm/battle-4.mp3',
    'assets/bgm/battle-5.mp3', 'assets/bgm/battle-6.mp3', 'assets/bgm/battle-7.mp3', 'assets/bgm/battle-8.mp3', 'assets/bgm/battle-9.mp3', 'assets/bgm/battle-10.mp3']
};
const bgmEls = [$('bgm'), document.createElement('audio')];
const bgm = { cur: 0, set: null, src: '' };
for (const el of bgmEls) {
  el.preload = 'none'; el.volume = 0;
  el.addEventListener('ended', () => { if (el === bgmEls[bgm.cur] && bgm.set) startTrack(bgm.set); });
}
// 散った後・術式台を開いている間は少し下げる
function bgmTarget() { return Math.min(1, 0.45 * profile.bgmVol * (mode === 'dead' ? 0.55 : 1) * (forge.open ? 0.6 : 1)); }
function pickTrack(set) {
  const list = BGM[set], rest = list.filter(s => s !== profile.lastTrack && s !== bgm.src);
  const pool = rest.length ? rest : list;
  return pool[Math.floor(Math.random() * pool.length)];
}
function startTrack(set) {
  const src = pickTrack(set);
  profile.lastTrack = src; saveProfile();
  bgm.cur ^= 1;
  const el = bgmEls[bgm.cur];
  el.src = src; el.volume = 0; el.loop = false;
  bgm.set = set; bgm.src = src;
  const p = el.play();
  if (p && p.catch) p.catch(() => { /* 自動再生が止められたら次の操作で */ });
}
function playBgm() {
  if (!audio.ctx) return;
  if (!profile.bgm) { for (const el of bgmEls) el.pause(); bgm.set = null; return; }
  const want = mode === 'lobby' ? 'lobby' : 'play';
  if (bgm.set !== want) startTrack(want);
  else if (bgmEls[bgm.cur].paused) { const p = bgmEls[bgm.cur].play(); if (p && p.catch) p.catch(() => {}); }
}
function nextTrack() {
  if (!audio.ctx || !profile.bgm) return;
  startTrack(bgm.set || (mode === 'lobby' ? 'lobby' : 'play'));
  toast(L('曲を変えた'), '');
}
function updateBgm(dt) {
  const cur = bgmEls[bgm.cur], old = bgmEls[bgm.cur ^ 1], want = bgm.set ? bgmTarget() : 0;
  // 2秒ほどでなめらかに寄せる。古い曲は3秒ほどで消える
  if (!cur.paused) cur.volume = Math.max(0, Math.min(1, cur.volume + Math.max(-dt * 0.5, Math.min(dt * 0.5, want - cur.volume))));
  if (!old.paused) { old.volume = Math.max(0, old.volume - dt * 0.33); if (old.volume <= 0.002) old.pause(); }
  // 曲の終わりの3秒前から次の曲へ重ねる
  if (bgm.set && !cur.paused && cur.duration > 10 && cur.currentTime > cur.duration - 3) startTrack(bgm.set);
}
function toggleSfx() { profile.sfx = !profile.sfx; saveProfile(); syncSoundButtons(); }
function toggleBgm() { profile.bgm = !profile.bgm; saveProfile(); syncSoundButtons(); playBgm(); }

// 詠唱文：段ごとの原理と器から作る（例：「解けよ・風を裂き・触れて・結び、固まれ・満ちよ」）。大魔法陣の外輪を巡る文字にだけ使う
function chantWords(r) {
  const C = D.chant, out = [];
  r.stages.forEach((st, i) => {
    const look = S.lookOf(r, i);
    if (i) out.push(C.then[r.stages[i - 1].then]);
    out.push(C.a[look.a], look.b !== 'none' ? C.b[look.b] : '', C.vessel[st.vessel]);
  });
  return out.filter(Boolean);
}
// 声：いちばん人の声に近い日本語の声を選ぶ（ニューラル音声を優先）。設定で選んだ声があればそれを使う
const voice = { lastSpell: 0, jp: null };
const voiceId = v => v.voiceURI || v.name;
function jaVoices() {
  const sy = window.speechSynthesis;
  // いまの言語の声だけを候補にする
  return sy && sy.getVoices ? sy.getVoices().filter(v => String(v.lang).toLowerCase().startsWith(LANG)) : [];
}
const voiceScore = v => (/natural|neural/i.test(v.name) ? 8 : 0) + (/online/i.test(v.name) ? 4 : 0) + (/google/i.test(v.name) ? 3 : 0) + (/nanami|keita|kyoko|otoya|haruka/i.test(v.name) ? 2 : 0) + (v.localService ? 0 : 1);
function pickVoice() {
  const list = jaVoices();
  if (!list.length) return null;
  voice.jp = (profile.voiceURI && list.find(v => voiceId(v) === profile.voiceURI)) || list.slice().sort((x, y) => voiceScore(y) - voiceScore(x))[0];
  return voice.jp;
}
if (window.speechSynthesis && window.speechSynthesis.addEventListener) window.speechSynthesis.addEventListener('voiceschanged', () => { voice.jp = null; pickVoice(); if (!$('settings').hidden) syncSettings(); });
// kind：spell（技名）・win（勝利宣言）・death（断末魔）・foe（相手の勝利宣言）・test（設定で試す）
function speak(text, kind = 'spell') {
  const sy = window.speechSynthesis, U = window.SpeechSynthesisUtterance;
  if (!sy || !U || !text) return;
  if (kind !== 'test' && (profile.voiceMode === 'off' || (profile.voiceMode === 'name' && kind !== 'spell'))) return;
  const now = clock;
  // 技名どうしは重ねない（0.7秒あける）。叫びは割り込む
  if (kind === 'spell' && voice.lastSpell && now - voice.lastSpell < 0.7) return;
  sy.cancel();
  if (kind === 'spell') voice.lastSpell = now;
  const u = new U(String(text).slice(0, 60));
  u.lang = LOCALE;
  const v = voice.jp || pickVoice();
  if (v) u.voice = v;
  // 人の声らしさ：高さと速さは自然な値の近くに置き、毎回すこしだけ揺らす（極端に変えると機械っぽくなる）
  const [rate, pitch] = { spell: [1.06, 1.02], win: [1.02, 1.06], death: [0.9, 0.95], foe: [1.0, 0.92], test: [1.04, 1.02] }[kind] || [1, 1];
  u.rate = rate + (Math.random() - 0.5) * 0.06;
  u.pitch = pitch + (Math.random() - 0.5) * 0.08;
  u.volume = 1;
  sy.speak(u);
}
const pendingSpeech = [];
function speakLater(text, kind, delay) { pendingSpeech.push({ text, kind, t: delay }); }
function updateSpeech(dt) {
  for (let i = pendingSpeech.length - 1; i >= 0; i--) { const p = pendingSpeech[i]; p.t -= dt; if (p.t <= 0) { pendingSpeech.splice(i, 1); speak(p.text, p.kind); } }
}
// 声：なし → 技名だけ → 技名と叫び、の順に切り替える
const VOICE_MODES = ['off', 'name', 'all'];
const VOICE_LABEL = { off: L('声なし'), name: L('技名だけ'), all: L('技名と叫び') };
function setVoiceMode(m) {
  profile.voiceMode = m; profile.voice = m !== 'off'; saveProfile(); syncSoundButtons();
  if (m === 'off' && window.speechSynthesis) window.speechSynthesis.cancel();
  if (!$('settings').hidden) syncSettings();
}
function toggleVoice() { const m = VOICE_MODES[(VOICE_MODES.indexOf(profile.voiceMode) + 1) % 3]; setVoiceMode(m); if (mode === 'play') toast(L('声：{0}', VOICE_LABEL[m]), ''); }

// ═══ 08. 世界の描画（儀式場・術者・術式・結界・糸） ═════════════
// 戦場は一つの大きな魔法陣。外周にルーンの帯、内側に六原理の六芒星と節点がある
const NODE_R = 0.6;   // 六原理の節点を置く半径（結界に対する割合）
function draw() {
  const z = cam.z;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.fillStyle = FLOOR;
  ctx.fillRect(0, 0, vw, vh);
  const toWorld = () => ctx.setTransform(dpr * z, 0, 0, dpr * z, dpr * (vw / 2 - (cam.x + cam.sx) * z), dpr * (vh / 2 - (cam.y + cam.sy) * z));
  toWorld();
  const L = cam.x - vw / 2 / z - 60, T = cam.y - vh / 2 / z - 60, Rt = cam.x + vw / 2 / z + 60, B = cam.y + vh / 2 / z + 60;
  const inView = (x, y, r) => x + r > L && x - r < Rt && y + r > T && y - r < B;

  // 石畳と陣
  ctx.fillStyle = floorPat;
  ctx.fillRect(L, T, Rt - L, B - T);
  drawArena(inView);
  // 手ほどきでは、壁を置く地点か課題の人形の足元を明示する
  if (tutor.on && tutor.i < 6) {
    const target = world.units.find(u => u.dummy && u.alive);
    const x = tutor.i === 1 ? 170 : target?.x, y = tutor.i === 1 ? 0 : target?.y;
    if (x !== undefined) {
      ctx.save(); ctx.strokeStyle = hex('blue'); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, 25 + Math.sin(world.t * 4) * 3, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - 35, y); ctx.lineTo(x + 35, y); ctx.moveTo(x, y - 35); ctx.lineTo(x, y + 35); ctx.stroke(); ctx.restore();
    }
  }

  // 術の光が床を照らす
  updateTrails();
  if (!LOW) { drawLights(inView); drawReflections(inView); }
  // 床の跡：焦げ（暗く）・亀裂 → 焼きついた紋（光る）
  for (const d of decals) if (d.kind === 'scorch' && inView(d.x, d.y, d.r * 1.4)) drawScorch(d);
  for (const d of decals) if (d.kind === 'crack' && inView(d.x, d.y, d.r * 1.6)) drawCrack(d);
  ctx.globalCompositeOperation = 'lighter';
  for (const d of decals) if (d.kind === 'sigil' && inView(d.x, d.y, d.r * 1.6)) drawSigil(d);
  ctx.globalCompositeOperation = 'source-over';

  // 床を這う闇の靄（軽い画質では省く）
  if (!LOW) drawFog(L, T, Rt, B);
  for (const s of world.springs) if (inView(s.x, s.y, 260)) drawSpring(s);
  for (const s of world.strikes) if (inView(s.x, s.y, s.r + 40)) drawStrikeWarn(s);
  // 領域（残留・吸魔・結界・周回）は床に描く
  for (const zo of world.zones) if (inView(zo.x, zo.y, zo.zr + 40)) drawZone(zo);
  drawMotes(inView);
  for (const k of world.rocks) if (inView(k.x, k.y, k.r + 20)) drawRock(k);
  // 結界は奥（上）から順に描く（面の壁が手前の壁に重なる）
  const seer = S.hero(world), seen = o => S.visibleSpell(seer, o);
  for (const g of world.wards.filter(g => g.hp > 0 && seen(g) && inView(g.x, g.y, g.r + (g.len || 0) / 2 + 60)).sort((a, b) => a.y - b.y)) drawWard(g);
  // 罠（待機中の術式）と投射の着地点
  for (const s of world.spells) if (!s.done && seen(s) && (s.state === 'wait' || s.kind === 'lob') && inView(s.x, s.y, s.radius + 40)) drawTrap(s);
  // 囮（散魔の光・鏡界の像）
  for (const d of world.decoys) if (inView(d.x, d.y, 80)) drawDecoy(d);

  // 術者は奥（上）から順に描く
  const top = world.ranking[0];
  const vis = world.units.filter(u => u.alive && S.visibleTo(S.hero(world), u) && inView(u.x, u.y - u.r * 2, u.r * 4));
  vis.sort((a, b) => a.y - b.y);
  // 詠唱の大魔法陣は術者の足元（術者より先に描く）
  for (const c of castCircles) drawCastCircle(c);
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  // 周回の城壁のうち、術者より奥（上）にあるものは術者より先に描く
  for (const s of world.spells) if (!s.done && s.kind === 'orbiter' && s.shape === 'castle' && seen(s) && inView(s.x, s.y, 80)) { const o = S.unitById(world, s.owner); if (o && s.y < o.y) drawOrbiter(s); }
  for (const u of vis) drawMage(u, u === top);

  // 糸（④）：術者の杖と、糸でつながった術式を結ぶ
  drawThreads(inView);
  // 爆発の煙（暗く重ねる）
  drawSmoke(inView);

  // 飛ぶ術式と火花は光として足し合わせる
  ctx.globalCompositeOperation = 'lighter';
  for (const s of world.spells) if (!s.done && s.state === 'fly' && s.kind === 'proj' && seen(s) && inView(s.x, s.y, 60)) drawFlyer(s);
  for (const s of world.spells) if (!s.done && s.state === 'fly' && s.kind === 'lob' && seen(s) && inView(s.x, s.y, 200)) drawLob(s);
  for (const s of world.spells) if (!s.done && s.kind === 'orbiter' && seen(s) && inView(s.x, s.y, 80)) { if (s.shape === 'castle') { const o = S.unitById(world, s.owner); if (o && s.y < o.y) continue; } drawOrbiter(s); }
  for (const p of parts) if (inView(p.x, p.y, (p.r1 || p.r || 10) + 20) || p.x2 !== undefined) drawPart(p);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  // 色調：冷たく沈んだ色に寄せる（闇の世界。光だけがあとでにじむ）
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (!LOW) {
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = GRADE;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = 'source-over';
  }
  // 光のにじみ：ここまでに描いた明るい光だけを拾ってぼかし、上から足す（名前や吹き出しはにじませない）
  drawBloom();
  toWorld();

  for (const u of vis) drawLabel(u);
  for (const t of texts) drawText(t);
  drawEdge(L, T, Rt, B);
  for (const b of bubbles) if (inView(b.x, b.y, 200)) drawBubble(b);

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawScreenOverlay();
}
const GRADE = 'rgb(204,207,228)';
// 闇の靄：格子ごとに決まった場所に大きな暗い靄を置き、ゆっくり流す。冷たい薄明かりを少しだけ混ぜる
function drawFog(L, T, Rt, B) {
  const t = world.t, cell = 760;
  ctx.save();
  for (let gx = Math.floor(L / cell) - 1; gx <= Math.floor(Rt / cell) + 1; gx++) {
    for (let gy = Math.floor(T / cell) - 1; gy <= Math.floor(B / cell) + 1; gy++) {
      const h = Math.sin(gx * 12.9898 + gy * 78.233) * 43758.5453, f = h - Math.floor(h), f2 = (f * 7.13) % 1;
      const x = gx * cell + f * cell * 0.7 + Math.sin(t * 0.05 + f * 20) * 200, y = gy * cell + f2 * cell * 0.7 + Math.cos(t * 0.04 + f2 * 20) * 160;
      const size = cell * (0.8 + f * 0.7);
      ctx.globalAlpha = 0.55;
      ctx.drawImage(smokeTile, x - size, y - size * 0.6, size * 2, size * 1.2);
      if (f2 < 0.35) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.045 + Math.sin(t * 0.3 + f * 9) * 0.012;
        ctx.drawImage(glow('#3e5596'), x - size * 0.8, y - size * 0.4, size * 1.6, size * 0.8);
        ctx.globalCompositeOperation = 'source-over';
      }
    }
  }
  ctx.restore();
}
// 灰：画面の手前を静かに舞い落ちる灰と、ときどき赤く光る燃えさし
const ash = Array.from({ length: 46 }, () => ({ x: Math.random(), y: Math.random(), vx: 0, vy: 0, s: 0.6 + Math.random() * 1.6, ember: Math.random() < 0.07, ph: Math.random() * 9 }));
let ashCam = null;
function updateAsh(dt) {
  const dx = ashCam ? (cam.x - ashCam.x) * cam.z : 0, dy = ashCam ? (cam.y - ashCam.y) * cam.z : 0;
  ashCam = { x: cam.x, y: cam.y };
  for (const a of ash) {
    // 手前の灰ほど速く流れる（奥行き）
    const k = a.s / 2.4;
    a.x += ((-8 + Math.sin(clock * 0.4 + a.ph) * 14) * dt * k - dx * (0.4 + k * 0.5)) / Math.max(1, vw);
    a.y += ((22 + a.s * 10) * dt - dy * (0.4 + k * 0.5)) / Math.max(1, vh);
    a.x -= Math.floor(a.x); a.y -= Math.floor(a.y);
  }
}
function drawAsh() {
  for (const a of ash) {
    const x = a.x * vw, y = a.y * vh;
    if (a.ember) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.22 + Math.sin(clock * 2 + a.ph) * 0.14;
      ctx.drawImage(glow('#ff7a4a'), x - a.s * 3, y - a.s * 3, a.s * 6, a.s * 6);
      ctx.globalCompositeOperation = 'source-over';
    } else {
      ctx.globalAlpha = 0.14 + a.s * 0.06;
      ctx.fillStyle = '#8a8798';
      ctx.fillRect(x, y, a.s, a.s);
    }
  }
  ctx.globalAlpha = 1;
}
// 遠雷：ときどき空が冷たく光り、少し遅れて低く鳴る
const thunder = { t: 12, rumble: -1 };
function updateThunder(dt) {
  if (mode !== 'play' || REDUCED) return;
  thunder.t -= dt;
  if (thunder.t <= 0) { thunder.t = rnd(16, 34); flashScreen('#aebcff', rnd(0.04, 0.08)); thunder.rumble = rnd(0.5, 1.4); }
  if (thunder.rumble > 0) { thunder.rumble -= dt; if (thunder.rumble <= 0) sfx('thunder', rnd(0.5, 1)); }
}
// 光のにじみ（ブルーム）：縮めた画面の暗い所を落とし、明るい所だけをぼかして重ねる
const bloomCv = document.createElement('canvas'), bctx = bloomCv.getContext('2d');
const BLOOM_OK = !!bctx && typeof bctx.filter === 'string';
function drawBloom() {
  if (!profile.bloom || !BLOOM_OK || LOW) return;
  const w = Math.max(2, Math.round(vw / 4)), h = Math.max(2, Math.round(vh / 4));
  if (bloomCv.width !== w || bloomCv.height !== h) { bloomCv.width = w; bloomCv.height = h; }
  bctx.globalCompositeOperation = 'copy';
  bctx.filter = 'brightness(1.05) contrast(2.8) saturate(1.35) blur(2.5px)';
  bctx.drawImage(canvas, 0, 0, w, h);
  bctx.filter = 'none';
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.42;
  ctx.drawImage(bloomCv, 0, 0, canvas.width, canvas.height);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}
function drawSmoke(inView) {
  for (const m of smokes) {
    const f = m.t / m.life, s = m.r * (1 + f * 1.6);
    if (!inView(m.x, m.y, s)) continue;
    ctx.globalAlpha = (f < 0.15 ? f / 0.15 : 1 - (f - 0.15) / 0.85) * 0.75;
    ctx.drawImage(smokeTile, m.x - s, m.y - s, s * 2, s * 2);
  }
  ctx.globalAlpha = 1;
}
// 床に刻まれた儀式場の陣。刻まれた線は黒い溝に象嵌の古い金が細く光るだけで、動かない。
// 動くのは魔素の光（節点・要の陣の輪・立ちのぼる粒）だけ
const INLAY = '#c4a066';
function carve(w, a, path) {
  ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineWidth = w + 2.2; path(); ctx.stroke();
  ctx.strokeStyle = rgba(INLAY, Math.min(1, a * 1.5)); ctx.lineWidth = w; path(); ctx.stroke();
}
const circlePath = (x, y, r) => () => { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); };
function drawArena(inView) {
  const R = world.R, t = world.t;
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const nodes = D.principleOrder.map((k, i) => { const a = -Math.PI / 2 + i * TAU / 6; return { k, x: Math.cos(a) * R * NODE_R, y: Math.sin(a) * R * NODE_R }; });
  // 放射の筋：中心から外周の帯へ、二十四本
  carve(0.8, 0.08, () => { ctx.beginPath(); for (let i = 0; i < 24; i++) { const a = i / 24 * TAU + TAU / 48, c = Math.cos(a), s = Math.sin(a); ctx.moveTo(c * (W.center.r + 70), s * (W.center.r + 70)); ctx.lineTo(c * (R - 130), s * (R - 130)); } });
  // 同心の輪：内輪・節点の輪（二重）・外輪
  carve(1, 0.16, circlePath(0, 0, R * NODE_R * 0.5));
  carve(1.4, 0.2, circlePath(0, 0, R * NODE_R - 7)); carve(0.8, 0.14, circlePath(0, 0, R * NODE_R + 7));
  carve(1, 0.13, circlePath(0, 0, R * 0.82));
  // 六芒星：二つの三角形を二重の線で
  for (const sc of [1, 0.975]) carve(sc === 1 ? 1.4 : 0.8, sc === 1 ? 0.2 : 0.12, () => {
    ctx.beginPath();
    for (const s of [0, 1]) { for (let i = 0; i < 3; i++) { const n = nodes[s + i * 2]; i ? ctx.lineTo(n.x * sc, n.y * sc) : ctx.moveTo(n.x * sc, n.y * sc); } ctx.closePath(); }
  });
  // 目盛りの輪：一度ごとの細かな刻み、五度ごとの刻み、三十度ごとの長い刻みと菱
  const tr = R - 128;
  ctx.strokeStyle = rgba(INLAY, 0.22); ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i < 360; i++) {
    const a = i / 360 * TAU, x = Math.cos(a) * tr, y = Math.sin(a) * tr;
    if (!inView(x, y, 40)) continue;
    const len = i % 30 === 0 ? 30 : i % 5 === 0 ? 14 : 6, c = Math.cos(a), s = Math.sin(a);
    ctx.moveTo(c * tr, s * tr); ctx.lineTo(c * (tr - len), s * (tr - len));
  }
  ctx.stroke();
  carve(1, 0.2, circlePath(0, 0, tr));
  ctx.fillStyle = rgba(INLAY, 0.35);
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * TAU, x = Math.cos(a) * (tr - 44), y = Math.sin(a) * (tr - 44);
    if (!inView(x, y, 20)) continue;
    ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(0, -4); ctx.lineTo(-8, 0); ctx.lineTo(0, 4); ctx.closePath(); ctx.fill(); ctx.restore();
  }
  // 外周のルーンの帯（刻まれて動かない）と、二重の縁
  const band = R - 76, step = 58, n = Math.floor(TAU * band / step);
  ctx.strokeStyle = rgba(INLAY, 0.3); ctx.lineWidth = 1.8;
  for (let i = 0; i < n; i++) {
    const a = i / n * TAU, x = Math.cos(a) * band, y = Math.sin(a) * band;
    if (!inView(x, y, 30)) continue;
    ctx.save(); ctx.translate(x, y); ctx.rotate(a + Math.PI / 2); drawRune(ctx, i, 11); ctx.restore();
  }
  carve(1.6, 0.28, circlePath(0, 0, R - 44)); carve(0.8, 0.18, circlePath(0, 0, R - 108));
  // 立ちのぼる魔素：石の隙間から、淡い光の粒がゆっくり昇って消える（場所は決まっている）
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < (LOW ? 14 : 36); i++) {
    const a = i * 2.399963 + 1.1, d = Math.sqrt((i + 0.7) / 36) * (R - 200), x = Math.cos(a) * d, y = Math.sin(a) * d;
    if (!inView(x, y, 90)) continue;
    const ph = (t * 0.09 + i * 0.37) % 1, s = 2.2 + (i % 3);
    ctx.globalAlpha = Math.sin(ph * Math.PI) * 0.32;
    ctx.drawImage(glow('#b9c8ff'), x + Math.sin(ph * 5 + i) * 8 - s * 3, y - ph * 70 - s * 3, s * 6, s * 6);
  }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  if (inView(0, 0, 260)) {
    // 要の陣：刻まれた二重の輪とルーン。中に立つと制御容量が増える（境は魔素の光でゆっくり巡る）
    carve(1, 0.24, circlePath(0, 0, 200)); carve(0.8, 0.18, circlePath(0, 0, 160));
    ctx.strokeStyle = rgba(INLAY, 0.26); ctx.lineWidth = 1.4; runeRing(ctx, 180, 24, 8);
    const me0 = world.units.find(u => u.id === world.heroId && u.alive), inC = me0 && me0.center;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = rgba(BONE, inC ? 0.55 : 0.16); ctx.lineWidth = inC ? 2 : 1;
    ctx.setLineDash([2, 10]); ctx.lineDashOffset = t * 14;
    ctx.beginPath(); ctx.arc(0, 0, W.center.r, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    if (inC) { ctx.globalAlpha = 0.18; ctx.drawImage(glow('#d8c08a'), -W.center.r * 1.4, -W.center.r * 1.4, W.center.r * 2.8, W.center.r * 2.8); }
    ctx.restore();
    if (me0 && hyp(me0.x, me0.y) < W.center.r + 260) {
      ctx.font = `600 13px 'Zen Old Mincho', serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = rgba(BONE, inC ? 0.85 : 0.35);
      ctx.fillText(L('要の陣 ― 制御容量 +{0}', W.center.capacity), 0, W.center.r + 18);
    }
  }
  const me = world.units.find(u => u.id === world.heroId && u.alive);
  for (const nd of nodes) {
    if (!inView(nd.x, nd.y, 320)) continue;
    const p = D.principles[nd.k], c = hex(p.ink);
    const idx = D.principleOrder.indexOf(nd.k), on = me && me.node === idx;
    ctx.save();
    ctx.translate(nd.x, nd.y);
    // 刻まれた節点の陣（動かない）
    carve(1.4, 0.3, circlePath(0, 0, 110)); carve(0.8, 0.2, circlePath(0, 0, 134)); carve(0.8, 0.16, circlePath(0, 0, 62));
    ctx.strokeStyle = rgba(INLAY, 0.3); ctx.lineWidth = 1.3; runeRing(ctx, 122, 16, 5, 3);
    // 魔素の湧く光：輪の中が原理の色でうすく満ちる
    if (!LOW) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = (on ? 0.32 : 0.12) + Math.sin(t * 1.1 + nd.x) * 0.03;
      ctx.drawImage(glow(p.ink), -230, -230, 460, 460);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
    // 効き目の境：この輪の中に立つと、この原理の術が強まる
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = rgba(c, on ? 0.75 : 0.22); ctx.lineWidth = on ? 2 : 1;
    ctx.setLineDash([2, 9]); ctx.lineDashOffset = -t * 16;
    ctx.beginPath(); ctx.arc(0, 0, W.node.r, 0, TAU); ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = rgba(c, on ? 0.6 : 0.3); ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(0, 0, 110, 0, TAU); ctx.stroke();
    ctx.restore();
    if (me && hyp(me.x - nd.x, me.y - nd.y) < W.node.r + 260) {
      ctx.font = `600 13px 'Zen Old Mincho', serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = rgba(c, on ? 0.9 : 0.45);
      ctx.fillText(L('{0}の節点 ― {0}の術が強まり、魔力が湧く', p.name), 0, W.node.r + 18);
    }
    nodeScene(nd.k, c, t);
    ctx.font = `900 78px 'Zen Old Mincho', serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillText(p.kanji, 1.5, 7.5);
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = rgba(c, on ? 0.5 : 0.28);
    ctx.fillText(p.kanji, 0, 6);
    ctx.restore();
  }
  ctx.restore();
}
// 六原理の節点の情景：原理ごとの癖が、輪の中の景色になる（細く静かに）
function nodeScene(k, c, t) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = rgba(c, 0.26); ctx.fillStyle = rgba(c, 0.4); ctx.lineWidth = 1.2;
  if (k === 'motion') {
    for (let i = 0; i < 3; i++) { ctx.save(); ctx.rotate(t * (0.5 + i * 0.2)); ctx.beginPath(); ctx.arc(0, 0, 74 + i * 12, 0, 1.2 + i * 0.3); ctx.stroke(); ctx.restore(); }
  } else if (k === 'bind') {
    for (const [rr, sp] of [[84, 0.06], [70, -0.09]]) { ctx.save(); ctx.rotate(t * sp); ctx.beginPath(); for (let i = 0; i <= 6; i++) { const a = i / 6 * TAU; i ? ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : ctx.moveTo(rr, 0); } ctx.stroke(); ctx.restore(); }
  } else if (k === 'divide') {
    let seed = 91;
    const rr = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    ctx.globalAlpha = 0.7 + Math.sin(t * 0.8) * 0.2;
    ctx.beginPath();
    for (let i = 0; i < 7; i++) { let a = i / 7 * TAU + rr() * 0.3, d = 66; ctx.moveTo(Math.cos(a) * d, Math.sin(a) * d); for (let j = 0; j < 2; j++) { a += (rr() - 0.5) * 0.4; d += 14 + rr() * 6; ctx.lineTo(Math.cos(a) * d, Math.sin(a) * d); } }
    ctx.stroke();
  } else if (k === 'convert') {
    for (let i = 0; i < 10; i++) { const d = 104 - ((t * 18 + i * 10.4) % 42), a = i * 2.4 + d * 0.03 + t * 0.2; ctx.globalAlpha = Math.min(1, (d - 62) / 12) * 0.7; ctx.beginPath(); ctx.arc(Math.cos(a) * d, Math.sin(a) * d, 1.6, 0, TAU); ctx.fill(); }
  } else if (k === 'grow') {
    for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + 0.2, ph = (t * 0.25 + i * 0.37) % 1, x = Math.cos(a) * 86, y = Math.sin(a) * 86; ctx.globalAlpha = Math.sin(ph * Math.PI) * 0.8; ctx.beginPath(); ctx.arc(x, y - ph * 16, 1.8, 0, TAU); ctx.fill(); }
  } else if (k === 'phase') {
    for (const [dx, col2] of [[-3, 'rgba(110,200,255,.22)'], [3, 'rgba(255,140,170,.22)']]) { ctx.strokeStyle = col2; ctx.beginPath(); ctx.arc(dx + Math.sin(t * 1.1) * 2, 0, 88, 0, TAU); ctx.stroke(); }
  }
  ctx.restore();
}
// 落雷の予告：輪が縮んでいき、閉じたところへ落ちる
function drawStrikeWarn(s) {
  const f = Math.min(1, s.t / s.delay), t = world.t;
  ctx.save(); ctx.translate(s.x, s.y); ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = `rgba(255,120,140,${0.3 + 0.55 * f})`; ctx.lineWidth = 2 + f * 2.5;
  ctx.setLineDash([10, 8]); ctx.lineDashOffset = -t * 40; ctx.beginPath(); ctx.arc(0, 0, s.r, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
  ctx.strokeStyle = `rgba(255,232,236,${0.2 + 0.7 * f})`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 0, s.r * (1 - f), 0, TAU); ctx.stroke();
  drawStar(ctx, 0, 0, s.r * 0.5 * f, '#ffd6dc', 0.35 + 0.5 * f);
  ctx.restore();
}
function drawScorch(d) {
  const f = d.t / d.life, a = f < 0.7 ? 1 : 1 - (f - 0.7) / 0.3;
  ctx.save();
  ctx.translate(d.x, d.y); ctx.rotate(d.rot);
  ctx.fillStyle = `rgba(0,0,0,${0.42 * a})`;
  ctx.beginPath();
  d.pts.forEach((p, i) => { const an = i / d.pts.length * TAU, r = d.r * p; i ? ctx.lineTo(Math.cos(an) * r, Math.sin(an) * r) : ctx.moveTo(Math.cos(an) * r, Math.sin(an) * r); });
  ctx.closePath(); ctx.fill();
  if (d.t < 0.8) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = rgba(hex(d.ink), 0.5 * (1 - d.t / 0.8)); ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.restore();
}
function drawSigil(d) {
  const f = d.t / d.life, c = hex(d.ink);
  const a = (f < 0.08 ? f / 0.08 : 1 - Math.pow((f - 0.08) / 0.92, 0.6)) * 0.8;
  const s = 1 + f * 0.25;
  ctx.save();
  ctx.translate(d.x, d.y); ctx.rotate(d.rot + d.t * 0.1); ctx.scale(s, s);
  ctx.globalAlpha = a;
  ctx.strokeStyle = c; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(0, 0, d.r, 0, TAU); ctx.stroke();
  ctx.setLineDash([2, 7]);
  ctx.beginPath(); ctx.arc(0, 0, d.r * 1.18, 0, TAU); ctx.stroke();
  ctx.setLineDash([]);
  ctx.lineWidth = 1.6;
  runeRing(ctx, d.r * 1.09, 10, d.r * 0.06, d.rune);
  drawCrest(ctx, d.crest, d.r * 0.7, rgba(c, 0.9));
  ctx.restore();
}
function drawSpring(s) {
  const t = world.t, pulse = Math.max(0, 1 - s.surge / 3);
  const c = hex('yellow');
  ctx.save();
  ctx.translate(s.x, s.y);
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.45 + pulse * 0.4 + Math.sin(t * 2) * 0.05;
  ctx.drawImage(glow('yellow'), -s.r * 2.6, -s.r * 2.6, s.r * 5.2, s.r * 5.2);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.rotate(t * 0.35);
  ctx.strokeStyle = rgba(c, 0.7); ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(0, 0, s.r, 0, TAU); ctx.stroke();
  ctx.strokeStyle = rgba(c, 0.55); ctx.lineWidth = 1.6;
  runeRing(ctx, s.r + 16, 12, 6);
  ctx.rotate(-t * 0.8);
  ctx.setLineDash([4, 12]);
  ctx.beginPath(); ctx.arc(0, 0, s.r + 34 + pulse * 20, 0, TAU); ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = rgba(c, 0.8); ctx.lineWidth = 2;
  for (const off of [0, Math.PI / 3]) {
    ctx.beginPath();
    for (let i = 0; i < 3; i++) { const a = off + i * TAU / 3; const x = Math.cos(a) * s.r * 0.55, y = Math.sin(a) * s.r * 0.55; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.closePath(); ctx.stroke();
  }
  ctx.restore();
}
// 魔素：漂う光の粒。魔力の粒（散魔）はひし形で区別する
function drawMotes(inView) {
  const tt = world.t;
  ctx.globalCompositeOperation = 'lighter';
  const cores = [];
  for (const m of world.motes) {
    if (!inView(m.x, m.y, 30)) continue;
    const fade = m.field ? 1 : Math.min(1, (m.life - m.age) / 4);
    const s = (3 + Math.min(8, m.v * 1.6)) * (0.8 + Math.sin(tt * 3 + m.x * 0.05) * 0.2);
    ctx.globalAlpha = 0.6 * fade;
    ctx.drawImage(moteGlow(m.ink), m.x - s * 2.6, m.y - s * 2.6, s * 5.2, s * 5.2);
    if (m.mana) {
      ctx.strokeStyle = rgba(hex('blue'), 0.9 * fade); ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(m.x, m.y - s); ctx.lineTo(m.x + s * 0.7, m.y); ctx.lineTo(m.x, m.y + s); ctx.lineTo(m.x - s * 0.7, m.y); ctx.closePath(); ctx.stroke();
    }
    cores.push(m.x, m.y, s * 0.32 * fade);
  }
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = '#fffaf0';
  ctx.beginPath();
  for (let i = 0; i < cores.length; i += 3) { ctx.moveTo(cores[i] + cores[i + 2], cores[i + 1]); ctx.arc(cores[i], cores[i + 1], cores[i + 2], 0, TAU); }
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}
function rockPath(k, ox = 0, oy = 0, sc = 1) {
  ctx.beginPath();
  k.pts.forEach((p, i) => {
    const a = k.rot + i / k.pts.length * TAU, r = k.r * p * sc;
    const x = k.x + ox + Math.cos(a) * r, y = k.y + oy + Math.sin(a) * r;
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  });
  ctx.closePath();
}
// 岩：黒曜石の柱。表面にうすく古い刻印が残る
function drawRock(k) {
  ctx.save();
  // 影は右下へ長く落ちる
  ctx.fillStyle = 'rgba(0,0,0,.55)';
  rockPath(k, k.r * 0.18, k.r * 0.24, 1.04); ctx.fill();
  // 側面：左上から光を受け、右下ほど沈む黒曜石
  let g = ctx.createLinearGradient(k.x - k.r, k.y - k.r, k.x + k.r, k.y + k.r);
  g.addColorStop(0, '#24222f'); g.addColorStop(0.55, '#121119'); g.addColorStop(1, '#07070b');
  ctx.fillStyle = g; rockPath(k); ctx.fill();
  // 上面：一段明るい平らな面
  g = ctx.createLinearGradient(k.x - k.r, k.y - k.r, k.x + k.r * 0.5, k.y + k.r * 0.5);
  g.addColorStop(0, '#2f2d3c'); g.addColorStop(1, '#17161f');
  ctx.fillStyle = g; rockPath(k, -k.r * 0.06, -k.r * 0.12, 0.74); ctx.fill();
  // 縁：上面の輪郭だけが光を拾う
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(170,182,226,.16)'; ctx.lineWidth = 1.2; rockPath(k, -k.r * 0.06, -k.r * 0.12, 0.74); ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.lineWidth = 1.5; rockPath(k); ctx.stroke();
  // 古い刻印：象嵌の金が、かすかに残る
  ctx.translate(k.x - k.r * 0.06, k.y - k.r * 0.12);
  ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineWidth = 3.5; drawRune(ctx, k.id, k.r * 0.24);
  ctx.strokeStyle = rgba(INLAY, 0.28); ctx.lineWidth = 1.4; drawRune(ctx, k.id, k.r * 0.24);
  ctx.restore();
}
// 場：円（結があれば弾を止める結界）と纏
function drawZone(z) {
  if (z.kind === 'body' ? !S.visibleTo(S.hero(world), S.unitById(world, z.owner)) : !S.visibleSpell(S.hero(world), z)) return;
  const t = world.t, c = z.col, f = Math.min(1, z.t / Math.max(0.01, z.life));
  const fade = f > 0.85 ? (1 - f) / 0.15 : 1;
  ctx.save();
  ctx.translate(z.x, z.y);
  if (z.barrier) {
    // 結界：六角の殻。固体の結界は黒い結晶の板で、エネルギーの結界は光の膜
    // 削られるほど膜がちらつき、ひびが走る
    const hpF = z.max > 0 ? Math.max(0, z.hp / z.max) : 1, flick = hpF < 0.5 ? 0.6 + Math.random() * 0.4 : 1;
    if (z.matter === 'solid') {
      ctx.globalAlpha = 0.5 * fade;
      ctx.fillStyle = 'rgba(14,11,20,.7)';
      ctx.beginPath(); for (let i = 0; i <= 6; i++) { const a2 = i / 6 * TAU; i ? ctx.lineTo(Math.cos(a2) * z.zr, Math.sin(a2) * z.zr) : ctx.moveTo(z.zr, 0); } ctx.fill();
    }
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.14 * fade * flick;
    ctx.drawImage(glow(c), -z.zr * 1.2, -z.zr * 1.2, z.zr * 2.4, z.zr * 2.4);
    if (hpF < 0.7) {
      // ひび：中心から縁へ走る折れ線（結界ごとに形が決まっている）
      ctx.globalAlpha = fade * (0.9 - hpF);
      ctx.strokeStyle = '#fffaf0'; ctx.lineWidth = 1.2;
      let seed = z.id * 97;
      const rr = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      ctx.beginPath();
      for (let i = 0; i < Math.round((1 - hpF) * 9); i++) { let a2 = rr() * TAU, d = z.zr * 0.2; ctx.moveTo(Math.cos(a2) * d, Math.sin(a2) * d); for (let k = 0; k < 3; k++) { a2 += (rr() - 0.5) * 0.8; d += z.zr * 0.25; ctx.lineTo(Math.cos(a2) * d, Math.sin(a2) * d); } }
      ctx.stroke();
    }
    ctx.globalAlpha = fade * flick;
    ctx.rotate(t * (z.barrier === 'counter' ? -1.4 : 0.4));
    const n = 6;
    for (const [w, a] of [[9, 0.14], [2, 0.85]]) {
      ctx.strokeStyle = rgba(c, a); ctx.lineWidth = w;
      if (z.barrier === 'counter') {
        for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(0, 0, z.zr, i * TAU / 4, i * TAU / 4 + 1.1); ctx.stroke(); }
      } else {
        ctx.beginPath();
        for (let i = 0; i <= n; i++) {
          const a2 = i / n * TAU, wob = z.barrier === 'shift' ? Math.sin(t * 6 + i) * 5 : 0;
          const x = Math.cos(a2) * (z.zr + wob), y = Math.sin(a2) * (z.zr + wob);
          i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.stroke();
      }
    }
    // 内側の逆回りの輪・縁を巡る光点・脈動する外殻。結界が二重の殻に見える
    ctx.rotate(-t * 0.9);
    ctx.strokeStyle = rgba(c, 0.45); ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let i = 0; i <= n; i++) { const a2 = i / n * TAU; i ? ctx.lineTo(Math.cos(a2) * z.zr * 0.8, Math.sin(a2) * z.zr * 0.8) : ctx.moveTo(z.zr * 0.8, 0); }
    ctx.stroke();
    runeRing(ctx, z.zr * 0.9, Math.max(6, Math.round(z.zr / 16)), 3.5, z.id);
    ctx.rotate(t * 0.9 + t * 1.6);
    for (let i = 0; i < 3; i++) {
      const a2 = i * TAU / 3, s = 22;
      ctx.globalAlpha = 0.9 * fade * flick; ctx.drawImage(glow(c), Math.cos(a2) * z.zr - s / 2, Math.sin(a2) * z.zr - s / 2, s, s);
      ctx.save(); ctx.translate(Math.cos(a2) * z.zr, Math.sin(a2) * z.zr); drawGem(ctx, 7, c, t + i, 6, t, z.id + i); ctx.restore();
    }
    ctx.restore();
    return;
  }
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = (z.kind === 'orbit' ? 0.1 : 0.16) * fade;
  ctx.drawImage(glow(c), -z.zr * 1.15, -z.zr * 1.15, z.zr * 2.3, z.zr * 2.3);
  ctx.globalAlpha = fade;
  ctx.globalCompositeOperation = 'source-over';
  // 結晶の格子：六つの宝石が縁を巡り、放射状の稜線が床に走る
  if (z.kind !== 'body' && z.kind !== 'orbit') {
    ctx.save(); ctx.rotate(t * 0.18);
    ctx.strokeStyle = rgba(c, 0.18 * fade); ctx.lineWidth = 1;
    ctx.beginPath(); for (let i = 0; i < 12; i++) { const a2 = i / 12 * TAU; ctx.moveTo(Math.cos(a2) * z.zr * 0.28, Math.sin(a2) * z.zr * 0.28); ctx.lineTo(Math.cos(a2) * z.zr * 0.97, Math.sin(a2) * z.zr * 0.97); } ctx.stroke();
    const gn = LOW ? 3 : 6, gs = Math.max(5, Math.min(14, z.zr * 0.09));
    for (let i = 0; i < gn; i++) { const a2 = i / gn * TAU; ctx.save(); ctx.translate(Math.cos(a2) * z.zr, Math.sin(a2) * z.zr); ctx.globalAlpha = 0.9 * fade; drawGem(ctx, gs, c, t * 0.8 + i, 6, t, z.id + i); ctx.restore(); }
    ctx.restore();
  }
  // 床から生える結晶の柱：開いた瞬間に伸び、残る間は脈打つ
  if (z.kind !== 'body' && z.kind !== 'orbit') {
    const grow = Math.min(1, z.t / 0.35), sp = LOW ? 5 : 11;
    for (let i = 0; i < sp; i++) {
      const fr = ((z.id * 7 + i * 13) % 10) / 10, a2 = i / sp * TAU + z.id, rr = z.zr * (0.5 + 0.42 * fr), h = z.zr * (0.13 + 0.12 * fr) * grow;
      if (h < 3) continue;
      ctx.save(); ctx.translate(Math.cos(a2) * rr, Math.sin(a2) * rr - h * 0.5); ctx.scale(0.5, 1); ctx.globalAlpha = 0.9 * fade;
      drawGem(ctx, h * 0.5, c, 0, 6, t, z.id + i); ctx.restore();
    }
  }
  ctx.rotate(t * (z.kind === 'siphon' || z.kind === 'well' ? 1.2 : 0.3));
  ctx.strokeStyle = rgba(c, 0.6); ctx.lineWidth = 1.6;
  ctx.setLineDash(z.kind === 'orbit' ? [6, 10] : [2, 6]);
  ctx.beginPath(); ctx.arc(0, 0, z.zr, 0, TAU); ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = rgba(c, 0.45); ctx.lineWidth = 1.4;
  if (z.kind !== 'orbit') runeRing(ctx, z.zr * 0.88, Math.max(8, Math.round(z.zr / 14)), 4.5, z.id);
  if (z.kind === 'siphon' || z.kind === 'well') {
    // 渦：中心へ魔素が流れ込む
    ctx.strokeStyle = rgba(c, 0.5); ctx.lineWidth = 1.6;
    for (let i = 0; i < 4; i++) { ctx.beginPath(); for (let k = 0; k <= 16; k++) { const f2 = k / 16, a = i * TAU / 4 + f2 * 2.4, r = z.zr * (1 - f2) * 0.9; k ? ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r) : ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.stroke(); }
  }
  ctx.restore();
}
// 面の結界：線分に沿って立つ一枚の壁。固体は石と結晶の積まれた壁（上面・前面・目地・影）、
// エネルギーは揺らぐ光の幕（六角の網目と昇る走査線）、完全はその両方に金の光が重なる
// 城壁：石を積んだ厚い壁。上に凸凹の狭間（胸壁）が並ぶ。x, y は足元の中心、ang は壁の向き、L は長さ、T は厚みの半分、H は高さ
// 前面は石の段と目地、上面は明るい石、狭間は手前と奥の両側に立つ。削れるほどひびが入る
function drawRampart(x, y, ang, L, T, H, col, f, id, alpha = 1) {
  const cs = Math.cos(ang), sn = Math.sin(ang);
  const P = (u, v, h = 0) => [x + u * cs - v * sn, y + u * sn + v * cs - h];
  // 手前（画面の下）を向いている側面
  const fv = cs >= 0 ? T : -T, bv = -fv;
  const poly = pts => { ctx.beginPath(); pts.forEach(([px, py], i) => i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)); ctx.closePath(); };
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.globalCompositeOperation = 'source-over';
  ctx.lineJoin = 'round';
  // 影
  ctx.fillStyle = 'rgba(0,0,0,.5)';
  poly([P(-L / 2, -T), P(L / 2, -T), P(L / 2, T), P(-L / 2, T)].map(([px, py]) => [px + 12, py + 10])); ctx.fill();
  const n = Math.max(3, Math.round(L / 13)), mh = Math.max(6, H * 0.22);
  const merlons = (v) => {
    for (let k = 0; k < n; k += 2) {
      const u0 = -L / 2 + k * L / n, u1 = u0 + L / n;
      const a = P(u0, v, H), b = P(u1, v, H), a2 = P(u0, v, H + mh), b2 = P(u1, v, H + mh);
      poly([a, b, b2, a2]); ctx.fillStyle = '#8b8477'; ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,.65)'; ctx.lineWidth = 1; ctx.stroke();
      // 狭間の上面
      const c1 = P(u0, v - Math.sign(v) * 3, H + mh), c2 = P(u1, v - Math.sign(v) * 3, H + mh);
      poly([a2, b2, c2, c1]); ctx.fillStyle = '#b3ac9d'; ctx.fill();
    }
  };
  // 奥の狭間 → 上面 → 前面 → 手前の狭間 の順に重ねる
  merlons(bv);
  poly([P(-L / 2, -T, H), P(L / 2, -T, H), P(L / 2, T, H), P(-L / 2, T, H)]);
  ctx.fillStyle = '#a19a8b'; ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineWidth = 1.2; ctx.stroke();
  // 手前を向いた端の面（縦に走る壁でも厚みが見える）
  const ue = sn >= 0 ? L / 2 : -L / 2;
  poly([P(ue, -T), P(ue, T), P(ue, T, H), P(ue, -T, H)]);
  ctx.fillStyle = '#4f4a42'; ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,.8)'; ctx.lineWidth = 1.4; ctx.stroke();
  const front = [P(-L / 2, fv), P(L / 2, fv), P(L / 2, fv, H), P(-L / 2, fv, H)];
  poly(front);
  const gr = ctx.createLinearGradient(0, y - H, 0, y);
  gr.addColorStop(0, '#8f887b'); gr.addColorStop(0.55, '#645e54'); gr.addColorStop(1, '#34302b');
  ctx.fillStyle = gr; ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,.8)'; ctx.lineWidth = 1.6; ctx.stroke();
  // 石の段（横の目地）と、段ごとにずれる縦の目地
  ctx.save(); poly(front); ctx.clip();
  ctx.strokeStyle = 'rgba(20,18,16,.55)'; ctx.lineWidth = 1;
  const rows = Math.max(3, Math.round(H / 9)), cols = Math.max(3, Math.round(L / 16));
  ctx.beginPath();
  for (let k = 1; k < rows; k++) { const h = H * k / rows, [ax, ay] = P(-L / 2, fv, h), [bx, by] = P(L / 2, fv, h); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); }
  for (let k = 0; k < rows; k++) for (let j = 0; j <= cols; j++) {
    const u = -L / 2 + (j + (k % 2) * 0.5) * L / cols; if (u > L / 2) continue;
    const [ax, ay] = P(u, fv, H * k / rows), [bx, by] = P(u, fv, H * (k + 1) / rows); ctx.moveTo(ax, ay); ctx.lineTo(bx, by);
  }
  ctx.stroke();
  // 上端の光と、下の苔むした影
  ctx.strokeStyle = 'rgba(255,248,230,.25)'; ctx.lineWidth = 1.2;
  const [tx0, ty0] = P(-L / 2, fv, H), [tx1, ty1] = P(L / 2, fv, H); ctx.beginPath(); ctx.moveTo(tx0, ty0 + 1.5); ctx.lineTo(tx1, ty1 + 1.5); ctx.stroke();
  // ひび：削れるほど増える
  if (f < 0.75) {
    let seed = id * 131; const rr = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    ctx.strokeStyle = 'rgba(10,8,8,.8)'; ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (let i = 0; i < Math.round((1 - f) * 7); i++) { let [cx, cy] = P((rr() - 0.5) * L, fv, H * (0.3 + rr() * 0.6)); ctx.moveTo(cx, cy); for (let k = 0; k < 3; k++) { cx += (rr() - 0.5) * 10; cy += rr() * 9; ctx.lineTo(cx, cy); } }
    ctx.stroke();
  }
  ctx.restore();
  merlons(fv);
  // 術者の紋の色の刻印が、前面の中ほどに細く光る
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = rgba(hex(col), 0.45); ctx.lineWidth = 1.2;
  const [m0x, m0y] = P(-L * 0.35, fv, H * 0.5), [m1x, m1y] = P(L * 0.35, fv, H * 0.5);
  ctx.beginPath(); ctx.moveTo(m0x, m0y); ctx.lineTo(m1x, m1y); ctx.stroke();
  ctx.restore();
}
function drawSlab(g) {
  const c = g.col, f = Math.max(0, g.hp / g.max), t = world.t, fade = Math.max(0.2, Math.min(1, (g.life - g.t) / 0.6));
  const dx = g.bx - g.ax, dy = g.by - g.ay, L = hyp(dx, dy) || 1, ang = Math.atan2(dy, dx);
  const H = g.low ? 6 : 46 + g.r;   // 壁の高さ（画面の上へ立ち上がる）
  ctx.save();
  ctx.globalAlpha = fade;
  ctx.translate(g.x, g.y);
  const cs = Math.cos(ang), sn = Math.sin(ang);
  // 足元の四隅（壁の厚み g.r）と、上面の四隅（H だけ上）
  const foot = [[-L / 2, -g.r], [L / 2, -g.r], [L / 2, g.r], [-L / 2, g.r]].map(([u, v]) => [u * cs - v * sn, u * sn + v * cs]);
  const poly = (pts, oy = 0) => { ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y - oy) : ctx.moveTo(x, y - oy)); ctx.closePath(); };
  const solid = g.matter !== 'energy', perfect = g.matter === 'perfect';
  if (solid && !g.low) {
    ctx.restore();
    drawRampart(g.x, g.y, ang, L, g.r, H, c, f, g.id, fade);
    if (!perfect) return;
    ctx.save(); ctx.globalAlpha = fade; ctx.translate(g.x, g.y);
  }
  if (solid && g.low) {
    // 影
    ctx.fillStyle = 'rgba(0,0,0,.5)'; poly(foot.map(([x, y]) => [x + 10, y + 12])); ctx.fill();
    // 前面：足元の手前の辺から上面の手前の辺まで
    const front = foot.slice().sort((a, b) => b[1] - a[1]).slice(0, 2).sort((a, b) => a[0] - b[0]);
    ctx.beginPath(); ctx.moveTo(front[0][0], front[0][1]); ctx.lineTo(front[1][0], front[1][1]); ctx.lineTo(front[1][0], front[1][1] - H); ctx.lineTo(front[0][0], front[0][1] - H); ctx.closePath();
    const gr = ctx.createLinearGradient(0, -H, 0, g.r);
    gr.addColorStop(0, g.low ? '#1a1620' : '#e2dccf'); gr.addColorStop(0.55, g.low ? '#141118' : '#9c948a'); gr.addColorStop(1, '#2b272c');
    ctx.fillStyle = gr; ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.8)'; ctx.lineWidth = 2; ctx.stroke();
    // 目地：石を積んだ横線と縦線
    if (!g.low) {
      ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.lineWidth = 1.2;
      const x0 = front[0][0], y0 = front[0][1], x1 = front[1][0], y1 = front[1][1];
      for (let k = 1; k < 4; k++) {
        const h = H * k / 4;
        ctx.beginPath(); ctx.moveTo(x0, y0 - h); ctx.lineTo(x1, y1 - h); ctx.stroke();
        for (let j = 0; j < 6; j++) { const q = (j + (k % 2) * 0.5 + 0.25) / 6; if (q > 1) continue; ctx.beginPath(); ctx.moveTo(x0 + (x1 - x0) * q, y0 + (y1 - y0) * q - h); ctx.lineTo(x0 + (x1 - x0) * q, y0 + (y1 - y0) * q - h + H / 4); ctx.stroke(); }
      }
    }
    // 上面：明るい石
    poly(foot, H);
    ctx.fillStyle = g.low ? '#141118' : '#f4f0e6'; ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.lineWidth = 1.5; ctx.stroke();
    // 紋の色の刻印が上面の縁を細く走る。削れるほどひびが入る
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = rgba(hex(c), 0.25 + 0.45 * f); ctx.lineWidth = 1.4; poly(foot, H); ctx.stroke();
    if (f < 0.7) {
      ctx.strokeStyle = 'rgba(255,250,240,.6)'; ctx.lineWidth = 1;
      let seed = g.id * 131; const rr = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      ctx.beginPath();
      for (let i = 0; i < Math.round((1 - f) * 8); i++) { let x = (rr() - 0.5) * L * cs, y = (rr() - 0.5) * L * sn - H * rr(); ctx.moveTo(x, y); for (let k = 0; k < 3; k++) { x += (rr() - 0.5) * 16; y += rr() * 12; ctx.lineTo(x, y); } }
      ctx.stroke();
    }
  }
  if (!solid || perfect) {
    // 封印を刻んだ透明な面。外縁は固定し、残りの強度は欠けと亀裂で示す。
    ctx.globalCompositeOperation = 'source-over';
    const col = perfect ? '#eae4f4' : hex(c);
    const ax = -L / 2 * cs, ay = -L / 2 * sn, bx = L / 2 * cs, by = L / 2 * sn, HH = H + 20;
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.lineTo(bx, by - HH); ctx.lineTo(ax, ay - HH); ctx.closePath();
    const gr = ctx.createLinearGradient(0, 0, 0, -HH);
    gr.addColorStop(0, rgba(col, 0.19)); gr.addColorStop(0.5, 'rgba(14,12,23,0.55)'); gr.addColorStop(1, rgba(col, 0.08));
    ctx.fillStyle = gr; ctx.fill(); ctx.save(); ctx.clip(); ctx.globalCompositeOperation = 'lighter';
    const count = Math.max(2, Math.ceil(L / 38));
    for (let i = 0; i < count; i++) {
      const q = (i + 0.5) / count, x = ax + (bx - ax) * q, y = ay + (by - ay) * q - HH * 0.5;
      ctx.strokeStyle = rgba(col, 0.28 + f * 0.3); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, y - 17); ctx.lineTo(x + 9, y); ctx.lineTo(x, y + 17); ctx.lineTo(x - 9, y); ctx.closePath(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - 5, y - 6); ctx.lineTo(x + 5, y + 6); ctx.moveTo(x, y - 10); ctx.lineTo(x, y + 10); ctx.stroke();
      if (f < (i + 1) / (count + 1)) { ctx.strokeStyle = 'rgba(239,233,250,.7)'; ctx.beginPath(); ctx.moveTo(x - 8, y - HH); ctx.lineTo(x + 3, y - 9); ctx.lineTo(x - 4, y + 5); ctx.lineTo(x + 12, y + HH); ctx.stroke(); }
    }
    ctx.restore(); ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = rgba(col, 0.65); ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.lineTo(bx, by - HH); ctx.lineTo(ax, ay - HH); ctx.closePath(); ctx.stroke();
    ctx.strokeStyle = 'rgba(240,235,248,.7)'; ctx.lineWidth = 0.8; ctx.stroke();
    // 光沢が面を横切り、走査光が昇る。上端と足元は強く光り、両端に光の柱が立つ（削れるとちらつく）
    const fl = f < 0.4 ? 0.6 + Math.random() * 0.4 : 1;
    ctx.save();
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.lineTo(bx, by - HH); ctx.lineTo(ax, ay - HH); ctx.closePath(); ctx.clip();
    const sh = (t * 0.45 + g.id * 0.37) % 1, sx = ax + (bx - ax) * sh, sy = ay + (by - ay) * sh;
    const sg = ctx.createLinearGradient(sx - cs * 30, sy - sn * 30, sx + cs * 30, sy + sn * 30);
    sg.addColorStop(0, rgba(col, 0)); sg.addColorStop(0.5, rgba(col, 0.38 * fl)); sg.addColorStop(1, rgba(col, 0));
    ctx.fillStyle = sg; ctx.fillRect(sx - 40, Math.min(sy, ay, by) - HH - 4, 80, HH + Math.abs(by - ay) + 8);
    for (let k = 0; k < 3; k++) {
      const h = ((t * 0.7 + k / 3 + g.id * 0.13) % 1) * HH;
      ctx.strokeStyle = rgba(col, (1 - h / HH) * 0.55 * fl); ctx.lineWidth = 1.3;
      ctx.beginPath(); ctx.moveTo(ax, ay - h); ctx.lineTo(bx, by - h); ctx.stroke();
    }
    ctx.restore();
    ctx.lineCap = 'round';
    ctx.strokeStyle = rgba(col, 0.2 * fl); ctx.lineWidth = 8;
    ctx.beginPath(); ctx.moveTo(ax, ay - HH); ctx.lineTo(bx, by - HH); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
    ctx.strokeStyle = rgba(col, 0.95 * fl); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(ax, ay - HH); ctx.lineTo(bx, by - HH); ctx.stroke();
    for (const [px, py] of [[ax, ay], [bx, by]]) {
      ctx.strokeStyle = rgba(col, 0.7 * fl); ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.moveTo(px, py + 3); ctx.lineTo(px, py - HH - 6); ctx.stroke();
      ctx.globalAlpha = fade * 0.5 * fl; ctx.drawImage(glow(c), px - 16, py - HH - 22, 32, 32);
      ctx.globalAlpha = fade;
    }
  }
  ctx.restore();
}
// 結界の柱：固化・物性編壁は結晶の柱、塹壕は低い溝、根絡・位相牢は棘と格子
function drawWard(g) {
  if (g.len) {
    drawSlab(g);
    // 壁の両端の結晶柱：柱頭の宝石が光る
    const gs = Math.max(6, Math.min(12, g.len * 0.06));
    ctx.save(); ctx.globalAlpha = Math.max(0.25, Math.min(1, (g.life - g.t) / 0.6));
    for (const [px, py, sd] of [[g.ax, g.ay, 0], [g.bx, g.by, 1]]) { ctx.save(); ctx.translate(px, py - gs * 1.4 + Math.sin(world.t * 2 + sd) * 1.5); drawGem(ctx, gs, g.col, world.t * 0.6 + sd, 6, world.t, g.id + sd); ctx.restore(); }
    ctx.restore();
    return;
  }
  const c = g.col, f = g.hp / g.max, t = world.t;
  const fade = Math.min(1, (g.life - g.t) / 0.6);
  ctx.save();
  ctx.translate(g.x, g.y);
  ctx.globalAlpha = Math.max(0.2, fade);
  if (g.low) {
    ctx.fillStyle = 'rgba(0,0,0,.55)';
    ctx.beginPath(); ctx.ellipse(0, 0, g.r * 1.2, g.r * 0.55, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = rgba(c, 0.6); ctx.lineWidth = 2; ctx.stroke();
    ctx.restore(); return;
  }
  if (g.matter === 'energy' && g.kind !== 'root' && g.kind !== 'prison') {
    // エネルギーの結界：光の柱。走査する光の帯が昇り、削られるほどちらつく
    const h = g.r * (g.kind === 'wall' ? 2.2 : 1.7), top = -h - g.r * 0.5, fl = f < 0.5 ? 0.55 + Math.random() * 0.45 : 1;
    ctx.globalCompositeOperation = 'lighter';
    const gr = ctx.createLinearGradient(0, g.r * 0.3, 0, top);
    gr.addColorStop(0, rgba(c, (0.25 + 0.4 * f) * fl)); gr.addColorStop(0.7, rgba(c, 0.12 * fl)); gr.addColorStop(1, rgba(c, 0));
    ctx.fillStyle = gr; ctx.fillRect(-g.r * 0.78, top, g.r * 1.56, h + g.r * 0.8);
    ctx.strokeStyle = rgba(c, (0.45 + 0.45 * f) * fl); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(-g.r * 0.78, g.r * 0.3); ctx.lineTo(-g.r * 0.78, top * 0.8); ctx.moveTo(g.r * 0.78, g.r * 0.3); ctx.lineTo(g.r * 0.78, top * 0.8); ctx.stroke();
    ctx.strokeStyle = rgba(BONE, 0.5 * fl); ctx.lineWidth = 1;
    for (let k = 0; k < 3; k++) { const y = -(((t * 38 + k * h / 3 + g.id * 7) % h)); ctx.beginPath(); ctx.moveTo(-g.r * 0.78, y); ctx.lineTo(g.r * 0.78, y); ctx.stroke(); }
    ctx.strokeStyle = rgba(c, 0.8); ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.ellipse(0, g.r * 0.3, g.r * 0.85, g.r * 0.34, 0, 0, TAU); ctx.stroke();
    ctx.restore(); return;
  }
  ctx.fillStyle = 'rgba(0,0,0,.4)';
  ctx.beginPath(); ctx.ellipse(4, g.r * 0.5, g.r, g.r * 0.4, 0, 0, TAU); ctx.fill();
  if (g.kind === 'root' || g.kind === 'prison') {
    ctx.strokeStyle = rgba(g.kind === 'root' ? hex('green') : c, 0.85); ctx.lineWidth = 3; ctx.lineCap = 'round';
    for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + g.id; ctx.beginPath(); ctx.moveTo(Math.cos(a) * g.r * 0.9, Math.sin(a) * g.r * 0.4); ctx.quadraticCurveTo(0, -g.r * 0.6, Math.cos(a + 1.4) * g.r * 0.3, -g.r * 1.6); ctx.stroke(); }
    ctx.restore(); return;
  }
  // 結晶の柱：上に伸びる六角柱
  const h = g.r * (g.kind === 'wall' ? 2.2 : 1.7);
  ctx.fillStyle = '#16121f';
  ctx.beginPath();
  ctx.moveTo(-g.r * 0.8, 0); ctx.lineTo(-g.r * 0.8, -h); ctx.lineTo(0, -h - g.r * 0.5); ctx.lineTo(g.r * 0.8, -h); ctx.lineTo(g.r * 0.8, 0); ctx.lineTo(0, g.r * 0.35); ctx.closePath();
  ctx.fill();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = rgba(c, 0.4 + 0.5 * f); ctx.lineWidth = 2; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, g.r * 0.35); ctx.lineTo(0, -h - g.r * 0.5); ctx.strokeStyle = rgba(c, 0.25 + 0.3 * f); ctx.lineWidth = 1.2; ctx.stroke();
  ctx.globalAlpha *= 0.25 + f * 0.25 + Math.sin(t * 3 + g.id) * 0.05;
  ctx.drawImage(glow(c), -g.r * 1.4, -h - g.r * 0.6, g.r * 2.8, h + g.r * 1.4);
  ctx.restore();
}
// 罠：待機中の術式。発動のしかたを印で示す（時限は殻が薄れる輪、感知は探る輪、指示は✱）
function drawTrap(s) {
  const t = world.t, c = s.col;
  if (s.kind === 'lob' && s.state === 'fly') {
    // 投射の予告：着地点に輪が出る
    ctx.save();
    ctx.strokeStyle = rgba(c, 0.55); ctx.lineWidth = 1.5; ctx.setLineDash([5, 7]);
    ctx.beginPath(); ctx.arc(s.tx, s.ty, s.radius * 0.8, 0, TAU); ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
    return;
  }
  ctx.save();
  ctx.translate(s.x, s.y);
  const pulse = 0.6 + Math.sin(t * 6 + s.id) * 0.4;
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.55 * pulse;
  ctx.drawImage(glow(c), -22, -22, 44, 44);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.strokeStyle = rgba(c, 0.8); ctx.lineWidth = 1.6;
  ctx.rotate(t * 1.2);
  ctx.beginPath(); ctx.arc(0, 0, 12, 0, TAU); ctx.stroke();
  runeRing(ctx, 17, 6, 3, s.id);
  ctx.rotate(-t * 1.2);
  // 散逸していく殻：残りの寿命を輪で示す
  const left = Math.max(0, 1 - s.wait / (D.RULES.wait * s.st.time));
  ctx.strokeStyle = rgba(BONE, 0.6); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 22, -Math.PI / 2, -Math.PI / 2 + TAU * left); ctx.stroke();
  ctx.font = `700 16px 'Zen Kaku Gothic New', sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = rgba(BONE, 0.9);
  ctx.fillText(D.craft.thens[s.st.then].glyph, 0, 1);
  ctx.restore();
}
// 囮：散魔の光（追尾を引く）と、重層鏡界の像
// 演算体：折り畳まれた脳と、それを巡る観測の輪。目はなく、輪のレンズが術者を向く。回路の脈が走る
function drawBoss(u, alpha = 1, fake = false) {
  const t = world.t, r = u.r, hide = !fake && u.boss && u.boss.hideT > 0 && u.revealT <= 0;
  const h = S.hero(world), aim = h ? Math.atan2(h.y - u.y, h.x - u.x) : 0;
  const cy = u.y - r * 0.5 + Math.sin(t * 1.6 + u.id) * 4, violet = '#b784ff', pale = '#e6d9ff';
  ctx.save();
  ctx.globalAlpha = alpha * (hide ? 0.18 : 1);
  const sh = ctx.createRadialGradient(u.x, u.y + r * 0.25, 0, u.x, u.y + r * 0.25, r * 1.2);
  sh.addColorStop(0, 'rgba(0,0,0,.6)'); sh.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = sh; ctx.beginPath(); ctx.ellipse(u.x, u.y + r * 0.25, r * 1.2, r * 0.42, 0, 0, TAU); ctx.fill();
  ctx.translate(u.x, cy);
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= 0.32 + Math.sin(t * 2.2) * 0.06; ctx.drawImage(glow('purple'), -r * 2.3, -r * 2.3, r * 4.6, r * 4.6); ctx.restore();
  // 二つの半球：暗い結晶の質感に、脳の皺のような稜線
  for (const sd of [-1, 1]) {
    ctx.save(); ctx.translate(sd * r * 0.33, 0);
    const gr = ctx.createRadialGradient(-sd * r * 0.2, -r * 0.35, r * 0.05, 0, 0, r * 0.95);
    gr.addColorStop(0, '#4a3a86'); gr.addColorStop(0.6, '#1b1236'); gr.addColorStop(1, '#0a0716');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.ellipse(0, 0, r * 0.64, r * 0.8, sd * 0.1, 0, TAU); ctx.fill();
    ctx.save(); ctx.clip();
    ctx.strokeStyle = rgba(violet, 0.4); ctx.lineWidth = Math.max(1, r * 0.022);
    for (let k = 0; k < 7; k++) {
      ctx.beginPath();
      for (let x = -r * 0.7; x <= r * 0.7; x += r * 0.08) { const y = -r * 0.74 + k * r * 0.25 + Math.sin(x * (6 / r) + k * 1.9 + sd) * r * 0.075; x === -r * 0.7 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
      ctx.stroke();
    }
    // 回路：直角に折れる配線と、走るデータの光
    ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = rgba(pale, 0.5); ctx.lineWidth = Math.max(1, r * 0.018);
    for (let k = 0; k < 4; k++) {
      const x0 = -r * 0.45 + k * r * 0.3, y0 = -r * 0.1 - (k % 2) * r * 0.3;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0, y0 - r * 0.28); ctx.lineTo(x0 + r * 0.16 * sd, y0 - r * 0.28); ctx.lineTo(x0 + r * 0.16 * sd, y0 - r * 0.5); ctx.stroke();
      const p = (t * 0.7 + k * 0.27 + (sd > 0 ? 0.5 : 0)) % 1, px = x0 + (p < 0.4 ? 0 : (p - 0.4) / 0.6 * r * 0.16 * sd), py = y0 - Math.min(p / 0.4, 1) * r * 0.28 - (p > 0.7 ? (p - 0.7) / 0.3 * r * 0.22 : 0);
      ctx.fillStyle = pale; ctx.beginPath(); ctx.arc(px, py, Math.max(1.4, r * 0.03), 0, TAU); ctx.fill();
    }
    ctx.restore();
    ctx.strokeStyle = rgba(violet, 0.55); ctx.lineWidth = 1.4; ctx.beginPath(); ctx.ellipse(0, 0, r * 0.64, r * 0.8, sd * 0.1, 0, TAU); ctx.stroke();
    ctx.restore();
  }
  // 脳幹：下へ伸びる神経の束
  ctx.strokeStyle = rgba(violet, 0.6); ctx.lineWidth = Math.max(1.5, r * 0.04);
  for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.moveTo(k * r * 0.08, r * 0.7); ctx.quadraticCurveTo(k * r * 0.2 + Math.sin(t * 2 + k) * 4, r * 1.0, k * r * 0.14, r * 1.25 + Math.abs(k) * 3); ctx.stroke(); }
  // 観測の輪：傾いた輪が回り、レンズが術者のほうを向く
  for (let i = 0; i < 3; i++) {
    ctx.save(); ctx.rotate(t * (0.35 + i * 0.18) * (i % 2 ? -1 : 1) + i); ctx.scale(1, 0.3 + i * 0.08);
    ctx.strokeStyle = rgba(violet, 0.5 - i * 0.08); ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(0, 0, r * (1.08 + i * 0.2), 0, TAU); ctx.stroke();
    ctx.restore();
  }
  ctx.save(); ctx.rotate(aim); ctx.translate(r * 1.22, 0); ctx.rotate(-aim + t * 0.8); ctx.globalAlpha *= 0.95; drawGem(ctx, r * 0.17, violet, 0, 6, t, u.id); ctx.restore();
  if (!fake && u.boss && u.hurtT > 0) { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.beginPath(); ctx.arc(0, 0, r * 0.95, 0, TAU); ctx.fill(); }
  ctx.restore();
}
function drawDecoy(d) {
  const f = d.t / d.life, a = f > 0.8 ? (1 - f) / 0.2 : 1;
  if (d.boss) { drawBoss({ id: d.id, x: d.x, y: d.y, r: d.r, revealT: 0, hurtT: 0, boss: null }, 0.55 * a, true); return; }
  if (d.mirror) {
    ctx.save(); ctx.globalAlpha = 0.4 * a;
    drawMage({ id: d.id, x: d.x, y: d.y, r: d.r || 18, ink: d.ink, crest: d.crest, aim: Math.sin(world.t + d.id), vx: 0, vy: 0, level: 0, phaseT: 0, dashT: 0, hurtT: 0, casting: null }, false, true);
    ctx.restore();
    return;
  }
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.5 * a * (0.7 + Math.sin(world.t * 8) * 0.3);
  ctx.drawImage(glow('yellow'), d.x - 40, d.y - 40, 80, 80);
  ctx.restore();
}
// 糸：糸でつながった術式・結界・領域と、術者の杖先を結ぶ。張りが強いほど細く光る
function drawThreads(inView) {
  const t = world.t;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineWidth = 1.4;
  const one = (o, u) => {
    const tip = staffTip(u), dx = o.x - tip.x, dy = o.y - tip.y, d = hyp(dx, dy);
    if (d < 4 || (!inView(o.x, o.y, 40) && !inView(tip.x, tip.y, 40))) return;
    const sag = Math.min(60, d * 0.12), mx = (tip.x + o.x) / 2, my = (tip.y + o.y) / 2 + sag;
    const nm = o.col || u.ink, col = hex(nm), pulse = 0.5 + 0.5 * Math.sin(t * 5 + o.id);
    const path = () => { ctx.beginPath(); ctx.moveTo(tip.x, tip.y); ctx.quadraticCurveTo(mx, my, o.x, o.y); ctx.stroke(); };
    // 淡い光の帯 → 色の糸 → 白い芯の三層。糸の上を光の粒が杖から術へ走る
    ctx.setLineDash([]); ctx.lineCap = 'round';
    ctx.strokeStyle = rgba(col, 0.08 + 0.06 * pulse); ctx.lineWidth = 7; path();
    ctx.strokeStyle = rgba(col, 0.5 + 0.15 * pulse); ctx.lineWidth = 1.8; path();
    ctx.strokeStyle = 'rgba(255,250,240,.6)'; ctx.lineWidth = 0.7; path();
    const beads = Math.min(6, 2 + Math.floor(d / 90));
    for (let k = 0; k < beads; k++) {
      const q = (t * 0.8 + k / beads + o.id * 0.11) % 1, p = 1 - q;
      const bx = p * p * tip.x + 2 * p * q * mx + q * q * o.x, by = p * p * tip.y + 2 * p * q * my + q * q * o.y, s = 9 + 5 * Math.sin(q * Math.PI);
      ctx.globalAlpha = 0.85 * Math.sin(q * Math.PI); ctx.drawImage(glow(nm), bx - s, by - s, s * 2, s * 2);
    }
    ctx.globalAlpha = 1;
    // 結び目：術の側に回る小さな輪と光の点
    ctx.save(); ctx.translate(o.x, o.y); ctx.rotate(t * 2 + o.id);
    ctx.strokeStyle = rgba(col, 0.7); ctx.lineWidth = 1.2; ctx.setLineDash([3, 4]);
    ctx.beginPath(); ctx.arc(0, 0, 7 + pulse * 2, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    ctx.drawImage(glow(nm), -10, -10, 20, 20);
    ctx.restore();
  };
  for (const u of world.units) {
    if (!u.alive || !S.visibleTo(S.hero(world), u)) continue;
    for (const s of world.spells) if (s.owner === u.id && s.linked && !s.done) one(s, u);
    for (const z of world.zones) if (z.owner === u.id && z.linked && z.kind !== 'orbit') one(z, u);
    for (const g of world.wards) if (g.owner === u.id && g.linked && g.hp > 0) one(g, u);
  }
  ctx.setLineDash([]);
  ctx.restore();
}
// ─── 魔導士 ───
// フードと外套、肩掛け、刺繍の光るローブ、結晶を浮かべた杖。光は左上から当たり、縁は自分の紋の色で光る
function shade(h, f) {
  const n = parseInt(h.slice(1), 16);
  return `rgb(${Math.round((n >> 16) * f)},${Math.round(((n >> 8) & 255) * f)},${Math.round((n & 255) * f)})`;
}
// 布の色：紋の色を闇に沈めた深い色
function cloth(h, f) {
  const n = parseInt(h.slice(1), 16), k = 0.28;
  const mix = (v, base) => Math.round((v * k + base * (1 - k)) * f);
  return `rgb(${mix(n >> 16, 34)},${mix((n >> 8) & 255, 28)},${mix(n & 255, 44)})`;
}
function staffPose(u) {
  const s = u.r / 18, face = Math.cos(u.aim) >= 0 ? 1 : -1;
  const fy = u.y + u.r * 0.35;
  const hx = u.x + face * 8.5 * s, hy = fy - 27 * s;
  const aiming = !!u.casting || (u.slotCd && u.slotCd.some(c => c > 0));
  const tx = aiming ? hx + Math.cos(u.aim) * 19 * s : hx + face * 1.5 * s;
  const ty = aiming ? hy + Math.sin(u.aim) * 12 * s - 15 * s : hy - 31 * s;
  return { hx, hy, tx, ty, face, s, fy, aiming };
}
function staffTip(u) { const p = staffPose(u); return { x: p.tx, y: p.ty }; }
// 格：育つほど体は大きくならず、装いが整っていく（制御容量が増えるレベルに合わせる）。光のオーラや翼は付けない
// 0 素の魔導士 / 1 金の縁取り / 2 長い外套と額の宝石 / 3 金の肩当て
function grandeur(u) { const l = u.level || 0; return l >= 12 ? 3 : l >= 7 ? 2 : l >= 3 ? 1 : 0; }
const GOLD = '#d9b86a', GOLD_HI = '#ffe19a';
// 紋ごとのスキン：石の切り方（面の数）と輝き。位階ごとに裾の宝石が増え、演算の間を越えるたびに黒曜の回路をまとう
const CREST_SKIN = { ring: 8, bar: 4, cross: 4, lozenge: 6, igeta: 6, scale: 7, stars: 5, wheel: 8 };
function skinOf(u) { return { n: CREST_SKIN[u.crest] || 8, gems: Math.min(7, u.tier || 0), obsidian: u.skin || 0 }; }
function drawMage(u, isTop, image = false) {
  const viewer = world && S.hero(world);
  if (!image && viewer && !S.visibleTo(viewer, u)) return;
  if (u.boss) { drawBoss(u); return; }
  const t = world.t, r = u.r, c = hex(u.ink), SK = skinOf(u);
  const { hx, hy, tx, ty, face, s, fy, aiming } = staffPose(u);
  const speed = hyp(u.vx, u.vy), walk = Math.min(1, speed / 220);
  const bob = -Math.abs(Math.sin(t * 9 + u.id)) * 1.6 * s * walk + Math.sin(t * 2 + u.id) * 0.4 * s;
  const ghost = image || u.phaseT > 0 || u.dashT > 0 || u.ghostT > 0 || (u.cloakT > 0 && u.revealT <= 0);
  const lean = Math.max(-0.2, Math.min(0.2, u.vx / 800));
  const casting = !!u.casting;
  const sway = -u.vx / 260 * 6 * s + Math.sin(t * 3 + u.id) * 0.8 * s;   // 外套は進む向きと逆へなびく
  ctx.save();
  // 足元の紋の陣（楕円に寝かせる）
  ctx.save();
  ctx.translate(u.x, fy); ctx.scale(1, 0.4);
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = ghost ? 0.12 : casting ? 0.55 : 0.28;
  ctx.drawImage(glow(u.ink), -r * 2.4, -r * 2.4, r * 4.8, r * 4.8);
  ctx.globalAlpha = ghost ? 0.35 : 0.8;
  ctx.globalCompositeOperation = 'source-over';
  ctx.rotate(t * 0.4 + u.id);
  ctx.strokeStyle = rgba(c, 0.65); ctx.lineWidth = 1.3;
  ctx.beginPath(); ctx.arc(0, 0, r * 1.3, 0, TAU); ctx.stroke();
  ctx.strokeStyle = rgba(c, 0.35); ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(0, 0, r * 1.12, 0, TAU); ctx.stroke();
  if (r > 20) { ctx.strokeStyle = rgba(c, 0.55); runeRing(ctx, r * 1.21, Math.min(20, Math.round(r / 3.5)), 2.6 * s, u.id); }
  drawCrest(ctx, u.crest, r * 0.72, rgba(c, 0.5));
  const gr = image ? 0 : grandeur(u);
  if (u.rootT > 0) { ctx.strokeStyle = rgba(hex('green'), 0.9); ctx.lineWidth = 3; for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; ctx.beginPath(); ctx.moveTo(Math.cos(a) * r * 1.3, Math.sin(a) * r * 1.3); ctx.quadraticCurveTo(Math.cos(a + 0.5) * r * 0.8, Math.sin(a + 0.5) * r * 0.8, Math.cos(a) * r * 0.4, Math.sin(a) * r * 0.4); ctx.stroke(); } }
  ctx.restore();
  // 詠唱中：体のまわりに力の光がまとわりつき、脈打つ
  if (casting && !ghost) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.28 + Math.sin(t * 14 + u.id) * 0.08;
    const col = S.recipeResult(u.spells[u.casting.slot]).color;
    ctx.drawImage(glow(col), u.x - r * 2.2, fy - r * 3.6, r * 4.4, r * 4.4);
    ctx.restore();
  }
  // 影
  const sh = ctx.createRadialGradient(u.x, fy, 0, u.x, fy, r * 0.9);
  sh.addColorStop(0, 'rgba(0,0,0,.65)'); sh.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = sh;
  ctx.beginPath(); ctx.ellipse(u.x, fy, r * 0.95, r * 0.34, 0, 0, TAU); ctx.fill();
  ctx.globalAlpha = ghost ? 0.4 : 1;
  ctx.translate(u.x, fy + bob);
  const X = v => v * s, Y = v => v * s;
  const hurt = u.hurtT > 0;
  // 格2：長い外套。裾が地を這い、縁が紋の色で光る
  if (gr >= 2) {
    ctx.fillStyle = hurt ? rgba(c, 0.7) : cloth(c, 0.5);
    ctx.beginPath();
    ctx.moveTo(X(-8.5), Y(-40));
    ctx.bezierCurveTo(X(-16) + sway * 0.5, Y(-24), X(-22) + sway * 1.4, Y(-6), X(-21) + sway * 1.8, Y(4));
    ctx.quadraticCurveTo(X(0) + sway * 1.5, Y(8) + Math.sin(t * 4 + u.id) * Y(1.2), X(21) + sway * 1.8, Y(4));
    ctx.bezierCurveTo(X(22) + sway * 1.4, Y(-6), X(16) + sway * 0.5, Y(-24), X(8.5), Y(-40));
    ctx.closePath(); ctx.fill();
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = rgba(gr >= 3 ? GOLD : c, 0.55); ctx.lineWidth = X(0.8); ctx.stroke();
    ctx.restore();
  }
  // 外套（背中側）：肩から裾へ広がり、なびく
  let g = ctx.createLinearGradient(0, Y(-42), 0, Y(2));
  g.addColorStop(0, cloth(c, 0.9)); g.addColorStop(1, cloth(c, 0.45));
  ctx.fillStyle = hurt ? rgba(c, 0.8) : g;
  ctx.beginPath();
  ctx.moveTo(X(-7.5), Y(-39));
  ctx.bezierCurveTo(X(-13) + sway * 0.4, Y(-26), X(-17) + sway, Y(-10), X(-16) + sway * 1.3, Y(1.5));
  ctx.quadraticCurveTo(X(-8) + sway, Y(3.5) + Math.sin(t * 5 + u.id) * Y(1), X(0) + sway, Y(2));
  ctx.quadraticCurveTo(X(8) + sway, Y(3.5) - Math.sin(t * 5 + u.id) * Y(1), X(16) + sway * 1.3, Y(1.5));
  ctx.bezierCurveTo(X(17) + sway, Y(-10), X(13) + sway * 0.4, Y(-26), X(7.5), Y(-39));
  ctx.closePath(); ctx.fill();
  // 杖（体の後ろ側を先に）
  const drawStaff = () => {
    const sx = hx - u.x, sy = hy - fy - bob, ex = tx - u.x, ey = ty - fy - bob;
    const bx = sx - (ex - sx) * 0.62, by = sy - (ey - sy) * 0.62;
    const sg = ctx.createLinearGradient(bx, by, ex, ey);
    sg.addColorStop(0, '#2a1d15'); sg.addColorStop(0.6, '#5a4230'); sg.addColorStop(1, '#3a2a1e');
    ctx.strokeStyle = sg; ctx.lineWidth = X(2.6); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(ex, ey); ctx.stroke();
    // 金具
    ctx.strokeStyle = '#b89a5e'; ctx.lineWidth = X(3.2);
    for (const f of [0.18, 0.88]) { const px = bx + (ex - bx) * f, py = by + (ey - by) * f, l = X(1.2); const dx = (ex - bx), dy = (ey - by), dl = hyp(dx, dy) || 1; ctx.beginPath(); ctx.moveTo(px - dx / dl * l, py - dy / dl * l); ctx.lineTo(px + dx / dl * l, py + dy / dl * l); ctx.stroke(); }
    // 杖頭：三日月の枠と、浮かぶ結晶
    const ang = Math.atan2(ey - by, ex - bx);
    ctx.save(); ctx.translate(ex, ey); ctx.rotate(ang + Math.PI / 2);
    ctx.strokeStyle = '#c9ad6e'; ctx.lineWidth = X(1.4);
    ctx.beginPath(); ctx.arc(0, -X(1), X(4.6), Math.PI * 0.15, Math.PI * 0.85, true); ctx.stroke();
    ctx.restore();
    const float = Math.sin(t * 3 + u.id) * X(0.8);
    ctx.save(); ctx.translate(ex, ey - X(3.2) + float); ctx.rotate(t * (casting ? 3 : 0.8));
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = (ghost ? 0.4 : 1) * (casting ? 1 : 0.7);
    ctx.drawImage(glow(u.ink), -X(9), -X(9), X(18), X(18));
    ctx.globalCompositeOperation = 'source-over';
    drawGem(ctx, X(3.8), c, 0, SK.n, t, u.id);
    ctx.restore();
    ctx.globalAlpha = ghost ? 0.4 : 1;
  };
  if (face < 0) drawStaff();
  // ローブ：腰から裾へ。光の当たる側を明るく、ひだを描く
  g = ctx.createLinearGradient(X(-12), 0, X(12), 0);
  g.addColorStop(0, cloth(c, 1.25)); g.addColorStop(0.55, cloth(c, 0.85)); g.addColorStop(1, cloth(c, 0.55));
  ctx.fillStyle = hurt ? rgba(c, 0.85) : g;
  const hem = Math.sin(t * 7 + u.id) * walk * X(1.2);
  ctx.beginPath();
  ctx.moveTo(X(-6.5) + lean * X(5), Y(-24));
  ctx.quadraticCurveTo(X(-10), Y(-12), X(-12.5) + sway * 0.5 + hem, Y(-0.5));
  ctx.quadraticCurveTo(X(0) + sway * 0.4, Y(2.2), X(12.5) + sway * 0.5 - hem, Y(-0.5));
  ctx.quadraticCurveTo(X(10), Y(-12), X(6.5) + lean * X(5), Y(-24));
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = X(0.8);
  for (const k of [-0.45, 0.1, 0.55]) { ctx.beginPath(); ctx.moveTo(X(k * 8) + lean * X(4), Y(-22)); ctx.quadraticCurveTo(X(k * 11), Y(-10), X(k * 12.5) + sway * 0.45, Y(-1)); ctx.stroke(); }
  // 裾の刺繍：紋の色で光るルーン
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = rgba(c, ghost ? 0.3 : casting ? 1 : 0.75); ctx.lineWidth = X(0.7);
  ctx.beginPath(); ctx.moveTo(X(-12) + sway * 0.5 + hem, Y(-2)); ctx.quadraticCurveTo(X(0) + sway * 0.4, Y(0.8), X(12) + sway * 0.5 - hem, Y(-2)); ctx.stroke();
  for (let i = 0; i < 7; i++) { const f = (i + 0.5) / 7, px = X(-11 + 22 * f) + sway * 0.45, py = Y(-3.4 + Math.sin(f * Math.PI) * 2); ctx.save(); ctx.translate(px, py); drawRune(ctx, i + u.id, X(0.9)); ctx.restore(); }
  ctx.restore();
  // 格1：裾に金の縁取り
  if (gr >= 1) {
    ctx.strokeStyle = GOLD; ctx.lineWidth = X(0.9);
    ctx.beginPath(); ctx.moveTo(X(-12.5) + sway * 0.5 + hem, Y(-0.8)); ctx.quadraticCurveTo(X(0) + sway * 0.4, Y(2), X(12.5) + sway * 0.5 - hem, Y(-0.8)); ctx.stroke();
    ctx.strokeStyle = rgba(GOLD, 0.7); ctx.lineWidth = X(0.5);
    ctx.beginPath(); ctx.moveTo(X(0) + lean * X(4.5), Y(-23)); ctx.lineTo(X(0) + sway * 0.4, Y(1.8)); ctx.stroke();
  }
  // 紋のスキン：位階ごとに裾の宝石が増える
  for (let i = 0; i < SK.gems; i++) { const f = (i + 0.5) / SK.gems; ctx.save(); ctx.translate(X(-9.5 + 19 * f) + sway * 0.45, Y(-2.6 + Math.sin(f * Math.PI) * 1.4)); drawGem(ctx, X(1.2), c, t * 0.5 + i, SK.n, t, u.id + i); ctx.restore(); }
  // 演算の間を越えた者：外套に黒曜の回路が走る
  if (SK.obsidian >= 1) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = 'rgba(190,150,255,.65)'; ctx.lineWidth = X(0.55);
    for (const sd of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(sd * X(4), Y(-23)); ctx.lineTo(sd * X(4), Y(-15)); ctx.lineTo(sd * X(8), Y(-15)); ctx.lineTo(sd * X(8), Y(-7)); ctx.lineTo(sd * X(5), Y(-7)); ctx.lineTo(sd * X(5), Y(-1.5)); ctx.stroke();
      const p = (t * 0.8 + (sd > 0 ? 0.5 : 0)) % 1; ctx.fillStyle = '#efe4ff'; ctx.beginPath(); ctx.arc(sd * X(4 + p * 3), Y(-23 + p * 21), X(0.6), 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
  // 胴と帯
  g = ctx.createLinearGradient(X(-7), 0, X(7), 0);
  g.addColorStop(0, cloth(c, 1.15)); g.addColorStop(1, cloth(c, 0.6));
  ctx.fillStyle = hurt ? rgba(c, 0.85) : g;
  ctx.beginPath(); ctx.moveTo(X(-6) + lean * X(6), Y(-40)); ctx.lineTo(X(6) + lean * X(6), Y(-40)); ctx.lineTo(X(7) + lean * X(5), Y(-24)); ctx.lineTo(X(-7) + lean * X(5), Y(-24)); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#1a1420';
  ctx.fillRect(X(-7.2) + lean * X(5), Y(-26), X(14.4), Y(2.6));
  ctx.save(); ctx.translate(lean * X(5), Y(-24.7)); drawCrest(ctx, u.crest, X(1.8), '#c9ad6e'); ctx.restore();
  // 空いた手：詠唱中は前へ差し出し、掌に光を集める
  const off = -face;
  const ohx = casting ? off * X(3) + Math.cos(u.aim) * X(9) : off * X(7.5), ohy = casting ? Y(-31) + Math.sin(u.aim) * X(5) : Y(-24);
  ctx.strokeStyle = hurt ? rgba(c, 0.8) : cloth(c, 0.8); ctx.lineWidth = X(3.4); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(off * X(5.5) + lean * X(6), Y(-37)); ctx.quadraticCurveTo(off * X(8), Y(-31), ohx, ohy); ctx.stroke();
  ctx.fillStyle = '#2b2128'; ctx.beginPath(); ctx.arc(ohx, ohy, X(1.3), 0, TAU); ctx.fill();
  if (casting) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.6 + Math.sin(t * 20) * 0.2;
    ctx.drawImage(glow(S.recipeResult(u.spells[u.casting.slot]).color), ohx - X(8), ohy - X(8), X(16), X(16));
    ctx.restore();
  }
  // 肩掛け：胸元で留め金が光る
  g = ctx.createLinearGradient(0, Y(-42), 0, Y(-30));
  g.addColorStop(0, cloth(c, 1.3)); g.addColorStop(1, cloth(c, 0.7));
  ctx.fillStyle = hurt ? rgba(c, 0.85) : g;
  ctx.beginPath();
  ctx.moveTo(X(-9.5) + lean * X(6), Y(-37));
  ctx.quadraticCurveTo(X(-8) + lean * X(6), Y(-42.5), X(0) + lean * X(6), Y(-42.5));
  ctx.quadraticCurveTo(X(8) + lean * X(6), Y(-42.5), X(9.5) + lean * X(6), Y(-37));
  ctx.quadraticCurveTo(X(5) + lean * X(6), Y(-32.5), X(0) + lean * X(6), Y(-31));
  ctx.quadraticCurveTo(X(-5) + lean * X(6), Y(-32.5), X(-9.5) + lean * X(6), Y(-37));
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = gr >= 1 ? GOLD : rgba(c, 0.8); ctx.lineWidth = X(gr >= 1 ? 0.8 : 0.6); ctx.stroke();
  // 格3：金の肩当て
  if (gr >= 3) {
    for (const sd of [-1, 1]) {
      ctx.fillStyle = shade(GOLD, 0.75);
      ctx.beginPath(); ctx.ellipse(sd * X(8.2) + lean * X(6), Y(-37.5), X(3.4), X(2.2), sd * 0.35, Math.PI, TAU); ctx.fill();
      ctx.strokeStyle = GOLD_HI; ctx.lineWidth = X(0.5); ctx.stroke();
    }
  }
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  ctx.drawImage(glow(u.ink), lean * X(6) - X(3), Y(-35) - X(3), X(6), X(6));
  ctx.restore();
  // フード：影の奥に、光る目
  const hxo = lean * X(7) + face * X(0.6);
  g = ctx.createLinearGradient(X(-7), Y(-58), X(7), Y(-40));
  g.addColorStop(0, cloth(c, 1.35)); g.addColorStop(1, cloth(c, 0.55));
  ctx.fillStyle = hurt ? rgba(c, 0.85) : g;
  ctx.beginPath();
  ctx.moveTo(hxo - X(7), Y(-40.5));
  ctx.bezierCurveTo(hxo - X(8.5), Y(-48), hxo - X(5.5), Y(-55), hxo - face * X(3) , Y(-58.5));
  ctx.bezierCurveTo(hxo + X(5.5), Y(-55), hxo + X(8.5), Y(-48), hxo + X(7), Y(-40.5));
  ctx.quadraticCurveTo(hxo, Y(-38.5), hxo - X(7), Y(-40.5));
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#060509';
  ctx.beginPath(); ctx.ellipse(hxo + face * X(1.4), Y(-46.2), X(4.2), X(4.8), 0, 0, TAU); ctx.fill();
  const blink = Math.sin(t * 1.3 + u.id * 7) > 0.97 ? 0.15 : 1;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = hurt ? '#fff' : rgba(c, 1);
  for (const e of [-1, 1]) {
    const ex2 = hxo + face * X(2.2) + e * X(1.55), ey2 = Y(-46.4);
    // キービジュアルと同じ、影の奥に浮かぶ縦長の光る目
    ctx.beginPath(); ctx.ellipse(ex2, ey2, X(0.8), X(1.1) * blink, 0, 0, TAU); ctx.fill();
    ctx.globalAlpha = 0.5; ctx.drawImage(glow(u.ink), ex2 - X(3), ey2 - X(3), X(6), X(6)); ctx.globalAlpha = 1;
  }
  ctx.restore();
  // 格2：額の宝石と金の細い冠
  if (gr >= 2) {
    ctx.strokeStyle = GOLD; ctx.lineWidth = X(0.7);
    ctx.beginPath(); ctx.moveTo(hxo - X(5.6), Y(-50.5)); ctx.quadraticCurveTo(hxo + face * X(1), Y(-53.2), hxo + X(5.6), Y(-50.5)); ctx.stroke();
    const gx = hxo + face * X(1.2), gy = Y(-52.4);
    ctx.fillStyle = rgba(c, 0.9); ctx.beginPath(); ctx.moveTo(gx, gy - X(1.4)); ctx.lineTo(gx + X(1), gy); ctx.lineTo(gx, gy + X(1.4)); ctx.lineTo(gx - X(1), gy); ctx.closePath(); ctx.fill();
  }
  // 杖を持つ腕と手
  const shx = face * X(5.5) + lean * X(6), shy = Y(-37);
  ctx.strokeStyle = hurt ? rgba(c, 0.8) : cloth(c, 0.95); ctx.lineWidth = X(3.6); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(shx, shy); ctx.quadraticCurveTo(face * X(9), Y(-31), hx - u.x, hy - fy - bob); ctx.stroke();
  if (face >= 0) drawStaff();
  ctx.fillStyle = '#2b2128'; ctx.beginPath(); ctx.arc(hx - u.x, hy - fy - bob, X(1.5), 0, TAU); ctx.fill();
  // 演算の間を二度越えた者：頭上を黒曜の宝石が巡る
  if (SK.obsidian >= 2) for (let i = 0; i < 3; i++) { const a = t * 1.3 + i * TAU / 3; ctx.save(); ctx.translate(Math.cos(a) * X(9), Y(-62) + Math.sin(a) * X(2.6)); drawGem(ctx, X(1.5), '#b784ff', a, 6, t, i); ctx.restore(); }
  // 縁の光：自分の紋の色で輪郭が光る
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = rgba(c, casting ? 0.55 : 0.28); ctx.lineWidth = X(0.9);
  ctx.beginPath();
  ctx.moveTo(hxo - X(7), Y(-40.5));
  ctx.bezierCurveTo(hxo - X(8.5), Y(-48), hxo - X(5.5), Y(-55), hxo - face * X(3), Y(-58.5));
  ctx.bezierCurveTo(hxo + X(5.5), Y(-55), hxo + X(8.5), Y(-48), hxo + X(7), Y(-40.5));
  ctx.stroke();
  ctx.restore();
  ctx.restore();
  if (image) return;
  drawStatus(u, s, fy);
  // 首位の冠：フードの上に浮く金の三点
  if (isTop) {
    ctx.save(); ctx.translate(u.x, fy - 67 * s + Math.sin(t * 3) * 2);
    ctx.fillStyle = GOLD;
    ctx.beginPath(); ctx.moveTo(-12, 6); ctx.lineTo(-12, -5); ctx.lineTo(-6, 0); ctx.lineTo(0, -9); ctx.lineTo(6, 0); ctx.lineTo(12, -5); ctx.lineTo(12, 6); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
}
// 詠唱の大魔法陣：足元に開き、詠唱文の文字が外輪を巡る。中心に原理の字。詠唱が進むほど満ちる
function drawCastCircle(c) {
  const u = S.unitById(world, c.id);
  if (!u) return;
  const f = Math.min(1, c.t / Math.max(0.05, c.total)), done = c.t > c.total;
  const fade = done ? Math.max(0, 1 - (c.t - c.total) / 0.3) : 1;
  const R0 = u.r * (c.big ? 2.4 : 1.7) * (0.55 + 0.45 * Math.min(1, f * 1.6)) * (done ? 1 + (c.t - c.total) * 1.5 : 1);
  const col = c.col, fy = u.y + u.r * 0.35;
  ctx.save();
  ctx.translate(u.x, fy); ctx.scale(1, 0.42);
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.35 * fade * (0.5 + f * 0.5);
  ctx.drawImage(glow(col), -R0 * 1.3, -R0 * 1.3, R0 * 2.6, R0 * 2.6);
  ctx.globalAlpha = fade;
  ctx.rotate(c.rot + c.t * 1.2);
  ctx.strokeStyle = rgba(col, 0.9); ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(0, 0, R0, 0, TAU * Math.min(1, f * 1.4)); ctx.stroke();
  ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.arc(0, 0, R0 * 0.78, 0, TAU); ctx.stroke();
  // 六芒と、詠唱が進むほど灯る刻み
  ctx.strokeStyle = rgba(col, 0.6);
  ctx.beginPath();
  for (const off of [0, Math.PI / 3]) { for (let i = 0; i <= 3; i++) { const a = off + i * TAU / 3, x = Math.cos(a) * R0 * 0.76, y = Math.sin(a) * R0 * 0.76; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } }
  ctx.stroke();
  const ticks = 24;
  for (let i = 0; i < ticks; i++) { if (i / ticks > f) break; const a = i / ticks * TAU; ctx.beginPath(); ctx.moveTo(Math.cos(a) * R0 * 0.82, Math.sin(a) * R0 * 0.82); ctx.lineTo(Math.cos(a) * R0 * 0.94, Math.sin(a) * R0 * 0.94); ctx.stroke(); }
  // 外輪を巡る詠唱文
  if (c.big && c.words) {
    const chars = [...c.words], rr = R0 * 1.14;
    ctx.font = `700 ${Math.max(12, R0 * 0.16)}px 'Zen Old Mincho', serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = rgba(col, 0.95);
    const shown = Math.ceil(chars.length * Math.min(1, f * 1.2));
    chars.slice(0, shown).forEach((ch, i) => { const a = -Math.PI / 2 + i / Math.max(chars.length, 12) * TAU; ctx.save(); ctx.rotate(a); ctx.translate(0, -rr); ctx.scale(1, 1 / 0.42 * 0.6); ctx.fillText(ch, 0, 0); ctx.restore(); });
  }
  ctx.restore();
  // 中心の原理の字（寝かせずに立てて描く）
  if (c.big) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.55 * fade * f;
    ctx.font = `900 ${u.r * 1.3}px 'Zen Old Mincho', serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = col;
    ctx.fillText(D.principles[c.a].kanji + (c.b !== 'none' && c.b !== c.a ? D.principles[c.b].kanji : ''), u.x, fy - u.r * 0.2);
    ctx.restore();
  }
}
// 光が床を照らす：術・領域・杖先の結晶のまわりをうすく明るくする
function drawLights(inView) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const sp of world.spells) {
    if (sp.done || !inView(sp.x, sp.y, 160) || !S.visibleSpell(S.hero(world), sp)) continue;
    ctx.globalAlpha = sp.state === 'fly' ? 0.2 : 0.1;
    ctx.drawImage(glow(sp.col), sp.x - 120, sp.y - 120, 240, 240);
  }
  for (const z of world.zones) {
    if (!inView(z.x, z.y, z.zr * 1.5) || (z.kind === 'body' ? !S.visibleTo(S.hero(world), S.unitById(world, z.owner)) : !S.visibleSpell(S.hero(world), z))) continue;
    ctx.globalAlpha = 0.08;
    ctx.drawImage(glow(z.col), z.x - z.zr * 1.5, z.y - z.zr * 1.5, z.zr * 3, z.zr * 3);
  }
  for (const u of world.units) {
    if (!u.alive || !S.visibleTo(S.hero(world), u) || !inView(u.x, u.y, 200)) continue;
    const tip = staffTip(u);
    ctx.globalAlpha = u.casting ? 0.28 : 0.1;
    const rr = u.casting ? 150 + u.r * 2 : 90;
    ctx.drawImage(glow(u.ink), tip.x - rr, tip.y - rr, rr * 2, rr * 2);
  }
  ctx.restore();
}
// 磨かれた床の映り込み：杖先の光・飛ぶ術・光線が、足元の石に縦に伸びて映る
function drawReflections(inView) {
  const seer = S.hero(world);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const u of world.units) {
    if (!u.alive || !S.visibleTo(seer, u) || !inView(u.x, u.y, 160)) continue;
    const tip = staffTip(u), fy = u.y + u.r * 0.35, ry = fy + (fy - tip.y) * 0.85, s = u.casting ? 12 : 8;
    ctx.globalAlpha = u.casting ? 0.2 : 0.1;
    ctx.drawImage(glow(u.ink), tip.x - s, ry - s * 3.2, s * 2, s * 6.4);
  }
  for (const p of parts) {
    if (p.kind !== 'beam') continue;
    const a = Math.max(0, 1 - p.t / p.life) * 0.12;
    ctx.globalAlpha = a; ctx.strokeStyle = hex(p.ink); ctx.lineWidth = p.w * 2.4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(p.x, p.y + 30); ctx.lineTo(p.x2, p.y2 + 30); ctx.stroke();
  }
  ctx.restore();
}
// 弾の尾：少し前の位置を覚えておき、細くなる光の筋で描く
const trails = new Map();
function updateTrails() {
  const alive = new Set(), far = (vw + vh) / cam.z * 0.7;
  for (const s of world.spells) {
    if (s.done || s.state !== 'fly') continue;
    alive.add(s.id);
    let tr = trails.get(s.id);
    if (!tr) trails.set(s.id, tr = []);
    const y = s.kind === 'lob' ? s.y - lobHeight(s) : s.y;
    tr.push(s.x, y);
    // 飛ぶ術式は火の粉をこぼしていく
    // エネルギーは火の粉と電気をこぼし、固体はほとんど何もこぼさない
    if (s.matter !== 'solid' && Math.random() < 0.3 && hyp(s.x - cam.x, s.y - cam.y) < far) {
      parts.push({ kind: 'ember', x: s.x + rnd(-3, 3), y: y + rnd(-3, 3), vx: -(s.vx || 0) * 0.05 + rnd(-30, 30), vy: -(s.vy || 0) * 0.05 + rnd(-30, 30), r: rnd(0.8, 1.8), ink: s.col, t: 0, life: rnd(0.25, 0.5) });
    }
    const max = s.shape === 'orb' ? 16 : s.shape === 'shard' ? 12 : 22;
    if (tr.length > max) tr.splice(0, tr.length - max);
  }
  for (const id of trails.keys()) if (!alive.has(id)) trails.delete(id);
}
function lobHeight(s) { const f = Math.min(1, s.t / s.dur), d = hyp(s.tx - s.sx, s.ty - s.sy); return Math.sin(f * Math.PI) * Math.min(170, d * 0.35 + 40); }
// 尾：先へ行くほど太く明るくなる光の帯。色の帯の中に白熱した細い芯が通る
function trailRibbon(tr, n, w0, fill) {
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const j = Math.min(n - 1, i + 1), k = Math.max(0, i - 1);
    const dx = tr[j * 2] - tr[k * 2], dy = tr[j * 2 + 1] - tr[k * 2 + 1], d = hyp(dx, dy) || 1;
    const w = w0 * Math.pow(i / (n - 1), 1.3) * 0.5;
    const x = tr[i * 2] - dy / d * w, y = tr[i * 2 + 1] + dx / d * w;
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  for (let i = n - 1; i >= 0; i--) {
    const j = Math.min(n - 1, i + 1), k = Math.max(0, i - 1);
    const dx = tr[j * 2] - tr[k * 2], dy = tr[j * 2 + 1] - tr[k * 2 + 1], d = hyp(dx, dy) || 1;
    const w = w0 * Math.pow(i / (n - 1), 1.3) * 0.5;
    ctx.lineTo(tr[i * 2] + dy / d * w, tr[i * 2 + 1] - dx / d * w);
  }
  ctx.closePath();
  ctx.fillStyle = fill; ctx.fill();
}
function drawTrail(s, w0) {
  const tr = trails.get(s.id);
  if (!tr || tr.length < 6) return;
  const c = hex(s.col), n = tr.length / 2;
  if (s.matter === 'solid') {
    // 固体：空気を裂く細い白い筋が二本（光らない。重い物が飛ぶ感じ）
    const k = Math.max(0, n - 8);
    const x0 = tr[k * 2], y0 = tr[k * 2 + 1], x1 = tr[tr.length - 2], y1 = tr[tr.length - 1];
    const dx = x1 - x0, dy = y1 - y0, L = hyp(dx, dy) || 1, nx = -dy / L * w0 * 0.6, ny = dx / L * w0 * 0.6;
    ctx.save(); ctx.globalCompositeOperation = 'source-over';
    for (const sgn of [-1, 1]) {
      const g = ctx.createLinearGradient(x0, y0, x1, y1);
      g.addColorStop(0, 'rgba(230,226,236,0)'); g.addColorStop(1, 'rgba(230,226,236,.55)');
      ctx.strokeStyle = g; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(x0 + nx * sgn, y0 + ny * sgn); ctx.lineTo(x1 + nx * sgn * 0.6, y1 + ny * sgn * 0.6); ctx.stroke();
    }
    ctx.restore();
    return;
  }
  // エネルギー：外側に広く淡い揺らぎの帯をもう一枚
  const g0 = ctx.createLinearGradient(tr[0], tr[1], tr[tr.length - 2], tr[tr.length - 1]);
  g0.addColorStop(0, rgba(c, 0)); g0.addColorStop(1, rgba(c, 0.18 + 0.04 * Math.sin(world.t * 23 + s.id)));
  trailRibbon(tr, n, w0 * 2.8, g0);
  const g = ctx.createLinearGradient(tr[0], tr[1], tr[tr.length - 2], tr[tr.length - 1]);
  g.addColorStop(0, rgba(c, 0)); g.addColorStop(0.6, rgba(c, 0.3)); g.addColorStop(1, rgba(c, 0.8));
  trailRibbon(tr, n, w0 * 1.3, g);
  const g2 = ctx.createLinearGradient(tr[0], tr[1], tr[tr.length - 2], tr[tr.length - 1]);
  g2.addColorStop(0.35, 'rgba(255,250,240,0)'); g2.addColorStop(1, 'rgba(255,250,240,.8)');
  trailRibbon(tr, n, w0 * 0.4, g2);
}
// ─── 魔素の光：この世界はすべて魔素でできていて、光は魔素であり命でもある ───
// 四方向に伸びる輝き（レンズの光芒）
function drawStar(g, x, y, s, col, a) {
  if (a <= 0.01) return;
  g.save(); g.translate(x, y); g.globalAlpha *= a; g.fillStyle = col;
  for (const rot of [0, Math.PI / 2]) {
    g.save(); g.rotate(rot); g.beginPath(); g.moveTo(-s, 0); g.lineTo(0, -s * 0.1); g.lineTo(s, 0); g.lineTo(0, s * 0.1); g.closePath(); g.fill(); g.restore();
  }
  g.restore();
}
// 魔素の光の塊を原点に描く：白く熱い芯と、色を帯びた淡い光。ゆっくり脈打ち、ときどき輝きが走る（面取りの石ではない）
function drawGem(g, r, col, rot = 0, n = 8, t = 0, seed = 0) {
  const pulse = 0.88 + 0.12 * Math.sin(t * 6 + seed * 1.3), a0 = g.globalAlpha;
  g.save(); g.globalCompositeOperation = 'lighter';
  g.globalAlpha = a0 * 0.55 * pulse; g.drawImage(glow(col), -r * 2.6, -r * 2.6, r * 5.2, r * 5.2);
  g.globalAlpha = a0 * 0.95; g.drawImage(hotGlow(col), -r * 1.35 * pulse, -r * 1.35 * pulse, r * 2.7 * pulse, r * 2.7 * pulse);
  g.globalAlpha = a0 * 0.9; g.fillStyle = '#fffaf0'; g.beginPath(); g.arc(0, 0, r * 0.32 * pulse, 0, TAU); g.fill();
  g.restore();
  g.globalAlpha = a0;
}
// ─── 形（刀・日本刀・手裏剣・槍・針・球・結晶） ───
// 原点に置き、+x の向きに描く。s は大きさの単位（全長はおよそ 5s）
const WEAPONS = ['blade', 'katana', 'shuriken', 'spear', 'arrow', 'scythe', 'axe', 'hammer', 'chakram', 'castle'];
const SPINNERS = ['shuriken', 'chakram'];
function weaponPath(g, shape, s) {
  g.beginPath();
  switch (shape) {
    case 'blade':
      // 直刀：両刃の刀身・鍔・柄・柄頭
      g.moveTo(2.9 * s, 0); g.lineTo(2.3 * s, -0.27 * s); g.lineTo(-0.9 * s, -0.27 * s); g.lineTo(-0.9 * s, 0.27 * s); g.lineTo(2.3 * s, 0.27 * s); g.closePath();
      g.rect(-1.12 * s, -0.72 * s, 0.24 * s, 1.44 * s);
      g.rect(-2.2 * s, -0.14 * s, 1.08 * s, 0.28 * s);
      g.moveTo(-2.1 * s, 0); g.arc(-2.32 * s, 0, 0.22 * s, 0, TAU);
      break;
    case 'katana':
      // 日本刀：反りのある片刃・切先・楕円の鍔・長い柄
      g.moveTo(-0.9 * s, -0.16 * s); g.quadraticCurveTo(1.3 * s, -0.3 * s, 3.2 * s, -0.78 * s);
      g.quadraticCurveTo(3.0 * s, -0.42 * s, 2.7 * s, -0.36 * s);
      g.quadraticCurveTo(1.2 * s, 0.1 * s, -0.9 * s, 0.14 * s); g.closePath();
      g.moveTo(-0.92 * s, 0); g.ellipse(-1.02 * s, 0, 0.13 * s, 0.5 * s, 0, 0, TAU);
      g.rect(-2.55 * s, -0.15 * s, 1.42 * s, 0.3 * s);
      break;
    case 'shuriken':
      // 手裏剣：四方の刃。中央に穴
      for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, rr = i % 2 ? 0.46 * s : 1.75 * s; i ? g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : g.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); }
      g.closePath();
      g.moveTo(0.26 * s, 0); g.arc(0, 0, 0.26 * s, 0, TAU, true);
      break;
    case 'spear':
      // 槍：長い柄と木の葉形の穂先
      g.rect(-3.4 * s, -0.09 * s, 4.4 * s, 0.18 * s);
      g.rect(0.9 * s, -0.22 * s, 0.32 * s, 0.44 * s);
      g.moveTo(1.2 * s, 0); g.quadraticCurveTo(1.9 * s, -0.55 * s, 3.3 * s, 0); g.quadraticCurveTo(1.9 * s, 0.55 * s, 1.2 * s, 0); g.closePath();
      break;
    case 'arrow':
      // 矢：細い矢柄・鏃・矢羽
      g.rect(-2.8 * s, -0.06 * s, 4.2 * s, 0.12 * s);
      g.moveTo(1.4 * s, -0.3 * s); g.lineTo(2.4 * s, 0); g.lineTo(1.4 * s, 0.3 * s); g.closePath();
      g.moveTo(-2.9 * s, 0); g.lineTo(-2.3 * s, -0.4 * s); g.lineTo(-1.8 * s, -0.4 * s); g.lineTo(-2.3 * s, 0); g.lineTo(-1.8 * s, 0.4 * s); g.lineTo(-2.3 * s, 0.4 * s); g.closePath();
      break;
    case 'scythe':
      // 大鎌：柄と、大きく反った三日月の刃
      g.rect(-2.6 * s, -0.08 * s, 3.4 * s, 0.16 * s);
      g.moveTo(0.8 * s, -0.1 * s); g.quadraticCurveTo(2.6 * s, -0.4 * s, 2.2 * s, -2.2 * s);
      g.quadraticCurveTo(1.9 * s, -0.9 * s, 0.5 * s, 0.1 * s); g.closePath();
      break;
    case 'axe':
      // 斧：短い柄と、扇形の重い刃
      g.rect(-2.2 * s, -0.12 * s, 3.2 * s, 0.24 * s);
      g.moveTo(0.4 * s, -0.2 * s); g.lineTo(1.1 * s, -1.2 * s); g.quadraticCurveTo(1.9 * s, 0, 1.1 * s, 1.2 * s); g.lineTo(0.4 * s, 0.2 * s); g.closePath();
      break;
    case 'hammer':
      // 槌：太い柄と、四角い大きな頭
      g.rect(-2.2 * s, -0.13 * s, 3.0 * s, 0.26 * s);
      g.rect(0.6 * s, -0.95 * s, 1.1 * s, 1.9 * s);
      break;
    case 'chakram':
      // 円月輪：刃の付いた輪
      for (let i = 0; i < 16; i++) { const a = i * TAU / 16, rr = i % 2 ? 1.25 * s : 1.5 * s; i ? g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : g.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); }
      g.closePath();
      g.moveTo(0.85 * s, 0); g.arc(0, 0, 0.85 * s, 0, TAU, true);
      break;
    case 'castle':
      // 城：狭間（凹凸）の付いた石の城壁
      g.moveTo(-1.4 * s, 0.9 * s); g.lineTo(-1.4 * s, -0.9 * s);
      for (let i = 0; i < 4; i++) { const x0 = -1.4 * s + i * 0.7 * s; g.lineTo(x0, -1.25 * s); g.lineTo(x0 + 0.35 * s, -1.25 * s); g.lineTo(x0 + 0.35 * s, -0.9 * s); g.lineTo(x0 + 0.7 * s, -0.9 * s); }
      g.lineTo(1.4 * s, 0.9 * s); g.closePath();
      break;
    case 'orb':
      g.arc(0, 0, 1.05 * s, 0, TAU);
      break;
    case 'shard':
      g.moveTo(2.2 * s, 0); g.lineTo(0, -0.7 * s); g.lineTo(-1.6 * s, 0); g.lineTo(0, 0.7 * s); g.closePath();
      break;
    default:
      // 針：細い結晶の棘
      g.moveTo(2.5 * s, 0); g.lineTo(-1.6 * s, -0.3 * s); g.lineTo(-1.15 * s, 0); g.lineTo(-1.6 * s, 0.3 * s); g.closePath();
  }
}
// 刃の光る線（切れる縁・樋・刃文）
function weaponEdge(g, shape, s) {
  g.beginPath();
  switch (shape) {
    case 'blade': g.moveTo(-0.8 * s, 0); g.lineTo(2.6 * s, 0); break;
    case 'katana': g.moveTo(-0.8 * s, 0.08 * s); g.quadraticCurveTo(1.2 * s, 0.02 * s, 2.8 * s, -0.4 * s); break;
    case 'shuriken': for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; g.moveTo(Math.cos(a) * 0.5 * s, Math.sin(a) * 0.5 * s); g.lineTo(Math.cos(a) * 1.6 * s, Math.sin(a) * 1.6 * s); } break;
    case 'spear': g.moveTo(1.3 * s, 0); g.lineTo(3.1 * s, 0); break;
    case 'orb': g.arc(-0.2 * s, -0.25 * s, 0.6 * s, Math.PI * 1.05, Math.PI * 1.6); break;
    case 'arrow': g.moveTo(1.5 * s, 0); g.lineTo(2.3 * s, 0); break;
    case 'scythe': g.moveTo(0.7 * s, 0); g.quadraticCurveTo(1.9 * s, -0.8 * s, 2.2 * s, -2.1 * s); break;
    case 'axe': g.moveTo(1.1 * s, -1.1 * s); g.quadraticCurveTo(1.85 * s, 0, 1.1 * s, 1.1 * s); break;
    case 'hammer': g.rect(0.7 * s, -0.85 * s, 0.9 * s, 1.7 * s); break;
    case 'chakram': g.arc(0, 0, 1.3 * s, 0, TAU); break;
    case 'castle': g.moveTo(-1.3 * s, -0.2 * s); g.lineTo(1.3 * s, -0.2 * s); g.moveTo(-1.3 * s, 0.4 * s); g.lineTo(1.3 * s, 0.4 * s); g.moveTo(-0.5 * s, -0.2 * s); g.lineTo(-0.5 * s, 0.4 * s); g.moveTo(0.4 * s, 0.4 * s); g.lineTo(0.4 * s, 0.9 * s); break;
    case 'shard': g.moveTo(1.4 * s, 0); g.lineTo(-0.8 * s, 0); break;
    default: g.moveTo(2.2 * s, 0); g.lineTo(-1 * s, 0);
  }
}
// 質で描き分ける：
//   固体＝重い物体。地面に落ちる影、上から光が当たる鋼・石の陰影、黒い輪郭、刃先だけの鋭い反射。光は放たない
//   エネルギー＝揺らぐ光。外へ広がる色の層が脈打ち、白熱した芯が震え、縁に電弧がはぜる
//   完全＝固体の体に、金と白の光の膜が重なる
function drawWeapon(g, shape, s, col, matter, spin, lift = 0) {
  const c = hex(col), solid = matter === 'solid' || matter === true || matter === 'perfect', perfect = matter === 'perfect';
  g.save();
  if (SPINNERS.includes(shape)) g.rotate(spin);
  if (solid) {
    // 影：少し下（地面）に落とし、本体は浮かせて描く
    if (lift) {
      g.save(); g.globalCompositeOperation = 'source-over'; g.translate(lift * 0.35, lift); g.scale(1, 0.9);
      weaponPath(g, shape, s); g.fillStyle = 'rgba(0,0,0,.5)'; g.fill('evenodd'); g.restore();
    }
    weaponPath(g, shape, s);
    g.globalCompositeOperation = 'source-over';
    // 鋼と石：上の面が明るく、下へ沈む。色はわずかに紋の色を混ぜる
    const stone = shape === 'hammer', castle = shape === 'castle';
    const gr = g.createLinearGradient(-s, -s * 1.2, s * 0.6, s * 1.2);
    if (castle) {
      // 城：積んだ石の城壁
      gr.addColorStop(0, '#b3ac9d'); gr.addColorStop(0.45, '#7a7367'); gr.addColorStop(1, '#3a3530');
    } else {
      gr.addColorStop(0, stone ? '#a8a1b3' : '#ece8f2'); gr.addColorStop(0.3, stone ? shade(c, 0.45) : shade(c, 0.7));
      gr.addColorStop(0.62, stone ? '#26222d' : '#2a2532'); gr.addColorStop(1, '#0c0a10');
    }
    g.fillStyle = gr; g.fill('evenodd');
    if (castle) {
      // 石の段と目地
      g.save(); g.clip('evenodd');
      g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = Math.max(0.6, s * 0.04);
      g.beginPath();
      for (let k = 0; k < 4; k++) { const y = -0.9 * s + k * 0.45 * s; g.moveTo(-1.6 * s, y); g.lineTo(1.6 * s, y); for (let j = -3; j <= 3; j++) { const x = j * 0.45 * s + (k % 2) * 0.22 * s; g.moveTo(x, y); g.lineTo(x, y + 0.45 * s); } }
      g.stroke();
      g.restore();
      weaponPath(g, shape, s);
    }
    g.strokeStyle = 'rgba(0,0,0,.85)'; g.lineWidth = Math.max(1, s * 0.12); g.lineJoin = 'round'; g.stroke();
    // 輪郭のすぐ内側に紋の色の縁（光らせずに塗る。暗い床でも形が読める）
    g.strokeStyle = rgba(c, 0.7); g.lineWidth = Math.max(0.8, s * 0.06); g.stroke();
    weaponEdge(g, shape, s);
    g.strokeStyle = stone ? 'rgba(0,0,0,.55)' : 'rgba(255,252,246,.9)'; g.lineWidth = Math.max(0.7, s * 0.07); g.lineCap = 'round'; g.stroke();
    // 紋の色は刻まれた筋としてだけ細く光る
    g.globalCompositeOperation = 'lighter';
    weaponPath(g, shape, s * 0.97);
    g.strokeStyle = rgba(c, perfect ? 0.9 : 0.4); g.lineWidth = Math.max(0.6, s * 0.05); g.stroke();
    if (perfect) {
      const f = 0.6 + Math.sin(world.t * 6 + spin) * 0.25;
      g.strokeStyle = `rgba(255,226,150,${0.55 * f})`; g.lineWidth = s * 0.5; g.stroke();
      g.strokeStyle = `rgba(255,252,240,${0.8 * f})`; g.lineWidth = Math.max(1, s * 0.12); g.stroke();
    }
  } else {
    g.globalCompositeOperation = 'lighter';
    const f = 0.92 + 0.08 * Math.sin((world ? world.t : 0) * 21 + spin);
    // 外へ広がる色の層（太いほど淡い）。乱数でちらつかせず、ゆっくり脈打つ
    weaponPath(g, shape, s);
    g.lineJoin = 'round';
    for (const [w2, a] of [[s * 1.5, 0.07], [s * 0.85, 0.15], [s * 0.42, 0.34]]) { g.strokeStyle = rgba(c, a * f); g.lineWidth = w2 * f; g.stroke(); }
    g.fillStyle = rgba(c, 0.72); g.fill('evenodd');
    // 白熱した芯
    weaponEdge(g, shape, s);
    g.strokeStyle = '#fffaf0'; g.lineWidth = Math.max(1, s * 0.26 * f); g.lineCap = 'round'; g.stroke();
  }
  g.restore();
}
// 飛ぶ術式：形と質で描き分ける。エネルギーは「大きな淡い光・色の層・白熱した芯」の三層でちらつき、固体は重い刃が鈍く光る
function drawFlyer(b) {
  const c = hex(b.col), r = b.size * 1.2, solid = b.matter === 'solid';
  const sp = hyp(b.vx, b.vy) || 1, ux = b.vx / sp, uy = b.vy / sp, ang = Math.atan2(uy, ux);
  const flick = 0.96 + Math.sin(world.t * 19 + b.id) * 0.04, A = Math.min(1, b.age / 0.04 + 0.3);
  ctx.globalAlpha = A * (solid ? 0.45 : 1);
  drawTrail(b, (b.shape === 'orb' ? r * 1.8 : r * 1.1) * (solid ? 0.6 : 1));
  ctx.globalAlpha = A * (solid ? 0.08 : 0.1);
  ctx.drawImage(glow(b.col), b.x - r * 7, b.y - r * 7, r * 14, r * 14);
  ctx.globalAlpha = A;
  if (solid || WEAPONS.includes(b.shape)) {
    // 固体は地面から浮いて飛ぶ（影が下に落ちる）。エネルギーは光の塊
    ctx.save(); ctx.translate(b.x, b.y - (solid ? 8 : 0)); ctx.rotate(ang);
    drawWeapon(ctx, b.shape, r * (SPINNERS.includes(b.shape) ? 1.1 : b.shape === 'castle' ? 0.8 : 0.9) * (solid ? 1.45 : 1), b.col, b.matter, world.t * 22 + b.id, solid ? 10 : 0);
    ctx.restore();
    if (!solid) { const s = r * 1.5 * flick; ctx.drawImage(hotGlow(b.col), b.x - s, b.y - s, s * 2, s * 2); }
  } else if (b.shape === 'orb') {
    // 面取りの宝石を核にし、まわりを圧縮層が回る。毎フレーム乱数の電弧で輪郭を隠さない。
    // 魔素の球：白熱の芯を、二枚の圧縮された光の輪が逆向きに巡る。前には空気を押し分ける弧
    ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(ang);
    drawGem(ctx, r * 1.7, c, 0, 8, world.t, b.id);
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 2; i++) {
      ctx.save(); ctx.rotate(world.t * (i ? -2.4 : 2.4) + i * 1.3);
      ctx.strokeStyle = i ? 'rgba(240,236,250,.9)' : c;
      ctx.globalAlpha = A * (i ? 0.55 : 0.6); ctx.lineWidth = i ? 0.9 : 1.4;
      ctx.beginPath(); ctx.ellipse(0, 0, r * (0.85 + i * 0.22), r * 0.32, 0, 0.3, 5.4); ctx.stroke(); ctx.restore();
    }
    ctx.strokeStyle = rgba(c, 0.5); ctx.lineWidth = 1; ctx.globalAlpha = A * 0.6;
    ctx.beginPath(); ctx.arc(-r * 0.2, 0, r * 1.45, -0.65, 0.65); ctx.stroke(); ctx.restore();
  } else if (b.shape === 'shard') {
    // 結晶：回る光の反射と、刃先の白い光
    ctx.drawImage(glow(b.col), b.x - r * 3, b.y - r * 3, r * 6, r * 6);
    ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(ang);
    // 細長い魔素の光の塊：先が鋭く、芯に白い筋
    ctx.save(); ctx.scale(2.1, 0.8); drawGem(ctx, r * 1.5, c, 0, 6, world.t, b.id); ctx.restore();
    ctx.strokeStyle = 'rgba(255,250,240,.85)'; ctx.lineWidth = r * 0.16; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-r * 1.6, 0); ctx.lineTo(r * 2.2, 0); ctx.stroke();
    ctx.restore();
  } else {
    // 針：光の槍。先端に空気を押し分ける弧が立つ
    ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(ang);
    ctx.drawImage(glow(b.col), -r * 5.5, -r * 1.6 * flick, r * 7.5, r * 3.2 * flick);
    ctx.strokeStyle = rgba(c, 0.55); ctx.lineWidth = Math.max(1, r * 0.2);
    ctx.beginPath(); ctx.arc(-r * 0.6, 0, r * 1.6, -0.85, 0.85); ctx.stroke();
    // 細い光の槍：芯を色の光が包む
    ctx.save(); ctx.translate(-r * 0.6, 0); ctx.scale(2.8, 0.45); drawGem(ctx, r * 1.5, c, 0, 4, world.t, b.id); ctx.restore();
    ctx.strokeStyle = 'rgba(255,250,240,.85)'; ctx.lineWidth = r * 0.14; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-r * 2.4, 0); ctx.lineTo(r * 0.9, 0); ctx.stroke();
    ctx.restore();
    const s = r * 1.6 * flick;
    ctx.drawImage(hotGlow(b.col), b.x - s, b.y - s, s * 2, s * 2);
  }
  ctx.globalAlpha = 1;
}
// 周回の刃：術者のまわりを回る固体の刃。回ってきた弧が淡く光る
function drawOrbiter(s) {
  const o = S.unitById(world, s.owner);
  if (!o) return;
  if (s.shape === 'castle') {
    // 城：術者を囲む城壁の一枚（円の接線の向きに立つ）
    const fade = Math.max(0, Math.min(1, (s.life - s.t) / 0.6, s.age / 0.2));
    drawRampart(s.x, s.y, s.ang + Math.PI / 2, s.size * 1.9, s.size * 0.32, 30, s.col, Math.max(0, s.hp / s.max), s.id, fade);
    return;
  }
  const c = hex(s.col), fade = Math.max(0, Math.min(1, (s.life - s.t) / 0.6, s.age / 0.2));
  ctx.lineCap = 'round';
  // 城壁はほとんど回らないので、回った跡の光は描かない
  if (s.shape !== 'castle' && (s.r.weave !== 2 || s.r.anchor === 'orbit')) for (let k = 0; k < 4; k++) {
    ctx.strokeStyle = rgba(c, 0.32 * fade * (1 - k / 4)); ctx.lineWidth = s.size * (0.7 - k * 0.12);
    ctx.beginPath(); ctx.arc(o.x, o.y, s.orad, s.ang - 0.18 * (k + 1), s.ang - 0.18 * k); ctx.stroke();
  }
  ctx.globalAlpha = 0.18 * fade;
  ctx.drawImage(glow(s.col), s.x - s.size * 4, s.y - s.size * 4, s.size * 8, s.size * 8);
  ctx.globalAlpha = fade;
  ctx.save(); ctx.translate(s.x, s.y - 6); ctx.rotate(s.r.weave === 2 && s.r.anchor !== 'orbit' ? s.ang : s.ang + Math.PI / 2);
  drawWeapon(ctx, s.shape, s.size * (SPINNERS.includes(s.shape) ? 0.9 : s.shape === 'castle' ? 0.62 : 0.78), s.col, s.matter, world.t * 16 + s.id, 8);
  ctx.restore();
  ctx.globalAlpha = 1;
}
// 投射：放物線で飛ぶ。影は地面を進む
function drawLob(s) {
  const h = lobHeight(s), r = 7;
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.beginPath(); ctx.ellipse(s.x, s.y, r * 1.4, r * 0.6, 0, 0, TAU); ctx.fill();
  ctx.globalCompositeOperation = 'lighter';
  drawTrail(s, r * 1.4);
  ctx.drawImage(glow(s.col), s.x - r * 3.8, s.y - h - r * 3.8, r * 7.6, r * 7.6);
  ctx.fillStyle = '#fffaf0'; ctx.beginPath(); ctx.arc(s.x, s.y - h, r * 0.6, 0, TAU); ctx.fill();
}
// 体にかかっている術：固化装甲・硬化・反射の構え・加速・鈍化・観測の印
// 体全体を包む殻：縁ほど光が厚く（球の縁）、中に力場の格子が流れ、光の筋が縁を巡る
function drawShell(cx, cy, rx, ry, col, alpha, lattice, spin) {
  const t = world.t;
  ctx.save(); ctx.translate(cx, cy);
  ctx.globalCompositeOperation = 'lighter';
  ctx.save(); ctx.scale(1, ry / rx);
  const g = ctx.createRadialGradient(0, 0, rx * 0.45, 0, 0, rx);
  g.addColorStop(0, rgba(col, 0.02 * alpha)); g.addColorStop(0.78, rgba(col, 0.1 * alpha)); g.addColorStop(0.96, rgba(col, 0.5 * alpha)); g.addColorStop(1, rgba(col, 0));
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, rx, 0, TAU); ctx.fill();
  ctx.restore();
  if (lattice) {
    // 三方向の平行線でできた格子（六角の力場）。ゆっくり流れる
    ctx.save(); ctx.beginPath(); ctx.ellipse(0, 0, rx * 0.97, ry * 0.97, 0, 0, TAU); ctx.clip();
    ctx.strokeStyle = rgba(col, 0.2 * alpha); ctx.lineWidth = 0.9;
    const h = Math.max(6, rx / 3.2), off = (t * 6) % h, L = ry * 1.2;
    ctx.beginPath();
    for (const ang of [0, Math.PI / 3, -Math.PI / 3]) {
      const ca = Math.cos(ang), sa = Math.sin(ang);
      for (let k = -8; k <= 8; k++) { const d = k * h + off, px = -sa * d, py = ca * d; ctx.moveTo(px - ca * L, py - sa * L); ctx.lineTo(px + ca * L, py + sa * L); }
    }
    ctx.stroke();
    ctx.restore();
  }
  ctx.strokeStyle = rgba(col, 0.75 * alpha); ctx.lineWidth = 1.3;
  ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, TAU); ctx.stroke();
  ctx.strokeStyle = `rgba(255,250,240,${0.75 * alpha})`; ctx.lineWidth = 2;
  for (let i = 0; i < (Math.abs(spin) > 2 ? 3 : 1); i++) { const a0 = t * spin + i * TAU / 3; ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, a0, a0 + 0.6); ctx.stroke(); }
  // 上のつや
  ctx.globalAlpha = 0.3 * alpha;
  ctx.drawImage(glow('#fffaf0'), -rx * 0.55, -ry * 0.92, rx * 0.8, ry * 0.42);
  ctx.restore();
}
function drawStatus(u, s, fy) {
  const t = world.t, cy = fy - 28 * s, rr = 24 * s + 6;
  // 殻の中心と大きさ：足元からフードの上まで包む
  const sy = fy - 29 * s, rx = 21 * s + 5, ry = 36 * s + 5;
  if (u.spawnShield > 0) drawShell(u.x, sy, rx + 3, ry + 3, hex(BONE), 0.3 + Math.sin(t * 4) * 0.08, false, 0.8);
  if (u.hardenT > 0) drawShell(u.x, sy, rx, ry, hex('blue'), 0.6 + u.bodyArmor, true, 1.4);
  if (u.impactT > 0) drawShell(u.x, sy, rx + 5, ry + 5, hex('purple'), 0.9, false, -4);
  ctx.save();
  ctx.translate(u.x, cy);
  if (u.tetherT > 0) {
    ctx.strokeStyle = rgba(hex('blue'), .7); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, 24 * s); ctx.lineTo(u.tetherX - u.x, u.tetherY - cy); ctx.stroke();
    ctx.beginPath(); ctx.arc(u.tetherX - u.x, u.tetherY - cy, 8, 0, TAU); ctx.stroke();
  }
  if (u.slowAmt > 0) {
    ctx.strokeStyle = rgba(hex('blue'), 0.9); ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) { const a = t * 2 + i * TAU / 3; ctx.beginPath(); ctx.arc(Math.cos(a) * rr * 0.8, Math.sin(a) * rr * 0.4 + 20 * s, 5, a, a + Math.PI); ctx.stroke(); }
  }
  if (u.markT > 0) {
    ctx.strokeStyle = rgba(hex('pink'), 0.9); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(0, -46 * s, 8, 0, TAU); ctx.moveTo(-13, -46 * s); ctx.lineTo(13, -46 * s); ctx.moveTo(0, -46 * s - 13); ctx.lineTo(0, -46 * s + 13); ctx.stroke();
  }
  ctx.restore();
}
function drawLabel(u) {
  if (!S.visibleTo(S.hero(world), u)) return;
  const s = u.r / 18, fy = u.y + u.r * 0.35;
  const size = Math.max(12, Math.min(19, 11 + u.r * 0.11)) / Math.max(0.75, cam.z);
  const y = fy - 62 * s - (world.ranking[0] === u && !world.room.practice ? 18 * s : 0) - size * 0.6;
  ctx.font = `700 ${size}px 'Zen Kaku Gothic New', sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(6,5,9,.85)'; ctx.lineJoin = 'round';
  ctx.strokeText(u.name, u.x, y);
  ctx.fillStyle = u.id === world.heroId ? '#fffaf0' : u.dummy ? rgba(hex('yellow'), 0.9) : rgba(BONE, 0.82);
  ctx.fillText(u.name, u.x, y);
  if (u.hp < u.maxHp - 0.5) {
    const w = Math.max(36, u.r * 1.6), h = 4, x = u.x - w / 2, yy = y + size * 0.72;
    ctx.fillStyle = 'rgba(6,5,9,.8)'; ctx.fillRect(x - 1, yy - 1, w + 2, h + 2);
    ctx.fillStyle = hex(u.ink); ctx.fillRect(x, yy, w * Math.max(0, u.hp / u.maxHp), h);
  }
}
// 衝撃で反る → 膝と肩が落ちる → 杖が転がり、裂けた外套が灰にほどける。
function drawDefeat(p) {
  const t = p.t, r = p.r, fall = Math.min(1, Math.max(0, (t - 0.12) / 0.55));
  const ash = Math.max(0, (t - 0.85) / 1.35), col = hex(p.ink);
  ctx.save(); ctx.globalCompositeOperation = 'source-over'; ctx.translate(p.x, p.y);
  ctx.globalAlpha = (1 - ash) * 0.65; ctx.fillStyle = '#030205';
  ctx.beginPath(); ctx.ellipse(0, 5, r * (1 + fall), r * 0.35, 0, 0, TAU); ctx.fill();
  // 杖は体と別に落ちる。接地後は跳ねが減衰する。
  ctx.save(); ctx.translate(r * (0.8 + fall * 0.8) * p.dir, -r * (1 - fall) - Math.abs(Math.sin(fall * 9)) * r * 0.15);
  ctx.rotate(p.dir * fall * 1.5); ctx.globalAlpha = 1 - ash; ctx.strokeStyle = '#827b73'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, -r * 1.4); ctx.lineTo(0, r * 0.5); ctx.stroke(); ctx.restore();
  ctx.save(); ctx.translate(p.dir * r * fall * 0.55, -r * 0.2); ctx.rotate(p.dir * (-0.22 * Math.exp(-t * 8) + fall * 1.12));
  ctx.globalAlpha = 1 - ash;
  const robe = ctx.createLinearGradient(-r, 0, r * 0.5, 0);
  robe.addColorStop(0, cloth(col, 1.3)); robe.addColorStop(0.4, cloth(col, 0.9)); robe.addColorStop(1, '#100d16');
  ctx.fillStyle = robe; ctx.strokeStyle = cloth(col, 1.5); ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.moveTo(-r * 0.38, -r * 1.55);
  ctx.bezierCurveTo(-r * 0.72, -r * 1.05, -r * 0.62, -r * 0.3, -r, r * 0.22);
  for (let i = 0; i < 9; i++) ctx.lineTo(r * (-1 + i * 0.21), r * (i % 2 ? 0.12 : 0.3));
  ctx.bezierCurveTo(r * 0.45, -r * 0.3, r * 0.65, -r, r * 0.35, -r * 1.5);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = 1.5;
  for (let i = -2; i < 3; i++) { ctx.beginPath(); ctx.moveTo(i * r * 0.13, -r * 1.1); ctx.quadraticCurveTo(i * r * 0.11, -r * 0.4, i * r * 0.29, r * 0.16); ctx.stroke(); }
  // 尖ったフードの奥は暗く、顔が伏せられるほど内側の影が広がる。
  ctx.fillStyle = robe; ctx.strokeStyle = cloth(col, 1.5); ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.moveTo(-r * 0.43, -r * 1.3); ctx.bezierCurveTo(-r * 0.6, -r * 1.8, -r * 0.18, -r * 2.12, r * 0.09, -r * 2.2); ctx.quadraticCurveTo(r * 0.56, -r * 1.95, r * 0.42, -r * 1.32); ctx.quadraticCurveTo(0, -r * 1.15, -r * 0.43, -r * 1.3); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#08070c'; ctx.beginPath(); ctx.ellipse(r * 0.05, -r * 1.63, r * 0.28, r * 0.35, fall * 0.4, 0, TAU); ctx.fill();
  // 肩から垂れる腕と、途切れた刺繍の光。
  ctx.strokeStyle = cloth(col, 1.1); ctx.lineWidth = r * 0.22; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-r * 0.45, -r * 1.2); ctx.quadraticCurveTo(-r * (0.9 + fall * 0.2), -r * 0.7, -r * (0.65 + fall * 0.4), -r * 0.15); ctx.stroke();
  ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = col; ctx.lineWidth = 1;
  for (let i = 0; i < 5; i++) { ctx.globalAlpha = Math.max(0, 0.65 - t * 0.38 - i * 0.025); ctx.beginPath(); ctx.moveTo(-r * 0.5, -r * 1.2 + i * r * 0.28); ctx.lineTo(r * 0.2, -r * 0.95 + i * r * 0.24); ctx.stroke(); }
  ctx.restore();
  ctx.globalCompositeOperation = 'source-over';
  for (let i = 0; i < (LOW ? 14 : 30); i++) {
    const q = i / 30, drift = Math.max(0, t - 0.55 - q * 0.35);
    if (!drift) continue;
    ctx.globalAlpha = Math.max(0, Math.min(1, drift * 3) * (1 - ash)); ctx.fillStyle = i % 5 === 0 ? col : '#69616e';
    const x = Math.sin(i * 12.7) * r + drift * (10 + q * 20), y = -q * r * 1.7 - drift * (15 + q * 25);
    ctx.fillRect(x, y, 1.5 + q * 2, 1 + q * 2);
  }
  ctx.restore();
}
function drawPart(p) {
  const f = p.t / p.life, c = hex(p.ink);
  if (p.kind === 'defeat') { drawDefeat(p); return; }
  if (p.kind === 'spark' || p.kind === 'rise') {
    const a = 1 - f * f, s = p.r * (1 - f * 0.6);
    ctx.globalAlpha = a;
    if (p.kind === 'spark' && (p.vx || p.vy)) {
      ctx.strokeStyle = c; ctx.lineWidth = s; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.035, p.y - p.vy * 0.035); ctx.stroke();
    }
    ctx.drawImage(glow(p.ink), p.x - s * 3, p.y - s * 3, s * 6, s * 6);
  } else if (p.kind === 'ring') {
    const e = 1 - Math.pow(1 - f, 3);
    ctx.strokeStyle = c;
    ctx.globalAlpha = (1 - f) * 0.9;
    ctx.lineWidth = p.width * (1 - f * 0.6);
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r0 + (p.r1 - p.r0) * e, 0, TAU); ctx.stroke();
  } else if (p.kind === 'flash') {
    ctx.globalAlpha = (1 - f) * 0.9;
    const s = p.r * (0.7 + f * 0.6);
    ctx.drawImage(glow(p.ink), p.x - s, p.y - s, s * 2, s * 2);
    // 白熱した芯：最初の一瞬だけ強く
    ctx.globalAlpha = Math.max(0, 1 - f * 2.5) * 0.8;
    const s2 = Math.min(60, p.r * 0.28);
    ctx.drawImage(hotGlow(p.ink), p.x - s2, p.y - s2, s2 * 2, s2 * 2);
  } else if (p.kind === 'shock') {
    // 衝撃波：前縁が白く光り、内側に色の熱が薄く残る
    const e = 1 - Math.pow(1 - f, 2.4), rr = Math.max(2, p.r * (0.15 + 0.85 * e)), a = 1 - f;
    const g = ctx.createRadialGradient(p.x, p.y, rr * 0.5, p.x, p.y, rr);
    g.addColorStop(0, rgba(c, 0)); g.addColorStop(0.72, rgba(c, 0.18 * a)); g.addColorStop(0.92, rgba(c, 0.7 * a)); g.addColorStop(0.97, `rgba(255,250,240,${0.85 * a})`); g.addColorStop(1, rgba(c, 0));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(p.x, p.y, rr, 0, TAU); ctx.fill();
  } else if (p.kind === 'flare') {
    // 光芒：横に長く伸びる光の筋と、短い縦の筋
    const a = (1 - f) * (1 - f), len = p.r * (0.6 + f * 0.6), th = Math.max(2, p.r * 0.05);
    ctx.globalAlpha = a;
    ctx.drawImage(glow(p.ink), p.x - len, p.y - th, len * 2, th * 2);
    ctx.drawImage(hotGlow(p.ink), p.x - len * 0.45, p.y - th * 0.5, len * 0.9, th);
    ctx.globalAlpha = a * 0.5;
    ctx.drawImage(glow(p.ink), p.x - th * 1.2, p.y - len * 0.35, th * 2.4, len * 0.7);
  } else if (p.kind === 'ember') {
    const s = p.r * (1 - f * 0.5);
    ctx.globalAlpha = (1 - f) * (0.55 + Math.random() * 0.45);
    ctx.drawImage(glow(p.ink), p.x - s * 3, p.y - s * 3, s * 6, s * 6);
    ctx.fillStyle = '#fffaf0'; ctx.fillRect(p.x - s * 0.45, p.y - s * 0.45, s * 0.9, s * 0.9);
  } else if (p.kind === 'arc') {
    // 電弧：毎回ちがう折れ線。色の太い線に白い細い芯
    const dx = p.x2 - p.x, dy = p.y2 - p.y, L = hyp(dx, dy) || 1, nx = -dy / L, ny = dx / L;
    const pts = [p.x, p.y];
    for (let i = 1; i < 5; i++) { const q = i / 5, off = (Math.random() - 0.5) * L * 0.45; pts.push(p.x + dx * q + nx * off, p.y + dy * q + ny * off); }
    pts.push(p.x2, p.y2);
    ctx.globalAlpha = 1 - f; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const [w, st] of [[p.w * 3, rgba(c, 0.45)], [p.w * 0.7, '#fffaf0']]) {
      ctx.strokeStyle = st; ctx.lineWidth = w;
      ctx.beginPath(); ctx.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]); ctx.stroke();
    }
  } else if (p.kind === 'circle') {
    const open = Math.min(1, f / 0.25), a = f < 0.6 ? 1 : 1 - (f - 0.6) / 0.4;
    ctx.save();
    ctx.translate(p.x, p.y); ctx.rotate(p.rot + f * 1.2);
    ctx.globalAlpha = a * 0.9;
    ctx.strokeStyle = c; ctx.lineWidth = 1.8;
    const rr = p.r * (0.6 + open * 0.4);
    ctx.beginPath(); ctx.arc(0, 0, rr, 0, TAU * open); ctx.stroke();
    ctx.lineWidth = 1.3;
    if (open >= 1) {
      runeRing(ctx, rr * 0.8, 10, Math.max(2.5, rr * 0.07), p.rune);
      ctx.beginPath();
      for (let i = 0; i < 6; i++) { const an = i * TAU / 6; ctx.moveTo(0, 0); ctx.lineTo(Math.cos(an) * rr * 0.62, Math.sin(an) * rr * 0.62); }
      ctx.stroke();
    }
    ctx.restore();
  } else if (p.kind === 'beam') {
    // 光線：一本の光。外の淡い光 → 色の層 → 白熱の芯。撃った瞬間だけ太く、消えるときは細く締まって消える。
    // 縁を乱数で震わせず、芯に沿って流れる明るさの波で、力が流れ続けているように見せる
    const a = f < 0.06 ? 1 : Math.pow(1 - (f - 0.06) / 0.94, 1.5);
    const w0 = p.w * (f < 0.1 ? 1.45 - f * 4.5 : Math.max(0.15, 1 - (f - 0.1) * 0.95)) * (1 + 0.04 * Math.sin(p.t * 70 + (p.seed || 0)));
    ctx.lineCap = 'round';
    const line = () => { ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x2, p.y2); ctx.stroke(); };
    for (const [w, al] of [[w0 * 6, 0.06], [w0 * 2.8, 0.18], [w0 * 1.4, 0.55]]) { ctx.strokeStyle = rgba(c, al * a); ctx.lineWidth = w; line(); }
    ctx.strokeStyle = `rgba(255,251,244,${a})`; ctx.lineWidth = Math.max(1.5, w0 * 0.42); line();
    // 流れる光：芯に沿って明るい帯が先へ走る
    const dx = p.x2 - p.x, dy = p.y2 - p.y;
    ctx.strokeStyle = `rgba(255,255,255,${0.32 * a})`; ctx.lineWidth = w0 * 1.1;
    for (let k = 0; k < 2; k++) {
      const q = (p.t * 2.6 + k * 0.5 + (p.seed || 0)) % 1, q0 = Math.max(0, q - 0.14);
      ctx.beginPath(); ctx.moveTo(p.x + dx * q0, p.y + dy * q0); ctx.lineTo(p.x + dx * q, p.y + dy * q); ctx.stroke();
    }
    // 両端の白熱
    ctx.globalAlpha = a;
    const s1 = w0 * 2.4, s2 = w0 * 3.2;
    ctx.drawImage(hotGlow(p.ink), p.x - s1, p.y - s1, s1 * 2, s1 * 2);
    ctx.drawImage(hotGlow(p.ink), p.x2 - s2, p.y2 - s2, s2 * 2, s2 * 2);
  } else if (p.kind === 'bolt') {
    ctx.globalAlpha = 1 - f; ctx.strokeStyle = c; ctx.lineWidth = p.w;
    ctx.beginPath(); ctx.moveTo(p.x, p.y);
    for (let i = 1; i < 7; i++) { const k = i / 7; ctx.lineTo(p.x + (p.x2 - p.x) * k + Math.sin(p.seed + i * 3) * 14, p.y + (p.y2 - p.y) * k + Math.cos(p.seed + i * 2) * 14); }
    ctx.lineTo(p.x2, p.y2); ctx.stroke();
  } else if (p.kind === 'streak' || p.kind === 'slash' || p.kind === 'glitch') {
    ctx.globalAlpha = (1 - f) * (p.kind === 'glitch' ? 0.9 : 0.8);
    ctx.strokeStyle = p.kind === 'slash' ? '#fffaf0' : c; ctx.lineWidth = p.w * (1 - f * 0.7); ctx.lineCap = p.kind === 'glitch' ? 'butt' : 'round';
    const k = p.kind === 'slash' ? Math.min(1, f * 4) : 1;
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + (p.x2 - p.x) * k, p.y + (p.y2 - p.y) * k); ctx.stroke();
    if (p.kind === 'slash') { ctx.strokeStyle = rgba(c, 0.6 * (1 - f)); ctx.lineWidth = p.w * 3; ctx.stroke(); }
  } else if (p.kind === 'drain') {
    const e = f * f;
    const x = p.x + (p.tx - p.x) * e, y = p.y + (p.ty - p.y) * e;
    ctx.globalAlpha = 1 - f * 0.5;
    ctx.drawImage(glow(p.ink), x - 10, y - 10, 20, 20);
  } else if (p.kind === 'gem') {
    // 宝石の欠片：面が光を返し、消える直前にもう一度きらりと光る
    ctx.save(); ctx.translate(p.x, p.y); ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = f < 0.75 ? 1 : (1 - f) / 0.25;
    drawGem(ctx, p.r, c, p.rot, p.n, p.t * 1.4, p.x);
    ctx.restore();
  } else if (p.kind === 'shard') {
    // 結晶の欠片：回りながら飛び、光を返す
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
    ctx.globalAlpha = 1 - f;
    ctx.fillStyle = rgba(c, 0.9);
    ctx.beginPath(); ctx.moveTo(0, -p.r); ctx.lineTo(p.r * 0.45, 0); ctx.lineTo(0, p.r); ctx.lineTo(-p.r * 0.45, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = `rgba(255,250,240,${0.8 * (1 - f)})`;
    ctx.beginPath(); ctx.moveTo(0, -p.r * 0.6); ctx.lineTo(p.r * 0.18, 0); ctx.lineTo(0, p.r * 0.2); ctx.closePath(); ctx.fill();
    ctx.restore();
  } else if (p.kind === 'hex') {
    ctx.save(); ctx.translate(p.x, p.y);
    ctx.globalAlpha = (1 - f) * 0.8; ctx.strokeStyle = c; ctx.lineWidth = 1.5;
    const rr = p.r * (0.7 + f * 0.4);
    for (let k = 0; k < 2; k++) { ctx.beginPath(); for (let i = 0; i <= 6; i++) { const a = i * TAU / 6 + k * 0.52, x = Math.cos(a) * rr * (1 - k * 0.4), y = Math.sin(a) * rr * (1 - k * 0.4); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke(); }
    ctx.restore();
  } else if (p.kind === 'swirl') {
    // 渦：外から中心へ巻き込まれる光
    const rr = p.r * (1 - f), a = p.a0 + f * 5;
    const x = p.x + Math.cos(a) * rr, y = p.y + Math.sin(a) * rr * 0.6;
    ctx.globalAlpha = Math.min(1, f * 3) * (1 - f * 0.3);
    ctx.drawImage(glow(p.ink), x - p.size * 3, y - p.size * 3, p.size * 6, p.size * 6);
  } else if (p.kind === 'petal') {
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
    ctx.globalAlpha = 1 - f * f;
    ctx.fillStyle = c;
    ctx.beginPath(); ctx.ellipse(0, 0, p.r, p.r * 0.45, 0, 0, TAU); ctx.fill();
    ctx.restore();
  } else if (p.kind === 'muzzle') {
    // 前を向いた小さな陣：狙いの向きに傾いた輪が開き、刻みが灯って、外へ広がりながら消える
    const open = 1 - Math.pow(1 - Math.min(1, f / 0.35), 3), a = f < 0.5 ? 1 : 1 - (f - 0.5) / 0.5, rr = p.r * (0.55 + open * 0.55 + f * 0.25);
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.scale(0.34, 1);
    ctx.globalAlpha = a; ctx.strokeStyle = c; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(0, 0, rr, 0, TAU); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,250,240,.85)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(0, 0, rr * 0.72, -open * Math.PI, open * Math.PI); ctx.stroke();
    ctx.strokeStyle = rgba(c, 0.8); ctx.lineWidth = 1.1;
    ctx.beginPath();
    for (let i = 0; i < 12; i++) { const an = i / 12 * TAU + f * 2; ctx.moveTo(Math.cos(an) * rr * 0.8, Math.sin(an) * rr * 0.8); ctx.lineTo(Math.cos(an) * rr * 0.92, Math.sin(an) * rr * 0.92); }
    ctx.stroke();
    ctx.globalAlpha = a * 0.5; ctx.drawImage(glow(p.ink), -rr * 1.3, -rr * 1.3, rr * 2.6, rr * 2.6);
    ctx.restore();
  } else if (p.kind === 'glyph') {
    // 放った原理の字が杖先に一瞬浮かぶ
    ctx.globalAlpha = f < 0.2 ? f / 0.2 : 1 - (f - 0.2) / 0.8;
    ctx.font = `900 ${22 + f * 10}px 'Zen Old Mincho', serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = c;
    ctx.fillText(p.text, p.x, p.y - f * 14);
  }
  ctx.globalAlpha = 1;
}
// 亀裂：床に走るひび。最初は光り、やがて黒い筋になる
function drawCrack(d) {
  const f = d.t / d.life, hot = Math.max(0, 1 - d.t / 0.9);
  ctx.save();
  ctx.translate(d.x, d.y);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = `rgba(0,0,0,${0.55 * (1 - f)})`; ctx.lineWidth = 3;
  for (const l of d.lines) { ctx.beginPath(); l.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke(); }
  if (hot > 0) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = rgba(hex(d.ink), hot * 0.9); ctx.lineWidth = 1.4;
    for (const l of d.lines) { ctx.beginPath(); l.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke(); }
  }
  ctx.restore();
}
function drawText(t) {
  const f = t.t / t.life, s = t.size / Math.max(0.7, cam.z) * (f < 0.15 ? 1 + (0.15 - f) * 3 : 1);
  ctx.globalAlpha = f > 0.6 ? 1 - (f - 0.6) / 0.4 : 1;
  ctx.font = `900 ${s}px 'Zen Old Mincho', serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(6,5,9,.85)';
  ctx.strokeText(t.text, t.x, t.y);
  ctx.fillStyle = hex(t.ink); ctx.fillText(t.text, t.x, t.y);
  ctx.globalAlpha = 1;
}
// 吹き出し：詠唱は細い字、勝利宣言は金の縁、断末魔は薔薇色の縁
function drawBubble(b) {
  const f = b.t / b.life, a = f < 0.08 ? f / 0.08 : f > 0.8 ? (1 - f) / 0.2 : 1;
  const s = b.r / 18, zc = Math.max(0.7, cam.z);
  const size = (b.kind === 'chant' ? 13 : 15) / zc;
  const y = b.y + b.r * 0.35 - 62 * s - 34 / zc - (b.kind === 'death' ? -40 * s : 0) - f * (b.kind === 'death' ? 30 : 6);
  ctx.save();
  ctx.globalAlpha = a;
  ctx.font = `${b.kind === 'chant' ? 700 : 900} ${size}px ${b.kind === 'chant' ? "'Zen Old Mincho', serif" : "'Zen Kaku Gothic New', sans-serif"}`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const text = b.text.length > 24 ? b.text.slice(0, 23) + '…' : b.text;
  const w = ctx.measureText(text).width + 18 / zc, h = size + 12 / zc;
  const edge = b.kind === 'win' ? hex('yellow') : b.kind === 'death' ? hex('pink') : hex(b.ink);
  if (b.kind !== 'chant') {
    ctx.fillStyle = 'rgba(12,10,17,.9)';
    ctx.fillRect(b.x - w / 2, y - h / 2, w, h);
    ctx.strokeStyle = edge; ctx.lineWidth = 1.5 / zc;
    ctx.strokeRect(b.x - w / 2, y - h / 2, w, h);
    ctx.beginPath(); ctx.moveTo(b.x - 5 / zc, y + h / 2); ctx.lineTo(b.x, y + h / 2 + 7 / zc); ctx.lineTo(b.x + 5 / zc, y + h / 2); ctx.fillStyle = edge; ctx.fill();
    ctx.fillStyle = '#fffaf0';
  } else {
    ctx.lineWidth = 3.5 / zc; ctx.strokeStyle = 'rgba(6,5,9,.85)'; ctx.strokeText(text, b.x, y);
    ctx.fillStyle = rgba(edge, 0.95);
  }
  ctx.fillText(text, b.x, y);
  ctx.restore();
}
// 結界：外は闇に沈み、境界には光る二重の輪
function drawEdge(L, T, R, B) {
  const Rw = world.R;
  if (hyp(cam.x, cam.y) + (vw + vh) / cam.z < Rw) return;
  ctx.save();
  ctx.beginPath();
  ctx.rect(L, T, R - L, B - T);
  ctx.arc(0, 0, Rw, 0, TAU, true);
  ctx.fillStyle = 'rgba(2,1,3,.86)'; ctx.fill();
  const c = '#a3202f';
  for (const [w, col] of [[26, rgba(c, 0.1)], [10, rgba(c, 0.22)], [3, rgba(BONE, 0.75)]]) {
    ctx.strokeStyle = col; ctx.lineWidth = w;
    ctx.beginPath(); ctx.arc(0, 0, Rw, 0, TAU); ctx.stroke();
  }
  ctx.strokeStyle = rgba(BONE, 0.3); ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(0, 0, Rw - 12, 0, TAU); ctx.stroke();
  ctx.restore();
}
// 画面の縁：暗く落とし、体力が減ると薔薇色に染まる。照準も描く
function drawScreenOverlay() {
  if (!LOW) drawAsh();
  ctx.fillStyle = getVignette();
  ctx.fillRect(0, 0, vw, vh);
  if (!LOW && grainPat) {
    // 粒：毎フレームずらして重ねる。ごく薄く
    ctx.save();
    ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = 0.07;
    ctx.translate(-Math.random() * 256, -Math.random() * 256);
    ctx.fillStyle = grainPat; ctx.fillRect(0, 0, vw + 256, vh + 256);
    ctx.restore();
  }
  if (screenFx.a > 0.005) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = rgba(screenFx.col, screenFx.a);
    ctx.fillRect(0, 0, vw, vh);
    ctx.globalCompositeOperation = 'source-over';
  }
  const me = world && S.hero(world);
  if (mode !== 'play' || !me || !me.alive) return;
  const low = 1 - me.hp / me.maxHp, outside = hyp(me.x, me.y) > world.R;
  if (low > 0.55 || outside) {
    const a = outside ? 0.55 : (low - 0.55) / 0.45 * 0.6;
    const g = ctx.createRadialGradient(vw / 2, vh / 2, Math.min(vw, vh) * 0.3, vw / 2, vh / 2, Math.hypot(vw, vh) * 0.6);
    g.addColorStop(0, 'rgba(150,10,30,0)'); g.addColorStop(1, `rgba(150,10,30,${a * (0.8 + Math.sin(world.t * 8) * 0.2)})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, vw, vh);
  }
  // 画面外の相手：画面の縁に方向を示す矢じり。近いほど濃く、上位3人は大きい
  const top3 = world.ranking.slice(0, 3);
  for (const u of world.units) {
    if (!u.alive || u === me || !S.visibleTo(me, u)) continue;
    const dx = u.x - cam.x, dy = u.y - cam.y, d = hyp(dx, dy);
    if (d > 1500) continue;
    const sx = vw / 2 + dx * cam.z, sy = vh / 2 + dy * cam.z;
    if (sx > -12 && sx < vw + 12 && sy > -12 && sy < vh + 12) continue;
    const a = Math.atan2(dy, dx), hw = vw / 2 - 30, hh = vh / 2 - 30;
    const k = Math.min(hw / Math.max(1e-6, Math.abs(Math.cos(a))), hh / Math.max(1e-6, Math.abs(Math.sin(a))));
    const big = top3.includes(u) ? 1.4 : 1;
    ctx.save();
    ctx.translate(vw / 2 + Math.cos(a) * k, vh / 2 + Math.sin(a) * k); ctx.rotate(a);
    ctx.globalAlpha = 0.25 + 0.6 * (1 - d / 1500);
    ctx.fillStyle = hex(u.ink);
    ctx.beginPath(); ctx.moveTo(10 * big, 0); ctx.lineTo(-6 * big, -7 * big); ctx.lineTo(-3 * big, 0); ctx.lineTo(-6 * big, 7 * big); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  if (touch.active) {
    // 仮想スティック：触れた所に土台の輪、指の位置に芯
    const stick = (st, col) => {
      if (!st) return;
      const dx = st.x - st.ox, dy = st.y - st.oy, d = hyp(dx, dy), k = d > STICK_FULL ? STICK_FULL / d : 1;
      ctx.save();
      ctx.strokeStyle = rgba(BONE, 0.35); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(st.ox, st.oy, STICK_FULL, 0, TAU); ctx.stroke();
      ctx.fillStyle = rgba(col, 0.35); ctx.strokeStyle = rgba(col, 0.9);
      ctx.beginPath(); ctx.arc(st.ox + dx * k, st.oy + dy * k, 26, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.restore();
    };
    stick(touch.move, hex(BONE));
    stick(touch.aim, S.recipeResult(me.spells[heroSlot]).color);
    // 狙っている相手に印
    if (touch.target && touch.target.u.alive) {
      const tx = (touch.target.u.x - cam.x) * cam.z + vw / 2, ty = (touch.target.u.y - cam.y) * cam.z + vh / 2;
      ctx.save(); ctx.translate(tx, ty); ctx.rotate(world.t * 2);
      ctx.strokeStyle = rgba(S.recipeResult(me.spells[heroSlot]).color, 0.95); ctx.lineWidth = 2;
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(0, 0, 30, i * TAU / 4 + 0.2, i * TAU / 4 + 1.2); ctx.stroke(); }
      ctx.restore();
    }
  }
  if (!touch.active) {
    // 照準：いま持っている術の色の小さな陣
    const r = me.spells[heroSlot], col = S.recipeResult(r).color;
    ctx.save();
    ctx.translate(mouse.x, mouse.y);
    ctx.strokeStyle = rgba(BONE, 0.85); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(0, 0, 11, 0, TAU); ctx.stroke();
    ctx.strokeStyle = rgba(col, 0.9);
    ctx.rotate(world.t * 1.5);
    ctx.beginPath();
    for (let i = 0; i < 4; i++) { const a = i * TAU / 4; ctx.moveTo(Math.cos(a) * 15, Math.sin(a) * 15); ctx.lineTo(Math.cos(a) * 21, Math.sin(a) * 21); }
    ctx.stroke();
    ctx.restore();
  }
}

// ═══ 09. 表示（HUD） ════════════════════════════════════════════
let hudT = 0, barKey = '';
function updateHud(dt) {
  hudT -= dt;
  if (hudT > 0) return;
  hudT = 0.1;
  const me = S.hero(world);
  if (!me) return;
  $('hudScore').textContent = fmt(me.mass);
  const alive = world.ranking.length;
  $('hudRank').textContent = me.alive ? `#${me.place || '–'}` : '–';
  $('hudCount').textContent = `/ ${alive}`;
  $('boardRoom').innerHTML = `${escapeHtml(world.room.name)} <small>${L('{0}人', alive)}</small>`;
  $('hudKills').textContent = me.kills;
  const lv = me.level, a0 = lv ? S.xpFor(lv) : 0, a1 = S.xpFor(lv + 1);
  const cap = S.capacityOf(me), next = D.RULES.capacity.find(([l]) => l > lv);
  $('hudLevel').textContent = L('LV {0}・制御容量 {1}', lv, cap) + (next ? L('（LV{0}で{1}）', next[0], next[1]) : '');
  $('hudXp').style.width = lv >= W.level.max ? '100%' : `${Math.min(100, (me.xp - a0) / (a1 - a0) * 100)}%`;
  $('hpBar').style.width = `${Math.max(0, me.hp / me.maxHp * 100)}%`;
  $('mpBar').style.width = `${Math.max(0, me.mp / S.maxMp(me) * 100)}%`;
  $('hpBar').parentElement.classList.toggle('low', me.hp / me.maxHp < 0.3);
  const bb = world.room.special && world.boss && world.boss.alive ? world.boss : null;
  $('bossBar').hidden = !bb;
  if (bb) {
    $('bossName').textContent = `${bb.name}　${D.bosses[bb.boss.stage].title}`;
    $('bossFill').style.width = `${Math.max(0, bb.hp / bb.maxHp * 100)}%`;
    $('bossNote').textContent = bb.boss.counter ? L('解析済み：{0}への対策', D.craft.vessels[bb.boss.counter].name) : L('こちらの術を観測している');
  }
  // 順位表
  const rows = [];
  world.ranking.slice(0, 10).forEach((u, i) => rows.push(boardRow(u, i + 1, u === me)));
  if (me.alive && me.place > 10) rows.push('<li class="gap"></li>', boardRow(me, me.place, true));
  $('board').innerHTML = rows.join('');
  // 術の枠（1〜4）
  const infos = me.spells.map(r => S.spellInfo(me, r));
  const key = infos.map((f, i) => `${f.name}|${f.cost}|${f.misfire}|${heroSlot === i}|${me.mp >= f.cost}`).join(';');
  if (key !== barKey) {
    barKey = key;
    $('spellBar').innerHTML = infos.map((f, i) => {
      const r = me.spells[i];
      const glyphs = r.stages.map((st, j) => D.craft.vessels[st.vessel].glyph + (j < r.stages.length - 1 ? D.craft.thens[st.then].glyph : '')).join('') + (r.link ? '∿' : '');
      return `<button type="button" class="slot${heroSlot === i ? ' on' : ''}${me.mp < f.cost ? ' dry' : ''}${f.misfire ? ' risky' : ''}" data-i="${i}" style="--c:${f.color}" title="${escapeHtml(f.result.desc)}">`
        + `<i class="key">${i + 1}</i><b class="nm">${escapeHtml(f.name)}</b>`
        + `<span class="meta"><span>${glyphs}</span><span>${L('魔力 {0}', f.cost)}</span><span class="${f.misfire ? 'warn' : ''}">${L('容量 {0}/{1}', f.parts, f.cap)}${f.misfire ? L('・暴発 {0}%', Math.round(f.misfire * 100)) : ''}</span></span>`
        + `<span class="chant"></span></button>`;
    }).join('');
  }
  const chant = me.casting ? me.casting.t / me.casting.total : 0;
  [...$('spellBar').children].forEach((b, i) => b.style.setProperty('--p', me.casting && me.casting.slot === i ? chant.toFixed(3) : 0));
  // 糸
  const linked = S.linkedOf(world, me);
  const cmd = linked.filter(S.waitsSignal).length;
  $('threadInfo').hidden = !linked.length;
  $('touchDetonate').hidden = !cmd; $('touchRecall').hidden = !linked.length;
  if (linked.length) $('threadInfo').innerHTML = `<b>${L('糸 {0}', linked.length)}</b>${cmd ? `<span>${L('F 合図（{0}）', cmd)}</span>` : ''}<span>${L('G 回収')}</span>`;
  // 回避
  $('dodgeBtn').style.setProperty('--cd', me.dodgeCd > 0 ? (me.dodgeCd / W.dodge.cd).toFixed(3) : 0);
  $('dodgeBtn').classList.toggle('ready', me.dodgeCd <= 0 && me.mp >= W.dodge.cost);
  // 修練場：与えた威力と、この5秒の毎秒の威力
  $('practice').hidden = !world.room.practice;
  if (world.room.practice) {
    practiceLog.push([world.t, me.dealt]);
    while (practiceLog.length > 2 && world.t - practiceLog[0][0] > 5) practiceLog.shift();
    const [t0, d0] = practiceLog[0], dps = world.t > t0 ? (me.dealt - d0) / (world.t - t0) : 0;
    $('practiceDps').textContent = L('与えた威力 {0}・毎秒 {1}', fmt(me.dealt), dps.toFixed(1));
    $('practiceTaken').textContent = L('受けた威力 {0}・防いだ {1}', fmt(me.taken), me.blocked);
    $('practiceFire').textContent = world.practiceFire ? L('攻撃人形：撃つ') : L('攻撃人形：止める');
    $('practiceFire').setAttribute('aria-pressed', world.practiceFire ? 'true' : 'false');
  }
  drawMini(me);
}
const practiceLog = [];
function boardRow(u, n, you) {
  return `<li class="${you ? 'you' : ''}"><span class="n">${n}</span><span class="dot" style="--c:${hex(u.ink)}"></span><span class="nm">${escapeHtml(u.name)}</span><span>${fmt(u.mass)}</span></li>`;
}
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
$('spellBar').addEventListener('click', e => { const b = e.target.closest('.slot'); if (b) selectSlot(Number(b.dataset.i)); });
$('dodgeBtn').addEventListener('click', () => { const me = S.hero(world); if (me) me.input.dodge = true; });
function drawMini(me) {
  const s = mini.width, c = s / 2, k = (s / 2 - 8) / world.R;
  mctx.clearRect(0, 0, s, s);
  mctx.fillStyle = 'rgba(12,10,17,.9)';
  mctx.beginPath(); mctx.arc(c, c, s / 2 - 3, 0, TAU); mctx.fill();
  mctx.strokeStyle = rgba(BONE, 0.5); mctx.lineWidth = 1.5; mctx.stroke();
  D.principleOrder.forEach((key, i) => {
    const a = -Math.PI / 2 + i * TAU / 6;
    mctx.fillStyle = rgba(hex(D.principles[key].ink), 0.6);
    mctx.beginPath(); mctx.arc(c + Math.cos(a) * world.R * NODE_R * k, c + Math.sin(a) * world.R * NODE_R * k, 3, 0, TAU); mctx.fill();
  });
  mctx.fillStyle = rgba(hex('yellow'), 0.8);
  for (const sp of world.springs) { mctx.beginPath(); mctx.arc(c + sp.x * k, c + sp.y * k, 4, 0, TAU); mctx.fill(); }
  mctx.fillStyle = 'rgba(236,230,216,.14)';
  for (const r of world.rocks) { mctx.beginPath(); mctx.arc(c + r.x * k, c + r.y * k, Math.max(2, r.r * k), 0, TAU); mctx.fill(); }
  // 上位3人と、観測（相干観測）した相手だけ見える
  const shown = new Set(world.ranking.slice(0, 3));
  for (const u of world.units) if (u.alive && u.markT > 0) shown.add(u);
  [...shown].forEach((u, i) => {
    if (u === me || !S.visibleTo(me, u)) return;
    mctx.fillStyle = hex(u.ink);
    mctx.beginPath(); mctx.arc(c + u.x * k, c + u.y * k, Math.max(2.5, 5 - i), 0, TAU); mctx.fill();
  });
  if (me.alive) {
    mctx.fillStyle = '#fffaf0';
    mctx.beginPath(); mctx.arc(c + me.x * k, c + me.y * k, 3.5, 0, TAU); mctx.fill();
    mctx.strokeStyle = hex(me.ink); mctx.lineWidth = 1.5;
    mctx.beginPath(); mctx.arc(c + me.x * k, c + me.y * k, 7, 0, TAU); mctx.stroke();
  }
}
// 撃破の知らせ
function feedKill(e, meId) {
  const p = document.createElement('p');
  if (e.victim === meId) { p.className = 'me-down'; p.innerHTML = e.killerName ? L('{0} に散らされた', `<b>${escapeHtml(e.killerName)}</b>`) : L('結界の外で散った'); }
  else if (e.killer === meId) { p.className = 'mine'; p.innerHTML = L('{0} を散らした', `<b>${escapeHtml(e.victimName)}</b>`); }
  else if (e.killerName) p.innerHTML = `${escapeHtml(e.killerName)} → <b>${escapeHtml(e.victimName)}</b>`;
  else p.innerHTML = L('{0} が結界に散った', `<b>${escapeHtml(e.victimName)}</b>`);
  const feed = $('feed');
  feed.prepend(p);
  while (feed.children.length > 5) feed.lastChild.remove();
  setTimeout(() => p.classList.add('fade'), 5000);
  setTimeout(() => p.remove(), 5600);
}
let toastTimer = 0;
function toast(big, small = '') {
  $('toast').innerHTML = `<span>${escapeHtml(big)}</span>${small ? `<small>${escapeHtml(small)}</small>` : ''}`;
  toastTimer = 1.8;
}

// ═══ 10. ロビーと術式台 ═════════════════════════════════════════
const worlds = {};
function worldFor(key) { return worlds[key] || (worlds[key] = S.createWorld(key)); }
let world = worldFor(D.rooms[profile.room] ? profile.room : 'ichi');
let mode = 'lobby';
function buildLobby() {
  $('nameInput').value = profile.name;
  $('nameInput').addEventListener('input', () => { profile.name = $('nameInput').value.trim().slice(0, 12); saveProfile(); });
  $('inkPick').innerHTML = D.inkOrder.map(k => `<button type="button" role="radio" data-k="${k}" style="--c:${hex(k)}" title="${D.inks[k].name}" aria-label="${D.inks[k].name}"></button>`).join('');
  $('inkPick').addEventListener('click', e => { const b = e.target.closest('button'); if (b) { profile.ink = b.dataset.k; saveProfile(); syncLobby(); } });
  $('crestPick').innerHTML = D.crestOrder.map(k => `<button type="button" role="radio" data-k="${k}" title="${D.crests[k]}" aria-label="${D.crests[k]}"><canvas width="64" height="64"></canvas></button>`).join('');
  $('crestPick').addEventListener('click', e => { const b = e.target.closest('button'); if (b) { profile.crest = b.dataset.k; saveProfile(); syncLobby(); } });
  $('roomList').addEventListener('click', e => { const b = e.target.closest('button'); if (b) { profile.room = b.dataset.k; saveProfile(); world = worldFor(b.dataset.k); syncLobby(); } });
  $('joinBtn').addEventListener('click', () => join());
  $('dojoBtn').addEventListener('click', () => join('dojo'));
  $('practiceForge').addEventListener('click', () => openForge(heroSlot));
  $('practiceLeave').addEventListener('click', leave);
  // 攻撃人形：射（槍・魔弾・日本刀・手裏剣）と砲（光線・斧）が撃ってくる。切り替えると受けた威力を数えなおす
  $('practiceFire').addEventListener('click', () => {
    world.practiceFire = !world.practiceFire;
    const me = S.hero(world);
    if (me) { me.taken = 0; me.blocked = 0; me.hp = me.maxHp; }
    toast(world.practiceFire ? L('攻撃人形が撃ちはじめた') : L('攻撃人形を止めた'), world.practiceFire ? L('受けた威力と、結界で防いだ数を数える（修練場では散らない）') : '');
  });
  $('howBtn').addEventListener('click', () => { $('how').hidden = false; $('howClose').focus(); });
  $('howClose').addEventListener('click', () => { $('how').hidden = true; });
  $('howRules').innerHTML = D.rules.map(r => `<li>${r}</li>`).join('');
  $('howKeys').innerHTML = D.howto.map(([a, b]) => `<tr><th>${a}</th><td>${b}</td></tr>`).join('');
  $('howPrinciples').innerHTML = D.principleOrder.map(k => { const p = D.principles[k], h = D.learning.parts.principle[k]; return `<li style="--c:${hex(p.ink)}"><b>${p.kanji}</b><span>${p.name}</span><em>${h[0]}<br>${h[1]}<br>${h[2]}</em></li>`; }).join('');
  $('howWorld').innerHTML = D.learning.world.map(([title, text]) => `<article><h4>${title}</h4><p>${text}</p></article>`).join('');
  $('howExample').textContent = D.learning.example;
  $('howTutor').addEventListener('click', () => { $('how').hidden = true; startTutor(); });
  // 術と叫び
  $('loadout').addEventListener('click', e => { const b = e.target.closest('[data-i]'); openForge(b ? Number(b.dataset.i) : 0); });
  $('openForge').addEventListener('click', () => openForge(0));
  $('deathForge').addEventListener('click', () => openForge(0));
  for (const [id, key] of [['cryWin', 'win'], ['cryDeath', 'death']]) {
    $(id).value = profile.cries[key];
    $(id).addEventListener('input', () => { profile.cries[key] = $(id).value.slice(0, 40); saveProfile(); });
  }
  $('cryTest').addEventListener('click', () => { unlockAudio(); speak(profile.cries.win, 'win'); speakLater(profile.cries.death, 'death', 2.4); });
  $('againBtn').addEventListener('click', () => join());
  $('lobbyBtn').addEventListener('click', toLobby);
  $('leaveBtn').addEventListener('click', leave);
  $('sfxBtn').addEventListener('click', toggleSfx);
  $('bgmBtn').addEventListener('click', toggleBgm);
  $('voiceBtn').addEventListener('click', toggleVoice);
  $('tutorStart').addEventListener('click', startTutor);
  $('tutorLink').addEventListener('click', startTutor);
  $('tutorSkip').addEventListener('click', () => endTutor(tutor.i === TUTOR.length - 1));
  $('tutorGo').addEventListener('click', () => { endTutor(true); leave(); join(); });
  buildSettings();
  buildForge();
  syncSoundButtons();
  syncLobby();
}
function syncWelcome() { $('welcome').hidden = !!profile.tutorial; }
function syncSoundButtons() {
  $('sfxBtn').classList.toggle('off', !profile.sfx);
  $('bgmBtn').classList.toggle('off', !profile.bgm);
  $('voiceBtn').classList.toggle('off', profile.voiceMode === 'off');
  $('voiceBtn').classList.toggle('name', profile.voiceMode === 'name');
  $('voiceBtn').textContent = profile.voiceMode === 'name' ? L('技') : L('声');
  $('voiceBtn').title = L('声：{0}（V で切り替え）', VOICE_LABEL[profile.voiceMode]);
}
// 設定：声（なし／技名だけ／技名と叫び）・声の種類・音量・光のにじみ
function buildSettings() {
  $('setSfxOn').addEventListener('change', () => { if ($('setSfxOn').checked !== profile.sfx) toggleSfx(); syncSettings(); });
  $('setBgmOn').addEventListener('change', () => { if ($('setBgmOn').checked !== profile.bgm) toggleBgm(); syncSettings(); });
  $('settingsBtn').addEventListener('click', openSettings);
  $('setBtn').addEventListener('click', openSettings);
  $('setClose').addEventListener('click', closeSettings);
  $('setVoiceMode').addEventListener('click', e => { const b = e.target.closest('button'); if (b) setVoiceMode(b.dataset.k); });
  $('setVoiceName').addEventListener('change', () => { profile.voiceURI = $('setVoiceName').value; saveProfile(); voice.jp = null; pickVoice(); });
  $('setVoiceTest').addEventListener('click', () => {
    unlockAudio();
    const named = profile.spells.find(r => r.customName);
    speak(`${named ? named.customName : S.spellName(S.normRecipe(D.presets.beam.r))}${L('！')}`, 'test');
  });
  $('setSfxVol').addEventListener('input', () => { profile.sfxVol = Number($('setSfxVol').value); saveProfile(); setSfxVolume(); syncSettings(); });
  $('setSfxVol').addEventListener('change', () => { unlockAudio(); sfx('cast', 1, 'motion'); });
  $('setBgmVol').addEventListener('input', () => { profile.bgmVol = Number($('setBgmVol').value); saveProfile(); syncSettings(); });
  $('setNextTrack').addEventListener('click', () => { unlockAudio(); nextTrack(); });
  $('setBloom').addEventListener('change', () => { profile.bloom = !!$('setBloom').checked; saveProfile(); });
  // 言語：選ぶと保存して読み込み直す（文字・名前・声をすべてその言語にする）
  $('setLang').innerHTML = [`<option value="auto">${L('自動（ブラウザに合わせる）')}</option>`]
    .concat(Object.keys(LANG_NAMES).filter(k => k === 'ja' || LANGS[k]).map(k => `<option value="${k}">${LANG_NAMES[k]}</option>`)).join('');
  $('setLang').addEventListener('change', () => { profile.lang = $('setLang').value; saveProfile(); location.reload(); });
  $('setQuality').innerHTML = [['auto', L('自動（スマホや重い端末は軽く）')], ['high', L('高い')], ['low', L('軽い（スマホ向け）')]].map(([v, t]) => `<option value="${v}">${t}</option>`).join('');
  $('setQuality').addEventListener('change', () => { profile.quality = $('setQuality').value; perfLow = false; saveProfile(); applyQuality(); });
}
function openSettings() { unlockAudio(); syncSettings(); $('settings').hidden = false; $('setClose').focus(); }
function closeSettings() { $('settings').hidden = true; }
function syncSettings() {
  $('setSfxOn').checked = !!profile.sfx;
  $('setBgmOn').checked = !!profile.bgm;
  for (const b of $('setVoiceMode').children) b.setAttribute('aria-checked', b.dataset.k === profile.voiceMode);
  const list = jaVoices(), cur = voice.jp || pickVoice();
  const label = v => v.name.replace(/^(Microsoft|Google)\s+/, '').replace(/\s*-\s*Japanese.*$/i, '').replace(/\s*\(Japan\)/i, '');
  $('setVoiceName').innerHTML = list.length
    ? list.slice().sort((x, y) => voiceScore(y) - voiceScore(x)).map(v => `<option value="${escapeHtml(voiceId(v))}">${escapeHtml(label(v))}${voiceScore(v) >= 8 ? L('　◆自然') : ''}</option>`).join('')
    : `<option value="">${L('（日本語の声が見つからない）')}</option>`;
  $('setVoiceName').disabled = !list.length;
  if (cur) $('setVoiceName').value = voiceId(cur);
  $('setSfxVol').value = profile.sfxVol; $('setSfxV').textContent = Math.round(profile.sfxVol * 100);
  $('setBgmVol').value = profile.bgmVol; $('setBgmV').textContent = Math.round(profile.bgmVol * 100);
  $('setBloom').checked = !!profile.bloom;
  $('setBloom').disabled = !BLOOM_OK;
  $('setLang').value = profile.lang || 'auto';
  $('setQuality').value = profile.quality || 'auto';
}
function syncLobby() {
  for (const b of $('inkPick').children) b.setAttribute('aria-checked', b.dataset.k === profile.ink);
  for (const b of $('crestPick').children) {
    b.setAttribute('aria-checked', b.dataset.k === profile.crest);
    const c = b.querySelector('canvas'), g = c.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, 64, 64);
    g.fillStyle = '#120f19';
    g.beginPath(); g.arc(32, 32, 28, 0, TAU); g.fill();
    g.strokeStyle = hex(profile.ink); g.lineWidth = 2; g.stroke();
    g.translate(32, 32);
    drawCrest(g, b.dataset.k, 17, hex(profile.ink));
  }
  $('crestName').textContent = D.crests[profile.crest] || '';
  syncRooms();
  syncCareer();
  syncLoadout();
}
function syncRooms() {
  $('roomList').innerHTML = D.roomOrder.map(k => {
    const r = D.rooms[k], w = worlds[k];
    const alive = w ? w.units.filter(u => u.alive).length : r.bots;
    const lead = w && w.ranking[0];
    return `<button type="button" role="radio" data-k="${k}" aria-checked="${k === profile.room}"><b>${r.name}</b><span class="count">${L('{0}人', alive)}</span><span class="desc">${r.note}</span>${lead ? `<span class="lead">${L('首位　{0}　{1}', escapeHtml(lead.name), fmt(lead.mass))}</span>` : ''}</button>`;
  }).join('');
}
function syncCareer() {
  const ti = S.tierOf(profile.points), tier = D.tiers[ti], next = D.tiers[ti + 1];
  $('sealBig').textContent = tier.seal;
  $('tierName').textContent = tier.name;
  $('pointsValue').textContent = fmt(profile.points);
  $('tierBar').style.width = next ? `${(profile.points - tier.min) / (next.min - tier.min) * 100}%` : '100%';
  $('tierNext').textContent = (next ? L('次の「{0}」まで {1} pt', next.name, fmt(next.min - profile.points)) : L('最上位の位階')) + (nextSpecialAt() < Infinity ? L('　／　次の観測まで {0} pt', fmt(Math.max(0, nextSpecialAt() - profile.points))) : '');
  $('statBest').textContent = fmt(profile.best);
  $('statPlace').textContent = profile.bestPlace ? L('{0}位', profile.bestPlace) : '–';
  $('statKills').textContent = fmt(profile.kills);
  $('statRuns').textContent = fmt(profile.runs);
  $('recent').innerHTML = profile.recent.length
    ? profile.recent.slice(0, 5).map(r => `<li><span>${fmt(r.score)}</span><span>${L('{0}位', r.place)}</span><span>${L('撃破 {0}', r.kills)}</span></li>`).join('')
    : L('<li class="empty">まだ入場していない</li>');
}
function syncLoadout() {
  $('loadout').innerHTML = profile.spells.map((r, i) => {
    const f = S.spellInfo(null, r);
    return `<li><button type="button" data-i="${i}" style="--c:${f.color}"><i>${i + 1}</i><b>${escapeHtml(f.name)}</b><span>${L('容量 {0}・魔力 {1}', f.parts, f.cost)}</span></button></li>`;
  }).join('');
}

// ─── 術式台 ───
// 術 ＝ 1〜3段。段ごとに器・軌道・原理の点・力の向き・次の段へ移る条件・質・大きさ・持続・見た目を選ぶ。
// 原理は器そのものと、器に触れたものへ同じ規則で効く。選べない組み合わせは押せず、理由を読める
const forge = { slot: 0, stage: 0, draft: null, msg: '', open: false, advanced: false, help: null, changes: '' };
const CR = D.craft;
const STAGE_ROWS = [
  { id: 'fVessel', key: 'vessel', options: () => CR.vesselOrder.map(k => ({ v: k, big: CR.vessels[k].glyph, sub: CR.vessels[k].name, title: CR.vessels[k].note })) },
  { id: 'fPath', key: 'path', options: () => CR.pathOrder.map(k => ({ v: k, big: '', sub: CR.paths[k].name, title: CR.paths[k].note })) },
  { id: 'fForce', key: 'force', options: () => CR.forceOrder.map(k => ({ v: k, big: '', sub: CR.forces[k].name, title: CR.forces[k].name })) },
  { id: 'fThen', key: 'then', options: () => CR.thenOrder.map(k => ({ v: k, big: CR.thens[k].glyph, sub: CR.thens[k].name, title: CR.thens[k].note })) },
  { id: 'fMatter', key: 'matter', options: () => CR.matterOrder.map(k => ({ v: k, big: CR.matters[k].kanji, sub: CR.matters[k].name, title: CR.matters[k].note })) },
  { id: 'fShape', key: 'look', options: () => [{ v: 'auto', big: '', sub: L('自動'), title: L('器と原理から形を決める') }].concat(D.shapeOrder.map(k => ({ v: k, big: '', sub: D.shapes[k].name, title: L('見た目だけ。性能は原理で決まる') }))) }
];
const cur = () => forge.draft[forge.slot];
const curStage = () => cur().stages[Math.min(forge.stage, cur().stages.length - 1)];
function buildForge() {
  for (const row of STAGE_ROWS) {
    $(row.id).addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b || b.disabled || b.getAttribute('aria-disabled') === 'true') return;
      forge.help = { key: row.key, v: b.dataset.v };
      setStage({ [row.key]: b.dataset.v });
    });
  }
  // 原理の点：0〜3.0のスライダー（0.1刻み）。動かしている間は作りなおさない
  $('fPoints').addEventListener('input', e => {
    const b = e.target.closest('input[data-k]');
    if (!b) return;
    forge.help = { key: 'p', v: b.dataset.k };
    setStage({ p: { ...curStage().p, [b.dataset.k]: Number(b.value) } }, true);
  });
  $('fStages').addEventListener('click', e => { const b = e.target.closest('button[data-si]'); if (b) { forge.stage = Number(b.dataset.si); forge.help = null; renderForge(); } });
  $('fAddStage').addEventListener('click', () => {
    const r = cur();
    if (r.stages.length >= CR.maxStages) return;
    forge.stage = r.stages.length;
    forge.help = { key: 'then', v: r.stages[r.stages.length - 1].then };
    setDraft({ stages: r.stages.concat([{ vessel: 'field', p: { divide: 1 }, time: .5 }]) });
  });
  $('fDelStage').addEventListener('click', () => {
    const r = cur();
    if (r.stages.length <= 1) return;
    const stages = r.stages.filter((_, i) => i !== forge.stage);
    forge.stage = Math.max(0, forge.stage - 1);
    setDraft({ stages });
  });
  $('fLink').addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b || b.getAttribute('aria-disabled') === 'true') return;
    forge.help = { key: 'link', v: b.dataset.v };
    setDraft({ link: b.dataset.v === 'hold' });
  });
  $('fSize').addEventListener('input', () => setStage({ size: Number($('fSize').value) }, true));
  $('fTime').addEventListener('input', () => setStage({ time: Number($('fTime').value) }, true));
  $('fNew').addEventListener('click', () => {
    forge.draft[forge.slot] = S.normRecipe({ v: 3, stages: [{ vessel: 'bolt', p: {} }] });
    forge.stage = 0; forge.help = { key: 'vessel', v: 'bolt' }; forge.changes = '';
    forge.msg = L('白紙の弾から組む。器を選び、原理に点を振ろう');
    renderForge();
  });
  // 詳細を閉じても、質・大きさ・持続・糸の設定は消さない
  $('forgeAdvanced').addEventListener('click', () => { forge.advanced = !forge.advanced; renderForge(); });
  $('fName').addEventListener('input', () => setDraft({ customName: $('fName').value }, true));
  $('forgeSlots').addEventListener('click', e => { const b = e.target.closest('button'); if (b) { forge.slot = Number(b.dataset.i); forge.stage = 0; forge.msg = ''; forge.help = null; renderForge(); } });
  const starters = D.presetStarters;
  for (const [id, list] of [['fPresets', starters], ['fMorePresets', D.presetOrder.filter(k => !starters.includes(k))]]) {
    $(id).innerHTML = list.map(k => `<button type="button" class="chip preset" data-k="${k}" title="${escapeHtml(S.spellName(S.normRecipe(D.presets[k].r)))}">${D.presets[k].label}</button>`).join('');
    $(id).addEventListener('click', e => { const b = e.target.closest('button'); if (b) loadPreset(b.dataset.k); });
  }
  // 達人の流派：Bot が修める4つの術を丸ごと読み込む／一つずつ今の枠へ読み込む
  $('fSchools').innerHTML = D.schools.map((sc, i) => `<button type="button" class="chip preset school" data-i="${i}" title="${escapeHtml(sc.creed + '\n' + sc.spells.map(r => r.customName).join(L('・')))}">${sc.name}</button>`).join('');
  $('fSchools').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    const sc = D.schools[Number(b.dataset.i)];
    forge.draft = sc.spells.map(r => S.normRecipe(r));
    forge.stage = 0;
    forge.msg = L('流派「{0}」の4つの術を読み込んだ（{1}）', sc.name, sc.spells.map(r => r.customName).join(L('・')));
    renderForge();
  });
  $('fMasters').innerHTML = D.schools.map((sc, i) => sc.spells.map((r, j) => `<button type="button" class="chip preset" data-i="${i}" data-j="${j}" title="${escapeHtml(sc.name + '：' + S.recipeResult(S.normRecipe(r)).name)}">${escapeHtml(r.customName)}</button>`).join('')).join('');
  $('fMasters').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    const sc = D.schools[Number(b.dataset.i)], r = sc.spells[Number(b.dataset.j)];
    forge.draft[forge.slot] = S.normRecipe(r);
    forge.stage = 0;
    forge.msg = L('{0}の「{1}」を {2} に読み込んだ', sc.name, r.customName, forge.slot + 1);
    renderForge();
  });
  $('fReset').addEventListener('click', () => { forge.draft = D.defaultSpells.map(r => S.normRecipe(r)); forge.stage = 0; forge.msg = L('初期の4つに戻した'); renderForge(); });
  $('forgeClose').addEventListener('click', closeForge);
  // 部品にふれると、その意味を下に出す
  const help = e => {
    const b = e.target.closest('[data-help]'); if (!b) return;
    $('fHelp').textContent = b.dataset.help;
    // 原理の点は data-k が原理、data-v が点の数
    if (b.dataset.key) { forge.help = { key: b.dataset.key, v: b.dataset.key === 'p' ? b.dataset.k : b.dataset.v }; renderPartHelp(); }
  };
  $('forge').addEventListener('mouseover', help);
  $('forge').addEventListener('focusin', help);
  $('fTry').addEventListener('click', () => { const slot = forge.slot; closeForge(); if (!(mode === 'play' && world.room.practice)) join('dojo'); selectSlot(slot); });
}
function loadPreset(key) {
  forge.draft[forge.slot] = S.normRecipe(D.presets[key].r);
  forge.stage = 0; forge.help = null; forge.changes = '';
  forge.msg = L('作例「{0}」を {1} に読み込んだ', D.presets[key].label, forge.slot + 1);
  renderForge();
}
// 点の表示：整数は「2」、小数は「2.5」
const fmtPt = n => String(Math.round(n * 10) / 10);
// 原理が器そのものに何をするか（この器では効かなければ空）
function selfLine(st, k) {
  const tx = CR.selfText[st.vessel][k];
  if (!tx) return '';
  const count = st.vessel === 'orbit' ? S.orbitCopiesOf(st.p.grow) : S.copiesOf(st.p.grow);
  return tx.split('{n}').join(fmtPt(st.p[k])).split('{c}').join(count);
}
// 原理が触れたものに何をするか
function touchLine(st, k) {
  const n = st.p[k];
  switch (k) {
    case 'motion': return CR.forces[st.force].name;
    case 'bind': return ['bolt', 'ray', 'body', 'orbit'].includes(st.vessel) ? (n >= 3 ? L('術者へつなぎ、足を止める') : L('術者へつなぐ')) : (n >= 3 ? L('中心へつなぎ、足を止める') : L('中心へつなぐ'));
    case 'divide': return n >= 2 ? L('壊し、糸を断つ') : L('壊す');
    case 'convert': return L('魔力を奪う');
    case 'grow': return L('自分の体と壁を直す（相手には効かない）');
    case 'phase': return L('印を付ける（隠れられず、打撃が重くなる）');
  }
  return '';
}
// 1回触れたときの打撃の目安
const STAGE_MUL = { bolt: 1, ray: CR.ray.mul, wall: CR.wall.touch, field: CR.field.burst, body: CR.body.bump, orbit: CR.orbit.touch };
const stageHit = st => S.touchPower(st) * STAGE_MUL[st.vessel] / (['bolt', 'ray'].includes(st.vessel) ? Math.sqrt(S.copiesOf(st.p.grow)) : st.vessel === 'orbit' ? Math.sqrt(S.orbitCopiesOf(st.p.grow) / 2) : 1);
// 段を文章にする
function stageText(r, i) {
  const st = r.stages[i], ks = S.topKeys(st.p);
  const opts = [];
  if (st.vessel === 'bolt') opts.push(CR.paths[st.path].name);
  if (st.vessel !== 'ray' && st.vessel !== 'body') opts.push(CR.matters[st.matter].name);
  let t = L('{0}段目：{1}', i + 1, CR.vessels[st.vessel].name) + (opts.length ? L('（{0}）', opts.join(L('・'))) : '') + L('。');
  const kan = k => `${D.principles[k].kanji}${fmtPt(st.p[k])}`;
  if (!ks.length) t += L('原理なし。素の魔力だけ。');
  else {
    const self = ks.map(k => { const s = selfLine(st, k); return s ? `${kan(k)} ${s}` : ''; }).filter(Boolean);
    if (self.length) t += L('器そのもの：{0}。', self.join(L('／')));
    t += L('触れたもの：{0}。', ks.map(k => `${kan(k)} ${touchLine(st, k)}`).join(L('／')));
  }
  if (st.vessel === 'body' && st.p.phase >= CR.ghost.at) t += L('透けている間は弾も体も素通りするが、魔力が毎秒減る。');
  if (st.vessel === 'body' && st.p.phase > 0 && st.p.grow > 0) t += L('分身を{0}体残す。', Math.max(1, Math.min(CR.clone.max, Math.round(Math.min(st.p.phase, st.p.grow)))));
  t += L('一撃の打撃 約{0}。', Math.round(stageHit(st)));
  if (i < r.stages.length - 1) t += L('{0}、{1}段目を開く。', CR.thens[st.then].name, i + 2);
  return t;
}
function describe(r) {
  let t = r.stages.map((_, i) => stageText(r, i)).join(' ');
  if (r.link) t += L('糸でつながる（誘導・合図 F・回収 G ができるが、維持費がかかる）。');
  return t;
}
// 説明は、マウス・キーボード・タッチで選んだものについて常に読める
function renderPartHelp() {
  const st = curStage(), h = forge.help || { key: 'vessel', v: st.vessel };
  const LP = D.learning.parts;
  let title = '', what = '', use = '', weak = '';
  if (h.key === 'p') {
    const k = h.v, p = D.principles[k], guide = LP.principle[k];
    title = `${p.kanji} ${p.name}`;
    [what, use, weak] = guide;
  } else if (h.key === 'vessel') { title = CR.vessels[h.v].name; [what, use, weak] = LP.vessel[h.v]; }
  else if (h.key === 'then') { title = CR.thens[h.v].name; [what, use, weak] = LP.then[h.v]; }
  else if (h.key === 'path') { title = CR.paths[h.v].name; what = CR.paths[h.v].note; use = L('弾だけが選べる。'); weak = L('追尾は制御容量を1使う。'); }
  else if (h.key === 'matter') { title = CR.matters[h.v].name; what = CR.matters[h.v].note; use = L('固体はエネルギーの構造を、光線はエネルギーの結界を大きく削る。'); weak = L('固体は遅く、エネルギーは固体の構造に弱い。'); }
  else if (h.key === 'force') { title = CR.forces[h.v].name; what = L('動の点で触れたものを動かす向き。弾・線・纏・環の中心は術者、壁は触れた面、円は中心。'); use = L('引けば相手を寄せ、押せば遠ざけ、回せば横へ流す。'); weak = L('動の点がなければ働かない。'); }
  else if (h.key === 'link') { title = L('糸'); [what, use] = [L('放った後も術者とつながる。'), L('追尾の弾を照準へ誘導し、F の合図で次の段を開き、G でほどいて魔力を戻す。')]; weak = L('毎秒魔力を使い、遠すぎると切れる。制御容量を1使う。'); }
  else { title = L('見た目'); what = L('弾と環の形。'); use = L('好みの姿にする。'); weak = L('性能は変わらない。'); }
  $('fHelpTitle').textContent = title;
  $('fHelpWhat').textContent = what; $('fHelpUse').textContent = use; $('fHelpWeak').textContent = weak;
  $('fHelp').textContent = (h.key === 'p' && selfLine(st, h.v) ? L('この器では：{0}', selfLine({ ...st, p: { ...st.p, [h.v]: Math.max(1, st.p[h.v]) } }, h.v)) : '') || blockReason(st, h.key, h.v) || L('部品を選ぶと、この説明が切り替わる。');
}
// 選べない組み合わせの理由
function blockReason(st, key, v) {
  if (key === 'then' && !CR.thensFor[st.vessel].includes(v)) return v === 'break' ? L('壊れる器（弾・面・環・結のある円）だけが選べる。') : v === 'end' || v === 'signal' ? L('線は一瞬で終わるので「触れたら」だけ。') : '';
  if (key === 'then' && v === 'break' && st.vessel === 'field' && !st.p.bind) return L('結の無い円は硬さを持たず、壊れない。結に点を振ろう。');
  if (key === 'matter' && (st.vessel === 'ray' || st.vessel === 'body')) return st.vessel === 'ray' ? L('線は光そのもの。質はエネルギーだけ。') : L('纏は自分の体。質は選ばない。');
  if (key === 'path' && st.vessel !== 'bolt') return L('軌道は弾だけが選べる。');
  if (key === 'look' && st.vessel !== 'bolt' && st.vessel !== 'orbit') return L('見た目は弾と環だけが選べる。');
  if (key === 'link' && v === 'cut' && cur().stages.slice(0, -1).some(s => s.then === 'signal')) return L('「合図で」移る段があるので、糸が要る。');
  return '';
}
function setStage(patch, soft = false) {
  const r = cur();
  setDraft({ stages: r.stages.map((s, i) => i === forge.stage ? { ...s, ...patch } : s) }, soft);
}
// 正規化で他の項目が変わったら、画面で知らせる
function setDraft(patch, soft = false) {
  const before = { ...cur(), ...patch }, normalized = S.normRecipe(before);
  const changed = [];
  normalized.stages.forEach((s, i) => {
    const b = before.stages[i] || {};
    if (b.then && b.then !== s.then) changed.push(L('{0}段目の条件→{1}', i + 1, CR.thens[s.then].name));
    if (b.matter && b.matter !== s.matter) changed.push(L('{0}段目の質→{1}', i + 1, CR.matters[s.matter].name));
  });
  if (!before.link && normalized.link) changed.push(L('糸→つなぐ'));
  forge.changes = changed.length ? L('この組み合わせに合わせて変更：{0}。選べない部品にふれると理由が分かる。', changed.join(L('・'))) : '';
  forge.draft[forge.slot] = normalized;
  forge.stage = Math.min(forge.stage, normalized.stages.length - 1);
  forge.msg = '';
  renderForge(soft);
}
function openForge(slot = 0) {
  forge.slot = slot; forge.stage = 0;
  const me = world && S.hero(world);
  forge.draft = (tutor.on && me ? me.spells : profile.spells).map(r => S.normRecipe(r));
  forge.help = null; forge.changes = '';
  forge.msg = '';
  forge.open = true;
  $('forge').hidden = false;
  renderForge();
  $('forgeClose').focus();
}
function closeForge() {
  if (!forge.open) return;
  forge.open = false;
  // 手ほどきの実験用レシピを、保存した持ち術へ書き込まない
  if (!tutor.on) { profile.spells = forge.draft.map(r => S.normRecipe(r)); saveProfile(); }
  $('forge').hidden = true;
  if (tutor.on && tutor.s) tutor.s.forged = JSON.stringify(forge.draft[0]) !== tutor.s.initialRecipe;
  syncLoadout();
  const me = world && S.hero(world);
  if (mode === 'play' && me && me.alive && world.room.practice) { me.spells = forge.draft.map(r => S.normRecipe(r)); barKey = ''; me.casting = null; }
}
const stageColor = st => { const ks = S.topKeys(st.p); return !ks.length ? '#d9cfbd' : hex(D.principles[ks[0]].ink); };
function renderForge(soft = false) {
  const r = cur(), si = Math.min(forge.stage, r.stages.length - 1), st = r.stages[si], last = si === r.stages.length - 1;
  $('forge').classList.toggle('prima-forge-basic', !forge.advanced);
  $('forgeAdvanced').setAttribute('aria-expanded', forge.advanced);
  $('forgeAdvanced').textContent = forge.advanced ? L('基本に戻る') : L('術式を拡張する');
  $('forgeModeNote').textContent = tutor.on ? L('手ほどきの練習用。保存した4つの術は変更しない。')
    : forge.advanced ? L('質・大きさ・持続・糸を調整する。') : L('器を選び、原理に点を振り、段をつなぐ。詳細を閉じても設定は残る。');
  $('fChanges').textContent = forge.changes;
  $('forgeSlots').innerHTML = forge.draft.map((d, i) => {
    const f = S.spellInfo(null, d);
    return `<button type="button" role="tab" data-i="${i}" aria-selected="${i === forge.slot}" style="--c:${f.color}"><i>${i + 1}</i><b>${escapeHtml(f.name)}</b><span>${L('容量 {0}', f.parts)}</span></button>`;
  }).join('');
  // 段：1段目 → 条件 → 2段目 …
  $('fStages').innerHTML = r.stages.map((s, i) => {
    const ks = S.topKeys(s.p).map(k => D.principles[k].kanji + fmtPt(s.p[k])).join('');
    const tab = `<button type="button" role="tab" data-si="${i}" aria-selected="${i === si}" style="--c:${stageColor(s)}"><i>${L('{0}段目', i + 1)}</i><b>${CR.vessels[s.vessel].glyph} ${CR.vessels[s.vessel].name}</b><span>${ks || L('原理なし')}</span></button>`;
    return tab + (i < r.stages.length - 1 ? `<span class="prima-then" aria-hidden="true">${CR.thens[s.then].glyph}<small>${CR.thens[s.then].name}</small></span>` : '');
  }).join('');
  $('fAddStage').hidden = r.stages.length >= CR.maxStages;
  $('fDelStage').hidden = r.stages.length <= 1;
  $('fDelStage').textContent = L('{0}段目を外す', si + 1);
  $('fStageNote').textContent = r.stages.length >= CR.maxStages ? L('段は最大{0}つ。', CR.maxStages) : L('段を足すと、この術が条件を満たした場所から次の器が開く。');
  // 段の項目
  $('fPathRow').hidden = st.vessel !== 'bolt';
  $('fForceRow').hidden = !st.p.motion;
  $('fThenRow').hidden = last;
  $('fShapeRow').hidden = st.vessel !== 'bolt' && st.vessel !== 'orbit';
  for (const row of STAGE_ROWS) {
    $(row.id).innerHTML = row.options().map(o => {
      const blocked = !!blockReason(st, row.key, o.v) || S.normRecipe({ ...r, stages: r.stages.map((s, i) => i === si ? { ...s, [row.key]: o.v } : s) }).stages[si][row.key] !== o.v;
      const why = blocked ? blockReason(st, row.key, o.v) : '';
      return `<button type="button" class="chip${o.big ? '' : ' plain'}" data-key="${row.key}" data-v="${o.v}" aria-pressed="${st[row.key] === o.v}"${blocked ? ' aria-disabled="true"' : ''} data-help="${escapeHtml(why || o.title)}" title="${escapeHtml(why || o.title)}">${o.big ? `<b>${o.big}</b>` : ''}<span>${o.sub}</span></button>`;
    }).join('');
  }
  // 原理の点（0〜3.0のスライダー）。器そのものへの働きを横に出す。つまみを動かしている間も作りなおさない
  const fp = $('fPoints'), sig = D.principleOrder.map(k => D.principles[k].name).join();
  if (fp.dataset.sig !== sig) {
    fp.dataset.sig = sig;
    fp.innerHTML = D.principleOrder.map(k => {
      const p = D.principles[k];
      return `<div class="prima-pt" data-k="${k}" style="--c:${hex(p.ink)}"><b>${p.kanji}</b><span class="nm">${p.name}</span><span class="pt-ctl"><input type="range" min="0" max="${CR.maxLevel}" step="0.1" data-k="${k}" data-key="p"><output></output></span><em></em></div>`;
    }).join('');
  }
  for (const row of fp.children) {
    const k = row.dataset.k, p = D.principles[k], n = st.p[k], self = selfLine({ ...st, p: { ...st.p, [k]: Math.max(1, n) } }, k);
    const inp = row.querySelector('input');
    row.classList.toggle('on', n > 0);
    if (Number(inp.value) !== n) inp.value = n;
    inp.setAttribute('aria-label', L('{0}を{1}点', p.name, fmtPt(n)));
    inp.dataset.help = L('{0}：器そのもの＝{1}／触れたもの＝{2}', p.name, self || L('この器では働かない'), touchLine(st, k));
    row.querySelector('output').textContent = fmtPt(n);
    row.querySelector('em').innerHTML = `${escapeHtml(self || L('（器には効かない）'))}<br>${escapeHtml(L('触れたもの：{0}', touchLine(st, k)))}`;
  }
  // 大きさ・持続・糸
  $('fSize').max = D.craft.sizeMax[st.vessel] || D.craft.size[1];
  $('fSize').value = st.size; $('fTime').value = st.time;
  $('fSizeV').textContent = `${Math.round(st.size * 100)}%`; $('fTimeV').textContent = `${Math.round(st.time * 100)}%`;
  $('fSize').disabled = st.vessel === 'body'; $('fTime').disabled = st.vessel === 'ray';
  $('fSlideNote').textContent = { bolt: L('弾：大きさは当たりの広さ、持続は射程。剣などは最大3倍の巨剣にできるが、160%を超えると魔力が急に増える。'), ray: L('線：大きさは光の太さ。持続は無い。'), wall: L('面：大きさは長さと硬さ、持続は立っている時間。'), field: L('円：大きさは半径（消費は面積で増える）、持続は残る時間。'), body: L('纏：持続は宿る時間。'), orbit: L('環：大きさは回る半径、持続は回る時間。160%を超えると巨剣になり、魔力が急に増える。') }[st.vessel];
  const needLink = r.stages.slice(0, -1).some(s => s.then === 'signal');
  $('fLink').innerHTML = [['cut', L('切る'), L('放った瞬間に糸を切る。維持費なし')], ['hold', L('つなぐ'), L('誘導・合図・回収ができる。維持費がかかり、制御容量を1使う')]].map(([v, name, note]) => {
    const blocked = v === 'cut' && needLink, why = blocked ? blockReason(st, 'link', v) : note;
    return `<button type="button" class="chip plain" data-key="link" data-v="${v}" aria-pressed="${(v === 'hold') === r.link}"${blocked ? ' aria-disabled="true"' : ''} data-help="${escapeHtml(why)}" title="${escapeHtml(why)}"><span>${name}</span></button>`;
  }).join('');
  if (!soft || document.activeElement !== $('fName')) $('fName').value = r.customName;
  // 結果
  const f = S.spellInfo(null, r), res = f.result;
  $('fResName').textContent = f.name;
  $('fResName').style.setProperty('--c', f.color);
  $('fResBase').textContent = L('器：{0}', r.stages.map((s, i) => CR.vessels[s.vessel].name + (i < r.stages.length - 1 ? ` ${CR.thens[s.then].glyph} ` : '')).join(''));
  $('fResDesc').textContent = res.desc;
  $('fSummary').textContent = describe(r);
  $('fResTags').innerHTML = res.tags.map(t => `<span>${t}</span>`).join('');
  $('fParts').textContent = `${f.parts}`;
  $('fCost').textContent = `${f.cost}`;
  $('fWind').textContent = L('{0}秒', f.windup.toFixed(2));
  $('fPow').textContent = `${Math.round(Math.max(...r.stages.map(stageHit)))}`;
  $('fPow').title = L('いちばん重い段の一撃（増の複製は1発ぶん）。点を重ねるほど共鳴して重くなる');
  $('fReach').textContent = ['bolt', 'ray'].includes(r.stages[0].vessel) ? `${Math.round(f.reach * 100)}%` : '－';
  // 制御容量：レベルごとの暴発率
  $('fCap').innerHTML = D.RULES.capacity.map(([lv, cap]) => {
    const over = f.parts - cap, m = over > 0 ? Math.min(D.RULES.misfire.max, over * D.RULES.misfire.perOverPart) : 0;
    return `<span class="${m ? 'warn' : 'ok'}">${L('LV{0}〜 容量{1}', lv, cap)}${m ? L('・暴発 {0}%', Math.round(m * 100)) : L('・安定')}</span>`;
  }).join('');
  $('forgeMsg').textContent = forge.msg;
  $('fTry').textContent = mode === 'play' && world.room.practice ? L('決定して試す') : L('修練場で試す');
  renderPartHelp();
}
// 見本：段ごとに器が開き、条件を満たした場所から次の段が開く様子を小さな図で見せる
const pv = $('forgePreview'), pctx = pv.getContext('2d');
function drawPreview(time) {
  if (!forge.open) return;
  const r = cur(), g = pctx, Wd = pv.width, Hd = pv.height;
  const per = 1.2, T = per * r.stages.length + 0.6, t = time % T;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.fillStyle = '#0a0810'; g.fillRect(0, 0, Wd, Hd);
  g.strokeStyle = 'rgba(236,230,216,.05)'; g.lineWidth = 1;
  for (let x = 0; x < Wd; x += 24) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, Hd); g.stroke(); }
  const cx = 50, cy = Hd * 0.62, tx = Wd - 70, ty = Hd * 0.46;
  const dot = (x, y, col, rr) => { g.fillStyle = col; g.beginPath(); g.arc(x, y, rr, 0, TAU); g.fill(); };
  const glowAt = (x, y, s, c) => { g.globalCompositeOperation = 'lighter'; g.drawImage(glow(c), x - s, y - s, s * 2, s * 2); g.globalCompositeOperation = 'source-over'; };
  g.strokeStyle = rgba(BONE, .6); g.lineWidth = 1.5; g.beginPath(); g.ellipse(cx, cy + 10, 16, 6, 0, 0, TAU); g.stroke();
  dot(cx, cy - 6, '#1b1724', 10);
  dot(tx, ty, 'rgba(236,230,216,.18)', 12);
  g.strokeStyle = 'rgba(236,230,216,.4)'; g.beginPath(); g.arc(tx, ty, 12, 0, TAU); g.stroke();
  let ox = cx, oy = cy - 6, dir = Math.atan2(ty - oy, tx - ox);
  for (let i = 0; i < r.stages.length; i++) {
    const st = r.stages[i], c = stageColor(st), k = (t - i * per) / per;
    if (k < 0) break;
    const f = Math.min(1, k), fade = k > 1 ? Math.max(0.15, 1 - (k - 1) * 2) : 1;
    // 弾・線は照準へ、面は術者の正面、円は足元、後の段は前の段の続きへ
    const aimX = i ? ox + Math.cos(dir) * 90 : tx, aimY = i ? oy + Math.sin(dir) * 90 : ty;
    let ex = aimX, ey = aimY;
    g.globalAlpha = fade;
    if (st.vessel === 'bolt') {
      const n = S.copiesOf(st.p.grow);
      for (let j = 0; j < n; j++) {
        const off = (j - (n - 1) / 2) * 0.16, a = Math.atan2(aimY - oy, aimX - ox) + off, d = hyp(aimX - ox, aimY - oy);
        let kk = f;
        if (st.path === 'return') kk = f < 0.5 ? f * 2 : 2 - f * 2;
        let x = ox + Math.cos(a) * d * kk, y = oy + Math.sin(a) * d * kk;
        if (st.path === 'arc') y -= Math.sin(f * Math.PI) * 50;
        if (st.path === 'seek') y += Math.sin(f * Math.PI * 2) * 14;
        if (k < 1) { glowAt(x, y, 9, c); g.save(); g.translate(x, y); g.rotate(a); drawWeapon(g, S.visualShapeOf(r, i), 4.5, c, st.matter, t * 30); g.restore(); }
      }
    } else if (st.vessel === 'ray') {
      if (f < 0.5) { g.strokeStyle = rgba(c, 1 - f * 2); g.lineWidth = 4 * st.size; g.beginPath(); g.moveTo(ox, oy); g.lineTo(aimX, aimY); g.stroke(); }
    } else if (st.vessel === 'wall') {
      const wd = 34 + 26 * st.p.motion, wx = i ? ox : ox + Math.cos(dir) * wd, wy = i ? oy : oy + Math.sin(dir) * wd, L2 = 40 * st.size * f + (st.p.motion ? f * 12 : 0);
      g.strokeStyle = c; g.lineWidth = 6 + st.p.bind * 2; g.lineCap = 'round';
      g.beginPath(); g.moveTo(wx - Math.sin(dir) * L2 + Math.cos(dir) * f * 10 * st.p.motion, wy + Math.cos(dir) * L2); g.lineTo(wx + Math.sin(dir) * L2 + Math.cos(dir) * f * 10 * st.p.motion, wy - Math.cos(dir) * L2); g.stroke();
      ex = wx; ey = wy;
    } else if (st.vessel === 'field') {
      const fx = ox + Math.cos(dir) * f * 18 * st.p.motion, fy = oy + Math.sin(dir) * f * 18 * st.p.motion, rr = 30 * st.size;
      g.strokeStyle = rgba(c, 0.9); g.lineWidth = st.p.bind ? 3 : 1.6; g.setLineDash(st.p.bind ? [] : [3, 5]);
      g.beginPath(); g.arc(fx, fy, rr * Math.min(1, f * 3), 0, TAU); g.stroke(); g.setLineDash([]);
      glowAt(fx, fy, rr * (1.2 - f * 0.5), c);
      ex = fx; ey = fy;
    } else if (st.vessel === 'body') {
      g.strokeStyle = c; g.globalAlpha = fade * (st.p.phase ? .3 + .2 * Math.sin(t * 8) : .7);
      g.lineWidth = 2; g.beginPath(); g.arc(cx, cy - 6, 18 + f * 6, 0, TAU); g.stroke();
      ex = cx; ey = cy - 6;
    } else if (st.vessel === 'orbit') {
      const n = S.orbitCopiesOf(st.p.grow), rr = 26 + 8 * st.size;
      for (let j = 0; j < n; j++) {
        const a = t * TAU * (0.6 + st.p.motion * 0.3) + j / n * TAU;
        g.save(); g.translate(cx + Math.cos(a) * rr, cy - 6 + Math.sin(a) * rr); g.rotate(a + Math.PI / 2);
        drawWeapon(g, S.visualShapeOf(r, i), 4, c, st.matter, t * 30); g.restore();
      }
      ex = cx + Math.cos(dir) * rr; ey = cy - 6 + Math.sin(dir) * rr;
    }
    g.globalAlpha = 1;
    // 次の段へ移る所に条件の字を出す
    if (i < r.stages.length - 1 && k >= 0.85 && k < 1.3) {
      g.fillStyle = rgba(BONE, .9); g.font = "700 14px 'Zen Kaku Gothic New', sans-serif"; g.textAlign = 'center';
      g.fillText(CR.thens[st.then].glyph + (st.then === 'signal' ? ' F' : ''), ex, ey - 18);
    }
    if (hyp(ex - ox, ey - oy) > 1) dir = Math.atan2(ey - oy, ex - ox);
    ox = ex; oy = ey;
  }
  if (r.link) { g.strokeStyle = rgba(stageColor(r.stages[0]), .35); g.setLineDash([5, 4]); g.beginPath(); g.moveTo(cx + 8, cy - 18); g.quadraticCurveTo((cx + ox) / 2, (cy + oy) / 2 + 20, ox, oy); g.stroke(); g.setLineDash([]); }
  g.fillStyle = rgba(BONE, .55); g.font = "700 11px 'Zen Kaku Gothic New', sans-serif"; g.textAlign = 'left';
  g.fillText(r.stages.map((s, i) => CR.vessels[s.vessel].name + (i < r.stages.length - 1 ? CR.thens[s.then].glyph : '')).join(' ') + (r.link ? L('・糸') : ''), 10, 16);
}

// ═══ 11. 入場・散った・退出 ═════════════════════════════════════
let run = null, deathReady = false;
function join(roomKey) {
  unlockAudio();
  closeForge();
  if (document.activeElement) document.activeElement.blur();
  const special = roomKey === 'special';
  world = special ? S.createWorld('special', (Date.now() & 0xffffff), { stage: Math.min(profile.special.cleared, D.bosses.length - 1) }) : worldFor(roomKey || profile.room);
  practiceLog.length = 0;
  const me = S.spawnHero(world, { name: profile.name || L('名無し'), ink: profile.ink, crest: profile.crest, tier: S.tierOf(profile.points), skin: profile.special.cleared, spells: profile.spells, cries: profile.cries });
  if (special) {
    // 演算の間：制御容量が育った状態で入り、ボスと向き合って始まる。魔力は少しずつ戻る
    me.level = 12; me.xp = S.xpFor(12); me.mp = S.maxMp(me); me.hp = me.maxHp; me.spawnShield = 1.5;
    me.x = -world.R * 0.5; me.y = 0; me.aim = 0; me.input.aim = 0;
  }
  if (window.PRIMA_AUTO) window.PRIMA_AUTO.join(world, me);
  run = { startT: world.t, ended: false };
  mode = 'play';
  deathReady = false;
  barKey = ''; heroSlot = 0;
  cam.x = me.x; cam.y = me.y;
  $('lobby').hidden = true; $('death').hidden = true; $('how').hidden = true;
  $('hud').hidden = false;
  $('touch').hidden = !touch.active;
  $('feed').innerHTML = '';
  toast(world.room.name, world.room.practice ? L('人形を相手に術を試す。T で術式台、Esc で戻る') : special ? L('{0}。散れば、積んだ位階は0に戻る', D.bosses[world.stage].name) : L('術を放つと入場保護が解ける'));
  // 入場して間もない人には、枠の上に操作の手がかりを出す
  const showHints = !world.room.practice && !special && profile.runs < 3;
  $('hints').hidden = !showHints;
  if (showHints) $('hints').innerHTML = touchy()
    ? `<span>${L('左をなぞって歩く')}</span><span>${L('右をタッチして放つ')}</span><span>${L('下の枠で持ち替え')}</span>`
    : `<span><kbd>${L('左クリック')}</kbd>${L('放つ')}</span><span><kbd>1〜4</kbd>${L('持ち替え')}</span><span><kbd>Space</kbd>${L('回避')}</span><span><kbd>Esc</kbd>${L('退出')}</span>`;
  sfx('join');
  playBgm();
}
// ─── 手ほどき：修練場で実際に操作しながら1段ずつ進む ───
// 実際に成立した術・命中・防御を条件に進める。操作しただけでは達成にならない
const tutor = { on: false, i: 0, doneT: 0, s: null, rocks: null };
const TUTOR = D.learning.tutorial.map(([title, text], i) => ({
  title, text, keys: i >= 2 && i <= 5 ? [L('T で術式台'), L('決定 / Esc'), L('左クリック')] : [L('マウスで狙う'), L('左クリック')],
  touch: i >= 2 && i <= 5 ? [L('上の「術式台」ボタン'), L('画面の右半分をタッチ')] : [L('画面の右半分をタッチ')],
  last: i === 6,
  done: [s => s.casts >= 2 && s.dealt > 0, s => s.blocked > 0, s => s.forged && s.connected && s.dealt > 0,
    s => s.forged && s.orbited, s => s.forged && s.divided && s.wall && s.wall.hp <= 0, s => s.forged && s.chained && s.dealt > 0][i]
}));
function startTutor() {
  endTutor(false);
  join('dojo');
  // 課題の射線をランダムな岩でふさがない。通常の修練場へ戻るときに復元する。
  tutor.rocks = world.rocks; world.rocks = [];
  $('toast').innerHTML = '';
  tutor.on = true; tutor.i = 0; tutor.doneT = 0;
  document.body.classList.add('prima-tutorial');
  prepareTutor(); renderTutor();
}
function prepareTutor() {
  const me = S.hero(world), i = tutor.i;
  if (!me || i === 6) return;
  world.spells = []; world.wards = []; world.zones = []; world.decoys = [];
  world.practiceFire = i === 1;
  me.x = 0; me.y = 0; me.vx = me.vy = 0; me.casting = me.queue = null;
  me.slowT = me.rootT = me.phaseT = 0; me.slowAmt = 0; me.hp = me.maxHp; me.mp = S.maxMp(me); me.spawnShield = 0;
  me.slotCd.fill(0); me.input.cast = false; me.input.mx = me.input.my = 0;
  const kind = i === 1 ? 'shooter' : i === 4 ? 'guard' : i === 5 ? 'walk' : 'still';
  const target = world.units.find(u => u.dummy === kind);
  for (const u of world.units) if (u.dummy) u.alive = u === target;
  if (target) {
    target.x = 340; target.y = 0; target.vx = target.vy = 0; target.home = { x: 340, y: 0 };
    target.casting = target.queue = null; target.slotCd.fill(0); target.hp = target.maxHp; target.spawnShield = 0;
    target.slowT = target.rootT = target.phaseT = 0; target.slowAmt = 0;
    if (i === 1) { target.spells = [0, 1, 2, 3].map(() => S.normRecipe(D.presets.bolt.r)); target.fireT = 1.5; }
  }
  // 1の枠：2段目は石壁、ほかは魔弾から組み替える
  const recipe = i === 1 ? D.presets.stoneWall.r : D.presets.bolt.r;
  me.spells = [recipe, D.presets.bolt.r, D.presets.burst.r, D.presets.stoneWall.r].map(r => S.normRecipe(r));
  selectSlot(0); barKey = '';
  tutor.s = { casts: 0, dealt0: me.dealt || 0, dealt: 0, blocked0: me.blocked || 0, blocked: 0,
    forged: false, connected: false, orbited: false, divided: false, chained: false, wall: null, initialRecipe: JSON.stringify(me.spells[0]) };
  if (i === 4 && target) {
    // 弱った壁を用意し、「破壊した一撃も止まる」ことを体験できるようにする
    target.x = 170;
    const prev = target.spells[0]; target.spells[0] = S.normRecipe(D.presets.stoneWall.r);
    target.input.aim = target.aim = Math.PI; target.input.tx = 110; target.input.ty = 0;
    if (S.beginCast(world, target, 0)) { target.casting.t = target.casting.total; S.release(world, target); }
    target.spells[0] = prev; target.x = 340;
    tutor.s.wall = world.wards.find(g => g.owner === target.id);
    if (tutor.s.wall) { tutor.s.wall.hp = tutor.s.wall.max = 90; tutor.s.wall.life = 120; }
    target.slotCd.fill(999);
  }
}
function tutorEvent(e, meId) {
  const s = tutor.s;
  if (!tutor.on || !s || e.id !== meId || e.type !== 'cast') return;
  s.casts++;
  // 放った術の組み立てで課題を確かめる（結を足した弾・環・分2以上の弾・2段以上）
  const r = S.hero(world)?.spells[S.hero(world).sel];
  if (!r) return;
  const s0 = r.stages[0];
  if (s0.vessel === 'bolt' && s0.p.bind > 0) s.connected = true;
  if (s0.vessel === 'orbit') s.orbited = true;
  if (s0.vessel === 'bolt' && s0.p.divide >= 2) s.divided = true;
  if (r.stages.length >= 2) s.chained = true;
}
function tutorTick(dt) {
  if (!tutor.on) return;
  if (mode !== 'play' || !world.room.practice) { endTutor(false); return; }
  const me = S.hero(world), s = tutor.s, step = TUTOR[tutor.i];
  if (!me || !s) return;
  if (forge.open) return;
  s.dealt = (me.dealt || 0) - s.dealt0;
  s.blocked = (me.blocked || 0) - s.blocked0;
  if (tutor.doneT > 0) { tutor.doneT -= dt; if (tutor.doneT <= 0) { tutor.i++; prepareTutor(); renderTutor(); } return; }
  if (!forge.open && !step.last && step.done(s)) {
    tutor.doneT = 0.9;
    $('tutor').classList.add('done');
    $('tutorBar').style.width = `${(tutor.i + 1) / (TUTOR.length - 1) * 100}%`;
    sfx('level', 0.6);
  }
}
function renderTutor() {
  const st = TUTOR[tutor.i];
  $('tutor').hidden = false; $('tutor').classList.remove('done');
  $('tutorCount').textContent = `${tutor.i + 1} / ${TUTOR.length}`;
  $('tutorTitle').textContent = st.title; $('tutorText').textContent = st.text;
  $('tutorKeys').innerHTML = (touchy() ? st.touch : st.keys).map(k => `<kbd>${escapeHtml(k)}</kbd>`).join('');
  $('tutorBar').style.width = `${tutor.i / (TUTOR.length - 1) * 100}%`;
  $('tutorGo').hidden = !st.last;
  $('tutorSkip').textContent = st.last ? L('修練場に残る') : L('手ほどきを終える');
  if (st.last) { profile.tutorial = true; saveProfile(); }
}
function endTutor(done) {
  const wasOn = tutor.on;
  if (wasOn && forge.open) closeForge();
  tutor.on = false; $('tutor').hidden = true;
  document.body.classList.remove('prima-tutorial');
  if (wasOn && world && world.room.practice) {
    if (tutor.rocks) world.rocks = tutor.rocks;
    tutor.rocks = null;
    world.practiceFire = false; world.spells = []; world.wards = []; world.zones = []; world.decoys = [];
    const me = S.hero(world);
    if (me) { me.spells = profile.spells.map(r => S.normRecipe(r)); me.casting = me.queue = null; barKey = ''; }
    for (const u of world.units) if (u.dummy) {
      const d = D.dummies.find(d => d.kind === u.dummy);
      u.alive = true; u.x = d.x; u.y = d.y; u.home = { x: d.x, y: d.y }; u.slotCd.fill(0);
      u.spells = (d.spells ? d.spells.map(k => D.presets[k].r) : D.defaultSpells).map(r => S.normRecipe(r));
    }
  }
  if (done) { profile.tutorial = true; saveProfile(); }
  syncWelcome();
}
// ─── スペシャルステージ：位階ポイントが節目に達すると、その場で突然「演算の間」へ引き込まれる ───
let specialT = 0, quitT = 0, winT = 0;
const nextSpecialAt = () => profile.special.cleared < D.special.at.length ? D.special.at[profile.special.cleared] : Infinity;
function checkSpecial() {
  if (mode !== 'play' || specialT > 0 || world.room.practice || world.room.special || tutor.on) return;
  const me = S.hero(world);
  if (!me || !me.alive) return;
  const place = me.bestPlace < 99 ? me.bestPlace : (me.place || world.ranking.length);
  if (profile.points + S.runPoints(me.peak, me.kills, place) < nextSpecialAt()) return;
  specialT = 2.6;
  flashScreen('#b784ff', 0.7); shake(18); punch = 0.08;
  toast(L('観測された'), L('何かが、あなたの紋を読んでいる'));
  sfx('bossCall');
}
function startSpecial() {
  const me = S.hero(world);
  if (me && me.alive) {
    endRun(me);
    S.kill(world, me);
    world.events = world.events.filter(e => !(e.type === 'kill' && e.victim === me.id));
  }
  join('special');
}
// 演算の間で散った：積んだ位階は0に戻る
function specialLost() {
  const lost = profile.points;
  profile.points = 0; profile.special.deaths++;
  saveProfile();
  return lost;
}
function specialWon() {
  profile.special.cleared = Math.min(D.special.at.length, profile.special.cleared + 1);
  winT = 5;
  saveProfile();
  flashScreen('#e6d9ff', 0.6);
  toast(L('演算体は沈黙した'), profile.special.cleared >= D.special.at.length ? L('すべての演算の間を越えた。黒曜の紋をまとう') : L('黒曜の紋が刻まれた。次の節目で、また観測される'));
  sfx('level');
}
// 1回の入場を記録して位階ポイントにする
function endRun(me) {
  if (!run || run.ended || world.room.practice || world.room.special) return null;
  run.ended = true;
  const survived = world.t - run.startT;
  const place = me.bestPlace < 99 ? me.bestPlace : (me.place || world.ranking.length);
  const pts = S.runPoints(me.peak, me.kills, place);
  const before = S.tierOf(profile.points);
  profile.points += pts;
  profile.best = Math.max(profile.best, Math.floor(me.peak));
  profile.bestPlace = profile.bestPlace ? Math.min(profile.bestPlace, place) : place;
  profile.kills += me.kills;
  profile.runs++;
  profile.time += survived;
  profile.recent.unshift({ score: Math.floor(me.peak), place, kills: me.kills, room: world.roomKey, at: Date.now() });
  profile.recent = profile.recent.slice(0, 8);
  saveProfile();
  return { pts, place, survived, up: S.tierOf(profile.points) > before };
}
function heroDown(e) {
  const me = world.units.find(u => u.id === world.heroId);
  if (!me) return;
  sfx('down');
  const special = world.room.special;
  const res = special ? null : endRun(me);
  const lost = special ? specialLost() : 0;
  mode = 'dead';
  setTimeout(() => {
    if (mode !== 'dead') return;
    const tier = D.tiers[S.tierOf(profile.points)];
    $('deathBy').innerHTML = e.killerName ? L('{0} に散らされた', `<b>${escapeHtml(e.killerName)}</b>`) : L('結界の外で構造が崩れた');
    $('deathCry').textContent = e.deathCry ? `「${e.deathCry}」` : '';
    $('dScore').textContent = fmt(me.peak);
    $('dPlace').textContent = L('{0}位', res ? res.place : '–');
    $('dKills').textContent = me.kills;
    const s = Math.floor(res ? res.survived : 0);
    $('dTime').textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    $('dPoints').textContent = special ? `−${fmt(lost)}` : `+${fmt(res ? res.pts : 0)}`;
    $('dSeal').textContent = tier.seal;
    $('dTier').textContent = special ? L('位階は0に戻った。{0}・計 {1} pt', tier.name, fmt(profile.points)) : L('{0}・計 {1} pt', tier.name, fmt(profile.points));
    $('dRankUp').hidden = !(res && res.up);
    $('death').hidden = false;
    deathReady = true;
    $('againBtn').focus();
  }, 2300);
}
function leave() {
  if (mode !== 'play') return;
  const me = S.hero(world);
  // 演算の間から逃げることは、散ることと同じ。うっかり押さないよう、もう一度押させる
  if (me && me.alive && world.room.special && !winT) {
    if (quitT <= 0) { quitT = 3; toast(L('もう一度 Esc で退出'), L('逃げれば、位階は0に戻る')); return; }
    specialLost();
    S.kill(world, me);
    world.events = world.events.filter(e => !(e.type === 'kill' && e.victim === me.id));
    world = worldFor(profile.room); toLobby(); return;
  }
  if (me && me.alive && world.room.practice) { const w = world; w.units.splice(w.units.indexOf(me), 1); world = worldFor(profile.room); toLobby(); return; }
  if (me && me.alive) {
    endRun(me);
    // 退出した術者の魔素はその場に散る（③ 散逸）
    S.kill(world, me);
    world.events = world.events.filter(e => !(e.type === 'kill' && e.victim === me.id));
  }
  toLobby();
}
function toLobby() {
  mode = 'lobby';
  if (window.PRIMA_AUTO) window.PRIMA_AUTO.lobby();
  $('death').hidden = true; $('hud').hidden = true; $('lobby').hidden = false;
  syncLobby();
  syncWelcome();
  playBgm();
}

// ═══ 12. 毎フレーム ═════════════════════════════════════════════
let last = 0, lobbyT = 0, spectate = null, clock = 0, debugZoom = 1;
// 1フレームの例外でゲームを止めない。先に次の描画を予約し、例外は一度だけ知らせる
let crashed = false;
const perf = { t: 0, n: 0, done: false };
function frame(now) {
  requestAnimationFrame(frame);
  const raw = Math.max(0, (now - (last || now)) / 1000), dt = Math.min(0.05, raw);
  last = now;
  try { tick(dt); } catch (err) {
    if (!crashed) { crashed = true; console.error(err); toast(L('表示で問題が起きた'), L('このまま遊べるが、続くときは再読み込みしてほしい')); }
  }
  // 重い端末：戦闘中の平均が 36fps を下回ったら、光のにじみを一度だけ自動で切る
  if (mode === 'play' && !perf.done && raw < 0.5) {
    perf.t += raw; perf.n++;
    if (perf.t > 5) {
      if (perf.t / perf.n > 1 / 36 && profile.bloom && !LOW) { profile.bloom = false; saveProfile(); toast(L('光のにじみを切った'), L('動きが重かったため。設定で戻せる')); }
      // それでも重い（平均 40fps を下回る）なら、画質を「軽い」に落とす
      else if (perf.t / perf.n > 1 / 40 && !LOW && (profile.quality || 'auto') === 'auto') { perfLow = true; applyQuality(); toast(L('画質を軽くした'), L('動きが重かったため。設定で戻せる')); }
      perf.done = true;
    }
  }
}
// タブを隠したら音楽と声を止め、戻ったら再開する
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    stopFlightAudio();
    for (const el of bgmEls) el.pause();
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    if (audio.ctx && audio.ctx.suspend) audio.ctx.suspend();
  } else if (audio.ctx) {
    audio.ctx.resume();
    if (bgm.set && profile.bgm) { const p = bgmEls[bgm.cur].play(); if (p && p.catch) p.catch(() => {}); }
  }
});
function tick(dt) {
  clock += dt;
  const me = S.hero(world);
  if (mode === 'play' && me && me.alive) {
    if (window.PRIMA_AUTO && window.PRIMA_AUTO.enabled) window.PRIMA_AUTO.drive(world, me, dt);
    else heroInput(me);
  }
  if (freeze > 0) freeze -= dt;
  else if (!(forge.open && world.room.practice)) S.step(world, dt);
  consumeEvents();
  flightAudio();
  tutorTick(dt);
  if (quitT > 0) quitT -= dt;
  checkSpecial();
  if (specialT > 0) { specialT -= dt; if (specialT <= 0) startSpecial(); }
  if (winT > 0) { winT -= dt; if (winT <= 0) { winT = 0; world = worldFor(profile.room); toLobby(); } }
  updateFx(dt);
  updateSpeech(dt);
  updateBgm(dt);
  warmAudio();
  // カメラ
  let tx = cam.x, ty = cam.y, tz = baseZoom();
  if (mode === 'play' && me && me.alive) {
    tx = me.x + me.vx * 0.12; ty = me.y + me.vy * 0.12 - me.r * 0.6;
    // 育つほど少し引いて広く見せる（体は大きくならない）
    tz *= Math.max(0.74, 1 - Math.sqrt(Math.max(0, me.mass)) / 240);
  } else if (mode === 'dead' && me) {
    tx = me.x; ty = me.y; tz *= 0.8;
  } else {
    // ロビー：上位の誰かを遠くから見る
    lobbyT -= dt;
    if (lobbyT <= 0 || !spectate || !spectate.alive) { lobbyT = 9; spectate = world.ranking[Math.floor(Math.random() * Math.min(4, world.ranking.length))] || null; }
    if (spectate) { tx = spectate.x; ty = spectate.y; }
    tz *= 0.72;
  }
  const k = Math.min(1, dt * (mode === 'lobby' ? 1.2 : 9));
  cam.x += (tx - cam.x) * k; cam.y += (ty - cam.y) * k;
  tz *= (1 + punch) * debugZoom;
  cam.z += (tz - cam.z) * Math.min(1, dt * 3);
  cam.shake *= Math.pow(0.001, dt);
  cam.sx = (Math.random() - 0.5) * cam.shake; cam.sy = (Math.random() - 0.5) * cam.shake;
  document.body.classList.toggle('aiming', mode === 'play' && !touch.active);
  draw();
  drawPreview(clock);
  if (mode !== 'lobby') updateHud(dt);
  else { hudT -= dt; if (hudT <= 0) { hudT = 1; syncRoomCounts(); } }
  if (window.PRIMA_AUTO) window.PRIMA_AUTO.tick({ world, me, mode, dt, deathReady });
  if (toastTimer > 0) { toastTimer -= dt; if (toastTimer <= 0) $('toast').innerHTML = ''; }
}
// ロビーの人数と首位だけを定期的に書き換える（選択中のボタンを作り直さない）
function syncRoomCounts() {
  for (const b of $('roomList').children) {
    const w = worlds[b.dataset.k];
    if (!w) continue;
    b.querySelector('.count').textContent = L('{0}人', w.units.filter(u => u.alive).length);
    const lead = w.ranking[0], el = b.querySelector('.lead');
    if (lead && el) el.textContent = L('首位　{0}　{1}', lead.name, fmt(lead.mass));
  }
}
// 選んでいない部屋も裏で進める（ロビーに戻ったとき時間が流れている）
setInterval(() => { for (const k in worlds) if (worlds[k] !== world) { for (let i = 0; i < 6; i++) S.step(worlds[k], 1 / 12); worlds[k].events.length = 0; } }, 500);

buildLobby();
if (window.PRIMA_AUTO) window.PRIMA_AUTO.attach({ join, leave, toLobby, L, unlockAudio, world: () => world });
syncWelcome();
requestAnimationFrame(frame);
// 開発用：URL の末尾が #debug のときだけ内部を触れる
if (location.hash === '#debug') window.__prima = { tick, join, leave, openForge, closeForge, get world() { return world; }, get mode() { return mode; }, keys, mouse, decals, parts, bubbles, profile, set zoom(v) { debugZoom = v; } };
})();
