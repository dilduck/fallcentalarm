import subprocess
import sys
import os

# Change to CDP_ANALYZER directory
os.chdir(r'C:\ClaudeCodeProjects\fallcentalert\CDP_ANALYZER')

# First, ensure playwright is installed
print("Installing Playwright...")
subprocess.run([sys.executable, "-m", "playwright", "install", "chromium"], check=True)

print("\nRunning CDP Analyzer...")
# Run the analyzer
subprocess.run([sys.executable, "cdp_analyzer_windows.py"], check=True)