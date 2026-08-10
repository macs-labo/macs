/* 作物ツリー表示 */

// m_sakumotsu 検索結果から作物ツリー生成
function buildCropTree(sqlResult) {
	// idsakuからclass cまでのID部分を取得し、残りを0埋めした構造IDを返す
	function getStructuralId(idsaku, c) {
		let part = '';
		if (c === 0) { part = idsaku.substring(0, 2); }
		else if (c === 1) { part = idsaku.substring(0, 4); }
		else if (c === 2) { part = idsaku.substring(0, 6); }
		else if (c === 3) { part = idsaku.substring(0, 8); }
		else if (c === 4) { part = idsaku.substring(0, 12); }
		else if (c === 5) { part = idsaku; }
		return part.padEnd(16, '0');
	}

	if (!sqlResult || sqlResult.length === 0 || !sqlResult[0].values) {
		return [];
	}

	const { columns, values } = sqlResult[0];
	const map = new Map();

	// idsaku順にソートし、親ノードが先に処理されるようにする（これは維持）
	values.sort((a, b) => String(a[1]).localeCompare(String(b[1])));

	const colIndex = {
		idsaku: columns.indexOf('idsaku'),
		class: columns.indexOf('class'),
		toroku: columns.indexOf('toroku'),
		sakumotsu: columns.indexOf('sakumotsu'),
		shukakubui: columns.indexOf('shukakubui'),
		betsumei: columns.indexOf('betsumei'),
		keywords: columns.indexOf('keywords'),
	};

	function createNode(row, id, baseName, classVal, parentId, isDummy, realIdsaku) {
		const dataIdsaku = row.length > 0 ? String(row[colIndex.idsaku]) : realIdsaku;

		// 付加情報を含む表示名（name および text に使用）を生成
		let displayName = baseName;
		let nodeText = `[C${classVal}] ${baseName}`; // text はこれまで通り [C#] を含める
		let addInfo = '';

		if (isDummy) {
			// ダミーノードの場合
			//displayName = baseName; // ダミーノードの name はシンプルに
			nodeText = `[DUMMY C${classVal}] ${baseName}`;
		} else {
			// 実ノードの場合: addInfo に収穫部位、別名を追加
			const shukaku = row[colIndex.shukakubui] || '';
			const betsumei = row[colIndex.betsumei] || '';
			addInfo += shukaku ? `<span class="shukaku">${shukaku}</span>` : '';
			addInfo += betsumei ? `<span class="betsumei">${betsumei}</span>` : '';
			nodeText = `[C${classVal}] ${displayName}`;
		}

		return {
			id: id,
			// 【修正点】name プロパティに付加情報を含める
			name: displayName,
			text: nodeText,
			data: {
				isDummy: isDummy,
				idsaku: dataIdsaku, // 常に16桁のidsaku（実ノードまたは構造ID）を保持
				class: classVal,
				toroku: isDummy ? 0 : row[colIndex.toroku] || 0,
				sakumotsu: isDummy ? '' : baseName,
				shukakubui: isDummy ? '' : row[colIndex.shukakubui] || '',
				betsumei: isDummy ? '' : row[colIndex.betsumei] || '',
				keywords: isDummy ? '' : row[colIndex.keywords] || '',
				addinfo: isDummy ? '' : addInfo,
			},
			state: {
				depth: classVal,
			},
			children: [],
			parentId: parentId,
		};
	}

	//// 1. 実ノードとダミーノードを生成し、親子チェーンを確立 ////

	// C0ノードを先に処理
	values.filter(row => row[colIndex.class] === 0).forEach(row => {
		const idsaku = String(row[colIndex.idsaku]);
		map.set(idsaku, createNode(row, idsaku, row[colIndex.sakumotsu], 0, null, false, idsaku));
	});

	// C1以上のノードを処理
	values.filter(row => row[colIndex.class] > 0).forEach(row => {
		const currentClass = row[colIndex.class];
		const idsaku = String(row[colIndex.idsaku]);
		const sakumotsu = row[colIndex.sakumotsu];

		let parentNodeId = null;
		let nearestRealParentName = '';

		// C0からC(currentClass - 1)までの親ノードを遡ってチェック・生成
		for (let c = 0; c < currentClass; c++) {
			const structuralId = getStructuralId(idsaku, c);

			// 1. 実ノードが存在するかチェック
			let existingRealNode = map.get(structuralId);

			if (existingRealNode && existingRealNode.data.class === c) {
				// 1. 実ノードが存在する場合 (ex: C1 かんきつ)
				parentNodeId = structuralId;
				// 直近上位の実作物名で、ダミーノードの名前を上書きする
				// NOTE: name に付加情報が既についている場合は、それを使用
				//nearestRealParentName = existingRealNode.name.split('<span')[0];
				nearestRealParentName = existingRealNode.name;
			} else {
				// 2. 実ノードが存在しない場合 -> ダミーノードの生成を試みる

				// 初めてダミーノードを生成する場合、C0ノード名で初期化
				if (!nearestRealParentName) {
					const C0Id = getStructuralId(idsaku, 0);
					// C0ノードが存在しない可能性もあるためチェック
					//nearestRealParentName = map.get(C0Id) ? map.get(C0Id).name.split('<span')[0] : '不明';
					nearestRealParentName = map.get(C0Id) ? map.get(C0Id).name : '不明';
				}

				// ダミーノードのIDを**一意**にするためのキー
				const dummyId = structuralId + `_D${c}`;

				// ダミーノードがまだマップにない場合のみ生成
				if (!map.has(dummyId)) {

					const dummyNode = createNode(
						[],
						dummyId,
						nearestRealParentName, // 直近の実ノード名を継承
						c,
						parentNodeId,
						true,
						structuralId
					);
					map.set(dummyId, dummyNode);
				}
				parentNodeId = dummyId;
			}
		}

		//// 3. 現在の階層の実ノードをマップに登録 ////
		const realNode = createNode(row, idsaku, sakumotsu, currentClass, parentNodeId, false, idsaku);
		map.set(idsaku, realNode);
	});

	//// 2. 親子関係を構築し、ツリー配列を返す ////
	const tree = [];
	map.forEach(node => {
		if (node.parentId) {
			const parent = map.get(node.parentId);
			if (parent) {
				parent.children.push(node);
			}
		} else {
			tree.push(node);
		}
	});

	// 【重要な修正点】各ノードの子ノードをidsakuの昇順でソート
	// mapに格納されている全ノードに対してソート処理を実行
	map.forEach(node => {
		if (node.children.length > 1) {
			// 子ノードが2つ以上ある場合のみソートを実行
			node.children.sort((a, b) => {
				// idsaku（16桁文字列）を比較
				// ダミーノードの場合、data.idsaku には構造ID（例: '0101000000000000'）が入っている
				// 実ノードの場合、data.idsaku には元のidsaku（例: '0101010100000000'）が入っている
				return String(a.data.idsaku).localeCompare(String(b.data.idsaku));
			});
		}
	});

	// 最後にC0ノード（treeの直下ノード）もidsakuでソート（なくても問題ないが、より確実にC0ノード順を保証するため）
	if (tree.length > 1) {
		tree.sort((a, b) => {
			 return String(a.data.idsaku).localeCompare(String(b.data.idsaku));
		});
	}

	return tree;
}

