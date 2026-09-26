// PRIMA 紋戦 — 演算コア
// DOM・Canvas・音・実時間を持たない。step(world, dt) で進むだけ。
// ブラウザでは data.js の後に読み込み、window.PRIMA_SIM として公開する。
// 将来のオンライン対戦ではこのファイルをサーバー側でもそのまま動かす（docs/ONLINE_RELEASE.md）。
// 術式の組み方・消費・詠唱・部品数・暴発・27現象の効き方は旧版（dist/classic/game.js）に合わせてある。
//
// ─── 目次（═══ NN. で検索） ───
// 01. 乱数と小道具   02. 世界の生成（修練場の人形を含む）   03. 術者（体・能力値）   04. レベルと制御容量
// 05. 魔素（地面の粒）   06. 術式計算（正規化・部品数・消費・詠唱・暴発）
// 07. 詠唱と発動   08. 飛ぶ術式・罠・投射・光線   09. 起動（追加機能）と現象
// 10. 領域・結界・囮   11. 糸（維持費・切断・誘導・指示起爆・回収）   12. 命中
// 13. 撃破と再参加   14. 1フレームの更新   15. Botの思考   16. 順位   17. 公開
(() => {
const ROOT = typeof window !== 'undefined' ? window : globalThis;
const D = ROOT.PRIMA_DATA;
const W = D.WORLD, R = D.RULES;
const P = D.principleOrder;

// ═══ 01. 乱数と小道具 ═══════════════════════════════════════════
// 再現できるように世界ごとに種つきの乱数を持つ
function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const clamp = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v;
const hyp = Math.hypot;
const TAU = Math.PI * 2;
const angDiff = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
const pick = (w, arr) => arr[Math.floor(w.rng() * arr.length)];

// ═══ 02. 世界の生成 ═════════════════════════════════════════════
function createWorld(roomKey, seed = (Date.now() & 0xffffff)) {
  const room = D.rooms[roomKey] || D.rooms.ichi;
  const w = {
    roomKey, room, R: room.R, t: 0, seed, rng: mulberry(seed), nextId: 1,
    units: [], motes: [], spells: [], zones: [], wards: [], decoys: [],
    rocks: [], springs: [], events: [], nodes: [],
    heroId: null, respawnQueue: [], grid: makeGrid(room.R), rankT: 0, ranking: [], moteAcc: 0
  };
  const r = w.rng;
  // 六原理の節点：床に刻まれた六つの紋（描画の六芒星の頂点と同じ場所）
  P.forEach((k, i) => { const a = -Math.PI / 2 + i * TAU / 6; w.nodes.push({ k, i, x: Math.cos(a) * w.R * W.node.at, y: Math.sin(a) * w.R * W.node.at }); });
  // 魔素泉：ゆっくり魔素を吐き、ときどき大きく噴き出す。乱戦の起点になる
  for (let i = 0; i < room.springs; i++) {
    const a = i / room.springs * TAU + r() * 0.6, d = w.R * (0.38 + r() * 0.32);
    w.springs.push({ id: w.nextId++, x: Math.cos(a) * d, y: Math.sin(a) * d, r: 80, timer: r(), surge: W.mote.surgeEvery * (0.4 + r() * 0.6) });
  }
  // 岩：弾と体を止める遮蔽
  let tries = 0;
  while (w.rocks.length < room.rocks && tries++ < 400) {
    const a = r() * TAU, d = Math.sqrt(r()) * (w.R - 220), rr = 46 + r() * 84;
    const x = Math.cos(a) * d, y = Math.sin(a) * d;
    if (hyp(x, y) < 260) continue;
    if (w.rocks.some(k => hyp(k.x - x, k.y - y) < k.r + rr + 140)) continue;
    if (w.springs.some(s => hyp(s.x - x, s.y - y) < rr + 200)) continue;
    const pts = [];
    const n = 9 + Math.floor(r() * 4);
    for (let j = 0; j < n; j++) pts.push(0.78 + r() * 0.3);
    w.rocks.push({ id: w.nextId++, x, y, r: rr, pts, rot: r() * 6.3 });
  }
  while (w.motes.length < room.motes) spawnFieldMote(w);
  // 修練場：散らない人形を置く（止まる・歩く・結界を張る）
  if (room.practice) for (const d of D.dummies) addDummy(w, d);
  // 途中から入った部屋らしく、Botは育ち具合をばらつかせて置く
  for (let i = 0; i < room.bots; i++) addBot(w, startMass(w));
  for (let i = 0; i < 150; i++) step(w, 1 / 30);
  w.events.length = 0;
  return w;
}
function startMass(w) {
  const x = w.rng();
  return Math.round(x < 0.45 ? x * 60 : x < 0.85 ? 30 + x * 260 : 200 + Math.pow(x, 6) * 1400);
}

// ═══ 03. 術者（体・能力値） ═════════════════════════════════════
function makeUnit(w, o) {
  const u = {
    id: w.nextId++, name: o.name, ink: o.ink, crest: o.crest, tier: o.tier || 0, bot: !!o.bot,
    alive: true, x: 0, y: 0, vx: 0, vy: 0, aim: 0, r: W.body.baseR,
    mass: 0, peak: 0, xp: 0, level: 0,
    hp: W.body.baseHp, maxHp: W.body.baseHp, mp: W.mp.max,
    spells: [0, 1, 2, 3].map(i => normRecipe((o.spells || D.defaultSpells)[i] || D.defaultSpells[i])),
    sel: 0, casting: null, queue: null, slotCd: [0, 0, 0, 0],
    cries: o.cries || { win: '', death: '' },
    dodgeCd: 0, dashT: 0, phaseT: 0, shield: 0, reflectT: 0, hasteT: 0, hardenT: 0, vitalT: 0,
    rootT: 0, slowT: 0, slowAmt: 0, poisonT: 0, poisonDps: 0, poisonBy: 0, markT: 0,
    spawnShield: W.spawnShield, combatT: 99, lastHitBy: null, lastHitT: -99,
    kills: 0, bornT: w.t, place: 0, bestPlace: 99, hurtT: 0, dummy: o.dummy || null, dealt: 0, taken: 0, blocked: 0,
    aegis: false, every: o.every || 0, fireT: 1, fireI: 0, node: -1, center: false,
    input: { mx: 0, my: 0, aim: 0, tx: 0, ty: 0, cast: false, slot: 0, dodge: false, detonate: false, recall: false },
    brain: o.bot ? makeBrain(w, o.school) : null
  };
  placeSafely(w, u);
  return u;
}
function placeSafely(w, u) {
  // 大きな相手から離れた場所に置く
  let best = null, bestScore = -1;
  for (let i = 0; i < 14; i++) {
    const a = w.rng() * TAU, d = Math.sqrt(w.rng()) * (w.R - 200);
    const x = Math.cos(a) * d, y = Math.sin(a) * d;
    if (w.rocks.some(k => hyp(k.x - x, k.y - y) < k.r + 60)) continue;
    let near = 9999;
    for (const o of w.units) if (o.alive && o !== u) near = Math.min(near, hyp(o.x - x, o.y - y) - o.r * 4);
    if (near > bestScore) { bestScore = near; best = { x, y }; }
  }
  best = best || { x: 0, y: 0 };
  u.x = best.x; u.y = best.y; u.aim = w.rng() * TAU;
}
// Bot の多くは流派（達人の術）を修めて入ってくる。修練を積んだ術者として、はじめから少しレベルが高い
function addBot(w, mass = 0) {
  const used = new Set(w.units.filter(u => u.alive).map(u => u.name));
  let name = pick(w, D.botNames);
  for (let i = 0; i < 6 && used.has(name); i++) name = pick(w, D.botNames);
  const school = w.rng() < W.bot.schoolShare ? pick(w, D.schools) : null;
  const u = makeUnit(w, {
    name, bot: true, school,
    ink: pick(w, D.inkOrder), crest: pick(w, D.crestOrder),
    tier: Math.floor(Math.pow(w.rng(), 1.8) * D.tiers.length),
    spells: school ? school.spells : pick(w, D.botLoadouts).map(k => D.presets[k].r),
    cries: { win: pick(w, D.cries.win), death: pick(w, D.cries.death) }
  });
  w.units.push(u);
  if (mass > 0) gain(w, u, mass);
  // レベルの下限：制御容量が育った状態で入る（魔素＝スコアは増やさない）
  let floor = W.bot.levelMin + Math.floor(w.rng() * (W.bot.levelMax - W.bot.levelMin + 1));
  // 流派の術をすべて暴発させずに扱えるだけの制御容量は持って入る
  const need = Math.max(...u.spells.map(partCount));
  for (const [lv, cap] of R.capacity) if (cap >= need) { floor = Math.max(floor, lv); break; }
  if (u.level < floor) { u.level = floor; u.xp = Math.max(u.xp, xpFor(floor)); }
  u.mp = maxMp(u);
  u.hp = u.maxHp;
  return u;
}
function addDummy(w, d) {
  const u = makeUnit(w, { name: d.name, ink: d.ink, crest: 'ring', bot: false, dummy: d.kind, every: d.every, spells: d.spells ? d.spells.map(k => D.presets[k].r) : null, cries: { win: '', death: '' } });
  u.x = d.x; u.y = d.y; u.home = { x: d.x, y: d.y }; u.spawnShield = 0; u.aim = Math.PI;
  u.mass = d.mass || 0; refreshBody(u); u.hp = u.maxHp;
  w.units.push(u);
  return u;
}
// 人形の動き：歩く人形は左右に往復し、結界の人形はときどき術者との間に壁を立てる
function dummyThink(w, u, dt) {
  const ix = u.input, me = hero(w);
  ix.cast = false; ix.mx = 0; ix.my = 0;
  if (u.dummy === 'walk') ix.my = Math.sin(w.t * 0.9 + u.id) > 0 ? 1 : -1;
  if (me && me.alive) {
    ix.aim = Math.atan2(me.y - u.y, me.x - u.x);
    if (u.dummy === 'guard' && u.slotCd[0] <= 0 && Math.sin(w.t * 0.5) > 0.96) { ix.tx = (u.x + me.x) / 2; ix.ty = (u.y + me.y) / 2; ix.slot = 0; ix.cast = true; }
    // 攻撃人形：「攻撃人形」を入れているときだけ、持ち術を順に術者へ放つ（耐久と結界の試験）
    if ((u.dummy === 'shooter' || u.dummy === 'cannon') && w.practiceFire) {
      const d = hyp(me.x - u.x, me.y - u.y), lead = d / 900;
      ix.aim = Math.atan2(me.y + me.vy * lead - u.y, me.x + me.vx * lead - u.x);
      u.fireT -= dt;
      if (u.fireT <= 0 && !u.casting && d < 1100) {
        u.fireT = u.every; ix.slot = u.fireI % 4; u.fireI++;
        ix.tx = me.x; ix.ty = me.y; ix.cast = true;
      }
    }
  }
  if (u.home && hyp(u.x - u.home.x, u.y - u.home.y) > 260) { ix.mx = u.home.x - u.x; ix.my = u.home.y - u.y; }
  u.mp = maxMp(u);
}
function spawnHero(w, profile) {
  const old = w.units.find(u => u.id === w.heroId);
  if (old) { clearOwned(w, old.id); w.units.splice(w.units.indexOf(old), 1); }
  const u = makeUnit(w, { name: profile.name || '名無し', ink: profile.ink, crest: profile.crest, tier: profile.tier || 0, bot: false, spells: profile.spells, cries: profile.cries });
  w.units.push(u);
  w.heroId = u.id;
  return u;
}
function hero(w) { return w.units.find(u => u.id === w.heroId) || null; }
function unitById(w, id) { for (const u of w.units) if (u.id === id) return u; return null; }

// 魔素から体を決める
function refreshBody(u) {
  const s = Math.sqrt(Math.max(0, u.mass));
  u.r = Math.min(W.body.maxR, W.body.baseR + s * W.body.rPerSqrt);
  const maxHp = W.body.baseHp + s * W.body.hpPerSqrt;
  if (maxHp > u.maxHp) u.hp += maxHp - u.maxHp;
  u.maxHp = maxHp;
  u.hp = Math.min(u.hp, u.maxHp);
}
const speedOf = u => Math.max(W.body.minSpeed, W.body.speed - Math.sqrt(Math.max(0, u.mass)) * W.body.speedPerSqrt);
const maxMp = u => W.mp.max + u.level * W.mp.perLevel;
// 制御容量：旧版は職業ごと（巫女4・前衛5・術者7・観測9）。乱戦ではレベルで育つ
// 立っている節点が、この術の原理（主・副・追加性質）と同じか
function nodeBoost(w, u, r) {
  if (!u || u.node < 0 || !w.nodes[u.node]) return false;
  const k = w.nodes[u.node].k;
  return r.a === k || r.b === k || r.extras.includes(k);
}
function capacityOf(u) {
  let c = 0;
  for (const [lv, n] of R.capacity) if ((u ? u.level : 0) >= lv) c = n;
  // 要の陣（戦場の中央）に立つ間は、制御容量が増える
  return c + (u && u.center ? W.center.capacity : 0);
}

// ═══ 04. レベルと制御容量 ═══════════════════════════════════════
// レベルが上がると制御容量（扱える部品の数）と魔力の器が育つ。育つほど重い術を安定して放てる
function xpFor(level) { return Math.round(W.level.xpBase * Math.pow(level, W.level.xpPow)); }
function gain(w, u, v) {
  if (u.dummy) return;
  u.mass += v; u.xp += v;
  if (u.mass > u.peak) u.peak = u.mass;
  refreshBody(u);
  while (u.level < W.level.max && u.xp >= xpFor(u.level + 1)) {
    u.level++;
    w.events.push({ type: 'level', id: u.id, level: u.level, x: u.x, y: u.y, cap: capacityOf(u), capUp: R.capacity.some(([lv]) => lv === u.level) });
  }
}

// ═══ 05. 魔素（地面の粒） ═══════════════════════════════════════
// 粒はすべて同じ形で作る（あとから項目を足すと処理が遅くなる）
function mote(x, y, vx, vy, v, ink, life, field, from, mana) {
  return { x, y, vx, vy, v, ink, life, age: 0, field, from, mana, eaten: false };
}
function spawnFieldMote(w) {
  const a = w.rng() * TAU, d = Math.sqrt(w.rng()) * (w.R - 40);
  const x = Math.cos(a) * d, y = Math.sin(a) * d;
  if (w.rocks.some(k => hyp(k.x - x, k.y - y) < k.r)) return;
  w.motes.push(mote(x, y, 0, 0, 1 + Math.floor(w.rng() * 3) * 0.5, pick(w, D.inkOrder), Infinity, true, 0, false));
}
// mana：散魔で撒かれた魔力の粒。拾うと魔素（スコア）ではなく魔力が戻る
function dropMote(w, x, y, v, ink, speed, from = 0, mana = false) {
  if (w.motes.length >= W.mote.maxTotal) {
    // 上限に達したら一番古い落とし物から散逸させる
    const i = w.motes.findIndex(m => !m.field);
    if (i >= 0) w.motes.splice(i, 1); else return;
  }
  const a = w.rng() * TAU, s = speed * (0.3 + w.rng() * 0.7);
  w.motes.push(mote(x, y, Math.cos(a) * s, Math.sin(a) * s, v, ink, (mana ? 12 : W.mote.dropLife) * (0.8 + w.rng() * 0.4), false, from, mana));
}
// 魔素の近傍探索用の格子。配列を使い回し、毎フレーム中身だけ入れ直す
const CELL = 160;
function makeGrid(R) {
  const off = R + 800, n = Math.ceil(off * 2 / CELL);
  return { off, n, cells: Array.from({ length: n * n }, () => []), used: [] };
}
function cellIndex(g, x, y) {
  const cx = Math.floor((x + g.off) / CELL), cy = Math.floor((y + g.off) / CELL);
  if (cx < 0 || cy < 0 || cx >= g.n || cy >= g.n) return -1;
  return cy * g.n + cx;
}
function rebuildGrid(w) {
  const g = w.grid;
  for (const i of g.used) g.cells[i].length = 0;
  g.used.length = 0;
  for (const m of w.motes) {
    const i = cellIndex(g, m.x, m.y);
    if (i < 0) continue;
    const c = g.cells[i];
    if (!c.length) g.used.push(i);
    c.push(m);
  }
}
function motesNear(w, x, y, rad, out = []) {
  const g = w.grid;
  const x0 = Math.max(0, Math.floor((x - rad + g.off) / CELL)), x1 = Math.min(g.n - 1, Math.floor((x + rad + g.off) / CELL));
  const y0 = Math.max(0, Math.floor((y - rad + g.off) / CELL)), y1 = Math.min(g.n - 1, Math.floor((y + rad + g.off) / CELL));
  for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
    const c = g.cells[cy * g.n + cx];
    for (let k = 0; k < c.length; k++) out.push(c[k]);
  }
  return out;
}
function updateMotes(w, dt) {
  const room = w.room;
  for (const s of w.springs) {
    s.timer -= dt;
    if (s.timer <= 0) { s.timer = W.mote.springEvery; dropMote(w, s.x, s.y, 1 + w.rng() * 1.5, 'yellow', 180); }
    s.surge -= dt;
    if (s.surge <= 0) {
      s.surge = W.mote.surgeEvery;
      for (let i = 0; i < W.mote.surgeCount; i++) dropMote(w, s.x, s.y, 2 + w.rng() * 2, 'yellow', 420);
      w.events.push({ type: 'surge', x: s.x, y: s.y });
    }
  }
  let field = 0;
  for (let i = w.motes.length - 1; i >= 0; i--) {
    const m = w.motes[i];
    m.age += dt;
    if (m.field) field++;
    if (m.age > m.life) { w.motes.splice(i, 1); continue; }
    if (m.vx || m.vy) {
      m.x += m.vx * dt; m.y += m.vy * dt;
      const f = Math.pow(0.04, dt);
      m.vx *= f; m.vy *= f;
      if (Math.abs(m.vx) + Math.abs(m.vy) < 2) m.vx = m.vy = 0;
    }
  }
  // 地面の魔素はゆっくり湧き戻る（refill 秒で満ちる）
  w.moteAcc += room.motes / W.mote.refill * dt;
  while (w.moteAcc >= 1) { w.moteAcc--; if (field++ < room.motes) spawnFieldMote(w); }
  rebuildGrid(w);
  const near = [];
  // 魔素収束（井戸）と吸魔の領域は、周りの魔素を引き寄せる
  for (const z of w.zones) {
    if (z.kind !== 'well' && z.kind !== 'siphon') continue;
    const owner = unitById(w, z.owner);
    const cx = z.kind === 'siphon' && owner ? owner.x : z.x, cy = z.kind === 'siphon' && owner ? owner.y : z.y;
    near.length = 0;
    for (const m of motesNear(w, z.x, z.y, z.zr * 1.6, near)) {
      if (hyp(m.x - z.x, m.y - z.y) > z.zr * 1.6) continue;
      const dx = cx - m.x, dy = cy - m.y, d = hyp(dx, dy) || 1;
      m.vx = dx / d * 340; m.vy = dy / d * 340;
    }
  }
  // 吸い寄せと吸収
  let eaten = false;
  for (const u of w.units) {
    if (!u.alive) continue;
    const reach = u.r + W.magnet.base + u.level * W.magnet.perLevel;
    near.length = 0;
    motesNear(w, u.x, u.y, reach, near);
    for (const m of near) {
      // 自分が加速で落とした粒はしばらく拾えない
      if (m.eaten || (m.from === u.id && m.age < 1.5)) continue;
      const dx = u.x - m.x, dy = u.y - m.y, d = hyp(dx, dy);
      if (d > reach) continue;
      if (d < u.r * 0.85) {
        m.eaten = eaten = true;
        // 魔素を拾うと育ち、魔力も戻る。散魔の粒（魔力の粒）は魔力だけ戻す
        if (m.mana) u.mp = Math.min(maxMp(u), u.mp + m.v);
        else { gain(w, u, m.v); u.mp = Math.min(maxMp(u), u.mp + m.v * W.mote.mana); }
        if (u.id === w.heroId) w.events.push({ type: 'pickup', v: m.v, ink: m.ink, x: m.x, y: m.y, mana: m.mana });
        continue;
      }
      const pull = 520 * (1 - d / reach) + 120;
      m.vx = dx / d * pull; m.vy = dy / d * pull;
    }
  }
  if (eaten) w.motes = w.motes.filter(m => !m.eaten);
}

// ═══ 06. 術式計算（旧版と同じ式） ═══════════════════════════════
// レシピ = { a, b, form, behavior, trigger, deploy, link, extras[], power, duration, rate, visualShape, customName }
const RAPID_OK = ['project', 'homing', 'lob', 'sow', 'relay', 'beam'];
const VISUAL_SHAPES = Object.keys(D.visualShapes);
const PR = k => D.principles[k] || D.noPrinciple;
const cleanName = v => String(v || '').trim().slice(0, 20);
function normRecipe(r) {
  const o = { a: 'motion', b: 'none', form: 'point', behavior: 'project', trigger: 'contact', deploy: 'single', link: 'cut', visualShape: 'auto', power: 1, duration: 1, rate: 1, ...(r || {}) };
  if (!D.principles[o.a]) o.a = 'motion';
  if (o.b !== 'none' && !D.principles[o.b]) o.b = o.a;
  if (!D.forms[o.form]) o.form = 'point';
  if (!D.behaviors[o.behavior]) o.behavior = 'project';
  if (!D.triggers[o.trigger]) o.trigger = 'contact';
  if (!D.deploys[o.deploy]) o.deploy = 'single';
  if (!D.links[o.link]) o.link = 'cut';
  if (!VISUAL_SHAPES.includes(o.visualShape)) o.visualShape = 'auto';
  o.extras = (Array.isArray(o.extras) ? o.extras : []).filter(k => D.principles[k]).slice(0, R.maxExtras);
  o.power = clamp(Number(o.power) || 1, R.power[0], R.power[1]);
  o.duration = clamp(Number(o.duration) || 1, R.duration[0], R.duration[1]);
  o.rate = clamp(Math.round(Number(o.rate) || 1), R.rate[0], R.rate[1]);
  if (o.behavior === 'orbit') { o.trigger = 'contact'; if (!['linger', 'siphon'].includes(o.deploy)) o.deploy = 'single'; }
  if (o.behavior === 'beam') { o.form = 'line'; o.trigger = 'contact'; o.deploy = 'single'; }
  if (!RAPID_OK.includes(o.behavior)) o.rate = 1;
  // 指示起爆は糸を通してしか届かない（④ 糸）。光線は一瞬で終わるので糸を持てない
  if (o.trigger === 'command') o.link = 'hold';
  if (o.behavior === 'beam') o.link = 'cut';
  // 質：省いたら、結を含む術は固体・ほかはエネルギー（周回はエネルギーの膜）。光線は光なので常にエネルギー
  if (!D.matters[o.matter]) o.matter = o.behavior !== 'orbit' && (o.a === 'bind' || o.b === 'bind') ? 'solid' : 'energy';
  if (o.behavior === 'beam') o.matter = 'energy';
  if (o.matter === 'perfect' && !perfectOk(o)) o.matter = o.a === 'bind' || o.b === 'bind' ? 'solid' : 'energy';
  return {
    a: o.a, b: o.b, form: o.form, behavior: o.behavior, trigger: o.trigger, deploy: o.deploy, link: o.link, extras: o.extras,
    power: o.power, duration: o.duration, rate: o.rate, matter: o.matter, visualShape: o.visualShape, customName: cleanName(o.customName || o.name)
  };
}
const pairKey = r => r.b === 'none' ? `${r.a}|none` : [r.a, r.b].sort().join('|');
// 完全（固体とエネルギーを重ねた結界）を使える術：結界を作る現象か、周回（強化術は除く）
const WARD_TYPES = ['solid', 'wall', 'trench', 'root', 'prison', 'bulwark', 'shift', 'counter'];
function perfectOk(r) {
  if (r.behavior === 'orbit') return !(r.b === 'none' && ['motion', 'bind', 'grow'].includes(r.a));
  const p = D.pairData[pairKey(r)];
  return !!p && WARD_TYPES.includes(p.type);
}
// 部品数：既定値（弾・射出・接触・単発・切断）から外れた選択と、原理・追加性質の数
function partCount(r) {
  return 1 + (r.b !== 'none' ? 1 : 0) + (r.form !== 'point' ? 1 : 0) + (r.behavior !== 'project' ? 1 : 0)
    + (r.trigger !== 'contact' ? 1 : 0) + (r.deploy !== 'single' ? 1 : 0) + (r.link === 'hold' ? 1 : 0) + r.extras.length;
}
// 複雑度倍率：freeParts を超えた部品数に応じて消費が割高になる
function complexityMul(r) {
  const C = R.complexity, over = Math.max(0, partCount(r) - C.freeParts);
  return 1 + C.perPart * Math.pow(over, C.exponent);
}
// 暴発率：制御容量を超えた部品1つごとに上がる
function misfireChance(r, u) {
  const over = partCount(r) - capacityOf(u);
  return over > 0 ? Math.min(R.misfire.max, over * R.misfire.perOverPart) : 0;
}
const extrasCount = (r, k) => r.extras.filter(x => x === k).length;
const visualShapeOf = r => r.visualShape !== 'auto' ? r.visualShape : r.form === 'point' ? 'needle' : r.form === 'line' ? 'shard' : 'orb';
const shapeOf = r => D.shapes[visualShapeOf(r)] || D.shapes.needle;
const matterOf = r => D.matters[r.matter] || D.matters.energy;
// 純度：部品が少ない単調な術ほど一撃が重く、複雑な術ほど威力が落ちる
function purityMul(r) {
  const P = R.purity, n = partCount(r);
  return n <= P.base ? 1 + P.bonus * (P.base - n) : Math.max(P.min, 1 - P.penalty * (n - P.base));
}
// 遠くでの衰え：放った術は離れるほど散る（③ 散逸）。光線と槍はほとんど衰えない。固体は衰えにくい
function falloffMul(r, dist) {
  const k = (D.behaviors[r.behavior].falloff || 0) * matterOf(r).fall * shapeOf(r).fall;
  return Math.max(R.falloff.min, 1 - k * dist / R.falloff.per);
}
function mixHex(a, b) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  return '#' + [((pa >> 16) + (pb >> 16)) >> 1, (((pa >> 8) & 255) + ((pb >> 8) & 255)) >> 1, ((pa & 255) + (pb & 255)) >> 1].map(v => v.toString(16).padStart(2, '0')).join('');
}
const inkHex = k => (D.inks[PR(k).ink] || D.inks.yellow).hex;
// 名前と現象：組み合わせ表から引き、広がり方の字を付ける（旧版と同じ）
function recipeResult(r) {
  const base = D.pairData[pairKey(r)] || { base: PR(r.a).name + PR(r.b).name, type: 'hybrid', desc: '未分類の現象。', tags: ['複合'], power: 58, control: 58, terrain: 58 };
  const fm = D.forms[r.form], N = D.naming;
  // 名前の組み立て方は言語ごとに data の naming が決める（日本語は「魔弾」＋「針」、英語は「Arcane Bolt」＋「 Needle」）
  const suffix = r.form === 'point' ? (N.shapeSuffix[visualShapeOf(r)] || fm.suffix) : fm.suffix;
  const strip = N.beamStrip && base.base.endsWith(N.beamStrip) ? base.base.slice(0, -N.beamStrip.length) : base.base;
  const core = r.behavior === 'beam' ? N.beam.replace('{0}', strip) : (base.base.endsWith(suffix) ? base.base : base.base + N.join + suffix);
  const extras = r.extras.map(k => PR(k).kanji).join('');
  return {
    ...base, name: extras ? `${core}${N.extraSep}${extras}` : core,
    color: r.b === 'none' ? inkHex(r.a) : mixHex(inkHex(r.a), inkHex(r.b)),
    power: Math.round(base.power * fm.power), control: Math.round(base.control * fm.control), terrain: Math.round(base.terrain * fm.terrain)
  };
}
const spellName = r => r.customName || recipeResult(r).name;
function baseCost(r) {
  const effect = recipeResult(r);
  // 原理を強く保つ分、効果の威力・制圧力・地形操作にも魔素が要る
  const force = Math.ceil((effect.power * .55 + effect.control * .28 + effect.terrain * .17) / 12);
  const complexity = (r.b !== 'none' && r.a !== r.b ? 2 : 0) + (r.behavior === 'beam' ? 5 : 0) + (r.deploy === 'linger' && r.form === 'field' ? 4 : 0);
  const extras = r.extras.reduce((s, k) => s + PR(k).cost * .8, 0);
  let sum = PR(r.a).cost + PR(r.b).cost + D.forms[r.form].cost + D.behaviors[r.behavior].cost
    + D.triggers[r.trigger].cost + D.deploys[r.deploy].cost + D.links[r.link].cost + extras + force + complexity;
  // 形（刀・槍など）を作る手間と、固体にする手間
  sum += shapeOf(r).cost;
  sum *= matterOf(r).cost;
  sum *= complexityMul(r);
  // 単調な術ほど燃費が良い
  sum *= 1 - R.purity.costCut * Math.max(0, R.purity.base - partCount(r));
  sum *= Math.pow(r.power, 1.6);
  if (r.trigger === 'fuse') sum *= clamp(1.5 - r.duration * .5, .8, 1.3);
  else if (['linger', 'siphon'].includes(r.deploy) || r.behavior === 'orbit') sum *= clamp(.7 + r.duration * .3, .7, 1.6);
  return sum;
}
function rawCost(r) {
  let cost = Math.ceil(baseCost(r));
  if (RAPID_OK.includes(r.behavior) && r.rate > 1) cost = Math.ceil(cost * (1 + (r.rate - 1) * .78));
  return cost;
}
function recipeCost(r, u) {
  return Math.max(1, Math.round(rawCost(r) * R.costScale));
}
function windupTime(r) {
  const C = R.complexity;
  const core = clamp(.16 + baseCost(r) / complexityMul(r) * .0195 * D.forms[r.form].wind * D.behaviors[r.behavior].wind, .18, 1.35);
  return Math.min(C.maxWind, core + C.windPerPart * Math.max(0, partCount(r) - C.freeParts)) * R.windScale;
}
// 画面に出す術の要約
function spellInfo(u, r) {
  const res = recipeResult(r);
  return {
    name: spellName(r), result: res, parts: partCount(r), cap: capacityOf(u), cost: recipeCost(r, u), windup: windupTime(r), misfire: misfireChance(r, u), color: res.color, type: res.type,
    // 威力の目安：命中1回の基本威力（魔素0）、純度の倍率、800 先での残り
    power: hitBase(null, r, res) * (D.behaviors[r.behavior].hitMul || 1), purity: purityMul(r), reach: falloffMul(r, 800)
  };
}

