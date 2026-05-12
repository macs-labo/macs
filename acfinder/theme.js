/**
 * ACFinderBE 共通テーマ定義・適用スクリプト
 */

// テーマの定義データ
const colorThemes = [
	{ name: 'light', title: '標準ライトテーマ', css: '' },
	{ name: 'light-cyan-stripe', title: 'シアン・ストライプ(簿記ソフト準拠)',
css: `:root {
	/* シアン・ストライプ（簿記ソフト準拠・偶数行青色強調） */
	--bg-color-title-bar: #ecf7f7;       /* タイトルバー背景色 */
	--bg-color: #ffffff;                 /* 基本背景色 */
	--bg-color-even-row: #e4efef;        /* 偶数行背景色 */
	--bg-color-filter-header: #70D0D0b0; /* フィルター列背景色（視認性向上のため少し濃く修正） */
	--bg-color-fixed-header: #70d0d050;  /* 固定列背景色 */
	--selection-border-color: #008b8b;   /* 選択罫線色 */
}` },
	{ name: 'light-soft-sepia', title: 'UDソフトセピア(眼精疲労軽減)',
css: `:root {
	/* UD ソフトセピア (眼精疲労軽減・光過敏配慮) */
	--bg-color-title-bar: #FFFCFA;      /* タイトルバー背景色（ほぼ白に近いセピア） */
	--bg-color: #f9f5f0;                /* 背景色（明るくクリアなセピア） */
	--text-color: #5d5045;              /* 通常文字色（柔らかい濃茶） */
	--text-color-dark: #3e352e;         /* 表頭文字色等の濃文字色 */
	--text-color-light: #8e8071;        /* タイトルバークレジット等の淡文字色 */
	--bg-color-disabled: #e8ded3;       /* 選択不可チェックボックス背景色 */
	--bg-color-button: #f1e9e0;         /* ボタン等の背景色 */
	--border-color: #d8cdbf;            /* 枠線色（主張しすぎないベージュ） */
	--border-color-strong: #bcae9f;     /* チェックボックス等枠線色 */
	--border-color-focus: #a6917c;      /* 入力中テキスト入力枠線色 */
	--bg-color-header: #f2e9df;         /* キャプション背景色 */
	--border-color-header: #d8cdbf;     /* キャプション枠線色 */
	--icon-color: #9c8b7c;              /* アイコン色 */
	--icon-color-hover: #5d5045;        /* ホバー中アイコン色 */
	--bg-color-icon-hover: #e8ded3;     /* ホバー中アイコン、ボタン背景色 */
	--border-color-ht-common: #e0d5c8;  /* 表枠線色 */
	--bg-color-ht-header: #ede2d5;      /* 表頭・ページネーション背景色 */
	--bg-color-even-row: #f2ece4;       /* 偶数行背景色（薄い縞模様） */
	--bg-color-filter-header: #EBD4C4;  /* フィルター列背景色（違和感解消のため調整） */
	--bg-color-fixed-header: #E8DBC0;   /* 固定列背景色（違和感解消のため調整） */
	--bg-color-highlighted-header: #e0d1c1; /* カーソル列表頭背景色 */
	--bg-color-active-header: #d9c5b0;  /* 操作中表頭背景色 */
	--selection-border-color: #a6917c;  /* 選択セル枠線色 */
	--scrollbar-track-color: #EDE2D5CC; /* スクロールバーの背景色 */
	--scrollbar-tumb-color: #A6917CCC;  /* スクロールバーのつまみ色 */
}` },
	{ name: 'light-sandbeige', title: 'UDサンドベージュ(眼精疲労軽減)',
css: `:root {
	/* UD サンドベージュ (眼精疲労軽減・光過敏配慮) */
	--bg-color-title-bar: #FAF3EB;      /* タイトルバー背景色 */
	--bg-color: #f4ece4;                /* 背景色（落ち着いたセピア） */
	--text-color: #544230;              /* 通常文字色 */
	--text-color-dark: #4F3E2D;         /* 表頭文字色等の濃文字色 */
	--text-color-light: #584633;        /* タイトルバークレジット等の淡文字色 */
	--bg-color-disabled: #d1b89d;       /* 選択不可チェックボックス背景色 */
	--bg-color-button: #ece0d1;         /* ボタン等の背景色 */
	--border-color: #9c846b;            /* 枠線色 */
	--border-color-strong: #886E4C;     /* チェックボックス等枠線色 */
	--border-color-focus: #6E593C;      /* 入力中テキスト入力枠線色 */
	--bg-color-header: #e3d5c5;         /* キャプション背景色 */
	--border-color-header: #9c846b;     /* キャプション枠線色 */
	--icon-color: #776043;              /* アイコン色 */
	--icon-color-hover: #413525;        /* ホバー中アイコン色 */
	--bg-color-icon-hover: #D4B78F;     /* ホバー中アイコン、ボタン背景色 */
	--border-color-ht-common: #BDAC99;  /* 表枠線色 */
	--bg-color-ht-header: #DFD0BF;      /* 表頭・ページネーション背景色 */
	--bg-color-even-row: #ece0d1;       /* 偶数行背景色 */
	--bg-color-highlighted-header: #C9B9A8; /* カーソル列表頭背景色 */
	--bg-color-active-header: #AD967E;  /* 操作中表頭背景色 */
	--bg-color-filter-header: #BCA288;  /* フィルター列表頭背景色 */
	--bg-color-fixed-header: #D5C0AB;   /* 固定列背景色 */
	--selection-border-color: #826948;  /* 選択セル枠線色 */
	--scrollbar-track-color: #DFD0BFCC; /* スクロールバーの背景色 */
	--scrollbar-tumb-color: #886E4CCC;  /* スクロールバーのつまみ色 */
}` },
	{ name: 'light-bule-orange', title: 'UDブルーオレンジ(P/D型色覚)',
css: `:root {
	/* UD ブルー・オレンジ (P/D型(1/2型)色覚配慮) / 反転文字使用禁止 */
	--bg-color-title-bar: #fffdf3;      /* タイトルバー背景色 */
	--bg-color-header: #fffdf3;         /* キャプション背景色 */
	--bg-color-even-row: #fff9e6;       /* 偶数行背景色 */
	--bg-color-filter-header: #ffd54f;  /* フィルター列背景色（P/D型向きの黄色） */
	--bg-color-fixed-header: #B9E7B0;   /* 固定列背景色 */
	--selection-border-color: #005aff;  /* 選択罫線色 */
	--db-update-text-color: #0041b0;    /* 更新文字色 */
}` },
	{ name: 'light-green-positive', title: 'UD ポジティブ・グリーン(T型色覚)',
css: `:root {
	/* UD ポジティブ・グリーン (T型(3型)色覚配慮) */
	--bg-color-title-bar: #F7FDF5;      /* タイトルバー背景色 */
	--bg-color-header: #e2f2d9;         /* キャプション背景色（視認性のため濃く修正） */
	--bg-color-even-row: #f0f9eb;       /* 偶数行背景色（視認性のため濃く修正） */
	--bg-color-filter-header: #c2e7b0;  /* フィルター列背景色（視認性のため濃く修正） */
	--bg-color-fixed-header: #d0eac0;   /* 固定列背景色 */
	--selection-border-color: #67c23a;  /* 選択罫線色 */
	--db-update-text-color: #1e7e34;    /* 更新文字色 */
}` },
	{ name: 'light-mono', title: 'UDモノクローム(明暗差重視)',
css: `:root {
	/* UD モノクローム (明度差重視・色彩完全排除) */
	--bg-color-title-bar: #F9F9F9;      /* タイトルバー背景色（極薄グレー） */
	--bg-color: #ffffff;                /* 基本背景色（白） */
	--icon-color: #555555;              /* アイコン色 */
	--text-color: #000000;              /* 通常文字色（黒） */
	--icon-color-hover: #000000;        /* ホバー中アイコン色 */
	--bg-color-icon-hover: #b0b0b0;     /* ホバー中アイコン、ボタン背景色 */
	--border-color: #000000;            /* 境界線（最大コントラスト） */
	--bg-color-header: #EBEBEB;         /* キャプション背景色（薄いグレー） */
	--bg-color-ht-header: #F0F0F0;      /* 表頭背景色（濃すぎないグレー） */
	--bg-color-even-row: #FAFAFA;       /* 偶数行背景色（僅かな差） */
	--border-color: #D1D1D1;            /* 汎用枠線色 */
	--border-color-ht-common: #E0E0E0;  /* 表枠線色（濃すぎないグレー） */
	--selection-border-color: #000000;  /* 選択罫線色 */
	--bg-color-fixed-header: #F8F8F8;   /* 固定列背景色 */
	--bg-color-filter-header: #C9C9C9;  /* フィルター列背景色 */
	--bg-color-highlighted-header: #DDDDDD; /* カーソル列背景色（色排除） */
	--bg-color-active-header: #DCDCDC;      /* 操作中列背景色（色排除） */
	--border-color-focus: #000000;      /* フォーカス枠線色 */
}` },
	{ name: 'light-high-contrast', title: 'UD ハイコントラスト(明瞭度重視)',
css: `:root {
	/* UD ハイコントラスト (明瞭度重視・弱視配慮) */
	--bg-color-title-bar: #FFFFFF;      /* タイトルバー背景色（純白） */
	--bg-color: #ffffff;                /* 背景色（純白） */
	--text-color: #000000;              /* 通常文字色（純黒） */
	--text-color-light: #222222;        /* 補助文字色 */
	--icon-color: #444444;              /* アイコン色 */
	--icon-color-hover: #000000;        /* ホバー中アイコン色 */
	--bg-color-icon-hover: #a8a8a8;     /* ホバー中アイコン、ボタン背景色 */
	--border-color: #000000;            /* 境界線（最大コントラスト） */
	--border-color-strong: #000000;     /* 強調境界線 */
	--border-color-ht-common: #000000;  /* 表枠線（明瞭化） */
	--bg-color-header: #d0d0d0;         /* キャプション（濃いグレーで明示） */
	--bg-color-ht-header: #d0d0d0;      /* 表頭（濃いグレーで明示） */
	--bg-color-even-row: #e8e8e8;       /* 偶数行（認識しやすい薄グレー） */
	--selection-border-color: #0000ff;  /* 選択罫線色（鮮明な青） */
	--border-color-focus: #0000ff;      /* フォーカス枠（明瞭化） */
	--db-update-text-color: #d00000;    /* 更新箇所（高彩度赤） */
}` },
	{ name: 'dark', title: '標準ダークテーマ', css: '' },
	{ name: 'dark-soft-night', title: 'UDダークソフトナイト(眼精疲労軽減)',
css: `[data-theme="dark"] {
	/* UD ダーク・ソフトナイト (眼精疲労・光過敏配慮) */
	--bg-color-title-bar: #24292B;      /* タイトルバー背景色 */
	--bg-color: #1c2022;                /* 基本背景色 */
	--text-color: #b8c1c4;              /* 通常文字色 */
	--bg-color-header: #2d3336;         /* キャプション背景色 */
	--bg-color-fixed-header: #354a43;   /* 固定列背景色 */
	--selection-border-color: #6a96a3;  /* 選択罫線色 */
	--db-update-text-color: #9cdcfe;    /* 更新文字色 */
	--bg-color-even-row: #23282b;       /* 偶数行背景色 */
	--border-color: #454d50;            /* 枠線色 */
}` },
	{ name: 'dark-blue-orange', title: 'UDダークブルーオレンジ(P/D型色覚)',
css: `[data-theme="dark"] {
	/* UD ダーク・ブルーオレンジ (P/D型(1/2型)色覚配慮) */
	--bg-color-title-bar: #22252A;      /* タイトルバー背景色 */
	--bg-color: #1a1b1e;                /* 基本背景色 */
	--text-color: #dcdcdc;              /* 通常文字色 */
	--bg-color-header: #2c3e50;         /* キャプション背景色 */
	--bg-color-filter-header: #1a4a80;  /* フィルター列背景色 */
	--bg-color-fixed-header: #455a64;   /* 固定列背景色（P/D型向き調整） */
	--bg-color-pagesize-over: #8a4b00;  /* 上限超過背景色 */
	--selection-border-color: #ff9d00;  /* 選択罫線色 */
	--db-update-text-color: #7abaff;    /* 更新文字色 */
	--bg-color-even-row: #22252a;       /* 偶数行背景色 */
}` },
	{ name: 'dark-high-contrast', title: 'UDダークハイコントラスト(明瞭度重視)',
css: `[data-theme="dark"] {
	/* UD ダーク・高コントラスト (明瞭度重視・弱視配慮) */
	--bg-color-title-bar: #1A1A1A;      /* タイトルバー背景色 */
	--bg-color: #0d0d0d;                /* 基本背景色 */
	--text-color: #eeeeee;              /* 通常文字色 */
	--text-color-dark: #ffffff;         /* 表頭文字色等の濃文字色 */
	--text-color-light: #d0d0d0;        /* 補助文字色 */
	--border-color: #bbbbbb;            /* 汎用枠線 */
	--border-color-strong: #ffffff;     /* 強調境界線（純白） */
	--border-color-ht-common: #eeeeee;  /* 表枠線（明瞭化） */
	--border-color-focus: #ffff00;      /* フォーカス枠（黄色） */
	--icon-color: #bbbbbb;              /* アイコン色 */
	--icon-color-hover: #ffffff;        /* ホバー中アイコン色 */
	--bg-color-icon-hover: #888888;     /* ホバー中アイコン、ボタン背景色 */
	--bg-color-header: #2a2a2a;         /* キャプション背景色 */
	--bg-color-ht-header: #444444;      /* 表頭（コントラスト強化） */
	--bg-color-fixed-header: #FFFF00BA;   /* 固定列背景色（黄色反転表示） */
	--text-color-fixed-header: #000000; /* 固定列文字色（黒） */
	--selection-border-color: #ffff00;  /* 選択罫線色 */
	--db-update-text-color: #ffff00;    /* 更新文字色 */
	--bg-color-even-row: #222222;       /* 偶数行背景色（明確化） */
}` },
];

