/* カラム名マッピング */
// カラム名マッピング用のグローバル変数
let columnMappings = {
	// デフォルトのマッピング定義
	"bango": "登録番号",
	"meisho": "農薬名称",
	"yoto": "用途",
	"zaikei": "剤型",
	"torokubi": "登録日",
	"kigen": "登録有効期限",
	"koka": "効果",
	"sakumotsu": "作物名",
	"byochu": "病害虫雑草名",
	"mokuteki": "使用目的",
	"shurui": "農薬の種類",
	"tsusho": "農薬通称",
	"jiki": "使用時期",
	"baisu": "希釈倍数/使用量", //2025.10.06 修正
	"ekiryo": "使用液量",
	"hoho": "使用方法",
	"basho": "適用場所",
	"jikan": "使用時間",
	"ondo": "温度",
	"dojo": "土壌",
	"chitai": "適用地帯",
	"tekiyaku": "適用薬剤",
	"kongo": "混合数",
	"kaisu": "使用回数",
	"seibun1": "成分1",
	"seibun2": "成分2",
	"seibun3": "成分3",
	"seibun4": "成分4",
	"seibun5": "成分5",
	"keito1": "系統1",
	"keito2": "系統2",
	"keito3": "系統3",
	"keito4": "系統4",
	"keito5": "系統5",
	"kaisu1": "回数1",
	"kaisu2": "回数2",
	"kaisu3": "回数3",
	"kaisu4": "回数4",
	"kaisu5": "回数5",
	"mid1": "RAC1",
	"mid2": "RAC2",
	"mid3": "RAC3",
	"mid4": "RAC4",
	"mid5": "RAC5",
	// ここから
	"yuko1" : "有効成分1",
	"yuko2" : "有効成分2",
	"yuko3" : "有効成分3",
	"yuko4" : "有効成分4",
	"yuko5" : "有効成分5",
	"rem1": "RAC備考1",
	"rem2": "RAC備考2",
	"rem3": "RAC備考3",
	"rem4": "RAC備考4",
	"rem5": "RAC備考5",
	"risk1": "FRAC耐性リスク1",
	"risk2": "FRAC耐性リスク2",
	"risk3": "FRAC耐性リスク3",
	"risk4": "FRAC耐性リスク4",
	"risk5": "FRAC耐性リスク5",
	// ここまで 2025.10.10 追加
	"ippanmei": "一般名",
	"seibun": "有効成分",
	"iso": "ISO物質名",
	"keito": "系統名",
	"mid": "RACコード",
	"rackeito": "RAC系統名",
	"sayoten": "作用点",
	"sayokiko": "作用機構",
	"fgroup": "RAC備考",
	"risk": "耐性リスク",
	"shoryaku": "成分(省略型)",
	"kanryaku": "成分(簡略型)",
	"seizaidokusei": "製剤毒性",
	"seizaiyoto": "製剤用途",
	"seizaikoka": "製剤効果",
	"seizaiojas": "製剤有機JAS",
	"nodo": "濃度",
	"seibunEikyo": "水産影響評価",
	"dokusei": "毒性",
	"ojas": "有機JAS",
	"hatsutoroku": "初登録日",
	"jogai": "毒劇除外",
	"biko": "備考",
	"ryakusho": "申請者名",
	"toroku": "登録有無",
	"chuijiko": "農薬使用時、容器洗浄液、空容器等に係る注意事項",
	"shukakubui": "収穫部位",
	"betsumei": "別名",
	"ruby": "よみがな",
	"kamei": "科名",
	"gunmei": "群横断作物名",
	"shozoku": "所属作物群名",
	"nozoku": "除外作物名",
	"fukumu": "包含作物名",

	// 必要に応じて追加のマッピングをここに定義
};

// カラム名を日本語に変換する関数
function translateColumnName(originalName) {
	// マッピングが存在する場合はそれを返す、なければ元のカラム名をそのまま返す
	originalName = originalName.replace(/^int_/i, '');
	return columnMappings[originalName] || originalName;
}

// 非オーバーレイスクロールバーの太さ取得
function getScrollbarWidth() {
	// 一時的な要素を作成
	const outer = document.createElement('div');
	// スクロールバーを表示させるためのスタイル設定
	outer.style.visibility = 'hidden'; // ユーザーに見えないように
	outer.style.overflow = 'scroll'; // スクロールバーを表示させる
	outer.style.width = '100px'; // 任意の固定幅を設定
	outer.style.height = '100px'; // 任意の固定高さを設定
	outer.style.position = 'absolute'; // レイアウトへの影響を最小限に

	// DOMに追加
	document.body.appendChild(outer);

	// outerの全幅 (offsetWidth) からコンテンツ領域の幅 (clientWidth) を引く
	// この差がスクロールバーの幅となる
	const scrollbarWidth = outer.offsetWidth - outer.clientWidth;

	// 要素を削除
	document.body.removeChild(outer);

	return scrollbarWidth > 2 ? scrollbarWidth : 0;
}

/**
 * sql-wasmの検索結果から、全行がNULLの列を検出し、そのヘッダーと値を削除します。
 * * sql-wasmの結果形式: [{ columns: string[], values: Array<Array<any>> }]
 * * @param {Array<{columns: string[], values: Array<Array<any>>}>} sqlResults 検索結果の配列
 * @returns {Array<{columns: string[], values: Array<Array<any>>}>} クリーンアップされた検索結果
 */
