// Armored Convoy: a self-contained, fixed-step turret-defense campaign.
const $ = id => document.getElementById(id);
const STORAGE = 'vc-armored-convoy-v1';
const messages = {
  en: {
    title:'Armored Convoy',restart:'Restart mission',pause:'Pause / resume (P)',sound:'Sound',help:'Help (?)',theme:'Light / dark theme',close:'Close',language:'Language',integrity:'Convoy armor',sector:'Sector',score:'Score',heat:'Weapon heat',rocket:'Rocket',shield:'Shield',fire:'Fire',difficulty:'Difficulty',easy:'Recruit',normal:'Veteran',hard:'Elite',start:'Deploy convoy',retry:'Try again',unavailable:'3D unavailable',loadError:'The 3D engine could not load. Check your internet connection and WebGL support, then try again.',helpTitle:'Mission manual',brief:'Escort three trucks through the canyon, refinery and night pass. Protect the cargo and reach the extraction zone.',loading:'Preparing the convoy…',ready:'Convoy ready',paused:'Mission paused',pausedDesc:'Your convoy is safe while paused.',resume:'Continue mission',victory:'Convoy extracted',victoryDesc:'All three sectors are secure. Your cargo has reached the outpost.',defeat:'Convoy disabled',defeatDesc:'The escort armor was depleted. Try using cover fire, rockets and the shield.',again:'New mission',record:'Best',distance:'Route',escort:'Protect the convoy',clear:'Clear remaining threats',sectorNames:['Red canyon','Oil frontier','Night pass'],kills:'Destroyed',accuracy:'Accuracy',complete:'Sector secured',upgradeBrief:'Field repair restored 20 armor. Choose one upgrade before continuing.',upgradeDamage:'Hardened rounds',upgradeDamageDesc:'+25% cannon damage for the remaining mission.',upgradeCooling:'Cooling system',upgradeCoolingDesc:'+35% heat recovery and faster firing.',upgradeRepair:'Support supplies',upgradeRepairDesc:'+35 armor and two additional rockets.',overheat:'OVERHEATED · release to cool',rocketEmpty:'No rockets remaining',shieldReady:'Shield ready',shieldActive:'SHIELD ACTIVE',boss:'Heavy raider incoming',pickup:'Supply recovered',armor:'Armor',readyText:'Ready',shieldWait:'Shield recharging',objectiveHelp:'Mission',objectiveText:'Survive three 900 m sectors. At the end of each sector, destroy the remaining vehicles before choosing an upgrade. In sector three an armored raider guards the exit. All convoy vehicles share one armor pool.',controlsHelp:'Controls',moveHelp:'Move the convoy left / right',aimHelp:'Aim the turret',fireHelp:'Fire cannon',rocketHelp:'Fire explosive rocket',shieldHelp:'Activate 4-second shield',pauseHelp:'Pause / resume',helpHelp:'Open this manual',touchHelp:'Touch: drag on the scene to aim and fire; the arrows steer. You can also hold Fire and use the rocket/shield buttons.',tacticsHelp:'Field tactics',tacticsText:'Short bursts prevent overheating. Rockets damage enemies in an area and destroy roadblocks. Intercept red missiles before they reach the trucks. Move out of warning lanes, collect green supplies and use the shield when surrounded. The heavy raider exposes its orange core between bursts. Difficulty affects incoming damage and enemy spawn rate.',saveHelp:'Records & preferences',saveText:'Best scores for each difficulty, victories, language, theme and sound stay in this browser and are included in the collection backup. A new mission starts from sector one.',left:'Move left',right:'Move right',scene:'Convoy battlefield',shots:'Shots',blocked:'Armor deflected',core:'Core exposed',restartTitle:'Restart the mission?',restartText:'Current mission progress will be reset. Your records will be kept.',cancel:'Keep playing',confirm:'Restart',volume:'Volume',speed:'Route speed'
  },
  pt: {
    title:'Comboio Blindado',restart:'Reiniciar missão',pause:'Pausar / continuar (P)',sound:'Som',help:'Ajuda (?)',theme:'Tema claro / escuro',close:'Fechar',language:'Idioma',integrity:'Blindagem do comboio',sector:'Setor',score:'Pontos',heat:'Temperatura',rocket:'Foguete',shield:'Escudo',fire:'Atirar',difficulty:'Dificuldade',easy:'Recruta',normal:'Veterano',hard:'Elite',start:'Iniciar missão',retry:'Tentar novamente',unavailable:'3D indisponível',loadError:'Não foi possível carregar o motor 3D. Verifique a conexão com a internet e o suporte a WebGL e tente novamente.',helpTitle:'Manual de missão',brief:'Escolte três caminhões pelo cânion, refinaria e passagem noturna. Proteja a carga e chegue à zona de extração.',loading:'Preparando o comboio…',ready:'Comboio pronto',paused:'Missão pausada',pausedDesc:'Seu comboio está seguro durante a pausa.',resume:'Continuar missão',victory:'Comboio resgatado',victoryDesc:'Os três setores estão seguros. Sua carga chegou ao posto avançado.',defeat:'Comboio destruído',defeatDesc:'A blindagem da escolta se esgotou. Use tiros de cobertura, foguetes e o escudo.',again:'Nova missão',record:'Recorde',distance:'Rota',escort:'Proteja o comboio',clear:'Elimine as ameaças restantes',sectorNames:['Cânion vermelho','Fronteira petrolífera','Passagem noturna'],kills:'Destruídos',accuracy:'Precisão',complete:'Setor protegido',upgradeBrief:'O reparo de campo restaurou 20 de blindagem. Escolha uma melhoria para continuar.',upgradeDamage:'Munição reforçada',upgradeDamageDesc:'+25% de dano do canhão pelo restante da missão.',upgradeCooling:'Sistema de refrigeração',upgradeCoolingDesc:'+35% de resfriamento e disparos mais rápidos.',upgradeRepair:'Suprimentos de apoio',upgradeRepairDesc:'+35 de blindagem e dois foguetes adicionais.',overheat:'SUPERAQUECIDO · solte para resfriar',rocketEmpty:'Sem foguetes restantes',shieldReady:'Escudo pronto',shieldActive:'ESCUDO ATIVO',boss:'Saqueador pesado se aproximando',pickup:'Suprimento coletado',armor:'Blindagem',readyText:'Pronto',shieldWait:'Escudo recarregando',objectiveHelp:'Missão',objectiveText:'Sobreviva a três setores de 900 m. No final de cada setor, destrua os veículos restantes antes de escolher uma melhoria. Um saqueador blindado protege a saída no terceiro setor. Os caminhões compartilham a mesma blindagem.',controlsHelp:'Controles',moveHelp:'Mover o comboio para os lados',aimHelp:'Mirar a torre',fireHelp:'Disparar o canhão',rocketHelp:'Lançar foguete explosivo',shieldHelp:'Ativar escudo por 4 segundos',pauseHelp:'Pausar / continuar',helpHelp:'Abrir este manual',touchHelp:'Toque: arraste no cenário para mirar e disparar; as setas dirigem. Você também pode segurar Atirar e usar os botões de foguete e escudo.',tacticsHelp:'Táticas',tacticsText:'Rajadas curtas evitam o superaquecimento. Foguetes causam dano em área e destroem bloqueios. Intercepte os mísseis vermelhos antes de chegarem aos caminhões. Desvie das faixas de alerta, colete suprimentos verdes e use o escudo quando cercado. O saqueador pesado expõe o núcleo laranja entre rajadas. A dificuldade altera o dano recebido e o ritmo de chegada dos inimigos.',saveHelp:'Recordes e preferências',saveText:'Recordes por dificuldade, vitórias, idioma, tema e som ficam neste navegador e fazem parte do backup da coleção. Uma nova missão começa no primeiro setor.',left:'Mover à esquerda',right:'Mover à direita',scene:'Campo de batalha do comboio',shots:'Disparos',blocked:'Blindagem resistiu',core:'Núcleo exposto',restartTitle:'Reiniciar a missão?',restartText:'O progresso desta missão será reiniciado. Seus recordes serão mantidos.',cancel:'Continuar jogando',confirm:'Reiniciar',volume:'Volume',speed:'Velocidade da rota'
  },
  ja: {
    title:'装甲輸送隊',restart:'任務を再開',pause:'一時停止 / 再開 (P)',sound:'サウンド',help:'ヘルプ (?)',theme:'ライト / ダーク',close:'閉じる',language:'言語',integrity:'輸送隊の装甲',sector:'区域',score:'スコア',heat:'砲身の温度',rocket:'ロケット',shield:'シールド',fire:'射撃',difficulty:'難易度',easy:'新兵',normal:'熟練',hard:'精鋭',start:'出撃',retry:'再試行',unavailable:'3Dを利用できません',loadError:'3Dエンジンを読み込めませんでした。インターネット接続とWebGL対応を確認して再試行してください。',helpTitle:'任務マニュアル',brief:'峡谷、製油所、夜の峠を進む3台のトラックを護衛します。貨物を守り、脱出地点に到達しましょう。',loading:'輸送隊を準備中…',ready:'出撃準備完了',paused:'任務を一時停止',pausedDesc:'停止中、輸送隊は攻撃されません。',resume:'任務を続ける',victory:'輸送隊が脱出',victoryDesc:'全3区域を確保し、貨物が前哨基地に到着しました。',defeat:'輸送隊が行動不能',defeatDesc:'装甲が尽きました。援護射撃、ロケット、シールドを活用しましょう。',again:'新しい任務',record:'最高記録',distance:'ルート',escort:'輸送隊を護衛',clear:'残りの敵を撃破',sectorNames:['赤い峡谷','石油地帯','夜の峠'],kills:'撃破',accuracy:'命中率',complete:'区域確保',upgradeBrief:'応急修理で装甲が20回復しました。強化を選んで続行します。',upgradeDamage:'強化弾',upgradeDamageDesc:'残りの任務で砲のダメージが25%増加。',upgradeCooling:'冷却装置',upgradeCoolingDesc:'冷却効率が35%増加し、連射速度も向上。',upgradeRepair:'補給物資',upgradeRepairDesc:'装甲35回復、ロケットを2発補充。',overheat:'過熱 · 射撃を止めて冷却',rocketEmpty:'ロケットがありません',shieldReady:'シールド使用可能',shieldActive:'シールド展開中',boss:'重装襲撃車が接近',pickup:'補給を回収',armor:'装甲',readyText:'準備完了',shieldWait:'シールド充電中',objectiveHelp:'任務',objectiveText:'900mの区域を3つ突破します。各区域の最後で残りの敵を倒して強化を選びます。第3区域の出口には重装襲撃車が待ち構えます。輸送隊の装甲は全車両で共有します。',controlsHelp:'操作',moveHelp:'輸送隊を左右に移動',aimHelp:'砲塔の照準',fireHelp:'砲を発射',rocketHelp:'爆発ロケットを発射',shieldHelp:'4秒間シールドを展開',pauseHelp:'一時停止 / 再開',helpHelp:'このマニュアルを開く',touchHelp:'タッチ：画面をドラッグして照準と射撃。矢印で移動します。射撃ボタンを押しながらロケットやシールドも使えます。',tacticsHelp:'戦術',tacticsText:'短い連射で過熱を防ぎます。ロケットは範囲ダメージを与え、障害物を破壊します。赤いミサイルを迎撃しましょう。警告レーンを避け、緑の補給を集め、囲まれたらシールドを使います。重装襲撃車は連射の合間にオレンジ色のコアを露出します。難易度は被ダメージと敵の出現頻度に影響します。',saveHelp:'記録と設定',saveText:'難易度別の記録、勝利数、言語、テーマ、音声設定はブラウザーに保存され、コレクションのバックアップに含まれます。新しい任務は第1区域から始まります。',left:'左へ移動',right:'右へ移動',scene:'輸送隊の戦場',shots:'発射数',blocked:'装甲で防御',core:'コア露出',restartTitle:'任務を最初から？',restartText:'現在の任務をリセットします。最高記録は保持されます。',cancel:'続ける',confirm:'最初から',volume:'音量',speed:'走行速度'
  }
};
let stored={};try{stored=JSON.parse(localStorage.getItem(STORAGE)||'{}')||{};}catch{}
function shared(key){try{return localStorage.getItem(key);}catch{return null;}}
let lang=['en','pt','ja'].includes(stored.lang)?stored.lang:([ 'en','pt','ja'].includes(shared('app_lang'))?shared('app_lang'):'pt');
let theme=stored.theme==='light'||stored.theme==='dark'?stored.theme:(shared('app_theme')==='light'?'light':'dark');
try{if(parent!==window&&parent.OS){if(['en','pt','ja'].includes(parent.OS.lang))lang=parent.OS.lang;if(['light','dark'].includes(parent.OS.theme))theme=parent.OS.theme;}}catch{}
let sound=stored.sound!==false;
let difficulty=['easy','normal','hard'].includes(stored.difficulty)?stored.difficulty:'normal';
let best=stored.best&&typeof stored.best==='object'?stored.best:{};
let wins=Number.isFinite(stored.wins)?Math.max(0,stored.wins):0;
const t=key=>messages[lang][key]??messages.en[key]??key;
function save(){try{localStorage.setItem(STORAGE,JSON.stringify({lang,theme,sound,difficulty,best,wins}));}catch{}}
let mode='loading', game=null, audio=null, resumeHelp=false;
let overlayType='ready';
function tone(freq=180,duration=.08,type='square',volume=.035,slide=.5){
  if(!sound)return;
  try{audio??=new (window.AudioContext||window.webkitAudioContext)();if(audio.state==='suspended')audio.resume();const o=audio.createOscillator(),g=audio.createGain();o.type=type;o.frequency.setValueAtTime(freq,audio.currentTime);o.frequency.exponentialRampToValueAtTime(Math.max(25,freq*slide),audio.currentTime+duration);g.gain.setValueAtTime(volume,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+duration);o.connect(g).connect(audio.destination);o.start();o.stop(audio.currentTime+duration);}catch{}
}
function renderHelp(){
  $('help-content').innerHTML=`<h3>${t('objectiveHelp')}</h3><p>${t('objectiveText')}</p><h3>${t('controlsHelp')}</h3><dl><dt>A / D · ← / →</dt><dd>${t('moveHelp')}</dd><dt>Mouse · I J K L</dt><dd>${t('aimHelp')}</dd><dt>Click · Space</dt><dd>${t('fireHelp')}</dd><dt>R</dt><dd>${t('rocketHelp')}</dd><dt>Q</dt><dd>${t('shieldHelp')}</dd><dt>P · Esc</dt><dd>${t('pauseHelp')}</dd><dt>?</dt><dd>${t('helpHelp')}</dd></dl><p>${t('touchHelp')}</p><h3>${t('tacticsHelp')}</h3><p>${t('tacticsText')}</p><h3>${t('saveHelp')}</h3><p>${t('saveText')}</p>`;
}
function translate(){
  document.documentElement.lang=lang;document.documentElement.dataset.theme=theme;document.title=t('title');
  document.querySelectorAll('[data-i18n]').forEach(e=>e.textContent=t(e.dataset.i18n));
  document.querySelectorAll('[data-title]').forEach(e=>{e.title=t(e.dataset.title);e.setAttribute('aria-label',t(e.dataset.title));});
  $('lang-switcher').value=lang;$('lang-switcher').setAttribute('aria-label',t('language'));$('scene').setAttribute('aria-label',t('scene'));
  document.querySelector('[data-key=a]').setAttribute('aria-label',t('left'));document.querySelector('[data-key=d]').setAttribute('aria-label',t('right'));
  $('difficulty').value=difficulty;$('sound').setAttribute('aria-pressed',String(sound));$('theme-switcher').textContent=theme==='dark'?'☼':'☾';
  renderHelp();if(mode!=='playing')showOverlay(overlayType);game?.hud();
}
function showOverlay(type){
  overlayType=type;$('overlay').hidden=false;$('results').innerHTML='';$('upgrade-options').hidden=type!=='upgrade';$('difficulty-row').hidden=type!=='ready';$('primary').hidden=type==='upgrade';
  $('overlay-badge').textContent=({ready:'◈',pause:'Ⅱ',win:'✦',lose:'◇',upgrade:'↑',restart:'↻'})[type]||'◈';
  const keys={ready:['ready','brief','start'],pause:['paused','pausedDesc','resume'],win:['victory','victoryDesc','again'],lose:['defeat','defeatDesc','again'],upgrade:['complete','upgradeBrief','resume'],restart:['restartTitle','restartText','confirm']};
  const k=keys[type]||keys.ready;$('overlay-title').textContent=t(k[0]);$('overlay-description').textContent=mode==='loading'?t('loading'):t(k[1]);$('primary').textContent=t(k[2]);$('primary').disabled=mode==='loading';
  $('record').textContent=`${t('record')} · ${Math.round(best[difficulty]||0).toLocaleString(lang)}`;
  if(type==='win'||type==='lose')for(const [label,value]of [['score',game.score],['kills',game.kills],['accuracy',`${Math.round(game.hits/Math.max(1,game.shots)*100)}%`]]){const d=document.createElement('div');d.textContent=t(label);const b=document.createElement('b');b.textContent=value;d.append(b);$('results').append(d);}
  if(type==='upgrade'){
    $('upgrade-options').replaceChildren();
    for(const kind of ['Damage','Cooling','Repair']){const b=document.createElement('button'),strong=document.createElement('strong'),span=document.createElement('span');strong.textContent=t('upgrade'+kind);span.textContent=t('upgrade'+kind+'Desc');b.append(strong,span);b.onclick=()=>game.upgrade(kind);$('upgrade-options').append(b);}
  }
  if(type==='restart'){const b=document.createElement('button');b.textContent=t('cancel');b.onclick=()=>{mode='paused';showOverlay('pause');};$('results').append(b);}
}
function setPaused(value){
  if(value&&mode==='playing'){mode='paused';game.clearInput();showOverlay('pause');}
  else if(!value&&mode==='paused'&&!$('help').open){mode='playing';$('overlay').hidden=true;game.clearInput();$('scene').focus({preventScroll:true});}
}
function openHelp(){resumeHelp=mode==='playing';setPaused(true);game?.clearInput();if(!$('help').open)$('help').showModal();}
$('help-button').onclick=openHelp;$('close-help').onclick=()=>$('help').close();
$('help').addEventListener('close',()=>{if(resumeHelp){resumeHelp=false;setPaused(false);}});
$('lang-switcher').onchange=e=>{lang=e.target.value;save();translate();};$('theme-switcher').onclick=()=>{theme=theme==='dark'?'light':'dark';save();translate();};
$('sound').onclick=()=>{sound=!sound;save();translate();if(sound)tone(440,.12,'sine');};
$('difficulty').onchange=e=>{difficulty=e.target.value;save();showOverlay('ready');};
$('pause').onclick=()=>setPaused(mode==='playing');
$('restart').onclick=()=>{if(!game)return;if(mode==='playing'||mode==='paused'){setPaused(true);showOverlay('restart');}else game.start();};
$('primary').onclick=()=>{if(!game)return;tone(440,.13,'sine',.05,1.4);if(overlayType==='pause')setPaused(false);else game.start();};
$('rocket-button').onclick=()=>game?.fireRocket();$('shield-button').onclick=()=>game?.activateShield();$('reload').onclick=()=>location.reload();
translate();

