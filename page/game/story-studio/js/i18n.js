const STORAGE_KEY = 'app_lang';

export const LANGS = ['en', 'pt', 'ja'];

export const STRINGS = {
  en: {
    title: 'Story Studio',
    tagline: 'Little 3D films you can take apart',
    stories: 'Stories', characters: 'Characters', props: 'Objects', sets: 'Sets',
    library: 'Library', official: 'Official', mine: 'Mine',
    overrides: 'replaces the official one',
    empty: 'Nothing here yet.',
    emptyMine: 'Import a document to start your own library.',
    play: 'Play', pause: 'Pause', replay: 'Replay', back: 'Back to library',
    open: 'Open', preview: 'Preview', edit: 'Edit', save: 'Save',
    export: 'Export', exportBundle: 'Export with everything it uses',
    import: 'Import', importTitle: 'Import a document',
    importHint: 'Paste a JSON document, or drop a .json file. A bundle brings in everything at once.',
    importPaste: 'Paste JSON here',
    importFile: 'Choose a .json file', importGlb: 'Upload a .glb model',
    importDo: 'Import', imported: 'Imported {n} document(s).',
    remove: 'Delete', removeConfirm: 'Delete "{name}" from your library? This cannot be undone.',
    cancel: 'Cancel', close: 'Close',
    editorTitle: 'Edit as JSON', apply: 'Apply and play', revert: 'Revert',
    valid: 'Valid.', problems: 'Problems',
    loading: 'Loading…', notFound: 'Not found.',
    missingProps: 'Missing objects, drawn as pink boxes: {list}',
    libraryProblems: 'Some shipped documents failed to load: {list}',
    storageOff: 'Browser storage is unavailable, so your own documents cannot be saved. Official content still plays.',
    duration: 'Length', castLabel: 'Cast', actionsLabel: 'Actions',
    kindCharacter: 'Character', kindProp: 'Object', kindSet: 'Set', kindStory: 'Story',
    baseMan: 'Man', baseWoman: 'Woman', baseChild: 'Child',
    height: 'Height', build: 'Build', outfits: 'Outfits', anchors: 'Anchors',
    theme: 'Theme', themeLight: 'Light', themeDark: 'Dark', language: 'Language',
    detail: 'Detail', detailOn: 'Detailed', detailOff: 'Simple',
    docs: 'Format reference',
  },
  pt: {
    title: 'Story Studio',
    tagline: 'Pequenos filmes 3D que você pode desmontar',
    stories: 'Histórias', characters: 'Personagens', props: 'Objetos', sets: 'Cenários',
    library: 'Biblioteca', official: 'Oficial', mine: 'Meus',
    overrides: 'substitui o oficial',
    empty: 'Nada aqui ainda.',
    emptyMine: 'Importe um documento para começar sua própria biblioteca.',
    play: 'Reproduzir', pause: 'Pausar', replay: 'Repetir', back: 'Voltar à biblioteca',
    open: 'Abrir', preview: 'Prévia', edit: 'Editar', save: 'Salvar',
    export: 'Exportar', exportBundle: 'Exportar com tudo que ela usa',
    import: 'Importar', importTitle: 'Importar um documento',
    importHint: 'Cole um documento JSON ou solte um arquivo .json. Um bundle traz tudo de uma vez.',
    importPaste: 'Cole o JSON aqui',
    importFile: 'Escolher arquivo .json', importGlb: 'Enviar modelo .glb',
    importDo: 'Importar', imported: '{n} documento(s) importado(s).',
    remove: 'Excluir', removeConfirm: 'Excluir "{name}" da sua biblioteca? Não dá para desfazer.',
    cancel: 'Cancelar', close: 'Fechar',
    editorTitle: 'Editar como JSON', apply: 'Aplicar e reproduzir', revert: 'Reverter',
    valid: 'Válido.', problems: 'Problemas',
    loading: 'Carregando…', notFound: 'Não encontrado.',
    missingProps: 'Objetos ausentes, desenhados como caixas rosa: {list}',
    libraryProblems: 'Alguns documentos oficiais não carregaram: {list}',
    storageOff: 'O armazenamento do navegador não está disponível, então seus documentos não podem ser salvos. O conteúdo oficial continua funcionando.',
    duration: 'Duração', castLabel: 'Elenco', actionsLabel: 'Ações',
    kindCharacter: 'Personagem', kindProp: 'Objeto', kindSet: 'Cenário', kindStory: 'História',
    baseMan: 'Homem', baseWoman: 'Mulher', baseChild: 'Criança',
    height: 'Altura', build: 'Porte', outfits: 'Roupas', anchors: 'Âncoras',
    theme: 'Tema', themeLight: 'Claro', themeDark: 'Escuro', language: 'Idioma',
    detail: 'Detalhe', detailOn: 'Detalhado', detailOff: 'Simples',
    docs: 'Referência do formato',
  },
  ja: {
    title: 'Story Studio',
    tagline: '分解できる小さな3D映画',
    stories: '物語', characters: '登場人物', props: '物体', sets: '舞台',
    library: 'ライブラリ', official: '公式', mine: '自分の',
    overrides: '公式版を置き換えます',
    empty: 'まだ何もありません。',
    emptyMine: 'ドキュメントを読み込むと自分のライブラリが始まります。',
    play: '再生', pause: '一時停止', replay: 'もう一度', back: 'ライブラリへ戻る',
    open: '開く', preview: 'プレビュー', edit: '編集', save: '保存',
    export: '書き出し', exportBundle: '使用中のものをすべて含めて書き出し',
    import: '読み込み', importTitle: 'ドキュメントを読み込む',
    importHint: 'JSONを貼り付けるか、.jsonファイルをドロップしてください。バンドルなら一度にすべて入ります。',
    importPaste: 'ここにJSONを貼り付け',
    importFile: '.jsonファイルを選ぶ', importGlb: '.glbモデルを送る',
    importDo: '読み込む', imported: '{n}件のドキュメントを読み込みました。',
    remove: '削除', removeConfirm: '「{name}」をライブラリから削除しますか。取り消せません。',
    cancel: 'やめる', close: '閉じる',
    editorTitle: 'JSONとして編集', apply: '適用して再生', revert: '元に戻す',
    valid: '問題ありません。', problems: '問題',
    loading: '読み込み中…', notFound: '見つかりません。',
    missingProps: '見つからない物体はピンクの箱で表示しています: {list}',
    libraryProblems: '一部の公式ドキュメントを読み込めませんでした: {list}',
    storageOff: 'ブラウザの保存領域が使えないため、自分のドキュメントは保存できません。公式の内容は再生できます。',
    duration: '長さ', castLabel: '配役', actionsLabel: '動作',
    kindCharacter: '登場人物', kindProp: '物体', kindSet: '舞台', kindStory: '物語',
    baseMan: '男性', baseWoman: '女性', baseChild: '子ども',
    height: '身長', build: '体格', outfits: '衣装', anchors: 'アンカー',
    theme: 'テーマ', themeLight: 'ライト', themeDark: 'ダーク', language: '言語',
    detail: '描き込み', detailOn: '細かい', detailOff: '簡素',
    docs: '書式リファレンス',
  },
};

