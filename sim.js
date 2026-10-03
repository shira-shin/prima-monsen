// PRIMA 紋戦 — 演算コア
// DOM・Canvas・音・実時間を持たない。step(world, dt) で進むだけ。
// ブラウザでは data.js の後に読み込み、window.PRIMA_SIM として公開する。
// 将来のオンライン対戦ではこのファイルをサーバー側でもそのまま動かす（docs/ONLINE_RELEASE.md）。
// 術は「器 × 原理 × 段の連鎖」（docs/SPELLCRAFT.md）。原理は器そのものと、器に触れたものへ同じ規則で効く。
//
// ─── 目次（═══ NN. で検索） ───
// 01. 乱数と小道具   02. 世界の生成（修練場の人形を含む）   03. 術者（体・能力値）   04. レベルと制御容量
// 05. 魔素（地面の粒）   06. 術式計算（正規化・容量・消費・詠唱・暴発・名前）
// 07. 詠唱と発動（段を開く・次の段へ移る）   08. 器：弾・線   09. 器：面・円・纏・環
// 10. 場・壁・纏の更新   11. 糸（維持費・切断・誘導・合図・回収）   12. 触れる（原理が相手に効く）と打撃
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
function createWorld(roomKey, seed = (Date.now() & 0xffffff), opts = {}) {
  const room = D.rooms[roomKey] || D.rooms.ichi;
  const w = {
    roomKey, room, R: room.R, t: 0, seed, rng: mulberry(seed), nextId: 1,
    units: [], motes: [], spells: [], zones: [], wards: [], decoys: [], strikes: [], strikeT: 0, boss: null, stage: opts.stage || 0,
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
  if (room.special) addBoss(w, w.stage);
  w.strikeT = nextStrike(w);
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
    id: w.nextId++, name: o.name, ink: o.ink, crest: o.crest, tier: o.tier || 0, skin: o.skin || 0, bot: !!o.bot,
    alive: true, x: 0, y: 0, vx: 0, vy: 0, aim: 0, r: W.body.baseR,
    mass: 0, peak: 0, xp: 0, level: 0,
    hp: W.body.baseHp, maxHp: W.body.baseHp, mp: W.mp.max,
    spells: [0, 1, 2, 3].map(i => normRecipe((o.spells || D.defaultSpells)[i] || D.defaultSpells[i])),
    sel: 0, casting: null, queue: null, slotCd: [0, 0, 0, 0],
    cries: o.cries || { win: '', death: '' },
    // 纏（body）の効き目は毎フレーム場から書き込まれる。hasteT などは描画用の印
    dodgeCd: 0, dashT: 0, phaseT: 0, hasteT: 0, hardenT: 0, vitalT: 0, impactT: 0,
    bodyT: 0, bodyZone: 0, bodyMotion: 0, bodyArmor: 0, bodyConvert: 0, bodyPhase: 0, cloakT: 0, cloak: 0, revealT: 0, ghostT: 0,
    // 結でつながれた先：tetherTo が術者なら術者の位置、0 なら (tetherX, tetherY)
    tetherT: 0, tetherX: 0, tetherY: 0, tetherTo: 0, tetherLength: 0, tetherForce: 0, tetherPull: 0, tetherBreak: 0, tetherOwner: 0,
    rootT: 0, slowT: 0, slowAmt: 0, markT: 0, markLv: 0,
    spawnShield: W.spawnShield, combatT: 99, lastHitBy: null, lastHitT: -99,
    kills: 0, bornT: w.t, boss: null, bleedT: 0, place: 0, bestPlace: 99, hurtT: 0, dummy: o.dummy || null, dealt: 0, taken: 0, blocked: 0,
    every: o.every || 0, fireT: 1, fireI: 0, node: -1, center: false,
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
    // 流派の弟子は、開祖の一言を叫ぶことが多い
    cries: school && school.cries && w.rng() < .7 ? { win: pick(w, school.cries.win), death: pick(w, school.cries.death) } : { win: pick(w, D.cries.win), death: pick(w, D.cries.death) }
  });
  w.units.push(u);
  if (mass > 0) gain(w, u, mass);
  if (u.tier >= 6) u.skin = 1;
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
  const u = makeUnit(w, { name: profile.name || '名無し', ink: profile.ink, crest: profile.crest, tier: profile.tier || 0, skin: profile.skin || 0, bot: false, spells: profile.spells, cries: profile.cries });
  w.units.push(u);
  w.heroId = u.id;
  return u;
}
function hero(w) { return w.units.find(u => u.id === w.heroId) || null; }
function unitById(w, id) { for (const u of w.units) if (u.id === id) return u; return null; }

// 魔素から体を決める
function refreshBody(u) {
  if (u.boss) { u.r = u.boss.r; u.maxHp = u.boss.hp; u.hp = Math.min(u.hp, u.maxHp); return; }
  const s = Math.sqrt(Math.max(0, u.mass));
  u.r = Math.min(W.body.maxR, W.body.baseR + s * W.body.rPerSqrt);
  const maxHp = W.body.baseHp + s * W.body.hpPerSqrt;
  if (maxHp > u.maxHp) u.hp += maxHp - u.maxHp;
  u.maxHp = maxHp;
  u.hp = Math.min(u.hp, u.maxHp);
}
const speedOf = u => u.boss ? u.boss.speed : Math.max(W.body.minSpeed, W.body.speed - Math.sqrt(Math.max(0, u.mass)) * W.body.speedPerSqrt);
const maxMp = u => W.mp.max + u.level * W.mp.perLevel;
// 立っている節点の原理が、この術のどれかの段に振られているか
function nodeBoost(w, u, r) {
  if (!u || u.node < 0 || !w.nodes[u.node]) return false;
  const k = w.nodes[u.node].k;
  return r.stages.some(s => s.p[k] > 0);
}
// 制御容量：レベルで育つ（原理の点・段のつなぎ・糸・追尾の合計まで暴発しない）
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

// ═══ 06. 術式計算（器 × 原理 × 段） ═════════════════════════════
// レシピ = { v: 3, stages: [{ vessel, path, matter, force, size, time, look, then, p: { motion, bind, divide, convert, grow, phase } }], link, customName }
// 原理は一つの動詞。器そのもの（self）と、器に触れたもの（touch）へ同じ規則で効く（data.js の principles）
const C = D.craft;
const PR = k => D.principles[k];
const VESSELS = C.vesselOrder, PATHS = C.pathOrder, FORCES = C.forceOrder;
const LOOKS = ['auto', ...D.shapeOrder];
const cleanName = v => String(v || '').trim().slice(0, 20);
// 点は0〜3の連続値。効き目と数は整数の点の間をなめらかにつなぐ
const lerpAt = (arr, g) => { const x = clamp(g, 0, arr.length - 1), i = Math.min(arr.length - 2, Math.floor(x)); return arr[i] + (arr[i + 1] - arr[i]) * (x - i); };
const echo = lv => lerpAt(C.echo, lv);
const copiesOf = g => Math.max(1, Math.round(lerpAt(C.copies, g)));
const orbitCopiesOf = g => Math.max(1, Math.round(lerpAt(C.orbitCopies, g)));
const numIn = (v, [lo, hi], def) => { const n = Number(v); return v === undefined || v === null || v === '' || !Number.isFinite(n) ? def : clamp(n, lo, hi); };
function normStage(s) {
  const o = s && typeof s === 'object' ? s : {};
  const vessel = VESSELS.includes(o.vessel) ? o.vessel : 'bolt';
  const p = {};
  for (const k of P) p[k] = clamp(Math.round((Number(o.p && o.p[k]) || 0) * 10) / 10, 0, C.maxLevel);
  let then = C.thensFor[vessel].includes(o.then) ? o.then : 'hit';
  // 結の無い円は壊れない（硬さを持たない）
  if (then === 'break' && vessel === 'field' && !p.bind) then = 'end';
  return {
    vessel,
    path: vessel === 'bolt' && PATHS.includes(o.path) ? o.path : 'straight',
    // 光線と自分の体はエネルギーのまま
    matter: vessel === 'ray' || vessel === 'body' ? 'energy' : o.matter === 'solid' ? 'solid' : 'energy',
    force: FORCES.includes(o.force) ? o.force : 'push',
    size: vessel === 'body' ? 1 : numIn(o.size, [C.size[0], C.sizeMax[vessel] || C.size[1]], 1),
    time: vessel === 'ray' ? 1 : numIn(o.time, C.time, 1),
    look: (vessel === 'bolt' || vessel === 'orbit') && LOOKS.includes(o.look) ? o.look : 'auto',
    then, p
  };
}
// 旧方式（27現象の weave: 1、配分の weave: 2）の保存を、近い一段の術へ置き換える
function fromLegacy(o) {
  const p = {};
  const add = (k, n) => { if (PR(k)) p[k] = Math.min(C.maxLevel, (p[k] || 0) + n); };
  const b = o.b && o.b !== 'none' ? o.b : null;
  add(o.a || 'motion', b === o.a ? 2 : 1);
  if (b && b !== o.a) add(b, 1);
  if (o.weave === 2 && !b) add(o.a, 1);
  for (const k of Array.isArray(o.extras) ? o.extras : []) add(k, 1);
  // はじめの制御容量に収める
  for (let guard = 0; guard < 12 && Object.values(p).reduce((a, n) => a + n, 0) > 4; guard++) {
    const top = Object.keys(p).sort((x, y) => p[y] - p[x])[0]; p[top]--;
  }
  let vessel = 'bolt';
  if (o.behavior === 'beam') vessel = 'ray';
  else if (o.weave === 2) vessel = o.target === 'self' ? 'body' : o.target === 'construct' ? (o.anchor === 'fixed' ? 'wall' : 'orbit') : o.target === 'field' ? 'field' : 'bolt';
  else if (o.behavior === 'orbit') vessel = o.matter === 'solid' ? 'orbit' : b ? 'field' : 'body';
  else if (['plane', 'line'].includes(o.form) && (o.a === 'bind' || b === 'bind')) vessel = 'wall';
  else if (['ring', 'field'].includes(o.form) && ['lob', 'drop', 'sow'].includes(o.behavior)) vessel = 'field';
  const path = vessel !== 'bolt' ? 'straight' : o.behavior === 'homing' ? 'seek' : o.behavior === 'lob' ? 'arc' : 'straight';
  return { v: 3, customName: o.customName || o.name, link: o.link === 'hold' && vessel !== 'ray',
    stages: [{ vessel, path, matter: o.matter === 'solid' ? 'solid' : 'energy', look: o.visualShape, p }] };
}
function normRecipe(r) {
  let o = r && typeof r === 'object' ? r : {};
  if (o.v !== 3) o = fromLegacy(o);
  const src = Array.isArray(o.stages) && o.stages.length ? o.stages.slice(0, C.maxStages) : [{}];
  const stages = src.map(normStage);
  // 合図で移る段があれば、糸が要る（④ 糸）
  const link = !!o.link || stages.slice(0, -1).some(s => s.then === 'signal');
  return { v: 3, stages, link, customName: cleanName(o.customName || o.name) };
}
// 制御容量に数える量：原理の点の合計 ＋ 段のつなぎ ＋ 糸 ＋ 追尾の軌道
function partCount(r) {
  let n = r.stages.length - 1 + (r.link ? 1 : 0);
  for (const s of r.stages) { for (const k of P) n += s.p[k]; n += C.paths[s.path].parts; }
  return Math.round(n * 10) / 10;
}
// 暴発率：制御容量を超えた点1つごとに上がる
function misfireChance(r, u) {
  const over = partCount(r) - capacityOf(u);
  return over > 0 ? Math.min(R.misfire.max, over * R.misfire.perOverPart) : 0;
}
// 点の多い順（同じなら原理の順）
const topKeys = p => P.filter(k => p[k] > 0).sort((x, y) => p[y] - p[x] || P.indexOf(x) - P.indexOf(y));
function mixHex(a, b) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  return '#' + [((pa >> 16) + (pb >> 16)) >> 1, (((pa >> 8) & 255) + ((pb >> 8) & 255)) >> 1, ((pa & 255) + (pb & 255)) >> 1].map(v => v.toString(16).padStart(2, '0')).join('');
}
const inkHex = k => (D.inks[PR(k).ink] || D.inks.yellow).hex;
function colorOf(st) {
  const ks = topKeys(st.p);
  return !ks.length ? '#d9cfbd' : ks.length === 1 ? inkHex(ks[0]) : mixHex(inkHex(ks[0]), inkHex(ks[1]));
}
// 見た目の形：選んでいなければ器と原理から決める（性能は変わらない）
function shapeFor(st) {
  if (st.look !== 'auto') return st.look;
  if (st.vessel === 'orbit') return 'blade';
  if (st.vessel !== 'bolt') return 'orb';
  if (st.matter === 'solid') return st.p.divide >= 2 ? 'spear' : 'shard';
  return st.p.motion >= 2 ? 'arrow' : st.p.grow ? 'shard' : 'needle';
}
// 描画と音のための見かけ（主な原理 a・次の原理 b・広がり・届き方・発動の印）
const FORM_OF = { bolt: 'point', ray: 'line', wall: 'plane', field: 'ring', body: 'point', orbit: 'ring' };
const BEH_OF = { straight: 'project', arc: 'lob', seek: 'homing', return: 'project' };
function lookOf(rec, si) {
  const st = rec.stages[si], ks = topKeys(st.p), next = si + 1 < rec.stages.length;
  return {
    v: 3, a: ks[0] || 'motion', b: ks[1] || 'none', form: FORM_OF[st.vessel],
    behavior: st.vessel === 'bolt' ? BEH_OF[st.path] : st.vessel === 'ray' ? 'beam' : st.vessel === 'body' || st.vessel === 'orbit' ? 'orbit' : 'drop',
    trigger: next && st.then === 'signal' ? 'command' : next && st.then === 'end' ? 'fuse' : 'contact',
    deploy: 'single', matter: st.matter, visualShape: shapeFor(st), duration: st.time, power: 1, link: rec.link ? 'hold' : 'cut'
  };
}
const visualShapeOf = (r, si = 0) => shapeFor(r.stages[si]);
// 名前：段ごとに「原理の字＋器の字」。点の多い原理から並べる（例：分動弾・分円）
const resultCache = new WeakMap();
function recipeResult(r) {
  if (resultCache.has(r)) return resultCache.get(r);
  const N = C.naming;
  const names = r.stages.map(s => { const ks = topKeys(s.p); return (ks.length ? ks.map(k => PR(k).short || PR(k).kanji).join(N.join) : N.empty) + N.join + C.vessels[s.vessel].name; });
  const s0 = r.stages[0];
  const res = { name: names.join(N.stageSep), base: names[0], type: s0.vessel, desc: C.vessels[s0.vessel].note, color: colorOf(s0),
    tags: [...new Set(r.stages.flatMap(s => topKeys(s.p).map(k => PR(k).name)))] };
  resultCache.set(r, res);
  return res;
}
const spellName = r => r.customName || recipeResult(r).name;
// 魔力の消費：器の負荷 ＋ 原理の負荷 × 点^1.35、大きさ・持続・質で変わる。2段目からは少し軽い
const bigPower = s => 1 + .6 * Math.pow(Math.max(0, s - 1.6), 1.5);   // 巨大な武器は一撃も重い（3倍で約2倍）。代わりに弾は遅くなる
const bigCost = s => Math.pow(Math.max(0, s - 1.6), 1.5);   // 1.6倍を超える巨大な武器の割増（3倍で約1.66）
const SIZE_COST = { bolt: s => .75 + .25 * s + .5 * bigCost(s), ray: s => .6 + .4 * s, wall: s => .5 + .5 * s, field: s => .35 + .65 * s * s, orbit: s => .6 + .4 * s + .5 * bigCost(s), body: () => 1 };
const TIME_COST = { bolt: t => .85 + .15 * t, ray: () => 1, wall: t => .7 + .3 * t, field: t => .6 + .4 * t, orbit: t => .6 + .4 * t, body: t => .55 + .45 * t };
function stageCost(s, i) {
  let c = C.vessels[s.vessel].cost + C.paths[s.path].cost;
  for (const k of P) if (s.p[k]) c += PR(k).cost * Math.pow(s.p[k], 1.35);
  c *= SIZE_COST[s.vessel](s.size) * TIME_COST[s.vessel](s.time) * (s.matter === 'solid' ? C.solidCost : 1);
  return c * (i > 0 ? C.later : 1);
}
function baseCost(r) { return r.stages.reduce((n, s, i) => n + stageCost(s, i), 0) + (r.link ? C.linkCost : 0); }
function recipeCost(r) { return Math.max(1, Math.round(baseCost(r) * C.costScale)); }
function windupTime(r) {
  const Wd = C.wind;
  return clamp(Wd.base + baseCost(r) * Wd.perCost, Wd.min, Wd.max) + Wd.perStage * (r.stages.length - 1);
}
// 命中1回の打撃（器の倍率を掛ける前）：素の魔力（違う紋が触れて構造を乱す）＋分は壊し、動は運動量で打つ。
// 壁は素の魔力では打たない（原理の無い壁に触れても痛くない）
const touchPower = st => (st.vessel === 'wall' ? 0 : C.dmg.base) + C.dmg.divide * echo(st.p.divide) + C.dmg.motion * echo(st.p.motion);
// 魔素の多い体ほど少し重い
const unitDmg = u => 1 + Math.sqrt(Math.max(0, u ? u.mass : 0)) * C.dmg.perSqrt;
// 遠くでの衰え：弾は散りやすく（固体は衰えにくい）、光線はほとんど衰えない（③ 散逸）
function falloffMul(st, dist) {
  const k = st.vessel === 'ray' ? C.ray.fall : st.vessel === 'bolt' ? C.bolt.fall * (st.matter === 'solid' ? .6 : 1.2) : 0;
  return Math.max(R.falloff.min, 1 - k * dist / R.falloff.per);
}
const VESSEL_MUL = { bolt: 1, ray: C.ray.mul, wall: C.wall.touch, field: C.field.burst, body: C.body.bump, orbit: C.orbit.touch };
// 画面に出す術の要約
function spellInfo(u, r) {
  const res = recipeResult(r), s0 = r.stages[0];
  return {
    name: spellName(r), result: res, parts: partCount(r), cap: capacityOf(u), cost: recipeCost(r), windup: windupTime(r), misfire: misfireChance(r, u), color: res.color, type: res.type,
    // 威力の目安：1段目の一撃（弾・線は増の複製の合計）。遠く（800先）で残る割合
    power: touchPower(s0) * VESSEL_MUL[s0.vessel] * (['bolt', 'ray'].includes(s0.vessel) ? Math.sqrt(copiesOf(s0.p.grow)) : 1),
    reach: falloffMul(s0, 800)
  };
}
// 当たらない体：回避で跳んでいる間と、纏の相が十分に高く透けている間
const intang = u => u.dashT > 0 || u.ghostT > 0;
// 隠密は無敵ではない。近距離・詠唱・被弾・観測（印）で姿が分かる
function visibleTo(observer, u) {
  if (!u) return false;
  if (!observer || observer.id === u.id || u.revealT > 0 || u.markT > 0 || u.casting) return true;
  const strength = u.cloakT > 0 ? u.cloak : 0;
  return strength <= 0 || hyp(observer.x - u.x, observer.y - u.y) < 90 + (1 - strength) * 500;
}
// 相のある術（弾・壁・場）は、持ち主以外には近づくまで見えない
function visibleSpell(observer, o) {
  if (!o || !o.veil || !observer || observer.id === o.owner) return true;
  return hyp(observer.x - o.x, observer.y - o.y) < Math.max(C.veil.min, C.veil.range - C.veil.perLevel * o.veil);
}

