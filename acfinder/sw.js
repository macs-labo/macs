const CACHE_NAME = 'acfinder-assets-v5.43'; // バージョンを上げる
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
	'./mob-crop.html',
	'./mob-pest.html',
	'./mob-chem.html',
	'./mob-pa-rec.html',
	'./stdsql.zip',
	'./custom.js',
	'./header.js',
	'./loader.js',
	'./table.js',
	'./crop.js',
	'./pest.js',
	'./chem.js',
	'./filer.js',
	'./theme.js',
	'./common.css',
	'./loader.css',
	'./table.css',
	'./crop.css',
	'./filer.css',
	'./editor.css',
	'./icons.svg',
	'./init_create_view.sql',
	'./previews/preview.html',
	'./previews/autosize.html',
	'./previews/resizable.html',
	'./previews/preview.js',
	'./previews/preview.css',
	'./manifest.json',
	'../android-chrome-192x192.png',
	'../apple-touch-icon-180x180.png',
	// 外部ライブラリもキャッシュしてオフライン対応を強化
	'https://cdn.jsdelivr.net/npm/sql.js@1.14.1/dist/sql-wasm.min.js',
	'https://cdn.jsdelivr.net/npm/sql.js@1.14.1/dist/sql-wasm.wasm',
	'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js',
	'https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js',
	'https://cdn.jsdelivr.net/npm/file-saver@2.0.5/dist/FileSaver.min.js',
	'https://cdn.jsdelivr.net/npm/handsontable@17.0.1/dist/handsontable.full.min.js',
	'https://cdn.jsdelivr.net/npm/handsontable@17.0.1/dist/languages/ja-JP.js',
	'https://cdn.jsdelivr.net/npm/handsontable@17.0.1/styles/handsontable.min.css',
	'https://cdn.jsdelivr.net/npm/handsontable@17.0.1/styles/ht-theme-classic.min.css',
	'https://cdn.jsdelivr.net/npm/infinite-tree@1.18.0/dist/infinite-tree.min.js',
	'https://cdn.jsdelivr.net/npm/infinite-tree@1.18.0/dist/infinite-tree.css',
	'https://cdn.jsdelivr.net/npm/@koozaki/romaji-conv@2.0.35/dist/romaji-conv.js',
	'https://cdn.jsdelivr.net/npm/codemirror@5.65.21/lib/codemirror.js',
	'https://cdn.jsdelivr.net/npm/codemirror@5.65.21/mode/sql/sql.js',
	'https://cdn.jsdelivr.net/npm/codemirror@5.65.21/addon/edit/matchbrackets.js',
	'https://cdn.jsdelivr.net/npm/codemirror@5.65.21/addon/hint/show-hint.js',
	'https://cdn.jsdelivr.net/npm/codemirror@5.65.21/addon/hint/sql-hint.js',
	'https://cdn.jsdelivr.net/npm/codemirror@5.65.21/addon/selection/active-line.js',
	'https://cdn.jsdelivr.net/npm/codemirror@5.65.21/lib/codemirror.css',
	'https://cdn.jsdelivr.net/npm/codemirror@5.65.21/theme/eclipse.css',
	'https://cdn.jsdelivr.net/npm/codemirror@5.65.21/theme/darcula.css',
	'https://cdn.jsdelivr.net/npm/codemirror@5.65.21/addon/hint/show-hint.css',
	'https://cdn.jsdelivr.net/npm/codemirror-colorpicker@1.9.80/dist/codemirror-colorpicker.css',
	'https://cdn.jsdelivr.net/npm/codemirror-colorpicker@1.9.80/dist/codemirror-colorpicker.min.js',
	'https://cdn.jsdelivr.net/npm/swiper@12.1.4/swiper-bundle.min.js',
	'https://cdn.jsdelivr.net/npm/swiper@12.1.4/swiper-bundle.min.css'
];

self.addEventListener('install', (event) => {
	// addAll は一つでも失敗すると全体が失敗するため、個別に add してエラーを許容する構成に変更
	event.waitUntil(
		caches.open(CACHE_NAME).then((cache) => {
			return Promise.allSettled(
				ASSETS_TO_CACHE.map(async (url) => {
					try {
						// cache: 'reload' を指定することで、ブラウザキャッシュを無視して最新を強制取得
						const response = await fetch(url, { cache: 'reload' });
						if (response.ok) {
							return await cache.put(url, response);
						}
					} catch (err) {
						console.error(`[SW] Failed to cache: ${url}`, err);
					}
				}) // map の終了
			);
		}).then(() => { // caches.open().then() の終了と次の then
			console.log('[SW] Install completed (some assets might have failed, check console)');
			return self.skipWaiting();
		})
	); // event.waitUntil() の終了
}); // addEventListener() の終了

// Background Sync イベントリスナー
self.addEventListener('sync', (event) => {
	if (event.tag === 'download-db-update') {
		event.waitUntil(downloadAndCacheUpdate());
	}
});

