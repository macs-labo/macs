/* 共通ヘッダー表示＆データベースローダー */

// 利用上の注意点修正日
const cautionDate = Date.parse('2026/3/1');

// データベース設定
let db = null;
let tables = []; // テーブルインスタンスを保持する配列
let lastUpdate = '';
let dbStatusCached = false;

const isMacs = window.location.hostname.match(/^(macs|noyaku)\./); // MACS サイト判定: ホスト名の先頭が macs. または noyaku.
const datdir = isMacs ? '../data/' : 'https://raw.githubusercontent.com/macs-labo/macs/main/data/'; // MACS サイト以外では github から取得
const maindb = 'acis';
const subdb  = 'spec';
const local  = window.location.protocol.indexOf('file:') === 0;
const isElectron = typeof window.electronAPI !== 'undefined';

//const sleep = time => new Promise(resolve => setTimeout(resolve, time));

//IndexedDB を削除
//const DBDeleteRequest = window.indexedDB.deleteDatabase('fileCacheDB');

// IndexedDBを開く関数
function openDB(dbName) {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(dbName, 1);
		
		request.onupgradeneeded = (event) => {
			const db = event.target.result;
			if (!db.objectStoreNames.contains('files')) {
				db.createObjectStore('files', { keyPath: 'fileName' });
			}
		};
		
		request.onsuccess = (event) => {
			resolve(event.target.result);
		};
		
		request.onerror = (event) => {
			reject(event.target.error);
		};
	});
}

// IndexedDBからファイルのメタデータを取得
async function getLocalFile(db, fileName) {
	return new Promise((resolve, reject) => {
		const transaction = db.transaction('files', 'readonly');
		const store = transaction.objectStore('files');
		const request = store.get(fileName);
		
		request.onsuccess = () => {
			resolve(request.result); // { fileName, blob, timestamp } または undefined
		};
		
		request.onerror = () => {
			reject(request.error);
		};
	});
}

// IndexedDBにファイルを保存（Blob -> 失敗時 Base64 にフォールバック）
async function saveFileToDB(db, fileName, blob, timestamp) {
	// 最初に通常のBlobとして保存を試みる
	try {
		await new Promise((resolve, reject) => {
			const transaction = db.transaction('files', 'readwrite');
			const store = transaction.objectStore('files');
			// Blobをそのまま保存
			const request = store.put({ fileName, blob, timestamp }); 
			
			request.onsuccess = () => resolve();
			request.onerror = () => reject(request.error);
		});
		console.log(`[IndexedDB] ${fileName} saved as Blob.`);
	} catch (error) {
		// Blob保存が失敗した場合（SafariのDOMExceptionを想定）
		console.warn(`[IndexedDB] Failed to save ${fileName} as Blob. Retrying with Base64. Error:`, error);
		
		// Base64に変換してリトライ
		const base64String = await new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onloadend = () => resolve(reader.result);
			reader.onerror = () => reject(reader.error);
			reader.readAsDataURL(blob); // Data URL (Base64) 形式で読み込む
		});

		// Base64文字列として保存
		await new Promise((resolve, reject) => {
			// 注意: このとき、キー 'blob' の代わりに 'base64String' など別のキーで保存するか、
			// 全てのブラウザで Base64 を使う場合は単に 'blob' に Base64 を保存するかの判断が必要です。
			// 互換性を考慮し、ここでは **'blob' キーに Base64 文字列を保存**し、
			// 読み出し側で 'blob' の中身をチェックして復元します。
			const transaction = db.transaction('files', 'readwrite');
			const store = transaction.objectStore('files');
			// Blobの代わりにBase64文字列を保存
			const request = store.put({ fileName, blob: base64String, timestamp }); 
			
			request.onsuccess = () => resolve();
			request.onerror = () => reject(request.error);
		});
		console.log(`[IndexedDB] ${fileName} saved as Base64 (fallback).`);
	}
}

// サーバーからタイムスタンプを取得
async function getServerTimestamp(serverUrl, timeout = 3000) {

	const controller = new AbortController();
	const id = setTimeout(() => controller.abort(), timeout);

	try {
		if (serverUrl.includes('raw.githubusercontent.com')) {
			// GitHub APIを使用して、ZIPファイル自体の最新コミット日時を取得
			// URL例: https://raw.githubusercontent.com/user/repo/main/path/to/file
			// API例: https://api.github.com/repos/user/repo/commits?path=path/to/file&page=1&per_page=1
			const parts = serverUrl.replace('https://raw.githubusercontent.com/', '').split('/');
			const [owner, repo, branch, ...pathParts] = parts;
			const filePath = pathParts.join('/');

			const apiUrl = `https://api.github.com/repos/${owner}/${repo}/commits?path=${filePath}&sha=${branch}&per_page=1`;
			
			const response = await fetch(apiUrl, { cache: 'no-cache', signal: controller.signal });
			if (response.ok) {
				const commits = await response.json();
				if (commits && commits.length > 0) {
					return commits[0].commit.committer.date; // ISO 8601形式 (e.g. 2023-10-01T12:00:00Z)
				}
			}
		} else {
			// 通常のHTTP HEADリクエスト
			let response = await fetch(serverUrl, { method: 'HEAD', cache: 'no-cache', signal: controller.signal });
			if (response.ok) {
				return response.headers.get('Last-Modified');
			}
		}
	} catch (error) {
		console.warn(`[getServerTimestamp] Could not get timestamp for ${serverUrl}.`, error);
		// エラー時は null を返す
	} finally {
		clearTimeout(id);
	}
	return null;
}

// サーバーからファイルをダウンロード
async function fetchFile(serverUrl, timeout = 60000, autoClose = true) {

	const controller = new AbortController();
	const id = setTimeout(() => controller.abort(), timeout);

	try {
		// no-cache で失敗した場合は通常リクエストでリトライ
		let response = await fetch(serverUrl, { cache: 'no-cache', signal: controller.signal }).catch(e => {
			if (e.name === 'AbortError') throw e;
			console.log(`[fetchFile] Retrying ${serverUrl} without no-cache...`);
			return fetch(serverUrl, { signal: controller.signal });
		});

		if (!response.ok) {
			throw new Error(`Failed to download file: ${response.status}`);
		}

		// 進捗表示
		const contentLength = response.headers.get('Content-Length');
		const total = contentLength ? parseInt(contentLength, 10) : 0;
		const fileName = serverUrl.split('/').pop();
		let blob;

		if (response.body) {
			const reader = response.body.getReader();
			const chunks = [];
			let loaded = 0;

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				
				chunks.push(value);
				loaded += value.length;

				if (total > 0) {
					const percent = Math.floor((loaded / total) * 100);
					// ダウンロード中は await しない（スループットを落とさないため）
					waiting(true, `ダウンロード中: ${fileName} ${percent}%`);
				} else {
					waiting(true, `ダウンロード中: ${fileName} ${(loaded / 1024).toFixed(0)}KB`);
				}
			}
			blob = new Blob(chunks);
		} else {
			blob = await response.blob();
		}

		// 9バイト問題対策: サイズが小さすぎる場合はエラーとする (空のZIPでも22バイトはある)
		if (blob.size < 22) {
			const text = await blob.text();
			throw new Error(`Invalid file content (too small): ${text}`);
		}
		// タイムスタンプも返すように変更
		return { blob, lastModified: response.headers.get('Last-Modified') };
	} finally {
		clearTimeout(id);
		if (autoClose) waiting(false);
	}
}

// タイムスタンプを比較（文字列をDateに変換して比較）
function isServerNewer(serverTimestamp, localTimestamp) {
	if (!localTimestamp) return true; // ローカルにない場合、新しいとみなす
	const serverDate = new Date(serverTimestamp);
	const localDate = new Date(localTimestamp);
	return serverDate > localDate;
}

