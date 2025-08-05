import os
import sys

# UTF-8 환경 변수 설정
os.environ['PYTHONIOENCODING'] = 'utf-8'

# 현재 인코딩 확인
print(f"Python 기본 인코딩: {sys.getdefaultencoding()}")
print(f"표준 출력 인코딩: {sys.stdout.encoding}")
print(f"표준 에러 인코딩: {sys.stderr.encoding}")

# 테스트 메시지
print("\n한글 테스트: 안녕하세요!")
print("특수문자 테스트: ✓ ✗ ❌ ⚠")
print("이모지 테스트: 😊 🚀 💾")