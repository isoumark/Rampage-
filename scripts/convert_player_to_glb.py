import bpy
from pathlib import Path

project_root = Path(__file__).resolve().parents[1]
source_path = project_root / 'public' / 'models' / 'player.fbx'
output_path = project_root / 'public' / 'models' / 'player.glb'

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=str(source_path), use_anim=True)
bpy.ops.export_scene.gltf(
    filepath=str(output_path),
    export_format='GLB',
    export_animations=True,
    export_force_sampling=True,
    export_nla_strips=True,
    export_optimize_animation_size=True,
    export_image_format='AUTO',
)

print(f'Exported {output_path}')