// 単一 DB ファイルの URL フェッチまたは IndexedDB からのロード
async function fetchOrLoadFile(db, fileName, serverUrl, autoClose = true) {
	let localFile = null;
	try {
		// 先にローカルファイルをチェック
		try {
			localFile = await getLocalFile(db, fileName);
		} catch (e) {
			console.warn(`Failed to load local file ${fileName}:`, e);
		}

		// ローカルファイルがある場合はタイムアウトを短くする
		const tsTimeout = localFile ? 1000 : 3000;
		let serverTimestamp = null;
		try {
			serverTimestamp = await getServerTimestamp(serverUrl, tsTimeout);
		} catch (e) {
			// タイムスタンプ取得失敗は許容する
		}
		
		// ローカルファイルが存在しても、blob プロパティが欠損している場合は破損とみなして再ダウンロード
		const isCorrupted = localFile && !localFile.blob;

		// サーバーのタイムスタンプ取得に失敗した場合(null)は、ローカルファイルがあればそれを使う
		const shouldDownload = isCorrupted || !localFile || (serverTimestamp !== null && isServerNewer(serverTimestamp, localFile.timestamp));

		if (shouldDownload) {
			console.log(`${fileName} is outdated, missing, or corrupted. Downloading...`);
			// ローカルファイルがある（更新用途）ならタイムアウトを短く(30000ms)、なければデフォルト(60000ms)
			const dlTimeout = (localFile && !isCorrupted) ? 30000 : 60000;
			
			const result = await fetchFile(serverUrl, dlTimeout, autoClose);
			const blob = result.blob;
			const newTimestamp = result.lastModified || serverTimestamp;

			try {
				await saveFileToDB(db, fileName, blob, newTimestamp); 
			} catch (e) {
				console.warn(`Failed to save ${fileName} to IndexedDB:`, e);
			}
			return { blob, fileName, isFallback: false };
		} else {
			console.log(`${fileName} is up-to-date. Loading from local.`);
			// サーバーとの通信（タイムスタンプ取得）に失敗してキャッシュを使った場合は fallback とみなす
			const isFallback = (serverTimestamp === null);

			// --- ⚠️ ここから復元処理を追加 ⚠️ ---
			let storedData = localFile.blob;
			
			// localFile.blob が Blob ではなく Base64 文字列（Data URL）だった場合の復元
			if (typeof storedData === 'string' && storedData.startsWith('data:')) {
				console.log(`[IndexedDB] ${fileName} is Base64 encoded. Decoding...`);
				// Base64からBlobに変換
				const parts = storedData.split(',');
				const mime = parts[0].match(/:(.*?);/)[1];
				const base64 = parts[1];
				const binary = atob(base64); // Base64デコード
				
				const arrayBuffer = new ArrayBuffer(binary.length);
				const uint8Array = new Uint8Array(arrayBuffer);
				for (let i = 0; i < binary.length; i++) {
					uint8Array[i] = binary.charCodeAt(i);
				}
				
				// Blobオブジェクトを生成
				storedData = new Blob([uint8Array], { type: mime });
			}

			// Blob または 復元された Blob を返す
			if (!storedData) throw new Error('Stored data is empty');
			return { blob: storedData, fileName, isFallback };
			// ------------------------------------
		}
	} catch (error) {
		console.warn(`Error processing ${fileName} with cache logic:`, error);

		// フォールバック: 直接ダウンロードを試みる
		try {
			console.log(`Attempting direct download for ${fileName} as fallback...`);
			const controller = new AbortController();
			const id = setTimeout(() => controller.abort(), 60000);
			const response = await fetch(serverUrl, { signal: controller.signal });
			clearTimeout(id);

			if (!response.ok) throw new Error(`Fallback fetch failed: ${response.status} ${response.statusText}`);
			const blob = await response.blob();

			// フォールバックでも保存を試みる
			try {
				const lastModified = response.headers.get('Last-Modified');
				await saveFileToDB(db, fileName, blob, lastModified);
			} catch (e) { console.warn('Fallback save failed:', e); }

			return { blob, fileName, isFallback: false };
		} catch (fallbackError) {
			console.error(`Fallback download failed for ${fileName}:`, fallbackError);

			// フォールバックダウンロードが失敗した場合、最後の手段としてローカルキャッシュを使用
			if (!localFile) {
				try { localFile = await getLocalFile(db, fileName); } catch (e) {}
			}
			if (localFile && localFile.blob) {
				console.log(`Using local cache for ${fileName} as a last resort.`);
				let storedData = localFile.blob;
				if (typeof storedData === 'string' && storedData.startsWith('data:')) {
					console.log(`[IndexedDB] ${fileName} is Base64 encoded. Decoding...`);
					const parts = storedData.split(',');
					const mime = parts[0].match(/:(.*?);/)[1];
					const base64 = parts[1];
					const binary = atob(base64);
					const arrayBuffer = new ArrayBuffer(binary.length);
					const uint8Array = new Uint8Array(arrayBuffer);
					for (let i = 0; i < binary.length; i++) {
						uint8Array[i] = binary.charCodeAt(i);
					}
					storedData = new Blob([uint8Array], { type: mime });
				}
				if (storedData) return { blob: storedData, fileName, isFallback: true };
			}

			// ローカルキャッシュもなければ、最終的にエラーを投げる
			throw new Error(`Failed to download ${fileName} and no local backup available.`);
		}
	}
}

//PHP preg_quote 相当
function preg_quote (str, delimiter) {
    return (str + '').replace(new RegExp('[.\\\\+*?\\[\\^\\]$(){}=!<>|:\\' + (delimiter || '') + '-]', 'g'), '\\$&');
}

//PHP str_replace 相当(毎回全文字置換)
function replaceArray(find, replace, str) {
	var replaceString = str;
	for (var i = 0; i < find.length; i++) {
		//replaceString = replaceString.replaceAll(find[i], Array.isArray(replace) ? replace[i] : replace);
		replaceString = replaceString.replaceAll(find[i], replace[i]);
	}
	return replaceString;
};

// 修正版: Mapを使って1文字ずつ置換し、空文字置換に対応
/*
function replaceArray(find, replace, str) {
	const replaceMap = new Map();
	for (let i = 0; i < find.length; i++) {
		replaceMap.set(find[i], replace[i]);
	}
	return Array.from(str).reduce((result, char) => {
		const replacement = replaceMap.get(char);
		// replacementがundefinedならcharをそのまま追加、''なら追加しない
		return result + (replacement !== undefined ? replacement : char);
	}, '');
}
*/

// 全角カタカナ→全角ひらがな変換
function toHiragana(str) {
	// 全角カタカナと全角ひらがなのコードポイントの差分を計算します。
	// 'ァ' (\u30a1) と 'ぁ' (\u3041) のコードポイントの差は 96 です。
	const OFFSET = '\u30a1'.charCodeAt(0) - '\u3041'.charCodeAt(0);

	// 文字列を一文字ずつ処理し、変換を行います。
	const convertedString = Array.from(str).map(char => {
		const code = char.charCodeAt(0);

		// 全角カタカナの範囲 (\u30a1 から \u30f6) をチェックします。
		// \u30a1-\u30f3: 全角カタカナの ァ-ン: ここで終わるなら <= 0x30f3 とする(sjis 用)
		// \u30f4-\u30f6: ヴヵヶ: utf8 は対応する全角ひらがながあるので、<= 0x30f6 のまま
		if (code >= 0x30a1 && code <= 0x30f6) {
			// カタカナのコードポイントから OFFSET を引くことで、対応するひらがなのコードポイントになります。
			const hiraganaCode = code - OFFSET;
			return String.fromCharCode(hiraganaCode);
		}

		// カタカナ以外の文字はそのまま返します。
		return char;
	}).join('');

	return convertedString;
}

