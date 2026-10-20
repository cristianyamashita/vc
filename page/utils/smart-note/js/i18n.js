/* Smart Note — translations (EN / PT / JA). */
window.SN_I18N = {
  en: {
    title: 'Smart Note',
    newPage: 'New page', newSubPage: 'New sub-page', import: 'Import', export: 'Export', help: 'Help', theme: 'Toggle theme',
    toggleSidebar: 'Show or hide the page list', searchPh: 'Search pages…', untitled: 'Untitled', saved: 'Saved', saving: 'Saving…',
    words: 'words', noPages: 'No pages yet', noMatch: 'No page matches', deletePage: 'Delete page',
    deleteConfirm: 'Delete "{title}"?', deleteConfirmChildren: 'Delete "{title}" and its {n} sub-pages?',
    cancel: 'Cancel', delete: 'Delete', ok: 'OK', close: 'Close',
    undo: 'Undo', redo: 'Redo', bold: 'Bold', italic: 'Italic', underline: 'Underline', strike: 'Strikethrough', inlineCode: 'Inline code',
    textColor: 'Text color', highlight: 'Highlight', alignLeft: 'Align left', alignCenter: 'Center', alignRight: 'Align right',
    link: 'Link', clearFormat: 'Clear formatting', insert: 'Insert block', blockType: 'Block type', font: 'Font', fontDefault: 'Default font',
    size: 'Size', sizeDefault: 'Size', none: 'None', more: 'More',
    expMarkdown: 'Markdown (.md)', expHtml: 'HTML (.html)', expText: 'Plain text (.txt)', expPdf: 'PDF (print)',
    expJsonPage: 'JSON — this page and sub-pages', expJsonAll: 'JSON — all pages',
    pdfHint: 'In the print dialog choose "Save as PDF".', imported: '{n} page(s) imported.', importFail: 'Could not import this file.',
    exportDone: 'File exported.', nothingToExport: 'Nothing to export.',
    linkUrl: 'URL', linkText: 'Text', insertLink: 'Insert link', removeLink: 'Remove link', openLink: 'Open link',
    tblRowAbove: 'Row above', tblRowBelow: 'Row below', tblColLeft: 'Column left', tblColRight: 'Column right',
    tblDelRow: 'Delete row', tblDelCol: 'Delete column', tblDelTable: 'Delete table', tblHeader: 'Header row',
    figSmall: 'Small', figMedium: 'Medium', figLarge: 'Large', figFull: 'Full width', figAlignL: 'Left', figAlignC: 'Center', figAlignR: 'Right', figDelete: 'Delete image',
    captionPh: 'Caption', editorPh: "Type '/' for commands", titlePh: 'Untitled',
    slashNoResults: 'No results', slashPagesTitle: 'Link to page', noOtherPages: 'No other pages', backToMenu: 'Back',
    bt_text: 'Text', bt_h1: 'Heading 1', bt_h2: 'Heading 2', bt_h3: 'Heading 3', bt_bullet: 'Bulleted list', bt_number: 'Numbered list',
    bt_todo: 'To-do list', bt_quote: 'Quote', bt_code: 'Code', bt_callout: 'Callout',
    sl_text: 'Text', sld_text: 'Plain paragraph', kw_text: 'paragraph plain',
    sl_h1: 'Heading 1', sld_h1: 'Large section heading', kw_h1: 'title h1 header',
    sl_h2: 'Heading 2', sld_h2: 'Medium section heading', kw_h2: 'title h2 header',
    sl_h3: 'Heading 3', sld_h3: 'Small section heading', kw_h3: 'title h3 header',
    sl_bullet: 'Bulleted list', sld_bullet: 'Simple bulleted list', kw_bullet: 'list ul bullets',
    sl_number: 'Numbered list', sld_number: 'List with numbers', kw_number: 'list ol ordered',
    sl_todo: 'To-do list', sld_todo: 'Checkbox task list', kw_todo: 'checkbox task check',
    sl_quote: 'Quote', sld_quote: 'Capture a quotation', kw_quote: 'blockquote citation',
    sl_code: 'Code', sld_code: 'Code block with monospace font', kw_code: 'snippet pre monospace',
    sl_divider: 'Divider', sld_divider: 'Horizontal line', kw_divider: 'hr line separator rule',
    sl_callout: 'Callout', sld_callout: 'Highlighted note with an icon', kw_callout: 'note tip warning info',
    sl_table: 'Table', sld_table: 'Simple table (3 × 3)', kw_table: 'grid rows columns',
    sl_image: 'Image', sld_image: 'Upload an image file', kw_image: 'picture photo upload',
    sl_link: 'Link', sld_link: 'Insert a web link', kw_link: 'url hyperlink web',
    sl_subpage: 'Sub-page', sld_subpage: 'Create a new page inside this one', kw_subpage: 'child document new page',
    sl_pagelink: 'Link to page', sld_pagelink: 'Link to an existing page', kw_pagelink: 'document reference mention',
    sl_date: 'Date', sld_date: "Insert today's date", kw_date: 'today calendar',
    sl_time: 'Time', sld_time: 'Insert the current time', kw_time: 'clock now',
    helpTitle: 'Smart Note — Help',
    helpIntro: 'A block-based notepad. Pages are saved in this browser (IndexedDB). Type <code>/</code> at the start of a line or after a space to open the command menu, keep typing to filter, use ↑ ↓ and press <b>Enter</b> to insert the block.',
    helpBlocks: 'Blocks', helpShortcuts: 'Shortcuts', helpMarkdown: 'Markdown shortcuts', helpFiles: 'Import and export', helpStorage: 'Storage',
    helpShortcutList: [
      ['/', 'Open the command menu'], ['Ctrl+B / I / U', 'Bold, italic, underline'], ['Ctrl+Shift+X', 'Strikethrough'], ['Ctrl+E', 'Inline code'],
      ['Ctrl+K', 'Insert link (Ctrl+click opens a link)'], ['Ctrl+Z / Ctrl+Y', 'Undo / redo'], ['Ctrl+S', 'Save now'],
      ['Tab / Shift+Tab', 'Indent or outdent list items; next cell in tables'], ['Enter ×2', 'Leave a code block, quote or callout'],
      ['Shift+Enter', 'Line break inside a block'], ['Backspace', 'At the start of a block turns it into text'], ['?', 'This help (outside the editor)'],
    ],
    helpMdList: [
      ['# ', 'Heading 1 (## and ### for 2 and 3)'], ['- ', 'Bulleted list'], ['1. ', 'Numbered list'], ['[] ', 'To-do'], ['> ', 'Quote'], ['``` ', 'Code block'], ['--- ', 'Divider'],
    ],
    helpFilesText: 'Export the current page as Markdown (default), HTML, plain text or PDF (through the print dialog, images included). JSON keeps pages, sub-pages and images and can be imported back. Import accepts .md, .txt, .html and .json files; images can be pasted, dropped or chosen with the Image block.',
    helpStorageText: 'Everything is stored locally in IndexedDB (SmartNoteDB). Use the Backup page of this collection to copy it to another browser.',
    welcomeTitle: 'Welcome to Smart Note',
    welcomeMd: `# Welcome to Smart Note
A notepad with blocks, saved in your browser.

> 💡 Type **/** at the start of a line to open the command menu. Keep typing to filter, then press **Enter**.

## Try it
- [ ] Type \`/table\` and press Enter
- [ ] Add an image with \`/image\` or paste one
- [x] Create a sub-page with \`/sub-page\`

| Block | Shortcut |
| --- | --- |
| Heading | \`# \` |
| List | \`- \` |
| To-do | \`[] \` |

Use **Export** to save as Markdown, HTML, text or PDF.`,
  },
  pt: {
    title: 'Smart Note',
    newPage: 'Nova página', newSubPage: 'Nova subpágina', import: 'Importar', export: 'Exportar', help: 'Ajuda', theme: 'Alternar tema',
    toggleSidebar: 'Mostrar ou ocultar a lista de páginas', searchPh: 'Buscar páginas…', untitled: 'Sem título', saved: 'Salvo', saving: 'Salvando…',
    words: 'palavras', noPages: 'Nenhuma página ainda', noMatch: 'Nenhuma página encontrada', deletePage: 'Excluir página',
    deleteConfirm: 'Excluir "{title}"?', deleteConfirmChildren: 'Excluir "{title}" e suas {n} subpáginas?',
    cancel: 'Cancelar', delete: 'Excluir', ok: 'OK', close: 'Fechar',
    undo: 'Desfazer', redo: 'Refazer', bold: 'Negrito', italic: 'Itálico', underline: 'Sublinhado', strike: 'Tachado', inlineCode: 'Código inline',
    textColor: 'Cor do texto', highlight: 'Destaque', alignLeft: 'Alinhar à esquerda', alignCenter: 'Centralizar', alignRight: 'Alinhar à direita',
    link: 'Link', clearFormat: 'Limpar formatação', insert: 'Inserir bloco', blockType: 'Tipo de bloco', font: 'Fonte', fontDefault: 'Fonte padrão',
    size: 'Tamanho', sizeDefault: 'Tamanho', none: 'Nenhum', more: 'Mais',
    expMarkdown: 'Markdown (.md)', expHtml: 'HTML (.html)', expText: 'Texto simples (.txt)', expPdf: 'PDF (imprimir)',
    expJsonPage: 'JSON — esta página e subpáginas', expJsonAll: 'JSON — todas as páginas',
    pdfHint: 'Na janela de impressão escolha "Salvar como PDF".', imported: '{n} página(s) importada(s).', importFail: 'Não foi possível importar este arquivo.',
    exportDone: 'Arquivo exportado.', nothingToExport: 'Nada para exportar.',
    linkUrl: 'URL', linkText: 'Texto', insertLink: 'Inserir link', removeLink: 'Remover link', openLink: 'Abrir link',
    tblRowAbove: 'Linha acima', tblRowBelow: 'Linha abaixo', tblColLeft: 'Coluna à esquerda', tblColRight: 'Coluna à direita',
    tblDelRow: 'Excluir linha', tblDelCol: 'Excluir coluna', tblDelTable: 'Excluir tabela', tblHeader: 'Linha de cabeçalho',
    figSmall: 'Pequena', figMedium: 'Média', figLarge: 'Grande', figFull: 'Largura total', figAlignL: 'Esquerda', figAlignC: 'Centro', figAlignR: 'Direita', figDelete: 'Excluir imagem',
    captionPh: 'Legenda', editorPh: "Digite '/' para comandos", titlePh: 'Sem título',
    slashNoResults: 'Sem resultados', slashPagesTitle: 'Link para página', noOtherPages: 'Não há outras páginas', backToMenu: 'Voltar',
    bt_text: 'Texto', bt_h1: 'Título 1', bt_h2: 'Título 2', bt_h3: 'Título 3', bt_bullet: 'Lista com marcadores', bt_number: 'Lista numerada',
    bt_todo: 'Lista de tarefas', bt_quote: 'Citação', bt_code: 'Código', bt_callout: 'Destaque',
    sl_text: 'Texto', sld_text: 'Parágrafo simples', kw_text: 'paragrafo parágrafo texto text paragraph',
    sl_h1: 'Título 1', sld_h1: 'Título grande de seção', kw_h1: 'titulo título cabeçalho heading h1',
    sl_h2: 'Título 2', sld_h2: 'Título médio de seção', kw_h2: 'titulo título cabeçalho heading h2',
    sl_h3: 'Título 3', sld_h3: 'Título pequeno de seção', kw_h3: 'titulo título cabeçalho heading h3',
    sl_bullet: 'Lista com marcadores', sld_bullet: 'Lista simples com marcadores', kw_bullet: 'lista marcadores bullet list ul',
    sl_number: 'Lista numerada', sld_number: 'Lista com números', kw_number: 'lista numeros números numbered list ol',
    sl_todo: 'Lista de tarefas', sld_todo: 'Lista com caixas de seleção', kw_todo: 'tarefa checkbox todo check caixa',
    sl_quote: 'Citação', sld_quote: 'Destacar uma citação', kw_quote: 'citacao citação quote blockquote',
    sl_code: 'Código', sld_code: 'Bloco de código com fonte monoespaçada', kw_code: 'codigo código code snippet pre',
    sl_divider: 'Divisor', sld_divider: 'Linha horizontal', kw_divider: 'divisor linha separador divider hr',
    sl_callout: 'Destaque', sld_callout: 'Nota destacada com ícone', kw_callout: 'destaque nota aviso dica callout note',
    sl_table: 'Tabela', sld_table: 'Tabela simples (3 × 3)', kw_table: 'tabela grade linhas colunas table',
    sl_image: 'Imagem', sld_image: 'Enviar um arquivo de imagem', kw_image: 'imagem foto figura image picture',
    sl_link: 'Link', sld_link: 'Inserir um link da web', kw_link: 'link url ligacao ligação',
    sl_subpage: 'Subpágina', sld_subpage: 'Criar uma nova página dentro desta', kw_subpage: 'subpagina subpágina pagina página filha nova subpage child',
    sl_pagelink: 'Link para página', sld_pagelink: 'Link para uma página existente', kw_pagelink: 'pagina página referencia referência documento link page',
    sl_date: 'Data', sld_date: 'Inserir a data de hoje', kw_date: 'data hoje calendario calendário date today',
    sl_time: 'Hora', sld_time: 'Inserir a hora atual', kw_time: 'hora agora relogio relógio time now',
    helpTitle: 'Smart Note — Ajuda',
    helpIntro: 'Um bloco de notas por blocos. As páginas ficam salvas neste navegador (IndexedDB). Digite <code>/</code> no início de uma linha ou após um espaço para abrir o menu de comandos, continue digitando para filtrar, use ↑ ↓ e pressione <b>Enter</b> para inserir o bloco.',
    helpBlocks: 'Blocos', helpShortcuts: 'Atalhos', helpMarkdown: 'Atalhos Markdown', helpFiles: 'Importar e exportar', helpStorage: 'Armazenamento',
    helpShortcutList: [
      ['/', 'Abrir o menu de comandos'], ['Ctrl+B / I / U', 'Negrito, itálico, sublinhado'], ['Ctrl+Shift+X', 'Tachado'], ['Ctrl+E', 'Código inline'],
      ['Ctrl+K', 'Inserir link (Ctrl+clique abre o link)'], ['Ctrl+Z / Ctrl+Y', 'Desfazer / refazer'], ['Ctrl+S', 'Salvar agora'],
      ['Tab / Shift+Tab', 'Recuar ou avançar itens de lista; próxima célula em tabelas'], ['Enter ×2', 'Sair de um bloco de código, citação ou destaque'],
      ['Shift+Enter', 'Quebra de linha dentro do bloco'], ['Backspace', 'No início de um bloco, transforma-o em texto'], ['?', 'Esta ajuda (fora do editor)'],
    ],
    helpMdList: [
      ['# ', 'Título 1 (## e ### para 2 e 3)'], ['- ', 'Lista com marcadores'], ['1. ', 'Lista numerada'], ['[] ', 'Tarefa'], ['> ', 'Citação'], ['``` ', 'Bloco de código'], ['--- ', 'Divisor'],
    ],
    helpFilesText: 'Exporte a página atual como Markdown (padrão), HTML, texto simples ou PDF (pela janela de impressão, com imagens). O JSON guarda páginas, subpáginas e imagens e pode ser importado de volta. A importação aceita arquivos .md, .txt, .html e .json; imagens podem ser coladas, arrastadas ou escolhidas com o bloco Imagem.',
    helpStorageText: 'Tudo fica armazenado localmente no IndexedDB (SmartNoteDB). Use a página Backup desta coleção para copiar para outro navegador.',
    welcomeTitle: 'Bem-vindo ao Smart Note',
    welcomeMd: `# Bem-vindo ao Smart Note
Um bloco de notas por blocos, salvo no seu navegador.

> 💡 Digite **/** no início de uma linha para abrir o menu de comandos. Continue digitando para filtrar e pressione **Enter**.

## Experimente
- [ ] Digite \`/tabela\` e pressione Enter
- [ ] Adicione uma imagem com \`/imagem\` ou cole uma
- [x] Crie uma subpágina com \`/subpágina\`

| Bloco | Atalho |
| --- | --- |
| Título | \`# \` |
| Lista | \`- \` |
| Tarefa | \`[] \` |

Use **Exportar** para salvar como Markdown, HTML, texto ou PDF.`,
  },
  ja: {
    title: 'Smart Note',
    newPage: '新しいページ', newSubPage: '新しいサブページ', import: 'インポート', export: 'エクスポート', help: 'ヘルプ', theme: 'テーマ切替',
    toggleSidebar: 'ページ一覧の表示/非表示', searchPh: 'ページを検索…', untitled: '無題', saved: '保存済み', saving: '保存中…',
    words: '語', noPages: 'ページがありません', noMatch: '該当するページがありません', deletePage: 'ページを削除',
    deleteConfirm: '「{title}」を削除しますか？', deleteConfirmChildren: '「{title}」とそのサブページ{n}件を削除しますか？',
    cancel: 'キャンセル', delete: '削除', ok: 'OK', close: '閉じる',
    undo: '元に戻す', redo: 'やり直す', bold: '太字', italic: '斜体', underline: '下線', strike: '取り消し線', inlineCode: 'インラインコード',
    textColor: '文字色', highlight: 'ハイライト', alignLeft: '左揃え', alignCenter: '中央揃え', alignRight: '右揃え',
    link: 'リンク', clearFormat: '書式をクリア', insert: 'ブロックを挿入', blockType: 'ブロックの種類', font: 'フォント', fontDefault: '既定のフォント',
    size: 'サイズ', sizeDefault: 'サイズ', none: 'なし', more: 'その他',
    expMarkdown: 'Markdown (.md)', expHtml: 'HTML (.html)', expText: 'テキスト (.txt)', expPdf: 'PDF（印刷）',
    expJsonPage: 'JSON — このページとサブページ', expJsonAll: 'JSON — すべてのページ',
    pdfHint: '印刷ダイアログで「PDFとして保存」を選んでください。', imported: '{n}ページをインポートしました。', importFail: 'このファイルはインポートできませんでした。',
    exportDone: 'ファイルをエクスポートしました。', nothingToExport: 'エクスポートするものがありません。',
    linkUrl: 'URL', linkText: 'テキスト', insertLink: 'リンクを挿入', removeLink: 'リンクを解除', openLink: 'リンクを開く',
    tblRowAbove: '上に行', tblRowBelow: '下に行', tblColLeft: '左に列', tblColRight: '右に列',
    tblDelRow: '行を削除', tblDelCol: '列を削除', tblDelTable: '表を削除', tblHeader: 'ヘッダー行',
    figSmall: '小', figMedium: '中', figLarge: '大', figFull: '全幅', figAlignL: '左', figAlignC: '中央', figAlignR: '右', figDelete: '画像を削除',
    captionPh: 'キャプション', editorPh: "'/' でコマンド", titlePh: '無題',
    slashNoResults: '結果なし', slashPagesTitle: 'ページへのリンク', noOtherPages: '他のページはありません', backToMenu: '戻る',
    bt_text: 'テキスト', bt_h1: '見出し1', bt_h2: '見出し2', bt_h3: '見出し3', bt_bullet: '箇条書き', bt_number: '番号付きリスト',
    bt_todo: 'ToDoリスト', bt_quote: '引用', bt_code: 'コード', bt_callout: 'コールアウト',
    sl_text: 'テキスト', sld_text: '通常の段落', kw_text: 'テキスト 段落 text paragraph',
    sl_h1: '見出し1', sld_h1: '大きなセクション見出し', kw_h1: '見出し みだし heading h1 title',
    sl_h2: '見出し2', sld_h2: '中くらいのセクション見出し', kw_h2: '見出し みだし heading h2 title',
    sl_h3: '見出し3', sld_h3: '小さなセクション見出し', kw_h3: '見出し みだし heading h3 title',
    sl_bullet: '箇条書き', sld_bullet: 'シンプルな箇条書きリスト', kw_bullet: '箇条書き リスト bullet list ul',
    sl_number: '番号付きリスト', sld_number: '番号付きのリスト', kw_number: '番号 リスト numbered list ol',
    sl_todo: 'ToDoリスト', sld_todo: 'チェックボックス付きタスク', kw_todo: 'todo タスク チェック checkbox task',
    sl_quote: '引用', sld_quote: '引用文を記録', kw_quote: '引用 quote blockquote',
    sl_code: 'コード', sld_code: '等幅フォントのコードブロック', kw_code: 'コード code snippet pre',
    sl_divider: '区切り線', sld_divider: '水平線', kw_divider: '区切り 線 divider hr line',
    sl_callout: 'コールアウト', sld_callout: 'アイコン付きの強調メモ', kw_callout: 'コールアウト メモ 注意 callout note tip',
    sl_table: '表', sld_table: 'シンプルな表（3 × 3）', kw_table: '表 テーブル table grid',
    sl_image: '画像', sld_image: '画像ファイルをアップロード', kw_image: '画像 写真 image picture photo',
    sl_link: 'リンク', sld_link: 'Webリンクを挿入', kw_link: 'リンク url link',
    sl_subpage: 'サブページ', sld_subpage: 'このページの中に新しいページを作成', kw_subpage: 'サブページ 子ページ 新規 subpage child',
    sl_pagelink: 'ページへのリンク', sld_pagelink: '既存のページへリンク', kw_pagelink: 'ページ 参照 リンク page link',
    sl_date: '日付', sld_date: '今日の日付を挿入', kw_date: '日付 今日 date today',
    sl_time: '時刻', sld_time: '現在の時刻を挿入', kw_time: '時刻 時間 今 time now',
    helpTitle: 'Smart Note — ヘルプ',
    helpIntro: 'ブロック型のメモ帳です。ページはこのブラウザ（IndexedDB）に保存されます。行頭またはスペースの後に <code>/</code> を入力するとコマンドメニューが開きます。続けて入力して絞り込み、↑ ↓ で選んで <b>Enter</b> でブロックを挿入します。',
    helpBlocks: 'ブロック', helpShortcuts: 'ショートカット', helpMarkdown: 'Markdownショートカット', helpFiles: 'インポートとエクスポート', helpStorage: '保存',
    helpShortcutList: [
      ['/', 'コマンドメニューを開く'], ['Ctrl+B / I / U', '太字、斜体、下線'], ['Ctrl+Shift+X', '取り消し線'], ['Ctrl+E', 'インラインコード'],
      ['Ctrl+K', 'リンクを挿入（Ctrl+クリックでリンクを開く）'], ['Ctrl+Z / Ctrl+Y', '元に戻す / やり直す'], ['Ctrl+S', '今すぐ保存'],
      ['Tab / Shift+Tab', 'リスト項目のインデント / 解除、表では次のセルへ'], ['Enter ×2', 'コードブロック、引用、コールアウトから抜ける'],
      ['Shift+Enter', 'ブロック内で改行'], ['Backspace', 'ブロックの先頭でテキストに戻す'], ['?', 'このヘルプ（エディター外で）'],
    ],
    helpMdList: [
      ['# ', '見出し1（## と ### で2と3）'], ['- ', '箇条書き'], ['1. ', '番号付きリスト'], ['[] ', 'ToDo'], ['> ', '引用'], ['``` ', 'コードブロック'], ['--- ', '区切り線'],
    ],
    helpFilesText: '現在のページを Markdown（既定）、HTML、テキスト、PDF（印刷ダイアログ経由、画像を含む）でエクスポートできます。JSON はページ、サブページ、画像を保持し、再インポートできます。インポートは .md、.txt、.html、.json に対応し、画像は貼り付け、ドロップ、または「画像」ブロックで追加できます。',
    helpStorageText: 'すべてローカルの IndexedDB（SmartNoteDB）に保存されます。別のブラウザへ移すにはこのコレクションのバックアップページを使ってください。',
    welcomeTitle: 'Smart Note へようこそ',
    welcomeMd: `# Smart Note へようこそ
ブラウザに保存されるブロック型メモ帳です。

> 💡 行頭で **/** を入力するとコマンドメニューが開きます。続けて入力して絞り込み、**Enter** を押してください。

## 試してみる
- [ ] \`/表\` と入力して Enter
- [ ] \`/画像\` で画像を追加するか、貼り付ける
- [x] \`/サブページ\` でサブページを作る

| ブロック | ショートカット |
| --- | --- |
| 見出し | \`# \` |
| リスト | \`- \` |
| ToDo | \`[] \` |

**エクスポート** で Markdown、HTML、テキスト、PDF に保存できます。`,
  },
};
