"""Author the reusable kitchen library and its four-character dinner film.
Run from any directory with Python 3; outputs are ordinary editable documents.
"""
import json
import math
from pathlib import Path

DATA = Path(__file__).resolve().parents[1] / 'page/game/story-studio/data'
created = {'props': [], 'actions': [], 'sets': [], 'stories': []}

def name(en, pt, ja): return dict(en=en, pt=pt, ja=ja)
def write(folder, doc):
    (DATA / folder / f"{doc['id']}.json").write_text(json.dumps(doc, ensure_ascii=False, indent=2) + '\n')
    created[folder].append(f"{doc['id']}.json")
def part(w,h,d,x,y,z,color,shape='box',**kw):
    return dict(w=w,h=h,d=d,x=x,y=y,z=z,color=color,shape=shape,n=3,grain=0,**kw)
def prop(id, names, boxes, footprint, anchors=None, **kw):
    doc=dict(kind='prop', version=1, id=id, name=name(*names), source=dict(type='boxes', boxes=boxes), footprint=footprint, anchors=anchors or {}, **kw)
    write('props',doc)
    return doc
B=part
cream='#f2eadd'; wood='#bb8550'; edge='#865e3a'; sage='#6b9586'; dark='#273e43'; steel='#b6c6c9'; white='#fff7e8'
# Cabinet fronts face +Z. Counters finish at y=.94; all origins are at floor.
def cabinet(width):
    boxes=[B(width,.78,.67,0,.43,0,sage),B(width+.06,.065,.76,0,.9075,0,cream),B(width-.12,.10,.55,0,.05,0,dark)]
    for x in [-width/4,width/4]:
        boxes += [B(width/2-.035,.57,.022,x,.38,.35,'#7ba493'), B(width/2-.035,.13,.022,x,.76,.35,'#86ad9d'), B(.17,.02,.035,x,.77,.38,'#d6bb80')]
    return boxes
prop('kitchen-counter', ('Preparation counter','Balcão de preparo','調理台'), cabinet(1.4),[1.46,.76], {'work':{'pos':[0,0,.85],'yaw':90}})
boxes=[B(1.28,.78,.67,0,.43,0,sage), B(1.14,.10,.55,0,.05,0,dark)]
for x in [-.32,.32]: boxes += [B(.6,.69,.025,x,.45,.35,'#7ba493'),B(.03,.17,.04,x+(.19 if x<0 else -.19),.63,.38,'#d6bb80')]
# An open basin, rather than a painted rectangle on a solid countertop.
boxes += [B(.25,.065,.76,-.545,.9075,0,cream),B(.25,.065,.76,.545,.9075,0,cream), B(.84,.065,.14,0,.9075,-.31,cream),B(.84,.065,.14,0,.9075,.31,cream),B(.80,.025,.48,0,.755,0,steel)]
for x in [-.395,.395]:boxes.append(B(.025,.17,.5,x,.835,0,steel))
for z in [-.245,.245]:boxes.append(B(.8,.17,.025,0,.835,z,steel))
boxes += [B(.075,.01,.075,0,.773,0,dark,'cylinder'),B(.04,.29,.04,.23,1.085,-.29,steel,'cylinder'),B(.04,.04,.52,.23,1.23,-.03,steel),B(.04,.08,.04,.23,1.20,.21,steel,'cylinder'),B(.12,.025,.035,.35,.98,-.28,dark)]
prop('kitchen-sink',('Sink and tap','Pia com torneira','シンクと蛇口'),boxes,[1.4,.76])
boxes=[B(1.06,.84,.72,0,.45,0,cream),B(1.08,.055,.75,0,.91,0,dark),B(.9,.49,.035,0,.39,.38,'#34484b'),B(.73,.32,.014,0,.38,.403,'#172b33'),B(.73,.03,.05,0,.69,.425,steel)]
for x in [-.29,.29]:
    for z in [-.19,.19]:
        boxes += [B(.28,.018,.28,x,.948,z,'#131e26','cylinder'),B(.31,.013,.027,x,.965,z,steel),B(.027,.013,.31,x,.965,z,steel)]