function cleanSqlResult(result) {
	if (result.length === 0) return [];

	const originalColumns = result.columns;
	const originalValues = result.values;

	if (!originalColumns || originalColumns.length === 0) {
		return result; // 列がない場合はそのまま返す
	}

	const numColumns = originalColumns.length;
	const numRows = originalValues.length;

	// 1. 各列が全てNULLかどうかを判定するための配列を初期化
	// initiallyAssumeNulls[i]がtrueなら、その列は今のところ全てNULLと見なす
	const initiallyAssumeNulls = new Array(numColumns).fill(true);

	// 2. 全行を走査し、NULLではない値があればその列のフラグをfalseにする
	for (let i = 0; i < numRows; i++) {
		for (let j = 0; j < numColumns; j++) {
			// 値が null または undefined または空文字列でない場合 (0 は NULLではない)
			if (originalValues[i][j] !== null && originalValues[i][j] !== undefined && originalValues[i][j] !== '') {
				initiallyAssumeNulls[j] = false;
			}
		}
	}

	// 3. 保持する列のインデックス、新しいヘッダー、新しい値の配列を作成
	const indicesToKeep = [];
	const newColumns = [];
	
	// 保持する列のインデックスと新しいヘッダーを決定
	for (let j = 0; j < numColumns; j++) {
		if (!initiallyAssumeNulls[j]) {
			indicesToKeep.push(j);
			newColumns.push(originalColumns[j]);
		}
	}

	// 4. 値の配列（行）をフィルタリング
	const newValues = originalValues.map(row => {
		return indicesToKeep.map(index => row[index]);
	});
	
	// 5. クリーンアップされた結果を返却
	return {
		columns: newColumns,
		values: newValues
	};
}

