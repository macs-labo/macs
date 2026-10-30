// ==== 使用回数上限の超過判定 (成分別・内訳枠): 時期/方法/対象の3軸で規定文を解釈する ====
/*
 * 【全体像】
 *  入力  : 計画表の使用行(1行 = 1回の使用。「使用回数」列の値は使わない)と、有効成分ごとの成分回数(seibunkaisu)の規定文
 *  規定文: 「4回以内(は種時の土壌混和は1回以内、生育期の株元灌注は1回以内、散布は合計2回以内)」のように、
 *          先頭が総量、括弧内が「使用時期・使用方法・対象(剤型など)ごとの内訳上限」
 *  処理  : ①規定文を「枠(slot)」と「条件(atom)」に分解する(parseRule)
 *          ②使用行を 時期(positions) / 方法(methods) / 対象(targets・form) に分解する(normalizeRow)
 *          ③行と条件を 3値(yes/maybe/no)で照合し、行を1つの枠に割り当てる(assign)
 *          ④枠ごとに使用回数を数え、上限超過を NG、確定できない使用を含めて超えるなら 要確認 とする(judge)
 *  方針  : 確定した使用だけで超えたときだけ NG。確定できない使用は候補の枠すべてに「可能性」として数え(最悪の場合)、
 *          それで上限を超えうるときだけ 要確認。超えようがなければ、不明な点があっても OK(1回の使用は上限を超えない)。
 *
 *  【判定要件】(2026-10 確定。要確認548件の精査で定めたもの)
 *   R1  要確認の条件: 枠を確定できない行・読めない時期語の行・解釈できない条件は「可能性」として数え、上限を超えうるときだけ要確認。
 *       規定文そのものを読めない場合は、内訳の上限は最低1回なので、その成分の使用が2回以上のときだけ要確認
 *   R2  排他的な区分(最上位の内訳の上限の合計 ≥ 総量): 使用はどれかの枠に属する。該当しうる枠が1つなら確定(消去法)
 *   R3  排他的な区分で、名指しの時期だけの枠(休眠期処理)と一般の方法の枠(散布・灌注・混和)の両方に当たる行は時期の枠
 *   R4  同格の候補は、方法の語句が使用方法と文字どおり一致する枠、時期が真に狭い枠(定植直後 ⊂ 定植後)を優先
 *   R5  出来事基準の時期(開花・出穂・幼穂形成・入水・伏せ込み・加温・一次/二次生理落果・浸種)は前後関係で照合。
 *       使用時期の括弧書きも読む。行がその出来事に触れていなければ確定しない(maybe)。
 *       ただし生育ステージの表にその出来事の時期があり、防除時期との前後が分かる行(item.eventDates)は、文面で決まらないときその前後で決める。
 *       前提: 出穂前20日以内は幼穂形成期の後、二次生理落果の時期・後は一次生理落果の後、満開・落花の後は開花の後
 *   R6  横断的な時期の枠(出来事基準の時期だけの節で、内訳の合計が総量を超え、時期の無い方法の節と並ぶもの。例: 出穂期以降)は、
 *       方法の枠と重ねて数える
 *   R7  時期の語彙: 本葉N枚・展開時・出芽時・袋掛け・初発・収穫予定N日前→生育中、覆土前→は種時、鉢上・仮植・株冷蔵・苗の低温暗黒処理→育苗中、
 *       植替→定植、培土→土寄せ、萌芽直前→萌芽前(植付前・植付時も萌芽前)、「その…後」→直前の語の後、作物名の(仮植床)→仮植床での使用
 *   R8  方法・対象の語彙: 土壌表面散布・全面土壌散布・播溝散布・全面均一散布は「散布」と区別、設置・配置、毒餌、鱗片=種子、罹病株、
 *       仮植床・苗床・育苗培土・育苗期=育苗の場所、は種前の浸漬・粉衣=種子への処理
 *   R9  「N倍希釈」の枠は、行の希釈倍数の範囲で照合(収まれば該当、重ならなければ非該当、一部・不明は確定しない)
 *   R10 使用目的: 「茎葉枯凋」「除草剤として」「…に使用する場合」は病害虫名の欄で照合。「異なる目的には使用しない」は2目的以上の使用でNG
 *   R11 条件付きの上限(「当該処理をする場合には」「…をする場合には」)は、条件の処理を計画で使ったときだけ効かせる
 *   R12 規定文の読み方: 「A又はB」は1枠を共有、「粉剤及び粉粒剤のX」「は種又は定植後」は後半を前の語にも分配、
 *       「…までの」は期間、「1花房当り1回」など単位当たりの回数は判定外、先頭が条件の規定(「種子への処理は1回、…」)は総量なしの内訳
 *   R13 1枠に時期の違う条件が並ぶとき、行の時期が条件の時期の和に収まれば、その枠に該当
 *   R14 排他的な区分なのにどの枠にも当たらない行は、時期の読み違いとみなし、方法・対象で否定されない枠を候補に戻す
 *       (0なら総量にだけ数える。規定文と登録の方法が食い違う場合で、規定文側の問題)
 *   R15 含有率で区別する剤型(「2%粒剤」「1%粒剤」)は、農薬名から辞書の含有率を引いて照合。含有率表は、そのような規定を持つ成分を
 *       判定するときだけ、データベース(kihon ビュー)からその成分の分を作る(contentPctOf)。引けない農薬は確定しない。
 *       「散布」の受け皿にしか確定的に当たらない株元散布などの行は、方法まで合う別の枠に該当しうるなら確定しない
 *
 *  【用語】
 *   枠(slot)   : 「Xは合計N回以内」1つ分の上限。{ id, label, limit, overlay, parentAtoms }。
 *                「合計」または条件が1つなら複数条件で1枠を共有、「合計」なしの列挙は条件ごとに別枠になる。
 *   条件(atom) : 枠に属する1つの条件(例: 「は種時の土壌混和」)。時期・方法・対象のうち書かれた軸だけを持つ。
 *   overlay    : 入れ子の括弧(内数)。親の条件と自分の条件の両方に当てはまる行を数える追加の枠。
 *   位置(P)    : 作業時期を時間軸上の位置に置き換えた番号(下の P)。
 *   3値照合    : yes=確実に該当 / maybe=該当するかもしれない(情報不足) / no=該当しない。
 *                枠を1つに確定できた行だけを「確定」として数え、確定できない行は「可能性」として別に数える。
 *
 *  【理由の文言と表示】(判定とは別に管理する。表示の集約・並べ替えに判定は使わない)
 *   内訳枠の理由は、規定文の内訳枠の文言そのもの(slotTextOf)+「: 使用回数N回」(要確認は「+可能性M回」)。
 *     例: 「本田での散布、空中散布、無人ヘリ散布は合計3回以内: 使用回数4回」
 *   内訳枠のある成分は、判定がどうであれ、その行が数えられた枠の理由を必ず表示する(OK の枠は judge の facts / okLines)。
 *   成分の総使用回数の理由(「総使用回数は4回以内: 使用回数4回」)も判定によらず必ず表示する。
 *   本剤の使用回数(登録ごと・登録をまたいだ合計)は表の使用回数・使用上限の列で分かるので、理由には書かず判定にだけ反映する。
 *
 *  【要確認の解消(利用者の選択)】
 *   judge は確定できない点ごとに「問い」を作り(questions)、opts.resolve(問い) が答えを返せばその答えで確定して数える。
 *   答えは画面の中だけで持つ(usageChoices)。防除計画(.json)には保存しない。選択がなければ判定は従来と同じ。
 *
 *  【公開】 UsageLimit.judge(items, 成分名, { contentPct(農薬名, 成分名), resolve(問い) })、
 *          UsageLimit.text(item, 成分名, { contentPct })(使用行が当たる内訳枠の規定文の文言。薬剤別の集計キー用。選択は反映しない)、
 *          UsageLimit.stageOf(時期)(現在の表示では使っていない)。ほかはすべてこの関数の内部用。
 *   items の各行: { no, ref, sakumotsu, yakuzai, zaikei, jiki, hoho, ekiryo, baisu(希釈倍数), byochu(病害虫名・使用目的), seibunkaisu,
 *                   stage(段階別使用回数の登録の行だけ: 'NURSERY'=苗床・育苗 / 'FIELD'=本圃・本田 / 'BOTH'=決まらない。normalizeRowRaw 参照),
 *                   eventDates(生育ステージの表の出来事の時期に対する防除時期の前後 Map(出来事 → 'before'|'at'|'after')。matchTime 参照) }
 */
