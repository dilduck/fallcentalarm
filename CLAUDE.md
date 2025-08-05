# FallCentAlert 프로젝트 정보

## 서버 정보
- **서버 주소**: 114.207.245.158
- **SSH 접속**: `ssh root@114.207.245.158`
- **프로젝트 경로**: `/opt/fallcentalert`
- **프로세스 관리**: PM2 사용

## 배포 절차
1. 로컬에서 변경사항 커밋 및 푸시
   ```bash
   git add .
   git commit -m "커밋 메시지"
   git push origin main
   ```

2. 서버에서 업데이트
   ```bash
   cd /opt/fallcentalert
   git pull origin main
   npm install  # package.json 변경시
   pm2 restart all
   pm2 status
   ```

## 주요 개선사항 (2025-07-25)
- **크롤링 안정성 개선**: CDP 초기화 및 브라우저 관리 문제 수정
- **사용자별 알림 분리**: localStorage + 쿠키 기반 사용자 추적
- **알림음 개선**: 진짜 신규 상품에만 알림음 재생
- **UI 피드백 강화**: 크롤링 상태 실시간 모니터링

## 프로젝트 구조
- `/public/js/app.js`: 프론트엔드 메인 스크립트
- `/server/app.js`: Express 서버 메인 파일
- `/server/routes/api.js`: API 라우트
- `/server/services/`:
  - `alert-service.js`: 알림 서비스
  - `crawler-service.js`: 크롤링 서비스 (CDP 사용)
  - `storage-service.js`: 데이터 저장 서비스

## 디버깅 명령어
```bash
# PM2 로그 확인
pm2 logs fallcentalert --lines 50

# 실시간 로그 모니터링
pm2 logs fallcentalert

# 프로세스 재시작 (환경변수 업데이트 포함)
pm2 restart fallcentalert --update-env
```

## 테스트 스크립트
- `test_crawling_flow.js`: 크롤링 플로우 테스트
- `check_products.js`: 상품 수집 확인
- `simple_cdp_test.py`: CDP 연결 테스트

## 주의사항
- Windows 개발환경에서는 LF/CRLF 변환 경고가 발생할 수 있음
- 서버는 Linux 환경이므로 정상 작동