// グローバル配列変数
var checkedCrops = [];
// 現在作成されているツリー参照（イベント解除のために保持）
var currentInfinitTree = null;
// 現在の作物ツリーを保持（リセット時に使用）
var currentCropTree = null;

/**
 * 作物ツリー管理クラス
 */
class CropTreeManager {
	constructor(selector, onCheckCallback, isGlobal = false) {
		this.selector = selector;
		this.onCheckCallback = onCheckCallback;
		this.isGlobal = isGlobal;
		this.searchMethod = ' and ';
		this.containerElement = null;
		this.domHandlers = {};
		this.idSuffix = '';
		this.checkedCrops = [];
		this.doFilter = null;
	}

	async init(sql, options = {}) {
		this.containerElement = document.querySelector(this.selector);
		if (!this.containerElement) return;

		this.reset(false, true); // 再構築時は選択状態を維持する

		this.idSuffix = this.selector.replace(/[^a-zA-Z0-9]/g, '_');
		const idSuffix = this.idSuffix;

		// 再構築時（除外条件変更など）に選択状態を復元する
		if (this.isGlobal && Array.isArray(window.checkedCrops)) {
			this.checkedCrops = [...window.checkedCrops];
		}

		// UIパーツの構築（コンテナ内部に集約）
		let methodHtml = '';
		if (options.showSearchMethod) {
			methodHtml = `
				<div class="selector">
					<h3>複数作物選択時検索方法</h3>
					<select id="searchMethod${idSuffix}">
						<option value=" and " ${this.searchMethod === ' and ' ? 'selected' : ''}>AND検索</option>
						<option value=" or " ${this.searchMethod === ' or ' ? 'selected' : ''}>OR検索</option>
					</select>
				</div>`;
		}
		const excluderHtml = options.showExcluder ? `<div id="excluder${idSuffix}"></div>` : '';

		this.containerElement.innerHTML = `
			${excluderHtml}
			${methodHtml}
			<h3>作物名選択</h3>
			<form id="filterForm${idSuffix}" class="inputbar" onsubmit="return false;">
				<input type="text" id="filterInput${idSuffix}" name="filterInput" placeholder="絞込作物名" title="指定例： [なす]部分一致 [:なす]前方一致 [なす:]後方一致 [:なす:]完全一致" autocomplete="on" />
				<button type="button" id="filterButton${idSuffix}">絞込</button>
			</form>
			<div class="treebox">
				<div class="checkListItem"><input type="checkbox" id="clearAll${idSuffix}" autocomplete="off" disabled /><label for="clearAll${idSuffix}">全解除</label></div>
				<div id="treeInner${idSuffix}"></div>
			</div>
		`;
		this.containerElement.classList.remove('hidden');

		// 全解除ボタンの状態を同期
		const clearAll = this.containerElement.querySelector(`#clearAll${idSuffix}`);
		if (clearAll) {
			clearAll.checked = this.checkedCrops.length > 0;
			clearAll.disabled = !clearAll.checked;
		}

		try {
			// 除外セレクタの初期化
			if (options.showExcluder) {
				makeExcludeSelector(`#excluder${idSuffix}`, this.onCheckCallback);
			}

			// 描画を一度確定させてから重い処理に入る
			await new Promise(resolve => setTimeout(resolve, 0));
			const sqlResult = db.exec(sql);
			// SQL実行後に再度解放
			await new Promise(resolve => setTimeout(resolve, 0));
			const treeData = buildCropTree(sqlResult);
			const treeContainer = this.containerElement.querySelector(`#treeInner${idSuffix}`);
			
			this.infiniteTree = new InfiniteTree(treeContainer, {
				autoOpen: false,
				selectable: false,
				data: treeData,
				rowRenderer: (node, opts) => {
					node.manager = this;
					return rowRenderer(node, opts);
				},
				togglerClass: 'infinite-tree-toggler',
				noDataText: '該当する作物が見つかりませんでした。',
			});

			this._setupListeners(idSuffix);
			
			if (this.isGlobal) {
				currentInfinitTree = this.infiniteTree;
				currentCropTree = this.containerElement;
			}
		} catch (error) {
			console.error('Initialization error:', error);
		}
	}