function strconv(str, opt = 'v') {
	if (str === null || str === '') return '';
	let mod = '';
	const fromVague = [
		'ゔ','ぢ','づ','ぱ','ぴ','ぷ','ぺ','ぽ','ゃ','ゅ','ょ','ゎ',
		'ぁ','ぃ','ぅ','ぇ','ぉ','ゕ','ゖ','っ',' ',',','-','ー'
	];
	const toVague = [
		'ぶ','じ','ず','ば','び','ぶ','べ','ぼ','や','ゆ','よ','わ',
		'あ','い','う','え','お','か','け','','','','','',''
	];
	const fromRegex = [
		'ゔ','ぢ','づ','ぱ','ぴ','ぷ','ぺ','ぽ',' ',',','-','ー','－',
		'ぁ','ぃ','ぅ','ぇ','ぉ','ゕ','ゖ','っ','ゃ','ゅ','ょ','ゎ',
		'ば','び','べ','ぼ','は','ひ','へ','ほ'
	];
	const toRegex = [
		'ぶ','じ','ず','ば','び','ぶ','べ','ぼ','','','','','',
		'あ','い','う','え','お','か','け','','や','ゆ','よ','わ',
		'(ば|ぶあ)','(び|ぶい)','(べ|ぶえ)','(ぼ|ぶお)','(は|ふあ)','(ひ|ふい)','(へ|ふえ)','(ほ|ふお)'
	];
	opt = opt.toLowerCase();
	if (opt.match(/[cvr]/g)) str = str.toUpperCase();
	if (opt.match(/[kvr]/g)) str = toHiragana(str);
	if ((opt.indexOf('v') >= 0) && (opt.indexOf('r') < 0)) str = replaceArray(fromVague, toVague, str);
	if (opt.indexOf('r') >= 0) {
		str = replaceArray(fromRegex, toRegex, str); // 'ふ', 'つ' 以外は、replaceArray で単純文字列変換
		str = str.replace(/つ(?!$)/g, 'つ?'); // 末尾でない 'つ' を 'つ?' に変換
		str = str.replace(/([ふぶ])(?![あいえお])/g, '$1ゆ?'); // 最後に、'[あいえお]' が後続しない 'ふ|ぶ' を 'ふゆ?|ぶゆ?' に変換
	}
	return str;
}

function n_concat(con, args) {
	if (con === null || con === '') throw 'Invalid argument to function n_concat(): first argument is not allowed null or empty string';
	//if (args === null) return;
	args = args.filter(v => v !== undefined);
	if (args.length == 1) {
		const arg = args[0];
		if (arg === null || typeof arg !== 'string') return;
		args = JSON.parse(arg); // JSON 文字列としてパースを試みる。失敗してもスカラー文字として配列化する必要なし
	}
	if (args.length == 1) throw 'Wrong number of arguments to function n_concat(), use aggregate function gn_concat()';
	const recon = preg_quote(con);
	var res = '';
	for (const arg of args) {
		if(arg === null || arg === '') continue;
		let pats = arg.split(con);
		for (const s of pats) {
			let pat = preg_quote(s);
			let re = new RegExp(`(^|${recon})${pat}(${recon}|$)`);
			if (!res.match(re)) res += res ? con + s : s;
		}
	}
	return res;
}

function d_concat(con, args) {
	if (con === null || con === '') throw 'Invalid argument to function d_concat(): first argument is not allowed null or empty string';
	//if (args === null) return;
	args = args.filter(v => v !== undefined);
	if (args.length == 1) {
		const arg = args[0];
		if (arg === null || typeof arg !== 'string') return;
		args = JSON.parse(arg);  // JSON 文字列としてパースを試みる。失敗してもスカラー文字として配列化する必要なし
	}
	if (args.length == 1) throw 'Wrong number of arguments to function d_concat(), use aggregate function gd_concat()';
	var res = '';
	for (const arg of args) {
		if(arg === null || arg === '') continue;
		res += res ? con + arg : arg;
	}
	return res;
}

function _if(...args) {
	args = args.filter(v => v !== undefined);
	switch(args.length) {
		case 2: return Boolean(args[0]) ? args[1] : null; break;
		case 3: return Boolean(args[0]) ? args[1] : args[2]; break;
		case 4: return Boolean(args[0]) ? args[1] : Boolean(args[2]) ? arg[3] : null; break;
		case 5: return Boolean(args[0]) ? args[1] : Boolean(args[2]) ? arg[3] : arg[4]; break;
		case 6: return Boolean(args[0]) ? args[1] : Boolean(args[2]) ? arg[3] : Boolean(arg[4]) ? arg[5] : null; break;
		case 7: return Boolean(args[0]) ? args[1] : Boolean(args[2]) ? arg[3] : Boolean(arg[4]) ? arg[5] : arg[6]; break;
	}
}

function _regexp(pattern, target, opt = 'v') {
	if (target === null || target === '') return false;
	//return new RegExp(strconv(pattern, opt)).test(strconv(target, opt));
	var optr = opt.toLowerCase();
	if (optr.indexOf('v') >= 0) optr = 'r';
	return new RegExp(strconv(pattern, optr)).test(strconv(target, opt));
}

function extnum(pattern, target, def = 0) {
	var r = def;
	if (target === null) target = '';
	const res = [...target.matchAll(new RegExp(`([\+\-]?[0-9]+(\.[0-9]+([Ee][\+\-]?[0-9]+)?)?)\s*(${pattern})`, 'g'))];
	if (res.length > 0) r = parseFloat(res[0][1]);
	return r;
}

	/**
 * SQLiteのLIKE演算子（%のみ）と等価なロジック
 * @param {string} value - 比較対象のカラム値
 * @param {string[]} patterns - パターンの配列
 * @returns {boolean} - いずれかのパターンに一致すればtrue
 */
function definiteLikeIn(value, patterns) {
	// pattern のバリデーション
	if (value === null || typeof value !== 'string') return false;

	// patterns のバリデーションと正規化
	if (patterns === null) return false;

	let patternsArray = patterns; // 複数引数関数として登録しているせいか、文字列をひとつだけ指定しても array として渡される
	if (patterns.length === 1) {
		const pattern = patterns[0];
		// pattern が文字列以外の場合は patternArray = JSON.paser(pattern) で patternArray が変化するので、事前にチェック
		if (pattern === null || typeof pattern !== 'string') return false;
		// JSON 文字列としてパースを試みる。失敗しても patternArray は変化しないので、エラーを補足しても何もしない。
		try { patternsArray = JSON.parse(pattern); } catch (e) { }
	}

	// 各値に対して処理
	for (const pattern of patternsArray) {
		if (pattern === null || typeof pattern !== 'string') continue;

		// %が含まれない（完全一致）
		if (!pattern.includes('%')) {
			if (value === pattern) return true;
		}
		// prefix%
		else if (pattern.endsWith('%') && !pattern.substring(0, pattern.length - 1).includes('%')) {
			const prefix = pattern.substring(0, pattern.length - 1);
			if (value.startsWith(prefix)) return true;
		}
		// %suffix
		else if (pattern.startsWith('%') && !pattern.substring(1).includes('%')) {
			const suffix = vaguePattern.substring(1);
			if (value.endsWith(suffix)) return true;
		}
		// %middle% (最初の%と最後の%のみ)
		else if (pattern.startsWith('%') && pattern.endsWith('%') && pattern.lastIndexOf('%') === pattern.length - 1) {
			const middle = pattern.substring(1, pattern.length - 1);
			if (value.includes(middle)) return true;
		}
		// 複雑なパターンは非サポート（高速化のため）
	}

	return false;
}

/*
function vagueMatches(pattern, values) {
	// pattern のバリデーション
	if (pattern === null || typeof pattern !== 'string') return false;
	const vaguePattern = strconv(pattern);

	// values のバリデーションと正規化
	if (values === null) return false;

	let valuesArray;
	if (typeof values === 'string') {
		try {
			// JSON 文字列としてパースを試みる
			valuesArray = JSON.parse(values);
		} catch (e) {
			// パース失敗時はスカラー文字列として配列化
			valuesArray = [values];
		}
	} else {
		valuesArray = values;
	}

	// 配列でない場合は false を返す
	if (!Array.isArray(valuesArray)) return false;

	// 各値に対して処理
	for (const value of valuesArray) {
		if (value === null || typeof value !== 'string') continue;
		const vagueValue = strconv(value);

		// %が含まれない（完全一致）
		if (!vaguePattern.includes('%')) {
			if (vagueValue === vaguePattern) return true;
		}
		// prefix%
		else if (vaguePattern.endsWith('%') && !vaguePattern.substring(0, vaguePattern.length - 1).includes('%')) {
			const prefix = vaguePattern.substring(0, vaguePattern.length - 1);
			if (vagueValue.startsWith(prefix)) return true;
		}
		// %suffix
		else if (vaguePattern.startsWith('%') && !vaguePattern.substring(1).includes('%')) {
			const suffix = vaguePattern.substring(1);
			if (vagueValue.endsWith(suffix)) return true;
		}
		// %middle% (最初の%と最後の%のみ)
		else if (vaguePattern.startsWith('%') && vaguePattern.endsWith('%') && vaguePattern.lastIndexOf('%') === vaguePattern.length - 1) {
			const middle = vaguePattern.substring(1, vaguePattern.length - 1);
			if (vagueValue.includes(middle)) return true;
		}
		// 複雑なパターンは非サポート（高速化のため）
	}

	return false;
}
*/

