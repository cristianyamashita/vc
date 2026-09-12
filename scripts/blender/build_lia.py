"""Build Lia's editable Blender source and Story Studio skinned GLB.

Run with Blender 4.5: blender --background --python scripts/blender/build_lia.py
Authoring coordinates below are Story Studio's: +X face, +Y up, +Z left.
All assets are original procedural geometry; no downloaded character assets.
"""
import bpy
import math
import json
import sys
import os
from pathlib import Path
from mathutils import Vector
from math import sin, cos, pi, exp

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(globals().get('CHARACTER_OUTPUT') or os.environ.get('LIA_OUTPUT_DIR', str(ROOT / 'page/game/story-studio/models/lia')))
OUT.mkdir(parents=True, exist_ok=True)
DOC = globals().get('CHARACTER_DOC') or json.loads((ROOT / 'page/game/story-studio/data/characters/lia.json').read_text())
ASSET_ID = DOC['id']
SKIN_COLOR = DOC.get('look', {}).get('skin', '#e8c6a4')
H = 1.27
PARENTS = {'hips': None, 'chest': 'hips', 'neck': 'chest', 'head': 'neck',
           'lArm': 'chest', 'lFore': 'lArm', 'lHand': 'lFore',
           'rArm': 'chest', 'rFore': 'rArm', 'rHand': 'rFore',
           'lThigh': 'hips', 'lShin': 'lThigh', 'lFoot': 'lShin',
           'rThigh': 'hips', 'rShin': 'rThigh', 'rFoot': 'rShin'}
shoulder = (H * .182 * (.86 + .46 * .44) * .86 / 2
            + H * .039 * (.92 + .46 * .24) * .42)
hip = H * .182 * .27
elbow = H * (.786 - (.786 - .482) * .52)
J = {'hips': (0, H * .482, 0), 'chest': (0, H * .592, 0),
     'neck': (0, H * .810, 0), 'head': (0, H * (.810 + .014 * .4), 0)}
for side, sign in [('l', 1), ('r', -1)]:
    for part, y, z in [('Arm', H * .786, shoulder), ('Fore', elbow, shoulder),
                       ('Hand', H * .482, shoulder), ('Thigh', H * .482, hip),
                       ('Shin', H * .262, hip), ('Foot', H * .042, hip)]:
        J[side + part] = (0, y, sign * z)

def v(p):
    return Vector((p[0], -p[2], p[1]))

def story(p):
    return p.x, p.z, -p.y

def linear(c):
    return c / 12.92 if c <= .04045 else ((c + .055) / 1.055) ** 2.4

def rgba(h):
    h = h.lstrip('#')
    return tuple(linear(int(h[i:i+2], 16) / 255) for i in (0, 2, 4)) + (1,)

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for col in list(bpy.data.collections):
    if col.name != 'Collection':
        bpy.data.collections.remove(col)
base_collection = bpy.data.collections.get('Collection')
base_collection.name = 'Lia • body and face'

def material(name, color, rough=.5, subsurface=0, metallic=0):
    m = bpy.data.materials.new(name)
    m.diffuse_color = rgba(color)
    m.use_nodes = True
    bs = m.node_tree.nodes.get('Principled BSDF')
    bs.inputs['Base Color'].default_value = rgba(color)
    bs.inputs['Roughness'].default_value = rough
    bs.inputs['Metallic'].default_value = metallic
    bs.inputs['Subsurface Weight'].default_value = subsurface
    if subsurface:
        bs.inputs['Subsurface Radius'].default_value = (1, .45, .24)
        bs.inputs['Subsurface Scale'].default_value = .025
    return m

skin = material('Skin • warm porcelain', SKIN_COLOR, .48, .07)
lip = material('Lips • rose', '#b77970', .5, .025)
crease = material('Mouth • warm shadow', '#673d32', .7)
hair = material('Hair • chestnut', '#70371f', .4)
hairlight = material('Hair • copper ribbons', '#985434', .42)
hairdark = material('Hair • strand shadow', '#4c2417', .48)
white = material('Eyes • ivory', '#fff7e9', .2)
iris = material('Eyes • amber brown', '#815632', .27)
irislight = material('Eyes • honey', '#bb8b46', .3)
pupil = material('Eyes • pupil and limbal ring', '#211710', .2)
glint = material('Eyes • catchlight', '#ffffff', .08)
ivory = material('Cotton • warm white', '#f2ebdc', .86)
denim = material('Denim', '#456f9b', .86)
sole = material('Rubber • ivory', '#ded8cc', .86)
charcoal = material('Trousers • charcoal', '#323b49', .83)
gold = material('Brass • buttons', '#d2a967', .32, metallic=.6)
under = material('Foundation • opaque cotton', '#d6c9b9', .9)

def mesh(name, verts, faces, mat):
    data = bpy.data.meshes.new(name)
    data.from_pydata([v(p) for p in verts], [], faces)
    data.update()
    ob = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(ob)
    ob.data.materials.append(mat)
    for poly in data.polygons:
        poly.use_smooth = True
    return ob

def ellipsoid(name, pos, scale, mat, segments=32, rings=20):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, location=v(pos))
    ob = bpy.context.object
    ob.name = name
    ob.scale = (scale[0], scale[2], scale[1])
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    ob.data.materials.append(mat)
    for p in ob.data.polygons:
        p.use_smooth = True
    return ob

def loft(name, rows, mat, n=40, pleats=0):
    # (height, depth radius, side radius, forward offset, side offset).
    verts, faces = [], []
    for y, rx, rz, x, z in rows:
        for i in range(n):
            a = i / n * 2 * pi
            f = 1 + pleats * cos(12*a)
            verts.append((x + rx*cos(a)*f, y, z + rz*sin(a)*f))
    for j in range(len(rows)-1):
        for i in range(n):
            a = j*n+i; b=j*n+(i+1)%n
            faces.append((a,b,b+n,a+n))
    faces += [tuple(reversed(range(n))), tuple((len(rows)-1)*n+i for i in range(n))]
    return mesh(name, verts, faces, mat)

