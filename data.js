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
  mp: { max: 100, perLevel: 4, regen: 0, practice: 24, special: 7 },
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
  points: { perPeak: 0.2, perKill: 15, place: [[1, 80], [3, 40], [10, 15]] },
  // 残酷さ（法則：世界は誰も選ばない）。手負いは追い打ちを受け、血が止まらず、傷は癒えない。落雷は大きく育った者を選んで落ちる
  //   finish：体力が below 未満の相手への打撃 ×mul ／ bleed：体力が below 未満で打たれると time 秒、毎秒 maxHp × perSec を失う
  //   noRegen：体力がこれ未満なら自然回復しない ／ strike：落雷。every 秒ごと（範囲）、warn 秒前に予告、半径 r、最大体力の hpShare を奪う。bias の確率で最大の魔素の者を狙う
  cruel: { finish: { below: .35, mul: 1.35 }, bleed: { below: .5, time: 4, perSec: .014 }, noRegen: .3,
    strike: { every: [12, 22], warn: 1.8, r: 120, hpShare: .45, bias: .55, motes: 36 } }
};


// ═══ 02. 六原理 ═════════════════════════════════════════════════
// 原理は一つの動詞。作用先で意味を変えず、「器そのもの」と「器に触れたもの」の二つへ同じ規則で効く。
// cost は1点あたりの魔力の負荷（点を重ねるほど割高：点^1.35）
DATA.principles = {
  motion:  { kanji: '動', name: '運動', ink: 'orange', cost: 2.2, self: '速くなる',       touch: '押す・引く・回す' },
  bind:    { kanji: '結', name: '結合', ink: 'blue',   cost: 2.6, self: '硬くなる',       touch: '器の中心へつなぐ' },
  divide:  { kanji: '分', name: '分解', ink: 'teal',   cost: 3,   self: '鋭くなる',       touch: '壊す' },
  convert: { kanji: '換', name: '変換', ink: 'purple', cost: 2.8, self: '受けた魔力を吸う', touch: '魔力を奪う' },
  grow:    { kanji: '増', name: '増殖', ink: 'green',  cost: 3.2, self: '数と時間が増える', touch: '自分の紋を直す' },
  phase:   { kanji: '相', name: '位相', ink: 'pink',   cost: 3,   self: '見えず、結を抜ける', touch: '印を付ける' }
};
DATA.principleOrder = ['motion', 'bind', 'divide', 'convert', 'grow', 'phase'];
// 詠唱：術の段から詠唱文を作り、足元の大魔法陣の文字として巡らせる（読み上げはしない）。
// 声に出すのは、名前を付けた術の技名だけ
DATA.chant = {
  a: { motion: '疾く奔れ', bind: '結び、固まれ', divide: '解けよ', convert: '移ろい、還れ', grow: '芽吹き、満ちよ', phase: '位相よ、揺らげ' },
  b: { motion: '風を裂き', bind: '縛りを重ね', divide: '理を割り', convert: '紋を書き換え', grow: '命を継ぎ', phase: '影を渡り', none: '' },
  vessel: { bolt: '', ray: '貫け', wall: '壁となれ', field: '満ちよ', body: '我に宿れ', orbit: '我を巡れ' },
  then: { hit: '触れて', end: '尽きて', signal: '合図に', break: '砕けて' },
  // この秒数より長い詠唱は大魔法陣を開く
  voiceAt: 0.34
};

