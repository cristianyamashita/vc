"""Shared masculine character profiles, using the connected Lia construction.
Entry points: build_rui.py (adult man), build_tom.py (boy).
The body-plan landmarks match js/cast/body.js; tests compare hand pivots exactly.
"""
import bpy
import json
import os
import runpy
from pathlib import Path
from mathutils import Vector
from math import sin,cos,pi,exp

ROOT=Path(__file__).resolve().parents[2]
ID=globals()['CHARACTER_ID']
DOC=json.loads((ROOT/f'page/game/story-studio/data/characters/{ID}.json').read_text())
NAME=DOC['name']['en']
OUT=Path(os.environ.get(ID.upper()+'_OUTPUT_DIR',str(ROOT/f'page/game/story-studio/models/{ID}')))
ADULT=DOC['base']=='man'
PLAN=({'ankle':.039,'knee':.285,'hip':.530,'waist':.620,'shoulder':.818,'neck':.850,'chin':.868,
       'shoulderW':.235,'hipW':.182,'armW':.049} if ADULT else
      {'ankle':.042,'knee':.260,'hip':.485,'waist':.590,'shoulder':.790,'neck':.812,'chin':.825,
       'shoulderW':.194,'hipW':.174,'armW':.042})


def finish(g):
    old=dict(g['J']);P=PLAN;H=DOC['height'];build=DOC['build']
    shoulder=H*P['shoulderW']*(.86+build*.44)*.86/2+H*P['armW']*(.92+build*.24)*.42
    hip=H*P['hipW']*.27
    elbow=H*(P['shoulder']-(P['shoulder']-P['hip'])*.52)
    joints={'hips':(0,H*P['hip'],0),'chest':(0,H*P['waist'],0),
            'neck':(0,H*P['neck'],0),'head':(0,H*(P['neck']+(P['chin']-P['neck'])*.4),0)}
    for side,sign in [('l',1),('r',-1)]:
        for part,y,z in [('Arm',H*P['shoulder'],shoulder),('Fore',elbow,shoulder),
                         ('Hand',H*P['hip'],shoulder),('Thigh',H*P['hip'],hip),
                         ('Shin',H*P['knee'],hip),('Foot',H*P['ankle'],hip)]:
            joints[side+part]=(0,y,sign*z)
    anchors=sorted([(0,0)]+[(old[n][1],joints[n][1]) for n in
        ['lFoot','lShin','hips','chest','lFore','lArm','neck','head']]+[(1.296,H+.006)])
    def map_y(y):
        for (a,b),(c,d) in zip(anchors,anchors[1:]):
            if y<=c:return b+(y-a)/(c-a)*(d-b)
        return anchors[-1][1]+(y-anchors[-1][0])
    def smooth(t):
        t=max(0,min(1,t));return t*t*(3-2*t)
    arm_scale=shoulder/old['lArm'][2];hip_scale=hip/old['lThigh'][2]
    head_scale=1.08 if ADULT else .99
    def morph(p,arm=0):
        x,y,z=p
        neck=smooth((y-.990)/.070)
        torso=hip_scale+(arm_scale-hip_scale)*smooth((y-.665)/.22)
        side_scale=torso*(1-neck)+head_scale*neck
        # Rui has a wider jaw and deeper adult facial planes; Tom retains the
        # larger rounded head and softer jaw of a child, independently of height.
        jaw=(.19 if ADULT else .025)*exp(-((y-1.082)/.041)**2)
        zz=z*(side_scale*(1-arm)+arm_scale*arm)*(1+jaw)
        depth=(1.76 if ADULT else .99)*(1-neck)+(1.12 if ADULT else .98)*neck
        xx=x*depth
        yy=map_y(y)
        if ADULT:
            # The continuous warp includes lids, iris, face and brows together.
            yy-=.17*(y-1.166)*exp(-((y-1.166)/.027)**2)*exp(-((abs(z)-.042)/.034)**2)
        return xx,yy,zz
    bpy.data.objects.remove(bpy.data.objects['Lia_Hair'],do_unlink=True)
    rig=g['rig'];bpy.ops.object.select_all(action='DESELECT')
    for ob in list(rig.children):
        if ob.type!='MESH':continue
        bpy.context.view_layer.objects.active=ob;ob.select_set(True)
        bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
        groups={vg.index:vg.name for vg in ob.vertex_groups}
        for vert in ob.data.vertices:
            arm=sum(w.weight for w in vert.groups if groups[w.group].endswith(('Arm','Fore','Hand')))
            vert.co=g['v'](morph(g['story'](vert.co),arm))
        if ob.name=='Lia_Face':
            attr=ob.data.color_attributes.get('FaceTint');base=g['rgba'](DOC['look']['skin'])
            rose=g['rgba']('#af7158' if ADULT else '#d79f88')
            for vert,item in zip(ob.data.vertices,attr.data):
                x,y,z=g['story'](vert.co)
                blush=(.08 if ADULT else .16)*exp(-((abs(z)-.055*head_scale)/.028)**2-((y-map_y(1.127))/.023)**2)*max(0,x/.1)
                item.color=tuple(base[k]*(1-blush)+rose[k]*blush for k in range(3))+(1,)
        if ob.name.startswith(('Lia_Body','Lia_Face','Lia_Hand')):ob['bodyContact']=True
        ob.name=ob.name.replace('Lia_',NAME+'_');ob.select_set(False)
    bpy.context.view_layer.objects.active=rig;rig.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    for bone in rig.data.edit_bones:
        oldtail=g['story'](bone.tail)
        bone.head=g['v'](joints[bone.name]);bone.tail=g['v'](morph(oldtail,1 if bone.name.endswith(('Arm','Fore','Hand')) else 0))
    bpy.ops.object.mode_set(mode='OBJECT')
    rig.name=NAME+'_Rig';rig.data.name=NAME+' • Story Studio 16';rig['height']=H
    for col in bpy.data.collections:col.name=col.name.replace('Lia',NAME)
    palette={'Hair • chestnut':DOC['look']['hair'],
             'Hair • copper ribbons':'#57412b' if ADULT else '#ddbd7b',
             'Hair • strand shadow':'#281e15' if ADULT else '#97713a',
             'Hair • auburn variation':'#44321f' if ADULT else '#bb924d',
             'Lips • rose':'#a97460' if ADULT else '#c08c77',
             'Mouth • warm shadow':'#5e3c2b' if ADULT else '#78543d'}
    for mat in bpy.data.materials:
        if mat.name in palette:
            mat.diffuse_color=g['rgba'](palette[mat.name])
            bs=mat.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=mat.diffuse_color
            if mat.name.startswith('Hair'):
                bs.inputs['Roughness'].default_value=.62;bs.inputs['Specular IOR Level'].default_value=.28
    g['J']=joints;g['H']=H
    # A close crop with a softly swept top. Tom's longer, uneven fringe is
    # authored separately; neither character inherits the braid or long hair.
    def scalp(t,a,lift=0):
        top=max(0,cos(t))
        swept=(.005 if ADULT else .009)*sin(2*a+.8)*sin(t)*top
        return Vector((-.003+(.097+lift)*sin(t)*cos(a),
            1.159+(.135+lift)*cos(t)+swept,
            (.106+lift)*sin(t)*sin(a)))
    def hairline(a):
        return 1.10+.84*(1-cos(a))/2-.11*exp(-((abs(a)-pi/2)/.35)**2)+(.025 if ADULT else .08)*cos(5*a+.7)*max(0,cos(a))
    g['scalp']=scalp;g['hairbits']=[]
    N=128;R=40;vv=[];ff=[]
    for j in range(R+1):
        for i in range(N):
            a=-pi+2*pi*i/N;t=.002+(hairline(a)-.002)*j/R
            vv.append(tuple(scalp(t,a,.0005*sin(37*a+2*t))))
    for j in range(R):
        for i in range(N):
            a=j*N+i;b=j*N+(i+1)%N;ff.append((a,a+N,b+N,b))
    g['hairbits'].append(g['mesh'](NAME+' crop foundation',vv,ff,g['hair']))
    # Short overlapping locks, swept from a side part over the forehead.
    for i in range(10):
        u=i/9
        controls=[(-.015-.034*u,1.293-.012*u,-.030-.009*u),
                  (.072-.040*u,1.305-.012*u,-.047),
                  (.110-.040*u,1.252,.008+.043*u),
                  (.082-.075*u,1.215+(.018 if ADULT else -.003)*sin(i),.052+.038*u)]
        g['hairlock']('Short swept crop',controls,.015 if ADULT else .020,.0035 if ADULT else .005,g['hair'] if i%4 else g['hairsoft'])
    for i in range(28):
        a=-pi+2*pi*i/28
        if abs(a)<.60:continue
        end=hairline(a)-.025
        controls=[tuple(scalp(.16,a-.18)),tuple(scalp(.58,a-.11)),
                  tuple(scalp(end*.82,a-.06)),tuple(scalp(end,a))]
        g['hairlock']('Tapered crop side',controls,.011,.0023,g['hair'],detail=True)
    if not ADULT:
        for i in range(4):
            u=i/3
            controls=[(.020,1.285,-.045+.025*u),(.090,1.28,-.06+.02*u),
                      (.105,1.235,-.030+.026*u),(.089,1.206+.012*u,-.005+.025*u)]
            g['hairlock']('Boy tousled fringe',controls,.012,.004,g['hairlight'] if i==1 else g['hair'])
    for ob in g['hairbits']:
        for vert in ob.data.vertices:vert.co=g['v'](morph(g['story'](vert.co)))
    g['bind'](g['join'](g['hairbits'],NAME+'_Hair'),'head')

runpy.run_path(str(ROOT/'scripts/blender/build_lia.py'),run_name='__main__',init_globals={
    'CHARACTER_DOC':DOC,'CHARACTER_OUTPUT':str(OUT),'CHARACTER_FINISH':finish})