	_setupListeners(idSuffix) {
		const tree = this.infiniteTree;
		const filterInput = this.containerElement.querySelector(`#filterInput${idSuffix}`);
		const searchMethodSelect = this.containerElement.querySelector(`#searchMethod${idSuffix}`);
		if (searchMethodSelect) {
			searchMethodSelect.addEventListener('change', (e) => {
				this.searchMethod = e.target.value;
				this.onCheckCallback(this.checkedCrops);
			});
		}
		const filterButton = this.containerElement.querySelector(`#filterButton${idSuffix}`);
		const filterForm = this.containerElement.querySelector(`#filterForm${idSuffix}`);
		const clearAll = this.containerElement.querySelector(`#clearAll${idSuffix}`);

		// チェックボックス操作
		const changeHandler = (event) => {
			const target = event.target;
			if (target && target.matches('.checkbox')) {
				const nodeId = target.getAttribute('data-node-id');
				const node = tree.getNodeById(nodeId);
				if (!node) return;
				node.state.checked = !node.state.checked;
				
				if (node.state.checked) {
					this.checkedCrops.push({ id: node.id, sakumotsu: node.data.sakumotsu });
				} else {
					this.checkedCrops = this.checkedCrops.filter(item => item.id !== node.id);
				}

				if (this.isGlobal) window.checkedCrops = this.checkedCrops;
				tree.update();
				if (clearAll) {
					clearAll.checked = this.checkedCrops.length > 0;
					clearAll.disabled = !clearAll.checked;
				}
				// UIの更新（チェックマークの表示等）を優先し、重い処理（SQL実行やDOM生成）を非同期にする
				setTimeout(() => {
					this.onCheckCallback(this.checkedCrops);
				}, 0);
				event.stopPropagation();
			}
		};
		tree.contentElement.addEventListener('change', changeHandler);
		this.domHandlers.change = changeHandler;

		// トグル・スクロール時のチェック復元
		const restoreChecks = () => {
			this.checkedCrops.forEach(c => {
				const inputId = `crop_${this.idSuffix}_${c.id}`;
				const cb = tree.contentElement.querySelector(`input[id="${inputId}"]`);
				if (cb) cb.checked = true;
			});
		};

		tree.on('openNode', (node) => {
			if (node.state.depth > 0 && node.hasChildren() && node.children[0].data.isDummy) {
				const openRec = (n) => {
					if (n.hasChildren()) n.children.forEach(child => {
						if (!child.state.open) { child.state.open = true; tree.openNode(child); openRec(child); }
					});
				};
				openRec(node);
				tree.nodes.forEach(n => {
					const isChecked = this.checkedCrops.some(c => c.id == n.id);
					if (n.state.checked !== isChecked) n.state.checked = isChecked;
				});
				tree.update();
			}
			restoreChecks();
		});
		tree.on('closeNode', restoreChecks);
		tree.scrollElement.addEventListener('scroll', restoreChecks);

		// フィルタ
		let isFiltering = false;
		this.doFilter = async () => {
			if (isFiltering) return;
			isFiltering = true;
			if (filterButton.textContent === '解除') filterInput.value = '';
			const val = filterInput.value;
			filterButton.textContent = val === '' ? '絞込' : '解除';

			// 描画を確実に行わせるため、waiting() を利用して一旦制御をブラウザに戻します。
			// これにより「絞込」から「解除」への表示変更や、ローディング表示が即座に反映されます。
			await waiting(true, '絞り込み中...');

			try {
				this._applyFilter(val);
				if (filterButton.textContent === '解除') filterInput.blur();
			} finally {
				isFiltering = false;
				await waiting(false);
			}
		};
		// ボタンクリック時に入力欄の blur による change イベントの重複発火を防止します
		filterButton.addEventListener('mousedown', (e) => {
			if (document.activeElement === filterInput) e.preventDefault();
		});
		filterButton.addEventListener('click', this.doFilter);
		filterInput.addEventListener('change', this.doFilter);
		filterInput.addEventListener('input', (e) => {
			if (e.target.value === '') {
				if (typeof isMobile === 'undefined' || !isMobile) {
					this.doFilter();
				} else {
					filterButton.textContent = '絞込';
				}
			} else {
				if (filterButton.textContent === '解除') filterButton.textContent = '絞込';
			}
		});
		filterForm.addEventListener('submit', (e) => e.preventDefault());

		// 全解除
		clearAll.addEventListener('click', () => this.clearAll(false));
	}