def tube(name, points, radius, mat, sides=8):
    verts, faces = [], []
    for i, p in enumerate(points):
        a = Vector(points[max(i-1,0)]); b = Vector(points[min(i+1,len(points)-1)])
        tangent = (b-a).normalized()
        ref = Vector((1,0,0)) if abs(tangent.x) < .9 else Vector((0,0,1))
        u = tangent.cross(ref).normalized(); w = tangent.cross(u)
        r = radius if isinstance(radius, (int,float)) else radius[i]
        for k in range(sides):
            q = Vector(p) + r*(u*cos(k*2*pi/sides) + w*sin(k*2*pi/sides))
            verts.append(tuple(q))
    for i in range(len(points)-1):
        for k in range(sides):
            a=i*sides+k; b=i*sides+(k+1)%sides
            faces.append((a,a+sides,b+sides,b))
    faces += [tuple(reversed(range(sides))),tuple((len(points)-1)*sides+k for k in range(sides))]
    return mesh(name, verts, faces, mat)

def join(obs, name):
    bpy.ops.object.select_all(action='DESELECT')
    for o in obs: o.select_set(True)
    bpy.context.view_layer.objects.active = obs[0]
    bpy.ops.object.join()
    ob = bpy.context.object; ob.name = name
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return ob

def smooth_union(obs, name, voxel):
    ob = join(obs,name)
    mod = ob.modifiers.new('Sculpt • seamless volumes', 'REMESH')
    mod.mode = 'VOXEL'; mod.voxel_size = voxel; mod.use_smooth_shade = True
    bpy.ops.object.modifier_apply(modifier=mod.name)
    mod = ob.modifiers.new('Sculpt • polish', 'SMOOTH'); mod.factor=.9; mod.iterations=6
    bpy.ops.object.modifier_apply(modifier=mod.name)
    if name != 'Lia_Body':
        mod=ob.modifiers.new('Retopology • garment budget','DECIMATE');mod.ratio=.10
        bpy.ops.object.modifier_apply(modifier=mod.name)
    return ob

def mixweights(y, low, high, a, b):
    t=max(0,min(1,(y-low)/(high-low))); t=t*t*(3-2*t)
    return {a: 1-t, b:t}

def bodyweights(p):
    x,y,z=p
    side='l' if z>0 else 'r'
    if abs(z) > .109 and y > .55 and y < 1.016:
        if y > .957:
            t=max(0,min(1,(abs(z)-.103)/.025))
            return {'chest':1-t,side+'Arm':t}
        if y > elbow+.034: return {side+'Arm':1}
        if y > elbow-.034: return mixweights(y,elbow-.034,elbow+.034,side+'Fore',side+'Arm')
        if y > J[side+'Hand'][1]+.020: return {side+'Fore':1}
        return mixweights(y,J[side+'Hand'][1]-.015,J[side+'Hand'][1]+.020,side+'Hand',side+'Fore')
    if y < .63:
        if y > .58: return mixweights(y,.58,.65,side+'Thigh','hips')
        if y > .365: return {side+'Thigh':1}
        if y > .30: return mixweights(y,.30,.365,side+'Shin',side+'Thigh')
        if y > .085: return {side+'Shin':1}
        return mixweights(y,.037,.085,side+'Foot',side+'Shin')
    if y > 1.01: return mixweights(y,1.00,1.037,'chest','neck')
    return mixweights(y,.715,.79,'hips','chest')

def clothweights(p):
    x,y,z=p
    if y < .65 and abs(z) < .03:
        return {'hips':1}
    return bodyweights(p)

def armweights(p):
    x,y,z=p; side='l' if z>0 else 'r'
    if y>elbow+.035: return {side+'Arm':1}
    if y>elbow-.035: return mixweights(y,elbow-.035,elbow+.035,side+'Fore',side+'Arm')
    return mixweights(y,J[side+'Hand'][1]-.015,J[side+'Hand'][1]+.02,side+'Hand',side+'Fore')

def legweights(p):
    x,y,z=p; side='l' if z>0 else 'r'
    if y>.58: return mixweights(y,.58,.65,side+'Thigh','hips')
    if y>.365: return {side+'Thigh':1}
    if y>.30: return mixweights(y,.30,.365,side+'Shin',side+'Thigh')
    if y>.085: return {side+'Shin':1}
    return mixweights(y,.037,.085,side+'Foot',side+'Shin')

def skirtweights(p):
    x,y,z=p
    if y>.70: return mixweights(y,.715,.79,'hips','chest')
    t=max(0,min(.94,(.69-y)/.19))
    left=max(0,min(1,(z+.022)/.044))
    return {'hips':1-t,'lThigh':t*left,'rThigh':t*(1-left)}

def shoulderweights(p, cloth=False):
    x,y,z=p
    if y>1.01 and abs(z)<.065:
        return mixweights(y,1.00,1.037,'chest','neck')
    # Widen the chest/arm blend over the axilla and deltoid. Both sides of
    # the welded shoulder use this continuous field; no independently rigid cap.
    t=max(0,min(1,(y-.895)/.08));t=t*t*(3-2*t)
    low,high=.094,.099
    if cloth:
        # Follow the torso contour below the axilla. A fixed Z threshold
        # can accidentally assign the shirt's waist or ribs to an arm.
        profile=[(.66,.090),(.715,.089),(.765,.088),(.86,.097),(.949,.103)]
        radius=profile[0][1] if y<profile[0][0] else profile[-1][1]
        for (ay,az),(by,bz) in zip(profile,profile[1:]):
            if ay<=y<=by:radius=az+(bz-az)*(y-ay)/(by-ay);break
        low,high=radius+.001,radius+.004
    low=low*(1-t)+.065*t
    high=high*(1-t)+.127*t
    a=max(0,min(1,(abs(z)-low)/(high-low)));a=a*a*(3-2*a)
    torso=mixweights(y,.715,.79,'hips','chest')
    out={k:w*(1-a) for k,w in torso.items()}
    for k,w in armweights(p).items():out[k]=out.get(k,0)+w*a
    return out

def shirtweights(p):
    return shoulderweights(p,cloth=True)

def pieceweights(ob):
    name=ob.name
    if name.startswith(('Shoe','Sole','Sneaker')):
        return lambda p: {'lFoot' if p[2]>0 else 'rFoot':1}
    if name.startswith(('Continuous trousers','Cuff seam')): return legweights
    if name.startswith(('Soft skirt','Skirt hem','Towel overlap')): return skirtweights
    if name.startswith('Sleeve seam'): return armweights
    if name.startswith('Sleeve'): return shirtweights
    if name.startswith('Continuous shirt'): return shirtweights
    return lambda p: mixweights(p[1],.715,.79,'hips','chest')