function registerMultiArityFunction(db, functionName, valueArgName, maxPatterns, coreLogic) {
	if (typeof db.create_function !== 'function') {
		console.error("Provided object is not a valid sql-wasm Database instance.");
		return;
	}

	// パターン数 n = 2 から maxPatterns までループ (最小引数 3 = valueArgName + p1 + p2)
	const MIN_PATTERNS = 2;
	const coreLogicName = coreLogic.name || 'coreLogic'; // コアロジック関数の名前を取得

	// coreLogic関数をクロージャ（スコープ）に取り込むための処理
	// このヘルパーを呼び出すスコープに coreLogic が存在する必要があります。
	// Functionコンストラクタ内でcoreLogicを参照するために、グローバルまたはスコープ内の参照が必要です。
	// 例：window.coreLogic = coreLogic; 
	
	// ただし、Functionコンストラクタは新しいスコープを作るため、この関数内で定義された
	// coreLogicを直接参照させるのは、通常、安全ではありません。
	// 解決策として、Functionコンストラクタの最終引数に関数本体を文字列で渡します。

	for (let n = MIN_PATTERNS; n <= maxPatterns; n++) {
		// ラッパー関数の引数リストを作成
		// 例: n=3 の場合 ['col', 'p1', 'p2', 'p3']
		const argNames = [valueArgName].concat(Array.from({ length: n }, (_, i) => `p${i + 1}`));
		
		// 関数本体のロジック文字列を生成
		const functionBody = `
			// 最初の引数（arguments[0]）がカラム値
			const value = arguments[0]; 
			
			// arguments[1]以降のすべての引数（パターン）を配列に変換
			const patterns = Array.prototype.slice.call(arguments, 1);
			
			// 登録時に渡された実際のコアロジック関数を直接呼び出す
			return this.coreLogic(value, patterns);
		`;

		// Function コンストラクタを使って動的に引数を持つ関数を生成
		// ここで第三引数に functionBody を渡し、最後の引数に this の参照先を渡す必要があります。
		// sql-wasm の create_function は this コンテキストの制御が複雑なため、
		// 単純な Function コンストラクタの使用ではなく、外部スコープから coreLogic を
		// 取得できるようにするのが現実的です。
		
		// **最も確実な方法**：登録関数を Function コンストラクタで生成し、
		// クロージャを介さずに coreLogic へアクセスするため、
		// 登録時にコアロジックをバインドします。
		
		const wrapperFunction = new Function(...argNames, functionBody).bind({ coreLogic });

		// SQLに登録
		try {
			db.create_function(functionName, wrapperFunction);
			
			//console.log(`Registered function: ${functionName}(${argNames.join(', ')})`);
		} catch (error) {
			console.error(`Failed to register ${functionName} with ${argNames.length} args:`, error);
		}
	}
}

//SQLite ユーザ定義関数登録
function registerCustomFunctions() {
	if (!db) return;

	// ACFinder 互換 ifnullstr
	db.create_function('IFNULLSTR', function(x, y) {
		return x === null || x === '' ? y : x;
	});

	// ACFinder 互換 if
	db.create_function('IF', function(cond1, true1) {
		//return _if(cond1, true1);
		return Boolean(cond1) ? true1 : null;
			});
	db.create_function('IF', function(cond1, true1, false1) {
		//return _if(cond1, true1, false1);
		return Boolean(cond1) ? true1 : false1;
	});
	db.create_function('IF2', function(cond1, true1, cond2, true2) {
		//return _if(cond1, true1, cond2, true2);
		return Boolean(cond1) ? true1 : (Boolean(cond2) ? true2 : null);
	});
	db.create_function('IF2', function(cond1, true1, cond2, true2, false2) {
		//return _if(cond1, true1, cond2, true2, false2);
		return Boolean(cond1) ? true1 : (Boolean(cond2) ? true2 : false2);
	});
	db.create_function('IF3', function(cond1, true1, cond2, true2, cond3, true3) {
		//return _if(cond1, true1, cond2, true2, cond3, true3);
		return Boolean(cond1) ? true1 : (Boolean(cond2) ? true2 : (Boolean(cond3) ? true3 : null));
	});
	db.create_function('IF3', function(cond1, true1, cond2, true2, cond3, true3, false3) {
		//return _if(cond1, true1, cond2, true2, cond3, true3, false3);
		return Boolean(cond1) ? true1 : (Boolean(cond2) ? true2 : (Boolean(cond3) ? true3 : false3));
	});

	// ACFinder 互換 extnum
	db.create_function('EXTNUM', function(pattern, target) {
		return extnum(pattern, target);
	});
	db.create_function('EXTNUM', function(pattern, target, def) {
		return extnum(pattern, target, def);
	});

	// ACFinder 互換 explode
	db.create_function('EXPLODE', function(dlm, src, num) {
		return src.split(preg_quote(dlm))[num];
	});

	// ACFinder 互換 strconv (標準であいまい検索 OFF)
	db.create_function('STRCONV', function(str) {
		return strconv(str);
	});
	db.create_function('STRCONV', function(str, opt) {
		return strconv(str, opt);
	});

	// ACFinder 互換 regexp
	db.create_function('REGEXP', function(pattern, target) {
		return _regexp(pattern, target);
	});
	db.create_function('REGEXP', function(pattern, target, opt) {
		return _regexp(pattern, target, opt);
	});

/*
		// values MACTH pattern: json array 対応日本語あいまい検索 LIKE
	db.create_function('MATCH', function(pattern, values) {
		return vagueMaches(pattern, values);
	});
	// MATCH(pattern, p1, p2 ...): % ワイルドカードのみ使える複数対象対応日本語あいまい検索 LIKE
	registerMultiArityFunction(db, 'MATCH', 'col', 10, vagueMatches);
*/

	// LIKE_IN(value, patterns): json array 対応 % ワイルドカードのみ使える複数パターン対象 IN
	db.create_function('LIKE_IN', function(value, patterns) {
		return definiteLikeIn(value, patterns);
	});
	// LIKE_IN(col, p1, p2 ... ,p10): % ワイルドカードのみ使える複数パターン対象 IN
	registerMultiArityFunction(db, 'LIKE_IN', 'col', 10, definiteLikeIn);

	// 正規表現の置換
	db.create_function('RE_REPLACE', function(pattern, target, replacement) {
		return target.replace(new RegExp(pattern, 'g'), replacement);
	});

	// ACfinder 互換 concat は廃止 今後は n_concat を使ってね
	db.create_function('N_CONCAT', function(con, args) {
		return n_concat(con, args);
	});
	// N_CONCAT(con, p1, p2, ... ,p10): ACFinder の scalar concat 相当。重複文字列は連結しない。
	registerMultiArityFunction(db, 'N_CONCAT', 'con', 10, n_concat);

	// ACfinder 互換 concat2 は廃止 今後は d_concat または sqlite 標準 concat_ws を使ってね
	// D_CONCAT(con, args): SQLite3 の concat_ws と等価。連結文字列の重複を許容。
	db.create_function('D_CONCAT', function(con, args) {
		return d_concat(con, args);
	});
	// D_CONCAT(con, p1, p2 ... ,p10): ACFinder の scalar concat2 相当
	registerMultiArityFunction(db, 'D_CONCAT', 'con', 10,d_concat);

	// ACFinder 互換 aggregate concat スカラー関数と重複する名前は使用できないため gn_concat に変更
	db.create_aggregate('GN_CONCAT', {
		init: () => '',
		step: (res, con, col) => {
			if (con === null || con === '') {
				throw 'Invalid argument to function gn_concat(): first argument is not allowed null or empty string';
			} else if (col !== null && col !== '') {
				const recon = preg_quote(con);
				let pats = col.split(con);
				for (const s of pats) {
					let pat = preg_quote(s);
					//console.log(pat);
					let re = new RegExp(`(^|${recon})${pat}(${recon}|$)`);
					//console.log(re);
					if (!res.match(re)) res += res ? con + s : s;
				}
			}
			return res;
		},
		finalize: res => res
	});

	// ACFinder 互換 aggregate d_concat スカラー関数と重複する名前は使用できないため gd_concat に変更
	db.create_aggregate('GD_CONCAT', {
		init: () => '',
		step: (res, con, col) => {
			if (con === null || con === '') {
				throw 'Invalid argument to function gd_concat(): first argument is not allowed null or empty string';
			} else {
			  res += col === null || col === '' ? '' : res ? con + col : col;
			}
			return res;
		},
		finalize: res => res
	});

	console.log("User defined functions registered.");
}

