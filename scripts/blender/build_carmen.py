"""Build Carmen using Lia's connected skin/garment construction and an adult profile.
Run: blender --background --python scripts/blender/build_carmen.py [-- --no-render]
CARMEN_OUTPUT_DIR may point to a separate directory for experiments.
"""
import bpy
import bmesh
from mathutils.bvhtree import BVHTree
import math
import json
import os
import runpy
from pathlib import Path
from mathutils import Vector
from math import sin, cos, pi, exp

ROOT=Path(__file__).resolve().parents[2]
DOC=json.loads((ROOT/'page/game/story-studio/data/characters/carmen.json').read_text())
OUT=Path(os.environ.get('CARMEN_OUTPUT_DIR',str(ROOT/'page/game/story-studio/models/carmen')))


def finish(g):
    old=dict(g['J']);H=DOC['height'];build=DOC['build']
    shoulder=H*.202*(.86+build*.44)*.86/2+H*.041*(.92+build*.24)*.42
    hip=H*.196*.27
    elbow=H*(.812-(.812-.520)*.52)
    joints={'hips':(0,H*.520,0),'chest':(0,H*.628,0),
            'neck':(0,H*.845,0),'head':(0,H*(.845+.021*.4),0)}
    for side,sign in [('l',1),('r',-1)]:
        for part,y,z in [('Arm',H*.812,shoulder),('Fore',elbow,shoulder),
                         ('Hand',H*.520,shoulder),('Thigh',H*.520,hip),
                         ('Shin',H*.285,hip),('Foot',H*.039,hip)]:
            joints[side+part]=(0,y,sign*z)
    anchors=sorted([(0,0)]+[(old[n][1],joints[n][1]) for n in
        ['lFoot','lShin','hips','chest','lFore','lArm','neck','head']]+[(1.296,H+.009)])
    def map_y(y):
        for (a,b),(c,d) in zip(anchors,anchors[1:]):
            if y<=c:return b+(y-a)/(c-a)*(d-b)
        return anchors[-1][1]+(y-anchors[-1][0])*.97
    def smooth(t):
        t=max(0,min(1,t));return t*t*(3-2*t)
    arm_scale=shoulder/old['lArm'][2];hip_scale=hip/old['lThigh'][2]
    def morph(p,arm=0,bust=True):
        x,y,z=p
        neck=smooth((y-.990)/.065)
        torso_scale=hip_scale+(arm_scale-hip_scale)*smooth((y-.68)/.25)
        side_scale=torso_scale*(1-neck)+.97*neck
        xx=x*(1.30*(1-neck)+.97*neck)
        zz=z*(side_scale*(1-arm)+arm_scale*arm)
        # A continuous chest displacement: volume grows from the ribs and
        # blends into the sternum. The exact same field fits every garment.
        if bust and x>0 and .77<y<.981:
            front=smooth(x/.042)
            lobes=exp(-((z-.047)/.038)**2)+exp(-((z+.047)/.038)**2)
            xx+=.078*exp(-((y-.893)/.046)**2)*lobes*front*(1-arm)
        shoulder_lift=.018*exp(-((y-.978)/.032)**2)*smooth((abs(z)-.040)/.07)
        return xx,map_y(y)+shoulder_lift,zz
    g['PROFILE_MAP']=morph
    # Hair is constructed specifically for Carmen, rather than stretching the braid.
    bpy.data.objects.remove(bpy.data.objects['Lia_Hair'],do_unlink=True)
    rig=g['rig'];bpy.ops.object.select_all(action='DESELECT')
    for ob in list(rig.children):
        if ob.type!='MESH':continue
        bpy.context.view_layer.objects.active=ob;ob.select_set(True)
        bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
        # Dense cloth rings are needed for a smooth fitted bust after the morph.
        if ob.get('wardrobe'):
            bm=bmesh.new();bm.from_mesh(ob.data)
            for _ in range(3):
                long=[e for e in bm.edges if e.calc_length()>.009]
                if not long:break
                bmesh.ops.subdivide_edges(bm,edges=long,cuts=1,use_grid_fill=True)
            bm.to_mesh(ob.data);bm.free()
        names={vg.index:vg.name for vg in ob.vertex_groups}
        for vert in ob.data.vertices:
            arm=sum(w.weight for w in vert.groups if names[w.group].endswith(('Arm','Fore','Hand')))
            p=g['story'](vert.co)
            moved=list(morph(p,arm))
            # Resting hands clear the skirt while the original joint pivots stay exact.
            moved[2]+=(1 if p[2]>0 else -1)*.018*arm*smooth((.94-p[1])/.18)
            vert.co=g['v'](moved)
        dst=g['rgba'](DOC['look']['skin'])
        if ob.name=='Lia_Face':
            attr=ob.data.color_attributes.get('FaceTint')
            if attr:
                for vert,item in zip(ob.data.vertices,attr.data):
                    x,y,z=g['story'](vert.co)
                    blush=.13*exp(-((abs(z)-.053)/.027)**2-((y-map_y(1.127))/.022)**2)*max(0,x/.09)
                    rose=g['rgba']('#ab6050')
                    item.color=tuple(dst[k]*(1-blush)+rose[k]*blush for k in range(3))+(1,)
        if ob.name.startswith(('Lia_Body','Lia_Face','Lia_Hand')):ob['bodyContact']=True
        ob.name=ob.name.replace('Lia_','Carmen_')
        ob.select_set(False)
    # Fit the garment front/back to the final continuous body. This also
    # compensates for different triangulation densities on cloth and skin.
    body=bpy.data.objects['Carmen_Body'];bm=bmesh.new();bm.from_mesh(body.data)
    surface=BVHTree.FromBMesh(bm)
    for ob in g['wardrobe']:
        for vert in ob.data.vertices:
            x,y,z=g['story'](vert.co)
            if not map_y(.77)<y<map_y(.983) or abs(z)>.162 or abs(x)<.025:continue
            sign=1 if x>0 else -1
            hit,normal,index,distance=surface.ray_cast(Vector((sign,vert.co.y,vert.co.z)),Vector((-sign,0,0)),2)
            if hit is not None:
                vert.co.x=sign*max(sign*x,sign*hit.x+.010)
    bm.free()
    # Native bones keep anatomical tails; runtime uses canonical joint frames.
    bpy.context.view_layer.objects.active=rig;rig.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    for bone in rig.data.edit_bones:
        oldtail=g['story'](bone.tail)
        bone.head=g['v'](joints[bone.name])
        bone.tail=g['v'](morph(oldtail,1 if bone.name.endswith(('Arm','Fore','Hand')) else 0,False))
    bpy.ops.object.mode_set(mode='OBJECT')
    rig.name='Carmen_Rig';rig.data.name='Carmen • Story Studio 16';rig['height']=H
    for col in bpy.data.collections:col.name=col.name.replace('Lia','Carmen')
    # Recolor all original face details consistently (brows, eyelashes, lips).
    palette={'Hair • chestnut':'#1c1410','Hair • copper ribbons':'#493025',
             'Hair • strand shadow':'#100c0a','Hair • auburn variation':'#2b1d16',
             'Lips • rose':'#9e534e','Mouth • warm shadow':'#4a2823'}
    for mat in bpy.data.materials:
        if mat.name in palette:
            mat.diffuse_color=g['rgba'](palette[mat.name]);mat.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=mat.diffuse_color
    for mat in bpy.data.materials:
        if mat.name.startswith('Hair'):
            bs=mat.node_tree.nodes.get('Principled BSDF');bs.inputs['Specular IOR Level'].default_value=.28
    g['J']=joints;g['H']=H
    hair=g['hair'];variation=g['material']('Hair • dark warm ribbons','#302019',.46)
    sheen=g['material']('Hair • subtle chestnut sheen','#3d2a20',.48)
    bits=[]
    def hair_morph(p):
        x,y,z=p
        flare=.022*smooth((1.13-y)/.22)
        hair_y=map_y(1.159)+(y-1.159)*(.97+.33*smooth((1.17-y)/.12))
        return x*.97,hair_y,z*.97+(1 if z>0 else -1)*flare
    # Close scalp foundation; curved sections overlap its hairline and crown.
    verts=[];faces=[];N=112;R=40
    for j in range(R+1):
        for i in range(N):
            a=2*pi*i/N;t=.002+(g['hairline'](a)-.002)*j/R
            p=g['scalp'](t,a,.001*sin(8*a+t)*sin(t)**2)
            verts.append(hair_morph(p))
    for j in range(R):
        for i in range(N):
            a=j*N+i;b=j*N+(i+1)%N;faces.append((a,a+N,b+N,b))
    bits.append(g['mesh']('Carmen close hair foundation',verts,faces,hair))
    def lock(name,path,width,depth,mat,detail=True):
        vv=[];ff=[];axes=[];normals=[];radii=[];count=len(path)-1;K=12
        path=[Vector(p) for p in path]
        for j,p in enumerate(path):
            t=j/count;tangent=(path[min(count,j+1)]-path[max(0,j-1)]).normalized()
            normal=Vector((p.x,(p.y-map_y(1.159))*.15,p.z)).normalized()
            axis=tangent.cross(normal).normalized();normal=axis.cross(tangent).normalized()
            r=max(.018,sin(pi*t)**.30)*(1-.25*t)
            axes.append(axis);normals.append(normal);radii.append(r)
            for k in range(K):
                a=2*pi*k/K;vv.append(tuple(p+axis*width*r*cos(a)+normal*depth*r*sin(a)))
        for j in range(count):
            for k in range(K):
                a=j*K+k;b=j*K+(k+1)%K;ff.append((a,b,b+K,a+K))
        ff.extend([tuple(reversed(range(K))),tuple(count*K+k for k in range(K))])
        bits.append(g['mesh'](name,vv,ff,mat))
        if detail:
            for offset in [-.55,0,.55]:
                points=[tuple(p+axes[j]*width*radii[j]*offset+normals[j]*(depth*radii[j]*math.sqrt(1-offset**2)+.0001)) for j,p in enumerate(path)]
                bits.append(g['tube']('Soft flowing filament',points,.00011,variation,5))
    # Crown-to-back cascades, with independently phased S waves and tapered ends.
    for side in [-1,1]:
        for i in range(13):
            a=side*(.77+i*.185);path=[];phase=i*.61+(side+1)*.3
            for k in range(85):
                t=k/84
                if t<.40:
                    u=t/.40;p=g['scalp'](.12+1.47*u,a-.18*(1-u),.002)
                else:
                    u=(t-.40)/.60;root=g['scalp'](1.59,a,.002)
                    drop=(.34+.045*sin(i*.8))*u
                    wave=sin(u*pi*3.4+phase)-sin(phase)
                    p=Vector((root.x-.018*u+.027*wave*smooth(u/.30)-.15*smooth(u/.55)*max(0,cos(a)),root.y-drop,
                              root.z+side*(.011*sin(u*pi)+.026*wave*smooth(u/.30))))
                path.append(hair_morph(p))
            lock('Long layered wave',path,.025+(i%3)*.002,.010,hair if i%4 else variation)
    # Broad side-parted fringe follows the skull, then opens beside the cheeks.
    for side in [-1,1]:
        for i in range(5):
            path=[];a=side*(.26+i*.105)
            for k in range(65):
                t=k/64;p=g['scalp'](.13+1.22*t,a+side*.48*t,.0025)
                path.append(hair_morph(p))
            lock('Swept face frame',path,.020,.0045,hair if i%3 else variation)
        # Two loose face-framing waves fall in front of the shoulders/bust.
        for i in range(2):
            path=[]
            for k in range(73):
                t=k/72;y=1.205-(.35-i*.035)*t
                x=.064+.030*t+.023*sin(pi*t)+.025*sin(t*pi*3)
                z=side*(.080+.022*sin(t*pi*.8)+.018*sin(t*pi*3+i))
                xx,yy,zz=hair_morph((x,y,z))
                xx+=.062*smooth((t-.35)/.35)
                if yy<H*.85:
                    hit,_,_,_=surface.ray_cast(g['v']((1,yy,zz)),Vector((-1,0,0)),2)
                    if hit is not None:xx=max(xx,hit.x+.027)
                path.append((xx,yy,zz))
            lock('Loose face framing wave',path,.016,.007,variation if i else hair)
    # Overlapping side-swept sections cover the front foundation up to its edge.
    g['hairbits']=[]
    for i in range(9):
        u=i/8
        controls=[(-.004-.045*u,1.291-.008*u,-.030-.012*u),
                  (.100-.045*u,1.300-.020*u,-.052-.010*u),
                  (.118-.055*u,1.227+.015*u,.030+.052*u),
                  (.054-.075*u,1.187-.040*u,.092+.009*u)]
        g['hairlock']('Carmen swept fringe',controls,.019-.002*u,.004,hair if i%3 else variation)
    for ob in g['hairbits']:
        for vert in ob.data.vertices:vert.co=g['v'](hair_morph(g['story'](vert.co)))
        bits.append(ob)
    g['bind'](g['join'](bits,'Carmen_Hair'),'head')

runpy.run_path(str(ROOT/'scripts/blender/build_lia.py'),run_name='__main__',init_globals={
    'CHARACTER_DOC':DOC,'CHARACTER_OUTPUT':str(OUT),'CHARACTER_FINISH':finish})
