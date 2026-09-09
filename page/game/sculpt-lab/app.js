import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { SimplifyModifier } from 'three/addons/modifiers/SimplifyModifier.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const $ = (selector) => document.querySelector(selector);
const viewport = $('#viewport');
const DB_NAME = 'OrbitSculptLabDB';
const DB_VERSION = 2;
const STORE = 'projects';
const SESSION_STORE = 'session';
const DEFAULT_COLOR = '#c9a69d';

const translations = {
  pt: {
    brandOverline: 'ORBIT / PLAYGROUND 3D', appTitle: 'Orbit Sculpt Lab', language: 'Idioma', themeToggle: 'Alternar tema', localOnly: 'LOCAL', dragKey: 'arraste', scrollKey: 'scroll', rightMouse: 'botão direito', untitledForm: 'Forma sem nome', untitledBlock: 'Bloco sem nome', delete: 'Excluir', toolGuideHeading: 'Ferramenta selecionada', howToUse: 'COMO USAR',
    clayGuideTitle: 'Clay', clayGuideDesc: 'Adiciona volume à superfície, como modelar argila.', clayGuideUse: 'Clique e arraste sobre a malha para construir a forma.', inflateGuideTitle: 'Inflar', inflateGuideDesc: 'Expande a superfície para criar saliências e formas arredondadas.', inflateGuideUse: 'Arraste devagar sobre uma área para fazê-la crescer.', sinkGuideTitle: 'Afundar', sinkGuideDesc: 'Empurra uma área ampla para dentro da forma, criando depressões suaves.', sinkGuideUse: 'Arraste sobre a superfície; ajuste o raio para controlar a largura da depressão.', carveGuideTitle: 'Cavar', carveGuideDesc: 'Escava um sulco mais estreito e profundo no centro do pincel.', carveGuideUse: 'Arraste como uma goiva; reduza o raio para desenhar detalhes fundos.', grabGuideTitle: 'Puxar', grabGuideDesc: 'Move uma região inteira da malha sem perder o volume ao redor.', grabGuideUse: 'Arraste a área na direção desejada; use raios maiores para formas largas.', smoothGuideTitle: 'Suavizar', smoothGuideDesc: 'Mistura os vértices vizinhos para remover marcas e transições duras.', smoothGuideUse: 'Passe o pincel várias vezes sobre a marca que deseja suavizar.', paintGuideTitle: 'Pintar', paintGuideDesc: 'Aplica a cor escolhida diretamente nos vértices da superfície.', paintGuideUse: 'Escolha uma cor e arraste como se estivesse usando uma caneta.', eraseGuideTitle: 'Apagar cor', eraseGuideDesc: 'Retorna a área pintada para a cor original da massa.', eraseGuideUse: 'Arraste sobre as cores que deseja remover.',
    ready: 'Pronto', saving: 'Salvando…', saved: 'Salvo', loaded: 'Projeto carregado', sessionRestored: 'Sessão anterior restaurada', reduceVertices: 'Reduzir vértices', reducingVertices: 'Reduzindo…', verticesReduced: 'Vértices reduzidos: {before} → {after}', minimumVertices: 'A malha já está no limite mínimo', refineVertices: 'Refinar áreas esticadas', refiningVertices: 'Refinando…', verticesRefined: '{added} vértices adicionados nas áreas esparsas', noSparseAreas: 'Nenhuma área esticada precisa de mais vértices', meshTooDense: 'A malha atingiu o limite de segurança', topologyNote: 'Reduzir simplifica tudo; Refinar adiciona pontos somente onde estão muito espaçados.',
    baseMesh: 'Malha base', live: 'AO VIVO', sphere: 'Esfera', box: 'Caixa', organicBase: 'Base orgânica', hardSurface: 'Superfície dura', density: 'Densidade', newMesh: 'Nova malha',
    brush: 'Pincel', clay: 'Clay', inflate: 'Inflar', sink: 'Afundar', carve: 'Cavar', grab: 'Puxar', smooth: 'Suavizar', paint: 'Pintar', erase: 'Apagar cor', radius: 'Raio', strength: 'Força', color: 'Cor', symmetry: 'Simetria X', display: 'Visualização', wireframe: 'Wireframe', floorGrid: 'Grade no chão',
    undo: 'Desfazer', redo: 'Refazer', sculptMode: 'Esculpir', moveCamera: 'Mover câmera', orbitCamera: 'Rodar câmera', front: 'Frente', top: 'Topo', isometric: 'Isométrica', dragHint: 'Arraste sobre a malha para esculpir', panHint: 'Arraste para mover a câmera', orbitHint: 'Arraste para rodar a câmera', loading: 'Carregando motor 3D…', vertices: 'vértices', faces: 'faces',
    project: 'Projeto', projectName: 'Nome do projeto', projectNamePlaceholder: 'Dê um nome à sua forma', saveProject: 'Salvar no navegador', saveNote: 'IndexedDB · salvo somente neste dispositivo', fileStudio: 'Arquivos', exportGlb: 'Exportar GLB', importFile: 'Importar modelo', exportJson: 'Exportar JSON', importJson: 'Importar JSON', fileNote: 'GLB leva a malha e as cores do vértice. JSON mantém o projeto editável.',
    savedProjects: 'Projetos salvos', noProjects: 'Nenhum projeto salvo ainda.', shortcuts: 'Atalhos', orbit: 'Orbitar', zoom: 'Zoom', rotate: 'Rotacionar câmera', brushSize: 'Tamanho do pincel',
    meshCreated: 'Nova malha criada', sculptSaved: 'Projeto salvo no navegador', exportDone: 'Arquivo GLB exportado', jsonExportDone: 'Projeto JSON exportado', imported: 'Modelo importado', partsImported: '{count} partes importadas e unificadas', jsonImported: 'Projeto JSON importado', noUndo: 'Nada para desfazer', noRedo: 'Nada para refazer', deleted: 'Projeto excluído', invalidFile: 'Arquivo não reconhecido', dbError: 'Não foi possível acessar o armazenamento',
    typeSphere: 'Esfera', typeBox: 'Caixa', typeImported: 'Importado', toolClay: 'Clay', toolInflate: 'Inflar', toolSink: 'Afundar', toolCarve: 'Cavar', toolGrab: 'Puxar', toolSmooth: 'Suavizar', toolPaint: 'Pintar', toolErase: 'Apagar cor', confirmDelete: 'Excluir este projeto?'
  },
  en: {
    brandOverline: 'ORBIT / 3D PLAYGROUND', appTitle: 'Orbit Sculpt Lab', language: 'Language', themeToggle: 'Toggle theme', localOnly: 'LOCAL', dragKey: 'drag', scrollKey: 'scroll', rightMouse: 'right mouse', untitledForm: 'Untitled form', untitledBlock: 'Untitled block', delete: 'Delete', toolGuideHeading: 'Selected tool', howToUse: 'HOW TO USE',
    clayGuideTitle: 'Clay', clayGuideDesc: 'Adds volume to the surface, like shaping clay.', clayGuideUse: 'Click and drag over the mesh to build the form.', inflateGuideTitle: 'Inflate', inflateGuideDesc: 'Expands the surface to create bumps and rounded forms.', inflateGuideUse: 'Drag slowly over an area to make it grow.', sinkGuideTitle: 'Sink', sinkGuideDesc: 'Pushes a broad area into the form to create soft depressions.', sinkGuideUse: 'Drag over the surface; adjust the radius to control the depression width.', carveGuideTitle: 'Carve', carveGuideDesc: 'Cuts a narrower, deeper groove at the center of the brush.', carveGuideUse: 'Drag like a gouge; reduce the radius to draw deep details.', grabGuideTitle: 'Grab', grabGuideDesc: 'Moves an entire region of the mesh while keeping nearby volume.', grabGuideUse: 'Drag the area in the desired direction; use a larger radius for broad forms.', smoothGuideTitle: 'Smooth', smoothGuideDesc: 'Blends neighboring vertices to remove marks and hard transitions.', smoothGuideUse: 'Brush over a mark several times to soften it.', paintGuideTitle: 'Paint', paintGuideDesc: 'Applies the selected color directly to surface vertices.', paintGuideUse: 'Choose a color and drag as if you were using a pen.', eraseGuideTitle: 'Erase color', eraseGuideDesc: 'Returns painted areas to the original material color.', eraseGuideUse: 'Drag over the colors you want to remove.',
    ready: 'Ready', saving: 'Saving…', saved: 'Saved', loaded: 'Project loaded', sessionRestored: 'Previous session restored', reduceVertices: 'Reduce vertices', reducingVertices: 'Reducing…', verticesReduced: 'Vertices reduced: {before} → {after}', minimumVertices: 'The mesh is already at the minimum limit', refineVertices: 'Refine stretched areas', refiningVertices: 'Refining…', verticesRefined: '{added} vertices added to sparse areas', noSparseAreas: 'No stretched area needs more vertices', meshTooDense: 'The mesh reached the safety limit', topologyNote: 'Reduce simplifies everything; Refine adds points only where they are too far apart.',
    baseMesh: 'Base mesh', live: 'LIVE', sphere: 'Sphere', box: 'Box', organicBase: 'Organic base', hardSurface: 'Hard surface', density: 'Density', newMesh: 'New mesh',
    brush: 'Brush', clay: 'Clay', inflate: 'Inflate', sink: 'Sink', carve: 'Carve', grab: 'Grab', smooth: 'Smooth', paint: 'Paint', erase: 'Erase color', radius: 'Radius', strength: 'Strength', color: 'Color', symmetry: 'X symmetry', display: 'Display', wireframe: 'Wireframe', floorGrid: 'Floor grid',
    undo: 'Undo', redo: 'Redo', sculptMode: 'Sculpt', moveCamera: 'Move camera', orbitCamera: 'Rotate camera', front: 'Front', top: 'Top', isometric: 'Isometric', dragHint: 'Drag over the mesh to sculpt', panHint: 'Drag to move the camera', orbitHint: 'Drag to rotate the camera', loading: 'Loading 3D engine…', vertices: 'vertices', faces: 'faces',
    project: 'Project', projectName: 'Project name', projectNamePlaceholder: 'Name your form', saveProject: 'Save in browser', saveNote: 'IndexedDB · saved on this device only', fileStudio: 'Files', exportGlb: 'Export GLB', importFile: 'Import model', exportJson: 'Export JSON', importJson: 'Import JSON', fileNote: 'GLB carries mesh and vertex colors. JSON keeps the project editable.',
    savedProjects: 'Saved projects', noProjects: 'No saved projects yet.', shortcuts: 'Shortcuts', orbit: 'Orbit', zoom: 'Zoom', rotate: 'Rotate camera', brushSize: 'Brush size',
    meshCreated: 'New mesh created', sculptSaved: 'Project saved in browser', exportDone: 'GLB file exported', jsonExportDone: 'JSON project exported', imported: 'Model imported', partsImported: '{count} parts imported and merged', jsonImported: 'JSON project imported', noUndo: 'Nothing to undo', noRedo: 'Nothing to redo', deleted: 'Project deleted', invalidFile: 'Unrecognized file', dbError: 'Could not access storage',
    typeSphere: 'Sphere', typeBox: 'Box', typeImported: 'Imported', toolClay: 'Clay', toolInflate: 'Inflate', toolSink: 'Sink', toolCarve: 'Carve', toolGrab: 'Grab', toolSmooth: 'Smooth', toolPaint: 'Paint', toolErase: 'Erase color', confirmDelete: 'Delete this project?'
  },
  ja: {
    brandOverline: 'ORBIT / PLAYGROUND 3D', appTitle: 'Orbit Sculpt Lab', language: '言語', themeToggle: 'テーマ切替', localOnly: 'LOCAL', dragKey: 'ドラッグ', scrollKey: 'スクロール', rightMouse: '右クリック', untitledForm: '名前のない形', untitledBlock: '名前のないブロック', delete: '削除', toolGuideHeading: '選択中のツール', howToUse: '使い方',
    clayGuideTitle: 'クレイ', clayGuideDesc: '粘土を形作るように、表面にボリュームを加えます。', clayGuideUse: 'メッシュ上をクリックしてドラッグし、形を作ります。', inflateGuideTitle: '膨らませる', inflateGuideDesc: '表面を広げて、ふくらみや丸い形を作ります。', inflateGuideUse: '育てたい部分をゆっくりドラッグします。', sinkGuideTitle: '押し込む', sinkGuideDesc: '広い範囲を形の内側へ押し込み、滑らかなくぼみを作ります。', sinkGuideUse: '表面をドラッグし、半径でくぼみの幅を調整します。', carveGuideTitle: '彫る', carveGuideDesc: 'ブラシの中心に細く深い溝を彫ります。', carveGuideUse: '丸のみのようにドラッグします。細部には半径を小さくします。', grabGuideTitle: '引っ張る', grabGuideDesc: '周囲のボリュームを保ちながら、メッシュの領域を動かします。', grabGuideUse: '動かしたい方向へドラッグします。広い形には大きな半径を使います。', smoothGuideTitle: 'スムーズ', smoothGuideDesc: '隣接する頂点を混ぜ、跡や硬い境目を滑らかにします。', smoothGuideUse: '滑らかにしたい跡の上を何度かブラシします。', paintGuideTitle: 'ペイント', paintGuideDesc: '選択した色を表面の頂点に直接適用します。', paintGuideUse: '色を選び、ペンのようにドラッグします。', eraseGuideTitle: '色を消す', eraseGuideDesc: 'ペイントした部分を元のマテリアル色に戻します。', eraseGuideUse: '消したい色の上をドラッグします。',
    ready: '準備完了', saving: '保存中…', saved: '保存済み', loaded: 'プロジェクトを読み込みました', sessionRestored: '前回のセッションを復元しました', reduceVertices: '頂点を減らす', reducingVertices: '削減中…', verticesReduced: '頂点を削減: {before} → {after}', minimumVertices: 'メッシュはすでに最小限です', refineVertices: '伸びた部分を細分化', refiningVertices: '細分化中…', verticesRefined: '疎な部分に頂点を{added}個追加しました', noSparseAreas: '頂点を追加する必要がある部分はありません', meshTooDense: 'メッシュが安全上限に達しました', topologyNote: '削減は全体を簡略化し、細分化は間隔が広い部分だけに頂点を追加します。',
    baseMesh: 'ベースメッシュ', live: 'LIVE', sphere: '球体', box: 'ボックス', organicBase: '有機的なベース', hardSurface: 'ハードサーフェス', density: '密度', newMesh: '新しいメッシュ',
    brush: 'ブラシ', clay: 'クレイ', inflate: '膨らませる', sink: '押し込む', carve: '彫る', grab: '引っ張る', smooth: 'スムーズ', paint: 'ペイント', erase: '色を消す', radius: '半径', strength: '強さ', color: '色', symmetry: 'X対称', display: '表示', wireframe: 'ワイヤーフレーム', floorGrid: '床グリッド',
    undo: '元に戻す', redo: 'やり直す', sculptMode: '造形', moveCamera: 'カメラ移動', orbitCamera: 'カメラ回転', front: '正面', top: '上面', isometric: 'アイソメ', dragHint: 'メッシュ上をドラッグして造形', panHint: 'ドラッグしてカメラを移動', orbitHint: 'ドラッグしてカメラを回転', loading: '3Dエンジンを読み込み中…', vertices: '頂点', faces: '面',
    project: 'プロジェクト', projectName: 'プロジェクト名', projectNamePlaceholder: '形に名前を付ける', saveProject: 'ブラウザに保存', saveNote: 'IndexedDB · このデバイスだけに保存', fileStudio: 'ファイル', exportGlb: 'GLBを書き出す', importFile: 'モデルを読み込む', exportJson: 'JSONを書き出す', importJson: 'JSONを読み込む', fileNote: 'GLBはメッシュと頂点カラーを保持。JSONは編集可能なプロジェクトを保持します。',
    savedProjects: '保存済みプロジェクト', noProjects: '保存済みプロジェクトはありません。', shortcuts: 'ショートカット', orbit: '回転', zoom: 'ズーム', rotate: 'カメラ回転', brushSize: 'ブラシサイズ',
    meshCreated: '新しいメッシュを作成しました', sculptSaved: 'ブラウザに保存しました', exportDone: 'GLBを書き出しました', jsonExportDone: 'JSONを書き出しました', imported: 'モデルを読み込みました', partsImported: '{count}個のパーツを読み込み、統合しました', jsonImported: 'JSONプロジェクトを読み込みました', noUndo: '元に戻す操作はありません', noRedo: 'やり直す操作はありません', deleted: 'プロジェクトを削除しました', invalidFile: '認識できないファイルです', dbError: 'ストレージにアクセスできません',
    typeSphere: '球体', typeBox: 'ボックス', typeImported: '読み込み', toolClay: 'クレイ', toolInflate: '膨らませる', toolSink: '押し込む', toolCarve: '彫る', toolGrab: '引っ張る', toolSmooth: 'スムーズ', toolPaint: 'ペイント', toolErase: '色を消す', confirmDelete: 'このプロジェクトを削除しますか？'
  }
};

