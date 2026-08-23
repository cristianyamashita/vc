(() => {
  'use strict';

  const DB_NAME = 'ServiceTycoonDB';
  const DB_VERSION = 1;
  const SAVE_INTERVAL = 5000;
  const MAX_FLOOR_AXIS = 8;
  const ICON_GROUPS = [
    { key: 'people', icons: '👤 👥 🧑 👨 👩 🧒 👦 👧 👶 👵 👴 🧓 👨‍🏫 👩‍🏫 🧑‍🏫 👨‍🎓 👩‍🎓 🧑‍🎓 👨‍💼 👩‍💼 🧑‍💼 👨‍⚕️ 👩‍⚕️ 🧑‍⚕️ 👨‍🍳 👩‍🍳 🧑‍🍳 👨‍🔧 👩‍🔧 🧑‍🔧 👨‍💻 👩‍💻 🧑‍💻 👨‍🎨 👩‍🎨 🧑‍🎨 👮 👷 💂 🕵️ 🤵 👰 🥷 🧙 🦸 🦹 🤖 👽'.split(/\s+/), tags: 'people person staff customer student teacher worker guest pessoas pessoa equipe cliente aluno professor hóspede 人 人物 スタッフ 顧客 生徒 先生' },
    { key: 'education', icons: '📚 📖 📕 📗 📘 📙 📓 📔 📒 📑 🔖 🏫 🎓 ✏️ ✒️ 🖊️ 🖋️ 📝 📐 📏 🧮 🔬 🔭 🧪 🧫 🧬 💡 🧠 🗣️ 👁️ 🎨 🖌️ 🖍️ 🎵 🎼 🧩 ♟️ 🏆 🥇 📊 📈 💻 🖥️ ⌨️ 🖨️'.split(/\s+/), tags: 'education school class study book learning ensino escola aula estudo livro educação 学校 教室 勉強 本 教育' },
    { key: 'business', icons: '💼 🗂️ 📁 📂 🗄️ 📋 📌 📍 📎 🖇️ ✂️ 📅 📆 🗓️ ⏰ ⌚ 📞 ☎️ 📱 📟 📠 📧 ✉️ 📨 📤 📥 📦 🧾 💳 💵 💴 💶 💷 🪙 💰 🏦 ⚖️ 🔐 🔑 🛎️ 🔔 📢 📣 ✅ ☑️ 🤝'.split(/\s+/), tags: 'business office service money payment work empresa escritório serviço dinheiro pagamento trabalho ビジネス 会社 サービス お金 仕事' },
    { key: 'places', icons: '🏠 🏡 🏢 🏣 🏤 🏥 🏦 🏨 🏪 🏫 🏬 🏭 🏯 🏰 💒 ⛪ 🕌 🛕 🕍 ⛩️ 🗼 🗽 🚪 🪟 🛏️ 🛋️ 🪑 🚿 🛁 🚽 🛗 🧱 🪵 🪨 ⛺ 🏕️ 🌆 🌇 🌃 🏙️ 🏘️ 🏚️ 🏗️ 🛖 🏛️ 🎪 🏟️ 🏖️ 🏝️'.split(/\s+/), tags: 'places room building hotel door chair house lugares sala prédio hotel porta cadeira 場所 部屋 建物 ホテル ドア 椅子' },
    { key: 'food', icons: '🍽️ 🍴 🥄 🔪 🥣 🥡 🥢 ☕ 🍵 🫖 🧋 🥤 🍶 🍺 🍷 🥂 🍹 🧊 🍎 🍊 🍋 🍌 🍉 🍇 🍓 🫐 🍒 🍑 🥭 🍍 🥝 🍅 🥑 🥦 🥬 🥕 🌽 🍞 🥐 🥖 🧀 🥚 🍳 🥞 🧇 🍔 🍟 🍕 🌭 🥪 🌮 🌯 🍜 🍝 🍣 🍱 🍛 🍲 🍰 🎂 🍪 🍩 🍫'.split(/\s+/), tags: 'food restaurant meal kitchen drink comida restaurante refeição cozinha bebida 食べ物 レストラン 食事 厨房 飲み物' },
    { key: 'transport', icons: '🚶 🧍 🏃 🚲 🛴 🛵 🏍️ 🚗 🚕 🚙 🚌 🚎 🚐 🚑 🚒 🚓 🚚 🚛 🚜 🦽 🛺 🚃 🚋 🚞 🚝 🚄 🚅 🚆 🚇 🚈 🚉 ✈️ 🛫 🛬 🚁 🚀 🛸 🚢 ⛴️ 🚤 🛥️ ⚓ 🚏 🚦 🗺️ 🧭'.split(/\s+/), tags: 'transport travel elevator movement vehicle transporte viagem elevador movimento veículo 交通 旅行 エレベーター 移動 車両' },
    { key: 'objects', icons: '💡 🔦 🕯️ 🧯 🔌 🔋 🪫 ⚙️ 🔧 🔨 🛠️ ⛏️ 🪚 🪛 🧰 🧲 🪜 🧹 🧺 🧻 🪣 🧼 🧽 🧴 🪥 🪞 🛒 🎁 🎈 🎀 🧸 🪆 🖼️ 🪴 🌱 🌿 🌳 🌵 🌸 🌼 🪻 🐶 🐱 🐭 🐰 🦊 🐻 🐼 🐸 🐵 🦁 🐯 🐮 🐷 🐔 🐧 🦉 🦋 🐝 🐟'.split(/\s+/), tags: 'objects equipment tools decoration animals objetos equipamento ferramentas decoração animais 物 設備 道具 装飾 動物' },
    { key: 'symbols', icons: '● ○ ◉ ◎ ◌ ◍ ◐ ◑ ◒ ◓ ■ □ ▪ ▫ ▰ ▱ ▲ △ ▶ ▷ ▼ ▽ ◆ ◇ ◈ ★ ☆ ✦ ✧ ✪ ✿ ❖ ❯ ➜ ➤ ➕ ➖ ✕ ✓ ✔ ✚ ✜ ✎ ✐ ☀ ☁ ☂ ☾ ♨ ♫ ♪ ♬ ⚡ 🔥 💧 ❄️ 🌈 🌟 💫 ✨ ❤️ 🧡 💛 💚 💙 💜 🤍 🖤 ⚪ ⚫ 🟢 🔵 🟣 🟠 🟡 🔴'.split(/\s+/), tags: 'symbols shapes status color icon símbolos formas status cor ícone 記号 図形 状態 色 アイコン' }
  ];
  const HEAD_SHAPES = ['circle', 'oval', 'square', 'diamond', 'hex'];
  const BODY_SHAPES = ['rounded', 'square', 'tall', 'wide', 'triangle', 'capsule'];
  const HAIR_SHAPES = ['none', 'short', 'spike', 'side', 'bob', 'long', 'bun', 'pony', 'curly'];
  const HAIR_ALIASES = { bowl: 'bob' };
  const HAIR_SWATCHES = ['#1c1c1c', '#3d2314', '#6b3f1f', '#8d5524', '#c68642', '#e8c56b', '#f4e3c1', '#c0392b', '#7a3e9d', '#4a5568', '#d0d5dd'];
  const MAX_LOOKS = 12;
  const SKIN_SWATCHES = ['#f8d5b8', '#f1c6a5', '#e8b896', '#d4a574', '#c68642', '#8d5524', '#6b3f1f'];
  const CLOTHES_SWATCHES = ['#a7ef5b', '#44d7c2', '#7ec8ff', '#ffb25f', '#f3d675', '#ff8fab', '#c6a7ff', '#9ae6b4', '#ff6e78', '#e8e8e8', '#2b3a42', '#d4af37'];
  const THEME_DEFAULTS = {
    dark: { background: '#071a23', roomFill: '#0b222c' },
    light: { background: '#dce6e5', roomFill: '#f7fbfa' }
  };
  const STAGE_SWATCHES = ['#071a23', '#140e08', '#120e1a', '#0b1c14', '#dce6e5', '#f4efe6', '#e8eef8', '#efe8f4'];
  const ROOM_FILL_SWATCHES = ['#0b222c', '#24180e', '#1c1628', '#123024', '#f7fbfa', '#fff8ee', '#f4f7fc', '#fbf4f8'];
  const ROOM_COLOR_SWATCHES = ['#44d7c2', '#a7ef5b', '#7ec8ff', '#ffb25f', '#c6a7ff', '#ff8fab', '#f3d675', '#9ae6b4'];
  const MAX_FURNITURE = 12;
  const MAX_STATIONS = 6;
  const FURNITURE_KINDS = ['chair', 'table', 'desk', 'bed', 'whiteboard', 'cabinet', 'window', 'toilet', 'bath', 'plant'];
  const FURNITURE_META = {
    chair: { w: 14, h: 26, y: 90, color: '#d4a574' },
    table: { w: 28, h: 18, y: 90, color: '#c68642' },
    desk: { w: 22, h: 22, y: 90, color: '#8d6e4a' },
    bed: { w: 38, h: 24, y: 90, color: '#9ec9ff' },
    whiteboard: { w: 22, h: 34, y: 62, color: '#e8e8e8' },
    cabinet: { w: 16, h: 38, y: 90, color: '#6b4f32' },
    window: { w: 20, h: 28, y: 42, color: '#8ec8e8' },
    toilet: { w: 12, h: 22, y: 90, color: '#e8e8e8' },
    bath: { w: 18, h: 36, y: 90, color: '#a8d4e8' },
    plant: { w: 10, h: 22, y: 90, color: '#6db82a' }
  };
  const FURNITURE_PARTS = {
    chair: '<i class="f-back"></i><i class="f-seat"></i><i class="f-leg l"></i><i class="f-leg r"></i>',
    table: '<i class="f-top"></i><i class="f-leg l"></i><i class="f-leg r"></i>',
    desk: '<i class="f-top"></i><i class="f-body"></i><i class="f-leg l"></i><i class="f-leg r"></i>',
    bed: '<i class="f-head"></i><i class="f-base"></i><i class="f-matt"></i><i class="f-pillow"></i>',
    whiteboard: '<i class="f-board"></i><i class="f-tray"></i>',
    cabinet: '<i class="f-body"></i><i class="f-leg l"></i><i class="f-leg r"></i>',
    window: '<i class="f-pane"></i><i class="f-sill"></i>',
    toilet: '<i class="f-tank"></i><i class="f-bowl"></i>',
    bath: '<i class="f-stall"></i><i class="f-curtain"></i>',
    plant: '<i class="f-leaf a"></i><i class="f-leaf b"></i><i class="f-leaf c"></i><i class="f-pot"></i>'
  };

  function makeLook(id, skin, body, head, bodyShape, icon, hair = 'short', hairColor = '#3d2314') {
    return { id, skin, body, head, bodyShape, icon, hair, hairColor };
  }

  function makeFurn(id, kind, x, y, extra = {}) {
    const meta = FURNITURE_META[kind] || FURNITURE_META.chair;
    return { id, kind, x, y, w: extra.w || meta.w, h: extra.h || meta.h, flip: !!extra.flip, color: extra.color || meta.color };
  }

  function makeSpot(id, role, x, y, minShare, maxShare) {
    return { id, role, x, y, minShare, maxShare };
  }

  const I18N = {
    en: {
      managementGame: 'MANAGEMENT GAME', cash: 'Cash', earned: 'Earned', staff: '{staffPlural}', served: '{customerPlural} served', waiting: 'Waiting',
      gameStats: 'Game statistics', language: 'Language', themeToggle: 'Theme', gameControls: 'Game controls', pause: 'Pause', floorPlan: 'Floor plan', close: 'Close',
      scenarioStudio: 'Scenario studio', hireStaff: 'Hire {staff}', openRoom: 'Open {room}', trainStaff: 'Train team', saved: 'Saved', saving: 'Saving…', floor: 'FLOOR', open: 'OPEN',
      addWaitingChairs: 'Add waiting chairs', addLoungeChairs: 'Add lounge chairs', chairsAdded: '{count} chairs added', maximum: 'MAX',
      addElevator: 'Add elevator', upgradeElevator: 'Faster elevators', elevatorAdded: 'Elevator added', elevatorUpgraded: 'Elevators upgraded to level {level}', elevators: 'ELEVATORS',
      elevator: 'ELEVATOR', waitingRoom: 'WAITING ROOM', staffLounge: '{staff} LOUNGE', selectedRoom: 'SELECTED {room}', roomLevel: '{room} level', equipment: 'Equipment', revenue: 'Revenue', manageFloor: 'Floor upgrades', floorUpgradeHint: 'Upgrade several rooms without leaving this panel.', openRooms: 'Open rooms', notOpened: 'Not opened', upgradeAllRooms: 'Upgrade all rooms + equipment', allRoomsUpgraded: 'All rooms and equipment upgraded',
      upgradeRoom: 'Upgrade {room}', upgradeEquipment: 'Upgrade equipment', customizeEverything: 'CUSTOMIZE EVERYTHING', yourScenarios: 'Your scenarios', newScenario: 'New', importJson: 'Import JSON', exportJson: 'Export JSON',
      quickEdit: 'Quick edit', documentation: 'Documentation ↗', scenarioName: 'Scenario name', appearance: 'Appearance', appearanceHint: 'Theme changes the interface and text colors. {room} colors stay independent.', interfaceTheme: 'Interface theme', themeDark: 'Dark', themeLight: 'Light', screenBackground: 'Screen background', roomFill: '{room} fill', roomAccent: '{room} accent', currencySymbol: 'Currency symbol', scenarioIcon: 'Scenario icon', customerIcon: 'Customer icon', staffIcon: 'Staff icon', roomIcon: 'Room icon', equipmentIcon: 'Equipment icon', activityIcon: 'Activity icon',
      iconGallery: 'Icon gallery', searchIcons: 'Search icons…', iconResults: '{count} icons', noIcons: 'No icons found', chooseIcon: 'Choose icon', iconPeople: 'People', iconEducation: 'Education', iconBusiness: 'Business & service', iconPlaces: 'Rooms & places', iconFood: 'Food & hospitality', iconTransport: 'Transport', iconObjects: 'Objects & equipment', iconSymbols: 'Symbols & shapes',
      minDuration: 'Min. duration (sec)', maxDuration: 'Max. duration (sec)', baseRevenue: 'Base revenue', arrivalRate: 'Arrival interval (sec)', staffPerRoom: 'Staff per service', waitingCapacity: 'Maximum waiting chairs', floorColumns: 'Rooms horizontally', floorRows: 'Rooms vertically',
      staffServicePosition: 'Staff during service', insideRoom: 'Inside room', outsideRoom: 'Outside room', restPolicy: 'Rest policy', restWhenEmpty: 'Only when queue is empty', timedBreak: 'Timed 3–5 sec break',
      restMin: 'Minimum break (sec)', restMax: 'Maximum break (sec)',
      maxElevators: 'Maximum elevators', elevatorTravelTime: 'Base elevator time (sec)',
      labels: 'Labels (EN / PT / JP)', customerSingular: 'Customer', staffSingular: 'Staff', roomSingular: 'Room', jsonHint: 'Advanced mode: edit the complete scenario. Invalid JSON cannot be saved.',
      characterEditor: 'Characters', characterEditorHint: 'Design several looks for staff and customers, including hair shape and color. New people pick a random unused type first; after every type has appeared, looks can repeat.',
      staffTypes: 'Staff types', customerTypes: 'Customer types', addType: 'Add type', duplicateType: 'Duplicate', deleteType: 'Delete',
      headShape: 'Head', bodyShape: 'Body', hairShape: 'Hair', skinColor: 'Skin', clothesColor: 'Clothes', hairColor: 'Hair color', lookIcon: 'Badge icon', keepOneType: 'Keep at least one type.', maxTypes: 'Maximum of {count} types.',
      shapeCircle: 'Circle', shapeOval: 'Oval', shapeSquare: 'Square', shapeDiamond: 'Diamond', shapeHex: 'Hexagon',
      shapeRounded: 'Rounded', shapeTall: 'Tall', shapeWide: 'Wide', shapeTriangle: 'Triangle', shapeCapsule: 'Capsule',
      hairNone: 'None', hairShort: 'Short', hairSpike: 'Spikes', hairSide: 'Side part', hairBob: 'Bob', hairLong: 'Long', hairBun: 'Bun', hairPony: 'Ponytail', hairCurly: 'Curly',
      roomEditor: 'Room', roomEditorHint: 'Side view: drag furniture and people spots. Drag the edges of a selected object to resize it. Spots are where customers and staff can stand, plus the min/max share of service time in each place.',
      furniture: 'Furniture', peopleSpots: 'People spots', addFurniture: 'Add', clickToSelect: 'Drag items in the room. Select a piece of furniture and drag its edges to resize it.',
      furnChair: 'Chair', furnTable: 'Table', furnDesk: 'Desk', furnBed: 'Bed', furnWhiteboard: 'Whiteboard', furnCabinet: 'Cabinet', furnWindow: 'Window', furnToilet: 'Toilet', furnBath: 'Bathroom', furnPlant: 'Plant',
      spotCustomer: '{customer} spot', spotStaff: '{staff} spot', spotBoth: 'Shared spot',
      spotRole: 'Who uses it', roleCustomer: '{customer}', roleStaff: '{staff}', roleBoth: 'Both',
      timeMin: 'Min. time share (%)', timeMax: 'Max. time share (%)', flipItem: 'Flip', itemColor: 'Color', itemWidth: 'Width', itemHeight: 'Height', maxFurniture: 'Maximum of {count} objects.', maxStations: 'Maximum of {count} spots.',
      resetProgress: 'Reset progress', preserveReconfigure: 'Preserve value when reconfiguring', preserveReconfigureHelp: 'Purchased rooms, upgrades and facilities return to cash. Uncheck to reset everything.', saveAndPlay: 'Save & play', empty: 'EMPTY', busy: 'BUSY', locked: 'AVAILABLE', level: 'LV.',
      notEnoughCash: 'Not enough cash', hired: '{staff} hired', roomOpened: '{room} opened', teamUpgraded: 'Team upgraded to level {level}', roomUpgraded: '{room} upgraded', equipmentUpgraded: 'Equipment upgraded',
      scenarioSaved: 'Scenario saved', assetsLiquidated: '{amount} recovered from purchased resources', scenarioImported: 'Scenario imported', invalidConfig: 'Invalid scenario configuration', resetConfirm: 'Reset all progress for this scenario?', newScenarioName: 'My new scenario',
      preset: 'Built-in example', custom: 'Custom scenario', paused: 'Paused', queueFull: 'Waiting room full', servicePaid: '+{amount}', teacher: 'teacher', student: 'student', classroom: 'classroom'
    },
    pt: {
      managementGame: 'JOGO DE GESTÃO', cash: 'Caixa', earned: 'Faturamento', staff: '{staffPlural}', served: '{customerPlural} atendidos', waiting: 'Na espera',
      gameStats: 'Estatísticas do jogo', language: 'Idioma', themeToggle: 'Tema', gameControls: 'Controles do jogo', pause: 'Pausar', floorPlan: 'Planta do andar', close: 'Fechar',
      scenarioStudio: 'Estúdio de cenários', hireStaff: 'Contratar {staff}', openRoom: 'Abrir {room}', trainStaff: 'Treinar equipe', saved: 'Salvo', saving: 'Salvando…', floor: 'ANDAR', open: 'ABERTO',
      addWaitingChairs: 'Adicionar cadeiras de espera', addLoungeChairs: 'Adicionar cadeiras de descanso', chairsAdded: '{count} cadeiras adicionadas', maximum: 'MÁX.',
      addElevator: 'Adicionar elevador', upgradeElevator: 'Elevadores mais rápidos', elevatorAdded: 'Elevador adicionado', elevatorUpgraded: 'Elevadores melhorados para o nível {level}', elevators: 'ELEVADORES',
      elevator: 'ELEVADOR', waitingRoom: 'SALA DE ESPERA', staffLounge: 'DESCANSO — {staff}', selectedRoom: '{room} SELECIONADA', roomLevel: 'Nível da {room}', equipment: 'Equipamentos', revenue: 'Receita', manageFloor: 'Melhorias do andar', floorUpgradeHint: 'Melhore várias salas sem fechar este painel.', openRooms: 'Salas abertas', notOpened: 'Não aberta', upgradeAllRooms: 'Melhorar todas as salas + equipamentos', allRoomsUpgraded: 'Todas as salas e equipamentos foram melhorados',
      upgradeRoom: 'Melhorar {room}', upgradeEquipment: 'Melhorar equipamentos', customizeEverything: 'CUSTOMIZE TUDO', yourScenarios: 'Seus cenários', newScenario: 'Novo', importJson: 'Importar JSON', exportJson: 'Exportar JSON',
      quickEdit: 'Edição rápida', documentation: 'Documentação ↗', scenarioName: 'Nome do cenário', appearance: 'Aparência', appearanceHint: 'O tema muda a interface e as cores do texto. As cores da {room} ficam independentes.', interfaceTheme: 'Tema da interface', themeDark: 'Escuro', themeLight: 'Claro', screenBackground: 'Fundo da tela', roomFill: 'Preenchimento da {room}', roomAccent: 'Destaque da {room}', currencySymbol: 'Símbolo da moeda', scenarioIcon: 'Ícone do cenário', customerIcon: 'Ícone do cliente', staffIcon: 'Ícone da equipe', roomIcon: 'Ícone da sala', equipmentIcon: 'Ícone do equipamento', activityIcon: 'Ícone da atividade',
      iconGallery: 'Galeria de ícones', searchIcons: 'Buscar ícones…', iconResults: '{count} ícones', noIcons: 'Nenhum ícone encontrado', chooseIcon: 'Selecionar ícone', iconPeople: 'Pessoas', iconEducation: 'Educação', iconBusiness: 'Negócios e serviços', iconPlaces: 'Salas e lugares', iconFood: 'Alimentação e hotelaria', iconTransport: 'Transporte', iconObjects: 'Objetos e equipamentos', iconSymbols: 'Símbolos e formas',
      minDuration: 'Duração mín. (seg)', maxDuration: 'Duração máx. (seg)', baseRevenue: 'Receita base', arrivalRate: 'Intervalo de chegada (seg)', staffPerRoom: 'Equipe por atendimento', waitingCapacity: 'Máximo de cadeiras de espera', floorColumns: 'Salas na horizontal', floorRows: 'Salas na vertical',
      staffServicePosition: 'Equipe durante o atendimento', insideRoom: 'Dentro da sala', outsideRoom: 'Fora da sala', restPolicy: 'Política de descanso', restWhenEmpty: 'Somente com fila vazia', timedBreak: 'Pausa de 3–5 segundos',
      restMin: 'Pausa mínima (seg)', restMax: 'Pausa máxima (seg)',
      maxElevators: 'Máximo de elevadores', elevatorTravelTime: 'Tempo-base do elevador (seg)',
      labels: 'Nomes (EN / PT / JP)', customerSingular: 'Cliente', staffSingular: 'Equipe', roomSingular: 'Sala', jsonHint: 'Modo avançado: edite o cenário completo. JSON inválido não pode ser salvo.',
      characterEditor: 'Personagens', characterEditorHint: 'Desenhe vários tipos para equipe e clientes, incluindo formato e cor do cabelo. Novas pessoas entram com um tipo ainda não usado; depois que todos aparecerem, os tipos podem repetir.',
      staffTypes: 'Tipos de equipe', customerTypes: 'Tipos de cliente', addType: 'Novo tipo', duplicateType: 'Duplicar', deleteType: 'Excluir',
      headShape: 'Cabeça', bodyShape: 'Corpo', hairShape: 'Cabelo', skinColor: 'Pele', clothesColor: 'Roupa', hairColor: 'Cor do cabelo', lookIcon: 'Ícone', keepOneType: 'Mantenha pelo menos um tipo.', maxTypes: 'Máximo de {count} tipos.',
      shapeCircle: 'Círculo', shapeOval: 'Oval', shapeSquare: 'Quadrado', shapeDiamond: 'Losango', shapeHex: 'Hexágono',
      shapeRounded: 'Arredondado', shapeTall: 'Alto', shapeWide: 'Largo', shapeTriangle: 'Triângulo', shapeCapsule: 'Cápsula',
      hairNone: 'Nenhum', hairShort: 'Curto', hairSpike: 'Espinhos', hairSide: 'Lateral', hairBob: 'Chanel', hairLong: 'Longo', hairBun: 'Coque', hairPony: 'Rabo de cavalo', hairCurly: 'Cacheado',
      roomEditor: 'Sala', roomEditorHint: 'Vista de lado: arraste móveis e pontos. Arraste a borda de um móvel selecionado para redimensionar. Os pontos dizem onde cliente e equipe podem ficar, e a fatia mín/máx do tempo de atendimento em cada lugar.',
      furniture: 'Móveis', peopleSpots: 'Pontos de pessoas', addFurniture: 'Adicionar', clickToSelect: 'Arraste os itens na sala. Selecione um móvel e puxe as bordas para redimensionar.',
      furnChair: 'Cadeira', furnTable: 'Mesa', furnDesk: 'Escrivaninha', furnBed: 'Cama', furnWhiteboard: 'Quadro', furnCabinet: 'Armário', furnWindow: 'Janela', furnToilet: 'Vaso', furnBath: 'Banheiro', furnPlant: 'Planta',
      spotCustomer: 'Ponto do {customer}', spotStaff: 'Ponto do {staff}', spotBoth: 'Ponto compartilhado',
      spotRole: 'Quem usa', roleCustomer: '{customer}', roleStaff: '{staff}', roleBoth: 'Os dois',
      timeMin: 'Fatia mín. do tempo (%)', timeMax: 'Fatia máx. do tempo (%)', flipItem: 'Espelhar', itemColor: 'Cor', itemWidth: 'Largura', itemHeight: 'Altura', maxFurniture: 'Máximo de {count} objetos.', maxStations: 'Máximo de {count} pontos.',
      resetProgress: 'Zerar progresso', preserveReconfigure: 'Manter valor ao reconfigurar', preserveReconfigureHelp: 'Salas, upgrades e instalações compradas voltam para o caixa. Desmarque para zerar tudo.', saveAndPlay: 'Salvar e jogar', empty: 'VAZIA', busy: 'OCUPADA', locked: 'DISPONÍVEL', level: 'NV.',
      notEnoughCash: 'Dinheiro insuficiente', hired: '{staff} contratado', roomOpened: '{room} aberta', teamUpgraded: 'Equipe melhorada para o nível {level}', roomUpgraded: '{room} melhorada', equipmentUpgraded: 'Equipamento melhorado',
      scenarioSaved: 'Cenário salvo', assetsLiquidated: '{amount} recuperados dos recursos comprados', scenarioImported: 'Cenário importado', invalidConfig: 'Configuração de cenário inválida', resetConfirm: 'Zerar todo o progresso deste cenário?', newScenarioName: 'Meu novo cenário',
      preset: 'Exemplo incluído', custom: 'Cenário personalizado', paused: 'Pausado', queueFull: 'Sala de espera lotada', servicePaid: '+{amount}', teacher: 'professor', student: 'aluno', classroom: 'sala'
    },
    ja: {
      managementGame: '経営シミュレーション', cash: '所持金', earned: '総収益', staff: '{staffPlural}', served: '対応した{customerPlural}', waiting: '待機中',
      gameStats: 'ゲーム統計', language: '言語', themeToggle: 'テーマ', gameControls: 'ゲーム操作', pause: '一時停止', floorPlan: 'フロア図', close: '閉じる',
      scenarioStudio: 'シナリオスタジオ', hireStaff: '{staff}を雇う', openRoom: '{room}を開く', trainStaff: 'スタッフ研修', saved: '保存済み', saving: '保存中…', floor: 'フロア', open: '営業中',
      addWaitingChairs: '待合椅子を追加', addLoungeChairs: 'ラウンジ椅子を追加', chairsAdded: '椅子を{count}脚追加しました', maximum: '最大',
      addElevator: 'エレベーターを追加', upgradeElevator: 'エレベーター高速化', elevatorAdded: 'エレベーターを追加しました', elevatorUpgraded: 'エレベーターがレベル{level}になりました', elevators: 'エレベーター',
      elevator: 'エレベーター', waitingRoom: '待合室', staffLounge: '{staff}ラウンジ', selectedRoom: '選択中の{room}', roomLevel: '{room}レベル', equipment: '設備', revenue: '収益', manageFloor: 'フロアアップグレード', floorUpgradeHint: 'このパネルを閉じずに複数の部屋をアップグレードできます。', openRooms: '営業中の部屋', notOpened: '未開放', upgradeAllRooms: 'すべての部屋と設備をアップグレード', allRoomsUpgraded: 'すべての部屋と設備をアップグレードしました',
      upgradeRoom: '{room}をアップグレード', upgradeEquipment: '設備をアップグレード', customizeEverything: 'すべてカスタマイズ', yourScenarios: 'シナリオ', newScenario: '新規', importJson: 'JSON読込', exportJson: 'JSON出力',
      quickEdit: '簡単編集', documentation: 'ドキュメント ↗', scenarioName: 'シナリオ名', appearance: '外観', appearanceHint: 'テーマは画面と文字色を変えます。{room}の色はテーマと別に設定できます。', interfaceTheme: 'インターフェーステーマ', themeDark: 'ダーク', themeLight: 'ライト', screenBackground: '画面の背景', roomFill: '{room}の塗り', roomAccent: '{room}のアクセント', currencySymbol: '通貨記号', scenarioIcon: 'シナリオアイコン', customerIcon: '顧客アイコン', staffIcon: 'スタッフアイコン', roomIcon: '部屋アイコン', equipmentIcon: '設備アイコン', activityIcon: '活動アイコン',
      iconGallery: 'アイコンギャラリー', searchIcons: 'アイコンを検索…', iconResults: '{count}個のアイコン', noIcons: 'アイコンが見つかりません', chooseIcon: 'アイコンを選択', iconPeople: '人物', iconEducation: '教育', iconBusiness: 'ビジネスとサービス', iconPlaces: '部屋と場所', iconFood: '食事とホスピタリティ', iconTransport: '交通', iconObjects: '物と設備', iconSymbols: '記号と図形',
      minDuration: '最短時間（秒）', maxDuration: '最長時間（秒）', baseRevenue: '基本収益', arrivalRate: '到着間隔（秒）', staffPerRoom: 'サービス毎のスタッフ数', waitingCapacity: '待合椅子の最大数', floorColumns: '横方向の部屋数', floorRows: '縦方向の部屋数',
      staffServicePosition: 'サービス中のスタッフ', insideRoom: '部屋の中', outsideRoom: '部屋の外', restPolicy: '休憩ルール', restWhenEmpty: '待ち列が空の時のみ', timedBreak: '3〜5秒の休憩',
      restMin: '最短休憩（秒）', restMax: '最長休憩（秒）',
      maxElevators: 'エレベーター最大数', elevatorTravelTime: '基本移動時間（秒）',
      labels: '名称 (EN / PT / JP)', customerSingular: '顧客', staffSingular: 'スタッフ', roomSingular: '部屋', jsonHint: '上級モード：シナリオ全体を編集します。無効なJSONは保存できません。',
      characterEditor: 'キャラクター', characterEditorHint: '髪の形と色を含め、スタッフと顧客の見た目を複数作れます。新しい人はまだ使っていないタイプからランダムに選ばれ、全てのタイプが出たあとは繰り返しできます。',
      staffTypes: 'スタッフのタイプ', customerTypes: '顧客のタイプ', addType: 'タイプを追加', duplicateType: '複製', deleteType: '削除',
      headShape: '頭', bodyShape: '体', hairShape: '髪', skinColor: '肌', clothesColor: '服', hairColor: '髪の色', lookIcon: 'バッジ', keepOneType: 'タイプは1つ以上必要です。', maxTypes: 'タイプは最大{count}個です。',
      shapeCircle: '円', shapeOval: '楕円', shapeSquare: '四角', shapeDiamond: '菱形', shapeHex: '六角',
      shapeRounded: '丸み', shapeTall: '縦長', shapeWide: '横長', shapeTriangle: '三角', shapeCapsule: 'カプセル',
      hairNone: 'なし', hairShort: 'ショート', hairSpike: 'スパイク', hairSide: 'サイド', hairBob: 'ボブ', hairLong: 'ロング', hairBun: 'お団子', hairPony: 'ポニーテール', hairCurly: 'カール',
      roomEditor: '部屋', roomEditorHint: '横から見た部屋です。家具をドラッグして配置し、選択した家具の端をドラッグすると大きさを変えられます。立ち位置は顧客とスタッフが入れる場所で、滞在時間の最小・最大割合も決められます。',
      furniture: '家具', peopleSpots: '立ち位置', addFurniture: '追加', clickToSelect: '部屋の中をドラッグして配置します。家具を選んで端をドラッグするとサイズを変えられます。',
      furnChair: '椅子', furnTable: 'テーブル', furnDesk: '机', furnBed: 'ベッド', furnWhiteboard: 'ホワイトボード', furnCabinet: '棚', furnWindow: '窓', furnToilet: 'トイレ', furnBath: 'バスルーム', furnPlant: '観葉植物',
      spotCustomer: '{customer}の位置', spotStaff: '{staff}の位置', spotBoth: '共用の位置',
      spotRole: '使う人', roleCustomer: '{customer}', roleStaff: '{staff}', roleBoth: '両方',
      timeMin: '最短の時間割合（%）', timeMax: '最長の時間割合（%）', flipItem: '左右反転', itemColor: '色', itemWidth: '幅', itemHeight: '高さ', maxFurniture: '家具は最大{count}個です。', maxStations: '立ち位置は最大{count}個です。',
      resetProgress: '進行をリセット', preserveReconfigure: '再設定時に資産価値を維持', preserveReconfigureHelp: '購入した部屋、アップグレード、設備を現金に戻します。チェックを外すとすべてリセットされます。', saveAndPlay: '保存してプレイ', empty: '空室', busy: '使用中', locked: '利用可能', level: 'LV.',
      notEnoughCash: '資金が足りません', hired: '{staff}を雇いました', roomOpened: '{room}を開きました', teamUpgraded: 'チームがレベル{level}になりました', roomUpgraded: '{room}をアップグレードしました', equipmentUpgraded: '設備をアップグレードしました',
      scenarioSaved: 'シナリオを保存しました', assetsLiquidated: '購入済み資産から{amount}を回収しました', scenarioImported: 'シナリオを読み込みました', invalidConfig: 'シナリオ設定が無効です', resetConfirm: 'このシナリオの進行をすべてリセットしますか？', newScenarioName: '新しいシナリオ',
      preset: '標準サンプル', custom: 'カスタムシナリオ', paused: '一時停止', queueFull: '待合室が満員です', servicePaid: '+{amount}', teacher: '先生', student: '生徒', classroom: '教室'
    }
  };

  const PRESETS = [
    {
      id: 'academy', name: 'Bright Path Academy', builtIn: true, icon: '📚', currencySymbol: '$', color: '#44d7c2', floor: { columns: 5, rows: 5 },
      appearance: { theme: 'dark', background: '#071a23', roomFill: '#0b222c', roomColor: '#44d7c2' },
      icons: { customer: '●', staff: '✦', room: '▤', equipment: '▰' },
      characters: {
        staff: [
          makeLook('staff-1', '#f1c6a5', '#a7ef5b', 'circle', 'rounded', '✦', 'short', '#1c1c1c'),
          makeLook('staff-2', '#d4a574', '#2bb3a3', 'oval', 'tall', '✦', 'side', '#3d2314'),
          makeLook('staff-3', '#e8b896', '#c6e86b', 'square', 'square', '✦', 'bun', '#6b3f1f'),
          makeLook('staff-4', '#c68642', '#44d7c2', 'hex', 'capsule', '✦', 'spike', '#1c1c1c')
        ],
        customers: [
          makeLook('customer-1', '#f8d5b8', '#44d7c2', 'circle', 'rounded', '●', 'bob', '#e8c56b'),
          makeLook('customer-2', '#f1c6a5', '#7ec8ff', 'oval', 'tall', '●', 'long', '#3d2314'),
          makeLook('customer-3', '#e8b896', '#ffb25f', 'square', 'wide', '●', 'short', '#1c1c1c'),
          makeLook('customer-4', '#d4a574', '#f3d675', 'diamond', 'triangle', '●', 'pony', '#8d5524'),
          makeLook('customer-5', '#c68642', '#ff8fab', 'hex', 'capsule', '●', 'curly', '#1c1c1c')
        ]
      },
      roomLayout: {
        furniture: [
          makeFurn('board', 'whiteboard', 22, 58),
          makeFurn('chair', 'chair', 54, 90),
          makeFurn('cabinet', 'cabinet', 86, 90)
        ],
        stations: [
          makeSpot('seat', 'customer', 54, 78, 45, 70),
          makeSpot('board', 'both', 28, 72, 30, 55)
        ]
      },
      labels: {
        customer: { en: 'student', pt: 'aluno', ja: '生徒' }, customerPlural: { en: 'Students', pt: 'Alunos', ja: '生徒' },
        staff: { en: 'teacher', pt: 'professor', ja: '先生' }, staffPlural: { en: 'Teachers', pt: 'Professores', ja: '先生' },
        room: { en: 'classroom', pt: 'sala', ja: '教室' }, roomPlural: { en: 'Classrooms', pt: 'Salas', ja: '教室' }
      },
      activities: [{ id: 'tutoring', name: { en: 'Tutoring', pt: 'Reforço', ja: '個別指導' }, icon: '✎', minDuration: 10, maxDuration: 15, baseRevenue: 48, weight: 1 }],
      equipment: [
        { level: 1, name: { en: 'Study desk', pt: 'Mesa de estudo', ja: '学習机' }, icon: '▰', revenueMultiplier: 1 },
        { level: 2, name: { en: 'Whiteboard', pt: 'Quadro branco', ja: 'ホワイトボード' }, icon: '▤', revenueMultiplier: 1.2 },
        { level: 3, name: { en: 'Smart board', pt: 'Lousa digital', ja: '電子黒板' }, icon: '▣', revenueMultiplier: 1.5 }
      ],
      upgrades: { hireStaff: { baseCost: 180, multiplier: 1.28 }, openRoom: { baseCost: 260, multiplier: 1.28 }, staffTraining: { baseCost: 220, multiplier: 1.28, revenueBonus: 0.12 }, room: { baseCost: 120, multiplier: 1.28, revenueBonus: 0.28 }, equipment: { baseCost: 90, multiplier: 1.28, revenueBonus: 0.2 }, waitingSeats: { baseCost: 90, multiplier: 1.3 }, loungeSeats: { baseCost: 75, multiplier: 1.28 }, elevatorCount: { baseCost: 320, multiplier: 1.55 }, elevatorSpeed: { baseCost: 180, multiplier: 1.38 } },
      facilities: { waiting: { startingSeats: 4, maxSeats: 12, seatsPerUpgrade: 2 }, lounge: { startingSeats: 3, maxSeats: 12, seatsPerUpgrade: 2 }, elevators: { startingCount: 1, maxCount: 6, baseTravelTime: 1.8, speedMultiplier: 0.78, minimumTravelTime: 0.35 } },
      routing: { staffServicePosition: 'inside', restPolicy: 'queueAware', restMin: 3, restMax: 5, walkSpeed: 230, followDelay: 0.24 },
      simulation: { minDuration: 10, maxDuration: 15, arrivalInterval: 4.2, waitingCapacity: 12, staffPerService: 1, startingStaff: 1, startingRooms: 1, walkDuration: 0.85 },
      economy: { startingCash: 360, baseRevenue: 48, hireBaseCost: 180, roomBaseCost: 260, staffUpgradeBaseCost: 220, roomUpgradeBaseCost: 120, equipmentUpgradeBaseCost: 90, levelMultiplier: 1.28, equipmentRevenueBonus: 0.2, roomRevenueBonus: 0.28, staffRevenueBonus: 0.12 }
    },
    {
      id: 'restaurant', name: 'Olive & Ember', builtIn: true, icon: '🍽️', currencySymbol: '$', color: '#ffb25f', floor: { columns: 5, rows: 5 },
      appearance: { theme: 'dark', background: '#140e08', roomFill: '#24180e', roomColor: '#ffb25f' },
      icons: { customer: '●', staff: '✦', room: '▱', equipment: '◉' },
      characters: {
        staff: [
          makeLook('staff-1', '#f1c6a5', '#2b3a42', 'circle', 'tall', '✦', 'short', '#1c1c1c'),
          makeLook('staff-2', '#d4a574', '#e8e8e8', 'oval', 'rounded', '✦', 'bob', '#3d2314'),
          makeLook('staff-3', '#c68642', '#ffb25f', 'square', 'square', '✦', 'bun', '#6b3f1f'),
          makeLook('staff-4', '#e8b896', '#ff6e78', 'hex', 'capsule', '✦', 'spike', '#1c1c1c')
        ],
        customers: [
          makeLook('customer-1', '#f8d5b8', '#ffb25f', 'circle', 'rounded', '●', 'bob', '#e8c56b'),
          makeLook('customer-2', '#f1c6a5', '#7ec8ff', 'oval', 'wide', '●', 'long', '#3d2314'),
          makeLook('customer-3', '#d4a574', '#c6a7ff', 'square', 'tall', '●', 'curly', '#1c1c1c'),
          makeLook('customer-4', '#e8b896', '#9ae6b4', 'diamond', 'triangle', '●', 'pony', '#8d5524'),
          makeLook('customer-5', '#c68642', '#ff8fab', 'hex', 'capsule', '●', 'short', '#6b3f1f')
        ]
      },
      roomLayout: {
        furniture: [
          makeFurn('window', 'window', 20, 40),
          makeFurn('table', 'table', 48, 90),
          makeFurn('chair', 'chair', 66, 90)
        ],
        stations: [
          makeSpot('table', 'customer', 50, 78, 100, 100)
        ]
      },
      labels: {
        customer: { en: 'guest', pt: 'cliente', ja: 'お客様' }, customerPlural: { en: 'Guests', pt: 'Clientes', ja: 'お客様' },
        staff: { en: 'waiter', pt: 'garçom', ja: 'ウェイター' }, staffPlural: { en: 'Waiters', pt: 'Garçons', ja: 'ウェイター' },
        room: { en: 'table', pt: 'mesa', ja: 'テーブル' }, roomPlural: { en: 'Tables', pt: 'Mesas', ja: 'テーブル' }
      },
      activities: [{ id: 'meal-service', name: { en: 'Meal service', pt: 'Serviço de refeição', ja: '食事サービス' }, icon: '♨', minDuration: 8, maxDuration: 13, baseRevenue: 42, weight: 1 }],
      equipment: [
        { level: 1, name: { en: 'Table setting', pt: 'Mesa posta', ja: 'テーブルセット' }, icon: '▱', revenueMultiplier: 1 },
        { level: 2, name: { en: 'Premium serviceware', pt: 'Louça premium', ja: '上質な食器' }, icon: '◉', revenueMultiplier: 1.24 },
        { level: 3, name: { en: 'Chef station', pt: 'Estação do chef', ja: 'シェフステーション' }, icon: '♨', revenueMultiplier: 1.55 }
      ],
      upgrades: { hireStaff: { baseCost: 160, multiplier: 1.27 }, openRoom: { baseCost: 230, multiplier: 1.27 }, staffTraining: { baseCost: 210, multiplier: 1.27, revenueBonus: 0.1 }, room: { baseCost: 110, multiplier: 1.27, revenueBonus: 0.25 }, equipment: { baseCost: 80, multiplier: 1.27, revenueBonus: 0.24 }, waitingSeats: { baseCost: 85, multiplier: 1.28 }, loungeSeats: { baseCost: 70, multiplier: 1.26 }, elevatorCount: { baseCost: 290, multiplier: 1.5 }, elevatorSpeed: { baseCost: 165, multiplier: 1.35 } },
      facilities: { waiting: { startingSeats: 4, maxSeats: 14, seatsPerUpgrade: 2 }, lounge: { startingSeats: 3, maxSeats: 10, seatsPerUpgrade: 2 }, elevators: { startingCount: 1, maxCount: 6, baseTravelTime: 1.6, speedMultiplier: 0.76, minimumTravelTime: 0.3 } },
      routing: { staffServicePosition: 'outside', restPolicy: 'queueAware', restMin: 3, restMax: 5, walkSpeed: 240, followDelay: 0.24 },
      simulation: { minDuration: 8, maxDuration: 13, arrivalInterval: 3.7, waitingCapacity: 14, staffPerService: 1, startingStaff: 1, startingRooms: 1, walkDuration: 0.8 },
      economy: { startingCash: 340, baseRevenue: 42, hireBaseCost: 160, roomBaseCost: 230, staffUpgradeBaseCost: 210, roomUpgradeBaseCost: 110, equipmentUpgradeBaseCost: 80, levelMultiplier: 1.27, equipmentRevenueBonus: 0.24, roomRevenueBonus: 0.25, staffRevenueBonus: 0.1 }
    },
    {
      id: 'hotel', name: 'Moonrise Hotel', builtIn: true, icon: '🛎️', currencySymbol: '$', color: '#c6a7ff', floor: { columns: 5, rows: 5 },
      appearance: { theme: 'dark', background: '#120e1a', roomFill: '#1c1628', roomColor: '#c6a7ff' },
      icons: { customer: '●', staff: '✦', room: '▥', equipment: '◆' },
      characters: {
        staff: [
          makeLook('staff-1', '#f1c6a5', '#c6a7ff', 'circle', 'tall', '✦', 'short', '#1c1c1c'),
          makeLook('staff-2', '#d4a574', '#2b3a42', 'oval', 'rounded', '✦', 'side', '#3d2314'),
          makeLook('staff-3', '#e8b896', '#d4af37', 'square', 'square', '✦', 'bun', '#6b3f1f'),
          makeLook('staff-4', '#c68642', '#e8e8e8', 'hex', 'capsule', '✦', 'none', '#1c1c1c')
        ],
        customers: [
          makeLook('customer-1', '#f8d5b8', '#c6a7ff', 'circle', 'rounded', '●', 'bob', '#e8c56b'),
          makeLook('customer-2', '#f1c6a5', '#7ec8ff', 'oval', 'wide', '●', 'long', '#3d2314'),
          makeLook('customer-3', '#e8b896', '#ffb25f', 'square', 'tall', '●', 'pony', '#8d5524'),
          makeLook('customer-4', '#d4a574', '#ff8fab', 'diamond', 'triangle', '●', 'curly', '#1c1c1c'),
          makeLook('customer-5', '#c68642', '#9ae6b4', 'hex', 'capsule', '●', 'spike', '#4a5568')
        ]
      },
      roomLayout: {
        furniture: [
          makeFurn('window', 'window', 16, 38),
          makeFurn('bed', 'bed', 38, 90),
          makeFurn('desk', 'desk', 70, 90),
          makeFurn('bath', 'bath', 90, 90)
        ],
        stations: [
          makeSpot('bed', 'customer', 40, 78, 40, 65),
          makeSpot('desk', 'both', 68, 78, 15, 30),
          makeSpot('bath', 'customer', 88, 78, 15, 30)
        ]
      },
      labels: {
        customer: { en: 'guest', pt: 'hóspede', ja: '宿泊客' }, customerPlural: { en: 'Guests', pt: 'Hóspedes', ja: '宿泊客' },
        staff: { en: 'butler', pt: 'mordomo', ja: 'バトラー' }, staffPlural: { en: 'Butlers', pt: 'Mordomos', ja: 'バトラー' },
        room: { en: 'suite', pt: 'quarto', ja: '客室' }, roomPlural: { en: 'Suites', pt: 'Quartos', ja: '客室' }
      },
      activities: [
        { id: 'room-stay', name: { en: 'Room stay', pt: 'Hospedagem', ja: '宿泊' }, icon: '☾', minDuration: 12, maxDuration: 17, baseRevenue: 86, weight: 3 },
        { id: 'room-service', name: { en: 'Room service', pt: 'Serviço de quarto', ja: 'ルームサービス' }, icon: '♨', minDuration: 7, maxDuration: 11, baseRevenue: 54, weight: 1 }
      ],
      equipment: [
        { level: 1, name: { en: 'Guest room', pt: 'Quarto padrão', ja: '標準客室' }, icon: '▥', revenueMultiplier: 1 },
        { level: 2, name: { en: 'Premium bedding', pt: 'Cama premium', ja: 'プレミアム寝具' }, icon: '◆', revenueMultiplier: 1.22 },
        { level: 3, name: { en: 'Luxury suite', pt: 'Suíte de luxo', ja: 'ラグジュアリースイート' }, icon: '✦', revenueMultiplier: 1.55 }
      ],
      upgrades: { hireStaff: { baseCost: 170, multiplier: 1.3 }, openRoom: { baseCost: 310, multiplier: 1.3 }, staffTraining: { baseCost: 250, multiplier: 1.3, revenueBonus: 0.14 }, room: { baseCost: 150, multiplier: 1.3, revenueBonus: 0.32 }, equipment: { baseCost: 115, multiplier: 1.3, revenueBonus: 0.22 }, waitingSeats: { baseCost: 120, multiplier: 1.32 }, loungeSeats: { baseCost: 95, multiplier: 1.3 }, elevatorCount: { baseCost: 380, multiplier: 1.58 }, elevatorSpeed: { baseCost: 210, multiplier: 1.4 } },
      facilities: { waiting: { startingSeats: 3, maxSeats: 10, seatsPerUpgrade: 1 }, lounge: { startingSeats: 4, maxSeats: 12, seatsPerUpgrade: 2 }, elevators: { startingCount: 1, maxCount: 8, baseTravelTime: 2.2, speedMultiplier: 0.8, minimumTravelTime: 0.4 } },
      routing: { staffServicePosition: 'inside', restPolicy: 'timed', restMin: 3, restMax: 5, walkSpeed: 220, followDelay: 0.24 },
      simulation: { minDuration: 12, maxDuration: 17, arrivalInterval: 5.4, waitingCapacity: 10, staffPerService: 2, startingStaff: 2, startingRooms: 1, walkDuration: 0.72 },
      economy: { startingCash: 520, baseRevenue: 86, hireBaseCost: 170, roomBaseCost: 310, staffUpgradeBaseCost: 250, roomUpgradeBaseCost: 150, equipmentUpgradeBaseCost: 115, levelMultiplier: 1.3, equipmentRevenueBonus: 0.22, roomRevenueBonus: 0.32, staffRevenueBonus: 0.14 }
    }
  ];

  const $ = (selector, parent = document) => parent.querySelector(selector);
  const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];
  const deepCopy = (value) => JSON.parse(JSON.stringify(value));
  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function shuffle(list) {
    const copy = list.slice();
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(Math.random() * (index + 1));
      [copy[index], copy[swap]] = [copy[swap], copy[index]];
    }
    return copy;
  }

  function sanitizeColor(value, fallback) {
    const color = String(value || '').trim();
    if (/^#([0-9a-fA-F]{3})$/.test(color)) return `#${[...color.slice(1)].map(char => char + char).join('')}`.toLowerCase();
    return /^#([0-9a-fA-F]{6})$/.test(color) ? color.toLowerCase() : fallback;
  }

  function sameColor(a, b) {
    return sanitizeColor(a, '') === sanitizeColor(b, '') && Boolean(sanitizeColor(a, ''));
  }

  function hexLuminance(hex) {
    const color = sanitizeColor(hex, '#000000');
    const channel = value => {
      const sample = parseInt(value, 16) / 255;
      return sample <= 0.03928 ? sample / 12.92 : Math.pow((sample + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * channel(color.slice(1, 3)) + 0.7152 * channel(color.slice(3, 5)) + 0.0722 * channel(color.slice(5, 7));
  }

  function inkFor(background) {
    return hexLuminance(background) > 0.42 ? '#143038' : '#eef9f6';
  }

  function mutedFor(background) {
    return hexLuminance(background) > 0.42 ? '#5a7378' : '#8ba8ad';
  }

  function normalizeAppearance(scenario, fallbackTheme = 'dark') {
    if (!scenario || typeof scenario !== 'object') return scenario;
    const requested = scenario.appearance?.theme || fallbackTheme;
    const theme = requested === 'light' ? 'light' : 'dark';
    const defaults = THEME_DEFAULTS[theme];
    const color = sanitizeColor(scenario.color, '#44d7c2');
    scenario.color = color;
    scenario.appearance = {
      theme,
      background: sanitizeColor(scenario.appearance?.background, defaults.background),
      roomFill: sanitizeColor(scenario.appearance?.roomFill, defaults.roomFill),
      roomColor: sanitizeColor(scenario.appearance?.roomColor, color)
    };
    return scenario;
  }

  function applyAppearance(scenario = config) {
    const appearance = scenario?.appearance || THEME_DEFAULTS.dark;
    const theme = appearance.theme === 'light' ? 'light' : 'dark';
    const background = sanitizeColor(appearance.background, THEME_DEFAULTS[theme].background);
    const roomFill = sanitizeColor(appearance.roomFill, THEME_DEFAULTS[theme].roomFill);
    const roomColor = sanitizeColor(appearance.roomColor, scenario?.color || '#44d7c2');
    const lightStage = hexLuminance(background) > 0.42;
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.setProperty('--accent-2', sanitizeColor(scenario?.color, '#44d7c2'));
    document.documentElement.style.setProperty('--stage-bg', background);
    document.documentElement.style.setProperty('--stage-ink', inkFor(background));
    document.documentElement.style.setProperty('--stage-muted', mutedFor(background));
    document.documentElement.style.setProperty('--stage-grid', lightStage ? 'rgba(20, 48, 54, .07)' : 'rgba(255, 255, 255, .02)');
    document.documentElement.style.setProperty('--locked-room', lightStage ? 'rgba(255, 255, 255, .45)' : 'rgba(6, 21, 29, .32)');
    document.documentElement.style.setProperty('--room-fill', roomFill);
    document.documentElement.style.setProperty('--room-color', roomColor);
    document.documentElement.style.setProperty('--room-ink', inkFor(roomFill));
    document.documentElement.style.setProperty('--room-muted', mutedFor(roomFill));
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = theme === 'light' ? '#e7eef0' : '#071a22';
    const toggle = $('#theme-toggle');
    if (toggle) {
      toggle.textContent = theme === 'light' ? '☀' : '☾';
      toggle.setAttribute('aria-label', t('themeToggle'));
    }
  }

  function shiftThemeDefaults(appearance, fromTheme, toTheme) {
    if (!appearance || fromTheme === toTheme) return appearance;
    const from = THEME_DEFAULTS[fromTheme] || THEME_DEFAULTS.dark;
    const to = THEME_DEFAULTS[toTheme] || THEME_DEFAULTS.dark;
    if (sameColor(appearance.background, from.background)) appearance.background = to.background;
    if (sameColor(appearance.roomFill, from.roomFill)) appearance.roomFill = to.roomFill;
    appearance.theme = toTheme;
    return appearance;
  }

  function defaultRoomLayout() {
    return {
      furniture: [makeFurn('chair-1', 'chair', 50, 90)],
      stations: [makeSpot('spot-1', 'customer', 50, 78, 100, 100)]
    };
  }

  function uniquifyIds(items, prefix) {
    const used = new Set();
    return items.map((item, index) => {
      let id = String(item.id || `${prefix}-${index + 1}`).slice(0, 40);
      if (!id || used.has(id)) id = `${prefix}-${index + 1}`;
      let suffix = 2;
      while (used.has(id)) id = `${prefix}-${index + 1}-${suffix++}`;
      used.add(id);
      return { ...item, id };
    });
  }

  function normalizeFurniture(raw, index) {
    const kind = FURNITURE_KINDS.includes(raw?.kind) ? raw.kind : 'chair';
    const meta = FURNITURE_META[kind];
    return {
      id: String(raw?.id || `furn-${index + 1}`).slice(0, 40),
      kind,
      x: clamp(Number(raw?.x) || 50, 4, 96),
      y: clamp(Number(raw?.y) || meta.y, 12, 96),
      w: clamp(Number(raw?.w) || meta.w, 6, 72),
      h: clamp(Number(raw?.h) || meta.h, 8, 80),
      flip: !!raw?.flip,
      color: sanitizeColor(raw?.color, meta.color)
    };
  }

  function normalizeStation(raw, index) {
    const role = ['customer', 'staff', 'both'].includes(raw?.role) ? raw.role : 'customer';
    let minShare = clamp(Number(raw?.minShare) || 20, 0, 100);
    let maxShare = clamp(Number(raw?.maxShare) || 50, 0, 100);
    if (maxShare < minShare) [minShare, maxShare] = [maxShare, minShare];
    return {
      id: String(raw?.id || `spot-${index + 1}`).slice(0, 40),
      role,
      x: clamp(Number(raw?.x) || 50, 6, 94),
      y: clamp(Number(raw?.y) || 78, 18, 96),
      minShare,
      maxShare
    };
  }

  function normalizeRoomLayout(scenario) {
    if (!scenario || typeof scenario !== 'object') return scenario;
    const source = scenario.roomLayout && typeof scenario.roomLayout === 'object' ? scenario.roomLayout : defaultRoomLayout();
    const furniture = Array.isArray(source.furniture) ? source.furniture.slice(0, MAX_FURNITURE).map(normalizeFurniture) : [];
    const stations = Array.isArray(source.stations) ? source.stations.slice(0, MAX_STATIONS).map(normalizeStation) : [];
    scenario.roomLayout = {
      furniture: uniquifyIds(furniture, 'furn'),
      stations: uniquifyIds(stations.length ? stations : defaultRoomLayout().stations, 'spot')
    };
    return scenario;
  }

  function roomLayoutOf(scenario = config) {
    return normalizeRoomLayout(scenario ? { ...scenario, roomLayout: scenario.roomLayout } : {}).roomLayout;
  }

  function furnitureInner(kind) {
    return FURNITURE_PARTS[kind] || FURNITURE_PARTS.chair;
  }

  function furnitureStyle(item) {
    return `--x:${item.x}%;--y:${item.y}%;--wn:${item.w};--hn:${item.h};--furn:${item.color};z-index:${Math.round(item.y)}`;
  }

  function furnitureMarkup(item, extraClass = '') {
    const editable = extraClass.includes('editable');
    const handles = editable
      ? `<span class="resize-handles" aria-hidden="true">${['nw', 'n', 'ne', 'w', 'e', 'sw', 's', 'se'].map(handle => `<span data-resize="${handle}"></span>`).join('')}</span>`
      : '';
    return `<div class="furn furn-${escapeHtml(item.kind)} ${extraClass}" data-kind="${escapeHtml(item.kind)}" data-flip="${item.flip ? 1 : 0}" data-layout-kind="furniture" data-layout-id="${escapeHtml(item.id)}" style="${furnitureStyle(item)}"><span class="furn-body">${furnitureInner(item.kind)}</span>${handles}</div>`;
  }

  function stationMarkup(item, extraClass = '') {
    const label = item.role === 'staff' ? 'S' : item.role === 'both' ? 'B' : 'C';
    return `<div class="spot ${extraClass}" data-role="${escapeHtml(item.role)}" data-layout-kind="station" data-layout-id="${escapeHtml(item.id)}" style="--x:${item.x}%;--y:${item.y}%;z-index:${Math.round(item.y) + 20}"><b>${label}</b></div>`;
  }

  function fallbackLook(kind, scenario = config) {
    const isStaff = kind === 'staff';
    return makeLook(
      `${isStaff ? 'staff' : 'customer'}-1`,
      '#f1c6a5',
      isStaff ? '#a7ef5b' : (scenario?.color || '#44d7c2'),
      'circle',
      'rounded',
      isStaff ? (scenario?.icons?.staff || '✦') : (scenario?.icons?.customer || '●'),
      'short',
      '#3d2314'
    );
  }

  function uniquifyLookIds(looks, prefix) {
    const used = new Set();
    return looks.map((look, index) => {
      let id = String(look.id || `${prefix}-${index + 1}`).slice(0, 40);
      if (!id || used.has(id)) id = `${prefix}-${index + 1}`;
      let suffix = 2;
      while (used.has(id)) id = `${prefix}-${index + 1}-${suffix++}`;
      used.add(id);
      return { ...look, id };
    });
  }

  function normalizeLook(raw, index, kind, scenario) {
    const fallback = fallbackLook(kind, scenario);
    return {
      id: String(raw?.id || `${kind === 'staff' ? 'staff' : 'customer'}-${index + 1}`).slice(0, 40),
      skin: sanitizeColor(raw?.skin, fallback.skin),
      body: sanitizeColor(raw?.body, fallback.body),
      head: HEAD_SHAPES.includes(raw?.head) ? raw.head : 'circle',
      bodyShape: BODY_SHAPES.includes(raw?.bodyShape) ? raw.bodyShape : 'rounded',
      hair: HAIR_SHAPES.includes(HAIR_ALIASES[raw?.hair] || raw?.hair) ? (HAIR_ALIASES[raw?.hair] || raw.hair) : 'short',
      hairColor: sanitizeColor(raw?.hairColor, fallback.hairColor),
      icon: String(raw?.icon ?? fallback.icon).slice(0, 16)
    };
  }

  function defaultLooksFor(scenario, kind) {
    const isStaff = kind === 'staff';
    const icon = isStaff ? (scenario?.icons?.staff || '✦') : (scenario?.icons?.customer || '●');
    const clothes = isStaff
      ? [scenario?.color || '#44d7c2', '#a7ef5b', '#ffb25f', '#c6a7ff']
      : [scenario?.color || '#44d7c2', '#7ec8ff', '#ffb25f', '#f3d675', '#ff8fab'];
    const count = isStaff ? 4 : 5;
    const hairStyles = HAIR_SHAPES.filter(shape => shape !== 'none');
    return Array.from({ length: count }, (_, index) => makeLook(
      `${isStaff ? 'staff' : 'customer'}-${index + 1}`,
      SKIN_SWATCHES[index % SKIN_SWATCHES.length],
      clothes[index % clothes.length],
      HEAD_SHAPES[index % HEAD_SHAPES.length],
      BODY_SHAPES[index % BODY_SHAPES.length],
      icon,
      hairStyles[index % hairStyles.length],
      HAIR_SWATCHES[index % HAIR_SWATCHES.length]
    ));
  }

  function normalizeCharacters(scenario) {
    if (!scenario || typeof scenario !== 'object') return scenario;
    const staffSource = Array.isArray(scenario.characters?.staff) && scenario.characters.staff.length
      ? scenario.characters.staff.slice(0, MAX_LOOKS)
      : defaultLooksFor(scenario, 'staff');
    const customerSource = Array.isArray(scenario.characters?.customers) && scenario.characters.customers.length
      ? scenario.characters.customers.slice(0, MAX_LOOKS)
      : defaultLooksFor(scenario, 'customers');
    scenario.characters = {
      staff: uniquifyLookIds(staffSource.map((look, index) => normalizeLook(look, index, 'staff', scenario)), 'staff'),
      customers: uniquifyLookIds(customerSource.map((look, index) => normalizeLook(look, index, 'customers', scenario)), 'customer')
    };
    return scenario;
  }

  function characterLooks(kind, scenario = config) {
    const key = kind === 'staff' ? 'staff' : 'customers';
    const list = scenario?.characters?.[key];
    return Array.isArray(list) && list.length ? list : [fallbackLook(kind, scenario)];
  }

  function resolveLook(kind, lookId, scenario = config) {
    const looks = characterLooks(kind, scenario);
    return looks.find(look => look.id === lookId) || looks[0];
  }

  function nextLookId(kind, scenario = config) {
    const looks = characterLooks(kind, scenario);
    const ids = looks.map(look => look.id);
    lookBags[kind] = (lookBags[kind] || []).filter(id => ids.includes(id));
    if (!lookBags[kind].length) lookBags[kind] = shuffle(ids);
    return lookBags[kind].pop() || looks[0].id;
  }

  function seedLookBag(kind, usedIds, scenario = config) {
    const ids = characterLooks(kind, scenario).map(look => look.id);
    const unused = ids.filter(id => !usedIds.includes(id));
    lookBags[kind] = shuffle(unused);
  }

  function takeLooks(kind, count, scenario) {
    const looks = characterLooks(kind, scenario);
    const bag = shuffle(looks.map(look => look.id));
    return Array.from({ length: count }, () => {
      if (!bag.length) bag.push(...shuffle(looks.map(look => look.id)));
      return bag.pop();
    });
  }

  function personInnerHtml(look) {
    return `<span class="person-hair-back"></span><span class="person-head"></span><span class="person-hair-front"></span><span class="person-torso"></span><span class="person-icon">${escapeHtml(look?.icon || '')}</span>`;
  }

  function applyLookToElement(element, look) {
    if (!element || !look) return;
    element.style.setProperty('--skin', look.skin);
    element.style.setProperty('--person-color', look.body);
    element.style.setProperty('--hair', look.hairColor);
    element.dataset.head = look.head;
    element.dataset.body = look.bodyShape;
    element.dataset.hair = look.hair;
  }

  let db;
  let scenarios = [];
  let config;
  let state;
  let language = 'en';
  let selectedRoomId = null;
  let editingScenarioId = null;
  let activeEditorTab = 'visual';
  let lastFrame = performance.now();
  let lastSave = 0;
  let lastRender = 0;
  let arrivalTimer = 1.1;
  let speed = 1;
  let paused = false;
  let entityCounter = 0;
  let jobs = [];
  let customers = [];
  let activeIconTarget = 'customerIcon';
  let elevatorCursor = 0;
  let preserveOnReconfigure = true;
  let userTheme = 'dark';
  let lookBags = { staff: [], customers: [] };
  let editorLooks = { staff: [], customers: [] };
  let selectedLookKind = 'staff';
  let selectedLookId = null;
  let editorLayout = { furniture: [], stations: [] };
  let selectedLayoutKind = '';
  let selectedLayoutId = null;
  let layoutDrag = null;

  function openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains('scenarios')) database.createObjectStore('scenarios', { keyPath: 'id' });
        if (!database.objectStoreNames.contains('saves')) database.createObjectStore('saves', { keyPath: 'scenarioId' });
        if (!database.objectStoreNames.contains('preferences')) database.createObjectStore('preferences');
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  function idb(storeName, mode, action) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, mode);
      const result = action(tx.objectStore(storeName));
      tx.oncomplete = () => resolve(result?.result);
      tx.onerror = () => reject(tx.error);
    });
  }

  async function seedScenarios() {
    const existing = await idb('scenarios', 'readonly', store => store.getAll());
    for (const preset of PRESETS) {
      const current = existing.find(item => item.id === preset.id);
      const next = normalizeRoomLayout(normalizeAppearance(normalizeCharacters(current ? mergeDefaults(current, preset) : deepCopy(preset))));
      if (!current || JSON.stringify(current) !== JSON.stringify(next)) {
        await idb('scenarios', 'readwrite', store => store.put(next));
      }
    }
  }

  function mergeDefaults(current, defaults) {
    if (Array.isArray(defaults)) return current === undefined ? deepCopy(defaults) : current;
    if (!defaults || typeof defaults !== 'object') return current === undefined ? defaults : current;
    const result = current && typeof current === 'object' && !Array.isArray(current) ? deepCopy(current) : {};
    Object.entries(defaults).forEach(([key, value]) => {
      result[key] = mergeDefaults(result[key], value);
    });
    return result;
  }

  function floorColumns(scenario = config) {
    return clamp(Math.round(Number(scenario?.floor?.columns) || 5), 1, MAX_FLOOR_AXIS);
  }

  function floorRows(scenario = config) {
    return clamp(Math.round(Number(scenario?.floor?.rows) || 5), 1, MAX_FLOOR_AXIS);
  }

  function roomCapacity(scenario = config) {
    return floorColumns(scenario) * floorRows(scenario);
  }

  function defaultState(scenario) {
    const startingStaff = clamp(Number(scenario.simulation.startingStaff) || 1, 1, 20);
    const startingRooms = clamp(Number(scenario.simulation.startingRooms) || 1, 1, roomCapacity(scenario));
    const waitingSeats = clamp(Number(scenario.facilities?.waiting?.startingSeats) || Math.min(4, scenario.simulation.waitingCapacity), 1, Number(scenario.facilities?.waiting?.maxSeats) || scenario.simulation.waitingCapacity);
    const loungeSeats = clamp(Number(scenario.facilities?.lounge?.startingSeats) || 3, 1, Number(scenario.facilities?.lounge?.maxSeats) || 12);
    const elevatorCount = clamp(Number(scenario.facilities?.elevators?.startingCount) || 1, 1, Number(scenario.facilities?.elevators?.maxCount) || 6);
    const staffLooks = takeLooks('staff', startingStaff, scenario);
    return {
      scenarioId: scenario.id,
      cash: scenario.economy.startingCash,
      totalEarned: 0,
      served: 0,
      staffLevel: 1,
      waitingSeats,
      loungeSeats,
      elevatorCount,
      elevatorLevel: 1,
      staff: Array.from({ length: startingStaff }, (_, index) => ({ id: index + 1, status: 'idle', lookId: staffLooks[index] })),
      rooms: Array.from({ length: startingRooms }, (_, index) => ({ id: index + 1, level: 1, equipmentLevel: 1, status: 'empty' })),
      savedAt: Date.now()
    };
  }

  async function loadScenario(id, fresh = false, skipCurrentSave = false) {
    if (!skipCurrentSave) await saveGame();
    config = normalizeRoomLayout(normalizeAppearance(normalizeCharacters(deepCopy(scenarios.find(item => item.id === id) || scenarios[0])), userTheme));
    const saved = fresh ? null : await idb('saves', 'readonly', store => store.get(config.id));
    state = saved || defaultState(config);
    const defaults = defaultState(config);
    state.waitingSeats = clamp(Number(state.waitingSeats) || defaults.waitingSeats, 1, Number(config.facilities?.waiting?.maxSeats) || config.simulation.waitingCapacity);
    state.loungeSeats = clamp(Number(state.loungeSeats) || defaults.loungeSeats, 1, Number(config.facilities?.lounge?.maxSeats) || 12);
    state.elevatorCount = clamp(Number(state.elevatorCount) || defaults.elevatorCount, 1, Number(config.facilities?.elevators?.maxCount) || 6);
    state.elevatorLevel = Math.max(1, Number(state.elevatorLevel) || 1);
    const staffLooks = characterLooks('staff');
    lookBags = { staff: [], customers: [] };
    state.staff = (state.staff?.length ? state.staff : [{ id: 1 }]).map((member, index) => ({
      id: member.id || index + 1,
      status: 'idle',
      location: 'lounge',
      lookId: staffLooks.some(look => look.id === member.lookId) ? member.lookId : null
    }));
    seedLookBag('staff', state.staff.map(member => member.lookId).filter(Boolean));
    state.staff.forEach(member => { if (!member.lookId) member.lookId = nextLookId('staff'); });
    seedLookBag('customers', []);
    state.rooms = (state.rooms?.length ? state.rooms : [{ id: 1, level: 1, equipmentLevel: 1 }]).slice(0, roomCapacity(config)).map(room => ({ ...room, status: 'empty', progress: 0 }));
    cleanupEntities();
    jobs = [];
    customers = [];
    elevatorCursor = 0;
    arrivalTimer = 1.2;
    selectedRoomId = null;
    $('#selection-panel').hidden = true;
    await idb('preferences', 'readwrite', store => store.put(config.id, 'activeScenario'));
    renderAll();
    ensureStaffElements();
    if (fresh) await saveGame();
  }

  async function saveGame() {
    if (!db || !state || !config) return;
    $('#save-status').textContent = t('saving');
    const snapshot = deepCopy({ ...state, savedAt: Date.now() });
    snapshot.staff = snapshot.staff.map(member => ({ id: member.id, status: 'idle', lookId: member.lookId }));
    snapshot.rooms = snapshot.rooms.map(room => ({ ...room, status: 'empty', progress: 0 }));
    await idb('saves', 'readwrite', store => store.put(snapshot));
    $('#save-status').textContent = t('saved');
  }

  function label(key, plural = false, lang = language) {
    const labelKey = plural ? `${key}Plural` : key;
    return config?.labels?.[labelKey]?.[lang] || config?.labels?.[labelKey]?.en || key;
  }

  function t(key, params = {}) {
    const dict = I18N[language] || I18N.en;
    const replacements = {
      customer: label('customer'), customerPlural: label('customer', true),
      staff: label('staff'), staffPlural: label('staff', true),
      room: label('room'), roomPlural: label('room', true), ...params
    };
    return (dict[key] || I18N.en[key] || key).replace(/\{(\w+)\}/g, (_, token) => replacements[token] ?? token);
  }

  function currency(value) {
    const amount = Math.round(Number(value) || 0).toLocaleString(language === 'pt' ? 'pt-BR' : language === 'ja' ? 'ja-JP' : 'en-US');
    return `${config.currencySymbol}${amount}`;
  }

  function setLanguage(lang) {
    language = ['en', 'pt', 'ja'].includes(lang) ? lang : 'en';
    document.documentElement.lang = language;
    $$('.language-switcher button').forEach(button => button.classList.toggle('active', button.dataset.lang === language));
    $$('[data-i18n]').forEach(element => { element.textContent = t(element.dataset.i18n); });
    $$('[data-i18n-aria]').forEach(element => { element.setAttribute('aria-label', t(element.dataset.i18nAria)); });
    $$('[data-i18n-placeholder]').forEach(element => { element.setAttribute('placeholder', t(element.dataset.i18nPlaceholder)); });
    if (db) idb('preferences', 'readwrite', store => store.put(language, 'language'));
    if ($('#icon-gallery') && config) renderIconGallery();
    if (!$('#studio-modal')?.hidden && activeEditorTab === 'characters') renderCharacterEditor();
    if (!$('#studio-modal')?.hidden && activeEditorTab === 'room') renderRoomEditor();
    renderAll();
  }

  function cost(kind, target = null) {
    const e = config.economy;
    const rules = config.upgrades || {};
    if (kind === 'hire') return scaledCost(rules.hireStaff, e.hireBaseCost, state.staff.length - 1, e.levelMultiplier);
    if (kind === 'room') return scaledCost(rules.openRoom, e.roomBaseCost, state.rooms.length - 1, e.levelMultiplier);
    if (kind === 'staff') return scaledCost(rules.staffTraining, e.staffUpgradeBaseCost, state.staffLevel - 1, e.levelMultiplier);
    if (kind === 'roomUpgrade') return scaledCost(rules.room, e.roomUpgradeBaseCost, target.level - 1, e.levelMultiplier);
    if (kind === 'equipment') return scaledCost(rules.equipment, e.equipmentUpgradeBaseCost, target.equipmentLevel - 1, e.levelMultiplier);
    if (kind === 'waitingSeats') {
      const facility = config.facilities?.waiting || {};
      const upgradesBought = Math.max(0, Math.ceil((state.waitingSeats - (facility.startingSeats || 1)) / (facility.seatsPerUpgrade || 1)));
      return scaledCost(rules.waitingSeats, 90, upgradesBought, e.levelMultiplier);
    }
    if (kind === 'loungeSeats') {
      const facility = config.facilities?.lounge || {};
      const upgradesBought = Math.max(0, Math.ceil((state.loungeSeats - (facility.startingSeats || 1)) / (facility.seatsPerUpgrade || 1)));
      return scaledCost(rules.loungeSeats, 75, upgradesBought, e.levelMultiplier);
    }
    if (kind === 'elevatorCount') return scaledCost(rules.elevatorCount, 320, state.elevatorCount - 1, e.levelMultiplier);
    if (kind === 'elevatorSpeed') return scaledCost(rules.elevatorSpeed, 180, state.elevatorLevel - 1, e.levelMultiplier);
    return 0;
  }

  function scaledCost(rule, fallbackBase, level, fallbackMultiplier) {
    return Math.round(Number(rule?.baseCost ?? fallbackBase) * Math.pow(Number(rule?.multiplier ?? fallbackMultiplier), level));
  }

  function purchaseSeriesValue(rule, fallbackBase, fallbackMultiplier, startLevel, count) {
    let total = 0;
    for (let index = 0; index < Math.max(0, count); index += 1) {
      total += scaledCost(rule, fallbackBase, startLevel + index, fallbackMultiplier);
    }
    return total;
  }

  function liquidateProgress(scenario, savedState) {
    const current = savedState || defaultState(scenario);
    const defaults = defaultState(scenario);
    const economy = scenario.economy;
    const rules = scenario.upgrades || {};
    const waitingFacility = scenario.facilities?.waiting || {};
    const loungeFacility = scenario.facilities?.lounge || {};
    const refundParts = [];

    refundParts.push(purchaseSeriesValue(rules.hireStaff, economy.hireBaseCost, economy.levelMultiplier, defaults.staff.length - 1, (current.staff?.length || 0) - defaults.staff.length));
    refundParts.push(purchaseSeriesValue(rules.openRoom, economy.roomBaseCost, economy.levelMultiplier, defaults.rooms.length - 1, (current.rooms?.length || 0) - defaults.rooms.length));
    refundParts.push(purchaseSeriesValue(rules.staffTraining, economy.staffUpgradeBaseCost, economy.levelMultiplier, 0, (Number(current.staffLevel) || 1) - 1));

    (current.rooms || []).forEach(room => {
      refundParts.push(purchaseSeriesValue(rules.room, economy.roomUpgradeBaseCost, economy.levelMultiplier, 0, (Number(room.level) || 1) - 1));
      refundParts.push(purchaseSeriesValue(rules.equipment, economy.equipmentUpgradeBaseCost, economy.levelMultiplier, 0, (Number(room.equipmentLevel) || 1) - 1));
    });

    const waitingUpgrades = Math.ceil(Math.max(0, (Number(current.waitingSeats) || defaults.waitingSeats) - defaults.waitingSeats) / (Number(waitingFacility.seatsPerUpgrade) || 1));
    const loungeUpgrades = Math.ceil(Math.max(0, (Number(current.loungeSeats) || defaults.loungeSeats) - defaults.loungeSeats) / (Number(loungeFacility.seatsPerUpgrade) || 1));
    refundParts.push(purchaseSeriesValue(rules.waitingSeats, 90, economy.levelMultiplier, 0, waitingUpgrades));
    refundParts.push(purchaseSeriesValue(rules.loungeSeats, 75, economy.levelMultiplier, 0, loungeUpgrades));
    refundParts.push(purchaseSeriesValue(rules.elevatorCount, 320, economy.levelMultiplier, defaults.elevatorCount - 1, (Number(current.elevatorCount) || defaults.elevatorCount) - defaults.elevatorCount));
    refundParts.push(purchaseSeriesValue(rules.elevatorSpeed, 180, economy.levelMultiplier, 0, (Number(current.elevatorLevel) || 1) - 1));

    const refund = refundParts.reduce((sum, value) => sum + value, 0);
    return {
      cash: Math.max(0, Number(current.cash) || 0) + refund,
      totalEarned: Math.max(0, Number(current.totalEarned) || 0),
      served: Math.max(0, Number(current.served) || 0),
      refund
    };
  }

  function roomRevenue(room, activity = null) {
    const e = config.economy;
    const rules = config.upgrades || {};
    const base = Number(activity?.baseRevenue ?? config.activities?.[0]?.baseRevenue ?? e.baseRevenue);
    const equipmentTier = equipmentForLevel(room.equipmentLevel);
    const equipmentBonus = Number(rules.equipment?.revenueBonus ?? e.equipmentRevenueBonus);
    const extraEquipmentLevels = equipmentTier ? Math.max(0, room.equipmentLevel - Number(equipmentTier.level)) : room.equipmentLevel - 1;
    const equipmentMultiplier = (Number(equipmentTier?.revenueMultiplier) || 1) * (1 + extraEquipmentLevels * equipmentBonus);
    const roomMultiplier = 1 + (room.level - 1) * Number(rules.room?.revenueBonus ?? e.roomRevenueBonus);
    const staffMultiplier = 1 + (state.staffLevel - 1) * Number(rules.staffTraining?.revenueBonus ?? e.staffRevenueBonus);
    return Math.round(base * roomMultiplier * equipmentMultiplier * staffMultiplier);
  }

  function equipmentForLevel(level) {
    const tiers = [...(config.equipment || [])].sort((a, b) => Number(a.level) - Number(b.level));
    return tiers.filter(item => Number(item.level) <= level).pop() || null;
  }

  function chooseActivity() {
    const activities = config.activities?.length ? config.activities : [{ id: 'service', icon: config.icons.room, minDuration: config.simulation.minDuration, maxDuration: config.simulation.maxDuration, baseRevenue: config.economy.baseRevenue, weight: 1 }];
    const total = activities.reduce((sum, item) => sum + Math.max(0, Number(item.weight) || 1), 0);
    let roll = Math.random() * total;
    for (const activity of activities) {
      roll -= Math.max(0, Number(activity.weight) || 1);
      if (roll <= 0) return activity;
    }
    return activities[0];
  }

  function renderAll() {
    if (!config || !state) return;
    applyAppearance(config);
    $('#scenario-title').textContent = config.name;
    document.title = `${config.name} — Service Floor Tycoon`;
    renderStats();
    renderElevators();
    renderFloor();
    renderFacilitySeats();
    renderSelection();
    if (!$('#floor-manager-modal').hidden) renderFloorManager();
    updateEntityPositions();
  }

  function renderStats() {
    $('#cash-stat').textContent = currency(state.cash);
    $('#earned-stat').textContent = currency(state.totalEarned);
    $('#staff-stat').textContent = state.staff.length;
    $('#served-stat').textContent = state.served;
    const waitingCount = customers.filter(customer => ['waiting', 'assigned'].includes(customer.status)).length;
    $('#waiting-stat').textContent = waitingCount;
    $('#waiting-badge').textContent = `${waitingCount} / ${state.waitingSeats}`;
    $('#idle-badge').textContent = state.staff.filter(member => member.location === 'lounge' && ['idle', 'resting'].includes(member.status)).length;
    const hireCost = cost('hire');
    const roomCost = cost('room');
    const staffCost = cost('staff');
    const waitingCost = cost('waitingSeats');
    const loungeCost = cost('loungeSeats');
    const elevatorCost = cost('elevatorCount');
    const elevatorSpeedCost = cost('elevatorSpeed');
    const waitingMax = Number(config.facilities?.waiting?.maxSeats) || config.simulation.waitingCapacity;
    const loungeMax = Number(config.facilities?.lounge?.maxSeats) || 12;
    const elevatorMax = Number(config.facilities?.elevators?.maxCount) || 6;
    $('#hire-cost').textContent = currency(hireCost);
    $('#room-cost').textContent = state.rooms.length >= roomCapacity() ? 'MAX' : currency(roomCost);
    $('#staff-upgrade-cost').textContent = currency(staffCost);
    $('#waiting-upgrade-cost').textContent = state.waitingSeats >= waitingMax ? t('maximum') : currency(waitingCost);
    $('#lounge-upgrade-cost').textContent = state.loungeSeats >= loungeMax ? t('maximum') : currency(loungeCost);
    $('#elevator-cost').textContent = state.elevatorCount >= elevatorMax ? t('maximum') : currency(elevatorCost);
    $('#elevator-speed-cost').textContent = elevatorCanUpgradeSpeed() ? currency(elevatorSpeedCost) : t('maximum');
    $('#elevator-badge').textContent = `${state.elevatorCount} · ${t('level')} ${state.elevatorLevel} · ${elevatorTravelTime().toFixed(2)}s`;
    $('#hire-btn').disabled = state.cash < hireCost;
    $('#buy-room-btn').disabled = state.cash < roomCost || state.rooms.length >= roomCapacity();
    $('#upgrade-staff-btn').disabled = state.cash < staffCost;
    $('#upgrade-waiting-btn').disabled = state.cash < waitingCost || state.waitingSeats >= waitingMax;
    $('#upgrade-lounge-btn').disabled = state.cash < loungeCost || state.loungeSeats >= loungeMax;
    $('#add-elevator-btn').disabled = state.cash < elevatorCost || state.elevatorCount >= elevatorMax;
    $('#upgrade-elevator-btn').disabled = state.cash < elevatorSpeedCost || !elevatorCanUpgradeSpeed();
    $('[data-i18n="staff"]')?.setAttribute('title', label('staff', true));
  }

  function elevatorTravelTime() {
    const facility = config.facilities?.elevators || {};
    const base = Number(facility.baseTravelTime) || 1.8;
    const multiplier = Number(facility.speedMultiplier) || .78;
    const minimum = Number(facility.minimumTravelTime) || .35;
    return Math.max(minimum, base * Math.pow(multiplier, state.elevatorLevel - 1));
  }

  function elevatorCanUpgradeSpeed() {
    const facility = config.facilities?.elevators || {};
    const base = Number(facility.baseTravelTime) || 1.8;
    const multiplier = Number(facility.speedMultiplier) || .78;
    const minimum = Number(facility.minimumTravelTime) || .35;
    const next = Math.max(minimum, base * Math.pow(multiplier, state.elevatorLevel));
    return next < elevatorTravelTime() - .001;
  }

  function renderElevators() {
    const bank = $('#elevator-bank');
    if (!bank) return;
    bank.style.setProperty('--elevator-count', state.elevatorCount);
    while (bank.children.length < state.elevatorCount) {
      const index = bank.children.length;
      const unit = document.createElement('div');
      unit.className = 'elevator-unit';
      unit.dataset.elevatorIndex = index;
      unit.innerHTML = `<span class="elevator-indicator">${String(index + 1).padStart(2, '0')}</span>`;
      bank.appendChild(unit);
    }
    while (bank.children.length > state.elevatorCount) bank.lastElementChild.remove();
  }

  function elevatorElement(index) {
    return $(`.elevator-unit[data-elevator-index="${index}"]`);
  }

  function openElevator(index, duration = .55) {
    const element = elevatorElement(index);
    if (!element) return;
    element.classList.add('active');
    window.setTimeout(() => element.classList.remove('active'), (duration / Math.max(speed, .1)) * 1000);
  }

  function setElevatorTravelling(index, travelling) {
    elevatorElement(index)?.classList.toggle('travelling', travelling);
  }

  function renderFloor() {
    const grid = $('#floor-grid');
    const roomMap = new Map(state.rooms.map(room => [room.id, room]));
    grid.style.setProperty('--floor-columns', floorColumns());
    grid.style.setProperty('--floor-rows', floorRows());
    grid.innerHTML = '';
    for (let index = 1; index <= roomCapacity(); index++) {
      const room = roomMap.get(index);
      const element = document.createElement('button');
      element.type = 'button';
      const activeJob = room?.status === 'busy' ? jobs.find(job => job.roomId === room.id) : null;
      const doorOpen = activeJob && ['toRoom', 'exit'].includes(activeJob.phase);
      element.className = room ? `room opened ${room.status === 'busy' ? 'busy' : ''} ${doorOpen ? 'door-open' : ''} ${selectedRoomId === room.id ? 'selected' : ''}` : 'room locked';
      element.dataset.roomId = index;
      if (!room) {
        element.disabled = true;
        element.innerHTML = `<span class="locked-label"><i>＋</i>${String(index).padStart(2, '0')} · ${t('locked')}</span><span class="room-door locked-door" aria-hidden="true"><i></i></span>`;
      } else {
        const equipment = equipmentForLevel(room.equipmentLevel);
        const activityName = activeJob ? localized(activeJob.activity.name) : '';
        element.style.setProperty('--progress', `${room.progress || 0}%`);
        const layout = roomLayoutOf();
        const furnitureHtml = layout.furniture.map(item => furnitureMarkup(item)).join('');
        element.innerHTML = `<span class="room-head"><span class="room-name"><span class="room-number">${String(index).padStart(2, '0')}</span><strong>${escapeHtml(capitalize(label('room')))} ${String(index).padStart(2, '0')}</strong></span><span class="room-status"><i></i>${t(room.status === 'busy' ? 'busy' : 'empty')}</span></span><span class="room-interior"><span class="room-floor"></span>${furnitureHtml}<span class="room-activity" title="${escapeHtml(activityName)}">${escapeHtml(activeJob?.activity?.icon || '')}</span></span><span class="room-level">${t('level')} ${room.level} · ${escapeHtml(equipment?.icon || config.icons.equipment)} ${room.equipmentLevel}</span><span class="room-door" aria-hidden="true"><i></i></span><span class="room-progress"></span>`;
      }
      grid.appendChild(element);
    }
  }

  function renderFacilitySeats() {
    const waiting = $('#waiting-seats');
    const lounge = $('#lounge-seats');
    const waitingOccupied = new Set(customers.filter(customer => ['waiting', 'assigned'].includes(customer.status)).map(customer => customer.seatIndex));
    const loungeOccupied = new Set(state.staff.map((member, index) => member.location === 'lounge' && ['idle', 'resting'].includes(member.status) ? index : -1));
    waiting.innerHTML = Array.from({ length: state.waitingSeats }, (_, index) => `<span class="seat ${waitingOccupied.has(index) ? 'occupied' : ''}"></span>`).join('');
    lounge.innerHTML = Array.from({ length: state.loungeSeats }, (_, index) => `<span class="seat ${loungeOccupied.has(index) ? 'occupied' : ''}"></span>`).join('');
  }

  function renderSelection() {
    if (!selectedRoomId) return;
    const room = state.rooms.find(item => item.id === selectedRoomId);
    if (!room) return;
    $('#selected-room-title').textContent = `${capitalize(label('room'))} ${String(room.id).padStart(2, '0')}`;
    $('#selected-state').textContent = t(room.status === 'busy' ? 'busy' : 'empty');
    $('#selected-state-dot').style.background = room.status === 'busy' ? 'var(--orange)' : 'var(--accent)';
    $('#selected-level').textContent = room.level;
    const equipment = equipmentForLevel(room.equipmentLevel);
    $('#selected-equipment').textContent = `${room.equipmentLevel} · ${localized(equipment?.name) || config.icons.equipment}`;
    $('#selected-revenue').textContent = currency(roomRevenue(room));
    $('#upgrade-room-cost').textContent = currency(cost('roomUpgrade', room));
    $('#upgrade-equipment-cost').textContent = currency(cost('equipment', room));
    $('#upgrade-room-btn').disabled = state.cash < cost('roomUpgrade', room);
    $('#upgrade-equipment-btn').disabled = state.cash < cost('equipment', room);
  }

  function renderFloorManager() {
    const grid = $('#floor-upgrade-grid');
    if (!grid || !config || !state) return;
    const roomMap = new Map(state.rooms.map(room => [room.id, room]));
    grid.style.setProperty('--floor-columns', floorColumns());
    grid.style.setProperty('--floor-rows', floorRows());
    $('#floor-manager-cash').textContent = currency(state.cash);
    $('#floor-manager-room-count').textContent = `${state.rooms.length} / ${roomCapacity()}`;
    const upgradeAllCost = allRoomsUpgradeCost();
    $('#upgrade-all-rooms-cost').textContent = currency(upgradeAllCost);
    $('#upgrade-all-rooms-btn').disabled = !state.rooms.length || state.cash < upgradeAllCost;
    grid.innerHTML = Array.from({ length: roomCapacity() }, (_, offset) => {
      const roomId = offset + 1;
      const room = roomMap.get(roomId);
      const roomNumber = String(roomId).padStart(2, '0');
      if (!room) return `<article class="floor-upgrade-card locked"><b>＋ ${roomNumber}</b><small>${escapeHtml(t('notOpened'))}</small></article>`;
      const roomUpgradeCost = cost('roomUpgrade', room);
      const equipmentUpgradeCost = cost('equipment', room);
      return `<article class="floor-upgrade-card ${room.status === 'busy' ? 'busy' : ''}">
        <div class="floor-card-head"><strong>${escapeHtml(capitalize(label('room')))} ${roomNumber}</strong><span>${escapeHtml(t(room.status === 'busy' ? 'busy' : 'empty'))}</span></div>
        <div class="floor-card-levels">
          <div><small>${escapeHtml(t('roomLevel'))}</small><strong>${escapeHtml(t('level'))} ${room.level}</strong></div>
          <div><small>${escapeHtml(t('equipment'))}</small><strong>${escapeHtml(t('level'))} ${room.equipmentLevel}</strong></div>
        </div>
        <div class="floor-card-actions">
          <button type="button" data-floor-room="${roomId}" data-upgrade-kind="roomUpgrade" ${state.cash < roomUpgradeCost ? 'disabled' : ''}><span>↟ ${escapeHtml(t('roomLevel'))}</span><strong>${escapeHtml(currency(roomUpgradeCost))}</strong></button>
          <button type="button" data-floor-room="${roomId}" data-upgrade-kind="equipment" ${state.cash < equipmentUpgradeCost ? 'disabled' : ''}><span>↟ ${escapeHtml(t('equipment'))}</span><strong>${escapeHtml(currency(equipmentUpgradeCost))}</strong></button>
        </div>
      </article>`;
    }).join('');
  }

  function createPerson(type, id, lookId) {
    const look = resolveLook(type, lookId);
    const element = document.createElement('div');
    element.className = `person ${type}`;
    element.id = `person-${type}-${id}`;
    applyLookToElement(element, look);
    element.innerHTML = personInnerHtml(look);
    $('#people-layer').appendChild(element);
    return element;
  }

  function removePerson(type, id) {
    $(`#person-${type}-${id}`)?.remove();
  }

  function cleanupEntities() {
    $('#people-layer').innerHTML = '';
  }

  function getPoint(kind, index = 0, slot = 0) {
    let element;
    if (kind === 'elevator') element = elevatorElement(((index % state.elevatorCount) + state.elevatorCount) % state.elevatorCount) || $('#elevator-zone');
    if (kind === 'waiting' || kind === 'waitingPickup') element = $('#waiting-zone');
    if (kind === 'lounge') element = $('#lounge-zone');
    if (kind === 'room' || kind === 'roomDoor' || kind === 'roomThreshold') element = $(`.room[data-room-id="${index}"]`);
    if (!element) return { x: innerWidth / 2, y: innerHeight / 2 };
    const rect = element.getBoundingClientRect();
    if (kind === 'waiting' || kind === 'waitingPickup') {
      const seat = $$('.seat', $('#waiting-seats'))[index % Math.max(state.waitingSeats, 1)];
      const seatRect = seat?.getBoundingClientRect();
      const point = seatRect ? { x: seatRect.left + seatRect.width / 2, y: seatRect.bottom - 2 } : { x: rect.left + rect.width / 2, y: rect.bottom - 28 };
      if (kind === 'waitingPickup') point.x += 18 + slot * 14;
      return point;
    }
    if (kind === 'lounge') {
      const seat = $$('.seat', $('#lounge-seats'))[index];
      const seatRect = seat?.getBoundingClientRect();
      return seatRect ? { x: seatRect.left + seatRect.width / 2, y: seatRect.bottom - 2 } : { x: rect.left + 34 + ((index - state.loungeSeats) % 6) * 29, y: rect.top + 62 };
    }
    if (kind === 'elevator') return { x: rect.left + rect.width / 2 + slot * 10, y: rect.bottom - 18 };
    if (kind === 'roomThreshold') return { x: rect.left + rect.width / 2, y: rect.bottom + 5 };
    if (kind === 'roomDoor') {
      const outsideOffsets = [0, 0, -17, 17, -34, 34];
      return { x: rect.left + rect.width / 2 + (outsideOffsets[slot] || 0), y: rect.bottom + 9 };
    }
    const interior = $('.room-interior', element) || element;
    const box = interior.getBoundingClientRect();
    const roomOffsets = [[-13, 0], [13, 0], [0, 16], [-18, 16], [18, 16], [0, -15]];
    const [offsetX, offsetY] = roomOffsets[slot] || [0, 0];
    return { x: box.left + box.width / 2 + offsetX, y: box.top + box.height * .78 + offsetY };
  }

  function getStationPoint(roomId, station, slot = 0) {
    const room = $(`.room[data-room-id="${roomId}"]`);
    if (!room || !station) return getPoint('room', roomId, slot);
    const interior = $('.room-interior', room) || room;
    const box = interior.getBoundingClientRect();
    return { x: box.left + box.width * (Number(station.x) / 100) + slot * 9, y: box.top + box.height * (Number(station.y) / 100) };
  }

  function planStations(stations, duration) {
    if (!stations.length) return [];
    const raw = stations.map(item => ({ ...item, share: Math.max(0.01, random(item.minShare, item.maxShare) || 1) }));
    const total = raw.reduce((sum, item) => sum + item.share, 0) || 1;
    let elapsed = 0;
    return raw.map(item => {
      const length = duration * (item.share / total);
      const start = elapsed;
      elapsed += length;
      return { id: item.id, x: item.x, y: item.y, start, end: elapsed };
    });
  }

  function buildServicePlan(duration) {
    const layout = roomLayoutOf();
    const customerStations = layout.stations.filter(item => item.role === 'customer' || item.role === 'both');
    const staffStations = layout.stations.filter(item => item.role === 'staff' || item.role === 'both');
    return {
      customer: planStations(customerStations, duration),
      staff: planStations(staffStations, duration)
    };
  }

  function stepAt(plan, elapsed) {
    if (!plan?.length) return null;
    return plan.find(step => elapsed >= step.start && elapsed < step.end - 0.0001) || plan[plan.length - 1];
  }

  function staffUsesRoomStations() {
    return (config.routing?.staffServicePosition || 'inside') === 'inside';
  }

  function updateJobStations(job) {
    if (job.phase !== 'service') return;
    const customer = customers.find(item => item.id === job.customerId);
    const room = state.rooms.find(item => item.id === job.roomId);
    if (!customer || !room) return;
    const customerStep = stepAt(job.customerPlan, job.elapsed);
    if (customerStep && customerStep.id !== job.customerStationId) {
      job.customerStationId = customerStep.id;
      moveElement($(`#person-customer-${customer.id}`), getStationPoint(room.id, customerStep, 0), .42);
    }
    if (!staffUsesRoomStations()) return;
    const staff = job.staffIds.map(id => state.staff.find(member => member.id === id)).filter(Boolean);
    const staffStep = stepAt(job.staffPlan, job.elapsed) || customerStep;
    if (!staffStep) return;
    if (staffStep.id !== job.staffStationId) {
      job.staffStationId = staffStep.id;
      staff.forEach((member, index) => {
        moveElement($(`#person-staff-${member.id}`), getStationPoint(room.id, staffStep, index + (customerStep && staffStep.id === customerStep.id ? 1 : 0)), .42);
      });
    }
  }

  function moveElement(element, point, duration = .6, invalidateRoute = true) {
    if (!element) return;
    if (invalidateRoute) element.dataset.routeToken = String((Number(element.dataset.routeToken) || 0) + 1);
    element.style.transitionDuration = `${duration / Math.max(speed, .1)}s`;
    element.style.left = `${point.x}px`;
    element.style.top = `${point.y}px`;
    element.classList.toggle('walking', duration > 0.1);
    window.setTimeout(() => element.classList.remove('walking'), (duration / Math.max(speed, .1)) * 1000);
  }

  function movementThreshold(kind) {
    const zone = $(`#${kind}-zone`);
    const stage = $('#game-stage').getBoundingClientRect();
    const rect = zone?.getBoundingClientRect();
    return { x: rect ? rect.left + rect.width / 2 : innerWidth / 2, y: stage.bottom - 8 };
  }

  function roomCorridor(roomId, slot = 0) {
    const door = getPoint('roomThreshold', roomId);
    const grid = $('#floor-grid').getBoundingClientRect();
    return { door, spine: { x: grid.left - 12, y: door.y } };
  }

  function routeGroundToGround(fromKind, toKind, destination) {
    const fromThreshold = movementThreshold(fromKind);
    const toThreshold = movementThreshold(toKind);
    return [fromThreshold, toThreshold, destination];
  }

  function routeGroundToRoom(fromKind, roomId, destination, slot = 0) {
    const stage = $('#game-stage').getBoundingClientRect();
    const corridor = roomCorridor(roomId, slot);
    const fromThreshold = movementThreshold(fromKind);
    return [fromThreshold, { x: corridor.spine.x, y: stage.bottom - 8 }, corridor.spine, corridor.door, destination];
  }

  function routeRoomToGround(roomId, toKind, destination, slot = 0) {
    const stage = $('#game-stage').getBoundingClientRect();
    const corridor = roomCorridor(roomId, slot);
    const toThreshold = movementThreshold(toKind);
    return [corridor.door, corridor.spine, { x: corridor.spine.x, y: stage.bottom - 8 }, toThreshold, destination];
  }

  function escortFollowDelay() {
    return clamp(Number(config.routing?.followDelay) || .24, .08, 1.5);
  }

  function moveAlongRoute(element, points, fallbackDuration = .6, startDelay = 0) {
    if (!element || !points.length) return fallbackDuration + startDelay;
    const current = { x: parseFloat(element.style.left) || element.getBoundingClientRect().left, y: parseFloat(element.style.top) || element.getBoundingClientRect().top };
    const routePoints = [current, ...points];
    const distances = points.map((point, index) => Math.hypot(point.x - routePoints[index].x, point.y - routePoints[index].y));
    const totalDistance = distances.reduce((sum, value) => sum + value, 0) || 1;
    const totalDuration = Math.max(fallbackDuration, totalDistance / (Number(config.routing?.walkSpeed) || 230));
    const token = String((Number(element.dataset.routeToken) || 0) + 1);
    element.dataset.routeToken = token;
    let elapsed = 0;
    points.forEach((point, index) => {
      const segmentDuration = distances[index] > 0 ? Math.max(.08, totalDuration * (distances[index] / totalDistance)) : 0;
      window.setTimeout(() => {
        if (element.dataset.routeToken !== token) return;
        moveElement(element, point, segmentDuration, false);
      }, ((startDelay + elapsed) / Math.max(speed, .1)) * 1000);
      elapsed += segmentDuration;
    });
    return elapsed + startDelay;
  }

  function updateEntityPositions() {
    customers.forEach((customer, index) => {
      const element = $(`#person-customer-${customer.id}`);
      if (!element) return;
      if (['waiting', 'assigned'].includes(customer.status)) moveElement(element, getPoint('waiting', customer.seatIndex ?? 0), 0);
      if (['elevator', 'arriving', 'exiting'].includes(customer.status)) moveElement(element, getPoint('elevator', customer.elevatorIndex ?? 0), 0);
    });
    state.staff.forEach((member, index) => {
      const element = $(`#person-staff-${member.id}`);
      if (['idle', 'resting'].includes(member.status) && member.location === 'lounge') moveElement(element, getPoint('lounge', index), 0);
    });
  }

  function occupiedElevators() {
    const occupied = new Set(customers.filter(customer => customer.status === 'elevator').map(customer => customer.elevatorIndex));
    jobs.forEach(job => {
      if (job.elevatorIndex !== undefined && ['exit', 'elevatorDeparture'].includes(job.phase)) occupied.add(job.elevatorIndex);
    });
    return occupied;
  }

  function findAvailableElevator() {
    const occupied = occupiedElevators();
    for (let offset = 0; offset < state.elevatorCount; offset++) {
      const index = (elevatorCursor + offset) % state.elevatorCount;
      if (!occupied.has(index)) {
        elevatorCursor = (index + 1) % state.elevatorCount;
        return index;
      }
    }
    return -1;
  }

  function spawnCustomer() {
    const waitingCount = customers.filter(customer => ['elevator', 'waiting', 'arriving', 'assigned'].includes(customer.status)).length;
    if (waitingCount >= state.waitingSeats) return false;
    const elevatorIndex = findAvailableElevator();
    if (elevatorIndex < 0) return false;
    const usedSeats = new Set(customers.filter(customer => ['elevator', 'waiting', 'arriving', 'assigned'].includes(customer.status)).map(customer => customer.seatIndex));
    const seatIndex = Array.from({ length: state.waitingSeats }, (_, index) => index).find(index => !usedSeats.has(index)) ?? 0;
    const id = ++entityCounter;
    const lookId = nextLookId('customers');
    const customer = { id, status: 'elevator', timer: elevatorTravelTime(), seatIndex, elevatorIndex, lookId };
    customers.push(customer);
    const element = createPerson('customer', id, lookId);
    element.style.opacity = '0';
    moveElement(element, getPoint('elevator', elevatorIndex), 0);
    setElevatorTravelling(elevatorIndex, true);
    return true;
  }

  function releaseCustomerFromElevator(customer) {
    const element = $(`#person-customer-${customer.id}`);
    setElevatorTravelling(customer.elevatorIndex, false);
    openElevator(customer.elevatorIndex);
    customer.status = 'arriving';
    if (element) element.style.opacity = '1';
    customer.timer = moveAlongRoute(element, routeGroundToGround('elevator', 'waiting', getPoint('waiting', customer.seatIndex)), config.simulation.walkDuration);
  }

  function ensureStaffElements() {
    state.staff.forEach((member, index) => {
      if (!member.lookId) member.lookId = nextLookId('staff');
      let element = $(`#person-staff-${member.id}`);
      if (!element) element = createPerson('staff', member.id, member.lookId);
      if (member.status === 'idle') {
        member.location = member.location || 'lounge';
        moveElement(element, getPoint('lounge', index), .2);
      }
    });
  }

  function assignJobs() {
    const needed = clamp(Number(config.simulation.staffPerService) || 1, 1, 5);
    while (true) {
      const customer = customers.find(item => item.status === 'waiting');
      const room = state.rooms.find(item => item.status === 'empty');
      const idleStaff = state.staff.filter(member => member.status === 'idle').slice(0, needed);
      if (!customer || !room || idleStaff.length < needed) break;
      const waitingIndex = customer.seatIndex ?? 0;
      customer.status = 'assigned';
      room.status = 'busy';
      room.progress = 0;
      idleStaff.forEach(member => { member.status = 'busy'; });
      const activity = chooseActivity();
      const duration = random(activity.minDuration ?? config.simulation.minDuration, activity.maxDuration ?? config.simulation.maxDuration);
      const job = { customerId: customer.id, roomId: room.id, staffIds: idleStaff.map(member => member.id), activity, phase: 'pickup', timer: 0, duration, elapsed: 0 };
      job.timer = Math.max(...idleStaff.map((member, index) => {
        const destination = getPoint('waitingPickup', waitingIndex, index);
        const from = ['elevator', 'lounge', 'waiting'].includes(member.location) ? member.location : 'waiting';
        member.location = 'waiting';
        return moveAlongRoute($(`#person-staff-${member.id}`), routeGroundToGround(from, 'waiting', destination), config.simulation.walkDuration, index * escortFollowDelay());
      }));
      jobs.push(job);
    }
  }

  function beginJobExit(job, customer, room, staff, elevatorIndex) {
    job.elevatorIndex = elevatorIndex;
    job.phase = 'exit';
    customer.status = 'exiting';
    customer.elevatorIndex = elevatorIndex;
    setElevatorTravelling(elevatorIndex, true);
    const customerDuration = moveAlongRoute($(`#person-customer-${customer.id}`), routeRoomToGround(room.id, 'elevator', getPoint('elevator', elevatorIndex)), config.simulation.walkDuration, escortFollowDelay());
    const staffDurations = staff.map((member, index) => {
      member.location = 'elevator';
      const formationDelay = index === 0 ? 0 : (index + 1) * escortFollowDelay();
      return moveAlongRoute($(`#person-staff-${member.id}`), routeRoomToGround(room.id, 'elevator', getPoint('elevator', elevatorIndex, index + 1), index + 1), config.simulation.walkDuration, formationDelay);
    });
    job.timer = Math.max(customerDuration, ...staffDurations);
  }

  function advanceJob(job) {
    const staff = job.staffIds.map(id => state.staff.find(member => member.id === id)).filter(Boolean);
    if (job.phase === 'return') {
      staff.forEach(member => { member.location = 'lounge'; delete member.destination; });
      if ((config.routing?.restPolicy || 'queueAware') === 'timed') {
        staff.forEach(member => { member.status = 'resting'; });
        job.phase = 'rest';
        const configuredMin = Number(config.routing?.restMin);
        const configuredMax = Number(config.routing?.restMax);
        job.timer = random(Number.isFinite(configuredMin) ? configuredMin : 3, Number.isFinite(configuredMax) ? configuredMax : 5);
        return;
      }
      staff.forEach(member => { member.status = 'idle'; });
      return 'done';
    }
    if (job.phase === 'rest') {
      staff.forEach(member => { member.status = 'idle'; });
      return 'done';
    }
    const customer = customers.find(item => item.id === job.customerId);
    const room = state.rooms.find(item => item.id === job.roomId);
    if (!customer || !room) return 'done';
    if (job.phase === 'pickup') {
      const plan = buildServicePlan(job.duration);
      job.customerPlan = plan.customer;
      job.staffPlan = plan.staff;
      job.customerStationId = plan.customer[0]?.id || null;
      job.staffStationId = plan.staff[0]?.id || plan.customer[0]?.id || null;
      job.phase = 'toRoom';
      customer.status = 'toRoom';
      const customerDest = plan.customer[0] ? getStationPoint(room.id, plan.customer[0], 0) : getPoint('room', room.id, 0);
      const customerDuration = moveAlongRoute($(`#person-customer-${customer.id}`), routeGroundToRoom('waiting', room.id, customerDest), config.simulation.walkDuration, escortFollowDelay());
      const staffDurations = staff.map((member, index) => {
        const outside = !staffUsesRoomStations();
        const destination = outside
          ? getPoint('roomDoor', room.id, index + 1)
          : (plan.staff[0] || plan.customer[0])
            ? getStationPoint(room.id, plan.staff[0] || plan.customer[0], index + 1)
            : getPoint('room', room.id, index + 1);
        member.location = outside ? 'roomDoor' : 'room';
        const formationDelay = index === 0 ? 0 : (index + 1) * escortFollowDelay();
        return moveAlongRoute($(`#person-staff-${member.id}`), routeGroundToRoom('waiting', room.id, destination, index + 1), config.simulation.walkDuration, formationDelay);
      });
      job.timer = Math.max(customerDuration, ...staffDurations);
      return;
    }
    if (job.phase === 'toRoom') {
      job.phase = 'service';
      job.timer = job.duration;
      customer.status = 'service';
      return;
    }
    if (job.phase === 'service') {
      const elevatorIndex = findAvailableElevator();
      if (elevatorIndex < 0) {
        job.phase = 'waitElevator';
        job.timer = .25;
        return;
      }
      beginJobExit(job, customer, room, staff, elevatorIndex);
      return;
    }
    if (job.phase === 'waitElevator') {
      const elevatorIndex = findAvailableElevator();
      if (elevatorIndex < 0) {
        job.timer = .25;
        return;
      }
      beginJobExit(job, customer, room, staff, elevatorIndex);
      return;
    }
    if (job.phase === 'exit') {
      room.status = 'empty';
      room.progress = 0;
      const customerElement = $(`#person-customer-${customer.id}`);
      if (customerElement) customerElement.style.opacity = '0';
      setElevatorTravelling(job.elevatorIndex, true);
      openElevator(job.elevatorIndex);
      job.phase = 'elevatorDeparture';
      job.timer = elevatorTravelTime();
      renderAll();
      return;
    }
    if (job.phase === 'elevatorDeparture') {
      setElevatorTravelling(job.elevatorIndex, false);
      const payment = roomRevenue(room, job.activity);
      state.cash += payment;
      state.totalEarned += payment;
      state.served += 1;
      const customerElement = $(`#person-customer-${customer.id}`);
      if (customerElement) customerElement.classList.add('cash-pop');
      showFloatingPayment(payment, getPoint('elevator', job.elevatorIndex));
      window.setTimeout(() => removePerson('customer', customer.id), 220);
      customers = customers.filter(item => item.id !== customer.id);
      if ((config.routing?.restPolicy || 'queueAware') === 'queueAware' && customers.some(item => ['elevator', 'waiting', 'arriving'].includes(item.status))) {
        staff.forEach(member => { member.status = 'idle'; member.location = 'elevator'; });
        renderAll();
        return 'done';
      }
      staff.forEach((member, index) => {
        member.status = 'returning';
        member.location = 'elevator';
        member.destination = 'lounge';
      });
      job.phase = 'return';
      job.timer = Math.max(...staff.map((member, index) => {
        const loungeIndex = state.staff.indexOf(member);
        return moveAlongRoute($(`#person-staff-${member.id}`), routeGroundToGround('elevator', 'lounge', getPoint('lounge', loungeIndex)), config.simulation.walkDuration, index * escortFollowDelay());
      }));
      renderAll();
      return;
    }
  }

  function interruptQueueAwareReturns() {
    if ((config.routing?.restPolicy || 'queueAware') !== 'queueAware') return;
    let availableAssignments = Math.min(customers.filter(item => ['elevator', 'waiting', 'arriving'].includes(item.status)).length, state.rooms.filter(room => room.status === 'empty').length);
    if (!availableAssignments) return;
    jobs.forEach(job => {
      if (availableAssignments <= 0) return;
      if (job.phase !== 'return') return;
      job.staffIds.forEach(id => {
        const member = state.staff.find(item => item.id === id);
        if (member) { member.status = 'idle'; member.location = 'corridor'; }
      });
      job.phase = 'interrupted';
      job.timer = 0;
      availableAssignments -= 1;
    });
    jobs = jobs.filter(job => job.phase !== 'interrupted');
  }

  function tick(delta) {
    arrivalTimer -= delta;
    if (arrivalTimer <= 0) {
      const spawned = spawnCustomer();
      arrivalTimer = spawned ? config.simulation.arrivalInterval * random(.75, 1.25) : .35;
    }
    customers.filter(customer => customer.status === 'elevator').forEach(customer => {
      customer.timer -= delta;
      if (customer.timer <= 0) releaseCustomerFromElevator(customer);
    });
    customers.filter(customer => customer.status === 'arriving').forEach(customer => {
      customer.timer -= delta;
      if (customer.timer <= 0) customer.status = 'waiting';
    });
    interruptQueueAwareReturns();
    assignJobs();
    jobs.forEach(job => {
      job.timer -= delta;
      if (job.phase === 'service') {
        job.elapsed += delta;
        const room = state.rooms.find(item => item.id === job.roomId);
        if (room) room.progress = clamp((job.elapsed / job.duration) * 100, 0, 100);
        updateJobStations(job);
      }
    });
    jobs = jobs.filter(job => job.timer > 0 || advanceJob(job) !== 'done');
  }

  function gameLoop(now) {
    const rawDelta = Math.min((now - lastFrame) / 1000, .12);
    lastFrame = now;
    if (!paused && config && state) tick(rawDelta * speed);
    if (now - lastSave > SAVE_INTERVAL) { lastSave = now; saveGame(); }
    if (state && now - lastRender > 120) {
      lastRender = now;
      renderStats();
      renderFloor();
      renderFacilitySeats();
      renderSelection();
    }
    requestAnimationFrame(gameLoop);
  }

  function spend(amount, success) {
    if (state.cash < amount) { toast(t('notEnoughCash'), 'bad'); return false; }
    state.cash -= amount;
    success();
    renderAll();
    saveGame();
    return true;
  }

  function hireStaff() {
    spend(cost('hire'), () => {
      const id = Math.max(0, ...state.staff.map(member => member.id)) + 1;
      state.staff.push({ id, status: 'idle', lookId: nextLookId('staff') });
      ensureStaffElements();
      toast(t('hired'), 'good');
    });
  }

  function buyRoom() {
    if (state.rooms.length >= roomCapacity()) return;
    spend(cost('room'), () => {
      const id = state.rooms.length + 1;
      state.rooms.push({ id, level: 1, equipmentLevel: 1, status: 'empty', progress: 0 });
      toast(t('roomOpened'), 'good');
    });
  }

  function upgradeStaff() {
    spend(cost('staff'), () => {
      state.staffLevel += 1;
      toast(t('teamUpgraded', { level: state.staffLevel }), 'good');
    });
  }

  function upgradeFacility(kind) {
    const isWaiting = kind === 'waitingSeats';
    const facility = isWaiting ? config.facilities?.waiting : config.facilities?.lounge;
    const stateKey = isWaiting ? 'waitingSeats' : 'loungeSeats';
    const max = Number(facility?.maxSeats) || (isWaiting ? config.simulation.waitingCapacity : 12);
    if (state[stateKey] >= max) return;
    spend(cost(kind), () => {
      const amount = Math.min(Number(facility?.seatsPerUpgrade) || 1, max - state[stateKey]);
      state[stateKey] += amount;
      toast(t('chairsAdded', { count: amount }), 'good');
    });
  }

  function upgradeElevators(kind) {
    const facility = config.facilities?.elevators || {};
    if (kind === 'elevatorCount') {
      const max = Number(facility.maxCount) || 6;
      if (state.elevatorCount >= max) return;
      spend(cost(kind), () => {
        state.elevatorCount += 1;
        toast(t('elevatorAdded'), 'good');
      });
      return;
    }
    if (!elevatorCanUpgradeSpeed()) return;
    spend(cost('elevatorSpeed'), () => {
      state.elevatorLevel += 1;
      toast(t('elevatorUpgraded', { level: state.elevatorLevel }), 'good');
    });
  }

  function upgradeRoomAsset(roomId, kind) {
    const room = state.rooms.find(item => item.id === roomId);
    if (!room) return;
    const amount = cost(kind, room);
    spend(amount, () => {
      if (kind === 'roomUpgrade') { room.level += 1; toast(t('roomUpgraded'), 'good'); }
      else { room.equipmentLevel += 1; toast(t('equipmentUpgraded'), 'good'); }
    });
  }

  function upgradeSelected(kind) {
    upgradeRoomAsset(selectedRoomId, kind);
  }

  function allRoomsUpgradeCost() {
    return state.rooms.reduce((total, room) => total + cost('roomUpgrade', room) + cost('equipment', room), 0);
  }

  function upgradeAllRooms() {
    if (!state.rooms.length) return;
    const amount = allRoomsUpgradeCost();
    spend(amount, () => {
      state.rooms.forEach(room => {
        room.level += 1;
        room.equipmentLevel += 1;
      });
      toast(t('allRoomsUpgraded'), 'good');
    });
  }

  function showFloatingPayment(amount, point) {
    const pop = document.createElement('div');
    pop.className = 'toast good';
    pop.textContent = t('servicePaid', { amount: currency(amount) });
    $('#toast-region').appendChild(pop);
    window.setTimeout(() => pop.remove(), 1600);
  }

  function toast(message, type = '') {
    const element = document.createElement('div');
    element.className = `toast ${type}`;
    element.textContent = message;
    $('#toast-region').appendChild(element);
    window.setTimeout(() => element.remove(), 2300);
  }

  function validateConfig(candidate) {
    if (!candidate || typeof candidate !== 'object') throw new Error('Configuration must be an object.');
    const required = ['id', 'name', 'icons', 'labels', 'simulation', 'economy'];
    required.forEach(key => { if (!candidate[key]) throw new Error(`Missing "${key}".`); });
    ['minDuration', 'maxDuration', 'arrivalInterval', 'waitingCapacity', 'staffPerService'].forEach(key => {
      if (!(Number(candidate.simulation[key]) > 0)) throw new Error(`simulation.${key} must be greater than zero.`);
    });
    const columns = Number(candidate.floor?.columns ?? 5);
    const rows = Number(candidate.floor?.rows ?? 5);
    if (!Number.isInteger(columns) || columns < 1 || columns > MAX_FLOOR_AXIS || !Number.isInteger(rows) || rows < 1 || rows > MAX_FLOOR_AXIS) {
      throw new Error(`floor.columns and floor.rows must be integers from 1 to ${MAX_FLOOR_AXIS}.`);
    }
    candidate.floor = { ...(candidate.floor || {}), columns, rows };
    normalizeCharacters(candidate);
    normalizeAppearance(candidate);
    normalizeRoomLayout(candidate);
    if (Number(candidate.simulation.startingRooms) > columns * rows) throw new Error('simulation.startingRooms cannot exceed the floor capacity.');
    if (candidate.simulation.maxDuration < candidate.simulation.minDuration) throw new Error('maxDuration must be greater than or equal to minDuration.');
    if (candidate.routing) {
      if (!['inside', 'outside'].includes(candidate.routing.staffServicePosition)) throw new Error('routing.staffServicePosition must be "inside" or "outside".');
      if (!['queueAware', 'timed'].includes(candidate.routing.restPolicy)) throw new Error('routing.restPolicy must be "queueAware" or "timed".');
      if (candidate.routing.followDelay !== undefined && (!Number.isFinite(Number(candidate.routing.followDelay)) || Number(candidate.routing.followDelay) < .08 || Number(candidate.routing.followDelay) > 1.5)) throw new Error('routing.followDelay must be between 0.08 and 1.5 seconds.');
      if (!Number.isFinite(Number(candidate.routing.restMin)) || Number(candidate.routing.restMin) < 0 || !Number.isFinite(Number(candidate.routing.restMax)) || Number(candidate.routing.restMax) < 0) throw new Error('routing rest times must be zero or greater.');
      if (Number(candidate.routing.restMax) < Number(candidate.routing.restMin)) throw new Error('routing.restMax must be greater than or equal to restMin.');
    }
    ['waiting', 'lounge'].forEach(facilityName => {
      const facility = candidate.facilities?.[facilityName];
      if (facility && (Number(facility.startingSeats) < 1 || Number(facility.maxSeats) < Number(facility.startingSeats) || Number(facility.seatsPerUpgrade) < 1)) {
        throw new Error(`facilities.${facilityName} has invalid seat values.`);
      }
    });
    const elevators = candidate.facilities?.elevators;
    if (elevators && (Number(elevators.startingCount) < 1 || Number(elevators.maxCount) < Number(elevators.startingCount) || Number(elevators.baseTravelTime) <= 0 || Number(elevators.speedMultiplier) <= 0 || Number(elevators.speedMultiplier) >= 1 || Number(elevators.minimumTravelTime) <= 0 || Number(elevators.minimumTravelTime) > Number(elevators.baseTravelTime))) {
      throw new Error('facilities.elevators has invalid values.');
    }
    ['startingCash', 'baseRevenue', 'hireBaseCost', 'roomBaseCost', 'staffUpgradeBaseCost', 'roomUpgradeBaseCost', 'equipmentUpgradeBaseCost', 'levelMultiplier'].forEach(key => {
      if (!(Number(candidate.economy[key]) >= 0)) throw new Error(`economy.${key} must be numeric.`);
    });
    return candidate;
  }

  function renderScenarioList() {
    $('#scenario-list').innerHTML = scenarios.map(item => `<button type="button" class="scenario-item ${item.id === editingScenarioId ? 'active' : ''}" data-scenario-id="${escapeHtml(item.id)}"><span class="scenario-icon">${escapeHtml(item.icon || item.icons.room)}</span><span><strong>${escapeHtml(item.name)}</strong><small>${t(item.builtIn ? 'preset' : 'custom')}</small></span></button>`).join('');
  }

  function openStudio() {
    editingScenarioId = config.id;
    renderScenarioList();
    populateEditor(config);
    $('#preserve-reconfigure-checkbox').checked = preserveOnReconfigure;
    $('#studio-modal').hidden = false;
    syncStudioChrome();
    paused = true;
    $('#pause-btn').classList.add('active');
  }

  function closeStudio() {
    $('#studio-modal').hidden = true;
    $('#studio-modal .studio')?.classList.remove('wide-canvas');
    paused = false;
    $('#pause-btn').classList.remove('active');
  }

  function syncStudioChrome() {
    $('#studio-modal .studio')?.classList.toggle('wide-canvas', !$('#studio-modal').hidden && activeEditorTab === 'room');
  }

  function openFloorManager() {
    $('#selection-panel').hidden = true;
    selectedRoomId = null;
    $('#floor-manager-modal').hidden = false;
    renderFloorManager();
  }

  function closeFloorManager() {
    $('#floor-manager-modal').hidden = true;
  }

  function iconGroupTitle(key) {
    return t(`icon${key.charAt(0).toUpperCase()}${key.slice(1)}`);
  }

  function selectIconTarget(target) {
    if (!['scenarioIcon', 'customerIcon', 'staffIcon', 'roomIcon', 'equipmentIcon', 'activityIcon'].includes(target)) return;
    activeIconTarget = target;
    $$('#icon-targets [data-icon-target]').forEach(button => button.classList.toggle('active', button.dataset.iconTarget === target));
    renderIconGallery();
  }

  function renderIconGallery() {
    const gallery = $('#icon-gallery');
    const form = $('#visual-editor');
    if (!gallery || !form) return;
    const query = ($('#icon-search').value || '').trim().toLocaleLowerCase(language);
    const selected = form.elements[activeIconTarget]?.value || '';
    let count = 0;
    const groups = ICON_GROUPS.map(group => {
      const groupMatches = !query || `${group.key} ${group.tags} ${iconGroupTitle(group.key)}`.toLocaleLowerCase(language).includes(query);
      const icons = group.icons.filter(icon => groupMatches || icon.includes(query));
      count += icons.length;
      if (!icons.length) return '';
      return `<section class="icon-group"><h4>${escapeHtml(iconGroupTitle(group.key))}</h4><div class="icon-grid">${icons.map(icon => `<button type="button" class="icon-choice ${icon === selected ? 'selected' : ''}" data-icon-choice="${escapeHtml(icon)}" aria-label="${escapeHtml(`${t('chooseIcon')}: ${icon}`)}">${escapeHtml(icon)}</button>`).join('')}</div></section>`;
    }).join('');
    gallery.innerHTML = groups || `<div class="icon-gallery-empty">${escapeHtml(t('noIcons'))}</div>`;
    $('#icon-gallery-count').textContent = t('iconResults', { count });
  }

  function applyIconChoice(icon) {
    const input = $('#visual-editor').elements[activeIconTarget];
    if (!input) return;
    input.value = icon;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    renderIconGallery();
  }

  function populateEditor(scenario) {
    scenario = normalizeRoomLayout(normalizeAppearance(normalizeCharacters(deepCopy(scenario))));
    const form = $('#visual-editor');
    form.elements.name.value = scenario.name;
    form.elements.theme.value = scenario.appearance.theme;
    form.elements.theme.dataset.previousTheme = scenario.appearance.theme;
    form.elements.background.value = scenario.appearance.background;
    form.elements.roomFill.value = scenario.appearance.roomFill;
    form.elements.roomColor.value = scenario.appearance.roomColor;
    form.elements.currencySymbol.value = scenario.currencySymbol;
    form.elements.scenarioIcon.value = scenario.icon || '✦';
    form.elements.customerIcon.value = scenario.icons.customer;
    form.elements.staffIcon.value = scenario.icons.staff;
    form.elements.roomIcon.value = scenario.icons.room;
    form.elements.equipmentIcon.value = scenario.icons.equipment || scenario.equipment?.[0]?.icon || '▰';
    form.elements.activityIcon.value = scenario.activities?.[0]?.icon || '✎';
    form.elements.minDuration.value = scenario.simulation.minDuration;
    form.elements.maxDuration.value = scenario.simulation.maxDuration;
    form.elements.baseRevenue.value = scenario.economy.baseRevenue;
    form.elements.arrivalRate.value = scenario.simulation.arrivalInterval;
    form.elements.staffPerRoom.value = scenario.simulation.staffPerService;
    form.elements.waitingCapacity.value = scenario.facilities?.waiting?.maxSeats || scenario.simulation.waitingCapacity;
    form.elements.floorColumns.value = floorColumns(scenario);
    form.elements.floorRows.value = floorRows(scenario);
    form.elements.maxElevators.value = scenario.facilities?.elevators?.maxCount || 6;
    form.elements.elevatorTravelTime.value = scenario.facilities?.elevators?.baseTravelTime || 1.8;
    form.elements.staffServicePosition.value = scenario.routing?.staffServicePosition || 'inside';
    form.elements.restPolicy.value = scenario.routing?.restPolicy || 'queueAware';
    form.elements.restMin.value = scenario.routing?.restMin ?? 3;
    form.elements.restMax.value = scenario.routing?.restMax ?? 5;
    ['en', 'pt', 'ja'].forEach(lang => {
      form.elements[`customer_${lang}`].value = scenario.labels.customer[lang];
      form.elements[`staff_${lang}`].value = scenario.labels.staff[lang];
      form.elements[`room_${lang}`].value = scenario.labels.room[lang];
    });
    $('#json-textarea').value = JSON.stringify(scenario, null, 2);
    $('#json-error').textContent = '';
    editorLooks = {
      staff: deepCopy(characterLooks('staff', scenario)),
      customers: deepCopy(characterLooks('customers', scenario))
    };
    selectedLookKind = 'staff';
    selectedLookId = editorLooks.staff[0]?.id || null;
    editorLayout = deepCopy(scenario.roomLayout || defaultRoomLayout());
    selectedLayoutKind = '';
    selectedLayoutId = null;
    renderAppearanceSwatches();
    renderIconGallery();
    if (activeEditorTab === 'characters') renderCharacterEditor();
    if (activeEditorTab === 'room') renderRoomEditor();
  }

  function appearanceSwatchesFor(field) {
    if (field === 'background') return STAGE_SWATCHES;
    if (field === 'roomFill') return ROOM_FILL_SWATCHES;
    return ROOM_COLOR_SWATCHES;
  }

  function renderAppearanceSwatches() {
    const form = $('#visual-editor');
    if (!form) return;
    $$('.appearance-swatches').forEach(row => {
      const field = row.dataset.swatchFor;
      const current = form.elements[field]?.value;
      row.innerHTML = appearanceSwatchesFor(field).map(color => `<button type="button" data-appearance-swatch="${escapeHtml(field)}" data-appearance-color="${escapeHtml(color)}" class="${sameColor(current, color) ? 'active' : ''}" style="background:${escapeHtml(color)}" aria-label="${escapeHtml(color)}"></button>`).join('');
    });
  }

  function syncAppearanceFormToLive(field) {
    const form = $('#visual-editor');
    if (!form || !config || editingScenarioId !== config.id) return;
    const previousTheme = config.appearance?.theme === 'light' ? 'light' : 'dark';
    config.appearance = {
      theme: form.elements.theme.value === 'light' ? 'light' : 'dark',
      background: sanitizeColor(form.elements.background.value, THEME_DEFAULTS.dark.background),
      roomFill: sanitizeColor(form.elements.roomFill.value, THEME_DEFAULTS.dark.roomFill),
      roomColor: sanitizeColor(form.elements.roomColor.value, config.color)
    };
    if (field === 'theme' && previousTheme !== config.appearance.theme) {
      userTheme = config.appearance.theme;
      if (db) idb('preferences', 'readwrite', store => store.put(userTheme, 'theme'));
    }
    applyAppearance(config);
    if (field === 'theme') persistLiveAppearance();
  }

  function onAppearanceFormChange(field) {
    const form = $('#visual-editor');
    if (!form) return;
    if (field === 'theme') {
      const next = form.elements.theme.value === 'light' ? 'light' : 'dark';
      const previous = form.elements.theme.dataset.previousTheme === 'light' ? 'light' : 'dark';
      const shifted = shiftThemeDefaults({
        theme: previous,
        background: form.elements.background.value,
        roomFill: form.elements.roomFill.value
      }, previous, next);
      form.elements.background.value = shifted.background;
      form.elements.roomFill.value = shifted.roomFill;
      form.elements.theme.dataset.previousTheme = next;
    }
    renderAppearanceSwatches();
    syncAppearanceFormToLive(field);
  }

  function persistLiveAppearance() {
    if (!db || !config?.appearance) return;
    const stored = scenarios.find(item => item.id === config.id);
    if (stored) stored.appearance = deepCopy(config.appearance);
    idb('scenarios', 'readwrite', store => store.put(stored || config));
  }

  function toggleTheme() {
    const current = config?.appearance?.theme || userTheme || 'dark';
    const next = current === 'light' ? 'dark' : 'light';
    userTheme = next;
    if (db) idb('preferences', 'readwrite', store => store.put(next, 'theme'));
    if (config) {
      normalizeAppearance(config);
      shiftThemeDefaults(config.appearance, config.appearance.theme, next);
      applyAppearance(config);
      persistLiveAppearance();
    } else {
      document.documentElement.dataset.theme = next;
    }
    const form = $('#visual-editor');
    if (form && config && editingScenarioId === config.id) {
      form.elements.theme.value = next;
      form.elements.theme.dataset.previousTheme = next;
      form.elements.background.value = config.appearance.background;
      form.elements.roomFill.value = config.appearance.roomFill;
      renderAppearanceSwatches();
    }
  }

  function scenarioFromVisual() {
    const source = deepCopy(scenarios.find(item => item.id === editingScenarioId) || config);
    const form = $('#visual-editor');
    source.name = form.elements.name.value.trim() || t('newScenarioName');
    source.currencySymbol = form.elements.currencySymbol.value.trim() || '$';
    source.appearance = {
      theme: form.elements.theme.value === 'light' ? 'light' : 'dark',
      background: sanitizeColor(form.elements.background.value, THEME_DEFAULTS.dark.background),
      roomFill: sanitizeColor(form.elements.roomFill.value, THEME_DEFAULTS.dark.roomFill),
      roomColor: sanitizeColor(form.elements.roomColor.value, source.color || '#44d7c2')
    };
    source.icon = form.elements.scenarioIcon.value || '✦';
    source.icons.customer = form.elements.customerIcon.value || '●';
    source.icons.staff = form.elements.staffIcon.value || '✦';
    source.icons.room = form.elements.roomIcon.value || '▤';
    source.icons.equipment = form.elements.equipmentIcon.value || '▰';
    if (source.equipment?.length) source.equipment[0].icon = source.icons.equipment;
    if (source.activities?.length) source.activities[0].icon = form.elements.activityIcon.value || '✎';
    source.simulation.minDuration = Number(form.elements.minDuration.value);
    source.simulation.maxDuration = Number(form.elements.maxDuration.value);
    source.simulation.arrivalInterval = Number(form.elements.arrivalRate.value);
    source.simulation.staffPerService = Number(form.elements.staffPerRoom.value);
    source.simulation.waitingCapacity = Number(form.elements.waitingCapacity.value);
    source.floor = source.floor || {};
    source.floor.columns = Number(form.elements.floorColumns.value);
    source.floor.rows = Number(form.elements.floorRows.value);
    source.simulation.startingRooms = Math.min(Number(source.simulation.startingRooms) || 1, source.floor.columns * source.floor.rows);
    source.facilities = source.facilities || {};
    source.facilities.waiting = source.facilities.waiting || { startingSeats: Math.min(4, source.simulation.waitingCapacity), seatsPerUpgrade: 2 };
    source.facilities.waiting.maxSeats = source.simulation.waitingCapacity;
    source.facilities.waiting.startingSeats = Math.min(Number(source.facilities.waiting.startingSeats) || 1, source.facilities.waiting.maxSeats);
    source.facilities.elevators = source.facilities.elevators || { startingCount: 1, speedMultiplier: .78, minimumTravelTime: .35 };
    source.facilities.elevators.maxCount = Number(form.elements.maxElevators.value);
    source.facilities.elevators.baseTravelTime = Number(form.elements.elevatorTravelTime.value);
    source.facilities.elevators.startingCount = Math.min(Number(source.facilities.elevators.startingCount) || 1, source.facilities.elevators.maxCount);
    source.routing = source.routing || {};
    source.routing.staffServicePosition = form.elements.staffServicePosition.value;
    source.routing.restPolicy = form.elements.restPolicy.value;
    source.routing.restMin = Number(form.elements.restMin.value);
    source.routing.restMax = Number(form.elements.restMax.value);
    source.routing.walkSpeed = Number(source.routing.walkSpeed) || 230;
    source.economy.baseRevenue = Number(form.elements.baseRevenue.value);
    if (source.activities?.length) {
      source.activities[0].minDuration = source.simulation.minDuration;
      source.activities[0].maxDuration = source.simulation.maxDuration;
      source.activities[0].baseRevenue = source.economy.baseRevenue;
    }
    ['en', 'pt', 'ja'].forEach(lang => {
      source.labels.customer[lang] = form.elements[`customer_${lang}`].value.trim();
      source.labels.staff[lang] = form.elements[`staff_${lang}`].value.trim();
      source.labels.room[lang] = form.elements[`room_${lang}`].value.trim();
      source.labels.customerPlural[lang] = pluralize(source.labels.customer[lang], lang);
      source.labels.staffPlural[lang] = pluralize(source.labels.staff[lang], lang);
      source.labels.roomPlural[lang] = pluralize(source.labels.room[lang], lang);
    });
    source.characters = {
      staff: deepCopy(editorLooks.staff),
      customers: deepCopy(editorLooks.customers)
    };
    source.roomLayout = deepCopy(editorLayout);
    if (source.characters.staff[0]?.icon) source.icons.staff = source.characters.staff[0].icon;
    if (source.characters.customers[0]?.icon) source.icons.customer = source.characters.customers[0].icon;
    return validateConfig(source);
  }

  function selectedLayoutItem() {
    const list = selectedLayoutKind === 'furniture' ? editorLayout.furniture : editorLayout.stations;
    return (list || []).find(item => item.id === selectedLayoutId) || null;
  }

  function layoutItemOffset(kind, count) {
    return { x: clamp(18 + (count % 4) * 18, 8, 90), y: kind === 'window' || kind === 'whiteboard' ? 42 + (count % 2) * 8 : 88 };
  }

  function addFurniture(kind) {
    if (editorLayout.furniture.length >= MAX_FURNITURE) { toast(t('maxFurniture', { count: MAX_FURNITURE }), 'bad'); return; }
    const meta = FURNITURE_META[kind] || FURNITURE_META.chair;
    const point = layoutItemOffset(kind, editorLayout.furniture.length);
    const item = makeFurn(`${kind}-${Date.now()}`, kind, point.x, point.y);
    editorLayout.furniture.push(normalizeFurniture(item, editorLayout.furniture.length));
    selectedLayoutKind = 'furniture';
    selectedLayoutId = editorLayout.furniture[editorLayout.furniture.length - 1].id;
    renderRoomEditor();
  }

  function addStation(role) {
    if (editorLayout.stations.length >= MAX_STATIONS) { toast(t('maxStations', { count: MAX_STATIONS }), 'bad'); return; }
    const point = layoutItemOffset('chair', editorLayout.stations.length);
    const item = makeSpot(`spot-${Date.now()}`, role, point.x, 78, role === 'customer' ? 40 : 20, role === 'customer' ? 70 : 50);
    editorLayout.stations.push(normalizeStation(item, editorLayout.stations.length));
    selectedLayoutKind = 'station';
    selectedLayoutId = editorLayout.stations[editorLayout.stations.length - 1].id;
    renderRoomEditor();
  }

  function deleteSelectedLayoutItem() {
    if (selectedLayoutKind === 'furniture') {
      editorLayout.furniture = editorLayout.furniture.filter(item => item.id !== selectedLayoutId);
    } else if (selectedLayoutKind === 'station') {
      if (editorLayout.stations.length <= 1) return;
      editorLayout.stations = editorLayout.stations.filter(item => item.id !== selectedLayoutId);
    }
    selectedLayoutKind = '';
    selectedLayoutId = null;
    renderRoomEditor();
  }

  function resizeHandleFromPoint(event, el) {
    if (!el?.classList.contains('furn')) return '';
    const box = el.getBoundingClientRect();
    const pad = 10;
    const x = event.clientX - box.left;
    const y = event.clientY - box.top;
    const nearL = x <= pad;
    const nearR = x >= box.width - pad;
    const nearT = y <= pad;
    const nearB = y >= box.height - pad;
    if (!nearL && !nearR && !nearT && !nearB) return '';
    return `${nearT ? 'n' : nearB ? 's' : ''}${nearL ? 'w' : nearR ? 'e' : ''}`;
  }

  function furnitureUnit(stage) {
    const rect = stage.getBoundingClientRect();
    return { rect, unit: Math.min(1.05 * rect.width / 100, 2.9 * rect.height / 100) };
  }

  function resizePatchFromDrag(drag, event, stage) {
    const { rect, unit } = furnitureUnit(stage);
    if (unit < 0.05) return null;
    const dx = (event.clientX - drag.x) / unit;
    const dy = (event.clientY - drag.y) / unit;
    const start = drag.start;
    let x = start.x;
    let y = start.y;
    let w = start.w;
    let h = start.h;
    const handle = drag.handle || '';
    if (handle.includes('e')) {
      w = start.w + dx;
      x = start.x + (dx * unit / 2) / rect.width * 100;
    }
    if (handle.includes('w')) {
      w = start.w - dx;
      x = start.x + (dx * unit / 2) / rect.width * 100;
    }
    if (handle.includes('n')) h = start.h - dy;
    if (handle.includes('s')) {
      h = start.h + dy;
      y = start.y + (dy * unit) / rect.height * 100;
    }
    return { x, y, w, h };
  }

  function applyLayoutElementBox(el, item) {
    if (!el) return;
    el.style.setProperty('--x', `${item.x}%`);
    el.style.setProperty('--y', `${item.y}%`);
    el.style.setProperty('--wn', item.w);
    el.style.setProperty('--hn', item.h);
    el.style.zIndex = String(Math.round(item.y) + (selectedLayoutKind === 'station' ? 20 : 0));
  }

  function updateSelectedLayout(patch, options = {}) {
    const item = selectedLayoutItem();
    if (!item) return;
    Object.assign(item, patch);
    if (selectedLayoutKind === 'furniture') Object.assign(item, normalizeFurniture(item, 0), { id: item.id });
    else Object.assign(item, normalizeStation(item, 0), { id: item.id });
    if (layoutDrag) {
      applyLayoutElementBox($(`#layout-stage [data-layout-id="${item.id}"]`), item);
      if (options.syncInspectorSize) {
        const widthInput = $('[data-layout-w]');
        const heightInput = $('[data-layout-h]');
        if (widthInput) widthInput.value = Math.round(item.w);
        if (heightInput) heightInput.value = Math.round(item.h);
      }
      return;
    }
    renderLayoutStage();
    if (!options.keepInspector) renderLayoutInspector();
  }

  function renderFurniturePalette() {
    const palette = $('#furniture-palette');
    if (!palette) return;
    palette.innerHTML = FURNITURE_KINDS.map(kind => `<button type="button" class="palette-btn" data-add-furn="${kind}" ${editorLayout.furniture.length >= MAX_FURNITURE ? 'disabled' : ''}><span class="palette-mini">${furnitureMarkup({ ...makeFurn('p', kind, 50, 92), w: 72, h: 78 }, '')}</span><span>${escapeHtml(t(`furn${kind.charAt(0).toUpperCase()}${kind.slice(1)}`))}</span></button>`).join('');
  }

  function renderStationPalette() {
    const palette = $('#station-palette');
    if (!palette) return;
    const full = editorLayout.stations.length >= MAX_STATIONS;
    palette.innerHTML = [
      ['customer', t('spotCustomer')],
      ['staff', t('spotStaff')],
      ['both', t('spotBoth')]
    ].map(([role, label]) => `<button type="button" class="palette-btn" data-add-spot="${role}" ${full ? 'disabled' : ''}><span class="palette-mini">${stationMarkup({ id: 'p', role, x: 50, y: 92 })}</span><span>${escapeHtml(label)}</span></button>`).join('');
  }

  function renderLayoutStage() {
    const stage = $('#layout-stage');
    if (!stage) return;
    const furnitureHtml = editorLayout.furniture.map(item => furnitureMarkup(item, `editable ${item.id === selectedLayoutId && selectedLayoutKind === 'furniture' ? 'selected' : ''}`)).join('');
    const stationHtml = editorLayout.stations.map(item => stationMarkup(item, `editable ${item.id === selectedLayoutId && selectedLayoutKind === 'station' ? 'selected' : ''}`)).join('');
    stage.innerHTML = `<span class="room-floor"></span><span class="room-door layout-door" aria-hidden="true"><i></i></span>${furnitureHtml}${stationHtml}`;
  }

  function renderLayoutInspector() {
    const panel = $('#layout-inspector');
    if (!panel) return;
    const item = selectedLayoutItem();
    if (!item) {
      panel.innerHTML = `<div class="layout-inspector-empty">${escapeHtml(t('clickToSelect'))}</div>`;
      return;
    }
    if (selectedLayoutKind === 'furniture') {
      panel.innerHTML = `<h4>${escapeHtml(t(`furn${item.kind.charAt(0).toUpperCase()}${item.kind.slice(1)}`))}</h4>
        <label><span data-i18n-keep>${escapeHtml(t('itemColor'))}</span><span class="color-line"><input type="color" data-layout-color value="${escapeHtml(item.color)}"><span class="swatch-row">${ROOM_COLOR_SWATCHES.concat(['#d4a574', '#8d6e4a', '#e8e8e8']).map(color => `<button type="button" data-layout-swatch="${escapeHtml(color)}" class="${sameColor(item.color, color) ? 'active' : ''}" style="background:${escapeHtml(color)}"></button>`).join('')}</span></span></label>
        <div class="look-shape-row">
          <label><span>${escapeHtml(t('itemWidth'))}</span><input type="number" min="6" max="72" data-layout-w value="${Math.round(item.w)}"></label>
          <label><span>${escapeHtml(t('itemHeight'))}</span><input type="number" min="8" max="80" data-layout-h value="${Math.round(item.h)}"></label>
        </div>
        <label><span>${escapeHtml(t('flipItem'))}</span><input type="checkbox" data-layout-flip ${item.flip ? 'checked' : ''}></label>
        <button type="button" class="danger-look" id="delete-layout-btn">${escapeHtml(t('deleteType'))}</button>`;
      return;
    }
    panel.innerHTML = `<h4>${escapeHtml(t(item.role === 'staff' ? 'spotStaff' : item.role === 'both' ? 'spotBoth' : 'spotCustomer'))}</h4>
      <label><span>${escapeHtml(t('spotRole'))}</span><select data-layout-role>
        <option value="customer" ${item.role === 'customer' ? 'selected' : ''}>${escapeHtml(t('roleCustomer'))}</option>
        <option value="staff" ${item.role === 'staff' ? 'selected' : ''}>${escapeHtml(t('roleStaff'))}</option>
        <option value="both" ${item.role === 'both' ? 'selected' : ''}>${escapeHtml(t('roleBoth'))}</option>
      </select></label>
      <label><span>${escapeHtml(t('timeMin'))}</span><input type="number" min="0" max="100" data-layout-min value="${item.minShare}"></label>
      <label><span>${escapeHtml(t('timeMax'))}</span><input type="number" min="0" max="100" data-layout-max value="${item.maxShare}"></label>
      <button type="button" class="danger-look" id="delete-layout-btn" ${editorLayout.stations.length <= 1 ? 'disabled' : ''}>${escapeHtml(t('deleteType'))}</button>`;
  }

  function renderRoomEditor() {
    if (!$('#room-editor') || $('#room-editor').hidden) return;
    renderFurniturePalette();
    renderStationPalette();
    renderLayoutStage();
    renderLayoutInspector();
  }

  function pointerToLayoutPercent(event, stage) {
    const rect = stage.getBoundingClientRect();
    return {
      x: clamp(((event.clientX - rect.left) / Math.max(rect.width, 1)) * 100, 4, 96),
      y: clamp(((event.clientY - rect.top) / Math.max(rect.height, 1)) * 100, 12, 96)
    };
  }

  function selectedLook() {
    return (editorLooks[selectedLookKind] || []).find(look => look.id === selectedLookId) || null;
  }

  function lookMarkup(look, extraClass = '') {
    return `<span class="person ${escapeHtml(extraClass)}" data-head="${escapeHtml(look.head)}" data-body="${escapeHtml(look.bodyShape)}" data-hair="${escapeHtml(look.hair)}" style="--skin:${escapeHtml(look.skin)};--person-color:${escapeHtml(look.body)};--hair:${escapeHtml(look.hairColor)}">${personInnerHtml(look)}</span>`;
  }

  function renderLookList(kind) {
    const list = $(`#${kind === 'staff' ? 'staff' : 'customer'}-look-list`);
    if (!list) return;
    list.innerHTML = editorLooks[kind].map((look, index) => `<button type="button" class="look-card ${look.id === selectedLookId && kind === selectedLookKind ? 'active' : ''}" data-look-kind="${kind}" data-look-id="${escapeHtml(look.id)}">${lookMarkup(look, kind)}<small>${index + 1}</small></button>`).join('');
  }

  function renderCharacterEditor() {
    const addStaff = $('#add-staff-look-btn');
    const addCustomer = $('#add-customer-look-btn');
    if (addStaff) addStaff.disabled = editorLooks.staff.length >= MAX_LOOKS;
    if (addCustomer) addCustomer.disabled = editorLooks.customers.length >= MAX_LOOKS;
    renderLookList('staff');
    renderLookList('customers');
    renderLookInspector();
  }

  function renderLookInspector() {
    const panel = $('#look-inspector');
    if (!panel) return;
    const look = selectedLook();
    if (!look) {
      panel.innerHTML = `<div class="look-inspector-empty">${escapeHtml(t('keepOneType'))}</div>`;
      return;
    }
    const looks = editorLooks[selectedLookKind];
    panel.innerHTML = `
      <div class="look-preview-stage">${lookMarkup(look, selectedLookKind)}</div>
      <div class="look-shape-row">
        <div>
          <h4>${escapeHtml(t('headShape'))}</h4>
          <div class="shape-grid">${HEAD_SHAPES.map(shape => `<button type="button" class="shape-btn ${look.head === shape ? 'active' : ''}" data-look-field="head" data-look-value="${shape}" aria-label="${escapeHtml(t(`shape${shape.charAt(0).toUpperCase()}${shape.slice(1)}`))}"><i class="shape-swatch head-${shape}"></i></button>`).join('')}</div>
        </div>
        <div>
          <h4>${escapeHtml(t('bodyShape'))}</h4>
          <div class="shape-grid">${BODY_SHAPES.map(shape => `<button type="button" class="shape-btn ${look.bodyShape === shape ? 'active' : ''}" data-look-field="bodyShape" data-look-value="${shape}" aria-label="${escapeHtml(t(`shape${shape.charAt(0).toUpperCase()}${shape.slice(1)}`))}"><i class="shape-swatch body-${shape}"></i></button>`).join('')}</div>
        </div>
      </div>
      <div>
        <h4>${escapeHtml(t('hairShape'))}</h4>
        <div class="shape-grid">${HAIR_SHAPES.map(shape => `<button type="button" class="shape-btn ${look.hair === shape ? 'active' : ''}" data-look-field="hair" data-look-value="${shape}" aria-label="${escapeHtml(t(`hair${shape.charAt(0).toUpperCase()}${shape.slice(1)}`))}"><i class="shape-swatch hair-${shape}"></i></button>`).join('')}</div>
      </div>
      <div class="look-color-row">
        <label><span>${escapeHtml(t('skinColor'))}</span>
          <div class="color-line"><input type="color" data-look-color="skin" value="${escapeHtml(look.skin)}">
          <div class="swatch-row">${SKIN_SWATCHES.map(color => `<button type="button" data-look-color-swatch="skin" data-look-value="${color}" class="${look.skin.toLowerCase() === color.toLowerCase() ? 'active' : ''}" style="background:${color}" aria-label="${color}"></button>`).join('')}</div></div>
        </label>
        <label><span>${escapeHtml(t('clothesColor'))}</span>
          <div class="color-line"><input type="color" data-look-color="body" value="${escapeHtml(look.body)}">
          <div class="swatch-row">${CLOTHES_SWATCHES.map(color => `<button type="button" data-look-color-swatch="body" data-look-value="${color}" class="${look.body.toLowerCase() === color.toLowerCase() ? 'active' : ''}" style="background:${color}" aria-label="${color}"></button>`).join('')}</div></div>
        </label>
        <label><span>${escapeHtml(t('hairColor'))}</span>
          <div class="color-line"><input type="color" data-look-color="hairColor" value="${escapeHtml(look.hairColor)}">
          <div class="swatch-row">${HAIR_SWATCHES.map(color => `<button type="button" data-look-color-swatch="hairColor" data-look-value="${color}" class="${look.hairColor.toLowerCase() === color.toLowerCase() ? 'active' : ''}" style="background:${color}" aria-label="${color}"></button>`).join('')}</div></div>
        </label>
      </div>
      <label class="look-icon-field"><span>${escapeHtml(t('lookIcon'))}</span><input data-look-icon maxlength="16" value="${escapeHtml(look.icon)}"></label>
      <div class="look-inspector-actions">
        <button type="button" id="duplicate-look-btn" ${looks.length >= MAX_LOOKS ? 'disabled' : ''}>${escapeHtml(t('duplicateType'))}</button>
        <button type="button" class="danger-look" id="delete-look-btn" ${looks.length <= 1 ? 'disabled' : ''}>${escapeHtml(t('deleteType'))}</button>
      </div>`;
  }

  function updateSelectedLook(patch, options = {}) {
    const look = selectedLook();
    if (!look) return;
    Object.assign(look, patch);
    if (options.keepInspector) {
      renderLookList('staff');
      renderLookList('customers');
      const preview = $('#look-inspector .person');
      if (preview) {
        applyLookToElement(preview, look);
        const icon = preview.querySelector('.person-icon');
        if (icon) icon.textContent = look.icon;
      }
      ['skin', 'body', 'hairColor'].forEach(field => {
        if (!(field in patch)) return;
        $$(`#look-inspector [data-look-color-swatch="${field}"]`).forEach(button => {
          button.classList.toggle('active', button.dataset.lookValue.toLowerCase() === look[field].toLowerCase());
        });
      });
      return;
    }
    renderCharacterEditor();
  }

  function randomLook(kind, existing) {
    const usedHeads = new Set(existing.map(look => look.head));
    const usedBodies = new Set(existing.map(look => look.bodyShape));
    const usedHair = new Set(existing.map(look => look.hair));
    const usedClothes = new Set(existing.map(look => look.body.toLowerCase()));
    const usedSkin = new Set(existing.map(look => look.skin.toLowerCase()));
    const usedHairColor = new Set(existing.map(look => (look.hairColor || '').toLowerCase()));
    const palette = kind === 'staff' ? ['#a7ef5b', '#44d7c2', '#2b3a42', '#d4af37', '#e8e8e8', '#ffb25f', '#c6a7ff', '#ff6e78'] : CLOTHES_SWATCHES;
    const source = selectedLook() || existing[existing.length - 1] || fallbackLook(kind);
    return normalizeLook({
      id: `${kind === 'staff' ? 'staff' : 'customer'}-${Date.now().toString(36)}`,
      skin: SKIN_SWATCHES.find(color => !usedSkin.has(color.toLowerCase())) || SKIN_SWATCHES[existing.length % SKIN_SWATCHES.length],
      body: palette.find(color => !usedClothes.has(color.toLowerCase())) || palette[existing.length % palette.length],
      head: HEAD_SHAPES.find(shape => !usedHeads.has(shape)) || HEAD_SHAPES[existing.length % HEAD_SHAPES.length],
      bodyShape: BODY_SHAPES.find(shape => !usedBodies.has(shape)) || BODY_SHAPES[existing.length % BODY_SHAPES.length],
      hair: HAIR_SHAPES.find(shape => !usedHair.has(shape)) || HAIR_SHAPES[existing.length % HAIR_SHAPES.length],
      hairColor: HAIR_SWATCHES.find(color => !usedHairColor.has(color.toLowerCase())) || HAIR_SWATCHES[existing.length % HAIR_SWATCHES.length],
      icon: source.icon
    }, existing.length, kind);
  }

  function addEditorLook(kind, look) {
    if (editorLooks[kind].length >= MAX_LOOKS) {
      toast(t('maxTypes', { count: MAX_LOOKS }), 'bad');
      return;
    }
    const next = uniquifyLookIds([...editorLooks[kind], look], kind === 'staff' ? 'staff' : 'customer').pop();
    editorLooks[kind].push(next);
    selectedLookKind = kind;
    selectedLookId = next.id;
    renderCharacterEditor();
  }

  function duplicateSelectedLook() {
    const look = selectedLook();
    if (!look) return;
    addEditorLook(selectedLookKind, { ...deepCopy(look), id: `${look.id}-copy` });
  }

  function deleteSelectedLook() {
    const looks = editorLooks[selectedLookKind];
    if (looks.length <= 1) {
      toast(t('keepOneType'), 'bad');
      return;
    }
    const index = looks.findIndex(look => look.id === selectedLookId);
    looks.splice(index, 1);
    selectedLookId = looks[Math.max(0, index - 1)]?.id || looks[0].id;
    renderCharacterEditor();
  }

  async function saveEditedScenario() {
    try {
      const candidate = activeEditorTab === 'json' ? validateConfig(JSON.parse($('#json-textarea').value)) : scenarioFromVisual();
      const previous = scenarios.find(item => item.id === candidate.id);
      const rulesChanged = !previous || JSON.stringify(previous) !== JSON.stringify(candidate);
      const switchingScenario = candidate.id !== config.id;
      const reconfiguring = rulesChanged || switchingScenario;
      preserveOnReconfigure = $('#preserve-reconfigure-checkbox').checked;
      await saveGame();
      const sourceScenarioId = config.id;
      const carriedProgress = reconfiguring && preserveOnReconfigure
        ? liquidateProgress(config, deepCopy(state))
        : null;
      await idb('scenarios', 'readwrite', store => store.put(candidate));
      await idb('preferences', 'readwrite', store => store.put(preserveOnReconfigure, 'preserveOnReconfigure'));
      scenarios = await idb('scenarios', 'readonly', store => store.getAll());
      if (reconfiguring) {
        await idb('saves', 'readwrite', store => store.delete(sourceScenarioId));
        if (candidate.id !== sourceScenarioId) await idb('saves', 'readwrite', store => store.delete(candidate.id));
      }
      await loadScenario(candidate.id, reconfiguring, true);
      if (carriedProgress) {
        state.cash = carriedProgress.cash;
        state.totalEarned = carriedProgress.totalEarned;
        state.served = carriedProgress.served;
        await saveGame();
        renderAll();
      }
      closeStudio();
      toast(t('scenarioSaved'), 'good');
      if (carriedProgress?.refund) toast(t('assetsLiquidated', { amount: currency(carriedProgress.refund) }), 'good');
    } catch (error) {
      $('#json-error').textContent = error.message;
      toast(t('invalidConfig'), 'bad');
    }
  }

  async function createScenario() {
    const copy = deepCopy(config);
    copy.id = `custom-${Date.now()}`;
    copy.name = t('newScenarioName');
    copy.builtIn = false;
    copy.icon = '✦';
    await idb('scenarios', 'readwrite', store => store.put(copy));
    scenarios.push(copy);
    editingScenarioId = copy.id;
    renderScenarioList();
    populateEditor(copy);
  }

  async function importScenario(file) {
    try {
      const imported = validateConfig(JSON.parse(await file.text()));
      if (scenarios.some(item => item.id === imported.id)) imported.id = `${imported.id}-import-${Date.now()}`;
      imported.builtIn = false;
      await idb('scenarios', 'readwrite', store => store.put(imported));
      scenarios.push(imported);
      editingScenarioId = imported.id;
      renderScenarioList();
      populateEditor(imported);
      toast(t('scenarioImported'), 'good');
    } catch (error) {
      toast(`${t('invalidConfig')}: ${error.message}`, 'bad');
    }
  }

  function exportScenario() {
    const item = scenarios.find(scenario => scenario.id === editingScenarioId) || config;
    const blob = new Blob([JSON.stringify(item, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${item.id}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function resetProgress() {
    if (!confirm(t('resetConfirm'))) return;
    await idb('saves', 'readwrite', store => store.delete(config.id));
    await loadScenario(config.id, true, true);
    closeStudio();
  }

  function bindEvents() {
    $('.language-switcher').addEventListener('click', event => { if (event.target.dataset.lang) setLanguage(event.target.dataset.lang); });
    $('#theme-toggle').addEventListener('click', toggleTheme);
    $('#hire-btn').addEventListener('click', hireStaff);
    $('#buy-room-btn').addEventListener('click', buyRoom);
    $('#upgrade-staff-btn').addEventListener('click', upgradeStaff);
    $('#upgrade-waiting-btn').addEventListener('click', () => upgradeFacility('waitingSeats'));
    $('#upgrade-lounge-btn').addEventListener('click', () => upgradeFacility('loungeSeats'));
    $('#add-elevator-btn').addEventListener('click', () => upgradeElevators('elevatorCount'));
    $('#upgrade-elevator-btn').addEventListener('click', () => upgradeElevators('elevatorSpeed'));
    $('#upgrade-room-btn').addEventListener('click', () => upgradeSelected('roomUpgrade'));
    $('#upgrade-equipment-btn').addEventListener('click', () => upgradeSelected('equipment'));
    $('#floor-grid').addEventListener('click', event => {
      const roomElement = event.target.closest('.room.opened');
      if (!roomElement) return;
      selectedRoomId = Number(roomElement.dataset.roomId);
      $('#selection-panel').hidden = false;
      renderAll();
    });
    $('#selection-close').addEventListener('click', () => { selectedRoomId = null; $('#selection-panel').hidden = true; renderFloor(); });
    $('#open-floor-manager-btn').addEventListener('click', openFloorManager);
    $('#close-floor-manager-btn').addEventListener('click', closeFloorManager);
    $('#floor-manager-modal').addEventListener('click', event => { if (event.target === $('#floor-manager-modal')) closeFloorManager(); });
    $('#floor-upgrade-grid').addEventListener('click', event => {
      const button = event.target.closest('[data-floor-room][data-upgrade-kind]');
      if (!button) return;
      upgradeRoomAsset(Number(button.dataset.floorRoom), button.dataset.upgradeKind);
    });
    $('#upgrade-all-rooms-btn').addEventListener('click', upgradeAllRooms);
    $('#pause-btn').addEventListener('click', () => { paused = !paused; $('#pause-btn').classList.toggle('active', paused); $('#pause-btn').textContent = paused ? '▶' : 'Ⅱ'; if (paused) toast(t('paused')); });
    $$('.speed-btn').forEach(button => button.addEventListener('click', () => { speed = Number(button.dataset.speed); $$('.speed-btn').forEach(item => item.classList.toggle('active', item === button)); }));
    $('#open-studio-btn').addEventListener('click', openStudio);
    $('#close-studio-btn').addEventListener('click', closeStudio);
    $('#studio-modal').addEventListener('click', event => { if (event.target === $('#studio-modal')) closeStudio(); });
    $('#new-scenario-btn').addEventListener('click', createScenario);
    $('#scenario-list').addEventListener('click', event => {
      const button = event.target.closest('[data-scenario-id]');
      if (!button) return;
      editingScenarioId = button.dataset.scenarioId;
      renderScenarioList();
      populateEditor(scenarios.find(item => item.id === editingScenarioId));
    });
    $('#icon-targets').addEventListener('click', event => {
      const button = event.target.closest('[data-icon-target]');
      if (button) selectIconTarget(button.dataset.iconTarget);
    });
    $('#icon-gallery').addEventListener('click', event => {
      const button = event.target.closest('[data-icon-choice]');
      if (button) applyIconChoice(button.dataset.iconChoice);
    });
    $('#icon-search').addEventListener('input', renderIconGallery);
    $('#visual-editor').addEventListener('focusin', event => {
      if (event.target.dataset.iconInput) selectIconTarget(event.target.dataset.iconInput);
    });
    $('#visual-editor').addEventListener('click', event => {
      const swatch = event.target.closest('[data-appearance-swatch]');
      if (!swatch) return;
      const input = $('#visual-editor').elements[swatch.dataset.appearanceSwatch];
      if (!input) return;
      input.value = swatch.dataset.appearanceColor;
      onAppearanceFormChange(swatch.dataset.appearanceSwatch);
    });
    $('#visual-editor').addEventListener('input', event => {
      if (event.target.dataset.iconInput) renderIconGallery();
      if (['background', 'roomFill', 'roomColor'].includes(event.target.name)) onAppearanceFormChange(event.target.name);
    });
    $('#visual-editor').addEventListener('change', event => {
      if (event.target.name === 'theme') onAppearanceFormChange('theme');
    });
    $$('.editor-tabs button').forEach(button => button.addEventListener('click', () => {
      if (activeEditorTab === 'json' && button.dataset.tab !== 'json') {
        try { populateEditor(validateConfig(JSON.parse($('#json-textarea').value))); } catch {}
      }
      activeEditorTab = button.dataset.tab;
      $$('.editor-tabs button').forEach(item => item.classList.toggle('active', item === button));
      $('#visual-editor').hidden = activeEditorTab !== 'visual';
      $('#json-editor').hidden = activeEditorTab !== 'json';
      $('#character-editor').hidden = activeEditorTab !== 'characters';
      $('#room-editor').hidden = activeEditorTab !== 'room';
      syncStudioChrome();
      if (activeEditorTab === 'json') $('#json-textarea').value = JSON.stringify(scenarioFromVisual(), null, 2);
      if (activeEditorTab === 'characters') renderCharacterEditor();
      if (activeEditorTab === 'room') renderRoomEditor();
    }));
    $('#room-editor').addEventListener('click', event => {
      const furn = event.target.closest('[data-add-furn]');
      if (furn) { addFurniture(furn.dataset.addFurn); return; }
      const spot = event.target.closest('[data-add-spot]');
      if (spot) { addStation(spot.dataset.addSpot); return; }
      if (event.target.closest('#delete-layout-btn')) { deleteSelectedLayoutItem(); return; }
      const swatch = event.target.closest('[data-layout-swatch]');
      if (swatch) { updateSelectedLayout({ color: swatch.dataset.layoutSwatch }); return; }
    });
    $('#room-editor').addEventListener('change', event => {
      if (event.target.dataset.layoutFlip !== undefined) updateSelectedLayout({ flip: event.target.checked });
      if (event.target.dataset.layoutRole) updateSelectedLayout({ role: event.target.value });
    });
    $('#room-editor').addEventListener('input', event => {
      if (event.target.dataset.layoutColor) updateSelectedLayout({ color: event.target.value }, { keepInspector: true });
      if (event.target.dataset.layoutMin) updateSelectedLayout({ minShare: Number(event.target.value) }, { keepInspector: true });
      if (event.target.dataset.layoutMax) updateSelectedLayout({ maxShare: Number(event.target.value) }, { keepInspector: true });
      if (event.target.dataset.layoutW) updateSelectedLayout({ w: Number(event.target.value) }, { keepInspector: true });
      if (event.target.dataset.layoutH) updateSelectedLayout({ h: Number(event.target.value) }, { keepInspector: true });
    });
    $('#layout-stage').addEventListener('pointerdown', event => {
      const item = event.target.closest('[data-layout-id]');
      if (!item) {
        selectedLayoutKind = '';
        selectedLayoutId = null;
        $$('#layout-stage [data-layout-id]').forEach(el => el.classList.remove('selected'));
        renderLayoutInspector();
        return;
      }
      const alreadySelected = item.classList.contains('selected');
      selectedLayoutKind = item.dataset.layoutKind;
      selectedLayoutId = item.dataset.layoutId;
      $$('#layout-stage [data-layout-id]').forEach(el => el.classList.toggle('selected', el.dataset.layoutId === selectedLayoutId));
      renderLayoutInspector();
      const current = selectedLayoutItem();
      if (!current) return;
      const handle = event.target.closest('[data-resize]')?.dataset.resize
        || (alreadySelected && item.dataset.layoutKind === 'furniture' ? resizeHandleFromPoint(event, item) : '');
      const origin = pointerToLayoutPercent(event, $('#layout-stage'));
      layoutDrag = {
        id: current.id,
        kind: selectedLayoutKind,
        mode: handle && selectedLayoutKind === 'furniture' ? 'resize' : 'move',
        handle,
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        offsetX: current.x - origin.x,
        offsetY: current.y - origin.y,
        start: { x: current.x, y: current.y, w: current.w, h: current.h },
        moved: false
      };
      item.setPointerCapture?.(event.pointerId);
      event.preventDefault();
    });
    window.addEventListener('pointermove', event => {
      if (!layoutDrag) return;
      const stage = $('#layout-stage');
      if (!stage || $('#room-editor')?.hidden) return;
      if (!layoutDrag.moved && Math.hypot(event.clientX - layoutDrag.x, event.clientY - layoutDrag.y) < 4) return;
      layoutDrag.moved = true;
      if (layoutDrag.mode === 'resize') {
        const patch = resizePatchFromDrag(layoutDrag, event, stage);
        if (patch) updateSelectedLayout(patch, { keepInspector: true, syncInspectorSize: true });
        return;
      }
      const point = pointerToLayoutPercent(event, stage);
      updateSelectedLayout({
        x: clamp(point.x + layoutDrag.offsetX, 4, 96),
        y: clamp(point.y + layoutDrag.offsetY, 12, 96)
      }, { keepInspector: true });
    });
    window.addEventListener('pointerup', () => {
      if (layoutDrag?.moved) {
        renderLayoutStage();
        renderLayoutInspector();
      }
      layoutDrag = null;
    });
    window.addEventListener('pointercancel', () => { layoutDrag = null; });
    $('#add-staff-look-btn').addEventListener('click', () => addEditorLook('staff', randomLook('staff', editorLooks.staff)));
    $('#add-customer-look-btn').addEventListener('click', () => addEditorLook('customers', randomLook('customers', editorLooks.customers)));
    $('#character-editor').addEventListener('click', event => {
      const card = event.target.closest('.look-card');
      if (!card) return;
      selectedLookKind = card.dataset.lookKind;
      selectedLookId = card.dataset.lookId;
      renderCharacterEditor();
    });
    $('#look-inspector').addEventListener('click', event => {
      if (event.target.closest('#duplicate-look-btn')) { duplicateSelectedLook(); return; }
      if (event.target.closest('#delete-look-btn')) { deleteSelectedLook(); return; }
      const shape = event.target.closest('[data-look-field]');
      if (shape) {
        updateSelectedLook({ [shape.dataset.lookField]: shape.dataset.lookValue });
        return;
      }
      const swatch = event.target.closest('[data-look-color-swatch]');
      if (swatch) updateSelectedLook({ [swatch.dataset.lookColorSwatch]: swatch.dataset.lookValue });
    });
    $('#look-inspector').addEventListener('input', event => {
      if (event.target.dataset.lookColor) updateSelectedLook({ [event.target.dataset.lookColor]: event.target.value }, { keepInspector: true });
      if (event.target.dataset.lookIcon !== undefined) updateSelectedLook({ icon: event.target.value }, { keepInspector: true });
    });
    $('#json-textarea').addEventListener('input', () => {
      try { JSON.parse($('#json-textarea').value); $('#json-error').textContent = ''; }
      catch (error) { $('#json-error').textContent = error.message; }
    });
    $('#save-scenario-btn').addEventListener('click', saveEditedScenario);
    $('#preserve-reconfigure-checkbox').addEventListener('change', event => {
      preserveOnReconfigure = event.target.checked;
      if (db) idb('preferences', 'readwrite', store => store.put(preserveOnReconfigure, 'preserveOnReconfigure'));
    });
    $('#reset-progress-btn').addEventListener('click', resetProgress);
    $('#export-config-btn').addEventListener('click', exportScenario);
    $('#import-config-input').addEventListener('change', event => { if (event.target.files[0]) importScenario(event.target.files[0]); event.target.value = ''; });
    window.addEventListener('resize', updateEntityPositions);
    window.addEventListener('beforeunload', saveGame);
    document.addEventListener('visibilitychange', () => { if (document.hidden) saveGame(); });
    document.addEventListener('keydown', event => {
      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (!$('#studio-modal').hidden && activeEditorTab === 'room' && selectedLayoutId && !['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName)) {
          event.preventDefault();
          deleteSelectedLayoutItem();
          return;
        }
      }
      if (event.key !== 'Escape') return;
      if (!$('#floor-manager-modal').hidden) closeFloorManager();
      else if (!$('#studio-modal').hidden) closeStudio();
    });
  }

  function pluralize(word, lang) {
    if (lang === 'ja') return word;
    if (lang === 'pt') return /[rslz]$/i.test(word) ? `${word}es` : `${word}s`;
    return /s$/i.test(word) ? word : `${word}s`;
  }

  function capitalize(value) {
    return value ? value.charAt(0).toLocaleUpperCase(language) + value.slice(1) : '';
  }

  function localized(value) {
    if (typeof value === 'string') return value;
    return value?.[language] || value?.en || '';
  }

  function random(min, max) { return Number(min) + Math.random() * (Number(max) - Number(min)); }
  function escapeHtml(value) { return String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]); }

  async function init() {
    try {
      db = await openDatabase();
      await seedScenarios();
      scenarios = await idb('scenarios', 'readonly', store => store.getAll());
      const savedLanguage = await idb('preferences', 'readonly', store => store.get('language'));
      const activeScenario = await idb('preferences', 'readonly', store => store.get('activeScenario'));
      const savedPreserveOnReconfigure = await idb('preferences', 'readonly', store => store.get('preserveOnReconfigure'));
      const savedTheme = await idb('preferences', 'readonly', store => store.get('theme'));
      language = savedLanguage || (navigator.language.startsWith('pt') ? 'pt' : navigator.language.startsWith('ja') ? 'ja' : 'en');
      preserveOnReconfigure = savedPreserveOnReconfigure !== false;
      userTheme = savedTheme === 'light' ? 'light' : 'dark';
      bindEvents();
      await loadScenario(activeScenario || 'academy');
      setLanguage(language);
      requestAnimationFrame(gameLoop);
    } catch (error) {
      console.error(error);
      document.body.innerHTML = `<main style="padding:40px;color:white;font-family:system-ui"><h1>Service Floor Tycoon</h1><p>IndexedDB could not be initialized.</p><pre>${escapeHtml(error.message)}</pre></main>`;
    }
  }

  init();
})();
