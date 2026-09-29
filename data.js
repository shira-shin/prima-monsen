// PRIMA 紋戦 — 数値・表・文章
// ロジックは sim.js（演算）と game.js（描画・操作）にある。バランス調整はまずここで行う。
// window.PRIMA_DATA として公開する。Node のテストでは globalThis に載る。
(() => {
const DATA = {};

// ═══ 01. 世界の定数 ════════════════════════════════════════════
DATA.WORLD = {
  // 体：魔素（スコア）が増えるほど大きく・丈夫に・遅くなる
  // 体の大きさはほぼ一定（育ちはオーラと装いで見せる）。重さ（魔素）が増えるほど少し遅くなる
  body: { baseR: 18, rPerSqrt: 0.12, maxR: 24, baseHp: 110, hpPerSqrt: 5, speed: 272, speedPerSqrt: 1.45, minSpeed: 180, accel: 8 },
  // 魔力（術の燃料）。詠唱を始めるときに先払いする
  // 魔力（術の燃料）。詠唱を始めるときに先払いする。戦場では勝手には戻らない：
  // 光の粒（魔素）を拾うと戻り（mote.mana × 粒の大きさ）、六原理の節点の中でだけ湧き出る（node.regen 毎秒）。修練場では常に戻る
  mp: { max: 100, perLevel: 4, regen: 0, practice: 24 },
  // 命中の基本威力：旧版の (8 + 現象の威力 × 0.085) に、魔素の大きさの補正 (1 + √魔素 × perSqrt) を掛ける
  hit: { base: 10, perPower: 0.085, perSqrt: 0.012 },
  // 詠唱中は遅くなる。放った直後の間
  cast: { slowWhileChant: 0.72, recast: 0.12 },
  // 回避（右クリック / Space）
  dodge: { cd: 2.6, cost: 14, speed: 1200, time: 0.18 },
  // 回復：しばらく打たれないと自然に戻る
  regen: { delay: 5, perSec: 0.03 },
  // 撃破：散った体は魔素に戻り、周囲にばらまかれる
  death: { dropShare: 0.72, dropBase: 6, killerShare: 0.08, killerBase: 8, killerHeal: 0.15, killerMana: 0.4, creditTime: 5 },
  // 結界の外は構造が保てない
  edge: { dps: 18, dpsPerHp: 0.08, hardMargin: 220 },
  // 大きな体は保ちきれず、魔素が少しずつ散逸する（③ 散逸）
  // 1秒あたり (魔素 − floor) × rate × (1 + 魔素 / soft)。大きいほど急に散る
  decay: { floor: 400, rate: 0.004, soft: 3000 },
  // 入場直後の保護（術を放つと解ける）
  spawnShield: 3,
  // 吸い寄せ
  magnet: { base: 42, perLevel: 2.2 },
  // 地面の魔素
  mote: { dropLife: 34, maxTotal: 3600, refill: 30, springEvery: 0.5, surgeEvery: 22, surgeCount: 22, mana: 6 },
  // レベル：必要な累計魔素 = xpBase × L^xpPow
  level: { xpBase: 11, xpPow: 1.58, max: 24 },
  // 六原理の節点：床に刻まれた六つの紋（結界の半径 × at の場所）。半径 r の中に立つと、その原理を含む術の
  // 威力が power 倍・消費が cost 倍になり、どの術者も魔力の戻りが regen 倍になる
  node: { at: 0.6, r: 150, power: 1.3, cost: 0.75, regen: 16 },
  // 要の陣：戦場の中央の陣。中に立つ間は制御容量が増え、重い術を暴発させずに扱える
  center: { r: 200, capacity: 1 },
  // Bot：流派を修めて入る割合と、入場時のレベルの下限の幅（制御容量 5〜7 の術者として入る）
  bot: { schoolShare: .8, levelMin: 3, levelMax: 9 },
  // 位階ポイント：1回の入場で得る点
  points: { perPeak: 0.2, perKill: 15, place: [[1, 80], [3, 40], [10, 15]] }
};

// ═══ 02. 六原理（旧版の接続盤と同じ） ═══════════════════════════
// 術の主原理・副原理・追加性質になる。cost は旧版の原理負荷。
DATA.principles = {
  motion:  { kanji: '動', name: '運動', ink: 'orange', cost: 5 },
  bind:    { kanji: '結', name: '結合', ink: 'blue',   cost: 6 },
  divide:  { kanji: '分', name: '分解', ink: 'teal',   cost: 7 },
  convert: { kanji: '換', name: '変換', ink: 'purple', cost: 7 },
  grow:    { kanji: '増', name: '増殖', ink: 'green',  cost: 8 },
  phase:   { kanji: '相', name: '位相', ink: 'pink',   cost: 9 }
};
DATA.principleOrder = ['motion', 'bind', 'divide', 'convert', 'grow', 'phase'];
// 詠唱：術を組み立てた部品から詠唱文を作り、足元の大魔法陣の文字として巡らせる（読み上げはしない）。
// 声に出すのは、名前を付けた術の技名だけ
DATA.chant = {
  a: { motion: '疾く奔れ', bind: '結び、固まれ', divide: '解けよ', convert: '移ろい、還れ', grow: '芽吹き、満ちよ', phase: '位相よ、揺らげ' },
  b: { motion: '風を裂き', bind: '縛りを重ね', divide: '理を割り', convert: '紋を書き換え', grow: '命を継ぎ', phase: '影を渡り', none: '' },
  behavior: { project: '', homing: '逃すな', lob: '降り注げ', sow: '種となれ', drop: '此処に在れ', orbit: '我を巡れ', relay: '三方を穿て', beam: '貫け' },
  form: { point: '', line: '', plane: '壁となれ', ring: '環となれ', field: '満ちよ' },
  deploy: { single: '', burst: '爆ぜろ', scatter: '散れ', linger: '留まれ', sprinkle: '撒け', siphon: '奪え' },
  // この秒数より長い詠唱は大魔法陣を開く
  voiceAt: 0.34
};
DATA.noPrinciple = { kanji: '－', name: 'なし', ink: 'yellow', cost: 0 };

// ═══ 03. 術式の部品（旧版の接続盤） ═══════════════════════════
// 1 主原理  2 副原理  3 広がり方  4 届き方  5 発動  6 追加機能  7 糸  8 追加性質  ＋ 強弱・見た目・名前
// 術式 ＝ { a, b, form, behavior, trigger, deploy, link, extras[], power, duration, rate, matter, visualShape, customName }
// matter（質）と visualShape（形）は部品に数えない。質を省くと、結を含む術は固体・ほかはエネルギー（周回はエネルギー）になる
// 消費・詠唱・部品数・暴発の式は旧版と同じ（sim.js の 06）。乱戦の速さに合わせて costScale / windScale を掛ける
DATA.forms = {
  point: { name: '小さな弾', suffix: '針', cost: 2, radius: 38,  power: 1.35, control: .55, terrain: .25, wind: .55 },
  line:  { name: '細い波',   suffix: '脈', cost: 4, radius: 58,  power: 1.15, control: .70, terrain: .35, wind: .75 },
  plane: { name: '壁',       suffix: '壁', cost: 7, radius: 96,  power: .80,  control: 1.05, terrain: 1.05, wind: 1.05 },
  ring:  { name: '周囲',     suffix: '環', cost: 8, radius: 148, power: .80,  control: 1.20, terrain: .85, wind: 1.15 },
  field: { name: '広い場',   suffix: '域', cost: 11, radius: 226, power: .65, control: 1.10, terrain: 1.35, wind: 1.45 }
};
DATA.formOrder = ['point', 'line', 'plane', 'ring', 'field'];
// 届き方。range / speed は乱戦の広さに合わせてある
// falloff：1000 進むごとに失う威力の割合（③ 散逸。放った術は離れるほど散る）。hitMul は命中の倍率
DATA.behaviors = {
  project: { name: '射出',     glyph: '→', cost: 3,  wind: .8,   range: 780, speed: 820, falloff: .45, note: '直進。岩や結界に阻まれる。遠くほど威力が散る' },
  homing:  { name: '追尾',     glyph: '◠', cost: 7,  wind: 1.05, range: 950, speed: 470, falloff: .35, note: '違う紋の大きな魔力へ曲がる。糸を維持すると照準へ誘導できる' },
  lob:     { name: '投射',     glyph: '⌒', cost: 5,  wind: 1.0,  range: 560, speed: 560, falloff: 0,   note: '放物線で結界や岩を飛び越える。着地点が予告される' },
  sow:     { name: '播種',     glyph: '✦', cost: 4,  wind: .9,   range: 420, speed: 480, falloff: 0,   note: '足元近くへ種を撒く。転がって止まり、罠になる' },
  drop:    { name: '自位置',   glyph: '⊙', cost: 3,  wind: .85,  range: 0,   speed: 0,   falloff: 0,   note: '今いる場所に設置する' },
  orbit:   { name: '周回',     glyph: '↻', cost: 7,  wind: 1.0,  range: 0,   speed: 0,   falloff: 0,   note: '術者に追従する。起動は常時。単一原理なら強化術。固体にすると刃が周りを回る' },
  relay:   { name: '扇射',     glyph: '⌁', cost: 9,  wind: 1.3,  range: 640, speed: 780, falloff: .55, note: '三方へ撃ち分ける。散りやすい' },
  beam:    { name: '貫通光線', glyph: '⚡', cost: 18, wind: 1.55, range: 950, speed: 0,   falloff: .06, hitMul: 2.6, note: '敵を貫く高出力の光線。遠くでもほとんど衰えない。設置壁で止まる。壁を壊した一撃も奥には届かない' }
};
DATA.behaviorOrder = ['project', 'homing', 'lob', 'sow', 'drop', 'orbit', 'relay', 'beam'];
DATA.triggers = {
  contact:   { name: '接触', glyph: '◆', cost: 0, note: '命中・接触で起動' },
  fuse:      { name: '時限', glyph: '◷', cost: 2, note: '殻が散逸して割れた瞬間に起動（射出は狙点で炸裂）' },
  proximity: { name: '感知', glyph: '◎', cost: 3, note: '違う紋が範囲に入ると起動。止まった術式は罠になる' },
  command:   { name: '指示', glyph: '✱', cost: 3, note: '糸を通した合図で起動（F）。糸は自動で維持になる' }
};
DATA.triggerOrder = ['contact', 'fuse', 'proximity', 'command'];
DATA.deploys = {
  single:   { name: '単発', glyph: '·', cost: 0, note: '広がり方どおりに一度作用する' },
  burst:    { name: '炸裂', glyph: '✸', cost: 3, note: '範囲を広げ、一瞬で炸裂する' },
  scatter:  { name: '分裂', glyph: '❋', cost: 5, note: '追尾する小片に分かれる' },
  linger:   { name: '残留', glyph: '◌', cost: 5, note: '領域が長く残り続ける' },
  sprinkle: { name: '散魔', glyph: '∴', cost: 2, note: '攻撃せず、負荷の約8割を魔力の粒として撒く。誰でも拾え、追尾の囮になる' },
  siphon:   { name: '吸魔', glyph: '⊛', cost: 5, note: '領域内の敵の魔力と魔素を奪い、周りの魔素を術者へ引く。威力は半減' }
};
DATA.deployOrder = ['single', 'burst', 'scatter', 'linger', 'sprinkle', 'siphon'];
DATA.links = {
  cut:  { name: '切断', glyph: '✂', cost: 0, note: '放った瞬間に糸を切る。維持費なし。術式どおりにしか動かない' },
  hold: { name: '維持', glyph: '∿', cost: 3, note: '糸でつながり続ける。維持費がかかるが、誘導・指示起爆（F）・延命・回収（G）ができる' }
};
DATA.extraEffects = {
  motion:  { note: '命中時に吹き飛ばしを追加' },
  bind:    { note: '命中時に鈍化。2つ重ねると短く拘束' },
  divide:  { note: '結界・殻を剥がし、威力+8%' },
  convert: { note: '命中時に相手の魔力を奪う' },
  grow:    { note: '命中時に追尾小片を生む' },
  phase:   { note: '結界・硬化による減衰を受けにくい' }
};
// 質：魔力を固体（結晶）にして放つか、エネルギー（光と熱）のまま放つか。
// 相性（じゃんけん）：エネルギーは固体の結界を貫き、固体はエネルギーの結界を剥がす。同じ質どうしは止まる
DATA.matters = {
  energy: { name: 'エネルギー', kanji: '光', speed: 1.08, fall: 1.3, cost: 1,   knock: 0,   note: '光と熱のまま放つ。速いが遠くで散りやすい。設置壁には止められる。領域型の結界には質の相性がある' },
  solid:  { name: '固体',       kanji: '晶', speed: .86,  fall: .6,  cost: 1.1, knock: 120, note: '結晶に固めて放つ。遅いが重く、威力が落ちにくい。エネルギーの結界を剥がし、固体の結界には止められる。固体の結界はとても硬い' },
  // 完全：固体とエネルギーを重ねた結界。どちらの質も通さず、光線でも砕けない（位相をずらす術と解体領域だけが抜ける）。
  // 引き換えに消費は数倍、張っている間は魔力が戻らず減り続け、足が重く、術を唱えると解ける。結界・周回の術にだけ使える
  perfect: { name: '完全',      kanji: '全', speed: 1,    fall: 1,   cost: 3.4, knock: 0,   note: '固体とエネルギーを重ねた完全な結界。何も通さない。ただし消費が非常に重く、張っている間は魔力が減り続け、足が重く、術を唱えると解ける（結界・周回だけ）' }
};
DATA.matterOrder = ['energy', 'solid', 'perfect'];
// 形：飛ぶ術式と周回の刃の形。
// speed 速さ・size 当たり判定の大きさ・dmg 威力・fall 遠くでの衰え・pierce 斬り抜ける人数・bounce 跳ね返る回数・range 射程
// ward 結界への威力（貫通力。砕ききれば止まらず抜ける）・knock 押し込み・returns 戻ってくる・cost 形作る負荷
// orbit：周回させたときの本数・大きさ・回る速さ・硬さ・斬る威力の倍率
const SH = o => ({ speed: 1, size: 1, dmg: 1, fall: 1, pierce: 0, bounce: 0, range: 1, ward: 1, knock: 0, returns: false, cost: 0, ...o, orbit: { count: 1, size: 1, spin: 1, hp: 1, mul: 1, ...(o.orbit || {}) } });
DATA.shapes = {
  needle:   SH({ name: '針',     speed: 1.1,  size: .8,   dmg: .95, fall: .9, ward: .8, note: '細く速い。当たりは小さい' }),
  orb:      SH({ name: '球',     speed: .95,  size: 1.25, fall: 1.1, note: '大きく当たりやすいが、少し遅い' }),
  shard:    SH({ name: '結晶',   dmg: 1.04, ward: 1.2, note: '尖った結晶。結界に少し強い' }),
  arrow:    SH({ name: '矢',     speed: 1.4,  size: .6,   dmg: .9, fall: .5, range: 1.35, ward: 1.1, cost: 1, note: '細く最も速い矢。当たりはとても小さいが、遠くまで届く' }),
  blade:    SH({ name: '刀',     speed: .9,   size: 1.55, dmg: 1.14, fall: 1.25, range: .85, ward: 1.1, cost: 2, note: '幅の広い直刀。当たりが大きく重いが、遠くでは鈍る' }),
  katana:   SH({ name: '日本刀', speed: 1.02, size: 1.3,  dmg: 1.08, fall: 1.05, pierce: 1, range: .95, ward: 1.3, cost: 3, note: '反りのある刃。一人を斬り抜けて、後ろの相手にも届く' }),
  scythe:   SH({ name: '大鎌',   speed: .85,  size: 2.1,  fall: 1.2, pierce: 2, range: .7, ward: .8, cost: 4, orbit: { size: 1.3, spin: .8, mul: 1.3 }, note: '弧を描く大きな刃。当たりが最も広く、三人まで薙ぎ払うが、射程が短い' }),
  axe:      SH({ name: '斧',     speed: .8,   size: 1.4,  dmg: 1.3, fall: 1.3, range: .75, ward: 2.5, knock: 200, cost: 3, note: '重い斧。遅いが一撃が重く、結界を叩き割る' }),
  hammer:   SH({ name: '槌',     speed: .75,  size: 1.5,  dmg: 1.2, fall: 1.2, range: .75, ward: 3, knock: 340, cost: 4, note: '巨大な槌。結界に最も強く、当たった相手を大きく吹き飛ばす' }),
  shuriken: SH({ name: '手裏剣', speed: 1.2,  size: .9,   dmg: .86, fall: .75, bounce: 2, range: 1.05, cost: 2, note: '回る四方の刃。岩や結界に当たると二度まで跳ね返る' }),
  chakram:  SH({ name: '円月輪', speed: 1.1,  size: 1.1,  dmg: .92, returns: true, cost: 3, note: '回る輪。遠くまで飛ぶと手元へ戻ってきて、帰りにも当たる' }),
  spear:    SH({ name: '槍',     speed: 1.3,  size: .8,   dmg: 1.1, fall: .45, range: 1.25, ward: 1.8, cost: 3, note: '長い穂先。最も衰えず、結界を突き通す力が強い' }),
  castle:   SH({ name: '城',     speed: .6,   size: 2.0,  dmg: .8, range: .7, ward: 2, cost: 5, orbit: { count: 2.4, size: 2.2, spin: .1, hp: 3.2, mul: .25 }, note: '石の城壁。飛ばすと遅く重い塊。周回させると、ほとんど回らない城壁が自分を囲む' })
};
DATA.shapeOrder = ['needle', 'orb', 'shard', 'arrow', 'blade', 'katana', 'scythe', 'axe', 'hammer', 'shuriken', 'chakram', 'spear', 'castle'];
// 保存された術の見た目のキー（visualShape）。auto は広がり方から決める
// 術の名前の組み立て方：基の名（現象）＋ join ＋ 形の字。光線は beam の {0} に基の名（末尾の beamStrip を外す）。追加性質は extraSep の後に字を並べる
DATA.naming = {
  join: '', extraSep: '・', beam: '{0}貫通光線', beamStrip: '刃',
  shapeSuffix: { needle: '針', orb: '弾', shard: '刃', arrow: '矢', blade: '刀', katana: '太刀', scythe: '鎌', axe: '斧', hammer: '槌', shuriken: '星', chakram: '輪', spear: '槍', castle: '城' }
};
DATA.visualShapes = { auto: '自動' };
for (const k of DATA.shapeOrder) DATA.visualShapes[k] = DATA.shapes[k].name;
// 世界の決まり（旧版 WORLD と同じ意味。乱戦用に一部を調整）
DATA.RULES = {
  link: { range: 900, upkeepBase: 0.55, upkeepScale: 0.018, upkeepMul: 2.6, decayMul: 0.35, guideTurn: 4.6, severedLife: 1.4 },
  recall: { refund: 0.6 },
  complexity: { freeParts: 4, perPart: .09, exponent: 1.35, windPerPart: .05, maxWind: 2.4 },
  // 純度：部品が少ない単調な術ほど燃費が良く威力が高い。部品が多い複雑な術ほど威力が落ちる
  // 威力倍率 = 基準部品数以下なら 1 + bonus × 不足分、超えたら 1 − penalty × 超過分（下限 min）。消費は不足分 × costCut だけ安い
  purity: { base: 4, bonus: .1, penalty: .06, min: .65, costCut: .07 },
  // 術どうしの干渉：強い方が弱い方に削られる割合（固体の衝突・エネルギーの相殺）
  // melt：エネルギーが固体を貫くとき、固体が熱で削れる割合（エネルギーの威力に対して）
  // fusion：自分のエネルギーどうしが融合するとき取り込む割合。enchant：自分の固体にエネルギーが宿るとき上乗せする割合
  interfere: { solidLoss: .6, energyLoss: 1, melt: .5, fusion: .9, enchant: .8 },
  // 共鳴：自分の紋の場を通った術の威力の倍率。誘爆：起動した術が自分の罠を連鎖させる距離（× 広がり）
  resonance: 1.3, chainReach: 1.1,
  // 戻る術（円月輪）が手元へ戻ったとき、消費のうち戻る魔力の割合
  returnRefund: .5,
  // 時限の殻が割れるまでの秒数（× 時限・持続）
  fuse: .8,
  // 残留の場：0.5秒ごとの作用の倍率と、中の相手を鈍らせる割合
  linger: { tick: .55, slow: .3 },
  // 吸魔：威力の倍率、0.5秒ごとに奪う魔力と魔素
  siphon: { dmg: .8, mp: 9, mass: 1.6 },
  // 散魔：負荷のうち魔力の粒として撒く割合
  sprinkle: 1,
  // 拘束の秒数（× 時限・持続）：慣性拘束・根絡・位相牢。毒の毎秒の威力（× 命中の威力）
  bind: { tether: 1.0, root: 1.9, prison: 2.3 },
  poisonDps: .26,
  // 遠くでの衰え：届き方の falloff × 質 × 形。下限 min
  falloff: { per: 1000, min: .35 },
  // 質の相性。pierceWard：エネルギーが固体の結界を貫くとき結界に与える割合、pierceKeep：貫いた後に残る威力
  // strip：固体がエネルギーの結界を剥がすときの倍率。beamSolid / beamWard：光線が固体 / エネルギーの結界に与える倍率
  // breakKeep：形の貫通力で結界を砕ききったとき、抜けた先に残る威力
  clash: { pierceWard: .4, pierceKeep: .6, strip: 4, beamSolid: 1, beamWard: 2.2, breakKeep: .7 },
  // 固体の結界の硬さの倍率。面の結界（壁・環の城壁）の硬さの倍率（1枚でこれだけ硬い）
  solidWardHp: 1.8, slabHp: 3.2,
  // 完全の結界：張っている間に減る魔力（毎秒）と、足の重さ
  perfect: { drain: 9, slow: .45 },
  // 周回の刃（固体の周回）：広がり方ごとの本数と回る半径、持続・回る速さ・硬さ・同じ相手を斬る間隔・威力の倍率
  orbiter: { count: { point: 2, line: 3, plane: 4, ring: 5, field: 6 }, radius: { point: 34, line: 42, plane: 52, ring: 64, field: 82 }, life: 6, spin: 3.2, hp: 22, hitCd: .45, mul: .7 },
  // 結界（領域型）の硬さ = (base + 制圧力 × perControl) × 強弱
  barrierHp: { base: 40, perControl: .8 },
  // 制御容量：旧版は職業ごと（巫女4・前衛5・術者7・観測9）。乱戦ではレベルで育つ
  capacity: [[0, 4], [3, 5], [7, 7], [12, 9]],
  misfire: { perOverPart: .16, max: .8, selfDamage: .45 },
  maxExtras: 4,
  decoy: { life: 3.6, weight: 70 },
  power: [0.7, 1.6], duration: [0.6, 2], rate: [1, 3], velocity: [0.5, 2], velocityCost: 0.35,
  // 乱戦は旧版より速い：詠唱をこの倍率で縮める。消費は旧版よりやや重い
  costScale: 0.95, windScale: 0.62, rapidGap: 0.12
};
// 原理の組み合わせ表（旧版そのまま）。キーは a と b をアルファベット順に '|' で結ぶ。単一原理は '<a>|none'
DATA.pairData = {
    // ── 単一原理（純放出）。部品が少ないぶん安く速い ──
    'motion|none':   { base: '魔弾',     type: 'bolt',    desc: '自分の紋の魔力をそのまま押し出す純放出。安く速いが副作用はない。', tags: ['純放出', '低燃費', '速射'], power: 60, control: 18, terrain: 10 },
    'bind|none':     { base: '固化',     type: 'solid',   desc: '魔力を高密度に固めて障壁を作る。糸を維持すれば回収（G）で魔力の一部が戻る。', tags: ['固化', '障壁', '回収可'], power: 16, control: 70, terrain: 90 },
    'divide|none':   { base: '分解',     type: 'sunder',  desc: '違う紋の構造をほどく。結界・反力を剥がし、術式で作られた壁を崩す。', tags: ['剥離', '構造破壊', '対結界'], power: 70, control: 22, terrain: 40 },
    'convert|none':  { base: '吸奪',     type: 'drain',   desc: '触れた相手の魔力の紋を書き換え、自分の魔素として奪う。', tags: ['魔素奪取', '継戦', '低威力'], power: 28, control: 40, terrain: 8 },
    'grow|none':     { base: '修復',     type: 'mend',    desc: '自分の紋の魔力で崩れた構造を埋め直す。味方には紋の変換ロスが出る。', tags: ['回復', '味方支援', '変換ロス'], power: 20, control: 30, terrain: 20 },
    'phase|none':    { base: '位相化',   type: 'veil',    desc: '自分の位相を一瞬ずらし、放った直後の攻撃をすり抜ける。', tags: ['回避', '無敵時間', '低威力'], power: 18, control: 50, terrain: 5 },
    // ── 二原理 ──
    'bind|motion':   { base: '慣性拘束', type: 'tether',  desc: '移動しようとする力を結び、中心へ引き戻し続ける。', tags: ['拘束', '引き戻し', '地形係留'], power: 42, control: 88, terrain: 64 },
    'divide|grow':   { base: '腐蝕胞子', type: 'poison',  desc: '分解作用が自己増殖し、接触面を侵す毒性領域へ変わる。', tags: ['毒', '持続侵蝕', '拡散'], power: 68, control: 54, terrain: 82 },
    'bind|grow':     { base: '根絡',     type: 'root',    desc: '結合が地中へ増殖し、足場から対象を縫い止める。', tags: ['足止め', '根壁', '地形生成'], power: 28, control: 96, terrain: 91 },
    'motion|motion': { base: '共振衝撃', type: 'shock',   desc: '二重の運動を同調させ、接触点から衝撃を円状に解放する。', tags: ['衝撃波', '吹き飛ばし', '破砕'], power: 91, control: 45, terrain: 58 },
    'convert|grow':  { base: '生体転写', type: 'bloom',   desc: '奪った魔素を増殖可能な構造へ変え、回復場として定着させる。', tags: ['吸収', '再生', '領域維持'], power: 30, control: 40, terrain: 72 },
    'bind|phase':    { base: '位相牢',   type: 'prison',  desc: '対象の位相を空間へ結合し、境界を越える動きを封じる。', tags: ['隔離', '境界封鎖', '防御'], power: 36, control: 94, terrain: 74 },
    'divide|phase':  { base: '虚蝕',     type: 'void',    desc: '物質の位相境界だけを分解し、防壁を無視して侵入する。', tags: ['貫通', '防壁無視', '高負荷'], power: 74, control: 22, terrain: 12 },
    'motion|phase':  { base: '転位穿孔', type: 'blink',   desc: '運動の到達点へ位相を先行させ、術式と術者を跳躍させる。', tags: ['転移', '貫通', '奇襲'], power: 66, control: 35, terrain: 18 },
    'convert|divide':{ base: '崩壊変換', type: 'corrode', desc: '分解した構造を不安定な魔素へ変換し、地形ごと崩す。', tags: ['腐食', '地形破壊', '魔素回収'], power: 76, control: 48, terrain: 88 },
    'convert|motion':{ base: '反力変換', type: 'counter', desc: '受けた運動を魔素へ変換し、逆方向へ放出する。', tags: ['反射', '吸収', '反撃'], power: 62, control: 66, terrain: 24 },
    'grow|motion':   { base: '連鎖波',   type: 'cascade', desc: '運動が伝播するたび次の波を増殖させ、複数地点へ連鎖する。', tags: ['連鎖', '波及', '面制圧'], power: 71, control: 61, terrain: 56 },
    'bind|convert':  { base: '物性編壁', type: 'wall',    desc: '周囲の地形を結合し直し、性質を変えた障壁を組み上げる。', tags: ['防壁', '地形利用', '変質'], power: 18, control: 82, terrain: 98 },
    'divide|motion': { base: '断裂刃',   type: 'rend',    desc: '運動の軌跡そのものを分解し、通過線上を切り裂く。', tags: ['切断', '直線', '装甲貫通'], power: 84, control: 38, terrain: 30 },
    'grow|phase':    { base: '重層鏡界', type: 'mirror',  desc: '位相を増殖させ、術者の像を複数展開して攻撃を分散させる。', tags: ['分身', '回避', '撹乱'], power: 34, control: 72, terrain: 40 },
    'bind|bind':     { base: '重縛結界', type: 'bulwark', desc: '結合を二重に閉じ、味方を包む減衰結界を編む。', tags: ['防御', '味方支援', '減衰'], power: 12, control: 90, terrain: 55 },
    'convert|phase': { base: '位相転換', type: 'shift',   desc: '受けた術式の位相を書き換え、術者の魔素へ戻す。', tags: ['魔素回収', '無効化', '再構成'], power: 40, control: 76, terrain: 20 },
    'grow|grow':     { base: '増殖苗床', type: 'swarm',   desc: '増殖が増殖を呼び、自走する小片が対象を追尾する。', tags: ['追尾', '数的圧', '持続'], power: 54, control: 58, terrain: 66 },
    'phase|phase':   { base: '相干観測', type: 'scan',    desc: '位相を重ね合わせ、触れた対象の構造値（耐久・魔素）を読み取る。', tags: ['観測', '情報', '低威力'], power: 14, control: 30, terrain: 6 },
    'convert|convert':{ base: '魔素収束', type: 'well',   desc: '変換を重ねて魔素の流れを一点へ束ね、周囲の魔素を引き寄せる井戸を作る。', tags: ['魔素集束', '回復効率', '設置'], power: 6, control: 40, terrain: 30 },
    'bind|divide':   { base: '掘削塹壕', type: 'trench',  desc: '結合を裂いて地面を掘り下げ、身を隠せる溝を組み上げる。射線を切る。', tags: ['遮蔽', '地形生成', '防御'], power: 14, control: 60, terrain: 96 },
    'divide|divide': { base: '解体領域', type: 'unmake',  desc: '結合という結合を解く。地形も術式も等しく解ける。', tags: ['術式解除', '地形破壊', '高負荷'], power: 70, control: 44, terrain: 94 }
  };

// 最初に持っている4つの術（旧版の初期術式と同じ顔ぶれ。はじめの制御容量4に収まるよう、炸裂・時限を外してある）
DATA.defaultSpells = [
  { a: 'motion', b: 'none',    form: 'point', behavior: 'project', trigger: 'contact', deploy: 'single' },
  { a: 'divide', b: 'motion',  form: 'point', behavior: 'homing',  trigger: 'contact', deploy: 'single' },
  { a: 'motion', b: 'motion',  form: 'ring',  behavior: 'lob',     trigger: 'contact', deploy: 'single' },
  { a: 'bind',   b: 'convert', form: 'plane', behavior: 'drop',    trigger: 'contact', deploy: 'single' }
];
// 作例（旧版の作例と同じ顔ぶれ＋乱戦向け）
DATA.presets = {
  bolt:    { label: '純放出（1部品）',  r: { a: 'motion', b: 'none', form: 'point', behavior: 'project', trigger: 'contact', deploy: 'single' } },
  shock:   { label: '共振衝撃針',       r: { a: 'motion', b: 'motion', form: 'point', behavior: 'project', trigger: 'contact', deploy: 'single' } },
  guided:  { label: '糸で誘導',         r: { a: 'divide', b: 'motion', form: 'point', behavior: 'homing', trigger: 'contact', deploy: 'single', link: 'hold' } },
  beam:    { label: '貫通光線',         r: { a: 'divide', b: 'motion', form: 'line', behavior: 'beam', trigger: 'contact', deploy: 'single' } },
  remote:  { label: '遠隔起爆',         r: { a: 'motion', b: 'motion', form: 'ring', behavior: 'sow', trigger: 'command', deploy: 'burst', link: 'hold' } },
  solid:   { label: '固化盾（回収可）', r: { a: 'bind', b: 'none', form: 'plane', behavior: 'drop', trigger: 'contact', deploy: 'single', link: 'hold' } },
  wall:    { label: '物性編壁',         r: { a: 'bind', b: 'convert', form: 'plane', behavior: 'lob', trigger: 'contact', deploy: 'single' } },
  barrier: { label: '魔力バリア',       r: { a: 'bind', b: 'bind', form: 'ring', behavior: 'orbit', trigger: 'contact', deploy: 'linger', matter: 'energy' } },
  blades:  { label: '周回刃（固体）',   r: { a: 'divide', b: 'motion', form: 'ring', behavior: 'orbit', trigger: 'contact', deploy: 'single', matter: 'solid', visualShape: 'katana' } },
  spear:   { label: '晶槍（固体）',     r: { a: 'motion', b: 'none', form: 'point', behavior: 'project', trigger: 'contact', deploy: 'single', matter: 'solid', visualShape: 'spear' } },
  shuriken:{ label: '手裏剣（固体）',   r: { a: 'motion', b: 'motion', form: 'point', behavior: 'project', trigger: 'contact', deploy: 'single', matter: 'solid', visualShape: 'shuriken' } },
  katana:  { label: '斬光（日本刀）',   r: { a: 'divide', b: 'motion', form: 'point', behavior: 'project', trigger: 'contact', deploy: 'single', matter: 'energy', visualShape: 'katana' } },
  axe:     { label: '破城斧（固体）',   r: { a: 'motion', b: 'motion', form: 'point', behavior: 'project', trigger: 'contact', deploy: 'single', matter: 'solid', visualShape: 'axe' } },
  chakram: { label: '円月輪（固体）',   r: { a: 'divide', b: 'none', form: 'point', behavior: 'project', trigger: 'contact', deploy: 'single', matter: 'solid', visualShape: 'chakram' } },
  arrow:   { label: '光矢（三連）',     r: { a: 'motion', b: 'none', form: 'point', behavior: 'project', trigger: 'contact', deploy: 'single', matter: 'energy', visualShape: 'arrow', rate: 3 } },
  bastion: { label: '石壁（面の固体結界）', r: { a: 'bind', b: 'none', form: 'plane', behavior: 'lob', trigger: 'contact', deploy: 'single', matter: 'solid' } },
  castle:  { label: '城塞（周回の城壁）', r: { a: 'bind', b: 'convert', form: 'ring', behavior: 'orbit', trigger: 'contact', deploy: 'single', matter: 'solid', visualShape: 'castle' } },
  aegis:   { label: '完全結界',         r: { a: 'bind', b: 'bind', form: 'ring', behavior: 'orbit', trigger: 'contact', deploy: 'single', matter: 'perfect' } },
  reflect: { label: '反射',             r: { a: 'convert', b: 'motion', form: 'ring', behavior: 'orbit', trigger: 'contact', deploy: 'linger' } },
  shift:   { label: '無効化',           r: { a: 'convert', b: 'phase', form: 'ring', behavior: 'orbit', trigger: 'contact', deploy: 'linger' } },
  poison:  { label: '腐蝕の罠',         r: { a: 'divide', b: 'grow', form: 'ring', behavior: 'sow', trigger: 'proximity', deploy: 'linger' } },
  blink:   { label: '転位穿孔',         r: { a: 'motion', b: 'phase', form: 'point', behavior: 'project', trigger: 'contact', deploy: 'single' } },
  well:    { label: '魔素収束',         r: { a: 'convert', b: 'convert', form: 'ring', behavior: 'lob', trigger: 'contact', deploy: 'single' } },
  mend:    { label: '自己修復',         r: { a: 'grow', b: 'none', form: 'ring', behavior: 'drop', trigger: 'contact', deploy: 'linger' } },
  haste:   { label: '加速（強化術）',   r: { a: 'motion', b: 'none', form: 'field', behavior: 'orbit', trigger: 'contact', deploy: 'single' } },
  harden:  { label: '硬化（強化術）',   r: { a: 'bind', b: 'none', form: 'ring', behavior: 'orbit', trigger: 'contact', deploy: 'single' } },
  vital:   { label: '活性（強化術）',   r: { a: 'grow', b: 'none', form: 'field', behavior: 'orbit', trigger: 'contact', deploy: 'single' } },
  heavy:   { label: '9部品の重術式',    r: { a: 'divide', b: 'motion', form: 'point', behavior: 'homing', trigger: 'proximity', deploy: 'scatter', link: 'hold', extras: ['bind', 'convert', 'divide'] } }
};
DATA.presetOrder = ['bolt', 'arrow', 'spear', 'shuriken', 'chakram', 'katana', 'axe', 'shock', 'guided', 'beam', 'remote', 'solid', 'bastion', 'wall', 'barrier', 'blades', 'castle', 'aegis', 'reflect', 'shift', 'poison', 'blink', 'well', 'mend', 'haste', 'harden', 'vital', 'heavy'];
// 達人の流派：Bot はどれか一つの流派を修め、名を付けた術を叫んで使い分ける（遊ぶ人へのお手本）。
// keep は相手との間合い。術は 4 つ。術式台の「達人の術」からも読み込める
const M = (customName, r) => ({ customName, ...r });
DATA.schools = [
  { key: 'archer', name: '光芒の射手', keep: 560, spells: [
    M('流星', { a: 'motion', b: 'none', form: 'point', behavior: 'project', matter: 'energy', visualShape: 'arrow', rate: 3 }),
    M('天穿', { a: 'divide', b: 'motion', behavior: 'beam', power: 1.3 }),
    M('砦', { a: 'bind', b: 'none', form: 'plane', behavior: 'lob', matter: 'solid' }),
    M('疾風', { a: 'motion', b: 'none', form: 'field', behavior: 'orbit' })
  ] },
  { key: 'blade', name: '剣聖', keep: 260, spells: [
    M('朧斬', { a: 'divide', b: 'motion', form: 'point', behavior: 'project', matter: 'energy', visualShape: 'katana', rate: 2 }),
    M('八重桜', { a: 'divide', b: 'motion', form: 'ring', behavior: 'orbit', matter: 'solid', visualShape: 'katana' }),
    M('縮地', { a: 'motion', b: 'phase', form: 'point', behavior: 'project' }),
    M('大鎌・宵薙ぎ', { a: 'divide', b: 'motion', form: 'point', behavior: 'project', matter: 'solid', visualShape: 'scythe' })
  ] },
  { key: 'fortress', name: '城塞の主', keep: 300, spells: [
    M('破城', { a: 'motion', b: 'motion', form: 'point', behavior: 'project', matter: 'solid', visualShape: 'axe' }),
    M('金城', { a: 'bind', b: 'convert', form: 'ring', behavior: 'orbit', matter: 'solid', visualShape: 'castle' }),
    M('絶界', { a: 'bind', b: 'bind', form: 'ring', behavior: 'orbit', matter: 'perfect' }),
    M('地鳴り', { a: 'motion', b: 'motion', form: 'ring', behavior: 'lob', deploy: 'burst', matter: 'solid', visualShape: 'hammer' })
  ] },
  { key: 'curse', name: '呪術師', keep: 380, spells: [
    M('瘴気の種', { a: 'divide', b: 'grow', form: 'ring', behavior: 'sow', trigger: 'proximity', deploy: 'linger' }),
    M('縛鎖', { a: 'bind', b: 'grow', form: 'ring', behavior: 'lob' }),
    M('魂喰らい', { a: 'convert', b: 'none', form: 'point', behavior: 'homing', rate: 2 }),
    M('虚ろ穿ち', { a: 'divide', b: 'phase', form: 'point', behavior: 'project', visualShape: 'spear' })
  ] },
  { key: 'bomber', name: '爆破師', keep: 330, spells: [
    M('爆縛陣', { a: 'motion', b: 'motion', form: 'ring', behavior: 'sow', trigger: 'command', deploy: 'burst', link: 'hold' }),
    M('崩天', { a: 'motion', b: 'motion', form: 'ring', behavior: 'lob', deploy: 'burst' }),
    M('散華', { a: 'motion', b: 'motion', form: 'point', behavior: 'project', trigger: 'fuse', deploy: 'scatter', visualShape: 'shuriken' }),
    M('反転', { a: 'convert', b: 'motion', form: 'ring', behavior: 'orbit', deploy: 'linger' })
  ] },
  { key: 'swarm', name: '群れ使い', keep: 420, spells: [
    M('千本桜', { a: 'grow', b: 'grow', form: 'point', behavior: 'homing', deploy: 'scatter' }),
    M('三叉雷', { a: 'grow', b: 'motion', form: 'point', behavior: 'relay', rate: 2 }),
    M('奪魂域', { a: 'convert', b: 'divide', form: 'ring', behavior: 'lob', deploy: 'siphon' }),
    M('再生', { a: 'grow', b: 'none', form: 'ring', behavior: 'drop', deploy: 'linger' })
  ] },
  { key: 'storm', name: '雷帝', keep: 470, spells: [
    M('雷槍', { a: 'motion', b: 'none', form: 'point', behavior: 'project', matter: 'energy', visualShape: 'spear', rate: 2 }),
    M('天雷', { a: 'grow', b: 'motion', form: 'line', behavior: 'beam', power: 1.2 }),
    M('雷鳴環', { a: 'grow', b: 'motion', form: 'ring', behavior: 'lob', deploy: 'linger' }),
    M('魔素収束', { a: 'convert', b: 'convert', form: 'ring', behavior: 'lob' })
  ] },
  { key: 'mirror', name: '鏡の魔女', keep: 400, spells: [
    M('月輪', { a: 'divide', b: 'none', form: 'point', behavior: 'project', matter: 'solid', visualShape: 'chakram' }),
    M('鏡花', { a: 'grow', b: 'phase', form: 'ring', behavior: 'drop' }),
    M('水鏡', { a: 'convert', b: 'phase', form: 'ring', behavior: 'orbit', deploy: 'linger' }),
    M('慣性の鎖', { a: 'bind', b: 'motion', form: 'point', behavior: 'homing' })
  ] }
];
// Botの持ち術（旧来の組。流派を持たない Bot が使う。はじめの容量4に収まる術を中心にしてある）
DATA.botLoadouts = [
  ['bolt', 'guided', 'wall', 'beam'],
  ['spear', 'blink', 'harden', 'mend'],
  ['bolt', 'poison', 'blades', 'guided'],
  ['shock', 'well', 'solid', 'beam'],
  ['shuriken', 'reflect', 'wall', 'haste'],
  ['katana', 'guided', 'barrier', 'vital'],
  ['spear', 'beam', 'barrier', 'blades'],
  ['axe', 'chakram', 'bastion', 'guided'],
  ['arrow', 'beam', 'castle', 'mend']
];

// ═══ 04. 光の色（術者・魔素・原理の色） ═══════════════════════
// 暗い儀式場の上で光る。キー名は保存データに使うので変えない
DATA.floor = '#060508';   // 石畳の闇
DATA.bone = '#ece6d8';    // 文字・陣の線
DATA.inks = {
  pink:   { name: '薔薇', hex: '#ff5fa2' },
  blue:   { name: '蒼',   hex: '#5aa9ff' },
  yellow: { name: '金',   hex: '#ffd36a' },
  green:  { name: '若葉', hex: '#8fe36a' },
  orange: { name: '焔',   hex: '#ff8a3d' },
  purple: { name: '紫',   hex: '#b784ff' },
  teal:   { name: '翠',   hex: '#3fe0c5' },
  red:    { name: '紅',   hex: '#ff5a5a' }
};
DATA.inkOrder = ['pink', 'blue', 'yellow', 'green', 'orange', 'purple', 'teal', 'red'];

// ═══ 05. 紋（術者ごとの印） ═══════════════════════════════════
// 形は game.js の drawCrest() が描く
DATA.crests = {
  ring:    '丸',
  bar:     '丸に一',
  cross:   '十字',
  lozenge: '菱',
  igeta:   '井桁',
  scale:   '鱗',
  stars:   '三つ星',
  wheel:   '輪違い'
};
DATA.crestOrder = ['ring', 'bar', 'cross', 'lozenge', 'igeta', 'scale', 'stars', 'wheel'];

// ═══ 06. ルーム ════════════════════════════════════════════════
// いまは全員その端末の中で演算する（参加者はBot）。オンライン化は docs/ONLINE_RELEASE.md。
DATA.rooms = {
  ichi: { name: '一の間',   note: '標準の広さ。はじめての入場に', R: 2500, bots: 21, motes: 1600, springs: 4, rocks: 10 },
  sema: { name: '狭間',     note: '狭く、すぐに撃ち合いになる',   R: 1600, bots: 11, motes: 720, springs: 2, rocks: 6 },
  oo:   { name: '大広間',   note: '広い。大きく育つまで逃げ切れ', R: 3500, bots: 35, motes: 2900, springs: 6, rocks: 16 },
  // 修練場：人形を相手に術を試す。記録は残らない。T で術式台を開いて組み替えられる
  dojo: { name: '修練場',   note: '人形を相手に、作った術を試す。記録は残らない', R: 1100, bots: 0, motes: 0, springs: 0, rocks: 3, practice: true }
};
DATA.roomOrder = ['ichi', 'sema', 'oo'];
// 修練場の人形：止まる・左右に歩く・結界を張る（物性編壁で射線を切ってくる）
DATA.dummies = [
  { name: '人形・止', kind: 'still', ink: 'yellow', x: 420, y: -160, mass: 300 },
  { name: '人形・歩', kind: 'walk', ink: 'teal', x: 520, y: 140, mass: 150 },
  { name: '人形・壁', kind: 'guard', ink: 'blue', x: 760, y: -20, mass: 500, spells: ['wall', 'wall', 'wall', 'wall'] },
  // 攻撃する人形（修練場の「攻撃人形」を入れたときだけ撃つ）。耐久と結界の試験に。every 秒ごとに持ち術を順に放つ
  { name: '人形・射', kind: 'shooter', ink: 'orange', x: -560, y: -260, mass: 200, every: 1.1, spells: ['spear', 'bolt', 'katana', 'shuriken'] },
  { name: '人形・砲', kind: 'cannon', ink: 'purple', x: -620, y: 260, mass: 400, every: 3.4, spells: ['beam', 'axe', 'beam', 'shock'] }
];

// ═══ 07. 位階（端末に保存する累計ポイント） ════════════════════
DATA.tiers = [
  { min: 0,     seal: '無', name: '無紋' },
  { min: 250,   seal: '初', name: '初紋' },
  { min: 800,   seal: '二', name: '二紋' },
  { min: 1800,  seal: '三', name: '三紋' },
  { min: 3600,  seal: '四', name: '四紋' },
  { min: 6500,  seal: '五', name: '五紋' },
  { min: 11000, seal: '匠', name: '紋匠' },
  { min: 18000, seal: '聖', name: '紋聖' }
];

// ═══ 08. Botの名前と叫び ══════════════════════════════════════
// 闇の儀式場に集う術者たち。重く、静かな名にしてある
DATA.botNames = [
  '灰燼', '黒曜', '朔', '鴉羽', '墨染', '夜叉丸', '葬送', '冥灯', '焦土', '白骨',
  '宵闇', '残響', '霧雨', '鉄紺', '絶影', '緋縅', '無明', '凍月', '蒼炎', '贄',
  'Vesper', 'Ashen', 'Noctis', 'Morrow', 'Grave', 'Umbra', 'Sable', 'Wraith', 'Cinder', 'Hollow',
  '終焉の徒', '黄昏', '断罪', '沈黙', '孤影', '凶星', '禍津', '夜哭', '廃都', '葬灯',
  'Rook', 'Crow', 'Ember', 'Lament', 'Requiem', 'Vigil', 'Shroud', 'Obsidian', 'Thorn', 'Omen'
];
// 旧版の断末魔・決め台詞に、戦場らしい短い叫びを足したもの
DATA.cries = {
  win: [
    '勝利は証明じゃない。次の問いの始まりだ。', 'この紋に刻むのは、勝者の名ではなく選択だ。',
    '散逸する力を、今だけは守る形にできた。', '勝った。それでも、壊したものは戻らない。',
    '読み切ったのではない。迷いを一つ、越えただけだ。', '強さとは、何を壊さずに済ませるか。',
    '糸を結ぶ手も、断つ手も、同じ手だった。', '勝利のあとに残る静けさまで、引き受けよう。',
    '器の差ではない。最後まで選び直せた差だ。', 'この一勝を、終わりにしない。'
  ].concat(['紋の違いを思い知れ。', '終わりだ。', '遅い。', '散れ。', '灰に還れ。']),
  death: [
    '……紋がほどける。最後まで、私だった。', '器は砕けても、選んだ道は消えない……',
    '散っていく魔力にも、帰る場所がある……', '守れなかったものまで、忘れはしない……',
    'この敗北も、次の構造の一部になる……', '糸が切れた。もう、誰にも預けられない……',
    '勝つことだけが、正しさではなかった……', '命は散逸する。それでも願いは残る……',
    '見誤ったのは術式じゃない。私の恐れだ……', '最後の一片まで、意志は渡さない……'
  ].concat(['ぐ……あああっ！', '……ここまで、か。', 'くっ……闇に、呑まれる……', '馬鹿な……この私が……', '無念……'])
};
// 自分の叫びの初期値（ロビーで書き換えられる）
DATA.defaultCries = { win: '見たか、これが紋の力だ！', death: 'くっ…まだ散るわけには…！' };

// ═══ 09. 遊び方 ════════════════════════════════════════════════
DATA.howto = [
  ['動く', 'WASD / 矢印キー'],
  ['術を持ち替える', '1・2・3・4 / ホイール / 下の枠をクリック'],
  ['術を放つ', 'マウスで狙い、左クリック（押し続けると続けて詠唱）'],
  ['回避', '右クリック / Space'],
  ['指示起爆', 'F（「発動：指示」の術に合図を送る）'],
  ['回収', 'G（「糸：維持」の術をほどき、魔力の一部を戻す）'],
  ['術式台', 'T（修練場の中、ロビー、散った後）'],
  ['音', 'M で効果音、N で音楽、V で声（なし／技名だけ／技名と叫び）、B で曲を変える。細かい設定はロビーの「設定」']
];
DATA.rules = [
  '術は「術式台」で組む。何が起こるか（原理）・どんな形か・どう届くか・いつ起こるか・起きた後どうなるか、を選ぶと、27の現象のどれかになる。',
  '部品が増えるほど消費と詠唱が重くなり、威力も落ちる。部品の少ない単調な術ほど燃費が良く、一撃が重い。扱える部品の数（制御容量）はレベルで育つ：LV0で4、LV3で5、LV7で7、LV12で9。超えた術は放つ瞬間に暴発しうる。',
  '術は「固体」か「エネルギー」で放つ。設置壁はどちらの質も光線も止め、壊した一撃も受け止める。領域型の結界は質の相性で削れる。固体を周回させると、刃が周りを回って盾にも武器にもなる。',
  '放った術は遠くへ行くほど散って弱まる。光線と槍はほとんど衰えない。形（針・矢・刀・日本刀・大鎌・斧・槌・手裏剣・円月輪・槍・城…）で速さ・当たり判定・結界への貫通力が変わる。',
  '「完全」の結界は固体とエネルギーを重ね、何も通さない。ただし消費が非常に重く、張っている間は魔力が減り続けて足が重くなり、術を唱えると解ける。',
  '違う紋の術どうしは空中でぶつかる。固体どうしは衝突して弱い方が砕け、エネルギーどうしは相殺し合い、エネルギーが固体を貫くと大きく弱まり固体も削れる。炸裂の爆風は違う紋のエネルギーの弾を吹き消し、固体の弾を弾き飛ばす。光線は違う紋のエネルギーの弾を焼き払う。',
  '自分の紋の術どうしは反発せず、重なり合う。エネルギーどうしは「融合」して大きな一発に、エネルギーが自分の固体の弾に触れると「魔装」して固体が重くなる。自分のエネルギーの場を通った弾や光線は「共鳴」して強まり、炸裂は近くの自分の罠を「誘爆」させる。自分の結界は自分の術を通す（壁越しに撃てる）。円月輪を受け止めると魔力が半分戻る。',
  '戦場の床の六つの紋は「六原理の節点」。その輪の中に立つと、その原理を含む術の威力が上がり、消費が下がり、魔力の戻りも速くなる。中央の「要の陣」に立つと制御容量が1増える。',
  '作った術は「修練場」で人形を相手に試せる。修練場では T でいつでも組み替えられる。',
  '戦場では地面の光の粒（魔素）を拾うと育ち、魔力も戻る。魔力は勝手には戻らない（六原理の節点の中でだけ湧き出る）。魔素がそのままスコア。散らした相手の魔素は周りにばらまかれ、魔力も奪える。',
  '散ったら終わり。スコアと順位が位階ポイントになる。すぐ入りなおせる。'
];

(typeof window !== 'undefined' ? window : globalThis).PRIMA_DATA = DATA;
})();