// ═══ 07. 詠唱と発動 ═════════════════════════════════════════════
// 詠唱を始める（魔力は先払い）。詠唱が終わると放たれる
function beginCast(w, u, slot) {
  if (u.casting || u.queue || u.dashT > 0) return false;
  // 完全の結界を張っている間は術を唱えられない。唱えようとすると結界が解ける
  if (u.aegis) { dispelPerfect(w, u, 'cast'); return false; }
  const r = u.spells[slot];
  if (!r || u.slotCd[slot] > 0) return false;
  const cost = Math.max(1, Math.round(recipeCost(r, u) * (nodeBoost(w, u, r) ? W.node.cost : 1)));
  if (u.mp < cost) return false;
  u.mp -= cost;
  u.spawnShield = 0;
  const total = windupTime(r);
  u.casting = { slot, t: 0, total, cost };
  w.events.push({ type: 'chant', id: u.id, slot, name: spellName(r), named: !!r.customName, a: r.a, b: r.b, beh: r.behavior, form: r.form, deploy: r.deploy, parts: partCount(r), t: total, col: recipeResult(r).color });
  return true;
}
function release(w, u) {
  const c = u.casting;
  u.casting = null;
  const r = u.spells[c.slot];
  u.slotCd[c.slot] = W.cast.recast;
  // 制御容量を超えた術式は、放つ瞬間に崩れて自分を傷つけることがある（② 構造体）
  if (w.rng() < misfireChance(r, u)) {
    w.events.push({ type: 'misfire', id: u.id, x: u.x, y: u.y, ink: u.ink, name: spellName(r) });
    damage(w, u, rawCost(r) * R.misfire.selfDamage, null);
    return;
  }
  fire(w, u, r, c.cost);
  if (r.rate > 1) u.queue = { slot: c.slot, left: r.rate - 1, t: R.rapidGap, cost: c.cost };
}
function reachPoint(u, tx, ty, reach) {
  const dx = tx - u.x, dy = ty - u.y, d = hyp(dx, dy);
  if (d <= reach || d === 0) return { x: tx, y: ty };
  return { x: u.x + dx / d * reach, y: u.y + dy / d * reach };
}
// 命中の基本威力：旧版の (8 + 現象の威力 × 0.085) × 強弱。大きな体ほど少し重い
// 単調な術ほど重く（純度）、形でも少し変わる
function hitBase(u, r, res) {
  return (W.hit.base + res.power * W.hit.perPower) * r.power * (1 + Math.sqrt(Math.max(0, u ? u.mass : 0)) * W.hit.perSqrt)
    * (1 + .08 * extrasCount(r, 'divide')) * purityMul(r) * shapeOf(r).dmg;
}
function fire(w, u, r, cost) {
  const res = recipeResult(r), fm = D.forms[r.form], bh = D.behaviors[r.behavior];
  const hold = r.link === 'hold';
  const boost = nodeBoost(w, u, r);
  const common = { owner: u.id, col: res.color, r, res, dmg: hitBase(u, r, res) * (boost ? W.node.power : 1), radius: fm.radius * (r.deploy === 'burst' ? 1.5 : 1), hold, linked: hold, cost, matter: r.matter, cast: w.nextId++ };
  const aim = u.aim, ix = u.input;
  w.events.push({ type: 'cast', id: u.id, name: spellName(r), named: !!r.customName, a: r.a, beh: r.behavior, form: r.form, x: u.x, y: u.y, ink: u.ink, col: res.color, aim, rtype: res.type, matter: r.matter, node: boost });
  // 位相化：放った直後の攻撃をすり抜ける
  if (res.type === 'veil') u.phaseT = Math.max(u.phaseT, 0.6 * r.duration);
  // 強化術：単一原理を周回で放つと、自分の紋の魔力を体へ直接書き込む（旧版の加速・硬化・活性）
  if (r.behavior === 'orbit' && r.b === 'none' && ['motion', 'bind', 'grow'].includes(r.a)) {
    const t = 4.5 * r.duration;
    if (r.a === 'motion') u.hasteT = Math.max(u.hasteT, t);
    if (r.a === 'bind') u.hardenT = Math.max(u.hardenT, t);
    if (r.a === 'grow') u.vitalT = Math.max(u.vitalT, t);
    w.events.push({ type: 'buff', id: u.id, kind: r.a, x: u.x, y: u.y, col: res.color });
    return;
  }
  // 固体の周回：魔力を結晶の刃にして周りを回らせる。固体の弾を受け止め、触れた相手を斬る（盾にも武器にもなる）
  if (r.behavior === 'orbit' && (r.matter === 'solid' || (r.matter === 'perfect' && !['bulwark', 'shift', 'counter'].includes(res.type)))) { spawnOrbiters(w, u, common); return; }
  switch (r.behavior) {
    case 'project': case 'homing': {
      const s = spawnFlyer(w, u, common, aim, bh, r.behavior === 'homing');
      if (r.trigger === 'fuse') s.stopAt = Math.min(bh.range, hyp(ix.tx - u.x, ix.ty - u.y));
      break;
    }
    case 'relay':
      for (const k of [-1, 0, 1]) spawnFlyer(w, u, { ...common, dmg: common.dmg * 0.62 }, aim + k * 0.22, bh, false);
      break;
    case 'lob': {
      const p = reachPoint(u, ix.tx, ix.ty, bh.range), d = hyp(p.x - u.x, p.y - u.y);
      w.spells.push({ ...common, id: w.nextId++, kind: 'lob', state: 'fly', sx: u.x, sy: u.y, x: u.x, y: u.y, tx: p.x, ty: p.y, t: 0, dur: Math.max(0.25, d / bh.speed), age: 0, wait: 0, fuseT: R.fuse * r.duration, shape: visualShapeOf(r), hit: [], vx: p.x - u.x, vy: p.y - u.y });
      break;
    }
    case 'sow': {
      const p = reachPoint(u, ix.tx, ix.ty, bh.range);
      const s = spawnFlyer(w, u, common, Math.atan2(p.y - u.y, p.x - u.x), bh, false);
      s.stopAt = hyp(p.x - u.x, p.y - u.y); s.rolling = true;
      break;
    }
    case 'drop':
      if (r.trigger === 'contact') activate(w, { ...common, x: u.x, y: u.y, vx: Math.cos(aim), vy: Math.sin(aim), kind: 'drop' }, u.x, u.y, null);
      else w.spells.push({ ...common, id: w.nextId++, kind: 'trap', state: 'wait', x: u.x, y: u.y, vx: Math.cos(aim), vy: Math.sin(aim), age: 0, wait: 0, fuseT: R.fuse * r.duration, shape: visualShapeOf(r), hit: [] });
      break;
    case 'orbit':
      // 周回：術者に追従する領域。結界系は弾を止め、ほかは周りに作用し続ける
      spawnZone(w, { ...common, x: u.x, y: u.y, vx: Math.cos(aim), vy: Math.sin(aim) }, 'orbit', common.radius * 0.7, 3.2 * r.duration * (r.deploy === 'linger' ? 1.4 : 1) * (r.matter === 'perfect' ? 2 : 1));
      break;
    case 'beam':
      fireBeam(w, u, common, aim, bh.range, 12 * fm.radius / 58);
      break;
  }
}