let lang = localStorage.getItem('sculpt-lab-lang') || 'pt';
if (!translations[lang]) lang = 'pt';
let scene, camera, renderer, controls, mesh, gridHelper, floorPlane, material;
let raycaster = new THREE.Raycaster();
let pointer = new THREE.Vector2();
let activeTool = 'clay';
let cameraMode = 'sculpt';
let temporaryCameraMode = null;
let primitive = 'sphere';
let detail = 3;
let projectId = crypto.randomUUID();
let history = [];
let historyIndex = 0;
let strokeActive = false;
let strokeChanged = false;
let lastPoint = null;
let lastBrushPoint = null;
let grabState = null;
let animationFrame;
let toastTimer;
let dbPromise;
let sessionReady = false;
let sessionSaveTimer;

function t(key) { return translations[lang][key] || translations.en[key] || key; }

function setLanguage(next) {
  lang = next;
  localStorage.setItem('sculpt-lab-lang', lang);
  document.documentElement.lang = lang;
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => { el.placeholder = t(el.dataset.i18nPlaceholder); });
  document.querySelectorAll('[data-i18n-aria]').forEach((el) => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
  document.querySelectorAll('[data-i18n-title]').forEach((el) => { el.title = t(el.dataset.i18nTitle); });
  document.querySelectorAll('[data-lang]').forEach((el) => el.classList.toggle('active', el.dataset.lang === lang));
  updateToolLabel();
  updateToolGuide();
  updateInteractionMode();
  updateObjectLabel();
  renderProjects();
}

