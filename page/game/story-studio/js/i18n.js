const STORAGE_KEY = 'app_lang';

export const LANGS = ['en', 'pt', 'ja'];

export const STRINGS = {
  en: {
    modelBlender: 'Blender prototype', modelVoxel: 'Compare voxel', modelSource: 'Blender file',
    modelHint: 'New cuts and sculpting are edited in Blender; fabric painting uses the voxel version.',
    title: 'Story Studio',
    tagline: 'Little 3D films you can take apart',
    stories: 'Stories', characters: 'Characters', props: 'Objects', sets: 'Sets',
    library: 'Library', official: 'Official', mine: 'Mine',
    overrides: 'replaces the official one',
    empty: 'Nothing here yet.',
    emptyMine: 'Import a document to start your own library.',
    play: 'Play', pause: 'Pause', replay: 'Replay', back: 'Back to library',
    open: 'Open', preview: 'Preview', edit: 'Edit', save: 'Save',
    duplicate: 'Duplicate', duplicated: 'Copied as "{id}".',
    visualEdit: 'Visual edit',
    editMove: 'Move', editRotate: 'Rotate', editSnap: 'Snap', editSky: 'Time of day',
    editSearch: 'Search objects', editInScene: 'In the set',
    editPickHint: 'Click an object to select it, or drag one in from the left',
    editSnapOn: 'snapping 0.25 m / 15°',
    editProps: 'Properties', editId: 'Name', editPos: 'Position', editRot: 'Rotation',
    editYaw: 'yaw', editPitch: 'pitch', editRoll: 'roll',
    editSize: 'Size', editUniform: 'linked', editTint: 'Colour',
    editTintClear: 'Original', editRepeat: 'Repeat', editCount: 'count',
    editLock: 'Lock', editUnlock: 'Unlock', editLocked: 'locked',
    editLockedHint: 'Locked. Unlock it to move, turn or delete it.',
    storyEdit: 'Visual edit', editSet: 'Set', editShot: 'Free look',
    editCamera: 'Camera', editStage: 'Stage', editDo: 'Action', editWhen: 'Time',
    editAddAction: 'Add action', editText: 'Line', editHolds: 'Holding',
    editFromView: 'Camera from this view',
    editOpeningShot: 'Opening shot', editCamAt: 'Camera at', editCamLook: 'Looking at',
    editPickAnything: 'Pick somebody on the stage, or a block on the timeline.',
    storySaved: 'Story saved as "{id}".',
    storyDiscard: 'Discard the changes to this story?',
    editSaved: 'Set saved as "{id}".',
    editDiscard: 'Discard the changes to this set?',
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
    kindCharacter: 'Character', kindProp: 'Object', kindSet: 'Set', kindStory: 'Story', exportGlb: 'Export GLB', exportedGlb: 'GLB exported.', exportGlbFailed: 'Could not export this item as GLB.',
    noDemo: 'This action has no body to show.',
    actions: 'Actions', groupAction: 'Group', soloAction: 'Solo',
    reps: 'reps', demo: 'Demo',
    baseMan: 'Man', baseWoman: 'Woman', baseBoy: 'Boy', baseGirl: 'Girl',
    hair: 'Hair',
    height: 'Height', build: 'Build', outfits: 'Outfits', anchors: 'Anchors',
    theme: 'Theme', themeLight: 'Light', themeDark: 'Dark', language: 'Language',
    detail: 'Detail', detailOn: 'Detailed', detailOff: 'Simple',
    fitCut: 'Cut', fitFit: 'Fit', fitSwell: 'Stands off the body',
    fitPlans: 'Offered to', fitPreviewOn: 'Try it on',
    fitPaints: 'Paints', fitPaintName: 'Paint name', fitColor: 'Main colour',
    fitAdd: 'New', fitCopy: 'Copy', fitNewPaint: 'New paint',
    fitSpray: 'Spray', fitInk: 'Ink', fitDots: 'Dots',
    fitSprayed: '{n} cells sprayed', fitClear: 'Clear spray',
    fitTool_move: 'Turn', fitTool_spray: 'Spray', fitTool_erase: 'Erase', fitTool_pick: 'Pick colour',
    fitHint: 'Left-drag sprays, right-drag turns the body. Paint only lands on cloth.',
    fitSaved: 'Outfit saved as "{id}".',
    fitDiscard: 'Discard the changes to this outfit?',
    kindOutfit: 'Outfit', propNew: 'New object',
    propSelect: 'Select', propMove: 'Move', propRotate: 'Rotate', propScale: 'Scale', propPen: 'Pen', propSpray: 'Spray', propPaintColor: 'Paint colour', propBrushSize: 'Tip size', propBase: 'Use existing as base', propExport: 'Export GLB', propExported: 'GLB exported.', propExportFailed: 'Could not export this object as GLB.', propParts: 'Parts', propLock: 'Lock this part', propRemove: 'Remove part', propRemoveConfirm: 'Remove the selected part?', propShapes: 'Add geometric part', propHint: 'Select a part, then move, rotate or scale it with the handles. Use the lock boxes to keep parts out of the way. Choose an ink colour and tip size before using the pen or spray.', propPartProps: 'Selected part', propColor: 'Colour', propOpacity: 'Transparency', propShape: 'Shape', propSize: 'Size', propObjectProps: 'Object', propName: 'Name', propId: 'ID', propEmit: 'Emit light', propPickup: 'Can be held', propGrip: 'Hand / arm angle', propCompare: 'Compare with character', propSaved: 'Object saved as "{id}".', propDiscard: 'Discard the changes to this object?',
    docs: 'Format reference',
  },
  pt: {
    modelBlender: 'Protótipo Blender', modelVoxel: 'Comparar voxel', modelSource: 'Arquivo Blender',
    modelHint: 'Novos cortes e escultura são editados no Blender; a pintura do tecido usa a versão voxel.',
    title: 'Story Studio',
    tagline: 'Pequenos filmes 3D que você pode desmontar',
    stories: 'Histórias', characters: 'Personagens', props: 'Objetos', sets: 'Cenários',
    library: 'Biblioteca', official: 'Oficial', mine: 'Meus',
    overrides: 'substitui o oficial',
    empty: 'Nada aqui ainda.',
    emptyMine: 'Importe um documento para começar sua própria biblioteca.',
    play: 'Reproduzir', pause: 'Pausar', replay: 'Repetir', back: 'Voltar à biblioteca',
    open: 'Abrir', preview: 'Prévia', edit: 'Editar', save: 'Salvar',
    duplicate: 'Duplicar', duplicated: 'Copiado como "{id}".',
    visualEdit: 'Editar visual',
    editMove: 'Mover', editRotate: 'Girar', editSnap: 'Encaixe', editSky: 'Hora do dia',
    editSearch: 'Buscar objetos', editInScene: 'No cenário',
    editPickHint: 'Clique num objeto para selecionar, ou arraste um da esquerda',
    editSnapOn: 'encaixe 0,25 m / 15°',
    editProps: 'Propriedades', editId: 'Nome', editPos: 'Posição', editRot: 'Rotação',
    editYaw: 'yaw', editPitch: 'pitch', editRoll: 'roll',
    editSize: 'Tamanho', editUniform: 'junto', editTint: 'Cor',
    editTintClear: 'Original', editRepeat: 'Repetir', editCount: 'quantos',
    editLock: 'Travar', editUnlock: 'Destravar', editLocked: 'travado',
    editLockedHint: 'Travado. Destrave para mover, girar ou excluir.',
    storyEdit: 'Editar visual', editSet: 'Cenário', editShot: 'Olhar livre',
    editCamera: 'Câmera', editStage: 'Palco', editDo: 'Ação', editWhen: 'Tempo',
    editAddAction: 'Nova ação', editText: 'Fala', editHolds: 'Segurando',
    editFromView: 'Câmera daqui',
    editOpeningShot: 'Plano de abertura', editCamAt: 'Câmera em', editCamLook: 'Olhando para',
    editPickAnything: 'Escolha alguém no palco, ou um bloco na linha do tempo.',
    storySaved: 'História salva como "{id}".',
    storyDiscard: 'Descartar as alterações desta história?',
    editSaved: 'Cenário salvo como "{id}".',
    editDiscard: 'Descartar as alterações deste cenário?',
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
    kindCharacter: 'Personagem', kindProp: 'Objeto', kindSet: 'Cenário', kindStory: 'História', exportGlb: 'Exportar GLB', exportedGlb: 'GLB exportado.', exportGlbFailed: 'Não foi possível exportar este item como GLB.',
    noDemo: 'Esta ação não tem corpo para mostrar.',
    actions: 'Ações', groupAction: 'Em grupo', soloAction: 'Individual',
    reps: 'repetições', demo: 'Demonstração',
    baseMan: 'Homem', baseWoman: 'Mulher', baseBoy: 'Menino', baseGirl: 'Menina',
    hair: 'Cabelo',
    height: 'Altura', build: 'Porte', outfits: 'Roupas', anchors: 'Âncoras',
    theme: 'Tema', themeLight: 'Claro', themeDark: 'Escuro', language: 'Idioma',
    detail: 'Detalhe', detailOn: 'Detalhado', detailOff: 'Simples',
    fitCut: 'Corte', fitFit: 'Caimento', fitSwell: 'Folga sobre o corpo',
    fitPlans: 'Oferecida para', fitPreviewOn: 'Vestir em',
    fitPaints: 'Pinturas', fitPaintName: 'Nome da pintura', fitColor: 'Cor principal',
    fitAdd: 'Nova', fitCopy: 'Copiar', fitNewPaint: 'Nova pintura',
    fitSpray: 'Spray', fitInk: 'Tinta', fitDots: 'Pontos',
    fitSprayed: '{n} células pintadas', fitClear: 'Limpar spray',
    fitTool_move: 'Girar', fitTool_spray: 'Spray', fitTool_erase: 'Apagar', fitTool_pick: 'Pegar cor',
    fitHint: 'Arraste com o botão esquerdo para pintar, com o direito para girar. A tinta só pega na roupa.',
    fitSaved: 'Roupa salva como "{id}".',
    fitDiscard: 'Descartar as mudanças nesta roupa?',
    kindOutfit: 'Roupa', propNew: 'Novo objeto',
    propSelect: 'Selecionar', propMove: 'Mover', propRotate: 'Girar', propScale: 'Redimensionar', propPen: 'Caneta', propSpray: 'Spray', propPaintColor: 'Cor da pintura', propBrushSize: 'Tamanho da ponta', propBase: 'Usar objeto existente como base', propExport: 'Exportar GLB', propExported: 'GLB exportado.', propExportFailed: 'Não foi possível exportar este objeto como GLB.', propParts: 'Partes', propLock: 'Bloquear esta parte', propRemove: 'Remover parte', propRemoveConfirm: 'Remover a parte selecionada?', propShapes: 'Adicionar parte geométrica', propHint: 'Selecione uma parte e use as alças para mover, girar ou redimensionar. Use as caixas de bloqueio para manter partes fora do caminho. Escolha a cor e o tamanho da ponta antes de usar a caneta ou o spray.', propPartProps: 'Parte selecionada', propColor: 'Cor', propOpacity: 'Transparência', propShape: 'Forma', propSize: 'Tamanho', propObjectProps: 'Objeto', propName: 'Nome', propId: 'ID', propEmit: 'Emitir luz', propPickup: 'Pode ser segurado', propGrip: 'Ângulo da mão / braço', propCompare: 'Comparar com personagem', propSaved: 'Objeto salvo como "{id}".', propDiscard: 'Descartar as mudanças neste objeto?',
    docs: 'Referência do formato',
  },
  ja: {
    modelBlender: 'Blender試作', modelVoxel: 'ボクセルと比較', modelSource: 'Blenderファイル',
    modelHint: '新しい服の形や造形はBlenderで編集します。布のペイントにはボクセル版を使います。',
    title: 'Story Studio',
    tagline: '分解できる小さな3D映画',
    stories: '物語', characters: '登場人物', props: '物体', sets: '舞台',
    library: 'ライブラリ', official: '公式', mine: '自分の',
    overrides: '公式版を置き換えます',
    empty: 'まだ何もありません。',
    emptyMine: 'ドキュメントを読み込むと自分のライブラリが始まります。',
    play: '再生', pause: '一時停止', replay: 'もう一度', back: 'ライブラリへ戻る',
    open: '開く', preview: 'プレビュー', edit: '編集', save: '保存',
    duplicate: '複製', duplicated: '「{id}」として複製しました。',
    visualEdit: '画面で編集',
    editMove: '移動', editRotate: '回転', editSnap: 'スナップ', editSky: '時刻',
    editSearch: '物体を検索', editInScene: 'この舞台の中',
    editPickHint: '物体をクリックして選ぶか、左からドラッグしてください',
    editSnapOn: 'スナップ 0.25 m / 15°',
    editProps: 'プロパティ', editId: '名前', editPos: '位置', editRot: '回転',
    editYaw: 'yaw', editPitch: 'pitch', editRoll: 'roll',
    editSize: '大きさ', editUniform: '連動', editTint: '色',
    editTintClear: '元の色', editRepeat: '繰り返し', editCount: '個数',
    editLock: 'ロック', editUnlock: 'ロック解除', editLocked: 'ロック中',
    editLockedHint: 'ロック中です。移動・回転・削除には解除してください。',
    storyEdit: '画面で編集', editSet: '舞台', editShot: '自由視点',
    editCamera: 'カメラ', editStage: '舞台効果', editDo: '動作', editWhen: '時間',
    editAddAction: '動作を追加', editText: 'セリフ', editHolds: '手に持つ',
    editFromView: 'この視点をカメラに',
    editOpeningShot: '冒頭のカット', editCamAt: 'カメラ位置', editCamLook: '注視点',
    editPickAnything: '舞台の人物か、タイムラインのブロックを選んでください。',
    storySaved: '物語を「{id}」として保存しました。',
    storyDiscard: 'この物語の変更を破棄しますか。',
    editSaved: '舞台を「{id}」として保存しました。',
    editDiscard: 'この舞台の変更を破棄しますか。',
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
    kindCharacter: '登場人物', kindProp: '物体', kindSet: '舞台', kindStory: '物語', exportGlb: 'GLBを書き出す', exportedGlb: 'GLBを書き出しました。', exportGlbFailed: 'このアイテムをGLBに書き出せませんでした。',
    noDemo: 'この動作には見せる体がありません。',
    actions: '動作', groupAction: 'グループ', soloAction: '単独',
    reps: '回', demo: 'デモ',
    baseMan: '男性', baseWoman: '女性', baseBoy: '男の子', baseGirl: '女の子',
    hair: '髪',
    height: '身長', build: '体格', outfits: '衣装', anchors: 'アンカー',
    theme: 'テーマ', themeLight: 'ライト', themeDark: 'ダーク', language: '言語',
    detail: '描き込み', detailOn: '細かい', detailOff: '簡素',
    fitCut: '仕立て', fitFit: 'ゆとり', fitSwell: '体からの浮き',
    fitPlans: '対象', fitPreviewOn: '試着する体',
    fitPaints: '塗装', fitPaintName: '塗装の名前', fitColor: '主色',
    fitAdd: '新規', fitCopy: '複製', fitNewPaint: '新しい塗装',
    fitSpray: 'スプレー', fitInk: 'インク', fitDots: 'ドット',
    fitSprayed: '{n} セル塗装済み', fitClear: 'スプレーを消す',
    fitTool_move: '回す', fitTool_spray: 'スプレー', fitTool_erase: '消す', fitTool_pick: '色を拾う',
    fitHint: '左ドラッグで塗り、右ドラッグで回します。塗料は布にしか乗りません。',
    fitSaved: '衣装を「{id}」として保存しました。',
    fitDiscard: 'この衣装の変更を破棄しますか？',
    kindOutfit: '衣装', propNew: '新しい物体',
    propSelect: '選択', propMove: '移動', propRotate: '回転', propScale: 'サイズ変更', propPen: 'ペン', propSpray: 'スプレー', propPaintColor: '塗る色', propBrushSize: '先端のサイズ', propBase: '既存の物体をベースにする', propExport: 'GLBを書き出す', propExported: 'GLBを書き出しました。', propExportFailed: 'この物体をGLBに書き出せませんでした。', propParts: 'パーツ', propLock: 'このパーツをロック', propRemove: 'パーツを削除', propRemoveConfirm: '選択したパーツを削除しますか？', propShapes: '図形パーツを追加', propHint: 'パーツを選び、ハンドルで移動・回転・サイズ変更を行います。ロック欄で他のパーツを編集対象から外せます。ペンやスプレーの前に色と先端サイズを選びます。', propPartProps: '選択中のパーツ', propColor: '色', propOpacity: '透明度', propShape: '形', propSize: 'サイズ', propObjectProps: '物体', propName: '名前', propId: 'ID', propEmit: '光を発する', propPickup: '手で持てる', propGrip: '手・腕の角度', propCompare: '登場人物と比較', propSaved: '物体を「{id}」として保存しました。', propDiscard: 'この物体の変更を破棄しますか。',
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
