<?php
// CORSポリシーを迂回するためのプロキシスクリプト

// エラー表示設定（開発時のみ有効にする）
// error_reporting(E_ALL);
// ini_set('display_errors', 1);

// ヘッダー設定
// ダウンロードするファイルタイプを指示
header('Content-Type: application/octet-stream');
// ファイル名を指定 (適宜変更可能だが、今回は acis.zip 固定)
header('Content-Disposition: attachment; filename="acis.zip"');

// URLパラメータからGitHubのリリースダウンロードURLを取得
$github_url = $_GET['url'] ?? '';

// URLのバリデーション
if (empty($github_url) || !filter_var($github_url, FILTER_VALIDATE_URL) || !str_starts_with($github_url, 'https://github.com/macs-labo/macs/releases/download/')) {
    http_response_code(400);
    echo "Bad Request: Missing or invalid 'url' parameter.";
    exit;
}

// GitHubからのファイルダウンロード（サーバー側で実施）
// User-Agentを設定しないとGitHubがブロックすることがある
$options = [
    'http' => [
        'method' => 'GET',
        'header' => "User-Agent: PHP/" . PHP_VERSION . "\r\n" // GitHubはUser-Agentを要求することがある
    ]
];
$context = stream_context_create($options);
$file_content = @file_get_contents($github_url, false, $context);

if ($file_content === false) {
    http_response_code(500);
    echo "Failed to download file from GitHub. Check the URL and server logs.";
    exit;
}

echo $file_content;
?>