for x in [-.35,-.12,.12,.35]:boxes.append(B(.07,.07,.026,x,.805,.39,dark,'cylinder',axis='z'))
prop('kitchen-stove',('Stove and oven','Fogão com forno','コンロとオーブン'),boxes,[1.1,.78])
boxes=[B(.9,1.93,.78,0,.995,0,'#b8d8cc'),B(.85,.53,.035,0,1.64,.415,'#cee3d9'),B(.85,1.29,.035,0,.7,.415,'#cee3d9'),B(.055,.28,.065,-.30,1.62,.46,steel),B(.055,.55,.065,-.30,1.02,.46,steel), B(.28,.19,.014,.15,1.47,.441,'#fff1be')]
for x,y,c in [(.06,1.53,'#e77859'),(.24,1.54,'#e5b642')]:boxes.append(B(.03,.03,.02,x,y,.455,c,'sphere'))
prop('kitchen-fridge',('Refrigerator','Geladeira','冷蔵庫'),boxes,[.94,.84])
boxes=[B(1.3,.14,.79,0,1.85,0,steel),B(.49,.67,.36,0,2.25,-.18,cream),B(.92,.025,.52,0,1.77,.02,dark)]
prop('kitchen-hood',('Extractor hood','Coifa','レンジフード'),boxes,[1.3,.8])
boxes=[B(2.45,.075,1.2,0,.7825,0,wood), B(2.18,.12,.035,0,.69,-.48,edge),B(2.18,.12,.035,0,.69,.48,edge), B(.52,.008,1.19,0,.824,0,'#e9ddbb')]
for x in [-1.02,1.02]:
    for z in [-.43,.43]:boxes.append(B(.10,.74,.10,x,.37,z,edge))
prop('kitchen-table',('Family dining table','Mesa de jantar','食卓'),boxes,[2.5,1.24])
boxes=[B(.62,.23,.48,0,.115,0,wood),B(.64,.027,.5,0,.245,0,cream),B(.62,.115,.22,0,.0575,.35,wood)]
prop('kitchen-step',('Kitchen step','Degrau de cozinha','キッチン踏み台'),boxes,[.65,.74],{'stand':{'pos':[0,.258,0],'yaw':0}})
# Child seat is taller, with a footrest; adults use the existing chair.
chair=json.loads((DATA/'props/chair.json').read_text())['source']['boxes']
child=[dict(p, y=p.get('y',0)+.20) for p in chair]
for p in child:
    if p['h']==.44: p.update(h=.64,y=.32)
    if p['h']==.52: p.update(h=.32,y=.86)
    if p.get('detail'): p.update(y=1.01)
child += [B(.33,.035,.44,.16,.28,0,wood)]
prop('kitchen-child-chair',('Child dining chair','Cadeira infantil de jantar','子供用ダイニングチェア'),child,[.55,.55],{'seat':{'pos':[.02,.70,0],'yaw':0}})
boxes=[B(8,.08,7,0,-.045,0,'#d9d2be')]
for ix in range(10):
    for iz in range(9):boxes.append(B(.79,.012,.765,-3.6+ix*.8,.002,-3.06+iz*.77,'#e9e3d3' if (ix+iz)%2 else '#d6d9c8'))
prop('kitchen-floor',('Kitchen tile floor','Piso de cozinha','キッチンのタイル床'),boxes,[8,7])
boxes=[B(8,2.9,.13,0,1.45,0,'#eee1c9'), B(8,.08,.17,0,.08,.03,edge)]
for ix in range(24):
    for iy in range(3):boxes.append(B(.326,.16,.02,-3.83+ix/3,1.02+iy*.17,.08,'#bed3ca' if (ix+iy)%3 else '#a9c6b9'))