// ═══ 07. 詠唱と発動 ═════════════════════════════════════════════
// 詠唱を始める（魔力は先払い）。詠唱が終わると放たれる
function beginCast(w, u, slot) {
  if (u.casting || u.dashT > 0) return false;
  const r = u.spells[slot];
  if (!r || u.slotCd[slot] > 0) return false;
  const cost = Math.max(1, Math.round(recipeCost(r) * (nodeBoost(w, u, r) ? W.node.cost : 1)));
  if (u.mp < cost) return false;
  u.mp -= cost;
  u.revealT = Math.max(u.revealT, 1.4);
  u.spawnShield = 0;
  const total = windupTime(r), look = lookOf(r, 0);
  u.casting = { slot, t: 0, total, cost };
  w.events.push({ type: 'chant', id: u.id, slot, name: spellName(r), named: !!r.customName, a: look.a, b: look.b, beh: look.behavior, form: look.form, deploy: 'single', parts: partCount(r), stages: r.stages.length, t: total, col: recipeResult(r).color });
  return true;
}
function release(w, u) {
  const c = u.casting;
  u.casting = null;
  const r = u.spells[c.slot];
  u.slotCd[c.slot] = W.cast.recast;
  // 演算体は術者の戦い方を見て学ぶ
  if (w.boss && u.id === w.heroId) { const v = r.stages[0].vessel, sn = w.boss.boss.seen; sn[v] = (sn[v] || 0) + 1; }
  // 制御容量を超えた術式は、放つ瞬間に崩れて自分を傷つけることがある（② 構造体）
  if (w.rng() < misfireChance(r, u)) {
    w.events.push({ type: 'misfire', id: u.id, x: u.x, y: u.y, ink: u.ink, name: spellName(r) });
    damage(w, u, baseCost(r) * R.misfire.selfDamage, null);
    return;
  }
  fire(w, u, r, c.cost);
}
// 放つ：1段目を術者から開く。後の段は、前の段が条件を満たした場所から開く
function fire(w, u, r, cost) {
  u.revealT = Math.max(u.revealT, 1.4);
  const res = recipeResult(r), look = lookOf(r, 0), s0 = r.stages[0];
  const k = { owner: u.id, rec: r, cast: w.nextId++, linked: r.link, cost, boost: nodeBoost(w, u, r) ? W.node.power : 1, unit: unitDmg(u) };
  w.events.push({ type: 'cast', id: u.id, name: spellName(r), named: !!r.customName, a: look.a, b: look.b, power: 1, shape: look.visualShape, beh: look.behavior, form: look.form,
    x: u.x, y: u.y, ink: u.ink, col: res.color, aim: u.aim, rtype: s0.vessel, matter: s0.matter, node: k.boost > 1, stages: r.stages.length });
  spawnStage(w, k, 0, { x: u.x, y: u.y, dir: u.aim, tx: u.input.tx, ty: u.input.ty }, 1);
}
// 段を開く。k は詠唱ごとの共通（持ち主・レシピ・糸・消費・魔素の重さ）、at は開く場所と向き
function spawnStage(w, k, si, at, mul) {
  const owner = unitById(w, k.owner);
  if (!owner || !owner.alive) return;
  const st = k.rec.stages[si];
  // 2段目からは、糸があれば今の照準へ、無ければ前の段の向きへ開く
  if (si > 0) {
    const aim = k.linked ? { x: owner.input.tx, y: owner.input.ty } : { x: at.x + Math.cos(at.dir) * 320, y: at.y + Math.sin(at.dir) * 320 };
    if (hyp(aim.x - at.x, aim.y - at.y) > 1) at.dir = Math.atan2(aim.y - at.y, aim.x - at.x);
    at.tx = aim.x; at.ty = aim.y;
  }
  const base = {
    owner: k.owner, rec: k.rec, si, st, look: lookOf(k.rec, si), col: colorOf(st), mul, unit: k.unit, boost: k.boost,
    dmg: k.unit * k.boost * mul, cost: k.cost / k.rec.stages.length, hold: k.linked, linked: k.linked, matter: st.matter, cast: k.cast,
    veil: st.p.phase, bindLv: st.p.bind, advanced: false, grp: null, k
  };
  switch (st.vessel) {
    case 'bolt': spawnBolts(w, owner, base, at); break;
    case 'ray': fireRays(w, owner, base, at); break;
    case 'wall': spawnWall(w, owner, base, at); break;
    case 'field': spawnField(w, owner, base, at); break;
    case 'body': spawnBody(w, owner, base); break;
    case 'orbit': spawnOrbit(w, owner, base); break;
  }
}
// 次の段へ移る。移った段は役目を終えて消える。一つの器（環の刃の群れなど）からは一度だけ
function advance(w, o, x, y, dir, cond) {
  if (o.si + 1 >= o.rec.stages.length || o.st.then !== cond) return false;
  const g = o.grp || o;
  if (g.advanced) return false;
  g.advanced = true;
  const next = o.rec.stages[o.si + 1];
  w.events.push({ type: 'activate', x, y, r: next.vessel === 'field' ? C.field.radius * next.size : 40, col: colorOf(next), rtype: next.vessel, a: lookOf(o.rec, o.si + 1).a,
    b: lookOf(o.rec, o.si + 1).b, deploy: 'single', form: FORM_OF[next.vessel], owner: o.owner, matter: next.matter, cond });
  spawnStage(w, o.k, o.si + 1, { x, y, dir }, o.mul);
  consume(w, o);
  return true;
}
// 器を消す（刃の群れは群れごと）
function consume(w, o) {
  if (o.grp) { for (const s of w.spells) if (s.grp === o.grp) s.done = true; return; }
  if (o.low !== undefined) { o.hp = 0; o.broken = true; }
  else if (o.zr !== undefined) o.dead = true;
  else o.done = true;
}
const hasNext = o => o.si + 1 < o.rec.stages.length;