const UsageLimit = (() => {

// ============================================================ メモ化(計画表の更新ごとに再計算しない)
const jikiCache = new Map();   // 使用時期の文字列 → parseJikiRaw の結果
const ruleCache = new Map();   // 規定文(作物別規定は作物名も含む) → parseRuleRaw の結果
const rowCache = new Map();    // 「時期・方法・液量・薬剤名・剤型」の組 → normalizeRowRaw の結果
/** cache から key の値を返す。無ければ make() で作って保存する(結果は変更しない前提で共有する) */
function memo(cache, key, make) {
	let v = cache.get(key);
	if (v === undefined) { v = make(); cache.set(key, v); }
	return v;
}
/** 使用時期の文字列を解析する(メモ化)。戻り値は parseJikiRaw を参照 */
const parseJiki = (t) => memo(jikiCache, String(t == null ? '' : t), () => parseJikiRaw(t));
/**
 * 規定文を解析する(メモ化)。t: 規定文、sakumotsu: 行の作物名。
 * 作物別の規定(数字で始まらない文)だけが作物名で結果が変わるので、そのときだけキャッシュのキーに作物名を含める
 */
const parseRule = (t, sakumotsu) => {
	const text = String(t == null ? '' : t);
	const key = /^\s*\d/.test(text) ? text : text + '\u0000' + (sakumotsu || '');
	return memo(ruleCache, key, () => parseRuleRaw(text, { sakumotsu }));
};
/** 使用行 r = { jiki, hoho, ekiryo, yakuzai, zaikei } を照合用の形に正規化する(メモ化)。戻り値は normalizeRowRaw を参照 */
const normalizeRow = (r) => memo(rowCache, [r.jiki, r.hoho, r.ekiryo, r.yakuzai, r.zaikei, r.baisu, r.byochu, /仮植/.test(r.sakumotsu || '') ? 'K' : '', r.stage || '',
	r.eventDates && r.eventDates.size ? [...r.eventDates].map(([e, x]) => e + '=' + x).join(',') : ''].join('\u0001'), () => normalizeRowRaw(r));

// ============================================================ 時期の語彙
// 作業時期を1本の時間軸(年内の作業順)上の位置に置き換える。範囲(A～B)は両端の間の位置をすべて含めて扱う
//   PRE  =0 作付前・耕起前・前作(土壌消毒など)   SOWB =1 は種前(浸種・催芽を含む)   SOW  =2 は種時・直播時
//   RAISE=3 育苗期(は種後～移植前)               PLB  =4 移植・定植・植付の前       PL   =5 移植時・定植時(当日・同時)
//   PLA  =6 移植・定植の直後(植付後萌芽前を含む) GROW =7 生育期・本田・発生期など   HILL =8 土寄せ時・土寄せ後(生育期の後半)
//   HARV =9 収穫期                               AFTER=10 収穫後・剪定後(次作までの休閑期)
const P = { PRE: 0, SOWB: 1, SOW: 2, RAISE: 3, PLB: 4, PL: 5, PLA: 6, GROW: 7, HILL: 8, HARV: 9, AFTER: 10 };
const P_MAX = 10;   // 位置の最大値(AFTER)
/** a から b までの整数配列(両端を含む)。範囲の間を埋めるのに使う */
const range = (a, b) => { const r = []; for (let i = a; i <= b; i++) r.push(i); return r; };

/** 文字列の正規化: 全角→半角(NFKC)、波ダッシュ類(~〜～)を「~」に統一、空白を除去。比較・解析の前に必ず通す */
function norm(s) {
	return String(s == null ? '' : s).normalize('NFKC').replace(/[~〜～]/g, '~').replace(/\s+/g, '');
}

/** 時期の比較キー: 括弧書き・但し書き・語尾(まで/までの処理)を除いた文字列。行の時期と規定文の枠条件が同じ表現かの判定に使う */
function timeKeyOf(t) {
	return norm(t).replace(/\([^)]*\)/g, '').replace(/^[^:、~]{1,12}:/, '').replace(/(但し|ただし|但).*$/, '').replace(/までの処理$|まで$|の処理$|処理$/, '');
}

// ============================================================ 出来事を基準にした時期(event)
// 開花・出穂・入水など、時間軸(P)の位置だけでは前後を区別できない出来事。
// 規定(「開花前は2回以内、開花後は3回以内」)と使用時期(「開花から収穫前日まで」)が同じ出来事に触れていれば、その前後関係で照合する。
// 使用時期の括弧書き(「は種直後～稲出芽前(入水15日前まで)」)も読む
const EVENTS = [
	['開花', /開花/],
	['出穂', /出穂/],
	['幼穂形成', /幼穂形成/],
	['入水', /入水/],
	['伏込', /伏せ?込み?/],
	['加温', /加温/],
	['一次生理落果', /一次生理落果/],
	['二次生理落果', /二次生理落果/],
	['浸種', /浸種/],
];
/**
 * 文字列中の出来事と、それに対する相対位置を返す。戻り値 Map(出来事 → 'before'|'at'|'after'|'from'|'span')
 *   before=前・直前・N日前 / at=時・期(その時期) / after=後・直後・N日後 / from=以降・から(その時期を含めて後) /
 *   span=前と後の両方に触れている(「満開予定日10日前～満開40日後」など)
 * 「加温ハウス」のように前後の語が付かない言及は数えない
 */
function eventsOf(text) {
	const s = norm(text);
	const res = new Map();
	const add = (ev, rel) => {
		const cur = res.get(ev);
		if (!cur || cur === rel) { res.set(ev, rel); return; }
		const set = new Set([cur, rel]);
		// 前と後(以降)の両方 → span。後と以降 → 以降。時と後 → 以降
		if (set.has('before') || set.has('span')) res.set(ev, 'span');
		else res.set(ev, 'from');
	};
	EVENTS.forEach(([ev, re]) => {
		const g = new RegExp(re.source, 'g');
		let m;
		while ((m = g.exec(s))) {
			const t0 = s.slice(m.index + m[0].length);           // 出来事の語の直後
			const hasKi = /^(?:発生)?期/.test(t0);                // 「出穂期」「二次生理落果発生期」
			const tail = t0.replace(/^(?:発生)?期?/, '');
			let rel = null;
			if (/^(?:直前|前)/.test(tail) || /^\d+(?:~\d+)?日前/.test(tail)) rel = 'before';
			else if (/^(?:以降|から|~)/.test(tail)) rel = 'from';
			else if (/^(?:直後|後)/.test(tail) || /^\d+(?:~\d+)?日後/.test(tail)) rel = 'after';
			else if (hasKi || /^(?:時|当日|同時)/.test(tail)) rel = 'at';
			if (rel) add(ev, rel);
		}
	});
	// 満開・落花の後は開花の後(「満開20～40日後」)
	if (/(?:満開|落花)期?(?:後|以降|\d+(?:~\d+)?日後)/.test(s)) add('開花', 'after');
	// 二次生理落果は一次生理落果の後に起こる。二次生理落果の時期・後の使用は、一次生理落果より後
	if (res.has('二次生理落果') && res.get('二次生理落果') !== 'before' && !res.has('一次生理落果')) res.set('一次生理落果', 'after');
	// 麦・稲の幼穂形成期は出穂のおよそ25～45日前。出穂20日前より後(出穂前20日以内)の使用は幼穂形成期の後とみなす(農学上の前提)
	if (!res.has('幼穂形成')) {
		const hm = s.match(/出穂(?:期)?前(\d+)(?:~(\d+))?日/);
		if (hm && Math.max(Number(hm[1]), Number(hm[2] || 0)) <= 20) res.set('幼穂形成', 'after');
	}
	return res;
}

/** 規定の相対位置 a と使用時期の相対位置 r の照合(3値) */
function eventRel(a, r) {
	if (r === 'span') return 'maybe';
	if (a === 'before') return r === 'before' ? 'yes' : 'no';
	if (a === 'after') return r === 'after' || r === 'from' ? 'yes' : r === 'at' ? 'maybe' : 'no';
	if (a === 'from') return r === 'before' ? 'no' : 'yes';
	if (a === 'at') return r === 'at' ? 'yes' : r === 'from' ? 'maybe' : 'no';
	return 'maybe';
}

/**
 * 1つの語(「移植3日前」「定植直後」等)を 作業基準 + 相対位置 に分解する。戻り値 { term, anchor, rel, lit }
 *   anchor: 基準となる作業。'PLANT'(移植・定植・植付) / 'SOW'(は種) / 'RAISE'(育苗) / 'AFTER'(収穫後・剪定後) /
 *           'PRE'(作付前・耕起) / 'GROW'(生育期・発生期などの生育の語) / null(基準なし)
 *   rel   : 基準に対する相対位置。'before'(前) / 'at'(時・当日・同時) / 'just_after'(直後) / 'after'(後) / 'during'(期間中) / null
 *   lit   : 位置に置けない季節・月の語(休眠期・夏・6月・融雪後 など)をそのままの文字列で保持する。これは文字列の一致で照合する
 * 上から順に最初に当たった分類を採用する(順序が意味を持つ。例: 「育苗トレイ」は時期でなく対象なので育苗の分類から除外している)
 */
function scanTerm(t) {
	let anchor = null;   // 基準となる作業(上記)
	let lit = null;      // 位置に置けない語(季節・月)
	let rel = null;      // 基準との前後関係(上記)
	// 仮植(仮植床への植付・仮植前)は本圃に植える前の育苗の段階。「植付」を含むので定植より先に判定する
	if (/仮植/.test(t)) { anchor = 'RAISE'; rel = 'during'; }
	else if (/移植|定植|植付|植え付け|田植|植栽|挿苗|植替/.test(t)) anchor = 'PLANT';   // 挿苗(かんしょ等)・植替(わさび等)は定植と同じ
	else if (/浸種|催芽/.test(t)) { anchor = 'SOW'; rel = 'before'; }
	else if (/は種|播種|直播|種まき/.test(t)) anchor = 'SOW';
	else if (/覆土/.test(t)) { anchor = 'SOW'; rel = 'at'; }   // 覆土前・覆土時 = は種した直後(箱育苗の種籾の上など)。は種時として扱う
	else if (/育苗(?!箱|トレイ|ポット|培土)/.test(t)) anchor = 'RAISE';   // 「育苗トレイ」は時期ではなく対象
	else if (/(収穫|摘採|剪定|刈取)(直|終了|約\d+[カケヶ]?月)?後/.test(t)) anchor = 'AFTER';
	else if (/作付|耕起|前作|地ごしらえ|整地|残渣|土壌消毒/.test(t)) anchor = 'PRE';
	else if (/休眠|根雪|夏期|冬期|秋期|春期|積雪|落葉|萌芽直?前|夏|冬/.test(t)) lit = (t.match(/休眠期?|根雪前?|夏期?|冬期?|秋期?|春期?|積雪期?|落葉期?|萌芽直?前|夏|冬/) || [t])[0].replace('萌芽直前', '萌芽前');   // 萌芽直前 = 萌芽前
	else if (/発芽前|出芽前|緑化|鉢上|苗床|株冷蔵|低温暗黒/.test(t)) { anchor = 'RAISE'; rel = 'during'; }   // 鉢上・株冷蔵・苗の低温暗黒処理は育苗中の作業
	else if (/植代|しろかき|代かき/.test(t)) { anchor = 'PLANT'; rel = 'before'; }   // 植代 = 移植の少し前
	else if (/融雪後/.test(t)) lit = '融雪後';
	else if (/\d+月/.test(t)) lit = t.match(/\d+月/)[0];
	else if (/土寄|(?<!育苗)培土(?!混和)/.test(t)) anchor = 'HILL';   // 培土 = 土寄せ(「育苗培土」は育苗用の土なので除く)   // 土寄せ(培土)は生育期の途中の作業。「土寄せ後」は萌芽前・生育初期を含まない
	else if (/本田|本圃|生育|発生|発病|雑草(?!茎葉)|萌芽|葉期|出穂|穂|幼虫|成虫|着色|結実|展葉|伸長|培土|出蕾|成熟|新梢|開花|満開|発芽|抽苔|果実|肥大|落花|株元|収穫期|収穫始|収穫直前|収穫予定|収穫開始予定|出芽|本葉|展開|初発|袋掛|果|苗立|病斑|若齢|初期|終期|盛期|始期|期/.test(t)) anchor = 'GROW';   // 本葉N枚・展開時・出芽時・袋掛け・病害の初発前などは作物の生育中
	if (rel == null) {
		if (/直後/.test(t)) rel = 'just_after';
		else if (/後/.test(t)) rel = 'after';
		else if (/前/.test(t)) rel = 'before';
		else if (/当日|同時|時/.test(t)) rel = 'at';
	}
	return { term: t, anchor, rel, lit };
}

/**
 * 行(使用時期)側: scanTerm の結果が指す位置の集合(P の値の配列)を返す。行は「実際にいつ使ったか」なので点に近い。
 * 例: 「移植前」→[PLB]、「移植後」→[PLA, GROW]、「は種後」→[RAISE]、「定植時」→[PL]
 */
function rowPositions(sc) {
	const a = sc.anchor;   // 基準の作業
	if (a === 'PLANT') return sc.rel === 'before' ? [P.PLB] : sc.rel === 'after' ? [P.PLA, P.GROW] : sc.rel === 'just_after' ? [P.PLA] : [P.PL];
	if (a === 'SOW') return sc.rel === 'before' ? [P.SOWB] : sc.rel === 'just_after' || sc.rel === 'after' ? [P.RAISE] : [P.SOW];
	if (a === 'RAISE') return [P.RAISE];
	if (a === 'PRE') return [P.PRE];
	if (a === 'AFTER') return [P.AFTER];
	if (a === 'GROW') return [P.GROW];
	if (a === 'HILL') return sc.rel === 'before' ? [P.GROW] : [P.HILL];
	return [];
}

/**
 * 規定文(atom)側: 「までの処理」「〜後」「〜前」の意味を区間に展開した位置の配列を返す。規定は「その時期の使用すべて」を指すので区間になる。
 * upto: 「定植時までの処理」のように「まで」で終わる条件(=その時点までの全期間)のとき true
 * 例: 「定植時までの処理」→ PRE～PL、「定植後」→ PLA～AFTERの手前、「本田」→ PLA～AFTERの手前
 */
function atomPositions(sc, upto) {
	const a = sc.anchor;   // 基準の作業
	// 以降の at/bef/aft は、基準が定植か は種かで決まる「その時・その前・その直後」の位置
	if (!a) return [];
	if (a === 'GROW') return /本田|本圃/.test(sc.term) ? range(P.PLA, P_MAX - 1) : [P.PLA, P.GROW, P.HILL, P.HARV];
	if (a === 'HILL') return upto ? [P.PLA, P.GROW, P.HILL] : sc.rel === 'before' ? [P.PLA, P.GROW] : [P.HILL, P.HARV];
	if (a === 'AFTER') return [P.AFTER];
	if (a === 'PRE') return sc.rel === 'before' || upto ? range(P.PRE, P.PRE) : [P.PRE];
	if (a === 'RAISE') return [P.RAISE];
	const at = a === 'PLANT' ? P.PL : P.SOW;
	const bef = a === 'PLANT' ? P.PLB : P.SOWB;
	const aft = a === 'PLANT' ? P.PLA : P.RAISE;
	if (upto) return range(P.PRE, at);
	if (sc.rel === 'before') return range(P.PRE, bef);
	if (sc.rel === 'just_after') return [aft];
	if (sc.rel === 'after') return range(aft, P_MAX - 1);
	return [at];
}

/** 「は種又は定植21日前まで」のように、後ろの語だけが持つ相対位置(前・後など)を、相対位置を持たない前の語に引き継ぐ。scans を直接書き換える */
function inheritRel(scans) {
	for (let i = scans.length - 2; i >= 0; i--) {
		if (scans[i].anchor && scans[i].rel == null && scans[i + 1].rel != null) scans[i].rel = scans[i + 1].rel;
	}
}

const LIST_SEP = /又は|または|もしくは|及び|並びに|かつ|、|,/;   // 語の列挙の区切り(時期・方法・条件の列挙で共通)
// 「収穫前日まで」「14日前まで」のように、時期語を含まず収穫前日数(PHI)だけを表す文字列
const PHI_ONLY = /^(?:収穫|摘採|出荷|摘心)?(?:\d+日)?前(?:日)?まで$/;

/**
 * 使用時期文字列 → { positions, literals, phi, empty, implied, unresolved }
 *   phi: 収穫前日数(「収穫前日まで」=1)。時期語ではない
 *   implied: 時期語が無く収穫前日数だけ → 圃場に作物がある期間とみなす
 */
function parseJikiRaw(text) {
	// res: 戻り値。timeKey=比較キー、phi=収穫前日数、positions=時間軸上の位置(P)の集合、literals=季節・月の語の集合、
	//      empty=時期の記載なし、implied=収穫前日数だけなので「作物が圃場にある期間」とみなした、unresolved=解釈できなかった語
	const res = { raw: String(text == null ? '' : text), timeKey: timeKeyOf(text), phi: null, positions: new Set(), literals: new Set(), empty: false, implied: false, unresolved: [] };
	let s = norm(text);   // 正規化した時期文字列
	if (s === '' || s === '-') { res.empty = true; return res; }
	// 「植付時(仮植床)」のように括弧で仮植床と書かれた行は、仮植床への植付(育苗の段階)。括弧は後で除くので先に本文へ移す
	if (/\(仮植床?\)/.test(s)) s = '仮植床' + s.replace(/\(仮植床?\)/, '');
	res.events = eventsOf(s);   // 開花・出穂などの出来事を基準にした時期(括弧書きも含めて読む)

	const m = s.match(/(?:収穫開始|収穫|摘採|出荷|摘心)(?:(\d+)日)?前(日)?まで/);
	if (m) res.phi = m[1] ? Number(m[1]) : 1;

	// main: 括弧書き・「1回目:」のような見出し・但し書き(収穫前日数など)を除いた、時期語だけの文字列
	let main = s.replace(/\([^)]*\)/g, '').replace(/^[^:、~]{1,12}:/, '').replace(/(但し|ただし|但).*$/, '');
	// 範囲の終点に付く「収穫N日前まで」は時期語ではないので取り除く(phiとして保持済み)
	main = main.replace(/(?:~|から)?(?:[^、~]*?の)?(?:収穫開始|収穫|摘採|出荷|摘心)(?:\d+日)?前(?:日)?まで/g, '');
	if (main === '' || PHI_ONLY.test(main)) {
		if (res.phi != null) {
			res.implied = true;
			[P.PLA, P.GROW, P.HILL, P.HARV].forEach((p) => res.positions.add(p));
		} else res.empty = true;
		return res;
	}

	parsePeriod(main, res);
	return res;
}

/**
 * 時期の文字列(「A～B」「AからB」「A又はB」)を positions/literals/unresolved に解釈して res に足す。
 * 使用行の時期と、規定文の内訳条件(「収穫終了後～落葉期までは3回以内」など)で同じ関数を使い、
 * 同じ文字列なら必ず同じ結果になるようにする。
 */