function showToast(message) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2500);
}

function setSaveState(state) {
  const el = $('#save-state');
  const dot = el.querySelector('.status-dot');
  dot.className = `status-dot ${state === 'saving' ? 'saving' : state === 'error' ? 'error' : ''}`;
  el.querySelector('[data-i18n]').textContent = t(state === 'saving' ? 'saving' : state === 'error' ? 'dbError' : state === 'saved' ? 'saved' : 'ready');
}

function init3D() {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(38, 1, .1, 100);
  camera.position.set(3.7, 2.8, 4.4);
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  viewport.appendChild(renderer.domElement);

  const hemi = new THREE.HemisphereLight(0xc8fff6, 0x0a202b, 1.35);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xffffff, 4.1);
  key.position.set(3, 5, 4);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 14;
  key.shadow.camera.left = -4;
  key.shadow.camera.right = 4;
  key.shadow.camera.top = 4;
  key.shadow.camera.bottom = -4;
  key.shadow.bias = -0.0004;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x48cfc0, 1.8);
  rim.position.set(-4, 2, -4);
  scene.add(rim);
  gridHelper = new THREE.GridHelper(8, 24, 0x24666c, 0x16424d);
  gridHelper.position.y = -1.425;
  scene.add(gridHelper);
  floorPlane = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), new THREE.MeshStandardMaterial({ color: 0x07151d, roughness: 1, metalness: 0, transparent: true, opacity: .42 }));
  floorPlane.rotation.x = -Math.PI / 2;
  floorPlane.position.y = -1.44;
  floorPlane.receiveShadow = true;
  scene.add(floorPlane);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = .075;
  controls.enablePan = true;
  controls.minDistance = 2.1;
  controls.maxDistance = 10;
  controls.target.set(0, 0, 0);
  controls.update();
  controls.addEventListener('change', () => scheduleSessionSave(400));
  updateInteractionMode();

  createMesh('sphere', 3, false);
  $('#loading').classList.add('hidden');
  resizeRenderer();
  window.addEventListener('resize', resizeRenderer);
  renderer.domElement.addEventListener('pointermove', handlePointerMove);
  renderer.domElement.addEventListener('pointerdown', handlePointerDown);
  window.addEventListener('pointerup', handlePointerUp);
  renderer.domElement.addEventListener('pointerleave', () => { if (!strokeActive) $('#brush-cursor').hidden = true; });
  renderer.domElement.addEventListener('contextmenu', (event) => event.preventDefault());
  animate();
}

function resizeRenderer() {
  if (!renderer) return;
  const width = Math.max(1, viewport.clientWidth);
  const height = Math.max(1, viewport.clientHeight);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
}

function createLegacyGeometry(kind, level) {
  if (kind === 'box') {
    const segments = Math.max(1, level * 2);
    return new THREE.BoxGeometry(2.5, 2.5, 2.5, segments, segments, segments);
  }
  return new THREE.IcosahedronGeometry(1.35, level);
}

function weldGeometry(source, displacedPositions = null, displacedColors = null, tolerance = 1e-5) {
  const base = source.attributes.position;
  if (!base) throw new Error('Geometry has no position attribute');

  const positionValues = displacedPositions?.length === base.count * 3 ? displacedPositions : base.array;
  const displacedColorValues = displacedColors?.length === base.count * 3 ? displacedColors : null;
  const sourceColorAttribute = source.attributes.color?.count === base.count ? source.attributes.color : null;
  const hasColors = Boolean(displacedColorValues || sourceColorAttribute);
  const precision = 1 / tolerance;
  const lookup = new Map();
  const remap = new Uint32Array(base.count);
  const positionSums = [];
  const colorSums = [];
  const occurrences = [];

  for (let i = 0; i < base.count; i++) {
    const key = `${Math.round(base.getX(i) * precision)}|${Math.round(base.getY(i) * precision)}|${Math.round(base.getZ(i) * precision)}`;
    let weldedIndex = lookup.get(key);
    if (weldedIndex === undefined) {
      weldedIndex = occurrences.length;
      lookup.set(key, weldedIndex);
      positionSums.push(0, 0, 0);
      if (hasColors) colorSums.push(0, 0, 0);
      occurrences.push(0);
    }
    remap[i] = weldedIndex;
    occurrences[weldedIndex] += 1;
    const target = weldedIndex * 3;
    positionSums[target] += Number(positionValues[i * 3]);
    positionSums[target + 1] += Number(positionValues[i * 3 + 1]);
    positionSums[target + 2] += Number(positionValues[i * 3 + 2]);
    if (hasColors) {
      colorSums[target] += displacedColorValues ? Number(displacedColorValues[i * 3]) : sourceColorAttribute.getX(i);
      colorSums[target + 1] += displacedColorValues ? Number(displacedColorValues[i * 3 + 1]) : sourceColorAttribute.getY(i);
      colorSums[target + 2] += displacedColorValues ? Number(displacedColorValues[i * 3 + 2]) : sourceColorAttribute.getZ(i);
    }
  }

  occurrences.forEach((count, i) => {
    const offset = i * 3;
    positionSums[offset] /= count;
    positionSums[offset + 1] /= count;
    positionSums[offset + 2] /= count;
    if (hasColors) {
      colorSums[offset] /= count;
      colorSums[offset + 1] /= count;
      colorSums[offset + 2] /= count;
    }
  });

  const sourceIndices = source.index?.array || Array.from({ length: base.count }, (_, i) => i);
  const indices = Array.from(sourceIndices, (index) => remap[index]);
  const welded = new THREE.BufferGeometry();
  welded.setAttribute('position', new THREE.Float32BufferAttribute(positionSums, 3));
  if (hasColors) welded.setAttribute('color', new THREE.Float32BufferAttribute(colorSums, 3));
  welded.setIndex(indices);
  welded.computeVertexNormals();
  welded.computeBoundingBox();
  welded.computeBoundingSphere();
  return welded;
}

function createGeometry(kind, level) {
  let source;
  if (kind === 'box') {
    const segments = Math.max(1, level * 4);
    source = new THREE.BoxGeometry(2.5, 2.5, 2.5, segments, segments, segments);
  } else {
    source = new THREE.IcosahedronGeometry(1.35, Math.max(1, level * 2));
  }
  const geometry = weldGeometry(source);
  source.dispose();
  return geometry;
}

function geometryFromSnapshot(kind, level, snapshot) {
  const levels = [Number(level), 1, 2, 3, 4, 5].filter((value, index, values) => values.indexOf(value) === index);
  for (const candidateLevel of levels) {
    const geometry = createGeometry(kind, candidateLevel);
    if (snapshot?.positions?.length === geometry.attributes.position.count * 3) {
      return { geometry, applySnapshotAfter: true, level: candidateLevel };
    }
    geometry.dispose();

    const legacy = createLegacyGeometry(kind, candidateLevel);
    if (snapshot?.positions?.length === legacy.attributes.position.count * 3) {
      const migratedGeometry = weldGeometry(legacy, snapshot.positions, snapshot.colors);
      legacy.dispose();
      return { geometry: migratedGeometry, applySnapshotAfter: false, level: candidateLevel };
    }
    legacy.dispose();
  }

  const rawGeometry = geometryFromRawSnapshot(snapshot);
  return { geometry: rawGeometry || createGeometry(kind, level), applySnapshotAfter: false, level: Number(level) };
}

function geometryFromRawSnapshot(snapshot) {
  if (!snapshot?.positions?.length) return null;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(snapshot.positions, 3));
  if (snapshot.colors?.length === snapshot.positions.length) geometry.setAttribute('color', new THREE.Float32BufferAttribute(snapshot.colors, 3));
  if (snapshot.indices?.length) geometry.setIndex(snapshot.indices);
  else geometry.setIndex(Array.from({ length: snapshot.positions.length / 3 }, (_, index) => index));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function ensureColors(geometry, color = DEFAULT_COLOR) {
  const count = geometry.attributes.position.count;
  if (!geometry.attributes.color || geometry.attributes.color.count !== count) {
    const c = new THREE.Color(color);
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) c.toArray(colors, i * 3);
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  }
}

function createMaterial() {
  return new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .78, metalness: 0, vertexColors: true, side: THREE.FrontSide, wireframe: $('#wireframe')?.checked || false });
}

function configureMesh(target) {
  target.castShadow = true;
  target.receiveShadow = true;
}

