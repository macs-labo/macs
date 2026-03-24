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

// フィルタリング関数
function applyFilter(tree, filterInput) {
	const filterText = romajiConv(filterInput.value).toHiragana().replaceAll('：', ':');
	//filterInput.value = filterText;
	const includeAncestors = false; // 必要に応じて設定
	const matchedNodes = new Set(); // 新しいフィルタリングごとにリセット

	if (!filterText) {
			// すべてのオープン中のノードを強制的に閉じる（逆順処理）
			const openNodes = tree.getOpenNodes();
			//console.log(openNodes);
			const nodesToClose = [...openNodes].sort((a, b) => b.id.localeCompare(a.id)); // node.id の逆順ソート
			nodesToClose.forEach(node => {
				if (node.parent !== null) { // ルートでない場合にクローズ
					node.state.open = false;
					tree.closeNode(node);
					tree.update(); // 各クローズ後に更新
					//console.log(`Force closed node: ${node.name}, open state: ${node.state.open}`);
				}
			});
			tree.unfilter();
			tree.update(); // 最終的な再描画
			//console.log('Filter cleared and nodes closed');
	} else {
		// 子孫がマッチしたかどうかを再帰的に判定するヘルパー関数
		// 戻り値: true (子孫がマッチした), false (子孫はマッチしなかった)
		const checkNodeAndDescendants = (node) => {
			// 1. まず子孫ノードを再帰的にすべてチェックする
			let hasMatchingDescendant = false;
			if (node.hasChildren()) {
				// some() は途中で止まるため使わない。map() や forEach() で全子ノードを探索する。
				node.getChildren().forEach(child => {
					if (checkNodeAndDescendants(child)) {
						hasMatchingDescendant = true; // 子孫にマッチがあったことを記録
					}
				});
			}

			// 2. 自身がマッチするかどうかを判定
			const data = node.data;
			const isSelfMatch = data.keywords.includes(filterText) && !(filterText == 'かき' && data.keywords.includes('花き'));

			// 3. 子孫がマッチしておらず、かつ自身がマッチする場合のみ、このノードを最終的なマッチ対象とする
			if (isSelfMatch && !hasMatchingDescendant) {
				matchedNodes.add(node);
			}

			// 4. 自身または子孫のいずれかがマッチした場合に true を返し、親ノードに伝える
			return isSelfMatch || hasMatchingDescendant;
		};

		// ツリーのルートノードから再帰チェックを開始
		tree.nodes.forEach(rootNode => checkNodeAndDescendants(rootNode));

		// フィルタリング処理
		tree.filter((node) => {
			// matchedNodes に含まれているノードのみ表示
			return matchedNodes.has(node);
		});
	}
	// includeAncestors が true の場合、親ノードを処理
	if (includeAncestors) {
		matchedNodes.forEach(node => {
			let parent = node.parent;
			while (parent) {
				matchedNodes.add(parent);
				tree.openNode(parent);
				//console.log(`Opened parent node: ${parent.name}`);
				parent = parent.parent;
			}
		});
	}

	// マッチしたノードの親ノード（class 0 ノードを含む）を展開
	const parentNodes = new Set();
	matchedNodes.forEach(node => {
		let current = node.parent;
		while (current) {
			if (current.id) parentNodes.add(current);
			current = current.parent;
		}
	});

	//console.log('Matched Nodes:', matchedNodes);

	// マッチノードの親ノードを開く
	parentNodes.forEach(node => {
		tree.openNode(node);
		//console.log(`Opened parent node: ${node.name}`);
	});
	// 親ノードを開くとマッチノードの子ノードが全開になるので、マッチノードは閉じる
	matchedNodes.forEach(node => {
		tree.closeNode(node);
	});

	// ツリーの再描画
	tree.update();
	//console.log('Tree updated after filtering');
}

// グローバル配列変数
let checkedCrops = [];
// 現在作成されているツリー参照（イベント解除のために保持）
let currentInfinitTree = null;
// 現在の作物ツリーを保持（リセット時に使用）
let currentCropTree = null;

