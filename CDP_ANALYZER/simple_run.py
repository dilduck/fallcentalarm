import os
import sys
import subprocess

# Change to the CDP_ANALYZER directory
os.chdir(os.path.dirname(os.path.abspath(__file__)))

# Run the cdp_analyzer_windows.py directly
subprocess.run([sys.executable, "cdp_analyzer_windows.py"])