function parsePeriod(main, res) {
	// parts: 「~」「から」で分けた範囲の各端(1つなら範囲ではない)。partScans: 各端を「又は・及び」でさらに分けた語の scanTerm 結果
	const parts = main.split(/(?<!\d)~|~(?!\d)|から/).filter(Boolean);
	const partScans = parts.map((part) => {
		const scans = part.split(LIST_SEP).filter(Boolean).map(scanTerm);
		inheritRel(scans);
		// 「本葉2～3枚時とその2週間後」「休眠に入る直前及びその約1カ月後」の「その…後」は、直前の語を基準にした後の時期
		scans.forEach((sc, k) => {
			if (k > 0 && /^その/.test(sc.term) && !sc.anchor && !sc.lit) {
				const prev = scans[k - 1];
				sc.anchor = prev.anchor; sc.lit = prev.lit; sc.rel = prev.anchor ? 'after' : sc.rel;
			}
		});
		return scans;
	});
	// 「移植3日前～当日」の「当日」のように基準語を持たない終点は、もう一方の基準語を借りる
	const anchors = partScans.flat().filter((sc) => sc.anchor);
	if (anchors.length) {
		partScans.flat().forEach((sc) => {
			if (!sc.anchor && !sc.lit && (sc.rel === 'at' || sc.rel === 'after' || sc.rel === 'before')) sc.anchor = anchors[0].anchor;
		});
	}
	// 「移植直後～15日」「移植後3日～10日」の「15日」「10日」のように、日数だけの終点は、直前の端の基準を引き継ぐ
	// (直前が「前」なら前、それ以外は後。「移植前3日～1日」なら移植前、「移植後3日～10日」なら移植後)
	partScans.forEach((scans, pi) => {
		if (pi === 0 || scans.length !== 1 || !/^\d+日(間)?$/.test(scans[0].term)) return;
		const prev = partScans[pi - 1].filter((sc) => sc.anchor).pop();
		if (prev) { scans[0].anchor = prev.anchor; scans[0].rel = prev.rel === 'before' ? 'before' : 'after'; }
	});
	// 行のすべての語が「は種・定植・植付の前」(または作付前)を指すか。「は種又は定植9日前まで」は「は種又は定植後」の枠には当たらない
	const anchored = partScans.flat().filter((sc) => sc.anchor);
	res.allBeforeAnchor = anchored.length > 0 && anchored.every((sc) => sc.anchor === 'PRE' || ((sc.anchor === 'SOW' || sc.anchor === 'PLANT') && sc.rel === 'before'));
	const partPos = [];   // 各端が指す位置の集合(範囲の端どうしの前後関係を見るため、端ごとに保持する)
	partScans.forEach((scans) => {
		const pos = new Set();
		scans.forEach((sc) => {
			const ps = rowPositions(sc);
			if (ps.length) ps.forEach((p) => pos.add(p));
			else if (sc.lit) res.literals.add(sc.lit);
			else res.unresolved.push(sc.term);
		});
		partPos.push(pos);
	});
	// 「植付後萌芽前」「植付後～萌芽前」のように移植・植付の後で萌芽(発芽・出芽)前までの期間は、植付直後の位置(PLA)だけ。
	// 生育期(GROW)以降は含まない。「休眠期～萌芽前」など植付を伴わない萌芽前は、従来どおり季節の語として扱う
	if (/(萌芽|発芽|出芽)直?前/.test(main) && partPos.some((ps) => ps.has(P.PLA))) {
		partPos.forEach((ps) => { ps.delete(P.GROW); ps.delete(P.HILL); ps.delete(P.HARV); });
		res.literals.add('萌芽前');   // 「萌芽前」の枠(季節の語)と照合するために残す
		res.preEmerge = true;         // 植付後・萌芽前の行(matchTime で、生育期・萌芽後の枠には当てず、萌芽前の枠には確定させる)
	}
	const all = new Set();   // 全端の位置の和集合(範囲でないときはこれがそのまま結果、範囲のときは最小～最大の間を埋める)
	partPos.forEach((ps) => ps.forEach((p) => all.add(p)));
	if (parts.length >= 2 && partPos.every((ps) => ps.size > 0)) {
		const first = partPos[0];
		const last = partPos[partPos.length - 1];
		if (Math.max(...first) > Math.min(...last)) {
			// 終点が始点より前の位置 = 年をまたぐ期間(収穫終了後から萌芽まで 等)。生育期などは含めず、始点側だけを使う
			first.forEach((p) => res.positions.add(p));
		} else {
			range(Math.min(...all), Math.max(...all)).forEach((p) => res.positions.add(p));   // 範囲は間を埋める
		}
	} else all.forEach((p) => res.positions.add(p));
	return res;
}

// ============================================================ 方法・対象の語彙
// 方法は「種類/細分」の階層で持つ。規定の「散布」(親)は、行の「株元散布」(SPRAY/BASE)を含むが、逆は「かもしれない」(maybe)になる。
//   SPRAY 散布(/AERIAL 無人航空機・空中, /FLOOD 湛水, /BASE 株元, /FOLIAGE 茎葉・葉面)   DRENCH 灌注(/BASE 株元, /SOIL 土壌)
//   MIX 混和(/SOIL 土壌混和)   SIDE 側条施用   COAT 塗布   SEEDTREAT 種子処理(粉衣・浸漬)   TRUNK 樹幹   FUME くん煙・くん蒸
//   JET 噴射   THROW 投げ入れ・滴下   INJECT 注入   STOCK 株処理   ROWTREAT 畦間処理
const METHODS = [
	['SPRAY/AERIAL', /無人航空機|無人ヘリ|空中散布|航空散布|ドローン/],
	['SPRAY/FLOOD', /湛水散布|湛水周縁散布|落水散布|原液湛水/],
	['SPRAY/BASE', /株元散布/],
	// 土壌へ散布する方法。規定の「散布」(厳密に「散布」と書かれた方法)とは区別する
	['SPRAY/SOIL', /土壌表面散布|全面土壌散布|土壌散布|土壌表面に散布/],
	['SPRAY/ROW', /播溝散布|作条散布|播溝に散布|作条に散布/],
	['SPRAY/UNIFORM', /全面均一散布/],
	['SPRAY/FOLIAGE', /茎葉散布|葉面散布|茎葉兼/],   // 「雑草茎葉兼土壌散布」も茎葉への散布を含む
	['DRENCH/BASE', /株元灌注|株元かん注/],
	['DRENCH/SOIL', /土壌灌注|土壌かん注/],
	['MIX/SOIL', /土壌混和|全面混和|作条混和/],
	['SIDE', /側条施用|側条/],
	['COAT', /塗布|塗沫|塗抹/],
	['SEEDTREAT', /粉衣|浸漬|種子処理/],
	['TRUNK', /樹幹/],
	['FUME', /くん煙|くん蒸|煙霧/],
	['JET', /噴射/],
	['THROW', /投げ入れ|投入|滴下/],
	['INJECT', /注入/],
	['STOCK', /株処理|株元処理/],
	['ROWTREAT', /畦間処理|畦間/],
	['HOLE', /植穴/],                                   // 植穴処理(定植時の植穴への施用)
	['SOILAPPLY', /土中施用|(?:は種|播種)同時施(?:薬|用)/],   // は種同時施薬機を用いた土中施用
	['PLACE', /設置|配置|吊り?下げ|つり下げ/],          // テープ剤・容器入り剤の設置(散布ではない)
	['BAIT', /毒餌/],                                   // 米ぬか等との混合毒餌
];
// 細分が特定できないときの汎用の方法(「散布」とだけ書かれた行など)。細分が見つかった場合は重ねて付けない
const GENERIC = [['SPRAY', /散布/], ['DRENCH', /灌注|かん注|灌水/], ['MIX', /混和/]];
// 「樹幹散布」「種子粉衣」のように対象が方法を決める語は、汎用の散布/灌注を重ねない
const EXCLUSIVE = ['TRUNK', 'SEEDTREAT', 'COAT', 'FUME', 'JET', 'THROW', 'INJECT', 'STOCK', 'ROWTREAT', 'SIDE', 'HOLE', 'SOILAPPLY', 'PLACE', 'BAIT'];

/** 文字列 t に含まれる方法の集合(METHODS のキー / 汎用キー)を返す。行の使用方法にも規定文の条件にも使う */
function scanMethods(t) {
	const set = new Set();   // 見つかった方法
	METHODS.forEach(([k, re]) => { if (re.test(t)) set.add(k); });
	// 「培土に均一に混和する」「床土に混和」など、土(培土・床土・覆土・土壌)へ混ぜる記述は土壌混和とみなす。
	// 散布や灌注などを併記している場合(「散布して土壌と混和」)は別の方法が主なので、ここでは決めない
	if (/混和/.test(t) && /土/.test(t) && !/散布|灌注|かん注|灌水|くん蒸|噴射/.test(t) && ![...set].some((x) => x.startsWith('MIX'))) set.add('MIX/SOIL');
	const exclusive = EXCLUSIVE.some((k) => set.has(k));
	// 「全面散布土壌混和」「散布後土壌混和」のように、散布してから土壌に混和する方法は、土壌混和として扱う
	// (散布は混和の前処理で、方法としては土壌混和。散布の枠には数えない)
	const sprayThenMix = set.has('MIX/SOIL') && /散布(?:後|して|し)?[、,]?(?:土壌)?(?:に)?混和/.test(t);
	GENERIC.forEach(([k, re]) => {
		if (k === 'SPRAY' && sprayThenMix) return;
		if (!exclusive && re.test(t) && ![...set].some((x) => x === k || x.startsWith(k + '/'))) set.add(k);
	});
	return set;
}

// 処理の対象。NURSERY=育苗箱・トレイ・ポット  BED=床土・覆土  SEED=種子・種いも・球根  FIELD=圃場・本圃
//   これに加えて、剤型は 'FORM:粒剤' のように scanTargets が動的に追加する(剤型別の規定用)
const TARGETS = [
	['NURSERY', /育苗箱|育苗トレイ|セルトレイ|セル成型|ペーパーポット|育苗ポット|苗床|仮植床/],
	['BED', /床土|覆土/],
	['SEED', /種子|種もみ|種籾|種いも|種イモ|種芋|種球|球根|浸種|鱗片/],   // 鱗片 = にんにくの種球
	['DISEASED', /罹病株/],                                               // ウイルス罹病株の枯殺など
	['FIELD', /圃場|ほ場|本圃/],
];
// 剤型として認識する語。規定文中の剤型の検出と、辞書の zaikei が剤型を表す語かの判定(その他・農薬肥料などを除く)に使う
const FORMS = /粒剤|粉剤|乳剤|水和剤|水溶剤|エアゾル剤|くん煙剤|フロアブル|顆粒|液剤|ゾル|油剤|マイクロカプセル|ジャンボ|パック/;

/** 文字列 t に含まれる対象('NURSERY' など)と剤型('FORM:粒剤' など)の集合を返す */
function scanTargets(t) {
  const set = new Set();   // 見つかった対象・剤型
  TARGETS.forEach(([k, re]) => { if (re.test(t)) set.add(k); });
  const f = t.match(FORMS);
  if (f) set.add('FORM:' + f[0]);
  return set;
}
/** 規定の条件にだけ現れる対象: 希釈倍数('DIL:下限-上限')と使用目的('PURPOSE:…')。行の側は希釈倍数・病害虫名(使用目的)の欄で照合する */
function scanRuleTargets(t) {
	const set = new Set();
	// 含有率で区別する剤型(「2%粒剤」「1%粒剤」): 行の製剤の含有率(農薬名から辞書で引く)で照合する
	const pc = norm(t).match(/(\d+(?:\.\d+)?)%(?=粉粒剤|粒剤|粉剤|乳剤|水和剤|水溶剤|液剤|フロアブル)/);
	if (pc) set.add('PCT:' + pc[1]);
	const d = norm(t).match(/(\d+)(?:~(\d+))?倍(?:希釈)?/);
	if (d) set.add('DIL:' + d[1] + '-' + (d[2] || d[1]));
	if (/枯凋/.test(t)) set.add('PURPOSE:枯凋');
	if (/除草剤として/.test(t)) set.add('PURPOSE:除草');
	return set;
}

// ============================================================ 規定文のパース
function normalizeParen(s) { return norm(s); }   // (旧名。現在は norm と同じ)

/** 条件の文字列から方法を表す語句を取り出す(「は種時の播溝土壌混和」→「播溝土壌混和」)。方法の語が無ければ '' */
function methodPhrase(it) {
	const s = norm(it).replace(/\([^)]*\)/g, '');
	const m = s.match(/([^の、]*?(?:散布|混和|灌注|かん注|塗布|浸漬|粉衣|注入|処理|施用|噴射|くん煙|設置|配置))$/);
	if (!m) return '';
	const ph = m[1].replace(/^.*?(?:時|前|後|期|まで|当日)の?/, '');
	return scanMethods(ph).size ? ph : '';
}

/**
 * 節の条件部(「は種時の土壌混和、定植時の株元散布」など)を、列挙ごとの atom の配列にする。
 * atom = { raw, timeKey, timeOnly, positions, literals, methods, targets, parsed, specificity, fieldStart }
 *   positions/literals : 時期の条件(位置の集合 / 季節・月の語の集合)。どちらも空なら時期の指定なし
 *   methods / targets  : 方法の条件 / 対象・剤型の条件。空なら指定なし
 *   timeKey            : 時期表現の比較キー(行の時期と同じ表現かの判定用)。timeOnly: 時期だけの条件(方法・対象の指定なし)
 *   specificity        : 指定された軸の数(時期1+方法1+対象の数)。複数の枠に当てはまるときは大きいほうを優先する
 *   parsed             : 何か1つでも解釈できたか(false なら「条件を解釈できません」の警告)
 *   fieldStart         : 「本田・本圃」を含む条件か(田植同時の行を優先的にここへ割り当てるため)
 */
function parseAtomList(cond) {
	const items = cond.split(LIST_SEP).filter(Boolean);   // 列挙を分けた各条件の文字列
	// 列挙の前の語が剤型だけ・作業の語だけのときは、最後の語の後半を前の語にも掛ける(分配)。
	//   「粉剤及び粉粒剤のは種時の処理」→「粉剤のは種時の処理」「粉粒剤のは種時の処理」
	//   「は種又は定植前の土壌混和」→「は種前の土壌混和」「定植前の土壌混和」、「は種又は定植後」→「は種後」「定植後」
	const last = items[items.length - 1] || '';
	const FORM_WORD = /^(?:[\d.]+%)?(?:粉粒剤|粒剤|粉剤|乳剤|水和剤|水溶剤|フロアブル|液剤|マイクロカプセル剤)/;
	const ACT_WORD = /^(?:は種|播種|定植|移植|植付け?|直播)/;
	for (let k = 0; k < items.length - 1; k++) {
		const it = items[k];
		const fm = it.match(FORM_WORD), lm = last.match(FORM_WORD);
		if (fm && fm[0] === it && lm) { items[k] = it + last.slice(lm[0].length); continue; }
		const am = it.match(ACT_WORD), la = last.match(ACT_WORD);
		if (am && am[0] === it && la && last.length > la[0].length) items[k] = it + last.slice(la[0].length);
	}
	const scans = items.map((it) => scanTerm(it.replace(/までの処理$|まで$|の処理$|処理$/, '')));
	inheritRel(scans);
	return items.map((it, i) => {
		// 「定植時までの処理」「定植当日までの株元散布」「定植時までの灌注処理」のように「…まで」が付く条件は、その時点までの全期間
		const upto = /(時|期|前|当日|日)までの?/.test(it) && !/から/.test(it);
		const sc = scans[i];
		let positions = new Set(atomPositions(sc, upto));
		let literals = new Set(sc.lit ? [sc.lit] : []);
		const cleaned = it.replace(/\([^)]*\)/g, '').replace(/までの処理$|まで$|の処理$|処理$/, '');
		if (/(?<!\d)~|~(?!\d)|から/.test(cleaned)) {          // 「収穫終了後～落葉期」など: 使用行の時期と同じ解釈にする
			const pp = parsePeriod(cleaned, { positions: new Set(), literals: new Set(), unresolved: [] });
			if (pp.positions.size || pp.literals.size) { positions = pp.positions; literals = pp.literals; }
		}
		// 萌芽前は、植付前・植付時(ばれいしょ等)も含む(植え付けた後に萌芽する)
		if (literals.has('萌芽前')) [P.PRE, P.SOWB, P.SOW, P.PLB, P.PL].forEach((x) => positions.add(x));
		const events = eventsOf(it);   // 開花前・出穂期以降・入水前など、出来事を基準にした条件
		const methods = scanMethods(it);
		const targets = scanTargets(it);
		scanRuleTargets(it).forEach((x) => targets.add(x));   // 希釈倍数・使用目的の条件
		// 「育苗期」等の時期語に含まれる「育苗」を対象(育苗箱)としては数えない
		const parsed = positions.size > 0 || literals.size > 0 || methods.size > 0 || targets.size > 0 || events.size > 0;
		const hasTime = positions.size > 0 || literals.size > 0 || events.size > 0;
		const dims = (hasTime ? 1 : 0) + (methods.size ? 1 : 0) + (targets.size ? targets.size : 0);
		return {
			raw: it, growthOnly: sc.anchor === 'GROW' && !/本田|本圃/.test(sc.term), timeKey: hasTime ? timeKeyOf(it) : '',
			timeOnly: methods.size === 0 && targets.size === 0, hasTime, positions, literals, methods, targets, parsed, specificity: dims,
			fieldStart: /本田|本圃/.test(it),
			events,
			// 出来事だけで時期を決める条件(「開花前」「出穂期以降」「入水前」)。行がその出来事に触れていなければ確定できない
			eventOnly: events.size > 0 && !/から|~/.test(cleaned),
			// は種後・定植後のように、は種・定植より後の全期間を指す条件(季節の語だけの行も含みうる)
			afterAnchor: (sc.anchor === 'SOW' || sc.anchor === 'PLANT') && (sc.rel === 'after' || sc.rel === 'just_after'),
			phrase: methodPhrase(it),   // 方法を表す語句(時期の語を除いたもの。行の使用方法と文字どおり一致するかの判定用)
		};
	});
}

