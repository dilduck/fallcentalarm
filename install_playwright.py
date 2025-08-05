import subprocess
import sys
import os

print("Playwright 브라우저 설치 시작...")

try:
    # 환경 변수 설정
    env = os.environ.copy()
    env['PLAYWRIGHT_BROWSERS_PATH'] = '0'  # 기본 경로 사용
    
    # playwright install 실행
    result = subprocess.run(
        [sys.executable, '-m', 'playwright', 'install', 'chromium'],
        capture_output=True,
        text=True,
        env=env
    )
    
    print("stdout:", result.stdout)
    print("stderr:", result.stderr)
    print("return code:", result.returncode)
    
    if result.returncode == 0:
        print("설치 성공!")
    else:
        print("설치 실패")
        
except Exception as e:
    print(f"오류 발생: {e}")