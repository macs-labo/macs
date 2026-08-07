/**
 * 病害虫リスト管理クラス
 */
class PestListManager {
	constructor(wrapperSelector, onChangeCallback) {
		this.wrapper = document.querySelector(wrapperSelector);
		this.onChangeCallback = onChangeCallback;
		this.checkedPests = []; // 選択された病害虫リスト [{id, byochu}]
		this.pests = [];        // 現在表示されている病害虫データ

		this.isFiltering = false;
		this.container = null;
		this.filterInput = null;
		this.filterButton = null;
		this.filterCategory = null;
		this.clearAllCheckbox = null;
		this.sortSelect = null;
		this.onSearch = null; // 追加：外部検索用コールバック
		this.idSuffix = '';
	}

  /**
	 * UIの初期化とイベントリスナーの登録
	 * @param {Object} options { title: string, showCategory: boolean, onSearch: function }
	 */
	init(options = {}) {
		if (!this.wrapper) return;

		this.reset();

		this.idSuffix = this.wrapper.id || Math.random().toString(36).substr(2, 9);
		const showCategory = options.showCategory !== false;
		const title = options.title || '病害虫名等選択';
		this.onSearch = options.onSearch;
		const btnText = '絞込';

		const categoryHtml = !showCategory ? '' : `
			<select name="byochuSelect">
				<option value="" selected>全　全て</option>
				<option value="1">病　病害</option>
				<option value="2">虫　害虫</option>
				<option value="3">草　雑草</option>
				<option value="4">鳥　鳥獣</option>
				<option value="5">他　その他</option>
			</select>`;

		this.wrapper.innerHTML = `
			<h3>${title}</h3>
			<form class="inputbar" onsubmit="return false">
				${categoryHtml}
				<input type="text" name="byochuInput" placeholder="病害虫名等で絞込" autocomplete="on" />
				<button type="button" name="byochuButton">${btnText}</button>
			</form>
			<div class="allItemsContainer operator">
				<div class="checkListItem">
					<input type="checkbox" id="pestAllClear_${this.idSuffix}" disabled/><label for="pestAllClear_${this.idSuffix}">全解除</label>
				</div>
				<div>
					<span>並替:</span>
					<select name="pestSort">
						<option value="idbyochu" selected>ID順</option>
						<option value="betsumei">読順</option>
					</select>
				</div>
			</div>
			<div class="list-box no-swipe">
				<div class="pest-list-container"></div>
			</div>
		`;

		this.wrapper.classList.remove('hidden');

		this.container = this.wrapper.querySelector('.pest-list-container');
		this.filterInput = this.wrapper.querySelector('input[name="byochuInput"]');
		this.filterButton = this.wrapper.querySelector('button[name="byochuButton"]');
		this.filterCategory = this.wrapper.querySelector('select[name="byochuSelect"]');
		this.clearAllCheckbox = this.wrapper.querySelector(`#pestAllClear_${this.idSuffix}`);
		this.sortSelect = this.wrapper.querySelector('select[name="pestSort"]');

		this._setupListeners();

		// 初期全件取得（外部検索が定義されている場合、キーワード空で実行）
		if (this.onSearch) {
			this.onSearch('', '');
		}
	}

	_setupListeners() {
		const btnText = '絞込';
		// 絞込ボタン
		this.filterButton.addEventListener('click', () => this._handleFilter());
		// フィルタ入力 (Enter または Change)
		this.filterButton.addEventListener('mousedown', (e) => {
			// ボタンクリック時に入力欄の blur による重複発火を防止
			if (document.activeElement === this.filterInput) e.preventDefault();
		});
		this.filterInput.addEventListener('change', () => this._handleFilter());
		this.filterInput.addEventListener('input', (e) => {
			if (e.target.value === '') {
				if (typeof isMobile === 'undefined' || !isMobile) {
					this._handleFilter();
				} else {
					this.filterButton.textContent = btnText;
				}
			} else {
				if (this.filterButton.textContent === '解除') this.filterButton.textContent = btnText;
			}
		});

		// 区分フィルター
		if (this.filterCategory) {
			this.filterCategory.addEventListener('change', () => this._handleFilter());
		}

		// 全解除
		this.clearAllCheckbox.addEventListener('change', () => this.clearAll());

		// ソート
		this.sortSelect.addEventListener('change', () => this.sort(this.sortSelect.value));
	}