// ═══ 08. 飛ぶ術式・罠・投射・光線 ═══════════════════════════════
// 飛ぶ術式はすべて同じ項目で作る（passed：貫いた結界、bounce：跳ね返れる回数、t / life / ang / orad / hp / hitT は周回の刃だけが使う）
function spawnFlyer(w, u, common, a, bh, homing) {
  const sh = shapeOf(common.r), mt = matterOf(common.r);
  const speed = bh.speed * (common.res.type === 'bolt' ? 1.1 : 1) * sh.speed * mt.speed;
  const s = {
    ...common, id: w.nextId++, kind: 'proj', state: 'fly',
    x: u.x + Math.cos(a) * (u.r + 4), y: u.y + Math.sin(a) * (u.r + 4),
    vx: Math.cos(a) * speed + u.vx * 0.25, vy: Math.sin(a) * speed + u.vy * 0.25, speed,
    range: bh.range * sh.range, traveled: 0, age: 0, wait: 0, fuseT: R.fuse * common.r.duration, homing, tgt: null, retarget: 0,
    size: (6 + Math.min(4.5, Math.sqrt(Math.max(0, u.mass)) * 0.07)) * (common.r.form === 'line' ? 1.6 : common.r.form === 'point' ? 1 : 1.3) * sh.size,
    pierce: (['rend', 'void'].includes(common.res.type) && common.r.form === 'line' ? 3 : 0) + sh.pierce, hit: [], shape: visualShapeOf(common.r),
    passed: [], bounce: sh.bounce, t: 0, life: 0, ang: 0, orad: 0, hp: 0, hitT: 0,
    wardMul: sh.ward, returns: sh.returns, back: false, spin: 0, orbMul: 0
  };
  w.spells.push(s);
  return s;
}
// 周回の刃：固体の周回。広がり方と形で本数・大きさ・回る速さが決まり、術者のまわりを回り続ける（城は城壁になって囲む）
function spawnOrbiters(w, u, common) {
  const r = common.r, O = R.orbiter, sh = shapeOf(r), so = sh.orbit;
  const n = Math.max(1, Math.round((O.count[r.form] || 3) * so.count)), size = 12 * so.size * Math.sqrt(sh.size);
  const orad = u.r + O.radius[r.form] + size * 0.4;
  const life = O.life * r.duration * (r.deploy === 'linger' ? 1.5 : 1);
  for (let i = 0; i < n; i++) {
    const ang = u.aim + i / n * TAU;
    w.spells.push({
      ...common, cost: common.cost / n, id: w.nextId++, kind: 'orbiter', state: 'orbit',
      x: u.x + Math.cos(ang) * orad, y: u.y + Math.sin(ang) * orad, vx: 0, vy: 0, speed: 0,
      range: 0, traveled: 0, age: 0, wait: 0, fuseT: 0, homing: false, tgt: null, retarget: 0,
      size, pierce: 0, hit: [], shape: visualShapeOf(r),
      passed: [], bounce: 0, t: 0, life, ang, orad, hp: O.hp * r.power * so.hp, hitT: O.hitCd,
      wardMul: sh.ward, returns: false, back: false, spin: O.spin * so.spin, orbMul: O.mul * so.mul
    });
  }
  w.events.push({ type: 'zone', id: 0, kind: 'blades', x: u.x, y: u.y, r: orad, col: common.col, rtype: common.res.type, owner: u.id });
}
// 点と線分の距離
function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy;
  const t = L2 > 0 ? clamp(((px - ax) * dx + (py - ay) * dy) / L2, 0, 1) : 0;
  return hyp(ax + dx * t - px, ay + dy * t - py);
}
function tickOrbiter(w, s, owner, dt) {
  if (!owner || !owner.alive) { s.done = true; return; }
  s.t += dt * (s.linked ? R.link.decayMul : 1);
  if (s.t > s.life || s.hp <= 0) { s.done = true; w.events.push({ type: s.hp <= 0 ? 'wardBreak' : 'fizzle', x: s.x, y: s.y, col: s.col, r: 14 }); return; }
  s.ang += s.spin * dt;
  const nx = owner.x + Math.cos(s.ang) * s.orad, ny = owner.y + Math.sin(s.ang) * s.orad;
  if (dt > 0) { s.vx = (nx - s.x) / dt; s.vy = (ny - s.y) / dt; }
  s.x = nx; s.y = ny;
  s.hitT -= dt;
  if (s.hitT <= 0) { s.hit.length = 0; s.hitT = R.orbiter.hitCd; }
  const C = R.clash;
  // 飛んでくる術式：固体どうしはぶつかって砕け合い、エネルギーは刃を貫いていく
  for (const o of w.spells) {
    if (o.done || o.kind !== 'proj' || o.state !== 'fly' || o.owner === s.owner || o.passed.includes(s.id)) continue;
    // 速い弾がすり抜けないよう、この1フレームに進んだ線分で調べる
    if (segDist(s.x, s.y, o.x - o.vx * dt, o.y - o.vy * dt, o.x, o.y) > s.size + o.size) continue;
    // 完全の刃はエネルギーも通さず、削れもしない
    if (o.matter === 'energy' && s.matter !== 'perfect') {
      o.passed.push(s.id); s.hp -= o.dmg * C.pierceWard; o.dmg *= C.pierceKeep;
      w.events.push({ type: 'pierce', x: s.x, y: s.y, col: o.col });
      continue;
    }
    if (s.matter !== 'perfect') s.hp -= o.dmg * o.wardMul;
    o.done = true; owner.blocked++;
    w.events.push({ type: 'clash', x: (o.x + s.x) / 2, y: (o.y + s.y) / 2, col: s.col, col2: o.col, perfect: s.matter === 'perfect' });
  }
  // 違う紋のエネルギーの結界に触れると、少しずつ剥がしていく
  const z = barrierAt(w, s.x, s.y, s.owner);
  if (z && z.matter === 'energy' && s.matter !== 'energy') { hurtZone(w, z, s.dmg * C.strip * dt); if (s.hitT === R.orbiter.hitCd) w.events.push({ type: 'strip', x: s.x, y: s.y, col: s.col }); }
  // 触れた相手を斬る（同じ相手は hitCd ごとに一度）
  for (const u of w.units) {
    if (!u.alive || u.id === s.owner || u.dashT > 0 || s.hit.includes(u.id)) continue;
    if (hyp(u.x - s.x, u.y - s.y) > u.r + s.size) continue;
    s.hit.push(u.id);
    hitFoe(w, s, owner, u, s.orbMul, u.x - owner.x, u.y - owner.y);
  }
}
// 自律追尾：自分と違う紋の、大きく近い魔力へ曲がる。散魔の囮に引かれる（① 紋）
function homingTarget(w, s) {
  let best = null, bs = 0;
  const heading = Math.atan2(s.vy, s.vx);
  const consider = (x, y, weight, obj) => {
    const dx = x - s.x, dy = y - s.y, d = hyp(dx, dy);
    if (d > 760 || Math.abs(angDiff(heading, Math.atan2(dy, dx))) > 1.3) return;
    const sc = weight / (d + 180);
    if (sc > bs) { bs = sc; best = obj; }
  };
  for (const u of w.units) if (u.alive && u.id !== s.owner) consider(u.x, u.y, Math.sqrt(u.mass + 30) + 4, { unit: u.id });
  for (const d of w.decoys) if (d.owner !== s.owner) consider(d.x, d.y, Math.sqrt(R.decoy.weight) + 6, { decoy: d.id });
  return best;
}
function barrierAt(w, x, y, owner, skip) {
  for (const z of w.zones) if (z.barrier && !z.dead && z.owner !== owner && hyp(z.x - x, z.y - y) < z.zr && !(skip && skip.includes(z.id))) return z;
  return null;
}
// 共鳴：自分の紋の場（残留・周回・結界・吸魔・生体転写・魔素収束のエネルギーの場）を通った術は強まる。場ごとに一度
function resonate(w, s) {
  if (s.kind !== 'proj') return;
  for (const z of w.zones) {
    if (z.owner !== s.owner || z.dead || z.matter === 'solid' || s.passed.includes(z.id) || hyp(z.x - s.x, z.y - s.y) > z.zr) continue;
    s.passed.push(z.id); s.dmg *= R.resonance;
    w.events.push({ type: 'resonate', x: s.x, y: s.y, col: z.col, col2: s.col, owner: s.owner });
  }
}
// 干渉：飛んでいる術式どうしが接触したときの反応（① 紋）
//  違う紋（紋が反発し合う）
//   固体どうし       → 衝突。弱い方が砕け、強い方も削れる。ほぼ互角なら両方砕ける
//   エネルギーどうし → 相殺。打ち消し合い、弱い方が消え、強い方も弱まる
//   固体とエネルギー → 貫通と減衰。エネルギーは固体を貫くが大きく弱まり、固体は熱で削れる
//  同じ紋（同じ型の魔力は反発せず、重なり合う）
//   エネルギーどうし → 融合。一つの大きな弾になる（威力を足し合わせる）
//   エネルギーが固体に触れる → 魔装。エネルギーが固体に宿り、固体の弾が重くなる
//   固体どうし       → すり抜ける（どちらも形を保つ）
//  同じ詠唱から出た弾（扇射・分裂の小片・連射）どうしは干渉しない
function interfere(w, dt) {
  const fly = [];
  for (const s of w.spells) if (!s.done && s.kind === 'proj' && s.state === 'fly') fly.push(s);
  const I = R.interfere;
  for (let i = 0; i < fly.length; i++) {
    const a = fly[i];
    for (let j = i + 1; j < fly.length; j++) {
      const b = fly[j];
      if (a.done) break;
      if (b.done || a.cast === b.cast || a.passed.includes(b.id) || b.passed.includes(a.id)) continue;
      const same = a.owner === b.owner;
      // 同じ紋で重なり合うのは、触れて起動する弾だけ（罠・時限・指示の術式は形を保つ）
      if (same && (a.frag || b.frag || a.rolling || b.rolling || a.r.trigger !== 'contact' || b.r.trigger !== 'contact' || (a.matter === 'solid' && b.matter === 'solid'))) continue;
      // この1フレームで最も近づいた距離（向かい合って速く飛ぶ弾もすり抜けない）
      const rx = a.x - b.x, ry = a.y - b.y, vx = a.vx - b.vx, vy = a.vy - b.vy, v2 = vx * vx + vy * vy;
      const t = v2 > 0 ? clamp(-(rx * vx + ry * vy) / v2, -dt, 0) : 0;
      if (hyp(rx + vx * t, ry + vy * t) > a.size + b.size) continue;
      const x = (a.x + b.x) / 2, y = (a.y + b.y) / 2;
      if (same) {
        if (a.matter === b.matter) {
          // 融合：強い方が弱い方を取り込み、大きくなる
          const [big, small] = a.dmg >= b.dmg ? [a, b] : [b, a];
          big.dmg += small.dmg * I.fusion; big.size = Math.min(big.size * 1.3, 26); small.done = true;
          w.events.push({ type: 'fuse', x, y, col: big.col, col2: small.col, owner: a.owner });
        } else {
          // 魔装：エネルギーが固体の弾に宿る
          const [sol, en] = a.matter === 'solid' ? [a, b] : [b, a];
          sol.dmg += en.dmg * I.enchant; sol.col = en.col; en.done = true;
          w.events.push({ type: 'enchant', x, y, col: en.col, col2: sol.col, owner: a.owner });
        }
        continue;
      }
      if (a.matter !== b.matter) {
        // 貫通と減衰：互いに一度だけ
        const [sol, en] = a.matter === 'solid' ? [a, b] : [b, a];
        const heat = en.dmg * I.melt;
        en.dmg *= R.clash.pierceKeep; sol.dmg = Math.max(0, sol.dmg - heat);
        a.passed.push(b.id); b.passed.push(a.id);
        if (sol.dmg < 1) sol.done = true;
        w.events.push({ type: 'pierce', x, y, col: en.col, col2: sol.col, bolt: true });
        continue;
      }
      const pa = a.dmg * (a.matter === 'solid' ? a.wardMul : 1), pb = b.dmg * (b.matter === 'solid' ? b.wardMul : 1);
      const [strong, weak, ps, pw] = pa >= pb ? [a, b, pa, pb] : [b, a, pb, pa];
      weak.done = true;
      if (ps - pw < ps * 0.15) strong.done = true;   // ほぼ互角なら両方とも消える
      else strong.dmg *= 1 - pw / ps * (a.matter === 'solid' ? I.solidLoss : I.energyLoss);
      w.events.push({ type: a.matter === 'solid' ? 'clash' : 'cancel', x, y, col: a.col, col2: b.col });
    }
  }
}
function updateSpells(w, dt) {
  for (let i = w.spells.length - 1; i >= 0; i--) {
    const s = w.spells[i];
    if (!s.done) tickSpell(w, s, dt);
  }
  interfere(w, dt);
  if (w.spells.some(s => s.done)) w.spells = w.spells.filter(s => !s.done);
}
function tickSpell(w, s, dt) {
  const owner = unitById(w, s.owner);
  s.age += dt;
  if (s.kind === 'orbiter') { tickOrbiter(w, s, owner, dt); return; }
  if (s.kind === 'lob' && s.state === 'fly') {
    s.t += dt;
    const f = Math.min(1, s.t / s.dur);
    s.x = s.sx + (s.tx - s.sx) * f; s.y = s.sy + (s.ty - s.sy) * f;
    if (f >= 1) arrive(w, s);
    return;
  }
  if (s.state === 'fly') {
    // 追尾：糸を維持していれば照準へ誘導、切れていれば自律で狙う（④ 糸）
    if (s.homing) {
      let tx = null, ty = null, turn = 2.4;
      if (s.linked && owner && owner.alive) { tx = owner.input.tx; ty = owner.input.ty; turn = R.link.guideTurn; }
      else {
        s.retarget -= dt;
        if (s.retarget <= 0) { s.retarget = 0.2; s.tgt = homingTarget(w, s); }
        const t = s.tgt && (s.tgt.unit ? unitById(w, s.tgt.unit) : w.decoys.find(d => d.id === s.tgt.decoy));
        if (t && t.alive !== false) { tx = t.x; ty = t.y; }
      }
      if (tx !== null) {
        const sp = hyp(s.vx, s.vy), cur = Math.atan2(s.vy, s.vx);
        const na = cur + clamp(angDiff(cur, Math.atan2(ty - s.y, tx - s.x)), -turn * dt, turn * dt);
        s.vx = Math.cos(na) * sp; s.vy = Math.sin(na) * sp;
      }
    }
    // 円月輪：射程の半分で折り返し、術者の手元へ戻る（帰りにも当たる）
    if (s.returns && !s.back && s.traveled >= s.range * 0.5) { s.back = true; s.hit.length = 0; s.homing = false; w.events.push({ type: 'ricochet', x: s.x, y: s.y, col: s.col }); }
    if (s.back) {
      if (!owner || !owner.alive) { s.done = true; return; }
      const sp = hyp(s.vx, s.vy), cur = Math.atan2(s.vy, s.vx);
      const na = cur + clamp(angDiff(cur, Math.atan2(owner.y - s.y, owner.x - s.x)), -9 * dt, 9 * dt);
      s.vx = Math.cos(na) * sp; s.vy = Math.sin(na) * sp;
      if (hyp(owner.x - s.x, owner.y - s.y) < owner.r + s.size + 6) {
        s.done = true;
        const refund = s.cost * R.returnRefund;
        owner.mp = Math.min(maxMp(owner), owner.mp + refund);
        w.events.push({ type: 'catch', id: owner.id, x: s.x, y: s.y, col: s.col, refund });
        return;
      }
    }
    s.x += s.vx * dt; s.y += s.vy * dt; s.traveled += hyp(s.vx, s.vy) * dt;
    resonate(w, s);
    flyCollide(w, s);
    if (s.done || s.state !== 'fly') return;
    if (s.stopAt !== undefined && s.traveled >= s.stopAt) {
      if (s.r.trigger === 'fuse' && !s.rolling) activate(w, s, s.x, s.y, null);
      else arrive(w, s);
    } else if (s.traveled >= s.range * (s.returns ? 1.9 : 1)) {
      if (s.r.trigger === 'contact') { s.done = true; w.events.push({ type: 'fizzle', x: s.x, y: s.y, col: s.col }); }
      else arrive(w, s);
    } else if (s.r.trigger === 'proximity' && foeNear(w, s, s.radius * 0.6)) activate(w, s, s.x, s.y, null);
    return;
  }
  // 待機中の術式（罠）：殻は散逸していく。糸でつながっていれば減りが遅い（③ 散逸）
  s.wait += dt * (s.linked ? R.link.decayMul : 1);
  if (s.r.trigger === 'fuse') { s.fuseT -= dt; if (s.fuseT <= 0) { activate(w, s, s.x, s.y, null); return; } }
  if (s.r.trigger === 'proximity') { if (foeNear(w, s, s.radius * 0.7)) { activate(w, s, s.x, s.y, null); return; } }
  if (s.r.trigger === 'contact') { const f = foeNear(w, s, 26); if (f) { activate(w, s, s.x, s.y, f); return; } }
  // 糸が切れた指示式は、起爆できないまま散逸する
  if (s.r.trigger === 'command' && !s.linked) s.severT = (s.severT ?? R.link.severedLife) - dt;
  if (s.wait > 6 * s.r.duration || s.severT <= 0) { s.done = true; w.events.push({ type: 'fizzle', x: s.x, y: s.y, col: s.col }); }
}
// 着いた：時限は殻が割れるまで、感知・指示は罠として待つ。接触は着いた場所で起動
function arrive(w, s) {
  s.state = 'wait';
  if (s.kind === 'lob') s.kind = 'trap';
  if (s.r.trigger === 'contact' && !s.rolling) activate(w, s, s.x, s.y, null);
}
function foeNear(w, s, rad) {
  for (const u of w.units) if (u.alive && u.id !== s.owner && u.dashT <= 0 && hyp(u.x - s.x, u.y - s.y) < rad + u.r) return u;
  return null;
}
function flyCollide(w, s) {
  const passWard = s.res.type === 'void' || extrasCount(s.r, 'phase') > 0;
  const C = R.clash;
  for (const k of w.rocks) if (hyp(k.x - s.x, k.y - s.y) < k.r * 0.92 + s.size) { hitObstacle(w, s, k.x, k.y, k.r * 0.92 + s.size); return; }
  for (const g of w.wards) {
    if (g.owner === s.owner || g.hp <= 0 || passWard || s.passed.includes(g.id)) continue;
    const cp = wardPoint(g, s.x, s.y);
    if (hyp(cp.x - s.x, cp.y - s.y) > g.r + s.size) continue;
    const go = unitById(w, g.owner);
    // 完全の結界：どちらの質も通さず、削れもしない
    if (g.matter === 'perfect') {
      if (go) go.blocked++;
      w.events.push({ type: 'absorb', x: s.x, y: s.y, col: g.col, kind: 'perfect' });
      hitObstacle(w, s, cp.x, cp.y, g.r + s.size);
      return;
    }
    // 質の相性：エネルギーは固体の結界を貫く（削り、大きく弱まる）
    if (s.matter === 'energy' && g.matter === 'solid') {
      s.passed.push(g.id); hurtWard(w, g, s.dmg * C.pierceWard * s.wardMul); s.dmg *= C.pierceKeep;
      w.events.push({ type: 'pierce', x: s.x, y: s.y, col: s.col });
      continue;
    }
    // 固体はエネルギーの結界を剥がす。形の貫通力（斧・槌・槍…）が強いほど大きく削る
    let hit = s.dmg * s.wardMul;
    if (s.matter === 'solid' && g.matter === 'energy') { hit *= C.strip; w.events.push({ type: 'strip', x: s.x, y: s.y, col: s.col }); }
    else if (['sunder', 'corrode', 'unmake'].includes(s.res.type)) hit *= 3.5;
    hurtWard(w, g, hit);
    // 砕ききれば止まらず抜ける（少し弱まる）
    if (g.hp <= 0) { s.passed.push(g.id); s.dmg *= C.breakKeep; continue; }
    if (go) go.blocked++;
    hitObstacle(w, s, cp.x, cp.y, g.r + s.size);
    return;
  }
  // 結界系の領域（重縛結界・位相転換・反力変換）
  const z = passWard ? null : barrierAt(w, s.x, s.y, s.owner, s.passed);
  if (z) {
    const zo = unitById(w, z.owner);
    if (z.matter !== 'perfect' && s.matter === 'energy' && z.matter === 'solid') {
      s.passed.push(z.id); hurtZone(w, z, s.dmg * C.pierceWard * s.wardMul); s.dmg *= C.pierceKeep;
      w.events.push({ type: 'pierce', x: s.x, y: s.y, col: s.col });
      return;
    }
    if (z.matter !== 'perfect' && s.matter === 'solid' && z.matter === 'energy') {
      hurtZone(w, z, s.dmg * C.strip * s.wardMul);
      w.events.push({ type: 'strip', x: s.x, y: s.y, col: s.col });
      if (z.dead) { s.passed.push(z.id); return; }
    } else hurtZone(w, z, s.dmg * s.wardMul);
    if (zo) zo.blocked++;
    if (z.barrier === 'counter') { reflect(w, s, z.owner, z.col); return; }
    if (z.barrier === 'shift') { const zo = unitById(w, z.owner); if (zo) zo.mp = Math.min(maxMp(zo), zo.mp + s.cost * 0.4); }
    s.done = true;
    w.events.push({ type: 'absorb', x: s.x, y: s.y, col: z.col, kind: z.barrier });
    return;
  }
  for (const u of w.units) {
    if (!u.alive || u.id === s.owner || s.hit.includes(u.id) || u.dashT > 0) continue;
    if (hyp(u.x - s.x, u.y - s.y) > u.r + s.size) continue;
    // 反力変換の構え：触れた弾を撃ち返す
    if (u.reflectT > 0) { reflect(w, s, u.id, s.col); return; }
    if (s.r.trigger === 'contact' || s.r.trigger === 'proximity') {
      if (s.pierce > 0) { s.pierce--; s.hit.push(u.id); effectAt(w, s, s.x, s.y, 10, 1, u); continue; }
      activate(w, s, s.x, s.y, u);
      return;
    }
    // 時限の弾は体をすり抜け、狙った地点で炸裂する（地点を狙う術）。指示の術式は体に当たるとそこで止まる
    if (s.r.trigger === 'fuse' && !s.rolling) { s.hit.push(u.id); continue; }
    arrive(w, s);
    return;
  }
}
// 反射：糸は元の術者から離れる（旧版の境界の決まり）
function reflect(w, s, newOwner, col) {
  s.owner = newOwner; s.linked = false; s.hold = false; s.vx = -s.vx; s.vy = -s.vy; s.hit = [newOwner]; s.traveled = 0; s.homing = false; s.passed = [];
  w.events.push({ type: 'reflect', x: s.x, y: s.y, col });
}
function hitObstacle(w, s, cx, cy, rad) {
  // 手裏剣：岩や結界に当たると跳ね返る（当たった面の向きで反射）
  if (s.bounce > 0 && cx !== undefined) {
    s.bounce--;
    const dx = s.x - cx, dy = s.y - cy, d = hyp(dx, dy) || 1, nx = dx / d, ny = dy / d, vn = s.vx * nx + s.vy * ny;
    if (vn < 0) { s.vx -= 2 * vn * nx; s.vy -= 2 * vn * ny; }
    s.x = cx + nx * (rad + 1); s.y = cy + ny * (rad + 1);
    w.events.push({ type: 'ricochet', x: s.x, y: s.y, col: s.col });
    return;
  }
  if (s.r.trigger === 'contact') {
    if (s.r.form === 'point') { s.done = true; w.events.push({ type: 'splat', x: s.x, y: s.y, col: s.col }); }
    else activate(w, s, s.x, s.y, null);
  } else { s.x -= s.vx * 0.02; s.y -= s.vy * 0.02; arrive(w, s); }
}
// 貫通光線：岩と違う紋の結界で止まる（虚蝕・相の追加性質は結界を越える）。途中の相手はすべて貫く
function fireBeam(w, u, common, a, range, width) {
  const x0 = u.x + Math.cos(a) * u.r, y0 = u.y + Math.sin(a) * u.r;
  const dx = Math.cos(a), dy = Math.sin(a);
  // 線と円が最初に交わる距離（交わらなければ null。始点が円の中なら 0）
  const entry = (cx, cy, r) => {
    const fx = cx - x0, fy = cy - y0, t = fx * dx + fy * dy;
    const off = hyp(fx - dx * t, fy - dy * t);
    if (off >= r) return null;
    const l = t - Math.sqrt(r * r - off * off);
    if (t + Math.sqrt(r * r - off * off) < 0) return null;
    return Math.max(0, l);
  };
  let len = range;
  for (const k of w.rocks) { const e = entry(k.x, k.y, k.r * 0.9); if (e !== null && e < len) len = e; }
  // 光線は溜めが長い分、一撃が重い（旧版の1.6倍をさらに強めた）。結界に当たると、固体は貫き、エネルギーは強ければ砕いて進む
  const C = R.clash;
  let dmg = common.dmg * (D.behaviors.beam.hitMul || 1);
  const passWard = common.res.type === 'void' || extrasCount(common.r, 'phase') > 0;
  if (!passWard) {
    const blocks = [];
    for (const g of w.wards) {
      if (g.owner === u.id || g.low || g.hp <= 0) continue;
      // 面の結界は線分に沿って並べた円で調べる
      let e = null;
      for (const p of wardSamples(g)) { const q = entry(p.x, p.y, g.r); if (q !== null && (e === null || q < e)) e = q; }
      if (e !== null && e < len) blocks.push({ e, o: g, ward: true });
    }
    for (const z of w.zones) if (z.barrier && !z.dead && z.owner !== u.id) { const e = entry(z.x, z.y, z.zr); if (e !== null && e < len) blocks.push({ e, o: z, ward: false }); }
    blocks.sort((p, q) => p.e - q.e);
    for (const b of blocks) {
      if (b.e >= len) break;
      const o = b.o;
      // 完全の結界は光線でも砕けない
      if (o.matter === 'perfect') {
        len = b.e;
        const po = unitById(w, o.owner); if (po) po.blocked++;
        w.events.push({ type: 'absorb', x: x0 + dx * len, y: y0 + dy * len, col: o.col, kind: 'perfect' });
        break;
      }
      const solid = o.matter === 'solid', hit = dmg * (solid ? C.beamSolid : C.beamWard);
      if (b.ward) hurtWard(w, o, hit); else hurtZone(w, o, hit);
      const broke = b.ward ? o.hp <= 0 : o.dead;
      if (solid || broke) {
        if (!broke) { dmg *= C.pierceKeep; w.events.push({ type: 'pierce', x: x0 + dx * b.e, y: y0 + dy * b.e, col: common.col }); }
        continue;
      }
      len = b.e;
      w.events.push({ type: 'absorb', x: x0 + dx * len, y: y0 + dy * len, col: o.col, kind: o.barrier || o.kind });
      break;
    }
  }
  len = Math.max(0, len);
  const onBeam = (x, y, r) => { const fx = x - x0, fy = y - y0, t = fx * dx + fy * dy; return t > 0 && t < len && hyp(fx - dx * t, fy - dy * t) < r + width; };
  for (const o of w.spells) if (!o.done && o.kind === 'proj' && o.state === 'fly' && o.owner !== u.id && o.matter === 'energy' && onBeam(o.x, o.y, o.size)) {
    o.done = true; w.events.push({ type: 'cancel', x: o.x, y: o.y, col: common.col, col2: o.col });
  }
  for (const z of w.zones) if (z.owner === u.id && !z.dead && z.matter !== 'solid' && onBeam(z.x, z.y, z.zr)) {
    dmg *= R.resonance; w.events.push({ type: 'resonate', x: z.x, y: z.y, col: z.col, col2: common.col, owner: u.id });
    break;
  }
  for (const o of w.units) {
    if (!o.alive || o.id === u.id || o.dashT > 0) continue;
    const fx = o.x - x0, fy = o.y - y0, t = fx * dx + fy * dy;
    if (t < -o.r || t > len + o.r) continue;
    // 光線もわずかに散る（届いた距離で弱まる）
    if (hyp(fx - dx * t, fy - dy * t) < o.r + width) hitFoe(w, { ...common, dmg, vx: dx, vy: dy, traveled: Math.max(0, t) }, u, o, 1, dx, dy);
  }
  w.events.push({ type: 'beam', id: u.id, x1: x0, y1: y0, x2: x0 + dx * len, y2: y0 + dy * len, w: width, col: common.col, rtype: common.res.type, a: common.r.a });
}