/**
 * 括弧の対応を見て、括弧の外(depth 0)の区切り文字だけで分割する。
 *   isSep(ch): その文字が区切り候補か / cut(buf): それまでに溜めた文字列 buf で区切ってよいか(「回以内」で終わっているときだけ区切る等)
 */
function splitTop(str, isSep, cut) {
  const out = [];   // 分割結果
  let depth = 0;    // 現在の括弧の深さ
  let buf = '';     // 区切りを待って溜めている文字列
  for (const ch of str) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (depth === 0 && isSep(ch) && cut(buf)) { out.push(buf); buf = ''; continue; }
    buf += ch;
  }
  if (buf) out.push(buf);
  return out;
}
/** 文字列 b が回数の上限で終わっているか(「…は1回以内」「…は1回以内(内訳)」)。節の区切りの「、」と条件の列挙の「、」を見分けるのに使う */
const endsWithLimit = (b) => /\d回(以内)?$/.test(b) || (/\)$/.test(b) && /回/.test(b));

/**
 * 作物別の規定「A、Bは4回以内(…)、上記以外のCは1回」を作物の節ごとに分ける。
 * 戻り値: [{ crops(作物名の記述), names(作物名の配列), total(総量), inner(括弧内の内訳。無ければ null) }]
 */
function parseCropSegments(s) {
	const segs = [];   // 作物ごとの節
	let pos = 0;       // 次に読む位置
	while (pos < s.length) {
		let depth = 0;
		let idx = -1;
		let m = null;
		for (let k = pos; k < s.length; k++) {
			const ch = s[k];
			if (ch === '(') depth++;
			else if (ch === ')') depth--;
			else if (depth === 0 && ch === 'は') {
				const mm = /^は(\d+)回(以内)?/.exec(s.slice(k));
				if (mm) { idx = k; m = mm; break; }
			}
		}
		if (idx < 0) break;
		const crops = s.slice(pos, idx);
		let end = idx + m[0].length;
		let inner = null;
		if (s[end] === '(') {
			let d = 0;
			let k = end;
			for (; k < s.length; k++) {
				if (s[k] === '(') d++;
				else if (s[k] === ')') { d--; if (d === 0) break; }
			}
			inner = s.slice(end + 1, k);
			end = k + 1;
		}
		segs.push({ crops, names: crops.split(/、|及び|又は/).filter(Boolean), total: Number(m[1]), inner });
		pos = end + (/^[、,]/.test(s.slice(end)) ? 1 : 0);
	}
	return segs;
}

/** 作物名 sakumotsu に該当する節を選ぶ。無ければ「その他・上記以外」の節、それも無ければ null */
function pickCropSegment(segs, sakumotsu) {
	const sak = norm(sakumotsu);
	const isOther = (seg) => /その他|上記以外|以外/.test(seg.crops);
	let hit = null;
	if (sak) {
		hit = segs.find((g) => !isOther(g) && g.names.some((n) => n.replace(/\(.*\)/, '') === sak || (sak.length >= 2 && (n.includes(sak) || sak.includes(n.replace(/\(.*\)/, ''))))));
	}
	return hit || segs.find(isOther) || null;
}

/**
 * 括弧の内側の節列(「AはN回以内、BはM回以内」)を slot/atom にして rule に追加する。
 *   inner : 括弧の内側の文字列    rule: 追加先(rule.slots / rule.atoms / rule.warnings)
 *   prefix: 枠の id の接頭辞('S' → S1, S2, ... / 入れ子は 'S1.' → S1.1)
 *   parent: 入れ子のとき { atoms: 親の条件 }。あれば追加する枠は overlay(内数)になる
 * 「合計」付き、または条件が1つ → 1枠を共有。「合計」なしの列挙 → 条件ごとに別枠(id は S2-1, S2-2 …)
 * 「但し当該処理をする場合には…」のような条件付きの節は評価せず、警告(=要確認)にする
 */
function parseClauses(inner, rule, prefix, parent) {
	let prevAtoms = null;   // 直前の節の条件(「但し」で始まる節を、その内数として扱うため)
	splitTop(inner, (c) => c === '、' || c === ',', endsWithLimit).forEach((clause, ci) => {
		const id0 = prefix + (ci + 1);   // この節の枠 id
		// 入れ子の括弧を分離: head=「条件と上限」の部分、child=入れ子の括弧の中身
		let head = clause;
		let child = null;
		const p = clause.indexOf('(');
		if (p >= 0 && clause.endsWith(')')) { head = clause.slice(0, p); child = clause.slice(p + 1, -1); }
		let cond = null;      // 条件部の文字列
		let limit = null;     // この節の上限回数
		let shared = false;   // 「合計」付きか(複数条件で1枠を共有)
		let m = head.match(/^(.+)は(合計)?(\d+)回(?:以内)?$/) || head.match(/^(.+?)(合計)?(\d+)回(?:以内)?$/);
		if (!m) { rule.warnings.push('規定の節を解釈できません: ' + clause); return; }
		cond = m[1]; shared = !!m[2]; limit = Number(m[3]);
		// 「1花房当り1回」「1株当たり1回」のような単位当たりの回数は、計画の行数では数えられない(どの花房に使ったかは計画に無い)ので判定しない
		if (/^\d+(?:花房|花|株|果|房|樹|枝|鉢|本|穂)(?:当り|当たり|につき)$/.test(cond)) return;
		// 「A又はBは1回以内」は、AかBのどちらかで1回(1枠を共有)。「直播でのは種時又は移植時までの処理」など
		if (/又は|または|或いは|もしくは/.test(cond)) shared = true;
		let conditional = false;   // 「但し…」で始まる条件付きの節か
		let whenAtoms = null;      // 「…をする場合には」の条件(その処理をした場合にだけ効く上限)
		const toushori = /当該処理/.test(clause);
		if (/^但し/.test(cond)) { cond = cond.replace(/^但し[、,]?(当該処理をする場合には)?/, ''); conditional = true; }
		if (/場合/.test(cond)) {
			// 「は種時に土壌灌注をする場合には1回以内」: 条件の処理(は種時の土壌灌注)を計画で使っていれば、親の節の上限がこの回数になる
			const w = cond.match(/^(.+?)を(?:する|行う|使用する)場合(?:に|には)?$/);
			if (!w || !parent) { rule.warnings.push('条件付きの規定は評価していません: ' + clause); return; }
			whenAtoms = parseAtomList(w[1].replace(/に(?=[^に]*$)/, 'の'));
			const slot = { id: id0, label: (parent.label || '') + '(' + w[1] + 'をする場合)', limit, overlay: true, multi: false, parentAtoms: parent.atoms, allOfParent: true, whenAtoms,
				rawText: `${parent.label || ''}は${w[1]}をする場合には${limit}回以内` };
			rule.slots.push(slot);
			return;
		}
		const atoms = /^\d+年間に?$/.test(cond)
			? [{ raw: cond, positions: new Set(), literals: new Set(), methods: new Set(), targets: new Set(), events: new Map(), parsed: true, specificity: 0 }]
			: parseAtomList(cond);
		atoms.forEach((a) => { if (!a.parsed) rule.warnings.push('条件を解釈できません: ' + a.raw); });
		let par = parent;   // この節を overlay にする場合の親(入れ子、または「但し」の節の直前の節)
		if (conditional && !toushori && prevAtoms) par = { atoms: prevAtoms };       // 直前の節の内数

		// 枠を1つ作り、その条件(atomsOf)を rule.atoms に slotId 付きで登録する
		// rawText: 規定文の内訳枠の文言そのもの(「散布及び無人航空機散布は合計3回以内」)。列挙を枠ごとに分けた場合は、その条件の文言
		const mk = (id, label, atomsOf, rawText) => {
			const slot = { id, label, limit, overlay: !!par, multi: atomsOf.length > 1, rawText };   // multi: 複数の時期・方法を合算する枠(「灌注及び浸漬は合計1回以内」など)
			if (par) slot.parentAtoms = par.atoms;
			// 「但し当該処理をする場合には…合計1回以内」: 直前の節の処理(当該処理)を計画で使った場合にだけ効く上限
			if (conditional && toushori && prevAtoms) { slot.whenAtoms = prevAtoms; slot.label = label + '(当該処理をする場合)'; }
			rule.slots.push(slot);
			atomsOf.forEach((a) => rule.atoms.push({ ...a, slotId: id, overlay: !!par }));
			return slot;
		};
		const headRaw = head.replace(/^但し[、,]?/, '');   // 内訳枠の文言(「但し、」は除く)
		if (shared || atoms.length === 1) mk(id0, cond, atoms, (conditional && toushori ? '(当該処理をする場合)' : '') + (conditional && toushori ? headRaw.replace(/^当該処理をする場合には/, '') : headRaw));
		else atoms.forEach((a, k) => { mk(`${id0}-${k + 1}`, a.raw, [a], `${a.raw}は${limit}回以内`); });
		// 総量の内訳(排他的な区分)の上限の合計を求めるため、最上位の通常の節の上限を記録する
		if (!parent && !par && !(conditional && toushori)) rule.clauses.push({ id0, limit, atoms });
		if (!par || par === parent) prevAtoms = atoms;
		if (child) {
			const stripped = child.replace(/^但し[、,]?/, '');
			parseClauses(stripped, rule, id0 + '.', { atoms, label: cond });
		}
	});
}

/**
 * 規定文を解析する。text: 規定文、opts.sakumotsu: 作物別規定の選択に使う作物名。
 * 戻り値 rule = { raw, total(総量の上限), slots[], atoms[], warnings[](解釈できなかった部分。あれば 要確認), crop(採用した作物の節) }
 * 括弧が無い規定は slots が空(=総量のみで、内訳の判定対象なし)
 */
function parseRuleRaw(text, opts = {}) {
	let s = norm(text);   // 正規化した規定文(作物別規定のときは選んだ節を「N回以内(…)」の形に直したもの)
	const rule = { raw: String(text == null ? '' : text), total: null, slots: [], atoms: [], warnings: [], crop: null, clauses: [], exhaustive: false, crossCut: new Set(), exclusivePurpose: false };

	if (s && !/^\d/.test(s)) {                       // 数字で始まらない規定: 作物別・使用目的別・総量の無い内訳だけの規定
		// 使用目的別の規定: 「冬期落葉防止及びへた落ち防止に使用する場合は合計1回以内、後期落果防止に使用する場合は2回以内(但し、異なる目的には使用しない)」
		if (/に使用する場合は/.test(s)) return parsePurposeRule(s, rule);
		const segs = parseCropSegments(s);
		const seg = segs.length ? pickCropSegment(segs, opts.sakumotsu) : null;
		if (!seg) {
			// 「種子への処理は1回、1花房当り1回」のように、先頭が作物名ではなく処理の条件のとき: 総量の無い内訳の列挙として読む
			if (segs.length && segs.every((g) => parseAtomList(g.crops).every((x) => x.parsed))) {
				parseClauses(s, rule, 'S', null);
				return finishRule(rule);
			}
			rule.warnings.push('作物別の規定を解釈できません: ' + rule.raw.slice(0, 40));
			return rule;
		}
		rule.crop = seg.crops;
		if (!opts.sakumotsu || !seg.names.some((n) => n.includes(norm(opts.sakumotsu)))) {
			if (/その他|上記以外|以外/.test(seg.crops)) rule.warnings.push('作物名に一致せず「' + seg.crops + '」の規定を採用しました');
		}
		s = seg.total + '回以内' + (seg.inner ? '(' + seg.inner + ')' : '');
	}

	const t = s.match(/^(\d+)回(?:以内)?/);   // 先頭の総量
	if (t) rule.total = Number(t[1]);
	// 「1株当り1回」「1花につき1回」のように、時期・方法・対象の要素を含まない単位当たりの回数規定は、
	// 内訳の判定対象がない単なる回数なので要確認にしない(括弧の内訳がある規定だけ、総量を読めないことを警告する)
	else if (s.includes('(')) rule.warnings.push('総使用回数を読み取れません: ' + text);

	const i = s.indexOf('(');       // 内訳の括弧の開始
	const j = s.lastIndexOf(')');   // 内訳の括弧の終了(入れ子があるので最後の閉じ括弧)
	if (i < 0 || j < i) return rule;
	parseClauses(s.slice(i + 1, j), rule, 'S', null);
	return finishRule(rule);
}

/**
 * 内訳の節どうしの関係を決める(parseRuleRaw の仕上げ)。
 *   crossCut  : 「出穂期以降は2回以内」のように、方法で分けた節(散布など)と重なって効く、出来事基準の時期だけの節。
 *               内訳の上限の合計が総量を超え、そのような節と時期の無い方法の節が並ぶときに限る。行はこの節と方法の節の両方に数える
 *   exhaustive: 内訳の上限の合計(crossCut を除く)が総量以上 → 登録上の使用はどれかの節に必ず属する(排他的な区分)。
 *               このとき、行が1つの節以外に当たらないと分かれば、その節に確定できる(消去法)
 */