	// checkedCrops の状態をツリーのUIに同期させる
	async syncCheckState(crops = '') {
		if (!this.infiniteTree) return;
		if (crops) {
			this.checkedCrops = [];
			const cropList = "'" + crops.replaceAll(',', "','") + "'";
			const result = db.exec(`select idsaku, sakumotsu from m_sakumotsu where sakumotsu in (${cropList}) order by idsaku`);
			if (result) {
				result[0].values.forEach(row => { this.checkedCrops.push({id: row[0], sakumotsu: row[1]}); });
			}
			if (this.isGlobal) window.checkedCrops = this.checkedCrops;
		} else if (this.isGlobal) {
			this.checkedCrops = window.checkedCrops;
		}

		// まず、現在のツリーのチェック状態をすべてクリア
		this.infiniteTree.nodes.forEach(node => {
			// 親ノードが閉じていると checkNode() がエラーになるので、先に親ノードの開閉状況を確認
			if (!node.parent || node.parent.state.open) {
				// 親ノードがトップノードまたは開いている場合は checkNode() でアンチェック　node.state.checked = false だけでは tree.update() で反映されない
				this.infiniteTree.checkNode(node, false); // エラーを気にしないなら、この結果が false なら強制アンチェックするのでも OK
			}
			node.state.checked = false;
			const inputId = this.isGlobal ? node.id : `crop_${this.idSuffix}_${node.id}`;
			const cb = this.infiniteTree.contentElement.querySelector(`input[id="${inputId}"]`);
			if (cb) cb.checked = false;
		});

		// this.checkedCrops に基づいてチェック状態を適用
		this.checkedCrops.forEach(c => {
			const node = this.infiniteTree.getNodeById(c.id);
			node.state.checked = true;
			const inputId = this.isGlobal ? c.id : `crop_${this.idSuffix}_${c.id}`;
			const cb = this.infiniteTree.contentElement.querySelector(`input[id="${inputId}"]`);
			if (cb) cb.checked = true;
		});
		this.infiniteTree.update();

		// clearAll チェックボックスの設定
		const clearAll = this.containerElement.querySelector(`#clearAll${this.idSuffix}`);
		if (clearAll) {
			clearAll.checked = this.checkedCrops.length > 0;
			clearAll.disabled = !clearAll.checked;
		}

		// doFilter() 実行
		const filterInput = this.containerElement.querySelector(`#filterInput${this.idSuffix}`);
		if (filterInput) {
			filterInput.value = crops.replaceAll(',', ' ');
			this.doFilter();
		}
	}