prop('kitchen-wall',('Kitchen backsplash wall','Parede com azulejos','キッチンのタイル壁'),boxes,[8,.18])
boxes=[B(.15,2.9,6.9,0,1.45,0,'#e9dbc4'),B(.19,.08,6.9,.03,.08,0,edge),B(.025,1.1,1.9,.09,1.85,-.4,'#8ac4cf')]
for z in [-1.4,.6]:boxes.append(B(.10,1.22,.08,.14,1.85,z,white))
for y in [1.25,1.85,2.45]:boxes.append(B(.1,.08,2.08,.14,y,-.4,white))
boxes.append(B(.1,1.22,.05,.14,1.85,-.4,white))
prop('kitchen-window-wall',('Kitchen window wall','Parede com janela','窓付きキッチン壁'),boxes,[.22,7])
# Tableware, food and hand tools. Fine detail is geometry, no external textures.
def plate():return [B(.29,.018,.29,0,.012,0,white,'cylinder'),B(.245,.009,.245,0,.024,0,'#d8e4da','cylinder'),B(.212,.01,.212,0,.030,0,white,'cylinder')]
prop('dinner-plate',('Dinner plate','Prato','ディナープレート'),plate(),[.3,.3],{'grip':{'pos':[-.11,.025,0],'pitch':-90}})
def food():
    out=[B(.135,.043,.11,-.03,.052,-.015,'#ebbc62','sphere')]
    for i in range(8):out.append(B(.09,.016,.017,-.06+(i%3)*.03,.069+(i%2)*.012,-.05+(i//3)*.03,'#f5d086',rz=(i%2-.5)*.24))
    for x,z,c in [(.067,-.04,'#6fa851'),(.065,.04,'#e2863e'),(-.04,.074,'#dc6045')]:out.append(B(.05,.036,.045,x,.051,z,c,'sphere'))
    return out
prop('dinner-meal',('Pasta and vegetables','Macarrão com legumes','野菜パスタ'),plate()+food(),[.3,.3],{'grip':{'pos':[-.11,.025,0],'pitch':-90}})
prop('kitchen-board',('Chopping board','Tábua de cortar','まな板'),[B(.5,.026,.32,0,.016,0,wood),B(.11,.022,.13,-.29,.016,0,wood)],[.6,.33])
veg=[]
for i in range(5):veg += [B(.11,.065,.065,-.12+i*.06,.047,0,'#e88139','cylinder',axis='x'), B(.04,.04,.04,-.1+i*.05,.04,.09,'#80ad51','sphere')]
prop('chopped-vegetables',('Chopped vegetables','Legumes cortados','切った野菜'),veg,[.4,.25])
prop('wash-vegetables',('Fresh vegetables','Legumes frescos','新鮮な野菜'),[B(.18,.07,.07,0,.04,0,'#e6803b','cone',axis='x'),B(.1,.085,.10,.05,.04,.1,'#de5946','sphere'),B(.11,.07,.11,-.08,.04,.09,'#77a35a','sphere')],[.3,.25])
prop('kitchen-knife',('Kitchen knife','Faca de cozinha','包丁'),[B(.026,.12,.032,0,0,0,dark),B(.012,.19,.055,0,-.15,0,steel)],[.06,.06],{'grip':{'pos':[0,0,0],'pitch':-70}})
spoon=[B(.022,.24,.024,0,0,0,wood,'cylinder'),B(.062,.025,.047,0,-.139,0,wood,'sphere')]
prop('cooking-spoon',('Wooden spoon','Colher de pau','木べら'),spoon,[.07,.05],{'grip':{'pos':[0,.065,0],'pitch':-65}})
# Ring of segments leaves actual open space in the bowls and cooking pot.
def bowl(radius,height,color):
    out=[B(radius*1.5,.022,radius*1.5,0,.016,0,color,'cylinder')]
    for i in range(24):
        a=i*math.tau/24
        out.append(B(radius*.29,height,.025,math.sin(a)*radius,.02+height/2,math.cos(a)*radius,color,ry=a))
    return out
salad=bowl(.19,.115,'#e5c58d')
for i in range(15):
    a=i*2.399;r=.13*math.sqrt((i+.5)/15)
    salad.append(B(.086,.033,.065,math.cos(a)*r,.085+(i%3)*.012,math.sin(a)*r,['#749f48','#98b458','#d76543'][i%3],'sphere'))
prop('salad-bowl',('Salad bowl','Tigela de salada','サラダボウル'),salad,[.42,.42],{'grip':{'pos':[-.17,.07,0],'pitch':-90}})
pot=bowl(.20,.22,'#6f8990')+[B(.035,.055,.14,-.255,.19,0,dark),B(.035,.055,.14,.255,.19,0,dark), B(.34,.022,.34,0,.15,0,'#c9673f','cylinder')]
for i in range(6):pot.append(B(.10,.018,.028,(i%3-1)*.08,.17,(i//3-.5)*.1,'#f0c36d'))
prop('cooking-pot',('Pasta pot','Panela de macarrão','パスタ鍋'),pot,[.56,.43])
prop('serving-platter',('Vegetable serving platter','Travessa de legumes','野菜の盛り皿'),[dict(p,w=p['w']*1.6,d=p['d']*1.3,x=p['x']*1.6,z=p['z']*1.3) for p in plate()+food()],[.5,.42],{'grip':{'pos':[-.20,.025,0],'pitch':-90}})
pasta=bowl(.22,.12,white)
for i in range(16):pasta.append(B(.13,.018,.025,((i%4)-1.5)*.08,.10+(i%3)*.012,((i//4)-1.5)*.075,'#edba61',ry=(i%3)*.5))
prop('pasta-bowl',('Serving bowl of pasta','Travessa de macarrão','パスタの大鉢'),pasta,[.48,.48],{'grip':{'pos':[-.19,.07,0],'pitch':-90}})
prop('dinner-fork',('Dinner fork','Garfo','フォーク'),[B(.014,.15,.013,0,0,0,steel),B(.045,.026,.013,0,.079,0,steel)]+[B(.007,.047,.013,x,.108,0,steel) for x in [-.019,0,.019]],[.05,.025],{'grip':{'pos':[0,-.03,0],'pitch':-95}})
prop('water-glass',('Glass of water','Copo de água','水のグラス'),bowl(.045,.13,'#aacbd0')+[B(.073,.01,.073,0,.106,0,'#79b8c9','cylinder')],[.1,.1])
prop('bread-basket',('Bread basket','Cesta de pão','パンかご'),bowl(.17,.075,wood)+[B(.12,.07,.09,x,.09,z,'#dca962','sphere') for x,z in [(-.07,-.05),(.06,-.04),(0,.06)]],[.38,.38])
prop('running-water',('Running tap water','Água da torneira','蛇口の水'),[B(.018,.34,.018,0,.17,0,'#94d3e5','cylinder')],[.02,.02],opacity=.65)
prop('cooking-steam',('Cooking steam','Vapor da panela','鍋の湯気'),[B(.035,.08,.035,x,.10+i*.095,z,'#f4f0dd','sphere') for i,(x,z) in enumerate([(-.08,0),(.08,.04),(-.05,.03),(.03,0)])],[.22,.15],opacity=.32)
# Joint channels are reusable action documents, shared by all body plans.
def ch(j,axis='z',offset=0,amp=0,wave='const',**kw):return dict(joint=j,axis=axis,offset=offset,amp=amp,wave=wave,**kw)
def action(id,names,joints,period=1.6,gesture=False):
    write('actions',dict(kind='action',version=1,id=id,name=name(*names),category='solo',type='overlay',pose='stand',gesture=gesture,reps=True,period=period,defaultReps=5,breathe=.12,joints=joints))
neutral=[ch('lArm','x',-.13),ch('rArm','x',.13),ch('lFore','x',-.05),ch('rFore','x',.05)]
action('chopFood',('Chop vegetables','Cortar legumes','野菜を切る'),neutral+[ch('chest',offset=-.09),ch('head',offset=-.18),ch('rArm',offset=.37,amp=.08,wave='rise'),ch('rFore',offset=.86,amp=.18,wave='rise'),ch('lArm',offset=.46),ch('lFore',offset=.86)],.8)
action('stirPot',('Stir the pot','Mexer a panela','鍋をかき混ぜる'),neutral+[ch('head',offset=-.15),ch('rArm',offset=.50,amp=.055,wave='sin'),ch('rArm','y',offset=-.12,amp=.11,wave='cos'),ch('rFore',offset=1.58,amp=.07,wave='sin'),ch('lArm',offset=.42),ch('lFore',offset=1.0)],1.8)
action('washFood',('Wash vegetables','Lavar legumes','野菜を洗う'),neutral+[ch('head',offset=-.22),ch('chest',offset=-.10),ch('lArm',offset=.62,amp=.08,wave='sin'),ch('rArm',offset=.65,amp=-.08,wave='sin'),ch('lFore',offset=.90,amp=-.08,wave='sin'),ch('rFore',offset=.85,amp=.08,wave='sin')],1.4)
action('mixSalad',('Mix the salad','Misturar a salada','サラダを混ぜる'),neutral+[ch('head',offset=-.2),ch('rArm',offset=.77,amp=.09,wave='sin'),ch('rArm','y',offset=-.20,amp=.16,wave='cos'),ch('rFore',offset=1.05,amp=.10,wave='sin'),ch('lArm',offset=.71),ch('lFore',offset=1.12)],1.5)
action('carryDish',('Carry a dish','Levar uma travessa','料理を運ぶ'),neutral+[ch('rArm',offset=.26),ch('rFore',offset=1.16),ch('lArm',offset=.35),ch('lFore',offset=1.05)],2,True)
action('serveFood',('Serve the food','Servir a comida','料理を盛り付ける'),neutral+[ch('chest',offset=-.08,amp=-.08,wave='rise'),ch('head',offset=-.18),ch('rArm',offset=.35,amp=.40,wave='rise'),ch('rFore',offset=1.0,amp=-.35,wave='rise'),ch('lArm',offset=.38),ch('lFore',offset=.88)],2.4,True)
# A complete plate-to-mouth cycle, including inward forearm rotation and
# wrist tilt. Keep the elbow forward and outside the shoulder throughout
# the cycle, so the forearm comes around the torso instead of through it.
# The endpoints and elbow clearance were checked on all four Blender rigs.
eat_joints=[ch('lArm','x',-.39),ch('lFore','x',-.05),ch('head',offset=-.08,amp=-.04,wave='rise'),ch('lArm',offset=.39),ch('lFore',offset=.64)]
for joint,axis,low,high,rest in [
    ('rArm','x',.548,1.070,-.13),('rArm','y',-.009,-.473,0),('rArm','z',.797,.630,.04),
    ('rFore','x',-1.431,-.331,-.05),('rFore','y',-.476,-.530,0),('rFore','z',1.039,2.096,.12),
    ('rHand','z',-.694,-.326,0),('rHand','y',1.200,.340,0)]:
    eat_joints.append(ch(joint,axis,low-rest,high-low,'rise'))
action('eatMeal',('Eat a meal','Comer uma refeição','食事をする'),eat_joints,3.2,True)

carry_to=json.loads((DATA/'actions/walkTo.json').read_text())
carry_to.update(id='carryDishTo',name=name('Walk carrying a dish','Caminhar levando uma travessa','料理を持って歩く'))
carry_to['joints']=[c for c in carry_to['joints'] if c['joint'] not in ['lArm','rArm','lFore','rFore']]+neutral+[ch('rArm',offset=.26),ch('rFore',offset=1.16),ch('lArm',offset=.35),ch('lFore',offset=1.05)]
write('actions',carry_to)
placements=[]
def place(id,pr,at,yaw=0,**kw):placements.append(dict(id=id,prop=pr,at=at,yaw=yaw,**kw))
place('floor','kitchen-floor',[0,0,0],locked=True)
place('wall.back','kitchen-wall',[0,0,-3.25],locked=True)
place('wall.window','kitchen-window-wall',[-4,0,0],locked=True)
place('fridge','kitchen-fridge',[-3.28,0,-2.74])
place('counter','kitchen-counter',[-1.95,0,-2.74])
place('stove','kitchen-stove',[-.64,0,-2.74])
place('hood','kitchen-hood',[-.64,0,-2.74])
place('sink','kitchen-sink',[.63,0,-2.74])
place('counter.side','kitchen-counter',[2.15,0,-2.74])
place('table','kitchen-table',[0,0,.5])
place('chair.rui','chair',[-.64,0,-.28],-90,scale=[1,1.12,1])
place('chair.carmen','chair',[.64,0,-.28],-90,scale=[1,1.20,1])
place('chair.tom','kitchen-child-chair',[-.64,0,1.30],90)
place('chair.lia','kitchen-child-chair',[.64,0,1.30],90)
place('step','kitchen-step',[.63,0,-2.14])
place('board','kitchen-board',[-2.16,.94,-2.60])
place('vegetables','chopped-vegetables',[-2.16,.97,-2.60])
place('wash.veg','wash-vegetables',[.63,.80,-2.68])
place('pot','cooking-pot',[-.93,.979,-2.55])
place('salad','salad-bowl',[-1.10,.824,.47])
place('bread','bread-basket',[.05,.824,.50])
place('plant','houseplant',[2.35,.94,-2.87],scale=.40)
for id,x,z in [('rui',-.64,.07),('carmen',.64,.07),('tom',-.64,.93),('lia',.64,.93)]:
    place('plate.'+id,'dinner-plate',[x,.824,z])
    place('glass.'+id,'water-glass',[x+.21,.824,z])
write('sets',dict(kind='set',version=1,id='kitchen',name=name('Family kitchen','Cozinha','家族のキッチン'),ground=dict(size=[26,26],color='#d9d1bd'),sky='indoor',light=dict(sun=[.4,.95,.65],intensity=1.05),props=placements))
# The cooking ingredients belong to the reusable set; stage-only finished
# dishes start hidden and are revealed as they are prepared and served.
edits=[]
def add(id,pr,at,**kw):edits.append(dict(op='add',id=id,prop=pr,at=at,**kw))
add('water','running-water',[.86,.81,-2.53])
add('steam','cooking-steam',[-.93,1.19,-2.55])
add('platter','serving-platter',[-2.16,.94,-2.60])
add('pasta','pasta-bowl',[-.93,.99,-2.55])
for id,x,z in [('rui',-.64,.07),('carmen',.64,.07),('tom',-.64,.93),('lia',.64,.93)]:add('meal.'+id,'dinner-meal',[x,.824,z])
cast=[dict(id=id,character=id,outfit=outfit,at=at,yaw=yaw,**held) for id,outfit,at,yaw,held in [
 ('rui','casual',[-1.95,0,-2.14],-90,dict(holds='kitchen-knife')),
 ('carmen','casual',[-.80,0,-2.16],-90,dict(holds='cooking-spoon')),
 ('lia','casual',[.69,.258,-2.14],-90,{}),
 ('tom','casual',[-1.48,0,.56],0,dict(holds='cooking-spoon'))]]
timeline=[]
def e(t,do,actor=None,**kw):
    item=dict(t=t,do=do,**kw)
    if actor:item['actor']=actor
    timeline.append(item)
def say(t,id,en,pt,ja,dur=3.2):e(t,'say',id,text=name(en,pt,ja),**{'for':dur})
def cam(t,at,look,secs=3,fov=48):e(t,'cameraTo',at=at,look=look,fov=fov,**{'for':secs})
for id in ['platter','pasta']+['meal.'+id for id in ['rui','carmen','tom','lia']]:e(0,'propHide',id=id)
for id,act in [('rui','chopFood'),('carmen','stirPot'),('lia','washFood'),('tom','mixSalad')]:e(0,act,id,**{'for':22})
say(1,'carmen','Dinner together! Everyone has a job.','Vamos fazer o jantar juntos! Cada um ajuda.','みんなで夕飯を作ろう！役割分担ね。')
cam(4,[3.1,2.65,1.5],[-.75,1.1,-2.4],3,48)
say(5,'rui','I am chopping the vegetables.','Estou cortando os legumes.','野菜を切っているよ。')
say(9,'lia','I will wash these too!','Vou lavar estes também!','これも洗うね！')
cam(12,[2.8,2.4,3.65],[-.5,.9,.0],3,48)
say(13,'tom','And I am mixing our salad!','E eu estou misturando a salada!','ぼくはサラダを混ぜるよ！')
say(18,'carmen','The pasta is ready. Let us set the table.','O macarrão está pronto. Vamos servir a mesa.','パスタができたわ。食卓に運びましょう。',3.8)
cam(21,[5.5,4.2,6.5],[-.4,.9,-.25],3,48)
# Stop preparation before picking up the dishes; rinse water stops too.
for id in ['water','steam','vegetables','wash.veg']:e(22,'propHide',id=id)
for id in ['rui','carmen','lia','tom']:e(22,'stand',id,**{'for':.4})
for id in ['rui','carmen','tom']:e(22,'drop',id)
e(22,'propShow',id='platter')
e(22,'propShow',id='pasta')
# Adults carry their prepared dishes around the outside of the chairs.
for id,pr in [('rui','serving-platter'),('carmen','pasta-bowl')]:
    e(22.5,'hold',id,prop=pr)
    e(22.5,'carryDish',id,**{'for':8.5})
e(22.5,'propHide',id='platter');e(22.5,'propHide',id='pasta')
e(23,'carryDishTo','rui',via=[[-2.15,0,-1.3],[-2.15,0,-.4]],to=[-1.62,0,.1],**{'for':5})
e(24.5,'carryDishTo','carmen',via=[[1.55,0,-1.4],[1.85,0,-.8]],to=[1.62,0,.1],**{'for':5})
e(28,'turnTo','rui',yaw=0);e(29.5,'turnTo','carmen',yaw=180)
# Tom finishes the salad at the table; Lia comes down from her step.
e(23,'walkTo','lia',via=[[.72,0,-1.4],[1.9,0,-1.25],[2.0,0,1.25]],to=[1.53,0,1.12],**{'for':6})
e(23,'serveFood','tom',**{'for':2.4})
e(23.6,'propMove',id='salad',at=[-.90,.824,.47],arc=.10,**{'for':1.4})
e(25.8,'walkTo','tom',via=[[-1.65,0,1.55]],to=[-.64,0,1.30],**{'for':3.2})
e(29,'turnTo','lia',yaw=180)
for id in ['rui','carmen']:e(31,'serveFood',id,**{'for':2.4})
# Place the platters at the near edge first, then slide them into the centre.
e(31.7,'drop','rui');e(31.7,'drop','carmen')
e(31.7,'propMove',id='platter',at=[-.69,.824,.45]);e(31.7,'propShow',id='platter')
e(31.7,'propMove',id='pasta',at=[.69,.824,.45]);e(31.7,'propShow',id='pasta')
e(32,'propMove',id='platter',at=[-.47,.824,.5],**{'for':1})
e(32,'propMove',id='pasta',at=[.43,.824,.5],**{'for':1})
say(33,'lia','We all helped. Now we can eat!','Todo mundo ajudou. Agora vamos comer!','みんなで作ったね。いただきます！')
e(34,'walkTo','rui',via=[[-1.65,0,-.92]],to=[-.64,0,-.28],**{'for':3})
e(34,'walkTo','carmen',via=[[1.65,0,-.92]],to=[.64,0,-.28],**{'for':3})
e(33,'walkTo','lia',via=[[1.48,0,1.8]],to=[.64,0,1.30],**{'for':3})
# Fill each place setting as the shared dishes arrive; the original plates
# are hidden at the same instant, avoiding coincident surfaces.
for n,id in enumerate(['tom','lia','rui','carmen']):
    e(34+n*.6,'propHide',id='plate.'+id);e(34+n*.6,'propShow',id='meal.'+id)
for t,id in [(30,'tom'),(36.2,'lia'),(37.2,'rui'),(37.2,'carmen')]:e(t,'sit',id,on='chair.'+id)
cam(37.4,[3.3,2.2,3.5],[0,1.0,.4],3.5,43)
for n,id in enumerate(['rui','carmen','lia','tom']):
    e(40.5,'hold',id,prop='dinner-fork')
    e(41+n*.23,'eatMeal',id,**{'for':19})
say(43,'tom','The salad is crunchy!','A salada ficou crocante!','サラダがシャキシャキ！')
say(47,'rui','The vegetables turned out great.','Os legumes ficaram uma delícia.','野菜もおいしくできたね。')
cam(49,[3.0,1.85,-.8],[0,1.04,.55],3.5,46)
say(51,'lia','We made all of this together!','A gente fez tudo isso junto!','これ、全部みんなで作ったんだね！')
say(55,'carmen','Dinner tastes better together.','Jantar juntos é ainda mais gostoso.','みんなで食べると、もっとおいしいね。',4)
cam(57,[5.5,4.1,6.3],[-.25,.8,-.3],4,48)
e(62,'wait','carmen',**{'for':2})
# Sorting preserves same-time insertion order and keeps every actor's path
# in chronological order, as required by the timeline compiler.
timeline.sort(key=lambda item:item['t'])
write('stories',dict(kind='story',version=1,id='kitchen-family-dinner',name=name('Dinner made together','Jantar feito em conjunto','みんなで作る夕ごはん'),set='kitchen',camera=dict(at=[5.5,4.2,6.5],look=[-.4,.9,-.4],fov=48),setEdits=edits,cast=cast,timeline=timeline,embeds=[]))
index=json.loads((DATA/'index.json').read_text())
for folder,files in created.items():
    for file in files:
        if file not in index[folder]:index[folder].append(file)
(DATA/'index.json').write_text(json.dumps(index,ensure_ascii=False,indent=2)+'\n')
print(', '.join(f'{len(v)} {k}' for k,v in created.items()))