// ═══ 09. 起動（追加機能）と現象 ═════════════════════════════════
// 構造を作る現象：起動した場所に結界・領域・囮を置く。残留させると長く保つ
const STRUCTURE = ['solid', 'wall', 'trench', 'root', 'prison', 'bulwark', 'shift', 'counter', 'bloom', 'well', 'mirror', 'blink', 'mend', 'veil'];
function activate(w, s, x, y, direct) {
  s.done = true;
  const owner = unitById(w, s.owner);
  if (!owner) return;
  const r = s.r, type = s.res.type, dep = r.deploy;
  w.events.push({ type: 'activate', x, y, r: s.radius, col: s.col, rtype: type, a: r.a, b: r.b, deploy: dep, form: r.form, owner: s.owner, matter: r.matter });
  if (dep !== 'sprinkle' && (r.form !== 'point' || dep === 'burst')) {
    for (const o of w.spells) {
      if (o.done || o.kind !== 'proj' || o.state !== 'fly' || o.owner === s.owner || hyp(o.x - x, o.y - y) > s.radius) continue;
      if (o.matter === 'energy') { o.done = true; w.events.push({ type: 'cancel', x: o.x, y: o.y, col: s.col, col2: o.col }); }
      else { const d = hyp(o.x - x, o.y - y) || 1, sp = hyp(o.vx, o.vy); o.vx = (o.x - x) / d * sp; o.vy = (o.y - y) / d * sp; o.homing = false; o.dmg *= 0.7; w.events.push({ type: 'ricochet', x: o.x, y: o.y, col: o.col }); }
    }
    const reach = s.radius * R.chainReach;
    for (const o of w.spells) {
      if (o === s || o.done || o.state !== 'wait' || hyp(o.x - x, o.y - y) > reach) continue;
      if (o.owner === s.owner) {
        w.events.push({ type: 'chainBlast', x1: x, y1: y, x2: o.x, y2: o.y, col: o.col });
        activate(w, o, o.x, o.y, null);
      } else { o.done = true; w.events.push({ type: 'fizzle', x: o.x, y: o.y, col: o.col }); }
    }
  }
  if (dep === 'sprinkle') {
    // 散魔：攻撃せず、負荷の約8割を魔力の粒として撒く。粒は追尾の囮にもなる
    const total = s.cost * R.sprinkle, n = 6;
    for (let i = 0; i < n; i++) dropMote(w, x, y, total / n, 'yellow', 200, 0, true);
    w.decoys.push({ id: w.nextId++, owner: s.owner, x, y, t: 0, life: R.decoy.life, col: s.col });
    return;
  }
  if (dep === 'linger' && !STRUCTURE.includes(type)) { spawnZone(w, { ...s, x, y }, 'linger', s.radius, 3.5 * r.duration); return; }
  if (dep === 'siphon') { spawnZone(w, { ...s, x, y }, 'siphon', s.radius, 3 * r.duration); return; }
  const mul = dep === 'burst' ? 1.1 : dep === 'scatter' ? 0.55 : 1;
  effectAt(w, s, x, y, dep === 'scatter' ? s.radius * 0.6 : s.radius, mul, direct);
  if (dep === 'scatter' && !s.frag) for (let i = 0; i < 5; i++) spawnShard(w, s, x, y, i / 5 * TAU + w.rng(), 0.32);
  // 小片からはさらに小片を生まない（増殖が止まらなくなる）
  if (type === 'swarm' && !s.frag) for (let i = 0; i < 3; i++) spawnShard(w, s, x, y, w.rng() * TAU, 0.3);
}
// 追尾する小片（分裂・増殖苗床・増の追加性質）
function spawnShard(w, s, x, y, a, mul) {
  const r = { ...s.r, form: 'point', behavior: 'homing', trigger: 'contact', deploy: 'single', link: 'cut', extras: s.r.extras.filter(k => k !== 'grow') };
  w.spells.push({
    owner: s.owner, col: s.col, r, res: s.res, dmg: s.dmg * mul, radius: 30, hold: false, linked: false, cost: 0, cast: s.cast,
    id: w.nextId++, kind: 'proj', state: 'fly', x, y, vx: Math.cos(a) * 420, vy: Math.sin(a) * 420, speed: 420,
    range: 420, traveled: 0, age: 0, wait: 0, fuseT: 1, homing: true, tgt: null, retarget: 0, size: 4, pierce: 0, hit: [], shape: 'shard', frag: true,
    matter: s.r.matter, passed: [], bounce: 0, t: 0, life: 0, ang: 0, orad: 0, hp: 0, hitT: 0,
    wardMul: 1, returns: false, back: false, spin: 0, orbMul: 0
  });
}
// 現象が起こる：範囲の中の違う紋に効き、種類によって結界・領域を作る
function effectAt(w, s, x, y, radius, mul, direct) {
  const owner = unitById(w, s.owner);
  if (!owner) return;
  const type = s.res.type, r = s.r, dur = r.duration * (r.deploy === 'linger' ? 1.8 : 1);
  const foes = [];
  for (const u of w.units) {
    if (!u.alive || u.id === s.owner || u.dashT > 0) continue;
    if (u === direct || hyp(u.x - x, u.y - y) < radius + u.r) foes.push(u);
  }
  const dir = s.vx || s.vy ? Math.atan2(s.vy, s.vx) : owner.aim;
  switch (type) {
    case 'solid': case 'wall': case 'trench': buildWards(w, s, x, y, dir, type, dur); break;
    case 'root': buildWards(w, s, x, y, dir, 'root', dur * 0.6); break;
    case 'prison': for (const u of foes) ringWards(w, s, u.x, u.y, u.r + 30, 8, 'prison', 2.8 * r.duration); break;
    case 'bulwark': case 'shift': spawnZone(w, { ...s, x, y }, 'barrier', radius * 0.8, 4 * dur); break;
    case 'counter': owner.reflectT = Math.max(owner.reflectT, 1.2 * r.duration); break;
    case 'bloom': spawnZone(w, { ...s, x, y }, 'bloom', radius, 3 * dur); break;
    case 'well': spawnZone(w, { ...s, x, y }, 'well', radius, 4 * dur); break;
    case 'mirror':
      // 重層鏡界：術者の像を置き、追尾をそちらへ引く
      for (let i = 0; i < 2; i++) { const a = w.rng() * TAU; w.decoys.push({ id: w.nextId++, owner: s.owner, x: owner.x + Math.cos(a) * 70, y: owner.y + Math.sin(a) * 70, t: 0, life: R.decoy.life * r.duration, col: s.col, mirror: true, ink: owner.ink, crest: owner.crest, r: owner.r }); }
      break;
    case 'blink': {
      // 転位穿孔：術式の到達点へ位相を先行させ、術者が跳ぶ
      const ok = hyp(x, y) < w.R && !w.rocks.some(k => hyp(k.x - x, k.y - y) < k.r + owner.r);
      if (ok) { w.events.push({ type: 'blink', id: owner.id, x1: owner.x, y1: owner.y, x2: x, y2: y, col: s.col }); owner.x = x; owner.y = y; owner.phaseT = Math.max(owner.phaseT, 0.45); }
      break;
    }
    case 'mend':
      // 修復：自分の紋の魔力で構造を埋め直す。範囲に自分がいれば直る
      if (hyp(owner.x - x, owner.y - y) < radius + owner.r) heal(w, owner, s.dmg * 1.1 * mul);
      break;
    case 'sunder': case 'corrode': case 'unmake':
      for (const g of w.wards) if (g.owner !== s.owner && wardDist(g, x, y) < radius + g.r) hurtWard(w, g, s.dmg * (type === 'unmake' ? 99 : 3.5), type === 'unmake');
      if (type === 'unmake') {
        for (const z of w.zones) if (z.owner !== s.owner && hyp(z.x - x, z.y - y) < radius + z.zr) z.dead = true;
        for (const o of w.spells) if (o.owner !== s.owner && (o.state === 'wait' || o.kind === 'orbiter') && !o.done && hyp(o.x - x, o.y - y) < radius) { o.done = true; w.events.push({ type: 'fizzle', x: o.x, y: o.y, col: o.col }); }
      }
      break;
  }
  for (const u of foes) hitFoe(w, s, owner, u, mul, (u.x - x) || Math.cos(dir), (u.y - y) || Math.sin(dir));
}
function heal(w, u, amount) {
  if (!u.alive || amount <= 0) return;
  u.hp = Math.min(u.maxHp, u.hp + amount);
  w.events.push({ type: 'heal', id: u.id, x: u.x, y: u.y, v: amount });
}