	_applyFilter(inputText) {
		const tree = this.infiniteTree;
		//const filterText = new RegExp(strconv(romajiConv(text).toHiragana().replaceAll('：', ':').trim(), 'r'));
		const filterText = strNormalize(inputText, '|');
		const reFilter = new RegExp(strconv(filterText, 'r'), 'i');
		const matchedNodes = new Set();

		if (!filterText) {
			tree.getOpenNodes().sort((a, b) => b.id.localeCompare(a.id)).forEach(node => {
				if (node.parent !== null) { node.state.open = false; tree.closeNode(node); }
			});
			tree.unfilter();
		} else {
			const check = (node) => {
				let hasMatch = false;
				if (node.hasChildren()) node.getChildren().forEach(child => { if (check(child)) hasMatch = true; });
				const isSelf = strconv(node.data.keywords).match(reFilter) && !(filterText == 'かき' && node.data.keywords.includes('花き'));
				if (isSelf && !hasMatch) matchedNodes.add(node);
				return isSelf || hasMatch;
			};
			tree.nodes.forEach(root => check(root));
			tree.filter(node => matchedNodes.has(node));
			matchedNodes.forEach(node => {
				let curr = node.parent;
				while (curr) { if (curr.id) tree.openNode(curr); curr = curr.parent; }
				tree.closeNode(node);
			});
		}
		tree.update();
	}