let lang = 'en';
const listeners = new Set();

export function initI18n() {
  let stored = null;
  try {
    stored = localStorage.getItem(STORAGE_KEY);
  } catch (_err) { /* private mode */ }
  if (LANGS.includes(stored)) lang = stored;
  else if (LANGS.includes((navigator.language || '').slice(0, 2))) lang = navigator.language.slice(0, 2);
  document.documentElement.lang = lang;
  return lang;
}

export function getLang() {
  return lang;
}

export function setLang(next) {
  if (!LANGS.includes(next) || next === lang) return lang;
  lang = next;
  document.documentElement.lang = lang;
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch (_err) { /* keep it for this session only */ }
  for (const fn of listeners) fn(lang);
  applyI18n();
  return lang;
}

export function onLangChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function t(key, vars) {
  let s = STRINGS[lang]?.[key] ?? STRINGS.en[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}

/** A document's own per-language field, falling back so a name written only
 *  in Portuguese still shows something to an English reader. */
export function localised(field, fallback = '') {
  if (typeof field === 'string') return field;
  if (!field || typeof field !== 'object') return fallback;
  return field[lang] || field.en || field.pt || field.ja || fallback;
}

export function applyI18n(root = document) {
  for (const el of root.querySelectorAll('[data-i18n]')) {
    el.textContent = t(el.dataset.i18n);
  }
  for (const el of root.querySelectorAll('[data-i18n-placeholder]')) {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  }
  for (const el of root.querySelectorAll('[data-i18n-title]')) {
    el.title = t(el.dataset.i18nTitle);
  }
  for (const el of root.querySelectorAll('[data-i18n-aria]')) {
    el.setAttribute('aria-label', t(el.dataset.i18nAria));
  }
}