// ═══ 10. 領域・結界・囮 ═════════════════════════════════════════
function spawnZone(w, s, kind, zr, life) {
  const barrier = kind === 'barrier' ? s.res.type
    : kind === 'orbit' && ['bulwark', 'shift', 'counter'].includes(s.res.type) ? s.res.type : null;
  // 結界の領域は硬さを持つ。強い光線や、エネルギーの膜を剥がす固体の弾で砕ける
  const hp = barrier ? (R.barrierHp.base + s.res.control * R.barrierHp.perControl) * s.r.power : 0;
  const z = { id: w.nextId++, owner: s.owner, col: s.col, r: s.r, res: s.res, dmg: s.dmg, cost: s.cost, hold: s.hold, linked: s.linked,
    kind, x: s.x, y: s.y, zr, t: 0, life, tick: 0, barrier, matter: s.r.matter, hp, max: hp, dead: false };
  w.zones.push(z);
  // 周回で構造を作る現象は、術者の周りに一度だけ作る
  const owner = unitById(w, s.owner);
  if (kind === 'orbit' && owner) {
    if (s.res.type === 'solid') owner.shield = Math.max(owner.shield, 12 + s.res.terrain * 0.4 * s.r.power);   // 固化装甲
    if (['wall', 'trench', 'root', 'prison'].includes(s.res.type)) ringWards(w, s, owner.x, owner.y, owner.r + 44, 10, s.res.type, 3 * s.r.duration);
    if (s.res.type === 'counter') owner.reflectT = Math.max(owner.reflectT, 0.8);
  }
  w.events.push({ type: 'zone', id: z.id, kind, x: z.x, y: z.y, r: zr, col: z.col, rtype: s.res.type, owner: s.owner });
  return z;
}
function updateZones(w, dt) {
  for (let i = w.zones.length - 1; i >= 0; i--) {
    const z = w.zones[i];
    const owner = unitById(w, z.owner);
    z.t += dt * (z.linked ? R.link.decayMul : 1);
    if (z.dead || z.t > z.life || !owner || !owner.alive) { w.zones.splice(i, 1); w.events.push({ type: 'zoneEnd', x: z.x, y: z.y, col: z.col }); continue; }
    if (z.kind === 'orbit') { z.x = owner.x; z.y = owner.y; }
    z.tick -= dt;
    if (z.tick > 0) continue;
    z.tick = 0.5;
    const type = z.res.type;
    const inside = u => hyp(u.x - z.x, u.y - z.y) < z.zr + u.r;
    if (z.kind === 'bloom') {
      if (inside(owner)) heal(w, owner, owner.maxHp * 0.04);
      for (const u of w.units) if (u.alive && u !== owner && inside(u)) hitFoe(w, z, owner, u, 0.25, u.x - z.x, u.y - z.y);
      continue;
    }
    if (z.kind === 'well') { if (inside(owner)) owner.mp = Math.min(maxMp(owner), owner.mp + 6); continue; }
    if (z.kind === 'barrier') continue;
    if (z.kind === 'siphon') {
      // 吸魔：領域の中の違う紋から魔力と魔素を奪う
      for (const u of w.units) {
        if (!u.alive || u === owner || !inside(u)) continue;
        const m = Math.min(u.mp, R.siphon.mp * z.r.power); u.mp -= m; owner.mp = Math.min(maxMp(owner), owner.mp + m);
        if (u.mass > 0) { const s = Math.min(u.mass, R.siphon.mass * z.r.power); u.mass -= s; refreshBody(u); gain(w, owner, s); }
        if (!STRUCTURE.includes(type)) hitFoe(w, z, owner, u, 0.2, u.x - z.x, u.y - z.y);
      }
      continue;
    }
    if (z.kind === 'orbit') {
      if (z.barrier || ['solid', 'wall', 'trench', 'root', 'prison', 'well', 'mirror', 'blink', 'veil'].includes(type)) continue;
      if (type === 'mend' || type === 'bloom') { heal(w, owner, z.dmg * 0.35); continue; }
    }
    // 残留・周回：中にいる違う紋に作用し続ける
    for (const u of w.units) if (u.alive && u !== owner && inside(u)) {
      if (z.kind === 'linger') slow(u, R.linger.slow, 0.6);
      hitFoe(w, z, owner, u, z.kind === 'orbit' ? 0.4 : R.linger.tick, u.x - z.x, u.y - z.y);
    }
  }
  for (let i = w.wards.length - 1; i >= 0; i--) {
    const g = w.wards[i];
    g.t += dt * (g.linked ? R.link.decayMul : 1);
    if (g.hp <= 0 || g.t > g.life || !unitById(w, g.owner)) w.wards.splice(i, 1);
  }
  for (let i = w.decoys.length - 1; i >= 0; i--) { const d = w.decoys[i]; d.t += dt; if (d.t > d.life) w.decoys.splice(i, 1); }
}
// 結界（固化・物性編壁・掘削塹壕・根絡）：違う紋の弾と体を止める。自分の紋は通れる（① 紋）
// 細い波・壁は「面の結界」（一枚の壁）、環は多角形に囲む城壁、弾は太い柱、広い場は散らばる柱
// 固体の結界はとても硬い（RULES.solidWardHp）。面の結界は一枚でまとめて硬い（RULES.slabHp）
function buildWards(w, s, x, y, dir, kind, dur) {
  const owner = unitById(w, s.owner);
  const hp = (18 + s.res.terrain * 0.32) * s.r.power * (kind === 'wall' ? 1.5 : 1) * (1 + Math.sqrt(Math.max(0, owner ? owner.mass : 0)) * 0.02)
    * (s.r.matter === 'energy' ? 1 : R.solidWardHp);
  const form = s.r.form, nx = -Math.sin(dir), ny = Math.cos(dir), life = 7 * dur;
  if (kind !== 'root' && (form === 'line' || form === 'plane')) {
    const half = form === 'plane' ? 100 : 56;
    addWard(w, s, x, y, 15, hp * R.slabHp * (form === 'plane' ? 1 : 0.6), kind, life, nx * half, ny * half);
    return;
  }
  if (form === 'ring') {
    if (kind === 'root') { ringWards(w, s, x, y, s.radius * 0.72, 12, kind, life); return; }
    // 六角の城壁：六枚の面の結界で囲む
    const rad = s.radius * 0.72, n = 6;
    for (let i = 0; i < n; i++) {
      const a1 = i / n * TAU, a2 = (i + 1) / n * TAU;
      const ax = x + Math.cos(a1) * rad, ay = y + Math.sin(a1) * rad, bx = x + Math.cos(a2) * rad, by = y + Math.sin(a2) * rad;
      addWard(w, s, (ax + bx) / 2, (ay + by) / 2, 13, hp * R.slabHp * 0.5, kind, life, (bx - ax) / 2, (by - ay) / 2);
    }
    return;
  }
  const pts = [];
  if (form === 'point') pts.push({ x, y });
  else for (let i = 0; i < 8; i++) { const a = w.rng() * TAU, d = Math.sqrt(w.rng()) * s.radius * 0.8; pts.push({ x: x + Math.cos(a) * d, y: y + Math.sin(a) * d }); }
  const rr = form === 'point' ? 34 : 24;
  for (const p of pts) addWard(w, s, p.x, p.y, rr, form === 'point' ? hp * 2 : hp, kind, life);
}
function ringWards(w, s, x, y, rad, n, kind, life) {
  const hp = (14 + s.res.terrain * 0.25) * s.r.power;
  for (let i = 0; i < n; i++) addWard(w, s, x + Math.cos(i / n * TAU) * rad, y + Math.sin(i / n * TAU) * rad, 20, hp, kind, life);
}
// hx, hy：面の結界の半分の長さのベクトル（柱なら 0）。面は線分 (x±hx, y±hy) に太さ r を持つ
function addWard(w, s, x, y, r, hp, kind, life, hx = 0, hy = 0) {
  if (hyp(x, y) > w.R + 100) return;
  w.wards.push({ id: w.nextId++, owner: s.owner, col: s.col, x, y, r, hp, max: hp, t: 0, life, kind, low: kind === 'trench', hold: s.hold, linked: s.linked, cost: s.cost / 5, matter: s.r.matter, broken: false,
    ax: x - hx, ay: y - hy, bx: x + hx, by: y + hy, len: hyp(hx, hy) * 2 });
}
// 結界のいちばん近い点（柱は中心、面は線分の上）
function wardPoint(g, px, py) {
  if (!g.len) return { x: g.x, y: g.y };
  const dx = g.bx - g.ax, dy = g.by - g.ay, t = clamp(((px - g.ax) * dx + (py - g.ay) * dy) / (dx * dx + dy * dy), 0, 1);
  return { x: g.ax + dx * t, y: g.ay + dy * t };
}
function wardDist(g, px, py) { const p = wardPoint(g, px, py); return hyp(px - p.x, py - p.y); }
// 面の結界を太さの間隔で並べた点（光線と Bot の射線の判定に使う）
function wardSamples(g) {
  if (!g.len) return [{ x: g.x, y: g.y }];
  const n = Math.max(2, Math.ceil(g.len / g.r)), out = [];
  for (let i = 0; i <= n; i++) out.push({ x: g.ax + (g.bx - g.ax) * i / n, y: g.ay + (g.by - g.ay) * i / n });
  return out;
}
function hurtWard(w, g, dmg, force = false) {
  if (g.matter === 'perfect' && !force) return;
  g.hp -= dmg;
  if (g.hp <= 0 && !g.broken) { g.broken = true; w.events.push({ type: 'wardBreak', x: g.x, y: g.y, col: g.col, r: g.r, matter: g.matter }); }
}
function hurtZone(w, z, dmg) {
  if (!z.barrier || z.dead || z.matter === 'perfect') return;
  z.hp -= dmg;
  if (z.hp <= 0) { z.dead = true; w.events.push({ type: 'wardBreak', x: z.x, y: z.y, col: z.col, r: z.zr, matter: z.matter, big: true }); }
}

