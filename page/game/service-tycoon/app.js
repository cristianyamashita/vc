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

  const I18N = {
    en: {
      managementGame: 'MANAGEMENT GAME', cash: 'Cash', earned: 'Earned', staff: '{staffPlural}', served: '{customerPlural} served', waiting: 'Waiting',
      gameStats: 'Game statistics', language: 'Language', gameControls: 'Game controls', pause: 'Pause', floorPlan: 'Floor plan', close: 'Close',
      scenarioStudio: 'Scenario studio', hireStaff: 'Hire {staff}', openRoom: 'Open {room}', trainStaff: 'Train team', saved: 'Saved', saving: 'Saving…', floor: 'FLOOR', open: 'OPEN',
      addWaitingChairs: 'Add waiting chairs', addLoungeChairs: 'Add lounge chairs', chairsAdded: '{count} chairs added', maximum: 'MAX',
      addElevator: 'Add elevator', upgradeElevator: 'Faster elevators', elevatorAdded: 'Elevator added', elevatorUpgraded: 'Elevators upgraded to level {level}', elevators: 'ELEVATORS',
      elevator: 'ELEVATOR', waitingRoom: 'WAITING ROOM', staffLounge: '{staff} LOUNGE', selectedRoom: 'SELECTED {room}', roomLevel: '{room} level', equipment: 'Equipment', revenue: 'Revenue', manageFloor: 'Floor upgrades', floorUpgradeHint: 'Upgrade several rooms without leaving this panel.', openRooms: 'Open rooms', notOpened: 'Not opened', upgradeAllRooms: 'Upgrade all rooms + equipment', allRoomsUpgraded: 'All rooms and equipment upgraded',
      upgradeRoom: 'Upgrade {room}', upgradeEquipment: 'Upgrade equipment', customizeEverything: 'CUSTOMIZE EVERYTHING', yourScenarios: 'Your scenarios', newScenario: 'New', importJson: 'Import JSON', exportJson: 'Export JSON',
      quickEdit: 'Quick edit', documentation: 'Documentation ↗', scenarioName: 'Scenario name', currencySymbol: 'Currency symbol', scenarioIcon: 'Scenario icon', customerIcon: 'Customer icon', staffIcon: 'Staff icon', roomIcon: 'Room icon', equipmentIcon: 'Equipment icon', activityIcon: 'Activity icon',
      iconGallery: 'Icon gallery', searchIcons: 'Search icons…', iconResults: '{count} icons', noIcons: 'No icons found', chooseIcon: 'Choose icon', iconPeople: 'People', iconEducation: 'Education', iconBusiness: 'Business & service', iconPlaces: 'Rooms & places', iconFood: 'Food & hospitality', iconTransport: 'Transport', iconObjects: 'Objects & equipment', iconSymbols: 'Symbols & shapes',
      minDuration: 'Min. duration (sec)', maxDuration: 'Max. duration (sec)', baseRevenue: 'Base revenue', arrivalRate: 'Arrival interval (sec)', staffPerRoom: 'Staff per service', waitingCapacity: 'Maximum waiting chairs', floorColumns: 'Rooms horizontally', floorRows: 'Rooms vertically',
      staffServicePosition: 'Staff during service', insideRoom: 'Inside room', outsideRoom: 'Outside room', restPolicy: 'Rest policy', restWhenEmpty: 'Only when queue is empty', timedBreak: 'Timed 3–5 sec break',
      restMin: 'Minimum break (sec)', restMax: 'Maximum break (sec)',
      maxElevators: 'Maximum elevators', elevatorTravelTime: 'Base elevator time (sec)',
      labels: 'Labels (EN / PT / JP)', customerSingular: 'Customer', staffSingular: 'Staff', roomSingular: 'Room', jsonHint: 'Advanced mode: edit the complete scenario. Invalid JSON cannot be saved.',
      resetProgress: 'Reset progress', preserveReconfigure: 'Preserve value when reconfiguring', preserveReconfigureHelp: 'Purchased rooms, upgrades and facilities return to cash. Uncheck to reset everything.', saveAndPlay: 'Save & play', empty: 'EMPTY', busy: 'BUSY', locked: 'AVAILABLE', level: 'LV.',
      notEnoughCash: 'Not enough cash', hired: '{staff} hired', roomOpened: '{room} opened', teamUpgraded: 'Team upgraded to level {level}', roomUpgraded: '{room} upgraded', equipmentUpgraded: 'Equipment upgraded',
      scenarioSaved: 'Scenario saved', assetsLiquidated: '{amount} recovered from purchased resources', scenarioImported: 'Scenario imported', invalidConfig: 'Invalid scenario configuration', resetConfirm: 'Reset all progress for this scenario?', newScenarioName: 'My new scenario',
      preset: 'Built-in example', custom: 'Custom scenario', paused: 'Paused', queueFull: 'Waiting room full', servicePaid: '+{amount}', teacher: 'teacher', student: 'student', classroom: 'classroom'
    },
    pt: {
      managementGame: 'JOGO DE GESTÃO', cash: 'Caixa', earned: 'Faturamento', staff: '{staffPlural}', served: '{customerPlural} atendidos', waiting: 'Na espera',
      gameStats: 'Estatísticas do jogo', language: 'Idioma', gameControls: 'Controles do jogo', pause: 'Pausar', floorPlan: 'Planta do andar', close: 'Fechar',
      scenarioStudio: 'Estúdio de cenários', hireStaff: 'Contratar {staff}', openRoom: 'Abrir {room}', trainStaff: 'Treinar equipe', saved: 'Salvo', saving: 'Salvando…', floor: 'ANDAR', open: 'ABERTO',
      addWaitingChairs: 'Adicionar cadeiras de espera', addLoungeChairs: 'Adicionar cadeiras de descanso', chairsAdded: '{count} cadeiras adicionadas', maximum: 'MÁX.',
      addElevator: 'Adicionar elevador', upgradeElevator: 'Elevadores mais rápidos', elevatorAdded: 'Elevador adicionado', elevatorUpgraded: 'Elevadores melhorados para o nível {level}', elevators: 'ELEVADORES',
      elevator: 'ELEVADOR', waitingRoom: 'SALA DE ESPERA', staffLounge: 'DESCANSO — {staff}', selectedRoom: '{room} SELECIONADA', roomLevel: 'Nível da {room}', equipment: 'Equipamentos', revenue: 'Receita', manageFloor: 'Melhorias do andar', floorUpgradeHint: 'Melhore várias salas sem fechar este painel.', openRooms: 'Salas abertas', notOpened: 'Não aberta', upgradeAllRooms: 'Melhorar todas as salas + equipamentos', allRoomsUpgraded: 'Todas as salas e equipamentos foram melhorados',
      upgradeRoom: 'Melhorar {room}', upgradeEquipment: 'Melhorar equipamentos', customizeEverything: 'CUSTOMIZE TUDO', yourScenarios: 'Seus cenários', newScenario: 'Novo', importJson: 'Importar JSON', exportJson: 'Exportar JSON',
      quickEdit: 'Edição rápida', documentation: 'Documentação ↗', scenarioName: 'Nome do cenário', currencySymbol: 'Símbolo da moeda', scenarioIcon: 'Ícone do cenário', customerIcon: 'Ícone do cliente', staffIcon: 'Ícone da equipe', roomIcon: 'Ícone da sala', equipmentIcon: 'Ícone do equipamento', activityIcon: 'Ícone da atividade',
      iconGallery: 'Galeria de ícones', searchIcons: 'Buscar ícones…', iconResults: '{count} ícones', noIcons: 'Nenhum ícone encontrado', chooseIcon: 'Selecionar ícone', iconPeople: 'Pessoas', iconEducation: 'Educação', iconBusiness: 'Negócios e serviços', iconPlaces: 'Salas e lugares', iconFood: 'Alimentação e hotelaria', iconTransport: 'Transporte', iconObjects: 'Objetos e equipamentos', iconSymbols: 'Símbolos e formas',
      minDuration: 'Duração mín. (seg)', maxDuration: 'Duração máx. (seg)', baseRevenue: 'Receita base', arrivalRate: 'Intervalo de chegada (seg)', staffPerRoom: 'Equipe por atendimento', waitingCapacity: 'Máximo de cadeiras de espera', floorColumns: 'Salas na horizontal', floorRows: 'Salas na vertical',
      staffServicePosition: 'Equipe durante o atendimento', insideRoom: 'Dentro da sala', outsideRoom: 'Fora da sala', restPolicy: 'Política de descanso', restWhenEmpty: 'Somente com fila vazia', timedBreak: 'Pausa de 3–5 segundos',
      restMin: 'Pausa mínima (seg)', restMax: 'Pausa máxima (seg)',
      maxElevators: 'Máximo de elevadores', elevatorTravelTime: 'Tempo-base do elevador (seg)',
      labels: 'Nomes (EN / PT / JP)', customerSingular: 'Cliente', staffSingular: 'Equipe', roomSingular: 'Sala', jsonHint: 'Modo avançado: edite o cenário completo. JSON inválido não pode ser salvo.',
      resetProgress: 'Zerar progresso', preserveReconfigure: 'Manter valor ao reconfigurar', preserveReconfigureHelp: 'Salas, upgrades e instalações compradas voltam para o caixa. Desmarque para zerar tudo.', saveAndPlay: 'Salvar e jogar', empty: 'VAZIA', busy: 'OCUPADA', locked: 'DISPONÍVEL', level: 'NV.',
      notEnoughCash: 'Dinheiro insuficiente', hired: '{staff} contratado', roomOpened: '{room} aberta', teamUpgraded: 'Equipe melhorada para o nível {level}', roomUpgraded: '{room} melhorada', equipmentUpgraded: 'Equipamento melhorado',
      scenarioSaved: 'Cenário salvo', assetsLiquidated: '{amount} recuperados dos recursos comprados', scenarioImported: 'Cenário importado', invalidConfig: 'Configuração de cenário inválida', resetConfirm: 'Zerar todo o progresso deste cenário?', newScenarioName: 'Meu novo cenário',
      preset: 'Exemplo incluído', custom: 'Cenário personalizado', paused: 'Pausado', queueFull: 'Sala de espera lotada', servicePaid: '+{amount}', teacher: 'professor', student: 'aluno', classroom: 'sala'
    },
    ja: {
      managementGame: '経営シミュレーション', cash: '所持金', earned: '総収益', staff: '{staffPlural}', served: '対応した{customerPlural}', waiting: '待機中',
      gameStats: 'ゲーム統計', language: '言語', gameControls: 'ゲーム操作', pause: '一時停止', floorPlan: 'フロア図', close: '閉じる',
      scenarioStudio: 'シナリオスタジオ', hireStaff: '{staff}を雇う', openRoom: '{room}を開く', trainStaff: 'スタッフ研修', saved: '保存済み', saving: '保存中…', floor: 'フロア', open: '営業中',
      addWaitingChairs: '待合椅子を追加', addLoungeChairs: 'ラウンジ椅子を追加', chairsAdded: '椅子を{count}脚追加しました', maximum: '最大',
      addElevator: 'エレベーターを追加', upgradeElevator: 'エレベーター高速化', elevatorAdded: 'エレベーターを追加しました', elevatorUpgraded: 'エレベーターがレベル{level}になりました', elevators: 'エレベーター',
      elevator: 'エレベーター', waitingRoom: '待合室', staffLounge: '{staff}ラウンジ', selectedRoom: '選択中の{room}', roomLevel: '{room}レベル', equipment: '設備', revenue: '収益', manageFloor: 'フロアアップグレード', floorUpgradeHint: 'このパネルを閉じずに複数の部屋をアップグレードできます。', openRooms: '営業中の部屋', notOpened: '未開放', upgradeAllRooms: 'すべての部屋と設備をアップグレード', allRoomsUpgraded: 'すべての部屋と設備をアップグレードしました',
      upgradeRoom: '{room}をアップグレード', upgradeEquipment: '設備をアップグレード', customizeEverything: 'すべてカスタマイズ', yourScenarios: 'シナリオ', newScenario: '新規', importJson: 'JSON読込', exportJson: 'JSON出力',
      quickEdit: '簡単編集', documentation: 'ドキュメント ↗', scenarioName: 'シナリオ名', currencySymbol: '通貨記号', scenarioIcon: 'シナリオアイコン', customerIcon: '顧客アイコン', staffIcon: 'スタッフアイコン', roomIcon: '部屋アイコン', equipmentIcon: '設備アイコン', activityIcon: '活動アイコン',
      iconGallery: 'アイコンギャラリー', searchIcons: 'アイコンを検索…', iconResults: '{count}個のアイコン', noIcons: 'アイコンが見つかりません', chooseIcon: 'アイコンを選択', iconPeople: '人物', iconEducation: '教育', iconBusiness: 'ビジネスとサービス', iconPlaces: '部屋と場所', iconFood: '食事とホスピタリティ', iconTransport: '交通', iconObjects: '物と設備', iconSymbols: '記号と図形',
      minDuration: '最短時間（秒）', maxDuration: '最長時間（秒）', baseRevenue: '基本収益', arrivalRate: '到着間隔（秒）', staffPerRoom: 'サービス毎のスタッフ数', waitingCapacity: '待合椅子の最大数', floorColumns: '横方向の部屋数', floorRows: '縦方向の部屋数',
      staffServicePosition: 'サービス中のスタッフ', insideRoom: '部屋の中', outsideRoom: '部屋の外', restPolicy: '休憩ルール', restWhenEmpty: '待ち列が空の時のみ', timedBreak: '3〜5秒の休憩',
      restMin: '最短休憩（秒）', restMax: '最長休憩（秒）',
      maxElevators: 'エレベーター最大数', elevatorTravelTime: '基本移動時間（秒）',
      labels: '名称 (EN / PT / JP)', customerSingular: '顧客', staffSingular: 'スタッフ', roomSingular: '部屋', jsonHint: '上級モード：シナリオ全体を編集します。無効なJSONは保存できません。',
      resetProgress: '進行をリセット', preserveReconfigure: '再設定時に資産価値を維持', preserveReconfigureHelp: '購入した部屋、アップグレード、設備を現金に戻します。チェックを外すとすべてリセットされます。', saveAndPlay: '保存してプレイ', empty: '空室', busy: '使用中', locked: '利用可能', level: 'LV.',
      notEnoughCash: '資金が足りません', hired: '{staff}を雇いました', roomOpened: '{room}を開きました', teamUpgraded: 'チームがレベル{level}になりました', roomUpgraded: '{room}をアップグレードしました', equipmentUpgraded: '設備をアップグレードしました',
      scenarioSaved: 'シナリオを保存しました', assetsLiquidated: '購入済み資産から{amount}を回収しました', scenarioImported: 'シナリオを読み込みました', invalidConfig: 'シナリオ設定が無効です', resetConfirm: 'このシナリオの進行をすべてリセットしますか？', newScenarioName: '新しいシナリオ',
      preset: '標準サンプル', custom: 'カスタムシナリオ', paused: '一時停止', queueFull: '待合室が満員です', servicePaid: '+{amount}', teacher: '先生', student: '生徒', classroom: '教室'
    }
  };

  const PRESETS = [
    {
      id: 'academy', name: 'Bright Path Academy', builtIn: true, icon: '📚', currencySymbol: '$', color: '#44d7c2', floor: { columns: 5, rows: 5 },
      icons: { customer: '●', staff: '✦', room: '▤', equipment: '▰' },
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
      icons: { customer: '●', staff: '✦', room: '▱', equipment: '◉' },
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
      icons: { customer: '●', staff: '✦', room: '▥', equipment: '◆' },
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
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

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
      const next = current ? mergeDefaults(current, preset) : deepCopy(preset);
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
      staff: Array.from({ length: startingStaff }, (_, index) => ({ id: index + 1, status: 'idle' })),
      rooms: Array.from({ length: startingRooms }, (_, index) => ({ id: index + 1, level: 1, equipmentLevel: 1, status: 'empty' })),
      savedAt: Date.now()
    };
  }

  async function loadScenario(id, fresh = false, skipCurrentSave = false) {
    if (!skipCurrentSave) await saveGame();
    config = scenarios.find(item => item.id === id) || scenarios[0];
    const saved = fresh ? null : await idb('saves', 'readonly', store => store.get(config.id));
    state = saved || defaultState(config);
    const defaults = defaultState(config);
    state.waitingSeats = clamp(Number(state.waitingSeats) || defaults.waitingSeats, 1, Number(config.facilities?.waiting?.maxSeats) || config.simulation.waitingCapacity);
    state.loungeSeats = clamp(Number(state.loungeSeats) || defaults.loungeSeats, 1, Number(config.facilities?.lounge?.maxSeats) || 12);
    state.elevatorCount = clamp(Number(state.elevatorCount) || defaults.elevatorCount, 1, Number(config.facilities?.elevators?.maxCount) || 6);
    state.elevatorLevel = Math.max(1, Number(state.elevatorLevel) || 1);
    state.staff = (state.staff?.length ? state.staff : [{ id: 1 }]).map((member, index) => ({ id: member.id || index + 1, status: 'idle', location: 'lounge' }));
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
    snapshot.staff = snapshot.staff.map(member => ({ id: member.id, status: 'idle' }));
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
    $('#scenario-title').textContent = config.name;
    document.title = `${config.name} — Service Floor Tycoon`;
    document.documentElement.style.setProperty('--accent-2', config.color || '#44d7c2');
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
        element.style.setProperty('--room-color', config.color);
        element.style.setProperty('--progress', `${room.progress || 0}%`);
        const activityName = activeJob ? localized(activeJob.activity.name) : '';
        element.innerHTML = `<span class="room-head"><span class="room-name"><span class="room-number">${String(index).padStart(2, '0')}</span><strong>${escapeHtml(capitalize(label('room')))} ${String(index).padStart(2, '0')}</strong></span><span class="room-status"><i></i>${t(room.status === 'busy' ? 'busy' : 'empty')}</span></span><span class="room-center" title="${escapeHtml(activityName)}"><b>${escapeHtml(activeJob?.activity?.icon || config.icons.room)}</b>${activityName ? `<small>${escapeHtml(activityName)}</small>` : ''}</span><span class="room-level">${t('level')} ${room.level} · ${escapeHtml(equipment?.icon || config.icons.equipment)} ${room.equipmentLevel}</span><span class="room-door" aria-hidden="true"><i></i></span><span class="room-progress"></span>`;
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

  function createPerson(type, id) {
    const element = document.createElement('div');
    element.className = `person ${type}`;
    element.id = `person-${type}-${id}`;
    element.innerHTML = `<span class="person-icon">${escapeHtml(type === 'staff' ? config.icons.staff : config.icons.customer)}</span>`;
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
    const roomOffsets = [[-13, 0], [13, 0], [0, 16], [-18, 16], [18, 16], [0, -15]];
    const [offsetX, offsetY] = roomOffsets[slot] || [0, 0];
    return { x: rect.left + rect.width / 2 + offsetX, y: rect.top + rect.height * .62 + offsetY };
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
    const customer = { id, status: 'elevator', timer: elevatorTravelTime(), seatIndex, elevatorIndex };
    customers.push(customer);
    const element = createPerson('customer', id);
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
      let element = $(`#person-staff-${member.id}`);
      if (!element) element = createPerson('staff', member.id);
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
      job.phase = 'toRoom';
      customer.status = 'toRoom';
      const customerDuration = moveAlongRoute($(`#person-customer-${customer.id}`), routeGroundToRoom('waiting', room.id, getPoint('room', room.id, 0)), config.simulation.walkDuration, escortFollowDelay());
      const staffDurations = staff.map((member, index) => {
        const positionKind = (config.routing?.staffServicePosition || 'inside') === 'outside' ? 'roomDoor' : 'room';
        const destination = getPoint(positionKind, room.id, index + 1);
        member.location = positionKind === 'room' ? 'room' : 'roomDoor';
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
      state.staff.push({ id, status: 'idle' });
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
    paused = true;
    $('#pause-btn').classList.add('active');
  }

  function closeStudio() {
    $('#studio-modal').hidden = true;
    paused = false;
    $('#pause-btn').classList.remove('active');
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
    const form = $('#visual-editor');
    form.elements.name.value = scenario.name;
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
    renderIconGallery();
  }

  function scenarioFromVisual() {
    const source = deepCopy(scenarios.find(item => item.id === editingScenarioId) || config);
    const form = $('#visual-editor');
    source.name = form.elements.name.value.trim() || t('newScenarioName');
    source.currencySymbol = form.elements.currencySymbol.value.trim() || '$';
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
    return validateConfig(source);
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
    $('#visual-editor').addEventListener('input', event => {
      if (event.target.dataset.iconInput) renderIconGallery();
    });
    $$('.editor-tabs button').forEach(button => button.addEventListener('click', () => {
      activeEditorTab = button.dataset.tab;
      $$('.editor-tabs button').forEach(item => item.classList.toggle('active', item === button));
      $('#visual-editor').hidden = activeEditorTab !== 'visual';
      $('#json-editor').hidden = activeEditorTab !== 'json';
      if (activeEditorTab === 'json') $('#json-textarea').value = JSON.stringify(scenarioFromVisual(), null, 2);
    }));
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
      language = savedLanguage || (navigator.language.startsWith('pt') ? 'pt' : navigator.language.startsWith('ja') ? 'ja' : 'en');
      preserveOnReconfigure = savedPreserveOnReconfigure !== false;
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