function finishRule(rule) {
	const top = rule.clauses;
	// 横断的な節は「出穂期以降」のように出来事を基準にした時期だけの節に限る(本田・生育期・は種時などは時期で区分した排他的な節)
	const isTimeOnly = (c) => c.atoms.length && c.atoms.every((a) => a.eventOnly && a.methods.size === 0 && a.targets.size === 0);
	const isMethodOnly = (c) => c.atoms.length && c.atoms.every((a) => !a.hasTime && a.methods.size > 0);
	const sumAll = top.reduce((x, c) => x + c.limit, 0);
	if (rule.total != null && sumAll > rule.total && top.some(isMethodOnly)) {
		top.filter(isTimeOnly).forEach((c) => rule.slots.filter((sl) => sl.id === c.id0 || sl.id.startsWith(c.id0 + '-')).forEach((sl) => rule.crossCut.add(sl.id)));
	}
	const sum = top.filter((c) => !rule.crossCut.has(c.id0) && ![...rule.crossCut].some((id) => id.startsWith(c.id0 + '-'))).reduce((x, c) => x + c.limit, 0);
	rule.exhaustive = rule.total != null && top.length > 0 && sum >= rule.total;
	return rule;
}

/**
 * 使用目的別の規定(作物の代わりに「…に使用する場合」で節が分かれる)を読む。
 * 各節の目的は行の病害虫名の欄(使用目的)で照合する。「異なる目的には使用しない」があれば、2つ以上の目的に使う計画は NG
 */
function parsePurposeRule(s, rule) {
	const segs = splitTop(s, (c) => c === '、' || c === ',', endsWithLimit);
	let max = 0;
	segs.forEach((seg, k) => {
		const mm = seg.match(/^(.+?)に使用する場合は(合計)?(\d+)回(?:以内)?(?:\((.*)\))?$/);
		if (!mm) { rule.warnings.push('規定の節を解釈できません: ' + seg); return; }
		const limit = Number(mm[3]);
		max = Math.max(max, limit);
		if (mm[4] && /異なる目的には使用しない/.test(mm[4])) rule.exclusivePurpose = true;
		const words = mm[1].split(LIST_SEP).filter(Boolean);
		const id = 'U' + (k + 1);
		rule.slots.push({ id, label: mm[1] + 'に使用する場合', limit, overlay: false, multi: words.length > 1, purposeSlot: true, rawText: `${mm[1]}に使用する場合は${mm[2] ? '合計' : ''}${limit}回以内` });
		words.forEach((w) => rule.atoms.push({ raw: w, slotId: id, overlay: false, positions: new Set(), literals: new Set(), events: new Map(),
			methods: new Set(), targets: new Set(['PURPOSEWORD:' + w]), parsed: true, specificity: 1, hasTime: false, timeOnly: false, phrase: '' }));
	});
	if (/異なる目的には使用しない/.test(s)) rule.exclusivePurpose = true;
	rule.total = max || null;
	rule.exhaustive = true;   // 登録上の使用は、いずれかの目的に属する
	return rule;
}

// ============================================================ 行の解釈と照合
// 3値の大小(no < maybe < yes)。worst=AND(全部の軸が合って初めて yes)、best=OR(どれか1つ合えば良い)
const RANK = { no: 0, maybe: 1, yes: 2 };
const worst = (a, b) => (RANK[a] <= RANK[b] ? a : b);
const best = (a, b) => (RANK[a] >= RANK[b] ? a : b);

/**
 * 使用行 r = { jiki, hoho, ekiryo, yakuzai(or meisho), zaikei } を照合用に正規化する。
 * 戻り値: { jiki(解析済み時期), methods(方法の集合), targets(対象の集合), form(剤型または薬剤名), hoho, fieldSimul(田植同時か) }
 * 業務ルール(ここで行の解釈を補正する):
 *   田植同時(側条施用の田植え時・移植時を含む)は本田の処理、育苗箱への散布は移植前の処理として扱う
 */
function normalizeRowRaw(r) {
	// 作物名が「いちご(仮植床)」の登録は、仮植床(育苗の段階)での使用。使用時期「植付時」は仮植床への植付時
	const karishoku = /仮植/.test(norm(r.sakumotsu)) && !/仮植/.test(norm(r.jiki));
	const jiki = parseJiki(karishoku ? '仮植床' + norm(r.jiki) : r.jiki);   // 解析済みの使用時期
	const hoho = norm(r.hoho);        // 使用方法(正規化)
	const ekiryo = norm(r.ekiryo);    // 使用液量(「箱あたり」等、対象を示すことがある)
	const jt = norm(r.jiki);          // 使用時期(正規化した生の文字列)
	const methods = scanMethods(hoho);   // 行の方法
	const targets = new Set();           // 行の対象(剤型は別に form で持つ)
	scanTargets(hoho + ekiryo).forEach((x) => { if (!x.startsWith('FORM:')) targets.add(x); });
	if (/種|浸種/.test(jt) && /種子|浸種/.test(jt)) targets.add('SEED');
	// 剤型別の規定(「粒剤は1回以内、水和剤は4回以内」など)の判定には、辞書の剤型(zaikei)を使う。
	// zaikei が無い・「その他」「農薬肥料」など規定文に出てくる剤型名でないときだけ、薬剤名から推定する
	const zk0 = norm(r.zaikei).replace(/^エアゾル$/, 'エアゾル剤');   // 辞書の剤型(表記ゆれを補正)
	const zk = FORMS.test(zk0) ? zk0 : '';                              // 剤型を表す語のときだけ採用
	const form = zk || norm(r.yakuzai || r.meisho || '');               // 剤型の照合に使う文字列(剤型が使えなければ薬剤名)
	// 田植同時の施用(田植同時散布機など)は、移植と同時でも本田への処理として判定する
	// 使用時期が「田植え時」「移植時」の側条施用(田植えと同時に側条へ施用)も同様に扱う。は種時・直播時の側条施用は対象外
	const fieldSimul = /(田植|移植)(え)?同時/.test(hoho) || (/側条/.test(hoho) && /田植|移植/.test(jt));
	// 育苗箱への散布は、移植前の処理として判定する(使用時期が「移植当日」までの範囲でも、移植後は含めない)
	let jikiRow = jiki;   // 照合に使う時期(育苗箱散布のときだけ複製して補正する)
	// 育苗箱と本田の両方の処理が1行に書かれている登録は、移植前だけとは言えないのでこの扱いにしない
	const nurserySpray = targets.has('NURSERY') && /散布/.test(hoho) && !/本田|本圃/.test(jt + hoho);
	if (nurserySpray && jiki.positions.size) {
		const pre = new Set([...jiki.positions].filter((p) => p <= P.PLB));
		jikiRow = Object.assign({}, jiki, { positions: pre.size ? pre : new Set([P.PLB]) });   // jiki はキャッシュ共有なので複製する
	}
	// 「植付時(仮植床)」「仮植前」など、仮植床(育苗の段階)での使用
	if (/仮植/.test(jt) || karishoku) targets.add('NURSERY');
	// 育苗の場所での使用: 使用方法の「育苗培土・育苗用土・苗床」、使用時期の「育苗期・苗床・(苗床)」。
	// ただし「育苗箱:…本田:…」のように本田での使用も同じ行に書かれた登録は、どちらとも言えないので付けない
	if (/育苗培土|育苗用土|育苗土|苗床|ペーパーポット/.test(hoho) && !/本田|本圃/.test(hoho)) targets.add('NURSERY');
	if (/育苗|苗床/.test(jt) && !/本田|本圃/.test(jt + hoho)) targets.add('NURSERY');
	// は種前の浸漬・粉衣・塗沫は種子(種もみ)への処理(「は種前 6～72時間浸漬」)
	if (methods.has('SEEDTREAT') && jiki.positions.has(P.SOWB)) targets.add('SEED');
	// 段階別使用回数の登録(使用回数「苗床:4回以内 本圃:3回以内」)の行: 生育ステージの定植の時期・利用者の選択で決めた段階(stage)で、
	// 育苗の場所(NURSERY)か本圃かと、時期の位置(苗床 = 定植の前、本圃 = 定植以降)を決める。決まらない行(BOTH)は両方に当たりうる(STAGE?)
	if (r.stage === 'NURSERY' || r.stage === 'FIELD' || r.stage === 'BOTH') {
		const pos = new Set(jikiRow.positions);
		let np;
		if (r.stage === 'NURSERY') {
			targets.add('NURSERY');
			np = new Set([...pos].filter((p) => p <= P.PLB));
			if (!np.size) np.add(P.RAISE);
		} else if (r.stage === 'FIELD') {
			targets.delete('NURSERY');
			np = new Set([...pos].filter((p) => p >= P.PL));
			if (!np.size) np.add(P.GROW);
		} else {
			targets.delete('NURSERY');
			targets.add('STAGE?');
			np = new Set([...pos, P.RAISE]);
		}
		jikiRow = Object.assign({}, jikiRow, { positions: np });   // jiki はキャッシュ共有なので複製する
	}
	// 希釈倍数(「500～1000倍」)。規定の「500倍希釈灌注」などの照合に使う。倍数の記載が無ければ null(不明)
	const bm = norm(r.baisu).match(/(\d+)(?:~(\d+))?倍/);
	const dil = bm ? [Number(bm[1]), Number(bm[2] || bm[1])] : null;
	// 使用目的: 病害虫名の欄(適用病害虫名・使用目的)から読む。空なら null(不明)
	const by = norm(r.byochu).replace(/<br>/g, ' ');
	const purpose = by ? new Set() : null;
	if (purpose) {
		if (/枯凋/.test(by)) purpose.add('枯凋');
		if (/雑草|雑かん木|スギナ|ササ|イネ科|広葉|ノビエ|スズメノカタビラ|メヒシバ|ヒエ|カヤツリグサ|ホタルイ|コナギ|クズ|竹/.test(by)) purpose.add('除草');
		purpose.text = by;
	}
	// eventDates: 生育ステージの表の出来事の時期に対する防除時期の前後 Map(出来事 → 'before'|'at'|'after')。無ければ null
	return { jiki: jikiRow, methods, targets, form, hoho, fieldSimul, dil, purpose, eventDates: r.eventDates && r.eventDates.size ? r.eventDates : null };
}

/**
 * 時期の照合(3値)。atom に時期の指定が無ければ yes。行の時期が不明なら maybe。
 * 行の位置・語のうち atom に含まれる割合が全部なら yes、一部なら maybe(例: 「移植前～移植当日」の行は「移植前」の枠に一部だけ重なる)、無ければ no。
 */
function matchTime(atom, row) {
	const j = row.jiki;   // 行の解析済み時期
	// 出来事を基準にした条件(開花前・出穂期以降・入水前など): 行が同じ出来事に触れていれば、その前後関係で決める
	if (atom.events && atom.events.size) {
		let r = null;
		atom.events.forEach((ar, ev) => {
			let x = null;
			if (j.events && j.events.has(ev)) x = eventRel(ar, j.events.get(ev));
			// 生育ステージの表にその出来事の時期があり、防除時期との前後が分かる行(eventDates): 使用時期の文面で決まらないときは、その前後で決める
			const dr = row.eventDates ? row.eventDates.get(ev) : undefined;
			if (dr && (x == null || x === 'maybe')) x = eventRel(ar, dr);
			if (x != null) r = r == null ? x : worst(r, x);
		});
		if (r != null) return r;
		if (atom.eventOnly) {
			// 行がその出来事に触れていない: 位置で明らかに外れる(例: 定植前の行と「出穂期以降」)ときだけ no、それ以外は確定できない
			if (atom.positions.size === 0 && atom.literals.size === 0) return 'maybe';
			return matchTimePos(atom, row) === 'no' ? 'no' : 'maybe';
		}
	}
	if (atom.positions.size === 0 && atom.literals.size === 0) return 'yes';
	return matchTimePos(atom, row);
}

/** 時期の照合のうち、時間軸の位置(P)と季節の語による部分(3値) */
function matchTimePos(atom, row) {
	if (atom.positions.size === 0 && atom.literals.size === 0) return 'yes';
	const j = row.jiki;   // 行の解析済み時期
	if (row.fieldSimul && atom.fieldStart && j.positions.has(P.PL)) return 'yes';   // 田植同時 = 本田
	if (j.preEmerge) {   // 植付後萌芽前の行: 「萌芽前」の枠に当たる。「生育期」「萌芽後」など生育期の枠には当たらない
		if (atom.literals.has('萌芽前')) return 'yes';
		if (atom.growthOnly) return 'no';
	}
	if (j.positions.size === 0 && j.literals.size === 0) return 'maybe';   // 時期不明
	if (j.unresolved && j.unresolved.length) return 'maybe';   // 読めない時期語を含む行は、その語がどの時期かによるので確定しない
	if (atom.afterAnchor && j.allBeforeAnchor) return 'no';    // 「は種・定植の前」だけの行と「は種・定植の後」の条件は重ならない
	let inter = 0;   // 行の位置・語のうち atom に含まれるものの数
	let total = 0;   // 行の位置・語の総数
	j.positions.forEach((p) => { total++; if (atom.positions.has(p)) inter++; });
	j.literals.forEach((l) => { total++; if (atom.literals.has(l)) inter++; });
	if (inter === 0) {
		if (atom.fieldStart && j.positions.has(P.PL)) return 'maybe';   // 移植時の同時施用は本田か育苗の延長か不明
		// 「は種後」「定植後」の条件と、季節の語だけの行(「休眠に入る直前」など): 作物がある期間の語なので、は種・定植の後でありうる
		if (atom.afterAnchor && j.positions.size === 0 && j.literals.size) return 'maybe';
		return 'no';
	}
	return inter === total ? 'yes' : 'maybe';
}

/**
 * 方法の照合(3値)。atom に方法の指定が無ければ yes、行の方法が不明なら maybe。
 * 行の方法が atom と同じか、その細分(規定「散布」に対して行「株元散布」)なら yes。
 * 逆に、行が親(「散布」とだけ登録)で atom が細分(「株元散布」「無人航空機散布」)のときは no(方法の登録どおりに照合する)。
 */