// change イベントリスナー設定(チェックボックスのみ)
function setupClickListner(tree, onCheckCallback) {
	if (!tree || !tree.contentElement) return;

	// 既存のハンドラが登録されている場合は先に解除して重複登録を防ぐ
	if (tree._changeListener) {
		try { tree.contentElement.removeEventListener('change', tree._changeListener); } catch (e) {}
		delete tree._changeListener;
	}

	const handler = (event) => {
		const target = event.target;

		// チェックボックスがクリックされた場合のみ処理
		if (target && target.matches && target.matches('.checkbox')) {
			const nodeId = target.parentNode && target.parentNode.parentNode ? target.parentNode.parentNode.getAttribute('data-id') : null;
			if (!nodeId) return;
			const node = tree.getNodeById(nodeId);
			if (!node) return;
			const state = node.state;
			state.checked = !state.checked; // クリックされたノードのみチェックを反転
			//tree.checkNode(node); // これを使うと、親ノードのチェックまで反転されるので使わない
			
			// checkedCrops の更新
			if (state.checked === true) {
				// チェックがONの場合、node.id と node.data.sakumotsu を追加
				checkedCrops.push({ id: node.id, sakumotsu: node.data.sakumotsu });
			} else {
				// チェックがOFFの場合、該当する id のエントリを削除
				checkedCrops = checkedCrops.filter(item => item.id !== node.id);
			}

			tree.update();

			// 全解除チェックボックス表示設定
			const clearAll = document.querySelector('#clearAll');
			if (clearAll) {
				clearAll.checked = checkedCrops.length > 0;
				clearAll.disabled = !clearAll.checked;
			}

			// DOM更新後にsearchCropを呼び出す
			setTimeout(() => { onCheckCallback(); }, 0);

			// 他のデフォルトのツリー操作（ノード選択など）を防ぐ
			event.stopPropagation();
		}
	};

	tree._changeListener = handler;
	tree.contentElement.addEventListener('change', handler);
}

// 子ノードがダミーノードのノードをトグル時に子ノードを再帰的に開くイベントリスナー
function setupToggleListener(tree) {
	if (!tree || typeof tree.on !== 'function') return;

	// 既存のハンドラを解除できるように、登録前に old handler を削除
	if (tree._openNodeHandler && typeof tree.off === 'function') {
		try { tree.off('openNode', tree._openNodeHandler); } catch (e) {}
		delete tree._openNodeHandler;
	}
	if (tree._closeNodeHandler && typeof tree.off === 'function') {
		try { tree.off('closeNode', tree._closeNodeHandler); } catch (e) {}
		delete tree._closeNodeHandler;
	}

	const restoreChecks = () => {
		if (typeof checkedCrops !== 'undefined') {
			checkedCrops.forEach(c => {
				const cb = tree.contentElement.querySelector(`input[id="${c.id}"]`);
				if (cb) {
					cb.checked = true;
					cb.setAttribute('data-checked', '');
				}
			});
		}
	};

	const openHandler = (node) => {
		if (node.state.depth > 0 && node.hasChildren() && node.children[0].data.isDummy) {
			function openChildrenRecursively(n) {
				if (n.hasChildren()) {
					n.children.forEach(child => {
						if (!child.state.open) {
							child.state.open = true;
							tree.openNode(child);
							openChildrenRecursively(child);
						}
					});
				}
			}
			openChildrenRecursively(node);

			// チェック状態の同期
			if (typeof checkedCrops !== 'undefined') {
				tree.nodes.forEach(n => {
					const isChecked = checkedCrops.some(c => c.id == n.id);
					if (n.state.checked !== isChecked) n.state.checked = isChecked;
				});
			}

			tree.update();
		}
		restoreChecks();
	};

	const closeHandler = (node) => {
		restoreChecks();
	};

	tree._openNodeHandler = openHandler;
	tree._closeNodeHandler = closeHandler;
	tree.on('openNode', openHandler);
	tree.on('closeNode', closeHandler);

	const scrollHandler = () => {
		restoreChecks();
	};
	tree.scrollElement.addEventListener('scroll', scrollHandler);
	tree._scrollHandler = scrollHandler;
}

// チェック全解除
function clearAllCheckedNodes(tree, silent = false) {
	while (checkedCrops.length > 0) {
		const item = checkedCrops.pop();
		const node = tree.getNodeById(item.id);
		if (node) {
			tree.checkNode(node, false); // node.state.checked = false は tree.update() で反映されないので checkNode() 使用
			// シングルノードチェックでそのノードがツリーボックス内に見えている場合、tree.update() でなぜかチェックが消えなくなったので、見えている可能性のあるチェックボックスは強制アンチェック
			const checkbox = tree.contentElement.querySelector(`input[type="checkbox"][id="${node.id}"]`); // フィルタ外はノードは null が返るので、存在チェック不可避
			if (checkbox) checkbox.checked = false;
		}
	}
	tree.update(); // フィルター外ノードを含めて一気に画面反映させる
	const clearAll = document.querySelector('#clearAll');
	if (clearAll) {
		clearAll.checked = false;
		clearAll.disabled = true;
	}
	if (!silent && typeof tree.onCheckCallback === 'function') {
		tree.onCheckCallback();
	}
}

