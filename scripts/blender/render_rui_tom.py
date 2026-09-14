"""Render Rui and Tom together at their actual relative heights."""
import bpy
from pathlib import Path
from mathutils import Vector
root=Path(__file__).resolve().parents[2]/'page/game/story-studio/models'
bpy.ops.wm.open_mainfile(filepath=str(root/'rui/rui.blend'))
bpy.data.objects['Rui_Rig'].location.y=-.47
with bpy.data.libraries.load(str(root/'tom/tom.blend'),link=False) as (source,target):
    target.objects=[name for name in source.objects if name.startswith(('Tom_','Outfit_'))]
for ob in target.objects:
    if ob is None:continue
    bpy.context.scene.collection.objects.link(ob)
    if ob.name.startswith('Tom_Rig'):ob.location.y=.47
    if ob.get('wardrobe'):
        ob.hide_render=ob['wardrobe']!='casual';ob.hide_set(ob.hide_render)
s=bpy.context.scene;c=s.camera
c.location=(4,-.4,2.5);c.rotation_euler=(Vector((0,0,.96))-c.location).to_track_quat('-Z','Y').to_euler();c.data.ortho_scale=2.95
s.render.resolution_x=1600;s.render.resolution_y=1200
s.render.filepath=str(root/'rui-tom-preview.png')
bpy.ops.render.render(write_still=True)