function disposeMesh() {
  if (!mesh) return;
  mesh.geometry.dispose();
  mesh.material.dispose();
  scene.remove(mesh);
}

function createMesh(kind = primitive, level = detail, notify = true) {
  primitive = kind;
  detail = Number(level);
  const geometry = createGeometry(kind, detail);
  geometry.computeVertexNormals();
  ensureColors(geometry);
  disposeMesh();
  material = createMaterial();
  mesh = new THREE.Mesh(geometry, material);
  mesh.name = kind === 'sphere' ? t('untitledForm') : t('untitledBlock');
  mesh.userData.kind = kind;
  configureMesh(mesh);
  scene.add(mesh);
  buildNeighbours();
  history = [captureSnapshot()];
  historyIndex = 0;
  projectId = crypto.randomUUID();
  $('#project-name').value = mesh.name;
  updatePrimitiveButtons();
  updateStats();
  scheduleSessionSave();
  if (notify) { showToast(t('meshCreated')); setSaveState('ready'); }
}

function captureSnapshot() {
  if (!mesh) return { positions: [], colors: [], indices: [] };
  const pos = Array.from(mesh.geometry.attributes.position.array);
  const color = mesh.geometry.attributes.color ? Array.from(mesh.geometry.attributes.color.array) : [];
  const indices = mesh.geometry.index ? Array.from(mesh.geometry.index.array) : [];
  return { positions: pos, colors: color, indices };
}

function applySnapshot(snapshot) {
  if (!mesh || !snapshot?.positions?.length) return false;
  let geometry = mesh.geometry;
  let position = geometry.attributes.position;
  const indexLength = geometry.index?.count || 0;
  const topologyChanged = snapshot.positions.length !== position.array.length
    || (snapshot.indices?.length && snapshot.indices.length !== indexLength);
  if (topologyChanged) {
    const restored = geometryFromRawSnapshot(snapshot);
    if (!restored) return false;
    const name = mesh.name;
    const kind = mesh.userData.kind;
    replaceGeometry(restored, name, kind, false);
    updateStats();
    return true;
  }
  position.array.set(snapshot.positions);
  position.needsUpdate = true;
  ensureColors(geometry);
  if (snapshot.colors?.length) geometry.attributes.color.array.set(snapshot.colors.slice(0, geometry.attributes.color.array.length));
  geometry.attributes.color.needsUpdate = true;
  geometry.computeVertexNormals();
  updateStats();
  return true;
}

function commitHistory() {
  history = history.slice(0, historyIndex + 1);
  history.push(captureSnapshot());
  historyIndex += 1;
  if (history.length > 32) { history.shift(); historyIndex -= 1; }
  updateHistoryButtons();
}

function updateHistoryButtons() {
  $('#undo').disabled = historyIndex <= 0;
  $('#redo').disabled = historyIndex >= history.length - 1;
}

function getPointer(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  return rect;
}

function raycast(event) {
  getPointer(event);
  raycaster.setFromCamera(pointer, camera);
  return mesh ? raycaster.intersectObject(mesh, false)[0] : null;
}

function handlePointerMove(event) {
  const rect = getPointer(event);
  const cursor = $('#brush-cursor');
  cursor.style.left = `${event.clientX - rect.left}px`;
  cursor.style.top = `${event.clientY - rect.top}px`;
  cursor.style.width = `${Math.max(18, Number($('#radius').value) * 94)}px`;
  cursor.style.height = cursor.style.width;
  cursor.style.margin = `-${parseFloat(cursor.style.width) / 2}px 0 0 -${parseFloat(cursor.style.width) / 2}px`;
  if (getInteractionMode() !== 'sculpt') {
    cursor.hidden = true;
    return;
  }
  if (strokeActive && activeTool === 'grab' && grabState) {
    cursor.hidden = false;
    updateGrab(event);
    return;
  }
  const hit = raycast(event);
  cursor.hidden = !hit;
  if (strokeActive && hit) {
    const point = mesh.worldToLocal(hit.point.clone());
    const spacing = Math.max(.006, Number($('#radius').value) * .1);
    if (!lastBrushPoint || point.distanceTo(lastBrushPoint) >= spacing) {
      applyBrush(point);
      lastBrushPoint = point.clone();
    }
    lastPoint = point;
  }
}

function handlePointerDown(event) {
  if (event.button !== 0 || !mesh || getInteractionMode() !== 'sculpt') return;
  const hit = raycast(event);
  if (!hit) return;
  event.preventDefault();
  strokeActive = true;
  strokeChanged = activeTool !== 'grab';
  controls.enabled = false;
  renderer.domElement.setPointerCapture?.(event.pointerId);
  lastPoint = mesh.worldToLocal(hit.point.clone());
  lastBrushPoint = lastPoint.clone();
  if (activeTool === 'grab') beginGrab(hit, lastPoint);
  else applyBrush(lastPoint);
}

function handlePointerUp() {
  if (!strokeActive) return;
  strokeActive = false;
  controls.enabled = true;
  lastPoint = null;
  lastBrushPoint = null;
  grabState = null;
  if (strokeChanged) commitHistory();
  strokeChanged = false;
  scheduleSavedState();
  scheduleSessionSave();
}

function brushInfluence(distance, radius) {
  const x = 1 - distance / radius;
  return x * x * (3 - 2 * x);
}

function beginGrab(hit, startPoint) {
  const geometry = mesh.geometry;
  const position = geometry.attributes.position;
  const originalPositions = new Float32Array(position.array);
  const weights = new Float32Array(position.count);
  const mirroredVertices = new Uint8Array(position.count);
  const radius = Number($('#radius').value);
  const strength = Number($('#strength').value);
  const symmetric = $('#symmetry').checked;
  const mirroredPoint = new THREE.Vector3(-startPoint.x, startPoint.y, startPoint.z);

  for (let i = 0; i < position.count; i++) {
    const vertex = new THREE.Vector3().fromBufferAttribute(position, i);
    const directDistance = vertex.distanceTo(startPoint);
    const mirroredDistance = symmetric ? vertex.distanceTo(mirroredPoint) : Infinity;
    const useMirror = mirroredDistance < directDistance;
    const distance = useMirror ? mirroredDistance : directDistance;
    if (distance <= radius) {
      weights[i] = brushInfluence(distance, radius) * strength;
      mirroredVertices[i] = useMirror ? 1 : 0;
    }
  }

  const planeNormal = camera.getWorldDirection(new THREE.Vector3());
  grabState = {
    plane: new THREE.Plane().setFromNormalAndCoplanarPoint(planeNormal, hit.point),
    startPoint: startPoint.clone(),
    originalPositions,
    weights,
    mirroredVertices
  };
}

function updateGrab(event) {
  getPointer(event);
  raycaster.setFromCamera(pointer, camera);
  const worldPoint = raycaster.ray.intersectPlane(grabState.plane, new THREE.Vector3());
  if (!worldPoint) return;
  const currentPoint = mesh.worldToLocal(worldPoint.clone());
  const delta = currentPoint.sub(grabState.startPoint);
  const geometry = mesh.geometry;
  const position = geometry.attributes.position;
  let moved = false;

  for (let i = 0; i < position.count; i++) {
    const weight = grabState.weights[i];
    if (!weight) continue;
    const offset = i * 3;
    const moveX = grabState.mirroredVertices[i] ? -delta.x : delta.x;
    position.setXYZ(
      i,
      grabState.originalPositions[offset] + moveX * weight * 1.15,
      grabState.originalPositions[offset + 1] + delta.y * weight * 1.15,
      grabState.originalPositions[offset + 2] + delta.z * weight * 1.15
    );
    moved = true;
  }
  if (!moved) return;
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.attributes.normal.needsUpdate = true;
  strokeChanged = true;
  updateStats();
}

function applyBrush(point) {
  if (!mesh) return;
  const geometry = mesh.geometry;
  const position = geometry.attributes.position;
  const colors = geometry.attributes.color;
  const normals = geometry.attributes.normal;
  const radius = Number($('#radius').value);
  const strength = Number($('#strength').value);
  const symmetric = $('#symmetry').checked;
  const mirrored = new THREE.Vector3(-point.x, point.y, point.z);
  const paintColor = new THREE.Color($('#paint-color').value);
  const baseColor = new THREE.Color(DEFAULT_COLOR);
  let moved = false;

  for (let i = 0; i < position.count; i++) {
    const vertex = new THREE.Vector3().fromBufferAttribute(position, i);
    const dA = vertex.distanceTo(point);
    const dB = symmetric ? vertex.distanceTo(mirrored) : Infinity;
    const useMirror = dB < dA;
    const distance = useMirror ? dB : dA;
    if (distance > radius) continue;
    const influence = brushInfluence(distance, radius) * strength;
    if (activeTool === 'smooth') {
      const neighbours = mesh.userData.neighbours?.[i] || [];
      if (neighbours.length) {
        const average = new THREE.Vector3();
        neighbours.forEach((index) => average.add(new THREE.Vector3().fromBufferAttribute(position, index)));
        average.multiplyScalar(1 / neighbours.length);
        vertex.lerp(average, influence * .22);
      }
    } else if (['clay', 'inflate', 'sink', 'carve'].includes(activeTool)) {
      const normal = new THREE.Vector3().fromBufferAttribute(normals, i).normalize();
      const amounts = { clay: .055, inflate: .07, sink: -.07, carve: -.105 };
      const profile = activeTool === 'carve' ? influence * influence : influence;
      vertex.addScaledVector(normal, profile * amounts[activeTool]);
    } else if (activeTool === 'paint' || activeTool === 'erase') {
      const old = new THREE.Color().fromBufferAttribute(colors, i);
      old.lerp(activeTool === 'erase' ? baseColor : paintColor, Math.min(1, influence * .35));
      colors.setXYZ(i, old.r, old.g, old.b);
    }
    position.setXYZ(i, vertex.x, vertex.y, vertex.z);
    moved = true;
  }
  if (!moved) return;
  position.needsUpdate = true;
  if (activeTool === 'paint' || activeTool === 'erase') colors.needsUpdate = true;
  else {
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    geometry.attributes.normal.needsUpdate = true;
  }
  updateStats();
}