// ═══ 11. 糸（維持費・切断・誘導・指示起爆・回収） ════════════════
// 糸でつながった術式は、術者から毎秒維持費を取る。距離・魔力切れで切れる（④ 糸）
function linkedOf(w, u) {
  const out = [];
  for (const s of w.spells) if (s.owner === u.id && s.linked && !s.done) out.push(s);
  for (const z of w.zones) if (z.owner === u.id && z.linked && !z.dead) out.push(z);
  for (const g of w.wards) if (g.owner === u.id && g.linked && g.hp > 0) out.push(g);
  return out;
}
function updateLinks(w, dt) {
  for (const u of w.units) {
    if (!u.alive) continue;
    const list = linkedOf(w, u);
    if (!list.length) continue;
    let upkeep = 0;
    for (const o of list) {
      if (hyp(o.x - u.x, o.y - u.y) > R.link.range) { sever(w, o, 'far'); continue; }
      upkeep += (R.link.upkeepBase + o.cost * R.link.upkeepScale) * R.link.upkeepMul / (o.low !== undefined ? 5 : 1);
    }
    u.mp -= upkeep * dt;
    if (u.mp <= 0) { u.mp = 0; severAll(w, u, 'mp'); }
  }
}
function sever(w, o, why) {
  if (!o.linked) return;
  o.linked = false;
  w.events.push({ type: 'sever', x: o.x, y: o.y, owner: o.owner, why });
}
function severAll(w, u, why) { for (const o of linkedOf(w, u)) sever(w, o, why); }
// 指示起爆（F）：糸でつながった「指示」の術式に合図を送る
function detonate(w, u) {
  let n = 0;
  for (const s of w.spells.slice()) if (s.owner === u.id && s.linked && s.r.trigger === 'command' && !s.done) { activate(w, s, s.x, s.y, null); n++; }
  if (n) w.events.push({ type: 'detonate', id: u.id, n });
  return n;
}
// 回収（G）：糸でつながった術式をほどき、残っている割合 × 60% の魔力を戻す
function recall(w, u) {
  let refund = 0, n = 0;
  for (const o of linkedOf(w, u)) {
    let left;
    const ward = o.low !== undefined, spell = o.kind === 'proj' || o.kind === 'lob' || o.kind === 'trap' || o.kind === 'orbiter';
    if (ward) left = Math.max(0, 1 - o.t / o.life) * Math.max(0, o.hp / o.max);
    else if (o.kind === 'orbiter') left = Math.max(0, 1 - o.t / o.life);
    else if (spell) left = Math.max(0, 1 - o.wait / (6 * o.r.duration));
    else left = Math.max(0, 1 - o.t / o.life);
    refund += o.cost * R.recall.refund * left;
    n++;
    if (ward) o.hp = 0;
    else if (spell) o.done = true;
    else o.dead = true;
    w.events.push({ type: 'unravel', x: o.x, y: o.y, col: o.col, owner: u.id });
  }
  if (n) { u.mp = Math.min(maxMp(u), u.mp + refund); w.events.push({ type: 'recall', id: u.id, x: u.x, y: u.y, n, refund }); }
  return refund;
}
function clearOwned(w, id) {
  w.spells = w.spells.filter(s => s.owner !== id);
  w.zones = w.zones.filter(z => z.owner !== id);
  w.wards = w.wards.filter(g => g.owner !== id);
  w.decoys = w.decoys.filter(d => d.owner !== id);
}

// ═══ 12. 命中（旧版 impact と同じ効き方） ═══════════════════════
function hitFoe(w, s, owner, u, mul, dirx, diry) {
  const type = s.res.type, r = s.r;
  const ex = k => extrasCount(r, k);
  let base = s.dmg * mul;
  if (r.deploy === 'siphon') base *= R.siphon.dmg;
  // 放った術は離れるほど散って弱まる（③ 散逸）
  if (s.traveled > 0) base *= falloffMul(r, s.traveled);
  if (u.phaseT > 0 && type !== 'void') { w.events.push({ type: 'phased', x: u.x, y: u.y }); return; }
  if (u.spawnShield > 0) base = 0;
  // 相の追加性質：硬化・殻による減衰を受けにくい
  const soften = Math.min(1, ex('phase') * .5), mit = m => m + (1 - m) * soften;
  if (ex('divide')) u.shield = 0;
  if (u.hardenT > 0) base *= mit(.62);
  if (u.shield > 0 && type !== 'void' && base > 0) { const a = Math.min(u.shield, base * mit(.55)); u.shield -= a; base -= a; }
  if (u.casting) base *= 1.12;
  if (u.markT > 0) base *= 1.2;
  const d = hyp(dirx, diry) || 1, nx = dirx / d, ny = diry / d;
  const knock = (u.hardenT > 0 ? .5 : 1);
  const push = v => { u.vx += nx * v * knock; u.vy += ny * v * knock; };
  let dmg = 0;
  switch (type) {
    case 'tether': { dmg = base * .6; root(u, R.bind.tether); const tx = owner.x - u.x, ty = owner.y - u.y, td = hyp(tx, ty) || 1; u.vx += tx / td * 220 * knock; u.vy += ty / td * 220 * knock; break; }
    case 'poison': dmg = base * .35; u.poisonT = Math.max(u.poisonT, 4.5 * r.duration); u.poisonDps = Math.max(u.poisonDps, s.dmg * R.poisonDps); u.poisonBy = owner.id; slow(u, .4, 1.4); break;
    case 'root': dmg = base * .3; root(u, R.bind.root * r.duration); break;
    case 'shock': dmg = base; push(390 * D.forms[r.form].power); break;
    case 'bloom': dmg = base * .25; heal(w, owner, base * .5); owner.mp = Math.min(maxMp(owner), owner.mp + base * .5); break;
    case 'prison': dmg = base * .35; root(u, R.bind.prison * r.duration); u.shield = 0; break;
    case 'void': dmg = base; owner.phaseT = Math.max(owner.phaseT, .5); break;
    case 'blink': dmg = base * .85; break;
    case 'corrode': { dmg = base * .85; const m = Math.min(u.mp, base * .35); u.mp -= m; owner.mp = Math.min(maxMp(owner), owner.mp + m * .7); break; }
    case 'counter': dmg = base * .65; owner.reflectT = Math.max(owner.reflectT, .6); break;
    case 'cascade': dmg = base * .72; chain(w, s, owner, u, base * .5); break;
    case 'wall': dmg = base * .15; u.vx *= .2; u.vy *= .2; break;
    case 'rend': dmg = base * 1.05; u.shield = 0; slow(u, .3, .5); break;
    case 'unmake': dmg = base * .8; u.shield = 0; root(u, .5); break;
    case 'swarm': dmg = base * .5; slow(u, .3, .9); break;
    case 'scan': dmg = base * .35; u.markT = Math.max(u.markT, 6); break;
    case 'shift': { dmg = base * .45; const m = Math.min(u.mp, base * .5); u.mp -= m; owner.mp = Math.min(maxMp(owner), owner.mp + m * .8); break; }
    case 'well': dmg = base * .1; break;
    case 'bolt': dmg = base * .95; push(170); break;
    case 'solid': dmg = base * .3; slow(u, .35, .8); break;
    case 'sunder': dmg = base * .9; u.shield = 0; u.hardenT = 0; break;
    case 'drain': {
      // 吸奪：魔力を奪って自分の魔力にし、奪った分だけ自分の構造も埋める
      dmg = base * .55;
      const m = Math.min(u.mp, base * 1.1); u.mp -= m; owner.mp = Math.min(maxMp(owner), owner.mp + m * .8);
      heal(w, owner, dmg * .5);
      if (u.mass > 0) { const ms = Math.min(u.mass, base * .05); u.mass -= ms; refreshBody(u); gain(w, owner, ms); }
      break;
    }
    case 'mend': case 'veil': dmg = base * .28; break;
    case 'trench': dmg = base * .35; slow(u, .3, .5); break;
    case 'mirror': case 'bulwark': dmg = base * .2; break;
    default: dmg = base * .65; slow(u, .3, .7);
  }
  // 固体は重く、当たった相手を押し込む
  if (r.matter === 'solid' && dmg > 0) push(matterOf(r).knock);
  if (shapeOf(r).knock && dmg > 0 && s.kind !== 'orbiter') push(shapeOf(r).knock);
  // 追加性質の副作用（主効果のあとに上乗せ）
  if (ex('motion')) push(150 * ex('motion'));
  if (ex('bind')) { slow(u, Math.min(.6, .3 * ex('bind')), 1.2); if (ex('bind') >= 2) root(u, .6); }
  if (ex('convert')) { const m = Math.min(u.mp, 3 * r.power * ex('convert')); u.mp -= m; owner.mp = Math.min(maxMp(owner), owner.mp + m * .5); }
  if (ex('grow') && !s.frag) for (let k = 0; k < ex('grow'); k++) spawnShard(w, s, u.x, u.y, w.rng() * TAU, .3);
  // 断ち切る性質の術式は、相手の糸も断つ
  if (['rend', 'sunder', 'unmake'].includes(type)) severAll(w, u, 'cut');
  if (!u.alive) return;
  damage(w, u, dmg, owner);
  w.events.push({ type: 'hit', x: u.x - nx * u.r * 0.6, y: u.y - ny * u.r * 0.6, dmg, col: s.col, rtype: type, a: r.a, target: u.id, owner: owner.id, vx: nx, vy: ny, shielded: dmg <= 0, matter: r.matter });
}
function root(u, t) { u.rootT = Math.max(u.rootT, t); }
function slow(u, amt, t) { u.slowAmt = Math.max(u.slowAmt, amt); u.slowT = Math.max(u.slowT, t); }
// 連鎖波：いちばん近い別の相手へ跳ぶ
function chain(w, s, owner, from, dmg) {
  let best = null, bd = 320;
  for (const u of w.units) { if (!u.alive || u === owner || u === from) continue; const d = hyp(u.x - from.x, u.y - from.y); if (d < bd) { bd = d; best = u; } }
  if (!best) return;
  w.events.push({ type: 'chain', x1: from.x, y1: from.y, x2: best.x, y2: best.y, col: s.col });
  damage(w, best, dmg, owner);
}
function damage(w, u, dmg, source) {
  if (!u.alive || dmg <= 0) return;
  if (source && source.id !== u.id) source.dealt += dmg;
  if (u.dummy) {
    u.hp -= dmg; u.combatT = 0; u.hurtT = 0.09;
    if (u.hp <= 0) { u.hp = u.maxHp; w.events.push({ type: 'dummyReset', id: u.id, x: u.x, y: u.y }); }
    return;
  }
  // 修練場の術者は散らない（暴発しても構造が1だけ残る）
  if (w.room.practice) { u.taken += dmg; u.hp = Math.max(1, u.hp - dmg); u.combatT = 0; u.hurtT = 0.09; return; }
  u.hp -= dmg;
  u.combatT = 0;
  u.hurtT = 0.09;
  if (source && source.id !== u.id) { u.lastHitBy = source.id; u.lastHitT = w.t; }
  if (u.hp <= 0) kill(w, u);
}

