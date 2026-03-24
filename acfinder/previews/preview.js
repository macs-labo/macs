const debug = !window.location.href.includes('/acfinder/');

// プレビュー形式選択メニュー
const defaltOption = sessionStorage.getItem('previewTemplateFile') || '-- プレビュー形式を選択 --';
sessionStorage.removeItem('previewTemplateFile');
const previews = [
	{ file: '', name: defaltOption, disabled: true},
	{ file: 'autosize.html',	name: '列幅自動調整プレビュー(全列を用紙幅内に格納して印刷)' },
	{ file: 'resizable.html', name: '列幅調整可能プレビュー(先頭列から用紙幅に入る範囲のみ印刷)' }
];
if (debug) previews.push({ file: 'local', name: 'ローカルファイル読込' });

let selectedPreview = '';

function setPreviewOptions() {
	// window の url からファイル名を取得
	const filename = window.location.pathname.split('/').pop();
	let selectedValue = '';
	// select optin 設定
	const select = document.getElementById('previewSelect');
	previews.forEach((preview) => {
		const option = document.createElement('option');
		option.value = preview.file;
		option.textContent = preview.name;
		option.disabled = preview.disabled || false;
		select.appendChild(option);
		if (preview.file === filename) selectedPreview = preview.file;
	});
	select.value = selectedPreview;
}

// 自分自身に tableData を設定
function setTableData() {

	// tableData を sessionStorage から取得
	let tableData = {};
	const previewId = window.location.hash.substring(1);
	if (previewId) {
		const dataString = sessionStorage.getItem(previewId);
		if (dataString) {
			tableData = JSON.parse(dataString);
		}
	}

	// html に data-theme を設定
	document.documentElement.setAttribute('data-theme', tableData.theme || 'light');

	// title を設定
	document.title += tableData.title;

	// caption を設定
	const caption = tableData.caption || '';
	document.getElementById('caption-text').value = caption;
	document.querySelector('#preview h1').textContent = caption;

	// colgroup を設定
	const calgroup = document.querySelector('#preview table colgroup');
	if (calgroup) {
		calgroup.innerHTML = tableData.colgroup || '';
		const table = document.querySelector('#preview table');
		if (table) {
			table.setAttribute('style', `width: ${tableData.table_width}px;`);
		}
	}

	// thead を設定
	const thead = document.querySelector('#preview table thead');
	if (thead) {
		thead.innerHTML = tableData.thead || '';
	}

	// tbody を設定
	const tbody = document.querySelector('#preview table tbody');
	if (tbody) {
		tbody.innerHTML = tableData.tbody || '';
	}
}

function handleCaptionChanged(newCaption) {
	const previewCaption = document.querySelector('#preview h1');
	previewCaption.textContent = newCaption;
}

function handleZoomChanged(value) {
	const previewContent = document.getElementById('previewContent');
	const zoomValueSpan = document.getElementById('zoom-value');
	// transform: scale() の代わりに zoom を使用してレイアウト崩れを防ぐ
	previewContent.style.zoom = value;
	zoomValueSpan.textContent = `${Math.round(value * 100)}%`;

	// スライダーの背景色更新用
	const slider = document.getElementById('zoom-slider');
	const percent = (slider.value - slider.min) / (slider.max - slider.min) * 100;
	slider.style.setProperty('--value-percent', `${percent}%`);
}

// Global variable to store the cleanup function for resizable table
let cleanupResizableTable = null;

// テーブルの列幅をマウスドラッグで調整可能にする
function initializeResizableTable() {
	const table = document.querySelector('#preview table');
	if (!table) return;

	// colgroup が存在し、かつ子要素（col）が1つ以上ある場合のみ初期化する
	const colgroup = table.querySelector('colgroup');
	if (!colgroup || colgroup.children.length === 0) { // If no resizable table, ensure cleanup function is null
		if (cleanupResizableTable) {
			cleanupResizableTable();
			cleanupResizableTable = null;
		}
		return;
	}

	let targetCol = null;
	let startX = 0;
	let startWidth = 0;
	let startTableWidth = 0;
	let animationFrameId = null; // requestAnimationFrameのIDを保持

	// カーソル位置をチェックして形状を変更する関数
	const checkCursorPosition = (e) => {
		const cell = e.target.closest('th, td');
		if (cell) {
			const rect = cell.getBoundingClientRect();
			const zoom = parseFloat(document.getElementById('previewContent').style.zoom) || 1;
			const clientX = e.clientX / zoom;
			const isResizable = (rect.right / zoom - clientX < 5);
			cell.style.cursor = isResizable ? 'col-resize' : '';
			return isResizable;
		}
		return false;
	};

	const handleMouseMoveCheckCursor = (e) => {
		cancelAnimationFrame(animationFrameId); // 既存のフレームをキャンセル
		animationFrameId = requestAnimationFrame(() => checkCursorPosition(e));
	};

	const handleMouseDown = (e) => {
		const cell = e.target.closest('th, td');
		// カーソルがリサイズ形状の時のみドラッグを開始
		if (cell && getComputedStyle(cell).cursor === 'col-resize') {
			e.preventDefault();
			const colIndex = cell.cellIndex + 1;
			targetCol = table.querySelector(`colgroup > col:nth-child(${colIndex})`);
			if (!targetCol) return; // targetCol が null の場合は処理を中断

			const zoom = parseFloat(document.getElementById('previewContent').style.zoom) || 1;
			startX = e.clientX / zoom;
			startWidth = targetCol.offsetWidth;
			startTableWidth = parseFloat(getComputedStyle(table).width);

			document.addEventListener('mousemove', mouseMoveHandler);
			document.addEventListener('mouseup', mouseUpHandler);
		}
	};

	const mouseMoveHandler = (e) => {
		if (!targetCol) return;
		const zoom = parseFloat(document.getElementById('previewContent').style.zoom) || 1;
		const dx = (e.clientX / zoom) - startX;
		const newWidth = startWidth + dx;
		if (newWidth > 20) { // 最小幅を20pxに制限
			targetCol.style.width = `${newWidth}px`;
			table.style.width = `${startTableWidth + (newWidth - startWidth)}px`;
		}
	};

	const mouseUpHandler = () => {
		document.removeEventListener('mousemove', mouseMoveHandler);
		document.removeEventListener('mouseup', mouseUpHandler);
		targetCol = null;
		cancelAnimationFrame(animationFrameId);
		animationFrameId = null;
	};

	// Add event listeners
	table.addEventListener('mousemove', handleMouseMoveCheckCursor);
	table.addEventListener('mousedown', handleMouseDown);

	// Store the cleanup function
	cleanupResizableTable = () => {
		table.removeEventListener('mousemove', handleMouseMoveCheckCursor);
		table.removeEventListener('mousedown', handleMouseDown);
		document.removeEventListener('mousemove', mouseMoveHandler); // In case it's still active
		document.removeEventListener('mouseup', mouseUpHandler);	 // In case it's still active
		console.log('Resizable table event listeners cleaned up.');
	};
}

