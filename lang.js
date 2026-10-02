// PRIMA 紋戦 — 言語（English・中文・한국어）
// 日本語が元の言葉。ここには訳だけを置く。game.js が起動時に選んだ言語の data を PRIMA_DATA に重ね、ui で画面の文を訳す。
//   ui   ：日本語の文をキーにした訳。{0} {1}… は game.js が差し込む値
//   data ：PRIMA_DATA に重ねる訳（原理・器・段の条件・作例・流派・台詞・遊び方など）。配列の中のオブジェクトは同じ位置のものに重なる
// 新しい文を画面に足したら、ここの3つの言語にも訳を足す（scripts/smoke.cjs が抜けを調べる）
(() => {
const LANG = {};

// ═══ English ══════════════════════════════════════════════════
LANG.en = {
  ui: {
    "・": " · ",
    "！": "!",
    "／": " / ",
    "自動（スマホや重い端末は軽く）": "Auto (lighter on phones and slow devices)",
    "高い": "High",
    "軽い（スマホ向け）": "Light (for phones)",
    "画質を軽くした": "Graphics set to light",
    "起爆": "Blast",
    "回収": "Recall",
    "画質": "Graphics",
    "自分の紋の魔力を体へ書き込んだ": "You inscribed your own crest's mana into your body",
    "暴発": "Misfire",
    "「{0}」は制御容量を超えていた": "\"{0}\" exceeded your control capacity",
    "術式が…崩れる！": "The spell… is collapsing!",
    "結界崩壊": "Ward shattered",
    "貫通": "Pierce",
    "剥離": "Strip",
    "「{0}」の節点": "Node of \"{0}\"",
    "{0}を含む術が強まり（威力 ×{1}・消費 ×{2}）、輪の中では魔力が湧き出る": "Spells with {0} grow stronger (power ×{1}, cost ×{2}), and mana wells up inside the ring",
    "要の陣": "Keystone Circle",
    "ここに立つ間は制御容量が +{0}。重い術を暴発させずに扱える": "Control capacity +{0} while you stand here. Heavy spells won't misfire",
    "共鳴": "Resonance",
    "相殺": "Cancel",
    "融合": "Fusion",
    "魔装": "Imbue",
    "誘爆": "Chain blast",
    "魔力が尽きた": "Out of mana",
    "+{0} 魔力": "+{0} mana",
    "糸が切れた": "Thread snapped",
    "術者から離れすぎた": "Too far from the caster",
    "糸を断たれた": "Your thread was cut",
    "回収 +{0} 魔力": "Recalled +{0} mana",
    "糸でつながった術式 {0} つをほどいた": "Unraveled {0} threaded spells",
    "構造崩壊": "Structure broken",
    "{0} を散らした": "You scattered {0}",
    "+{0} 魔素": "+{0} essence",
    "制御容量が {0} になった。より重い術を安定して放てる": "Control capacity is now {0}. Heavier spells are stable",
    "次の制御容量まで育て": "Keep growing toward the next capacity",
    "曲を変えた": "Track changed",
    "声なし": "No voice",
    "技名だけ": "Spell names",
    "技名と叫び": "Names & cries",
    "声：{0}": "Voice: {0}",
    "要の陣 ― 制御容量 +{0}": "Keystone Circle — control capacity +{0}",
    "{0}の節点 ― {0}の術が強まり、魔力が湧く": "Node of {0} — {0} spells grow stronger, mana wells up",
    "{0}人": "{0}",
    "LV {0}・制御容量 {1}": "LV {0} · Capacity {1}",
    "（LV{0}で{1}）": " ({1} at LV{0})",
    "魔力 {0}": "Mana {0}",
    "・暴発 {0}%": " · Misfire {0}%",
    "糸 {0}": "Threads {0}",
    "G 回収": "G Recall",
    "与えた威力 {0}・毎秒 {1}": "Dealt {0} · {1}/s",
    "受けた威力 {0}・防いだ {1}": "Taken {0} · Blocked {1}",
    "攻撃人形：撃つ": "Attack dummies: ON",
    "攻撃人形：止める": "Attack dummies: OFF",
    "{0} に散らされた": "Scattered by {0}",
    "結界の外で散った": "Scattered outside the ward",
    "{0} が結界に散った": "{0} was scattered",
    "攻撃人形が撃ちはじめた": "The attack dummies opened fire",
    "攻撃人形を止めた": "Attack dummies stopped",
    "受けた威力と、結界で防いだ数を数える（修練場では散らない）": "Counts damage taken and hits blocked by wards (you can't fall in the training hall)",
    "技": "Nm",
    "声": "Vo",
    "声：{0}（V で切り替え）": "Voice: {0} (V to switch)",
    "自動（ブラウザに合わせる）": "Auto (match browser)",
    "　◆自然": "  ◆natural",
    "（日本語の声が見つからない）": "(No voice found for this language)",
    "首位　{0}　{1}": "Leader  {0}  {1}",
    "次の「{0}」まで {1} pt": "{1} pt to \"{0}\"",
    "最上位の位階": "Highest rank",
    "{0}位": "#{0}",
    "撃破 {0}": "Kills {0}",
    "<li class=\"empty\">まだ入場していない</li>": "<li class=\"empty\">No battles yet</li>",
    "なし": "None",
    "自動": "Auto",
    "作例「{0}」を {1} に読み込んだ": "Loaded example \"{0}\" into slot {1}",
    "流派「{0}」の4つの術を読み込んだ（{1}）": "Loaded the four spells of the \"{0}\" school ({1})",
    "{0}の「{1}」を {2} に読み込んだ": "Loaded {0}'s \"{1}\" into slot {2}",
    "初期の4つに戻した": "Reset to the starting four",
    "{0}秒": "{0}s",
    "LV{0}〜 容量{1}": "LV{0}+ capacity {1}",
    "・安定": " · stable",
    "決定して試す": "Confirm & try",
    "修練場で試す": "Try in the training hall",
    "名無し": "Nameless",
    "人形を相手に術を試す。T で術式台、Esc で戻る": "Test spells on dummies. T: spell forge, Esc: back",
    "術を放つと入場保護が解ける": "Casting ends your entry shield",
    "左をなぞって歩く": "Drag left to walk",
    "右をタッチして放つ": "Tap right to cast",
    "下の枠で持ち替え": "Switch spells below",
    "左クリック": "Left click",
    "放つ": "Cast",
    "持ち替え": "Switch",
    "回避": "Dodge",
    "退出": "Leave",
    "歩く": "Walk",
    "マウスで狙う": "Aim with mouse",
    "画面の右半分をタッチ": "Tap the right half",
    "T で術式台": "T: spell forge",
    "決定 / Esc": "Confirm / Esc",
    "上の「術式台」ボタン": "The \"Spell forge\" button at the top",
    "修練場に残る": "Stay in the training hall",
    "手ほどきを終える": "End tutorial",
    "結界の外で構造が崩れた": "Your structure collapsed outside the ward",
    "{0}・計 {1} pt": "{0} · total {1} pt",
    "表示で問題が起きた": "A display problem occurred",
    "このまま遊べるが、続くときは再読み込みしてほしい": "You can keep playing; reload if it continues",
    "光のにじみを切った": "Bloom turned off",
    "動きが重かったため。設定で戻せる": "Because things were slow. You can re-enable it in Settings",
    "PRIMA 紋戦": "PRIMA: Crest War",
    "このゲームは JavaScript で動きます。ブラウザの設定で JavaScript を有効にしてください。": "This game needs JavaScript. Please enable it in your browser settings.",
    "魔素": "Essence",
    "撃破": "Kills",
    "一の間": "First Hall",
    "手ほどき": "Tutorial",
    "戦場へ入る": "Enter the battlefield",
    "構造": "Structure",
    "魔力": "Mana",
    "避": "Dg",
    "修練場": "Training Hall",
    "与えた威力 0": "Dealt 0",
    "受けた威力 0・防いだ 0": "Taken 0 · Blocked 0",
    "術式台": "Spell forge",
    "ロビーへ": "Lobby",
    "音": "SE",
    "曲": "BGM",
    "紋戦": "Crest War",
    "はじめての方へ": "New here?",
    "手ほどきを始める": "Start tutorial",
    "名前": "Name",
    "光の色": "Light color",
    "紋": "Crest",
    "丸": "Ring",
    "ルーム": "Room",
    "戦場の参加者はいまはBotです。オンライン対戦は準備中。": "Other mages are bots for now. Online play is in preparation.",
    "遊び方": "How to play",
    "設定（声・音・画面）": "Settings (voice, sound, display)",
    "術": "Spells",
    "術式台を開く": "Open spell forge",
    "勝利宣言": "Victory line",
    "倒したときに叫ぶ": "Shouted when you scatter a foe",
    "断末魔": "Last words",
    "散ったときに叫ぶ": "Shouted when you fall",
    "声で試す": "Test voice",
    "無": "無",
    "無紋": "Crestless",
    "次の位階まで 250 pt": "250 pt to next rank",
    "最高魔素": "Best essence",
    "最高順位": "Best place",
    "通算撃破": "Total kills",
    "入場": "Battles",
    "最近の入場": "Recent battles",
    "散った": "Scattered",
    "生存": "Survived",
    "位階が上がった": "Rank up",
    "もう一度入る": "Enter again",
    "術式を組み直す": "Rebuild spells",
    "決定": "Confirm",
    "形": "Shape",
    "放った後": "After release",
    "糸": "Thread",
    "威力": "Power",
    "質": "Mt",
    "固めるか": "Matter",
    "固体／エネルギー": "Solid / energy",
    "魔弾針": "Arcane Bolt Needle",
    "詠唱": "Chant",
    "遠くで": "At range",
    "制御容量と暴発": "Control capacity & misfire",
    "部品にふれると、その意味がここに出る": "Hover a part to see what it does",
    "達人の流派": "Master schools",
    "Bot が修める4つの術を丸ごと読み込む": "Load all four spells a bot school uses",
    "達人の術": "Master spells",
    "初期の4つに戻す": "Reset to starting four",
    "閉じる": "Close",
    "設定": "Settings",
    "言語": "Language",
    "名前を付けた術を放つとき、その技名を叫ぶ。「技名と叫び」は勝利宣言と断末魔も声に出す。": "Shouts the name of a named spell when you cast. \"Names & cries\" also voices victory lines and last words.",
    "声の種類": "Voice",
    "試す": "Test",
    "「Natural」「Online」と付いた声がいちばん人に近い（Edge・Chrome で使える）。": "Voices labeled \"Natural\" or \"Online\" sound most human (Edge, Chrome).",
    "効果音": "Sound effects",
    "音楽": "Music",
    "曲を変える": "Change track",
    "光のにじみ": "Bloom",
    "術の光がまわりへにじむ。重いときは切る": "Spell light bleeds outward. Turn off if slow",
    "原理を接続して自分の術を組み、ルームの乱戦で放つ。魔素を拾い、散らして奪い、散ったらすぐ入りなおす魔法の乱戦。": "Wire principles into your own spells and unleash them in a room-wide melee. Collect essence, scatter rivals to take theirs, and jump back in when you fall.",
    "PRIMA 紋戦 — 術を組み、乱戦で放て": "PRIMA: Crest War — build spells, unleash them in the melee",
    "原理をつないで自分だけの魔法を組み、魔導士の乱戦で放つブラウザゲーム。登録不要・すぐ遊べる。": "A browser game where you wire principles into your own magic and unleash it in a battle of mages. No sign-up, play instantly.",
    "戦場": "Battlefield",
    "自分の状態": "Your status",
    "順位": "Ranking",
    "体と刻印": "Body",
    "回避（右クリック / Space）": "Dodge (right click / Space)",
    "射（槍・魔弾・日本刀・手裏剣）と砲（光線・斧）の人形が撃ってくる": "Shooter (spear, bolt, katana, shuriken) and cannon (beam, axe) dummies attack you",
    "全体図": "Map",
    "効果音（M）": "Sound effects (M)",
    "音楽（N）": "Music (N)",
    "声（V）": "Voice (V)",
    "ロビーへ戻る（Esc）": "Back to lobby (Esc)",
    "術と叫び": "Spells & cries",
    "位階": "Rank",
    "術の枠": "Spell slots",
    "術の動きの見本": "Spell preview",
    "（自動）": "(auto)",
    "部品を選ぶと、この説明が切り替わる。": "Select a part to read its explanation here.",
    "この組み合わせに合わせて変更：{0}。選べない部品にふれると理由が分かる。": "Adjusted for this combination: {0}. Inspect unavailable parts for the reason.",
    "基本に戻る": "Back to basics",
    "術式を拡張する": "Expand the spell",
    "手ほどきの練習用。保存した4つの術は変更しない。": "Tutorial practice: your four saved spells are unchanged.",
    "相手の術を読み、破る術を組み直せ。": "Read your foe’s spell and rebuild a counter.",
    "まず術式台の作例から1つ選び、修練場で試す。戦場で相手の術を観察し、戻って組み替える。": "Choose a forge template and test it in practice. Observe enemy spells on the battlefield, then return and rebuild.",
    "作例から作る": "Build from a template",
    "作例は完成した術のテンプレート。選ぶと今の枠だけに読み込み、自由に改造できる。": "Templates are complete spells. Choosing one loads only the current slot, ready for your changes.",
    "ほかの作例も見る": "More templates",
    "何が起こる？": "What happens?",
    "何に使える？": "What is it useful for?",
    "弱点は？": "What is the weakness?",
    "動きの模式図。実際の威力・射程・相性は修練場で確かめる。": "Motion illustration. Test actual power, range and matchups in practice.",
    "達人の術・流派から学ぶ": "Learn from master spells and schools",
    "最初の一歩": "First steps",
    "術の放ち方": "How to cast",
    "PCはWASDで移動、マウスで照準、左クリックで詠唱。1〜4か下の枠で術を持ち替える。スマホは左側で移動、右側で照準と詠唱。押し続けると連続して放つ。": "PC: WASD to move, mouse to aim, left-click to chant. Switch with 1–4 or the bottom slots. Mobile: move on the left, aim and cast on the right. Hold to cast repeatedly.",
    "魔素から魔法が生まれる": "Magic begins with essence",
    "六原理の役割": "The six principles",
    "原理をつなぎ、使い方を変える": "Connect principles, change how you fight",
    "戦場のルールを詳しく読む": "Read detailed battlefield rules",
    "魔法の手ほどきを始める": "Start the magic tutorial",
    "変更はすぐ反映され、このブラウザに保存される。音が出ないときは、消音と音量の両方を確認する。": "Changes apply immediately and are saved in this browser. If sound is missing, check both mute and volume.",
    "言語を変えると画面を読み込み直す。戦場ではロビーへ戻ってから変更しよう。": "Changing language reloads the page. Leave the battlefield for the lobby before changing it.",
    "動きが重いときは「軽い」を選ぶ。術の演算や強さは変わらず、光と粒の描画を減らす。": "Choose Light if movement stutters. It reduces light and particle drawing while keeping spell rules and strength unchanged.",
    "効果音を鳴らす": "Enable sound effects",
    "音楽を鳴らす": "Enable music",
    "魔素に己の紋を刻み、術を編む。崩れた構造は魔素へ還り、次の術者の力となる。": "Imprint your crest upon essence and weave a spell. Fallen structures return to essence, becoming power for the next mage.",
    "力の向き": "Force direction",
    "纏：{0}": "Mantle: {0}",
    "F 合図（{0}）": "F signal ({0})",
    "器と原理から形を決める": "Shape chosen from vessel and principles",
    "見た目だけ。性能は原理で決まる": "Looks only. Principles decide performance",
    "白紙の弾から組む。器を選び、原理に点を振ろう": "Starting from a blank bolt. Pick a vessel and put points into principles",
    "術者へつなぎ、足を止める": "binds to the caster and pins the feet",
    "術者へつなぐ": "binds to the caster",
    "中心へつなぎ、足を止める": "binds to the center and pins the feet",
    "中心へつなぐ": "binds to the center",
    "壊し、糸を断つ": "breaks and cuts threads",
    "壊す": "breaks",
    "魔力を奪う": "steals mana",
    "自分の体と壁を直す（相手には効かない）": "repairs your own body and walls (no effect on foes)",
    "印を付ける（隠れられず、打撃が重くなる）": "marks (cannot hide, takes heavier hits)",
    "{0}段目：{1}": "Stage {0}: {1}",
    "（{0}）": " ({0})",
    "。": ". ",
    "原理なし。素の魔力だけ。": "No principles: raw mana only. ",
    "器そのもの：{0}。": "Vessel itself: {0}. ",
    "触れたもの：{0}。": "What it touches: {0}. ",
    "一撃の打撃 約{0}。": "About {0} per hit. ",
    "{0}、{1}段目を開く。": "{0}, it opens stage {1}. ",
    "糸でつながる（誘導・合図 F・回収 G ができるが、維持費がかかる）。": "Threaded (guide, signal with F, recall with G; costs upkeep).",
    "弾だけが選べる。": "Only bolts can choose this.",
    "追尾は制御容量を1使う。": "Seeking uses 1 control capacity.",
    "固体はエネルギーの構造を、光線はエネルギーの結界を大きく削る。": "Solid carves energy structures; rays shatter energy barriers.",
    "固体は遅く、エネルギーは固体の構造に弱い。": "Solid is slow; energy is weak against solid structures.",
    "動の点で触れたものを動かす向き。弾・線・纏・環の中心は術者、壁は触れた面、円は中心。": "The direction Motion moves what it touches. The center is the caster for bolts, rays, mantles and orbits, the touched face for walls, and the middle for fields.",
    "引けば相手を寄せ、押せば遠ざけ、回せば横へ流す。": "Pull drags foes in, push drives them away, spin sweeps them sideways.",
    "動の点がなければ働かない。": "Needs points in Motion.",
    "放った後も術者とつながる。": "Stays connected to the caster after release.",
    "追尾の弾を照準へ誘導し、F の合図で次の段を開き、G でほどいて魔力を戻す。": "Steer seeking bolts to your aim, open the next stage with F, unravel with G to regain mana.",
    "毎秒魔力を使い、遠すぎると切れる。制御容量を1使う。": "Drains mana each second and snaps if too far. Uses 1 control capacity.",
    "見た目": "Look",
    "弾と環の形。": "The form of bolts and orbits.",
    "好みの姿にする。": "Pick the form you like.",
    "性能は変わらない。": "Performance does not change.",
    "この器では：{0}": "In this vessel: {0}",
    "壊れる器（弾・面・環・結のある円）だけが選べる。": "Only breakable vessels (bolt, wall, orbit, field with Bind).",
    "線は一瞬で終わるので「触れたら」だけ。": "A ray is instant, so only \"On touch\".",
    "結の無い円は硬さを持たず、壊れない。結に点を振ろう。": "A field without Bind has no hardness and cannot break. Put points into Bind.",
    "線は光そのもの。質はエネルギーだけ。": "A ray is light itself: energy only.",
    "纏は自分の体。質は選ばない。": "A mantle is your own body: no matter to choose.",
    "軌道は弾だけが選べる。": "Only bolts have a path.",
    "見た目は弾と環だけが選べる。": "Only bolts and orbits have a look.",
    "「合図で」移る段があるので、糸が要る。": "A stage moves \"On signal\", so a thread is required.",
    "{0}段目の条件→{1}": "stage {0} condition → {1}",
    "{0}段目の質→{1}": "stage {0} matter → {1}",
    "糸→つなぐ": "thread → held",
    "質・大きさ・持続・糸を調整する。": "Adjust matter, size, duration and thread.",
    "器を選び、原理に点を振り、段をつなぐ。詳細を閉じても設定は残る。": "Pick a vessel, put points into principles, chain stages. Hidden settings are kept.",
    "容量 {0}": "Load {0}",
    "{0}段目": "Stage {0}",
    "原理なし": "No principle",
    "{0}段目を外す": "Remove stage {0}",
    "段は最大{0}つ。": "Up to {0} stages.",
    "段を足すと、この術が条件を満たした場所から次の器が開く。": "Add a stage and the next vessel opens where this one meets its condition.",
    "{0}を{1}点": "{0} to {1}",
    "{0}：器そのもの＝{1}／触れたもの＝{2}": "{0}: vessel itself = {1} / what it touches = {2}",
    "この器では働かない": "no effect on this vessel",
    "（器には効かない）": "(no effect on the vessel)",
    "触れたもの：{0}": "Touch: {0}",
    "弾：大きさは当たりの広さ、持続は射程。剣などは最大3倍の巨剣にできるが、160%を超えると魔力が急に増える。": "Bolt: size is hitbox, duration is range. Swords and the like can reach 3x size, but above 160% the mana cost climbs steeply.",
    "線：大きさは光の太さ。持続は無い。": "Ray: size is thickness. No duration.",
    "面：大きさは長さと硬さ、持続は立っている時間。": "Wall: size is length and toughness, duration is how long it stands.",
    "円：大きさは半径（消費は面積で増える）、持続は残る時間。": "Field: size is radius (cost grows with area), duration is how long it lingers.",
    "纏：持続は宿る時間。": "Mantle: duration is how long it lasts.",
    "環：大きさは回る半径、持続は回る時間。160%を超えると巨剣になり、魔力が急に増える。": "Orbit: size is radius, duration is how long it circles. Above 160% it becomes a giant blade, and the mana cost climbs steeply.",
    "切る": "Cut",
    "放った瞬間に糸を切る。維持費なし": "Cut the thread on release. No upkeep",
    "つなぐ": "Hold",
    "誘導・合図・回収ができる。維持費がかかり、制御容量を1使う": "Guide, signal and recall. Costs upkeep and 1 control capacity",
    "器：{0}": "Vessels: {0}",
    "いちばん重い段の一撃（増の複製は1発ぶん）。点を重ねるほど共鳴して重くなる": "The heaviest stage per hit (one copy for Grow). Stacking points resonates into heavier hits",
    "・糸": " · thread",
    "作例を選ぶ → 器と原理の点を変える → 段をつなぐ → 修練場で試す。決定すると選んだ枠に保存され、1〜4で持ち替えて放てる。": "Pick a template → change the vessel and principle points → chain stages → test in the training hall. Confirm to save to the chosen slot; switch with 1–4 and cast.",
    "＋ 段を足す": "+ Add stage",
    "この段を外す": "Remove this stage",
    "白紙から組む": "Start blank",
    "器": "Vessel",
    "何を作る": "Make what",
    "軌": "Path",
    "どう飛ぶ": "How it flies",
    "軌道（弾だけ）": "Path (bolts only)",
    "理": "Pr",
    "原理": "Principles",
    "0〜3点・重ねるほど強い": "0–3 points; stacking is stronger",
    "向": "Dir",
    "動の点があるとき": "with Motion",
    "次": "Next",
    "次の段へ": "To next stage",
    "移る条件": "Condition",
    "量": "Amt",
    "大きさ・持続": "Size · duration",
    "大きさ": "Size",
    "持続": "Duration",
    "性能は変わらない": "no effect on power",
    "空欄なら原理と器の名前。付けると放つときに唱える": "Blank uses principles and vessels. Named spells are called out when cast",
    "容量": "Load",
    "達人の術は今の枠だけ、流派は4つの枠すべてを置き換える。点と段が多い術は、初期の制御容量では暴発しやすい。": "A master spell replaces the current slot; a school replaces all four. Spells with many points and stages misfire easily at low control capacity.",
    "段": "Stages",
    "容量 {0}/{1}": "Load {0}/{1}",
    "容量 {0}・魔力 {1}": "Load {0} · mana {1}",
    "魔弾を放つ、壁で防ぐ、原理に点を振る、器を替える、段をつなぐ。修練場で魔法の仕組みを試そう。": "Cast a bolt, block with a wall, put points into principles, change the vessel, chain stages. Try how magic works in the training hall."
  },
  data: {
    "rooms": {
      "ichi": {
        "name": "First Hall",
        "note": "Standard size. Good for your first battle"
      },
      "sema": {
        "name": "The Narrows",
        "note": "Tight; fights break out fast"
      },
      "oo": {
        "name": "Great Hall",
        "note": "Wide. Survive until you grow big"
      },
      "dojo": {
        "name": "Training Hall",
        "note": "Test your spells on dummies. Nothing is recorded"
      }
    },
    "dummies": [
      {
        "name": "Dummy: Still"
      },
      {
        "name": "Dummy: Walker"
      },
      {
        "name": "Dummy: Wall"
      },
      {
        "name": "Dummy: Shooter"
      },
      {
        "name": "Dummy: Cannon"
      }
    ],
    "tiers": [
      {
        "name": "Crestless"
      },
      {
        "name": "First Crest"
      },
      {
        "name": "Second Crest"
      },
      {
        "name": "Third Crest"
      },
      {
        "name": "Fourth Crest"
      },
      {
        "name": "Fifth Crest"
      },
      {
        "name": "Crestsmith"
      },
      {
        "name": "Crest Saint"
      }
    ],
    "inks": {
      "pink": {
        "name": "Rose"
      },
      "blue": {
        "name": "Azure"
      },
      "yellow": {
        "name": "Gold"
      },
      "green": {
        "name": "Leaf"
      },
      "orange": {
        "name": "Flame"
      },
      "purple": {
        "name": "Violet"
      },
      "teal": {
        "name": "Jade"
      },
      "red": {
        "name": "Crimson"
      }
    },
    "crests": {
      "ring": "Ring",
      "bar": "Barred ring",
      "cross": "Cross",
      "lozenge": "Lozenge",
      "igeta": "Well frame",
      "scale": "Scales",
      "stars": "Three stars",
      "wheel": "Linked rings"
    },
    "botNames": [
      "Vesper",
      "Ashen",
      "Noctis",
      "Morrow",
      "Grave",
      "Umbra",
      "Sable",
      "Wraith",
      "Cinder",
      "Hollow",
      "Rook",
      "Crow",
      "Ember",
      "Lament",
      "Requiem",
      "Vigil",
      "Shroud",
      "Obsidian",
      "Thorn",
      "Omen",
      "Dusk",
      "Gloam",
      "Ravel",
      "Hex",
      "Mourn",
      "Solace",
      "Blight",
      "Styx",
      "Kestrel",
      "Nadir",
      "Onyx",
      "Pyre",
      "Quill",
      "Rune",
      "Sorrow",
      "Tallow",
      "Umber",
      "Vane",
      "Wither",
      "Zephyr"
    ],
    "cries": {
      "win": [
        "Victory is not proof. It is the start of the next question.",
        "What this crest records is not the victor's name, but a choice.",
        "For now, I shaped scattering power into protection.",
        "I won. Still, what I broke will not return.",
        "I did not read everything. I only overcame one doubt.",
        "Strength is knowing what you need not break.",
        "The hand that ties the thread and the hand that cuts it were the same.",
        "I will carry even the silence after victory.",
        "Not a difference in vessels. I simply kept choosing until the end.",
        "This win will not be the end.",
        "Know the weight of a different crest.",
        "It's over.",
        "Too slow.",
        "Scatter.",
        "Return to ash."
      ],
      "death": [
        "…My crest unravels. I was myself to the end.",
        "The vessel breaks, but the path I chose remains…",
        "Even scattering mana has a place to return…",
        "I will not forget what I failed to protect…",
        "This defeat, too, becomes part of the next structure…",
        "The thread is cut. I can entrust it to no one now…",
        "Winning was never the only right answer…",
        "Life scatters. Still, the wish remains…",
        "It wasn't the spell that erred. It was my fear…",
        "To the last fragment, my will is mine…",
        "Gh… aaagh!",
        "…So this is where it ends.",
        "Ngh… the dark takes me…",
        "Impossible… not me…",
        "Such regret…"
      ]
    },
    "defaultCries": {
      "win": "Behold — the power of the crest!",
      "death": "Ngh… I can't scatter yet…!"
    },
    "schools": [
      {
        "name": "Radiant Archer",
        "spells": [
          {
            "customName": "Meteor"
          },
          {
            "customName": "Heavenpiercer"
          },
          {
            "customName": "Bastion"
          },
          {
            "customName": "Gale"
          }
        ]
      },
      {
        "name": "Sword Saint",
        "spells": [
          {
            "customName": "Moonhaze Cut"
          },
          {
            "customName": "Double Sakura"
          },
          {
            "customName": "Shrinking Step"
          },
          {
            "customName": "Dusk Reaper"
          }
        ]
      },
      {
        "name": "Lord of the Keep",
        "spells": [
          {
            "customName": "Siegebreaker"
          },
          {
            "customName": "Golden Keep"
          },
          {
            "customName": "Absolute Wall"
          },
          {
            "customName": "Earthquake"
          }
        ]
      },
      {
        "name": "Hexweaver",
        "spells": [
          {
            "customName": "Miasma Seed"
          },
          {
            "customName": "Binding Chains"
          },
          {
            "customName": "Soul Eater"
          },
          {
            "customName": "Hollow Lance"
          }
        ]
      },
      {
        "name": "Demolitionist",
        "spells": [
          {
            "customName": "Blast Seal"
          },
          {
            "customName": "Skyfall"
          },
          {
            "customName": "Scattered Bloom"
          },
          {
            "customName": "Reversal"
          }
        ]
      },
      {
        "name": "Swarm Caller",
        "spells": [
          {
            "customName": "Thousand Petals"
          },
          {
            "customName": "Trident Thunder"
          },
          {
            "customName": "Soul Siphon"
          },
          {
            "customName": "Regrowth"
          }
        ]
      },
      {
        "name": "Thunder Emperor",
        "spells": [
          {
            "customName": "Thunder Spear"
          },
          {
            "customName": "Heaven's Lightning"
          },
          {
            "customName": "Thunder Ring"
          },
          {
            "customName": "Essence Well"
          }
        ]
      },
      {
        "name": "Mirror Witch",
        "spells": [
          {
            "customName": "Moon Ring"
          },
          {
            "customName": "Mirror Blossom"
          },
          {
            "customName": "Water Mirror"
          },
          {
            "customName": "Chain of Inertia"
          }
        ]
      }
    ],
    "principles": {
      "motion": {
        "name": "Motion",
        "short": "Motion",
        "self": "speeds up",
        "touch": "push, pull, spin"
      },
      "bind": {
        "name": "Binding",
        "short": "Bind",
        "self": "hardens",
        "touch": "binds to the vessel center"
      },
      "divide": {
        "name": "Division",
        "short": "Divide",
        "self": "sharpens",
        "touch": "breaks"
      },
      "convert": {
        "name": "Conversion",
        "short": "Convert",
        "self": "absorbs incoming mana",
        "touch": "steals mana"
      },
      "grow": {
        "name": "Growth",
        "short": "Grow",
        "self": "more copies and time",
        "touch": "mends your own crest"
      },
      "phase": {
        "name": "Phase",
        "short": "Phase",
        "self": "unseen, slips through Bind",
        "touch": "marks"
      }
    },
    "chant": {
      "a": {
        "motion": "Run swift",
        "bind": "Bind and harden",
        "divide": "Come undone",
        "convert": "Shift and return",
        "grow": "Sprout and fill",
        "phase": "Phase, waver"
      },
      "b": {
        "motion": "tearing the wind",
        "bind": "layering bonds",
        "divide": "splitting reason",
        "convert": "rewriting the crest",
        "grow": "carrying life",
        "phase": "crossing shadows",
        "none": ""
      },
      "vessel": {
        "bolt": "",
        "ray": "pierce",
        "wall": "become a wall",
        "field": "fill the field",
        "body": "dwell in me",
        "orbit": "circle me"
      },
      "then": {
        "hit": "on touch",
        "end": "when spent",
        "signal": "at my signal",
        "break": "when shattered"
      }
    },
    "craft": {
      "naming": {
        "join": " ",
        "stageSep": " → ",
        "empty": "Bare"
      },
      "vessels": {
        "bolt": {
          "name": "Bolt",
          "note": "A mass of mana flying to your aim. It can open the next stage where it touches a foe, a wall or the aim point"
        },
        "ray": {
          "name": "Ray",
          "note": "Light that extends in an instant and pierces foes in a line. Stopped by placed walls. Heavy, but barely fades"
        },
        "wall": {
          "name": "Wall",
          "note": "A wall rising at the aim point. It stops everyone's bodies, shots and rays (your own too)"
        },
        "field": {
          "name": "Field",
          "note": "A field opening at the aim point. Strong the moment it opens, weaker while it lingers"
        },
        "body": {
          "name": "Mantle",
          "note": "Your own body becomes the vessel. Principles dwell in you and act on whoever you touch"
        },
        "orbit": {
          "name": "Orbit",
          "note": "Circles around you, catching incoming shots and acting on whoever it touches"
        }
      },
      "paths": {
        "straight": {
          "name": "Straight",
          "note": "Flies straight. Fast"
        },
        "arc": {
          "name": "Arc",
          "note": "Arcs over walls and rocks and lands at the aim point"
        },
        "seek": {
          "name": "Seek",
          "note": "Curves toward large foreign mana. With a thread you can steer it to your aim. Uses 1 control capacity"
        },
        "return": {
          "name": "Return",
          "note": "Turns back halfway and returns to your hand, hitting on the way back. Catching it refunds mana"
        }
      },
      "thens": {
        "hit": {
          "name": "On touch",
          "note": "The next stage opens where it touches a foe, wall or the aim point. A mantle triggers when you touch or are hit"
        },
        "end": {
          "name": "When spent",
          "note": "The next stage opens when its duration (a bolt's range) runs out. Makes delayed tricks"
        },
        "signal": {
          "name": "On signal",
          "note": "The next stage opens on your F signal. Needs a thread (added automatically)"
        },
        "break": {
          "name": "When broken",
          "note": "The next stage opens where the vessel is destroyed. Bolts, walls, orbits and fields with Bind only"
        }
      },
      "forces": {
        "push": {
          "name": "Push out"
        },
        "pull": {
          "name": "Pull in"
        },
        "spin": {
          "name": "Spin aside"
        }
      },
      "matters": {
        "energy": {
          "name": "Energy",
          "note": "Light and heat. Fast but fades at range. Weak against solid structures; rays shatter energy structures"
        },
        "solid": {
          "name": "Solid",
          "note": "Hardened into crystal. Slow but heavy, pushes foes and holds its power. Carves energy structures. Solid structures are tough"
        }
      },
      "selfText": {
        "bolt": {
          "motion": "flies faster",
          "bind": "wins midair clashes",
          "divide": "pierces {n} bodies and carves walls",
          "convert": "absorbs bolts it overpowers",
          "grow": "splits into {c} (each lighter)",
          "phase": "hard to see; slips through walls with Bind below {n}"
        },
        "ray": {
          "motion": "reaches farther",
          "bind": "",
          "divide": "carves walls hard",
          "convert": "",
          "grow": "splits into {c} rays (each lighter)",
          "phase": "slips through walls and barriers with Bind below {n}"
        },
        "wall": {
          "motion": "advances toward your aim, shoving bodies",
          "bind": "hardens",
          "divide": "",
          "convert": "turns blocked strikes into mana",
          "grow": "grows longer",
          "phase": "hard to see"
        },
        "field": {
          "motion": "drifts toward your aim",
          "bind": "becomes a barrier that stops shots",
          "divide": "snuffs foreign shots the moment it opens",
          "convert": "drains mana from foreign shots passing through",
          "grow": "lingers longer",
          "phase": "hard to see (a trap)"
        },
        "body": {
          "motion": "your feet get faster",
          "bind": "you take less damage",
          "divide": "shakes off slows and binds",
          "convert": "turns part of damage taken into mana",
          "grow": "your body regenerates",
          "phase": "hides you; walk through walls with Bind below {n}"
        },
        "orbit": {
          "motion": "circles faster",
          "bind": "blades harden",
          "divide": "",
          "convert": "turns caught shots into mana",
          "grow": "{c} blades",
          "phase": "hard to see"
        }
      }
    },
    "shapes": {
      "needle": {
        "name": "Needle"
      },
      "orb": {
        "name": "Orb"
      },
      "shard": {
        "name": "Shard"
      },
      "arrow": {
        "name": "Arrow"
      },
      "blade": {
        "name": "Sword"
      },
      "katana": {
        "name": "Katana"
      },
      "scythe": {
        "name": "Scythe"
      },
      "axe": {
        "name": "Axe"
      },
      "hammer": {
        "name": "Hammer"
      },
      "shuriken": {
        "name": "Shuriken"
      },
      "chakram": {
        "name": "Chakram"
      },
      "spear": {
        "name": "Spear"
      },
      "castle": {
        "name": "Castle"
      }
    },
    "presets": {
      "bolt": {
        "label": "Arcane bolt"
      },
      "lance": {
        "label": "Crystal lance"
      },
      "shotgun": {
        "label": "Scattershot"
      },
      "seeker": {
        "label": "Seeker needle"
      },
      "chakram": {
        "label": "Returning ring"
      },
      "ray": {
        "label": "Severing ray"
      },
      "anchor": {
        "label": "Chain anchor"
      },
      "ghost": {
        "label": "Wallpiercer"
      },
      "burst": {
        "label": "Burst orb"
      },
      "well": {
        "label": "Gravity well"
      },
      "cluster": {
        "label": "Cluster shot"
      },
      "remote": {
        "label": "Remote blast"
      },
      "mine": {
        "label": "Hidden mine"
      },
      "stoneWall": {
        "label": "Stone wall"
      },
      "drainWall": {
        "label": "Draining wall"
      },
      "counterWall": {
        "label": "Counter wall"
      },
      "barrier": {
        "label": "Barrier"
      },
      "guardRing": {
        "label": "Guard ring"
      },
      "bladeRing": {
        "label": "Blade ring"
      },
      "haste": {
        "label": "Swiftness"
      },
      "harden": {
        "label": "Harden"
      },
      "mend": {
        "label": "Regrowth"
      },
      "cloak": {
        "label": "Cloak"
      },
      "absorb": {
        "label": "Absorbing mantle"
      }
    },
    "howto": [
      [
        "Move",
        "WASD / arrow keys"
      ],
      [
        "Switch spells",
        "1·2·3·4 / wheel / click a slot"
      ],
      [
        "Cast",
        "Aim with the mouse, left click (hold to keep chanting)"
      ],
      [
        "Dodge",
        "Right click / Space"
      ],
      [
        "Signal",
        "F (tells \"On signal\" spells to open their next stage)"
      ],
      [
        "Recall",
        "G (unravels threaded spells, returning some mana)"
      ],
      [
        "Spell forge",
        "T (in the training hall, lobby, or after falling)"
      ],
      [
        "Sound",
        "M sound effects, N music, V voice (none / names / names & cries), B change track. More in Settings"
      ]
    ],
    "rules": [
      "Build spells in the spell forge. Choose a vessel (bolt, ray, wall, field, mantle, orbit) and put 0–3 points into the six principles. A principle acts by the same rule on the vessel itself and on whatever the vessel touches.",
      "Motion speeds up and pushes, Bind hardens and binds, Divide sharpens and breaks, Convert absorbs and steals, Grow adds copies and time and mends your own, Phase hides, slips through Bind and marks what it touches.",
      "Chain stages to grow a spell: a bolt that opens a field on touch, a wall that strikes back when broken, a trap you detonate with F. Conditions are On touch, When spent, On signal, When broken. Up to 3 stages.",
      "Stacked points resonate (1 point = 1, 2 = 2.2, 3 = 3.6): simple spells hit hardest, mixed spells are versatile. Points, stage links, threads and seeking all use control capacity: 4 at LV0, 5 at LV3, 7 at LV7, 9 at LV12. Beyond it, a spell may misfire as you cast.",
      "Vessels are Solid or Energy. Solid is slow and heavy and carves energy structures. Energy is fast but weak against solid structures. Rays shatter energy barriers. Placed walls stop everyone's bodies, shots and rays regardless of matter, even the strike that breaks them.",
      "A bolt, ray or body with more Phase points than a structure's Bind points slips through it. Thicker Bind stops Phase. Rocks cannot be passed.",
      "Shots of different crests collide in midair: solid clashes, energy cancels, mixed matter pierces and weakens. Bolts with Bind win clashes; bolts with Convert absorb what they overpower. Your own shots fuse, and shots passing your energy fields resonate.",
      "The six crests on the floor are the Nodes of the six principles. Stand in a ring to empower spells with that principle, lower their cost, and let mana well up. Standing in the central Keystone Circle raises control capacity by 1.",
      "Test your spells on dummies in the training hall. Press T there to rebuild at any time.",
      "On the battlefield, collect the glowing motes (essence) to grow and restore mana. Mana does not refill by itself (it wells up only inside the nodes). Essence is your score. Scattered foes spill their essence, and you take some of their mana.",
      "When you fall, the run ends. Your score and place become rank points. Jump right back in."
    ],
    "learning": {
      "parts": {
        "principle": {
          "motion": [
            "Vessel itself: speeds up. Bolts fly faster, walls and fields advance toward your aim, orbits spin faster, a mantle speeds your feet.",
            "What it touches: push, pull or spin. A pulling bolt drags the foe toward you.",
            "Lighter damage than Divide. Pushing too hard sends foes out of range."
          ],
          "bind": [
            "Vessel itself: hardens. Walls, orbits and fields gain toughness; a field with Bind becomes a barrier that stops shots. A mantle reduces damage taken.",
            "What it touches: binds it to the vessel's center — the caster for bolts, the middle for fields. 3 points also pin the feet.",
            "Dodging and distance break the bond. Strong Divide strikes crumble walls."
          ],
          "divide": [
            "Vessel itself: sharpens. It carves structures harder and a bolt pierces one body per point. A mantle shakes off slows and binds.",
            "What it touches: breaks. The biggest damage. 2+ points also cut the foe's threads.",
            "Costly. Tough walls need the right matter and Phase."
          ],
          "convert": [
            "Vessel itself: absorbs incoming mana. Strikes caught by walls and orbits, and part of the damage a mantle takes, become your mana.",
            "What it touches: steals mana, 60% of it returning to you.",
            "Adds no damage. Stealing mana does not hurt the body."
          ],
          "grow": [
            "Vessel itself: more copies and time. Bolts and rays fan out, orbits gain blades, fields linger, walls lengthen. A mantle regenerates your body.",
            "What it touches: mends your own crest — your body inside your field, your own walls.",
            "Each copy is lighter (the total rises). No effect on foes."
          ],
          "phase": [
            "Vessel itself: unseen, slips through Bind. With more Phase than a wall's or barrier's Bind, it passes through. A mantle hides you and lets you walk through walls.",
            "What it touches: marks it. Marked foes cannot hide and take slightly heavier hits.",
            "Approaching, chanting or being hit reveals you. Rocks cannot be passed."
          ]
        },
        "vessel": {
          "bolt": [
            "A mass of mana flying to your aim.",
            "The basic attack. Paths (arc, seek, return) and stages transform it.",
            "Straight shots can be sidestepped. Walls stop them."
          ],
          "ray": [
            "Light that extends in an instant and pierces foes in a line.",
            "Distant foes, shattering energy barriers.",
            "Long chant and high cost. Placed walls stop it."
          ],
          "wall": [
            "A wall rising at the aim point.",
            "Cut lines of fire. With Motion it advances; with Divide it hurts to touch.",
            "It also stops your own body and spells. Divide and Solid carve it."
          ],
          "field": [
            "A field opening at the aim point, strong when it opens and weaker while it lingers.",
            "Area attacks, traps, barriers (Bind), healing fields (Grow).",
            "Useless once foes step out."
          ],
          "body": [
            "Your own body becomes the vessel.",
            "Haste, hardening, regeneration, cloaking, body blows.",
            "Only one at a time. Reaches no one far away."
          ],
          "orbit": [
            "Blades or ramparts circling you.",
            "Catch incoming shots and act on foes who come close.",
            "No reach. Blades shatter when carved down."
          ]
        },
        "then": {
          "hit": [
            "The next stage opens where it touches.",
            "Bolts that burst on impact, traps that spring when stepped on, mantles that strike back when hit.",
            "Misses open nothing (a bolt opens at the aim point)."
          ],
          "end": [
            "The next stage opens when the duration runs out.",
            "Delayed blasts, bolts that split midair, seamless defenses.",
            "The foe may not wait."
          ],
          "signal": [
            "The next stage opens on your F signal.",
            "Detonate placed traps whenever you like.",
            "The thread costs upkeep and snaps if too far."
          ],
          "break": [
            "The next stage opens where the vessel is destroyed.",
            "Walls and orbits that strike back when broken.",
            "Nothing opens if it is never broken."
          ]
        }
      },
      "world": [
        [
          "Essence and mana",
          "The glowing motes on the ground are essence. Absorbed, they become mana bearing your crest. Spells spend mana; collect essence or stand in a node ring to refill."
        ],
        [
          "Crests and structures",
          "A crest marks who owns the mana. Your attacks never hurt you, but placed walls are structures, so they also stop your own body, shots and rays."
        ],
        [
          "Dissipation and threads",
          "Released spells eventually unravel. Holding a thread lets you guide, signal and recall, but it costs upkeep and has a range limit."
        ],
        [
          "From principles to phenomena",
          "This is not a world of fire or lightning elements. The six principles shape the motion and form of essence, appearing as light, shocks, crystals and barriers."
        ]
      ],
      "tutorial": [
        [
          "Motion and Divide: cast a bolt",
          "Aim your arcane bolt (Motion 1, Divide 1) at the dummy ahead and cast twice. PC: aim with the mouse and left click. Mobile: touch the right side. The blue bar is mana. Practice spells never change your saved four."
        ],
        [
          "Bind: block with a wall",
          "Slot 1 is now a Stone wall (a wall with Bind 3). Raise it between you and the dummy and block one shot. Walls also stop your own body and spells. Move behind it with WASD / the left side."
        ],
        [
          "Add a principle",
          "Open the forge, put at least 1 point into Bind on your bolt in slot 1 and confirm. Hit the dummy with it. Bind ties what it touches to the vessel's center — for a bolt, to you."
        ],
        [
          "Change the vessel",
          "In the forge, change slot 1's vessel to Orbit, confirm and cast. The same principles become blades circling you. The vessel changes, the principles keep their meaning."
        ],
        [
          "Divide: break the wall",
          "The dummy put up a wall. In the forge, raise Divide on your bolt to 2 or more and fire. Divide carves structures. The strike that breaks a wall still stops there, so fire again."
        ],
        [
          "Chain stages",
          "In the forge, press \"Add stage\" and make your bolt open a field in stage 2 \"On touch\". Put points into the field too and hit the moving dummy."
        ],
        [
          "Observe, rebuild, fight again",
          "On the battlefield, watch foes' spells and lines of fire. Try Divide or Phase against walls, sidestepping against seekers, rays or Solid against barriers. Refill mana from essence or nodes. Edit spells in the training hall or before entering. Practice spells are restored here."
        ]
      ],
      "example": "A bolt with only Motion is fast and pushes. Add Divide and it breaks; add Bind and it chains the foe to you. The same points on a field cover an area; on a mantle they dwell in your body. Chain \"a bolt that opens a field on touch\" and you have a burst orb. Principles decide what happens; vessels and stages decide how you use it."
    }
  }
};

// ═══ 中文（简体） ══════════════════════════════════════════════════
LANG.zh = {
  ui: {
    "・": "·",
    "！": "！",
    "／": "／",
    "自動（スマホや重い端末は軽く）": "自动（手机和低性能设备自动减轻）",
    "高い": "高",
    "軽い（スマホ向け）": "轻（适合手机）",
    "画質を軽くした": "已降低画质",
    "起爆": "起爆",
    "回収": "回收",
    "画質": "画质",
    "自分の紋の魔力を体へ書き込んだ": "将自身纹章的魔力写入了身体",
    "暴発": "暴发",
    "「{0}」は制御容量を超えていた": "「{0}」超出了控制容量",
    "術式が…崩れる！": "术式……要崩溃了！",
    "結界崩壊": "结界崩坏",
    "貫通": "贯通",
    "剥離": "剥离",
    "「{0}」の節点": "「{0}」之节点",
    "{0}を含む術が強まり（威力 ×{1}・消費 ×{2}）、輪の中では魔力が湧き出る": "含{0}的术得到强化（威力 ×{1}·消耗 ×{2}），圈内魔力会涌出",
    "要の陣": "要之阵",
    "ここに立つ間は制御容量が +{0}。重い術を暴発させずに扱える": "站在此处时控制容量 +{0}。可稳定施放重型术",
    "共鳴": "共鸣",
    "相殺": "抵消",
    "融合": "融合",
    "魔装": "魔装",
    "誘爆": "诱爆",
    "魔力が尽きた": "魔力耗尽",
    "+{0} 魔力": "+{0} 魔力",
    "糸が切れた": "丝线断了",
    "術者から離れすぎた": "离施术者太远",
    "糸を断たれた": "丝线被切断",
    "回収 +{0} 魔力": "回收 +{0} 魔力",
    "糸でつながった術式 {0} つをほどいた": "解开了 {0} 个丝线相连的术式",
    "構造崩壊": "结构崩坏",
    "{0} を散らした": "击散了 {0}",
    "+{0} 魔素": "+{0} 魔素",
    "制御容量が {0} になった。より重い術を安定して放てる": "控制容量提升至 {0}。可以稳定施放更重的术",
    "次の制御容量まで育て": "继续成长以获得下一级控制容量",
    "曲を変えた": "已切换曲目",
    "声なし": "无语音",
    "技名だけ": "仅技名",
    "技名と叫び": "技名与呐喊",
    "声：{0}": "语音：{0}",
    "要の陣 ― 制御容量 +{0}": "要之阵 ― 控制容量 +{0}",
    "{0}の節点 ― {0}の術が強まり、魔力が湧く": "{0}之节点 ― {0}之术强化，魔力涌出",
    "{0}人": "{0}人",
    "LV {0}・制御容量 {1}": "LV {0}·控制容量 {1}",
    "（LV{0}で{1}）": "（LV{0} 时为 {1}）",
    "魔力 {0}": "魔力 {0}",
    "・暴発 {0}%": "·暴发 {0}%",
    "糸 {0}": "丝线 {0}",
    "G 回収": "G 回收",
    "与えた威力 {0}・毎秒 {1}": "造成伤害 {0}·每秒 {1}",
    "受けた威力 {0}・防いだ {1}": "承受伤害 {0}·抵挡 {1}",
    "攻撃人形：撃つ": "攻击人偶：开火",
    "攻撃人形：止める": "攻击人偶：停止",
    "{0} に散らされた": "被 {0} 击散",
    "結界の外で散った": "在结界外消散",
    "{0} が結界に散った": "{0} 消散了",
    "攻撃人形が撃ちはじめた": "攻击人偶开始射击",
    "攻撃人形を止めた": "已停止攻击人偶",
    "受けた威力と、結界で防いだ数を数える（修練場では散らない）": "统计承受的伤害与结界挡下的次数（修炼场中不会消散）",
    "技": "技",
    "声": "声",
    "声：{0}（V で切り替え）": "语音：{0}（按 V 切换）",
    "自動（ブラウザに合わせる）": "自动（跟随浏览器）",
    "　◆自然": "　◆自然",
    "（日本語の声が見つからない）": "（未找到该语言的语音）",
    "首位　{0}　{1}": "首位　{0}　{1}",
    "次の「{0}」まで {1} pt": "距「{0}」还差 {1} pt",
    "最上位の位階": "最高位阶",
    "{0}位": "第{0}名",
    "撃破 {0}": "击破 {0}",
    "<li class=\"empty\">まだ入場していない</li>": "<li class=\"empty\">尚未参战</li>",
    "なし": "无",
    "自動": "自动",
    "作例「{0}」を {1} に読み込んだ": "已将范例「{0}」载入第 {1} 格",
    "流派「{0}」の4つの術を読み込んだ（{1}）": "已载入流派「{0}」的四个术（{1}）",
    "{0}の「{1}」を {2} に読み込んだ": "已将{0}的「{1}」载入第 {2} 格",
    "初期の4つに戻した": "已恢复初始四个术",
    "{0}秒": "{0}秒",
    "LV{0}〜 容量{1}": "LV{0}起 容量{1}",
    "・安定": "·稳定",
    "決定して試す": "确定并试用",
    "修練場で試す": "在修炼场试用",
    "名無し": "无名氏",
    "人形を相手に術を試す。T で術式台、Esc で戻る": "以人偶试术。T 打开术式台，Esc 返回",
    "術を放つと入場保護が解ける": "施术后入场保护解除",
    "左をなぞって歩く": "滑动左侧移动",
    "右をタッチして放つ": "点击右侧施术",
    "下の枠で持ち替え": "用下方栏位切换",
    "左クリック": "左键",
    "放つ": "施放",
    "持ち替え": "切换",
    "回避": "闪避",
    "退出": "退出",
    "歩く": "移动",
    "マウスで狙う": "鼠标瞄准",
    "画面の右半分をタッチ": "点击屏幕右半边",
    "T で術式台": "T 打开术式台",
    "決定 / Esc": "确定 / Esc",
    "上の「術式台」ボタン": "上方的「术式台」按钮",
    "修練場に残る": "留在修炼场",
    "手ほどきを終える": "结束教学",
    "結界の外で構造が崩れた": "在结界外结构崩坏",
    "{0}・計 {1} pt": "{0}·共 {1} pt",
    "表示で問題が起きた": "画面出现问题",
    "このまま遊べるが、続くときは再読み込みしてほしい": "可以继续游玩，若持续出现请重新载入",
    "光のにじみを切った": "已关闭光晕",
    "動きが重かったため。設定で戻せる": "因运行较卡。可在设置中恢复",
    "PRIMA 紋戦": "PRIMA 纹战",
    "このゲームは JavaScript で動きます。ブラウザの設定で JavaScript を有効にしてください。": "本游戏需要 JavaScript。请在浏览器设置中启用。",
    "魔素": "魔素",
    "撃破": "击破",
    "一の間": "一之间",
    "手ほどき": "教学",
    "戦場へ入る": "进入战场",
    "構造": "结构",
    "魔力": "魔力",
    "避": "避",
    "修練場": "修炼场",
    "与えた威力 0": "造成伤害 0",
    "受けた威力 0・防いだ 0": "承受伤害 0·抵挡 0",
    "術式台": "术式台",
    "ロビーへ": "大厅",
    "音": "音",
    "曲": "曲",
    "紋戦": "纹战",
    "はじめての方へ": "新手指引",
    "手ほどきを始める": "开始教学",
    "名前": "名字",
    "光の色": "光的颜色",
    "紋": "纹章",
    "丸": "圆",
    "ルーム": "房间",
    "戦場の参加者はいまはBotです。オンライン対戦は準備中。": "目前战场上的对手都是 Bot。联网对战筹备中。",
    "遊び方": "玩法",
    "設定（声・音・画面）": "设置（语音·声音·画面）",
    "術": "术",
    "術式台を開く": "打开术式台",
    "勝利宣言": "胜利宣言",
    "倒したときに叫ぶ": "击倒对手时喊出",
    "断末魔": "临终之言",
    "散ったときに叫ぶ": "消散时喊出",
    "声で試す": "试听语音",
    "無": "無",
    "無紋": "无纹",
    "次の位階まで 250 pt": "距下一位阶 250 pt",
    "最高魔素": "最高魔素",
    "最高順位": "最高名次",
    "通算撃破": "累计击破",
    "入場": "参战",
    "最近の入場": "最近参战",
    "散った": "已消散",
    "生存": "存活",
    "位階が上がった": "位阶提升",
    "もう一度入る": "再次进入",
    "術式を組み直す": "重新构筑术式",
    "決定": "确定",
    "形": "形",
    "放った後": "放出之后",
    "糸": "丝线",
    "威力": "威力",
    "質": "质",
    "固めるか": "是否凝固",
    "固体／エネルギー": "固体／能量",
    "魔弾針": "魔弹针",
    "詠唱": "咏唱",
    "遠くで": "远处",
    "制御容量と暴発": "控制容量与暴发",
    "部品にふれると、その意味がここに出る": "指向部件即可在此看到说明",
    "達人の流派": "达人流派",
    "Bot が修める4つの術を丸ごと読み込む": "整套载入 Bot 所修的四个术",
    "達人の術": "达人之术",
    "初期の4つに戻す": "恢复初始四个",
    "閉じる": "关闭",
    "設定": "设置",
    "言語": "语言",
    "名前を付けた術を放つとき、その技名を叫ぶ。「技名と叫び」は勝利宣言と断末魔も声に出す。": "施放已命名的术时喊出技名。「技名与呐喊」也会念出胜利宣言与临终之言。",
    "声の種類": "语音种类",
    "試す": "试听",
    "「Natural」「Online」と付いた声がいちばん人に近い（Edge・Chrome で使える）。": "带「Natural」「Online」的语音最接近真人（Edge·Chrome 可用）。",
    "効果音": "音效",
    "音楽": "音乐",
    "曲を変える": "切换曲目",
    "光のにじみ": "光晕",
    "術の光がまわりへにじむ。重いときは切る": "术的光向四周晕开。卡顿时请关闭",
    "原理を接続して自分の術を組み、ルームの乱戦で放つ。魔素を拾い、散らして奪い、散ったらすぐ入りなおす魔法の乱戦。": "连接原理构筑自己的术，在房间乱战中释放。拾取魔素、击散夺取、消散后立即重返的魔法乱战。",
    "PRIMA 紋戦 — 術を組み、乱戦で放て": "PRIMA 纹战 — 构筑术式，于乱战中释放",
    "原理をつないで自分だけの魔法を組み、魔導士の乱戦で放つブラウザゲーム。登録不要・すぐ遊べる。": "连接原理构筑专属魔法，在魔导士乱战中释放的浏览器游戏。免注册，即开即玩。",
    "戦場": "战场",
    "自分の状態": "自身状态",
    "順位": "排名",
    "体と刻印": "身体",
    "回避（右クリック / Space）": "闪避（右键 / Space）",
    "射（槍・魔弾・日本刀・手裏剣）と砲（光線・斧）の人形が撃ってくる": "射手人偶（枪·魔弹·日本刀·手里剑）与炮手人偶（光线·斧）会攻击你",
    "全体図": "全图",
    "効果音（M）": "音效（M）",
    "音楽（N）": "音乐（N）",
    "声（V）": "语音（V）",
    "ロビーへ戻る（Esc）": "返回大厅（Esc）",
    "術と叫び": "术与呐喊",
    "位階": "位阶",
    "術の枠": "术栏",
    "術の動きの見本": "术的动作示范",
    "（自動）": "（自动）",
    "部品を選ぶと、この説明が切り替わる。": "选择部件后这里会显示相应说明。",
    "この組み合わせに合わせて変更：{0}。選べない部品にふれると理由が分かる。": "为此组合调整：{0}。查看不可选部件可了解原因。",
    "基本に戻る": "返回基本",
    "術式を拡張する": "扩展术式",
    "手ほどきの練習用。保存した4つの術は変更しない。": "手把手练习用，不改变已保存的四个术。",
    "相手の術を読み、破る術を組み直せ。": "看穿对方的术，重组破解之术。",
    "まず術式台の作例から1つ選び、修練場で試す。戦場で相手の術を観察し、戻って組み替える。": "先在术式台选作例并在修练场试用。战场观察敌术，再回来重组。",
    "作例から作る": "从作例制作",
    "作例は完成した術のテンプレート。選ぶと今の枠だけに読み込み、自由に改造できる。": "作例是完整术的模板，只载入当前栏，可自由改造。",
    "ほかの作例も見る": "更多作例",
    "何が起こる？": "会发生什么？",
    "何に使える？": "能用来做什么？",
    "弱点は？": "弱点是什么？",
    "動きの模式図。実際の威力・射程・相性は修練場で確かめる。": "动作示意图，实际威力、射程与相性请在修练场确认。",
    "達人の術・流派から学ぶ": "学习达人术与流派",
    "最初の一歩": "第一步",
    "術の放ち方": "如何施术",
    "PCはWASDで移動、マウスで照準、左クリックで詠唱。1〜4か下の枠で術を持ち替える。スマホは左側で移動、右側で照準と詠唱。押し続けると連続して放つ。": "PC用WASD移动、鼠标瞄准、左键咏唱，1～4或底栏换术。手机左侧移动、右侧瞄准施术。按住连续施放。",
    "魔素から魔法が生まれる": "魔法由魔素诞生",
    "六原理の役割": "六原理的作用",
    "原理をつなぎ、使い方を変える": "连接原理，改变用法",
    "戦場のルールを詳しく読む": "详读战场规则",
    "魔法の手ほどきを始める": "开始魔法入门",
    "変更はすぐ反映され、このブラウザに保存される。音が出ないときは、消音と音量の両方を確認する。": "修改立即生效并保存在此浏览器。没有声音时同时检查静音与音量。",
    "言語を変えると画面を読み込み直す。戦場ではロビーへ戻ってから変更しよう。": "修改语言会重新加载，战场中请先返回大厅再修改。",
    "動きが重いときは「軽い」を選ぶ。術の演算や強さは変わらず、光と粒の描画を減らす。": "运行卡顿时选轻量，仅减少光与粒子的绘制，不改变术的运算与强度。",
    "効果音を鳴らす": "开启音效",
    "音楽を鳴らす": "开启音乐",
    "魔素に己の紋を刻み、術を編む。崩れた構造は魔素へ還り、次の術者の力となる。": "将自己的纹刻入魔素，编织术式。崩解的结构归于魔素，成为下一位术者的力量。",
    "力の向き": "力的方向",
    "纏：{0}": "缠：{0}",
    "F 合図（{0}）": "F 信号（{0}）",
    "器と原理から形を決める": "由器与原理决定形状",
    "見た目だけ。性能は原理で決まる": "仅外观。性能由原理决定",
    "白紙の弾から組む。器を選び、原理に点を振ろう": "从空白的弹开始构筑。选择器，为原理分配点数",
    "術者へつなぎ、足を止める": "连向施术者并定住双脚",
    "術者へつなぐ": "连向施术者",
    "中心へつなぎ、足を止める": "连向中心并定住双脚",
    "中心へつなぐ": "连向中心",
    "壊し、糸を断つ": "破坏并切断丝线",
    "壊す": "破坏",
    "魔力を奪う": "夺取魔力",
    "自分の体と壁を直す（相手には効かない）": "修复自己的身体与墙（对敌人无效）",
    "印を付ける（隠れられず、打撃が重くなる）": "打上印记（无法隐身，受击加重）",
    "{0}段目：{1}": "第{0}段：{1}",
    "（{0}）": "（{0}）",
    "。": "。",
    "原理なし。素の魔力だけ。": "无原理。仅有纯魔力。",
    "器そのもの：{0}。": "器本身：{0}。",
    "触れたもの：{0}。": "触及之物：{0}。",
    "一撃の打撃 約{0}。": "每击约{0}。",
    "{0}、{1}段目を開く。": "{0}，展开第{1}段。",
    "糸でつながる（誘導・合図 F・回収 G ができるが、維持費がかかる）。": "以丝线相连（可引导、F 信号、G 回收，但需维持费）。",
    "弾だけが選べる。": "只有弹可以选择。",
    "追尾は制御容量を1使う。": "追踪占用1控制容量。",
    "固体はエネルギーの構造を、光線はエネルギーの結界を大きく削る。": "固体大幅削弱能量结构，光线大幅削弱能量结界。",
    "固体は遅く、エネルギーは固体の構造に弱い。": "固体较慢，能量不敌固体结构。",
    "動の点で触れたものを動かす向き。弾・線・纏・環の中心は術者、壁は触れた面、円は中心。": "「动」推动触及之物的方向。弹、线、缠、环的中心是施术者，墙是接触面，圆是中心。",
    "引けば相手を寄せ、押せば遠ざけ、回せば横へ流す。": "拉则拉近，推则推远，旋则侧移。",
    "動の点がなければ働かない。": "没有「动」的点数则无效。",
    "放った後も術者とつながる。": "放出后仍与施术者相连。",
    "追尾の弾を照準へ誘導し、F の合図で次の段を開き、G でほどいて魔力を戻す。": "将追踪弹引向准星，用 F 信号展开下一段，用 G 解开并返还魔力。",
    "毎秒魔力を使い、遠すぎると切れる。制御容量を1使う。": "每秒消耗魔力，过远则断。占用1控制容量。",
    "見た目": "外观",
    "弾と環の形。": "弹与环的形状。",
    "好みの姿にする。": "选择喜欢的样子。",
    "性能は変わらない。": "性能不变。",
    "この器では：{0}": "在此器中：{0}",
    "壊れる器（弾・面・環・結のある円）だけが選べる。": "只有会被破坏的器（弹、墙、环、有「结」的圆）可选。",
    "線は一瞬で終わるので「触れたら」だけ。": "线瞬间结束，只能选「触及时」。",
    "結の無い円は硬さを持たず、壊れない。結に点を振ろう。": "没有「结」的圆没有硬度，不会被破坏。请为「结」分配点数。",
    "線は光そのもの。質はエネルギーだけ。": "线就是光本身，只能是能量。",
    "纏は自分の体。質は選ばない。": "缠是自己的身体，不选质。",
    "軌道は弾だけが選べる。": "只有弹可以选择轨道。",
    "見た目は弾と環だけが選べる。": "只有弹与环可以选择外观。",
    "「合図で」移る段があるので、糸が要る。": "有「信号时」进入的段，因此需要丝线。",
    "{0}段目の条件→{1}": "第{0}段条件→{1}",
    "{0}段目の質→{1}": "第{0}段质→{1}",
    "糸→つなぐ": "丝线→相连",
    "質・大きさ・持続・糸を調整する。": "调整质、大小、持续与丝线。",
    "器を選び、原理に点を振り、段をつなぐ。詳細を閉じても設定は残る。": "选择器，为原理分配点数，连接段。收起详细后设置仍保留。",
    "容量 {0}": "容量 {0}",
    "{0}段目": "第{0}段",
    "原理なし": "无原理",
    "{0}段目を外す": "移除第{0}段",
    "段は最大{0}つ。": "最多{0}段。",
    "段を足すと、この術が条件を満たした場所から次の器が開く。": "添加段后，下一个器会在此术满足条件的位置展开。",
    "{0}を{1}点": "{0}设为{1}点",
    "{0}：器そのもの＝{1}／触れたもの＝{2}": "{0}：器本身＝{1}／触及之物＝{2}",
    "この器では働かない": "对此器无效",
    "（器には効かない）": "（对器无效）",
    "触れたもの：{0}": "触及之物：{0}",
    "弾：大きさは当たりの広さ、持続は射程。剣などは最大3倍の巨剣にできるが、160%を超えると魔力が急に増える。": "弹：大小是命中范围，持续是射程。剑等最大可达3倍巨剑，但超过160%后魔力消耗会急剧增加。",
    "線：大きさは光の太さ。持続は無い。": "线：大小是光的粗细。没有持续。",
    "面：大きさは長さと硬さ、持続は立っている時間。": "墙：大小是长度与硬度，持续是屹立时间。",
    "円：大きさは半径（消費は面積で増える）、持続は残る時間。": "圆：大小是半径（消耗随面积增加），持续是残留时间。",
    "纏：持続は宿る時間。": "缠：持续是附身时间。",
    "環：大きさは回る半径、持続は回る時間。160%を超えると巨剣になり、魔力が急に増える。": "环：大小是旋转半径，持续是旋转时间。超过160%会变成巨剑，魔力消耗急剧增加。",
    "切る": "切断",
    "放った瞬間に糸を切る。維持費なし": "放出瞬间切断丝线。无维持费",
    "つなぐ": "相连",
    "誘導・合図・回収ができる。維持費がかかり、制御容量を1使う": "可引导、信号、回收。需维持费并占用1控制容量",
    "器：{0}": "器：{0}",
    "いちばん重い段の一撃（増の複製は1発ぶん）。点を重ねるほど共鳴して重くなる": "最重一段的单击（「增」的复制按一发计）。点数叠加越多，共鸣越重",
    "・糸": "·丝线",
    "作例を選ぶ → 器と原理の点を変える → 段をつなぐ → 修練場で試す。決定すると選んだ枠に保存され、1〜4で持ち替えて放てる。": "选择范例 → 改变器与原理点数 → 连接段 → 在修炼场试用。确定后保存到所选栏位，按 1〜4 切换施放。",
    "＋ 段を足す": "＋ 添加段",
    "この段を外す": "移除此段",
    "白紙から組む": "从空白构筑",
    "器": "器",
    "何を作る": "造什么",
    "軌": "轨",
    "どう飛ぶ": "怎么飞",
    "軌道（弾だけ）": "轨道（仅弹）",
    "理": "理",
    "原理": "原理",
    "0〜3点・重ねるほど強い": "0〜3点，叠加越强",
    "向": "向",
    "動の点があるとき": "有「动」时",
    "次": "次",
    "次の段へ": "进入下一段",
    "移る条件": "条件",
    "量": "量",
    "大きさ・持続": "大小·持续",
    "大きさ": "大小",
    "持続": "持续",
    "性能は変わらない": "性能不变",
    "空欄なら原理と器の名前。付けると放つときに唱える": "留空则用原理与器的名称。命名后施放时会喊出",
    "容量": "容量",
    "達人の術は今の枠だけ、流派は4つの枠すべてを置き換える。点と段が多い術は、初期の制御容量では暴発しやすい。": "达人之术只替换当前栏位，流派替换全部4个栏位。点数与段数多的术在初期控制容量下容易暴发。",
    "段": "段",
    "容量 {0}/{1}": "容量 {0}/{1}",
    "容量 {0}・魔力 {1}": "容量 {0}・魔力 {1}",
    "魔弾を放つ、壁で防ぐ、原理に点を振る、器を替える、段をつなぐ。修練場で魔法の仕組みを試そう。": "放出魔弹、用墙防御、为原理分配点数、更换器、连接段。在修炼场体验魔法的原理。"
  },
  data: {
    "rooms": {
      "ichi": {
        "name": "一之间",
        "note": "标准大小。适合第一次参战"
      },
      "sema": {
        "name": "狭间",
        "note": "狭窄，很快就会交火"
      },
      "oo": {
        "name": "大广间",
        "note": "宽广。坚持到成长壮大"
      },
      "dojo": {
        "name": "修炼场",
        "note": "以人偶试验自创的术。不留记录"
      }
    },
    "dummies": [
      {
        "name": "人偶·静"
      },
      {
        "name": "人偶·走"
      },
      {
        "name": "人偶·墙"
      },
      {
        "name": "人偶·射"
      },
      {
        "name": "人偶·炮"
      }
    ],
    "tiers": [
      {
        "name": "无纹"
      },
      {
        "name": "初纹"
      },
      {
        "name": "二纹"
      },
      {
        "name": "三纹"
      },
      {
        "name": "四纹"
      },
      {
        "name": "五纹"
      },
      {
        "name": "纹匠"
      },
      {
        "name": "纹圣"
      }
    ],
    "inks": {
      "pink": {
        "name": "蔷薇"
      },
      "blue": {
        "name": "苍"
      },
      "yellow": {
        "name": "金"
      },
      "green": {
        "name": "嫩叶"
      },
      "orange": {
        "name": "焰"
      },
      "purple": {
        "name": "紫"
      },
      "teal": {
        "name": "翠"
      },
      "red": {
        "name": "红"
      }
    },
    "crests": {
      "ring": "圆",
      "bar": "圆中一",
      "cross": "十字",
      "lozenge": "菱",
      "igeta": "井桁",
      "scale": "鳞",
      "stars": "三星",
      "wheel": "连环"
    },
    "cries": {
      "win": [
        "胜利不是证明，而是下一个问题的开始。",
        "刻在这纹章上的，不是胜者之名，而是选择。",
        "此刻，我把消散的力量化为了守护。",
        "我赢了。可被我毁掉的东西回不来了。",
        "并非看透一切，只是跨过了一个迷惘。",
        "所谓强大，是懂得不去毁掉什么。",
        "系上丝线的手与斩断它的手，是同一双手。",
        "连胜利之后的寂静，我也一并承受。",
        "不是器量之差，而是我坚持重新选择到了最后。",
        "这一胜，不会是终点。",
        "领教异纹的差距吧。",
        "结束了。",
        "太慢了。",
        "散吧。",
        "归于灰烬。"
      ],
      "death": [
        "……纹章松开了。直到最后，我都是我。",
        "器物虽碎，所选之路不会消失……",
        "消散的魔力，也有归处……",
        "没能守护的东西，我也不会忘记……",
        "这场败北，也将成为下一个结构的一部分……",
        "丝线断了。再也无法托付给谁……",
        "胜利并不是唯一的正确……",
        "生命会消散。但愿望仍在……",
        "看错的不是术式，是我的恐惧……",
        "直到最后一片，意志也不交出……",
        "呃……啊啊啊！",
        "……到此为止了吗。",
        "可恶……被黑暗吞没……",
        "不可能……我竟会……",
        "不甘……"
      ]
    },
    "defaultCries": {
      "win": "看见了吗，这就是纹章之力！",
      "death": "可恶……还不能在这里消散……！"
    },
    "schools": [
      {
        "name": "光芒射手",
        "spells": [
          {
            "customName": "流星"
          },
          {
            "customName": "天穿"
          },
          {
            "customName": "砦"
          },
          {
            "customName": "疾风"
          }
        ]
      },
      {
        "name": "剑圣",
        "spells": [
          {
            "customName": "胧斩"
          },
          {
            "customName": "八重樱"
          },
          {
            "customName": "缩地"
          },
          {
            "customName": "大镰·宵薙"
          }
        ]
      },
      {
        "name": "城塞之主",
        "spells": [
          {
            "customName": "破城"
          },
          {
            "customName": "金城"
          },
          {
            "customName": "绝界"
          },
          {
            "customName": "地鸣"
          }
        ]
      },
      {
        "name": "咒术师",
        "spells": [
          {
            "customName": "瘴气之种"
          },
          {
            "customName": "缚锁"
          },
          {
            "customName": "噬魂"
          },
          {
            "customName": "虚空穿刺"
          }
        ]
      },
      {
        "name": "爆破师",
        "spells": [
          {
            "customName": "爆缚阵"
          },
          {
            "customName": "崩天"
          },
          {
            "customName": "散华"
          },
          {
            "customName": "反转"
          }
        ]
      },
      {
        "name": "驭群者",
        "spells": [
          {
            "customName": "千本樱"
          },
          {
            "customName": "三叉雷"
          },
          {
            "customName": "夺魂域"
          },
          {
            "customName": "再生"
          }
        ]
      },
      {
        "name": "雷帝",
        "spells": [
          {
            "customName": "雷枪"
          },
          {
            "customName": "天雷"
          },
          {
            "customName": "雷鸣环"
          },
          {
            "customName": "魔素收束"
          }
        ]
      },
      {
        "name": "镜之魔女",
        "spells": [
          {
            "customName": "月轮"
          },
          {
            "customName": "镜花"
          },
          {
            "customName": "水镜"
          },
          {
            "customName": "惯性之锁"
          }
        ]
      }
    ],
    "principles": {
      "motion": {
        "name": "运动",
        "short": "动",
        "self": "变快",
        "touch": "推·拉·旋"
      },
      "bind": {
        "name": "结合",
        "short": "结",
        "self": "变硬",
        "touch": "连向器的中心"
      },
      "divide": {
        "name": "分解",
        "short": "分",
        "self": "变锐利",
        "touch": "破坏"
      },
      "convert": {
        "name": "转换",
        "short": "换",
        "self": "吸收受到的魔力",
        "touch": "夺取魔力"
      },
      "grow": {
        "name": "增殖",
        "short": "增",
        "self": "数量与时间增加",
        "touch": "修复自己的纹"
      },
      "phase": {
        "name": "相位",
        "short": "相",
        "self": "隐形，穿过「结」",
        "touch": "打上印记"
      }
    },
    "chant": {
      "a": {
        "motion": "疾驰吧",
        "bind": "结合，凝固",
        "divide": "解开吧",
        "convert": "流转，归还",
        "grow": "萌发，充盈",
        "phase": "相位，摇曳"
      },
      "b": {
        "motion": "撕裂风",
        "bind": "重叠束缚",
        "divide": "劈开理",
        "convert": "改写纹章",
        "grow": "延续生命",
        "phase": "穿越暗影",
        "none": ""
      },
      "vessel": {
        "bolt": "",
        "ray": "贯穿吧",
        "wall": "化为墙",
        "field": "充满吧",
        "body": "寄宿于我",
        "orbit": "绕我而行"
      },
      "then": {
        "hit": "触及",
        "end": "耗尽",
        "signal": "闻号",
        "break": "碎裂"
      }
    },
    "craft": {
      "naming": {
        "join": "",
        "stageSep": "・",
        "empty": "素"
      },
      "vessels": {
        "bolt": {
          "name": "弹",
          "note": "飞向准星的魔力团。可在触及敌人、墙或准星位置时展开下一段"
        },
        "ray": {
          "name": "线",
          "note": "瞬间延伸的光，贯穿一列敌人。被设置的墙阻挡。沉重但远处几乎不衰减"
        },
        "wall": {
          "name": "墙",
          "note": "在准星位置立起的墙。挡住所有人的身体、弹与光线（包括自己的）"
        },
        "field": {
          "name": "场",
          "note": "在准星位置展开的场。展开瞬间作用强，残留期间持续弱作用"
        },
        "body": {
          "name": "缠",
          "note": "以自己的身体为器。原理寄宿于自身，也作用于触及的敌人"
        },
        "orbit": {
          "name": "环",
          "note": "绕自己旋转。接住飞来的弹，作用于触及的敌人"
        }
      },
      "paths": {
        "straight": {
          "name": "直进",
          "note": "笔直飞行。快"
        },
        "arc": {
          "name": "抛物",
          "note": "以抛物线越过墙与岩石，落在准星位置"
        },
        "seek": {
          "name": "追踪",
          "note": "转向不同纹的大魔力。有丝线时可引向准星。占用1控制容量"
        },
        "return": {
          "name": "回归",
          "note": "在射程一半处折返回到手中，回程也能命中。接住会返还魔力"
        }
      },
      "thens": {
        "hit": {
          "name": "触及时",
          "note": "在触及敌人、墙或准星位置时展开下一段。缠在接触或被击中时触发"
        },
        "end": {
          "name": "耗尽时",
          "note": "持续（弹为射程）用尽时展开下一段。可做时间差机关"
        },
        "signal": {
          "name": "信号时",
          "note": "以 F 信号展开下一段。需要丝线（自动添加）"
        },
        "break": {
          "name": "破坏时",
          "note": "器被破坏时展开下一段。仅限弹、墙、环与有「结」的场"
        }
      },
      "forces": {
        "push": {
          "name": "向外推"
        },
        "pull": {
          "name": "向中心拉"
        },
        "spin": {
          "name": "向侧旋"
        }
      },
      "matters": {
        "energy": {
          "name": "能量",
          "note": "保持光与热。快但远处易散。不敌固体结构；光线能大幅削弱能量结构"
        },
        "solid": {
          "name": "固体",
          "note": "凝成结晶。慢但沉重，能推挤且不易衰减。大幅削弱能量结构。固体结构坚硬"
        }
      },
      "selfText": {
        "bolt": {
          "motion": "飞得更快",
          "bind": "空中对撞更强",
          "divide": "贯穿{n}个身体并削墙",
          "convert": "吸收压制的弹",
          "grow": "分成{c}发（每发较轻）",
          "phase": "难以看见；穿过「结」低于{n}的墙"
        },
        "ray": {
          "motion": "射得更远",
          "bind": "",
          "divide": "强力削墙",
          "convert": "",
          "grow": "分成{c}道（每道较轻）",
          "phase": "穿过「结」低于{n}的墙与结界"
        },
        "wall": {
          "motion": "向准星方向推进并推挤身体",
          "bind": "变硬",
          "divide": "",
          "convert": "把挡下的一击化为魔力",
          "grow": "变长",
          "phase": "难以看见"
        },
        "field": {
          "motion": "向准星方向漂移",
          "bind": "成为挡住弹的结界",
          "divide": "展开瞬间吹散敌方的弹",
          "convert": "从穿过的敌方弹中吸取魔力",
          "grow": "残留更久",
          "phase": "难以看见（成为陷阱）"
        },
        "body": {
          "motion": "脚步变快",
          "bind": "受到的伤害减少",
          "divide": "解除减速与束缚",
          "convert": "把部分受到的伤害化为魔力",
          "grow": "身体再生",
          "phase": "隐藏身形；可穿过「结」低于{n}的墙"
        },
        "orbit": {
          "motion": "转得更快",
          "bind": "刃变硬",
          "divide": "",
          "convert": "把接住的弹化为魔力",
          "grow": "刃变成{c}把",
          "phase": "难以看见"
        }
      }
    },
    "shapes": {
      "needle": {
        "name": "针"
      },
      "orb": {
        "name": "球"
      },
      "shard": {
        "name": "结晶"
      },
      "arrow": {
        "name": "矢"
      },
      "blade": {
        "name": "剑"
      },
      "katana": {
        "name": "日本刀"
      },
      "scythe": {
        "name": "大镰"
      },
      "axe": {
        "name": "斧"
      },
      "hammer": {
        "name": "锤"
      },
      "shuriken": {
        "name": "手里剑"
      },
      "chakram": {
        "name": "圆月轮"
      },
      "spear": {
        "name": "枪"
      },
      "castle": {
        "name": "城"
      }
    },
    "presets": {
      "bolt": {
        "label": "魔弹"
      },
      "lance": {
        "label": "晶枪"
      },
      "shotgun": {
        "label": "散弹"
      },
      "seeker": {
        "label": "追踪针"
      },
      "chakram": {
        "label": "回归轮"
      },
      "ray": {
        "label": "断光线"
      },
      "anchor": {
        "label": "锁链之锚"
      },
      "ghost": {
        "label": "穿墙弹"
      },
      "burst": {
        "label": "爆裂球"
      },
      "well": {
        "label": "重力井"
      },
      "cluster": {
        "label": "分裂弹"
      },
      "remote": {
        "label": "远程起爆"
      },
      "mine": {
        "label": "隐形地雷"
      },
      "stoneWall": {
        "label": "石墙"
      },
      "drainWall": {
        "label": "吸魔之墙"
      },
      "counterWall": {
        "label": "反击之墙"
      },
      "barrier": {
        "label": "结界"
      },
      "guardRing": {
        "label": "守护之环"
      },
      "bladeRing": {
        "label": "刃之环"
      },
      "haste": {
        "label": "疾走"
      },
      "harden": {
        "label": "硬化"
      },
      "mend": {
        "label": "再生"
      },
      "cloak": {
        "label": "隐身"
      },
      "absorb": {
        "label": "吸收之衣"
      }
    },
    "howto": [
      [
        "移动",
        "WASD / 方向键"
      ],
      [
        "切换术",
        "1·2·3·4 / 滚轮 / 点击下方栏位"
      ],
      [
        "施术",
        "鼠标瞄准，左键（按住连续咏唱）"
      ],
      [
        "闪避",
        "右键 / Space"
      ],
      [
        "信号",
        "F（向「信号时」进入下一段的术发送信号）"
      ],
      [
        "回收",
        "G（解开以丝线相连的术，返还部分魔力）"
      ],
      [
        "术式台",
        "T（修炼场中、大厅、消散后）"
      ],
      [
        "声音",
        "M 音效，N 音乐，V 语音（无／仅技名／技名与呐喊），B 切换曲目。详细设置见大厅的「设置」"
      ]
    ],
    "rules": [
      "在「术式台」构筑术。选择器（弹、线、墙、场、缠、环），为六原理分配0〜3点。原理以同一规则作用于器本身与器触及之物。",
      "「动」使之变快并推动，「结」使之变硬并连结，「分」使之锐利并破坏，「换」吸收并夺取，「增」增加数量与时间并修复自身，「相」隐形、穿过「结」并为触及者打上印记。",
      "连接段让术成长：弹触及时展开场、墙被破坏时反击、按 F 起爆。条件有「触及时·耗尽时·信号时·破坏时」。最多3段。",
      "点数叠加会共鸣增强（1点=1，2点=2.2，3点=3.6）。单纯的术作用最重，混合的术更多变。点数、段的连接、丝线与追踪共同占用控制容量：LV0为4，LV3为5，LV7为7，LV12为9。超过时施放瞬间可能暴发。",
      "器分为「固体」与「能量」。固体慢而重，大幅削弱能量结构。能量快但不敌固体结构。光线能粉碎能量结界。设置的墙不论质都会挡住所有人的身体、弹与光线，连破坏它的一击也会被挡下。",
      "「相」点数多于结构「结」点数的弹、光线与身体可以穿过该结构。「结」更厚就能挡住「相」。岩石无法穿过。",
      "不同纹的弹在空中碰撞：固体对撞，能量相消，质不同则互相贯穿而减弱。有「结」的弹对撞更强；有「换」的弹会吸收压制的弹。自己的弹会融合，穿过自己能量场的弹会共鸣增强。",
      "战场地面的六个纹是「六原理节点」。站在圆环中，含该原理的术威力提升、消耗降低，魔力恢复也更快。站在中央的「要之阵」控制容量+1。",
      "做好的术可以在「修炼场」对人偶试用。在修炼场中随时可按 T 重组。",
      "在战场拾取地面的光粒（魔素）即可成长并恢复魔力。魔力不会自行恢复（只在六原理节点中涌出）。魔素即分数。击散对手后其魔素会散落四周，也能夺取魔力。",
      "消散即结束。分数与名次换算为位阶点数。可以立即重新进场。"
    ],
    "learning": {
      "parts": {
        "principle": {
          "motion": [
            "器本身：变快。弹飞得更快，墙与场向准星推进，环转得更快，缠则让脚步变快。",
            "触及之物：推、拉或旋。拉的弹会把敌人拉向自己。",
            "伤害比「分」轻。推得太远会让敌人离开射程。"
          ],
          "bind": [
            "器本身：变硬。墙、环、场获得耐久；有「结」的场成为挡弹的结界。缠会减少受到的伤害。",
            "触及之物：连向器的中心——弹连向施术者，场连向中心。3点还会定住双脚。",
            "闪避与距离会切断连结。强力的「分」能击碎墙。"
          ],
          "divide": [
            "器本身：变锐利。更能削弱结构，弹按点数贯穿身体。缠会解除减速与束缚。",
            "触及之物：破坏。伤害最大。2点以上还会切断对方的丝线。",
            "消耗重。坚硬的墙需要搭配质与「相」。"
          ],
          "convert": [
            "器本身：吸收受到的魔力。墙与环挡下的一击、缠受到的部分伤害会化为自己的魔力。",
            "触及之物：夺取魔力，其中6成回到自己。",
            "不增加伤害。夺取魔力不会削弱对方身体。"
          ],
          "grow": [
            "器本身：数量与时间增加。弹与线呈扇形增加，环增加刃，场残留更久，墙变长。缠使身体再生。",
            "触及之物：修复自己的纹——在自己场中的身体与自己的墙。",
            "每个复制较轻（总量增加）。对敌人无效。"
          ],
          "phase": [
            "器本身：隐形并穿过「结」。「相」多于墙或结界的「结」即可穿过。缠会隐藏身形，并能穿墙行走。",
            "触及之物：打上印记。被标记者无法隐身，受击略重。",
            "靠近、咏唱或被击中会现形。岩石无法穿过。"
          ]
        },
        "vessel": {
          "bolt": [
            "飞向准星的魔力团。",
            "基本攻击。轨道（抛物、追踪、回归）与段会让它千变万化。",
            "直进可被侧移躲开。会被墙挡住。"
          ],
          "ray": [
            "瞬间延伸、贯穿一列敌人的光。",
            "远处的敌人、粉碎能量结界。",
            "咏唱长、消耗重。被设置的墙挡住。"
          ],
          "wall": [
            "在准星位置立起的墙。",
            "切断射线。有「动」会推进，有「分」则触碰会受伤。",
            "也会挡住自己的身体与术。会被「分」与固体削弱。"
          ],
          "field": [
            "在准星位置展开的场。展开瞬间作用强，残留期间作用弱。",
            "范围攻击、陷阱、结界（结）、回复场（增）。",
            "敌人离开场就无效。"
          ],
          "body": [
            "以自己的身体为器。",
            "加速、硬化、再生、隐身、冲撞。",
            "一次只能缠一个。碰不到远处。"
          ],
          "orbit": [
            "绕自己旋转的刃或城墙。",
            "接住飞来的弹，作用于靠近的敌人。",
            "够不到远处。刃被削尽就会碎裂。"
          ]
        },
        "then": {
          "hit": [
            "在触及的位置展开下一段。",
            "着弹即爆的弹、踩中即发的陷阱、被击中即反击的缠。",
            "落空就不会展开（弹会在准星位置展开）。"
          ],
          "end": [
            "持续用尽时展开下一段。",
            "延时爆炸、空中分裂的弹、无缝衔接的防御。",
            "对手未必会等你。"
          ],
          "signal": [
            "以 F 信号展开下一段。",
            "随时引爆放置的陷阱。",
            "丝线需维持费，过远会断。"
          ],
          "break": [
            "器被破坏的位置展开下一段。",
            "被破坏时反击的墙或环。",
            "不被破坏就不会展开。"
          ]
        }
      },
      "world": [
        [
          "魔素与魔力",
          "地面的发光粒是魔素。吸收后带上自己的纹成为魔力。施术消耗魔力，拾取魔素或站在节点圆环内可以补充。"
        ],
        [
          "纹与结构体",
          "纹标记魔力的持有者。自己的攻击不会伤害自己，但固定的墙是结构体，也挡住自己的身体、弹与光线。"
        ],
        [
          "散逸与丝线",
          "放出的术终会解散。维持丝线可引导、发信号、回收，但有维持费和距离限制。"
        ],
        [
          "从原理到现象",
          "这里不选择火或雷属性。六原理操纵魔素的运动与形状，产生光、冲击、结晶与结界。"
        ]
      ],
      "tutorial": [
        [
          "动与分：放出弹",
          "用1号的魔弹（动1·分1的弹）瞄准前方的人偶，施放2次。PC 用鼠标瞄准左键施放，手机触摸右侧。蓝条是魔力。练习用的术不会改变你保存的4个术。"
        ],
        [
          "结：用墙防御",
          "1号换成了石墙（结3的墙）。瞄准你与人偶之间立起墙，挡下1次弹。墙也会挡住自己的身体与术。用 WASD／左侧操作移到墙后。"
        ],
        [
          "添加原理",
          "打开术式台，为1号弹的「结」分配至少1点并确定。用它命中人偶。「结」会把触及之物连向器的中心——弹的话就是你自己。"
        ],
        [
          "更换器",
          "在术式台把1号的器换成「环」，确定后施放。同样的原理会化为绕你旋转的刃。换了器，原理的意义不变。"
        ],
        [
          "分：击碎墙",
          "前方的人偶立起了墙。在术式台把1号弹的「分」提高到2点以上并发射。「分」会削弱结构。击碎墙的那一击仍会被墙挡下，所以再射一次。"
        ],
        [
          "连接段",
          "在术式台按「添加段」，让1号弹「触及时」展开第2段的场。也为场分配原理，命中移动的人偶。"
        ],
        [
          "观察、重组、再战",
          "在战场观察对手的术与射线。对墙试试「分」或「相」，对追踪试试侧移，对结界试试光线或固体。用魔素或节点补充魔力。术式可在修炼场或进场前编辑。练习用的术会在这里恢复原样。"
        ]
      ],
      "example": "只有「动」的弹快而会推。加上「分」就会破坏，加上「结」就会把对手连向自己。同样的点数放在场上就成为范围，放在缠上就寄宿于身体。连接「弹触及时展开场」就是爆裂球。原理决定「做什么」，器与段决定「怎么用」。"
    }
  }
};

// ═══ 한국어 ══════════════════════════════════════════════════
LANG.ko = {
  ui: {
    "・": " · ",
    "！": "!",
    "／": " / ",
    "自動（スマホや重い端末は軽く）": "자동(스마트폰과 느린 기기는 가볍게)",
    "高い": "높음",
    "軽い（スマホ向け）": "가벼움(스마트폰용)",
    "画質を軽くした": "화질을 낮췄다",
    "起爆": "기폭",
    "回収": "회수",
    "画質": "화질",
    "自分の紋の魔力を体へ書き込んだ": "자신의 문장의 마력을 몸에 새겼다",
    "暴発": "폭발",
    "「{0}」は制御容量を超えていた": "「{0}」이(가) 제어 용량을 넘었다",
    "術式が…崩れる！": "술식이… 무너진다!",
    "結界崩壊": "결계 붕괴",
    "貫通": "관통",
    "剥離": "박리",
    "「{0}」の節点": "「{0}」의 절점",
    "{0}を含む術が強まり（威力 ×{1}・消費 ×{2}）、輪の中では魔力が湧き出る": "{0}을(를) 포함한 술이 강해지고(위력 ×{1}·소모 ×{2}), 고리 안에서는 마력이 솟는다",
    "要の陣": "요의 진",
    "ここに立つ間は制御容量が +{0}。重い術を暴発させずに扱える": "여기 서 있는 동안 제어 용량 +{0}. 무거운 술도 폭발 없이 다룰 수 있다",
    "共鳴": "공명",
    "相殺": "상쇄",
    "融合": "융합",
    "魔装": "마장",
    "誘爆": "유폭",
    "魔力が尽きた": "마력이 바닥났다",
    "+{0} 魔力": "+{0} 마력",
    "糸が切れた": "실이 끊어졌다",
    "術者から離れすぎた": "술자에게서 너무 멀어졌다",
    "糸を断たれた": "실이 잘렸다",
    "回収 +{0} 魔力": "회수 +{0} 마력",
    "糸でつながった術式 {0} つをほどいた": "실로 이어진 술식 {0}개를 풀었다",
    "構造崩壊": "구조 붕괴",
    "{0} を散らした": "{0}을(를) 흩어버렸다",
    "+{0} 魔素": "+{0} 마소",
    "制御容量が {0} になった。より重い術を安定して放てる": "제어 용량이 {0}이(가) 되었다. 더 무거운 술을 안정적으로 쓸 수 있다",
    "次の制御容量まで育て": "다음 제어 용량까지 성장하라",
    "曲を変えた": "곡을 바꿨다",
    "声なし": "음성 없음",
    "技名だけ": "기술명만",
    "技名と叫び": "기술명과 외침",
    "声：{0}": "음성: {0}",
    "要の陣 ― 制御容量 +{0}": "요의 진 ― 제어 용량 +{0}",
    "{0}の節点 ― {0}の術が強まり、魔力が湧く": "{0}의 절점 ― {0}의 술이 강해지고, 마력이 솟는다",
    "{0}人": "{0}명",
    "LV {0}・制御容量 {1}": "LV {0} · 제어 용량 {1}",
    "（LV{0}で{1}）": " (LV{0}에서 {1})",
    "魔力 {0}": "마력 {0}",
    "・暴発 {0}%": " · 폭발 {0}%",
    "糸 {0}": "실 {0}",
    "G 回収": "G 회수",
    "与えた威力 {0}・毎秒 {1}": "준 피해 {0} · 초당 {1}",
    "受けた威力 {0}・防いだ {1}": "받은 피해 {0} · 막음 {1}",
    "攻撃人形：撃つ": "공격 인형: 발사",
    "攻撃人形：止める": "공격 인형: 정지",
    "{0} に散らされた": "{0}에게 흩어졌다",
    "結界の外で散った": "결계 밖에서 흩어졌다",
    "{0} が結界に散った": "{0}이(가) 흩어졌다",
    "攻撃人形が撃ちはじめた": "공격 인형이 쏘기 시작했다",
    "攻撃人形を止めた": "공격 인형을 멈췄다",
    "受けた威力と、結界で防いだ数を数える（修練場では散らない）": "받은 피해와 결계로 막은 횟수를 센다(수련장에서는 흩어지지 않는다)",
    "技": "기",
    "声": "음",
    "声：{0}（V で切り替え）": "음성: {0} (V로 전환)",
    "自動（ブラウザに合わせる）": "자동(브라우저에 맞춤)",
    "　◆自然": "  ◆자연",
    "（日本語の声が見つからない）": "(이 언어의 음성을 찾을 수 없음)",
    "首位　{0}　{1}": "1위  {0}  {1}",
    "次の「{0}」まで {1} pt": "「{0}」까지 {1} pt",
    "最上位の位階": "최상위 위계",
    "{0}位": "{0}위",
    "撃破 {0}": "격파 {0}",
    "<li class=\"empty\">まだ入場していない</li>": "<li class=\"empty\">아직 입장 기록이 없다</li>",
    "なし": "없음",
    "自動": "자동",
    "作例「{0}」を {1} に読み込んだ": "예시 「{0}」을(를) {1}번에 불러왔다",
    "流派「{0}」の4つの術を読み込んだ（{1}）": "유파 「{0}」의 술 4개를 불러왔다({1})",
    "{0}の「{1}」を {2} に読み込んだ": "{0}의 「{1}」을(를) {2}번에 불러왔다",
    "初期の4つに戻した": "초기 4개로 되돌렸다",
    "{0}秒": "{0}초",
    "LV{0}〜 容量{1}": "LV{0}~ 용량{1}",
    "・安定": " · 안정",
    "決定して試す": "결정하고 시험",
    "修練場で試す": "수련장에서 시험",
    "名無し": "이름 없음",
    "人形を相手に術を試す。T で術式台、Esc で戻る": "인형을 상대로 술을 시험한다. T로 술식대, Esc로 돌아간다",
    "術を放つと入場保護が解ける": "술을 쓰면 입장 보호가 풀린다",
    "左をなぞって歩く": "왼쪽을 쓸어 이동",
    "右をタッチして放つ": "오른쪽을 터치해 발사",
    "下の枠で持ち替え": "아래 칸으로 교체",
    "左クリック": "왼쪽 클릭",
    "放つ": "발사",
    "持ち替え": "교체",
    "回避": "회피",
    "退出": "퇴장",
    "歩く": "걷기",
    "マウスで狙う": "마우스로 조준",
    "画面の右半分をタッチ": "화면 오른쪽 절반을 터치",
    "T で術式台": "T로 술식대",
    "決定 / Esc": "결정 / Esc",
    "上の「術式台」ボタン": "위의 「술식대」 버튼",
    "修練場に残る": "수련장에 남기",
    "手ほどきを終える": "튜토리얼 종료",
    "結界の外で構造が崩れた": "결계 밖에서 구조가 무너졌다",
    "{0}・計 {1} pt": "{0} · 합계 {1} pt",
    "表示で問題が起きた": "화면에 문제가 생겼다",
    "このまま遊べるが、続くときは再読み込みしてほしい": "계속 플레이할 수 있지만, 계속되면 새로고침해 주세요",
    "光のにじみを切った": "빛 번짐을 껐다",
    "動きが重かったため。設定で戻せる": "동작이 무거워서. 설정에서 되돌릴 수 있다",
    "PRIMA 紋戦": "PRIMA 문전",
    "このゲームは JavaScript で動きます。ブラウザの設定で JavaScript を有効にしてください。": "이 게임은 JavaScript로 동작합니다. 브라우저 설정에서 JavaScript를 켜 주세요.",
    "魔素": "마소",
    "撃破": "격파",
    "一の間": "첫째 방",
    "手ほどき": "튜토리얼",
    "戦場へ入る": "전장 입장",
    "構造": "구조",
    "魔力": "마력",
    "避": "피",
    "修練場": "수련장",
    "与えた威力 0": "준 피해 0",
    "受けた威力 0・防いだ 0": "받은 피해 0 · 막음 0",
    "術式台": "술식대",
    "ロビーへ": "로비로",
    "音": "음",
    "曲": "곡",
    "紋戦": "문전",
    "はじめての方へ": "처음이신 분께",
    "手ほどきを始める": "튜토리얼 시작",
    "名前": "이름",
    "光の色": "빛의 색",
    "紋": "문장",
    "丸": "원",
    "ルーム": "방",
    "戦場の参加者はいまはBotです。オンライン対戦は準備中。": "현재 전장의 참가자는 봇입니다. 온라인 대전은 준비 중.",
    "遊び方": "플레이 방법",
    "設定（声・音・画面）": "설정(음성·소리·화면)",
    "術": "술",
    "術式台を開く": "술식대 열기",
    "勝利宣言": "승리 선언",
    "倒したときに叫ぶ": "쓰러뜨렸을 때 외친다",
    "断末魔": "단말마",
    "散ったときに叫ぶ": "흩어졌을 때 외친다",
    "声で試す": "음성으로 시험",
    "無": "無",
    "無紋": "무문",
    "次の位階まで 250 pt": "다음 위계까지 250 pt",
    "最高魔素": "최고 마소",
    "最高順位": "최고 순위",
    "通算撃破": "누적 격파",
    "入場": "입장",
    "最近の入場": "최근 입장",
    "散った": "흩어졌다",
    "生存": "생존",
    "位階が上がった": "위계 상승",
    "もう一度入る": "다시 입장",
    "術式を組み直す": "술식 다시 짜기",
    "決定": "결정",
    "形": "형태",
    "放った後": "쏜 뒤",
    "糸": "실",
    "威力": "위력",
    "質": "질",
    "固めるか": "굳힐까",
    "固体／エネルギー": "고체 / 에너지",
    "魔弾針": "마탄 침",
    "詠唱": "영창",
    "遠くで": "먼 곳에서",
    "制御容量と暴発": "제어 용량과 폭발",
    "部品にふれると、その意味がここに出る": "부품에 마우스를 올리면 여기에 설명이 나온다",
    "達人の流派": "달인의 유파",
    "Bot が修める4つの術を丸ごと読み込む": "봇이 익힌 술 4개를 통째로 불러온다",
    "達人の術": "달인의 술",
    "初期の4つに戻す": "초기 4개로 되돌리기",
    "閉じる": "닫기",
    "設定": "설정",
    "言語": "언어",
    "名前を付けた術を放つとき、その技名を叫ぶ。「技名と叫び」は勝利宣言と断末魔も声に出す。": "이름 붙인 술을 쓸 때 그 기술명을 외친다. 「기술명과 외침」은 승리 선언과 단말마도 소리 낸다.",
    "声の種類": "음성 종류",
    "試す": "시험",
    "「Natural」「Online」と付いた声がいちばん人に近い（Edge・Chrome で使える）。": "「Natural」「Online」이 붙은 음성이 가장 사람에 가깝다(Edge·Chrome에서 사용 가능).",
    "効果音": "효과음",
    "音楽": "음악",
    "曲を変える": "곡 바꾸기",
    "光のにじみ": "빛 번짐",
    "術の光がまわりへにじむ。重いときは切る": "술의 빛이 주위로 번진다. 무거우면 끈다",
    "原理を接続して自分の術を組み、ルームの乱戦で放つ。魔素を拾い、散らして奪い、散ったらすぐ入りなおす魔法の乱戦。": "원리를 이어 자신의 술을 짜고, 방 전체의 난전에서 쏜다. 마소를 줍고, 흩어버려 빼앗고, 흩어지면 바로 다시 들어가는 마법 난전.",
    "PRIMA 紋戦 — 術を組み、乱戦で放て": "PRIMA 문전 — 술을 짜고, 난전에서 쏴라",
    "原理をつないで自分だけの魔法を組み、魔導士の乱戦で放つブラウザゲーム。登録不要・すぐ遊べる。": "원리를 이어 나만의 마법을 짜고 마도사들의 난전에서 쏘는 브라우저 게임. 가입 없이 바로 플레이.",
    "戦場": "전장",
    "自分の状態": "내 상태",
    "順位": "순위",
    "体と刻印": "몸",
    "回避（右クリック / Space）": "회피(오른쪽 클릭 / Space)",
    "射（槍・魔弾・日本刀・手裏剣）と砲（光線・斧）の人形が撃ってくる": "사수 인형(창·마탄·일본도·수리검)과 포수 인형(광선·도끼)이 공격해 온다",
    "全体図": "전체 지도",
    "効果音（M）": "효과음(M)",
    "音楽（N）": "음악(N)",
    "声（V）": "음성(V)",
    "ロビーへ戻る（Esc）": "로비로 돌아가기(Esc)",
    "術と叫び": "술과 외침",
    "位階": "위계",
    "術の枠": "술 칸",
    "術の動きの見本": "술 움직임 미리보기",
    "（自動）": "(자동)",
    "部品を選ぶと、この説明が切り替わる。": "부품을 고르면 이 설명이 바뀐다.",
    "この組み合わせに合わせて変更：{0}。選べない部品にふれると理由が分かる。": "조합에 맞게 변경: {0}. 고를 수 없는 부품에서 이유를 확인한다.",
    "基本に戻る": "기본으로 돌아가기",
    "術式を拡張する": "술식 확장",
    "手ほどきの練習用。保存した4つの術は変更しない。": "입문 연습용. 저장된 네 술은 바뀌지 않는다.",
    "相手の術を読み、破る術を組み直せ。": "적의 술을 읽고 깨뜨릴 술을 다시 짜라.",
    "まず術式台の作例から1つ選び、修練場で試す。戦場で相手の術を観察し、戻って組み替える。": "술식대 작례를 골라 수련장에서 시험한다. 전장에서 적의 술을 관찰하고 돌아와 다시 짠다.",
    "作例から作る": "작례로 만들기",
    "作例は完成した術のテンプレート。選ぶと今の枠だけに読み込み、自由に改造できる。": "작례는 완성된 술의 템플릿이다. 현재 슬롯만 불러와 자유롭게 바꿀 수 있다.",
    "ほかの作例も見る": "다른 작례 보기",
    "何が起こる？": "무슨 일이 일어날까?",
    "何に使える？": "어디에 쓸까?",
    "弱点は？": "약점은?",
    "動きの模式図。実際の威力・射程・相性は修練場で確かめる。": "동작 예시다. 실제 위력·사거리·상성은 수련장에서 확인하자.",
    "達人の術・流派から学ぶ": "달인의 술·유파로 배우기",
    "最初の一歩": "첫걸음",
    "術の放ち方": "술을 쏘는 방법",
    "PCはWASDで移動、マウスで照準、左クリックで詠唱。1〜4か下の枠で術を持ち替える。スマホは左側で移動、右側で照準と詠唱。押し続けると連続して放つ。": "PC: WASD 이동, 마우스 조준, 왼쪽 클릭 영창. 1~4나 아래 슬롯으로 교체. 모바일: 왼쪽 이동, 오른쪽 조준·영창. 누르면 연속 방출한다.",
    "魔素から魔法が生まれる": "마소에서 마법이 생긴다",
    "六原理の役割": "여섯 원리의 역할",
    "原理をつなぎ、使い方を変える": "원리를 연결하고 사용법을 바꾼다",
    "戦場のルールを詳しく読む": "전장 규칙 자세히 보기",
    "魔法の手ほどきを始める": "마법 입문 시작",
    "変更はすぐ反映され、このブラウザに保存される。音が出ないときは、消音と音量の両方を確認する。": "변경은 즉시 반영되어 이 브라우저에 저장된다. 소리가 없으면 음소거와 음량을 함께 확인하자.",
    "言語を変えると画面を読み込み直す。戦場ではロビーへ戻ってから変更しよう。": "언어 변경은 화면을 다시 불러온다. 전장에서는 로비로 돌아온 뒤 바꾸자.",
    "動きが重いときは「軽い」を選ぶ。術の演算や強さは変わらず、光と粒の描画を減らす。": "느리면 가벼움을 고르자. 술의 연산과 강도는 같고 빛·입자 묘사만 줄인다.",
    "効果音を鳴らす": "효과음 켜기",
    "音楽を鳴らす": "음악 켜기",
    "魔素に己の紋を刻み、術を編む。崩れた構造は魔素へ還り、次の術者の力となる。": "마소에 자신의 문양을 새겨 술을 엮는다. 무너진 구조는 마소로 돌아가 다음 술자의 힘이 된다.",
    "力の向き": "힘의 방향",
    "纏：{0}": "두름: {0}",
    "F 合図（{0}）": "F 신호({0})",
    "器と原理から形を決める": "그릇과 원리로 형태를 정한다",
    "見た目だけ。性能は原理で決まる": "외형뿐. 성능은 원리가 정한다",
    "白紙の弾から組む。器を選び、原理に点を振ろう": "빈 탄부터 짠다. 그릇을 고르고 원리에 점수를 주자",
    "術者へつなぎ、足を止める": "술자에게 묶고 발을 멈춘다",
    "術者へつなぐ": "술자에게 묶는다",
    "中心へつなぎ、足を止める": "중심에 묶고 발을 멈춘다",
    "中心へつなぐ": "중심에 묶는다",
    "壊し、糸を断つ": "부수고 실을 끊는다",
    "壊す": "부순다",
    "魔力を奪う": "마력을 빼앗는다",
    "自分の体と壁を直す（相手には効かない）": "자신의 몸과 벽을 고친다(상대에게는 효과 없음)",
    "印を付ける（隠れられず、打撃が重くなる）": "표식을 남긴다(숨을 수 없고 타격이 무거워진다)",
    "{0}段目：{1}": "{0}단: {1}",
    "（{0}）": "({0})",
    "。": ". ",
    "原理なし。素の魔力だけ。": "원리 없음. 순수한 마력뿐. ",
    "器そのもの：{0}。": "그릇 자체: {0}. ",
    "触れたもの：{0}。": "닿은 것: {0}. ",
    "一撃の打撃 約{0}。": "한 방 타격 약 {0}. ",
    "{0}、{1}段目を開く。": "{0} {1}단을 연다. ",
    "糸でつながる（誘導・合図 F・回収 G ができるが、維持費がかかる）。": "실로 이어진다(유도·F 신호·G 회수 가능, 유지비가 든다).",
    "弾だけが選べる。": "탄만 고를 수 있다.",
    "追尾は制御容量を1使う。": "추적은 제어 용량을 1 쓴다.",
    "固体はエネルギーの構造を、光線はエネルギーの結界を大きく削る。": "고체는 에너지 구조를, 광선은 에너지 결계를 크게 깎는다.",
    "固体は遅く、エネルギーは固体の構造に弱い。": "고체는 느리고, 에너지는 고체 구조에 약하다.",
    "動の点で触れたものを動かす向き。弾・線・纏・環の中心は術者、壁は触れた面、円は中心。": "「동」으로 닿은 것을 움직이는 방향. 탄·광선·두름·고리의 중심은 술자, 벽은 닿은 면, 영역은 중심.",
    "引けば相手を寄せ、押せば遠ざけ、回せば横へ流す。": "당기면 끌어오고, 밀면 멀어지고, 돌리면 옆으로 흘린다.",
    "動の点がなければ働かない。": "「동」 점수가 없으면 작동하지 않는다.",
    "放った後も術者とつながる。": "쏜 뒤에도 술자와 이어진다.",
    "追尾の弾を照準へ誘導し、F の合図で次の段を開き、G でほどいて魔力を戻す。": "추적 탄을 조준점으로 유도하고, F 신호로 다음 단을 열고, G로 풀어 마력을 되돌린다.",
    "毎秒魔力を使い、遠すぎると切れる。制御容量を1使う。": "매초 마력을 쓰고 너무 멀면 끊긴다. 제어 용량을 1 쓴다.",
    "見た目": "외형",
    "弾と環の形。": "탄과 고리의 형태.",
    "好みの姿にする。": "좋아하는 모습으로.",
    "性能は変わらない。": "성능은 변하지 않는다.",
    "この器では：{0}": "이 그릇에서는: {0}",
    "壊れる器（弾・面・環・結のある円）だけが選べる。": "부서지는 그릇(탄·벽·고리·「결」이 있는 영역)만 고를 수 있다.",
    "線は一瞬で終わるので「触れたら」だけ。": "광선은 순간에 끝나므로 「닿으면」만.",
    "結の無い円は硬さを持たず、壊れない。結に点を振ろう。": "「결」이 없는 영역은 단단함이 없어 부서지지 않는다. 「결」에 점수를 주자.",
    "線は光そのもの。質はエネルギーだけ。": "광선은 빛 그 자체. 질은 에너지뿐.",
    "纏は自分の体。質は選ばない。": "두름은 자신의 몸. 질은 고르지 않는다.",
    "軌道は弾だけが選べる。": "궤도는 탄만 고를 수 있다.",
    "見た目は弾と環だけが選べる。": "외형은 탄과 고리만 고를 수 있다.",
    "「合図で」移る段があるので、糸が要る。": "「신호로」 넘어가는 단이 있어 실이 필요하다.",
    "{0}段目の条件→{1}": "{0}단 조건→{1}",
    "{0}段目の質→{1}": "{0}단 질→{1}",
    "糸→つなぐ": "실→잇기",
    "質・大きさ・持続・糸を調整する。": "질·크기·지속·실을 조정한다.",
    "器を選び、原理に点を振り、段をつなぐ。詳細を閉じても設定は残る。": "그릇을 고르고, 원리에 점수를 주고, 단을 잇는다. 세부를 닫아도 설정은 남는다.",
    "容量 {0}": "용량 {0}",
    "{0}段目": "{0}단",
    "原理なし": "원리 없음",
    "{0}段目を外す": "{0}단 빼기",
    "段は最大{0}つ。": "단은 최대 {0}개.",
    "段を足すと、この術が条件を満たした場所から次の器が開く。": "단을 더하면 이 술이 조건을 채운 곳에서 다음 그릇이 열린다.",
    "{0}を{1}点": "{0}을(를) {1}점",
    "{0}：器そのもの＝{1}／触れたもの＝{2}": "{0}: 그릇 자체＝{1} / 닿은 것＝{2}",
    "この器では働かない": "이 그릇에서는 작동하지 않음",
    "（器には効かない）": "(그릇에는 효과 없음)",
    "触れたもの：{0}": "닿은 것: {0}",
    "弾：大きさは当たりの広さ、持続は射程。剣などは最大3倍の巨剣にできるが、160%を超えると魔力が急に増える。": "탄: 크기는 판정 넓이, 지속은 사거리. 검 등은 최대 3배 거검이 되지만, 160%를 넘으면 마력이 급격히 늘어난다.",
    "線：大きさは光の太さ。持続は無い。": "광선: 크기는 빛의 굵기. 지속은 없다.",
    "面：大きさは長さと硬さ、持続は立っている時間。": "벽: 크기는 길이와 단단함, 지속은 서 있는 시간.",
    "円：大きさは半径（消費は面積で増える）、持続は残る時間。": "영역: 크기는 반경(소비는 면적에 따라 증가), 지속은 남는 시간.",
    "纏：持続は宿る時間。": "두름: 지속은 깃드는 시간.",
    "環：大きさは回る半径、持続は回る時間。160%を超えると巨剣になり、魔力が急に増える。": "고리: 크기는 도는 반경, 지속은 도는 시간. 160%를 넘으면 거검이 되며 마력이 급격히 늘어난다.",
    "切る": "끊기",
    "放った瞬間に糸を切る。維持費なし": "쏘는 순간 실을 끊는다. 유지비 없음",
    "つなぐ": "잇기",
    "誘導・合図・回収ができる。維持費がかかり、制御容量を1使う": "유도·신호·회수 가능. 유지비가 들고 제어 용량을 1 쓴다",
    "器：{0}": "그릇: {0}",
    "いちばん重い段の一撃（増の複製は1発ぶん）。点を重ねるほど共鳴して重くなる": "가장 무거운 단의 한 방(「증」의 복제는 한 발 기준). 점수를 겹칠수록 공명해 무거워진다",
    "・糸": "·실",
    "作例を選ぶ → 器と原理の点を変える → 段をつなぐ → 修練場で試す。決定すると選んだ枠に保存され、1〜4で持ち替えて放てる。": "예제를 고른다 → 그릇과 원리 점수를 바꾼다 → 단을 잇는다 → 수련장에서 시험한다. 결정하면 고른 칸에 저장되고 1~4로 바꿔 쓸 수 있다.",
    "＋ 段を足す": "＋ 단 추가",
    "この段を外す": "이 단 빼기",
    "白紙から組む": "빈칸부터 짜기",
    "器": "그릇",
    "何を作る": "무엇을 만드나",
    "軌": "궤",
    "どう飛ぶ": "어떻게 나나",
    "軌道（弾だけ）": "궤도(탄만)",
    "理": "리",
    "原理": "원리",
    "0〜3点・重ねるほど強い": "0~3점·겹칠수록 강하다",
    "向": "향",
    "動の点があるとき": "「동」이 있을 때",
    "次": "다음",
    "次の段へ": "다음 단으로",
    "移る条件": "조건",
    "量": "양",
    "大きさ・持続": "크기·지속",
    "大きさ": "크기",
    "持続": "지속",
    "性能は変わらない": "성능은 그대로",
    "空欄なら原理と器の名前。付けると放つときに唱える": "비워 두면 원리와 그릇의 이름. 이름을 붙이면 쓸 때 외친다",
    "容量": "용량",
    "達人の術は今の枠だけ、流派は4つの枠すべてを置き換える。点と段が多い術は、初期の制御容量では暴発しやすい。": "달인의 술은 현재 칸만, 유파는 네 칸 모두를 바꾼다. 점수와 단이 많은 술은 초기 제어 용량에서 폭발하기 쉽다.",
    "段": "단",
    "容量 {0}/{1}": "용량 {0}/{1}",
    "容量 {0}・魔力 {1}": "용량 {0}·마력 {1}",
    "魔弾を放つ、壁で防ぐ、原理に点を振る、器を替える、段をつなぐ。修練場で魔法の仕組みを試そう。": "마탄을 쏘고, 벽으로 막고, 원리에 점수를 주고, 그릇을 바꾸고, 단을 잇는다. 수련장에서 마법의 원리를 시험해 보자."
  },
  data: {
    "rooms": {
      "ichi": {
        "name": "첫째 방",
        "note": "표준 크기. 첫 입장에 알맞다"
      },
      "sema": {
        "name": "틈새",
        "note": "좁아서 금세 교전이 벌어진다"
      },
      "oo": {
        "name": "대광간",
        "note": "넓다. 크게 자랄 때까지 살아남아라"
      },
      "dojo": {
        "name": "수련장",
        "note": "인형을 상대로 만든 술을 시험한다. 기록은 남지 않는다"
      }
    },
    "dummies": [
      {
        "name": "인형·정지"
      },
      {
        "name": "인형·보행"
      },
      {
        "name": "인형·벽"
      },
      {
        "name": "인형·사수"
      },
      {
        "name": "인형·포수"
      }
    ],
    "tiers": [
      {
        "name": "무문"
      },
      {
        "name": "초문"
      },
      {
        "name": "이문"
      },
      {
        "name": "삼문"
      },
      {
        "name": "사문"
      },
      {
        "name": "오문"
      },
      {
        "name": "문장인"
      },
      {
        "name": "문성"
      }
    ],
    "inks": {
      "pink": {
        "name": "장미"
      },
      "blue": {
        "name": "창"
      },
      "yellow": {
        "name": "금"
      },
      "green": {
        "name": "새잎"
      },
      "orange": {
        "name": "불꽃"
      },
      "purple": {
        "name": "보라"
      },
      "teal": {
        "name": "비취"
      },
      "red": {
        "name": "진홍"
      }
    },
    "crests": {
      "ring": "원",
      "bar": "원에 한 일",
      "cross": "십자",
      "lozenge": "마름모",
      "igeta": "우물 정",
      "scale": "비늘",
      "stars": "세 별",
      "wheel": "엇갈린 고리"
    },
    "botNames": [
      "Vesper",
      "Ashen",
      "Noctis",
      "Morrow",
      "Grave",
      "Umbra",
      "Sable",
      "Wraith",
      "Cinder",
      "Hollow",
      "Rook",
      "Crow",
      "Ember",
      "Lament",
      "Requiem",
      "Vigil",
      "Shroud",
      "Obsidian",
      "Thorn",
      "Omen",
      "잿빛",
      "흑요",
      "그믐",
      "까마귀깃",
      "먹물",
      "장송",
      "명등",
      "초토",
      "백골",
      "땅거미",
      "잔향",
      "안개비",
      "절영",
      "무명",
      "동월",
      "창염",
      "황혼",
      "단죄",
      "침묵",
      "고영"
    ],
    "cries": {
      "win": [
        "승리는 증명이 아니다. 다음 질문의 시작이다.",
        "이 문장에 새기는 것은 승자의 이름이 아니라 선택이다.",
        "흩어지는 힘을, 지금만은 지키는 형태로 만들었다.",
        "이겼다. 그래도 부순 것은 돌아오지 않는다.",
        "다 읽어낸 게 아니다. 망설임 하나를 넘었을 뿐.",
        "강함이란 무엇을 부수지 않고 끝낼지 아는 것.",
        "실을 묶는 손도 끊는 손도 같은 손이었다.",
        "승리 뒤에 남는 고요까지 떠안겠다.",
        "그릇의 차이가 아니다. 끝까지 다시 고른 차이다.",
        "이 한 번의 승리를 끝으로 삼지 않겠다.",
        "다른 문장의 차이를 깨달아라.",
        "끝이다.",
        "느리다.",
        "흩어져라.",
        "재로 돌아가라."
      ],
      "death": [
        "……문장이 풀린다. 끝까지 나였다.",
        "그릇은 부서져도 고른 길은 사라지지 않는다……",
        "흩어지는 마력에도 돌아갈 곳이 있다……",
        "지키지 못한 것까지 잊지 않겠다……",
        "이 패배도 다음 구조의 일부가 된다……",
        "실이 끊겼다. 이제 누구에게도 맡길 수 없다……",
        "이기는 것만이 옳음은 아니었다……",
        "생명은 흩어진다. 그래도 바람은 남는다……",
        "잘못 본 건 술식이 아니다. 나의 두려움이다……",
        "마지막 한 조각까지 의지는 넘기지 않는다……",
        "크윽…… 아아악!",
        "……여기까지인가.",
        "큭…… 어둠에 삼켜진다……",
        "말도 안 돼…… 이 내가……",
        "원통하다……"
      ]
    },
    "defaultCries": {
      "win": "보았느냐, 이것이 문장의 힘이다!",
      "death": "큭… 아직 흩어질 수는…!"
    },
    "schools": [
      {
        "name": "광망의 사수",
        "spells": [
          {
            "customName": "유성"
          },
          {
            "customName": "천천"
          },
          {
            "customName": "보루"
          },
          {
            "customName": "질풍"
          }
        ]
      },
      {
        "name": "검성",
        "spells": [
          {
            "customName": "몽롱참"
          },
          {
            "customName": "겹벚꽃"
          },
          {
            "customName": "축지"
          },
          {
            "customName": "큰낫·어스름베기"
          }
        ]
      },
      {
        "name": "성채의 주인",
        "spells": [
          {
            "customName": "파성"
          },
          {
            "customName": "금성"
          },
          {
            "customName": "절계"
          },
          {
            "customName": "지명"
          }
        ]
      },
      {
        "name": "주술사",
        "spells": [
          {
            "customName": "장기의 씨앗"
          },
          {
            "customName": "박쇄"
          },
          {
            "customName": "영혼 포식"
          },
          {
            "customName": "공허 관통"
          }
        ]
      },
      {
        "name": "폭파사",
        "spells": [
          {
            "customName": "폭박진"
          },
          {
            "customName": "붕천"
          },
          {
            "customName": "산화"
          },
          {
            "customName": "반전"
          }
        ]
      },
      {
        "name": "무리 부리는 자",
        "spells": [
          {
            "customName": "천본앵"
          },
          {
            "customName": "삼지뢰"
          },
          {
            "customName": "탈혼역"
          },
          {
            "customName": "재생"
          }
        ]
      },
      {
        "name": "뇌제",
        "spells": [
          {
            "customName": "뇌창"
          },
          {
            "customName": "천뢰"
          },
          {
            "customName": "뇌명환"
          },
          {
            "customName": "마소 수속"
          }
        ]
      },
      {
        "name": "거울의 마녀",
        "spells": [
          {
            "customName": "월륜"
          },
          {
            "customName": "경화"
          },
          {
            "customName": "수경"
          },
          {
            "customName": "관성의 사슬"
          }
        ]
      }
    ],
    "principles": {
      "motion": {
        "name": "운동",
        "short": "동",
        "self": "빨라진다",
        "touch": "민다·당긴다·돌린다"
      },
      "bind": {
        "name": "결합",
        "short": "결",
        "self": "단단해진다",
        "touch": "그릇의 중심에 묶는다"
      },
      "divide": {
        "name": "분해",
        "short": "분",
        "self": "날카로워진다",
        "touch": "부순다"
      },
      "convert": {
        "name": "변환",
        "short": "환",
        "self": "받은 마력을 흡수한다",
        "touch": "마력을 빼앗는다"
      },
      "grow": {
        "name": "증식",
        "short": "증",
        "self": "수와 시간이 늘어난다",
        "touch": "자신의 문장을 고친다"
      },
      "phase": {
        "name": "위상",
        "short": "상",
        "self": "보이지 않고 「결」을 통과한다",
        "touch": "표식을 남긴다"
      }
    },
    "chant": {
      "a": {
        "motion": "재빨리 달려라",
        "bind": "맺고, 굳어라",
        "divide": "풀려라",
        "convert": "흘러, 돌아가라",
        "grow": "싹트고, 차올라라",
        "phase": "위상이여, 흔들려라"
      },
      "b": {
        "motion": "바람을 가르고",
        "bind": "속박을 겹치고",
        "divide": "이치를 쪼개고",
        "convert": "문장을 고쳐 쓰고",
        "grow": "생명을 잇고",
        "phase": "그림자를 건너",
        "none": ""
      },
      "vessel": {
        "bolt": "",
        "ray": "꿰뚫어라",
        "wall": "벽이 되어라",
        "field": "가득 차라",
        "body": "내게 깃들어라",
        "orbit": "나를 돌아라"
      },
      "then": {
        "hit": "닿아서",
        "end": "다하여",
        "signal": "신호에",
        "break": "부서져"
      }
    },
    "craft": {
      "naming": {
        "join": "",
        "stageSep": "·",
        "empty": "소"
      },
      "vessels": {
        "bolt": {
          "name": "탄",
          "note": "조준점으로 날아가는 마력 덩어리. 적·벽·조준점에 닿은 곳에서 다음 단을 열 수 있다"
        },
        "ray": {
          "name": "광선",
          "note": "순식간에 뻗는 빛. 줄지은 적을 꿰뚫는다. 설치 벽에 막힌다. 무겁지만 멀리서도 거의 약해지지 않는다"
        },
        "wall": {
          "name": "벽",
          "note": "조준점에 서는 벽. 누구의 몸·탄·광선이든 막는다(자신의 것도)"
        },
        "field": {
          "name": "영역",
          "note": "조준점에 열리는 영역. 열리는 순간 강하게, 남아 있는 동안 약하게 계속 작용한다"
        },
        "body": {
          "name": "두름",
          "note": "자신의 몸을 그릇으로 삼는다. 원리가 자신에게 깃들고 닿은 적에게도 작용한다"
        },
        "orbit": {
          "name": "고리",
          "note": "자신 주위를 돈다. 날아오는 탄을 받아내고 닿은 적에게 작용한다"
        }
      },
      "paths": {
        "straight": {
          "name": "직진",
          "note": "곧게 난다. 빠르다"
        },
        "arc": {
          "name": "포물",
          "note": "포물선으로 벽과 바위를 넘어 조준점에 떨어진다"
        },
        "seek": {
          "name": "추적",
          "note": "다른 문장의 큰 마력으로 휘어진다. 실이 있으면 조준점으로 유도할 수 있다. 제어 용량을 1 쓴다"
        },
        "return": {
          "name": "회귀",
          "note": "사거리 절반에서 되돌아 손으로 돌아온다. 돌아올 때도 맞는다. 받으면 마력이 돌아온다"
        }
      },
      "thens": {
        "hit": {
          "name": "닿으면",
          "note": "적·벽·조준점에 닿은 곳에서 다음 단이 열린다. 두름은 닿거나 맞았을 때"
        },
        "end": {
          "name": "다하면",
          "note": "지속(탄은 사거리)을 다 쓴 곳에서 다음 단이 열린다. 시간차 장치가 된다"
        },
        "signal": {
          "name": "신호로",
          "note": "F 신호로 다음 단이 열린다. 실이 필요하다(자동으로 붙는다)"
        },
        "break": {
          "name": "부서지면",
          "note": "그릇이 부서진 곳에서 다음 단이 열린다. 탄·벽·고리·「결」이 있는 영역만"
        }
      },
      "forces": {
        "push": {
          "name": "바깥으로 밀기"
        },
        "pull": {
          "name": "중심으로 당기기"
        },
        "spin": {
          "name": "옆으로 돌리기"
        }
      },
      "matters": {
        "energy": {
          "name": "에너지",
          "note": "빛과 열 그대로. 빠르지만 멀리서 흩어지기 쉽다. 고체 구조에 약하고, 광선은 에너지 구조를 크게 깎는다"
        },
        "solid": {
          "name": "고체",
          "note": "결정으로 굳힌다. 느리지만 무겁게 밀어붙이고 잘 약해지지 않는다. 에너지 구조를 크게 깎는다. 고체 구조는 단단하다"
        }
      },
      "selfText": {
        "bolt": {
          "motion": "빨리 난다",
          "bind": "공중 충돌에 강하다",
          "divide": "{n}명을 꿰뚫고 벽을 깎는다",
          "convert": "이긴 탄을 흡수한다",
          "grow": "{c}발로 늘어난다(한 발은 가벼워진다)",
          "phase": "잘 보이지 않고 「결」{n} 미만의 벽을 통과한다"
        },
        "ray": {
          "motion": "멀리까지 뻗는다",
          "bind": "",
          "divide": "벽을 강하게 깎는다",
          "convert": "",
          "grow": "{c}줄로 늘어난다(한 줄은 가벼워진다)",
          "phase": "「결」{n} 미만의 벽과 결계를 통과한다"
        },
        "wall": {
          "motion": "조준 방향으로 나아가며 몸을 밀어낸다",
          "bind": "단단해진다",
          "divide": "",
          "convert": "막아낸 일격을 마력으로 바꾼다",
          "grow": "길어진다",
          "phase": "잘 보이지 않는다"
        },
        "field": {
          "motion": "조준 방향으로 흘러간다",
          "bind": "탄을 막는 결계가 된다",
          "divide": "열리는 순간 상대의 탄을 날려 버린다",
          "convert": "지나가는 상대 탄에서 마력을 빨아들인다",
          "grow": "오래 남는다",
          "phase": "잘 보이지 않는다(함정이 된다)"
        },
        "body": {
          "motion": "발이 빨라진다",
          "bind": "받는 타격이 줄어든다",
          "divide": "둔화와 속박을 푼다",
          "convert": "받은 타격의 일부를 마력으로 바꾼다",
          "grow": "몸이 재생한다",
          "phase": "모습을 감추고 「결」{n} 미만의 벽을 통과해 걷는다"
        },
        "orbit": {
          "motion": "빨리 돈다",
          "bind": "칼날이 단단해진다",
          "divide": "",
          "convert": "받아낸 탄을 마력으로 바꾼다",
          "grow": "칼날이 {c}개가 된다",
          "phase": "잘 보이지 않는다"
        }
      }
    },
    "shapes": {
      "needle": {
        "name": "침"
      },
      "orb": {
        "name": "구"
      },
      "shard": {
        "name": "결정"
      },
      "arrow": {
        "name": "화살"
      },
      "blade": {
        "name": "검"
      },
      "katana": {
        "name": "일본도"
      },
      "scythe": {
        "name": "큰낫"
      },
      "axe": {
        "name": "도끼"
      },
      "hammer": {
        "name": "망치"
      },
      "shuriken": {
        "name": "수리검"
      },
      "chakram": {
        "name": "원월륜"
      },
      "spear": {
        "name": "창"
      },
      "castle": {
        "name": "성"
      }
    },
    "presets": {
      "bolt": {
        "label": "마탄"
      },
      "lance": {
        "label": "결정 창"
      },
      "shotgun": {
        "label": "산탄"
      },
      "seeker": {
        "label": "추적 침"
      },
      "chakram": {
        "label": "회귀 고리"
      },
      "ray": {
        "label": "절단 광선"
      },
      "anchor": {
        "label": "사슬 닻"
      },
      "ghost": {
        "label": "벽 관통탄"
      },
      "burst": {
        "label": "폭렬구"
      },
      "well": {
        "label": "중력정"
      },
      "cluster": {
        "label": "분열탄"
      },
      "remote": {
        "label": "원격 기폭"
      },
      "mine": {
        "label": "보이지 않는 지뢰"
      },
      "stoneWall": {
        "label": "돌벽"
      },
      "drainWall": {
        "label": "흡마의 벽"
      },
      "counterWall": {
        "label": "반격의 벽"
      },
      "barrier": {
        "label": "결계"
      },
      "guardRing": {
        "label": "수호의 고리"
      },
      "bladeRing": {
        "label": "칼날 고리"
      },
      "haste": {
        "label": "질주"
      },
      "harden": {
        "label": "경화"
      },
      "mend": {
        "label": "재생"
      },
      "cloak": {
        "label": "은신"
      },
      "absorb": {
        "label": "흡수의 옷"
      }
    },
    "howto": [
      [
        "이동",
        "WASD / 방향키"
      ],
      [
        "술 교체",
        "1·2·3·4 / 휠 / 아래 칸 클릭"
      ],
      [
        "술 쓰기",
        "마우스로 조준, 왼쪽 클릭(누르고 있으면 계속 영창)"
      ],
      [
        "회피",
        "오른쪽 클릭 / Space"
      ],
      [
        "신호",
        "F(「신호로」 다음 단으로 넘어가는 술에 신호를 보낸다)"
      ],
      [
        "회수",
        "G(실로 이어진 술을 풀어 마력 일부를 되돌린다)"
      ],
      [
        "술식대",
        "T(수련장 안, 로비, 흩어진 뒤)"
      ],
      [
        "소리",
        "M 효과음, N 음악, V 음성(없음/기술명만/기술명과 외침), B 곡 바꾸기. 자세한 설정은 로비의 「설정」"
      ]
    ],
    "rules": [
      "술은 「술식대」에서 짠다. 그릇(탄·광선·벽·영역·두름·고리)을 고르고 여섯 원리에 0~3점을 준다. 원리는 그릇 자체와 그릇에 닿은 것에 같은 규칙으로 작용한다.",
      "「동」은 빠르게 하고 밀며, 「결」은 단단하게 하고 묶고, 「분」은 날카롭게 하고 부수며, 「환」은 흡수하고 빼앗고, 「증」은 수와 시간을 늘리고 자신을 고치며, 「상」은 숨기고 「결」을 통과하며 닿은 상대에게 표식을 남긴다.",
      "단을 이으면 술이 자란다. 탄이 닿으면 영역이 열리고, 벽이 부서지면 반격하고, F 신호로 기폭한다. 조건은 「닿으면·다하면·신호로·부서지면」. 최대 3단.",
      "점수를 겹칠수록 공명해 강해진다(1점=1, 2점=2.2, 3점=3.6). 단순한 술일수록 한 작용이 무겁고, 섞은 술은 다재다능해진다. 점수·단의 연결·실·추적의 합이 제어 용량을 쓴다: LV0은 4, LV3은 5, LV7은 7, LV12는 9. 넘은 술은 쏘는 순간 폭발할 수 있다.",
      "그릇은 「고체」 또는 「에너지」. 고체는 느리고 무거우며 에너지 구조를 크게 깎는다. 에너지는 빠르지만 고체 구조에 약하다. 광선은 에너지 결계를 부순다. 설치 벽은 질과 상관없이 누구의 몸·탄·광선이든 막고, 부순 일격도 받아낸다.",
      "「상」 점수가 구조의 「결」 점수보다 많은 탄·광선·몸은 그 구조를 통과한다. 「결」을 두껍게 하면 「상」을 막을 수 있다. 바위는 통과할 수 없다.",
      "다른 문장의 탄끼리는 공중에서 부딪친다. 고체끼리는 충돌하고, 에너지끼리는 상쇄하며, 질이 다르면 서로 꿰뚫고 약해진다. 「결」이 있는 탄은 충돌에 강하고, 「환」이 있는 탄은 이긴 탄을 흡수한다. 자신의 탄끼리는 융합하고, 자신의 에너지 영역을 지난 탄은 공명해 강해진다.",
      "전장 바닥의 여섯 문장은 「여섯 원리의 절점」. 그 원 안에 서면 그 원리를 포함한 술의 위력이 오르고 소비가 줄며 마력도 빨리 돌아온다. 중앙의 「요의 진」에 서면 제어 용량이 1 늘어난다.",
      "만든 술은 「수련장」에서 인형을 상대로 시험할 수 있다. 수련장에서는 T로 언제든 다시 짤 수 있다.",
      "전장에서 바닥의 빛 입자(마소)를 주우면 성장하고 마력도 돌아온다. 마력은 저절로 돌아오지 않는다(여섯 원리의 절점 안에서만 솟는다). 마소가 곧 점수. 흩어진 상대의 마소는 주위에 뿌려지고 마력도 빼앗을 수 있다.",
      "흩어지면 끝. 점수와 순위가 위계 포인트가 된다. 바로 다시 들어갈 수 있다."
    ],
    "learning": {
      "parts": {
        "principle": {
          "motion": [
            "그릇 자체: 빨라진다. 탄은 빨리 날고, 벽과 영역은 조준 방향으로 나아가고, 고리는 빨리 돌며, 두름이면 발이 빨라진다.",
            "닿은 것: 밀기·당기기·돌리기. 당기는 탄은 상대를 자신에게 끌어온다.",
            "타격은 「분」보다 가볍다. 너무 밀면 상대가 사거리 밖으로 나간다."
          ],
          "bind": [
            "그릇 자체: 단단해진다. 벽·고리·영역이 내구를 갖고, 「결」이 있는 영역은 탄을 막는 결계가 된다. 두름이면 받는 타격이 준다.",
            "닿은 것: 그릇의 중심에 묶는다. 탄은 술자에게, 영역은 중심에 묶고, 3점이면 발도 묶는다.",
            "회피와 거리로 묶임이 끊긴다. 강한 「분」의 일격에 벽이 무너진다."
          ],
          "divide": [
            "그릇 자체: 날카로워진다. 구조를 더 깎고, 탄은 점수만큼 몸을 꿰뚫는다. 두름이면 둔화와 속박을 푼다.",
            "닿은 것: 부순다. 가장 큰 타격. 2점 이상이면 상대의 실도 끊는다.",
            "마력 부담이 크다. 단단한 벽에는 질과 「상」의 조합이 필요하다."
          ],
          "convert": [
            "그릇 자체: 받은 마력을 흡수한다. 벽과 고리가 막은 일격, 두름이 받은 타격의 일부가 자신의 마력이 된다.",
            "닿은 것: 마력을 빼앗는다. 빼앗은 양의 6할이 자신에게 돌아온다.",
            "타격은 늘지 않는다. 마력을 빼앗아도 상대의 몸은 깎이지 않는다."
          ],
          "grow": [
            "그릇 자체: 수와 시간이 늘어난다. 탄과 광선은 부채꼴로 늘고, 고리는 칼날이 늘며, 영역은 오래 남고, 벽은 길어진다. 두름이면 몸이 재생한다.",
            "닿은 것: 자신의 문장을 고친다. 자신의 영역 안의 자기 몸과 자신의 벽을 고친다.",
            "늘어난 한 발은 가벼워진다(합계는 늘어난다). 상대에게는 효과가 없다."
          ],
          "phase": [
            "그릇 자체: 보이지 않고 「결」을 통과한다. 「상」이 벽이나 결계의 「결」보다 많으면 통과한다. 두름이면 모습이 사라지고 벽도 지나간다.",
            "닿은 것: 표식을 남긴다. 표식이 붙은 상대는 숨을 수 없고 타격이 조금 무거워진다.",
            "다가가거나, 영창하거나, 맞으면 모습이 드러난다. 바위는 통과할 수 없다."
          ]
        },
        "vessel": {
          "bolt": [
            "조준점으로 날아가는 마력 덩어리.",
            "기본 공격. 궤도(포물·추적·회귀)와 단으로 변한다.",
            "직진은 옆으로 피할 수 있다. 벽에 막힌다."
          ],
          "ray": [
            "순식간에 뻗어 줄지은 적을 꿰뚫는 빛.",
            "먼 상대, 에너지 결계 파괴.",
            "영창과 소비가 무겁다. 설치 벽에 막힌다."
          ],
          "wall": [
            "조준점에 서는 벽.",
            "사선을 끊는다. 「동」이면 나아가는 벽, 「분」이면 닿으면 아픈 벽.",
            "자신의 몸과 술도 막는다. 「분」과 고체에 깎인다."
          ],
          "field": [
            "조준점에 열리는 영역. 열리는 순간 강하게, 남아 있는 동안 약하게 작용한다.",
            "범위 공격·함정·결계(결)·회복 영역(증).",
            "밖으로 나가면 효과가 없다."
          ],
          "body": [
            "자신의 몸을 그릇으로 삼는다.",
            "가속·경화·재생·은신·몸통 박치기.",
            "한 번에 하나만 두를 수 있다. 멀리 닿지 않는다."
          ],
          "orbit": [
            "자신 주위를 도는 칼날이나 성벽.",
            "날아오는 탄을 받아내고 다가온 상대에게 작용한다.",
            "멀리 닿지 않는다. 칼날은 깎이면 부서진다."
          ]
        },
        "then": {
          "hit": [
            "닿은 곳에서 다음 단이 열린다.",
            "착탄하면 터지는 탄, 밟으면 발동하는 함정, 맞으면 반격하는 두름.",
            "빗나가면 열리지 않는다(탄은 조준점에서 열린다)."
          ],
          "end": [
            "지속을 다 쓴 곳에서 다음 단이 열린다.",
            "시간차 폭발, 공중에서 갈라지는 탄, 끊김 없는 방어.",
            "상대가 기다려 준다는 보장은 없다."
          ],
          "signal": [
            "F 신호로 다음 단이 열린다.",
            "설치한 함정을 원할 때 기폭한다.",
            "실의 유지비가 들고 너무 멀면 끊긴다."
          ],
          "break": [
            "그릇이 부서진 곳에서 다음 단이 열린다.",
            "부서지면 반격하는 벽과 고리.",
            "부서지지 않으면 열리지 않는다."
          ]
        }
      },
      "world": [
        [
          "마소와 마력",
          "바닥의 빛 입자는 마소다. 흡수하면 자기 문장이 새겨진 마력이 된다. 술은 마력을 쓰며 마소를 줍거나 절점 원 안에서 보충한다."
        ],
        [
          "문장과 구조체",
          "문장은 마력의 주인을 나타낸다. 자신의 공격은 자신을 해치지 않지만 고정된 벽은 구조체라 자신의 몸·탄·광선도 막는다."
        ],
        [
          "산일과 실",
          "방출한 술은 결국 풀린다. 실을 유지하면 유도·신호·회수가 가능하지만 유지비와 거리 한계가 있다."
        ],
        [
          "원리에서 현상으로",
          "불이나 번개 속성을 고르는 세계가 아니다. 여섯 원리로 마소의 운동과 형태를 조작해 빛·충격·결정·결계를 만든다."
        ]
      ],
      "tutorial": [
        [
          "동과 분: 탄을 쏜다",
          "1번 마탄(동1·분1의 탄)으로 앞의 인형을 조준해 2번 쏘자. PC는 마우스로 조준해 왼쪽 클릭, 스마트폰은 오른쪽을 터치. 파란 막대가 마력. 연습용 술은 저장한 네 술을 바꾸지 않는다."
        ],
        [
          "결: 벽으로 막는다",
          "1번을 돌벽(결3의 벽)으로 바꿨다. 인형과의 사이를 조준해 벽을 세우고 탄을 한 번 막자. 벽은 자신의 몸과 술도 막는다. WASD/왼쪽 조작으로 벽 뒤로 움직일 수 있다."
        ],
        [
          "원리를 더한다",
          "술식대를 열고 1번 탄의 「결」에 1점 이상을 주고 결정. 그 탄을 인형에 맞히자. 「결」은 닿은 상대를 그릇의 중심(탄이면 자신)에 묶는다."
        ],
        [
          "그릇을 바꾼다",
          "술식대에서 1번의 그릇을 「고리」로 바꾸고 결정해 쏘자. 같은 원리가 자신 주위를 도는 칼날이 된다. 그릇이 바뀌어도 원리의 뜻은 변하지 않는다."
        ],
        [
          "분: 벽을 무너뜨린다",
          "앞의 인형이 벽을 세웠다. 술식대에서 1번 탄의 「분」을 2점 이상으로 올려 쏘자. 「분」은 구조를 깎는다. 부순 일격은 벽에서 멈추므로 한 번 더 쏜다."
        ],
        [
          "단을 잇는다",
          "술식대에서 「단 추가」를 누르고, 1번 탄이 「닿으면」 2단의 영역이 열리는 술을 만들자. 영역에도 원리를 주고 움직이는 인형에 맞히자."
        ],
        [
          "관찰하고, 다시 짜고, 다시 싸운다",
          "전장에서는 상대의 술과 사선을 본다. 벽에는 「분」이나 「상」을, 추적에는 옆 이동을, 결계에는 광선이나 고체를 시험하자. 마력은 마소를 줍거나 절점에서 보충한다. 술식 편집은 수련장이나 입장 전에. 연습용 술은 여기서 원래대로 돌아간다."
        ]
      ],
      "example": "「동」만 있는 탄은 빠르게 민다. 「분」을 더하면 부수고, 「결」을 더하면 상대를 자신에게 묶는다. 같은 점수를 영역에 주면 범위가 되고, 두름에 주면 몸에 깃든다. 「탄이 닿으면 영역을 연다」로 단을 이으면 폭렬구. 원리는 「무엇을 하는가」, 그릇과 단은 「어떻게 쓰는가」를 정한다."
    }
  }
};

(typeof window !== 'undefined' ? window : globalThis).PRIMA_LANG = LANG;
})();