// ═══ 08. 器：弾・線 ═════════════════════════════════════════════
// 弾はすべて同じ項目で作る（あとから項目を足すと遅くなる）
function spawnBolts(w, owner, base, at) {
  const st = base.st, n = copiesOf(st.p.grow), m = bigPower(st.size) / Math.sqrt(n);
  const speed = C.bolt.speed * (1 + C.bolt.motionSpeed * echo(st.p.motion)) * (st.matter === 'solid' ? .85 : 1.08) / (1 + .2 * Math.max(0, st.size - 1.6));
  const range = C.vessels.bolt.range * st.time;
  const first = base.si === 0;
  const ox = first ? owner.x : at.x, oy = first ? owner.y : at.y;
  const aimD = hyp(at.tx - ox, at.ty - oy);
  // 照準の地点で次の段を開く弾（触れたら・合図で）は、そこで止まる
  const stops = hasNext(base) && (st.then === 'hit' || st.then === 'signal');
  const size = (C.bolt.size + Math.min(4.5, Math.sqrt(Math.max(0, owner.mass)) * 0.07)) * st.size;
  for (let i = 0; i < n; i++) {
    const a = at.dir + (i - (n - 1) / 2) * C.spread;
    // r は描画用の見かけ（届き方・発動の印・持続）。radius は着地点の予告の大きさ
    const common = { ...base, r: base.look, radius: 34 * st.size, mul: base.mul * m, dmg: base.dmg * m, id: w.nextId++, hit: [], passed: [], shape: shapeFor(st), size };
    if (st.path === 'arc') {
      const d = clamp(aimD, 60, 600 * st.time), tx = ox + Math.cos(a) * d, ty = oy + Math.sin(a) * d;
      w.spells.push({ ...common, kind: 'lob', state: 'fly', sx: ox, sy: oy, x: ox, y: oy, tx, ty, t: 0, dur: Math.max(.25, d / (speed * .8)), age: 0, wait: 0, fuseT: 0, severT: R.link.severedLife,
        vx: tx - ox, vy: ty - oy, speed, range: d, traveled: 0, homing: false, tgt: null, retarget: 0, pierce: 0, stopAt: Infinity, returns: false, back: false, life: 0, ang: 0, orad: 0, hp: 0, hitT: 0, spin: 0 });
      continue;
    }
    const sx = first ? ox + Math.cos(a) * (owner.r + 4) : ox, sy = first ? oy + Math.sin(a) * (owner.r + 4) : oy;
    w.spells.push({ ...common, kind: 'proj', state: 'fly', sx, sy, x: sx, y: sy, tx: at.tx, ty: at.ty, t: 0, dur: 0, age: 0, wait: 0, fuseT: 0, severT: R.link.severedLife,
      vx: Math.cos(a) * speed + (first ? owner.vx * .25 : 0), vy: Math.sin(a) * speed + (first ? owner.vy * .25 : 0), speed, range, traveled: 0,
      homing: st.path === 'seek', tgt: null, retarget: 0, pierce: Math.round(st.p.divide), stopAt: stops ? Math.min(range, Math.max(40, aimD)) : Infinity,
      returns: st.path === 'return', back: false, life: 0, ang: 0, orad: 0, hp: 0, hitT: 0, spin: 0 });
  }
}
// 点と線分の距離
function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy;
  const t = L2 > 0 ? clamp(((px - ax) * dx + (py - ay) * dy) / L2, 0, 1) : 0;
  return hyp(ax + dx * t - px, ay + dy * t - py);
}
// 自律追尾：自分と違う紋の、大きく近い魔力へ曲がる。印の付いた相手を好む。囮に引かれる（① 紋）
function homingTarget(w, s) {
  let best = null, bs = 0;
  const heading = Math.atan2(s.vy, s.vx);
  const consider = (x, y, weight, obj) => {
    const dx = x - s.x, dy = y - s.y, d = hyp(dx, dy);
    if (d > 760 || Math.abs(angDiff(heading, Math.atan2(dy, dx))) > 1.3) return;
    const sc = weight / (d + 180);
    if (sc > bs) { bs = sc; best = obj; }
  };
  for (const u of w.units) if (u.alive && u.id !== s.owner && visibleTo(s, u)) consider(u.x, u.y, (Math.sqrt(u.mass + 30) + 4) * (u.markT > 0 ? 1.8 : 1), { unit: u.id });
  for (const d of w.decoys) if (d.owner !== s.owner) consider(d.x, d.y, Math.sqrt(R.decoy.weight) + 6, { decoy: d.id });
  return best;
}
// 結のある結界（円）。相の点が結の点より多い術は抜ける
function barrierAt(w, x, y, owner, skip) {
  for (const z of w.zones) if (z.barrier && !z.dead && z.owner !== owner && hyp(z.x - x, z.y - y) < z.zr && !(skip && skip.includes(z.id))) return z;
  return null;
}
// 共鳴：自分の紋のエネルギーの場を通った弾は強まる。場ごとに一度
function resonate(w, s) {
  for (const z of w.zones) {
    if (z.owner !== s.owner || z.dead || z.kind !== 'field' || z.barrier || s.passed.includes(z.id) || hyp(z.x - s.x, z.y - s.y) > z.zr) continue;
    s.passed.push(z.id);
    // 換の場は吸う側。共鳴はエネルギーの場だけ
    if (z.matter === 'solid') continue;
    s.dmg *= C.resonance;
    w.events.push({ type: 'resonate', x: s.x, y: s.y, col: z.col, col2: s.col, owner: s.owner });
  }
  // 違う紋の換の場を通ると、弾の魔力が吸われる
  for (const z of w.zones) {
    if (z.owner === s.owner || z.dead || z.kind !== 'field' || !z.st.p.convert || s.passed.includes(z.id) || hyp(z.x - s.x, z.y - s.y) > z.zr) continue;
    s.passed.push(z.id);
    const cut = Math.min(.6, .15 * echo(z.st.p.convert)), zo = unitById(w, z.owner);
    if (zo) zo.mp = Math.min(maxMp(zo), zo.mp + s.dmg * touchPower(s.st) * cut * .5);
    s.dmg *= 1 - cut;
    w.events.push({ type: 'absorb', x: s.x, y: s.y, col: z.col, kind: 'drain' });
  }
}
// 干渉：飛んでいる弾どうしが接触したときの反応（① 紋）
//  違う紋：固体どうしは衝突、エネルギーどうしは相殺（結は競り合いに強い）。質が違えば貫き合って弱まる。
//          換のある弾は、競り勝った相手の弾を吸って魔力に変える。壊れた弾は「壊れたら」の段を開く
//  同じ紋：エネルギーどうしは融合、エネルギーが固体に触れると魔装。固体どうしはすり抜ける
//  同じ詠唱から出た弾（増の複製）どうしは干渉しない
const clashPower = s => s.dmg * touchPower(s.st) * (1 + .6 * echo(s.st.p.bind));
function breakBolt(w, s) {
  s.done = true;
  advance(w, s, s.x, s.y, Math.atan2(s.vy, s.vx), 'break');
}
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
      if (same && (a.matter === 'solid' && b.matter === 'solid' || hasNext(a) || hasNext(b))) continue;
      // 相の点が相手の結より多い弾は、ぶつからずにすり抜ける
      if (!same && (a.veil > b.bindLv || b.veil > a.bindLv)) continue;
      // この1フレームで最も近づいた距離（向かい合って速く飛ぶ弾もすり抜けない）
      const rx = a.x - b.x, ry = a.y - b.y, vx = a.vx - b.vx, vy = a.vy - b.vy, v2 = vx * vx + vy * vy;
      const t = v2 > 0 ? clamp(-(rx * vx + ry * vy) / v2, -dt, 0) : 0;
      if (hyp(rx + vx * t, ry + vy * t) > a.size + b.size) continue;
      const x = (a.x + b.x) / 2, y = (a.y + b.y) / 2;
      if (same) {
        if (a.matter === b.matter) {
          const [big, small] = a.dmg >= b.dmg ? [a, b] : [b, a];
          big.dmg += small.dmg * I.fusion; big.size = Math.min(big.size * 1.3, 26); small.done = true;
          w.events.push({ type: 'fuse', x, y, col: big.col, col2: small.col, owner: a.owner });
        } else {
          const [sol, en] = a.matter === 'solid' ? [a, b] : [b, a];
          sol.dmg += en.dmg * I.enchant; sol.col = en.col; en.done = true;
          w.events.push({ type: 'enchant', x, y, col: en.col, col2: sol.col, owner: a.owner });
        }
        continue;
      }
      if (a.matter !== b.matter) {
        const [sol, en] = a.matter === 'solid' ? [a, b] : [b, a];
        const heat = en.dmg * I.melt;
        en.dmg *= I.pierceKeep; sol.dmg = Math.max(0, sol.dmg - heat);
        a.passed.push(b.id); b.passed.push(a.id);
        if (sol.dmg < .05) breakBolt(w, sol);
        w.events.push({ type: 'pierce', x, y, col: en.col, col2: sol.col, bolt: true });
        continue;
      }
      const pa = clashPower(a), pb = clashPower(b);
      const [strong, weak, ps, pw] = pa >= pb ? [a, b, pa, pb] : [b, a, pb, pa];
      breakBolt(w, weak);
      // 換のある弾は相手の弾を吸う（削られずに魔力へ）
      if (strong.st.p.convert) {
        const so = unitById(w, strong.owner);
        if (so) so.mp = Math.min(maxMp(so), so.mp + pw * C.absorb * echo(strong.st.p.convert) * .3);
        w.events.push({ type: 'absorb', x, y, col: strong.col, kind: 'drain' });
        continue;
      }
      if (ps - pw < ps * 0.15) breakBolt(w, strong);   // ほぼ互角なら両方とも消える
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
    if (f >= 1) boltLand(w, s, true);
    return;
  }
  if (s.state === 'fly') {
    // 追尾：糸があれば照準へ誘導、無ければ自律で狙う（④ 糸）
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
    // 回帰：射程の半分で折り返し、術者の手元へ戻る（帰りにも当たる）
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
    // 細い壁や速い弾を飛び越さないよう、移動中も接触を調べる
    const steps = Math.max(1, Math.ceil(hyp(s.vx, s.vy) * dt / Math.max(8, s.size)));
    for (let i = 0; i < steps && !s.done && s.state === 'fly'; i++) {
      s.x += s.vx * dt / steps; s.y += s.vy * dt / steps; s.traveled += hyp(s.vx, s.vy) * dt / steps;
      resonate(w, s);
      flyCollide(w, s);
      if (!s.done && s.traveled >= s.stopAt) { boltLand(w, s, false); break; }
    }
    if (s.done || s.state !== 'fly') return;
    if (s.traveled >= s.range * (s.returns ? 1.9 : 1)) {
      s.done = true;
      if (!advance(w, s, s.x, s.y, Math.atan2(s.vy, s.vx), 'end')) w.events.push({ type: 'fizzle', x: s.x, y: s.y, col: s.col });
    }
    return;
  }
  // 合図を待つ弾（罠）：殻は散逸していく。糸でつながっていれば減りが遅い（③ 散逸）
  s.wait += dt * (s.linked ? R.link.decayMul : 1);
  if (!s.linked) s.severT -= dt;
  if (s.wait > R.wait * s.st.time || s.severT <= 0) { s.done = true; w.events.push({ type: 'fizzle', x: s.x, y: s.y, col: s.col }); }
}
// 着いた：放物は落ちた場所の周りに触れる。合図を待つ弾はその場で待つ。ほかは次の段を開く
function boltLand(w, s, fromArc) {
  const dir = Math.atan2(s.ty - s.sy, s.tx - s.sx) || Math.atan2(s.vy, s.vx);
  if (hasNext(s) && s.st.then === 'signal') { s.state = 'wait'; if (s.kind === 'lob') s.kind = 'trap'; return; }
  const owner = unitById(w, s.owner);
  if (fromArc && owner) {
    const rad = 34 * s.st.size;
    for (const u of w.units) if (u.alive && u.id !== s.owner && !intang(u) && hyp(u.x - s.x, u.y - s.y) < rad + u.r) touch(w, s, owner, u, 1, u.x - s.x, u.y - s.y, owner.x, owner.y);
    w.events.push({ type: 'splat', x: s.x, y: s.y, col: s.col });
  }
  s.done = true;
  if (!advance(w, s, s.x, s.y, dir, 'hit') && !fromArc) w.events.push({ type: 'fizzle', x: s.x, y: s.y, col: s.col });
}
function foeNear(w, s, rad) {
  for (const u of w.units) if (u.alive && u.id !== s.owner && !intang(u) && hyp(u.x - s.x, u.y - s.y) < rad + u.r) return u;
  return null;
}
// 構造（壁・結界・刃）へ与える力：分で鋭く、質の相性で変わる。光線はエネルギーの構造を砕く
function structHit(s, targetMatter, ray = false) {
  const vs = ray ? (targetMatter === 'energy' ? C.clash.rayOnEnergy : C.clash.rayOnSolid) * C.ray.structMul
    : s.matter === 'solid' && targetMatter === 'energy' ? C.clash.solidOnEnergy : s.matter === 'energy' && targetMatter === 'solid' ? C.clash.energyOnSolid : 1;
  return s.dmg * touchPower(s.st) * (1 + C.structPer * echo(s.st.p.divide)) * vs;
}
// 構造の換：受け止めた一撃を持ち主の魔力へ
function absorbInto(w, o, amount) {
  if (!o.st || !o.st.p.convert) return;
  const u = unitById(w, o.owner);
  if (u) u.mp = Math.min(maxMp(u), u.mp + amount * C.absorb * echo(o.st.p.convert));
}
function flyCollide(w, s) {
  for (const k of w.rocks) if (hyp(k.x - s.x, k.y - s.y) < k.r * 0.92 + s.size) { stopBolt(w, s); return; }
  for (const g of w.wards) {
    if (g.hp <= 0 || s.passed.includes(g.id)) continue;
    const cp = wardPoint(g, s.x, s.y);
    if (hyp(cp.x - s.x, cp.y - s.y) > g.r + s.size) continue;
    // 相の点が壁の結より多ければ、すり抜ける
    if (s.veil > g.bindLv) { s.passed.push(g.id); w.events.push({ type: 'phased', x: s.x, y: s.y, col: s.col }); continue; }
    const hit = structHit(s, g.matter);
    hurtWard(w, g, hit);
    absorbInto(w, g, hit);
    // 設置壁は岩と同じ遮蔽物。壊した一撃もここで受け止める
    const go = unitById(w, g.owner);
    if (go && g.owner !== s.owner) go.blocked++;
    stopBolt(w, s);
    return;
  }
  const z = barrierAt(w, s.x, s.y, s.owner, s.passed);
  if (z) {
    if (s.veil > z.bindLv) { s.passed.push(z.id); return; }
    const hit = structHit(s, z.matter);
    hurtZone(w, z, hit);
    absorbInto(w, z, hit);
    const zo = unitById(w, z.owner);
    // 結界を砕ききった弾は、弱まって抜ける
    if (z.dead) { s.passed.push(z.id); s.dmg *= .7; return; }
    if (zo) zo.blocked++;
    s.done = true;
    w.events.push({ type: 'absorb', x: s.x, y: s.y, col: z.col, kind: 'bulwark' });
    advance(w, s, s.x - s.vx * .02, s.y - s.vy * .02, Math.atan2(s.vy, s.vx), 'hit');
    return;
  }
  const owner = unitById(w, s.owner);
  if (w.decoys.length) for (const d of [...w.decoys]) {
    if (d.owner === s.owner || s.hit.includes(-d.id) || hyp(d.x - s.x, d.y - s.y) > d.r + s.size) continue;
    popDecoy(w, d);
    if (s.pierce > 0) { s.pierce--; s.hit.push(-d.id); continue; }
    s.done = true;
    advance(w, s, s.x, s.y, Math.atan2(s.vy, s.vx), 'hit');
    return;
  }
  for (const u of w.units) {
    if (!u.alive || u.id === s.owner || s.hit.includes(u.id) || intang(u)) continue;
    if (hyp(u.x - s.x, u.y - s.y) > u.r + s.size) continue;
    if (owner) touch(w, s, owner, u, 1, s.vx, s.vy, owner.x, owner.y);
    // 分の点の数だけ体を貫く
    if (s.pierce > 0) { s.pierce--; s.hit.push(u.id); continue; }
    s.done = true;
    advance(w, s, s.x, s.y, Math.atan2(s.vy, s.vx), 'hit');
    return;
  }
}
// 岩・壁に止められた弾：手前で次の段を開く
function stopBolt(w, s) {
  s.done = true;
  const x = s.x - s.vx * .02, y = s.y - s.vy * .02;
  if (!advance(w, s, x, y, Math.atan2(s.vy, s.vx), 'hit')) w.events.push({ type: 'splat', x: s.x, y: s.y, col: s.col });
}
// 線：岩と設置壁で止まり、途中の相手を貫く。相の点が結より多ければ構造を越える
function fireRays(w, owner, base, at) {
  const st = base.st, n = copiesOf(st.p.grow), m = 1 / Math.sqrt(n), lead = (n - 1) >> 1;
  const first = base.si === 0;
  const ox = first ? owner.x : at.x, oy = first ? owner.y : at.y;
  for (let i = 0; i < n; i++) fireRay(w, owner, { ...base, mul: base.mul * m, dmg: base.dmg * m }, ox, oy, at.dir + (i - (n - 1) / 2) * C.spread * .7, first, i === lead, at);
}
function fireRay(w, u, s, ox, oy, a, first, lead, at) {
  const st = s.st, x0 = ox + (first ? Math.cos(a) * u.r : 0), y0 = oy + (first ? Math.sin(a) * u.r : 0);
  const dx = Math.cos(a), dy = Math.sin(a);
  const range = C.vessels.ray.range * (1 + C.ray.motionRange * echo(st.p.motion)), width = C.ray.width * st.size;
  // 線と円が最初に交わる距離（交わらなければ null。始点が円の中なら 0）
  const entry = (cx, cy, r) => {
    const fx = cx - x0, fy = cy - y0, t = fx * dx + fy * dy;
    const off = hyp(fx - dx * t, fy - dy * t);
    if (off >= r) return null;
    if (t + Math.sqrt(r * r - off * off) < 0) return null;
    return Math.max(0, t - Math.sqrt(r * r - off * off));
  };
  let len = range;
  for (const k of w.rocks) { const e = entry(k.x, k.y, k.r * 0.9); if (e !== null && e < len) len = e; }
  const blocks = [];
  for (const g of w.wards) {
    if (g.hp <= 0 || s.veil > g.bindLv) continue;
    let e = null;
    for (const p of wardSamples(g)) { const q = entry(p.x, p.y, g.r); if (q !== null && (e === null || q < e)) e = q; }
    if (e !== null && e < len) blocks.push({ e, o: g, kind: 'ward' });
  }
  for (const b of w.spells) if (!b.done && b.kind === 'orbiter' && b.owner !== u.id && s.veil <= b.bindLv) {
    const e = entry(b.x, b.y, b.size);
    if (e !== null && e < len) blocks.push({ e, o: b, kind: 'blade' });
  }
  for (const z of w.zones) if (z.barrier && !z.dead && z.owner !== u.id && s.veil <= z.bindLv) { const e = entry(z.x, z.y, z.zr); if (e !== null && e < len) blocks.push({ e, o: z, kind: 'zone' }); }
  blocks.sort((p, q) => p.e - q.e);
  let dmgMul = 1;
  for (const b of blocks) {
    if (b.e >= len) break;
    const o = b.o, hit = structHit({ ...s, dmg: s.dmg * dmgMul }, o.matter, true);
    const defender = unitById(w, o.owner);
    if (b.kind === 'blade') { o.hp -= hit; absorbInto(w, o, hit); if (o.hp <= 0) bladeBroken(w, o); }
    else if (b.kind === 'ward') { hurtWard(w, o, hit); absorbInto(w, o, hit); }
    else {
      hurtZone(w, o, hit); absorbInto(w, o, hit);
      // 光線は結界を砕けば奥へ届く（弱まる）
      if (o.dead) { dmgMul *= R.interfere.pierceKeep; w.events.push({ type: 'pierce', x: x0 + dx * b.e, y: y0 + dy * b.e, col: s.col }); continue; }
    }
    len = b.e;
    if (defender && o.owner !== u.id) defender.blocked++;
    w.events.push({ type: 'absorb', x: x0 + dx * len, y: y0 + dy * len, col: o.col, kind: b.kind === 'zone' ? 'bulwark' : 'solid' });
    break;
  }
  len = Math.max(0, len);
  const onBeam = (x, y, r) => { const fx = x - x0, fy = y - y0, t = fx * dx + fy * dy; return t > 0 && t < len && hyp(fx - dx * t, fy - dy * t) < r + width; };
  // 違う紋のエネルギーの弾を焼き払う
  for (const o of w.spells) if (!o.done && o.kind === 'proj' && o.state === 'fly' && o.owner !== u.id && o.matter === 'energy' && onBeam(o.x, o.y, o.size)) {
    breakBolt(w, o); w.events.push({ type: 'cancel', x: o.x, y: o.y, col: s.col, col2: o.col });
  }
  // 自分のエネルギーの場を通ると共鳴する
  for (const z of w.zones) if (z.owner === u.id && !z.dead && z.kind === 'field' && !z.barrier && z.matter !== 'solid' && onBeam(z.x, z.y, z.zr)) {
    dmgMul *= C.resonance; w.events.push({ type: 'resonate', x: z.x, y: z.y, col: z.col, col2: s.col, owner: u.id });
    break;
  }
  for (const o of w.units) {
    if (!o.alive || o.id === u.id || intang(o)) continue;
    const fx = o.x - x0, fy = o.y - y0, t = fx * dx + fy * dy;
    if (t < 0 || t >= len) continue;
    if (hyp(fx - dx * t, fy - dy * t) < o.r + width) touch(w, { ...s, dmg: s.dmg * dmgMul, traveled: t, x: o.x, y: o.y }, u, o, C.ray.mul, dx, dy, u.x, u.y);
  }
  if (w.decoys.length) for (const d of [...w.decoys]) {
    if (d.owner === u.id) continue;
    const fx = d.x - x0, fy = d.y - y0, t = fx * dx + fy * dy;
    if (t >= 0 && t < len && hyp(fx - dx * t, fy - dy * t) < d.r + width) popDecoy(w, d);
  }
  w.events.push({ type: 'beam', id: u.id, x1: x0, y1: y0, x2: x0 + dx * len, y2: y0 + dy * len, w: width, col: s.col, rtype: 'ray', a: s.look.a, b: s.look.b });
  // 次の段は照準の地点（遮られればその手前）で開く
  if (lead) {
    const reach = first ? Math.min(len, Math.max(0, hyp(at.tx - u.x, at.ty - u.y) - u.r)) : len;
    advance(w, { ...s, grp: null, advanced: false }, x0 + dx * reach, y0 + dy * reach, a, 'hit');
  }
}

