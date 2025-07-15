# 폴센트 핫딜 감시 - 웹 버전 🔥

VB.NET에서 Node.js로 리팩토링된 폴센트(Fallcent) 웹사이트 핫딜 감시 시스템입니다.

## 🎯 주요 기능

- **실시간 크롤링**: Fallcent 웹사이트에서 상품 정보 자동 수집
- **4가지 알림 카테고리**:
  - 🔥 **초특가** (49% 이상 할인)
  - 🔧 **가전/디지털** (전자제품 전용)
  - 🔍 **키워드 매칭** (사용자 설정 키워드)
  - ⭐ **베스트 딜** (20% 이상 할인)
- **실시간 사운드 알림**: 카테고리별 맞춤 사운드
- **웹 인터페이스**: 현대적이고 반응형 웹 UI
- **자동 충원**: 알림 확인 시 새로운 딜 자동 추가
- **상품 관리**: 확인/차단 기능

## 🛠️ 기술 스택

- **Backend**: Node.js, Express, Socket.IO
- **Frontend**: HTML5, TailwindCSS, JavaScript
- **크롤링**: Puppeteer, Cheerio
- **스케줄링**: node-cron
- **데이터**: JSON 파일 저장

## 🚀 로컬 실행

```bash
# 저장소 클론
git clone https://github.com/YOUR_USERNAME/fallcentalert.git
cd fallcentalert

# 의존성 설치
npm install

# 서버 실행
npm start

# 개발 모드 (nodemon)
npm run dev
```

웹 브라우저에서 `http://localhost:3000` 접속

## 📁 프로젝트 구조

```
fallcentalert/
├── server/                 # 백엔드 서버
│   ├── app.js             # 메인 애플리케이션
│   ├── services/          # 비즈니스 로직
│   │   ├── crawler-service.js    # 웹 크롤링
│   │   ├── alert-service.js      # 알림 처리
│   │   └── storage-service.js    # 데이터 관리
│   └── routes/
│       └── api.js         # REST API
├── public/                # 프론트엔드
│   ├── index.html         # 메인 페이지
│   └── js/
│       └── app.js         # 클라이언트 로직
├── data/                  # 데이터 파일
└── sounds/                # 알림 사운드
```

## ⚙️ 설정

### 크롤링 설정
- **자동 새로고침**: 활성화/비활성화
- **새로고침 간격**: 30초 ~ 10분
- **로켓배송 필터**: 로켓배송 상품만 표시
- **최소 할인율**: 최소 할인율 설정

### 알림 설정
- **사운드 반복재생**: 카테고리별 반복 횟수/간격 설정
- **브라우저 알림**: 웹 푸시 알림
- **알림 지속시간**: 3~10초

### 키워드 설정
- **카테고리별 키워드**: 무선이어폰, 휴대폰, 컴퓨터 등
- **우선순위**: 높음/중간/낮음

## 🌐 배포

### 카페24 VPS (추천)
- 월 6,600원
- 상세 가이드: [deploy-guide-cafe24.md](deploy-guide-cafe24.md)

### 네이버 클라우드 플랫폼
- 월 8,000원
- 상세 가이드: [deploy-guide-ncp.md](deploy-guide-ncp.md)

## 🔧 환경 요구사항

- **Node.js**: 18.0.0 이상
- **메모리**: 최소 1GB (Puppeteer 사용)
- **저장공간**: 최소 10GB

## 📱 사용법

1. **웹 접속**: 배포된 서버 주소로 접속
2. **설정**: 우측 상단 설정 버튼으로 개인화
3. **알림 확인**: 우측 알림 패널에서 실시간 확인
4. **상품 관리**: 보기/차단 버튼으로 상품 관리

## 🤝 기여

이슈나 개선사항이 있다면 GitHub Issues에 등록해 주세요.

## 📄 라이선스

MIT License

## 🙏 감사

- **원본 아이디어**: VB.NET 버전의 폴센트 알림 시스템
- **Fallcent**: 핫딜 정보 제공
- **커뮤니티**: 피드백과 개선 아이디어 