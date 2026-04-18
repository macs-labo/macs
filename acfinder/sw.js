const CACHE_NAME = 'acfinder-assets-v2'; // バージョンを上げる
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
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE))
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
      return response || fetch(event.request);
    })
  );
});