armdata=bpy.data.armatures.new('Lia • Story Studio 16')
rig=bpy.data.objects.new('Lia_Rig',armdata)
bpy.context.collection.objects.link(rig)
bpy.context.view_layer.objects.active=rig
rig.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
for name,parent in PARENTS.items():
    b=armdata.edit_bones.new(name); b.head=v(J[name])
    next_joint={'hips':'chest','chest':'neck','neck':'head'}
    for side in ['l','r']:
        next_joint.update({side+'Arm':side+'Fore',side+'Fore':side+'Hand',
                           side+'Thigh':side+'Shin',side+'Shin':side+'Foot'})
    if name in next_joint: b.tail=v(J[next_joint[name]])
    elif name=='head': b.tail=v((0,1.26,0))
    elif name.endswith('Foot'): b.tail=b.head+Vector((.075,0,-.018))
    else: b.tail=b.head+Vector((0,0,-.065))
    if parent: b.parent=armdata.edit_bones[parent]
bpy.ops.object.mode_set(mode='OBJECT')
rig.show_in_front=True; armdata.display_type='OCTAHEDRAL'
rig['storyStudioRig']='story-studio-v1'
rig['height']=H

def bind(ob, weights=bodyweights, wardrobe=None):
    groups={n:ob.vertex_groups.new(name=n) for n in PARENTS}
    for vert in ob.data.vertices:
        p=story(ob.matrix_world @ vert.co)
        ww={weights:1} if isinstance(weights,str) else weights(p)
        for n,w in ww.items():
            if w > .00001: groups[n].add([vert.index],w,'REPLACE')
    mod=ob.modifiers.new('Lia • skin deformation','ARMATURE'); mod.object=rig
    ob.parent=rig
    if wardrobe: ob['wardrobe']=wardrobe
    return ob

# Weld torso and arms before skinning. Build the legs separately so the
# neutral-pose wrist cannot be welded to a nearby thigh during voxel remeshing.
hands=[]; arms=[]
vol=[loft('Torso sculpt',[(.59,.048,.070,0,0),(.63,.055,.088,0,0),(.71,.053,.082,0,0),
    (.76,.051,.079,0,0),(.86,.058,.089,0,0),(.95,.057,.095,0,0),(.988,.043,.079,0,0),
    (1.002,.024,.033,0,0)],skin)]
vol.append(ellipsoid('Neck sculpt',(0,1.026,0),(.027,.051,.031),skin))
legparts=[loft('Hip overlap',[(.59,.048,.070,0,0),(.63,.055,.088,0,0),(.69,.054,.084,0,0)],skin)]
for s in [1,-1]:
    z=s*shoulder
    arms.append(loft('Lia_Arm_'+('L' if s>0 else 'R'),[(.604,.018,.021,0,z),(.64,.019,.022,0,z),(.70,.023,.024,-.002,z),
        (.78,.024,.024,0,z),(.81,.026,.026,0,z+s*.005),(.91,.028,.028,0,z+s*.011),
        (.934,.028,.029,0,z+s*.007),(.953,.028,.029,0,z),(.972,.025,.029,0,z-s*.010),
        (.984,.020,.029,0,z-s*.026),(.989,.013,.029,0,z-s*.047),
        (.991,.010,.018,0,z-s*.064)],skin,32))
    handparts=[ellipsoid('Palm sculpt',(.002,.586,z),(.018,.033,.023),skin)]
    for k in range(4):
        zz=z+(k-1.5)*.011
        length=[.026,.038,.039,.031][k]
        handparts.append(ellipsoid('Finger sculpt',(.004,.565-length*.36,zz),(.0075,length*.64,.0066),skin,16,12))
    handparts.append(tube('Thumb sculpt',[(.005,.601,z-s*.018),(.019,.59,z-s*.031),(.024,.574,z-s*.032)],.009,skin,12))
    hands.append(smooth_union(handparts,'Lia_Hand_'+('L' if s>0 else 'R'),.0015))
    z=s*hip
    legparts.append(loft('Leg sculpt',[(.049,.021,.023,0,z),(.10,.025,.027,0,z),(.20,.032,.031,-.003,z),
        (.285,.030,.030,0,z),(.334,.031,.032,.004,z),(.39,.036,.037,0,z),
        (.51,.043,.044,0,z),(.605,.046,.046,0,z),(.642,.03,.04,0,z)],skin,32))
    legparts.append(ellipsoid('Foot sculpt',(.023,.033,z),(.063,.032,.030),skin))
upper=smooth_union(vol+arms,'Lia_Body',.0025)
lower=smooth_union(legparts,'Lia_Body',.0035)
for ob,ratio in [(upper,.30),(lower,.38)]:
    bpy.context.view_layer.objects.active=ob
    decimate=ob.modifiers.new('Retopology • web budget','DECIMATE');decimate.ratio=ratio
    bpy.ops.object.modifier_apply(modifier=decimate.name)
bind(upper,shoulderweights)
def lowerweights(p):
    if p[1]<.66:return legweights(p)
    return mixweights(p[1],.715,.79,'hips','chest')
bind(lower,lowerweights)
# The hidden hip overlap carries identical hips weights on both surfaces.
# Joining here preserves the welded arm/chest topology and each region's weights.
body=join([upper,lower],'Lia_Body')
for hand in hands:bind(hand,armweights)

# A continuous facial surface gives cheeks, orbital sockets, bridge and chin
# their own planes. Detail patches below sample this same surface, so eyelids
# and lips sit in the face instead of floating as separate spheres/tubes.
def face_x(y,z):
    t=max(-1,min(1,(y-1.159)/.123))
    jaw=1-.21*max(0,-t)**.65
    side=.100*jaw
    q=max(0,1-t*t-(z/side)**2)
    x=.087*q**.5
    base=x
    g=lambda cy,sy,cz,sz: exp(-((y-cy)/sy)**2-((z-cz)/sz)**2)
    x+=.011*g(1.152,.041,0,.015)  # bridge
    x+=.021*g(1.139,.014,0,.016)  # nose tip
    x+=.005*g(1.133,.007,0,.023)  # nasal wings
    x+=.008*g(1.122,.025,.050,.032)+.008*g(1.122,.025,-.050,.032)
    x-=.0095*g(1.166,.019,.043,.025)+.0095*g(1.166,.019,-.043,.025)
    x+=.0065*g(1.188,.013,.042,.033)+.0065*g(1.188,.013,-.042,.033)
    x+=.008*g(1.098,.022,0,.037)  # muzzle
    x+=.013*g(1.067,.016,0,.030)  # rounded chin plane
    x-=.002*g(1.088,.007,0,.021)  # labiomental fold
    x-=.0018*g(1.117,.009,0,.003) # philtrum
    fade=q/max(.000001,1-t*t)
    return base+(x-base)*fade

