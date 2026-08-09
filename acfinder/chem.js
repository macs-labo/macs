/**
 * 薬剤リスト管理クラス
 */
class ChemListManager {
	constructor(wrapperSelector, onChangeCallback) {
		this.wrapper = document.querySelector(wrapperSelector);
		this.onChangeCallback = onChangeCallback;
		this.selectedChem = null;
		this.itemRenderer = null;
		this.chems = [];
		this.isFiltering = false;
		this.autoSelect = false;
		this.container = null;
		this.filterInput = null;
		this.filterButton = null;
		this.filterCategory = null;
		this.idSuffix = '';
	}

	/**
	 * UIの初期化
	 * @param {Object} options { title: string, showCategory: boolean, autoSelect: boolean }
	 */
	init(options = {}) {
		if (!this.wrapper) return;
		const showCategory = options.showCategory === true;
		this.autoSelect = options.autoSelect === true;
		this.idSuffix = this.wrapper.id || Math.random().toString(36).substr(2, 9);
		this.title = options.title || '薬剤選択';
		const btnText = '絞込';

		const categoryHtml = !showCategory ? '' :  `
			<select name="yakuzaiSelect">
				<option value="" selected>全　全て</option>
				<option value="殺菌">菌　殺菌剤</option>
				<option value="殺虫">虫　殺虫剤</option>
				<option value="除草">草　除草剤</option>
				<option value="成長調整|植調">調　植調剤</option>
				<option value="肥料">肥　農薬肥料</option>
				<option value="殺そ剤">鼠　殺そ剤</option>
				<option value="その他">他　その他</option>
			</select>`;

		this.wrapper.innerHTML = `
			<h3>${this.title}</h3>
			<form class="inputbar" onsubmit="return false">
				${categoryHtml}
				<input type="text" name="yakuzaiInput" placeholder="時期・方法・系統名等で絞込" autocomplete="on" />
				<button type="button" name="yakuzaiButton">${btnText}</button>
			</form>
			<div class="list-box no-swipe">
				<div class="chem-list-container">
					<p class="nodata hidden">該当する薬剤が見つかりませんでした。</p>
				</div>
			</div>
		`;

		this.container = this.wrapper.querySelector('.chem-list-container');
		this.filterInput = this.wrapper.querySelector('input[name="yakuzaiInput"]');
		this.filterButton = this.wrapper.querySelector('button[name="yakuzaiButton"]');
		this.filterCategory = this.wrapper.querySelector('select[name="yakuzaiSelect"]');

		this._setupListeners();
	}

	_setupListeners() {
		if (!this.filterButton || !this.filterInput) return;
		const defaultBtnText = '絞込';
		const doFilter = () => this._handleFilter();
		this.filterButton.addEventListener('click', doFilter);
		this.filterButton.addEventListener('mousedown', (e) => {
			// ボタンクリック時に入力欄の blur による重複発火を防止
			if (this.filterInput && document.activeElement === this.filterInput) e.preventDefault();
		});
		this.filterInput.addEventListener('change', doFilter);
		this.filterInput.addEventListener('input', (e) => {
			if (e.target.value === '') {
				if (typeof isMobile === 'undefined' || !isMobile) {
					doFilter();
				} else {
					this.filterButton.textContent = defaultBtnText;
				}
			} else if (this.filterButton) {
				if (this.filterButton.textContent === '解除') this.filterButton.textContent = defaultBtnText;
			}
		});

		// 区分フィルター
		if (this.filterCategory) {
			this.filterCategory.addEventListener('change', () => this._handleFilter());
		}
	}

	async _handleFilter() {
		if (this.isFiltering) return;
		this.isFiltering = true;
		const defaultBtnText = '絞込';

		if (this.filterButton && this.filterButton.textContent === '解除' && this.filterInput) {
			this.filterInput.value = '';
		}

		if (typeof waiting === 'function') await waiting(true, '絞り込み中...');
		const visibleCount = this.filter(this.filterInput ? this.filterInput.value : '', this.filterCategory?.value || '');
		if (typeof waiting === 'function') await waiting(false);

		if (this.filterButton && this.filterInput) {
			this.filterButton.textContent = this.filterInput.value.trim() === '' ? defaultBtnText : '解除';
		}
		if (this.filterButton.textContent === '解除') this.filterInput.blur(); // フォーカスを外す
		this.isFiltering = false;
		// フィルタリング結果が 1 で、autoSelect オプションが true の場合、そのアイテムを自動選択
		if (visibleCount === 1 && this.autoSelect) {
			const selected = this.container.querySelector('.checkListItem:not(.hidden)>input');
			selected.checked = true;
			const changeEvent = new Event('change', { bubbles: true });
			selected.dispatchEvent(changeEvent);
		}
	}