function buildNeighbours() {
  const count = mesh.geometry.attributes.position.count;
  const neighbours = Array.from({ length: count }, () => new Set());
  const index = mesh.geometry.index;
  const indices = index ? index.array : Array.from({ length: count }, (_, i) => i);
  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i], b = indices[i + 1], c = indices[i + 2];
    if ([a, b, c].some((n) => n === undefined)) break;
    neighbours[a].add(b); neighbours[a].add(c); neighbours[b].add(a); neighbours[b].add(c); neighbours[c].add(a); neighbours[c].add(b);
  }
  mesh.userData.neighbours = neighbours.map((set) => [...set]);
}

function updateStats() {
  if (!mesh) return;
  const positionCount = mesh.geometry.attributes.position.count;
  const faceCount = mesh.geometry.index ? mesh.geometry.index.count / 3 : positionCount / 3;
  $('#vertex-count').textContent = positionCount.toLocaleString();
  $('#face-count').textContent = Math.round(faceCount).toLocaleString();
  updateObjectLabel();
}

function transferVertexColors(source, target) {
  const sourcePosition = source.attributes.position;
  const sourceColor = source.attributes.color;
  if (!sourceColor) return;
  const colorByPosition = new Map();
  const keyFor = (x, y, z) => `${Math.round(x * 1e5)}|${Math.round(y * 1e5)}|${Math.round(z * 1e5)}`;
  for (let i = 0; i < sourcePosition.count; i++) {
    colorByPosition.set(
      keyFor(sourcePosition.getX(i), sourcePosition.getY(i), sourcePosition.getZ(i)),
      [sourceColor.getX(i), sourceColor.getY(i), sourceColor.getZ(i)]
    );
  }
  const fallback = new THREE.Color(DEFAULT_COLOR);
  const colors = new Float32Array(target.attributes.position.count * 3);
  for (let i = 0; i < target.attributes.position.count; i++) {
    const position = target.attributes.position;
    const color = colorByPosition.get(keyFor(position.getX(i), position.getY(i), position.getZ(i))) || [fallback.r, fallback.g, fallback.b];
    colors.set(color, i * 3);
  }
  target.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
}

async function reduceVertices() {
  if (!mesh) return;
  const before = mesh.geometry.attributes.position.count;
  if (before <= 24) {
    showToast(t('minimumVertices'));
    return;
  }

  const button = $('#reduce-vertices');
  const label = button.querySelector('[data-i18n]');
  button.disabled = true;
  label.textContent = t('reducingVertices');
  await new Promise((resolve) => requestAnimationFrame(resolve));

  try {
    const source = mesh.geometry.clone();
    // three r164's modifier has a color-path issue; colors are transferred
    // from retained vertex positions immediately after simplification.
    source.deleteAttribute('color');
    const targetCount = Math.max(12, Math.floor(before / 2));
    const removeCount = Math.max(1, before - targetCount);
    const modifier = new SimplifyModifier();
    const simplified = modifier.modify(source, removeCount);
    source.dispose();
    transferVertexColors(mesh.geometry, simplified);
    simplified.computeVertexNormals();
    simplified.computeBoundingBox();
    simplified.computeBoundingSphere();

    const name = mesh.name;
    const kind = mesh.userData.kind;
    replaceGeometry(simplified, name, kind, false);
    commitHistory();
    updateStats();
    scheduleSessionSave();
    const after = mesh.geometry.attributes.position.count;
    showToast(t('verticesReduced').replace('{before}', before.toLocaleString()).replace('{after}', after.toLocaleString()));
  } catch (error) {
    console.error(error);
    showToast(t('invalidFile'));
  } finally {
    button.disabled = false;
    label.textContent = t('reduceVertices');
  }
}