	/**
	 * コンテナに対するイベントデリゲーション
	 */
	_setupDelegatedListeners() {
		this.container.addEventListener('change', (e) => {
			const target = e.target;
			if (target && target.type === 'checkbox' && target.dataset.id) {
				const id = target.dataset.id;
				if (target.checked) {
					this.checkedPests.push({ id: id, byochu: target.value });
				} else {
					this.checkedPests = this.checkedPests.filter(p => p.id !== id);
				}
				this.clearAllCheckbox.checked = this.checkedPests.length > 0;
				this.clearAllCheckbox.disabled = this.checkedPests.length === 0;
				if (this.onChangeCallback) this.onChangeCallback(this.checkedPests);
			}
		});
	}

	async _handleFilter() {
		if (this.isFiltering) return;
		this.isFiltering = true;
		const btnText = '絞込';

		if (this.filterButton && this.filterButton.textContent === '解除' && this.filterInput) {
			this.filterInput.value = '';
		}

		if (typeof waiting === 'function') await waiting(true, '絞り込み中...');
		this.filter(this.filterInput ? this.filterInput.value : '', this.filterCategory?.value || '');
		if (typeof waiting === 'function') await waiting(false);

		if (this.filterButton && this.filterInput) {
			this.filterButton.textContent = this.filterInput.value.trim() === '' ? btnText : '解除';
		}
		if (this.filterButton.textContent === '解除') this.filterInput.blur(); // フォーカスを外す
		this.isFiltering = false;
	}

	/**
	 * 状態をリセットする
	 * @param {boolean} hidden trueの場合、要素を非表示にする
	 */
	reset(hidden = false) {
		this.pests = [];
		this.checkedPests = [];
		if (this.container) this.container.innerHTML = '';
		if (this.clearAllCheckbox) {
			this.clearAllCheckbox.checked = false;
			this.clearAllCheckbox.disabled = true;
		}
		if (hidden && this.wrapper) this.wrapper.classList.add('hidden');
	}

	/**
	 * リストを更新・描画する
	 * @param {Array} pests [{idbyochu, byochu, betsumei, cid}]
	 * @param {boolean} silent trueの場合、コールバックを実行しない
	 */
	async update(pests, silent = false) {
		await waiting(true, '病害虫リスト更新中...');
		try {
			this.pests = pests;
			if (this.wrapper) this.wrapper.classList.remove('hidden');
			this.checkedPests = []; // リスト更新時は選択をリセット

			// 初回のみデリゲーションリスナーを設定
			if (!this.container.dataset.listenerSet) {
				this._setupDelegatedListeners();
				this.container.dataset.listenerSet = 'true';
			}

			this.render();

			// フィルターとソートの状態を維持
			if (this.filterInput) {
				this.filter(this.filterInput.value, this.filterCategory?.value || '');
			}
			if (this.sortSelect) {
				this.sort(this.sortSelect.value);
			}

			if (!silent && this.onChangeCallback) this.onChangeCallback(this.checkedPests);

			// 全解除ボタンの更新
			if (this.clearAllCheckbox) {
				this.clearAllCheckbox.checked = false;
				this.clearAllCheckbox.disabled = true;
			}
		} finally {
			await waiting(false);
		}
	}