// ═══ 13. 撃破と再参加 ═══════════════════════════════════════════
function kill(w, u) {
  u.alive = false;
  u.hp = 0;
  u.casting = null; u.queue = null;
  u.deadT = w.t;
  severAll(w, u, 'down');
  const credit = u.lastHitBy && w.t - u.lastHitT < W.death.creditTime ? w.units.find(o => o.id === u.lastHitBy && o.alive) : null;
  // 構造を失った体は魔素に戻り、周りへ散る（③ 散逸）
  const total = u.mass * W.death.dropShare + W.death.dropBase;
  const n = clamp(Math.round(total / 3), 6, 90);
  for (let i = 0; i < n; i++) {
    const a = w.rng() * TAU, d = w.rng() * u.r;
    dropMote(w, u.x + Math.cos(a) * d, u.y + Math.sin(a) * d, total / n, u.ink, 160 + u.r * 5);
  }
  if (credit) {
    credit.kills++;
    gain(w, credit, u.mass * W.death.killerShare + W.death.killerBase);
    credit.hp = Math.min(credit.maxHp, credit.hp + credit.maxHp * W.death.killerHeal);
    credit.mp = Math.min(maxMp(credit), credit.mp + maxMp(credit) * W.death.killerMana);
  }
  w.events.push({
    type: 'kill', victim: u.id, killer: credit ? credit.id : null, victimName: u.name, killerName: credit ? credit.name : null,
    x: u.x, y: u.y, r: u.r, ink: u.ink, crest: u.crest, mass: u.mass, peak: u.peak, killerInk: credit ? credit.ink : null,
    deathCry: u.cries.death, winCry: credit ? credit.cries.win : '', killerBot: credit ? credit.bot : false
  });
  if (u.bot) w.respawnQueue.push(w.t + 2 + w.rng() * 5);
}
function updateRespawns(w) {
  for (let i = w.respawnQueue.length - 1; i >= 0; i--) {
    if (w.t < w.respawnQueue[i]) continue;
    w.respawnQueue.splice(i, 1);
    // 散った Bot の抜け殻を片づけて新しい Bot を入れる
    const idx = w.units.findIndex(u => u.bot && !u.alive);
    if (idx >= 0) { clearOwned(w, w.units[idx].id); w.units.splice(idx, 1); }
    addBot(w, w.rng() < 0.2 ? w.rng() * 90 : 0);
  }
}

// ═══ 14. 1フレームの更新 ════════════════════════════════════════
function step(w, dt) {
  dt = Math.min(dt, 0.05);
  w.t += dt;
  markPerfect(w);
  for (const u of w.units) if (u.alive && u.bot) botThink(w, u, dt);
  for (const u of w.units) if (u.alive && u.dummy) dummyThink(w, u, dt);
  for (const u of w.units) if (u.alive) updateUnit(w, u, dt);
  separate(w);
  updateSpells(w, dt);
  updateZones(w, dt);
  updateLinks(w, dt);
  updateMotes(w, dt);
  updateRespawns(w);
  w.rankT -= dt;
  if (w.rankT <= 0) { w.rankT = 0.4; rank(w); }
}
function updateUnit(w, u, dt) {
  const ix = u.input;
  for (let i = 0; i < 4; i++) u.slotCd[i] = Math.max(0, u.slotCd[i] - dt);
  u.dodgeCd = Math.max(0, u.dodgeCd - dt * (u.hasteT > 0 ? 1.6 : 1));
  u.spawnShield = Math.max(0, u.spawnShield - dt);
  u.dashT = Math.max(0, u.dashT - dt); u.hurtT = Math.max(0, u.hurtT - dt);
  u.phaseT = Math.max(0, u.phaseT - dt); u.reflectT = Math.max(0, u.reflectT - dt);
  u.hasteT = Math.max(0, u.hasteT - dt); u.hardenT = Math.max(0, u.hardenT - dt); u.vitalT = Math.max(0, u.vitalT - dt);
  u.rootT = Math.max(0, u.rootT - dt); u.markT = Math.max(0, u.markT - dt);
  u.slowT -= dt; if (u.slowT <= 0) u.slowAmt = 0;
  u.combatT += dt;
  if (u.aegis) {
    u.mp -= R.perfect.drain * dt;
    if (u.mp <= 0) { u.mp = 0; dispelPerfect(w, u, 'mp'); }
  } else {
    // 魔力は勝手には戻らない。節点の中では湧き出し、修練場では常に戻る
    const regen = w.room.practice ? W.mp.practice : u.node >= 0 ? W.node.regen : W.mp.regen;
    u.mp = Math.min(maxMp(u), u.mp + regen * dt);
  }
  if (u.poisonT > 0) {
    u.poisonT -= dt;
    damage(w, u, u.poisonDps * dt, unitById(w, u.poisonBy));
    if (!u.alive) return;
    if (u.poisonT <= 0) u.poisonDps = 0;
  }
  if (u.vitalT > 0) u.hp = Math.min(u.maxHp, u.hp + u.maxHp * 0.05 * dt);
  if (u.mass > W.decay.floor) { u.mass -= (u.mass - W.decay.floor) * W.decay.rate * (1 + u.mass / W.decay.soft) * dt; refreshBody(u); }
  if (u.combatT > W.regen.delay) u.hp = Math.min(u.maxHp, u.hp + u.maxHp * W.regen.perSec * dt);
  // 節点に出入りした（入った節点の原理の術が強まる）
  let node = -1;
  for (const n of w.nodes) if (hyp(u.x - n.x, u.y - n.y) < W.node.r) { node = n.i; break; }
  if (node !== u.node) { u.node = node; if (!u.bot) w.events.push({ type: 'node', id: u.id, node, k: node >= 0 ? w.nodes[node].k : null }); }
  const center = hyp(u.x, u.y) < W.center.r;
  if (center !== u.center) { u.center = center; if (!u.bot && center) w.events.push({ type: 'center', id: u.id }); }
  // 狙い・持ち替え・詠唱・連射
  u.aim = ix.aim;
  if (ix.slot >= 0 && ix.slot < 4) u.sel = ix.slot;
  if (u.casting) { u.casting.t += dt; if (u.casting.t >= u.casting.total) release(w, u); }
  else if (u.queue) {
    u.queue.t -= dt;
    if (u.queue.t <= 0) { fire(w, u, u.spells[u.queue.slot], u.queue.cost); if (--u.queue.left <= 0) u.queue = null; else u.queue.t = R.rapidGap; }
  } else if (ix.cast) beginCast(w, u, u.sel);
  if (!u.alive) return;
  if (ix.detonate) { ix.detonate = false; detonate(w, u); }
  if (ix.recall) { ix.recall = false; recall(w, u); }
  // 回避：進む向きへ跳ぶ。跳んでいる間は当たらない
  if (ix.dodge) {
    ix.dodge = false;
    if (u.dodgeCd <= 0 && u.mp >= W.dodge.cost && !u.casting && u.rootT <= 0) {
      const m = hyp(ix.mx, ix.my), a = m > 0.1 ? Math.atan2(ix.my, ix.mx) : u.aim;
      u.mp -= W.dodge.cost; u.dodgeCd = W.dodge.cd; u.dashT = W.dodge.time; u.spawnShield = 0;
      u.vx = Math.cos(a) * W.dodge.speed; u.vy = Math.sin(a) * W.dodge.speed;
      w.events.push({ type: 'dodge', id: u.id, x: u.x, y: u.y, ink: u.ink });
    }
  }
  // 移動
  let mx = ix.mx, my = ix.my;
  const m = hyp(mx, my);
  if (m > 1) { mx /= m; my /= m; }
  const speed = speedOf(u) * (1 - u.slowAmt) * (u.aegis ? 1 - R.perfect.slow : 1) * (u.casting ? W.cast.slowWhileChant : 1) * (u.hasteT > 0 ? 1.42 : 1) * (u.rootT > 0 ? 0 : 1);
  if (u.dashT <= 0) {
    const k = Math.min(1, dt * W.body.accel);
    u.vx += (mx * speed - u.vx) * k;
    u.vy += (my * speed - u.vy) * k;
  }
  u.x += u.vx * dt; u.y += u.vy * dt;
  // 岩と違う紋の結界に押し戻される（塹壕は体を止めない）
  const push = (cx, cy, r) => {
    const dx = u.x - cx, dy = u.y - cy, d = hyp(dx, dy), min = r + u.r;
    if (d < min && d > 0) { u.x = cx + dx / d * min; u.y = cy + dy / d * min; const vn = (u.vx * dx + u.vy * dy) / d; if (vn < 0) { u.vx -= vn * dx / d; u.vy -= vn * dy / d; } }
  };
  for (const k of w.rocks) push(k.x, k.y, k.r * 0.9);
  for (const g of w.wards) if (g.owner !== u.id && !g.low && g.hp > 0) { const p = wardPoint(g, u.x, u.y); push(p.x, p.y, g.r); }
  // 結界の外：構造が崩れる。さらに外へは出られない
  const dc = hyp(u.x, u.y);
  if (dc > w.R) {
    if (!w.room.practice) damage(w, u, (W.edge.dps + u.maxHp * W.edge.dpsPerHp) * dt, null);
    u.combatT = 0;
    const lim = w.R + W.edge.hardMargin;
    if (dc > lim) { u.x *= lim / dc; u.y *= lim / dc; }
  }
}
// 完全の結界（領域・柱・周回の刃）を張っている術者に印を付ける
function markPerfect(w) {
  for (const u of w.units) u.aegis = false;
  const mark = id => { const u = unitById(w, id); if (u) u.aegis = true; };
  for (const z of w.zones) if (z.matter === 'perfect' && z.barrier && !z.dead) mark(z.owner);
  for (const g of w.wards) if (g.matter === 'perfect' && g.hp > 0) mark(g.owner);
  for (const s of w.spells) if (s.matter === 'perfect' && s.kind === 'orbiter' && !s.done) mark(s.owner);
}
function dispelPerfect(w, u, why) {
  for (const z of w.zones) if (z.owner === u.id && z.matter === 'perfect') z.dead = true;
  for (const g of w.wards) if (g.owner === u.id && g.matter === 'perfect') g.hp = 0;
  for (const s of w.spells) if (s.owner === u.id && s.matter === 'perfect' && s.kind === 'orbiter') s.done = true;
  u.aegis = false;
  w.events.push({ type: 'aegisEnd', id: u.id, x: u.x, y: u.y, why });
}
// 体どうしは重ならない（軽いほうが押される）
function separate(w) {
  const a = w.units;
  for (let i = 0; i < a.length; i++) {
    const p = a[i];
    if (!p.alive) continue;
    for (let j = i + 1; j < a.length; j++) {
      const q = a[j];
      if (!q.alive) continue;
      const dx = q.x - p.x, dy = q.y - p.y, d = hyp(dx, dy), min = p.r + q.r;
      if (d >= min || d === 0) continue;
      const push = (min - d), mp = p.r * p.r, mq = q.r * q.r, sum = mp + mq;
      p.x -= dx / d * push * mq / sum; p.y -= dy / d * push * mq / sum;
      q.x += dx / d * push * mp / sum; q.y += dy / d * push * mp / sum;
    }
  }
}

