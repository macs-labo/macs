const CACHE_NAME = 'acfinder-assets-v3.7'; // バージョンを上げる
const ASSETS_TO_CACHE = [
	'./crop.html',
	'./pest.html',
	'./chem.html',
	'./sql.html',
	'./pestplan.html',
	'./pesticides-pests.html',
	'./pesticides-crops.html',
	'./rac_moa.html',
	'./feedrice.html',
	'./notice.html',
	'./acisupdate.html',
	'./proc.html',
	'./prop.html',
	'./index.html',
	'./stdsql.zip',
	'./header.js',
	'./loader.js',
	'./table.js',
	'./crop.js',
	'./filer.js',
	'./common.css',
	'./loader.css',
	'./table.css',
	'./crop.css',
	'./filer.css',
	'./editor.css',
	'./icons.svg',
	'./previews/preview.html',
	'./previews/autosize.html',
	'./previews/resizable.html',
	'./previews/preview.js',
	'./previews/preview.css',
	// 外部ライブラリもキャッシュしてオフライン対応を強化
	'https://cdn.jsdelivr.net/npm/sql.js@1.13.0/dist/sql-wasm.min.js',
	'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js',
	'https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js',
	'https://cdn.jsdelivr.net/npm/file-saver@2.0.5/dist/FileSaver.min.js',
	'https://cdn.jsdelivr.net/npm/handsontable@16.2.0/dist/handsontable.full.min.js',
	'https://cdn.jsdelivr.net/npm/handsontable@16.2.0/dist/languages/ja-JP.js',
	'https://cdn.jsdelivr.net/npm/handsontable@16.2.0/styles/handsontable.min.css',
	'https://cdn.jsdelivr.net/npm/handsontable@16.2.0/styles/ht-theme-classic.min.css',
	'https://cdn.jsdelivr.net/npm/infinite-tree@1.18.0/dist/infinite-tree.min.js',
	'https://cdn.jsdelivr.net/npm/infinite-tree@1.18.0/dist/infinite-tree.css',
	'https://cdn.jsdelivr.net/npm/@koozaki/romaji-conv@2.0.32/dist/romaji-conv.js',
	'https://cdn.jsdelivr.net/npm/codemirror@5.65.20/lib/codemirror.js',
	'https://cdn.jsdelivr.net/npm/codemirror@5.65.20/mode/sql/sql.js',
	'https://cdn.jsdelivr.net/npm/codemirror@5.65.20/addon/edit/matchbrackets.js',
	'https://cdn.jsdelivr.net/npm/codemirror@5.65.20/addon/hint/show-hint.js',
	'https://cdn.jsdelivr.net/npm/codemirror@5.65.20/addon/hint/sql-hint.js',
	'https://cdn.jsdelivr.net/npm/codemirror@5.65.20/addon/selection/active-line.js',
	'https://cdn.jsdelivr.net/npm/codemirror@5.65.20/lib/codemirror.css',
	'https://cdn.jsdelivr.net/npm/codemirror@5.65.20/theme/eclipse.css',
	'https://cdn.jsdelivr.net/npm/codemirror@5.65.20/theme/darcula.css',
	'https://cdn.jsdelivr.net/npm/codemirror@5.65.20/addon/hint/show-hint.css'
];

self.addEventListener('install', (event) => {
	// addAll は一つでも失敗すると全体が失敗するため、個別に add してエラーを許容する構成に変更
	event.waitUntil(
		caches.open(CACHE_NAME).then((cache) => {
			return Promise.allSettled(
				ASSETS_TO_CACHE.map(url => 
					cache.add(url).catch(err => console.error(`[SW] Failed to cache: ${url}`, err))
				)
			);
		}).then(() => {
			console.log('[SW] Install completed (some assets might have failed, check console)');
			return self.skipWaiting();
		})
	);
});