// ═══ 03. 術式（器 × 原理 × 段の連鎖） ═══════════════════════════
// 術 ＝ 1〜3段。段 ＝ { vessel 器, p 原理の点, then 次の段へ移る条件, path 軌道, matter 質, force 力の向き, size 大きさ, time 持続, look 見た目 }
// レシピ ＝ { v: 3, stages: [段…], link 糸, customName }。必ず sim.js の normRecipe() を通す
// 原理の点は0〜3.0の連続値（術式台ではスライダー、0.1刻み）。薄める配分はない。点を重ねると共鳴して強まる（echo は整数の点の間をなめらかにつなぐ）。
// 制御容量に数えるもの（partCount）＝ 原理の点の合計 ＋ 段のつなぎ（2段目から1つずつ）＋ 糸 ＋ 追尾の軌道
DATA.craft = {
  maxStages: 3, maxLevel: 3,
  // 点の効き目：1点=1、2点=2.2、3点=3.6。単調な術ほど一つの作用が重い
  echo: [0, 1, 2.2, 3.6],
  // 大きさ：弾と環（剣・槍・斧などの武器）は最大3倍＝術者の倍ほどの巨剣。1.6倍を超えた分は魔力が急に増える
  size: [0.6, 1.6], sizeMax: { bolt: 3, orbit: 3 }, time: [0.5, 2],
  // 器。cost は器の負荷、range は1段目が術者から離れて立つ距離（面は正面の近さ・円は足元＝0）
  vessels: {
    bolt:  { name: '弾', cost: 4, range: 820, glyph: '→', note: '照準へ飛ぶ魔力の塊。触れた相手・壁・照準の地点で次の段へ移れる' },
    ray:   { name: '線', cost: 10, range: 900, glyph: '⚡', note: '一瞬で伸びる光。並んだ相手を貫く。設置壁で止まる。重いが遠くでも衰えない' },
    wall:  { name: '面', cost: 6, range: 110, glyph: '▮', note: '術者の正面に立つ壁（動で遠くへ）。遠くに立てるなら弾の後ろにつなぐ。誰の体も弾も光線も止める（自分のものも）' },
    field: { name: '円', cost: 7, range: 0,   glyph: '◎', note: '足元に開く場。遠くに開くなら弾や線の後ろにつなぐ。開いた瞬間に強く、残る間は弱く作用し続ける' },
    body:  { name: '纏', cost: 4, range: 0,   glyph: '◈', note: '自分の体を器にする。原理が自分に宿り、触れた相手にも作用する' },
    orbit: { name: '環', cost: 6, range: 0,   glyph: '↻', note: '自分の周りを回る。飛んでくる弾を受け止め、触れた相手に作用する' }
  },
  vesselOrder: ['bolt', 'ray', 'wall', 'field', 'body', 'orbit'],
  // 弾の軌道
  paths: {
    straight: { name: '直進', cost: 0, parts: 0, note: 'まっすぐ飛ぶ。速い' },
    arc:      { name: '放物', cost: 1, parts: 0, note: '放物線で壁や岩を越え、照準の地点へ落ちる' },
    seek:     { name: '追尾', cost: 3, parts: 1, note: '違う紋の大きな魔力へ曲がる。糸があれば照準へ誘導できる。制御容量を1使う' },
    return:   { name: '回帰', cost: 2, parts: 0, note: '射程の半分で折り返し、手元へ戻る。帰りにも当たり、受け止めると魔力が戻る' }
  },
  pathOrder: ['straight', 'arc', 'seek', 'return'],
  // 次の段へ移る条件。器ごとに使えるものが違う
  thens: {
    hit:    { name: '触れたら', glyph: '◆', note: '相手・壁・照準の地点に触れた所で次の段が開く。纏は触れた・打たれた時' },
    end:    { name: '尽きたら', glyph: '◷', note: '持続（弾は射程）を使い切った所で次の段が開く。時間差の仕掛けになる' },
    signal: { name: '合図で',   glyph: '✱', note: 'F の合図で次の段が開く。糸が必要（自動で付く）' },
    break:  { name: '壊れたら', glyph: '✕', note: '器が壊された所で次の段が開く。壁・環・結のある円・弾だけ' }
  },
  thenOrder: ['hit', 'end', 'signal', 'break'],
  thensFor: { bolt: ['hit', 'end', 'signal', 'break'], ray: ['hit'], wall: ['hit', 'end', 'signal', 'break'], field: ['hit', 'end', 'signal', 'break'], body: ['hit', 'end', 'signal'], orbit: ['hit', 'end', 'signal', 'break'] },
  forces: { push: { name: '外へ押す' }, pull: { name: '中心へ引く' }, spin: { name: '横へ回す' } },
  forceOrder: ['push', 'pull', 'spin'],
  matters: {
    energy: { name: 'エネルギー', kanji: '光', note: '光と熱のまま。速いが遠くで散りやすい。固体の構造には弱く、エネルギーの構造には光線が強い' },
    solid:  { name: '固体',       kanji: '晶', note: '結晶に固める。遅いが重く押し込み、衰えにくい。エネルギーの構造を大きく削る。固体の構造は硬い' }
  },
  matterOrder: ['energy', 'solid'],
  // 命中1回の打撃 = (base + divide × echo(分) + motion × echo(動)) × 器の倍率。魔素の多い体ほど少し重い
  dmg: { base: 5, divide: 7, motion: 2.5, perSqrt: 0.012, mark: 0.1 },
  // 器ごとの倍率。tick は残る場・壁・環・纏が触れ続けるときの割合と間隔
  bolt: { speed: 700, motionSpeed: .18, size: 6, fall: .45 },
  ray:  { mul: 1.5, width: 11, motionRange: .12, fall: .06, structMul: 1.6 },
  wall: { half: 90, reachMotion: 80, hp: 38, bindHp: 1.1, life: 8, move: 55, tick: .5, touch: .35, growLen: .3 },
  // 円は広さを持つぶん、開いた瞬間の作用（burst）は弾より軽い
  field:{ radius: 100, life: 2.4, move: 60, tick: .5, touch: .2, burst: .7, hp: 26, growLife: .5 },
  body: { life: 5, motion: .11, armor: .1, maxArmor: .4, regen: 2.4, cleanse: 1.5, convert: .1, bump: .6, bumpCd: .6 },
  orbit:{ radius: 42, life: 7, spin: 2.4, hp: 16, hitCd: .45, touch: .7 },
  // 増の器そのもの：弾・線・環の数（点ごと）。複製1つの効き目は √(基の数 / 数) 倍（合計は増えるが、1発は軽くなる）
  copies: [1, 2, 3, 5], orbitCopies: [2, 3, 4, 6], spread: .16,
  // 結：触れたものを器の中心へつなぐ。長さ・張力・引く力の上限・秒数。3点で足も縫い止める。
  // つながった距離より slack/2（最低でも長さ＋slack）離れると切れる。回避でも切れる
  tether: { length: 160, perLevel: 30, min: 50, force: 4, forcePer: 6, pull: 600, pullPer: 300, slack: 150, time: .8, timePer: .6, slow: .15, root: .5 },
  // 動：押す力（echo ごと）。固体はさらに押し込む
  knock: 150, solidKnock: 90,
  // 換：奪う魔力（echo ごと）と、自分へ戻る割合。器そのものが吸う割合（受けた打撃に対して）
  drain: 4, drainKeep: .6, absorb: .25,
  // 増：触れた自分の紋を直す量（echo ごと、1回あたり）
  mend: 3,
  // 相：見える距離（点ごとに縮む）と、印の秒数・打撃の上乗せ
  veil: { range: 520, perLevel: 150, min: 90 }, markTime: 1.5,
  // 隠れ身：纏の相で姿が薄れる強さ（相の効き目 × per）。近づく・詠唱する・打たれると見える
  cloak: { per: .38 },
  // 透過：纏の相が at 点以上で体が透け、弾・線・体を素通りする。魔力を毎秒 drain 払い、撃つ・打つ・魔力切れで解ける
  ghost: { at: 2.5, drain: 6 },
  // 分身：纏に相と増の両方を振ると、術者の姿の囮が min(相, 増) 体（最大 max）散らばる。囮は狙いと追尾を引き、割られると纏の「触れたら」が開く
  clone: { max: 3, speed: 150, drag: 1.6, lifePer: .25 },
  // 質の相性：攻撃の質 → 構造の質 の倍率
  clash: { solidOnEnergy: 1.8, energyOnSolid: .65, rayOnEnergy: 2, rayOnSolid: 1 },
  // 構造の硬さ：固体は硬く、エネルギーは柔らかい
  hardness: { solid: 1.4, energy: .85 },
  // 分の器そのもの：構造を削る倍率（echo ごと）。弾は点の数だけ体を貫く
  structPer: .6,
  // 共鳴：自分のエネルギーの場を通った弾の打撃の倍率
  resonance: 1.2,
  // 魔力の消費 = Σ段 (器 + Σ 原理の負荷 × 点^1.35 + 軌道) × 大きさ × 持続 × 質 × (2段目以降 later) ＋ 糸
  later: .9, solidCost: 1.1, linkCost: 3, costScale: 1,
  // 詠唱 = base + 消費 × perCost（上限 max）＋ 段ごとの間
  wind: { base: .12, perCost: .0105, min: .15, max: 1.1, perStage: .05 },
  // 自動の名前：段ごとに「原理の字＋器の字」、段どうしは stageSep でつなぐ。点の無い段は empty
  naming: { join: '', stageSep: '・', empty: '素' },
  // 術式台の説明：原理が器そのものに何をするか（器ごと）。{n} は点の数、{c} は増えた数。空文字は「この器には効かない」
  selfText: {
    bolt:  { motion: '速く飛ぶ', bind: '空中の競り合いに強い', divide: '{n}体を貫き、壁を削る', convert: '競り勝った弾を吸う', grow: '{c}発に増える（1発は軽くなる）', phase: '見えにくく、結{n}未満の壁を抜ける' },
    ray:   { motion: '遠くまで伸びる', bind: '', divide: '壁を強く削る', convert: '', grow: '{c}本に増える（1本は軽くなる）', phase: '結{n}未満の壁と結界を抜ける' },
    wall:  { motion: '遠くに立ち、照準の向きへ進んで体を押していく', bind: '硬くなる', divide: '', convert: '受け止めた一撃を魔力に変える', grow: '長くなる', phase: '見えにくい' },
    field: { motion: '足元から照準の向きへ流れていく', bind: '弾を止める結界になる', divide: '開いた瞬間、相手の弾を吹き消す', convert: '通り抜ける相手の弾から魔力を吸う', grow: '長く残る', phase: '見えにくい（罠になる）' },
    body:  { motion: '足が速くなる', bind: '受ける打撃が減る', divide: '鈍化や拘束をほどく', convert: '受けた打撃の一部を魔力に変える', grow: '体が再生する', phase: '姿を隠し、結{n}未満の壁を抜けて歩ける。2.5点で体が透けて弾も体も素通りする（魔力を毎秒使う）。増も振ると分身を残す' },
    orbit: { motion: '速く回る', bind: '刃が硬くなる', divide: '', convert: '受け止めた弾を魔力に変える', grow: '刃が{c}本になる', phase: '見えにくい' }
  }
};
// 見た目：弾と環の形。性能は変わらない（原理が性能を決める）
DATA.shapes = {
  needle: { name: '針' }, orb: { name: '球' }, shard: { name: '結晶' }, arrow: { name: '矢' }, blade: { name: '刀' }, katana: { name: '日本刀' },
  scythe: { name: '大鎌' }, axe: { name: '斧' }, hammer: { name: '槌' }, shuriken: { name: '手裏剣' }, chakram: { name: '円月輪' }, spear: { name: '槍' }, castle: { name: '城' }
};
DATA.shapeOrder = ['needle', 'orb', 'shard', 'arrow', 'blade', 'katana', 'scythe', 'axe', 'hammer', 'shuriken', 'chakram', 'spear', 'castle'];
// 世界の決まり（糸・回収・制御容量・暴発）
DATA.RULES = {
  link: { range: 900, upkeepBase: 0.55, upkeepScale: 0.018, upkeepMul: 2.6, decayMul: 0.35, guideTurn: 4.6, severedLife: 1.4 },
  recall: { refund: 0.6 },
  // 回帰の弾を受け止めたとき、消費のうち戻る魔力の割合
  returnRefund: .5,
  // 術どうしの干渉：強い方が弱い方に削られる割合（固体の衝突・エネルギーの相殺）
  // melt：エネルギーが固体を貫くとき、固体が熱で削れる割合。fusion / enchant：自分の弾どうしが融合・魔装するときの上乗せ
  interfere: { solidLoss: .6, energyLoss: 1, melt: .5, fusion: .9, enchant: .8, pierceKeep: .6 },
  // 遠くでの衰え（1000 あたり）の下限
  falloff: { per: 1000, min: .35 },
  // 制御容量：レベルで育つ。超えた点1つにつき暴発率が上がる
  capacity: [[0, 4], [3, 5], [7, 7], [12, 9]],
  misfire: { perOverPart: .16, max: .8, selfDamage: .45 },
  decoy: { life: 3.6, weight: 70 },
  // 合図を待つ弾の寿命（秒 × 持続）
  wait: 6
};