// ═══ 15. Botの思考 ══════════════════════════════════════════════
// 術の役割：どんな場面で使うかを、術式の組み立てから決める
function spellRole(r) {
  const t = recipeResult(r).type;
  if (r.behavior === 'orbit' && r.b === 'none' && ['motion', 'bind', 'grow'].includes(r.a)) return { motion: 'haste', bind: 'harden', grow: 'heal' }[r.a];
  // 完全の結界は切り札。周回の刃・城壁とエネルギーの結界は、身を守る術
  if (r.matter === 'perfect') return 'aegis';
  if (r.behavior === 'orbit' && r.matter === 'solid') return 'guard';
  if (['bulwark', 'shift', 'counter'].includes(t) && r.behavior === 'orbit') return 'guard';
  if (['solid', 'wall', 'trench'].includes(t)) return 'ward';
  if (['mend', 'bloom'].includes(t)) return 'heal';
  if (r.trigger === 'command') return 'remote';
  if (r.behavior === 'sow' || r.trigger === 'proximity') return 'trap';
  if (r.behavior === 'beam') return 'beam';
  // 拘束（慣性拘束・根絡・位相牢）は、大技へつなぐための術
  if (['tether', 'root', 'prison'].includes(t)) return 'bind';
  // 吸奪・吸魔：魔力が減ったときに相手から奪う
  if (t === 'drain' || r.deploy === 'siphon') return 'drain';
  if (t === 'mirror') return 'decoy';
  if (r.behavior === 'homing') return 'homing';
  if (t === 'blink') return 'blink';
  if (t === 'well') return 'well';
  if (r.behavior === 'lob' || ['ring', 'field'].includes(r.form)) return 'area';
  return 'shot';
}
// 術が相手に届く距離（Bot が射程の外から撃たないために）
function spellReach(r) {
  const bh = D.behaviors[r.behavior], sh = shapeOf(r), rad = D.forms[r.form].radius * (r.deploy === 'burst' ? 1.5 : 1);
  switch (r.behavior) {
    case 'project': case 'homing': case 'relay': return bh.range * sh.range * (sh.returns ? 0.5 : 0.85);
    case 'beam': return bh.range * 0.95;
    case 'lob': return bh.range + rad * 0.5;
    case 'sow': return bh.range + rad * 0.5;
    case 'drop': return rad * 0.9;
    case 'orbit': return rad * 0.7 + R.orbiter.radius[r.form] + 40;
  }
  return 400;
}
function makeBrain(w, school) {
  const r = w.rng;
  return {
    t: 0, mode: 'gather', target: null, wander: null, placing: false,
    // 腕前は高め：先読みの精度・よける確率・守りの判断に効く
    aggr: 0.35 + r() * 0.6, skill: 0.45 + r() * 0.5, flee: 0.2 + r() * 0.2,
    keep: (school ? school.keep : 300 + r() * 180) + r() * 70, strafe: r() < 0.5 ? 1 : -1, reserve: 10 + r() * 26, lastGuard: -9, aegisAt: -99,
    school: school ? school.key : ''
  };
}
function lineBlocked(w, ax, ay, bx, by, self) {
  const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1;
  const test = (cx, cy, r) => { const t = clamp(((cx - ax) * dx + (cy - ay) * dy) / L2, 0, 1); return hyp(ax + dx * t - cx, ay + dy * t - cy) < r; };
  for (const k of w.rocks) if (test(k.x, k.y, k.r * 0.9)) return true;
  for (const g of w.wards) if (g.owner !== self && !g.low && g.hp > 0 && wardSamples(g).some(p => test(p.x, p.y, g.r))) return true;
  return false;
}
// 役割に合い、相手まで届く術の番号（容量を超える術はたまにしか使わない）
function slotFor(w, u, role, dist = 0) {
  for (let i = 0; i < 4; i++) {
    const r = u.spells[i];
    if (spellRole(r) !== role || u.slotCd[i] > 0) continue;
    if (u.mp < recipeCost(r, u) + 4) continue;
    if (dist > spellReach(r)) continue;
    if (misfireChance(r, u) > 0 && w.rng() > 0.05) continue;
    return i;
  }
  return -1;
}
function botThink(w, u, dt) {
  const b = u.brain, ix = u.input, r = w.rng;
  const tgt = b.target && unitById(w, b.target);
  // 狙いは毎フレーム：相手の動きを先読みし、腕前に応じてぶれる
  if (tgt && tgt.alive) {
    const d = hyp(tgt.x - u.x, tgt.y - u.y), lead = d / 760 * (0.4 + b.skill * 0.7);
    const px = tgt.x + tgt.vx * lead, py = tgt.y + tgt.vy * lead;
    const want = Math.atan2(py - u.y, px - u.x);
    ix.aim = u.aim + angDiff(u.aim, want) * Math.min(1, dt * (5 + b.skill * 12)) + (r() - 0.5) * (1 - b.skill) * 0.14;
    if (!b.placing) { ix.tx = px; ix.ty = py; }
  }
  b.t -= dt;
  if (b.t > 0) return;
  b.t = 0.09 + r() * 0.08;
  b.placing = false;
  // 周りを見る
  let near = null, nd = 1e9, pickU = null, ps = -1;
  for (const o of w.units) {
    if (!o.alive || o === u) continue;
    const d = hyp(o.x - u.x, o.y - u.y);
    if (d > 1000) continue;
    if (d < nd) { nd = d; near = o; }
    const weak = 1 - o.hp / o.maxHp;
    // 入場したての小さな相手は後回し（撃ってきた相手は別）。拘束された相手は狙いどき
    const fresh = o.mass < 20 && w.t - o.bornT < 25 && u.lastHitBy !== o.id ? 0.3 : 1;
    const s = (1 + weak * 1.6 + (o.mass > u.mass ? 0.3 : 0) + (o.rootT > 0 ? 0.8 : 0) + (u.lastHitBy === o.id && w.t - u.lastHitT < 4 ? 0.7 : 0)) / (d + 120) * (o.spawnShield > 0 ? 0.1 : 1) * fresh;
    if (s > ps) { ps = s; pickU = o; }
  }
  const hpR = u.hp / u.maxHp;
  let mx = 0, my = 0, cast = false, slot = 0;
  // 巨体には近づかない（よほど好戦的で、相手が弱っていれば別）
  let giant = null;
  for (const o of w.units) if (o.alive && o !== u && o.mass > u.mass * 2.5 + 60 && hyp(o.x - u.x, o.y - u.y) < 480 + o.r && !(b.aggr > 0.7 && hpR > 0.7 && o.hp < o.maxHp * 0.5)) { giant = o; break; }
  if (giant) { near = giant; nd = hyp(giant.x - u.x, giant.y - u.y); }
  // 飛んでくる術式・光線の構え
  let threat = null;
  for (const s of w.spells) {
    if (s.owner === u.id || s.state !== 'fly' || s.done) continue;
    const dx = u.x - s.x, dy = u.y - s.y, d = hyp(dx, dy);
    if (d > 300 || d === 0) continue;
    const sp = hyp(s.vx, s.vy) || 1;
    if ((dx * s.vx + dy * s.vy) / (d * sp) > 0.86) { threat = s; break; }
  }
  const beamAim = !threat && w.units.some(o => o.alive && o !== u && o.casting && spellRole(o.spells[o.casting.slot]) === 'beam' && hyp(o.x - u.x, o.y - u.y) < 900 && Math.abs(angDiff(o.aim, Math.atan2(u.y - o.y, u.x - o.x))) < 0.12);
  // 自分の指示式の近くに敵が来たら起爆、魔力が尽きたら糸を回収
  for (const s of w.spells) if (s.owner === u.id && s.linked && s.r.trigger === 'command' && !s.done && foeNear(w, s, s.radius * 0.8)) { ix.detonate = true; break; }
  if (u.mp < 12 && linkedOf(w, u).length) ix.recall = true;
  // 完全結界を張った直後は、しばらく唱えずに守りを固める
  const holding = u.aegis && w.t - b.aegisAt < 2 + b.skill * 1.5;
  const use = (role, px, py, dist = 0) => {
    const i = slotFor(w, u, role, dist);
    if (i < 0) return false;
    slot = i; cast = true;
    if (px !== undefined) { ix.tx = px; ix.ty = py; b.placing = true; }
    if (role === 'aegis') b.aegisAt = w.t;
    return true;
  };
  if (near && ((nd < 620 && hpR < b.flee) || near === giant)) {
    b.mode = 'flee'; b.target = near.id;
    mx = u.x - near.x; my = u.y - near.y;
    // 逃げながら：切り札の完全結界・回復・加速・足止め・罠・囮・壁
    const acted = ((threat || beamAim) && hpR < 0.4 && use('aegis'))
      || (hpR < 0.5 && use('heal', u.x, u.y))
      || use('haste')
      || (nd < 460 && use('bind', near.x, near.y, nd))
      || (nd < 360 && use('trap', (u.x + near.x) / 2, (u.y + near.y) / 2))
      || use('decoy', u.x, u.y)
      || (nd < 300 && use('ward', (u.x + near.x) / 2, (u.y + near.y) / 2));
    if (!acted && nd < 700) { const i = slotFor(w, u, 'shot', nd); slot = i >= 0 ? i : 0; cast = u.mp > 30 && i >= 0; }
    if ((nd < 300 || threat) && r() < 0.3 + b.skill * 0.2) ix.dodge = true;
  } else if (pickU && hyp(pickU.x - u.x, pickU.y - u.y) < 460 + b.aggr * 320 && (b.aggr > 0.45 || pickU.hp < pickU.maxHp * 0.5 || hyp(pickU.x - u.x, pickU.y - u.y) < 340)) {
    b.mode = 'fight'; b.target = pickU.id;
    const dx = pickU.x - u.x, dy = pickU.y - u.y, d = hyp(dx, dy) || 1;
    // 魔力切れ：いちばん安い術も唱えられないなら、近くの光の粒を拾いに行く
    let cheapest = 1e9;
    for (const sp of u.spells) cheapest = Math.min(cheapest, recipeCost(sp, u));
    const dry = u.mp < cheapest + 6;
    let refuel = null, rs = 0;
    if (dry) for (const m of motesNear(w, u.x, u.y, 420)) { const md = hyp(m.x - u.x, m.y - u.y), sc = m.v / (md + 40); if (sc > rs) { rs = sc; refuel = m; } }
    // 流派の間合いを保ち、横へ回り込む。刃や城壁を回している間は、懐へ踏み込む
    const blades = w.spells.some(o => o.owner === u.id && o.kind === 'orbiter' && !o.done && o.orbMul >= 0.5);
    const keep = blades ? Math.min(b.keep, 70) : b.keep;
    const radial = clamp((d - keep) / 150, -1, 1);
    if (r() < 0.05) b.strafe *= -1;
    mx = dx / d * radial - dy / d * b.strafe * 0.85;
    my = dy / d * radial + dx / d * b.strafe * 0.85;
    if (refuel) { const fx = refuel.x - u.x, fy = refuel.y - u.y, fd = hyp(fx, fy) || 1; mx = fx / fd * 1.4 + mx * 0.4; my = fy / fd * 1.4 + my * 0.4; }
    const blocked = lineBlocked(w, u.x, u.y, pickU.x, pickU.y, u.id);
    const low = pickU.hp < pickU.maxHp * 0.3;
    const held = pickU.rootT > 0.25 || pickU.slowAmt > 0.3;
    const px = ix.tx, py = ix.ty;
    // 場面に合う術を選ぶ（上ほど優先）
    let chosen = false;
    const T = (cond, fn) => { if (!chosen && cond) chosen = !!fn(); };
    // 守り：弾や光線が来る。弱っていれば切り札の完全結界
    T((threat || beamAim) && w.t - b.lastGuard > 2 && r() < 0.35 + b.skill * 0.6, () => {
      const ok = (hpR < 0.45 && use('aegis')) || use('guard') || use('harden') || use('ward', u.x + dx / d * 90, u.y + dy / d * 90) || use('decoy', u.x, u.y);
      if (ok) b.lastGuard = w.t;
      return ok;
    });
    T(hpR < 0.45, () => use('heal', u.x, u.y) || use('drain', px, py, d));
    // 罠と指示起爆：迫ってくる相手の進む先へ置く（置いた指示式は近づいたら起爆し、近くの自分の罠を誘爆させる）
    const closing = (pickU.vx * -dx + pickU.vy * -dy) / d > 60;
    T(d < 600 && (closing ? r() < 0.7 : r() < 0.3), () => use('trap', u.x + dx * 0.6, u.y + dy * 0.6, d) || use('remote', px, py, d));
    // 連携：拘束・鈍化した相手には、重い一撃（光線・範囲・得意の弾）を叩き込む
    T(held, () => use('beam', undefined, undefined, d) || use('area', pickU.x, pickU.y, d) || use('remote', pickU.x, pickU.y, d) || use('shot', undefined, undefined, d));
    // 間合いの近い流派：刃を回してから、転位で一気に詰める
    T(b.keep < 200 && d < 420 && !blades && r() < 0.6, () => use('guard'));
    T(b.keep < 200 && blades && d > 220 && d < 620 && r() < 0.5, () => use('blink', undefined, undefined, d));
    // 近い：刃や城壁を回す・足止め・吸魔の場・範囲
    T(d < 280 && r() < 0.55, () => use('guard', undefined, undefined, d) || use('drain', px, py, d) || use('bind', px, py, d) || use('area', px, py, d));
    // 足止めを仕掛けてから大技へ
    T(d < 600 && r() < 0.3, () => use('bind', px, py, d));
    T(u.mp < maxMp(u) * 0.45 && r() < 0.4, () => use('drain', px, py, d));
    // 遮られている：放物線で越える・曲げる
    T(blocked, () => use('area', px, py, d) || use('homing', undefined, undefined, d) || use('trap', px, py, d));
    T(!blocked && d > 220 && r() < 0.35 + (low ? 0.3 : 0), () => use('beam', undefined, undefined, d));
    T(d > 260 && r() < 0.45, () => use('homing', undefined, undefined, d));
    T(r() < 0.3, () => use('area', px, py, d));
    T(low && d > 300 && d < 600 && r() < 0.3, () => use('blink', undefined, undefined, d));
    T(r() < 0.08, () => use('haste') || use('decoy', u.x, u.y) || use('well', u.x, u.y));
    T(!blocked, () => use('shot', undefined, undefined, d));
    // 何も合わなければ、届くどれかを使う
    if (!chosen && !blocked) chosen = ['homing', 'area', 'beam', 'drain', 'bind'].some(role => use(role, px, py, d));
    if (cast) cast = u.mp > recipeCost(u.spells[slot], u) + (low ? 0 : b.reserve * 0.35);
    // 大技のために魔力を溜める：素の弾ばかり撃たず、罠・指示式・光線・範囲・拘束を唱えられるだけ残す
    if (cast && !low && spellRole(u.spells[slot]) === 'shot') {
      let big = 0;
      for (const sp of u.spells) if (['trap', 'remote', 'beam', 'area', 'bind'].includes(spellRole(sp))) big = Math.max(big, recipeCost(sp, u));
      if (big && u.mp - recipeCost(u.spells[slot], u) < big + 4 && r() < 0.65) cast = false;
    }
    if (threat && r() < 0.15 + b.skill * 0.3) ix.dodge = true;
  } else {
    b.mode = 'gather';
    b.target = pickU && hyp(pickU.x - u.x, pickU.y - u.y) < 500 ? pickU.id : null;
    let goal = null, gs = 0;
    for (const m of motesNear(w, u.x, u.y, 520)) {
      const d = hyp(m.x - u.x, m.y - u.y);
      const s = m.v * (m.field ? 1 : 2.2) / (d + 60);
      if (s > gs) { gs = s; goal = m; }
    }
    if (!goal) {
      if (!b.wander || hyp(b.wander.x - u.x, b.wander.y - u.y) < 120 || r() < 0.01) {
        // 自分の術の原理の節点へ行くこともある（そこで戦うと術が強まる）
        const home = w.nodes.find(n => u.spells.some(sp => sp.a === n.k));
        if (home && r() < 0.35) { b.wander = { x: home.x + (r() - 0.5) * 120, y: home.y + (r() - 0.5) * 120 }; }
        else {
        const s = w.springs.length && r() < 0.5 ? pick(w, w.springs) : null;
        const a = r() * TAU, d = Math.sqrt(r()) * w.R * 0.8;
        b.wander = s ? { x: s.x, y: s.y } : { x: Math.cos(a) * d, y: Math.sin(a) * d };
        }
      }
      goal = b.wander;
    }
    mx = goal.x - u.x; my = goal.y - u.y;
    if (!tgt || !tgt.alive) ix.aim = Math.atan2(my, mx);
    if (tgt && tgt.alive && u.mp > 70) { const d = hyp(tgt.x - u.x, tgt.y - u.y), i = slotFor(w, u, 'shot', d); if (i >= 0) { slot = i; cast = true; } }
  }
  // 飛んでくる術式をよける
  if (threat && b.skill > 0.4 && r() < b.skill) {
    const sp = hyp(threat.vx, threat.vy) || 1, side = (threat.vx * (u.y - threat.y) - threat.vy * (u.x - threat.x)) > 0 ? 1 : -1;
    mx += -threat.vy / sp * side * 1.8; my += threat.vx / sp * side * 1.8;
  }
  // 光線の構えを向けられたら、横へずれる
  if (beamAim && r() < b.skill) { const a = Math.atan2(my, mx) + Math.PI / 2 * b.strafe; mx += Math.cos(a) * 2; my += Math.sin(a) * 2; }
  // 結界と岩を避ける
  const dc = hyp(u.x, u.y);
  if (dc > w.R - 260) { const k = (dc - (w.R - 260)) / 120; mx -= u.x / dc * k * 2; my -= u.y / dc * k * 2; }
  for (const k of w.rocks) {
    const dx = u.x - k.x, dy = u.y - k.y, d = hyp(dx, dy);
    if (d < k.r + u.r + 70) { mx += dx / d * 1.2; my += dy / d * 1.2; }
  }
  const L = hyp(mx, my) || 1;
  ix.mx = mx / L; ix.my = my / L;
  ix.cast = cast && !holding;
  ix.slot = slot;
}

// ═══ 16. 順位 ═══════════════════════════════════════════════════
function rank(w) {
  w.ranking = w.units.filter(u => u.alive).sort((a, b) => b.mass - a.mass);
  w.ranking.forEach((u, i) => { u.place = i + 1; if (u.place < u.bestPlace) u.bestPlace = u.place; });
  return w.ranking;
}
// 位階ポイント：最高到達の魔素・撃破数・最高順位から
function runPoints(peak, kills, bestPlace) {
  let p = Math.floor(peak * W.points.perPeak) + kills * W.points.perKill;
  for (const [place, bonus] of W.points.place) if (bestPlace <= place) { p += bonus; break; }
  return p;
}
function tierOf(points) {
  let i = 0;
  D.tiers.forEach((t, k) => { if (points >= t.min) i = k; });
  return i;
}

// ═══ 17. 公開 ═══════════════════════════════════════════════════
ROOT.PRIMA_SIM = {
  createWorld, step, spawnHero, hero, unitById, addBot, gain, xpFor, capacityOf, maxMp,
  normRecipe, pairKey, recipeResult, spellName, partCount, complexityMul, misfireChance, recipeCost, windupTime, spellInfo, spellRole, visualShapeOf,
  purityMul, falloffMul, hurtZone, hurtWard, wardPoint, wardDist, perfectOk, dispelPerfect, nodeBoost, interfere,
  beginCast, release, fire, activate, effectAt, detonate, recall, linkedOf, sever, homingTarget,
  damage, kill, rank, runPoints, tierOf, motesNear, mulberry, spellReach, slotFor
};
})();