//ローディング表示
async function waiting(sw = true, msg = '') {
	const obj = document.getElementById('loading');
	if (!obj) return;

	// #loading要素の中身が空の場合、ローダー要素を生成する
	if (obj.children.length === 0) {
		const loader = document.createElement('div');
		loader.classList.add('loader');
		obj.appendChild(loader);
		const msgP = document.createElement('p');
		obj.appendChild(msgP);
		const waitP = document.createElement('p');
		waitP.innerHTML = 'しばらくお待ちください。';
		obj.appendChild(waitP);
	}

	if (sw) {
		if (!msg) msg = 'データベースダウンロード中';
		obj.getElementsByTagName('p')[0].innerHTML = msg;
		obj.style.display = 'block';
		// メッセージ変更を確実にブラウザへ描画させるための yield
		await new Promise(resolve => setTimeout(resolve, 50));
	} else {
		obj.style.display = 'none';
	}
}

//DBオブジェクト初期化
function initDB() {
	registerCustomFunctions(); // ユーザ定義関数を登録
	db.run('pragma temp_store = 2;'); // テンポラリファイルをメモリに作成するよう変更
	console.log("Database initialized.");
	lastUpdate = db.exec("select * from info where item = 'LastUpdate'")[0].values[0][1];

	const isIframe = window.self !== window.top;
	// iframe内にいる場合は親ウィンドウのdocumentを、そうでなければ自身のdocumentを対象にする
	const targetDocument = isIframe ? window.parent.document : document;
	const dbUpdateElement = targetDocument.querySelector('#db-update');

	if (dbUpdateElement) {
		// 過去データ参照モード（historical-modeクラスがある場合）は、ここでは上書きしない
		if (!dbUpdateElement.classList.contains('historical-mode')) {
			dbUpdateElement.innerHTML = (dbStatusCached ? '保存DB:' : '最新DB:') + lastUpdate;
			if (dbStatusCached) dbUpdateElement.className = 'cached-mode';
		}
		// クリックイベントを追加（重複登録防止のため一旦削除）
		dbUpdateElement.removeEventListener('click', showReleaseDialog);
		dbUpdateElement.addEventListener('click', showReleaseDialog);
	}
}

//attach sub database
//async function attachDB(sdb, name) {
function attachDB(sdb, name) {
	let fsdb = sdb.exec('pragma database_list;')[0].values[0][2];
	//await db.run(`attach database ${fsdb.split('/').pop()} as ${name};`);
	db.run(`attach database ${fsdb.split('/').pop()} as ${name};`);
	console.log(`Attatch ${name}`);
}

//unzip
async function unzip(abuf, name) {
	const dbname = name.split('.').shift() + '.db';
	const zip = await new JSZip().loadAsync(abuf);
	const res = await zip.files[dbname].async('uint8array');
	return res;
}

// SQL を url から読んで実行（何も返さない）
async function execSQLLoadFromURL(url) {
	try {
		const response = await fetch(url);
		if (!response.ok) throw new Error(`レスポンスステータス: ${response.status}`);
		db.run(await response.text());
		console.log('Executed: ' + url);
	} catch (error) {
		console.error(error.message);
	}
}

// SQLファイルをロードして実行する関数（Promiseを返す）
function ExecSQLLoadFromFile(sqlfile) {
		return new Promise((resolve, reject) => {
				fetch(sqlfile)
				.then(response => response.text())
				.then(data => {
						try {
								db.run(data);
								//console.log(data);
								resolve(data);  // 成功時は処理したデータを返す
						} catch (err) {
								console.log(err);
								reject(err);	// SQL実行中のエラーをreject
						}
				})
				.catch(error => {
						console.log(error);
						reject(error);	  // fetch処理中のエラーをreject
				});
		});
}

function convTemplate(sql) {
	// 先頭の/* @template: {...} or [...] */コメントを抽出
	const commentRegex = /^\/\*\s*@template: (\{[\s\S]*?\}|\[\s*\{[\s\S]*?\}\s*\])\s*\*\//m;
	const match = sql.match(commentRegex);
	
	if (!match) {
		return sql; // テンプレートがない場合はそのまま返す
	}

	// JSONパース
	let configs;
	try {
		configs = JSON.parse(match[1]);
		// 単一オブジェクトの場合は配列に変換
		configs = Array.isArray(configs) ? configs : [configs];
	} catch (e) {
		throw new Error('Invalid JSON in template instruction: ' + e.message);
	}

	// SQLを一行ずつ分割
	const lines = sql.split('\n');
	let output = [];
	let inTargetView = false;
	let currentViewName = '';
	let currentPatternRegex = null;
	let currentTemplate = '';

	// ビュー定義の開始を検出
	const viewStartRegex = /^\s*(?:CREATE\s+(?:TEMP\s+)?VIEW\s+(\w+)\s+AS\s*)/i;

	for (let line of lines) {
		// ビュー定義の開始をチェック
		const viewMatch = line.match(viewStartRegex);
		if (viewMatch) {
			currentViewName = viewMatch[1];
			inTargetView = false;
			currentPatternRegex = null;
			currentTemplate = '';

			// 現在のビューに対応するテンプレートを探す
			for (const config of configs) {
				if (config.views.includes(currentViewName)) {
					inTargetView = true;
					currentPatternRegex = new RegExp(config.pattern, 'g');
					currentTemplate = config.template;
					break;
				}
			}
		}

		// 対象ビュー内でパターンマッチングと置換
		if (inTargetView && currentPatternRegex) {
			line = line.replace(currentPatternRegex, (match, group1) => {
				return currentTemplate.replace(/\$1/g, group1);
			});
		}

		// ビュー定義の終了をチェック
		if (line.trim().endsWith(';')) {
			inTargetView = false;
			currentViewName = '';
			currentPatternRegex = null;
			currentTemplate = '';
		}

		output.push(line);
	}

	return output.join('\n');
}

// タブ専用 view 等の設定
async function setTabViews() {
	if (!db) {
		console.log('setTabViews: Database is not loaded.');
		return;
	}
	const viewScriptElement = document.getElementById('views_or_tables');
	if (!viewScriptElement) {
		console.log('setTabViews: Element with id "views_or_tables" not found.');
		return;
	}

	let sqlContent = '';
	// src属性がある場合はfetchで外部ファイルを取得、なければtextContentから取得
	if (viewScriptElement.src) {
		try {
			const response = await fetch(viewScriptElement.src);
			if (!response.ok) throw new Error(`Failed to fetch view SQL from ${viewScriptElement.src}: ${response.statusText}`);
			sqlContent = await response.text();
		} catch (error) {
			console.error(error);
			return;
		}
	} else {
		sqlContent = viewScriptElement.textContent;
	}

	let sql = convTemplate(sqlContent);
	if (sql) db.run(sql);
}

// ファイルのベース名取得
function basename(filename) {
	const parts = filename.split('/').pop().split('.');
	// 最後の要素（拡張子）を除いた部分を結合して返す
	return parts.length > 1 ? parts.slice(0, -1).join('.') : parts[0];
}