	/**
	 * DOM描画
	 */
	render() {
		if (!this.container) return;
		let subid = 0;
		const html = this.pests.map(pest => {
			let id = String(pest.idbyochu);
			if (id === '59999999') id = id + '_' + subid++;
			const name = pest.byochu;
			const ruby = pest.betsumei !== null ? pest.betsumei : name === '添加' ? 'てんか' : name;
			const hint = name + ` / ${ruby}`;
			const filter = (name + ' ' + ruby).toLowerCase();
			const isGroup = id.endsWith('%') ? ' pestGroup' : '';
			const inputId = `pest_${this.idSuffix}_${id}`;
			return `<div class="checkListItem${isGroup}" title="${hint}">` +
					`<input type="checkbox" value="${name}" id="${inputId}" data-id="${id}" data-ruby="${ruby}" data-filter="${filter}">` +
					`<label for="${inputId}">${name}</label>` +
					`</div>`;
		}).join('') + '<p class="nodata hidden">該当する病害虫が見つかりませんでした。</p>';

		this.container.innerHTML = html;
	}

	/**
	 * 全解除
	 */
	clearAll() {
		this.container.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
		this.checkedPests = [];
		this.clearAllCheckbox.checked = false;
		this.clearAllCheckbox.disabled = true;
		if (this.onChangeCallback) this.onChangeCallback(this.checkedPests);
	}

	// pests で渡された病害虫をリストボックス UI と同期
	syncCheckState(pests = '') {
		if (!pests) return;

		// checkedPests 及びチェックボックスの設定
		const arrPests = pests.split(',');
		this.checkedPests = [];
		this.container.querySelectorAll('input[type="checkbox"]').forEach(cb => {
			cb.checked = false;
			arrPests.forEach(pest => {
				if (cb.value === pest) {
					this.checkedPests.push({ id: cb.dataset.id, byochu: cb.value });
					cb.checked = true;
				}
			});
		});
		if (this.isGlobal) window.checkedPests = this.checkedPests;

		// clearAll チェックボックスの設定
		this.clearAllCheckbox.checked = this.checkedPests.length > 0;
		this.clearAllCheckbox.disabled = !this.clearAllCheckbox.checked;
	}

	/**
	 * 絞り込み実行
	 * @param {String} inputText 絞込文字列（空白区切り可）
	 * @param {String} catId 区分ID
	 */
	filter(inputText = '', catId = '') {
		function toHan(str) {
			return str.replace(/[！-～]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0)).replace(/　/g, " ");
		}
		const normalized = toHan(inputText).toLowerCase().trim();
		const filters = (typeof romajiConv !== 'undefined' ? strconv(romajiConv(normalized).toHiragana(), 'r') : normalized)
			.split(' ')
			.filter(Boolean);

		let isNoData = true;
		this.container.querySelectorAll('.checkListItem').forEach(item => {
			const cb = item.querySelector('input');
			const matchesCat = catId === '' || cb.dataset.id.startsWith(catId);
			const target = strconv(cb.dataset.filter); // 名称とよみがな(ひらがな)が含まれている
			const matchesText = filters.length === 0 || filters.some(f => target.match(new RegExp(f)));

			const visible = matchesCat && matchesText;
			item.classList.toggle('hidden', !visible);
			item.classList.toggle('categoryHidden', !matchesCat);
			if (visible) isNoData = false;
		});
		this.container.querySelector('.nodata')?.classList.toggle('hidden', !isNoData);
		return isNoData;
	}

	/**
	 * 並べ替え実行
	 * @param {String} mode 'idbyochu' | 'betsumei'
	 */
	sort(mode) {
		const items = Array.from(this.container.querySelectorAll('.checkListItem'));
		items.sort((a, b) => {
			const cbA = a.querySelector('input');
			const cbB = b.querySelector('input');
			if (mode === 'idbyochu') {
				// ID順（文字列比較、'%'を含む可能性があるため）
				return cbA.dataset.id.localeCompare(cbB.dataset.id, 'ja');
			} else {
				// 読順（データ属性のルビ優先）
				const nameA = cbA.dataset.ruby || cbA.value;
				const nameB = cbB.dataset.ruby || cbB.value;
				return nameA.localeCompare(nameB, 'ja');
			}
		});
		items.forEach(item => this.container.appendChild(item));
		const nodata = this.container.querySelector('.nodata');
		if (nodata) this.container.appendChild(nodata);
	}
}
