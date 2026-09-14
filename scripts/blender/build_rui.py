"""Build Rui's editable Blender character and all nine wardrobes."""
import runpy
from pathlib import Path
runpy.run_path(str(Path(__file__).with_name('build_male.py')),run_name='__main__',init_globals={'CHARACTER_ID':'rui'})
