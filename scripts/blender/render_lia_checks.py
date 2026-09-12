"""Render Lia's neutral views and a 120-degree shoulder regression view.
Run: blender --background --python scripts/blender/render_lia_checks.py
The saved source is read without modifying its pose or overwriting the .blend.
"""
import bpy
from pathlib import Path
from mathutils import Vector, Matrix
from math import radians
out=Path(__file__).resolve().parents[2]/'page/game/story-studio/models/lia'
bpy.ops.wm.open_mainfile(filepath=str(out/'lia.blend'))
s=bpy.context.scene;c=s.camera
s.render.filepath=str(out/'lia-preview.png')
bpy.ops.render.render(write_still=True)
c.location=(2.8,-1.05,1.65);c.rotation_euler=(Vector((0,0,1.10))-c.location).to_track_quat('-Z','Y').to_euler();c.data.ortho_scale=.46
s.render.resolution_y=1000;s.render.filepath=str(out/'lia-detail.png')
bpy.ops.render.render(write_still=True)
rig=bpy.data.objects['Lia_Rig']
for name,angle in [('lArm',-120),('rArm',120)]:
 p=rig.pose.bones[name];pivot=p.bone.head_local
 p.matrix=Matrix.Translation(pivot)@Matrix.Rotation(radians(angle),4,'X')@Matrix.Translation(-pivot)@p.bone.matrix_local
 bpy.context.view_layer.update()
c.location=(3,-.35,1.65);c.rotation_euler=(Vector((0,0,1.0))-c.location).to_track_quat('-Z','Y').to_euler();c.data.ortho_scale=1.1
s.render.filepath=str(out/'lia-shoulders.png')
bpy.ops.render.render(write_still=True)