// 段を短く書くための道具（作例・流派・Botの持ち術）
const ST = (vessel, p = {}, o = {}) => ({ vessel, p, ...o });
const RC = (...stages) => ({ v: 3, stages });
const RL = (...stages) => ({ v: 3, stages, link: true });
// 作例（型）：どれも同じ規則で書かれた、編集できるレシピ
DATA.presets = {
  bolt:     { label: '魔弾',       r: RC(ST('bolt', { divide: 1, motion: 1 })) },
  lance:    { label: '晶槍',       r: RC(ST('bolt', { divide: 2, motion: 2 }, { matter: 'solid', look: 'spear' })) },
  shotgun:  { label: '散弾',       r: RC(ST('bolt', { grow: 2, divide: 1 }, { size: .8, time: .6, look: 'shard' })) },
  seeker:   { label: '追尾針',     r: RC(ST('bolt', { divide: 2 }, { path: 'seek', look: 'needle' })) },
  chakram:  { label: '回帰輪',     r: RC(ST('bolt', { divide: 2 }, { path: 'return', matter: 'solid', look: 'chakram' })) },
  ray:      { label: '断ち光線',   r: RC(ST('ray', { divide: 3 })) },
  anchor:   { label: '鎖の錨',     r: RC(ST('bolt', { bind: 2, motion: 1 }, { force: 'pull', look: 'spear' })) },
  burst:    { label: '爆裂球',     r: RC(ST('bolt', {}, { then: 'hit', look: 'orb' }), ST('field', { divide: 2, motion: 1 }, { size: .9, time: .5 })) },
  well:     { label: '重力井',     r: RC(ST('bolt', {}, { path: 'arc', then: 'hit', look: 'orb' }), ST('field', { motion: 2, bind: 1 }, { force: 'pull', time: 1.3 })) },
  remote:   { label: '遠隔起爆',   r: RL(ST('bolt', {}, { then: 'signal', look: 'orb' }), ST('field', { divide: 2 })) },
  mine:     { label: '見えない地雷', r: RC(ST('field', { phase: 2 }, { size: .6, time: 2, then: 'hit' }), ST('field', { divide: 2 }, { size: .9, time: .5 })) },
  stoneWall:{ label: '石壁',       r: RC(ST('wall', { bind: 3 }, { matter: 'solid' })) },
  drainWall:{ label: '吸魔の壁',   r: RC(ST('wall', { bind: 1, convert: 2 })) },
  counterWall:{ label: '反撃の壁', r: RC(ST('wall', { bind: 2 }, { matter: 'solid', then: 'break' }), ST('field', { divide: 2, motion: 1 }, { time: .5 })) },
  barrier:  { label: '結界',       r: RC(ST('field', { bind: 3 }, { size: .75, time: 1.5 })) },
  guardRing:{ label: '守りの環',   r: RC(ST('orbit', { bind: 2, grow: 1 }, { matter: 'solid', look: 'castle' })) },
  bladeRing:{ label: '刃の環',     r: RC(ST('orbit', { divide: 2, motion: 1 }, { matter: 'solid', look: 'katana' })) },
  haste:    { label: '疾走',       r: RC(ST('body', { motion: 2 })) },
  harden:   { label: '硬化',       r: RC(ST('body', { bind: 2 })) },
  mend:     { label: '再生',       r: RC(ST('body', { grow: 2 })) },
  cloak:    { label: '隠れ身',     r: RC(ST('body', { phase: 2 })) },
  absorb:   { label: '吸収の衣',   r: RC(ST('body', { convert: 2, bind: 1 })) },
  clone:    { label: '分身',       r: RC(ST('body', { phase: 1.5, grow: 1.5 }, { then: 'hit' }), ST('field', { divide: 1 }, { size: .8, time: .5 })) },
  phantom:  { label: '透過',       r: RC(ST('body', { phase: 2.5 }, { time: .5 })) },
  ghost:    { label: '壁抜けの弾', r: RC(ST('bolt', { phase: 2, divide: 1 }, { look: 'needle' })) },
  cluster:  { label: '分裂弾',     r: RC(ST('bolt', { divide: 1 }, { then: 'end', time: .4, look: 'shuriken' }), ST('bolt', { grow: 2, divide: 1 }, { size: .8, time: .5 })) }
};
DATA.presetOrder = ['bolt', 'lance', 'shotgun', 'seeker', 'chakram', 'ray', 'anchor', 'ghost', 'burst', 'well', 'cluster', 'remote', 'mine',
  'stoneWall', 'drainWall', 'counterWall', 'barrier', 'guardRing', 'bladeRing', 'haste', 'harden', 'mend', 'cloak', 'clone', 'phantom', 'absorb'];