function matchMethod(atom, row) {
  if (atom.methods.size === 0) return 'yes';
  if (row.methods.size === 0) return 'maybe';
  let res = 'no';
  atom.methods.forEach((a) => {
    row.methods.forEach((r) => {
      if (r === a || r.startsWith(a + '/')) res = best(res, 'yes');
      // 行の方法が「散布」とだけ登録されている場合は、株元散布・無人航空機散布などの細分の枠には当てない
      // (細分の方法は、行に「株元散布」「無人航空機による散布」と登録されるので、方法の登録どおりに照合する)
    });
  });
  return res;
}

/**
 * 対象・剤型の照合(3値)。atom の対象すべてに対し、行が合えば yes(AND)。
 *   FORM:x : 行の剤型に x が含まれれば yes、剤型は分かるが別の剤型なら no、判別できなければ maybe
 *   FIELD  : 行が育苗箱・床土・種子なら no(本田側の枠には該当しない)、それ以外は yes
 *   BED    : 行が床土・覆土なら yes、育苗箱なら maybe(床土に混和する可能性)
 *   その他 : 行の対象に含まれれば yes、無ければ no
 */
function matchTarget(atom, row) {
	let res = 'yes';
	atom.targets.forEach((t) => {
		let r;
		if (t.startsWith('FORM:')) r = !row.form ? 'maybe' : row.form.includes(t.slice(5)) ? 'yes' : (/剤/.test(row.form) ? 'no' : 'maybe');
		else if (t.startsWith('DIL:')) {   // 希釈倍数: 行の倍数の範囲が規定の範囲に収まれば yes、重ならなければ no、一部だけ・不明は maybe
			const [lo, hi] = t.slice(4).split('-').map(Number);
			if (!row.dil) r = 'maybe';
			else if (row.dil[0] >= lo && row.dil[1] <= hi) r = 'yes';
			else if (row.dil[1] < lo || row.dil[0] > hi) r = 'no';
			else r = 'maybe';
		} else if (t.startsWith('PCT:')) {   // 含有率: 行の製剤の含有率が同じなら yes、違えば no、分からなければ maybe
			const v = Number(t.slice(4));
			r = row.pct == null ? 'maybe' : Math.abs(row.pct - v) < 1e-9 ? 'yes' : 'no';
		} else if (t.startsWith('PURPOSEWORD:')) {   // 使用目的別の規定の目的語(「へた落ち防止」など): 病害虫名の欄に同じ語があるか
			r = !row.purpose ? 'maybe' : row.purpose.text.includes(t.slice(12)) ? 'yes' : 'no';
		} else if (t.startsWith('PURPOSE:')) {   // 使用目的(茎葉枯凋・除草剤として): 病害虫名の欄で照合。欄が空なら不明
			r = !row.purpose ? 'maybe' : row.purpose.has(t.slice(8)) ? 'yes' : 'no';
		}
		// 段階別使用回数の行で、苗床か本圃か決まらない(STAGE?): 育苗の場所・本圃の枠のどちらにも当たりうる
		else if (row.targets.has('STAGE?') && (t === 'FIELD' || t === 'NURSERY')) r = 'maybe';
		else if (t === 'FIELD') r = ['NURSERY', 'BED', 'SEED'].some((x) => row.targets.has(x)) ? 'no' : 'yes';
		else if (t === 'BED') r = row.targets.has('BED') ? 'yes' : row.targets.has('NURSERY') ? 'maybe' : 'no';
		// 育苗箱への処理と、床土・覆土への処理: 箱育苗の床土・覆土は育苗箱の中の土なので、該当しうる(maybe)
		else if (t === 'NURSERY' && !row.targets.has('NURSERY') && row.targets.has('BED')) r = 'maybe';
		else r = row.targets.has(t) ? 'yes' : 'no';
		res = worst(res, r);
	});
	return res;
}

/** atom と行を時期・方法・対象の3軸で照合し、3軸の worst(最も厳しい値)を返す */
function matchAtom(atom, row) {
  let r = matchTime(atom, row);
  r = worst(r, matchMethod(atom, row));
  r = worst(r, matchTarget(atom, row));
  return r;
}

/**
 * 行を枠に割り当てる。戻り値 { slots: 該当した枠 id の配列, certain: 確定か, overlay: [{ id, certain }] }
 *   certain=true : yes の枠が唯一つ(その枠に確定して数える)
 *   certain=false: 枠が複数ある/maybe だけ(judge が「可能性」として数え、要確認にする)
 *   slots が空   : どの枠にも該当しない(総量にだけ数える。フラグは立てない)
 * 複数の枠が yes のときの絞り込み(上から順に適用):
 *   ① 田植同時の行は「本田」の枠を優先  ② 指定された軸の数(specificity)が大きい枠を優先
 *      規定の「散布」は、行が株元散布など細分のとき1段低く扱う(「粒剤の処理」など他の枠があればそちらを優先)
 *   ③ 時期だけの枠どうしなら、行と同じ時期表現の枠  ④ 移植・植付より前の行で、行と同じ時期表現の「Xの植付前の処理」枠(方法指定なし)と
 *      時期指定のない方法枠が競合するときは、時期で確定する
 * overlay(入れ子=内数)の枠は、親の条件と自分の条件の両方に当てはまるかを別に評価する
 */
function assign(row, rule) {
	const yes = [];     // 確実に該当する条件
	const maybe = [];   // 該当するかもしれない条件
	// 解釈できなかった条件(parsed=false)は、どの行にも「該当するかもしれない」とする(黙って該当・非該当にしない)
	const m3 = (a) => (a.parsed === false ? 'maybe' : matchAtom(a, row));
	const main = rule.atoms.filter((a) => !a.overlay && !rule.crossCut.has(a.slotId));
	main.forEach((a) => {
		const m = m3(a);
		if (m === 'yes') yes.push(a);
		else if (m === 'maybe') maybe.push(a);
	});
	// 「定植時及びは種時の土壌混和は合計1回以内」のように1つの枠に時期の違う条件が並ぶとき、
	// 「定植時又はは種時」の行は各条件には一部しか重ならないが、枠全体(条件の和)には収まるので、その枠に該当する
	const bySlot = new Map();
	main.forEach((a) => { if (!bySlot.has(a.slotId)) bySlot.set(a.slotId, []); bySlot.get(a.slotId).push(a); });
	bySlot.forEach((as, id) => {
		if (as.length < 2 || as.some((a) => yes.includes(a))) return;
		const j = row.jiki;
		if (!j.positions.size || (j.unresolved && j.unresolved.length)) return;
		const mt = as.filter((a) => a.hasTime && !(a.events && a.events.size) && worst(matchMethod(a, row), matchTarget(a, row)) === 'yes');
		if (!mt.length) return;
		const up = new Set(); const ul = new Set();
		mt.forEach((a) => { a.positions.forEach((x) => up.add(x)); a.literals.forEach((x) => ul.add(x)); });
		if ([...j.positions].every((x) => up.has(x)) && [...j.literals].every((x) => ul.has(x))) yes.push(mt[0]);
	});
	let res = { slots: [], certain: false };   // 戻り値(overlay は最後に付ける)
	const nslots = (arr) => new Set(arr.map((a) => a.slotId)).size;
	if (yes.length) {
		// 田植同時の施用は、規定に「本田」の枠があればそちらを優先する(「移植時までの処理」にも読めるため)
		const pool = row.fieldSimul && yes.some((a) => a.fieldStart) ? yes.filter((a) => a.fieldStart) : yes;
		// 規定の「散布」は厳密に「散布」とだけ表記された行の枠。株元散布などの行が他の枠(「粒剤の処理」など)にも該当する場合は
		// そちらを優先し、「散布」枠は他に該当する枠がないときにだけ使う(数え漏れを避けるため、枠自体は残す)
		// eff: 行に対する条件の実効的な優先度(指定軸の数 − 「散布」枠を細分の行に当てるときの減点1)
		const eff = (a) => a.specificity - (a.methods.has('SPRAY') && !row.methods.has('SPRAY') && [...row.methods].some((m) => m.startsWith('SPRAY/')) ? 1 : 0);
		const top = Math.max(...pool.map(eff));                  // 最も優先度の高い値
		let cand = pool.filter((a) => eff(a) === top);          // 候補の条件(枠が複数残れば不確定)
		// 同格の枠が複数ある場合は、行の時期と同じ表現の枠を優先する(例: 「萌芽直前～萌芽期」の行 → 同じ表現の枠)。
		// 時期だけの枠同士に限る。方法や対象で一致した枠が混ざるときは、どちらの枠にも該当しうるので確定しない
		if (nslots(cand) > 1 && row.jiki.timeKey && cand.every((a) => a.timeOnly)) {
			const ex = cand.filter((a) => a.timeKey && a.timeKey === row.jiki.timeKey);
			if (ex.length) cand = ex;
		}
		// 移植・植付より前の時期の行で、行と同じ時期表現の「Xの植付前の処理」枠(方法指定なし)と、時期指定のない方法枠(散布など)が
		// 競合する場合は、時期で確定する(畝立て前作条散布などは植付前の土壌処理であり、生育期の散布ではない)
		if (nslots(cand) > 1 && row.jiki.timeKey && row.jiki.positions.size
				&& [...row.jiki.positions].every((p) => p <= P.PLB)) {
			const tm = cand.filter((a) => a.timeKey && a.timeKey.endsWith(row.jiki.timeKey) && a.methods.size === 0 && a.positions.size);
			const rest = cand.filter((a) => !tm.includes(a));
			if (tm.length && nslots(tm) === 1 && rest.every((a) => !a.positions.size && !a.literals.size)) cand = tm;
		}
		// 方法の語句が行の使用方法と文字どおり一致する枠を優先する
		// (「は種時の播溝土壌混和」と「は種時の全面土壌混和」、「果梗部塗布」と「新梢基部塗布」など、同じ種類の方法を部位・やり方で分けた枠)
		if (nslots(cand) > 1 && cand.every((a) => a.phrase)) {   // 候補がすべて方法の語句を持つとき(同じ種類の方法を部位・やり方で分けた枠)だけ
			const hz = norm(row.hoho);
			const lit = cand.filter((a) => a.phrase && hz.includes(norm(a.phrase)));
			if (lit.length && nslots(lit) === 1) cand = lit;
		}
		// 特別法の優先: 一方の条件の時期が他方の時期に真に含まれる(より狭い)場合は、狭いほうの枠
		// (「定植直後の株元灌注」と「定植後の株元灌注」→ 定植直後)
		if (nslots(cand) > 1) {
			const narrow = cand.filter((x) => x.positions.size > 0 && cand.every((y) => y.slotId === x.slotId
				|| ([...x.positions].every((q) => y.positions.has(q)) && y.positions.size > x.positions.size
						&& [...y.methods].every((ym) => [...x.methods].some((xm) => xm === ym || xm.startsWith(ym + '/'))))));
			if (narrow.length && nslots(narrow) === 1) cand = narrow;
		}
		// 排他的な区分の規定で、時期だけの枠(「休眠期処理」)と時期の無い方法の枠(「散布」)の両方に当たる行は、時期の枠に数える
		// (総量を区分に分けた規定では、名指しされた時期の処理は一般の方法の枠から除かれる。そうでなければ時期の枠は使われない)
		if (nslots(cand) > 1 && rule.exhaustive) {
			const tOnly = cand.filter((a) => a.hasTime && a.methods.size === 0 && a.targets.size === 0);
			const others = cand.filter((a) => !tOnly.includes(a));
			// 相手は「散布」「灌注」「混和」のような一般の方法の枠に限る(「苗浸漬」など特定の方法の枠とは、どちらとも決められない)
			const generic = (a) => !a.hasTime && a.targets.size === 0 && [...a.methods].every((mm) => mm === 'SPRAY' || mm === 'DRENCH' || mm === 'MIX');
			if (tOnly.length && nslots(tOnly) === 1 && others.length && others.every(generic)) cand = tOnly;
		}
		let slots = [...new Set(cand.map((a) => a.slotId))];   // 候補の枠 id(重複を除く)
		// 当たった枠が「散布」の受け皿(株元散布などの行を減点付きで当てた枠)だけで、方法まで合う別の枠に該当しうる(maybe)ときは、
		// そちらの可能性が残るので確定しない(例: 含有率の分からない粒剤の株元散布 → 「2%粒剤の株元散布」か「散布」か決められない)
		const fallbackOnly = cand.every((a) => eff(a) < a.specificity);
		const specificMaybe = maybe.filter((a) => matchMethod(a, row) === 'yes' && a.methods.size && !a.methods.has('SPRAY'));
		if (fallbackOnly && specificMaybe.length) slots = [...new Set(slots.concat(specificMaybe.map((a) => a.slotId)))];
		res = { slots, certain: slots.length === 1 };
	} else if (maybe.length) {
		const slots = [...new Set(maybe.map((a) => a.slotId))];
		// 消去法: 排他的な区分の規定(内訳の上限の合計が総量以上)では、登録上の使用はどれかの枠に属する。
		// 該当しうる枠が1つしか残らなければ、その枠に確定する(例: 「育苗箱散布は1回以内、本田では2回以内」で育苗箱散布でない行 → 本田)
		res = { slots, certain: rule.exhaustive && slots.length === 1 };
	} else if (rule.exhaustive) {
		// 排他的な区分の規定なのに、どの枠にも当たらない行: 登録上の使用はどれかの枠に属するはずなので、時期の語の読み違い(語彙不足)とみなす。
		// 方法・対象で否定されない枠を候補に戻す(時期は問わない)。1つなら確定、複数なら可能性、0なら本当に該当なし(総量にだけ数える)
		const mt = main.filter((a) => a.parsed !== false && worst(matchMethod(a, row), matchTarget(a, row)) !== 'no');
		const slots = [...new Set(mt.map((a) => a.slotId))];
		if (slots.length) res = { slots, certain: slots.length === 1, relaxed: true };
	}
	// 入れ子の枠(「Aは5回以内(そのうちBは4回以内)」のB): 親の条件とBの両方に該当する行を数える
	// 「時期だけの横断的な枠」(出穂期以降など)も、他の枠とは別に、該当すれば重ねて数える
	res.overlay = [];
	rule.slots.filter((sl) => sl.overlay).forEach((sl) => {
		let pm = 'no';   // 親の条件との照合結果(親が複数の条件なら best)
		sl.parentAtoms.forEach((a) => { pm = best(pm, m3(a)); });
		let cm = sl.allOfParent ? 'yes' : 'no';   // 自分の条件との照合結果(「…をする場合には」の枠は親の行すべて)
		rule.atoms.filter((a) => a.slotId === sl.id).forEach((a) => { cm = best(cm, m3(a)); });
		const r = worst(pm, cm);   // 親と自分の両方に合って初めて内数として数える
		if (r !== 'no') res.overlay.push({ id: sl.id, certain: r === 'yes' });
	});
	rule.slots.filter((sl) => rule.crossCut.has(sl.id)).forEach((sl) => {
		let cm = 'no';
		rule.atoms.filter((a) => a.slotId === sl.id).forEach((a) => { cm = best(cm, m3(a)); });
		if (cm !== 'no') res.overlay.push({ id: sl.id, certain: cm === 'yes' });
	});
	return res;
}

