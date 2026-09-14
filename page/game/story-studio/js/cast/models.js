// Built-in, versioned Blender assets. Documents reference an id, so backups
// remain portable and imported JSON cannot make the loader fetch arbitrary URLs.
export const CHARACTER_MODELS = {
  'lia-v1': { file: 'models/lia/lia.glb', rig: 'models/lia/rig.json', source: 'models/lia/lia.blend' },
  'carmen-v1': { file: 'models/carmen/carmen.glb', rig: 'models/carmen/rig.json', source: 'models/carmen/carmen.blend' },
  'rui-v1': { file: 'models/rui/rui.glb', rig: 'models/rui/rig.json', source: 'models/rui/rui.blend' },
  'tom-v1': { file: 'models/tom/tom.glb', rig: 'models/tom/rig.json', source: 'models/tom/tom.blend' },
};