	clearAll(silent = false) {
		if (!this.infiniteTree) return;
		while (this.checkedCrops.length > 0) {
			const item = this.checkedCrops.pop();
			const node = this.infiniteTree.getNodeById(item.id);
			if (node) {
				const parent = node.getParent();
				// 親ノードが閉じていると checkNode() がエラーになるので、先に親ノードの開閉状況を確認
				if (!parent || parent.state.open) {
					// 親ノードがトップノードまたは開いている場合は checkNode() でアンチェック　node.state.checked = false だけでは tree.update() で反映されない
					this.infiniteTree.checkNode(node, false); // エラーを気にしないなら、この結果が false なら強制アンチェックするのでも OK
				}
				// 見えていない node では chckeNode() に失敗するので、node.state.checked と checkbox を強制アンチェック
				const inputId = `crop_${this.idSuffix}_${item.id}`;
				const cb = this.infiniteTree.contentElement.querySelector(`input[id="${inputId}"]`);
				if (cb) cb.checked = false;
				node.state.checked = false;
			}
		}
		if (this.isGlobal) window.checkedCrops = [];
		this.infiniteTree.update();
		const ca = this.containerElement.querySelector('input[id^="clearAll"]');
		if (ca) { ca.checked = false; ca.disabled = true; }
		if (!silent) this.onCheckCallback(this.checkedCrops);
	}

	reset(hidden = false, keepSelection = false) {
		if (this.containerElement) {
			this.containerElement.innerHTML = '';
			if (hidden) this.containerElement.classList.add('hidden');
		}

		if (!this.infiniteTree) return;

		if (!keepSelection) {
			this.clearAll(true);
		}

		this.infiniteTree.clear();
		this.infiniteTree = null;
		if (this.isGlobal && !keepSelection) {
			currentInfinitTree = null;
			currentCropTree = null;
			window.checkedCrops = [];
		}
	}
}

let _defaultCropTreeManager = null;

async function makeCropTree(selector, sql, onCheckCallback, options = {}) {
	if (arguments.length >= 3) {
		if (!_defaultCropTreeManager || _defaultCropTreeManager.selector !== selector) {
			_defaultCropTreeManager = new CropTreeManager(selector, (checked) => {
				window.checkedCrops = checked;
				onCheckCallback(checked);
			}, true);
		}
		console.log(sql);
		await _defaultCropTreeManager.init(sql, options);
		return _defaultCropTreeManager;
	}
	return null;
}

function clearAllReset() {
	if (_defaultCropTreeManager) _defaultCropTreeManager.clearAll(true);
}

function resetCropTree(hidden = false) {
	if (_defaultCropTreeManager) _defaultCropTreeManager.reset(hidden);
}

