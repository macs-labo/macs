/* 共通ヘッダ用グローバル変数 */

// バージョン
const appVer = '2026.0331.1111';
const debug = !window.location.href.includes('/acfinder/');

// 基本タブメニュー設定
// ここに、ファイル名とタブ名を設定することで、オリジナルタブを追加可能
let tabs = [
	{ name: '作物', file: 'crop.html', title: '作物名から農薬を検索' },
	{ name: '病害虫', file: 'pest.html', title: '病害虫名等から農薬を検索' },
	{ name: '薬剤', file: 'chem.html', title: '農薬名等から農薬を検索' },
	{ name: 'SQL', file: 'sql.html', title: '農薬DBをカスタム検索' },
	{ name: '防除計画', file: 'pestplan.html', title: '防除計画(防除暦)作成支援ツール' },
	{ name: '農薬病害虫対応表', file: 'pesticides-pests.html', title: '複数の病害虫に対する各農薬の対応表を作成' },
	{ name: '農薬作物対応表', file: 'pesticides-crops.html', title: '複数の作物に対する各農薬の対応表を作成' },
	{ name: 'RAC作用機構', file: 'rac_moa.html', title: '薬剤のRAC作用機構分類表を作成(複数作物指定時 AND 検索)' },
	{ name: '飼料用稲・籾米', file: 'feedrice.html', title: 'WCS用稲や出穂期以降の飼料用籾米に使用可能な薬剤の検索' },
	{ name: 'ローカル', file: 'proc.html', title: 'PC上のタブファイルを実行' },
	{ name: '設定', file: 'prop.html', title: '各種動作モード設定' }
];

// FOUC (Flash of Unstyled Content) を防ぐため、CSS読み込み前にテーマを適用
(function() {
	const theme = localStorage.getItem('theme') || 'light';
	document.documentElement.setAttribute('data-theme', theme);
})();