function subdivideSparseEdges(source, maximumVertices = 200000) {
  const position = source.attributes.position;
  const color = source.attributes.color;
  const sourceIndices = source.index?.array || Array.from({ length: position.count }, (_, index) => index);
  const edges = new Map();
  const edgeKey = (a, b) => a < b ? `${a}:${b}` : `${b}:${a}`;
  const registerEdge = (a, b) => {
    const key = edgeKey(a, b);
    if (edges.has(key)) return;
    const dx = position.getX(a) - position.getX(b);
    const dy = position.getY(a) - position.getY(b);
    const dz = position.getZ(a) - position.getZ(b);
    edges.set(key, { key, a, b, length: Math.hypot(dx, dy, dz) });
  };

  for (let i = 0; i < sourceIndices.length; i += 3) {
    const a = sourceIndices[i], b = sourceIndices[i + 1], c = sourceIndices[i + 2];
    registerEdge(a, b);
    registerEdge(b, c);
    registerEdge(c, a);
  }

  const lengths = [...edges.values()].map((edge) => edge.length).sort((a, b) => a - b);
  if (!lengths.length) return { geometry: null, added: 0 };
  const medianLength = lengths[Math.floor(lengths.length / 2)];
  const threshold = medianLength * 1.6;
  const availableSlots = Math.max(0, maximumVertices - position.count);
  const candidates = [...edges.values()]
    .filter((edge) => edge.length > threshold)
    .sort((a, b) => b.length - a.length)
    .slice(0, availableSlots);
  if (!candidates.length) return { geometry: null, added: 0 };

  const markedEdges = new Set(candidates.map((edge) => edge.key));
  const positions = Array.from(position.array);
  const colors = color ? Array.from(color.array) : [];
  const midpointIndices = new Map();
  const midpointFor = (a, b) => {
    const key = edgeKey(a, b);
    if (midpointIndices.has(key)) return midpointIndices.get(key);
    const midpoint = positions.length / 3;
    positions.push(
      (position.getX(a) + position.getX(b)) / 2,
      (position.getY(a) + position.getY(b)) / 2,
      (position.getZ(a) + position.getZ(b)) / 2
    );
    if (color) {
      colors.push(
        (color.getX(a) + color.getX(b)) / 2,
        (color.getY(a) + color.getY(b)) / 2,
        (color.getZ(a) + color.getZ(b)) / 2
      );
    }
    midpointIndices.set(key, midpoint);
    return midpoint;
  };

  const outputIndices = [];
  const triangle = (a, b, c) => outputIndices.push(a, b, c);
  for (let i = 0; i < sourceIndices.length; i += 3) {
    const a = sourceIndices[i], b = sourceIndices[i + 1], c = sourceIndices[i + 2];
    const splitAB = markedEdges.has(edgeKey(a, b));
    const splitBC = markedEdges.has(edgeKey(b, c));
    const splitCA = markedEdges.has(edgeKey(c, a));
    const splitCount = Number(splitAB) + Number(splitBC) + Number(splitCA);
    const ab = splitAB ? midpointFor(a, b) : null;
    const bc = splitBC ? midpointFor(b, c) : null;
    const ca = splitCA ? midpointFor(c, a) : null;

    if (splitCount === 0) triangle(a, b, c);
    else if (splitCount === 3) {
      triangle(a, ab, ca); triangle(ab, b, bc); triangle(ca, bc, c); triangle(ab, bc, ca);
    } else if (splitCount === 1 && splitAB) {
      triangle(a, ab, c); triangle(ab, b, c);
    } else if (splitCount === 1 && splitBC) {
      triangle(b, bc, a); triangle(bc, c, a);
    } else if (splitCount === 1) {
      triangle(c, ca, b); triangle(ca, a, b);
    } else if (splitAB && splitBC) {
      triangle(b, bc, ab); triangle(a, ab, c); triangle(ab, bc, c);
    } else if (splitBC && splitCA) {
      triangle(c, ca, bc); triangle(b, bc, a); triangle(a, bc, ca);
    } else {
      triangle(a, ab, ca); triangle(b, c, ca); triangle(b, ca, ab);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  if (color) geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(outputIndices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return { geometry, added: midpointIndices.size };
}

async function refineStretchedAreas() {
  if (!mesh) return;
  if (mesh.geometry.attributes.position.count >= 200000) {
    showToast(t('meshTooDense'));
    return;
  }
  const button = $('#refine-vertices');
  const label = button.querySelector('[data-i18n]');
  button.disabled = true;
  label.textContent = t('refiningVertices');
  await new Promise((resolve) => requestAnimationFrame(resolve));

  try {
    const result = subdivideSparseEdges(mesh.geometry);
    if (!result.geometry || !result.added) {
      showToast(t('noSparseAreas'));
      return;
    }
    const name = mesh.name;
    const kind = mesh.userData.kind;
    replaceGeometry(result.geometry, name, kind, false);
    commitHistory();
    updateStats();
    scheduleSessionSave();
    showToast(t('verticesRefined').replace('{added}', result.added.toLocaleString()));
  } catch (error) {
    console.error(error);
    showToast(t('invalidFile'));
  } finally {
    button.disabled = false;
    label.textContent = t('refineVertices');
  }
}

function updateObjectLabel() {
  if (!mesh) return;
  $('#object-name').textContent = $('#project-name')?.value || mesh.name || 'Untitled form';
  $('#object-type').textContent = primitive === 'sphere' ? t('typeSphere') : primitive === 'box' ? t('typeBox') : t('typeImported');
}

function updatePrimitiveButtons() {
  document.querySelectorAll('[data-primitive]').forEach((button) => button.classList.toggle('active', button.dataset.primitive === primitive));
  $('#density').value = detail;
  $('#density-value').textContent = `${detail} / 5`;
}

function updateToolLabel() {
  const key = { clay: 'toolClay', inflate: 'toolInflate', sink: 'toolSink', carve: 'toolCarve', grab: 'toolGrab', smooth: 'toolSmooth', paint: 'toolPaint', erase: 'toolErase' }[activeTool];
  $('#active-tool-name').textContent = t(key);
}

const toolGuideData = {
  clay: { icon: '✦', title: 'clayGuideTitle', desc: 'clayGuideDesc', use: 'clayGuideUse' },
  inflate: { icon: '◉', title: 'inflateGuideTitle', desc: 'inflateGuideDesc', use: 'inflateGuideUse' },
  sink: { icon: '⊖', title: 'sinkGuideTitle', desc: 'sinkGuideDesc', use: 'sinkGuideUse' },
  carve: { icon: '⌄', title: 'carveGuideTitle', desc: 'carveGuideDesc', use: 'carveGuideUse' },
  grab: { icon: '✣', title: 'grabGuideTitle', desc: 'grabGuideDesc', use: 'grabGuideUse' },
  smooth: { icon: '≈', title: 'smoothGuideTitle', desc: 'smoothGuideDesc', use: 'smoothGuideUse' },
  paint: { icon: '●', title: 'paintGuideTitle', desc: 'paintGuideDesc', use: 'paintGuideUse' },
  erase: { icon: '⌫', title: 'eraseGuideTitle', desc: 'eraseGuideDesc', use: 'eraseGuideUse' }
};

function updateToolGuide() {
  const guide = toolGuideData[activeTool];
  if (!guide || !$('#tool-guide-title')) return;
  $('#tool-guide-icon').textContent = guide.icon;
  $('#tool-guide-title').textContent = t(guide.title);
  $('#tool-guide-desc').textContent = t(guide.desc);
  $('#tool-guide-use').textContent = t(guide.use);
}

function getInteractionMode() {
  return temporaryCameraMode || cameraMode;
}

function updateInteractionMode() {
  const mode = getInteractionMode();
  viewport.dataset.interaction = mode;
  document.querySelectorAll('[data-camera-tool]').forEach((button) => button.classList.toggle('active', button.dataset.cameraTool === mode));
  const hintKey = mode === 'pan' ? 'panHint' : mode === 'orbit' ? 'orbitHint' : 'dragHint';
  const hint = $('#interaction-hint');
  if (hint) {
    hint.dataset.i18n = hintKey;
    hint.textContent = t(hintKey);
  }
  if (!controls) return;
  controls.enabled = !strokeActive;
  controls.enablePan = mode === 'pan';
  // The right mouse button is always reserved for orbiting, including while
  // the left button remains in sculpt mode.
  controls.enableRotate = true;
  // OrbitControls swaps rotate and pan whenever Shift is held. Mapping the
  // temporary Shift mode to PAN makes its internal modifier swap land on ROTATE.
  const shiftOrbit = mode === 'orbit' && temporaryCameraMode === 'orbit';
  controls.mouseButtons.LEFT = mode === 'pan' || shiftOrbit ? THREE.MOUSE.PAN : mode === 'orbit' ? THREE.MOUSE.ROTATE : null;
  controls.mouseButtons.RIGHT = THREE.MOUSE.ROTATE;
  controls.touches.ONE = mode === 'pan' ? THREE.TOUCH.PAN : mode === 'orbit' ? THREE.TOUCH.ROTATE : null;
}

function selectCameraMode(mode) {
  cameraMode = mode;
  temporaryCameraMode = null;
  updateInteractionMode();
  scheduleSessionSave();
}

function selectTool(tool) {
  activeTool = tool;
  document.querySelectorAll('[data-tool]').forEach((button) => button.classList.toggle('active', button.dataset.tool === tool));
  updateToolLabel();
  updateToolGuide();
  selectCameraMode('sculpt');
  scheduleSessionSave();
}

function setCameraView(view) {
  const positions = { front: [0, .12, 4.7], top: [0, 4.7, .01], iso: [3.7, 2.8, 4.4] };
  const [x, y, z] = positions[view];
  camera.position.set(x, y, z);
  controls.target.set(0, 0, 0);
  controls.update();
  document.querySelectorAll('[data-view]').forEach((button) => button.classList.toggle('active', button.dataset.view === view));
}

function nudgeCamera(horizontal, vertical) {
  const offset = camera.position.clone().sub(controls.target);
  const spherical = new THREE.Spherical().setFromVector3(offset);
  spherical.theta += horizontal;
  spherical.phi = THREE.MathUtils.clamp(spherical.phi + vertical, .18, Math.PI - .18);
  camera.position.setFromSpherical(spherical).add(controls.target);
  camera.lookAt(controls.target);
  scheduleSessionSave();
}

function updateSceneTheme() {
  const isLight = document.documentElement.dataset.theme === 'light';
  scene.background = new THREE.Color(isLight ? 0xd9e7e8 : 0x081d27);
  gridHelper.material.opacity = isLight ? .62 : .82;
  gridHelper.material.transparent = true;
  if (floorPlane) {
    floorPlane.material.color.set(isLight ? 0xc5d4d5 : 0x07151d);
    floorPlane.material.opacity = isLight ? .3 : .42;
  }
}

function snapshotRecord() {
  return captureSnapshot();
}

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, { keyPath: 'id' });
      if (!request.result.objectStoreNames.contains(SESSION_STORE)) request.result.createObjectStore(SESSION_STORE, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

function currentSessionRecord() {
  return {
    id: 'current',
    version: 1,
    updatedAt: Date.now(),
    projectId,
    name: $('#project-name').value || mesh?.name || 'Untitled form',
    primitive,
    detail,
    mesh: snapshotRecord(),
    activeTool,
    cameraMode,
    settings: {
      density: Number($('#density').value),
      radius: Number($('#radius').value),
      strength: Number($('#strength').value),
      paintColor: $('#paint-color').value,
      symmetry: $('#symmetry').checked,
      wireframe: $('#wireframe').checked,
      showGrid: $('#show-grid').checked
    },
    camera: {
      position: camera.position.toArray(),
      target: controls.target.toArray()
    }
  };
}

async function persistCurrentSession() {
  if (!sessionReady || !mesh) return;
  try {
    const db = await openDb();
    const record = currentSessionRecord();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(SESSION_STORE, 'readwrite');
      tx.objectStore(SESSION_STORE).put(record);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  } catch (error) {
    console.error('Could not persist the current sculpt session', error);
  }
}

function scheduleSessionSave(delay = 250) {
  if (!sessionReady) return;
  clearTimeout(sessionSaveTimer);
  sessionSaveTimer = setTimeout(persistCurrentSession, delay);
}

function restoreSetting(id, value) {
  const input = $(`#${id}`);
  if (!input || value === undefined) return;
  if (input.type === 'checkbox') input.checked = Boolean(value);
  else input.value = value;
}

async function restoreCurrentSession() {
  let restored = false;
  try {
    const db = await openDb();
    const record = await new Promise((resolve, reject) => {
      const tx = db.transaction(SESSION_STORE, 'readonly');
      const request = tx.objectStore(SESSION_STORE).get('current');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    if (!record?.mesh?.positions?.length) return;

    primitive = record.primitive || 'sphere';
    detail = Number(record.detail || 3);
    let geometry;
    let applyStoredPositions = false;
    if (primitive === 'sphere' || primitive === 'box') {
      const result = geometryFromSnapshot(primitive, detail, record.mesh);
      geometry = result.geometry;
      detail = result.level;
      applyStoredPositions = result.applySnapshotAfter;
    } else {
      geometry = geometryFromRawSnapshot(record.mesh);
    }
    if (!geometry) return;

    replaceGeometry(geometry, record.name || 'Untitled form', primitive, false);
    if (applyStoredPositions) applySnapshot(record.mesh);
    projectId = record.projectId || crypto.randomUUID();
    $('#project-name').value = record.name || mesh.name;

    const settings = record.settings || {};
    restoreSetting('density', settings.density ?? detail);
    restoreSetting('radius', settings.radius);
    restoreSetting('strength', settings.strength);
    restoreSetting('paint-color', settings.paintColor);
    restoreSetting('symmetry', settings.symmetry);
    restoreSetting('wireframe', settings.wireframe);
    restoreSetting('show-grid', settings.showGrid);
    $('#density-value').textContent = `${$('#density').value} / 5`;
    $('#radius-value').textContent = Number($('#radius').value).toFixed(2);
    $('#strength-value').textContent = `${Math.round(Number($('#strength').value) * 100)}%`;
    $('#paint-color-value').textContent = $('#paint-color').value.toUpperCase();
    material.wireframe = $('#wireframe').checked;
    gridHelper.visible = $('#show-grid').checked;

    if (record.camera?.position?.length === 3) camera.position.fromArray(record.camera.position);
    if (record.camera?.target?.length === 3) controls.target.fromArray(record.camera.target);
    controls.update();

    const availableTool = toolGuideData[record.activeTool] ? record.activeTool : 'clay';
    selectTool(availableTool);
    cameraMode = ['sculpt', 'pan', 'orbit'].includes(record.cameraMode) ? record.cameraMode : 'sculpt';
    temporaryCameraMode = null;
    updateInteractionMode();
    history = [captureSnapshot()];
    historyIndex = 0;
    updatePrimitiveButtons();
    updateStats();
    updateHistoryButtons();
    updateObjectLabel();
    restored = true;
  } catch (error) {
    console.error('Could not restore the current sculpt session', error);
  } finally {
    sessionReady = true;
    scheduleSessionSave();
    if (restored) showToast(t('sessionRestored'));
  }
}

async function saveProject(silent = false) {
  try {
    setSaveState('saving');
    const db = await openDb();
    const name = $('#project-name').value.trim() || 'Untitled form';
    const record = { id: projectId, name, primitive, detail, mesh: snapshotRecord(), updatedAt: Date.now() };
    await new Promise((resolve, reject) => { const tx = db.transaction(STORE, 'readwrite'); tx.objectStore(STORE).put(record); tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); });
    mesh.name = name;
    updateObjectLabel();
    setSaveState('saved');
    await renderProjects();
    scheduleSessionSave();
    if (!silent) showToast(t('sculptSaved'));
  } catch (error) {
    console.error(error);
    setSaveState('error');
    if (!silent) showToast(t('dbError'));
  }
}

async function renderProjects() {
  const list = $('#project-list');
  try {
    const db = await openDb();
    const records = await new Promise((resolve, reject) => { const tx = db.transaction(STORE, 'readonly'); const req = tx.objectStore(STORE).getAll(); req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });
    records.sort((a, b) => b.updatedAt - a.updatedAt);
    if (!records.length) { list.innerHTML = `<div class="empty-state">${t('noProjects')}</div>`; return; }
    list.innerHTML = records.map((record) => `<div class="project-row"><button class="project-load" type="button" data-load-id="${record.id}"><strong>${escapeHtml(record.name)}</strong><small>${new Date(record.updatedAt).toLocaleDateString()}</small></button><button class="project-delete" type="button" data-delete-id="${record.id}" aria-label="${escapeHtml(t('delete'))}">×</button></div>`).join('');
  } catch (error) { list.innerHTML = `<div class="empty-state">${t('dbError')}</div>`; }
}

function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char])); }