// DB ロード(新版): サーバ DB ファイルと IndexedDB 保存ファイルのタイムスタンプを比較して、サーバが新しければサーバからフェッチ、それ以外なら IndexedDB からロード
async function fetchDB() {
	//if (local || db !== null) return Promise.resolve();
	if (local || db !== null) return;

	const fcDB = await openDB('fileCacheDB');
	
	const files = [
		{ fileName: `${maindb}.zip`, serverUrl: `${datdir}${maindb}.zip` },
		{ fileName: `${subdb}.zip`, serverUrl: `${datdir}${subdb}.zip` },
		//{ fileName: 'option.db', serverUrl: 'option.db' }, //ここに ATTACH するサブデータベースファイルを複数追加可能
		{ fileName: 'init_create_view.sql', serverUrl: 'init_create_view.sql' }
	];

	await waiting(true);
	let errorOccurred = false;
	try {
		console.log('Starting fetchOrLoadFile for all files...');
		const results = await Promise.all(
			files.map(file => fetchOrLoadFile(fcDB, file.fileName, file.serverUrl, false))
		);
		const blobs = results.map(r => r.blob);
		dbStatusCached = results[0].isFallback;
		console.log('All files fetched/loaded.');
		
		// sql-wasm.js のスクリプトタグからパスを特定(ファイル名が sql-wasm.min.js や sql.js の場合にも対応できるよう検索条件を緩和)
		const sqlJsScript = Array.from(document.scripts).find(s => s.src && (s.src.includes('sql-wasm') || s.src.includes('sql.js')));
		if (!sqlJsScript) {
			throw new Error("sql.jsのスクリプトタグが見つかりませんでした。");
		}
		const sqlJsPath = sqlJsScript.src.substring(0, sqlJsScript.src.lastIndexOf('/') + 1);
		if (debug) console.log(sqlJsPath);
		
		console.log('Initializing SQL.js...');
		await waiting(true, 'SQLエンジン初期化中...');
		const SQL = await initSqlJs({ locateFile: filename => `${sqlJsPath}${filename}` });
		
		//メイン DB ロード
		console.log('Loading main DB...');
		await waiting(true, 'メインデータベース読込中...');
		var dbname = basename(files[0].fileName) + '.db';
		db = new SQL.Database(await unzip(new Uint8Array(await blobs[0].arrayBuffer()), dbname));
		initDB();
		console.log(`Main database loaded from ${dbname}.`);
		
		//サブ DB ロード & attach
		for(let j = 1; j < files.length - 1; j++) {
			console.log(`Attaching sub DB ${files[j].fileName}...`);
			await waiting(true, `サブデータベース読込中: ${files[j].fileName}`);
			dbname = basename(files[j].fileName) + '.db';
			let content = new Uint8Array(await blobs[j].arrayBuffer());
			if (files[j].fileName.split('.').pop() == 'zip') content = await unzip(content, dbname);
			await attachDB(new SQL.Database(content), basename(files[j].fileName));
			console.log(`Sub database attached from ${dbname}.`);
		}
		
		// init_create_view 実行
		//await execSQLLoadFromURL('init_create_view.sql');
		const sqlFileIndex = files.length - 1;
		console.log(`Executing SQL file ${files[sqlFileIndex].fileName}...`);
		await waiting(true, 'データ構築中...');
		const transformedSql = convTemplate(await blobs[sqlFileIndex].text());
		//console.log(transformedSql);
		await db.run(transformedSql);
		console.log(`Executed ${files[sqlFileIndex].fileName}.`);
		await setTabViews();

		// キャッシュ利用が発生したファイルがあれば通知
		const fallbackFiles = results.filter(r => r.isFallback).map(r => r.fileName);
		if (fallbackFiles.length > 0) {
			alert(`ネットワーク制限またはタイムアウトにより、以下のファイルの更新確認ができませんでした。キャッシュされているデータを使用します：\n・${fallbackFiles.join('\n・')}\n\n最新のデータではない可能性があります。`);
		}

		console.log('fetchDB completed.');
	} catch (error) {
		console.error('Error in fetchDB:', error);
		await waiting(true, 'エラーが発生しました。<br>' + error.message);
		errorOccurred = true;
	} finally {
		fcDB.close();
		if (!errorOccurred) await waiting(false);
		//return Promise.resolve();
	}
}

// GitHubからリリース一覧を取得してダイアログ表示
async function showReleaseDialog() {
	const dialogId = 'release-menu';
	let dialog = document.getElementById(dialogId);
	
	if (!dialog) {
		dialog = document.createElement('dialog');
		dialog.id = dialogId;
		dialog.className = 'menu-dialog';
		dialog.style.outline = 'none'; // 初回表示時（フォーカス時）の太い外郭線を消す
		document.body.appendChild(dialog);
	}

	dialog.innerHTML = '<div class="menu-container"><p>リリース一覧を取得中...</p></div>';
	dialog.showModal();

	try {
		// CORSエラー回避のため単純な fetch を使用
		const response = await fetch('https://api.github.com/repos/macs-labo/macs/releases', {
			mode: 'cors',
			credentials: 'omit'
		});
		if (!response.ok) throw new Error('リリース一覧の取得に失敗しました。');
		const releases = await response.json();
		// releases を tag ASCII コードの降順にソート
		releases.sort((a, b) => b.tag_name.localeCompare(a.tag_name));

		dialog.innerHTML = `
			<div class="menu-container">
				<ul class="menu-list">
					<li class="menu-item menu-item-latest">
						<div class="menu-item-name">🔄 最新版に戻す (キャッシュから復元)</div>
					</li>
					${releases.slice(1).map(rel => `
						${(() => {
							const acisAsset = rel.assets.find(asset => asset.name === 'acis.zip');
							if (!acisAsset) return ''; // acis.zip が含まれないリリースはスキップ
							return `
						<li class="menu-item"
							data-tag="${rel.tag_name}"
							data-asset-url="${acisAsset.url}"
							data-release-name="${rel.name.replace('Release ', '')}"
							>
							<div class="menu-item-name">${rel.name.replace('Release ', '')}</div>
							<!-- タグ情報は表示しない -->
						</li>
							`;
						})()}
					`).join('')}
				</ul>
			</div>
			<form method="dialog"><span>過去のデータベースを選択</span><button style="outline:none;">閉じる</button>
			</form>
		`;

		// 最新版に戻すボタンのイベント
		dialog.querySelector('.menu-item-latest').addEventListener('click', async () => {
			dialog.close();
			await loadLatestFromCache();
		});

		dialog.querySelectorAll('.menu-item[data-tag]').forEach(item => {
			item.addEventListener('click', async () => {
				const tag = item.dataset.tag;
				const releaseName = item.dataset.releaseName;
				dialog.close();
				await loadHistoricalDB(tag, releaseName);
			});
		});
	} catch (error) {
		dialog.innerHTML = `<div class="menu-container"><p class="error">エラー: ${error.message}<br><small>ローカルファイル(file://)として実行している場合は、外部への接続がブラウザに制限されます。</small></p></div><form method="dialog"><button>閉じる</button></form>`;
	}

	// ダイアログの外側をクリックしたときに閉じる
	dialog.addEventListener('click', (event) => {
		if (event.target === dialog) {
			dialog.close();
		}
	});
}

// キャッシュ(IndexedDB)からファイルを取得する内部ヘルパー
async function getFileFromCache(fcDB, fileName) {
	const localFile = await getLocalFile(fcDB, fileName);
	if (!localFile || !localFile.blob) throw new Error(`${fileName} がキャッシュに見つかりません。`);
	
	let storedData = localFile.blob;
	// Base64デコード処理（fetchOrLoadFileのロジックを流用）
	if (typeof storedData === 'string' && storedData.startsWith('data:')) {
		const parts = storedData.split(',');
		const mime = parts[0].match(/:(.*?);/)[1];
		const base64 = parts[1];
		const binary = atob(base64);
		const uint8Array = new Uint8Array(binary.length);
		for (let i = 0; i < binary.length; i++) {
			uint8Array[i] = binary.charCodeAt(i);
		}
		storedData = new Blob([uint8Array], { type: mime });
	}
	return storedData;
}