try{
  const THREE=await import('https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.module.js');
  const V=THREE.Vector3,clamp=THREE.MathUtils.clamp,rand=(a,b)=>a+Math.random()*(b-a);
  const canvas=$('scene'),stage=$('stage');
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
  const scene=new THREE.Scene();scene.background=new THREE.Color('#dba879');scene.fog=new THREE.FogExp2('#dba879',.012);
  const camera=new THREE.PerspectiveCamera(55,1,.2,230);camera.position.set(0,12,24);camera.lookAt(0,1,-18);
  const ambient=new THREE.HemisphereLight(0xc7e9f4,0x75533c,2.4);scene.add(ambient);
  const sun=new THREE.DirectionalLight(0xffdeb0,3);sun.position.set(-22,35,-28);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-45,right:45,top:70,bottom:-45,near:1,far:120});sun.shadow.bias=-.0004;scene.add(sun);sun.target.position.set(0,0,-15);scene.add(sun.target);
  const mats={};
  function mat(color,emissive=0,roughness=.8){const key=`${color}:${emissive}:${roughness}`;return mats[key]??=new THREE.MeshStandardMaterial({color,roughness,metalness:roughness<.5?.5:.12,emissive,emissiveIntensity:emissive?1.4:0});}
  const geo={box:new THREE.BoxGeometry(1,1,1),sphere:new THREE.SphereGeometry(1,10,8),cylinder:new THREE.CylinderGeometry(1,1,1,10),cone:new THREE.ConeGeometry(1,1,6)};
  function mesh(shape,color,size,pos,parent=scene,emissive=0){const m=new THREE.Mesh(geo[shape],mat(color,emissive));m.scale.set(...size);m.position.set(...pos);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
  function box(parent,color,x,y,z,w,h,d,glow=0){return mesh('box',color,[w,h,d],[x,y,z],parent,glow);}
  const road=box(scene,0x484b48,0,-.16,-40,14,.3,160);road.receiveShadow=true;
  box(scene,0xa77d55,0,-.42,-40,240,.5,230);
  for(const x of [-7.1,7.1])box(scene,0xc8bd93,x,.01,-40,.17,.025,160);
  const markings=[];for(let z=-110;z<30;z+=7)for(const x of [-2.33,2.33])markings.push(box(scene,0xe3d4a9,x,.015,z,.12,.025,2.3));
  const scenery=new THREE.Group();scene.add(scenery);const props=[];
  function makeProp(z,i){
    const g=new THREE.Group(),side=i%2?1:-1;g.position.set(side*rand(12,42),0,z);scenery.add(g);
    if(i%5===0){ // refinery pump and pipe, silhouette readable from the road
      box(g,0x6a6051,0,.35,0,3,.7,4);box(g,0x393f40,0,2,0,.35,4,.35);
      const beam=box(g,0x9e6443,0,4.1,0,.4,.4,4);beam.rotation.x=.18;
      box(g,0x313c3c,0,3.2,-1.6,.15,2.6,.15);box(g,0xb59b74,1,1.2,0,1.3,2.4,2);
    }else if(i%4===0){
      const tank=mesh('cylinder',0x7e9694,[2,4,2],[0,2,0],g);tank.castShadow=true;box(g,0xc9d0b2,0,4.2,0,4.2,.2,4.2);box(g,0x424d47,2.7,1.4,0,.25,2.8,.25);
    }else if(i%3===0){
      const cactus=0x4c6d4d;mesh('cylinder',cactus,[.28,3.8,.28],[0,1.9,0],g);box(g,cactus,.6,2,0,1.2,.4,.4);mesh('cylinder',cactus,[.2,1.4,.2],[1.05,2.65,0],g);box(g,cactus,-.5,1.2,0,1,.35,.35);mesh('cylinder',cactus,[.18,1.3,.18],[-.9,1.8,0],g);
    }else{const rock=mesh('cone',i%2?0xa97152:0xbe8c60,[rand(2,5),rand(3,7),rand(2,5)],[0,1.5,0],g);rock.rotation.y=rand(0,6);}
    props.push(g);
  }
  for(let i=0;i<50;i++)makeProp(-130+i*3.2,i);
  for(let i=0;i<18;i++){const side=i%2?1:-1;const m=mesh('cylinder',0x9b725f,[rand(9,20),rand(15,33),rand(10,20)],[side*rand(60,100),5,-100+i*9]);m.rotation.y=rand(0,6);}
  const convoy=new THREE.Group();scene.add(convoy);const wheels=[];
  function wheel(parent,x,z,size=.5){const w=mesh('cylinder',0x18232a,[size,.3,size],[x,size,z],parent);w.rotation.z=Math.PI/2;wheels.push(w);mesh('cylinder',0x738581,[size*.55,.32,size*.55],[x,size,z],parent).rotation.z=Math.PI/2;}
  function truck(z,hero=false){
    const g=new THREE.Group();g.position.z=z;convoy.add(g);
    box(g,0x172c32,0,.65,0,2.15,.45,4.7);box(g,hero?0x466e65:0x566858,0,1.5,-1.45,2.1,1.5,1.6);
    box(g,0x163944,0,1.8,-2.28,1.65,.6,.035);box(g,0x78b8b1,-1.065,1.85,-1.5,.03,.55,.9);box(g,0x78b8b1,1.065,1.85,-1.5,.03,.55,.9);
    box(g,0xc4c3a4,0,.83,-2.35,2.3,.25,.25);box(g,0x152c32,0,.9,2.2,2.2,.25,.2);
    for(const x of [-.75,.75]){box(g,0xffffca,x,1.05,-2.27,.3,.25,.1,0xffdb76);box(g,0xff3530,x,.9,2.25,.2,.15,.05,0xff2211);}
    for(const x of [-1.12,1.12])for(const wz of [-1.35,1.1,1.8])wheel(g,x,wz);
    if(hero){box(g,0x3f6966,0,1.2,.6,2.05,.8,2.5);box(g,0xd3b885,0,1.67,.9,1.7,.12,2);}
    else {box(g,0xa6926c,0,1.65,.6,2,1.7,2.8);for(const zz of [-.6,.4,1.4]){box(g,0x485951,0,2.52,zz,2.05,.07,.1);for(const xx of [-1.02,1.02])box(g,0x485951,xx,1.7,zz,.07,1.7,.1);}}
    return g;
  }
  truck(-5);const hero=truck(4,true);truck(-14);
  const turret=new THREE.Group();turret.position.set(0,1.9,.4);hero.add(turret);
  mesh('cylinder',0x264c4e,[.9,.3,.9],[0,0,0],turret);box(turret,0x557e70,0,.38,0,1.2,.6,1.3);
  for(const x of [-.25,.25])box(turret,0x182d36,x,.4,-1.1,.15,.16,1.7);
  box(turret,0x76ffe0,0,.65,-.1,.3,.1,.35,0x45cfb8);
  const flash=mesh('sphere',0xffdd91,[.45,.35,.65],[0,.4,-2],turret,0xffb347);flash.visible=false;
  const shieldMesh=new THREE.Mesh(new THREE.SphereGeometry(1,28,18),new THREE.MeshBasicMaterial({color:0x65edca,transparent:true,opacity:.16,wireframe:true}));shieldMesh.scale.set(2.7,2.6,13);shieldMesh.position.set(0,1.3,-4);convoy.add(shieldMesh);shieldMesh.visible=false;
  const entities=new THREE.Group(),fx=new THREE.Group();scene.add(entities,fx);
  const warningMaterial=new THREE.MeshBasicMaterial({color:0xff704f,transparent:true,opacity:.18,depthWrite:false});
  const ray=new THREE.Raycaster(),plane=new THREE.Plane(new V(0,1,0),-1.3),pointer=new THREE.Vector2(0,.05),aim=new V(0,1.3,-20);
  const input=new Set();let pointerDown=false,toastTime=0,reticleTime=0,shake=0,hitFlash=0;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const bullets=[],hostiles=[],enemies=[],particles=[],obstacles=[],supplies=[];
  let shotId=0;
  function notice(key){$('toast').textContent=t(key);toastTime=2;}
  function removeObject(o){o.parent?.remove(o);}
  function burst(pos,color,count=16,power=5){
    for(let i=0;i<count;i++){if(particles.length>=180)break;const size=rand(.08,.23),m=mesh('box',color,[size,size,size],pos.toArray(),fx,color);m.castShadow=false;particles.push({m,v:new V(rand(-power,power),rand(1,power),rand(-power,power)),life:rand(.25,.65),total:.65});}
  }
  function vehicle(kind){
    const g=new THREE.Group(),color=kind==='boss'?0x6b3a35:kind==='jeep'?0x985b40:0x855e42;
    if(kind==='bike'){
      box(g,0x2a353c,0,.55,0,.45,.25,1.5);for(const z of [-.6,.6]){const w=mesh('cylinder',0x18262b,[.35,.2,.35],[0,.35,z],g);w.rotation.z=Math.PI/2;}
      box(g,color,0,.8,-.25,.5,.5,.7);box(g,0x36363b,0,1.1,.15,.5,.7,.5);mesh('sphere',0xd58e61,[.25,.25,.25],[0,1.6,0],g);box(g,0xff7862,0,.95,-.8,.2,.15,.7,0x9e3021);
    }else{
      const size=kind==='boss'?1.55:1;
      box(g,0x202b31,0,.55,0,1.8,.3,3.1);box(g,color,0,1,0,1.8,.8,2.9);box(g,0x2d4249,0,1.7,-.35,1.6,.8,1.6);box(g,0x95b8bc,0,1.8,-1.17,1.3,.4,.04);
      for(const x of [-.98,.98])for(const z of [-.9,1]){const w=mesh('cylinder',0x15242c,[.45,.25,.45],[x,.45,z],g);w.rotation.z=Math.PI/2;}
      box(g,0xe5a45b,0,2.2,.5,.9,.3,1);box(g,0x332c2c,0,2.2,-.1,.2,.2,1.4);
      if(kind==='boss'){for(const x of [-.7,.7])box(g,0x252e34,x,2.4,.55,.35,.6,1.4);const core=mesh('sphere',0xffb14a,[.45,.45,.45],[0,2.05,1.2],g,0xff6622);g.userData.core=core;}
      g.scale.setScalar(size);
    }
    const bar=new THREE.Group();bar.position.y=kind==='boss'?4.7:kind==='bike'?2.2:2.8;box(bar,0x293339,0,0,0,1.6,.1,.06);const hp=box(bar,0xffbf82,0,0,.04,1.6,.11,.06,0x7e371e);g.add(bar);g.userData.healthBar=hp;entities.add(g);return g;
  }
  const cfg={easy:{damage:.65,spawn:3.9,hp:150},normal:{damage:1,spawn:3.1,hp:125},hard:{damage:1.3,spawn:2.4,hp:110}};
  game={
    sector:1,distance:0,total:0,score:0,kills:0,shots:0,hits:0,hp:125,maxHp:125,heat:0,overheated:false,rockets:4,shield:0,shieldCooldown:0,damage:1,cooling:1,fireTimer:0,rocketTimer:0,spawnTimer:1.5,obstacleTimer:5,supplyTimer:10,bossSpawned:false,time:0,
    clearInput(){input.clear();pointerDown=false;},
    start(){
      for(const list of [bullets,hostiles,enemies,particles,obstacles,supplies]){for(const o of list)removeObject(o.m);list.length=0;}
      Object.assign(this,{sector:1,distance:0,total:0,score:0,kills:0,shots:0,hits:0,hp:cfg[difficulty].hp,maxHp:cfg[difficulty].hp,heat:0,overheated:false,rockets:4,shield:0,shieldCooldown:0,damage:1,cooling:1,fireTimer:0,rocketTimer:0,spawnTimer:1.8,obstacleTimer:5,supplyTimer:9,bossSpawned:false,time:0});
      convoy.position.x=0;pointer.set(0,.05);mode='playing';$('overlay').hidden=true;this.clearInput();this.palette();tone(330,.25,'sine',.05,2);this.hud();$('scene').focus({preventScroll:true});save();
    },
    palette(){const sky=['#dba879','#aebbb2','#203c56'][this.sector-1];scene.background.set(sky);scene.fog.color.set(sky);sun.color.set(this.sector===3?0x8fbaff:0xffdeb0);sun.intensity=this.sector===3?1.7:3;ambient.intensity=this.sector===3?1.9:2.4;renderer.toneMappingExposure=this.sector===3?1.3:1.15;},
    upgrade(kind){if(mode!=='upgrade')return;if(kind==='Damage')this.damage*=1.25;if(kind==='Cooling')this.cooling*=1.35;if(kind==='Repair'){this.hp=Math.min(this.maxHp,this.hp+35);this.rockets+=2;}this.sector++;this.distance=0;this.spawnTimer=3;this.bossSpawned=false;this.rockets+=2;this.palette();mode='playing';$('overlay').hidden=true;this.clearInput();$('scene').focus({preventScroll:true});tone(660,.18,'sine',.05,1.5);this.hud();},
    hurt(value){if(mode!=='playing'||this.shield>0)return;this.hp=Math.max(0,this.hp-value*cfg[difficulty].damage);hitFlash=.65;shake=reduced?0:.25;tone(85,.2,'sawtooth',.08,.5);if(this.hp<=0)this.finish(false);},
    finish(win){if(mode!=='playing')return;mode=win?'won':'lost';this.clearInput();if(win){this.score+=Math.round(this.hp*20)+this.rockets*80;wins++;}best[difficulty]=Math.max(Number(best[difficulty])||0,this.score);save();showOverlay(win?'win':'lose');tone(win?520:120,.5,'triangle',.08,win?1.6:.3);this.hud();},
    activateShield(){if(mode!=='playing')return;if(this.shieldCooldown>0){notice('shieldWait');return;}this.shield=4;this.shieldCooldown=23;notice('shieldActive');tone(290,.4,'sine',.05,2);},
    fireRocket(){if(mode!=='playing'||this.rocketTimer>0)return;if(this.rockets<=0){notice('rocketEmpty');return;}this.rockets--;this.rocketTimer=.7;this.shoot(true);},
    shoot(rocket=false){
      if(!rocket&&(this.fireTimer>0||this.overheated))return;
      const origin=new V(convoy.position.x,2.3,4.4),direction=aim.clone().sub(origin).normalize();
      const m=mesh(rocket?'cone':'sphere',rocket?0xffaa58:0xffedac,rocket?[.17,.75,.17]:[.095,.095,.42],origin.toArray(),entities,rocket?0xff6600:0xffc24c);
      if(rocket)m.quaternion.setFromUnitVectors(new V(0,1,0),direction);else m.quaternion.setFromUnitVectors(new V(0,0,1),direction);
      bullets.push({m,v:direction.multiplyScalar(rocket?48:96),life:2,rocket,id:++shotId,prev:origin.clone()});this.shots++;
      if(!rocket){this.fireTimer=.115/Math.sqrt(this.cooling);this.heat=Math.min(100,this.heat+6.8);if(this.heat>=100){this.overheated=true;notice('overheat');}tone(rand(150,205),.06,'square',.022,.3);}else tone(110,.25,'sawtooth',.07,.4);
      flash.visible=true;flash.scale.setScalar(rocket?1.5:1);reticleTime=.08;
    },
    spawn(kind){
      const m=vehicle(kind),side=Math.random()<.5?-1:1;
      m.position.set(side*rand(3.5,6),0,-70);const hp=kind==='boss'?650:kind==='jeep'?78:32;
      enemies.push({m,kind,hp,max:hp,side,speed:rand(13,18),targetZ:kind==='boss'?-27:rand(-32,-15),clock:rand(0,6),fire:rand(1.5,3),lane:side*rand(3,5.4)});
      if(kind==='boss')notice('boss');
    },
    hitEnemy(e,amount,rocket=false){
      const armored=e.kind==='boss'&&Math.sin(e.clock*1.5)>0;
      if(armored&&!rocket)amount*=.22;
      e.hp-=amount;burst(e.m.position.clone().add(new V(0,1.5,0)),armored?0xacc8d0:0xffb767,4,3);
      const hp=e.m.userData.healthBar;hp.scale.x=Math.max(0,e.hp/e.max)*1.6;
      if(e.hp<=0){burst(e.m.position.clone().add(new V(0,1,0)),0xffaa57,e.kind==='boss'?45:24,8);this.score+=e.kind==='boss'?2000:e.kind==='jeep'?200:100;this.kills++;tone(95,.22,'sawtooth',.06,.3);shake=reduced?0:.13;removeObject(e.m);enemies.splice(enemies.indexOf(e),1);}
    },
    hud(){
      $('hp').textContent=Math.ceil(this.hp);$('hp-bar').style.width=`${100*this.hp/this.maxHp}%`;$('hp-bar').style.background=this.hp<30?'var(--red)':'var(--green)';
      $('sector').textContent=`0${this.sector} / 03`;$('sector-name').textContent=t('sectorNames')[this.sector-1];$('score').textContent=Math.round(this.score).toLocaleString(lang);$('best').textContent=`${t('record')} ${Math.round(best[difficulty]||0).toLocaleString(lang)}`;
      $('distance').textContent=`${Math.floor(this.distance)} / 900 m`;$('route-bar').style.width=`${this.distance/9}%`;$('objective').textContent=t(this.distance>=900?'clear':'escort');
      $('heat-bar').style.width=this.heat+'%';$('heat-bar').style.background=this.overheated?'var(--red)':'var(--accent)';$('heat-label').textContent=this.overheated?'!':`${Math.round(this.heat)}%`;
      $('rocket-count').textContent=this.rockets;$('shield-count').textContent=this.shield>0?`${Math.ceil(this.shield)}s`:this.shieldCooldown>0?`${Math.ceil(this.shieldCooldown)}s`:'✓';
      $('rocket-button').disabled=mode!=='playing'||this.rockets<=0;$('shield-button').disabled=mode!=='playing'||this.shieldCooldown>0;
    },
    snapshot(){return{slug:'armored-convoy',mode,sector:this.sector,distance:this.distance,hp:this.hp,score:this.score,kills:this.kills,shots:this.shots,hits:this.hits,heat:this.heat,overheated:this.overheated,rockets:this.rockets,shield:this.shield,shieldCooldown:this.shieldCooldown,enemies:enemies.map(e=>({kind:e.kind,hp:e.hp,position:e.m.position.toArray()})),bullets:bullets.length,hostiles:hostiles.length,position:convoy.position.toArray(),renderer:{calls:renderer.info.render.calls,geometries:renderer.info.memory.geometries},lang,theme,difficulty};}
  };
  function segmentDistance(p,a,b){const d=b.clone().sub(a),l=d.lengthSq();return p.distanceTo(a.clone().addScaledVector(d,l?clamp(p.clone().sub(a).dot(d)/l,0,1):0));}
  function explode(b){burst(b.m.position,0xffba55,30,8);for(const e of [...enemies])if(e.m.position.distanceTo(b.m.position)<6)game.hitEnemy(e,100*game.damage,true);for(const o of [...obstacles])if(o.m.position.distanceTo(b.m.position)<6){burst(o.m.position,0xd5a169,14,5);removeObject(o.m);obstacles.splice(obstacles.indexOf(o),1);game.score+=30;}shake=reduced?0:.18;tone(70,.3,'sawtooth',.06,.4);}
  function update(dt){
    game.time+=dt;const speed=game.distance<900?21:10;game.distance=Math.min(900,game.distance+dt*21);game.total+=speed*dt;
    const move=(input.has('d')||input.has('arrowright')?1:0)-(input.has('a')||input.has('arrowleft')?1:0);convoy.position.x=clamp(convoy.position.x+move*5.8*dt,-5.2,5.2);convoy.rotation.z=THREE.MathUtils.damp(convoy.rotation.z,-move*.025,6,dt);
    if(input.has('j'))pointer.x-=dt;if(input.has('l'))pointer.x+=dt;if(input.has('i'))pointer.y+=dt;if(input.has('k'))pointer.y-=dt;pointer.x=clamp(pointer.x,-.96,.96);pointer.y=clamp(pointer.y,-.85,.8);
    ray.setFromCamera(pointer,camera);ray.ray.intersectPlane(plane,aim);aim.z=clamp(aim.z,-95,14);aim.x=clamp(aim.x,-45,45);turret.rotation.y=Math.atan2(-(aim.x-convoy.position.x),-(aim.z-4.4));
    $('reticle').style.left=`${(pointer.x+1)*50}%`;$('reticle').style.top=`${(1-pointer.y)*50}%`;
    game.fireTimer-=dt;game.rocketTimer-=dt;game.heat=Math.max(0,game.heat-dt*(pointerDown||input.has(' ')?10:26)*game.cooling);if(game.overheated&&game.heat<28)game.overheated=false;
    if(pointerDown||input.has(' '))game.shoot();game.shield=Math.max(0,game.shield-dt);game.shieldCooldown=Math.max(0,game.shieldCooldown-dt);shieldMesh.visible=game.shield>0;shieldMesh.material.opacity=.12+Math.sin(game.time*8)*.04;
    for(const m of markings){m.position.z+=speed*dt;if(m.position.z>31)m.position.z-=140;}
    for(const p of props){p.position.z+=speed*dt;if(p.position.z>32)p.position.z-=160;}
    for(const w of wheels)w.rotation.x+=speed*dt*1.8;
    for(let i=0;i<3;i++){const c=convoy.children[i];c.position.y=Math.sin(game.time*15+i)*.022;}
    game.spawnTimer-=dt;
    if(game.spawnTimer<=0&&game.distance<790){game.spawn(game.sector===3&&Math.random()<.6?'jeep':Math.random()<.3?'jeep':'bike');game.spawnTimer=cfg[difficulty].spawn/(1+(game.sector-1)*.18);}
    if(game.sector===3&&game.distance>550&&!game.bossSpawned){game.bossSpawned=true;game.spawn('boss');}
    game.obstacleTimer-=dt;
    if(game.obstacleTimer<=0&&game.distance<760){
      const g=new THREE.Group();g.position.set([-4.5,0,4.5][Math.floor(rand(0,3))],0,-75);entities.add(g);
      box(g,0x907e58,0,.7,0,2.2,1.4,1);box(g,0xe9be69,0,1.3,.55,2.35,.25,.08,0x55350e);for(const x of [-.7,0,.7])box(g,0x353a39,x,1.3,.6,.18,.26,.05);
      const warning=new THREE.Mesh(geo.box,warningMaterial);warning.scale.set(2.4,.02,16);warning.position.set(0,.03,8);g.add(warning);
      obstacles.push({m:g,hp:34});game.obstacleTimer=rand(5,8);
    }
    game.supplyTimer-=dt;
    if(game.supplyTimer<=0&&game.distance<820){const g=new THREE.Group();g.position.set(rand(-4.7,4.7),.7,-65);entities.add(g);box(g,0x48a889,0,0,0,.9,.9,.9);box(g,0xcfffd5,0,.47,0,.17,.04,.65,0x7affb5);box(g,0xcfffd5,0,.48,0,.65,.04,.17,0x7affb5);supplies.push({m:g});game.supplyTimer=13;}
    for(const e of [...enemies]){
      e.clock+=dt;const pos=e.m.position;pos.z=THREE.MathUtils.damp(pos.z,e.targetZ,1.2,dt);pos.x=THREE.MathUtils.damp(pos.x,e.lane+Math.sin(e.clock*(e.kind==='bike'?1.1:.5))*(e.kind==='boss'?2:.9),3,dt);e.m.rotation.z=Math.sin(e.clock*1.1)*.035;
      if(e.kind==='boss'){e.m.userData.core.material.emissiveIntensity=Math.sin(e.clock*1.5)>0?.1:2.5;}
      e.fire-=dt;
      if(e.fire<0&&pos.z>-48){const origin=pos.clone().add(new V(0,e.kind==='boss'?2.4:1.3,1));const target=new V(convoy.position.x+rand(-1,1),1.2,[-14,-5,4][Math.floor(rand(0,3))]);const dir=target.sub(origin).normalize();const m=mesh('sphere',0xff6049,[.18,.18,.4],origin.toArray(),entities,0xff3822);hostiles.push({m,v:dir.multiplyScalar(e.kind==='boss'?17:12),life:5,damage:e.kind==='boss'?14:7});e.fire=(e.kind==='boss'?.8:rand(2,3.5))/Math.sqrt(game.sector);tone(130,.08,'triangle',.01,1.5);}
    }
    for(const b of [...bullets]){
      b.prev.copy(b.m.position);b.m.position.addScaledVector(b.v,dt);b.life-=dt;let hit=false;
      for(const h of [...hostiles])if(segmentDistance(h.m.position,b.prev,b.m.position)<.65){burst(h.m.position,0xffdd99,7,3);removeObject(h.m);hostiles.splice(hostiles.indexOf(h),1);game.score+=15;hit=true;break;}
      if(!hit)for(const e of [...enemies]){const center=e.m.position.clone().add(new V(0,e.kind==='boss'?1.8:1.1,0));if(segmentDistance(center,b.prev,b.m.position)<(e.kind==='boss'?2.5:e.kind==='jeep'?1.5:1)){if(!b.rocket)game.hitEnemy(e,18*game.damage);hit=true;break;}}
      if(!hit)for(const o of [...obstacles])if(segmentDistance(o.m.position.clone().add(new V(0,.7,0)),b.prev,b.m.position)<1.35){o.hp-=18*game.damage;if(o.hp<=0){burst(o.m.position,0xd5a169,15,5);removeObject(o.m);obstacles.splice(obstacles.indexOf(o),1);game.score+=30;}hit=true;break;}
      if(hit){game.hits++;reticleTime=.12;$('reticle').classList.add('hit');}
      if(hit||b.life<0||b.m.position.y<0){if(b.rocket&&(hit||b.m.position.y<0))explode(b);removeObject(b.m);bullets.splice(bullets.indexOf(b),1);}
    }
    for(const h of [...hostiles]){
      h.m.position.addScaledVector(h.v,dt);h.life-=dt;
      const p=h.m.position;let hit=false;for(const z of [-14,-5,4])if(Math.abs(p.x-convoy.position.x)<1.3&&Math.abs(p.z-z)<2.3&&p.y<3){game.hurt(h.damage);burst(p,game.shield>0?0x75ffdd:0xff985b,6,3);hit=true;break;}
      if(hit||h.life<0||p.z>25){removeObject(h.m);hostiles.splice(hostiles.indexOf(h),1);}
    }
    for(const o of [...obstacles]){o.m.position.z+=speed*dt;let hit=false;for(const z of [-14,-5,4])if(Math.abs(o.m.position.x-convoy.position.x)<2&&Math.abs(o.m.position.z-z)<2.2){game.hurt(14);burst(o.m.position,0xd7a35c,18,5);hit=true;break;}if(hit||o.m.position.z>28){removeObject(o.m);obstacles.splice(obstacles.indexOf(o),1);}}
    for(const s of [...supplies]){s.m.position.z+=speed*dt;s.m.rotation.y+=dt;let collected=false;for(const z of [-14,-5,4])if(Math.abs(s.m.position.x-convoy.position.x)<1.7&&Math.abs(s.m.position.z-z)<2){game.hp=Math.min(game.maxHp,game.hp+12);game.rockets=Math.min(12,game.rockets+1);game.score+=40;burst(s.m.position,0x7df3c1,10,3);notice('pickup');tone(650,.15,'sine',.05,1.4);collected=true;break;}if(collected||s.m.position.z>28){removeObject(s.m);supplies.splice(supplies.indexOf(s),1);}}
    for(const p of [...particles]){p.life-=dt;p.v.y-=14*dt;p.m.position.addScaledVector(p.v,dt);p.m.rotation.x+=dt*5;p.m.rotation.z+=dt*6;p.m.scale.multiplyScalar(Math.exp(-dt*2));if(p.life<=0){removeObject(p.m);particles.splice(particles.indexOf(p),1);}}
    if(mode==='playing'&&game.distance>=900&&!enemies.length&&!hostiles.length){for(const list of [obstacles,supplies,bullets]){for(const o of list)removeObject(o.m);list.length=0;}if(game.sector===3)game.finish(true);else{game.hp=Math.min(game.maxHp,game.hp+20);game.score+=300;mode='upgrade';game.clearInput();showOverlay('upgrade');tone(660,.3,'sine',.05,1.4);}}
    toastTime-=dt;if(toastTime<=0)$('toast').textContent='';reticleTime-=dt;if(reticleTime<=0){flash.visible=false;$('reticle').classList.remove('hit');}shake=Math.max(0,shake-dt);hitFlash=Math.max(0,hitFlash-dt*2);$('hit-flash').style.opacity=hitFlash;game.hud();
  }
  function setPointer(e){const r=canvas.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,1-(e.clientY-r.top)/r.height*2);}
  canvas.addEventListener('pointermove',setPointer);canvas.addEventListener('pointerdown',e=>{if(mode!=='playing')return;e.preventDefault();canvas.focus({preventScroll:true});setPointer(e);if(e.button===2)game.fireRocket();else{pointerDown=true;canvas.setPointerCapture(e.pointerId);}});canvas.addEventListener('contextmenu',e=>e.preventDefault());
  function releasePointer(){pointerDown=false;}canvas.addEventListener('pointerup',releasePointer);canvas.addEventListener('pointercancel',releasePointer);canvas.addEventListener('lostpointercapture',releasePointer);
  function held(button,key){button.addEventListener('pointerdown',e=>{e.preventDefault();if(mode!=='playing')return;input.add(key);button.setPointerCapture(e.pointerId);});for(const event of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(event,()=>input.delete(key));}
  document.querySelectorAll('[data-key]').forEach(b=>held(b,b.dataset.key));held($('touch-fire'),' ');
  document.addEventListener('keydown',e=>{
    if(e.target.matches('input,select,textarea')||$('help').open)return;const key=e.key.toLowerCase();
    if([' ','arrowleft','arrowright','arrowup','arrowdown'].includes(key))e.preventDefault();
    if(key==='?'){e.preventDefault();openHelp();return;}
    if((key==='p'||key==='escape')&&!e.repeat){e.preventDefault();setPaused(mode==='playing');return;}
    if(mode!=='playing')return;input.add(key);if(!e.repeat&&key==='r')game.fireRocket();if(!e.repeat&&key==='q')game.activateShield();
  });document.addEventListener('keyup',e=>input.delete(e.key.toLowerCase()));
  window.addEventListener('blur',()=>{game.clearInput();setPaused(true);});document.addEventListener('visibilitychange',()=>{if(document.hidden){game.clearInput();setPaused(true);}});
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();setPaused(true);$('load-error').hidden=false;});
  const resize=()=>{const w=stage.clientWidth,h=stage.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.fov=w<600?65:55;camera.updateProjectionMatrix();};new ResizeObserver(resize).observe(stage);resize();
  const testMode=new URLSearchParams(location.search).has('test');
  let previous=performance.now(),accumulator=0;
  function frame(now){const dt=Math.min((now-previous)/1000,.1);previous=now;if(mode==='playing'&&!testMode){accumulator+=dt;let steps=0;while(accumulator>=1/60&&steps++<6&&mode==='playing'){update(1/60);accumulator-=1/60;}}else accumulator=0;
    const follow=convoy.position.x*.25;camera.position.set(follow+(shake?rand(-shake,shake):0),12+(shake?rand(-shake,shake):0),24);camera.lookAt(follow,1,-18);renderer.render(scene,camera);requestAnimationFrame(frame);
  }
  mode='ready';game.palette();translate();requestAnimationFrame(frame);
  window.__game={snapshot:()=>game.snapshot(),start:()=>game.start(),restart:()=>game.start(),pause:(value=true)=>setPaused(value),messages,save,renderer};
  // Deterministic controls for local integration tests; absent in normal play.
  if(testMode)window.__game.test={
    step(seconds,keys=[]){input.clear();for(const k of keys)input.add(k);for(let i=0;i<Math.ceil(Math.min(30,seconds)*60)&&mode==='playing';i++)update(1/60);return game.snapshot();},
    aimAt(x,y,z){camera.updateMatrixWorld();const screen=new V(x,y,z).project(camera);pointer.set(screen.x,screen.y);},
    spawn(kind,x=0,z=-20){game.spawn(kind);const e=enemies.at(-1);e.m.position.set(x,0,z);e.targetZ=z;e.lane=x;e.clock=0;e.fire=5;},
    clearThreats(){for(const list of [enemies,hostiles,obstacles,supplies,bullets]){for(const o of list)removeObject(o.m);list.length=0;}},
    damage:n=>game.hurt(n),rocket:()=>game.fireRocket(),shield:()=>game.activateShield(),upgrade:k=>game.upgrade(k),
    endSector(){game.distance=900;game.spawnTimer=100;game.bossSpawned=true;},
    spawnControl(enabled){game.spawnTimer=enabled?1:1e5;game.obstacleTimer=enabled?5:1e5;game.supplyTimer=enabled?9:1e5;},
    entities:()=>({enemies:enemies.map(e=>({kind:e.kind,health:e.hp,position:e.m.position.toArray(),coreOpen:Math.sin(e.clock*1.5)<=0})),supplies:supplies.map(s=>s.m.position.toArray()),obstacles:obstacles.map(o=>o.m.position.toArray()),hostiles:hostiles.map(h=>h.m.position.toArray())})
  };
}catch(error){mode='error';$('overlay').hidden=true;$('load-error').hidden=false;console.error('Armored Convoy could not initialize:',error);}