/** 内訳枠の規定文の文言(「散布及び無人航空機散布は合計3回以内」)。文言が取れない枠は条件と上限から組み立てる */
function slotTextOf(sl) {
	if (!sl) return '';
	if (sl.rawText) return sl.rawText + (sl.overlay && !sl.allOfParent ? '(内数)' : '');
	return `${sl.label}${sl.overlay && !sl.allOfParent ? '(内数)' : ''}は${sl.multi ? '合計' : ''}${sl.limit}回以内`;
}

// ============================================================ 判定(UI用)
/**
 * 1つの有効成分について、計画表の使用行から内訳枠の超過を判定する。
 * items: [{ no, sakumotsu, yakuzai, jiki, hoho, ekiryo, seibunkaisu }]  (1行 = 1回の使用)
 * 戻り値: { status: 'NG'|'要確認'|'OK'|'', lines, flags, facts, okLines, slotInfo, questions }
 *   lines  : 成分別の表に出す NG・要確認の理由 [{ level, text }]
 *   flags  : 超過(NG)または枠未確定(要確認)の内訳枠に属する使用行ごとの理由 Map(item.ref -> [{ level, text }])。判定に効く
 *   facts  : 上限内(OK)の内訳枠の、使用行ごとの理由 Map(item.ref -> [{ level: 'OK', text }])。判定には使わない表示用の事実。
 *            使用行には、その行自身の規定文から出た枠だけを付ける
 *   okLines: 成分別の表に出す OK の内訳枠の理由 [{ level: 'OK', text }](表示用)
 *   slotInfo : 合算枠への所属(現在の表示では使っていない)
 *   questions: 要確認の解消の問い(下記)。item.ref は呼び出し側が付ける任意の識別子(計画表の行 tr)
 *   NG      : 確定した使用だけで、内訳枠の上限を超えている
 *   要確認  : 枠を確定できない使用まで含めると超える/解釈できない規定・時期語がある
 *   ''      : 内訳規定がなく、総量だけの規定(判定対象なし)
 * 規定文が複数ある(登録ごとに異なる)場合は、どの規定文も成分の全使用行に当てはめて数え、最悪の結果を返す。
 * (規定文ごとに、その規定文を持つ行だけを数えると、登録が別でも同じ成分・同じ枠の使用が合算されず超過を見逃す)
 * 要確認の解消(利用者の選択):
 *   確定できない点ごとに「問い」q = { kind, key, ref, rows, seibun, rule, title, options:[{ value, label }] } を作り、
 *   opts.resolve(q) が選択肢の value を返せば、その答えで確定させて数える(返さなければ従来どおり「可能性」として数える)。
 *     kind 'slot'   : 使用行がどの内訳枠に当たるか(value = 枠 id、または 'none' = どの枠にも当たらない)
 *     kind 'overlay': 使用行が内数・横断の枠に当たるか('yes' / 'no')
 *     kind 'when'   : 使用行が「…をする場合には」の条件の処理に当たるか('yes' / 'no')
 *     kind 'warn'   : 読めない規定で、内訳の上限を超えていないか('ok' / 'ng')
 *   戻り値の questions: 要確認の原因になっている問い(answer なし)と、答えを使った問い(answer あり)。rows はその問いに関わる使用行(ref)
 *   選択がなければ(opts.resolve なし)判定は従来と同じ
 */
function judge(items, seibun, opts = {}) {
	// groups: 規定文(+作物別規定なら作物名)ごとの判定単位。rows は常に成分の全使用行(規定文が違っても全行に当てはめる)
	const groups = new Map();
	items.forEach((it) => {
		const text = String(it.seibunkaisu || '').trim();
		if (!/\d回/.test(text)) return;                       // '-' や空欄は対象外
		const crop = /^\s*\d/.test(text) ? '' : norm(it.sakumotsu);
		const key = text + '\u0000' + crop;
		if (!groups.has(key)) groups.set(key, { text, sakumotsu: it.sakumotsu, rows: items });
	});

	const lines = [];         // 画面に出す判定行 [{ level: 'NG'|'要確認', text }]
	const flags = new Map();  // 使用行(item.ref)ごとの理由 → 薬剤別の表に引き当てる
	const slotInfo = new Map();  // 使用行(item.ref)ごとの、合算枠(複数の時期・方法で合計N回)への所属 [{ key, label, limit, used }](現在の表示では使っていない)
	// its の各行に (level, text) の理由を付ける(同じ理由は重複して付けない)
	// sig: 枠の判定結果の中身(判定・上限・回数・該当した使用行)。規定文の書き方だけが違う同じ枠
	//      (「…無人ヘリ散布は合計3回以内」と「…無人航空機散布は合計3回以内」など、製剤ごとに文言の違う同じ成分の規定)の結果を
	//      1つにまとめるために使う。rule: その結果を出した規定文(使用行の自分の規定文の文言を優先して残す)
	// facts: 使用行(item.ref)ごとの、判定によらない内訳枠の事実(OK の枠の「規定文の文言: 使用回数N回」)。判定(flags)とは別に持ち、
	//        判定には使わない。内訳枠のある成分は、判定がどうであれ、その行が数えられた枠の回数を必ず表示するために使う
	const facts = new Map();
	const okLines = [];   // 画面に出す OK の内訳枠の行 [{ level: 'OK', text }](成分別の表用。判定には使わない)
	const flagTo = (target) => (its, level, text, sig, rule) => its.forEach((it) => {
		if (it.ref === undefined) return;
		if (!target.has(it.ref)) target.set(it.ref, []);
		const arr = target.get(it.ref);
		if (arr.some((f) => f.level === level && f.text === text)) return;
		const same = sig ? arr.findIndex((f) => f.sig === sig) : -1;
		if (same >= 0) {
			// 同じ中身の結果がすでにある: その行自身の規定文から出た文言のほうを残す
			if (rule && String(it.seibunkaisu || '').trim() === rule && arr[same].rule !== rule) arr[same] = { level, text, sig, rule };
			return;
		}
		arr.push({ level, text, sig, rule });
	});
	const flag = flagTo(flags);
	const fact = flagTo(facts);
	const seen = new Set();   // 判定行の重複除去用
	const seenSig = new Set();   // 判定行の重複除去用(中身が同じで文言だけ違う枠の結果)
	// 判定行を追加する(同じ内容は1回だけ)
	const push = (level, text, sig) => {
		const k = level + text;
		if (seen.has(k) || (sig && seenSig.has(sig))) return;
		seen.add(k); if (sig) seenSig.add(sig);
		lines.push({ level, text });
	};
	let hasSlots = false;   // 内訳の枠が1つでもある(=判定対象がある)
	let ng = false;         // 確定した使用だけで超過した枠がある
	let check = false;      // 枠を確定できない使用・解釈できない規定/時期語がある

	const questions = [];          // 要確認の原因の問い(未回答)と、回答を使った問い
	const qId = (q) => (q.ref === undefined || q.ref === null ? '' : q.ref) + '\u0002' + q.key;
	const addQ = (q, rows) => {
		// 同じ問いは1つにまとめ、関わる使用行を足していく
		const id = qId(q);
		const old = questions.find((x) => qId(x) === id && x.ref === q.ref);
		if (old) { rows.forEach((r) => { if (!old.rows.includes(r)) old.rows.push(r); }); return; }
		questions.push(Object.assign(q, { rows: rows.slice() }));
	};
	// 利用者の選択を問う。選択肢にない答え・未回答は undefined
	const ask = (q) => {
		if (!opts.resolve) return undefined;
		let v;
		try { v = opts.resolve(q); } catch (e) { v = undefined; }
		return q.options.some((o) => o.value === v) ? v : undefined;
	};
	const refsOf = (rs) => rs.map((x) => x.ref).filter((x) => x !== undefined);
	const pendingAll = [];   // 未回答の問いすべて(要確認の原因かどうかによらない)

	let gi = 0;
	groups.forEach((g) => {
		gi++;
		const rule = parseRule(g.text, g.sakumotsu);
		const qBase = seibun + '\u0001' + g.text + '\u0001' + (/^\s*\d/.test(g.text) ? '' : norm(g.sakumotsu));   // 問いのキーの共通部分
		const pend = new Map();   // 枠 id → その枠を要確認にしうる未回答の問い
		const pendAdd = (id, q) => { if (!pend.has(id)) pend.set(id, []); if (!pend.get(id).includes(q)) pend.get(id).push(q); };
		const slotById = (id) => rule.slots.find((x) => x.id === id);
		const answered = (q, v, r) => { q.answer = v; addQ(q, refsOf([r])); };
		if (rule.slots.length) hasSlots = true;
		const sure = {};       // 枠 id → その枠に確定した使用行
		const possible = {};   // 枠 id → その枠に該当するかもしれない使用行(確定できないもの)
		rule.slots.forEach((sl) => { sure[sl.id] = []; possible[sl.id] = []; });
		const needTime = rule.atoms.some((a) => a.positions.size > 0 || a.literals.size > 0);   // 規定に時期の条件があるか

		const why = new Map();   // 使用行 → 枠を確定できない理由(要確認の説明に添える)
		// 照合用に正規化した行。含有率で枠を分ける規定があれば、この成分の製剤の含有率(農薬名から引く)を付ける
		const usesPct = rule.atoms.some((x) => [...x.targets].some((tt) => tt.startsWith('PCT:')));
		// 含有率は呼び出し側(opts.contentPct)が農薬名と成分名から引く。この規定のときだけ問い合わせる。引けなければ null(不明)
		const pctOf = (r) => { try { const v = opts.contentPct ? opts.contentPct(r.yakuzai, seibun) : null; return typeof v === 'number' ? v : null; } catch (e) { return null; } };
		const rowOf = (r) => { const nr = normalizeRow(r); return usesPct ? Object.assign({}, nr, { pct: pctOf(r) }) : nr; };
		g.rows.forEach((r) => {
			const nr = rowOf(r);
			if (!rule.slots.length) return;
			const a = assign(nr, rule);   // この規定文の枠への割り当て
			if (a.slots.length && a.certain) sure[a.slots[0]].push(r);
			else if (a.slots.length) {
				// 枠を確定できない行: 利用者がどの枠に当たるかを選んでいれば、その枠に確定して数える
				const q = {
					kind: 'slot', key: 'slot\u0001' + qBase, ref: r.ref, no: r.no, seibun, rule: g.text,
					title: `${seibun}: 成分回数「${g.text}」のどの内訳枠に当たりますか`,
					options: a.slots.map((id) => ({ value: id, label: slotTextOf(slotById(id)) || id }))
						// 排他的な区分の規定(内訳の合計が総量以上)では、登録上の使用はどれかの枠に属するので「当たらない」は選べない
						.concat(rule.exhaustive ? [] : [{ value: 'none', label: 'いずれの内訳枠にも当たらない(総使用回数にだけ数える)' }]),
				};
				const c = ask(q);
				if (c === 'none') answered(q, c, r);
				else if (c !== undefined) { sure[c].push(r); answered(q, c, r); }
				else {
					// 枠を確定できない行は、候補の枠すべてに「可能性」として数える(最悪の場合の数)。
					// 要確認にするのは、その可能性まで含めると上限を超える枠があるときだけ(超えようがなければ OK)
					a.slots.forEach((id) => { possible[id].push(r); pendAdd(id, q); });
					pendingAll.push(q);
					why.set(r, nr.jiki.unresolved.length && needTime ? '使用時期「' + nr.jiki.unresolved.join('/') + '」を解釈できない' : '該当する枠を確定できない');
				}
			}
			a.overlay.forEach((o) => {
				if (o.certain) { sure[o.id].push(r); return; }
				const sl = slotById(o.id);
				const q = {
					kind: 'overlay', key: 'ov\u0001' + qBase + '\u0001' + o.id, ref: r.ref, no: r.no, seibun, rule: g.text,
					title: `${seibun}: 「${slotTextOf(sl)}」に当たりますか`,
					options: [{ value: 'yes', label: '当たる(この枠に数える)' }, { value: 'no', label: '当たらない' }],
				};
				const c = ask(q);
				if (c === 'yes') { sure[o.id].push(r); answered(q, c, r); }
				else if (c === 'no') answered(q, c, r);
				else {
					possible[o.id].push(r); pendAdd(o.id, q); pendingAll.push(q);
					if (!why.has(r)) why.set(r, '該当する枠を確定できない');
				}
			});
		});

		// 「…をする場合には」「当該処理をする場合には」の上限: 条件の処理を計画で使ったときだけ効く。
		// 確実に使っていれば通常どおり、使ったかどうか確定できなければ、その枠の使用は「可能性」として数える(超えうれば要確認)
		rule.slots.filter((sl) => sl.whenAtoms).forEach((sl) => {
			let on = 'no';
			const qs = [];   // 条件の処理に当たるか決められない行の問い
			g.rows.forEach((r) => {
				const nr = rowOf(r);
				let m = 'no';
				sl.whenAtoms.forEach((x) => { m = best(m, x.parsed === false ? 'maybe' : matchAtom(x, nr)); });
				if (m === 'maybe') {
					// 利用者が「条件の処理に当たる/当たらない」を選んでいれば、その答えで決める
					const q = {
						kind: 'when', key: 'when\u0001' + qBase + '\u0001' + sl.id, ref: r.ref, no: r.no, seibun, rule: g.text,
						title: `${seibun}: 「${slotTextOf(sl)}」の条件となる処理に当たりますか`,
						options: [{ value: 'yes', label: '当たる(この処理をした)' }, { value: 'no', label: '当たらない' }],
					};
					const c = ask(q);
					if (c !== undefined) { m = c; answered(q, c, r); } else { qs.push(q); pendingAll.push(q); }
				}
				on = best(on, m);
			});
			if (on === 'no') { sure[sl.id] = []; possible[sl.id] = []; }
			else if (on === 'maybe') {
				possible[sl.id] = sure[sl.id].concat(possible[sl.id]); sure[sl.id] = [];
				qs.forEach((q) => pendAdd(sl.id, q));
			}
		});

		rule.slots.forEach((sl) => {
			const su = sure[sl.id].length;      // 確定した使用回数
			const po = possible[sl.id].length;  // 可能性のある使用回数
			const label = sl.label + (sl.overlay && !sl.allOfParent ? '(内数)' : '');
			// 理由の文言: 「内訳枠の規定文の文言: 使用回数N回」(「散布及び無人航空機散布は合計3回以内: 使用回数4回」)
			const slotWords = slotTextOf(sl);
			if (sl.multi && !sl.overlay && su > 0) {   // 合算枠に確定した使用行を記録する
				sure[sl.id].forEach((it) => {
					if (it.ref === undefined) return;
					if (!slotInfo.has(it.ref)) slotInfo.set(it.ref, []);
					slotInfo.get(it.ref).push({ key: gi + ':' + sl.id, label: sl.label, limit: sl.limit, used: su });
				});
			}
			if (su > sl.limit) {
				ng = true;
				const sig = ['NG', sl.limit, su, 0, sure[sl.id].map((x) => x.no).join(',')].join('|');
				push('NG', `${slotWords}: 使用回数${su}回 (No.${sure[sl.id].map((x) => x.no).join(',')})`, sig);
				flag(sure[sl.id], 'NG', `${slotWords}: 使用回数${su}回`, sig, g.text);
			} else if (su + po > sl.limit) {
				check = true;
				const note = possible[sl.id].map((x) => `No.${x.no}(${why.get(x) || '該当する枠を確定できない'})`).join(', ');
				const sig = ['要確認', sl.limit, su, po, sure[sl.id].map((x) => x.no).join(','), possible[sl.id].map((x) => x.no).join(',')].join('|');
				push('要確認', `${slotWords}: 使用回数${su}回+可能性${po}回 — ${note}`, sig);
				flag(sure[sl.id].concat(possible[sl.id]), '要確認', `${slotWords}: 使用回数${su}回+可能性${po}回`, sig, g.text);
				// この枠を要確認にしている問い(関わる使用行は、この枠に数えた行すべて)
				(pend.get(sl.id) || []).forEach((q) => addQ(q, refsOf(sure[sl.id].concat(possible[sl.id]))));
			} else if (su + po > 0) {
				// 上限内の枠(OK)も、数えた使用行の事実として残す(判定には使わない)。
				// 使用行には、その行自身の規定文から出た枠だけを付ける(別の登録の規定文を当てはめた OK の枠まで並べない)
				const t = `${slotWords}: 使用回数${su}回${po ? `+可能性${po}回` : ''}`;
				const sig = ['OK', sl.limit, su, po, sure[sl.id].map((x) => x.no).join(','), possible[sl.id].map((x) => x.no).join(',')].join('|');
				fact(sure[sl.id].concat(possible[sl.id]).filter((x) => String(x.seibunkaisu || '').trim() === g.text), 'OK', t, sig, g.text);
				if (!okLines.some((x) => x.sig === sig || x.text === t)) okLines.push({ level: 'OK', text: t, sig });
			}
		});

		// 「異なる目的には使用しない」: 2つ以上の目的の枠に使用がある計画は NG(確定できない使用を含めてなら要確認)
		if (rule.exclusivePurpose) {
			const ps = rule.slots.filter((sl) => sl.purposeSlot);
			const sureUsed = ps.filter((sl) => sure[sl.id].length > 0);
			const anyUsed = ps.filter((sl) => sure[sl.id].length + possible[sl.id].length > 0);
			if (sureUsed.length >= 2) {
				ng = true;
				push('NG', '異なる目的に使用しています: ' + sureUsed.map((sl) => sl.label).join(' / '));
				flag(sureUsed.flatMap((sl) => sure[sl.id]), 'NG', '異なる目的には使用しない');
			} else if (anyUsed.length >= 2) {
				check = true;
				push('要確認', '異なる目的に使用している可能性があります: ' + anyUsed.map((sl) => sl.label).join(' / '));
				const its = anyUsed.flatMap((sl) => sure[sl.id].concat(possible[sl.id]));
				flag(its, '要確認', '異なる目的には使用しない');
				anyUsed.forEach((sl) => (pend.get(sl.id) || []).forEach((q) => addQ(q, refsOf(its))));
			}
		}

		// 規定文そのものを読めない場合: 内訳の上限は少なくとも1回なので、この成分の使用が1回だけなら超えようがない(OK)。
		// 2回以上なら、読めない内訳の上限を超えている可能性があるので要確認
		// (「条件を解釈できません」は、その条件をどの行にも「該当するかもしれない」として上で数えているので、ここでは扱わない)
		rule.warnings.filter((w) => !/^条件を解釈できません/.test(w)).forEach((w) => {
			if (g.rows.length < 2) return;
			// 利用者が規定を読んで「上限を超えていない/超えている」を選んでいれば、その答えで決める(使用回数が変われば問い直す)
			const q = {
				kind: 'warn', key: 'warn\u0001' + qBase + '\u0001' + w + '\u0001' + g.rows.length, ref: null, rows: refsOf(g.rows), seibun, rule: g.text,
				title: `${seibun}: ${w}。成分回数「${g.text}」の内訳の上限を超えていませんか(使用${g.rows.length}回)`,
				options: [{ value: 'ok', label: '超えていない' }, { value: 'ng', label: '超えている' }],
			};
			const c = ask(q);
			if (c === 'ok') { q.answer = c; addQ(q, refsOf(g.rows)); return; }
			if (c === 'ng') {
				q.answer = c; addQ(q, refsOf(g.rows));
				ng = true; push('NG', `${w}: 内訳の上限を超えている(選択)`); flag(g.rows, 'NG', `${w}: 内訳の上限を超えている(選択)`);
				return;
			}
			check = true; push('要確認', w); flag(g.rows, '要確認', w);
			addQ(q, refsOf(g.rows));
		});
	});

	// この成分で要確認の原因になっている問い、または回答済みの問いが1つでもあれば、この成分の未回答の問いもすべて出す
	// (一部を選ぶと他の行の問いが要確認の原因でなくなり、ダイアログから消えてしまうのを防ぐ。選び直しで全体を修正できるようにする)。
	// 関わる使用行はこの成分の問いの行すべてにそろえ、どの薬剤のダイアログからも同じ問いの組が見えるようにする
	if (questions.length) {
		pendingAll.forEach((q) => addQ(q, q.ref !== undefined && q.ref !== null ? [q.ref] : (q.rows || [])));
		const all = [];
		questions.forEach((q) => (q.ref !== undefined && q.ref !== null ? [q.ref] : []).concat(q.rows || []).forEach((r) => { if (!all.includes(r)) all.push(r); }));
		questions.forEach((q) => { q.rows = all.slice(); });
	}

	// 総合: NG > 要確認 > OK(枠があり問題なし) > ''(判定する内訳規定なし)
	const status = ng ? 'NG' : check ? '要確認' : hasSlots ? 'OK' : '';
	return { status, lines, flags, slotInfo, questions, facts, okLines: okLines.map(({ level, text }) => ({ level, text })) };
}