// rowRenderer 定義
const rowRenderer = (node, treeOptions) => {
	const { id, name, loadOnDemand = false, children, state, props = {} } = node;
	const droppable = treeOptions.droppable;
	let { depth, open, path, total, selected = false, filtered, checked, indeterminate } = state;

	// checkedCrops との同期 (スクロール時のチェック外れ対策)
	if (typeof checkedCrops !== 'undefined' && checkedCrops.some(c => c.id == id)) {
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
				`<input type="checkbox" class="checkbox" id="${id}" ${dataChecked}${dataIndeterminate}${cbChecked}${cbDisabled} autocomplete="off" />`,
				`<label for="${id}" class="infinite-tree-title${labelClass}">${nodeName}</label>${addinfo}`,
			'</div>',
		'</div>',
		''
	].join('\r\n');
	return html;
};

// 作物ツリーの生成とイベントハンドラ設定
function makeCropTree(selector, sql, onCheckCallback) {
	const cropTree = document.querySelector(selector);
	if (currentInfinitTree) resetCropTree();
	cropTree.innerHTML = `
		<h3>作物名選択</h3>
		<form id="filterForm" class="inputbar" onsubmit="return false;">
			<input type="text" id="filterInput" name="filterInput" placeholder="絞込作物名(空白で解除)" title="指定例： [なす]部分一致 [:なす]前方一致 [なす:]後方一致 [:なす:]完全一致" autocomplete="on" />
			<button type="button" id="filterButton">絞込</button>
		</form>
		<div class="treebox">
			<div"><input type="checkbox" id="clearAll" autocomplete="off" disabled /><label for="clearAll">全解除</label></div>
			<div id="tree"></div>
		</div>
	`;
	cropTree.style.display = 'block';

	try {
		const sqlResult = db.exec(sql);
		const treeData = buildCropTree(sqlResult);
		const treeContainer = document.querySelector('#tree');
		const filterForm = document.querySelector('#filterForm');
		const tree = new InfiniteTree(treeContainer, {
			//el: treeContainer,
			autoOpen: false,
			//droppable: { hoverClass: 'tree-droppable' },
			selectable: false,
			data: treeData,
			rowRenderer: rowRenderer,
			togglerClass: 'infinite-tree-toggler',
		});

		//console.log(tree);
		// コールバック関数をtreeオブジェクトに保存
		tree.onCheckCallback = onCheckCallback;
		// イベントリスナー登録
		setupToggleListener(tree);
		setupClickListner(tree, onCheckCallback);

	// フィルタトリガー登録
		const filterInput = document.querySelector('#filterInput');
		const filterButton = document.querySelector('#filterButton');

		// ドムハンドラ参照を保持するオブジェクト
		tree._domHandlers = {};

		// submitイベントはオートコンプリートの履歴保存のためにのみ使用
		const onFilterFormSubmit = (event) => { event.preventDefault(); };
		filterForm.addEventListener('submit', onFilterFormSubmit);
		tree._domHandlers.filterForm = filterForm;
		tree._domHandlers.filterFormSubmit = onFilterFormSubmit;

		// ボタンクリックで絞り込みを実行
		const onFilterButtonClick = () => { applyFilter(tree, filterInput); };
		filterButton.addEventListener('click', onFilterButtonClick);
		tree._domHandlers.filterButton = filterButton;
		tree._domHandlers.filterButtonClick = onFilterButtonClick;

		// 入力確定時（フォーカスが外れた等）に絞り込みを実行
		const onFilterInputChange = () => { applyFilter(tree, filterInput); };
		filterInput.addEventListener('change', onFilterInputChange);
		tree._domHandlers.filterInput = filterInput;
		tree._domHandlers.filterInputChange = onFilterInputChange;

		// inputイベントはオートコンプリートの邪魔をする可能性があるため、空になった時の処理に限定
		const onFilterInputInput = (event) => { if (event.target.value === '') applyFilter(tree, event.target); };
		filterInput.addEventListener('input', onFilterInputInput);
		tree._domHandlers.filterInputInput = onFilterInputInput;

		// 全解除登録
		const clearAll = document.querySelector('#clearAll');
		const onClearAllClick = () => { clearAllCheckedNodes(tree, false); }; // silent: false でコールバックを呼ぶ
		if (clearAll) {
			clearAll.addEventListener('click', onClearAllClick);
			tree._domHandlers.clearAll = clearAll;
			tree._domHandlers.clearAllClick = onClearAllClick;
		}

		// 現在作成されたツリー参照を保持（reset時に使う）
		currentInfinitTree = tree;
		currentCropTree = cropTree;
	} catch (error) {
		console.error('Initialization error:', error);
	}
}