// 過去のデータベースをロード
async function loadHistoricalDB(tag, releaseName) {
	
	await waiting(true, `${releaseName} を取得中...`);
	const fcDB = await openDB('fileCacheDB');

	try {
		// 1. 指定された過去の acis.zip を github raw ドメインから取得
		const githubRawDataUrl = `https://raw.githubusercontent.com/macs-labo/macs/${tag}/data/acis.zip`;
		const { blob: acisBlob, lastModified } = await fetchFile(githubRawDataUrl);
		
		// 2. 必要な他のファイル（spec, sql）は既存の IndexedDB から取得
		const specBlob = await getFileFromCache(fcDB, `${subdb}.zip`);
		const sqlBlob = await getFileFromCache(fcDB, 'init_create_view.sql');

		// 3. 現在のDBを閉じる
		if (db) db.close();

		// 4. SQL.js 再構築
		const sqlJsScript = Array.from(document.scripts).find(s => s.src && (s.src.includes('sql-wasm') || s.src.includes('sql.js')));
		const sqlJsPath = sqlJsScript.src.substring(0, sqlJsScript.src.lastIndexOf('/') + 1);
		const SQL = await initSqlJs({ locateFile: filename => `${sqlJsPath}${filename}` });

		await waiting(true, '過去データを展開中...');
		db = new SQL.Database(await unzip(new Uint8Array(await acisBlob.arrayBuffer()), 'acis.db'));

		const dbUpdateElement = document.querySelector('#db-update');
		if (dbUpdateElement) {
			dbUpdateElement.classList.add('historical-mode');
			dbUpdateElement.innerHTML = `⚠️過去参照: ${releaseName.replace('Release ', '').replace(/分$/, '')}`;
		}

		initDB();
		// サブDBアタッチ & ビュー作成
		await attachDB(new SQL.Database(await unzip(new Uint8Array(await specBlob.arrayBuffer()), 'spec.db')), 'spec');
		const transformedSql = convTemplate(await sqlBlob.text());
		await db.run(transformedSql);
		await setTabViews();

	} catch (error) {
		console.error('Error loading historical DB:', error);
		alert('データベースの切り替えに失敗しました。\n' + error.message);
	} finally {
		fcDB.close();
		await waiting(false);
	}
}

// キャッシュされている最新のデータベースをロードして復元
async function loadLatestFromCache() {
	await waiting(true, '最新データを復元中...');
	const fcDB = await openDB('fileCacheDB');
	
	try {
		// IndexedDBから全ファイルを取得
		const acisBlob = await getFileFromCache(fcDB, `${maindb}.zip`);
		const specBlob = await getFileFromCache(fcDB, `${subdb}.zip`);
		const sqlBlob = await getFileFromCache(fcDB, 'init_create_view.sql');

		if (db) db.close();

		const sqlJsScript = Array.from(document.scripts).find(s => s.src && (s.src.includes('sql-wasm') || s.src.includes('sql.js')));
		const sqlJsPath = sqlJsScript.src.substring(0, sqlJsScript.src.lastIndexOf('/') + 1);
		const SQL = await initSqlJs({ locateFile: filename => `${sqlJsPath}${filename}` });

		// メイン DB
		db = new SQL.Database(await unzip(new Uint8Array(await acisBlob.arrayBuffer()), 'acis.db'));

		// 過去データ表示モードを解除
		const dbUpdateElement = document.querySelector('#db-update');
		if (dbUpdateElement) {
			dbUpdateElement.classList.remove('historical-mode');
		}

		initDB();

		// サブ DB アタッチ
		let specContent = new Uint8Array(await specBlob.arrayBuffer());
		specContent = await unzip(specContent, 'spec.db');
		await attachDB(new SQL.Database(specContent), 'spec');

		// ビュー再構築
		const transformedSql = convTemplate(await sqlBlob.text());
		await db.run(transformedSql);
		await setTabViews();

	} catch (error) {
		console.error('Error restoring latest DB:', error);
		alert('データの復元に失敗しました。ページをリロードしてください。\n' + error.message);
	} finally {
		fcDB.close();
		await waiting(false);
	}
}

function getCurrentTheme() {
	const osColorScheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
	return localStorage.getItem('theme') || osColorScheme;
}

function openCautionDialog() {
	if (document.querySelector('#resultPane .caution-dialog')) return;
	const resultPane = document.getElementById('resultPane');
	if (!resultPane || cautionDate <= Number(localStorage.getItem('caution'))) return;
	const cautionDiv = document.createElement('div');
	cautionDiv.className = 'caution-dialog';
	cautionDiv.innerHTML = `
		<h3 class="caution-title">使用上の注意事項</h3>
		<ul>
			<li>当サイト(携帯農薬検索実験室)が本サービスで提供する情報は、FAMIC(独立行政法人農林水産消費安全技術センター)ホームページから取得した農薬登録情報を当サイトで加工し、検索できるようにしたものです。</li>
			<li>情報取得先であるFAMICは、FAMICホームページの情報を用いて当サイトが行う本サービスの提供等の一切の行為により、直接または間接的に生じた利用者またはそれ以外の第三者の損害については、その内容、方法の如何にかかわらず、一切責任を負いません。</li>
			<li>当サイト運営者は、FAMICホームページから取得した農薬登録情報の加工及び検索に万全を期していますが、本サービスを利用した結果いかなる損害が発生したとしても、一切責任を負いません。</li>
			<li>本サービスが使用するデータベースおよびプログラムのソースコードは MIT ライセンスで公開していますが、サービスの持続性確保のため、必ず「<a href="https://github.com/macs-labo/macs#readme" target="_blank">利用規約</a>」をご確認の上、不具合報告等のメインテナンスへの協力をお願いします。</li>
			</ul>
		<div>
			<button id="accept-caution" disabled>承諾</button>
			<span>利用規約へのリンクをクリックすると、「承諾」ボタンが有効化されます。本注意事項を表示したままでも利用可能ですが、「承諾」いただくと以後非表示になります。</span>
		</div>
	`;
	resultPane.appendChild(cautionDiv);

	const readmeLink = cautionDiv.querySelector('a');
	const acceptBtn = cautionDiv.querySelector('#accept-caution');
	readmeLink.addEventListener('click', () => {
		acceptBtn.disabled = false;
	});

	acceptBtn.addEventListener('click', function() {
		localStorage.setItem('caution', Date.now());
		cautionDiv.remove();
		const cautionLink = document.querySelector('#caution a');
		if (cautionLink) cautionLink.className = 'accepted';
	});
}

// テーマ適用（カスタムCSS含む）
// カスタムCSS適用（CSS優先度確保のため DOMContentLoaded で実行）
window.addEventListener('DOMContentLoaded', () => {
	const activeCss = localStorage.getItem('active_theme_css');
	if (activeCss) {
		let style = document.getElementById('user-custom-css-tag');
		if (!style) {
			style = document.createElement('style');
			style.id = 'user-custom-css-tag';
			document.head.appendChild(style);
		}
		style.textContent = activeCss;
	}
});

// 他のタブでのテーマ変更を検知して反映
window.addEventListener('storage', (event) => {
	if (event.key === 'theme') {
		const theme = event.newValue;
		document.documentElement.setAttribute('data-theme', theme);
		if (typeof editor !== 'undefined' && editor) {
			editor.setOption('theme', theme === 'dark' ? 'darcula' : 'eclipse');
		}
		if (typeof tables !== 'undefined' && tables) {
			const htTheme = 'ht-theme-classic' + (theme === 'dark' ? '-dark' : '');
			const tableList = Array.isArray(tables) ? tables : [tables];
			tableList.forEach(table => {
				if (table && typeof table.updateSettings === 'function') {
					table.updateSettings({ themeName: htTheme });
					table.render();
				}
			});
		}
	} else if (event.key === 'active_theme_css') {
		let style = document.getElementById('user-custom-css-tag');
		if (!style) {
			style = document.createElement('style');
			style.id = 'user-custom-css-tag';
			document.head.appendChild(style);
		}
		style.textContent = event.newValue;
	} else if (event.key === 'caution') {
		// 他のタブで「承諾」された場合、ダイアログを消して表示を更新する
		const cautionDiv = document.querySelector('#resultPane .caution-dialog');
		if (cautionDiv) cautionDiv.remove();
		
		const cautionLink = document.querySelector('#caution a');
		if (cautionLink) cautionLink.className = 'accepted';
	}
});

// タブの実行状況
let tabExecuted = false;