verts=[]; faces=[]; n=128; rings=96
for j in range(rings+1):
    t=pi*j/rings
    y=1.159+.123*cos(t)
    jaw=1-.21*max(0,-cos(t))**.65
    for i in range(n):
        a=2*pi*i/n
        z=.100*sin(t)*sin(a)*jaw
        x=.087*sin(t)*cos(a)
        if cos(a)>0:
            base=.087*max(0,1-cos(t)**2-(z/(.100*jaw))**2)**.5
            x=face_x(y,z)
        verts.append((x,y,z))
for j in range(rings):
    for i in range(n):
        a=j*n+i; b=j*n+(i+1)%n; faces.append((a,a+n,b+n,b))
head=mesh('Lia_Face',verts,faces,skin)
# Vertex blush survives glTF, whereas a Blender-only procedural shader would not.
faceMat=skin.copy(); faceMat.name='Skin • face with blush'; head.data.materials[0]=faceMat
col=head.data.color_attributes.new(name='FaceTint',type='FLOAT_COLOR',domain='POINT')
for i,vert in enumerate(head.data.vertices):
    x,y,z=story(vert.co)
    blush=.21*exp(-((abs(z)-.055)/.027)**2-((y-1.127)/.022)**2)*max(0,x/.09)
    base=rgba(SKIN_COLOR); rose=rgba('#cf8875')
    col.data[i].color=tuple(base[k]*(1-blush)+rose[k]*blush for k in range(3))+(1,)
