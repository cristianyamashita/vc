"""Check that a generated body's connected volumes are closed and have no tunnels.
blender --background --python scripts/blender/validate_character_source.py -- rui
This detects shoulder holes that finite matrices and connected-arm tests miss.
"""
import bpy
import sys
import json
import hashlib
from collections import defaultdict
from pathlib import Path
cid=sys.argv[sys.argv.index('--')+1]
assert cid in ['rui','tom']
out=Path(__file__).resolve().parents[2]/'page/game/story-studio/models'/cid
bpy.ops.wm.open_mainfile(filepath=str(out/(cid+'.blend')))
m=bpy.data.objects[cid.title()+'_Body'].data
parent=list(range(len(m.vertices)))
def find(i):
    while parent[i]!=i:
        parent[i]=parent[parent[i]];i=parent[i]
    return i
for edge in m.edges:
    a,b=map(find,edge.vertices)
    if a!=b:parent[b]=a
components=defaultdict(lambda:{'vertices':0,'edges':0,'faces':0})
for v in m.vertices:components[find(v.index)]['vertices']+=1
for e in m.edges:components[find(e.vertices[0])]['edges']+=1
incidence=defaultdict(int)
for f in m.polygons:
    components[find(f.vertices[0])]['faces']+=1
    for edge in f.edge_keys:incidence[tuple(sorted(edge))]+=1
assert all(incidence[tuple(sorted(e.vertices))]==2 for e in m.edges),'Open or non-manifold body edge'
for component in components.values():
    component['euler']=component['vertices']-component['edges']+component['faces']
    assert component['euler']==2,'Body contains a tunnel: inspect the shoulders and neck'
report={'character':cid,'closedBodySurfaces':True,'bodyComponents':list(components.values()),
        'glbSha256':hashlib.sha256((out/(cid+'.glb')).read_bytes()).hexdigest()}
(out/'source-validation.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
