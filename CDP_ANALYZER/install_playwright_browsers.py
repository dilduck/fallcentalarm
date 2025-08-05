import subprocess
import sys

print("Playwright 브라우저 설치 중...")
try:
    # Playwright 브라우저 설치
    result = subprocess.run([sys.executable, "-m", "playwright", "install"], 
                          capture_output=True, text=True)
    print(result.stdout)
    if result.stderr:
        print("오류:", result.stderr)
    print("\n설치 완료!")
except Exception as e:
    print(f"오류 발생: {e}")