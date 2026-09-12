"""Render Carmen's neutral views and a 120-degree shoulder regression view.
Run: blender --background --python scripts/blender/render_carmen_checks.py
The saved source is read without modifying its pose or overwriting the .blend.
"""
import bpy
from pathlib import Path
from mathutils import Vector, Matrix
from math import radians
out=Path(__file__).resolve().parents[2]/'page/game/story-studio/models/carmen'
bpy.ops.wm.open_mainfile(filepath=str(out/'carmen.blend'))
s=bpy.context.scene;c=s.camera
s.render.filepath=str(out/'carmen-preview.png')
bpy.ops.render.render(write_still=True)
c.location=(2.8,-1.05,2.02);c.rotation_euler=(Vector((0,0,1.49))-c.location).to_track_quat('-Z','Y').to_euler();c.data.ortho_scale=.54
s.render.resolution_y=1000;s.render.filepath=str(out/'carmen-detail.png')
bpy.ops.render.render(write_still=True)
rig=bpy.data.objects['Carmen_Rig']
for name,angle in [('lArm',-120),('rArm',120)]:
 p=rig.pose.bones[name];pivot=p.bone.head_local
 p.matrix=Matrix.Translation(pivot)@Matrix.Rotation(radians(angle),4,'X')@Matrix.Translation(-pivot)@p.bone.matrix_local
 bpy.context.view_layer.update()
c.location=(3,-.35,2.0);c.rotation_euler=(Vector((0,0,1.34))-c.location).to_track_quat('-Z','Y').to_euler();c.data.ortho_scale=1.38
s.render.filepath=str(out/'carmen-shoulders.png')
bpy.ops.render.render(write_still=True)