// ═══ 09. 器：面・円・纏・環 ═════════════════════════════════════
// 面の1段目が立つ最大の距離（術者から）。動の点で遠くへ立つ
const wallReach = st => C.vessels.wall.range + C.wall.reachMotion * echo(st.p.motion);
function wallSpot(u, tx, ty, st) {
  const dx = tx - u.x, dy = ty - u.y, d = hyp(dx, dy), a = d > 1 ? Math.atan2(dy, dx) : u.aim;
  const dist = clamp(d, u.r + 40, Math.max(u.r + 40, wallReach(st)));
  return { x: u.x + Math.cos(a) * dist, y: u.y + Math.sin(a) * dist };
}
// 面：術者の正面に立つ一枚の壁。誰の体も弾も光線も止める（② 構造体）
function spawnWall(w, owner, base, at) {
  const st = base.st, first = base.si === 0;
  // 1段目は術者の正面に立つ（照準は向きと近さだけを決める）。遠くへは動で、それ以上は前の段の着弾点から
  const p = first ? wallSpot(owner, at.tx, at.ty, st) : { x: at.x, y: at.y };
  const dir = first && hyp(p.x - owner.x, p.y - owner.y) > 1 ? Math.atan2(p.y - owner.y, p.x - owner.x) : at.dir;
  const half = C.wall.half * st.size * (1 + C.wall.growLen * echo(st.p.grow));
  const hp = C.wall.hp * (1 + C.wall.bindHp * echo(st.p.bind)) * C.hardness[st.matter] * Math.sqrt(st.size) * base.unit * base.mul;
  const nx = -Math.sin(dir), ny = Math.cos(dir);
  addWard(w, base, p.x, p.y, 15, hp, 'wall', C.wall.life * st.time, nx * half, ny * half, Math.cos(dir), Math.sin(dir));
  w.events.push({ type: 'zone', id: 0, kind: 'wall', x: p.x, y: p.y, r: half, col: base.col, rtype: 'wall', owner: owner.id });
}
// hx, hy：面の半分の長さのベクトル。面は線分 (x±hx, y±hy) に太さ r を持つ。dx, dy：動で進む向き
function addWard(w, s, x, y, r, hp, kind, life, hx, hy, dx, dy) {
  if (hyp(x, y) > w.R + 100) return;
  w.wards.push({ id: w.nextId++, owner: s.owner, col: s.col, x, y, r, hp, max: hp, t: 0, life, kind, low: false, hold: s.hold, linked: s.linked, cost: s.cost, matter: s.matter, broken: false,
    ax: x - hx, ay: y - hy, bx: x + hx, by: y + hy, len: hyp(hx, hy) * 2, dx, dy, tick: 0,
    rec: s.rec, si: s.si, st: s.st, look: s.look, mul: s.mul, unit: s.unit, boost: s.boost, dmg: s.dmg, veil: s.veil, bindLv: s.bindLv, advanced: false, grp: null, k: s.k });
}
// 結界のいちばん近い点（柱は中心、面は線分の上）
function wardPoint(g, px, py) {
  if (!g.len) return { x: g.x, y: g.y };
  const dx = g.bx - g.ax, dy = g.by - g.ay, t = clamp(((px - g.ax) * dx + (py - g.ay) * dy) / (dx * dx + dy * dy), 0, 1);
  return { x: g.ax + dx * t, y: g.ay + dy * t };
}
function wardDist(g, px, py) { const p = wardPoint(g, px, py); return hyp(px - p.x, py - p.y); }
// 面を太さの間隔で並べた点（光線と Bot の射線の判定に使う）
function wardSamples(g) {
  if (!g.len) return [{ x: g.x, y: g.y }];
  const n = Math.max(2, Math.ceil(g.len / g.r)), out = [];
  for (let i = 0; i <= n; i++) out.push({ x: g.ax + (g.bx - g.ax) * i / n, y: g.ay + (g.by - g.ay) * i / n });
  return out;
}
function hurtWard(w, g, dmg) {
  g.hp -= dmg;
  if (g.hp <= 0 && !g.broken) {
    g.broken = true;
    w.events.push({ type: 'wardBreak', x: g.x, y: g.y, col: g.col, r: g.r, matter: g.matter });
    advance(w, g, g.x, g.y, Math.atan2(g.dy, g.dx), 'break');
  }
}
function hurtZone(w, z, dmg) {
  if (!z.barrier || z.dead) return;
  z.hp -= dmg;
  if (z.hp <= 0) {
    z.dead = true;
    w.events.push({ type: 'wardBreak', x: z.x, y: z.y, col: z.col, r: z.zr, matter: z.matter, big: true });
    advance(w, z, z.x, z.y, Math.atan2(z.dy, z.dx), 'break');
  }
}
// 円：1段目は術者の足元に開く場（遠くへは動で流す・前の段の着弾点から開く）。開いた瞬間に強く作用し、残る間は弱く作用し続ける。結があれば弾を止める結界になる
function spawnField(w, owner, base, at) {
  const st = base.st, first = base.si === 0;
  const p = first ? { x: owner.x, y: owner.y } : { x: at.x, y: at.y };
  const zr = C.field.radius * st.size;
  const hp = st.p.bind ? C.field.hp * (1 + C.wall.bindHp * echo(st.p.bind)) * C.hardness[st.matter] * st.size * base.unit * base.mul : 0;
  const z = { id: w.nextId++, owner: base.owner, col: base.col, look: base.look, kind: 'field', x: p.x, y: p.y, zr, t: 0, life: C.field.life * st.time * (1 + C.field.growLife * echo(st.p.grow)),
    tick: C.field.tick, barrier: st.p.bind ? 'bulwark' : null, matter: st.matter, hp, max: hp, dead: false, hold: base.hold, linked: base.linked, cost: base.cost,
    dx: Math.cos(at.dir), dy: Math.sin(at.dir), rec: base.rec, si: base.si, st, mul: base.mul, unit: base.unit, boost: base.boost, dmg: base.dmg, veil: base.veil, bindLv: base.bindLv, advanced: false, grp: null, k: base.k };
  w.zones.push(z);
  w.events.push({ type: 'zone', id: z.id, kind: 'field', x: z.x, y: z.y, r: zr, col: z.col, rtype: st.p.bind ? 'bulwark' : 'field', owner: z.owner });
  fieldBurst(w, z);
}
// 開いた瞬間：中の相手に強く作用し、弾を吹き消し、自分の合図の罠を誘爆させる
function fieldBurst(w, z) {
  const owner = unitById(w, z.owner), st = z.st;
  if (!owner) return;
  w.events.push({ type: 'activate', x: z.x, y: z.y, r: z.zr, col: z.col, rtype: 'field', a: z.look.a, b: z.look.b, deploy: 'burst', form: 'ring', owner: z.owner, matter: z.matter });
  const strike = st.p.divide || st.p.motion;
  if (strike) for (const o of w.spells) {
    if (o.done || o.owner === z.owner || hyp(o.x - z.x, o.y - z.y) > z.zr) continue;
    if (o.kind === 'proj' && o.state === 'fly') {
      if (o.matter === 'energy') { breakBolt(w, o); w.events.push({ type: 'cancel', x: o.x, y: o.y, col: z.col, col2: o.col }); }
      else { const d = hyp(o.x - z.x, o.y - z.y) || 1, sp = hyp(o.vx, o.vy); o.vx = (o.x - z.x) / d * sp; o.vy = (o.y - z.y) / d * sp; o.homing = false; o.dmg *= .7; w.events.push({ type: 'ricochet', x: o.x, y: o.y, col: o.col }); }
    } else if (o.state === 'wait' && st.p.divide) { o.done = true; w.events.push({ type: 'fizzle', x: o.x, y: o.y, col: o.col }); }
  }
  // 誘爆：自分の合図待ちの罠が、この爆発で次の段を開く
  if (strike) for (const o of w.spells.slice()) {
    if (o.done || o.owner !== z.owner || o.state !== 'wait' || hyp(o.x - z.x, o.y - z.y) > z.zr * 1.1) continue;
    w.events.push({ type: 'chainBlast', x1: z.x, y1: z.y, x2: o.x, y2: o.y, col: o.col });
    advance(w, o, o.x, o.y, Math.atan2(o.y - z.y, o.x - z.x), 'signal');
  }
  fieldTouch(w, z, owner, C.field.burst);
}
function fieldTouch(w, z, owner, k) {
  let touched = false;
  if (w.decoys.length) for (const d of [...w.decoys]) if (d.owner !== z.owner && hyp(d.x - z.x, d.y - z.y) < z.zr + d.r) popDecoy(w, d);
  for (const u of w.units) {
    if (!u.alive || hyp(u.x - z.x, u.y - z.y) > z.zr + u.r) continue;
    if (u.id === z.owner) { if (z.st.p.grow) heal(w, u, C.mend * echo(z.st.p.grow) * k * z.mul, k < 1); continue; }
    if (intang(u)) continue;
    touch(w, z, owner, u, k, u.x - z.x, u.y - z.y, z.x, z.y);
    touched = true;
  }
  // 増：自分の壁を直す
  if (z.st.p.grow) for (const g of w.wards) if (g.owner === z.owner && g.hp > 0 && wardDist(g, z.x, z.y) < z.zr) g.hp = Math.min(g.max, g.hp + C.mend * echo(z.st.p.grow) * k * 2);
  if (touched && !z.dead) advance(w, z, z.x, z.y, Math.atan2(z.dy, z.dx), 'hit');
}
// 纏：自分の体を器にする。一つずつ（新しく纏うと前のものはほどける）
function spawnBody(w, owner, base) {
  for (const z of w.zones) if (z.owner === owner.id && z.kind === 'body') z.dead = true;
  for (let i = w.decoys.length - 1; i >= 0; i--) if (w.decoys[i].owner === owner.id) w.decoys.splice(i, 1);
  const st = base.st;
  const z = { id: w.nextId++, owner: base.owner, col: base.col, look: base.look, kind: 'body', x: owner.x, y: owner.y, zr: owner.r + 18, t: 0, life: C.body.life * st.time,
    tick: 0, barrier: null, matter: 'energy', hp: 0, max: 0, dead: false, hold: base.hold, linked: base.linked, cost: base.cost,
    dx: Math.cos(owner.aim), dy: Math.sin(owner.aim), rec: base.rec, si: base.si, st, mul: base.mul, unit: base.unit, boost: base.boost, dmg: base.dmg, veil: base.veil, bindLv: base.bindLv, advanced: false, grp: null, k: base.k };
  w.zones.push(z);
  w.events.push({ type: 'buff', id: owner.id, kind: base.look.a, x: owner.x, y: owner.y, col: base.col });
  if (st.p.phase > 0 && st.p.grow > 0) spawnClones(w, owner, st, base.col);
}
// 分身：相（姿を写す）と増（数を増やす）が揃うと、術者の姿の囮が散らばる。狙いと追尾を引き、割られると纏の「触れたら」が開く
function spawnClones(w, owner, st, col) {
  const n = Math.max(1, Math.min(C.clone.max, Math.round(Math.min(st.p.phase, st.p.grow))));
  const life = R.decoy.life * st.time * (1 + C.clone.lifePer * echo(st.p.grow));
  for (let i = 0; i < n; i++) {
    const a = n === 1 ? owner.aim + (w.rng() < .5 ? 1 : -1) * 1.2 : owner.aim + (i - (n - 1) / 2) * 1.1;
    w.decoys.push({ id: w.nextId++, owner: owner.id, x: owner.x, y: owner.y, vx: Math.cos(a) * C.clone.speed, vy: Math.sin(a) * C.clone.speed, t: 0, life,
      mirror: true, ink: owner.ink, crest: owner.crest, r: owner.r, aim: owner.aim, col });
  }
}
function popDecoy(w, d) {
  const i = w.decoys.indexOf(d);
  if (i < 0) return;
  w.decoys.splice(i, 1);
  w.events.push({ type: 'decoyPop', x: d.x, y: d.y, col: d.col, ink: d.ink, owner: d.owner, boss: !!d.boss });
  // 演算体の偽物は罠：割ったその場へ雷が落ちる
  if (d.boss) { addStrike(w, d.x, d.y, .6, 110, .3); return; }
  const z = w.zones.find(o => o.kind === 'body' && o.owner === d.owner && !o.dead);
  if (z) advance(w, z, d.x, d.y, d.aim, 'hit');
}
function applyBody(w, z, u, dt) {
  const p = z.st.p, e = k => echo(p[k]) * Math.min(1, z.mul);
  z.x = u.x; z.y = u.y;
  u.bodyT = .15;
  u.bodyMotion = C.body.motion * e('motion');
  u.bodyArmor = Math.min(C.body.maxArmor, C.body.armor * e('bind'));
  u.bodyConvert = C.body.convert * e('convert');
  u.bodyPhase = p.phase;
  u.bodyZone = z.id;
  if (p.motion) u.hasteT = .15;
  if (p.bind) u.hardenT = .15;
  if (p.grow) { u.vitalT = .15; if (u.hp < u.maxHp) u.hp = Math.min(u.maxHp, u.hp + C.body.regen * e('grow') * dt); }
  if (p.convert) u.impactT = .15;
  if (p.divide) for (const k of ['slowT', 'rootT', 'tetherT']) u[k] = Math.max(0, u[k] - C.body.cleanse * e('divide') * dt);
  if (p.phase && u.revealT <= 0) {
    u.cloakT = .15; u.cloak = Math.min(1, C.cloak.per * e('phase'));
    // 相が高いと体が透け、弾・線・体を素通りする。魔力を毎秒払い、尽きるか、撃つ・打つと解ける
    if (p.phase >= C.ghost.at && u.mp > 0) { u.ghostT = .15; u.mp = Math.max(0, u.mp - C.ghost.drain * dt); }
  }
  // 体当たり：触れた相手に原理が作用する
  z.tick -= dt;
  if (z.tick > 0) return;
  let touched = false;
  for (const v of w.units) {
    if (!v.alive || v === u || intang(v) || hyp(v.x - u.x, v.y - u.y) > u.r + v.r + 6) continue;
    touch(w, z, u, v, C.body.bump, v.x - u.x, v.y - u.y, u.x, u.y);
    touched = true;
  }
  if (touched) { z.tick = C.body.bumpCd; advance(w, z, u.x, u.y, u.aim, 'hit'); }
}
// 環：自分の周りを回る刃や城壁。飛んでくる弾を受け止め、触れた相手に作用する。一つずつ
function spawnOrbit(w, owner, base) {
  for (const s of w.spells) if (s.owner === owner.id && s.kind === 'orbiter') s.done = true;
  const st = base.st, n = orbitCopiesOf(st.p.grow), m = Math.sqrt(C.orbitCopies[0] / n) * bigPower(st.size);
  const castle = shapeFor(st) === 'castle';
  const size = 12 * Math.sqrt(st.size) * (castle ? 1.8 : 1);
  const orad = owner.r + C.orbit.radius * st.size + size * 0.4;
  const hp = C.orbit.hp * (1 + C.wall.bindHp * echo(st.p.bind)) * C.hardness[st.matter] * base.unit * base.mul * m * (castle ? 1.5 : 1);
  const spin = C.orbit.spin * (1 + .5 * echo(st.p.motion)) * (castle ? .12 : 1);
  const grp = { advanced: false };
  for (let i = 0; i < n; i++) {
    const ang = owner.aim + i / n * TAU;
    w.spells.push({ ...base, r: base.look, radius: size, grp, mul: base.mul * m, dmg: base.dmg * m, id: w.nextId++, kind: 'orbiter', state: 'orbit',
      sx: 0, sy: 0, x: owner.x + Math.cos(ang) * orad, y: owner.y + Math.sin(ang) * orad, tx: 0, ty: 0, t: 0, dur: 0, age: 0, wait: 0, fuseT: 0, severT: 0,
      vx: 0, vy: 0, speed: 0, range: 0, traveled: 0, homing: false, tgt: null, retarget: 0, pierce: 0, stopAt: Infinity, returns: false, back: false,
      life: C.orbit.life * st.time, ang, orad, hp, hitT: C.orbit.hitCd, spin, hit: [], passed: [], shape: shapeFor(st), size, max: hp });
  }
  w.events.push({ type: 'zone', id: 0, kind: 'blades', x: owner.x, y: owner.y, r: orad, col: base.col, rtype: 'orbit', owner: owner.id });
}
function bladeBroken(w, s) {
  s.done = true;
  w.events.push({ type: 'wardBreak', x: s.x, y: s.y, col: s.col, r: 14, matter: s.matter });
  advance(w, s, s.x, s.y, s.ang, 'break');
}
function tickOrbiter(w, s, owner, dt) {
  if (!owner || !owner.alive) { s.done = true; return; }
  s.t += dt * (s.linked ? R.link.decayMul : 1);
  if (s.hp <= 0) { bladeBroken(w, s); return; }
  if (s.t > s.life) {
    s.done = true;
    if (!advance(w, s, s.x, s.y, s.ang, 'end')) w.events.push({ type: 'fizzle', x: s.x, y: s.y, col: s.col, r: 14 });
    return;
  }
  s.ang += s.spin * dt;
  const nx = owner.x + Math.cos(s.ang) * s.orad, ny = owner.y + Math.sin(s.ang) * s.orad;
  if (dt > 0) { s.vx = (nx - s.x) / dt; s.vy = (ny - s.y) / dt; }
  s.x = nx; s.y = ny;
  s.hitT -= dt;
  if (s.hitT <= 0) { s.hit.length = 0; s.hitT = C.orbit.hitCd; }
  // 飛んでくる弾を受け止める（相の点が結より多い弾は抜ける）
  for (const o of w.spells) {
    if (o.done || o.kind !== 'proj' || o.state !== 'fly' || o.owner === s.owner || o.passed.includes(s.id)) continue;
    if (segDist(s.x, s.y, o.x - o.vx * dt, o.y - o.vy * dt, o.x, o.y) > s.size + o.size) continue;
    if (o.veil > s.bindLv) { o.passed.push(s.id); continue; }
    const hit = structHit(o, s.matter);
    s.hp -= hit; absorbInto(w, s, hit);
    o.done = true; owner.blocked++;
    advance(w, o, o.x, o.y, Math.atan2(o.vy, o.vx), 'hit');
    w.events.push({ type: 'clash', x: (o.x + s.x) / 2, y: (o.y + s.y) / 2, col: s.col, col2: o.col });
    if (s.hp <= 0) { bladeBroken(w, s); return; }
  }
  // 触れた相手に作用する（同じ相手は hitCd ごとに一度）
  for (const u of w.units) {
    if (!u.alive || u.id === s.owner || intang(u) || s.hit.includes(u.id)) continue;
    if (hyp(u.x - s.x, u.y - s.y) > u.r + s.size || lineBlocked(w, owner.x, owner.y, s.x, s.y)) continue;
    s.hit.push(u.id);
    touch(w, s, owner, u, C.orbit.touch, u.x - owner.x, u.y - owner.y, owner.x, owner.y);
    if (advance(w, s, u.x, u.y, Math.atan2(u.y - owner.y, u.x - owner.x), 'hit')) return;
  }
}
function heal(w, u, amount, quiet = false) {
  if (!u.alive || amount <= 0 || u.hp >= u.maxHp) return;
  u.hp = Math.min(u.maxHp, u.hp + amount);
  if (!quiet) w.events.push({ type: 'heal', id: u.id, x: u.x, y: u.y, v: amount });
}