async function loadProject(id) {
  try {
    const db = await openDb();
    const record = await new Promise((resolve, reject) => { const tx = db.transaction(STORE, 'readonly'); const req = tx.objectStore(STORE).get(id); req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });
    if (!record) return;
    primitive = record.primitive || 'sphere'; detail = Number(record.detail || 3);
    const restored = primitive === 'sphere' || primitive === 'box' ? geometryFromSnapshot(primitive, detail, record.mesh) : null;
    const geometry = restored ? restored.geometry : geometryFromRawSnapshot(record.mesh);
    if (!geometry) return;
    if (restored) detail = restored.level;
    ensureColors(geometry);
    disposeMesh(); material = createMaterial(); mesh = new THREE.Mesh(geometry, material); mesh.name = record.name; mesh.userData.kind = primitive; configureMesh(mesh); scene.add(mesh);
    if (restored?.applySnapshotAfter) applySnapshot(record.mesh);
    buildNeighbours(); history = [captureSnapshot()]; historyIndex = 0; projectId = record.id; $('#project-name').value = record.name;
    updatePrimitiveButtons(); updateStats(); updateHistoryButtons(); setSaveState('saved'); showToast(t('loaded')); scheduleSessionSave();
  } catch (error) { showToast(t('dbError')); }
}

async function deleteProject(id) {
  if (!window.confirm(t('confirmDelete'))) return;
  const db = await openDb();
  await new Promise((resolve, reject) => { const tx = db.transaction(STORE, 'readwrite'); tx.objectStore(STORE).delete(id); tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); });
  await renderProjects(); showToast(t('deleted'));
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportGlb() {
  const exporter = new GLTFExporter();
  const exportScene = new THREE.Scene();
  const clone = mesh.clone(); clone.geometry = mesh.geometry.clone(); clone.material = mesh.material.clone();
  exportScene.add(clone);
  exporter.parse(exportScene, (result) => { const blob = new Blob([result], { type: 'model/gltf-binary' }); downloadBlob(blob, `${slugify($('#project-name').value || 'sculpt')}.glb`); showToast(t('exportDone')); }, (error) => { console.error(error); showToast(t('invalidFile')); }, { binary: true, onlyVisible: true });
}

function slugify(value) { return String(value).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'sculpt'; }

function exportJson() {
  const payload = { version: 1, name: $('#project-name').value || 'Untitled form', primitive, detail, mesh: snapshotRecord() };
  downloadBlob(new Blob([JSON.stringify(payload)], { type: 'application/json' }), `${slugify(payload.name)}.json`); showToast(t('jsonExportDone'));
}

function importJson(text) {
  const payload = JSON.parse(text);
  const data = payload.mesh || payload;
  if (!data.positions?.length) throw new Error('Missing positions');
  primitive = payload.primitive || 'sphere'; detail = Number(payload.detail || 3);
  if (primitive === 'sphere' || primitive === 'box') {
    const restored = geometryFromSnapshot(primitive, detail, data);
    detail = restored.level;
    replaceGeometry(restored.geometry, payload.name || 'Imported form', primitive, false);
    if (restored.applySnapshotAfter) applySnapshot(data);
  } else {
    const imported = new THREE.BufferGeometry();
    imported.setAttribute('position', new THREE.Float32BufferAttribute(data.positions, 3));
    if (data.colors?.length) imported.setAttribute('color', new THREE.Float32BufferAttribute(data.colors, 3));
    if (data.indices?.length) imported.setIndex(data.indices);
    imported.computeVertexNormals();
    replaceGeometry(imported, payload.name || 'Imported form', 'imported');
  }
  projectId = crypto.randomUUID(); $('#project-name').value = payload.name || 'Imported form'; history = [captureSnapshot()]; historyIndex = 0; updateStats(); updatePrimitiveButtons(); updateHistoryButtons(); showToast(t('jsonImported')); setSaveState('ready'); scheduleSessionSave();
}

function replaceGeometry(geometry, name, kind, weld = true) {
  let prepared = geometry;
  if (weld) {
    prepared = weldGeometry(geometry);
    geometry.dispose();
  }
  ensureColors(prepared); disposeMesh(); material = createMaterial(); mesh = new THREE.Mesh(prepared, material); mesh.name = name; mesh.userData.kind = kind; configureMesh(mesh); scene.add(mesh); buildNeighbours();
}