/* Handsontable による結果テーブル表示 */
function outputTable(selector, result, option = {}) {
	const { caption = '', query = '', searchTime = false,  hidePaginationU20 = true, hideFooterU20 = true } = option || {};

	var nores = false;
	if (!result.length) {
		if (!query.match(/^select/i)) return null;
		nores = true;
		result = [{
			columns: ['result', 'query'],
			values: [['結果なし', query]],
		}];
	}

	//let resultContainer = document.getElementById("result");
	if (!selector) selector = '#result';
	let resultContainer = document.querySelector(selector);
	if (resultContainer === null) {
		alert('指定されたセレクタが見つかりません。');
		return;
	}

	// テーブルラッパーを作成
	let tableWrapper = document.createElement("div");
	tableWrapper.className = "table-wrapper";
	resultContainer.appendChild(tableWrapper);

	// テーブルヘッダ作成
	let tableHeader = document.createElement("div");
	tableHeader.classList.add('table_header');
	tableHeader.style.display = 'none';
	if (caption !== '') {
		let tableCaption = document.createElement("h4");
		tableCaption.innerHTML = caption;
		tableHeader.appendChild(tableCaption);
		tableHeader.style.display = 'block';
	}
	tableWrapper.appendChild(tableHeader);

	const rowsTableWindow = localStorage.getItem('rowsTableWindow') || '20';
	let currentRowsWindow = parseInt(rowsTableWindow, 10);
	const defPaginHeight = 41 + 2; // ページネーションの高さ
	const rowHeight = 24; // 1行の高さ
	const headerHeight = 24; // ヘッダーの高さ
	const defTableHeight = rowHeight * currentRowsWindow + headerHeight + defPaginHeight; // rowsTableWindow 行分の高さとページネーションの合計
	const scrollbarWidth = getScrollbarWidth(); // スクロールバーの太さ取得


	// Table 用のコンテナを作成
	let tableContainer = document.createElement("div");
	//tableContainer.id = `table-container-${index}`;
	tableContainer.classList.add('table_container');
	tableContainer.style.height = defTableHeight;
	tableContainer.style.width = 'auto';
	tableWrapper.appendChild(tableContainer);

	// Footer 用のコンテナを作成
	const footer = document.createElement('div');
	footer.classList.add('table_footer');

	// フィルター一括解除ボタン
	const filterClear = document.createElement('span');
	const filterSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
	filterSvg.classList.add('icon');
	const filterTitle = document.createElementNS('http://www.w3.org/2000/svg', 'title');
	filterTitle.textContent = 'フィルター一括解除';
	filterSvg.appendChild(filterTitle);
	const filterUse = document.createElementNS('http://www.w3.org/2000/svg', 'use');
	filterUse.setAttributeNS('http://www.w3.org/1999/xlink', 'href', 'icons.svg#filter-x');
	filterSvg.appendChild(filterUse);
	filterClear.appendChild(filterSvg);
	footer.appendChild(filterClear);

	// 非表示列一括再表示ボタン
	const showAllColumnsButton = document.createElement('span');
	const showAllColumnsSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
	showAllColumnsSvg.classList.add('icon');
	const showAllColumnsTitle = document.createElementNS('http://www.w3.org/2000/svg', 'title');
	showAllColumnsTitle.textContent = '非表示列一括再表示';
	showAllColumnsSvg.appendChild(showAllColumnsTitle);
	const showAllColumnsUse = document.createElementNS('http://www.w3.org/2000/svg', 'use');
	showAllColumnsUse.setAttributeNS('http://www.w3.org/1999/xlink', 'href', 'icons.svg#table-export');
	showAllColumnsSvg.appendChild(showAllColumnsUse);
	showAllColumnsButton.appendChild(showAllColumnsSvg);
	footer.appendChild(showAllColumnsButton);

	// セパレーター
	const separator = document.createElement('span');
	separator.classList.add('separator');
	separator.textContent = '|';
	footer.appendChild(separator);

	// エクスポートボタン
	const buttons = [
		{ name: 'copy', src: 'icons.svg#clipboard-copy', title: 'クリップボードにコピー' },
		{ name: 'csv', src: 'icons.svg#file-csv', title: 'CSV 形式で保存' },
		{ name: 'xls', src: 'icons.svg#file-xls', title: 'Excel 形式で保存' },
		{ name: 'html', src: 'icons.svg#printer', title: '印刷プレビューを開く'}
	];
	const footerExport = document.createElement('span');
	var exportButtons =[];
	buttons.forEach(button => {
		const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
		svg.classList.add('icon');

		const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
		title.textContent = button.title;
		svg.appendChild(title);

		const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
		use.setAttributeNS('http://www.w3.org/1999/xlink', 'href', button.src);
		svg.appendChild(use);

		footerExport.appendChild(svg);
		exportButtons[button.name] = svg;
	});
	footer.appendChild(footerExport);

	// 表示枠の行数選択
	const rowsOption = [
		{ value: '15', text: '表示枠:15行' },
		{ value: '20', text: '表示枠:20行', selected: true },
		{ value: '25', text: '表示枠:25行' },
		{ value: '30', text: '表示枠:30行' },
		{ value: '35', text: '表示枠:35行' },
		{ value: '40', text: '表示枠:40行' },
	];
	const footerWinSize = document.createElement('span');
	const rowsSelect = document.createElement('select');
	rowsOption.forEach(optionData => {
		const option = document.createElement('option');
		option.value = optionData.value;
		option.textContent = optionData.text;
		if (optionData.disabled) option.disabled = true; //disabledプロパティがあれば設定
		if (optionData.selected) option.selected = true; //selectedプロパティがあれば設定
		rowsSelect.appendChild(option);
	});
	rowsSelect.value = rowsTableWindow; // 初期値を rowsTableWindow に設定
	footerWinSize.appendChild(rowsSelect);
	footer.appendChild(footerWinSize);

	// その他テキスト
	const footerText = document.createElement('span');
	footerText.classList.add('footer_text');
	footer.appendChild(footerText);

	tableWrapper.appendChild(footer);

 	let madeTime = -performance.now();
	const defPageSize = 1000;

	var tableData = cleanSqlResult(result[0]);
	
	// 列定義を作成（データマッピング用＆ヘッダーアラインメント）
	const columns = tableData.columns.map(col => {
		const columnDefinition = {
			data: col,
			headerClassName: 'htLeft'
		};
		// 'int_' で始まるカラムには 'type: 'numeric'' を追加
		if (col.startsWith('int_')) {
			columnDefinition.type = 'numeric';
		}
		return columnDefinition;
	});

	// カラム名の日本語変換
	const columnNames = tableData.columns.map(translateColumnName);

	// 行データを取得
	const data = tableData.values.map(row => 
		columns.reduce((obj, col, i) => {
			obj[col.data] = row[i];
			return obj;
		}, {})
	);

	// ドロップダウンメニュー項目の定義
	const dropdownMenuItems = [
		'filter_by_condition',
		'filter_by_condition2',
		'filter_operators',
		'filter_by_value',
		'filter_action_bar',
	];

	// コンテキストメニュー項目の定義
	const contextMenuItems = {
		items: {
			'filter_by_cell_value': {
				name: 'このセルの値で絞り込み',
				hidden: function () {
					// 複数セル選択時は非表示
					if (!this.getSelectedRange() || this.getSelectedRange().length > 1) {
						return true;
					}
					const sel = this.getSelectedRange()[0];
					return sel.from.row !== sel.to.row || sel.from.col !== sel.to.col;
				},
				callback: function (key, selection, event) {
					const sel = selection[0];
					const row = sel.start.row;
					const col = sel.start.col;

					const value = this.getDataAtCell(row, col);
					if (value === null || value === undefined || value === '') {
						return;
					}

					const filtersPlugin = this.getPlugin('filters');
					const visualColIndex = col;

					// いったんこの列の条件をクリアしてから「等しい」で再設定
					filtersPlugin.removeConditions(visualColIndex);
					filtersPlugin.addCondition(visualColIndex, 'eq', [value]);
					filtersPlugin.filter(); // フィルタ実行

					// 既存の後処理と同じことをしておくとレイアウトが崩れにくい
					hideEmptyColumns(this);
					resetContainerWidth(this);
					updatePagination(this);
					updateContainerRect(this);
					updateRowsSelect(this);
					updatePageSize(this);
				}
			},
			'search_in_yakuzai_tab': {
				name: '薬剤タブで検索',
				hidden: function() {
					// 選択範囲がない、または複数セルが選択されている場合は非表示
					if (!this.getSelectedRange() || this.getSelectedRange().length > 1) {
						return true;
					}
					const selected = this.getSelectedRange()[0];
					const col = selected.from.col;
					const colName = this.getSettings().columns[col].data;
					const allowedColumns = [
						'bango', 'meisho', 'tsusho', 'ryakusho', 'shurui', 'ippanmei', 'seibun',
						'iso', 'keito', 'mid', 'rackeito', 'sayoten', 'sayokiko', 'fgroup',
						'seibun1', 'seibun2', 'seibun3', 'seibun4', 'seibun5',
						'keito1', 'keito2', 'keito3', 'keito4', 'keito5', 'mid1', 'mid2', 'mid3', 'mid4', 'mid5',
						'yuko1', 'yuko2', 'yuko3', 'yuko4', 'yuko5', 'rem1', 'rem2', 'rem3', 'rem4', 'rem5'
					];
					return !allowedColumns.includes(colName);
				},
				callback: function(key, selection, event) {
					const sel = selection[0];
					const row = sel.start.row;
					const col = sel.start.col;
					const cellValue = this.getDataAtCell(row, col);
					if (cellValue) {
						const url = `chem.html?keyword=${encodeURIComponent(cellValue)}`;
						window.open(url, '_blank');
					}
				}
			},
			'search_in_google': {
				name: 'Google で検索',
				hidden: function() {
					// 選択範囲がない、または複数セルが選択されている場合は非表示
					if (!this.getSelectedRange() || this.getSelectedRange().length > 1) {
						return true;
					}
					const selected = this.getSelectedRange()[0];
					const col = selected.from.col;
					const colName = this.getSettings().columns[col].data;
					const allowedColumns = [
						'sakumotsu','byochu','mokuteki','meisho', 'tsusho', 'ryakusho', 'shurui', 'ippanmei', 'seibun',
						'iso', 'keito', 'mid', 'rackeito', 'sayoten', 'sayokiko', 'fgroup',
						'seibun1', 'seibun2', 'seibun3', 'seibun4', 'seibun5',
						'keito1', 'keito2', 'keito3', 'keito4', 'keito5', 'mid1', 'mid2', 'mid3', 'mid4', 'mid5',
						'yuko1', 'yuko2', 'yuko3', 'yuko4', 'yuko5', 'rem1', 'rem2', 'rem3', 'rem4', 'rem5'
					];
					return !allowedColumns.includes(colName);
				},
				callback: function(key, selection, event) {
					const sel = selection[0];
					const row = sel.start.row;
					const col = sel.start.col;
					let cellValue = this.getDataAtCell(row, col);

					if (cellValue) {
						const colName = this.getSettings().columns[col].data;
						
						// 特定のカラムが選択された時に、別のカラムの値を追加するマッピング
						const contextMap = {
							'byochu': 'sakumotsu'
							// 他のルールもここに追加できます
							// 'column_A': 'column_B'
						};

						if (contextMap[colName]) {
							const contextColName = contextMap[colName];
							const columns = this.getSettings().columns;
							const contextColIndex = columns.findIndex(c => c.data === contextColName);

							if (contextColIndex > -1) {
								const contextValue = this.getDataAtCell(row, contextColIndex);
								if (contextValue) {
									cellValue = `${contextValue} ${cellValue}`;
								}
							}
						}

						const url = `https://google.com/search?q=${encodeURIComponent(cellValue)}`;
						window.open(url, '_blank');
					}
				}
			},
						'show_row_data': {
				name: '行データを表示',
				callback: function(key, selection, event) {
					const sel = selection[0];
					const row = sel.start.row;
					const physicalRow = this.toPhysicalRow(row);
					const rowData = this.getSourceDataAtRow(physicalRow);
					const columns = this.getSettings().columns;
					const headers = this.getColHeader();
					showRowDataDialog(rowData, columns, headers);
				}
			},
			'---------': { name: '---------' },
			'copy': {},
			'---------2': { name: '---------' },
			'freeze_column': {},
			'unfreeze_column': {},
			'---------3': { name: '---------' },
			'hidden_columns_hide': {},
			'hidden_columns_show': {},
		}
	};

	// テーマ設定
	const theme = 'ht-theme-classic' + (getCurrentTheme() === 'dark' ? '-dark' : '');
	// 最大カラム幅
	const maxColChars = parseInt(localStorage.getItem('maxColChars') || '50', 10);
	const maxColWidth = maxColChars * 13 + 13;

	let currentHideColumns = [];

	// Handsontable テーブルの初期化
	const table = new Handsontable(tableContainer, {
		themeName: theme,
		colHeaders: columnNames,
		data: data,
		columns: columns,
		language: 'ja-JP', // 日本語を指定
		readOnly: true,
		manualColumnMove: true, // 列移動プラグインを有効化
		manualColumnResize: true, // 列幅変更を有効化
		manualColumnFreeze: true, // 列固定を有効化
		hiddenColumns: { indicators: true }, // 列非表示を有効化
		columnSorting: true, // 列ソートを有効化
		filters: true, // フィルタープラグインを有効化
		dropdownMenu: dropdownMenuItems, // 必要なドロップダウンメニュー（フィルター含む）のみ設定
		contextMenu: contextMenuItems, // 必要なコンテキストメニューのみ設定
		
		// 行データダイアログ表示（ダブルクリック）
		afterOnCellMouseDown: function(event, coords, TD) {
			if (event.detail === 2 && coords.row >= 0) {
				const physicalRow = this.toPhysicalRow(coords.row);
				const rowData = this.getSourceDataAtRow(physicalRow);
				const columns = this.getSettings().columns;
				const headers = this.getColHeader();
				showRowDataDialog(rowData, columns, headers);
			}
		},
		
		// 行データダイアログ表示（Ctrl + Enter）
		beforeKeyDown: function(event) {
			if (event.ctrlKey && event.key === 'Enter') {
				const selected = this.getSelectedLast();
				if (selected) {
					const row = selected[0];
					if (row >= 0) {
						const physicalRow = this.toPhysicalRow(row);
						const rowData = this.getSourceDataAtRow(physicalRow);
						const columns = this.getSettings().columns;
						const headers = this.getColHeader();
						showRowDataDialog(rowData, columns, headers);
						event.stopImmediatePropagation();
						event.preventDefault();
					}
				}
			}
		},
		//loading: true, // ローディングプラグインを有効化
		//stretchH: 'all', // ブラウザ幅未満のテーブルの場合全部のカラムを引き伸ばし
		autoColumnSize: { syncLimit: 1000, useHeades: true, samplingRatio: 500 },
		//autoColumnSize: { syncLimit: 1000, useHeades: false, samplingRatio: 1000, allowSampleDuplicates: true },
		autoWrapCol: false,
		autoWrapRow: false,
		width: '100%',
		height: defTableHeight,
		pagination: {
			pageSize: defPageSize,
			pageSizeList: [],
			initialPage: 1,
			showPageSize: true,
			showCounter: true,
			showNavigation: true,
			//uiContainer: footer,
		},
		modifyColWidth: function(width, col) {
			// 最大列幅を設定(1カラムテーブルなら 100%、テーブル全幅がラッパー幅以下なら最大列幅非設定)
			//const wtHiderWidth = parseFloat(tableContainer.querySelector('.wtHider').style.width); // wtHider.style.width が一定しない
			const wrapperWidth = tableWrapper.getBoundingClientRect().width;
			return this.countCols() === 1 ? wrapperWidth : maxColChars === 0 ? width : width > maxColWidth ? maxColWidth : width;
		},
		afterInit: function() {
			updatePagination(this);
			//console.log(`showPagination: ${showPagination}`);
			updateContainerRect(this);
			updateRowsSelect(this);
			updatePageSize(this);
			updateFooter(this);
		},
		afterFilter: function() {
			hideEmptyColumns(this);
			resetContainerWidth(this);
			updatePagination(this);
			updateContainerRect(this);
			updateRowsSelect(this);
			updatePageSize(this);
		},
		afterPageSizeChange: function() {
			updatePageSize(this);
		},
		afterHideColumns: function(currentHideConfig, destinationHideConfig, actionPossible, stateChanged) {
			if (stateChanged) {
				currentHideColumns = destinationHideConfig;
				resetContainerWidth(this);
				updateContainerRect(this);
				//this.render();
			}
		},
		afterDropdownMenuShow: function(dropdownMenu) {
			const tableContainer = this.rootElement.closest('.table_container');
			if (tableContainer) {
				// コンテナの高さとビューポート高のいずれか小さい方を上限とする
				const maxMenuHeight = Math.min(tableContainer.clientHeight, window.innerHeight);
				const menuContainer = dropdownMenu.menu.container;
				
				if (menuContainer) {
					// 1. 一旦スタイルをリセットして、中身に応じた自然な高さを取得できるようにする
					menuContainer.style.height = '';
					const multipleSelect = menuContainer.querySelector('.htUIMultipleSelectHot');
					if (multipleSelect) {
						multipleSelect.style.height = '';
						multipleSelect.style.maxHeight = '';
					}

					// 2. 枠（リスト以外）の高さを計算
					const renderedMenuHeight = menuContainer.offsetHeight;

					if (multipleSelect) {
						const renderedListHeight = multipleSelect.offsetHeight;
						const frameHeight = renderedMenuHeight - renderedListHeight;

						// 3. リストの本来の高さを取得 (scrollHeight)
						const listContentHeight = multipleSelect.querySelector('.wtHider')?.scrollHeight || multipleSelect.scrollHeight;
						
						// 4. CSSから min-height, max-height を取得
						const style = window.getComputedStyle(multipleSelect);
						const minListHeight = parseFloat(style.minHeight) || 0;
						const maxListHeight = style.maxHeight === 'none' ? Number.MAX_SAFE_INTEGER : parseFloat(style.maxHeight);

						// 5. リストの高さの目標値を決定
						let targetListHeight = listContentHeight;

						// CSS の max-height で制限
						if (targetListHeight > maxListHeight) targetListHeight = maxListHeight;

						// コンテナの高さによる制限
						const availableListHeight = maxMenuHeight - frameHeight;
						if (targetListHeight > availableListHeight) targetListHeight = availableListHeight;

						// CSS の min-height で制限 (最優先)
						if (targetListHeight < minListHeight) targetListHeight = minListHeight;

						// 6. メニュー全体の高さを計算
						const targetMenuHeight = frameHeight + targetListHeight;

						// 7. 高さを固定値で設定
						multipleSelect.style.setProperty('height', targetListHeight + 'px', 'important');
						menuContainer.style.setProperty('height', targetMenuHeight + 'px', 'important');

					} else {
						// リストがない場合（ソートメニューなど）
						if (renderedMenuHeight > maxMenuHeight) {
							menuContainer.style.setProperty('height', maxMenuHeight + 'px', 'important');
						} else {
							// 影の表示崩れを防ぐため、現在の高さを固定値として設定
							menuContainer.style.setProperty('height', renderedMenuHeight + 'px', 'important');
						}
					}
				}
				// === 縦位置調整：メニューが画面下端を越える場合は上へずらす ===
				requestAnimationFrame(() => {
					const menuHeight = menuContainer.offsetHeight;
					if (menuHeight > 0) {
						const menuRect = menuContainer.getBoundingClientRect();
						const viewportH = window.innerHeight;
						const overflowBottom = menuRect.bottom - viewportH;
						if (overflowBottom > 0) {
							const currentTop = parseFloat(menuContainer.style.top) || menuRect.top;
							const newTop = currentTop - overflowBottom;
							const clampedTop = Math.max(newTop, 0);
							menuContainer.style.setProperty('top', clampedTop + 'px', 'important');
						}
					}
				});
			}
		},
		licenseKey: 'non-commercial-and-evaluation',
	});

	function hideEmptyColumns(hot) {
		const hiddenColumnsPlugin = hot.getPlugin('hiddenColumns');
		const numCols = hot.countCols(); // 全カラム数
		const numRows = hot.countRows(); // フィルター後の表示行数

		for (let col = 0; col < numCols; col++) {
			let hasData = false;
			for (let row = 0; row < numRows; row++) {
				const cellValue = hot.getDataAtCell(row, col); // フィルター後の表示データ
				if (cellValue !== null && cellValue !== undefined && cellValue !== '') {
					hasData = true;
					break;
				}
			}
			if (!hasData) {
				hiddenColumnsPlugin.hideColumn(col); // 空カラムを非表示
			} else {
				hiddenColumnsPlugin.showColumn(col); // データがある場合は表示
			}
		}
		hot.render(); // テーブルを再描画
	}

	function showAllColumns() {
		if (currentHideColumns.length === 0) return;
		const hiddenColumnsPlugin = table.getPlugin('hiddenColumns');
		hiddenColumnsPlugin.showColumns(currentHideColumns); // 全非表示カラムを再表示
		resetContainerWidth(table);
		updateContainerRect(table);
		table.render();
	}

	function updatePagination(hot) {
		const rows = hot.countSourceRows();
		const showPagination = rows > 20 || !hidePaginationU20;
		//console.log(`showPagination: ${showPagination}`);
		if (!showPagination) {
			hot.updateSettings({ pagination: false });
		} else {
			let pageSizeList = [rows];
			if (rows > 10000) pageSizeList.unshift(10000);
			if (rows > 5000) pageSizeList.unshift(5000);
			if (rows > defPageSize) pageSizeList.unshift(defPageSize);
			hot.updateSettings({
				pagination: {
					pageSize: defPageSize,
					pageSizeList: pageSizeList,
					initialPage: 1,
					showPageSize: true,
					showCounter: true,
					showNavigation: true,
					//uiContainer: footer,
				}
			});
		}
		//return showPagination;
	}

	function updatePageSize(hot) {
		if (hot.getSettings().pagination === false) return;
		const rows = hot.countRows();
		const pageSizeSel = tableContainer.querySelector('select[name="pageSize"]');
		const pageSize = parseInt(pageSizeSel.value, 10);
		//console.log(pageSize);
		if (rows > pageSize) {
			pageSizeSel.classList.add('pageSizeOver');
		} else {
			pageSizeSel.classList.remove('pageSizeOver');
		}
	}

	// Filter 時にテーブルコンテナの幅をリセット
	function resetContainerWidth(hot) {
		const htGrid = tableContainer.querySelector('.ht-grid');
		const gridWidth = htGrid.getBoundingClientRect().width;
		hot.updateSettings({ width: gridWidth });
	}

	// テーブルの横幅がビューポートより小さい場合、垂直スクロールバーをテーブルの右端に寄せる
	// 結果が 20 行未満の場合、pagination をテーブル直下に寄せる
	function updateContainerRect(hot) {
		const pagination = hot.getSettings().pagination !== false;
		const paginationHeight = pagination ? defPaginHeight : 0;
		const wtHolder = tableContainer.querySelector('.wtHolder').style;
		const wtHider = tableContainer.querySelector('.wtHider').style;
		const wtHolderWidth = parseFloat(wtHolder.width);
		const wtHolderHeight = parseFloat(wtHolder.height);
		const wtHiderWidth = parseFloat(wtHider.width);
		const wtHiderHeight = parseFloat(wtHider.height);
		let rows = hot.countRows();
		rows = rows < currentRowsWindow ? rows : currentRowsWindow;
		const logicalHeight = rows * rowHeight + headerHeight;;
		const tableWidth = (wtHiderWidth < wtHolderWidth) ? wtHiderWidth : wtHolderWidth;
		const tableHeight = (wtHiderHeight < wtHolderHeight) ? wtHiderHeight : (wtHolderHeight > logicalHeight) ? wtHolderHeight : logicalHeight;

		const sbarWidth = pagination ? scrollbarWidth : 0; // スクロールバーの太さを設定(オーバーレイスクロールバーの場合は 0)
		if (tableWidth < wtHolderWidth) { // ビューポートより幅が狭いテーブルは、テーブル右わきにスクロールバーが出るようテーブル幅を設定
			hot.updateSettings({ width: tableWidth + sbarWidth }); // 非オーバーレイスクロールバーの場合は、スクロールバーの幅をテーブル幅に加算
		}
		const sbarHeight = wtHiderWidth > wtHolderWidth ? scrollbarWidth : 0; //水平スクロールバーが出る場合は、スクロールバーの太さを設定(オーバーレイスクロールバーの場合は 0)
		hot.updateSettings({ height: tableHeight + paginationHeight + sbarHeight}); // ページネーション、水平スクロールバーの高さをテーブル高に加算
	}

	function updateFooter(hot) {
		if (hideFooterU20 && hot.countRows() <= 20) footer.style.display = 'none'; // 一応、フッタなしでも書き換えるべきところは書き換える
		madeTime += performance.now();
		if (nores) {
			if (searchTime !== false) footerText.innerHTML = `<span class="no-border">検索:${(searchTime / 1000).toFixed(6)}秒</span>`;
		} else {
			if (searchTime !== false) footerText.innerHTML = `<span>検索:${(searchTime / 1000).toFixed(6)}秒</span><span>表示:${(madeTime / 1000).toFixed(6)}秒</span>`
			if (query !== '') footerText.innerHTML += `<span class="no-border">${query}</span>`;
		}
	}

	// rowsSelect 及びその option 無効化
	function updateRowsSelect(hot) {
		const pagination = hot.getSettings().pagination;
		if (pagination === false) { // ページネーションが無効なら表示枠選択も無効
			rowsSelect.style.display = 'none';
			return;
		}

		const countRows = hot.countRows(); // フィルター後行数

		// 20　行以下は select そのものを無効化
		rowsSelect.disabled = countRows <= 20;

		/* currentRows にあわせて option を個別に disabled */
		const options = rowsSelect.options;
		let newSelectedIndex = -1;
		let currentSelectedValue = rowsSelect.value;
		//console.log(currentSelectedValue);
		let maxEnabledValue = -1;
	
		for (let i = 0; i < options.length; i++) {
			const option = options[i];
			const optionValue = parseInt(option.value, 10);
	
			// オプションの値が現在の行数より大きい場合は無効化
			option.disabled = optionValue > countRows;
	
			// 有効なオプションの中で最大の値を追跡
			if (!option.disabled) {
				maxEnabledValue = Math.max(maxEnabledValue, optionValue);
			}
	
			// 現在選択されている値が有効な値かをチェック
			if (optionValue === parseInt(currentSelectedValue, 10)) {
				newSelectedIndex = i;
			}
		}
	
		/* selected の行数が currentRows より大きい場合は、内輪の最大値を selected */
		let valueChanged = false;
		if (parseInt(currentSelectedValue, 10) > countRows) {
			if (maxEnabledValue !== -1) {
				rowsSelect.value = maxEnabledValue;
				valueChanged = true;
			}
		} else {
			rowsSelect.selectedIndex = newSelectedIndex;
		}

		// change イベントを手動で発火
		if (valueChanged) {
			const event = new Event('change');
			rowsSelect.dispatchEvent(event);
		}
	}

	// rowsSelect 変更処理
	rowsSelect.addEventListener('change', function(event) {
		const rows = parseInt(event.target.value, 10); // 選択された値を取得
		currentRowsWindow = rows;
		const height = rows * rowHeight + headerHeight + defPaginHeight; // 行数に基づいて高さを計算
		table.updateSettings({ height: height });
		updateContainerRect(table);
		//tableContainer.style.height = height;
	});

	// caption に YYYYMMDD-hhmmss にフォーマットした現在時刻を付加したファイル名を作成
	function makeFileName() {
		const caption = (option.caption || 'export') + '_';
		const now = new Date();
		const formattedDate = now.toLocaleString('ja-JP', {
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
			hour12: false
		});
		return caption + formattedDate.replace(/[\/:]/g, '').replace(' ', '-');
	}

	function dispStatus(msg, autoClose = 0) {
		return new Promise(resolve => {
			// ブラウザに制御を返すために setTimeout を使用
			// 描画を保証するために requestAnimationFrame を使用
			requestAnimationFrame(() => {
				footerText.innerHTML = msg;
				requestAnimationFrame(() => {
					if (autoClose) {
						setTimeout(() => {
							footerText.innerHTML = '';
							resolve();
						}, autoClose);
					} else {
						resolve();
					}
				});
			});
		});
	}


	function isEmpty() {
		const result = table.countRows() === 0;
		if (result) dispStatus('エクスポートするデータがありません。', 3000);
		return result;
	}

	// 可視（非表示でない）列のヘッダー、データ、幅を取得する関数
	function getVisibleData() {
		const hcp = table.getPlugin('hiddenColumns');
		const colCount = table.countCols();
		const visibleIndices = [];
		for (let i = 0; i < colCount; i++) {
			if (!hcp.isHidden(table.toPhysicalColumn(i))) {
				visibleIndices.push(i);
			}
		}
		return {
			headers: visibleIndices.map(i => table.getColHeader(i)),
			data: table.getData().map(row => visibleIndices.map(i => row[i])),
			widths: visibleIndices.map(i => table.getColWidth(i))
		};
	}

	// CSV/TSV 変換関数
	function convertCsv(format, title, headers, data) {
		const delimiter = format === 'tsv' ? '\t' : ',';
		const bom = format === 'csv' ? '\uFEFF' : ''; // BOM は CSV のみ

		// タイトルを追加
		let result = bom + `${title}\r\n`;

		// ヘッダー行を生成
		result += headers.map(h => String(h)).join(delimiter) + '\r\n';

		// データ行を生成
		data.forEach(row => {
			const rowData = row.map(cell => {
				let str = String(cell === null || cell === undefined ? '' : cell);
				// 区切り文字(,)、ダブルクォート(")、または改行が含まれる場合はセルをダブルクォートで囲む
				if (str.includes(delimiter) || str.includes('"') || str.includes('\n')) {
					// セル内のダブルクォートは2つ重ねてエスケープ
					str = '"' + str.replace(/"/g, '""') + '"';
				}
				return str;
			}).join(delimiter);
			result += rowData + '\r\n';
		});
		return result.replaceAll('null', '');
	}

	// 2025.10.10 追加
	function makeCaption() {
		let caption = option.caption || '';
		return caption === '' ? lastUpdate : `${caption} (${lastUpdate})`;
	}

	filterClear.addEventListener('click', () => {
		const filtersPlugin = table.getPlugin('filters');
		filtersPlugin.clearConditions();
		filtersPlugin.filter();
		//showAllColumns();
		resetContainerWidth(table);
		table.render();
		updateContainerRect(table);
		updateRowsSelect(table);
		updatePageSize(table);
	});

	showAllColumnsButton.addEventListener('click', () => {
		showAllColumns(table);
	});

	exportButtons['copy'].addEventListener('click', async () => {
		if (isEmpty()) return;
	
		try {
			await dispStatus('データを準備中');
			const { headers, data } = getVisibleData();
			const tsvData = convertCsv('tsv', makeCaption(), headers, data); // TSV 形式で生成 // 2025.10.10 修正

			await dispStatus('クリップボードにコピー中');
			await navigator.clipboard.writeText(tsvData);

			await dispStatus(`表示中の ${table.countRows()} 件のデータをクリップボードにコピーしました`, 3000);
		} catch (err) {
			console.error('クリップボードへのコピーに失敗しました', err);
			await dispStatus(`クリップボードへのコピーに失敗しました: ${err}`, 3000);
		}
	});

	exportButtons['csv'].addEventListener('click', async () => {
		if (isEmpty()) return;

		try {
			await dispStatus('データを準備中');
			const { headers, data } = getVisibleData();
			const csvData = convertCsv('csv', makeCaption(), headers, data); // BOM 付き CSV 形式で生成 // 2025.10.10 修正

			await dispStatus('CSV ファイル生成中');
			const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8' });
			saveAs(blob, `${makeFileName()}.csv`);

			await dispStatus(`表示中の ${table.countRows()} 件のデータを CSV ファイルとして保存しました`, 3000);
		} catch (err) {
			console.error('CSV ファイルの保存に失敗しました', err);
			await dispStatus(`CSV ファイルの保存に失敗しました: ${err}`, 3000);
		}
	});

	exportButtons['xls'].addEventListener('click', async () => {
		if (isEmpty()) return;

		try {
			await dispStatus('データを準備中。大きな表では時間がかかります。');

			// ExcelJS で Workbook 作成
			const workbook = new ExcelJS.Workbook();
			const worksheet = workbook.addWorksheet('Sheet1');

			const { headers, data, widths } = getVisibleData();
			
			// ヘッダー行を追加
			worksheet.addRow(headers);
		
			// データ行を追加
			data.forEach(row => worksheet.addRow(row));

			// 列幅を設定（ピクセルを Excel の文字数単位に変換）
			worksheet.columns = headers.map((header, index) => ({
				header,
				key: `col${index}`,
				width: (widths[index] > 0 ? widths[index] : 100) / 7, // ピクセルを文字数に変換（近似値）
			}));

			// タイトル行追加
			worksheet.spliceRows(1, 0, [ makeCaption()]); // 2025.10.10 修正

			// すべてのセルにフォントスタイルを適用する
			const fontExcel = localStorage.getItem('fontExcel') || '游ゴシック';
//			if (fontExcel !== 'Segoe UI') {
				worksheet.eachRow({ includeEmpty: true }, function(row, rowNumber) {
					row.eachCell({ includeEmpty: true }, function(cell, colNumber) {
						cell.font = { name: fontExcel, size: 10 };
					});
				});
//			}

			// Excel ファイルを生成してダウンロード
			await dispStatus('Excel ファイル生成中');
			workbook.xlsx.writeBuffer().then(buffer => {
				const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
				saveAs(blob, `${makeFileName()}.xlsx`);
			});
			await dispStatus(`表示中の ${table.countRows()} 件のデータを Excel ファイルとして保存しました。`, 3000);
		} catch(err) {
			console.error('Excel ファイルの保存に失敗しました', err);
			await dispStatus(`Excel ファイルの保存に失敗しました: ${err}`, 3000);
		}
	});

	exportButtons['html'].addEventListener('click', async () => {
		if (isEmpty()) return;

		try {
			await dispStatus('HTML ファイルを準備中...');

			const theme = getCurrentTheme(); // 'light' or 'dark'
			const title = `${new Date().toLocaleString()}`;
			const caption = makeCaption();
			const { headers, data, widths } = getVisibleData();

			// テーブル全体の幅を計算
			const tableWidth = widths.reduce((sum, width) => sum + width, 0);

			let colgroup = '';
			widths.forEach(width => {
				colgroup += `<col style="width: ${width}px;">`;
			});

			let thead = '<tr>';
			headers.forEach((header) => {
				thead += `<th>${header}</th>`;
			});
			thead += '</tr>';

			let tbody = '';
			data.forEach((row, index) => {
				const rowClass = index % 2 === 0 ? 'ht__row_odd' : 'ht__row_even';
				tbody += `<tr class="${rowClass}">`;
				row.forEach((cell, i) => {
					tbody += `<td>${cell === null || cell === undefined ? '' : cell}</td>`;
				});
				tbody += '</tr>\n';
			});

			// プレビュー用のデータをsessionStorageに保存
			const previewData = {
				theme: theme,
				title: title,
				caption: caption,
				colgroup: colgroup,
				thead: thead,
				tbody: tbody,
				table_width: tableWidth
			};
			const previewId = `preview_${Date.now()}`;
			sessionStorage.setItem(previewId, JSON.stringify(previewData));

			await dispStatus('HTML ファイルを生成中...');
			// preview.html 開発中はキャッシュを回避するためにタイムスタンプをクエリパラメータに追加
			//const url = `preview.html?cachebust=${Date.now()}#${previewId}`;
			const url = `./previews/autosize.html#${previewId}`;
			window.open(url, '_blank');

			await dispStatus(`表示中の ${table.countRows()} 件のデータを新しいタブで開きました。`, 3000);
		} catch (err) {
			console.error('HTML ファイルの保存に失敗しました', err);
			await dispStatus(`HTML ファイルの保存に失敗しました: ${err}`, 3000);
		}
	});

	tabExecuted = !nores;
	return table;
}

function resetTables(tables, selector = '#result') {
	const isArray = Array.isArray(tables);
	if (!isArray) tables = [tables];
	tables.forEach(table => {
		if (table !== null && typeof table.destroy === 'function') {
			table.destroy();
		}
	});
	const resultDiv = document.querySelector(selector);
	resultDiv.innerHTML = ""; // クリア
	tabExecuted = false;
	return isArray ? [] : null;
}

// 行データダイアログ表示関数
function showRowDataDialog(rowData, columns, headers) {
	// 既存のダイアログがあれば削除
	const existingDialog = document.getElementById('row-data-dialog');
	if (existingDialog) {
		existingDialog.remove();
	}

	const dialog = document.createElement('dialog');
	dialog.id = 'row-data-dialog';
	dialog.style.outline = 'none'; // 初回表示時の外郭線を消す
	let isMouseDownOnBackdrop = false;
	let startRect = null;
	let posStyle = '';
	// ローカルストレージに保存された位置・サイズを復元 デフォルト CSS の max-width, max-height は vw, vh 指定なのでサイズ計算は不要
	const savedPos = localStorage.getItem('rowDataDialogPosition');
	if (savedPos) {
		//console.log(savedPos);
		try {
			const pos = JSON.parse(savedPos);
			if (pos.left) posStyle += `left: ${pos.left};`;
			if (pos.top) posStyle += `top: ${pos.top};`;
			if (pos.width) posStyle += `width: ${pos.width};`;
			if (pos.height) posStyle += `height: ${pos.height};`;
			if (posStyle) dialog.style.cssText = posStyle;
		} catch (e) {
			// JSON パースエラー時はデフォルト CSS を使用
		}
	}
	const container = document.createElement('div');
	container.className = 'row-data-container';

	const headerDiv = document.createElement('div');
	headerDiv.className = 'row-data-header';
	headerDiv.innerHTML = '<span>詳細データ</span>';

	const closeBtn = document.createElement('span');
	closeBtn.className = 'row-data-close';
	closeBtn.textContent = '×';
	closeBtn.onclick = () => dialog.close();
	headerDiv.appendChild(closeBtn);

	headerDiv.addEventListener('mousedown', (e) => {
		if (e.target === closeBtn) return;
		e.preventDefault();
		const rect = dialog.getBoundingClientRect();
		const shiftX = e.clientX - rect.left;
		const shiftY = e.clientY - rect.top;

		dialog.style.margin = '0';
		dialog.style.left = rect.left + 'px';
		dialog.style.top = rect.top + 'px';

		const onMouseMove = (e) => {
			dialog.style.left = (e.clientX - shiftX) + 'px';
			dialog.style.top = (e.clientY - shiftY) + 'px';
		};

		const onMouseUp = () => {
			document.removeEventListener('mousemove', onMouseMove);
			document.removeEventListener('mouseup', onMouseUp);
		};

		document.addEventListener('mousemove', onMouseMove);
		document.addEventListener('mouseup', onMouseUp);
	});

	const contentDiv = document.createElement('div');
	contentDiv.className = 'row-data-content';

	const tableEl = document.createElement('table');
	tableEl.className = 'row-data-table';

	columns.forEach((col, index) => {
		const key = col.data;
		const label = headers[index];
		const value = rowData[key];

		if (value === null || value === '') return;

		const tr = document.createElement('tr');

		const th = document.createElement('th');
		th.textContent = label;

		const td = document.createElement('td');
		td.textContent = value !== null && value !== undefined ? value : '';

		tr.appendChild(th);
		tr.appendChild(td);
		tableEl.appendChild(tr);
	});

	contentDiv.appendChild(tableEl);
	container.appendChild(headerDiv);
	container.appendChild(contentDiv);
	dialog.appendChild(container);

	document.body.appendChild(dialog);

	dialog.addEventListener('mousedown', () => {
		startRect = dialog.getBoundingClientRect();
	});

	const onDocumentMouseUp = () => {
		if (!startRect) return;
		if (!document.body.contains(dialog)) {
			startRect = null;
			return;
		}
		const rect = dialog.getBoundingClientRect();
		if (rect.left !== startRect.left || rect.top !== startRect.top ||
			rect.width !== startRect.width || rect.height !== startRect.height) {
			localStorage.setItem('rowDataDialogPosition', JSON.stringify({
				left: rect.left + 'px',
				top: rect.top + 'px',
				width: rect.width + 'px',
				height: rect.height + 'px'
			}));
		}
		startRect = null;
	};

	document.addEventListener('mouseup', onDocumentMouseUp);
	dialog.addEventListener('close', () => {
		document.removeEventListener('mouseup', onDocumentMouseUp);
		dialog.remove();
	});

	dialog.addEventListener('mousedown', (event) => {
		if (event.target === dialog) {
			const rect = dialog.getBoundingClientRect();
			const isInDialog = (rect.top <= event.clientY && event.clientY <= rect.top + rect.height &&
				rect.left <= event.clientX && event.clientX <= rect.left + rect.width);
			isMouseDownOnBackdrop = !isInDialog;
		} else {
			isMouseDownOnBackdrop = false;
		}
	});

	dialog.addEventListener('click', (event) => {
		if (event.target === dialog) {
			if (!isMouseDownOnBackdrop) return;
			const rect = dialog.getBoundingClientRect();
			const isInDialog = (rect.top <= event.clientY && event.clientY <= rect.top + rect.height &&
				rect.left <= event.clientX && event.clientX <= rect.left + rect.width);
			if (!isInDialog) {
				dialog.close();
			}
		}
	});

	dialog.showModal();
}