// DOM読込完了時の初期設定
window.addEventListener('DOMContentLoaded', function() {

	// iframe内で実行されている場合は、UI関連の初期化をスキップ
	const isIframe = window.self !== window.top;

	const fileName = window.location.pathname.split('/').pop();

	if (!isIframe) {
		// ドキュメントタイトル設定
		const currentTab = tabs.find(tab => tab.file === fileName);
		if (currentTab) {
			document.title = `${currentTab.name}/ACFinder`;
		}

		// タイトルバー設定
		const titleBar = document.getElementById('title-bar');
		const tabHeader = document.createElement('div');
		tabHeader.className = 'tab_header';
		titleBar.appendChild(tabHeader);
		const titleWrapper= document.createElement('div');
		const title = document.createElement('h1');
		title.textContent = 'ACFinderBE';
		titleWrapper.appendChild(title);
		const version = document.createElement('span');
		const baseUrl = 'https://raw.githubusercontent.com/macs-labo/macs/main/acfinder';
		version.innerHTML = `Release <a href="${baseUrl}/acfinder${appVer}.zip">${appVer}</a>`;
		titleWrapper.appendChild(version);
		titleBar.appendChild(titleWrapper);
		const subtitle = document.createElement('h2');
		const year = new Date().getFullYear();
		subtitle.innerHTML = `Agricultural Chemicals Finder / Browser Edition<br/>&copy; 2025-${year} TEAM ACFinder / Licensed under the MIT License`;
		titleBar.appendChild(subtitle);
		const dataWrapper= document.createElement('div');
		const dbUpdate =  document.createElement('p');
		dbUpdate.id = 'db-update';
		dataWrapper.appendChild(dbUpdate);
		titleBar.appendChild(dataWrapper);
 		const caution = document.createElement('span');
		caution.id = 'caution';
		caution.innerHTML = '<a href="#" class="unaccepted">使用上の注意事項</a>';
		dataWrapper.appendChild(caution);
		setCautionClass();
		//titleBar.appendChild(caution);

		function setCautionClass() {
			const a = caution.querySelector('a');
			const accepted = localStorage.getItem('caution') || false;
			a.className = accepted ? 'accepted' : 'unaccepted';
		}

		caution.addEventListener('click', () => {
			localStorage.removeItem('caution');
			setCautionClass();
			openCautionDialog();
		});

		// 現在のタブ名を表示
		const currentTabName = document.createElement('span');
		currentTabName.className = 'current-tab-name';
		currentTabName.textContent = currentTab ? currentTab.name : '';
		tabHeader.appendChild(currentTabName);

		// 「＋」ボタンを追加
	/* // ノーマルボタン
		const addButton = document.createElement('button');
		addButton.className = 'add-tab-button';
		addButton.innerHTML = '＋';
		addButton.title = '新しいタブを開く';
		tabHeader.appendChild(addButton);
	*/
		// svg ボタン
		const addButton = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
		addButton.classList.add('add-tab-button');
		addButton.classList.add('svg_button');
		const hint = document.createElementNS('http://www.w3.org/2000/svg', 'title');
		hint.textContent = '新しいタブを開く';
		addButton.appendChild(hint);
		const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
		use.setAttributeNS('http://www.w3.org/1999/xlink', 'href', 'icons.svg#plus');
		addButton.appendChild(use);
		tabHeader.appendChild(addButton);

		// ダイアログ要素を生成
		const dialog = document.createElement('dialog');
		dialog.id = 'tab-menu';
		dialog.className = 'menu-dialog';
		dialog.style.outline = 'none'; // 初回表示時（フォーカス時）の太い外郭線を消す
		dialog.innerHTML = `
			<div class="menu-container">
				<ul id="menu-list" class="menu-list"></ul>
			</div>
			<form method="dialog">
				<span>新しく開くタブを選択</span><button style="outline:none;">閉じる</button>
			</form>
		`;
		document.body.appendChild(dialog);

		// ダイアログのメニューリストを生成
		const menuList = dialog.querySelector('#menu-list');
		tabs.forEach(option => {
			const item = document.createElement('li');
			item.className = 'menu-item';
			item.innerHTML = `<div class="menu-item-name">${option.name}</div><div class="menu-item-title">${option.title}</div>`;
			item.addEventListener('click', () => {
				window.open(option.file, tabExecuted ? '_blank' : '_self');
				dialog.close();
			});
			menuList.appendChild(item);
		});

		// 「＋」ボタンでダイアログを開く
		addButton.addEventListener('click', () => {
			dialog.showModal();
		});

		// ダイアログの外側をクリックしたときに閉じる
		dialog.addEventListener('click', (event) => {
			if (event.target === dialog) {
				dialog.close();
			}
		});
	}

	// ローダー画面設定
	const loading = document.getElementById('loading');
	if (loading) {
		loading.id = 'loading';
		const loader = document.createElement('div');
		loader.classList.add('loader');
		loading.appendChild(loader);
		const msg = document.createElement('p');
		loading.appendChild(msg);
		const wait = document.createElement('p');
		wait.innerHTML = 'しばらくお待ちください。';
		loading.appendChild(wait);
	}

});

// ページロード完了時の初期設定
window.addEventListener('DOMContentLoaded', async function() {

	// conditionpane が存在すれば conditionpane 開閉機能設定
	document.getElementById('sideToggler')?.remove(); // #sideToggler があれば削除
	const conditionPane = document.getElementById('conditionPane');
	if (conditionPane) {
		const sideToggler = document.createElement('div');
		sideToggler.id = 'sideToggler';
		sideToggler.title = 'サイドバーを開閉';
		sideToggler.innerHTML = '◀▶';
		conditionPane.parentNode.insertBefore(sideToggler, conditionPane);

		// サイドバー開閉イベントハンドラ
		sideToggler.addEventListener('click', () => {
			sideToggler.classList.toggle('closed');
			conditionPane.classList.toggle('closed');
			document.querySelector('.splitter')?.classList.toggle('closed');
		});
	}

	// resultTop が存在すれば resultTop 開閉機能設定
	document.getElementById('topToggler')?.remove(); // #topToggler があれば削除
	const resultTop = document.getElementById('resultTop');
	if (resultTop) {
		const topToggler = document.createElement('div');
		topToggler.id = 'topToggler';
		topToggler.title = '結果ペイン上部を開閉';
		topToggler.innerHTML = '▲▼';
		resultTop.parentNode.insertBefore(topToggler, resultTop);

		// トップ開閉機イベントハンドラ
		topToggler.addEventListener('click', () => {
			topToggler.classList.toggle('closed');
			resultTop.classList.toggle('closed');
		});
	}

	// conditionPane, resultpane が存在すれば、リサイズ機能設定
	//const conditionPane = document.getElementById('conditionPane');
	const resultPane = document.getElementById('resultPane');

	if (conditionPane && resultPane) {
		const splitter = document.createElement('div');
		splitter.classList.add('splitter');
		conditionPane.parentNode.insertBefore(splitter, resultPane);

		// 保存された幅の復元
		const sidebarWidth = localStorage.getItem('sidebarWidthRestore') || '0';
		const fileName = window.location.pathname.split('/').pop();
		const widthKey = `conditionPaneWidth_${fileName}`;
		const savedWidth = localStorage.getItem(widthKey);
		if (sidebarWidth === '1' && savedWidth) {
			conditionPane.style.width = savedWidth;
			conditionPane.style.flex = 'none';
		}

		let isResizing = false;

		splitter.addEventListener('mousedown', function(e) {
			isResizing = true;
			splitter.classList.add('dragging');
			document.body.style.cursor = 'col-resize';
			document.body.style.userSelect = 'none'; // テキスト選択防止
		});

		document.addEventListener('mousemove', function(e) {
			if (!isResizing) return;
			const newWidth = e.clientX - conditionPane.getBoundingClientRect().left;
			//if (newWidth > 100) { // 最小幅制限
				conditionPane.style.width = newWidth + 'px';
				conditionPane.style.flex = 'none';
			//}
		});

		document.addEventListener('mouseup', function(e) {
			if (isResizing) {
				isResizing = false;
				splitter.classList.remove('dragging');
				document.body.style.cursor = '';
				document.body.style.userSelect = '';

				// 幅の保存
				if (sidebarWidth === '1') localStorage.setItem(widthKey, conditionPane.style.width);
			}
		});
	}

	// 注意事項未承諾の場合、resultPane に注意事項を表示
	openCautionDialog();

});