// rowRenderer 定義
const rowRenderer = (node, treeOptions) => {
	const { id, name, loadOnDemand = false, children, state, props = {} } = node;
	const droppable = treeOptions.droppable;
	let { depth, open, path, total, selected = false, filtered, checked, indeterminate } = state;

	// checkedCrops との同期 (スクロール時のチェック外れ対策) - マネージャの checkedCrops を参照
	if (node.manager && node.manager.checkedCrops.some(c => c.id == id)) {
		checked = true;
	}

	const childrenLength = Object.keys(children).length;
	//const childrenLength = node.data.children.length;
	const more = node.hasChildren();

	if (filtered === false) return;
	let togglerContent = '<svg role="img" aria-label="⤷"><use href="icons.svg#down-right"></use></svg>';
	let togglerClass = '';

	if (!more && loadOnDemand) {
		togglerContent = '<svg role="img" aria-label="📁"><use href="icons.svg#folder-close"></use></svg>';
		togglerClass = treeOptions.togglerClass + ' infinite-tree-closed';
	} else if (more && open) {
		togglerContent = '<svg role="img" aria-label="📂"><use href="icons.svg#folder-open"></use></svg>';
		togglerClass = treeOptions.togglerClass;
	} else if (more && !open) {
		togglerContent = '<svg role="img" aria-label="📁"><use href="icons.svg#folder-close"></use></svg>';
		togglerClass = treeOptions.togglerClass + ' infinite-tree-closed';
	}

	const togglerUnselectable = node.data.toroku !== 1;
	togglerClass += togglerUnselectable ? ' unselectable' : '';
	const labelClass = togglerUnselectable ? '' : ' selectable';

	const cbDisabled = togglerUnselectable ? 'disabled ' : '';
	const cbChecked = checked ? 'checked ' : '';
	const dataChecked = checked ? 'data-checked ': '';
	const dataIndeterminate = indeterminate ? 'data-indeterminate ' : '';
	const nodeName = loadOnDemand ? '(loadOnDemand)' + name : name;
	const indent = depth * 20;
	let itemClass = 'infinite-tree-item';
	const inputId = node.manager ? `crop_${node.manager.idSuffix}_${id}` : `crop_${id}`;
	const dataTotal = total > 0 ? `data-total="${total}"` : '';
	const dataExpanded = more && open ? ' data-expanded' : '';
	itemClass += selected ? ' infinite-tree-selected' : '';
	const dataSelected = selected ? ' data-selected' : '';
	let hint = node.data.betsumei ? ` [別名:${node.data.betsumei}]` : '';
	hint = ` title="${nodeName}${hint}"`;
	const addinfo = node.data.addinfo;
	var html = [
		`<div class="${itemClass}" data-id="${id}" data-depth="${depth}" data-path="${path}" data-children="${childrenLength}"${dataTotal}${dataExpanded}${dataSelected}>`,
			`<div class="infinite-tree-node" style="margin-left: ${indent}px"${hint}>`,
				`<a class="${togglerClass}">${togglerContent}</a>`,
				`<input type="checkbox" class="checkbox" id="${inputId}" data-node-id="${id}" ${dataChecked}${dataIndeterminate}${cbChecked}${cbDisabled} autocomplete="off" />`,
				`<label for="${inputId}" class="infinite-tree-title${labelClass}">${nodeName}</label>${addinfo}`,
			'</div>',
		'</div>',
		''
	].join('\r\n');
	return html;
};

// カラム名用に半角()[]を全角（）［］に変換する関数
function normalizeColName(name) {
	const toFullWidthMap = { '(': '（', ')': '）', '[': '［', ']': '］' };
	return name.replace(/[()[\]]/g, (char) => toFullWidthMap[char]);
}

// 作物名 csv を sakuhojo 用作物名正規表現に変換
function csvToRegexp(csv) {
	// 半角括弧を全角に一括置換
	csv = normalizeColName(csv);

	// 先頭が栽培条件付き作物名の場合、上位作物群にも栽培条件を追加
	let items = csv.split(',');
	const f = items[0];
	if (f.includes('栽培）')) {
		let a = f.replace(/^.+?（/, '(（') + ')?';
		let c = f.replace(/（.+$/, '');
		items = items.map((item, i) => (i > 0 && item !== c) ? item + a : item);
	}
	csv = items.join(',');
	// 正規表現用に全角括弧をエスケープ
	const escapeMap = { '（': '\\(', '）': '\\)', '［': '\\[', '］': '\\]' };
	csv = csv.replace(/[（）［］]/g, (char) => escapeMap[char]);

	csv = csv.replaceAll(',', '|');
	return `、(${csv})、`;
}

let cropConditions = [];

// 単純作物名を上位下位展開して sakhojo 用検索条件に変換
function expandCrops(crop) {
	const sql = `
		select gn_concat(',', sakumotsu) from (select xidsaku, sakumotsu, toroku from m_sakumotsu order by xidsaku desc) where toroku = 1 and xidsaku regexp (
		select n_concat('|',xidsaku,substr(xidsaku,1,10)||'0000',substr(xidsaku,1,6)||'00000000',substr(xidsaku,1,4)||'0000000000',substr(xidsaku,1,2)||'000000000000',
		if(gunmei is not null,(select xidsaku from m_sakumotsu where sakumotsu = a.gunmei))) from m_sakumotsu as a where sakumotsu = '${crop}');
	`;
	const result = db.exec(sql);
	const crops = csvToRegexp(result[0].values[0][0]);
	return `('、'||n_concat('、', sakumotsu, shozoku)||'、' regexp '${crops}' and nozoku not regexp '${crops}' or fukumu regexp '${crops}')`;
}