// Background Sync イベントリスナー
self.addEventListener('sync', (event) => {
	if (event.tag === 'download-db-update') {
		event.waitUntil(downloadAndCacheUpdate());
	}
});

// 背景でのダウンロードと IndexedDB 保存処理
async function downloadAndCacheUpdate() {
	const dbName = 'fileCacheDB';
	const storeName = 'files';
	const filesToUpdate = [
		{ name: 'acis.zip', url: 'https://raw.githubusercontent.com/macs-labo/macs/main/data/acis.zip' },
		{ name: 'spec.zip', url: 'https://raw.githubusercontent.com/macs-labo/macs/main/data/spec.zip' },
		{ name: 'acisupdate.zip', url: 'https://macs.kabe.info/data/acisupdate.zip' }
	];

	// IndexedDB を開く (loader.js と同じ構成)
	const db = await new Promise((resolve, reject) => {
		const request = indexedDB.open(dbName, 1);
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});

	for (const file of filesToUpdate) {
		const response = await fetch(file.url, { cache: 'no-cache' });
		const blob = await response.blob();
		const timestamp = response.headers.get('Last-Modified') || new Date().toUTCString();

		await new Promise((resolve, reject) => {
			const transaction = db.transaction(storeName, 'readwrite');
			const store = transaction.objectStore(storeName);
			const request = store.put({ fileName: file.name, blob, timestamp });
			request.onsuccess = () => resolve();
			request.onerror = () => reject(request.error);
		});
		console.log(`[SW] Background update saved: ${file.name}`);
	}
	db.close();
}

// Push 通知受信時のイベントリスナー
self.addEventListener('push', (event) => {
	let data = { 
		title: 'ACFinder 更新通知', 
		body: 'データベースが更新されました。',
		tag: 'default-update' // デフォルトのタグ
	};

	if (event.data) {
		try {
			data = event.data.json();
		} catch (e) {
			data.body = event.data.text();
		}
	}

	const options = {
		body: data.body,
		icon: './android-chrome-192x192.png',
		badge: './android-chrome-192x192.png',
		// YAML側で設定した tag (acis-update や spec-update) を使用する
		// これにより、ACISとSPECが同時に更新されても両方の通知が表示されます
		tag: data.tag || 'general-update', 
		renotify: true,
		data: data // ペイロード全体を保持（notice.htmlへの引き継ぎ用）
	};

	event.waitUntil(
		self.registration.showNotification(data.title, options)
	);
});

// 通知クリック時のイベントリスナー
self.addEventListener('notificationclick', (event) => {
	event.notification.close();
	const payload = event.notification.data;

	event.waitUntil(
		clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (clientList) => {
			// notice.html に JSON ペイロードを Base64 エンコードして渡す
			const params = new URLSearchParams();
			params.set('p', btoa(unescape(encodeURIComponent(JSON.stringify(payload)))));
			const targetUrl = new URL(`./notice.html?${params.toString()}`, self.registration.scope).href;

			for (const client of clientList) {
				if (client.url === targetUrl && 'focus' in client) {
					return client.focus();
				}
			}
			if (clients.openWindow) {
				return clients.openWindow(targetUrl);
			}
		})
	);
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches.keys().then((keys) => Promise.all(
			keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
		))
	);
});

self.addEventListener('fetch', (event) => {
	const url = new URL(event.request.url);

	// acis.zip, spec.zip, acisupdate.zip は loader.js の IndexedDB ルーチンに任せるため SW ではキャッシュしない
	const dbFiles = ['acis.zip', 'spec.zip', 'acisupdate.zip'];
	if (dbFiles.some(file => url.pathname.endsWith(file))) {
		return; 
	}

	event.respondWith(
		caches.match(event.request, { ignoreSearch: true }).then((response) => {
			// クエリパラメータを無視してキャッシュを検索。あれば返し、なければネットワークへ
			return response || fetch(event.request, { redirect: "follow"});
		})
	);
});