// ═══ 10. 場・壁・纏の更新 ═══════════════════════════════════════
function updateZones(w, dt) {
  for (let i = w.zones.length - 1; i >= 0; i--) {
    const z = w.zones[i];
    const owner = unitById(w, z.owner);
    z.t += dt * (z.linked ? R.link.decayMul : 1);
    if (!z.dead && z.t > z.life && owner && owner.alive) { z.dead = true; advance(w, z, z.x, z.y, Math.atan2(z.dy, z.dx), 'end'); }
    if (z.dead || !owner || !owner.alive) { w.zones.splice(i, 1); w.events.push({ type: 'zoneEnd', x: z.x, y: z.y, col: z.col }); continue; }
    if (z.kind === 'body') { applyBody(w, z, owner, dt); continue; }
    // 動：場は照準の向きへ進む
    if (z.st.p.motion) {
      const v = C.field.move * echo(z.st.p.motion) * dt, nx = z.x + z.dx * v, ny = z.y + z.dy * v;
      if (!w.rocks.some(k => hyp(k.x - nx, k.y - ny) < k.r)) { z.x = nx; z.y = ny; }
    }
    z.tick -= dt;
    if (z.tick <= 0) { z.tick += C.field.tick; fieldTouch(w, z, owner, C.field.touch); }
  }
  for (let i = w.wards.length - 1; i >= 0; i--) {
    const g = w.wards[i];
    const owner = unitById(w, g.owner);
    g.t += dt * (g.linked ? R.link.decayMul : 1);
    if (g.hp > 0 && g.t > g.life && owner && owner.alive) { g.hp = 0; advance(w, g, g.x, g.y, Math.atan2(g.dy, g.dx), 'end'); }
    if (g.hp <= 0 || !owner || !owner.alive) { w.wards.splice(i, 1); continue; }
    // 動：壁は照準の向きへ進み、触れた体を押していく
    if (g.st.p.motion) {
      const v = C.wall.move * echo(g.st.p.motion) * dt, mx = g.dx * v, my = g.dy * v;
      if (!w.rocks.some(k => wardDist(g, k.x - mx, k.y - my) < k.r * .9 + g.r)) { g.x += mx; g.y += my; g.ax += mx; g.ay += my; g.bx += mx; g.by += my; }
    }
    // 触れている相手に作用する
    g.tick -= dt;
    if (g.tick > 0) continue;
    g.tick = C.wall.tick;
    let touched = false;
    for (const u of w.units) {
      if (!u.alive || intang(u)) continue;
      const cp = wardPoint(g, u.x, u.y);
      if (hyp(u.x - cp.x, u.y - cp.y) > g.r + u.r + 6) continue;
      if (u.id === g.owner) { if (g.st.p.grow) heal(w, u, C.mend * echo(g.st.p.grow) * C.wall.touch, true); continue; }
      touch(w, g, owner, u, C.wall.touch, u.x - cp.x, u.y - cp.y, cp.x, cp.y);
      touched = true;
    }
    if (touched) advance(w, g, g.x, g.y, Math.atan2(g.dy, g.dx), 'hit');
  }
  for (let i = w.decoys.length - 1; i >= 0; i--) {
    const d = w.decoys[i];
    d.t += dt;
    if (d.t > d.life) { w.decoys.splice(i, 1); continue; }
    d.x += d.vx * dt; d.y += d.vy * dt;
    const k = Math.max(0, 1 - C.clone.drag * dt); d.vx *= k; d.vy *= k;
  }
}

