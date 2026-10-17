// EN / PT / JA strings. t(key) falls back to English, then the key.
export const TEXT = {
  en: {
    title: "House Planner",
    project: "Project", projectName: "Name", new: "New", open: "Open", save: "Save", saveAs: "Save as copy", export: "Export JSON", import: "Import JSON",
    saved: "Saved", saving: "Saving…", unsaved: "Not saved", projects: "Saved projects", noProjects: "No saved projects yet.", delete: "Delete", cancel: "Cancel", close: "Close", confirmDelete: "Delete this item?", confirmDeleteProject: "Delete project \"{name}\"?", untitled: "Untitled house",
    terrain: "Terrain", floors: "Floors", walls: "Walls", openings: "Openings", stairs: "Stairs", outdoor: "Outdoor", garden: "Garden", objects: "Objects", comingSoon: "Coming in the next version",
    select: "Select", raise: "Raise", lower: "Lower", flatten: "Flatten", smooth: "Smooth", paint: "Paint", erase: "Erase", rect: "Rectangle", draw: "Draw wall", add: "Add", place: "Place",
    newGroup: "New floor group", view3d: "3D", viewTop: "Top", fit: "Fit", cutaway: "Cutaway", snap: "Snap", undo: "Undo", redo: "Redo", help: "Help",
    building: "Building", storey: "Storey", floor: "Floor", wall: "Wall", opening: "Opening", door: "Door", window: "Window", object: "Object", sun: "Sun", siteObjects: "Site objects", storeys: "Storeys", none: "None",
    addBuilding: "Add building", addStorey: "Add storey", deleteBuilding: "Delete building", deleteStorey: "Delete storey", setActive: "Edit this storey", storeyHint: "A new storey starts at the top of the previous one; edit its elevation freely.",
    preset_ground: "Ground floor (0 / 300 cm)", preset_upper: "Upper floor (+300 cm)", preset_basement: "Basement (−250 cm)",
    name: "Name", elevation: "Elevation", height: "Height", slabThickness: "Slab thickness", visible: "Visible", locked: "Locked", lockedShort: "locked", lock: "Lock", unlock: "Unlock", lockedItem: "This item is locked.",
    offset: "Offset", thickness: "Thickness", width: "Width", depth: "Depth", resolution: "Resolution", length: "Length", sill: "Sill height", flip: "Mirror", type: "Type", colors: "Colours", frameColor: "Frame", leafColor: "Leaf", glassColor: "Glass",
    texture: "Texture", solidColor: "Solid colour", tint: "Colour", surface: "Surface", material: "Texture", position: "Position", rotation: "Rotation", scale: "Scale", size: "Size",
    brush: "Brush", radius: "Radius", strength: "Strength", flattenUnderBuildings: "Flatten ground under buildings", flattenAll: "Reset terrain to flat", terrainHint: "Drag on the ground. Flatten levels toward the height where the stroke started.",
    useTime: "Position from time of day", azimuth: "Azimuth", timeOfDay: "Time of day", time: "Hour", latitude: "Latitude", month: "Month", light: "Light", intensity: "Intensity", shadows: "Shadows", roofShadow: "Roof blocks sunlight",
    tilesCount: "tiles", partsCount: "parts", itemsCount: "items", buildingsCount: "buildings", paintThis: "Paint tiles into this group", mergeInto: "Merge other groups into this one", splitGroup: "Split into connected groups", addOpening: "Add door / window", duplicate: "Duplicate",
    selectHint: "Click an item in the 3D view or in the list to edit it.", wallDone: "Wall chain ended.", openingOverlap: "That spot overlaps another opening.", measure: "",
    catalog: "Catalog", search: "Search objects…", allCategories: "All", noResults: "Nothing found.", rotateGhost: "[ and ] rotate before placing",
    "door-single": "Single door", "door-double": "Double door", "door-sliding": "Sliding glass door", "door-garage": "Garage door", "window-small": "Small window", "window-casement": "Casement window", "window-wide": "Wide window", "window-picture": "Picture window",
    importOk: "Imported.", importError: "Could not import this file.", exported: "Exported.", placed: "Placed", deleted: "Deleted.", noSelection: "Nothing selected.", lastStorey: "A building needs at least one storey.", lastBuilding: "A project needs at least one building.",
    helpTitle: "How to use",
    helpIntro: "Design a house in centimetres. The left panel lists everything in the project; the right panel edits what is selected. Orbit with the left button (Select tool) or Alt+drag, pan with the right button, zoom with the wheel.",
    helpTabs: "Terrain: raise, lower, flatten and smooth the ground with a brush. Floors: paint 50 cm tiles on the active storey; groups can sit at different offsets. Walls: click two points to draw, keep clicking to chain, Shift locks the axis, Esc or right-click ends. Openings: pick a door or window type and click a wall. Objects: pick from the catalog and click a floor or the ground; [ and ] rotate before placing.",
    helpGizmo: "Selected objects get a gizmo: W move, E rotate, R scale. Snapping follows the grid (5 cm, 15°). Ctrl+D duplicates, Delete removes, Ctrl+Z / Ctrl+Y undo and redo, V returns to Select, Esc cancels.",
    helpSun: "Select the Sun in the list to set azimuth, elevation and intensity, or let the time of day drive it. The house is closed to sunlight from above (the invisible roof), so light enters only through doors and windows. Cutaway hides the storeys above the active one.",
    helpStorage: "Projects autosave to this browser (IndexedDB). Use Project › Export to download a JSON file and Import to load it or an Environment Planner project. Lock any item to protect it from accidental edits.",
    helpKeys: "Keys: 1–8 tabs · V select · W/E/R gizmo · [ ] rotate ghost · Ctrl+Z/Y · Ctrl+D · Delete · ? help",
  },
  pt: {
    title: "Planejador de casas",
    project: "Projeto", projectName: "Nome", new: "Novo", open: "Abrir", save: "Salvar", saveAs: "Salvar como cópia", export: "Exportar JSON", import: "Importar JSON",
    saved: "Salvo", saving: "Salvando…", unsaved: "Não salvo", projects: "Projetos salvos", noProjects: "Nenhum projeto salvo ainda.", delete: "Excluir", cancel: "Cancelar", close: "Fechar", confirmDelete: "Excluir este item?", confirmDeleteProject: "Excluir o projeto \"{name}\"?", untitled: "Casa sem nome",
    terrain: "Terreno", floors: "Pisos", walls: "Paredes", openings: "Aberturas", stairs: "Escadas", outdoor: "Externo", garden: "Jardim", objects: "Objetos", comingSoon: "Disponível na próxima versão",
    select: "Selecionar", raise: "Levantar", lower: "Abaixar", flatten: "Aplanar", smooth: "Suavizar", paint: "Pintar", erase: "Apagar", rect: "Retângulo", draw: "Desenhar parede", add: "Adicionar", place: "Posicionar",
    newGroup: "Novo grupo de piso", view3d: "3D", viewTop: "Topo", fit: "Enquadrar", cutaway: "Corte", snap: "Imã", undo: "Desfazer", redo: "Refazer", help: "Ajuda",
    building: "Prédio", storey: "Andar", floor: "Piso", wall: "Parede", opening: "Abertura", door: "Porta", window: "Janela", object: "Objeto", sun: "Sol", siteObjects: "Objetos do lote", storeys: "Andares", none: "Nenhum",
    addBuilding: "Adicionar prédio", addStorey: "Adicionar andar", deleteBuilding: "Excluir prédio", deleteStorey: "Excluir andar", setActive: "Editar este andar", storeyHint: "Um andar novo começa no topo do anterior; ajuste a elevação como quiser.",
    preset_ground: "Térreo (0 / 300 cm)", preset_upper: "Andar superior (+300 cm)", preset_basement: "Subsolo (−250 cm)",
    name: "Nome", elevation: "Elevação", height: "Altura", slabThickness: "Espessura da laje", visible: "Visível", locked: "Travado", lockedShort: "travado", lock: "Travar", unlock: "Destravar", lockedItem: "Este item está travado.",
    offset: "Desnível", thickness: "Espessura", width: "Largura", depth: "Profundidade", resolution: "Resolução", length: "Comprimento", sill: "Altura do peitoril", flip: "Espelhar", type: "Tipo", colors: "Cores", frameColor: "Moldura", leafColor: "Folha", glassColor: "Vidro",
    texture: "Textura", solidColor: "Cor sólida", tint: "Cor", surface: "Superfície", material: "Textura", position: "Posição", rotation: "Rotação", scale: "Escala", size: "Tamanho",
    brush: "Pincel", radius: "Raio", strength: "Força", flattenUnderBuildings: "Aplanar o chão sob os prédios", flattenAll: "Zerar o terreno", terrainHint: "Arraste sobre o chão. Aplanar nivela para a altura onde o traço começou.",
    useTime: "Posição pela hora do dia", azimuth: "Azimute", timeOfDay: "Hora do dia", time: "Hora", latitude: "Latitude", month: "Mês", light: "Luz", intensity: "Intensidade", shadows: "Sombras", roofShadow: "Telhado bloqueia o sol",
    tilesCount: "placas", partsCount: "partes", itemsCount: "itens", buildingsCount: "prédios", paintThis: "Pintar placas neste grupo", mergeInto: "Juntar os outros grupos neste", splitGroup: "Separar em grupos conectados", addOpening: "Adicionar porta / janela", duplicate: "Duplicar",
    selectHint: "Clique em um item na vista 3D ou na lista para editá-lo.", wallDone: "Sequência de paredes encerrada.", openingOverlap: "Esse ponto sobrepõe outra abertura.", measure: "",
    catalog: "Catálogo", search: "Buscar objetos…", allCategories: "Todos", noResults: "Nada encontrado.", rotateGhost: "[ e ] giram antes de posicionar",
    "door-single": "Porta simples", "door-double": "Porta dupla", "door-sliding": "Porta de correr (vidro)", "door-garage": "Portão de garagem", "window-small": "Janela pequena", "window-casement": "Janela de abrir", "window-wide": "Janela larga", "window-picture": "Janela panorâmica",
    importOk: "Importado.", importError: "Não foi possível importar este arquivo.", exported: "Exportado.", placed: "Posicionado", deleted: "Excluído.", noSelection: "Nada selecionado.", lastStorey: "Um prédio precisa de pelo menos um andar.", lastBuilding: "Um projeto precisa de pelo menos um prédio.",
    helpTitle: "Como usar",
    helpIntro: "Desenhe uma casa em centímetros. O painel esquerdo lista tudo do projeto; o direito edita o que está selecionado. Gire a câmera com o botão esquerdo (ferramenta Selecionar) ou Alt+arrastar, mova com o botão direito e aproxime com a roda.",
    helpTabs: "Terreno: levante, abaixe, aplane e suavize o chão com um pincel. Pisos: pinte placas de 50 cm no andar ativo; grupos podem ficar em desníveis diferentes. Paredes: clique em dois pontos para desenhar, continue clicando para encadear, Shift trava o eixo, Esc ou botão direito encerra. Aberturas: escolha um tipo de porta ou janela e clique numa parede. Objetos: escolha no catálogo e clique num piso ou no chão; [ e ] giram antes de posicionar.",
    helpGizmo: "Objetos selecionados ganham um gizmo: W mover, E girar, R escalar. O imã segue a grade (5 cm, 15°). Ctrl+D duplica, Delete remove, Ctrl+Z / Ctrl+Y desfaz e refaz, V volta a Selecionar, Esc cancela.",
    helpSun: "Selecione o Sol na lista para definir azimute, altura e intensidade, ou deixe a hora do dia controlar. A casa é fechada ao sol por cima (telhado invisível), então a luz entra só por portas e janelas. O Corte esconde os andares acima do ativo.",
    helpStorage: "Os projetos são salvos automaticamente neste navegador (IndexedDB). Use Projeto › Exportar para baixar um JSON e Importar para carregá-lo ou um projeto do Environment Planner. Trave qualquer item para evitar edições acidentais.",
    helpKeys: "Teclas: 1–8 abas · V selecionar · W/E/R gizmo · [ ] girar · Ctrl+Z/Y · Ctrl+D · Delete · ? ajuda",
  },
  ja: {
    title: "ハウスプランナー",
    project: "プロジェクト", projectName: "名前", new: "新規", open: "開く", save: "保存", saveAs: "コピーとして保存", export: "JSONを書き出す", import: "JSONを読み込む",
    saved: "保存済み", saving: "保存中…", unsaved: "未保存", projects: "保存済みプロジェクト", noProjects: "保存されたプロジェクトはありません。", delete: "削除", cancel: "キャンセル", close: "閉じる", confirmDelete: "この項目を削除しますか？", confirmDeleteProject: "プロジェクト「{name}」を削除しますか？", untitled: "無題の家",
    terrain: "地形", floors: "床", walls: "壁", openings: "開口部", stairs: "階段", outdoor: "屋外", garden: "庭", objects: "オブジェクト", comingSoon: "次のバージョンで追加予定",
    select: "選択", raise: "盛り上げ", lower: "掘り下げ", flatten: "平らにする", smooth: "なめらか", paint: "塗る", erase: "消す", rect: "矩形", draw: "壁を描く", add: "追加", place: "配置",
    newGroup: "新しい床グループ", view3d: "3D", viewTop: "上面", fit: "全体表示", cutaway: "断面", snap: "スナップ", undo: "元に戻す", redo: "やり直す", help: "ヘルプ",
    building: "建物", storey: "階", floor: "床", wall: "壁", opening: "開口部", door: "ドア", window: "窓", object: "オブジェクト", sun: "太陽", siteObjects: "敷地のオブジェクト", storeys: "階", none: "なし",
    addBuilding: "建物を追加", addStorey: "階を追加", deleteBuilding: "建物を削除", deleteStorey: "階を削除", setActive: "この階を編集", storeyHint: "新しい階は前の階の上端から始まります。高さは自由に変更できます。",
    preset_ground: "1階 (0 / 300 cm)", preset_upper: "上階 (+300 cm)", preset_basement: "地下 (−250 cm)",
    name: "名前", elevation: "高さ位置", height: "高さ", slabThickness: "スラブ厚", visible: "表示", locked: "ロック中", lockedShort: "ロック", lock: "ロック", unlock: "ロック解除", lockedItem: "この項目はロックされています。",
    offset: "段差", thickness: "厚さ", width: "幅", depth: "奥行き", resolution: "解像度", length: "長さ", sill: "窓台の高さ", flip: "反転", type: "種類", colors: "色", frameColor: "枠", leafColor: "扉", glassColor: "ガラス",
    texture: "テクスチャ", solidColor: "単色", tint: "色", surface: "表面", material: "テクスチャ", position: "位置", rotation: "回転", scale: "拡大率", size: "サイズ",
    brush: "ブラシ", radius: "半径", strength: "強さ", flattenUnderBuildings: "建物の下の地面を平らにする", flattenAll: "地形をリセット", terrainHint: "地面をドラッグします。「平らにする」はストロークの開始点の高さに揃えます。",
    useTime: "時刻から位置を決める", azimuth: "方位角", timeOfDay: "時刻", time: "時", latitude: "緯度", month: "月", light: "光", intensity: "強さ", shadows: "影", roofShadow: "屋根が日光を遮る",
    tilesCount: "タイル", partsCount: "パーツ", itemsCount: "項目", buildingsCount: "建物", paintThis: "このグループにタイルを塗る", mergeInto: "他のグループをここに統合", splitGroup: "つながった部分ごとに分割", addOpening: "ドア / 窓を追加", duplicate: "複製",
    selectHint: "3Dビューまたはリストで項目をクリックすると編集できます。", wallDone: "壁の連続描画を終了しました。", openingOverlap: "その位置は別の開口部と重なります。", measure: "",
    catalog: "カタログ", search: "オブジェクトを検索…", allCategories: "すべて", noResults: "見つかりません。", rotateGhost: "[ と ] で配置前に回転",
    "door-single": "片開きドア", "door-double": "両開きドア", "door-garage": "ガレージドア", "door-sliding": "ガラス引き戸", "window-small": "小窓", "window-casement": "開き窓", "window-wide": "横長の窓", "window-picture": "大きな窓",
    importOk: "読み込みました。", importError: "このファイルは読み込めません。", exported: "書き出しました。", placed: "配置しました", deleted: "削除しました。", noSelection: "何も選択されていません。", lastStorey: "建物には少なくとも1つの階が必要です。", lastBuilding: "プロジェクトには少なくとも1つの建物が必要です。",
    helpTitle: "使い方",
    helpIntro: "センチ単位で家を設計します。左パネルはプロジェクトの一覧、右パネルは選択中の項目の設定です。左ボタン（選択ツール）または Alt+ドラッグで回転、右ボタンで移動、ホイールでズームします。",
    helpTabs: "地形：ブラシで地面を盛り上げ・掘り下げ・平坦化・なめらかにします。床：アクティブな階に50cmのタイルを塗ります。グループごとに段差を付けられます。壁：2点をクリックして描き、続けてクリックで連結、Shiftで軸固定、Escまたは右クリックで終了。開口部：ドアや窓の種類を選んで壁をクリック。オブジェクト：カタログから選んで床や地面をクリック。[ と ] で配置前に回転。",
    helpGizmo: "選択したオブジェクトにはギズモが付きます：W 移動、E 回転、R 拡大縮小。スナップはグリッド（5cm、15°）に従います。Ctrl+D 複製、Delete 削除、Ctrl+Z / Ctrl+Y 元に戻す・やり直す、V 選択に戻る、Esc キャンセル。",
    helpSun: "リストで太陽を選ぶと方位角・高度・強さを設定でき、時刻から決めることもできます。家は上からの日光を遮る（見えない屋根）ので、光はドアと窓からだけ入ります。断面はアクティブな階より上を隠します。",
    helpStorage: "プロジェクトはこのブラウザ（IndexedDB）に自動保存されます。プロジェクト › 書き出すでJSONをダウンロードし、読み込むでそのファイルやEnvironment Plannerのプロジェクトを開けます。誤操作を防ぐには項目をロックします。",
    helpKeys: "キー：1–8 タブ · V 選択 · W/E/R ギズモ · [ ] 回転 · Ctrl+Z/Y · Ctrl+D · Delete · ? ヘルプ",
  },
};

export function makeT(getLang) {
  return (key, vars) => {
    const lang = getLang();
    let s = TEXT[lang]?.[key] ?? TEXT.en[key] ?? key;
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, v);
    return s;
  };
}
export function translate(root, t) {
  root.querySelectorAll("[data-i18n]").forEach((el) => (el.textContent = t(el.dataset.i18n)));
  root.querySelectorAll("[data-tip]").forEach((el) => {
    el.title = t(el.dataset.tip);
    el.setAttribute("aria-label", t(el.dataset.tip));
  });
  root.querySelectorAll("[data-placeholder]").forEach((el) => (el.placeholder = t(el.dataset.placeholder)));
}
