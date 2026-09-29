/* Generated from page/index.html — run python3 scripts/build_os_catalog.py */
window.OSCatalog = (function () {
  const APPS = [
  {
    "id": "settings",
    "href": null,
    "icon": "../assets/icons/svg/os.svg",
    "kind": "native",
    "uninstallable": false,
    "defaultInstalled": true,
    "channel": "stable",
    "tag": {
      "en": "System",
      "pt": "Sistema",
      "ja": "システム"
    },
    "name": {
      "en": "Settings",
      "pt": "Configurações",
      "ja": "設定"
    },
    "desc": {
      "en": "Change theme, language, and user name, and install or uninstall apps.",
      "pt": "Muda tema, idioma e nome do usuário, e instala ou desinstala apps.",
      "ja": "テーマ、言語、ユーザー名を変更し、アプリをインストールまたは削除します。"
    }
  },
  {
    "id": "app-studio",
    "href": "os/apps/app-studio/index.html",
    "icon": "../assets/icons/svg/os-app_studio.svg",
    "kind": "native",
    "uninstallable": false,
    "defaultInstalled": true,
    "multiInstance": true,
    "windowW": 1100,
    "windowH": 720,
    "channel": "stable",
    "tag": {
      "en": "System",
      "pt": "Sistema",
      "ja": "システム"
    },
    "name": {
      "en": "App Studio",
      "pt": "App Studio",
      "ja": "App Studio"
    },
    "desc": {
      "en": "Create multi-file desktop apps with a Visual Studio-style editor.",
      "pt": "Crie apps do desktop com vários arquivos, num editor no estilo Visual Studio.",
      "ja": "Visual Studio 風のエディタで複数ファイルのデスクトップアプリを作成します。"
    }
  },
  {
    "id": "sheets",
    "href": "os/apps/sheets/index.html",
    "icon": "../assets/icons/svg/os-sheets.svg",
    "kind": "native",
    "uninstallable": false,
    "defaultInstalled": true,
    "channel": "stable",
    "tag": {
      "en": "System",
      "pt": "Sistema",
      "ja": "システム"
    },
    "name": {
      "en": "Sheets",
      "pt": "Planilhas",
      "ja": "表計算"
    },
    "desc": {
      "en": "Spreadsheet with multiple sheets, formulas, and Excel-style references.",
      "pt": "Planilha com várias abas, fórmulas e referências no estilo Excel.",
      "ja": "複数シート、数式、Excel 風の参照に対応した表計算アプリ。"
    }
  },
  {
    "id": "file-explorer",
    "href": null,
    "icon": "../assets/icons/svg/os-file_explorer.svg",
    "kind": "native",
    "uninstallable": false,
    "defaultInstalled": true,
    "multiInstance": true,
    "channel": "stable",
    "tag": {
      "en": "System",
      "pt": "Sistema",
      "ja": "システム"
    },
    "name": {
      "en": "File Explorer",
      "pt": "Explorador de Arquivos",
      "ja": "エクスプローラー"
    },
    "desc": {
      "en": "Browse folders and files stored in this desktop, with icons or details view.",
      "pt": "Navegue pastas e arquivos deste desktop, em ícones ou detalhes.",
      "ja": "このデスクトップに保存したフォルダーとファイルをアイコンまたは詳細表示で参照します。"
    }
  },
  {
    "id": "task-manager",
    "href": null,
    "icon": "../assets/icons/svg/os-task_manager.svg",
    "kind": "native",
    "uninstallable": false,
    "defaultInstalled": true,
    "channel": "stable",
    "tag": {
      "en": "System",
      "pt": "Sistema",
      "ja": "システム"
    },
    "name": {
      "en": "Task Manager",
      "pt": "Gerenciador de Tarefas",
      "ja": "タスク マネージャー"
    },
    "desc": {
      "en": "See open windows, end tasks, and check how much storage this desktop is using.",
      "pt": "Veja janelas abertas, encerre tarefas e confira o armazenamento deste desktop.",
      "ja": "開いているウィンドウの終了と、このデスクトップの使用容量を確認します。"
    }
  },
  {
    "id": "notepad",
    "href": "os/apps/notepad/index.html",
    "icon": "../assets/icons/svg/os-notepad.svg",
    "kind": "native",
    "suite": "accessories",
    "uninstallable": false,
    "defaultInstalled": true,
    "multiInstance": true,
    "windowW": 720,
    "windowH": 520,
    "channel": "stable",
    "tag": {
      "en": "Accessories",
      "pt": "Acessórios",
      "ja": "アクセサリ"
    },
    "name": {
      "en": "Notepad",
      "pt": "Bloco de Notas",
      "ja": "メモ帳"
    },
    "desc": {
      "en": "Simple text editor for notes and logs, with Open/Save on the desktop filesystem.",
      "pt": "Editor de texto simples para notas e logs, com Abrir/Salvar no sistema de arquivos do desktop.",
      "ja": "デスクトップのファイルシステムに保存できるシンプルなテキストエディタ。"
    }
  },
  {
    "id": "paint",
    "href": "os/apps/paint/index.html",
    "icon": "../assets/icons/svg/os-paint.svg",
    "kind": "native",
    "suite": "accessories",
    "uninstallable": false,
    "defaultInstalled": true,
    "multiInstance": true,
    "channel": "stable",
    "tag": {
      "en": "Accessories",
      "pt": "Acessórios",
      "ja": "アクセサリ"
    },
    "name": {
      "en": "Paint",
      "pt": "Paint",
      "ja": "ペイント"
    },
    "desc": {
      "en": "Bitmap drawing with pencil, shapes, fill, and undo — a Paint-style canvas.",
      "pt": "Desenho bitmap com lápis, formas, preenchimento e desfazer — no estilo Paint.",
      "ja": "鉛筆、図形、塗りつぶし、元に戻すを備えたペイント風キャンバス。"
    }
  },
  {
    "id": "calendar",
    "href": "os/apps/calendar/index.html",
    "icon": "../assets/icons/svg/os-calendar.svg",
    "kind": "native",
    "suite": "accessories",
    "uninstallable": false,
    "defaultInstalled": true,
    "channel": "stable",
    "tag": {
      "en": "Accessories",
      "pt": "Acessórios",
      "ja": "アクセサリ"
    },
    "name": {
      "en": "Calendar",
      "pt": "Calendário",
      "ja": "カレンダー"
    },
    "desc": {
      "en": "Month calendar with events and notes that also open from the taskbar clock.",
      "pt": "Calendário mensal com eventos e notas, também aberto pelo relógio da barra de tarefas.",
      "ja": "タスクバーの時計からも開ける、予定とメモ付きの月間カレンダー。"
    }
  },
  {
    "id": "browser",
    "href": "os/apps/browser/index.html",
    "icon": "../assets/icons/svg/os-browser.svg",
    "kind": "native",
    "suite": "accessories",
    "uninstallable": false,
    "defaultInstalled": true,
    "multiInstance": true,
    "windowW": 1100,
    "windowH": 720,
    "channel": "stable",
    "tag": {
      "en": "Accessories",
      "pt": "Acessórios",
      "ja": "アクセサリ"
    },
    "name": {
      "en": "Browser",
      "pt": "Navegador",
      "ja": "ブラウザ"
    },
    "desc": {
      "en": "Tabbed browser with live iframes, Compat view for sites that send X-Frame-Options, and a reader mode.",
      "pt": "Navegador com abas, iframe ao vivo, vista Compat para sites com X-Frame-Options e modo leitura.",
      "ja": "タブブラウザ。ライブ iframe、X-Frame-Options 向け Compat ビュー、リーダーモード。"
    }
  },
  {
    "id": "calculator",
    "href": "os/apps/calculator/index.html",
    "icon": "../assets/icons/svg/os-calculator.svg",
    "kind": "native",
    "suite": "accessories",
    "uninstallable": false,
    "defaultInstalled": true,
    "multiInstance": true,
    "windowW": 380,
    "windowH": 560,
    "channel": "stable",
    "tag": {
      "en": "Accessories",
      "pt": "Acessórios",
      "ja": "アクセサリ"
    },
    "name": {
      "en": "Calculator",
      "pt": "Calculadora",
      "ja": "電卓"
    },
    "desc": {
      "en": "Standard calculator with keyboard support.",
      "pt": "Calculadora padrão com suporte a teclado.",
      "ja": "キーボード操作に対応した標準電卓。"
    }
  },
  {
    "id": "camera",
    "href": "os/apps/camera/index.html",
    "icon": "../assets/icons/svg/os-camera.svg",
    "kind": "native",
    "suite": "accessories",
    "uninstallable": false,
    "defaultInstalled": true,
    "windowW": 520,
    "windowH": 480,
    "channel": "stable",
    "tag": {
      "en": "Accessories",
      "pt": "Acessórios",
      "ja": "アクセサリ"
    },
    "name": {
      "en": "Camera",
      "pt": "Câmera",
      "ja": "カメラ"
    },
    "desc": {
      "en": "View, capture photos, and record videos with filters.",
      "pt": "Visualize, tire fotos e grave vídeos com filtros.",
      "ja": "フィルター付きで写真撮影・動画録画ができるカメラ。"
    }
  },
  {
    "id": "upgrade",
    "href": "os/apps/upgrade/index.html",
    "icon": "../assets/icons/svg/os-upgrade.svg",
    "kind": "native",
    "suite": "accessories",
    "uninstallable": false,
    "defaultInstalled": true,
    "windowW": 720,
    "windowH": 720,
    "channel": "stable",
    "tag": {
      "en": "Accessories",
      "pt": "Acessórios",
      "ja": "アクセサリ"
    },
    "name": {
      "en": "Upgrade Simulator",
      "pt": "Simulador de Upgrade",
      "ja": "アップグレードシミュレーター"
    },
    "desc": {
      "en": "Fullscreen fake OS upgrade for Ubuntu, CentOS, Windows, or Mac. Press Esc to exit.",
      "pt": "Simula um upgrade em tela cheia do Ubuntu, CentOS, Windows ou Mac. Esc sai da simulação.",
      "ja": "Ubuntu / CentOS / Windows / Mac のアップグレード画面をフルスクリーンで再現。Esc で終了。"
    }
  },
  {
    "id": "stickies",
    "href": "os/apps/stickies/index.html",
    "icon": "../assets/icons/svg/os-stickies.svg",
    "kind": "native",
    "suite": "accessories",
    "uninstallable": false,
    "defaultInstalled": true,
    "multiInstance": true,
    "windowW": 720,
    "windowH": 520,
    "channel": "stable",
    "tag": {
      "en": "Accessories",
      "pt": "Acessórios",
      "ja": "アクセサリ"
    },
    "name": {
      "en": "Stickies",
      "pt": "Notas adesivas",
      "ja": "スティッキーズ"
    },
    "desc": {
      "en": "Colored sticky notes that also live as desktop widgets.",
      "pt": "Notas adesivas coloridas que também aparecem como widgets no desktop.",
      "ja": "デスクトップウィジェットにもなる色付きの付箋。"
    }
  },
  {
    "id": "snip",
    "href": null,
    "icon": "../assets/icons/svg/os-snip.svg",
    "kind": "native",
    "suite": "accessories",
    "uninstallable": false,
    "defaultInstalled": true,
    "windowW": 420,
    "windowH": 320,
    "channel": "stable",
    "tag": {
      "en": "Accessories",
      "pt": "Acessórios",
      "ja": "アクセサリ"
    },
    "name": {
      "en": "Snipping Tool",
      "pt": "Ferramenta de Recorte",
      "ja": "切り取りツール"
    },
    "desc": {
      "en": "Capture a rectangle of this desktop and save it or open it in Paint.",
      "pt": "Capture um retângulo deste desktop e salve ou abra no Paint.",
      "ja": "このデスクトップの範囲を切り取り、保存またはペイントで開きます。"
    }
  },
  {
    "id": "characters",
    "href": "os/apps/characters/index.html",
    "icon": "../assets/icons/svg/os-characters.svg",
    "kind": "native",
    "suite": "accessories",
    "uninstallable": false,
    "defaultInstalled": true,
    "windowW": 640,
    "windowH": 520,
    "channel": "stable",
    "tag": {
      "en": "Accessories",
      "pt": "Acessórios",
      "ja": "アクセサリ"
    },
    "name": {
      "en": "Character Map",
      "pt": "Mapa de Caracteres",
      "ja": "文字コード表"
    },
    "desc": {
      "en": "Browse symbols and copy characters to the clipboard.",
      "pt": "Percorra símbolos e copie caracteres para a área de transferência.",
      "ja": "記号を探してクリップボードにコピーします。"
    }
  },
  {
    "id": "preview",
    "href": "os/apps/preview/index.html",
    "icon": "../assets/icons/svg/os-preview.svg",
    "kind": "native",
    "suite": "accessories",
    "uninstallable": false,
    "defaultInstalled": true,
    "channel": "stable",
    "tag": {
      "en": "Accessories",
      "pt": "Acessórios",
      "ja": "アクセサリ"
    },
    "name": {
      "en": "Preview",
      "pt": "Visualização",
      "ja": "プレビュー"
    },
    "desc": {
      "en": "Quick look for images and PDFs stored on this desktop.",
      "pt": "Visualização rápida de imagens e PDFs deste desktop.",
      "ja": "このデスクトップの画像と PDF をすばやく表示します。"
    }
  },
  {
    "id": "about",
    "href": "os/apps/about/index.html",
    "icon": "../assets/icons/svg/os-about.svg",
    "kind": "native",
    "suite": "accessories",
    "uninstallable": false,
    "defaultInstalled": true,
    "windowW": 480,
    "windowH": 520,
    "channel": "stable",
    "tag": {
      "en": "Accessories",
      "pt": "Acessórios",
      "ja": "アクセサリ"
    },
    "name": {
      "en": "About This Desktop",
      "pt": "Sobre este desktop",
      "ja": "このデスクトップについて"
    },
    "desc": {
      "en": "System summary in the spirit of About This Mac and winver.",
      "pt": "Resumo do sistema no espírito de Sobre este Mac e winver.",
      "ja": "この Mac について / winver 風のシステム概要。"
    }
  },
  {
    "id": "mobile-ar_object_scanner",
    "href": "mobile/ar_object_scanner.html",
    "icon": "../assets/icons/svg/mobile-ar_object_scanner.svg",
    "kind": "site",
    "uninstallable": true,
    "defaultInstalled": false,
    "channel": "stable",
    "tag": {
      "en": "AR + ONNX",
      "pt": "AR + ONNX",
      "ja": "AR + ONNX"
    },
    "name": {
      "en": "AR Object Scanner",
      "pt": "AR Object Scanner",
      "ja": "AR Object Scanner"
    },
    "desc": {
      "en": "Mobile-friendly webcam scanner that runs YOLOv8n COCO 80 ONNX locally in the browser and overlays AR-style object labels.",
      "pt": "Scanner de webcam amigável para celular que roda YOLOv8n COCO 80 ONNX localmente no navegador e sobrepõe etiquetas de objetos em estilo AR.",
      "ja": "スマホ向けのウェブカメラスキャナー。YOLOv8n COCO 80 ONNX をブラウザ内でローカル実行し、AR 風の物体ラベルを重ねます。"
    }
  },
  {
    "id": "utils-terminal",
    "href": "utils/terminal.html",
    "icon": "../assets/icons/svg/utils-terminal.svg",
    "kind": "site",
    "uninstallable": true,
    "defaultInstalled": true,
    "channel": "stable",
    "tag": {
      "en": "Shell",
      "pt": "Shell",
      "ja": "シェル"
    },
    "name": {
      "en": "VC Terminal",
      "pt": "VC Terminal",
      "ja": "VC Terminal"
    },
    "desc": {
      "en": "Linux-like browser shell with a persistent virtual filesystem, pipes, and common tools including ls, cat, grep, cp, mv, and vim.",
      "pt": "Shell no estilo Linux no navegador, com sistema de arquivos virtual persistente, pipes e comandos comuns como ls, cat, grep, cp, mv e vim.",
      "ja": "ブラウザ上の Linux 風シェル。仮想ファイルシステムを保存し、パイプと ls、cat、grep、cp、mv、vim などの基本コマンドを使えます。"
    },
    "multiInstance": true
  },
  {
    "id": "utils-flashcards_srs",
    "href": "utils/flashcards_srs.html",
    "icon": "../assets/icons/svg/utils-flashcards_srs.svg",
    "kind": "site",
    "uninstallable": true,
    "defaultInstalled": false,
    "channel": "stable",
    "tag": {
      "en": "Learning",
      "pt": "Aprendizado",
      "ja": "学習"
    },
    "name": {
      "en": "Orbit Cards",
      "pt": "Orbit Cards",
      "ja": "オービットカード"
    },
    "desc": {
      "en": "Spaced-repetition flashcards with decks, due reviews, CSV import/export, and offline IndexedDB storage.",
      "pt": "Flashcards com repetição espaçada, baralhos, revisões pendentes, importação e exportação CSV e armazenamento IndexedDB.",
      "ja": "間隔反復、デッキ、復習スケジュール、CSV入出力、IndexedDB保存に対応したフラッシュカード。"
    }
  },
  {
    "id": "utils-data_explorer",
    "href": "utils/data_explorer.html",
    "icon": "../assets/icons/svg/utils-data_explorer.svg",
    "kind": "site",
    "uninstallable": true,
    "defaultInstalled": false,
    "channel": "stable",
    "tag": {
      "en": "Data",
      "pt": "Dados",
      "ja": "データ"
    },
    "name": {
      "en": "Atlas Data Explorer",
      "pt": "Atlas Data Explorer",
      "ja": "Atlas データエクスプローラー"
    },
    "desc": {
      "en": "Open, filter, sort, profile, chart, and convert JSON, CSV, or TSV datasets entirely in the browser.",
      "pt": "Abra, filtre, ordene, analise, crie gráficos e converta conjuntos JSON, CSV ou TSV no navegador.",
      "ja": "JSON・CSV・TSVをブラウザ内で開き、検索、並べ替え、分析、グラフ化、変換できます。"
    },
    "multiInstance": true
  },
  {
    "id": "utils-pdf_image_tools",
    "href": "utils/pdf_image_tools.html",
    "icon": "../assets/icons/svg/utils-pdf_image_tools.svg",
    "kind": "site",
    "uninstallable": true,
    "defaultInstalled": true,
    "channel": "stable",
    "tag": {
      "en": "Files",
      "pt": "Arquivos",
      "ja": "ファイル"
    },
    "name": {
      "en": "PDF & Image Tools",
      "pt": "Ferramentas de PDF e Imagem",
      "ja": "PDF・画像ツール"
    },
    "desc": {
      "en": "Merge, split, rotate and extract PDF pages, turn images into one PDF, and batch-convert images to WebP. Everything runs in the browser.",
      "pt": "Junta, divide, gira e extrai páginas de PDF, transforma imagens num único PDF e converte imagens em lote para WebP. Tudo roda no navegador.",
      "ja": "PDF ページの結合・分割・回転・抽出、画像を 1 つの PDF にまとめる機能、画像の WebP 一括変換。すべてブラウザ内で動きます。"
    }
  },
  {
    "id": "utils-css_visual_lab",
    "href": "utils/css_visual_lab.html",
    "icon": "../assets/icons/svg/utils-css_visual_lab.svg",
    "kind": "site",
    "uninstallable": true,
    "defaultInstalled": true,
    "channel": "stable",
    "tag": {
      "en": "Design",
      "pt": "Design",
      "ja": "デザイン"
    },
    "name": {
      "en": "CSS Visual Lab",
      "pt": "CSS Visual Lab",
      "ja": "CSS Visual Lab"
    },
    "desc": {
      "en": "Visually compose gradients, shadows, glass surfaces, borders, and animations, then copy clean CSS.",
      "pt": "Crie visualmente gradientes, sombras, superfícies de vidro, bordas e animações e copie o CSS.",
      "ja": "グラデーション、影、ガラス表現、ボーダー、アニメーションを見ながら作成し、CSSをコピー。"
    }
  },
  {
    "id": "utils-pomodoro_garden",
    "href": "utils/pomodoro_garden.html",
    "icon": "../assets/icons/svg/utils-pomodoro_garden.svg",
    "kind": "site",
    "uninstallable": true,
    "defaultInstalled": false,
    "channel": "stable",
    "tag": {
      "en": "Focus",
      "pt": "Foco",
      "ja": "集中"
    },
    "name": {
      "en": "Pomodoro Garden",
      "pt": "Pomodoro Garden",
      "ja": "ポモドーロ・ガーデン"
    },
    "desc": {
      "en": "A persistent focus timer where every completed session grows a unique plant in an animated garden.",
      "pt": "Cronômetro de foco persistente em que cada sessão concluída cultiva uma planta única no jardim animado.",
      "ja": "集中セッションを完了するたび、保存可能なアニメーションの庭に新しい植物が育ちます。"
    }
  },
  {
    "id": "utils-whiteboards",
    "href": "utils/whiteboards.html",
    "icon": "../assets/icons/svg/utils-whiteboards.svg",
    "kind": "site",
    "uninstallable": true,
    "defaultInstalled": true,
    "channel": "stable",
    "tag": {
      "en": "Drawing",
      "pt": "Desenho",
      "ja": "描画"
    },
    "name": {
      "en": "Whiteboard",
      "pt": "Quadro Branco",
      "ja": "ホワイトボード"
    },
    "desc": {
      "en": "Whiteboard with board tabs, shapes, text, images and autosave, plus two alternative builds made with Gemini and GPT.",
      "pt": "Quadro branco com abas, formas, texto, imagens e salvamento automático, e duas versões alternativas feitas com Gemini e GPT.",
      "ja": "ボードタブ・図形・テキスト・画像・自動保存に対応したホワイトボードと、Gemini と GPT で作った別版 2 つ。"
    }
  },
  {
    "id": "utils-photo_editor",
    "href": "utils/photo_editor.html",
    "icon": "../assets/icons/svg/utils-photo_editor.svg",
    "kind": "site",
    "uninstallable": true,
    "defaultInstalled": true,
    "channel": "stable",
    "tag": {
      "en": "Image",
      "pt": "Imagem",
      "ja": "画像"
    },
    "name": {
      "en": "Photo Editor",
      "pt": "Editor de Fotos",
      "ja": "フォトエディタ"
    },
    "desc": {
      "en": "Layered image editors: Pro with selections, filters, history and file saving, and the lighter Classic version.",
      "pt": "Editores de imagem com camadas: Pro, com seleções, filtros, histórico e salvamento de arquivos, e a versão Clássica, mais leve.",
      "ja": "レイヤー対応の画像エディタ。選択・フィルター・履歴・ファイル保存を備えた Pro と、軽量な Classic。"
    }
  },
  {
    "id": "utils-vector_editor",
    "href": "utils/vector_editor.html",
    "icon": "../assets/icons/svg/utils-vector_editor.svg",
    "kind": "site",
    "uninstallable": true,
    "defaultInstalled": true,
    "channel": "stable",
    "tag": {
      "en": "Vector",
      "pt": "Vetor",
      "ja": "ベクター"
    },
    "name": {
      "en": "Vector Studio",
      "pt": "Vector Studio",
      "ja": "Vector Studio"
    },
    "desc": {
      "en": "Single-file SVG editor focused on vector shapes, paths and text, with autosave, export, hotkeys, themes, and EN/PT/JA UI.",
      "pt": "Editor SVG em arquivo único focado em formas vetoriais, paths e texto, com autosave, exportação, hotkeys, temas e UI EN/PT/JA.",
      "ja": "図形・パス・テキスト中心の単一ファイル SVG エディタ。オートセーブ、書き出し、ホットキー、テーマ、EN/PT/JA UI に対応。"
    }
  },
  {
    "id": "utils-form_builder",
    "href": "utils/form_builder.html",
    "icon": "../assets/icons/svg/utils-form_builder.svg",
    "kind": "site",
    "uninstallable": true,
    "defaultInstalled": false,
    "channel": "stable",
    "tag": {
      "en": "Database",
      "pt": "Banco",
      "ja": "データベース"
    },
    "name": {
      "en": "Form Builder DB",
      "pt": "Form Builder DB",
      "ja": "Form Builder DB"
    },
    "desc": {
      "en": "Design custom forms, store records in IndexedDB, switch between table and form views, and scaffold lookup plus many-to-many relations with junction forms.",
      "pt": "Crie formulários personalizados, salve registros em IndexedDB, alterne entre visualização em tabela e formulário, e monte relações lookup e muitos-para-muitos com junction forms.",
      "ja": "カスタムフォームを設計し、レコードを IndexedDB に保存し、テーブル表示とフォーム表示を切り替え、lookup と多対多の関係を junction form で構築できます。"
    }
  },
  {
    "id": "utils-pixel_studio",
    "href": "utils/pixel_studio.html",
    "icon": "../assets/icons/svg/utils-pixel_studio.svg",
    "kind": "site",
    "uninstallable": true,
    "defaultInstalled": false,
    "channel": "stable",
    "tag": {
      "en": "Image",
      "pt": "Imagem",
      "ja": "画像"
    },
    "name": {
      "en": "Pixel Studio",
      "pt": "Estúdio Pixel",
      "ja": "ピクセルスタジオ"
    },
    "desc": {
      "en": "Pixel art editors: Sprint with layers and frame animation, plus the Modern and Vintage editors.",
      "pt": "Editores de pixel art: Sprint, com camadas e animação por quadros, e os editores Moderno e Retrô.",
      "ja": "ピクセルアートエディタ。レイヤーとフレームアニメーションの Sprint、モダン版とレトロ版。"
    }
  },
  {
    "id": "utils-dev_utils",
    "href": "utils/dev_utils.html",
    "icon": "../assets/icons/svg/utils-dev_utils.svg",
    "kind": "site",
    "uninstallable": true,
    "defaultInstalled": true,
    "channel": "stable",
    "tag": {
      "en": "Converters",
      "pt": "Conversores",
      "ja": "コンバーター"
    },
    "name": {
      "en": "Dev Utils",
      "pt": "Utilitários de Desenvolvedor",
      "ja": "開発者向けユーティリティ"
    },
    "desc": {
      "en": "Developer tools in one page: Base64, URL, MD5/SHA/HMAC, HTML/Unicode, JSON, CSV, YAML and XML converters, plus regex tester, text diff, fake data, Morse code, character art and password generator.",
      "pt": "Ferramentas de desenvolvimento numa só página: conversores Base64, URL, MD5/SHA/HMAC, HTML/Unicode, JSON, CSV, YAML e XML, além de testador de regex, diff de texto, dados falsos, código Morse, arte com caracteres e gerador de senhas.",
      "ja": "開発者向けツールを 1 ページに：Base64・URL・MD5/SHA/HMAC・HTML/Unicode・JSON・CSV・YAML・XML の変換に加え、正規表現テスター、テキスト差分、ダミーデータ、モールス信号、文字アート、パスワード生成。"
    }
  },
  {
    "id": "utils-handwritten_digit_ocr",
    "href": "utils/handwritten_digit_ocr.html",
    "icon": "../assets/icons/svg/utils-handwritten_digit_ocr.svg",
    "kind": "site",
    "uninstallable": true,
    "defaultInstalled": false,
    "channel": "stable",
    "tag": {
      "en": "OCR",
      "pt": "OCR",
      "ja": "OCR"
    },
    "name": {
      "en": "Handwritten Digit OCR",
      "pt": "OCR de Dígitos Manuscritos",
      "ja": "手書き数字 OCR"
    },
    "desc": {
      "en": "Client-side OCR prototype for boxed handwritten digits. Uses OpenCV.js for form correction and ONNX Runtime Web with a local MNIST model.",
      "pt": "Protótipo de OCR client-side para dígitos manuscritos em caixas. Usa OpenCV.js para corrigir o formulário e ONNX Runtime Web com um modelo MNIST local.",
      "ja": "箱付き手書き数字向けのクライアント側OCRプロトタイプ。OpenCV.jsでフォームを補正し、ONNX Runtime WebとローカルMNISTモデルで認識します。"
    }
  },
  {
    "id": "utils-color_picker",
    "href": "utils/color_picker.html",
    "icon": "../assets/icons/svg/utils-color_picker.svg",
    "kind": "site",
    "uninstallable": true,
    "defaultInstalled": true,
    "channel": "stable",
    "tag": {
      "en": "Color",
      "pt": "Cores",
      "ja": "色"
    },
    "name": {
      "en": "Color Picker",
      "pt": "Color Picker",
      "ja": "カラーピッカー"
    },
    "desc": {
      "en": "Pick colors with native controls, HEX/RGB typing, RGB/HSL sliders, palettes, harmony suggestions, history, and copy-ready values.",
      "pt": "Escolha cores com seletor nativo, digitação HEX/RGB, sliders RGB/HSL, paletas, sugestões de harmonia, histórico e valores prontos para copiar.",
      "ja": "標準ピッカー、HEX/RGB入力、RGB/HSLスライダー、パレット、配色提案、履歴、コピー用の値を備えたカラーツール。"
    }
  },
  {
    "id": "utils-local_image_gallery",
    "href": "utils/local_image_gallery.html",
    "icon": "../assets/icons/svg/utils-local_image_gallery.svg",
    "kind": "site",
    "uninstallable": true,
    "defaultInstalled": true,
    "channel": "stable",
    "tag": {
      "en": "Photos",
      "pt": "Fotos",
      "ja": "写真"
    },
    "name": {
      "en": "Local Image Gallery",
      "pt": "Galeria Local de Imagens",
      "ja": "ローカル画像ギャラリー"
    },
    "desc": {
      "en": "Choose a local folder and browse its images in a private client-side gallery with grid/masonry layouts, sorting, sizing controls and full-screen preview.",
      "pt": "Escolha uma pasta local e navegue pelas imagens em uma galeria privada no navegador, com layouts grid/masonry, ordenação, controle de tamanho e preview em tela cheia.",
      "ja": "ローカルフォルダを選んで、グリッド/Masonry レイアウト、並び替え、サイズ調整、全画面プレビュー付きのプライベートなクライアント側ギャラリーで画像を閲覧できます。"
    }
  },
  {
    "id": "utils-time_tools",
    "href": "utils/time_tools.html",
    "icon": "../assets/icons/svg/utils-time_tools.svg",
    "kind": "site",
    "uninstallable": true,
    "defaultInstalled": true,
    "channel": "stable",
    "tag": {
      "en": "Utility",
      "pt": "Utilitário",
      "ja": "ユーティリティ"
    },
    "name": {
      "en": "Time Tools",
      "pt": "Ferramentas de Tempo",
      "ja": "時間ツール"
    },
    "desc": {
      "en": "Stopwatch, countdown, clock, unit timing, time difference, time sum, age, world clocks and forex sessions, as tabs in one page. Timers keep running across tabs.",
      "pt": "Cronômetro, contagem regressiva, relógio, tempo por unidade, diferença e soma de tempos, idade, relógios mundiais e sessões forex, em abas numa só página. Os cronômetros continuam rodando entre as abas.",
      "ja": "ストップウォッチ、カウントダウン、時計、単位ごとの時間、時間差、時間合計、年齢、世界時計、FX 取引時間を 1 ページのタブにまとめました。タブを切り替えてもタイマーは動き続けます。"
    }
  },
  {
    "id": "utils-checklist",
    "href": "utils/checklist.html",
    "icon": "../assets/icons/svg/utils-checklist.svg",
    "kind": "site",
    "uninstallable": true,
    "defaultInstalled": true,
    "channel": "stable",
    "tag": {
      "en": "Productivity",
      "pt": "Produtividade",
      "ja": "生産性"
    },
    "name": {
      "en": "Checklist Manager",
      "pt": "Gerenciador de Checklists",
      "ja": "チェックリストマネージャー"
    },
    "desc": {
      "en": "Reusable checklist templates (daily, monthly or activity) run as timestamped instances with per-item notes and history, plus a quick to-do list. Saved in the browser.",
      "pt": "Modelos de checklist reutilizáveis (diários, mensais ou por atividade) executados com data e hora, notas por item e histórico, além de uma lista rápida de tarefas. Salvo no navegador.",
      "ja": "日次・月次・作業別の再利用できるチェックリストテンプレートを、タイムスタンプ付きで実行し、項目メモと履歴を残せます。クイック ToDo リスト付き。ブラウザに保存します。"
    }
  },
  {
    "id": "utils-gallery",
    "href": "utils/gallery.html",
    "icon": "../assets/icons/svg/utils-gallery.svg",
    "kind": "site",
    "uninstallable": true,
    "defaultInstalled": true,
    "channel": "stable",
    "tag": {
      "en": "Photos",
      "pt": "Fotos",
      "ja": "写真"
    },
    "name": {
      "en": "Image Gallery",
      "pt": "Galeria de Imagens",
      "ja": "画像ギャラリー"
    },
    "desc": {
      "en": "Upload images into an IndexedDB-backed gallery, open them fullscreen, remove them, and control their order with a numeric value.",
      "pt": "Envie imagens para uma galeria com IndexedDB, abra em tela cheia, remova e controle a ordem com um valor numérico.",
      "ja": "画像を IndexedDB 保存のギャラリーに追加し、全画面表示、削除、数値による表示順の調整ができます。"
    }
  },
  {
    "id": "utils-kanban",
    "href": "utils/kanban.html",
    "icon": "../assets/icons/svg/utils-kanban.svg",
    "kind": "site",
    "uninstallable": true,
    "defaultInstalled": true,
    "channel": "stable",
    "tag": {
      "en": "Productivity",
      "pt": "Produtividade",
      "ja": "生産性"
    },
    "name": {
      "en": "Kanban Board",
      "pt": "Quadro Kanban",
      "ja": "カンバンボード"
    },
    "desc": {
      "en": "Draggable Kanban board with customizable columns, cards with priority, due date, and labels, search/filter, and IndexedDB persistence. Multilingual UI (EN/PT/JA) and light/dark themes.",
      "pt": "Quadro Kanban com colunas arrastáveis e personalizáveis, cards com prioridade, prazo e etiquetas, busca/filtro e persistência IndexedDB. Interface multilíngue (EN/PT/JA) e temas claro/escuro.",
      "ja": "カラムをカスタマイズできるドラッグ可能なカンバンボード。カードに優先度・期日・ラベルを設定し、検索・フィルター・IndexedDB保存が可能。多言語UI（EN/PT/JA）とライト/ダークテーマ対応。"
    }
  },
  {
    "id": "utils-step_sequencer",
    "href": "utils/step_sequencer.html",
    "icon": "../assets/icons/svg/utils-step_sequencer.svg",
    "kind": "site",
    "uninstallable": true,
    "defaultInstalled": false,
    "channel": "stable",
    "tag": {
      "en": "Music",
      "pt": "Música",
      "ja": "音楽"
    },
    "name": {
      "en": "Step Sequencer 8-bit",
      "pt": "Sequenciador Step 8-bit",
      "ja": "ステップシーケンサー 8-bit"
    },
    "desc": {
      "en": "8-track × 16-step drum and melody sequencer with Web Audio API synthesis, BPM control, musical scales, mute/solo, pattern slots, and WAV export. No samples needed.",
      "pt": "Sequenciador de 8 tracks × 16 passos para bateria e melodia. Síntese via Web Audio API, controle de BPM, escalas musicais, mute/solo, slots de padrão e exportação WAV. Sem samples externos.",
      "ja": "8トラック×16ステップのドラム＆メロディシーケンサー。Web Audio API合成、BPM制御、音楽スケール、ミュート/ソロ、パターンスロット、WAV書き出し対応。サンプル不要。"
    }
  },
  {
    "id": "utils-calculators",
    "href": "utils/calculators.html",
    "icon": "../assets/icons/svg/utils-calculators.svg",
    "kind": "site",
    "uninstallable": true,
    "defaultInstalled": true,
    "channel": "stable",
    "tag": {
      "en": "Utility",
      "pt": "Utilitário",
      "ja": "ユーティリティ"
    },
    "name": {
      "en": "Calculators",
      "pt": "Calculadoras",
      "ja": "計算機"
    },
    "desc": {
      "en": "Simple, sum and expression calculators, a bandwidth calculator (MB/s and Mbps) and a bitwise converter with decimal, binary and hex, as tabs in one page.",
      "pt": "Calculadoras simples, de soma e de expressões, calculadora de banda (MB/s e Mbps) e conversor bit a bit com decimal, binário e hexadecimal, em abas numa só página.",
      "ja": "シンプル・合計・数式の計算機、帯域計算機（MB/s と Mbps）、10 進・2 進・16 進のビット変換を 1 ページのタブにまとめました。"
    }
  },
  {
    "id": "utils-credit_planner",
    "href": "utils/credit_planner.html",
    "icon": "../assets/icons/svg/utils-credit_planner.svg",
    "kind": "site",
    "uninstallable": true,
    "defaultInstalled": false,
    "channel": "stable",
    "tag": {
      "en": "Productivity",
      "pt": "Produtividade",
      "ja": "生産性"
    },
    "name": {
      "en": "Credit Usage Planner",
      "pt": "Planejador de Uso de Créditos",
      "ja": "クレジット使用プランナー"
    },
    "desc": {
      "en": "Track service credits by billing period and calculate the daily usage needed to finish the period without running out or wasting credits. IndexedDB storage, multilingual UI, and light/dark themes.",
      "pt": "Registre créditos de serviços por período de cobrança e calcule o uso diário necessário para terminar o período sem faltar ou desperdiçar créditos. Armazenamento IndexedDB, UI multilíngue e temas claro/escuro.",
      "ja": "請求期間ごとにサービスのクレジットを管理し、足りなくなったり無駄にしたりしないために必要な1日あたりの使用量を計算します。IndexedDB保存、多言語UI、ライト/ダークテーマ対応。"
    }
  },
  {
    "id": "utils-docs",
    "href": "utils/docs.html",
    "icon": "../assets/icons/svg/utils-docs.svg",
    "kind": "site",
    "uninstallable": true,
    "defaultInstalled": true,
    "channel": "stable",
    "tag": {
      "en": "Productivity",
      "pt": "Produtividade",
      "ja": "生産性"
    },
    "name": {
      "en": "Docs",
      "pt": "Documentos",
      "ja": "ドキュメント"
    },
    "desc": {
      "en": "Markdown editor with preview and a plain-text notebook, both organized in projects, books and pages and saved in the browser.",
      "pt": "Editor Markdown com pré-visualização e um caderno de texto simples, ambos organizados em projetos, livros e páginas e salvos no navegador.",
      "ja": "プレビュー付きの Markdown エディタとプレーンテキストのノート。どちらもプロジェクト・ブック・ページで整理し、ブラウザに保存します。"
    },
    "multiInstance": true
  },
  {
    "id": "utils-obsidian",
    "href": "utils/obsidian.html",
    "icon": "../assets/icons/svg/utils-obsidian.svg",
    "kind": "site",
    "uninstallable": true,
    "defaultInstalled": true,
    "channel": "stable",
    "tag": {
      "en": "Editor",
      "pt": "Editor",
      "ja": "エディタ"
    },
    "name": {
      "en": "Vault Markdown",
      "pt": "Vault Markdown",
      "ja": "Vault Markdown"
    },
    "desc": {
      "en": "Obsidian-style Markdown vaults in the browser with multiple vaults, folders, wiki links that create missing notes, IndexedDB storage, and ZIP import/export.",
      "pt": "Vaults Markdown estilo Obsidian no navegador, com múltiplos vaults, pastas, wiki links que criam notas inexistentes, armazenamento IndexedDB e importação/exportação ZIP.",
      "ja": "ブラウザで使えるObsidian風Markdown Vault。複数Vault、フォルダ、存在しないノートを作成できるWikiリンク、IndexedDB保存、ZIPインポート/エクスポートに対応。"
    }
  },
  {
    "id": "utils-test_builder",
    "href": "utils/test_builder.html",
    "icon": "../assets/icons/svg/utils-test_builder.svg",
    "kind": "site",
    "uninstallable": true,
    "defaultInstalled": false,
    "channel": "stable",
    "tag": {
      "en": "Test",
      "pt": "Teste",
      "ja": "テスト"
    },
    "name": {
      "en": "Test Builder",
      "pt": "Criador de Teste",
      "ja": "テストビルダー"
    },
    "desc": {
      "en": "Create multiple-choice questions with Project, Test, and Question hierarchy. Export/import JSON, export rendered TXT/HTML with or without answers, bilingual options, editable export CSS. IndexedDB storage, search (test/project/all).",
      "pt": "Crie perguntas de múltipla escolha com hierarquia Projeto, Teste e Pergunta. Exportar/importar JSON, exportar TXT/HTML renderizado com ou sem respostas, opções bilíngues, CSS de exportação editável. Armazenamento IndexedDB, busca (teste/projeto/tudo).",
      "ja": "プロジェクト・テスト・質問の階層で多肢選択問題を作成。JSONのエクスポート/インポート、回答あり/なしのTXT/HTML出力、二言語対応、出力用CSS編集可能。IndexedDB保存、検索（テスト/プロジェクト/全体）。"
    }
  },
  {
    "id": "utils-mouse_tester",
    "href": "utils/mouse_tester.html",
    "icon": "../assets/icons/svg/utils-mouse_tester.svg",
    "kind": "site",
    "uninstallable": true,
    "defaultInstalled": false,
    "channel": "stable",
    "tag": {
      "en": "Hardware",
      "pt": "Hardware",
      "ja": "ハードウェア"
    },
    "name": {
      "en": "Mouse Tester",
      "pt": "Testador de Mouse",
      "ja": "マウステスター"
    },
    "desc": {
      "en": "Test every mouse button live, including left, middle, right, Button 3 (Back), Button 4 (Forward), and scroll-wheel movement. Events are counted and logged instantly.",
      "pt": "Teste todos os botões do mouse ao vivo: esquerdo, meio, direito, Botão 3 (Voltar), Botão 4 (Avançar) e a roda de rolagem. Os eventos são contados e registrados na hora.",
      "ja": "左・中央・右ボタン、ボタン3（戻る）、ボタン4（進む）、スクロールホイールをリアルタイムでテストします。イベントはすぐにカウント・記録されます。"
    }
  },
  {
    "id": "utils-audio_player",
    "href": "utils/audio_player.html",
    "icon": "../assets/icons/svg/utils-audio_player.svg",
    "kind": "site",
    "uninstallable": true,
    "defaultInstalled": true,
    "channel": "stable",
    "tag": {
      "en": "Media",
      "pt": "Mídia",
      "ja": "メディア"
    },
    "name": {
      "en": "Audio Player",
      "pt": "Player de Áudio",
      "ja": "オーディオプレイヤー"
    },
    "desc": {
      "en": "Audio player with two-level folders, IndexedDB storage, and drag-and-drop. Tracks have editable name and description/lyrics; optional continue-to-next per subfolder; full player controls and volume.",
      "pt": "Player de áudio com pastas em dois níveis, armazenamento em IndexedDB e arrastar-e-soltar. Faixas com nome e descrição/letras editáveis; opção continuar para o próximo por subpasta; controles e volume.",
      "ja": "2階層フォルダ、IndexedDB保存、ドラッグ＆ドロップ対応のオーディオプレイヤー。トラック名・説明/歌詞の編集、サブフォルダごとの「次へ続く」オプション、再生コントロールと音量。"
    }
  },
  {
    "id": "utils-copy_tool",
    "href": "utils/copy_tool.html",
    "icon": "../assets/icons/svg/utils-copy_tool.svg",
    "kind": "site",
    "uninstallable": true,
    "defaultInstalled": true,
    "channel": "stable",
    "tag": {
      "en": "Productivity",
      "pt": "Produtividade",
      "ja": "生産性"
    },
    "name": {
      "en": "Copy Tool",
      "pt": "Ferramenta de Cópia",
      "ja": "コピーツール"
    },
    "desc": {
      "en": "Clipboard management tool with multiple workspaces, drag & drop organization, and import/export functionality. Features edit and drag modes.",
      "pt": "Ferramenta de gerenciamento de área de transferência com múltiplos espaços de trabalho, organização por arrastar e soltar e funcionalidade de importar/exportar. Apresenta modos de edição e arrastar.",
      "ja": "複数のワークスペース、ドラッグ＆ドロップ整理、インポート/エクスポート機能を備えたクリップボード管理ツール。編集モードとドラッグモードを特徴とします。"
    }
  },
  {
    "id": "utils-fullscreen_message",
    "href": "utils/fullscreen_message.html",
    "icon": "../assets/icons/svg/utils-fullscreen_message.svg",
    "kind": "site",
    "uninstallable": true,
    "defaultInstalled": true,
    "channel": "stable",
    "tag": {
      "en": "Display",
      "pt": "Exibição",
      "ja": "表示"
    },
    "name": {
      "en": "Full Screen Message",
      "pt": "Mensagem em Tela Cheia",
      "ja": "フルスクリーンメッセージ"
    },
    "desc": {
      "en": "Create and display customizable full-screen messages with adjustable colors, font sizes, and shadows. Features multilingual UI and theme support.",
      "pt": "Crie e exiba mensagens em tela cheia personalizáveis com cores, tamanhos de fonte e sombras ajustáveis. Apresenta interface multilíngue e suporte a temas.",
      "ja": "カスタマイズ可能なフルスクリーンメッセージを作成・表示。色、フォントサイズ、影を調整可能。多言語UIとテーマサポートを特徴とします。"
    }
  },
  {
    "id": "utils-prompt_concat",
    "href": "utils/prompt_concat.html",
    "icon": "../assets/icons/svg/utils-prompt_concat.svg",
    "kind": "site",
    "uninstallable": true,
    "defaultInstalled": true,
    "channel": "stable",
    "tag": {
      "en": "Productivity",
      "pt": "Produtividade",
      "ja": "生産性"
    },
    "name": {
      "en": "Prompt Concat",
      "pt": "Prompt Concat",
      "ja": "プロンプト結合"
    },
    "desc": {
      "en": "Prompt template expander: write an input with {V1..V5}, fill lists, and generate all combinations. Uses URL hash to scope localStorage.",
      "pt": "Expansor de template de prompt: escreva um input com {V1..V5}, preencha listas e gere todas as combinações. Usa o hash da URL para separar o localStorage.",
      "ja": "プロンプト用テンプレート展開ツール：{V1..V5}を含む入力を書き、リストを入れて全組み合わせを生成。URLハッシュでlocalStorageを切り替え。"
    }
  },
  {
    "id": "utils-wheel_picker",
    "href": "utils/wheel_picker.html",
    "icon": "../assets/icons/svg/utils-wheel_picker.svg",
    "kind": "site",
    "uninstallable": true,
    "defaultInstalled": true,
    "channel": "stable",
    "tag": {
      "en": "Utility",
      "pt": "Utilitário",
      "ja": "ユーティリティ"
    },
    "name": {
      "en": "Wheel Picker",
      "pt": "Roleta de Sorteio",
      "ja": "抽選ルーレット"
    },
    "desc": {
      "en": "Large wheel-based picker for raffles and decisions. Edit one item per line, spin to select a random result, choose color themes, and save each wheel by URL hash in IndexedDB.",
      "pt": "Roleta grande para sorteios e decisões. Edite um item por linha, gire para sortear um resultado, escolha temas de cores e salve cada roleta por hash da URL no IndexedDB.",
      "ja": "抽選や意思決定向けの大型ルーレット。1行1項目で編集し、回してランダム結果を選択できます。配色テーマに対応し、URLハッシュごとにIndexedDBへ保存します。"
    }
  },
  {
    "id": "utils-paste_canvas",
    "href": "utils/paste_canvas.html",
    "icon": "../assets/icons/svg/utils-paste_canvas.svg",
    "kind": "site",
    "uninstallable": true,
    "defaultInstalled": false,
    "channel": "stable",
    "tag": {
      "en": "Canvas",
      "pt": "Canvas",
      "ja": "キャンバス"
    },
    "name": {
      "en": "Paste Canvas",
      "pt": "Canvas Colar",
      "ja": "ペーストキャンバス"
    },
    "desc": {
      "en": "Paste, upload, or drag-and-drop images onto a white canvas. Add rectangles, rounded rectangles, lines, arrows (with draggable endpoints), and text. Configure border and shadow for all objects. Context menu: bring to front, send to back, duplicate, delete. Multilingual UI (EN/PT/JA) and light/dark theme.",
      "pt": "Cole, envie ou arraste imagens para um canvas branco. Adicione retângulos, retângulos com bordas ovais, linhas, setas (com pontas arrastáveis) e texto. Configure borda e sombra para todos os objetos. Menu de contexto: trazer à frente, enviar para trás, duplicar, apagar. Interface multilíngue (EN/PT/JA) e tema claro/escuro.",
      "ja": "白いキャンバスに画像を貼り付け、アップロード、またはドラッグ＆ドロップ。四角、角丸四角、線、矢印（端点をドラッグ可能）、テキストを追加。全オブジェクトの枠線と影を設定。コンテキストメニュー：最前面へ、最背面へ、複製、削除。多言語UI（EN/PT/JA）とライト/ダークテーマ。"
    }
  },
  {
    "id": "utils-backup",
    "href": "utils/backup.html",
    "icon": "../assets/icons/svg/utils-backup.svg",
    "kind": "site",
    "uninstallable": false,
    "defaultInstalled": true,
    "channel": "stable",
    "tag": {
      "en": "Storage",
      "pt": "Armazenamento",
      "ja": "ストレージ"
    },
    "name": {
      "en": "Backup & Restore",
      "pt": "Backup & Restauração",
      "ja": "バックアップと復元"
    },
    "desc": {
      "en": "Export all localStorage and IndexedDB data as a single JSON backup file. Restore from a backup to migrate data between browsers or devices. Supports merge and full replace modes. Handles binary data (Blobs, ArrayBuffers).",
      "pt": "Exporte todos os dados do localStorage e IndexedDB como um único arquivo JSON de backup. Restaure a partir de um backup para migrar dados entre navegadores ou dispositivos. Suporta modos de mesclagem e substituição total. Trata dados binários (Blobs, ArrayBuffers).",
      "ja": "localStorageとIndexedDBの全データを1つのJSONバックアップファイルとしてエクスポート。バックアップから復元してブラウザやデバイス間でデータを移行。マージと完全置換モードに対応。バイナリデータ（Blob、ArrayBuffer）も処理可能。"
    },
    "settingsPane": "backup"
  },
  {
    "id": "game-range-club",
    "href": "game/range-club/index.html",
    "icon": "../assets/icons/svg/game-range-club.svg",
    "kind": "site",
    "uninstallable": true,
    "defaultInstalled": false,
    "channel": "stable",
    "tag": {
      "en": "3D Shooting Range",
      "pt": "Stand de tiro 3D",
      "ja": "3D射撃場"
    },
    "name": {
      "en": "Range Club",
      "pt": "Range Club",
      "ja": "Range Club"
    },
    "desc": {
      "en": "A detailed 3D shooting range with woodland, outdoor and indoor environments, five weapons, custom photo targets, wind and weapon sway. Play freely or earn credits in a 12-stage tournament.",
      "pt": "Stand 3D detalhado com bosque, campo aberto e ambiente interno, cinco armas, alvos com suas fotos, vento e balanço. Jogue livremente ou ganhe créditos em um torneio de 12 etapas.",
      "ja": "森林・草原・屋内の3D射撃場。5種類の武器、写真付き標的、風と揺れを再現。自由に遊ぶか、全12ステージの大会でクレジットを獲得できます。"
    }
  },
  {
    "id": "game-voxelcraft",
    "href": "game/voxelcraft/index.html",
    "icon": "../assets/icons/svg/game-voxelcraft.svg",
    "kind": "site",
    "uninstallable": true,
    "defaultInstalled": true,
    "channel": "stable",
    "tag": {
      "en": "Voxel Sandbox",
      "pt": "Sandbox voxel",
      "ja": "ボクセル"
    },
    "name": {
      "en": "VoxelCraft",
      "pt": "VoxelCraft",
      "ja": "VoxelCraft"
    },
    "desc": {
      "en": "First-person 3D sandbox: punch trees, craft tools, mine stone and ore, place blocks, and explore a voxel world with visible arms.",
      "pt": "Sandbox 3D em primeira pessoa: quebre árvores, crie ferramentas, mine pedra e minério, coloque blocos e explore um mundo voxel com os braços visíveis.",
      "ja": "一人称の3Dサンドボックス。木を切り、道具を作り、石と鉱石を掘り、ブロックを置いて、腕の見えるボクセル世界を探検します。"
    }
  },
  {
    "id": "game-sculpt-lab",
    "href": "game/sculpt-lab/index.html",
    "icon": "../assets/icons/svg/game-sculpt-lab.svg",
    "kind": "site",
    "uninstallable": true,
    "defaultInstalled": false,
    "channel": "stable",
    "tag": {
      "en": "3D Sculpting",
      "pt": "Escultura 3D",
      "ja": "3Dスカルプト"
    },
    "name": {
      "en": "Orbit Sculpt Lab",
      "pt": "Orbit Sculpt Lab",
      "ja": "Orbit Sculpt Lab"
    },
    "desc": {
      "en": "Sculpt and paint a sphere or box in Three.js with Clay, Inflate, Grab, Smooth, and Paint tools. Save projects in IndexedDB, import/export JSON, or export the colored mesh as GLB.",
      "pt": "Escale e pinte uma esfera ou caixa em Three.js com ferramentas Clay, Inflar, Puxar, Suavizar e Pintar. Salve projetos no IndexedDB, importe/exporte JSON ou exporte a malha colorida como GLB.",
      "ja": "Three.jsで球体やボックスを造形・ペイントできます。Clay、膨張、引っ張り、スムーズ、ペイントを搭載し、IndexedDBへの保存、JSON入出力、色付きGLB出力に対応。"
    }
  },
  {
    "id": "game-forex_sim",
    "href": "game/forex_sim.html",
    "icon": "../assets/icons/svg/game-forex_sim.svg",
    "kind": "site",
    "uninstallable": true,
    "defaultInstalled": true,
    "channel": "stable",
    "tag": {
      "en": "Trading Sim",
      "pt": "Simulador de trade",
      "ja": "トレーディング"
    },
    "name": {
      "en": "VC Forex",
      "pt": "VC Forex",
      "ja": "VC Forex"
    },
    "desc": {
      "en": "Borrow from the bank, trade live USD/VC candles with stop-loss and take-profit, and try not to sink $100,000,000 into interest and bad trades.",
      "pt": "Pegue empréstimos no banco, opere candles ao vivo de USD/VC com stop e take, e tente não chegar a US$ 100.000.000 de prejuízo.",
      "ja": "銀行から借りて USD/VC のライブローソク足を取引し、損切りと利確を使い、金利と損失で 1億ドルまで沈まないようにするシミュレーター。"
    }
  },
  {
    "id": "game-factory_flow",
    "href": "game/factory_flow.html",
    "icon": "../assets/icons/svg/game-factory_flow.svg",
    "kind": "site",
    "uninstallable": true,
    "defaultInstalled": false,
    "channel": "stable",
    "tag": {
      "en": "Automation Puzzle",
      "pt": "Puzzle de automação",
      "ja": "自動化パズル"
    },
    "name": {
      "en": "Factory Flow",
      "pt": "Factory Flow",
      "ja": "Factory Flow"
    },
    "desc": {
      "en": "Build conveyor lines with assemblers and splitters, then tune the factory to ship each production target.",
      "pt": "Monte linhas com esteiras, montadoras e divisores e ajuste a fábrica para entregar cada meta de produção.",
      "ja": "コンベア、組立機、分岐機で生産ラインを作り、目標数の製品を出荷するパズル。"
    }
  },
  {
    "id": "game-marble_track_builder",
    "href": "game/marble_track_builder.html",
    "icon": "../assets/icons/svg/game-marble_track_builder.svg",
    "kind": "site",
    "uninstallable": true,
    "defaultInstalled": false,
    "channel": "stable",
    "tag": {
      "en": "Physics Builder",
      "pt": "Construção e física",
      "ja": "物理ビルダー"
    },
    "name": {
      "en": "Marble Track Builder",
      "pt": "Marble Track Builder",
      "ja": "Marble Track Builder"
    },
    "desc": {
      "en": "Draw tracks and combine bumpers, springs, and paired portals to guide marbles into the goal.",
      "pt": "Desenhe pistas e combine rebatedores, molas e portais em pares para levar as bolinhas ao destino.",
      "ja": "コースを描き、バンパー、スプリング、ペアのポータルを組み合わせてビー玉をゴールへ導きます。"
    }
  },
  {
    "id": "game-cargo_dispatcher",
    "href": "game/cargo_dispatcher.html",
    "icon": "../assets/icons/svg/game-cargo_dispatcher.svg",
    "kind": "site",
    "uninstallable": true,
    "defaultInstalled": false,
    "channel": "stable",
    "tag": {
      "en": "Logistics Puzzle",
      "pt": "Puzzle de logística",
      "ja": "物流パズル"
    },
    "name": {
      "en": "Cargo Dispatcher",
      "pt": "Cargo Dispatcher",
      "ja": "Cargo Dispatcher"
    },
    "desc": {
      "en": "Operate switches and signals in real time to route color-coded cargo trains without collisions.",
      "pt": "Opere desvios e sinais em tempo real para rotear trens de carga coloridos sem colisões.",
      "ja": "分岐と信号をリアルタイムで操作し、色分けされた貨物列車を衝突なしで配送します。"
    }
  },
  {
    "id": "game-service-tycoon",
    "href": "game/service-tycoon/index.html",
    "icon": "../assets/icons/svg/game-service-tycoon.svg",
    "kind": "site",
    "uninstallable": true,
    "defaultInstalled": true,
    "channel": "stable",
    "tag": {
      "en": "Management Sim",
      "pt": "Simulação de gestão",
      "ja": "経営シミュレーション"
    },
    "name": {
      "en": "Service Floor Tycoon",
      "pt": "Service Floor Tycoon",
      "ja": "サービスフロア・タイクーン"
    },
    "desc": {
      "en": "Build a service business with a configurable floor plan, animated customers, staff, queues, upgrades, and fully editable Academy or Restaurant scenarios saved in IndexedDB.",
      "pt": "Construa um negócio de serviços com planta configurável, clientes e equipe animados, filas, upgrades e cenários totalmente editáveis de escola ou restaurante, salvos no IndexedDB.",
      "ja": "設定可能なフロア図、アニメーションする顧客とスタッフ、行列、アップグレードを備えたサービス事業を運営。学校・レストランのシナリオを自由に編集し、IndexedDBに保存できます。"
    }
  },
  {
    "id": "game-river-raid",
    "href": "game/river-raid.html",
    "icon": "../assets/icons/svg/game-river-raid.svg",
    "kind": "site",
    "uninstallable": true,
    "defaultInstalled": true,
    "channel": "stable",
    "tag": {
      "en": "Arcade",
      "pt": "Arcade",
      "ja": "アーケード"
    },
    "name": {
      "en": "River Strike",
      "pt": "River Strike",
      "ja": "リバーストライク"
    },
    "desc": {
      "en": "Retro river shooter in a single self-contained HTML file with fuel, enemy waves, procedural banks, and an Atari-inspired HUD.",
      "pt": "Tiro retrô no rio em um único HTML autossuficiente: combustível, ondas de inimigos, margens procedurais e HUD inspirada na Atari.",
      "ja": "燃料、敵ウェーブ、プロシージャルな河岸、Atari風HUDを備えた1ファイル完結のレトロ川下りシューティング。"
    }
  },
  {
    "id": "game-tetris1",
    "href": "game/tetris1.html",
    "icon": "../assets/icons/svg/game-tetris1.svg",
    "kind": "site",
    "uninstallable": true,
    "defaultInstalled": true,
    "channel": "stable",
    "tag": {
      "en": "Classic",
      "pt": "Clássico",
      "ja": "クラシック"
    },
    "name": {
      "en": "Tetris",
      "pt": "Tetris",
      "ja": "テトリス"
    },
    "desc": {
      "en": "Classic Tetris game with modern UI, scoring system, and multilingual support (EN/PT/JA). Features next piece preview and level progression.",
      "pt": "Jogo clássico de Tetris com interface moderna, sistema de pontuação e suporte multilíngue (EN/PT/JA). Apresenta prévia da próxima peça e progressão de nível.",
      "ja": "モダンなUI、スコアリングシステム、多言語サポート（EN/PT/JA）を備えたクラシックテトリスゲーム。次のピースプレビューとレベル進行を特徴とします。"
    }
  },
  {
    "id": "game-vision_tetris",
    "href": "game/vision_tetris.html",
    "icon": "../assets/icons/svg/game-vision_tetris.svg",
    "kind": "site",
    "uninstallable": true,
    "defaultInstalled": true,
    "channel": "stable",
    "tag": {
      "en": "Camera Game",
      "pt": "Jogo com Câmera",
      "ja": "カメラゲーム"
    },
    "name": {
      "en": "Vision Tetris",
      "pt": "Vision Tetris",
      "ja": "Vision Tetris"
    },
    "desc": {
      "en": "Camera-driven Tetris with pinch-to-grab controls, open-palm nudges, hand-gesture rotation, light/dark themes, and EN/PT/JA support.",
      "pt": "Tetris controlado por câmera com pinça para pegar a peça, empurrões com palma aberta, rotação por gesto de abrir e fechar a mão, temas claro/escuro e suporte EN/PT/JA.",
      "ja": "ピンチでつかみ、開いた手で横移動し、手の開閉シーケンスで回転できるカメラ連動テトリスです。ライト/ダークテーマと EN/PT/JA に対応しています。"
    }
  },
  {
    "id": "game-vision_balloon_ball",
    "href": "game/vision_balloon_ball.html",
    "icon": "../assets/icons/svg/game-vision_balloon_ball.svg",
    "kind": "site",
    "uninstallable": true,
    "defaultInstalled": true,
    "channel": "stable",
    "tag": {
      "en": "Camera Physics",
      "pt": "Física com Câmera",
      "ja": "カメラ物理"
    },
    "name": {
      "en": "Vision Balloon Ball",
      "pt": "Bolinha Balão com Visão",
      "ja": "Vision Balloon Ball"
    },
    "desc": {
      "en": "Camera-driven ping-pong-sized ball with balloon-like gravity, hand-hit impulses, wall and ceiling bounces, and floor resting physics.",
      "pt": "Bolinha do tamanho de ping-pong controlada pela câmera, com gravidade de balão, impulsos ao bater com a mão, paredes e teto com rebote, e repouso no chão.",
      "ja": "カメラで操作するピンポン玉サイズのボール。風船風の重力、手の衝突による反発、壁と天井のバウンド、床で止まる物理を搭載。"
    }
  },
  {
    "id": "game-vision_hand_pong",
    "href": "game/vision_hand_pong.html",
    "icon": "../assets/icons/svg/game-vision_hand_pong.svg",
    "kind": "site",
    "uninstallable": true,
    "defaultInstalled": true,
    "channel": "stable",
    "tag": {
      "en": "Camera Arcade",
      "pt": "Arcade com Câmera",
      "ja": "カメラアーケード"
    },
    "name": {
      "en": "Vision Hand Pong",
      "pt": "Pong com Mãos e Visão",
      "ja": "Vision Hand Pong"
    },
    "desc": {
      "en": "Camera-driven Pong with hand-controlled paddles near the screen edges, live rebounds, light/dark themes, and EN/PT/JA support.",
      "pt": "Pong controlado por câmera com raquetes movidas pelas mãos nas bordas da tela, rebatidas em tempo real, temas claro/escuro e suporte EN/PT/JA.",
      "ja": "画面端のパドルを手で動かして遊ぶカメラ連動 Pong。リアルタイムの打ち返し、ライト/ダークテーマ、EN/PT/JA 対応。"
    }
  },
  {
    "id": "game-tower-defense",
    "href": "game/tower-defense.html",
    "icon": "../assets/icons/svg/game-tower-defense.svg",
    "kind": "site",
    "uninstallable": true,
    "defaultInstalled": true,
    "channel": "stable",
    "tag": {
      "en": "Tower Defense",
      "pt": "Tower Defense",
      "ja": "タワーディフェンス"
    },
    "name": {
      "en": "Iron Lane Defense",
      "pt": "Defesa do Corredor de Ferro",
      "ja": "アイアンレーン防衛"
    },
    "desc": {
      "en": "Fullscreen tower defense with drag-and-drop placement, weapon towers, barrier upgrades, repairs, sales, coins, vehicle waves, and widening lanes.",
      "pt": "Tower defense em tela cheia com posicionamento por drag-and-drop, torres de armas, upgrades de barreiras, conserto, venda, moedas, ondas de veículos e corredores cada vez mais largos.",
      "ja": "ドラッグ＆ドロップ配置、武器タワー、バリア強化、修理、売却、コイン、車両ウェーブ、広がるレーンを備えた全画面タワーディフェンス。"
    }
  },
  {
    "id": "game-tower-defense-3d",
    "href": "game/tower-defense-3d.html",
    "icon": "../assets/icons/svg/game-tower-defense-3d.svg",
    "kind": "site",
    "uninstallable": true,
    "defaultInstalled": true,
    "channel": "stable",
    "tag": {
      "en": "Tower Defense",
      "pt": "Tower Defense",
      "ja": "タワーディフェンス"
    },
    "name": {
      "en": "Iron Lane Defense 3D",
      "pt": "Defesa do Corredor de Ferro 3D",
      "ja": "アイアンレーン防衛 3D"
    },
    "desc": {
      "en": "3D tower defense with orbital camera, procedural vehicles, light effects, explosive particles, and the same lane-based strategy as the original.",
      "pt": "Tower defense 3D com câmera orbital, veículos processuais, efeitos de luz, partículas explosivas e a mesma estratégia de pistas do original.",
      "ja": "オービットカメラ、プロシージャルなビークル、ライティング効果、爆発パーティクルを備えた3Dタワーディフェンス。元のレーン戦略はそのままです。"
    }
  },
  {
    "id": "game-game1",
    "href": "game/game1.html",
    "icon": "../assets/icons/svg/game-game1.svg",
    "kind": "site",
    "uninstallable": true,
    "defaultInstalled": true,
    "channel": "stable",
    "tag": {
      "en": "Arena",
      "pt": "Arena",
      "ja": "アリーナ"
    },
    "name": {
      "en": "Melee Survivors",
      "pt": "Sobreviventes Corpo a Corpo",
      "ja": "近接サバイバー"
    },
    "desc": {
      "en": "Top-down survival: move, auto-swing sword, collect XP and pick upgrades. Multilingual UI.",
      "pt": "Sobrevivência top-down: mova-se, ataque com espada automaticamente, colete XP e escolha melhorias. UI multilíngue.",
      "ja": "トップダウンサバイバル：移動、自動剣振り、XP収集、アップグレード選択。多言語UI。"
    }
  },
  {
    "id": "game-cube-bash-arena",
    "href": "game/cube-bash-arena.html",
    "icon": "../assets/icons/svg/game-cube-bash-arena.svg",
    "kind": "site",
    "uninstallable": true,
    "defaultInstalled": true,
    "channel": "stable",
    "tag": {
      "en": "WebGL Arena",
      "pt": "Arena WebGL",
      "ja": "WebGLアリーナ"
    },
    "name": {
      "en": "Cube Bash Arena",
      "pt": "Cube Bash Arena",
      "ja": "キューブバッシュアリーナ"
    },
    "desc": {
      "en": "Low-poly cube survival arena with auto-attacks, dash, XP upgrades, smashable crates, minimap, color themes, and a saved upgrade lab.",
      "pt": "Arena low-poly de sobrevivencia contra cubos com ataques automaticos, dash, melhorias por XP, caixas quebraveis, minimapa, temas de cores e laboratorio salvo.",
      "ja": "ローポリのキューブサバイバル。自動攻撃、ダッシュ、XPアップグレード、壊せる箱、ミニマップ、カラーテーマ、保存されるアップグレードラボ付き。"
    }
  },
  {
    "id": "game-vehicle-bash-arena",
    "href": "game/vehicle-bash-arena.html",
    "icon": "../assets/icons/svg/game-vehicle-bash-arena.svg",
    "kind": "site",
    "uninstallable": true,
    "defaultInstalled": true,
    "channel": "stable",
    "tag": {
      "en": "WebGL Vehicle",
      "pt": "Veiculo WebGL",
      "ja": "WebGL車両"
    },
    "name": {
      "en": "Vehicle Bash Arena",
      "pt": "Arena de Veiculos",
      "ja": "ビークルバッシュアリーナ"
    },
    "desc": {
      "en": "Drivable 3D arena with mouse-aimed turret, enemy cars, defensive towers, weapon pickups, shields, coins, turbo, garage upgrades, and deformable terrain.",
      "pt": "Arena 3D dirigivel com torreta mirando no mouse, carros inimigos, torres defensivas, armas coletaveis, escudos, moedas, turbo, upgrades de garagem e terreno deformavel.",
      "ja": "マウス照準の砲塔、敵車両、防衛タワー、武器ピックアップ、シールド、コイン、ターボ、ガレージ強化、変形する地形を備えた運転可能な3Dアリーナ。"
    }
  },
  {
    "id": "game-helicopter-command",
    "href": "game/helicopter-command.html",
    "icon": "../assets/icons/svg/game-helicopter-command.svg",
    "kind": "site",
    "uninstallable": true,
    "defaultInstalled": false,
    "channel": "stable",
    "tag": {
      "en": "WebGL Flight",
      "pt": "Voo WebGL",
      "ja": "WebGL飛行"
    },
    "name": {
      "en": "Helicopter Command",
      "pt": "Comando de Helicóptero",
      "ja": "ヘリコプターコマンド"
    },
    "desc": {
      "en": "A drivable 3D helicopter with lift, yaw and boost flight controls. Free Flight mode for relaxed sightseeing through rings over mountains and lakes, or Combat mode to blast ground turrets and enemy gunships across escalating waves, earning coins for hangar upgrades.",
      "pt": "Um helicóptero 3D pilotável com controles de sustentação, guinada e turbo. Modo Passeio Livre para voar relaxado por anéis sobre montanhas e lagos, ou Modo Combate para destruir torres terrestres e helicópteros inimigos em ondas crescentes, ganhando moedas para upgrades no hangar.",
      "ja": "リフト、ヨー、ブーストで操縦する3Dヘリコプター。自由飛行モードでは山や湖の上をリングをくぐりながらのんびり観光でき、コンバットモードでは地上タレットや敵ヘリを次々に撃破してコインを稼ぎ、ハンガーで強化できます。"
    }
  },
  {
    "id": "game-2048-shooter",
    "href": "game/2048-shooter.html",
    "icon": "../assets/icons/svg/game-2048-shooter.svg",
    "kind": "site",
    "uninstallable": true,
    "defaultInstalled": true,
    "channel": "stable",
    "tag": {
      "en": "Number Shooter",
      "pt": "Tiro Numérico",
      "ja": "数字シューティング"
    },
    "name": {
      "en": "2048 Shooter: Number Match",
      "pt": "2048 Shooter: Combinação de Números",
      "ja": "2048 シューター：ナンバーマッチ"
    },
    "desc": {
      "en": "Aim numbered blocks into columns, merge matching values like 2048, build combos, and survive the rising danger line.",
      "pt": "Mire blocos numerados nas colunas, combine valores iguais como no 2048, crie combos e sobreviva à linha de perigo crescente.",
      "ja": "数字ブロックを列に撃ち、2048のように同じ数字を合体させ、危険ラインからタワーを守ります。"
    }
  },
  {
    "id": "game-endless-coaster",
    "href": "game/endless-coaster.html",
    "icon": "../assets/icons/svg/game-endless-coaster.svg",
    "kind": "site",
    "uninstallable": true,
    "defaultInstalled": false,
    "channel": "stable",
    "tag": {
      "en": "WebGL Coaster",
      "pt": "Montanha-russa WebGL",
      "ja": "WebGLコースター"
    },
    "name": {
      "en": "Loopland Express",
      "pt": "Expresso Loopland",
      "ja": "ループランド急行"
    },
    "desc": {
      "en": "An endless low-poly roller-coaster ride across a huge landscape. Every reload creates a new procedural track, scenery, hills, and thrilling drops.",
      "pt": "Um passeio infinito de montanha-russa low-poly por um terreno enorme. Cada reload cria uma nova pista procedural, paisagem, colinas e descidas radicais.",
      "ja": "広大なローポリ世界を走る終わりのないジェットコースター。再読み込みするたびに、新しいコース、景色、丘、急降下が生成されます。"
    }
  },
  {
    "id": "game-rail-siege",
    "href": "game/rail-siege.html",
    "icon": "../assets/icons/svg/game-rail-siege.svg",
    "kind": "site",
    "uninstallable": true,
    "defaultInstalled": false,
    "channel": "stable",
    "tag": {
      "en": "Coaster Combat",
      "pt": "Combate na Montanha-russa",
      "ja": "コースター戦闘"
    },
    "name": {
      "en": "Rail Siege",
      "pt": "Guerra nos Trilhos",
      "ja": "レール・シージ"
    },
    "desc": {
      "en": "Defend an endless roller-coaster cart with mouse-aimed weapons. Destroy ground troops and increasingly tall enemy towers, then choose weapon and shield upgrades after every lap.",
      "pt": "Defenda um carrinho de montanha-russa infinito com armas controladas pelo mouse. Destrua tropas e torres inimigas cada vez mais altas e escolha melhorias de arma e escudo a cada volta.",
      "ja": "マウス照準の武器で無限コースターを防衛。地上兵と次第に高くなる敵タワーを破壊し、周回ごとに武器やシールドを強化します。"
    }
  },
  {
    "id": "game-ten-second-stop",
    "href": "game/ten-second-stop.html",
    "icon": "../assets/icons/svg/game-ten-second-stop.svg",
    "kind": "site",
    "uninstallable": true,
    "defaultInstalled": true,
    "channel": "stable",
    "tag": {
      "en": "Timing",
      "pt": "Tempo",
      "ja": "タイミング"
    },
    "name": {
      "en": "10.00 Stop",
      "pt": "Pare em 10,00",
      "ja": "10.00 Stop"
    },
    "desc": {
      "en": "Timing challenge with a fading counter: press start, let the clock disappear, and stop exactly at 10.00 seconds while double-clicks stay blocked for 1 second.",
      "pt": "Desafio de tempo com contador que desaparece: aperte start, deixe o relogio sumir e pare exatamente em 10,00 segundos com bloqueio de clique duplo por 1 segundo.",
      "ja": "フェードアウトするカウンター付きのタイミングゲーム。スタート後に時計が消えたまま数え、1秒の連打防止付きでちょうど10.00秒で止めます。"
    }
  },
  {
    "id": "game-cube",
    "href": "game/cube.html",
    "icon": "../assets/icons/svg/game-cube.svg",
    "kind": "site",
    "uninstallable": true,
    "defaultInstalled": true,
    "channel": "stable",
    "tag": {
      "en": "WebGL",
      "pt": "WebGL",
      "ja": "WebGL"
    },
    "name": {
      "en": "Rubik's Cube (Three.js)",
      "pt": "Cubo de Rubik (Three.js)",
      "ja": "ルービックキューブ (Three.js)"
    },
    "desc": {
      "en": "Interactive Rubik's Cube from 1x1x1 up to 20x20x20. Scramble, rotate layers on any axis, and auto-solve.",
      "pt": "Cubo de Rubik interativo de 1×1×1 até 20×20×20. Embaralhe, gire camadas em qualquer eixo e resolva automaticamente.",
      "ja": "1×1×1から20×20×20までのインタラクティブなルービックキューブ。スクランブル、任意の軸でレイヤーを回転、自動解決。"
    }
  },
  {
    "id": "game-checkers",
    "href": "game/checkers.html",
    "icon": "../assets/icons/svg/game-checkers.svg",
    "kind": "site",
    "uninstallable": true,
    "defaultInstalled": true,
    "channel": "stable",
    "tag": {
      "en": "Board",
      "pt": "Tabuleiro",
      "ja": "ボード"
    },
    "name": {
      "en": "Checkers vs Computer",
      "pt": "Damas vs Computador",
      "ja": "チェッカー対コンピュータ"
    },
    "desc": {
      "en": "Classic checkers game against a computer opponent. Features multiple difficulty levels and a multilingual UI (EN/PT/JA).",
      "pt": "Jogo de damas clássico contra um oponente de computador. Possui múltiplos níveis de dificuldade e uma UI multilíngue (EN/PT/JA).",
      "ja": "コンピュータ対戦のクラシックなチェッカーゲーム。複数の難易度レベルと多言語UI（EN/PT/JA）を備えています。"
    }
  },
  {
    "id": "game-chess",
    "href": "game/chess.html",
    "icon": "../assets/icons/svg/game-chess.svg",
    "kind": "site",
    "uninstallable": true,
    "defaultInstalled": true,
    "channel": "stable",
    "tag": {
      "en": "Board",
      "pt": "Tabuleiro",
      "ja": "ボード"
    },
    "name": {
      "en": "Chess vs Computer",
      "pt": "Xadrez vs Computador",
      "ja": "チェス対コンピュータ"
    },
    "desc": {
      "en": "Play chess against a basic AI. Features a multilingual UI (EN/PT/JA).",
      "pt": "Jogue xadrez contra uma IA básica. Apresenta uma interface multilíngue (EN/PT/JA).",
      "ja": "基本的なAIとチェスをプレイします。多言語UI（EN / PT / JA）を備えています。"
    }
  },
  {
    "id": "game-domino",
    "href": "game/domino.html",
    "icon": "../assets/icons/svg/game-domino.svg",
    "kind": "site",
    "uninstallable": true,
    "defaultInstalled": false,
    "channel": "stable",
    "tag": {
      "en": "Board",
      "pt": "Tabuleiro",
      "ja": "ボード"
    },
    "name": {
      "en": "Dominoes Game",
      "pt": "Jogo de Dominó",
      "ja": "ドミノゲーム"
    },
    "desc": {
      "en": "Classic dominoes vs computer: draw/pass logic, scoring, and multilingual UI (PT/EN/JA).",
      "pt": "Dominó clássico contra o computador: lógica de comprar/passar, pontuação e interface multilíngue (PT/EN/JA).",
      "ja": "コンピュータ対戦のクラシックドミノ：ドロー/パスロジック、スコアリング、多言語UI（PT/EN/JA）。"
    }
  },
  {
    "id": "game-game5",
    "href": "game/game5.html",
    "icon": "../assets/icons/svg/game-game5.svg",
    "kind": "site",
    "uninstallable": true,
    "defaultInstalled": true,
    "channel": "stable",
    "tag": {
      "en": "Arcade",
      "pt": "Arcade",
      "ja": "アーケード"
    },
    "name": {
      "en": "Asteroids Survivors",
      "pt": "Sobreviventes de Asteroides",
      "ja": "アステロイドサバイバー"
    },
    "desc": {
      "en": "Inertia-based ship in an asteroid field with drones, missiles and upgrades. Survive and rack up score.",
      "pt": "Nave com base em inércia em um campo de asteroides com drones, mísseis e melhorias. Sobreviva e acumule pontos.",
      "ja": "小惑星帯で慣性ベースの船を操作し、ドローン、ミサイル、アップグレードで生き残り、スコアを獲得。"
    }
  },
  {
    "id": "game-snake",
    "href": "game/snake.html",
    "icon": "../assets/icons/svg/game-snake.svg",
    "kind": "site",
    "uninstallable": true,
    "defaultInstalled": true,
    "channel": "stable",
    "tag": {
      "en": "Classic+",
      "pt": "Clássico+",
      "ja": "クラシック+"
    },
    "name": {
      "en": "Snake FX",
      "pt": "Snake FX",
      "ja": "スネークFX"
    },
    "desc": {
      "en": "Modern snake with glow, particles and fun power-ups: speed boost, reverse, double vision and slow time.",
      "pt": "Snake moderno com brilho, partículas e power-ups divertidos: aumento de velocidade, reverso, visão dupla e tempo lento.",
      "ja": "グロー、パーティクル、楽しいパワーアップ（スピードブースト、リバース、ダブルビジョン、スロータイム）を備えたモダンスネーク。"
    }
  },
  {
    "id": "game-game2",
    "href": "game/game2.html",
    "icon": "../assets/icons/svg/game-game2.svg",
    "kind": "site",
    "uninstallable": true,
    "defaultInstalled": false,
    "channel": "stable",
    "tag": {
      "en": "Roguelite",
      "pt": "Roguelite",
      "ja": "ローグライト"
    },
    "name": {
      "en": "Orbit Weapons",
      "pt": "Armas Orbitais",
      "ja": "オービット兵器"
    },
    "desc": {
      "en": "Orbs circle the player and deal contact damage. Kite foes, grab XP, and build synergies via upgrades.",
      "pt": "Orbes circulam o jogador e causam dano de contato. Desvie dos inimigos, pegue XP e crie sinergias com melhorias.",
      "ja": "オーブがプレイヤーの周りを回り、接触ダメージを与える。敵をカイトし、XPを集め、アップグレードでシナジーを構築。"
    }
  },
  {
    "id": "game-game3",
    "href": "game/game3.html",
    "icon": "../assets/icons/svg/game-game3.svg",
    "kind": "site",
    "uninstallable": true,
    "defaultInstalled": false,
    "channel": "stable",
    "tag": {
      "en": "Action",
      "pt": "Ação",
      "ja": "アクション"
    },
    "name": {
      "en": "Boomerang / Chakram",
      "pt": "Bumerangue / Chakram",
      "ja": "ブーメラン / チャクラム"
    },
    "desc": {
      "en": "Returning projectiles that pierce and ricochet. Level up to add effects like bleed, trail, magnet and more.",
      "pt": "Projéteis que retornam, perfuram e ricocheteiam. Suba de nível para adicionar efeitos como sangramento, rastro, ímã e mais.",
      "ja": "貫通して跳ね返る投射物を返す。出血、軌跡、磁石などの効果を追加するためにレベルアップ。"
    }
  },
  {
    "id": "game-game6",
    "href": "game/game6.html",
    "icon": "../assets/icons/svg/game-game6.svg",
    "kind": "site",
    "uninstallable": true,
    "defaultInstalled": false,
    "channel": "stable",
    "tag": {
      "en": "Skill",
      "pt": "Habilidade",
      "ja": "スキル"
    },
    "name": {
      "en": "Cave Runner",
      "pt": "Corredor de Caverna",
      "ja": "ケーブランナー"
    },
    "desc": {
      "en": "Navigate cave mazes with thrust & inertia to reach the goal. Avoid walls and enemy turrets.",
      "pt": "Navegue por labirintos de cavernas com impulso e inércia para alcançar o objetivo. Evite paredes e torretas inimigas.",
      "ja": "推力と慣性で洞窟の迷路を進み、ゴールを目指す。壁や敵のタレットを避ける。"
    }
  },
  {
    "id": "game-custom_image_puzzle",
    "href": "game/custom_image_puzzle.html",
    "icon": "../assets/icons/svg/game-custom_image_puzzle.svg",
    "kind": "site",
    "uninstallable": true,
    "defaultInstalled": false,
    "channel": "stable",
    "tag": {
      "en": "Puzzle",
      "pt": "Quebra-cabeça",
      "ja": "パズル"
    },
    "name": {
      "en": "Custom Image Puzzle",
      "pt": "Quebra-cabeça de Imagem Personalizada",
      "ja": "カスタム画像パズル"
    },
    "desc": {
      "en": "Upload an image and solve a sliding puzzle (3x3-8x8). Includes i18n (EN/PT/JA), timer, moves, preview and persistence.",
      "pt": "Envie uma imagem e resolva um quebra-cabeça deslizante (3×3–8×8). Inclui i18n (EN/PT/JA), cronômetro, movimentos, pré-visualização e persistência.",
      "ja": "画像をアップロードしてスライディングパズル（3×3〜8×8）を解く。i18n（EN/PT/JA）、タイマー、移動回数、プレビュー、永続性を搭載。"
    }
  },
  {
    "id": "game-math_quiz",
    "href": "game/math_quiz.html",
    "icon": "../assets/icons/svg/game-math_quiz.svg",
    "kind": "site",
    "uninstallable": true,
    "defaultInstalled": false,
    "channel": "stable",
    "tag": {
      "en": "Educational",
      "pt": "Educacional",
      "ja": "教育"
    },
    "name": {
      "en": "Math Quiz Game",
      "pt": "Jogo de Quiz de Matemática",
      "ja": "算数クイズゲーム"
    },
    "desc": {
      "en": "Arithmetic drills (add/sub/mul/div) with a tri-lingual UI (en/pt/ja).",
      "pt": "Exercícios de aritmética (adição/subtração/multiplicação/divisão) com interface trilíngue (en/pt/ja).",
      "ja": "算数ドリル（加算/減算/乗算/除算）、多言語UI（en/pt/ja）付き。"
    }
  },
  {
    "id": "game-flip",
    "href": "game/flip.html",
    "icon": "../assets/icons/svg/game-flip.svg",
    "kind": "site",
    "uninstallable": true,
    "defaultInstalled": true,
    "channel": "stable",
    "tag": {
      "en": "Memory",
      "pt": "Memória",
      "ja": "メモリー"
    },
    "name": {
      "en": "Flip Board Game",
      "pt": "Jogo de Flip Board",
      "ja": "フリップボードゲーム"
    },
    "desc": {
      "en": "Memory card game with fruit icons. Match pairs, beat the timer, and score points. Multilingual UI (EN/PT/JA).",
      "pt": "Jogo de cartas de memória com ícones de frutas. Combine pares, vença o cronômetro e pontue. Interface multilíngue (EN/PT/JA).",
      "ja": "フルーツアイコンを使ったメモリーカードゲーム。ペアを合わせ、タイマーを倒し、ポイントを獲得。多言語UI（EN/PT/JA）。"
    }
  },
  {
    "id": "game-morris",
    "href": "game/morris.html",
    "icon": "../assets/icons/svg/game-morris.svg",
    "kind": "site",
    "uninstallable": true,
    "defaultInstalled": true,
    "channel": "stable",
    "tag": {
      "en": "Strategy",
      "pt": "Estratégia",
      "ja": "戦略"
    },
    "name": {
      "en": "Nine Men's Morris",
      "pt": "Jogo do Moinho",
      "ja": "ナイン・メンズ・モリス"
    },
    "desc": {
      "en": "Classic strategy board game with three phases: placing, moving, and flying. Play vs computer or 2-player hot-seat.",
      "pt": "Jogo de tabuleiro estratégico clássico com três fases: colocação, movimento e voo. Jogue contra o computador ou 2 jogadores no mesmo dispositivo.",
      "ja": "配置、移動、飛行の3つのフェーズを持つクラシックな戦略ボードゲーム。コンピュータ対戦または2人用ホットシート。"
    }
  },
  {
    "id": "game-pac-man",
    "href": "game/pac-man.html",
    "icon": "../assets/icons/svg/game-pac-man.svg",
    "kind": "site",
    "uninstallable": true,
    "defaultInstalled": true,
    "channel": "stable",
    "tag": {
      "en": "Arcade",
      "pt": "Arcade",
      "ja": "アーケード"
    },
    "name": {
      "en": "Pac-Man Clone",
      "pt": "Clone do Pac-Man",
      "ja": "パックマンクローン"
    },
    "desc": {
      "en": "Classic Pac-Man arcade game with ghosts, power pellets, and multiple difficulty levels. Features multilingual UI and customizable controls.",
      "pt": "Jogo de arcade clássico do Pac-Man com fantasmas, pílulas de poder e múltiplos níveis de dificuldade. Apresenta interface multilíngue e controles personalizáveis.",
      "ja": "幽霊、パワーペレット、複数の難易度レベルを備えたクラシックなパックマンアーケードゲーム。多言語UIとカスタマイズ可能なコントロールを特徴とします。"
    }
  },
  {
    "id": "game-space-invaders",
    "href": "game/space-invaders.html",
    "icon": "../assets/icons/svg/game-space-invaders.svg",
    "kind": "site",
    "uninstallable": true,
    "defaultInstalled": true,
    "channel": "stable",
    "tag": {
      "en": "Arcade",
      "pt": "Arcade",
      "ja": "アーケード"
    },
    "name": {
      "en": "Space Invaders",
      "pt": "Space Invaders",
      "ja": "スペースインベーダー"
    },
    "desc": {
      "en": "Classic Space Invaders game. Defeat waves of aliens and upgrade your weapon.",
      "pt": "Clássico jogo Space Invaders. Derrote ondas de alienígenas e melhore sua arma.",
      "ja": "クラシックなスペースインベーダーゲーム。エイリアンの波を倒し、武器をアップグレードします。"
    }
  },
  {
    "id": "game-type-invaders",
    "href": "game/type-invaders.html",
    "icon": "../assets/icons/svg/game-type-invaders.svg",
    "kind": "site",
    "uninstallable": true,
    "defaultInstalled": false,
    "channel": "stable",
    "tag": {
      "en": "Typing",
      "pt": "Digitação",
      "ja": "タイピング"
    },
    "name": {
      "en": "Type Invaders",
      "pt": "Type Invaders",
      "ja": "タイプインベーダー"
    },
    "desc": {
      "en": "Space Invaders meets typing game! Type English words before they reach the defense line. Words start slow and short, increasing in speed and difficulty as you level up.",
      "pt": "Space Invaders encontra jogo de digitação! Digite palavras em inglês antes que cheguem à linha de defesa. Palavras começam lentas e curtas, aumentando em velocidade e dificuldade conforme você sobe de nível.",
      "ja": "スペースインベーダーとタイピングゲームの融合！英単語が防衛ラインに到達する前にタイプしよう。レベルが上がるにつれて速度と難易度が上昇します。"
    }
  },
  {
    "id": "game-type-invaders-jp",
    "href": "game/type-invaders-jp.html",
    "icon": "../assets/icons/svg/game-type-invaders-jp.svg",
    "kind": "site",
    "uninstallable": true,
    "defaultInstalled": false,
    "channel": "stable",
    "tag": {
      "en": "Typing",
      "pt": "Digitação",
      "ja": "タイピング"
    },
    "name": {
      "en": "Type Invaders 日本語版",
      "pt": "Type Invaders 日本語版",
      "ja": "タイプインベーダー 日本語版"
    },
    "desc": {
      "en": "Japanese typing game! Type romaji to destroy Hiragana, Katakana, or Kanji words. Three categories with 5 difficulty levels each. Perfect for learning Japanese!",
      "pt": "Jogo de digitação japonês! Digite romaji para destruir palavras em Hiragana, Katakana ou Kanji. Três categorias com 5 níveis de dificuldade cada. Perfeito para aprender japonês!",
      "ja": "日本語タイピングゲーム！ローマ字を入力してひらがな、カタカナ、漢字の単語を撃破。3つのカテゴリーに各5段階の難易度。日本語学習に最適！"
    }
  },
  {
    "id": "game-crossword",
    "href": "game/crossword.html",
    "icon": "../assets/icons/svg/game-crossword.svg",
    "kind": "site",
    "uninstallable": true,
    "defaultInstalled": true,
    "channel": "stable",
    "tag": {
      "en": "Word",
      "pt": "Palavra",
      "ja": "ことば"
    },
    "name": {
      "en": "Crossword Mixer",
      "pt": "Misturador de Palavras Cruzadas",
      "ja": "クロスワードミキサー"
    },
    "desc": {
      "en": "Procedural crossword that switches word banks by language and rotates placement strategies every round. Japanese boards use kana only.",
      "pt": "Palavras cruzadas procedurais que trocam o banco de palavras conforme o idioma e giram a estrategia de montagem a cada rodada. No japones, o tabuleiro usa apenas kana.",
      "ja": "ことばの しゅるいと ならべかたが まいかい かわる じどうせいせい クロスワードです。にほんごの ばんは かなだけを つかいます。"
    }
  },
  {
    "id": "game-word-search",
    "href": "game/word-search.html",
    "icon": "../assets/icons/svg/game-word-search.svg",
    "kind": "site",
    "uninstallable": true,
    "defaultInstalled": true,
    "channel": "stable",
    "tag": {
      "en": "Word",
      "pt": "Palavra",
      "ja": "ことば"
    },
    "name": {
      "en": "Word Search Studio",
      "pt": "Estúdio Caça-Palavras",
      "ja": "ことばさがし"
    },
    "desc": {
      "en": "A procedural word search with three difficulty levels, eight directions, hints, timer, and pointer or keyboard controls.",
      "pt": "Caça-palavras procedural com três dificuldades, oito direções, dicas, cronômetro e controles por ponteiro ou teclado.",
      "ja": "3つの むずかしさ、8つの ほうこう、ヒント、タイマー、マウス・タッチ・キーボードそうさに たいおうした ことばさがしです。"
    }
  },
  {
    "id": "game-tic-tac-toe",
    "href": "game/tic-tac-toe.html",
    "icon": "../assets/icons/svg/game-tic-tac-toe.svg",
    "kind": "site",
    "uninstallable": true,
    "defaultInstalled": true,
    "channel": "stable",
    "tag": {
      "en": "Board",
      "pt": "Tabuleiro",
      "ja": "ボード"
    },
    "name": {
      "en": "Tic-Tac-Toe",
      "pt": "Jogo da Velha",
      "ja": "三目並べ"
    },
    "desc": {
      "en": "Classic Tic-Tac-Toe game. Play against a simple AI. Features a multilingual UI (EN/PT/JA) and theme support.",
      "pt": "Jogo da Velha clássico. Jogue contra uma IA simples. Possui uma interface multilíngue (EN/PT/JA) e suporte a temas.",
      "ja": "古典的な三目並べゲーム。シンプルなAIと対戦します。多言語UI（EN/PT/JA）とテーマサポートを特徴とします。"
    }
  },
  {
    "id": "game-missile-command",
    "href": "game/missile-command.html",
    "icon": "../assets/icons/svg/game-missile-command.svg",
    "kind": "site",
    "uninstallable": true,
    "defaultInstalled": true,
    "channel": "stable",
    "tag": {
      "en": "Arcade",
      "pt": "Arcade",
      "ja": "アーケード"
    },
    "name": {
      "en": "Missile Command",
      "pt": "Comando de Mísseis",
      "ja": "ミサイルコマンド"
    },
    "desc": {
      "en": "Defend your city from falling missiles. Use your cannon to shoot them down and protect your buildings.",
      "pt": "Defenda sua cidade dos mísseis que caem. Use seu canhão para derrubá-los e proteger seus edifícios.",
      "ja": "落下するミサイルから都市を守ってください。大砲を使って撃ち落とし、建物を守ります。"
    }
  },
  {
    "id": "game-rummy",
    "href": "game/rummy.html",
    "icon": "../assets/icons/svg/game-rummy.svg",
    "kind": "site",
    "uninstallable": true,
    "defaultInstalled": false,
    "channel": "stable",
    "tag": {
      "en": "Card",
      "pt": "Card",
      "ja": "Card"
    },
    "name": {
      "en": "Gin Rummy",
      "pt": "Gin Rummy",
      "ja": "Gin Rummy"
    },
    "desc": {
      "en": "Simplified Rummy vs AI: draw/discard, sets & runs, optional jokers, tri‑lingual UI (EN/PT/JA).",
      "pt": "Simplified Rummy vs AI: draw/discard, sets & runs, optional jokers, tri‑lingual UI (EN/PT/JA).",
      "ja": "Simplified Rummy vs AI: draw/discard, sets & runs, optional jokers, tri‑lingual UI (EN/PT/JA)."
    }
  },
  {
    "id": "misc-interactive_planetarium",
    "href": "misc/interactive_planetarium.html",
    "icon": "../assets/icons/svg/misc-interactive_planetarium.svg",
    "kind": "site",
    "uninstallable": true,
    "defaultInstalled": false,
    "channel": "stable",
    "tag": {
      "en": "3D Astronomy",
      "pt": "Astronomia 3D",
      "ja": "3D天文学"
    },
    "name": {
      "en": "Orbitarium",
      "pt": "Orbitarium",
      "ja": "Orbitarium"
    },
    "desc": {
      "en": "Explore a time-controlled 3D solar system with selectable worlds, procedural planets, and a detailed textured Earth globe.",
      "pt": "Explore um sistema solar 3D com controle do tempo, mundos selecionáveis, planetas procedurais e um globo terrestre detalhado.",
      "ja": "時間を操作できる3D太陽系。惑星を選択して観察でき、地球には詳細な表面テクスチャを使用。"
    }
  },
  {
    "id": "misc-fluid_lab",
    "href": "misc/fluid_lab.html",
    "icon": "../assets/icons/svg/misc-fluid_lab.svg",
    "kind": "site",
    "uninstallable": true,
    "defaultInstalled": true,
    "channel": "stable",
    "tag": {
      "en": "Simulation",
      "pt": "Simulação",
      "ja": "シミュレーション"
    },
    "name": {
      "en": "Fluid Lab",
      "pt": "Fluid Lab",
      "ja": "Fluid Lab"
    },
    "desc": {
      "en": "Paint swirling ink, fire, smoke, and ocean currents with touch, pointer gestures, microphone, or audio files.",
      "pt": "Pinte tinta, fogo, fumaça e correntes oceânicas com toque, ponteiro, microfone ou arquivos de áudio.",
      "ja": "タッチ、ポインター、マイク、音声ファイルで渦巻くインク、炎、煙、海流を描きます。"
    }
  },
  {
    "id": "misc-webcam_music_controller",
    "href": "misc/webcam_music_controller.html",
    "icon": "../assets/icons/svg/misc-webcam_music_controller.svg",
    "kind": "site",
    "uninstallable": true,
    "defaultInstalled": true,
    "channel": "stable",
    "tag": {
      "en": "Webcam Audio",
      "pt": "Webcam e áudio",
      "ja": "ウェブカメラ音楽"
    },
    "name": {
      "en": "Motion Orchestra",
      "pt": "Motion Orchestra",
      "ja": "Motion Orchestra"
    },
    "desc": {
      "en": "Turn hand movement into synth notes, drum hits, and audio effects with private in-browser motion tracking.",
      "pt": "Transforme movimentos das mãos em notas de sintetizador, bateria e efeitos com rastreamento privado no navegador.",
      "ja": "ブラウザ内のモーショントラッキングで、手の動きをシンセ音、ドラム、エフェクトに変換。"
    }
  },
  {
    "id": "misc-spin_lab",
    "href": "misc/spin_lab.html",
    "icon": "../assets/icons/svg/misc-spin_lab.svg",
    "kind": "site",
    "uninstallable": true,
    "defaultInstalled": true,
    "channel": "stable",
    "tag": {
      "en": "Physics",
      "pt": "Física",
      "ja": "物理"
    },
    "name": {
      "en": "Spin Lab",
      "pt": "Laboratório Giratório",
      "ja": "スピンラボ"
    },
    "desc": {
      "en": "Balls bouncing inside a spinning hexagon in three versions: one ball, a many-ball sandbox, and a tuner with sliders for every parameter.",
      "pt": "Bolas quicando dentro de um hexágono giratório, em três versões: uma bola, uma sandbox com várias bolas e um ajuste com controles para cada parâmetro.",
      "ja": "回転する六角形の中で跳ねるボールを 3 つの版で。ボール 1 個、たくさんのボールのサンドボックス、全パラメータを調整できる版。"
    }
  },
  {
    "id": "misc-robot_face",
    "href": "misc/robot_face.html",
    "icon": "../assets/icons/svg/misc-robot_face.svg",
    "kind": "site",
    "uninstallable": true,
    "defaultInstalled": true,
    "channel": "stable",
    "tag": {
      "en": "Screen Saver",
      "pt": "Screen Saver",
      "ja": "Screen Saver"
    },
    "name": {
      "en": "Robot Face Screen Saver",
      "pt": "Robot Face Screen Saver",
      "ja": "Robot Face Screen Saver"
    },
    "desc": {
      "en": "Fullscreen robotic face: background shifts slowly, eyes blink and follow the mouse (or random after 3s idle), occasional yawn and sleep.",
      "pt": "Fullscreen robotic face: background shifts slowly, eyes blink and follow the mouse (or random after 3s idle), occasional yawn and sleep.",
      "ja": "Fullscreen robotic face: background shifts slowly, eyes blink and follow the mouse (or random after 3s idle), occasional yawn and sleep."
    }
  },
  {
    "id": "misc-nebula_lab",
    "href": "misc/nebula_lab.html",
    "icon": "../assets/icons/svg/misc-nebula_lab.svg",
    "kind": "site",
    "uninstallable": true,
    "defaultInstalled": true,
    "channel": "stable",
    "tag": {
      "en": "Simulation",
      "pt": "Simulação",
      "ja": "シミュレーション"
    },
    "name": {
      "en": "Nebula Lab",
      "pt": "Laboratório Nebulosa",
      "ja": "ネビュララボ"
    },
    "desc": {
      "en": "Gravity and star-link playgrounds: Nebula 2 with physics, visual and tool panels, and the original Nebula.",
      "pt": "Simulações de gravidade e ligações entre estrelas: Nebula 2, com painéis de física, visual e ferramentas, e a Nebula original.",
      "ja": "重力と星のリンクで遊ぶシミュレーション。物理・表示・ツールのパネルがある Nebula 2 と、元の Nebula。"
    }
  },
  {
    "id": "misc-vision_labs",
    "href": "misc/vision_labs.html",
    "icon": "../assets/icons/svg/misc-vision_labs.svg",
    "kind": "site",
    "uninstallable": true,
    "defaultInstalled": true,
    "channel": "stable",
    "tag": {
      "en": "Webcam",
      "pt": "Webcam",
      "ja": "ウェブカメラ"
    },
    "name": {
      "en": "Vision Labs",
      "pt": "Laboratórios de Visão",
      "ja": "ビジョンラボ"
    },
    "desc": {
      "en": "Webcam experiments with hand, face and pose tracking: motion lab with a gesture presentation mode, eye-gaze cursor and keypad, and a hand-driven plasma globe.",
      "pt": "Experimentos com webcam e rastreamento de mãos, rosto e corpo: laboratório de movimento com modo de apresentação por gestos, cursor e teclado pelo olhar, e um globo de plasma guiado pela mão.",
      "ja": "手・顔・姿勢の追跡を使ったウェブカメラ実験。ジェスチャーでのプレゼンモード付きモーションラボ、視線カーソルとキーパッド、手で操るプラズマボール。"
    }
  },
  {
    "id": "misc-logic_circuit",
    "href": "misc/logic_circuit.html",
    "icon": "../assets/icons/svg/misc-logic_circuit.svg",
    "kind": "site",
    "uninstallable": true,
    "defaultInstalled": true,
    "channel": "stable",
    "tag": {
      "en": "Simulation",
      "pt": "Simulação",
      "ja": "シミュレーション"
    },
    "name": {
      "en": "Logic Circuit Simulator",
      "pt": "Simulador de Circuitos Lógicos",
      "ja": "論理回路シミュレーター"
    },
    "desc": {
      "en": "Canvas-based logic circuit simulator with draggable gates (AND, OR, NOT, NAND, NOR, XOR, XNOR), switches, LEDs, 7-segment display, wire connections, real-time evaluation, undo/redo, and save/load via IndexedDB.",
      "pt": "Simulador de circuitos lógicos em canvas com portas arrastáveis (AND, OR, NOT, NAND, NOR, XOR, XNOR), chaves, LEDs, display 7 segmentos, conexões de fios, avaliação em tempo real e salvar/carregar via IndexedDB.",
      "ja": "キャンバスベースの論理回路シミュレーター。AND・OR・NOT・NAND・NOR・XOR・XNORなどのゲートをドラッグして配置し、スイッチ・LED・7セグメントをワイヤー接続してリアルタイムで評価。IndexedDBに保存・読込可能。"
    }
  },
  {
    "id": "misc-hollywood",
    "href": "misc/hollywood.html",
    "icon": "../assets/icons/svg/misc-hollywood.svg",
    "kind": "site",
    "uninstallable": true,
    "defaultInstalled": false,
    "channel": "stable",
    "tag": {
      "en": "Screen Saver",
      "pt": "Protetor de Tela",
      "ja": "スクリーンセーバー"
    },
    "name": {
      "en": "Hollywood",
      "pt": "Hollywood",
      "ja": "ハリウッド"
    },
    "desc": {
      "en": "Movie-style hacker screen inspired by the Linux hollywood command: tmux-like panes with htop, code rain, logs, hexdump, vim, network graphs, builds and scans that keep splitting and reshuffling. All simulated.",
      "pt": "Tela de hacker de filme inspirada no comando hollywood do Linux: painéis estilo tmux com htop, chuva de código, logs, hexdump, vim, gráficos de rede, compilações e varreduras que se dividem e se reorganizam sem parar. Tudo simulado.",
      "ja": "Linux の hollywood コマンドに着想を得た映画風ハッカー画面。htop、コードの雨、ログ、hexdump、vim、ネットワークグラフ、ビルドやスキャンが動く tmux 風のペインが分割とシャッフルを繰り返します。すべてシミュレーションです。"
    }
  },
  {
    "id": "misc-electronics_lab_3d",
    "href": "misc/electronics_lab_3d.html",
    "icon": "../assets/icons/svg/misc-electronics_lab_3d.svg",
    "kind": "site",
    "uninstallable": true,
    "defaultInstalled": false,
    "channel": "beta",
    "tag": {
      "en": "Simulation",
      "pt": "Simulação",
      "ja": "シミュレーション"
    },
    "name": {
      "en": "3D Electronics Lab",
      "pt": "Laboratório de Eletrônica 3D",
      "ja": "3D電子工作ラボ"
    },
    "desc": {
      "en": "3D electronics lab simulator with Arduino-like boards (programmable in JavaScript), LEDs, motors, servos, 7-segment displays, pistons, buttons, switches, resistors, and a functional protoboard. Drag-and-drop wiring, snap-to-grid placement, and project save/load via IndexedDB.",
      "pt": "Simulador de laboratório de eletrônica em 3D com placas tipo Arduino programáveis em JavaScript. LEDs, motores, servos, displays 7 segmentos, pistões, botões, chaves, resistores e protoboard funcional. Fiação drag-and-drop, posicionamento com snap, salvar/carregar projetos via IndexedDB.",
      "ja": "3D電子工作ラボシミュレーター。ArduinoライクなボードをJavaScriptでプログラム可能。LED・モーター・サーボ・7セグメント・ピストン・ボタン・スイッチ・抵抗・ブレッドボードなど多数のコンポーネントを搭載。ドラッグ&ドロップ配線、スナップグリッド配置、IndexedDBによるプロジェクト保存・読込対応。"
    }
  },
  {
    "id": "utils-video_trimmer",
    "href": "utils/video_trimmer.html",
    "icon": "../assets/icons/svg/utils-video_trimmer.svg",
    "kind": "site",
    "uninstallable": true,
    "defaultInstalled": false,
    "channel": "beta",
    "tag": {
      "en": "Media",
      "pt": "Mídia",
      "ja": "メディア"
    },
    "name": {
      "en": "Video Trimmer",
      "pt": "Cortador de Vídeo",
      "ja": "動画トリマー"
    },
    "desc": {
      "en": "Upload a video, choose start and end with a double slider, preview only that selection, and export the trimmed clip directly in the browser.",
      "pt": "Envie um vídeo, escolha o início e o fim com um slider duplo, visualize apenas esse trecho e exporte o corte diretamente no navegador.",
      "ja": "動画をアップロードし、二重スライダーで開始位置と終了位置を選び、その範囲だけをプレビューしてブラウザ上で切り出し動画を書き出します。"
    }
  },
  {
    "id": "utils-code_lab",
    "href": "utils/code_lab.html",
    "icon": "../assets/icons/svg/utils-code_lab.svg",
    "kind": "site",
    "uninstallable": true,
    "defaultInstalled": false,
    "channel": "beta",
    "tag": {
      "en": "Developer",
      "pt": "Desenvolvedor",
      "ja": "開発者"
    },
    "name": {
      "en": "Code Lab",
      "pt": "Laboratório de Código",
      "ja": "コードラボ"
    },
    "desc": {
      "en": "Run JavaScript offline in a sandbox with canvas and console, or turn JavaScript into a Mermaid flowchart.",
      "pt": "Executa JavaScript offline numa sandbox com canvas e console, ou transforma JavaScript num fluxograma Mermaid.",
      "ja": "キャンバスとコンソール付きのサンドボックスで JavaScript をオフライン実行したり、Mermaid のフローチャートに変換したりします。"
    }
  },
  {
    "id": "utils-collage",
    "href": "utils/collage.html",
    "icon": "../assets/icons/svg/utils-collage.svg",
    "kind": "site",
    "uninstallable": true,
    "defaultInstalled": false,
    "channel": "beta",
    "tag": {
      "en": "Editor",
      "pt": "Editor",
      "ja": "エディタ"
    },
    "name": {
      "en": "Image Collage Editor",
      "pt": "Editor de Colagem de Imagens",
      "ja": "画像コラージュエディタ"
    },
    "desc": {
      "en": "Advanced image collage editor with layers, blend modes, filters, eraser tool, and export functionality. Features undo/redo, zoom controls, and multilingual UI (EN/PT/JA).",
      "pt": "Editor avançado de colagem de imagens com camadas, modos de mesclagem, filtros, ferramenta de borracha e funcionalidade de exportação. Apresenta desfazer/refazer, controles de zoom e interface multilíngue (EN/PT/JA).",
      "ja": "レイヤー、ブレンドモード、フィルター、消しゴムツール、エクスポート機能を備えた高度な画像コラージュエディタ。元に戻す/やり直す、ズームコントロール、多言語UI（EN/PT/JA）を特徴とします。"
    }
  },
  {
    "id": "game-traffic-lights",
    "href": "game/traffic-lights.html",
    "icon": "../assets/icons/svg/game-traffic-lights.svg",
    "kind": "site",
    "uninstallable": true,
    "defaultInstalled": false,
    "channel": "beta",
    "tag": {
      "en": "Traffic",
      "pt": "Trânsito",
      "ja": "交通"
    },
    "name": {
      "en": "Signal City",
      "pt": "Cidade dos Semáforos",
      "ja": "シグナルシティ"
    },
    "desc": {
      "en": "Aerial city traffic puzzle with manual traffic lights, two-way roads, vehicle queues, turning cars, congestion scoring, and expanding levels.",
      "pt": "Puzzle de trânsito em visão aérea com semáforos manuais, ruas de mão dupla, filas de veículos, carros virando, pontuação por congestionamento e fases maiores.",
      "ja": "上空視点の都市交通パズル。手動信号、双方向道路、車列、右左折、渋滞スコア、拡張レベルを備えています。"
    }
  },
  {
    "id": "game-roulette",
    "href": "game/roulette.html",
    "icon": "../assets/icons/svg/game-roulette.svg",
    "kind": "site",
    "uninstallable": true,
    "defaultInstalled": true,
    "channel": "beta",
    "tag": {
      "en": "Casino",
      "pt": "Cassino",
      "ja": "カジノ"
    },
    "name": {
      "en": "Casino Roulette",
      "pt": "Roleta de Cassino",
      "ja": "カジノルーレット"
    },
    "desc": {
      "en": "Classic casino roulette game with a betting table, chips, and animated wheel. Features multilingual UI (EN/PT/JA) and theme support.",
      "pt": "Jogo clássico de roleta de cassino com mesa de apostas, fichas e roda animada. Possui interface multilíngue (EN/PT/JA) e suporte a temas.",
      "ja": "ベットテーブル、チップ、アニメーションホイールを備えたクラシックなカジノルーレットゲーム。多言語UI（EN / PT / JA）とテーマのサポートが特徴です。"
    }
  },
  {
    "id": "game-slot-machine",
    "href": "game/slot-machine.html",
    "icon": "../assets/icons/svg/game-slot-machine.svg",
    "kind": "site",
    "uninstallable": true,
    "defaultInstalled": false,
    "channel": "beta",
    "tag": {
      "en": "Casino",
      "pt": "Cassino",
      "ja": "カジノ"
    },
    "name": {
      "en": "Slot Machine",
      "pt": "Caça-Níqueis",
      "ja": "スロットマシン"
    },
    "desc": {
      "en": "A classic casino-style slot machine game. Spin the reels and try your luck to win more coins. Features multilingual UI (EN/PT/JA) and theme support.",
      "pt": "Um jogo clássico de caça-níqueis estilo cassino. Gire as bobinas e tente a sua sorte para ganhar mais moedas. Apresenta interface multilíngue (EN/PT/JA) e suporte a temas.",
      "ja": "クラシックなカジノスタイルのスロットマシンゲーム。リールを回して運試し、より多くのコインを獲得しましょう。多言語UI（EN/PT/JA）とテーマサポートを特徴とします。"
    }
  },
  {
    "id": "game-ufo-tank-shooter-3d",
    "href": "game/ufo-tank-shooter-3d.html",
    "icon": "../assets/icons/svg/game-ufo-tank-shooter-3d.svg",
    "kind": "site",
    "uninstallable": true,
    "defaultInstalled": false,
    "channel": "alpha",
    "tag": {
      "en": "WebGL Shooter",
      "pt": "Tiro WebGL",
      "ja": "WebGLシューティング"
    },
    "name": {
      "en": "UFO Tank Shooter 3D",
      "pt": "Tanque Contra OVNIs 3D",
      "ja": "UFOタンクシューター 3D"
    },
    "desc": {
      "en": "Low-poly Three.js arcade shooter where you drive a tank, aim into the sky, and blast UFO waves before their tractor beams drain your armor.",
      "pt": "Shooter arcade low-poly em Three.js: dirija um tanque, mire no céu e destrua ondas de OVNIs antes que os raios tratores drenem sua blindagem.",
      "ja": "ローポリのThree.jsアーケードシューティング。戦車を操縦し、空へ照準を合わせ、UFOのトラクタービームで装甲が削られる前に撃ち落とします。"
    }
  },
  {
    "id": "game-traffic-pickup",
    "href": "game/traffic-pickup.html",
    "icon": "../assets/icons/svg/game-traffic-pickup.svg",
    "kind": "site",
    "uninstallable": true,
    "defaultInstalled": false,
    "channel": "alpha",
    "tag": {
      "en": "Puzzle",
      "pt": "Puzzle",
      "ja": "パズル"
    },
    "name": {
      "en": "Traffic Jam Pickup",
      "pt": "Traffic Jam Pickup",
      "ja": "トラフィックジャム・ピックアップ"
    },
    "desc": {
      "en": "Color-matching traffic puzzle with crowded parking lots, passenger queues, buses, vans, cars, coins, unlockable slots, and procedural solvable levels.",
      "pt": "Puzzle de trânsito por cores com estacionamento lotado, fila de passageiros, ônibus, vans, carros, moedas, vagas desbloqueáveis e fases procedurais solucionáveis.",
      "ja": "混雑した駐車場、乗客列、バス、バン、車、コイン、解放できる駐車枠、解ける手続き型レベルを備えた色合わせ交通パズル。"
    }
  },
  {
    "id": "utils-wordpad",
    "href": "utils/wordpad.html",
    "icon": "../assets/icons/svg/utils-wordpad.svg",
    "kind": "site",
    "uninstallable": true,
    "defaultInstalled": false,
    "channel": "alpha",
    "tag": {
      "en": "Editor",
      "pt": "Editor",
      "ja": "エディタ"
    },
    "name": {
      "en": "WordPad",
      "pt": "WordPad",
      "ja": "ワードパッド"
    },
    "desc": {
      "en": "Rich text editor with formatting, file operations, find/replace, and multilingual UI. Supports .txt, .docx, and .html import/export.",
      "pt": "Editor de texto rico com formatação, operações de arquivo, localizar/substituir e UI multilíngue. Suporta importação/exportação de .txt, .docx e .html.",
      "ja": "フォーマット、ファイル操作、検索/置換、多言語UIを備えたリッチテキストエディタ。.txt、.docx、.htmlのインポート/エクスポートをサポート。"
    },
    "multiInstance": true
  },
  {
    "id": "utils-mindmap",
    "href": "utils/mindmap.html",
    "icon": "../assets/icons/svg/utils-mindmap.svg",
    "kind": "site",
    "uninstallable": true,
    "defaultInstalled": false,
    "channel": "alpha",
    "tag": {
      "en": "SVG",
      "pt": "SVG",
      "ja": "SVG"
    },
    "name": {
      "en": "Mind Map",
      "pt": "Mapa Mental",
      "ja": "マインドマップ"
    },
    "desc": {
      "en": "Single-file SVG mind map: free/tree/radial layouts, add/edit/delete, zoom/pan, i18n and export/import.",
      "pt": "Mapa mental SVG em arquivo único: layouts livre/árvore/radial, adicionar/editar/excluir, zoom/pan, i18n e exportar/importar.",
      "ja": "単一ファイルSVGマインドマップ：フリー/ツリー/放射状レイアウト、追加/編集/削除、ズーム/パン、i18n、エクスポート/インポート。"
    }
  },
  {
    "id": "utils-slides",
    "href": "utils/slides.html",
    "icon": "../assets/icons/svg/utils-slides.svg",
    "kind": "site",
    "uninstallable": true,
    "defaultInstalled": false,
    "channel": "alpha",
    "tag": {
      "en": "Presentation",
      "pt": "Apresentação",
      "ja": "プレゼン"
    },
    "name": {
      "en": "Slides",
      "pt": "Slides",
      "ja": "スライド"
    },
    "desc": {
      "en": "Presentation editor with Project, Folder, Document structure. Slides support text, images, YouTube video, shapes and lines; fullscreen presentation mode; templates and zzSlideSystem for shared templates/backgrounds.",
      "pt": "Editor de apresentações com estrutura Projeto, Pasta, Documento. Slides suportam texto, imagens, vídeo YouTube, formas e linhas; modo apresentação em tela cheia; modelos e zzSlideSystem para templates e fundos compartilhados.",
      "ja": "プロジェクト、フォルダ、ドキュメント構造のプレゼンエディタ。スライドはテキスト、画像、YouTube動画、図形・線をサポート。全画面プレゼンモード、zzSlideSystemでテンプレート・背景を共有。"
    }
  },
  {
    "id": "game-pachinko1",
    "href": "game/pachinko1.html",
    "icon": "../assets/icons/svg/game-pachinko1.svg",
    "kind": "site",
    "uninstallable": true,
    "defaultInstalled": false,
    "channel": "alpha",
    "tag": {
      "en": "Arcade",
      "pt": "Arcade",
      "ja": "アーケード"
    },
    "name": {
      "en": "Pachinko",
      "pt": "Pachinko",
      "ja": "パチンコ"
    },
    "desc": {
      "en": "Canvas pachinko with pegs, bins, scoring and multilingual UI. Click to drop or enable auto-drop.",
      "pt": "Pachinko em canvas com pinos, caixas, pontuação e interface multilíngue. Clique para soltar ou ative o auto-drop.",
      "ja": "釘、ビン、スコアリング、多言語UIを備えたキャンバスパチンコ。クリックしてドロップするか、自動ドロップを有効にします。"
    }
  },
  {
    "id": "game-pachinko2",
    "href": "game/pachinko2.html",
    "icon": "../assets/icons/svg/game-pachinko2.svg",
    "kind": "site",
    "uninstallable": true,
    "defaultInstalled": false,
    "channel": "alpha",
    "tag": {
      "en": "WebGL",
      "pt": "WebGL",
      "ja": "WebGL"
    },
    "name": {
      "en": "Pachinko 3D",
      "pt": "Pachinko 3D",
      "ja": "パチンコ3D"
    },
    "desc": {
      "en": "Three.js + cannon-es neon pachinko: physics pegs, pockets and jackpot, UI in EN/JP/PT.",
      "pt": "Pachinko neon com Three.js + cannon-es: pinos físicos, bolsos e jackpot, UI em EN/JP/PT.",
      "ja": "Three.js + cannon-es ネオンパチンコ：物理的な釘、ポケット、ジャックポット、UIはEN/JP/PT対応。"
    }
  },
  {
    "id": "game-claw-machine",
    "href": "game/claw-machine.html",
    "icon": "../assets/icons/svg/game-claw-machine.svg",
    "kind": "site",
    "uninstallable": true,
    "defaultInstalled": false,
    "channel": "alpha",
    "tag": {
      "en": "Canvas",
      "pt": "Canvas",
      "ja": "キャンバス"
    },
    "name": {
      "en": "Claw Machine",
      "pt": "Máquina de Garra",
      "ja": "クレーンゲーム"
    },
    "desc": {
      "en": "2D crane game on HTML5 canvas; tri-lingual UI (en/pt/ja).",
      "pt": "Jogo de garra 2D em tela HTML5; UI trilíngue (en/pt/ja).",
      "ja": "HTML5キャンバス上の2Dクレーンゲーム。多言語UI（en/pt/ja）。"
    }
  },
  {
    "id": "game-game4",
    "href": "game/game4.html",
    "icon": "../assets/icons/svg/game-game4.svg",
    "kind": "site",
    "uninstallable": true,
    "defaultInstalled": false,
    "channel": "alpha",
    "tag": {
      "en": "Strategy",
      "pt": "Estratégia",
      "ja": "戦略"
    },
    "name": {
      "en": "Turret Survivor",
      "pt": "Sobrevivente de Torreta",
      "ja": "タレットサバイバー"
    },
    "desc": {
      "en": "Place temporary turrets between waves and upgrade their stats while you survive progressively harder enemies.",
      "pt": "Posicione torretas temporárias entre as ondas e melhore seus status enquanto sobrevive a inimigos progressivamente mais difíceis.",
      "ja": "ウェーブの合間に一時的なタレットを配置し、ますます困難になる敵を生き延びながらステータスをアップグレード。"
    }
  },
  {
    "id": "game-race",
    "href": "game/race.html",
    "icon": "../assets/icons/svg/game-race.svg",
    "kind": "site",
    "uninstallable": true,
    "defaultInstalled": false,
    "channel": "alpha",
    "tag": {
      "en": "Racing",
      "pt": "Corrida",
      "ja": "レース"
    },
    "name": {
      "en": "Hover Racing (Three.js)",
      "pt": "Corrida Flutuante (Three.js)",
      "ja": "ホバーレーシング (Three.js)"
    },
    "desc": {
      "en": "Spline-based hovercraft track with bots, boosts and HUD. Tune FOV, laps and field size.",
      "pt": "Pista de hovercraft baseada em spline com bots, boosts e HUD. Ajuste FOV, voltas e tamanho do campo.",
      "ja": "ボット、ブースト、HUDを備えたスプラインベースのホバークラフトトラック。FOV、ラップ、フィールドサイズを調整。"
    }
  },
  {
    "id": "game-game7",
    "href": "game/game7.html",
    "icon": "../assets/icons/svg/game-game7.svg",
    "kind": "site",
    "uninstallable": true,
    "defaultInstalled": false,
    "channel": "alpha",
    "tag": {
      "en": "Maze",
      "pt": "Labirinto",
      "ja": "迷路"
    },
    "name": {
      "en": "Labyrinth Runner",
      "pt": "Corredor de Labirinto",
      "ja": "ラビリンスランナー"
    },
    "desc": {
      "en": "Fog-of-war maze crawler. Find keys, open doors, collect orbs and avoid enemies while leveling up.",
      "pt": "Explorador de labirinto com névoa de guerra. Encontre chaves, abra portas, colete orbes e evite inimigos enquanto sobe de nível.",
      "ja": "戦場の霧の迷路クローラー。鍵を見つけ、ドアを開け、オーブを集め、敵を避けながらレベルアップ。"
    }
  }
];
  let USER_APPS = [];

  function setUserApps(list) {
    USER_APPS = Array.isArray(list) ? list.slice() : [];
  }

  function userApps() {
    return USER_APPS.slice();
  }

  // Old ids of pages that were merged into a tabbed page.
  const ALIASES = {
  "utils-timer": "utils-time_tools",
  "utils-time_diff": "utils-time_tools",
  "utils-time_sum": "utils-time_tools",
  "utils-age_calculator": "utils-time_tools",
  "utils-world_clocks": "utils-time_tools",
  "utils-forex_times": "utils-time_tools",
  "utils-calculator": "utils-calculators",
  "utils-band_calc": "utils-calculators",
  "utils-bitwise_converter": "utils-calculators",
  "utils-regex_playground": "utils-dev_utils",
  "utils-text_diff_studio": "utils-dev_utils",
  "utils-fake_data_generator": "utils-dev_utils",
  "utils-morse_code": "utils-dev_utils",
  "utils-char_art_creator": "utils-dev_utils",
  "utils-password_generator": "utils-dev_utils",
  "utils-prompt_context": "utils-prompt_concat",
  "utils-markdown": "utils-docs",
  "utils-notebook": "utils-docs",
  "utils-image_to_webp": "utils-pdf_image_tools",
  "utils-images_to_pdf": "utils-pdf_image_tools",
  "utils-pdf_toolbox": "utils-pdf_image_tools",
  "utils-code_runner": "utils-code_lab",
  "misc-code_runner": "utils-code_lab",
  "utils-code_flow": "utils-code_lab",
  "utils-todo": "utils-checklist",
  "utils-ps1": "utils-photo_editor",
  "utils-ps2": "utils-photo_editor",
  "utils-sprint": "utils-pixel_studio",
  "utils-pixel1": "utils-pixel_studio",
  "utils-pixel2": "utils-pixel_studio",
  "utils-whiteboard": "utils-whiteboards",
  "utils-whiteboard_google": "utils-whiteboards",
  "utils-whiteboard_gpt": "utils-whiteboards",
  "misc-nebula": "misc-nebula_lab",
  "misc-nebula2": "misc-nebula_lab",
  "misc-spin1": "misc-spin_lab",
  "misc-spin2": "misc-spin_lab",
  "misc-spin3": "misc-spin_lab",
  "misc-vision_motion_lab": "misc-vision_labs",
  "misc-eye_gaze_control": "misc-vision_labs",
  "misc-plasma_ball_lab": "misc-vision_labs"
};

  function resolveId(id) {
    return Object.prototype.hasOwnProperty.call(ALIASES, id) ? ALIASES[id] : id;
  }

  function byId(id) {
    const find = (key) => APPS.find((app) => app.id === key) || USER_APPS.find((app) => app.id === key) || null;
    return find(id) || (id !== resolveId(id) ? find(resolveId(id)) : null);
  }

  // Site apps that belong to the desktop (for example Backup, shown inside Settings).
  function systemSiteApps() {
    return APPS.filter((app) => app.kind === "site" && app.uninstallable === false);
  }

  function siteApps() {
    return APPS.filter((app) => app.kind === "site");
  }

  function nativeApps() {
    return APPS.filter((app) => app.kind === "native");
  }

  function isPrerelease(app) {
    return !!(app && (app.channel === "alpha" || app.channel === "beta"));
  }

  function stableSiteApps() {
    return siteApps().filter((app) => !isPrerelease(app));
  }

  function prereleaseSiteApps() {
    return siteApps().filter(isPrerelease);
  }

  function localizedText(value, lang) {
    if (value == null) return "";
    if (typeof value === "string") return value;
    return value[lang] || value.en || "";
  }

  function displayName(app, lang) {
    if (!app) return "";
    return localizedText(app.name, lang) || app.id;
  }

  function displayTag(app, lang) {
    if (!app) return "";
    return localizedText(app.tag, lang);
  }

  function displayDesc(app, lang) {
    if (!app) return "";
    return localizedText(app.desc, lang);
  }

  function tagGroupKey(app) {
    if (!app || !app.tag) return "App";
    if (typeof app.tag === "string") return app.tag;
    return app.tag.en || "App";
  }

  function resolveHref(app) {
    if (!app) return null;
    const href = app.href || (app.kind === "user" ? app.url : null);
    if (!href) return null;
    if (/^https?:\/\//i.test(href)) return href;
    return "../" + href;
  }

  const DEFAULT_INSTALLED = ["utils-calculators", "utils-copy_tool", "utils-dev_utils", "utils-checklist", "utils-whiteboards", "utils-prompt_concat", "game-tower-defense", "misc-vision_labs", "game-tower-defense-3d", "game-vehicle-bash-arena", "game-cube-bash-arena", "game-service-tycoon", "utils-terminal", "utils-pdf_image_tools", "utils-css_visual_lab", "utils-photo_editor", "utils-vector_editor", "utils-color_picker", "utils-local_image_gallery", "utils-gallery", "utils-kanban", "utils-time_tools", "utils-docs", "utils-obsidian", "utils-audio_player", "utils-fullscreen_message", "utils-wheel_picker", "utils-backup", "game-voxelcraft", "game-forex_sim", "game-river-raid", "game-tetris1", "game-vision_tetris", "game-vision_balloon_ball", "game-vision_hand_pong", "game-game1", "game-2048-shooter", "game-ten-second-stop", "game-cube", "game-checkers", "game-chess", "game-game5", "game-snake", "game-flip", "game-morris", "game-pac-man", "game-space-invaders", "game-crossword", "game-word-search", "game-tic-tac-toe", "game-missile-command", "misc-fluid_lab", "misc-webcam_music_controller", "misc-spin_lab", "misc-robot_face", "misc-nebula_lab", "misc-logic_circuit", "game-roulette"];

  // Start menu "Recommended" row: { id, hash } in display order.
  const START_RECOMMENDED = [{"id": "misc-vision_labs", "hash": ""}, {"id": "misc-nebula_lab", "hash": ""}, {"id": "utils-whiteboards", "hash": "main"}, {"id": "game-voxelcraft", "hash": ""}, {"id": "game-range-club", "hash": ""}];

  function installPackIds(pack) {
    if (pack === "all") return stableSiteApps().map((app) => app.id);
    if (pack === "recommended") return DEFAULT_INSTALLED.slice();
    return [];
  }

  return {
    APPS,
    ALIASES,
    DEFAULT_INSTALLED,
    START_RECOMMENDED,
    installPackIds,
    systemSiteApps,
    resolveId,
    byId,
    siteApps,
    nativeApps,
    userApps,
    setUserApps,
    isPrerelease,
    stableSiteApps,
    prereleaseSiteApps,
    displayName,
    displayTag,
    displayDesc,
    tagGroupKey,
    resolveHref,
  };
})();