// ローカルファイル読み込み処理
async function loadHtmlFromFile(event) {
	const file = event.target.files[0];
	if (!file) return;

	try {
		const templateHtml = await file.text();
		console.log(templateHtml);
		sessionStorage.setItem('previewTemplateHtml', templateHtml);
		sessionStorage.setItem('previewTemplateFile', 'ローカルファイル: ' + file.name);
		const previewId = window.location.hash.substring(1);
		// タイムスタンプを付加して、同じファイルでも再読み込みを強制する
		window.open(`preview.html?t=${Date.now()}#${previewId}`, '_self');
	} catch (e) {
		console.error('ファイルの読み込み中にエラーが発生しました:', e);
	}
}

// ファイル選択時の処理
async function handlePreviewSelection(event) {
	const selectedValue = event.target.value;
	if (!selectedValue) return;
 
	if (selectedValue === 'local') {
		const fileInput = document.getElementById('fileInput');
		// windowに一度だけ実行されるフォーカスイベントリスナーを追加
		const onFocus = () => {
			// リスナーをすぐに削除
			window.removeEventListener('focus', onFocus);

			// changeイベントが発火しなかった（キャンセルされた）場合を検知
			setTimeout(() => {
				if (fileInput.files.length === 0) {
					document.getElementById('previewSelect').value = selectedPreview;
				}
			}, 200); // 念のため少し時間を確保
		};
		window.addEventListener('focus', onFocus, { once: true });

		// ファイル選択ダイアログを開く
		fileInput.click();
		return;
	}
	
	// この window を #previewId を保持したまま選択した url で開き直す
	const previewId = window.location.hash.substring(1);
	window.open(`${selectedValue}#${previewId}`, '_self');

}

window.addEventListener('DOMContentLoaded', () => {
	// テンプレートがsessionStorageに保存されていれば、それでbodyを書き換える
	let execInitResizeTable = false;
	const templateHtml = sessionStorage.getItem('previewTemplateHtml');
	if (templateHtml) {
		sessionStorage.removeItem('previewTemplateHtml');
		const parser = new DOMParser();
		const newDoc = parser.parseFromString(templateHtml, 'text/html');
		document.title = newDoc.title;
		document.body.innerHTML = newDoc.body.innerHTML;
		// templateHtml に initializeResizableTable(); があれば、execInitResizeTable フラグセット
		execInitResizeTable = templateHtml.includes('initializeResizableTable();');
	}

	// previewSelector の option 設定
	setPreviewOptions();
	// テーブルデータの設定
	setTableData();

	// 初期表示時にスライダーの値を適用
	const initialZoom = document.getElementById('zoom-slider').value;
	handleZoomChanged(initialZoom);
	const previewSelect = document.getElementById('previewSelect');
	if (previewSelect) previewSelect.addEventListener('change', handlePreviewSelection);

	// イベントハンドラをまとめて設定
	const fileInput = document.getElementById('fileInput');
	if (fileInput) fileInput.addEventListener('change', loadHtmlFromFile);

	const captionText = document.getElementById('caption-text');
	if (captionText) captionText.addEventListener('change', (event) => {
		handleCaptionChanged(event.target.value);
	});

	const zoomSlider = document.getElementById('zoom-slider');
	if (zoomSlider) zoomSlider.addEventListener('input', (event) => {
		handleZoomChanged(event.target.value);
	});

	// template が initializeResizableTable() を呼び出す場合はここで代行
	if (execInitResizeTable) initializeResizableTable();

});