/**
 * 指定されたテーマを適用する
 * @param {number|string} themeRef インデックスまたはテーマ名、または 'custom'
 */
function applyTheme(themeRef) {
	let idx = -1;
	let css = '';
	let baseTheme = 'light';
	let themeName = '';

	if (themeRef === 'custom') {
		css = localStorage.getItem('user_custom_css_save') || '';
		baseTheme = localStorage.getItem('theme') || 'light';
		themeName = 'custom';
	} else {
		if (typeof themeRef === 'number') {
			idx = themeRef;
		} else {
			idx = colorThemes.findIndex(t => t.name === themeRef);
		}
		const theme = colorThemes[idx] || colorThemes[0];
		baseTheme = theme.name.includes('dark') ? 'dark' : 'light';
		css = theme.css;
		themeName = theme.name;
	}

	document.documentElement.setAttribute('data-theme', baseTheme);
	localStorage.setItem('theme', baseTheme);
	localStorage.setItem('selected_theme_name', themeName);
	localStorage.setItem('active_theme_css', css);

	updateCustomCss(css);

	// コンポーネント（Handsontable等）への適用
	if (typeof tables !== 'undefined' && tables) {
		const htTheme = 'ht-theme-classic' + (baseTheme === 'dark' ? '-dark' : '');
		const tableList = Array.isArray(tables) ? tables : [tables];
		tableList.forEach(table => {
			if (table && typeof table.updateSettings === 'function') {
				table.updateSettings({ themeName: htTheme });
				table.render();
			}
		});
	}
	if (typeof editor !== 'undefined' && editor && typeof editor.setOption === 'function') {
		editor.setOption('theme', baseTheme === 'dark' ? 'darcula' : 'eclipse');
	}
}

function updateCustomCss(cssText) {
	let style = document.getElementById('user-custom-css-tag');
	if (!style) {
		style = document.createElement('style');
		style.id = 'user-custom-css-tag';
		document.head.appendChild(style);
	}
	style.textContent = cssText;
}