// 単純作物名配列を in 用検索条件に変換
function makeCropCondition(crops) {
	if (crops.length === 0) {
		return null; // No crops selected, return null
	}
	cropConditions = crops.map(crop => expandCrops(crop));
	return `select sakumotsu from m_sakumotsu left join sakuhojo using(idsaku) where ${cropConditions.join(' or ')}`;
}

let excludeCondition = '';
let excluderChanged = false;
// セレクタごとの設定を保持するキャッシュ
const _cropTreeConfigs = new Map();

// excluder 用標準作物ツリー設定
async function setupCropTree(containerSelector = '#cropTree', callback = (typeof searchCrop === 'function' ? searchCrop : null), options = {}) {
	// 引数が空の場合、キャッシュから前回の設定を復元する
	if (Object.keys(options).length === 0 && _cropTreeConfigs.has(containerSelector)) {
		const config = _cropTreeConfigs.get(containerSelector);
		callback = config.callback;
		options = config.options;
	} else {
		// 新しい設定を保存
		_cropTreeConfigs.set(containerSelector, { callback, options });
	}

	const exclude = excludeCondition.replace(/^and/, 'where');
	//let sql = exclude ? `with tSakumotsu as (select distinct sakumotsu, 1 as exist from t_tekiyo ${exclude})` : '';
	let sql = `with tSakumotsu as (select distinct sakumotsu, 1 as exist from t_tekiyo ${exclude})`;
	sql += `
		select idsaku, class, toroku * ifnull(exist, 0) as toroku, sakumotsu, shukakubui, betsumei,
		':'||replace(n_concat('、', strconv(sakumotsu, 'k'), strconv(betsumei, 'k'), ruby), '、', ':')||':' as keywords
		from m_sakumotsu left join tSakumotsu using(sakumotsu) where sakumotsu not like '%除く%';
	`;
	excluderChanged = false;
	const manager = await makeCropTree(containerSelector, sql, callback, options);
	return manager;
}

// 検索除外薬剤セレクタ設置
function makeExcludeSelector(containerSelector = '#excluder', callback = (typeof searchCrop === 'function' ? searchCrop : null), treeSelector = '#cropTree') {
	const defaultIndex = parseInt(localStorage.getItem('excludeIndex')) || 1;
	const options = [
		{ value: "", text: 'なし' },
		{ value: "and n_concat('、', hoho, basho) not regexp \'倉庫|貯蔵|気密|天幕|サイロ'", text: '貯蔵時燻蒸剤' },
		{ value: "and (shurui <> '展着剤' and n_concat('、', hoho, basho) not regexp '倉庫|貯蔵|気密|天幕|サイロ')", text: '貯蔵時燻蒸剤・展着剤' }
	];
	excludeCondition = options[defaultIndex].value;
	const excludeContainer = document.querySelector(containerSelector);
	if (!excludeContainer) return;
	excludeContainer.classList.add('selector');
	excludeContainer.innerHTML = '';
	const h3 = document.createElement('h3');
	h3.textContent = '検索除外薬剤';
	excludeContainer.appendChild(h3);
	const excludeSelect = document.createElement('select');
	options.forEach((option, index) => {
		const optionElement = document.createElement('option');
		optionElement.value = option.value;
		optionElement.text = option.text;
		if (index === defaultIndex) {
			optionElement.selected = true;
		}
		excludeSelect.appendChild(optionElement);
	});
	excludeContainer.appendChild(excludeSelect);

	// イベントハンドラ設定
	excludeSelect.onchange = async () => {
		excludeCondition = excludeSelect.value;
		excluderChanged = true;
		localStorage.setItem('excludeIndex', excludeSelect.selectedIndex);
		
		if (window.checkedCrops && window.checkedCrops.length > 0) {
			// 既に作物が選択されている場合は検索結果のみ更新（ツリーのちらつき防止）
			if (typeof callback === 'function') {
				callback(window.checkedCrops);
			}
		} else {
			// 作物が選択されていない場合は、次の選択のためにツリーの有効/無効状態を更新
			await setupCropTree(treeSelector);
		}
	}
}