// ═══ 11. 糸（維持費・切断・誘導・合図・回収） ════════════════════
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
      upkeep += (R.link.upkeepBase + o.cost * R.link.upkeepScale) * R.link.upkeepMul / (o.kind === 'orbiter' ? 3 : 1);
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
function severAll(w, u, why) { for (const o of linkedOf(w, u)) sever(w, o, why); for (const v of w.units) if (v.tetherOwner === u.id) v.tetherT = 0; }
// 合図待ちの器か（F で次の段を開く）
const waitsSignal = o => o.linked && o.st && o.st.then === 'signal' && hasNext(o);
// 合図（F）：糸でつながった「合図で」の器が次の段を開く
function detonate(w, u) {
  let n = 0;
  const all = [...w.spells, ...w.zones, ...w.wards];
  for (const o of all) {
    if (o.owner !== u.id || o.done || o.dead || (o.low !== undefined && o.hp <= 0) || !waitsSignal(o)) continue;
    const dir = o.vx || o.vy ? Math.atan2(o.vy, o.vx) : o.dx !== undefined ? Math.atan2(o.dy, o.dx) : u.aim;
    if (advance(w, o, o.x, o.y, dir, 'signal')) n++;
  }
  if (n) w.events.push({ type: 'detonate', id: u.id, n });
  return n;
}
// 回収（G）：糸でつながった術式をほどき、残っている割合 × 60% の魔力を戻す
function recall(w, u) {
  let refund = 0, n = 0;
  for (const o of linkedOf(w, u)) {
    let left;
    const ward = o.low !== undefined, zone = o.zr !== undefined;
    if (ward) left = Math.max(0, 1 - o.t / o.life) * Math.max(0, o.hp / o.max);
    else if (zone || o.kind === 'orbiter') left = Math.max(0, 1 - o.t / o.life);
    else left = Math.max(0, 1 - o.wait / (R.wait * o.st.time));
    refund += o.cost * R.recall.refund * left;
    n++;
    if (ward) o.hp = 0;
    else if (zone) o.dead = true;
    else o.done = true;
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
  for (const u of w.units) if (u.tetherOwner === id) u.tetherT = 0;
}

// ═══ 12. 触れる（原理が相手に効く）と打撃 ═══════════════════════
// s：触れた器（弾・線・壁・場・纏・刃）。k：器の倍率。(cx, cy)：器の中心（引く先・つなぐ先）
//  分：壊す（打撃・殻を剥がす・2点で糸を断つ）  動：押す・引く・回す  結：中心へつなぐ（3点で足止め）
//  換：魔力を奪う  相：印を付ける  増：相手には効かない（自分の紋を直す）
function touch(w, s, owner, u, k, dirx, diry, cx, cy) {
  if (u.spawnShield > 0 || intang(u) || !u.alive) return;
  const st = s.st, p = st.p, e = key => echo(p[key]);
  owner.revealT = Math.max(owner.revealT, 1.4);
  // 打撃は s.dmg（魔素の重さ・節点・複製の倍率を含む）× 器の倍率 × 遠くでの衰え。副作用の強さも同じ割合で弱まる
  const fall = s.traveled ? falloffMul(st, s.traveled) : 1, strength = k * s.mul * fall;
  let dmg = s.dmg * k * fall * touchPower(st);
  if (u.markT > 0) dmg *= 1 + C.dmg.mark * u.markLv;
  if (u.casting) dmg *= 1.1;
  // 動：押す・引く・回す。弾・線・纏・環の中心は術者、壁は触れた面、場は中心
  let nx = dirx, ny = diry;
  if (st.force === 'pull') { nx = cx - u.x; ny = cy - u.y; }
  const d = hyp(nx, ny) || 1; nx /= d; ny /= d;
  if (st.force === 'spin') { const t = nx; nx = -ny; ny = t; }
  const knock = C.knock * e('motion') * Math.min(1.2, strength) + (s.matter === 'solid' && st.vessel !== 'body' ? C.solidKnock * Math.min(1, strength) : 0);
  if (knock > 0) { u.vx += nx * knock; u.vy += ny * knock; }
  // 結：器の中心へつなぐ（弾・線・纏・環は術者につながる）
  if (p.bind) {
    const T = C.tether, owned = ['bolt', 'ray', 'body', 'orbit'].includes(st.vessel);
    u.tetherT = Math.max(u.tetherT, (T.time + T.timePer * e('bind')) * Math.min(1, strength + .3));
    u.tetherX = cx; u.tetherY = cy; u.tetherTo = owned ? owner.id : 0; u.tetherOwner = owner.id;
    u.tetherLength = Math.max(T.min, T.length - T.perLevel * p.bind); u.tetherForce = T.force + T.forcePer * e('bind'); u.tetherPull = T.pull + T.pullPer * e('bind');
    // 遠くでつながれても、つながった距離より少し離れるまでは切れない
    u.tetherBreak = Math.max(u.tetherLength + T.slack, hyp(u.x - cx, u.y - cy) + T.slack * .5);
    slow(u, Math.min(.6, T.slow * e('bind')), .6 + .3 * e('bind'));
    if (p.bind >= 3) root(u, T.root * Math.min(1, strength + .3));
  }
  // 分：殻を剥がし、2点以上で糸を断つ
  if (p.divide >= 2 && strength >= .3) severAll(w, u, 'cut');
  // 換：魔力を奪う
  if (p.convert) {
    const taken = Math.min(u.mp, C.drain * e('convert') * strength);
    u.mp -= taken; owner.mp = Math.min(maxMp(owner), owner.mp + taken * C.drainKeep);
    if (taken > 0) w.events.push({ type: 'drain', x: u.x, y: u.y, owner: owner.id, col: s.col, v: taken });
  }
  // 相：印を付ける（隠れられず、打撃が重くなる）
  if (p.phase) { u.markT = Math.max(u.markT, C.markTime + e('phase')); u.markLv = Math.max(u.markLv, p.phase); u.revealT = Math.max(u.revealT, u.markT); }
  damage(w, u, dmg, owner);
  w.events.push({ type: 'hit', x: u.x - nx * u.r * 0.6, y: u.y - ny * u.r * 0.6, dmg, col: s.col, rtype: st.vessel, a: s.look.a, b: s.look.b,
    shape: shapeFor(st), target: u.id, owner: owner.id, vx: nx, vy: ny, shielded: dmg <= 0, matter: s.matter });
}
function root(u, t) { u.rootT = Math.max(u.rootT, t); }
function slow(u, amt, t) { u.slowAmt = Math.max(u.slowAmt, amt); u.slowT = Math.max(u.slowT, t); }
function damage(w, u, dmg, source) {
  if (!u.alive || dmg <= 0) return;
  dmg *= 1 - u.bodyArmor;
  u.revealT = Math.max(u.revealT, 1.4);
  const foe = source && source.id !== u.id;
  // 追い打ち：手負いの相手にはいっそう重く入り、傷口は塞がらない（法則：世界は誰も選ばない）
  if (foe && !u.dummy && !w.room.practice && !u.boss) {
    const hr = u.hp / u.maxHp;
    if (hr < W.cruel.finish.below) dmg *= W.cruel.finish.mul;
    if (hr < W.cruel.bleed.below) u.bleedT = W.cruel.bleed.time;
  }
  // 纏の換：受けた打撃の一部を魔力へ
  if (foe && u.bodyConvert > 0) { const a = dmg * u.bodyConvert; dmg -= a; u.mp = Math.min(maxMp(u), u.mp + a * .8); }
  if (foe) { source.dealt += dmg; source.revealT = Math.max(source.revealT, 1.4); }
  // 纏の「触れたら」：打たれた瞬間に次の段を開く
  if (foe) { const z = w.zones.find(o => o.kind === 'body' && o.owner === u.id && !o.dead); if (z) advance(w, z, u.x, u.y, Math.atan2(source.y - u.y, source.x - u.x), 'hit'); }
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
  if (foe) { u.lastHitBy = source.id; u.lastHitT = w.t; }
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
  if (u.bot && !u.boss) w.respawnQueue.push(w.t + 2 + w.rng() * 5);
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

// ═══ 13b. 落雷とスペシャルステージの演算体 ═══════════════════════
// 落雷：予告の輪が出て、少しあとに落ちる。魔素を多く抱えた者ほど選ばれやすい（法則二）。避けるか、受けるか
function nextStrike(w) {
  const sc = w.room.special ? D.bosses[w.stage].strikeEvery : W.cruel.strike.every;
  return sc[0] + w.rng() * (sc[1] - sc[0]);
}
function addStrike(w, x, y, delay, r, share, motes = 0) {
  w.strikes.push({ id: w.nextId++, x, y, r, t: 0, delay, share, motes });
  w.events.push({ type: 'strikeWarn', x, y, r, delay });
}
function updateStrikes(w, dt) {
  if (!w.room.practice) {
    w.strikeT -= dt;
    if (w.strikeT <= 0) {
      w.strikeT = nextStrike(w);
      const C2 = W.cruel.strike, alive = w.units.filter(u => u.alive && !u.dummy && !u.boss);
      if (alive.length) {
        const top = alive.reduce((a, b) => (b.mass > a.mass ? b : a));
        const victim = w.room.special ? alive[0] : w.rng() < C2.bias ? top : null;
        if (victim) addStrike(w, victim.x + victim.vx * C2.warn * .5, victim.y + victim.vy * C2.warn * .5, C2.warn, C2.r, C2.hpShare, C2.motes);
        else { const a = w.rng() * TAU, d = Math.sqrt(w.rng()) * (w.R - 200); addStrike(w, Math.cos(a) * d, Math.sin(a) * d, C2.warn, C2.r, C2.hpShare, C2.motes); }
      }
    }
  }
  for (let i = w.strikes.length - 1; i >= 0; i--) {
    const s = w.strikes[i];
    s.t += dt;
    if (s.t < s.delay) continue;
    w.strikes.splice(i, 1);
    w.events.push({ type: 'strike', x: s.x, y: s.y, r: s.r });
    for (const u of w.units) {
      if (!u.alive || u.dummy || intang(u) || hyp(u.x - s.x, u.y - s.y) > s.r + u.r) continue;
      damage(w, u, u.maxHp * s.share, null);
      u.vx += (u.x - s.x) * 4; u.vy += (u.y - s.y) * 4;
    }
    // 落ちた所には魔素が噴く（誰のものでもない）
    for (let k = 0; k < Math.min(18, s.motes / 2); k++) { const a = w.rng() * TAU, d = w.rng() * s.r; dropMote(w, s.x + Math.cos(a) * d, s.y + Math.sin(a) * d, 2.5, D.inkOrder[Math.floor(w.rng() * D.inkOrder.length)], 140); }
  }
}
// 演算体：脳と回路を思わせる知性。力で押すより、欺き、学び、観測する
function addBoss(w, stage) {
  const B = D.bosses[Math.min(stage, D.bosses.length - 1)];
  const u = makeUnit(w, { name: B.name, ink: 'purple', crest: 'ring', bot: true, spells: B.spells.map(k => D.presets[k].r), cries: { win: B.win, death: B.death } });
  u.boss = { stage, hp: B.hp, r: B.r, speed: B.speed, seen: {}, counter: '', learnT: B.learnEvery, decoyT: B.decoyEvery * .6, hideT: 0 };
  u.mass = B.mass; u.peak = B.mass; u.level = 12; u.xp = xpFor(12);
  refreshBody(u);
  u.hp = u.maxHp; u.mp = maxMp(u); u.spawnShield = 0;
  u.brain.skill = .95; u.brain.aggr = .85; u.brain.flee = 0; u.brain.keep = 360;
  u.x = w.R * .45; u.y = 0; u.aim = Math.PI;
  w.units.push(u);
  w.boss = u;
  return u;
}
function bossThink(w, u, dt) {
  const B = u.boss, cfg = D.bosses[Math.min(B.stage, D.bosses.length - 1)], h = hero(w);
  u.mp = Math.min(maxMp(u), u.mp + 10 * dt);
  if (!h || !h.alive) return;
  // 学ぶ：術者が多用した器に合わせて、四つの術を組み替える
  B.learnT -= dt;
  if (B.learnT <= 0) {
    B.learnT = cfg.learnEvery;
    let dom = '', best = 0;
    for (const [v, n] of Object.entries(B.seen)) if (n > best) { best = n; dom = v; }
    B.seen = {};
    if (dom && dom !== B.counter && D.bossCounters[dom]) {
      B.counter = dom;
      u.spells = D.bossCounters[dom].map(k => normRecipe(D.presets[k].r));
      u.slotCd = [0, 0, 0, 0];
      w.events.push({ type: 'bossLearn', id: u.id, vessel: dom, x: u.x, y: u.y });
    }
  }
  // 欺く：偽の自分を撒き、本物は姿を消す。偽物を割ると、そこへ雷が落ちる
  B.decoyT -= dt;
  if (B.decoyT <= 0) {
    B.decoyT = cfg.decoyEvery * (.8 + w.rng() * .4);
    for (let i = 0; i < cfg.decoyN; i++) {
      const a = w.rng() * TAU, v = 90 + w.rng() * 120;
      w.decoys.push({ id: w.nextId++, owner: u.id, x: u.x, y: u.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, life: 5.5, mirror: true, boss: true, ink: u.ink, crest: u.crest, r: u.r, aim: u.aim, col: '#b784ff' });
    }
    B.hideT = 3;
    w.events.push({ type: 'bossDecoy', id: u.id, x: u.x, y: u.y });
  }
  if (B.hideT > 0) { B.hideT -= dt; if (u.revealT <= 0) { u.cloakT = .15; u.cloak = .9; } }
}
// ═══ 14. 1フレームの更新 ════════════════════════════════════════
function step(w, dt) {
  dt = Math.min(dt, 0.05);
  w.t += dt;
  for (const u of w.units) if (u.alive && u.bot) { botThink(w, u, dt); if (u.boss) bossThink(w, u, dt); }
  for (const u of w.units) if (u.alive && u.dummy) dummyThink(w, u, dt);
  for (const u of w.units) if (u.alive) updateUnit(w, u, dt);
  separate(w);
  updateSpells(w, dt);
  updateZones(w, dt);
  updateLinks(w, dt);
  updateStrikes(w, dt);
  updateMotes(w, dt);
  updateRespawns(w);
  w.rankT -= dt;
  if (w.rankT <= 0) { w.rankT = 0.4; rank(w); }
}
function updateUnit(w, u, dt) {
  const ix = u.input;
  for (const k of ['bodyT', 'cloakT', 'ghostT', 'revealT', 'impactT', 'tetherT', 'hasteT', 'hardenT', 'vitalT']) u[k] = Math.max(0, u[k] - dt);
  // 纏がほどけたら、体に宿した原理も消える
  if (u.bodyT <= 0) { u.bodyMotion = 0; u.bodyArmor = 0; u.bodyConvert = 0; u.bodyPhase = 0; u.bodyZone = 0; }
  if (u.tetherT > 0) {
    // 術者につながれていれば、つなぐ先は術者と一緒に動く
    const caster = unitById(w, u.tetherOwner), anchor = u.tetherTo ? unitById(w, u.tetherTo) : null;
    if (anchor) { u.tetherX = anchor.x; u.tetherY = anchor.y; }
    const d = hyp(u.x - u.tetherX, u.y - u.tetherY);
    if (!caster || !caster.alive || (u.tetherTo && (!anchor || !anchor.alive)) || d > u.tetherBreak || u.dashT > 0) u.tetherT = 0;
  }
  for (let i = 0; i < 4; i++) u.slotCd[i] = Math.max(0, u.slotCd[i] - dt);
  u.dodgeCd = Math.max(0, u.dodgeCd - dt * (1 + u.bodyMotion * 3));
  u.spawnShield = Math.max(0, u.spawnShield - dt);
  u.dashT = Math.max(0, u.dashT - dt); u.hurtT = Math.max(0, u.hurtT - dt);
  u.phaseT = Math.max(0, u.phaseT - dt);
  u.rootT = Math.max(0, u.rootT - dt); u.markT = Math.max(0, u.markT - dt);
  if (u.markT <= 0) u.markLv = 0;
  u.slowT -= dt; if (u.slowT <= 0) u.slowAmt = 0;
  u.combatT += dt;
  // 魔力は勝手には戻らない。節点の中では湧き出し、修練場では常に戻る
  const regen = w.room.practice ? W.mp.practice : w.room.special ? W.mp.special : u.node >= 0 ? W.node.regen : W.mp.regen;
  u.mp = Math.min(maxMp(u), u.mp + regen * dt);
  if (u.mass > W.decay.floor && !u.boss) { u.mass -= (u.mass - W.decay.floor) * W.decay.rate * (1 + u.mass / W.decay.soft) * dt; refreshBody(u); }
  // 手負いは自然には癒えない。血が止まらない間は構造が削られ続ける
  if (u.combatT > W.regen.delay && (u.hp > u.maxHp * W.cruel.noRegen || w.room.practice)) u.hp = Math.min(u.maxHp, u.hp + u.maxHp * W.regen.perSec * dt);
  if (u.bleedT > 0) {
    u.bleedT -= dt;
    if (!w.room.practice && !u.dummy && !u.boss) { u.hp -= u.maxHp * W.cruel.bleed.perSec * dt; if (u.hp <= 0) kill(w, u); }
  }
  // 節点に出入りした（入った節点の原理の術が強まる）
  let node = -1;
  for (const n of w.nodes) if (hyp(u.x - n.x, u.y - n.y) < W.node.r) { node = n.i; break; }
  if (node !== u.node) { u.node = node; if (!u.bot) w.events.push({ type: 'node', id: u.id, node, k: node >= 0 ? w.nodes[node].k : null }); }
  const center = hyp(u.x, u.y) < W.center.r;
  if (center !== u.center) { u.center = center; if (!u.bot && center) w.events.push({ type: 'center', id: u.id }); }
  // 狙い・持ち替え・詠唱
  u.aim = ix.aim;
  if (ix.slot >= 0 && ix.slot < 4) u.sel = ix.slot;
  if (u.casting) { u.casting.t += dt; if (u.casting.t >= u.casting.total) release(w, u); }
  else if (ix.cast) beginCast(w, u, u.sel);
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
  const speed = speedOf(u) * (1 + u.bodyMotion) * (1 - u.slowAmt) * (u.casting ? W.cast.slowWhileChant : 1) * (u.rootT > 0 ? 0 : 1);
  if (u.dashT <= 0) {
    const k = Math.min(1, dt * W.body.accel);
    u.vx += (mx * speed - u.vx) * k;
    u.vy += (my * speed - u.vy) * k;
  }
  if (u.tetherT > 0 && u.dashT <= 0) {
    const dx = u.tetherX - u.x, dy = u.tetherY - u.y, d = hyp(dx, dy) || 1;
    const f = Math.min(u.tetherPull, Math.max(0, d - u.tetherLength) * u.tetherForce);
    u.vx += dx / d * f * dt; u.vy += dy / d * f * dt;
  }
  // 回避でも壁を飛び越さないように、移動の途中で接触を調べる
  const steps = Math.max(1, Math.ceil(hyp(u.vx, u.vy) * dt / Math.max(4, u.r * 0.5)));
  const push = (cx, cy, r, px, py, fx = 1, fy = 0) => {
    let dx = u.x - cx, dy = u.y - cy;
    const d = hyp(dx, dy), min = r + u.r;
    if (d >= min) return;
    // 壁の中心に設置された体も押し出す。進入した側を優先する
    if (d === 0) { dx = px - cx; dy = py - cy; if (hyp(dx, dy) === 0) { dx = fx; dy = fy; } }
    const n = hyp(dx, dy), nx = dx / n, ny = dy / n;
    u.x = cx + nx * min; u.y = cy + ny * min;
    const vn = u.vx * nx + u.vy * ny;
    if (vn < 0) { u.vx -= vn * nx; u.vy -= vn * ny; }
  };
  for (let i = 0; i < steps; i++) {
    const px = u.x, py = u.y;
    u.x += u.vx * dt / steps; u.y += u.vy * dt / steps;
    for (const k of w.rocks) push(k.x, k.y, k.r * 0.9, px, py);
    // 纏の相の点が壁の結より多ければ、壁をすり抜けて歩ける（岩は抜けない）
    for (const g of w.wards) if (!g.low && g.hp > 0 && u.bodyPhase <= g.bindLv) {
      const p = wardPoint(g, u.x, u.y);
      push(p.x, p.y, g.r, px, py, g.len ? g.by - g.ay : 1, g.len ? g.ax - g.bx : 0);
    }
  }
  // 結界の外：構造が崩れる。さらに外へは出られない
  const dc = hyp(u.x, u.y);
  if (dc > w.R) {
    if (!w.room.practice) damage(w, u, (W.edge.dps + u.maxHp * W.edge.dpsPerHp) * dt, null);
    u.combatT = 0;
    const lim = w.R + W.edge.hardMargin;
    if (dc > lim) { u.x *= lim / dc; u.y *= lim / dc; }
  }
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
// 術の役割：どんな場面で使うかを、1段目の器と原理、つながる段から決める
function spellRole(r) {
  const s0 = r.stages[0], p = s0.p, v = s0.vessel, chain = r.stages.length > 1;
  if (v === 'body') return p.grow && p.phase ? 'decoy' : p.grow ? 'heal' : p.phase ? 'decoy' : p.motion && p.motion >= p.bind ? 'haste' : 'harden';
  if (v === 'orbit') return 'guard';
  if (v === 'wall') return 'ward';
  if (v === 'ray') return 'beam';
  if (chain && s0.then === 'signal') return 'remote';
  if (v === 'field') {
    if (chain && s0.then === 'hit' && p.phase) return 'trap';
    if (p.bind && !p.divide && !p.motion) return 'guard';
    if (p.grow && !p.divide) return 'heal';
    if (p.convert && !p.divide) return 'drain';
    return 'area';
  }
  // 弾：放物や、触れたら円を開く弾は範囲の術
  if (s0.path === 'arc' || (chain && r.stages[1].vessel === 'field')) return 'area';
  if (s0.path === 'seek') return p.bind >= 2 ? 'bind' : p.convert > p.divide ? 'drain' : 'homing';
  if (p.bind >= 2) return 'bind';
  if (p.convert > p.divide) return 'drain';
  return 'shot';
}
// 自分の足元に開く術（1段目の円は必ず足元。動があれば足元から流れていく）
const selfCast = r => r.stages[0].vessel === 'field';
// 術が相手に届く距離（Bot が射程の外から撃たないために）
function spellReach(r) {
  const s0 = r.stages[0], V = C.vessels;
  switch (s0.vessel) {
    case 'bolt': return s0.path === 'arc' ? 600 * s0.time : V.bolt.range * s0.time * (s0.path === 'return' ? .5 : .85);
    case 'ray': return V.ray.range * (1 + C.ray.motionRange * echo(s0.p.motion)) * .95;
    case 'wall': return wallReach(s0) + C.wall.half * s0.size;
    case 'field': return C.field.radius * s0.size + C.field.move * echo(s0.p.motion) * C.field.life * s0.time * .5;
    case 'orbit': return C.orbit.radius * s0.size + 60;
  }
  return 0;
}
function makeBrain(w, school) {
  const r = w.rng;
  return {
    t: 0, mode: 'gather', target: null, bait: 0, wander: null, placing: false,
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
  for (const g of w.wards) if (g.hp > 0 && wardSamples(g).some(p => test(p.x, p.y, g.r))) return true;
  return false;
}
// 役割に合い、相手まで届く術の番号（容量を超える術はたまにしか使わない）
function slotFor(w, u, role, dist = 0) {
  for (let i = 0; i < 4; i++) {
    const r = u.spells[i];
    if (spellRole(r) !== role || u.slotCd[i] > 0) continue;
    // 纏と環は一つずつ。続いている間は唱えなおさない
    const v = r.stages[0].vessel;
    if (v === 'body' && w.zones.some(z => z.owner === u.id && z.kind === 'body' && !z.dead && z.life - z.t > .7)) continue;
    if (v === 'orbit' && w.spells.some(s => s.owner === u.id && s.kind === 'orbiter' && !s.done && s.life - s.t > .7)) continue;
    if (u.mp < recipeCost(r) + 4) continue;
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
  const bait = b.bait ? w.decoys.find(o => o.id === b.bait) : null;
  if (bait) {
    // 分身に惑わされている間は、囮へ撃つ
    const want = Math.atan2(bait.y - u.y, bait.x - u.x);
    ix.aim = u.aim + angDiff(u.aim, want) * Math.min(1, dt * (5 + b.skill * 12));
    if (!b.placing) { ix.tx = bait.x; ix.ty = bait.y; }
  } else if (tgt && tgt.alive && visibleTo(u, tgt)) {
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
    if (!o.alive || !visibleTo(u, o) || o === u) continue;
    const d = hyp(o.x - u.x, o.y - u.y);
    if (d > 1000) continue;
    if (d < nd) { nd = d; near = o; }
    const weak = 1 - o.hp / o.maxHp;
    // 入場したての小さな相手は後回し（撃ってきた相手は別）。拘束された相手は狙いどき
    const fresh = o.mass < 20 && w.t - o.bornT < 25 && u.lastHitBy !== o.id ? 0.3 : 1;
    const s = (1 + weak * 1.6 + (o.mass > u.mass ? 0.3 : 0) + (o.rootT > 0 ? 0.8 : 0) + (u.lastHitBy === o.id && w.t - u.lastHitT < 4 ? 0.7 : 0)) / (d + 120) * (o.spawnShield > 0 ? 0.1 : 1) * fresh;
    if (s > ps) { ps = s; pickU = o; }
  }
  // 近くの分身：腕前の低い Bot ほど本物と取り違え、囮のほうを狙う
  b.bait = 0;
  let baitD = 1e9, baitO = null;
  for (const o of w.decoys) {
    if (o.owner === u.id) continue;
    const dd = hyp(o.x - u.x, o.y - u.y);
    if (dd < 640 && dd < baitD) { baitD = dd; baitO = o; }
  }
  if (baitO && (!pickU || hyp(pickU.x - u.x, pickU.y - u.y) > baitD * .7) && r() > .1 + b.skill * .45) {
    b.bait = baitO.id;
    pickU = { id: 0, x: baitO.x, y: baitO.y, vx: baitO.vx, vy: baitO.vy, hp: 40, maxHp: 100, mass: 0, rootT: 0, tetherT: 0, slowAmt: 0, spawnShield: 0, bornT: 0 };
  }
  const hpR = u.hp / u.maxHp;
  let mx = 0, my = 0, cast = false, slot = 0;
  // 巨体には近づかない（よほど好戦的で、相手が弱っていれば別）
  let giant = null;
  for (const o of w.units) if (o.alive && o !== u && visibleTo(u, o) && o.mass > u.mass * 2.5 + 60 && hyp(o.x - u.x, o.y - u.y) < 480 + o.r && !(b.aggr > 0.7 && hpR > 0.7 && o.hp < o.maxHp * 0.5)) { giant = o; break; }
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
  // 自分の合図待ちの器の近くに敵が来たら合図、魔力が尽きたら糸を回収
  for (const o of [...w.spells, ...w.zones, ...w.wards]) if (o.owner === u.id && !o.done && !o.dead && waitsSignal(o) && foeNear(w, o, o.st.vessel === 'field' ? o.zr : 110)) { ix.detonate = true; break; }
  if (u.mp < 12 && linkedOf(w, u).length) ix.recall = true;
  const use = (role, px, py, dist = 0) => {
    const i = slotFor(w, u, role, dist);
    if (i < 0) return false;
    slot = i; cast = true;
    // 結界・回復・吸奪の場は自分の足元に開く
    if (selfCast(u.spells[i]) && !u.spells[i].stages[0].p.motion) { px = u.x; py = u.y; }
    if (px !== undefined) { ix.tx = px; ix.ty = py; b.placing = true; }
    return true;
  };
  if (near && ((nd < 620 && hpR < b.flee) || near === giant)) {
    b.mode = 'flee'; b.target = near.id;
    mx = u.x - near.x; my = u.y - near.y;
    // 逃げながら：守り・回復・加速・足止め・罠・隠れ身・壁
    const acted = ((threat || beamAim) && hpR < 0.4 && use('guard'))
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
    const blades = w.spells.some(o => o.owner === u.id && o.kind === 'orbiter' && !o.done);
    const keep = blades ? Math.min(b.keep, 70) : b.keep;
    const radial = clamp((d - keep) / 150, -1, 1);
    if (r() < 0.05) b.strafe *= -1;
    mx = dx / d * radial - dy / d * b.strafe * 0.85;
    my = dy / d * radial + dx / d * b.strafe * 0.85;
    if (refuel) { const fx = refuel.x - u.x, fy = refuel.y - u.y, fd = hyp(fx, fy) || 1; mx = fx / fd * 1.4 + mx * 0.4; my = fy / fd * 1.4 + my * 0.4; }
    const blocked = lineBlocked(w, u.x, u.y, pickU.x, pickU.y, u.id);
    const low = pickU.hp < pickU.maxHp * 0.3;
    const held = pickU.rootT > 0.25 || pickU.tetherT > .4 || pickU.slowAmt > 0.3;
    const px = ix.tx, py = ix.ty;
    // 場面に合う術を選ぶ（上ほど優先）
    let chosen = false;
    const T = (cond, fn) => { if (!chosen && cond) chosen = !!fn(); };
    // 守り：弾や光線が来る
    T((threat || beamAim) && w.t - b.lastGuard > 2 && r() < 0.35 + b.skill * 0.6, () => {
      const ok = use('guard') || use('harden') || use('ward', u.x + dx / d * 90, u.y + dy / d * 90) || use('decoy', u.x, u.y);
      if (ok) b.lastGuard = w.t;
      return ok;
    });
    T(hpR < 0.45, () => use('heal', u.x, u.y) || use('drain', px, py, d));
    // 罠と指示起爆：迫ってくる相手の進む先へ置く（置いた指示式は近づいたら起爆し、近くの自分の罠を誘爆させる）
    const closing = (pickU.vx * -dx + pickU.vy * -dy) / d > 60;
    T(d < 600 && (closing ? r() < 0.7 : r() < 0.3), () => use('trap', u.x + dx * 0.6, u.y + dy * 0.6, d) || use('remote', px, py, d));
    // 連携：拘束・鈍化した相手には、重い一撃（光線・範囲・得意の弾）を叩き込む
    T(held, () => use('beam', undefined, undefined, d) || use('area', pickU.x, pickU.y, d) || use('remote', pickU.x, pickU.y, d) || use('shot', undefined, undefined, d));
    // 間合いの近い流派：刃を回してから、足を速めて一気に詰める
    T(b.keep < 320 && d < 480 && !blades && r() < 0.6, () => use('guard'));
    T(b.keep < 320 && d > b.keep + 80 && d < 700 && r() < 0.5, () => use('haste'));
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
    T(low && d > 300 && d < 600 && r() < 0.3, () => use('haste'));
    T(r() < 0.08, () => use('haste') || use('harden') || use('decoy', u.x, u.y));
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
        const home = w.nodes.find(n => u.spells.some(sp => sp.stages.some(st => st.p[n.k] >= 2)));
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
  // 予告の輪から離れる
  for (const k of w.strikes) { const dx = u.x - k.x, dy = u.y - k.y, d = hyp(dx, dy) || 1; if (d < k.r + 90 && r() < .3 + b.skill * .6) { mx += dx / d * 3; my += dy / d * 3; } }
  // 結界と岩を避ける
  const dc = hyp(u.x, u.y);
  if (dc > w.R - 260) { const k = (dc - (w.R - 260)) / 120; mx -= u.x / dc * k * 2; my -= u.y / dc * k * 2; }
  for (const k of w.rocks) {
    const dx = u.x - k.x, dy = u.y - k.y, d = hyp(dx, dy);
    if (d < k.r + u.r + 70) { mx += dx / d * 1.2; my += dy / d * 1.2; }
  }
  const L = hyp(mx, my) || 1;
  ix.mx = mx / L; ix.my = my / L;
  ix.cast = cast;
  ix.slot = slot;
}

// ChatGPT版の自動操縦から、Botと同じ判断を術者に適用する。通常の操作では呼ばれない。
function autoThink(w, u, dt) {
  if (!u.brain) u.brain = makeBrain(w, null);
  botThink(w, u, dt);
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
  createWorld, addBoss, addStrike, popDecoy, step, spawnHero, hero, unitById, addBot, gain, xpFor, capacityOf, maxMp,
  visibleTo, visibleSpell, copiesOf, orbitCopiesOf, normRecipe, recipeResult, spellName, partCount, misfireChance, recipeCost, baseCost, stageCost, windupTime, spellInfo, spellRole, visualShapeOf, lookOf, topKeys, echo,
  falloffMul, touchPower, hurtZone, hurtWard, wardPoint, wardDist, nodeBoost, interfere, advance, waitsSignal,
  beginCast, release, fire, detonate, recall, linkedOf, sever, homingTarget,
  damage, kill, rank, runPoints, tierOf, motesNear, mulberry, spellReach, slotFor, autoThink
};
})();