// 術式台で最初に並べる作例
DATA.presetStarters = ['bolt', 'burst', 'anchor', 'stoneWall', 'bladeRing', 'mend', 'ray', 'mine'];
// 最初に持っている4つの術（はじめの制御容量4に収まる）
DATA.defaultSpells = ['bolt', 'burst', 'stoneWall', 'mend'].map(k => DATA.presets[k].r);
// 達人の流派：Bot はどれか一つの流派を修め、名を付けた術を叫んで使い分ける（遊ぶ人へのお手本）。
// keep は相手との間合い。術は 4 つ。術式台の「達人の術」からも読み込める
const M = (customName, r) => ({ customName, ...r });
DATA.schools = [
  { key: 'archer', name: '光芒の射手', keep: 560, creed: '遠くの一点を、ただ信じる。', cries: { win: ['見えなくても、当たる。'], death: ['星が、ひとつ消えただけだ……。'] }, spells: [
    M('流星', RC(ST('bolt', { divide: 1, motion: 2, grow: 1 }, { look: 'arrow' }))),
    M('天穿', RC(ST('ray', { divide: 3, motion: 1 }))),
    M('砦', RC(ST('wall', { bind: 3 }, { matter: 'solid' }))),
    M('疾風', RC(ST('body', { motion: 2 })))
  ] },
  { key: 'blade', name: '剣聖', keep: 260, creed: '一太刀に、すべてを預ける。', cries: { win: ['斬った。名は、覚えておく。'], death: ['刃が……折れたか……。'] }, spells: [
    M('朧斬', RC(ST('bolt', { divide: 2, motion: 1 }, { look: 'katana' }))),
    M('八重桜', RC(ST('orbit', { divide: 2, grow: 1 }, { matter: 'solid', look: 'katana' }))),
    M('縮地', RC(ST('body', { motion: 3, phase: 1 }, { time: .6 }))),
    M('大鎌・宵薙ぎ', RC(ST('bolt', { divide: 2, motion: 1 }, { matter: 'solid', look: 'scythe', size: 1.5, time: .6 })))
  ] },
  { key: 'fortress', name: '城塞の主', keep: 300, creed: '守るとは、崩れ方を選ぶこと。', cries: { win: ['城は、落ちぬ。'], death: ['落ちたのは城ではない……私だ。'] }, spells: [
    M('破城', RC(ST('bolt', { divide: 2, motion: 2 }, { matter: 'solid', look: 'axe' }))),
    M('金城', RC(ST('orbit', { bind: 2, grow: 1 }, { matter: 'solid', look: 'castle' }))),
    M('絶界', RC(ST('field', { bind: 3, convert: 1 }, { size: .8, time: 1.5 }))),
    M('地鳴り', RC(ST('bolt', {}, { path: 'arc', matter: 'solid', look: 'hammer', then: 'hit' }), ST('field', { motion: 2, divide: 1 }, { time: .5 })))
  ] },
  { key: 'curse', name: '呪術師', keep: 380, creed: '恨みは、構造になる。', cries: { win: ['呪いは、あなたが先に選んだ。'], death: ['呪いは……解けないままだ……。'] }, spells: [
    M('瘴気の種', RC(ST('field', { phase: 1 }, { size: .6, time: 2, then: 'hit' }), ST('field', { divide: 1, bind: 1 }, { time: 1.5 }))),
    M('縛鎖', RC(ST('bolt', { bind: 2 }, { path: 'seek' }))),
    M('魂喰らい', RC(ST('bolt', { convert: 2, divide: 1 }, { path: 'seek' }))),
    M('虚ろ穿ち', RC(ST('bolt', { phase: 2, divide: 2 }, { look: 'spear' })))
  ] },
  { key: 'bomber', name: '爆破師', keep: 330, creed: '壊れるものは、美しく壊れるべきだ。', cries: { win: ['ほら、綺麗でしょう？'], death: ['ははっ……最後まで、花火だ……！'] }, spells: [
    M('爆縛陣', RL(ST('bolt', {}, { then: 'signal', look: 'orb' }), ST('field', { divide: 2, bind: 1 }))),
    M('崩天', RC(ST('bolt', {}, { path: 'arc', then: 'hit', look: 'orb' }), ST('field', { divide: 2, motion: 1 }, { size: 1.2, time: .5 }))),
    M('散華', RC(ST('bolt', { motion: 1 }, { then: 'end', time: .5, look: 'shuriken' }), ST('bolt', { grow: 2, divide: 1 }, { size: .8, time: .5 }))),
    M('反転', RC(ST('wall', { bind: 1, convert: 2 })))
  ] },
  { key: 'swarm', name: '群れ使い', keep: 420, creed: '個は散る。群れは残る。', cries: { win: ['一匹ずつは弱くとも。'], death: ['巣が……散ってゆく……。'] }, spells: [
    M('千本桜', RC(ST('bolt', { grow: 3, divide: 1 }, { path: 'seek', size: .7 }))),
    M('三叉雷', RC(ST('bolt', { grow: 2, motion: 1, divide: 1 }))),
    M('奪魂域', RC(ST('bolt', {}, { path: 'arc', then: 'hit' }), ST('field', { convert: 2 }, { time: 1.5 }))),
    M('再生', RC(ST('body', { grow: 2 })))
  ] },
  { key: 'storm', name: '雷帝', keep: 470, creed: '落ちるものに、理由は要らない。', cries: { win: ['雷は、選ばない。'], death: ['雷が……落ちる側になるとはな……。'] }, spells: [
    M('雷槍', RC(ST('bolt', { motion: 2, divide: 1 }, { look: 'spear' }))),
    M('天雷', RC(ST('ray', { divide: 2, grow: 1 }))),
    M('雷鳴環', RC(ST('bolt', {}, { path: 'arc', then: 'hit' }), ST('field', { divide: 1, motion: 1 }, { force: 'spin', time: 1.5 }))),
    M('魔素収束', RC(ST('field', { convert: 2, grow: 1 }, { size: .8 })))
  ] },
  { key: 'mirror', name: '鏡の魔女', keep: 400, creed: '真実は、反射の中にしかない。', cries: { win: ['映っていたのは、あなたの方。'], death: ['割れた鏡に……私は何人いる……。'] }, spells: [
    M('月輪', RC(ST('bolt', { divide: 2 }, { path: 'return', matter: 'solid', look: 'chakram' }))),
    M('鏡花', RC(ST('body', { phase: 2, grow: 1 }, { then: 'hit' }), ST('field', { divide: 1, motion: 1 }, { time: .5 }))),
    M('水鏡', RC(ST('wall', { convert: 2, phase: 1 }))),
    M('慣性の鎖', RC(ST('bolt', { bind: 2, motion: 1 }, { path: 'seek', force: 'pull' })))
  ] }
];
// Botの持ち術（流派を持たない Bot が使う。はじめの容量4に収まる術を中心にしてある）
DATA.botLoadouts = [
  ['bolt', 'seeker', 'stoneWall', 'ray'],
  ['lance', 'anchor', 'harden', 'mend'],
  ['bolt', 'mine', 'bladeRing', 'seeker'],
  ['shotgun', 'well', 'barrier', 'ray'],
  ['chakram', 'drainWall', 'haste', 'burst'],
  ['ghost', 'seeker', 'guardRing', 'mend'],
  ['lance', 'ray', 'barrier', 'bladeRing'],
  ['bolt', 'cluster', 'stoneWall', 'cloak']
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
  // スペシャルステージ：位階ポイントが節目に達すると突然開く。得体のしれない演算体と一対一。散れば位階ポイントは0に戻る
  special: { name: '演算の間', note: '知性ある何かが待っている。散れば、積んだ位階は0に戻る', R: 1250, bots: 0, motes: 0, springs: 0, rocks: 0, special: true },
  dojo: { name: '修練場',   note: '人形を相手に、作った術を試す。記録は残らない', R: 1100, bots: 0, motes: 0, springs: 0, rocks: 3, practice: true }
};
DATA.roomOrder = ['ichi', 'sema', 'oo'];