// firefox のリロード時 checkbox 状態復元対策
function clearAllReset() {
	const clearAll = document.querySelector('#clearAll');
	if (clearAll) {
		clearAll.checked = false;
		clearAll.disabled = true;
	} else {
		console.warn('#clearAll element not found');
	}
}

// 作物ツリーリセット
function resetCropTree() {
	// 既存のツリーがあればリセット
	if (currentInfinitTree === null) return;

	// tree の checkbox を全解除
	clearAllCheckedNodes(currentInfinitTree, true); // silent: true でコールバックを抑制

	// イベントハンドラを解除して参照を破棄
	try {
		if (currentInfinitTree._changeListener && currentInfinitTree.contentElement) {
			currentInfinitTree.contentElement.removeEventListener('change', currentInfinitTree._changeListener);
			delete currentInfinitTree._changeListener;
		}
	} catch (e) {}

	// tree.on('openNode') handler
	try {
		if (currentInfinitTree._openNodeHandler && typeof currentInfinitTree.off === 'function') {
			currentInfinitTree.off('openNode', currentInfinitTree._openNodeHandler);
			delete currentInfinitTree._openNodeHandler;
		}
		if (currentInfinitTree._closeNodeHandler && typeof currentInfinitTree.off === 'function') {
			currentInfinitTree.off('closeNode', currentInfinitTree._closeNodeHandler);
			delete currentInfinitTree._closeNodeHandler;
		}
	} catch (e) {}

	// scroll event listener cleanup
	try {
		if (currentInfinitTree._scrollHandler && currentInfinitTree.scrollElement) {
			currentInfinitTree.scrollElement.removeEventListener('scroll', currentInfinitTree._scrollHandler);
			delete currentInfinitTree._scrollHandler;
		}
	} catch (e) {}

	// DOM handlers (filterForm, filterButton, filterInput, clearAll)
	try {
		const h = currentInfinitTree._domHandlers;
		if (h) {
			if (h.filterForm && h.filterFormSubmit) h.filterForm.removeEventListener('submit', h.filterFormSubmit);
			if (h.filterButton && h.filterButtonClick) h.filterButton.removeEventListener('click', h.filterButtonClick);
			if (h.filterInput && h.filterInputChange) h.filterInput.removeEventListener('change', h.filterInputChange);
			if (h.filterInput && h.filterInputInput) h.filterInput.removeEventListener('input', h.filterInputInput);
			if (h.clearAll && h.clearAllClick) h.clearAll.removeEventListener('click', h.clearAllClick);
			delete currentInfinitTree._domHandlers;
		}
	} catch (e) {}
	currentInfinitTree.clear();
	// 作物ツリー全体をクリア
	currentCropTree.innerHTML = '';
	currentCropTree.style.display = 'none';
	currentCropTree = null;
	currentInfinitTree = null;
}

// 作物名 csv を sakuhojo 用作物名正規表現に変換
function csvToRegexp(csv) {
	// 半角括弧を全角に一括置換
	const toFullWidthMap = { '(': '（', ')': '）', '[': '［', ']': '］' };
	csv = csv.replace(/[()[\]]/g, (char) => toFullWidthMap[char]);

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
	cropConditions = crops.map(crop => expandCrops(crop));
	return `select sakumotsu from m_sakumotsu left join sakuhojo using(idsaku) where ${cropConditions.join(' or ')}`;
}

let excludeCondition = '';
let exluderChanged = false;

// excluder 用標準作物ツリー設定
function setupCropTree(containerSelector = '#cropTree', callback = searchCrop) {
	const exclude = excludeCondition.replace(/^and/, 'where');
	let sql = exclude ? `with tSakumotsu as (select distinct sakumotsu, 1 as exist from t_tekiyo ${exclude})` : '';
	sql += `
		select idsaku, class, toroku * ifnull(exist, 0) as toroku, sakumotsu, shukakubui, betsumei, 
		':'||replace(n_concat('、', strconv(sakumotsu, 'k'), strconv(betsumei, 'k'), ruby), '、', ':')||':' as keywords
		from m_sakumotsu left join tSakumotsu using(sakumotsu) where sakumotsu not like '%除く%';
	`;
	makeCropTree(containerSelector, sql, callback);
	excluderChanged = false;
}

// 検索除外薬剤セレクタ設置
function makeExcludeSelector(containerSelector = '#excluder', callback = searchCrop) {
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
	excludeSelect.onchange = () => {
		excludeCondition = excludeSelect.value;
		excluderChanged = true;
		if (tables) {
			callback(); // 検索関数を実行
		} else {
			setupCropTree(); // 作物ツリーを再構築
		}
	}
}
