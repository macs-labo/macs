// ファイルツリーのノード描画
const rowRenderer = (node, treeOptions) => {
	const { id, name, children, state } = node;
	const { depth, open, filtered } = state;
	const isFile = node.data.isFile;
	const path = node.data.path;
	const fileClass = isFile ? ' fileNode' : ' folderNode';
	const more = node.hasChildren();

	if (filtered === false) return;

	let iconId, ariaLabel;
	if (isFile) {
		if (path.endsWith('.var')) {
			iconId = 'file-code';
		} else {
			iconId = 'file-text';
		}
		ariaLabel = '📄';
	} else {
		iconId = open ? 'folder-open' : 'folder-close';
		ariaLabel = open ? '📂' : '📁';
	}
	const togglerContent = `<svg class="icon" role="img" aria-label="${ariaLabel}"><use href="icons.svg#${iconId}"></use></svg>`;
	let togglerClass = more ? treeOptions.togglerClass : '';
	if (more && !open) togglerClass += ' infinite-tree-closed';

	const indent = depth * 20;
	const itemClass = 'infinite-tree-item';

	return [
		`<div class="${itemClass}" data-id="${id}">`,
			`<div class="infinite-tree-node" style="margin-left: ${indent}px">`,
				`<a class="${togglerClass}">${togglerContent}`,
				`<span class="infinite-tree-title${fileClass}" title="${name}">${name}</span></a>`,
			'</div>',
		'</div>'
	].join('');
};

function applyFilter(tree, filerInput) {
	const filterText = filerInput.value.trim().toLowerCase();
	const matchedNodes = new Set();

	if (!filterText) {
		// フィルタが空の場合、すべてのオープン中のノードを閉じる
		const openNodes = tree.getOpenNodes();
		const nodesToClose = [...openNodes].sort((a, b) => b.id.localeCompare(a.id));
		nodesToClose.forEach(node => {
			if (node.parent !== null) {
				node.state.open = false;
				tree.closeNode(node);
				tree.update();
			}
		});
		tree.unfilter();
		tree.update();
	} else {
		const checkNodeAndDescendants = (node) => {
			let hasMatchingDescendant = false;
			if (node.hasChildren()) {
				node.getChildren().forEach(child => {
					if (checkNodeAndDescendants(child)) {
						hasMatchingDescendant = true; 
					}
				});
			}

			const isSelfMatch = toHiragana(node.name).toLowerCase().includes(toHiragana(filterText));

			if (isSelfMatch && !hasMatchingDescendant) {
				matchedNodes.add(node);
			}

			return isSelfMatch || hasMatchingDescendant;
		};

		tree.nodes.forEach(rootNode => checkNodeAndDescendants(rootNode));

		tree.filter((node) => {
			return matchedNodes.has(node);
		});

		const parentNodes = new Set();
		matchedNodes.forEach(node => {
			let current = node.parent;
			while (current) {
				if (current.id) parentNodes.add(current);
				current = current.parent;
			}
		});

		parentNodes.forEach(node => {
			tree.openNode(node);
		});
		matchedNodes.forEach(node => {
			tree.closeNode(node);
		});

		tree.update();
	}
}

// zip ファイルからファイルツリーを構築
function makeFileTree(selector, zip, selectHandler, option = {}) {
	const { ext = '', hiddenComma = true, hiddenExt = true } = option || {};
	const fileTree = document.querySelector(selector);
	fileTree.innerHTML = `
		<form id="filerForm" class="inputbar" onsubmit="return false;">
			<input type="text" id="filerInput" name="filerInput" placeholder="絞込ファイル名(空白で解除)" autocomplete="on" />
			<button type="button" id="filerButton">絞込</button>
		</form>
		<div class="treebox">
			<div id="tree"></div>
		</div>
	`;

	try {
		const nodes = new Map();
		const treeData = [];

		let filePaths = Object.keys(zip.files);

		// extが指定されている場合、ファイルパスをフィルタリング
		if (ext) {
			const lowerCaseExt = ext.toLowerCase();
			const filteredFiles = filePaths.filter(path =>
				!zip.files[path].dir && path.toLowerCase().endsWith(lowerCaseExt)
			);
			const directories = new Set(
				filteredFiles.flatMap(path => path.substring(0, path.lastIndexOf('/') + 1).split('/').filter(Boolean).map((_, i, arr) => arr.slice(0, i + 1).join('/') + '/'))
			);
			filePaths = [...filteredFiles, ...Array.from(directories)];
		}

		// ディレクトリを先に、次にファイルを、それぞれ名前順でソート
		filePaths.sort((a, b) => {
			const aIsDir = a.endsWith('/');
			const bIsDir = b.endsWith('/');

			if (aIsDir && !bIsDir) return -1;
			if (!aIsDir && bIsDir) return 1;
			return a.localeCompare(b);
		});

		filePaths.forEach(path => {
			const file = zip.files[path];
			if (hiddenComma && (path.startsWith(',') || path.includes('/,'))) return;

			const parts = path.replace(/\/$/, '').split('/');
			let parentId = null;

			parts.forEach((part, i) => {
				const currentPath = parts.slice(0, i + 1).join('/');
				if (!nodes.has(currentPath)) {
					const isFile = !file.dir && (i === parts.length - 1);
					const name = hiddenExt && isFile ? basename(part) : part;	
					const node = {
						id: currentPath,
						name: name,
						children: [],
						data: { isFile: isFile, path: currentPath },
						parentId: parentId
					};
					nodes.set(currentPath, node);

					if (parentId) {
						const parentNode = nodes.get(parentId);
						if (parentNode) parentNode.children.push(node);
					} else {
						treeData.push(node);
					}
				}
				parentId = currentPath;
			});
		});

		const treeContainer = document.querySelector('#tree');
		treeContainer.innerHTML = ''; // ツリーコンテナをクリア
		const tree = new InfiniteTree(treeContainer, {
			data: treeData,
			autoOpen: false,
			selectable: true,
			rowRenderer: rowRenderer,
		});
		
		window.currentZip = zip; // グローバルに保存

		// ファイルクリック時の処理
		tree.on('click', (event) => {
			const node = tree.getNodeFromPoint(event.clientX, event.clientY);
			if (node && node.data.isFile) {
				tree.selectNode(node);
				selectHandler(node.data.path);
			}
		});

		// フィルタリング設定
		const filterInput = document.querySelector('#filerInput');
		const filterButton = document.querySelector('#filerButton');
		filterButton.addEventListener('click', () => applyFilter(tree, filterInput));
		filterInput.addEventListener('change', (event) => applyFilter(tree, filterInput));
		filterInput.addEventListener('input', (event) => { if(event.target.value === '') applyFilter(tree, filterInput) });
		document.querySelector('#filerForm').addEventListener('submit', (e) => e.preventDefault());

	} catch (error) {
		console.error('ZIPファイルの読み込みエラー:', error);
		alert('ZIPファイルの読み込みに失敗しました。');
	}
}
