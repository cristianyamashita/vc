"""Rebuild the leisure / rooms library. Plain JSON, no runtime dependencies."""
import json, math, random
from pathlib import Path
APP=Path(__file__).resolve().parents[1]/'page/game/story-studio'
D=APP/'data'
LOCAL=APP/'_local'
added={k:[] for k in ['props','actions','sets','stories']}
LOCAL_ACTIONS={'birthPosition'}
def N(en,pt,ja):return dict(en=en,pt=pt,ja=ja)
def put(folder,doc):
    root = LOCAL/folder if folder=='actions' and doc['id'] in LOCAL_ACTIONS else D/folder
    root.mkdir(parents=True, exist_ok=True)
    (root/(doc['id']+'.json')).write_text(json.dumps(doc,ensure_ascii=False,indent=2)+'\n')
    if not (folder=='actions' and doc['id'] in LOCAL_ACTIONS):
        added[folder].append(doc['id']+'.json')
def B(w,h,d,x=0,y=0,z=0,c='#a7c6bd',shape='box',**kw):return dict(w=w,h=h,d=d,x=x,y=y,z=z,color=c,shape=shape,n=3,**kw)
def prop(id,n,parts,foot,anchors=None,**kw):put('props',dict(kind='prop',version=1,id=id,name=N(*n),source=dict(type='boxes',boxes=parts),footprint=foot,anchors=anchors or {},**kw))
ring=[]
for i in range(48):
    a=i*math.tau/48
    ring.append(B(.065,.029,.029,.49*math.cos(a),0,.49*math.sin(a),['#de6498','#f3c657','#61b8bb'][i//4%3],'cylinder',axis='x',ry=((-a-math.pi/2+math.pi)%math.tau)-math.pi))
prop('hula-hoop',('Hula hoop','Bambolê','フラフープ'),ring,[1.02,1.02],{'grip':{'pos':[.49,0,0],'pitch':90}})
# Opposite faces total seven: 1/6, 2/5, 3/4, with real raised pips.
def die(cx,cz):
    out=[B(.105,.105,.105,cx,.056,cz,'#f9f2dc',shape='rounded')]
    patterns={1:[(0,0)],2:[(-1,-1),(1,1)],3:[(-1,-1),(0,0),(1,1)],4:[(-1,-1),(-1,1),(1,-1),(1,1)],5:[(-1,-1),(-1,1),(0,0),(1,-1),(1,1)],6:[(a,b) for a in [-1,1] for b in [-1,0,1]]}
    for axis,sign,count in [('y',1,1),('y',-1,6),('x',1,2),('x',-1,5),('z',1,3),('z',-1,4)]:
        for a,b in patterns[count]:
            pos={'x':cx,'y':.056,'z':cz};size={'x':.014,'y':.014,'z':.014};pos[axis]+=.053*sign;size[axis]=.003
            sides=[v for v in ['x','y','z'] if v!=axis];pos[sides[0]]+=a*.026;pos[sides[1]]+=b*.026
            out.append(B(size['x'],size['y'],size['z'],**pos,c='#31454c',shape='sphere'))
    return out
prop('dice-six',('Six-sided dice','Dados de seis faces','六面サイコロ'),die(-.07,0)+die(.07,.045),[.26,.17],{'grip':{'pos':[0,.05,0]}})
steel='#b8ccd2';blue='#91c4d2';white='#eeeedd';wood='#96683f'
bed=[B(2.2,.13,.98,0,.56,0,steel),B(2.03,.17,.88,0,.71,0,white,shape='rounded'),B(.39,.10,.73,-.75,.835,0,'#f7f5ed',shape='rounded'),B(1.18,.04,.9,.37,.815,0,blue)]
for x in [-.8,.8]:
    for z in [-.36,.36]:bed+=[B(.07,.43,.07,x,.32,z,steel),B(.13,.13,.07,x,.095,z,'#394750','cylinder',axis='z')]
for x in [-1.08,1.08]:bed += [B(.07,.52,.95,x,.81,0,blue)]
for z in [-.48,.48]:
    bed += [B(1.25,.035,.035,-.10,.96,z,steel)]
    for x in [-.7,-.1,.5]:bed.append(B(.025,.25,.025,x,.835,z,steel))
prop('hospital-bed',('Hospital bed','Cama de hospital','病院のベッド'),bed,[2.25,1.05],{'lie':{'pos':[0,.81,0],'yaw':0},'seat':{'pos':[.2,.81,0],'yaw':90}})
bull=[B(3.2,.23,2.9,0,.12,0,'#597ca0',shape='rounded'),B(2.7,.11,2.4,0,.27,0,'#ddb64e',shape='rounded'),B(.42,.5,.42,0,.56,0,steel,'cylinder'),B(1.35,.59,.62,0,1.0,0,'#654732','sphere'),B(.45,.5,.5,.66,1.09,0,'#805239','sphere'),B(.25,.23,.43,.94,.99,0,'#382b24','sphere'),B(.46,.07,.60,-.15,1.30,0,'#283741')]
for side in [-1,1]:bull+=[B(.08,.32,.08,.63,1.43,side*.30,'#eee0bc','cone',rz=-side*.35),B(.035,.035,.035,.85,1.19,side*.22,'#111c21','sphere')]
prop('mechanical-bull',('Mechanical bull','Touro mecânico','ロデオマシン'),bull,[3.3,3.0],{'seat':{'pos':[-.15,1.34,0],'yaw':0}})
notebook=[B(.32,.012,.24,0,.009,0,'#538b98'),B(.30,.014,.22,0,.024,0,'#fff5dc')]
for z in [-.075,-.045,-.015,.015,.045,.075]:notebook.append(B(.25,.001,.002,.01,.032,z,'#acc7d0'))
for z in [-.09,-.06,-.03,0,.03,.06,.09]:notebook.append(B(.024,.018,.008,-.15,.029,z,steel,'cylinder',axis='z'))
prop('notebook',('Notebook','Caderno','ノート'),notebook,[.32,.24],{'grip':{'pos':[-.13,.02,0],'pitch':-90}})
prop('pencil',('Pencil','Lápis','鉛筆'),[B(.012,.14,.012,0,0,0,'#e5b438','cylinder'),B(.012,.027,.012,0,-.083,0,'#bea16c','cone',rz=math.pi),B(.007,.009,.007,0,-.097,0,'#303535','cone',rz=math.pi)],[.02,.17],{'grip':{'pos':[0,0,0]}})
laptop=[B(.34,.025,.44,0,.025,0,'#677a84',shape='rounded'),B(.28,.004,.36,0,.041,0,'#253b48'),B(.08,.005,.13,.095,.046,0,'#9badb7'),B(.025,.26,.44,-.155,.17,0,'#526572',rz=-.13),B(.007,.218,.385,-.134,.18,0,'#80bdc9',rz=-.13)]
for x in [-.10,-.055,-.01]:
    for z in [-.15,-.10,-.05,0,.05,.10,.15]:laptop.append(B(.032,.004,.037,x,.046,z,'#a0b4bd'))
prop('laptop',('Laptop computer','Computador notebook','ノートパソコン'),laptop,[.38,.47])
horse=[B(1.45,.58,.52,0,1.04,0,'#936745','sphere'),B(.41,.71,.4,.57,1.44,0,'#936745','sphere',rz=-.30),B(.50,.32,.34,.82,1.76,0,'#a27650','sphere'),B(.17,.25,.34,.60,1.91,0,'#754c35','cone'),B(.48,.07,.59,-.1,1.34,0,'#403732')]
for x in [-.46,.45]:
    for z in [-.22,.22]:horse += [B(.095,.78,.10,x,.53,z,'#946540','cylinder'),B(.14,.15,.13,x+.02,.075,z,'#3a3430')]
for z in [-.18,.18]:horse.append(B(.026,.026,.026,.91,1.83,z,'#101819','sphere'))
horse += [B(.07,.6,.13,-.73,.79,0,'#45342b','cylinder',rz=-.2),B(.085,.63,.31,.44,1.49,0,'#45342b',rz=-.3)]
prop('saddle-horse',('Saddled horse','Cavalo com sela','鞍を付けた馬'),horse,[2.05,.7],{'seat':{'pos':[-.1,1.37,0],'yaw':0}})
prop('medical-monitor',('Bedside monitor','Monitor hospitalar','生体情報モニター'),[B(.5,.45,.12,0,1.42,0,white),B(.43,.33,.01,0,1.43,.07,'#142e3e'),B(.07,1.14,.07,0,.60,0,steel),B(.50,.07,.38,0,.035,0,steel)]+[B(.05,.018,.012,-.17+i*.05,1.43+math.sin(i*1.7)*.07,.08,'#7bc898') for i in range(8)],[.55,.4])
# Open roof/front keeps interior sets usable with the stage camera.
prop('room-shell-open',('Open room walls','Paredes de quarto aberto','開放型の部屋の壁'),[B(7,.1,6,0,-.05,0,'#d8c3a3'),B(7,2.8,.12,0,1.4,-3,'#e7dfd2'),B(.12,2.8,6,-3.5,1.4,0,'#dfd9cc')],[7,6])
prop('child-bed',('Child bed','Cama infantil','子供用ベッド'),[B(1.8,.25,.86,0,.24,0,'#7399aa'),B(1.73,.14,.8,0,.435,0,'#e9dbc5'),B(1.10,.04,.82,.27,.525,0,'#dda863'),B(.37,.08,.66,-.62,.55,0,'#eee4d2')],[1.9,.9],{'lie':{'pos':[0,.51,0],'yaw':0},'seat':{'pos':[0,.53,.18],'yaw':-90}})
prop('toy-blocks',('Building blocks','Blocos de brinquedo','積み木'),[B(.22,.22,.22,x,y,z,c) for x,y,z,c in [(-.2,.11,0,'#de795c'),(0,.11,0,'#72a6ab'),(.2,.11,0,'#e0b447'),(-.1,.33,0,'#70a080'),(.12,.33,0,'#d28fa3'),(0,.55,0,'#dda95c')]],[.7,.35])
prop('cave-rock',('Cave rock','Rocha de caverna','洞窟の岩'),[B(1.7,2.2,1.5,0,1.05,0,'#776e64','sphere'),B(1.2,1.3,1.6,.38,.6,.18,'#898073','sphere')],[2,1.8])
prop('stalagmites',('Stalagmites','Estalagmites','石筍'),[B(.35,h,.35,x,h/2,z,c,'cone') for x,h,z,c in [(-.3,1.2,0,'#928675'),(.2,.8,.1,'#afa08a'),(.05,1.7,-.3,'#817767')]],[.9,.8])
flowers=[]
for i in range(15):
    x=(i%5-2)*.15;z=(i//5-1)*.17;flowers += [B(.02,.27,.02,x,.14,z,'#568054','cylinder'),B(.13,.06,.13,x,.29,z,['#ebbd61','#dba1ba','#e6e1bf'][i%3],'sphere')]
prop('flower-bed',('Flower bed','Canteiro de flores','花壇'),[B(.95,.12,.65,0,.06,0,'#8a744f')]+flowers,[1,.7])
# A roomy canvas tent interior; poles and side fabric, with an open roof.
tent=[B(4.6,.04,3.5,0,.02,0,'#b6a481'),B(.045,2.22,.045,0,1.11,-1.72,steel),B(.045,2.22,.045,0,1.11,1.72,steel),B(.045,.045,3.5,0,2.22,0,steel)]
for side in [-1,1]:
    tent += [B(2.73,.045,1.65,side*1.15,1.46,-.9,'#839168',rz=-side*.58),B(.045,.62,3.5,side*2.28,.33,0,'#a2ab7c')]
    for z in [-1.72,1.72]:tent.append(B(2.74,.04,.04,side*1.15,1.46,z,steel,rz=-side*.58))
for i in range(15):
    x=(i-7)*.30;h=2.18-abs(x)*.69;tent.append(B(.30,h,.04,x,h/2,-1.73,'#a2ab7c'))
prop('tent-interior',('Tent interior','Interior de barraca','テントの内側'),tent,[4.6,3.5])
def C(j,axis='z',offset=0,amp=0,wave='const',**kw):return dict(joint=j,axis=axis,offset=offset,amp=amp,wave=wave,**kw)
def act(id,n,pose,joints,**kw):
    doc=dict(kind='action',version=1,id=id,name=N(*n),category='solo',type='overlay',pose=pose,duration=4,breathe=.2,joints=joints);doc.update(kw);put('actions',doc);return doc
for id,n,pose,waist in [('hulaStanding',('Hula hoop standing','Dançar bambolê em pé','立ってフラフープ'),'stand',.11)]:
    act(id,n,pose,[C('hips',amp=waist,wave='sin'),C('chest',amp=-waist*.8,wave='sin'),C('lArm','x',-.70),C('rArm','x',.70),C('lFore',offset=.8),C('rFore',offset=.8)],reps=True,period=1.2,defaultReps=6,root=[dict(field='shift',amp=.045,wave='sin')],props=[dict(id='hoop',prop='hula-hoop',joint='hips',bodyScale=True,at=[0,.12,0],spin=1.5,spinAxis='y',motion=[dict(field='x',amp=.045,wave='sin'),dict(field='z',amp=.045,wave='cos')])])
act('rollDice',('Roll dice','Jogar dados','サイコロを振る'),'kneel',[C('rArm',offset=.35,amp=.65,wave='rise'),C('rFore',offset=1.0,amp=-.65,wave='rise'),C('head',offset=-.2)],duration=2.6,props=[dict(id='dice',prop='dice-six',space='ground',at=[.32,.005,-.07],motion=[dict(field='x',amp=.55,wave='ramp'),dict(field='y',amp=.18,wave='rise',from_=0)])])
# Explicit finite arc: the dice settle instead of orbiting forever.
d=json.loads((D/'actions/rollDice.json').read_text());d['props'][0]['motion']=[dict(field='x',amp=.55,wave='ramp'),dict(field='y',amp=.20,wave='rise',**{'from':0,'to':.7}),dict(field='spin',amp=math.tau*2,wave='ramp',**{'from':0,'to':.7})];put('actions',d)
act('celebrate',('Celebrate','Comemorar','喜ぶ'),'stand',[C('rArm','x',2.3,amp=.15,wave='sin'),C('lArm','x',-2.3,amp=-.15,wave='sin'),C('rFore','z',.5),C('lFore',offset=.5),C('head','y',amp=.17,wave='sin')],reps=True,period=1.2,root=[dict(field='lift',amp=.08,wave='rise')])
act('birthPosition',('Reclined birth position','Deitar em posição de parto','仰向けの分娩姿勢'),'lieUp',[C('lThigh','x',-.65),C('rThigh','x',.65),C('lThigh',offset=1.05),C('rThigh',offset=1.05),C('lShin',offset=-1.3),C('rShin',offset=-1.3),C('lFore',offset=.7),C('rFore',offset=.7)],type='posture',duration=.8,anchor='lie',seatLift='add')
act('rideHorse',('Ride a horse','Montar cavalo','馬に乗る'),'sit',[C('lThigh','x',-.38),C('rThigh','x',.38),C('lThigh',offset=-.9),C('rThigh',offset=-.9),C('lShin',offset=.6),C('rShin',offset=.6),C('lArm',offset=.45),C('rArm',offset=.45),C('lFore',offset=.65),C('rFore',offset=.65),C('chest',amp=.035,wave='sin')],type='posture',reps=True,period=1.0,anchor='seat',seatLift='set',root=[dict(field='lift',offset=.48,amp=.012,wave='sin')],props=[dict(id='horse',prop='saddle-horse',at=[.03,0,0],space='ground',whenUnanchored=True)])
act('writeNotebook',('Write in a notebook','Escrever no caderno','ノートに書く'),'sit',[C('head',offset=-.28),C('rArm',offset=.3),C('rArm','x',-.18),C('rFore',offset=.8),C('rHand','y',amp=.1,wave='sin'),C('rHand',amp=.06,wave='cos'),C('lArm',offset=.32),C('lFore',offset=.8)],type='posture',reps=True,period=.65,anchor='seat',seatLift='set',props=[dict(id='notebook',prop='notebook',joint='hips',bodyScale=True,at=[.40,.17,-.16]),dict(id='pencil',prop='pencil',joint='rHand',at=[0,0,0],spinPhase=-.25)])
act('typeLaptop',('Type on a laptop','Digitar no computador','パソコンで入力する'),'sit',[C('head',offset=-.22),C('rArm','x',-.35),C('lArm','x',.35),C('rArm',offset=.33,amp=.018,wave='sin'),C('lArm',offset=.33,amp=-.018,wave='sin'),C('rFore',offset=.84,amp=.04,wave='sin'),C('lFore',offset=.84,amp=-.04,wave='sin'),C('rHand',amp=.08,wave='sin'),C('lHand',amp=-.08,wave='sin')],type='posture',reps=True,period=.42,anchor='seat',seatLift='set',props=[dict(id='computer',prop='laptop',joint='hips',bodyScale=True,at=[.45,.28,0],yaw=180)])
prop('arm-wrestling-table',('Arm wrestling table','Mesa de quebra de braço','腕相撲台'),[B(.90,.08,.85,0,1.16,0,'#5d8391')]+[B(.065,1.12,.065,x,.56,z,steel) for x in [-.34,.34] for z in [-.31,.31]]+[B(.20,.10 if x<0 else .055,.24,x,1.25 if x<0 else 1.225,-.06 if x<0 else 0,'#d19b64',shape='rounded') for x in [-.22,.22]],[.95,.9])
# Both opponents face the table centre; their right elbows sit on opposite pads.
parts={}
for rid in ['a','b']:
    parts[rid]=dict(pose='stand',joints=[C('chest',offset=-.12),C('rArm',offset=.55),C('rArm','x',.08),C('rFore',offset=1.56),C('rFore','y',amp=.20 if rid=='a' else -.20,wave='sin'),C('lArm',offset=.35),C('lFore',offset=.95)])
put('actions',dict(kind='action',version=1,id='armWrestle',name=N('Arm wrestling','Quebra de braço','腕相撲'),category='group',type='overlay',reps=True,period=3.2,defaultReps=3,roles=[dict(id='a',name=N('First player','Primeiro jogador','一人目'),at=[-.42,0,.25],yaw=0),dict(id='b',name=N('Second player','Segundo jogador','二人目'),at=[.42,0,-.19],yaw=180)],parts=parts,props=[dict(id='table',prop='arm-wrestling-table',at=[0,0,0])]))
# Detailed sets use deterministic placement: regenerating never rearranges trees.
def P(id,pr,at,yaw=0,**kw):return dict(id=id,prop=pr,at=at,yaw=yaw,**kw)
def SET(id,n,props,sky='indoor',size=30,color='#aaa28d'):put('sets',dict(kind='set',version=1,id=id,name=N(*n),ground=dict(size=[size,size],color=color),sky=sky,light=dict(sun=[-.4,.9,.35],intensity=2.1 if id=='cave' else 1),props=props))
SET('hospital-room',('Hospital room','Quarto de hospital','病室'),[P('shell','room-shell-open',[0,0,0]),P('bed','hospital-bed',[-.5,0,-.3]),P('monitor','medical-monitor',[-1.6,0,-1.4],-40),P('cabinet','nightstand',[-2.5,0,-1.7]),P('visitor','chair',[1.2,0,1.2],180),P('water','water-glass',[-2.5,.6,-1.7]),P('window','picture',[-3.4,1.5,-1],0,scale=2),P('plant','houseplant',[2.6,0,-2.3])])
rng=random.Random(139)
forest=[]
for i in range(64):
    a=i*2.399;r=4.5+(i%8)*1.2;x=math.cos(a)*r;z=math.sin(a)*r
    forest.append(P('tree.'+str(i),['tree','pine','tree'][i%3],[round(x,3),0,round(z,3)],rng.randrange(360),scale=round(rng.uniform(.85,1.65),2)))
for i in range(35):forest.append(P('undergrowth.'+str(i),['fern','bush','flower-bed'][i%3],[rng.uniform(-11,11),0,rng.uniform(-11,11)],rng.randrange(360),scale=rng.uniform(.5,1)))
forest += [P('clearing','dirt-patch',[0,.005,0],scale=2),P('log','log',[-2,0,-2]),P('rock','rock',[2.7,0,-1.8])]
SET('deep-grove',('Detailed woodland','Bosque detalhado','木々の茂る林'),forest,'day',60,'#6a8550')
cave=[P('floor','dirt-patch',[0,.015,0],scale=3,tint='#8a7d68')]
for i in range(13):
    a=math.pi*.1+i*math.pi*.8/12
    cave.append(P('rock.'+str(i),'cave-rock',[math.cos(a)*5,0,-math.sin(a)*4],i*19,scale=[1.3,1.4+(i%3)*.15,1.4]))
for i in range(7):cave.append(P('spires.'+str(i),'stalagmites',[-4+i*1.3,0,-2.7],i*42,scale=.5+(i%3)*.25))
cave += [P('ceiling.'+str(i),'cave-rock',[-3.2+i*1.6,2.9,-2.3],i*29,scale=[1.6,.38,1.7]) for i in range(5)]
cave += [P('lantern','lantern',[0,0,-1]),P('rock.front','rock',[-3,0,1])]
SET('cave',('Cave','Caverna','洞窟'),cave,'night',35,'#776c5e')
SET('child-bedroom',('Child bedroom','Quarto de criança','子供部屋'),[P('shell','room-shell-open',[0,0,0]),P('bed','child-bed',[-1.7,0,-1.9]),P('rug','rug',[.3,0,.4],tint='#88aaa4'),P('blocks','toy-blocks',[.4,0,.5]),P('ball','ball',[1.5,.1,1.4]),P('shelf','bookshelf',[2.5,0,-2.2]),P('desk','school-desk',[1.4,0,-1.4]),P('notebook','notebook',[1.4,.8,-1.4]),P('hoop','hula-hoop',[-1.9,.055,.7]),P('lamp','floor-lamp',[-2.7,0,-.5])])
SET('hotel-room',('Hotel room','Quarto de hotel','ホテルの部屋'),[P('shell','room-shell-open',[0,0,0]),P('bed','double-bed',[-1.3,0,-1.5]),P('nightstand','nightstand',[-2.7,0,-.7]),P('lamp','floor-lamp',[-2.7,.58,-.7],scale=.35),P('desk','desk',[2.1,0,-1.3]),P('chair','office-chair',[1.3,0,-1.3]),P('laptop','laptop',[2.1,.8,-1.3]),P('rug','rug',[0,0,1.1],tint='#b9a792'),P('bag','backpack',[2.6,0,1.8]),P('plant','houseplant',[-2.7,0,2.1])])
SET('camping-tent',('Inside the camping tent','Barraca de acampamento','キャンプテント'),[P('tent','tent-interior',[0,0,0]),P('bag.a','sleeping-bag',[-.8,.04,-.4]),P('bag.b','sleeping-bag-red',[.7,.04,-.4]),P('lantern','lantern',[0,.04,.6]),P('pack','backpack',[-1.8,.04,-1]),P('book','notebook',[1.5,.045,.9]),P('dice','dice-six',[.3,.04,1.1]),P('pine.a','pine',[-4,0,-4]),P('pine.b','pine',[4,0,-4])],'dusk',30,'#788358')
garden=[P('bench','bench',[0,0,0]),P('path','dirt-patch',[0,.01,1.3],scale=[2,1,.7]),P('lamp','lamp',[2.4,0,-.5])]
for i in range(8):garden.append(P('flowers.'+str(i),'flower-bed',[-3.5+i,0,-1.4],i*20))
for i,(x,z) in enumerate([(-4,-3),(4,-3),(-5,1),(5,-1)]):garden += [P('tree.'+str(i),'tree',[x,0,z],i*47,scale=1.4),P('bush.'+str(i),'bush',[x*.7,0,z*.7])]
SET('garden-bench',('Park bench and garden','Banco de praça com jardim','庭園のベンチ'),garden,'day',36,'#719252')
index=json.loads((D/'index.json').read_text())
for folder,files in added.items():
    for f in files:
        if f not in index[folder]:index[folder].append(f)
(D/'index.json').write_text(json.dumps(index,ensure_ascii=False,indent=2)+'\n')
print({k:len(set(v)) for k,v in added.items()})

# Contact calibration uses the same Three.js skeleton as playback.
import subprocess
subprocess.run(['node', str(Path(__file__).with_name('calibrate_story_studio_actions.mjs'))], check=True)