/** 使用時期の文字列 → 作物の生育段階。定植(植付)時までの位置だけなら「育苗期」、定植後の位置だけなら「生育期」、解釈できない・またがる場合は ''。
*  (薬剤別の表の段階表記は廃止したため、現在の表示では使っていない) */
const stageOf = (text) => {
	const ps = [...parseJiki(text).positions];
	if (!ps.length) return '';
	if (ps.every((p) => p <= P.PL)) return '育苗期';
	if (ps.every((p) => p >= P.PLA)) return '生育期';
	return '';
};

/**
 * 使用行 item が、成分 seibun の規定文(item.seibunkaisu)のどの内訳枠に当たるかを、内訳枠の規定文の文言(slotTextOf)で返す。
 * 判定はしない(回数は数えない)。利用者の選択(要確認の解消)も反映しない。
 * 薬剤別使用回数の表で、使用行を (通称, 使用回数, この文字列) で集計するキーに使う(planRowSlotText が成分ごとに並べる)。
 *   例: 「4回以内(粒剤の定植時までの処理は1回以内、…)」の定植時の株元散布 → 「4回以内 / 粒剤の定植時までの処理は1回以内」
 *       枠が1つに決まらない → 「4回以内 / (Aは1回以内 又は Bは2回以内)」、内訳の枠に当たらない・内訳の無い規定 → 「4回以内」
 *       入れ子(内数)の枠は「…(内数)」、該当するか決まらない内数・横断の枠は「…(該当の可能性)」を後ろに付ける
 *   opts.contentPct(農薬名, 成分名): 含有率で枠を分ける規定(「2%粒剤…」)の照合に使う(judge と同じ)
 */
function text(item, seibun, opts = {}) {
	const raw = String(item.seibunkaisu || '').trim();
	if (!/\d回/.test(raw)) return '';
	const rule = parseRule(raw, item.sakumotsu);
	// 総量の部分(括弧の内訳を除いた規定文。作物別の規定は選ばれた作物の節)
	const head = rule.crop ? `${rule.crop}は${rule.total != null ? rule.total + '回以内' : ''}` : norm(raw).replace(/\([^]*\)$/, '');
	if (!rule.slots.length) return head;
	const usesPct = rule.atoms.some((x) => [...x.targets].some((tt) => tt.startsWith('PCT:')));
	let nr = normalizeRow(item);
	if (usesPct) {
		let v = null;
		try { v = opts.contentPct ? opts.contentPct(item.yakuzai, seibun) : null; } catch (e) { v = null; }
		nr = Object.assign({}, nr, { pct: typeof v === 'number' ? v : null });
	}
	const a = assign(nr, rule);
	const labelOf = (id) => slotTextOf(rule.slots.find((x) => x.id === id)) || id;   // 内訳枠の規定文の文言そのもの
	const parts = [head];
	if (a.slots.length === 1 && a.certain) parts.push(labelOf(a.slots[0]));
	else if (a.slots.length) parts.push('(' + a.slots.map(labelOf).join(' 又は ') + ')');
	a.overlay.forEach((o) => parts.push(labelOf(o.id) + (o.certain ? '' : '(該当の可能性)')));
	return parts.join(' / ');
}

/** 文字列に出てくる出来事(開花・出穂・入水など。EVENTS の名前)の配列。生育ステージの表に出す出来事を決めるのに使う */
function eventsIn(t) { return [...eventsOf(t).keys()]; }
return { judge, stageOf, text, eventsIn, EVENT_NAMES: EVENTS.map(([n]) => n) };
})();


/**
 * 記録モードの日付を選ぶカレンダー(防除時期・生育ステージの時期で共通)。label の下に開き、日を押すと onPick(年月日) を呼んで閉じる。
 * 「クリア」は onPick('')。前月・翌月で月を移る。枠の外を押す・Esc で何もせず閉じる。
 * ブラウザの日付入力の部品は、日付が空のときに開く月を指定できないので、この画面で作る
 */
function openTimingCalendar(e, value, onPick) {
	closeTimingCalendar();
	//const anchor = document.querySelector(`label[for="${uniqueId}"]`);
	const anchor = e.target.querySelector('label');
	const pad = (n) => String(n).padStart(2, '0');
	const today = new Date();
	const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

	let y = today.getFullYear();
	let m = today.getMonth() + 1;

	if (/^\d{4}-\d{2}-\d{2}$/.test(value || '')) {
		y = Number(value.slice(0, 4));
		m = Number(value.slice(5, 7));
	} else {
		const match = String(value || '').match(/^(\d{1,2})月(上旬|中旬|下旬)$/);
		if (match) {
			m = Number(match[1]);
			const day = match[2] === '上旬' ? 5 : match[2] === '中旬' ? 15 : 25;
			value = `${y}-${pad(m)}-${pad(day)}`;
		} else {
			value = '';
		}
	}

	const pop = document.createElement('div');
	pop.id = 'timingCalendar';
	pop.setAttribute('role', 'dialog');
	pop.setAttribute('aria-label', '日付の選択');
	const render = () => {
		const days = new Date(y, m, 0).getDate();
		const start = new Date(y, m - 1, 1).getDay();
		let cells = '';
		for (let i = 0; i < start; i++) cells += '<span></span>';
		for (let d = 1; d <= days; d++) {
			const ds = `${y}-${pad(m)}-${pad(d)}`;
			const cls = ['tc-day', ds === value ? 'tc-sel' : '', ds === todayStr ? 'tc-today' : ''].filter(Boolean).join(' ');
			cells += `<button type="button" class="${cls}" data-date="${ds}">${d}</button>`;
		}
		pop.innerHTML = `<div class="tc-head"><button type="button" data-nav="-1" title="前の月">◀</button><span class="tc-title">${y}年${m}月</span><button type="button" data-nav="1" title="次の月">▶</button></div>`
			+ `<div class="tc-grid">${['日', '月', '火', '水', '木', '金', '土'].map(w => `<span class="tc-wd">${w}</span>`).join('')}${cells}</div>`
			+ `<div class="tc-foot"><button type="button" data-act="clear">クリア</button><button type="button" data-act="today">今日</button><button type="button" data-act="close">閉じる</button></div>`;
	};
	render();
	pop.addEventListener('click', (e) => {
		e.stopPropagation();
		const b = e.target.closest('button');
		if (!b) return;
		if (b.dataset.nav) { m += Number(b.dataset.nav); if (m < 1) { m = 12; y--; } if (m > 12) { m = 1; y++; } render(); return; }
		if (b.dataset.date) { closeTimingCalendar(); onPick(b.dataset.date); return; }
		if (b.dataset.act === 'clear') { closeTimingCalendar(); onPick(''); return; }
		if (b.dataset.act === 'today') { closeTimingCalendar(); onPick(todayStr); return; }
		if (b.dataset.act === 'close') closeTimingCalendar();
	});
	document.body.appendChild(pop);
	// 位置: anchor の下(画面からはみ出すときは上・左に寄せる)
	const r = anchor.getBoundingClientRect();
	const w = pop.offsetWidth, h = pop.offsetHeight;
	let left = Math.min(r.left, window.innerWidth - w - 8), top = r.bottom + 2;
	if (top + h > window.innerHeight - 8) top = Math.max(8, r.top - h - 2);
	pop.style.left = `${Math.max(8, left)}px`;
	pop.style.top = `${top}px`;
	pop._onDoc = (e) => { if (!pop.contains(e.target)) closeTimingCalendar(); };
	pop._onKey = (e) => { if (e.key === 'Escape') closeTimingCalendar(); };
	setTimeout(() => { document.addEventListener('click', pop._onDoc); document.addEventListener('keydown', pop._onKey); }, 0);
	(pop.querySelector('.tc-sel') || pop.querySelector('.tc-day'))?.focus();
}
function closeTimingCalendar() {
	const pop = document.getElementById('timingCalendar');
	if (!pop) return;
	document.removeEventListener('click', pop._onDoc);
	document.removeEventListener('keydown', pop._onKey);
	pop.remove();
}