// ═══ 06b. スペシャルステージと演算体 ═══════════════════════════
// 位階ポイントが at の節目に達すると、その場で突然開く（まだ倒していない最初の段）。散ると位階ポイントは0に戻る。
// 演算体は脳と回路を思わせる知性。力で押すより、欺く・学ぶ・観測する。
//   decoyEvery / decoyN：偽の自分（囮）を撒く間隔と数 ／ learnEvery：術者の戦い方を見て術を組み替える間隔
//   strikeEvery：術者を狙って落ちる雷の間隔 ／ counters：術者が多用した器 → 組み替える術（作例）
DATA.special = { at: [2000, 6500, 18000] };
DATA.bosses = [
  { name: '演算体・萌芽', title: '考え始めたもの', hp: 1100, r: 52, speed: 190, mass: 400, spells: ['seeker', 'ray', 'barrier', 'clone'],
    decoyEvery: 9, decoyN: 2, learnEvery: 14, strikeEvery: [7, 10], win: '観測を、記録した。', death: '演算……停止……。' },
  { name: '演算体・皮質', title: '折り畳まれた思考', hp: 2800, r: 62, speed: 205, mass: 800, spells: ['lance', 'seeker', 'guardRing', 'clone'],
    decoyEvery: 8, decoyN: 3, learnEvery: 11, strikeEvery: [5.5, 8], win: 'あなたの癖は、もう読めた。', death: '予測……できなかった……。' },
  { name: '総体・脳髄', title: '観測するすべて', hp: 6400, r: 76, speed: 220, mass: 1400, spells: ['ray', 'burst', 'drainWall', 'clone'],
    decoyEvery: 6.5, decoyN: 4, learnEvery: 8, strikeEvery: [4, 6], win: '全ては、計算の内だった。', death: '私は……ただ、見ていただけ……。' }
];
DATA.bossCounters = {
  bolt: ['stoneWall', 'drainWall', 'guardRing', 'seeker'], ray: ['barrier', 'cloak', 'clone', 'seeker'],
  wall: ['ray', 'lance', 'burst', 'seeker'], orbit: ['ray', 'burst', 'anchor', 'seeker'],
  field: ['ray', 'seeker', 'anchor', 'lance'], body: ['ray', 'mine', 'seeker', 'anchor']
};
// 修練場の人形：止まる・左右に歩く・壁を張る（石壁で射線を切ってくる）
DATA.dummies = [
  { name: '人形・止', kind: 'still', ink: 'yellow', x: 420, y: -160, mass: 300 },
  { name: '人形・歩', kind: 'walk', ink: 'teal', x: 520, y: 140, mass: 150 },
  { name: '人形・壁', kind: 'guard', ink: 'blue', x: 760, y: -20, mass: 500, spells: ['stoneWall', 'stoneWall', 'stoneWall', 'stoneWall'] },
  // 攻撃する人形（修練場の「攻撃人形」を入れたときだけ撃つ）。耐久と結界の試験に。every 秒ごとに持ち術を順に放つ
  { name: '人形・射', kind: 'shooter', ink: 'orange', x: -560, y: -260, mass: 200, every: 1.1, spells: ['lance', 'bolt', 'seeker', 'shotgun'] },
  { name: '人形・砲', kind: 'cannon', ink: 'purple', x: -620, y: 260, mass: 400, every: 3.4, spells: ['ray', 'burst', 'ray', 'anchor'] }
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
  ['合図', 'F（「合図で」次の段へ移る術に合図を送る）'],
  ['回収', 'G（糸でつながった術をほどき、魔力の一部を戻す）'],
  ['術式台', 'T（修練場の中、ロビー、散った後）'],
  ['音', 'M で効果音、N で音楽、V で声（なし／技名だけ／技名と叫び）、B で曲を変える。細かい設定はロビーの「設定」']
];
DATA.rules = [
  '術は「術式台」で組む。器（弾・線・面・円・纏・環）を選び、六原理に0〜3点を振る。原理は器そのものと、器に触れたものの両方に同じ規則で効く。',
  '動は速くして押す、結は硬くしてつなぐ、分は鋭くして壊す、換は吸って奪う、増は数と時間を増やして自分を直す、相は見えなくして結を抜け、触れた相手に印を付ける。',
  '段をつなぐと術が育つ。弾が触れたら円が開く、壁が壊れたら反撃する、合図（F）で起爆する。条件は「触れたら・尽きたら・合図で・壊れたら」。最大3段。',
  '点を重ねるほど共鳴して強まる（1点=1、2点=2.2、3点=3.6）。単調な術ほど一つの作用が重く、混ぜた術は多芸になる。点・段のつなぎ・糸・追尾の合計が制御容量を使う：LV0で4、LV3で5、LV7で7、LV12で9。超えた術は放つ瞬間に暴発しうる。',
  '器は「固体」か「エネルギー」。固体は遅く重く、エネルギーの構造を大きく削る。エネルギーは速いが固体の構造に弱い。光線はエネルギーの結界を砕く。設置壁は質に関係なく、誰の体も弾も光線も止め、壊した一撃も受け止める。',
  '相の点が構造の結の点より多い弾・光線・体は、その壁や結界をすり抜ける。結を厚くすれば位相を止められる。岩は抜けられない。',
  '違う紋の弾どうしは空中でぶつかる。固体どうしは衝突し、エネルギーどうしは相殺し、質が違えば貫き合って弱まる。結のある弾は競り合いに強く、換のある弾は相手の弾を吸う。自分の弾どうしは融合し、自分のエネルギーの場を通った弾は共鳴して強まる。',
  '戦場の床の六つの紋は「六原理の節点」。その輪の中に立つと、その原理を含む術の威力が上がり、消費が下がり、魔力の戻りも速くなる。中央の「要の陣」に立つと制御容量が1増える。',
  '作った術は「修練場」で人形を相手に試せる。修練場では T でいつでも組み替えられる。',
  '戦場では地面の光の粒（魔素）を拾うと育ち、魔力も戻る。魔力は勝手には戻らない（六原理の節点の中でだけ湧き出る）。魔素がそのままスコア。散らした相手の魔素は周りにばらまかれ、魔力も奪える。',
  '散ったら終わり。スコアと順位が位階ポイントになる。すぐ入りなおせる。'
];