	/**
	 * リストを更新・描画する
	 * @param {Array} chems [{tsusho, tekiyo, keywords}]
	 * @param {Function} itemRenderer カスタムレンダラー関数 (row) => htmlString
	 */
	async update(chems, itemRenderer = null) {
		await waiting(true, '薬剤リスト更新中...');
		try {
			this.chems = chems;
			this.itemRenderer = itemRenderer;
			this.selectedChem = null;
			this.render();

			// フィルターの状態を維持
			if (this.filterInput) {
				this.filter(this.filterInput.value, this.filterCategory?.value || '');
			}

			if (this.onChangeCallback) this.onChangeCallback(null);
		} finally {
			await waiting(false);
		}
	}

	render() {
		if (!this.container) return;
		const countSpan = `<span class="count">(${this.chems.length}/${this.chems.length})</span>`;
		this.wrapper.querySelector('h3').innerHTML = `${this.title} ${countSpan}`;

		const defaultRenderer = (row) => {
			const name = row.tsusho;
			const tekiyo = row.tekiyo;
			const info = `${tekiyo}|${row.keywords}`;
			const inputId = `chem_${this.idSuffix}_${name}`;
			return `<div class="checkListItem" data-info="${name}|${info}" title="${name}">` +
				`<input type="radio" name="chemSelect_${this.idSuffix}" value="${name}" id="${inputId}">` +
				`<label for="${inputId}"><em>${name}</em><br><small>${info}</small></label>` +
				`</div>`;
		};

		const renderer = this.itemRenderer || defaultRenderer;

		const html = this.chems.map(row => renderer(row)).join('') + '<p class="nodata hidden">該当する薬剤が見つかりませんでした。</p>';

		this.container.innerHTML = html;

		// ラジオボタンの変更イベント
		this.container.querySelectorAll('input[type="radio"]').forEach(radio => {
			radio.addEventListener('change', (e) => {
				this.selectedChem = e.target.value;
				if (this.onChangeCallback) this.onChangeCallback(this.selectedChem);
			});
		});
	}

	filter(inputText = '', catText = '') {
		function toHan(str) {
			return str.replace(/[！-～]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0)).replace(/　/g, " ");
		}
		const normalizedText = toHan(inputText).replace(/\s/g, ' ').trim();
		const filtersOrg = normalizedText.split(' ').filter(Boolean);
		const filtersHira = typeof romajiConv !== 'undefined' ? toHan(romajiConv(normalizedText).toHiragana()).split(' ').filter(Boolean) : [];
		const filters = filtersOrg.map((val, i) => `${val}|${strconv(filtersHira[i], 'r') || val}`);

		let isNoData = true;
		let visibleCount = 0;
		this.container.querySelectorAll('.checkListItem').forEach(item => {
			// カテゴリーマッチ判定
			const matchesCat = catText === '' || !!item.dataset.info.match(new RegExp(catText));
			// テキストマッチ判定 (AND検索)
			const target = strconv(item.dataset.info);
			const matchesText = filters.length === 0 || filters.every(f => {
				return !!target.match(new RegExp(f, 'i'));
			});

			const visible = matchesCat && matchesText;
			item.classList.toggle('hidden', !visible);
			item.classList.toggle('categoryHidden', !matchesCat);

			if (visible) {
				isNoData = false;
				if (!item.hasAttribute('data-group')) visibleCount++;
			}
		});
		this.container.querySelector('.nodata')?.classList.toggle('hidden', !isNoData);
		const countEl = this.wrapper.querySelector('h3 .count');
		if (countEl) {
			countEl.textContent = `(${visibleCount}/${this.chems.length})`;
		}
		return visibleCount;
	}
}

/**
 * 薬剤詳細表示管理クラス
 */
class ChemDetailManager {
	constructor(wrapperSelector) {
		this.wrapper = document.querySelector(wrapperSelector);
		this.container = null;
	}

	/**
	 * UIの初期化
	 * @param {Object} options { title: string }
	 */
	init(options = {}) {
		if (!this.wrapper) return;
		const title = options.title ? `<h3>${options.title}</h3>` : ''
		this.wrapper.innerHTML = `
			${title}
			<div class="chem-detail-container"></div>
		`;
		this.container = this.wrapper.querySelector('.chem-detail-container');
	}