function addImportedColors(geometry, sourceMaterial) {
  const position = geometry.attributes.position;
  if (!position || geometry.attributes.color?.count === position.count) return;

  const materials = Array.isArray(sourceMaterial) ? sourceMaterial : [sourceMaterial];
  const colors = new Float32Array(position.count * 3);
  const fallback = new THREE.Color(DEFAULT_COLOR);
  const assigned = new Uint8Array(position.count);
  const index = geometry.index;
  const groups = geometry.groups.length
    ? geometry.groups
    : [{ start: 0, count: index ? index.count : position.count, materialIndex: 0 }];

  groups.forEach((group) => {
    const color = materials[group.materialIndex]?.color || materials[0]?.color || fallback;
    const end = Math.min(group.start + group.count, index ? index.count : position.count);
    for (let cursor = group.start; cursor < end; cursor++) {
      const vertex = index ? index.getX(cursor) : cursor;
      color.toArray(colors, vertex * 3);
      assigned[vertex] = 1;
    }
  });

  for (let vertex = 0; vertex < position.count; vertex++) {
    if (!assigned[vertex]) fallback.toArray(colors, vertex * 3);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
}

function prepareImportedPart(sourceMesh, worldMatrix) {
  const geometry = sourceMesh.geometry.clone();
  geometry.applyMatrix4(worldMatrix);
  addImportedColors(geometry, sourceMesh.material);
  const prepared = weldGeometry(geometry);
  geometry.dispose();

  if (worldMatrix.determinant() < 0) {
    const index = prepared.index;
    for (let i = 0; i < index.count; i += 3) {
      const second = index.getX(i + 1);
      index.setX(i + 1, index.getX(i + 2));
      index.setX(i + 2, second);
    }
    index.needsUpdate = true;
    prepared.computeVertexNormals();
  }
  return prepared;
}

function importGlb(buffer, filename) {
  const loader = new GLTFLoader();
  loader.parse(buffer, '', (gltf) => {
    gltf.scene.updateMatrixWorld(true);
    const parts = [];
    const instanceMatrix = new THREE.Matrix4();
    const worldMatrix = new THREE.Matrix4();

    gltf.scene.traverse((node) => {
      if (!node.isMesh || !node.geometry?.attributes?.position) return;
      if (node.isInstancedMesh) {
        for (let i = 0; i < node.count; i++) {
          node.getMatrixAt(i, instanceMatrix);
          worldMatrix.multiplyMatrices(node.matrixWorld, instanceMatrix);
          parts.push(prepareImportedPart(node, worldMatrix));
        }
      } else {
        parts.push(prepareImportedPart(node, node.matrixWorld));
      }
    });

    if (!parts.length) { showToast(t('invalidFile')); return; }
    const geometry = parts.length === 1 ? parts[0] : mergeGeometries(parts, false);
    if (parts.length > 1) parts.forEach((part) => part.dispose());
    if (!geometry) { showToast(t('invalidFile')); return; }
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    replaceGeometry(geometry, filename.replace(/\.[^.]+$/, ''), 'imported', false);
    primitive = 'imported'; detail = 3; projectId = crypto.randomUUID(); $('#project-name').value = mesh.name; history = [captureSnapshot()]; historyIndex = 0; updateStats(); updatePrimitiveButtons(); updateHistoryButtons(); setSaveState('ready'); scheduleSessionSave();
    showToast(parts.length > 1 ? t('partsImported').replace('{count}', parts.length) : t('imported'));
  }, (error) => { console.error(error); showToast(t('invalidFile')); });
}

function handleFile(file) {
  if (!file) return;
  const reader = new FileReader();
  if (file.name.toLowerCase().endsWith('.json')) { reader.onload = () => { try { importJson(reader.result); } catch (error) { console.error(error); showToast(t('invalidFile')); } }; reader.readAsText(file); }
  else { reader.onload = () => importGlb(reader.result, file.name); reader.readAsArrayBuffer(file); }
}

function scheduleSavedState() {
  if (setSaveState.timer) clearTimeout(setSaveState.timer);
  setSaveState.timer = setTimeout(() => { if (projectId && historyIndex > 0) setSaveState('ready'); }, 500);
}

function bindEvents() {
  document.querySelectorAll('[data-lang]').forEach((button) => button.addEventListener('click', () => setLanguage(button.dataset.lang)));
  $('#theme-toggle').addEventListener('click', () => { const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light'; document.documentElement.dataset.theme = next; localStorage.setItem('sculpt-lab-theme', next); updateSceneTheme(); });
  document.querySelectorAll('[data-tool]').forEach((button) => button.addEventListener('click', () => selectTool(button.dataset.tool)));
  document.querySelectorAll('[data-primitive]').forEach((button) => button.addEventListener('click', () => createMesh(button.dataset.primitive, detail)));
  $('#new-mesh').addEventListener('click', () => createMesh(primitive, Number($('#density').value)));
  $('#density').addEventListener('input', (event) => { detail = Number(event.target.value); $('#density-value').textContent = `${detail} / 5`; scheduleSessionSave(); });
  $('#radius').addEventListener('input', (event) => { $('#radius-value').textContent = Number(event.target.value).toFixed(2); scheduleSessionSave(); });
  $('#strength').addEventListener('input', (event) => { $('#strength-value').textContent = `${Math.round(Number(event.target.value) * 100)}%`; scheduleSessionSave(); });
  $('#paint-color').addEventListener('input', (event) => { $('#paint-color-value').textContent = event.target.value.toUpperCase(); scheduleSessionSave(); });
  $('#symmetry').addEventListener('change', scheduleSessionSave);
  $('#wireframe').addEventListener('change', (event) => { if (material) material.wireframe = event.target.checked; scheduleSessionSave(); });
  $('#show-grid').addEventListener('change', (event) => { gridHelper.visible = event.target.checked; scheduleSessionSave(); });
  $('#reduce-vertices').addEventListener('click', reduceVertices);
  $('#refine-vertices').addEventListener('click', refineStretchedAreas);
  $('#project-name').addEventListener('input', () => { updateObjectLabel(); scheduleSessionSave(); });
  $('#save-project').addEventListener('click', () => saveProject());
  $('#export-glb').addEventListener('click', exportGlb);
  $('#export-json').addEventListener('click', exportJson);
  $('#import-file').addEventListener('click', () => { $('#file-input').value = ''; $('#file-input').click(); });
  $('#import-json').addEventListener('click', () => { $('#file-input').value = ''; $('#file-input').click(); });
  $('#file-input').addEventListener('change', (event) => handleFile(event.target.files[0]));
  $('#refresh-projects').addEventListener('click', renderProjects);
  $('#project-list').addEventListener('click', (event) => { const load = event.target.closest('[data-load-id]'); const del = event.target.closest('[data-delete-id]'); if (load) loadProject(load.dataset.loadId); if (del) deleteProject(del.dataset.deleteId); });
  $('#undo').addEventListener('click', () => { if (historyIndex <= 0) return showToast(t('noUndo')); historyIndex -= 1; applySnapshot(history[historyIndex]); updateHistoryButtons(); scheduleSessionSave(); });
  $('#redo').addEventListener('click', () => { if (historyIndex >= history.length - 1) return showToast(t('noRedo')); historyIndex += 1; applySnapshot(history[historyIndex]); updateHistoryButtons(); scheduleSessionSave(); });
  document.querySelectorAll('[data-view]').forEach((button) => button.addEventListener('click', () => setCameraView(button.dataset.view)));
  document.querySelectorAll('[data-camera-tool]').forEach((button) => button.addEventListener('click', () => selectCameraMode(button.dataset.cameraTool)));
  $('#reset-view').addEventListener('click', () => setCameraView('iso'));
  window.addEventListener('keydown', (event) => {
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') { event.preventDefault(); saveProject(); } return; }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') { event.preventDefault(); saveProject(); return; }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); (event.shiftKey ? $('#redo') : $('#undo')).click(); return; }
    if (!event.repeat && event.code === 'Space') { event.preventDefault(); temporaryCameraMode = 'pan'; updateInteractionMode(); return; }
    if (!event.repeat && event.key === 'Shift') { event.preventDefault(); temporaryCameraMode = 'orbit'; updateInteractionMode(); return; }
    if (event.key.toLowerCase() === 'b') { selectCameraMode('sculpt'); return; }
    const toolKeys = { '1': 'clay', '2': 'inflate', '3': 'grab', '4': 'smooth', '5': 'paint', '6': 'sink', '7': 'carve', e: 'erase' };
    if (toolKeys[event.key.toLowerCase()]) { selectTool(toolKeys[event.key.toLowerCase()]); return; }
    if (event.key.toLowerCase() === 'x') { $('#symmetry').checked = !$('#symmetry').checked; scheduleSessionSave(); return; }
    if (event.key === '[' || event.key === ']') { const input = $('#radius'); input.value = THREE.MathUtils.clamp(Number(input.value) + (event.key === ']' ? .03 : -.03), .05, .85).toFixed(2); input.dispatchEvent(new Event('input')); return; }
    const cameraKeys = { a: [-.065, 0], d: [.065, 0], w: [0, -.065], s: [0, .065], ArrowLeft: [-.065, 0], ArrowRight: [.065, 0], ArrowUp: [0, -.065], ArrowDown: [0, .065] };
    if (cameraKeys[event.key]) { event.preventDefault(); nudgeCamera(...cameraKeys[event.key]); }
  });
  window.addEventListener('keyup', (event) => {
    if ((event.code === 'Space' && temporaryCameraMode === 'pan') || (event.key === 'Shift' && temporaryCameraMode === 'orbit')) {
      temporaryCameraMode = null;
      updateInteractionMode();
    }
  });
  window.addEventListener('blur', () => { temporaryCameraMode = null; updateInteractionMode(); });
}

function animate() {
  animationFrame = requestAnimationFrame(animate);
  controls?.update();
  renderer?.render(scene, camera);
}

document.documentElement.dataset.theme = localStorage.getItem('sculpt-lab-theme') || 'dark';
setLanguage(lang);
bindEvents();
init3D();
buildNeighbours();
updateHistoryButtons();
updateSceneTheme();
renderProjects();
restoreCurrentSession();