vc=faceMat.node_tree.nodes.new('ShaderNodeVertexColor'); vc.layer_name='FaceTint'
faceMat.node_tree.links.new(vc.outputs['Color'],faceMat.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
bind(head,'head')
facebits=[]
eye_y=1.166; eye_z=.042; eye_w=.024

def eye_bounds(u):
    arc=max(0,sin(pi*u))**.8
    tilt=.002*(2*u-1)
    return eye_y+tilt-.0085*arc, eye_y+tilt+.0125*arc

def eye_surface(y,z):
    u=max(0,min(1,(abs(z)-eye_z+eye_w)/(2*eye_w)))
    low,high=eye_bounds(u)
    vv=max(0,min(1,(y-low)/max(.00001,high-low)))
    return face_x(y,z)+.0015+.0025*sin(pi*u)*sin(pi*vv)

def patch(name,coords,mat,nu,nv):
    faces=[]
    for j in range(nu):
        for k in range(nv):
            a=j*(nv+1)+k;faces.append((a,a+1,a+nv+2,a+nv+1))
    return mesh(name,coords,faces,mat)

for sign in [1,-1]:
    # One sculpted pinna with a recessed concha, a soft helix and an attached
    # lobule. The rim belongs to the surface; it is not a ring around the ear.
    centre=Vector((-.002,1.146,sign*.099))
    normal=Vector((.64,0,sign*.77));across=Vector((-.77,0,sign*.64))
    def earpoint(r,a):
        yy=.021*cos(a)*r
        xx=.0115*sin(a)*r*(.88+.12*cos(a))
        depth=.0038*exp(-((r-.77)/.17)**2)-.0018*exp(-(r/.43)**2)-.005*r**7
        return tuple(centre+across*xx+Vector((0,yy,0))+normal*depth)
    coords=[]
    for j in range(25):
        for k in range(65):coords.append(earpoint(j/24,2*pi*k/64))
    ear=patch('Sculpted ear',coords,skin,24,64)
    earMat=skin.copy();earMat.name='Skin • soft ear interior';ear.data.materials[0]=earMat
    tint=ear.data.color_attributes.new(name='EarTint',type='FLOAT_COLOR',domain='POINT')
    for j in range(25):
        r=j/24;shade=.30*exp(-((r-.33)/.32)**2)
        base=rgba(SKIN_COLOR);pink=rgba('#ca9b88')
        for k in range(65):tint.data[j*65+k].color=tuple(base[c]*(1-shade)+pink[c]*shade for c in range(3))+(1,)
    color=earMat.node_tree.nodes.new('ShaderNodeVertexColor');color.layer_name='EarTint'
    earMat.node_tree.links.new(color.outputs['Color'],earMat.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
    facebits.append(ear)
    facebits.append(ellipsoid('Ear attachment',(-.010,1.146,sign*.092),(.008,.019,.009),skin,24,20))
    pts=[]
    for k in range(21):
        a=-.7+2.9*k/20
        pts.append(tuple(Vector(earpoint(.47,a))+normal*.0012))
    facebits.append(tube('Ear inner fold',pts,[.0005+.0008*sin(pi*k/20) for k in range(21)],skin,8))
    pts=[tuple(Vector(earpoint(r,-.6))+normal*.001) for r in [.25,.36,.49,.61]]
    facebits.append(tube('Ear fork',pts,[.0008,.0011,.0009,.0004],skin,8))
    facebits.append(ellipsoid('Ear tragus',tuple(centre+across*(-.004)+normal*.001),(.002,.004,.0025),skin,20,12))
    # Almond-shaped sclera. Its boundary is also the inner eyelid boundary.
    coords=[]
    for j in range(49):
        u=j/48; z=sign*(eye_z-eye_w+2*eye_w*u); low,high=eye_bounds(u)
        for k in range(17):
            y=low+(high-low)*k/16
            coords.append((eye_surface(y,z),y,z))
    facebits.append(patch('Almond sclera',coords,white,48,16))
    # Iris and pupil follow the curved sclera, clipped under the eyelids.
    for name,radius,mat,offset in [('Limbal ring',.0108,pupil,.00025),('Amber iris',.0098,iris,.0004),('Pupil',.0048,pupil,.0006)]:
        coords=[]; faces=[]
        for j in range(13):
            rr=radius*j/12
            for k in range(65):
                a=2*pi*k/64; z=sign*eye_z+rr*cos(a); y=eye_y+.001+rr*sin(a)
                u=(abs(z)-eye_z+eye_w)/(2*eye_w); low,high=eye_bounds(u)
                y=max(low+.00015,min(high-.00015,y))
                coords.append((eye_surface(y,z)+offset,y,z))
        facebits.append(patch(name,coords,mat,12,64))
    for k in range(36):
        a=2*pi*k/36; pts=[]
        for r in [.0052,.0071,.0092]:
            z=sign*eye_z+r*cos(a); y=eye_y+.001+r*sin(a)
            low,high=eye_bounds((abs(z)-eye_z+eye_w)/(2*eye_w))
            y=max(low+.0003,min(high-.0003,y))
            pts.append((eye_surface(y,z)+.00055,y,z))
        facebits.append(tube('Iris fiber',pts,.00017,irislight,5))
    for dy,dz,r in [(.005,-.003,.0017),(-.003,.003,.0007)]:
        yy=eye_y+dy;zz=sign*eye_z+dz
        facebits.append(ellipsoid('Eye catchlight',(eye_surface(yy,zz)+.0009,yy,zz),(.0005,r,r),glint,16,12))
    for upper in [True,False]:
        coords=[]; margin=[]; fold=[]
        for j in range(49):
            u=j/48;z=sign*(eye_z-eye_w+2*eye_w*u);low,high=eye_bounds(u)
            yy=high if upper else low
            width=(.0065 if upper else .005)*max(0,sin(pi*u))**.5
            for k in range(7):
                w=k/6; y=yy+(1 if upper else -1)*width*w
                x=face_x(y,z)+(.0015+(.003 if upper else .002)*sin(pi*w))*(1-w)
                coords.append((x,y,z))
            margin.append((eye_surface(yy,z)+.0006,yy,z))
            fy=yy+width*.9;fold.append((face_x(fy,z)+.0006,fy,z))
        facebits.append(patch('Upper eyelid' if upper else 'Lower eyelid',coords,skin,48,6))
        if upper:
            facebits.append(tube('Fine upper lashes',margin,[.00025+.00055*sin(pi*k/48) for k in range(49)],hairdark,6))
            facebits.append(tube('Lid crease',fold[5:-5],.00028,lip,6))
        else:
            facebits.append(tube('Lower waterline',margin,.00045,lip,6))
    z=sign*(eye_z-eye_w+.001);y=eye_y-.001
    facebits.append(ellipsoid('Tear duct',(face_x(y,z)+.002,y,z),(.0012,.0014,.0018),lip,16,12))
    brow=[]
    for k in range(25):
        u=k/24;z=sign*(.019+.047*u); y=1.190+.005*sin(pi*u)+.001*u
        brow.append((face_x(y,z)+.0018,y,z))
    facebits.append(tube('Soft eyebrow',brow,[.0004+.0016*sin(pi*k/24)**.5 for k in range(25)],hair,8))
    for k in range(5):
        z=sign*(.032+k*.006);y=1.139-.003*(k%2)
        facebits.append(ellipsoid('Freckle',(face_x(y,z)+.0005,y,z),(.00055,.00065,.00065),hairlight,8,6))
    z=sign*.009; y=1.1305
    facebits.append(ellipsoid('Nostril',(face_x(y,z)+.0002,y,z),(.0006,.0013,.0027),crease,20,12))
# Sculpted lip ribbons: cupid's bow, fuller lower lip, and a fine mouth seam.
mouth=[]
for upper in [True,False]:
    coords=[]
    for j in range(49):
        t=-1+2*j/48;z=.022*t;arc=max(0,1-t*t)**.75
        seam=1.101+.0035*t*t
        cupid=exp(-((abs(t)-.28)/.20)**2)
        width=arc*(.0026+.0018*cupid) if upper else arc*.0042
        for k in range(9):
            w=k/8;y=seam+(1 if upper else -1)*width*w
            bulge=arc*(.0012*(1-w)+(.0021 if upper else .0028)*sin(pi*w))
            coords.append((face_x(y,z)+bulge,y,z))
        if upper: mouth.append((face_x(seam,z)+arc*.0013,seam,z))
    facebits.append(patch('Upper lip cupid bow' if upper else 'Lower lip volume',coords,lip,48,8))
facebits.append(tube('Mouth seam',mouth,[.00025+.0004*sin(pi*k/48) for k in range(49)],crease,6))
bind(join(facebits,'Lia_Eyes_and_Details'),'head')

# Asymmetric gathered hair, with a side part and broad overlapping locks.
# Fine color variation follows the flow instead of drawing radial ribs on a ball.
hairbits=[]
hairsoft=material('Hair • auburn variation','#78402a',.55)
hair.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value=.53
hairlight.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value=.56
hairdark.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value=.57

def scalp(t,a,lift=0):
    # Fuller swept side, less round at the temples, and a soft crown.
    side=exp(-((a-.65)/.9)**2)*sin(t)**2
    radius=1+.022*side+.008*sin(3*a+t)*sin(t)
    radius*=1-.10*max(0,min(1,(t-1.65)/.55))
    return Vector((-.003+(.101+lift)*sin(t)*cos(a)*radius,
                   1.159+(.137+lift)*cos(t)+.003*side,
                   (.110+lift)*sin(t)*sin(a)*radius))

def hairline(a):
    return 1.12+.94*(1-cos(a))/2+.035*sin(3*a)+.018*sin(7*a+.3)

vv=[];ff=[];n=128;rows=48
for j in range(rows+1):
    for i in range(n):
        a=2*pi*i/n;t=.002+(hairline(a)-.002)*j/rows
        # Broad, subdued waves belong to the mass, not raised wire strands.
        lift=.0015*sin(9*a+1.3*t)*sin(t)**2
        vv.append(tuple(scalp(t,a,lift)))
for j in range(rows):
    for i in range(n):
        a=j*n+i;b=j*n+(i+1)%n;ff.append((a,a+n,b+n,b))
cap=mesh('Gathered hair foundation',vv,ff,hair);hairbits.append(cap)

# Flattened oval locks follow a cubic curve. Unlike round tubes, their broad
# faces and tapered tips read as combed sections of hair rather than ropes.
def hairlock(name,control,width,depth,mat,detail=True):
    control=[Vector(p) for p in control];centres=[];normals=[];axes=[];radii=[]
    count=44;sides=16;vv=[];ff=[]
    path=[]
    for j in range(count+1):
        t=j/count
        point=(1-t)**3*control[0]+3*(1-t)**2*t*control[1]+3*(1-t)*t*t*control[2]+t**3*control[3]
        relative=point-Vector((-.003,1.159,0))
        scaled=Vector((relative.x/.101,relative.y/.137,relative.z/.110))
        # Bezier chords otherwise sink inside the scalp between control points.
        theta=math.atan2(math.hypot(scaled.x,scaled.z),scaled.y)
        azimuth=math.atan2(scaled.z,scaled.x)
        # Embed each broad section slightly into the foundation, avoiding
        # air gaps and a second helmet surface floating above the head.
        if name!='Temple wisp':point=scalp(theta,azimuth,.0008)
        path.append(point)
    for j,point in enumerate(path):
        t=j/count
        tangent=(path[min(count,j+1)]-path[max(0,j-1)]).normalized()
        normal=Vector((point.x+.003,(point.y-1.159)*.70,point.z)).normalized()
        axis=tangent.cross(normal).normalized();normal=axis.cross(tangent).normalized()
        if normal.dot(Vector((point.x+.003,point.y-1.159,point.z)))<0:normal=-normal
        taper=max(.018,sin(pi*t)**.40)*(1-.10*t)
        centres.append(point);normals.append(normal);axes.append(axis);radii.append(taper)
        for k in range(sides):
            a=2*pi*k/sides
            vv.append(tuple(point+axis*(width*taper*cos(a))+normal*(depth*taper*sin(a))))
    for j in range(count):
        for k in range(sides):
            a=j*sides+k;b=j*sides+(k+1)%sides;ff.append((a,b,b+sides,a+sides))
    ff.extend([tuple(reversed(range(sides))),tuple(count*sides+k for k in range(sides))])
    ob=mesh(name,vv,ff,mat);hairbits.append(ob)
    if detail:
        # Low contrast, very fine filaments break up broad highlights.
        for k in range(7):
            offset=(k-3)/4
            pts=[tuple(p+axes[j]*(offset*width*radii[j])+normals[j]*(depth*radii[j]*max(0,1-offset*offset)**.5+.0001)) for j,p in enumerate(centres)]
            hairbits.append(tube('Flowing filament',pts,[.00006+.00005*r for r in radii],hairsoft if k%3==0 else hairdark,5))

# Short overlapping sections bridge the crown into the side part, so the
# roots of long locks do not leave a smooth uncovered patch at the top.
for i in range(4):
    d=.012*i
    controls=[(.007-d,1.295,-.035),(.022-d,1.307,.005),
              (.004-d,1.298,.057),(-.030-d,1.263,.082)]
    hairlock('Crown transition',controls,.014,.003,hair)

# Large side-swept bangs start at an off-centre part, sweep across the forehead
# and taper towards the braid side; each has a different end and silhouette.
for i in range(9):
    u=i/8
    controls=[(-.004-.045*u,1.291-.008*u,-.030-.012*u),
              (.100-.045*u,1.300-.020*u,-.052-.010*u),
              (.118-.055*u,1.227+.015*u,.030+.052*u),
              (.054-.075*u,1.187-.040*u,.092+.009*u)]
    hairlock('Swept fringe lock',controls,.019-.002*u,.004,hair if i%3 else hairsoft)
# Smaller section on the other side of the part, tucked behind the ear.
for i in range(6):
    u=i/5
    controls=[(-.006-.040*u,1.290-.006*u,-.035),
              (.096-.095*u,1.278,-.060-.030*u),
              (.085-.110*u,1.213,-.087-.023*u),
              (.008-.060*u,1.149-.015*u,-.097)]
    hairlock('Tucked temple lock',controls,.017,.0038,hair)
# Sections on the back gather diagonally into the braid instead of radiating
# from a pole. The base remains concealed by overlapping sculpted ribbons.
for i in range(11):
    a=1.05+i*.36
    controls=[tuple(scalp(.22,a,.003)),tuple(scalp(.82,a+.16,.004)),
              tuple(scalp(1.50,a+.28,.004)),(-.068,1.123,.067)]
    hairlock('Gathered crown lock',controls,.022,.0045,hair if i%4 else hairsoft)
# Two slender, curved wisps loosen the temple outline without a fuzzy halo.
hairlock('Temple wisp',[(.057,1.207,.084),(.043,1.185,.111),(.057,1.153,.103),(.048,1.146,.094)],.003,.002,hair)
hairlock('Temple wisp',[(.040,1.208,-.088),(.021,1.186,-.104),(.033,1.162,-.099),(.021,1.155,-.094)],.0025,.0018,hair,False)

for strand in range(3):
    pts=[]; radii=[]
    for k in range(85):
        t=k/84; a=2*pi*(t*4.2+strand/3)
        size=.017*(1-.65*t)
        pts.append((-.067+.087*t+size*cos(a),1.126-.34*t,.070+.044*sin(t*pi*.65)+size*sin(a)))
        radii.append(.0105*(1-.64*t))
    hairbits.append(tube('Woven braid',pts,radii,hairlight if strand==1 else hair,10))
    for off in [-.003,.003]:
        hairbits.append(tube('Braid filament',[(x+.006,y,z+off) for x,y,z in pts],.00065,hairdark,5))
hairbits.append(ellipsoid('Braid tie',(.021,.793,.109),(.012,.009,.014),material('Ribbon • dusty rose','#d94f8a',.7)))
hairbits.append(ellipsoid('Braid tail',(.020,.774,.11),(.011,.023,.013),hair))
bind(join(hairbits,'Lia_Hair'),'head')

# Always-covered, anatomically neutral doll foundation beneath the wardrobe.
foundation=loft('Lia_Foundation',[(.59,.051,.086,0,0),(.63,.058,.091,0,0),(.668,.055,.088,0,0)],under)
bind(foundation,clothweights)

wardrobe=[]
def garment_rows(bottom=.665, top=.996, depth=0, width=0):
    rows=[(.61,.062,.100,0,0),(.665,.064,.087,0,0),(.715,.061,.087,0,0),(.765,.060,.086,0,0),
          (.86,.063,.095,0,0),(.949,.063,.101,0,0),(.970,.058,.110,0,0),
          (.983,.050,.098,0,0),(.990,.043,.077,0,0),(.996,.034,.050,0,0)]
    def sample(y):
        for a,b in zip(rows,rows[1:]):
            if a[0]<=y<=b[0]:
                t=(y-a[0])/(b[0]-a[0]); return (y,a[1]*(1-t)+b[1]*t+depth,a[2]*(1-t)+b[2]*t+width,0,0)
        return (y,rows[0][1]+depth,rows[0][2]+width,0,0)
    return [sample(bottom)]+[(y,rx+depth,rz+width,x,z) for y,rx,rz,x,z in rows if bottom<y<top]+[sample(top)]

def trim_ring(name,y,rx,rz,mat,x=0,z=0,r=.0018):
    return tube(name,[(x+rx*cos(a*2*pi/48),y,z+rz*sin(a*2*pi/48)) for a in range(49)],r,mat)

for entry in DOC['wardrobe']:
    wid=entry['id']; color=entry['color']; pieces=[]
    main=material('Cloth_'+wid,color,.84)
    dark=material('Seam_'+wid,color,.92)
    # Explicit material roles let the existing color picker recolor each instance.
    main['colorRole']='main'; dark['colorRole']='main'
    skirt=wid in ['dress','nightie','towel','tubeDress']
    trousers=wid in ['suit','shirt','overalls','pyjamas','military']
    sleeves= 'long' if trousers else 'short' if wid in ['casual','shortsTee','dress'] else 'none'
    if wid in ['towel','tubeDress']:
        pieces.append(loft('Wrap bodice',garment_rows(.638,.948,.003,.002),main))
        pieces.append(trim_ring('Bound upper edge',.948,.066,.111,ivory))
    elif wid=='underwear':
        pieces.append(loft('Opaque bralette',garment_rows(.831,.961,.001,.001),main,64))
        pieces.append(loft('Opaque briefs',[(.59,.055,.091,0,0),(.63,.062,.096,0,0),(.68,.060,.093,0,0)],main,64))
        for s in [1,-1]:
            pieces.append(tube('Bralette strap',[(.055,.953,s*.059),(.020,.995,s*.063),(-.046,.953,s*.058)],.006,main,10))
    elif wid=='shortsTop':
        pieces.append(loft('Sport top',garment_rows(.788,.991),main))
    elif wid=='nightie':
        pieces.append(loft('Nightdress bodice',garment_rows(.66,.967),main))
    elif wid=='swim':
        pieces.append(loft('One piece swimsuit',garment_rows(.594,.973,-.001,0),main))
        for s in [1,-1]:
            pieces.append(tube('Swimsuit strap',[(.052,.951,s*.062),(.019,.994,s*.063),(-.040,.969,s*.062)],.006,main,10))
    else:
        pieces.append(loft('Tailored top',garment_rows(.662,.996,.002,.002),main))
        pieces.append(trim_ring('Collar piping',.996,.034,.050,ivory,r=.0028))
    if skirt:
        hem=.425 if wid in ['dress','nightie'] else .453
        flare=.142 if wid=='dress' else .122 if wid=='nightie' else .107
        rows=[(hem,.085,flare,.003,0),(hem+.014,.084,flare,0,0),(.50,.076,max(.116,flare*.95),0,0),
              (.58,.070,.124,0,0),(.63,.067,.120,0,0),(.66,.064,.110,0,0),(.695,.060,.094,0,0)]
        pieces.append(loft('Soft skirt',rows,main,64,.022 if wid=='dress' else .008))
        pieces.append(trim_ring('Skirt hem',hem+.008,.086,flare+.001,ivory,r=.002))
    if not skirt and wid not in ['swim','underwear']:
        legmat=denim if wid in ['casual','shortsTee'] else main if wid in ['overalls','pyjamas','military','shortsTop'] else charcoal
        pants=[loft('Waistband',[(.59,.054,.106,0,0),(.62,.062,.116,0,0),(.65,.063,.111,0,0),(.685,.060,.105,0,0)],legmat)]
        for s in [1,-1]:
            zz=s*hip; bottom=.070 if trousers else .43
            rows=[(bottom,.033 if trousers else .045,.035 if trousers else .047,0,zz)]
            rows += [(y,rx,rz,0,zz) for y,rx,rz in [(.15,.034,.036),(.26,.035,.037),(.34,.035,.039),(.44,.044,.047),(.52,.049,.052),(.625,.050,.053)] if y>bottom]
            pants.append(loft('Trouser leg' if trousers else 'Shorts leg',rows,legmat,32))
            pieces.append(trim_ring('Cuff seam',bottom+.01,rows[0][1]+.001,rows[0][2]+.001,ivory,z=zz,r=.0014))
        pieces.append(smooth_union(pants,'Continuous trousers',.003))
    if sleeves!='none':
        for s in [1,-1]:
            z=s*shoulder; bottom=.625 if sleeves=='long' else .891
            rows=[(bottom,.027,.029,0,z)] if sleeves=='long' else [(bottom,.033,.034,0,z+s*.015)]
            rows += [(y,rx,rz,0,z+s*off) for y,rx,rz,off in [(.73,.030,.031,0),(.80,.031,.032,.003),(.90,.033,.034,.015),(.933,.033,.034,.010),(.949,.033,.034,0)] if y>bottom]
            rows += [(.968,.033,.034,0,z-s*.003),(.982,.027,.030,0,z-s*.012),
                     (.992,.020,.026,0,z-s*.025),(.995,.012,.020,0,z-s*.038),
                     (.997,.003,.010,0,z-s*.047)]
            pieces.append(smooth_union([loft('Sleeve',rows,main,40)],'Sleeve',.002))
            pieces.append(trim_ring('Sleeve seam',bottom+.003,rows[0][1]+.001,rows[0][2]+.001,ivory,z=rows[0][4]))
    if wid in ['shirt','suit','pyjamas','military']:
        for k in range(4):
            pieces.append(ellipsoid('Button',(.065,.928-k*.057,0),(.003,.005,.005),gold,12,8))
        if wid in ['suit','shirt']:
            for s in [1,-1]:
                pieces.append(tube('Folded collar',[(.041,.991,s*.015),(.066,.951,s*.04),(.067,.978,s*.052)],.009,ivory,8))
        if wid=='suit':
            pieces.append(tube('Tie',[(.062,.969,0),(.069,.91,0),(.064,.838,0)],[.009,.011,.006],gold,8))
    if wid in ['overalls','military']:
        for s in [1,-1]:
            if wid=='overalls':
                pieces.append(tube('Overall strap',[(.062,.77,s*.052),(.070,.925,s*.052),(.015,1.005,s*.060),(-.058,.94,s*.054)],.012,denim,8))
            pieces.append(ellipsoid('Patch pocket',(.066,.837,s*.05),(.008,.032,.025),dark,24,16))
            pieces.append(ellipsoid('Pocket button',(.074,.852,s*.05),(.003,.004,.004),gold,12,8))
    if wid=='dress':
        pieces.append(trim_ring('Waist piping',.706,.059,.090,ivory,r=.003))
        for s in [1,-1]:
            pieces.append(ellipsoid('Waist bow',(.066,.71,s*.017),(.008,.012,.017),ivory,20,12))
    if wid=='towel':
        pieces.append(tube('Towel overlap',[(.070,.93,.04),(.071,.71,.045),(.081,.48,.05)],.003,ivory,8))
    if wid not in ['swim','underwear','nightie','towel','pyjamas']:
        shoemat=main if wid in ['dress','tubeDress'] else ivory if wid in ['casual','shortsTee','shortsTop'] else charcoal
        for s in [1,-1]:
            z=s*hip
            pieces.append(ellipsoid('Shoe',(.022,.035,z),(.068,.034,.035),shoemat))
            pieces.append(ellipsoid('Sole',(.023,.016,z),(.069,.014,.036),sole))
            if wid in ['casual','shortsTee','shortsTop']:
                for k in range(3):
                    pieces.append(tube('Sneaker lace',[(.020+k*.012,.064-k*.004,z-.023),(.020+k*.012,.067-k*.004,z+.023)],.0019,ivory,6))
    # Weld the shirt and both sleeves before binding, including the armpit.
    # Trousers, hands and legs never participate in this union.
    panels=[o for o in pieces if o.name.startswith('Tailored top') or o.name.startswith('Sleeve') and not o.name.startswith('Sleeve seam')]
    if panels:
        pieces=[o for o in pieces if o not in panels]
        pieces.append(smooth_union(panels,'Continuous shirt',.0025))
    for piece in pieces: bind(piece,pieceweights(piece))
    ob=join(pieces,'Outfit_'+wid)
    ob['wardrobe']=wid
    wardrobe.append(ob)

# Optional adult character profile runs on the connected, weighted source.
if globals().get('CHARACTER_FINISH'):
    CHARACTER_FINISH(globals())

# Mesh normals recalculated consistently after joining custom surfaces.
for ob in list(rig.children):
    if ob.type!='MESH': continue
    bpy.context.view_layer.objects.active=ob
    bpy.ops.object.select_all(action='DESELECT');ob.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.normals_make_consistent(inside=False);bpy.ops.object.mode_set(mode='OBJECT')

# Store all wardrobes in the same GLB. Runtime prunes unselected garments.
bpy.ops.object.select_all(action='DESELECT')
rig.select_set(True)
for ob in rig.children: ob.select_set(True)
bpy.context.view_layer.objects.active=rig
bpy.ops.export_scene.gltf(filepath=str(OUT/(ASSET_ID+'.glb')),export_format='GLB',use_selection=True,
    export_animations=False,export_skins=True,export_extras=True,export_yup=True,
    export_apply=False,export_materials='EXPORT')
(OUT/'rig.json').write_text(json.dumps({'version':1,'rig':'story-studio-v1','height':H,
    'joints':{n:dict(zip(['x','y','z'],p)) for n,p in J.items()},
    'wardrobe':{w['id']:w['outfit'] for w in DOC['wardrobe']}},indent=2)+'\n')

# Editable source opens as a lit, three-quarter portrait. Other outfits are
# kept in their own collection and hidden; toggling one never destroys it.
for ob in wardrobe:
    col=bpy.data.collections.new('Wardrobe • '+ob['wardrobe']);bpy.context.scene.collection.children.link(col)
    for old in list(ob.users_collection): old.objects.unlink(ob)
    col.objects.link(ob)
    ob.hide_render=ob['wardrobe']!='casual'; ob.hide_set(ob['wardrobe']!='casual')

def aim(ob,point):
    ob.rotation_euler=(v(point)-ob.location).to_track_quat('-Z','Y').to_euler()

def area(name,pos,power,size,color):
    data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='DISK';data.size=size;data.color=color
    ob=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(ob);ob.location=v(pos);aim(ob,(0,.8,0))

studio=bpy.data.collections.new('Studio • lights and backdrop');bpy.context.scene.collection.children.link(studio)
bpy.context.view_layer.active_layer_collection=bpy.context.view_layer.layer_collection.children[studio.name]
area('Key • softbox',(2.5,3.2,-2.8),340,3,(1,.87,.76))
area('Fill • softbox',(1.5,1.8,2.3),160,2.5,(.79,.88,1))
area('Rim',(-1.8,2.2,.8),300,2,(1,.75,.5))
bpy.ops.mesh.primitive_plane_add(size=200)
floor=bpy.context.object;floor.name='Studio floor';floor.data.materials.append(material('Backdrop','#304c50',.88))
camdata=bpy.data.cameras.new('Lia portrait');cam=bpy.data.objects.new('Lia portrait',camdata)
bpy.context.collection.objects.link(cam);cam.location=v((2.8,1.65,1.65));aim(cam,(0,.665,0))
camdata.type='ORTHO';camdata.ortho_scale=1.52 if ASSET_ID=='lia' else H*1.20
if ASSET_ID!='lia':
    cam.location=v((2.8,2.0,1.65));aim(cam,(0,H*.52,0));bpy.context.scene.camera=cam
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=48
scene.cycles.use_denoising=True
scene.world.color=(.16,.16,.16)
scene.render.resolution_x=1000;scene.render.resolution_y=1100;scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX'
scene.render.image_settings.file_format='PNG'
scene.render.filepath=str(OUT/(ASSET_ID+'-preview.png'))
scene['README']=f'{ASSET_ID.title()}: 16 Story Studio deform bones; {len(wardrobe)} outfits. Show one Wardrobe mesh at a time. Rebuild: scripts/blender/build_{ASSET_ID}.py.'
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);bpy.context.view_layer.objects.active=rig
for screen in bpy.data.screens:
    for a in screen.areas:
        if a.type=='VIEW_3D':
            a.spaces.active.region_3d.view_perspective='CAMERA'
            a.spaces.active.shading.type='MATERIAL'
            a.spaces.active.overlay.show_overlays=False
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/(ASSET_ID+'.blend')),compress=True)
if '--no-render' not in sys.argv:
    bpy.ops.render.render(write_still=True)
    cam.location=v((2.8,1.65 if ASSET_ID=='lia' else H*1.30,1.05));aim(cam,(0,1.10 if ASSET_ID=='lia' else H-.17,0));camdata.ortho_scale=.46
    scene.render.resolution_y=1000
    scene.render.filepath=str(OUT/(ASSET_ID+'-detail.png'))
    bpy.ops.render.render(write_still=True)
print('LIA_BUILD_COMPLETE',len(body.data.vertices),'body vertices',len(wardrobe),'outfits')