// 初心者向けの原理・器・条件の説明と、実際に試す手ほどき
// principle：[器そのものに, 触れたものに, 気をつけること]。vessel / then：[何が起こる, 何に使える, 弱点]
DATA.learning = {
  parts: {
    principle: {
      motion:  ['器そのもの：速くなる。弾は速く、壁と円は照準の向きへ進み、環は速く回り、纏なら自分の足が速くなる。', '触れたもの：押す・引く・回す。弾で引けば相手を自分へ引き寄せる。', '打撃は分より軽い。押しすぎると相手が射程の外へ逃げる。'],
      bind:    ['器そのもの：硬くなる。壁・環・円は耐久を持ち、結のある円は弾を止める結界になる。纏なら受ける打撃が減る。', '触れたもの：器の中心へつなぐ。弾なら術者へ、円なら中心へつなぎ、3点で足も止める。', '回避と距離でつながりは切れる。分の強い一撃で壁は崩れる。'],
      divide:  ['器そのもの：鋭くなる。構造を削る力が増え、弾は点の数だけ体を貫く。纏なら鈍化や拘束をほどく。', '触れたもの：壊す。いちばん大きな打撃。2点以上で相手の糸も断つ。', '魔力の負荷が重い。固い壁には質と相の組み合わせが要る。'],
      convert: ['器そのもの：受けた魔力を吸う。壁や環が止めた一撃、纏が受けた打撃の一部が自分の魔力に戻る。', '触れたもの：魔力を奪う。奪った分の6割が自分に戻る。', '打撃は増えない。魔力を奪っても相手の体は削れない。'],
      grow:    ['器そのもの：数と時間が増える。弾・線は扇に増え、環は刃が増え、円は長く残り、壁は長くなる。纏なら体が再生する。', '触れたもの：自分の紋を直す。自分の場の中の自分の体や、自分の壁を直す。', '増えた1発は軽くなる（合計は増える）。相手には効かない。'],
      phase:   ['器そのもの：見えず、結を抜ける。相の点が壁や結界の結の点より多いとすり抜ける。纏なら姿が消え、壁も抜け、2.5点以上で体が透けて弾や体を素通りする。増も振れば、囮の分身を残す。', '触れたもの：印を付ける。印の付いた相手は隠れられず、打撃が少し重くなる。', '近づく・詠唱する・打たれると姿が見える。岩は抜けられない。透けている間は魔力が減り続ける。']
    },
    vessel: {
      bolt:  ['照準へ飛ぶ魔力の塊。', '基本の攻撃。軌道（放物・追尾・回帰）や段で化ける。', '直進は横へ避けられる。壁に止まる。'],
      ray:   ['一瞬で伸びる光。並んだ相手を貫く。', '遠くの相手、エネルギーの結界を砕く。', '詠唱と消費が重い。設置壁で止まる。'],
      wall:  ['術者の正面に立つ壁。遠くに立てるなら、動を振るか、弾の後ろにつなぐ。', '射線を切る。動で押し出す壁、分で触れると痛い壁。', '自分の体と術も止める。分と固体に削られる。'],
      field: ['足元に開く場。遠くに開くなら、弾や線の後ろにつなぐ。開いた瞬間に強く作用し、残る間は弱く作用する。', '範囲攻撃・罠・結界（結）・回復の場（増）。', '外へ出られると効かない。'],
      body:  ['自分の体を器にする。', '加速・硬化・再生・隠れ身・体当たり。', '一つずつしか纏えない。遠くには届かない。'],
      orbit: ['自分の周りを回る刃や城壁。', '飛んでくる弾を受け止め、近づく相手に作用する。', '遠くに届かない。刃は削られると砕ける。']
    },
    then: {
      hit:    ['触れた所で次の段が開く。', '着弾で爆ぜる弾、踏むと起きる罠、打たれると反撃する纏。', '外れると次の段が開かない（弾は照準の地点で開く）。'],
      end:    ['持続を使い切った所で次の段が開く。', '時間差の爆発、空中で分裂する弾、切れ目のない守り。', '相手が待ってくれるとは限らない。'],
      signal: ['F の合図で次の段が開く。', '置いた罠を好きな時に起爆する。', '糸の維持費がかかり、遠すぎると切れる。'],
      break:  ['器が壊された所で次の段が開く。', '壊されると反撃する壁や環。', '壊されなければ開かない。']
    }
  },
  world: [
    ['魔素と魔力', '地面の光の粒は魔素。取り込むと自分の紋を帯びた魔力になる。術を放つと魔力を使い、魔素を拾うか節点の輪に立つと補える。'],
    ['紋と構造体', '紋は魔力の持ち主を示す。自分の攻撃で自分は傷つかないが、固定した壁は構造体なので自分の体・弾・光線も止める。'],
    ['散逸と糸', '手を離れた術はやがてほどける。糸を維持すると誘導・合図・回収ができるが、維持費と距離の限界がある。'],
    ['原理から現象へ', '炎や雷の属性を選ぶ世界ではない。六原理で魔素の動きや形を操作し、その結果が光・衝撃・結晶・結界として現れる。']
  ],
  // 手ほどき（自分で操作する）：1段につき1つの作業だけを短く言う
  tutorial: [
    ['弾を撃つ', '人形に照準を合わせて左クリック。2回当てよう。'],
    ['壁で防ぐ', '人形が撃ってくる。間に壁を立てて、1発防ごう。'],
    ['原理を足す', '術式台を開き、弾の「結」に点を振って「決定」。撃って当てよう。'],
    ['器を替える', '術式台で1の器を「環」にして「決定」。撃つと刃が周りを回る。'],
    ['壁を崩す', '人形が壁を立てた。術式台で弾の「分」を2点以上にして撃とう。'],
    ['段をつなぐ', '術式台で「段を足す」。弾が触れたら円が開く術を作り、当てよう。'],
    ['戦場へ', '戦場では相手の術を見て、組み替えて戦う。魔力は魔素を拾って補う。']
  ],
  // 見て学ぶ（実演）：[章, 見出し, 説明]。場面の演出は game.js の DEMO（同じ順）
  demo: [
    ['はじめに', '魔法は三つで組む', '器（形）、原理（働き）、段（つなぎ）。この三つを組み合わせて術になる。これから実演で一つずつ見せる。'],
    ['器', '弾', '照準へ飛ぶ魔力の塊。基本の攻撃。'],
    ['器', '線', '一瞬で伸びる光。並んだ相手を貫く。重いが遠くまで届く。'],
    ['器', '面', '正面に立つ壁。射線を切る。自分の弾も止まる。'],
    ['器', '円', '足元に開く場。範囲攻撃、罠、結界、回復になる。'],
    ['器', '纏', '自分の体に宿す。加速、硬化、再生、隠れ身。'],
    ['器', '環', '自分の周りを回る刃。近づく相手を斬り、弾を受け止める。'],
    ['原理', '動：押す', '弾は速く飛び、当たった相手を押す。'],
    ['原理', '分：壊す', '壁や結界を削る。点が多いほど、固い壁も崩せる。'],
    ['原理', '結：つなぐ', '触れた相手を、器の中心（弾なら自分）へ引き寄せる。'],
    ['原理', '換：奪う', '当てた相手から魔力を奪い、自分の魔力に戻す。左の青い帯に注目。'],
    ['原理', '増：増やす', '弾が扇に増える。1発は軽くなるが、合計は増える。'],
    ['原理', '相：すり抜ける', '相の点が壁の結の点より多いと、壁を通り抜ける。'],
    ['つなぐ', '段をつなぐ', '弾が触れたら、次の段（円）が開く。器と原理を重ねて一つの術にする。'],
    ['つなぐ', '次の段へ移る条件', '触れたら・尽きたら・合図で・壊れたら。例は、飛んだ先で分裂する弾。'],
    ['拡張', '質：エネルギーと固体', 'エネルギーは速いが遠くで散る。固体は遅いが重く、衰えない。'],
    ['拡張', '大きさと持続', '大きいほど強いが魔力も増える。持続は場や壁が残る長さ。'],
    ['拡張', '軌道', '追尾は曲がり、回帰は戻り、放物は壁を越えて落ちる。'],
    ['拡張', '糸と合図', '糸をつなぐと、F キーの合図で好きな時に起爆できる。維持費がかかる。'],
    ['おわり', '以上が仕組み', '術式台の作例から選んで、組み替えてみよう。操作して試すなら手ほどきへ。']
  ],
  example: '動だけの弾は速く押す。分を足せば壊し、結を足せば相手を自分へつなぐ。同じ原理の点を円に振れば範囲に、纏に振れば自分の体に宿る。弾が触れたら円を開く、と段をつなげば爆裂球。原理は「何をするか」、器と段は「どう使うか」を決める。'
};

(typeof window !== 'undefined' ? window : globalThis).PRIMA_DATA = DATA;
})();