	/**
	 * 詳細情報の更新
	 * @param {string} chem 薬剤通称名
	 * @param {string} tableName 使用する適用テーブル名
	 * @param {Array} customSqls オプションのカスタムSQL配列 [{caption, prefix, query}]
	 */
	async update(chem, tableName = 't_cropTekiyo', customSqls = null) {
		if (!this.container || !chem) return;

		await waiting(true, '詳細情報を取得中...');
		try {
			const defaultSqls = [
				{
					name: 'summary',
					caption: '剤の概要', prefix: '',
					query: `
						with
							t_meisho as (select bango, meisho, tsusho from m_kihon where tsusho = '${chem}' order by bango),
							t_tsushoDaihyo as (select * from t_meisho where meisho = tsusho),
							t_bangoDaihyo as (select * from t_meisho where (select count(*) from t_tsushoDaihyo) = 0 and bango = (select min(bango) as bango from t_meisho group by tsusho)),
							t_daihyo as (select * from t_tsushoDaihyo UNION select * from t_bangoDaihyo),
							t_tazai as (select tsusho, gn_concat('<br>', format('%d %s', bango, meisho)) as tazai from t_meisho where bango <> (select bango from t_daihyo) group by tsusho),
							t_ojas as (select bango, ojas from t_tokusai)
						select format('%d %s', bango, meisho) as meisho,
							iif(shurui like '%'||zaikei||'%', shurui, format('%s [剤型: %s]',shurui,zaikei)) as 種類, dokusei,
							iif(yoto like '%'||koka||'%', yoto, format('%s [効果: %s]', yoto, koka)) as yoto, ojas, torokubi, ryakusho,
							tazai as 同名他剤, replace(chuijiko, '#', '<br>') as 注意事項
						from m_kihon left join suisan using(bango) left join t_tazai using(tsusho) left join t_ojas using(bango) left join seizai using(bango)
						where bango = (select bango from t_daihyo)
					`
				},
				{
					name: 'ingredients',
					caption: '成分カード', prefix: '成分',
					query: `
						select distinct row_number() over(order by (ippanmei)) as idx, ippanmei, nodo, seibun, iso,dokusei, jogai, keito, mid, rackeito, sayoten, sayokiko, fgroup, risk, ojas
						from kihon left join ${tableName}	using(tsusho)
						where tsusho = '${chem}' group by ippanmei
					`
				},
				{
					name: 'usage',
					caption: '適用カード', prefix: '適用',
					query: `
						SELECT
							row_number() over(order by (select null)) as idx, sakumotsu, gn_concat(',', ifnull(byochu, mokuteki)) as 病害虫等,
							jiki, kaisu, baisu, ekiryo, hoho, basho, jikan, ondo, dojo, chitai, tekiyaku
						FROM ${tableName}	WHERE tsusho = '${chem}'
						group by sakumotsu, jiki, kaisu, baisu, ekiryo, hoho, basho, jikan, ondo, dojo, chitai, tekiyaku
					`
				}
			];

			// customSqls が指定されている場合、デフォルト設定をベースに置換・追加を行う
			let sqls = defaultSqls;
			if (customSqls && Array.isArray(customSqls)) {
				const usedCustomIndices = new Set();

				// 1. デフォルト配列を走査して、target(index/name) または caption が一致するものを置換
				sqls = defaultSqls.map((def, idx) => {
					const cIdx = customSqls.findIndex(c =>
						(c.target !== undefined && (c.target === idx || c.target === def.name)) ||
						(c.target === undefined && c.caption && c.caption === def.caption)
					);
					if (cIdx !== -1) {
						usedCustomIndices.add(cIdx);
						return { ...def, ...customSqls[cIdx] };
					}
					return def;
				});

				// 2. 置換に使用されなかったカスタムSQL（新規追加分）を抽出して結合
				const additions = customSqls.filter((c, idx) => !usedCustomIndices.has(idx) && c.caption);
				sqls = [...sqls, ...additions];
			}

			let html = '';
			for (const sqlObj of sqls) {
				console.log(sqlObj.query.replace(/^\t+/gm, ''));
				let result = db.exec(sqlObj.query);
				const cleanedResult = result?.[0] ? cleanSqlResult(result[0]) : null;

				html += `<h3>${sqlObj.caption}</h3>`;

				if (cleanedResult?.values?.length > 0) {
					const cols = cleanedResult.columns;
					const vals = cleanedResult.values;
					vals.forEach(row => {
						if (row[0]) {
							html += `<h4 class="row-title no-swipe">${sqlObj.prefix}${row[0]}</h4>`;
						}
						html += '<table class="row-data-table">';
						let rowCount = 0;
						for (let i = 1; i < cols.length; i++) {
							if (row[i] !== null && row[i] !== undefined && row[i] !== '') {
								rowCount++;
								const cls = rowCount % 2 === 0 ? ' class="even-row"' : '';
								let colName = translateColumnName(cols[i]);
								if (colName === '希釈倍数/使用量') colName = String(row[i]).match(/倍|原液/) ? '希釈倍数' : '使用量';
								html += `<tr><th${cls}>${colName}</th><td${cls}>${row[i]}</td></tr>`;
							}
						}
						html += '</table>';
					});
					html += '<div class="bottom-spacer"></div>';
				} else {
					html += '<p>該当する情報が見つかりませんでした。</p>';
				}
			}
			this.container.innerHTML = html;
		} catch (e) {
			console.error("詳細表示エラー:", e);
		} finally {
			waiting(false);
		}
	}
}