// バックグラウンドでのダウンロードと IndexedDB 保存処理
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
		request.onupgradeneeded = (event) => {
			const db = event.target.result;
			if (!db.objectStoreNames.contains(storeName)) {
				db.createObjectStore(storeName, { keyPath: 'fileName' });
			}
		};
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});

	for (const file of filesToUpdate) {
		try {
			// HTTPキャッシュを完全に無視して最新を取得
			const response = await fetch(file.url, { cache: 'no-store' });
			if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
			
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
		} catch (err) {
			console.error(`[SW] Failed to update ${file.name}:`, err);
		}
	}
	db.close();
}

// Push 通知受信時のイベントリスナー
self.addEventListener('push', (event) => {
	let data = { 
		title: 'ACFinder 更新通知', 
		body: 'データベースが更新されました。',
		tag: 'default-update', // デフォルトのタグ
		type: 'db'             // デフォルトのタイプ (db or app)
	};

	if (event.data) {
		try {
			data = event.data.json();
		} catch (e) {
			data.body = event.data.text();
		}
	}

	const isAppUpdate = data.type === 'app';

	// アプリ本体の更新通知は、公開版と見なされるスコープでのみ表示する
	// /acfinder/ (外部サイト) または /macs/ (GitHub Pages) のいずれかを含むスコープで許可
	if (isAppUpdate && !(self.registration.scope.includes('/acfinder/') || self.registration.scope.includes('/macs/'))) {
		console.log('[SW] App update notification suppressed in non-production or unrecognized scope.');
		return;
	}

	const bodyText = isAppUpdate ? `${data.body}\n今すぐアップデート版をダウンロードしますか？` : `${data.body}\nバックグラウンドダウンロード予約しますか？`;

	const options = {
		body: bodyText,
		icon: './android-chrome-192x192.png',
		badge: './android-chrome-192x192.png',
		// YAML側で設定した tag (acis-update や spec-update) を使用する
		// これにより、ACISとSPECが同時に更新されても両方の通知が表示されます
		tag: data.tag || 'general-update', 
		renotify: true,
		actions: [
			{ action: 'reserve-download', title: 'OK' }
		],
		data: data // ペイロード全体を保持（notice.htmlへの引き継ぎ用）
	};

	event.waitUntil(
		self.registration.showNotification(data.title, options)
	);
});

// 通知クリック時のイベントリスナー
self.addEventListener('notificationclick', (event) => {
	event.notification.close();
	const payload = event.notification.data || {};

	// 「OK」ボタンがクリックされた場合
	if (event.action === 'reserve-download') {
		if (payload.type === 'app') {
			// アプリ自体の更新の場合: Service Worker の更新をチェック
			// これによりバックグラウンドで新しい ASSETS_TO_CACHE のダウンロードが開始されます
			event.waitUntil(self.registration.update());
		} else {
			// データベースの更新の場合: Background Sync を登録
			if ('sync' in self.registration) {
				event.waitUntil(self.registration.sync.register('download-db-update'));
			} else {
				// Background Sync 非対応ブラウザの場合は直接ダウンロード処理を試みる
				event.waitUntil(downloadAndCacheUpdate());
			}
		}
		return;
	}

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
		Promise.all([
			caches.keys().then((keys) => Promise.all(
				keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
			)),
			self.clients.claim() // すぐに現在のページを制御下に置く
		])
	);
});

self.addEventListener('fetch', (event) => {
	const url = new URL(event.request.url);

	// acis.zip, spec.zip, acisupdate.zip は loader.js の IndexedDB ルーチンに任せるため SW ではキャッシュしない
	const dbFiles = ['acis.zip', 'spec.zip', 'acisupdate.zip'];
	if (dbFiles.some(file => url.pathname.endsWith(file))) {
		return; 
	}

	// GET リクエスト以外（POST等）はキャッシュ対象外として普通に fetch
	if (event.request.method !== 'GET') {
		event.respondWith(fetch(event.request));
		return;
	}

	event.respondWith(
		(async () => {
			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), 1000); // 1秒タイムアウト

			try {
				// 1. まず HEAD リクエストでネットワークの疎通と応答速度を確認
				// cache: 'no-cache' を使用して 304 を許容し、速度を稼ぐ
				await fetch(event.request, { 
					method: 'HEAD', 
					cache: 'no-cache', 
					signal: controller.signal 
				}).catch(() => { throw new Error('offline'); });
				clearTimeout(timeoutId);

				// 2. 1秒以内に HEAD が成功したなら GET で実データを取得
				const networkResponse = await fetch(event.request, { redirect: "follow", cache: 'no-cache' });

				// 正常なレスポンスのみキャッシュを更新（不完全なデータや404を防ぐ）
				if (networkResponse && networkResponse.ok) {
					// custom.js 等、意図的に 404 になる可能性のあるものは無視
					const isStaticAsset = ASSETS_TO_CACHE.some(asset => new URL(asset, self.location.href).href === event.request.url);
					const isCdn = event.request.url.includes('cdn.jsdelivr.net');
					if (isStaticAsset || isCdn) {
						const cache = await caches.open(CACHE_NAME);
						await cache.put(event.request, networkResponse.clone());
					}
				}
				return networkResponse;
			} catch (err) {
				// 3. タイムアウト(1秒超過)またはオフライン時は、SWキャッシュを返す
				return await caches.match(event.request, { ignoreSearch: true });
			}
		})()
	);
});