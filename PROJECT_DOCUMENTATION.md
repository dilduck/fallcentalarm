# FallcentAlert 프로젝트 완전 가이드

## 목차
1. [프로젝트 개요](#프로젝트-개요)
2. [시스템 아키텍처](#시스템-아키텍처)
3. [핵심 기능](#핵심-기능)
4. [기술 스택](#기술-스택)
5. [프로젝트 구조](#프로젝트-구조)
6. [핵심 컴포넌트 상세 설명](#핵심-컴포넌트-상세-설명)
7. [데이터 흐름](#데이터-흐름)
8. [알림 시스템 로직](#알림-시스템-로직)
9. [사용자별 상태 관리](#사용자별-상태-관리)
10. [설치 및 실행](#설치-및-실행)
11. [배포 가이드](#배포-가이드)
12. [트러블슈팅](#트러블슈팅)

## 프로젝트 개요

FallcentAlert는 fallcent.com 웹사이트의 할인 상품을 실시간으로 모니터링하고 사용자에게 알림을 제공하는 웹 애플리케이션입니다.

### 주요 특징
- **실시간 상품 크롤링**: HTTP 요청 기반으로 주기적으로 상품 정보 수집
- **다단계 알림 시스템**: 할인율과 상품 특성에 따른 우선순위별 알림
- **사용자별 상태 관리**: 각 사용자가 본 상품을 개별 추적
- **반응형 UI**: 실시간 업데이트되는 대시보드

## 시스템 아키텍처

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Client (UI)   │────▶│  Express Server │────▶│  Fallcent.com   │
│   - React-like  │◀────│  - Socket.io    │◀────│   (크롤링 대상) │
│   - Socket.io   │     │  - REST API     │     └─────────────────┘
└─────────────────┘     └─────────────────┘
                               │
                               ▼
                        ┌─────────────────┐
                        │   File System   │
                        │  (JSON 저장소)  │
                        └─────────────────┘
```

## 핵심 기능

### 1. 상품 크롤링
- **주기**: 기본 60초 (사용자 설정 가능)
- **방식**: axios를 사용한 HTTP GET 요청
- **파싱**: cheerio를 사용한 HTML 파싱
- **필터링**: 로켓배송, 최소 할인율 등 설정 기반 필터링

### 2. 알림 카테고리 (우선순위 순)
1. **초특가 (Super Deal)**: 49% 이상 할인
2. **가전/디지털 (Electronics)**: 전자제품 카테고리
3. **키워드 매칭 (Keyword)**: 사용자 설정 키워드 일치
4. **베스트 딜 (Best Deal)**: 20% 이상 할인

### 3. 알림 관리
- **카테고리별 제한**: 각 카테고리 최대 10개 알림
- **중복 방지**: 동일 상품이 여러 카테고리에 중복 등록 방지
- **자동 충원**: 알림 제거 시 다음 우선순위 상품으로 자동 충원

## 기술 스택

### Backend
- **Node.js**: 런타임 환경
- **Express.js**: 웹 프레임워크
- **Socket.io**: 실시간 통신
- **axios**: HTTP 클라이언트
- **cheerio**: HTML 파싱
- **node-cron**: 스케줄링

### Frontend
- **Vanilla JavaScript**: 프레임워크 없는 순수 JS
- **Socket.io Client**: 실시간 통신
- **Tailwind CSS**: 스타일링

### Storage
- **File System**: JSON 파일 기반 데이터 저장

## 프로젝트 구조

```
fallcentalert/
├── server/
│   ├── app.js                 # Express 서버 메인 파일
│   ├── routes/
│   │   └── api.js            # REST API 라우트
│   └── services/
│       ├── crawler-service.js # 크롤링 로직
│       ├── alert-service.js   # 알림 생성/관리
│       ├── storage-service.js # 데이터 저장/로드
│       └── session-alert-service.js # 세션별 알림 관리
├── public/
│   ├── index.html            # 메인 HTML
│   ├── js/
│   │   └── app.js           # 클라이언트 메인 스크립트
│   └── sounds/              # 알림음 파일
├── data/                    # JSON 데이터 저장소
│   ├── products.json        # 현재 상품 목록
│   ├── viewed-products.json # 확인된 상품
│   ├── active-alerts.json  # 활성 알림
│   └── settings.json       # 사용자 설정
└── package.json
```

## 핵심 컴포넌트 상세 설명

### 1. CrawlerService (`server/services/crawler-service.js`)

상품 정보를 수집하는 핵심 서비스입니다.

```javascript
class CrawlerService {
    async crawlFallcent() {
        // 1. HTTP 요청으로 HTML 가져오기
        const response = await axios.get('https://fallcent.com');
        const $ = cheerio.load(response.data);
        
        // 2. 상품 정보 파싱
        // - 각 상품의 ID, 제목, 가격, 할인율 추출
        // - 로켓배송, 최저가 여부 확인
        // - 전자제품 카테고리 확인 (id="가전/디지털" div 내부)
        
        // 3. 중복 제거 및 정렬
        // - 할인율 높은 순으로 정렬
        
        return products;
    }
}
```

#### 주요 메서드
- `crawlFallcent()`: 메인 크롤링 함수
- `parseProduct()`: 개별 상품 파싱
- `isElectronicProduct()`: 전자제품 여부 판단
- `checkKeywordMatch()`: 키워드 매칭 확인

### 2. AlertService (`server/services/alert-service.js`)

알림을 생성하고 관리하는 서비스입니다.

```javascript
class AlertService {
    processProducts(products) {
        // 1. 새 상품 및 가격 변동 상품 필터링
        // 2. 각 상품에 대해 최적의 알림 카테고리 결정
        // 3. 우선순위에 따라 정렬
        // 4. 카테고리별 제한 적용
        // 5. 활성 알림으로 저장
        // 6. 모든 클라이언트에게 전송
    }
    
    createBestAlert(product, settings) {
        // 상품에 대해 가능한 모든 카테고리 확인
        // 우선순위가 가장 높은 카테고리 선택
        // 알림 객체 생성 (고정 ID 사용)
    }
    
    replenishAlerts() {
        // 각 카테고리의 빈 자리 확인
        // 다른 카테고리에 없는 다음 최고 상품으로 충원
    }
}
```

#### 알림 우선순위 계산
```javascript
// 기본 우선순위
super: 100 + Math.floor(discountRate / 10)
electronics: 80 + Math.floor(discountRate / 10)
keyword: 70 + keywordPriority + Math.floor(discountRate / 10)
best: 60 + Math.floor(discountRate / 10)

// 추가 우선순위
+15: 가격 인하 상품
+5: 로켓배송
+5: 최저가
```

### 3. StorageService (`server/services/storage-service.js`)

데이터 영속성을 관리하는 서비스입니다.

```javascript
class StorageService {
    constructor() {
        this.cache = {
            viewedProducts: new Map(),    // 확인된 상품
            productPrices: new Map(),     // 상품 가격 이력
            bannedProducts: new Map(),    // 차단된 상품
            currentProducts: [],          // 현재 상품 목록
            activeAlerts: {              // 활성 알림
                super: [],
                electronics: [],
                best: [],
                keyword: []
            }
        };
    }
    
    removeActiveAlert(alertId) {
        // 1. alertId로 productId 찾기
        // 2. 모든 카테고리에서 해당 productId 제거
        // 3. 파일 시스템에 저장
    }
}
```

#### 주요 기능
- **상품 확인 처리**: `markProductAsSeen()`
- **알림 관리**: `addActiveAlert()`, `removeActiveAlert()`
- **데이터 영속성**: JSON 파일로 자동 저장/로드

### 4. SessionAlertService (`server/services/session-alert-service.js`)

세션별 알림 상태를 관리합니다.

```javascript
class SessionAlertService {
    constructor() {
        this.sessionAlerts = new Map();      // 세션별 알림
        this.sessionClosedAlerts = new Map(); // 세션별 닫힌 알림
    }
    
    filterAlertsForSession(sessionId, userFilteredAlerts) {
        // 세션별로 닫힌 알림 제외
        // 사용자별 필터링은 이미 적용된 상태
    }
}
```

### 5. 클라이언트 앱 (`public/js/app.js`)

사용자 인터페이스와 상호작용을 관리합니다.

```javascript
class FallcentAlertApp {
    constructor() {
        this.alerts = { super: [], electronics: [], best: [], keyword: [] };
        this.closedAlerts = new Set();      // 닫힌 알림 ID
        this.userSeenProducts = new Set();  // 사용자별 본 상품
    }
    
    closeAlert(alertId, productId) {
        // 1. 서버에 close-alert 이벤트 전송
        // 2. closedAlerts에 추가
        // 3. UI에서 즉시 제거
    }
    
    openProduct(url, productId) {
        // 1. 새 탭에서 상품 페이지 열기
        // 2. 읽음 처리
        // 3. 해당 상품의 모든 알림 닫기
    }
}
```

## 데이터 흐름

### 1. 크롤링 → 알림 생성 흐름
```
[크롤러] HTML 파싱
    ↓
[크롤러] 상품 객체 생성
    ↓
[알림서비스] 새 상품/가격변동 필터링
    ↓
[알림서비스] 카테고리 결정 & 우선순위 계산
    ↓
[저장서비스] 활성 알림 저장
    ↓
[알림서비스] 사용자별 필터링
    ↓
[세션서비스] 세션별 필터링
    ↓
[Socket.io] 클라이언트 전송
```

### 2. 알림 닫기 흐름
```
[클라이언트] 닫기 버튼 클릭
    ↓
[클라이언트] close-alert 이벤트
    ↓
[서버] 사용자별 읽은 상품 추가
    ↓
[서버] 글로벌 읽은 상품 추가
    ↓
[저장서비스] 모든 카테고리에서 제거
    ↓
[알림서비스] 빈 자리 충원
    ↓
[Socket.io] 모든 클라이언트 업데이트
```

## 알림 시스템 로직

### 1. 알림 ID 생성
```javascript
const alertId = `${alertType}_${productId}`;
// 예: "super_12345678_87654321"
```
- 고정된 ID로 재생성 시에도 동일한 ID 유지
- 클라이언트의 closedAlerts Set으로 중복 표시 방지

### 2. 중복 방지 메커니즘
- **생성 시**: 한 상품은 우선순위가 가장 높은 카테고리에만 등록
- **충원 시**: 이미 다른 카테고리에 있는 상품은 제외
- **제거 시**: 모든 카테고리에서 동일 productId 제거

### 3. 알림 필터링 계층
```
1. 글로벌 필터링 (전체 사용자)
   - 로켓배송 필터
   - 최소 할인율 필터
   - 차단 상품 필터

2. 사용자별 필터링 (socket.userSeenProducts)
   - 사용자가 본 상품 제외
   - 새 상품(seen: false)은 항상 표시

3. 세션별 필터링 (sessionClosedAlerts)
   - 현재 세션에서 닫은 알림 제외

4. 클라이언트 필터링 (closedAlerts Set)
   - 로컬에서 닫은 알림 추가 제외
```

## 사용자별 상태 관리

### 1. 읽은 상품 추적
```javascript
// 클라이언트 (localStorage + 쿠키)
userSeenProducts: Set<productId>

// 서버 (소켓별)
socket.userSeenProducts: Set<productId>

// 글로벌 (JSON 파일)
viewedProducts: Map<productId, timestamp>
```

### 2. 상태 동기화
- **초기 연결**: 클라이언트가 localStorage의 읽은 상품 목록 전송
- **상품 확인**: 3개 레벨 모두 업데이트
- **초기화**: 모든 레벨 동시 초기화

### 3. 세션 관리
```javascript
// 세션 초기화
socket.on('init-session', (data) => {
    sessionId: 고유 세션 ID
    userSeenProducts: 읽은 상품 배열
});

// 세션 데이터 초기화
socket.on('reset-session-data', () => {
    세션별 닫힌 알림 목록 초기화
});
```

## 설치 및 실행

### 1. 요구사항
- Node.js 14.0 이상
- npm 또는 yarn

### 2. 설치
```bash
git clone https://github.com/dilduck/fallcentalarm.git
cd fallcentalert
npm install
```

### 3. 실행
```bash
# 개발 모드
npm run dev

# 프로덕션 모드
npm start
```

### 4. 환경 설정
```bash
# .env 파일 (선택사항)
PORT=3000
```

## 배포 가이드

### 1. 서버 요구사항
- Ubuntu 20.04 이상 (권장)
- Node.js 14.0 이상
- PM2 (프로세스 관리)

### 2. PM2 설정
```bash
# PM2 설치
npm install -g pm2

# 애플리케이션 시작
pm2 start server/app.js --name fallcentalert

# 시작 스크립트 저장
pm2 save
pm2 startup
```

### 3. 업데이트 절차
```bash
cd /opt/fallcentalert
git pull origin main
npm install  # package.json 변경 시
pm2 restart fallcentalert
```

## 트러블슈팅

### 1. 크롤링 타임아웃
**문제**: Navigation timeout of 30000ms exceeded
**해결**: Puppeteer 대신 axios 사용으로 전환 완료

### 2. 알림이 닫히지 않음
**문제**: 닫기 버튼 클릭 시 일부 알림만 닫힘
**해결**: 
- 고정 알림 ID 사용 (`${type}_${productId}`)
- closedAlerts Set으로 클라이언트 측 추적
- 모든 카테고리에서 동일 productId 제거

### 3. 중복 알림 표시
**문제**: 같은 상품이 여러 카테고리에 표시
**해결**:
- 생성 시 우선순위 기반 단일 카테고리 할당
- 충원 시 이미 있는 상품 제외

### 4. 초기화 미작동
**문제**: 상품 목록 초기화가 완전하지 않음
**해결**:
- closedAlerts Set 초기화 추가
- 서버 세션 데이터 초기화 이벤트 추가
- 비동기 순서 보장 (setTimeout 사용)

## 성능 최적화

### 1. 크롤링
- HTTP 요청 기반으로 빠른 응답
- 병렬 처리 없이 단일 요청으로 모든 데이터 수집

### 2. 알림 관리
- 카테고리별 최대 10개 제한
- 메모리 내 캐싱으로 빠른 조회

### 3. 실시간 통신
- Socket.io를 통한 효율적인 양방향 통신
- 필요한 클라이언트에만 선택적 전송

## 보안 고려사항

### 1. 입력 검증
- HTML 이스케이프 처리
- XSS 방지를 위한 데이터 속성 검증

### 2. 통신 보안
- CORS 설정으로 허용된 오리진만 접근
- Socket.io 연결 인증 (향후 구현 필요)

### 3. 데이터 보호
- 민감한 사용자 데이터 미저장
- 로컬 파일 시스템 기반 저장

## 향후 개선 사항

### 1. 기능 개선
- 사용자 인증 시스템
- 데이터베이스 통합 (MongoDB/PostgreSQL)
- 푸시 알림 지원
- 가격 히스토리 차트

### 2. 성능 개선
- Redis 캐싱 도입
- 크롤링 워커 분리
- CDN 통합

### 3. 사용성 개선
- 모바일 앱 개발
- 다국어 지원
- 테마 커스터마이징

## 문의 및 기여

- GitHub: https://github.com/dilduck/fallcentalarm
- Issues: 버그 리포트 및 기능 제안 환영

---

마지막 업데이트: 2025-08-08