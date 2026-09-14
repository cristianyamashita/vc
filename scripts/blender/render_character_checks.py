"""Render a generated character without changing the saved source or pose.
blender --background --python scripts/blender/render_character_checks.py -- rui
"""
import bpy
import sys
from pathlib import Path
from mathutils import Vector,Matrix
from math import radians
cid=sys.argv[sys.argv.index('--')+1]
assert cid in ['rui','tom','lia','carmen']
out=Path(__file__).resolve().parents[2]/'page/game/story-studio/models'/cid
bpy.ops.wm.open_mainfile(filepath=str(out/(cid+'.blend')))
s=bpy.context.scene;c=s.camera;rig=bpy.data.objects[cid.title()+'_Rig'];h=rig['height']
s.render.filepath=str(out/(cid+'-preview.png'));bpy.ops.render.render(write_still=True)
head=rig.data.bones['head'].head_local.z;top=h+.006;aimz=(head+top)/2-.025
c.location=(2.8,-1.05,aimz+.50);c.rotation_euler=(Vector((0,0,aimz))-c.location).to_track_quat('-Z','Y').to_euler();c.data.ortho_scale=.50 if h>1.5 else .44
s.render.resolution_y=1000;s.render.filepath=str(out/(cid+'-detail.png'));bpy.ops.render.render(write_still=True)
for name,angle in [('lArm',-120),('rArm',120)]:
 p=rig.pose.bones[name];pivot=p.bone.head_local
 p.matrix=Matrix.Translation(pivot)@Matrix.Rotation(radians(angle),4,'X')@Matrix.Translation(-pivot)@p.bone.matrix_local
 bpy.context.view_layer.update()
shoulder=rig.data.bones['lArm'].head_local.z
c.location=(3,-.35,shoulder+.55);c.rotation_euler=(Vector((0,0,shoulder-.04))-c.location).to_track_quat('-Z','Y').to_euler();c.data.ortho_scale=h*.90
s.render.filepath=str(out/(cid+'-shoulders.png'));bpy.ops.render.render(write_still=True)
