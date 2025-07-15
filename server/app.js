const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const cron = require('node-cron');
const path = require('path');

// 서비스 및 라우터 import
const CrawlerService = require('./services/crawler-service');
const AlertService = require('./services/alert-service');
const StorageService = require('./services/storage-service');
const SessionAlertService = require('./services/session-alert-service');
const { router: apiRoutes, setServices } = require('./routes/api');

class FallcentAlert {
    constructor() {
        this.app = express();
        this.server = http.createServer(this.app);
        this.io = socketIo(this.server, {
            cors: {
                origin: "*",
                methods: ["GET", "POST"]
            }
        });
        
        this.port = process.env.PORT || 3000;
        
        // 서비스 초기화
        this.storageService = new StorageService();
        this.crawlerService = new CrawlerService(this.storageService);
        this.alertService = new AlertService(this.io, this.storageService);
        this.sessionAlertService = new SessionAlertService(this.storageService);
        
        // AlertService에 SessionAlertService 주입
        this.alertService.setSessionAlertService(this.sessionAlertService);
        
        // API 라우터에 서비스 주입
        setServices({
            crawlerService: this.crawlerService,
            alertService: this.alertService,
            storageService: this.storageService
        });
        
        this.setupMiddleware();
        this.setupRoutes();
        this.setupSocketEvents();
        this.setupCronJobs();
    }

    setupMiddleware() {
        // CORS 설정
        this.app.use(cors());
        
        // JSON 파싱
        this.app.use(express.json());
        this.app.use(express.urlencoded({ extended: true }));
        
        // 정적 파일 서빙
        this.app.use(express.static(path.join(__dirname, '../public')));
        
        // 로그 미들웨어
        this.app.use((req, res, next) => {
            console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
            next();
        });
    }

    setupRoutes() {
        // API 라우터 연결
        this.app.use('/api', apiRoutes);
        
        // 메인 페이지
        this.app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, '../public/index.html'));
        });
        
        // SPA 라우팅 지원 (React Router)
        this.app.get('*', (req, res) => {
            res.sendFile(path.join(__dirname, '../public/index.html'));
        });
    }

    // 사용자별 알림 필터링 메서드
    filterAlertsForUser(globalAlerts, userSeenProducts) {
        console.log(`👤 사용자별 필터링 시작, 읽은 상품: ${userSeenProducts.size}개`);
        console.log(`👤 읽은 상품 목록:`, Array.from(userSeenProducts));
        
        const filteredAlerts = {
            super: [],
            electronics: [],
            best: [],
            keyword: []
        };
        
        Object.keys(globalAlerts).forEach(type => {
            const originalCount = globalAlerts[type].length;
            
            filteredAlerts[type] = globalAlerts[type].filter(alert => {
                const isSeenByUser = userSeenProducts.has(alert.productId);
                if (isSeenByUser) {
                    console.log(`👤 사용자별 필터링: ${alert.productId} - ${alert.product?.title}`);
                }
                return !isSeenByUser;
            });
            
            if (originalCount > filteredAlerts[type].length) {
                console.log(`👤 사용자별 ${type} 알림 필터링: ${originalCount}개 -> ${filteredAlerts[type].length}개`);
            }
        });
        
        console.log(`👤 사용자별 필터링 완료`);
        return filteredAlerts;
    }

    setupSocketEvents() {
        this.io.on('connection', (socket) => {
            console.log(`클라이언트 연결됨: ${socket.id}`);
            
            // 🔧 개선된 세션 초기화 처리 (사용자별 읽은 상품 정보 포함)
            socket.on('init-session', (data) => {
                const sessionId = data.sessionId;
                const userSeenProducts = data.userSeenProducts || []; // 클라이언트에서 전송된 사용자별 읽은 상품 목록
                
                socket.sessionId = sessionId; // 소켓에 세션 ID 저장
                socket.userSeenProducts = new Set(userSeenProducts); // 사용자별 읽은 상품 저장
                
                console.log(`🔧 세션 초기화: ${sessionId}, 사용자 읽은 상품: ${userSeenProducts.length}개`);
                
                // 글로벌 알림 가져오기
                const globalAlerts = this.storageService.getActiveAlerts();
                
                // 사용자별 알림 필터링
                const userFilteredAlerts = this.filterAlertsForUser(globalAlerts, socket.userSeenProducts);
                
                // 세션별 알림 초기화 (이미 사용자별 필터링된 알림 사용)
                const sessionAlerts = this.sessionAlertService.initSession(sessionId, userFilteredAlerts);
                
                // 클라이언트에게 세션별 데이터 전송
                socket.emit('initial-data', {
                    products: this.storageService.getAllProducts(),
                    settings: this.storageService.getSettings(),
                    stats: this.storageService.getStats(),
                    alerts: sessionAlerts
                });
            });
            
            // 수동 크롤링 요청
            socket.on('manual-crawl', async () => {
                console.log('수동 크롤링 요청 받음');
                try {
                    await this.performCrawling();
                    socket.emit('crawl-completed', { success: true });
                } catch (error) {
                    console.error('수동 크롤링 오류:', error);
                    socket.emit('crawl-error', { error: error.message });
                }
            });
            
            // 상품 확인 처리 (사용자별)
            socket.on('mark-as-seen', (productId) => {
                console.log(`👤 사용자별 상품 확인: ${productId}`);
                
                // 사용자별 읽은 상품 목록에 추가
                if (!socket.userSeenProducts) {
                    socket.userSeenProducts = new Set();
                }
                socket.userSeenProducts.add(productId);
                console.log(`👤 사용자별 읽은 상품 추가: ${productId} (총 ${socket.userSeenProducts.size}개)`);
                
                // 해당 사용자에게만 상품 업데이트 전송
                socket.emit('product-updated', { productId, seen: true });
            });
            
            // 상품 차단 처리
            socket.on('ban-product', (productData) => {
                this.storageService.banProduct(productData.id, productData.title);
                // 차단된 상품의 알림도 제거하고 충원
                this.storageService.removeActiveAlertByProductId(productData.id);
                this.alertService.replenishAlerts();
                this.alertService.sendAllAlertsToClients();
                this.io.emit('product-banned', productData);
            });
            
            // 🔧 사용자별 알림 닫기 처리 (전역 저장소 사용 안함)
            socket.on('close-alert', (data) => {
                const { alertId, productId, sessionId } = data;
                console.log(`🔧 사용자별 알림 닫기 요청: ${sessionId} -> ${alertId}, 상품: ${productId}`);
                
                // 1. 사용자별 읽은 상품 목록에 추가 (소켓별 저장)
                if (!socket.userSeenProducts) {
                    socket.userSeenProducts = new Set();
                }
                socket.userSeenProducts.add(productId);
                console.log(`👤 사용자별 읽은 상품 추가: ${productId} (총 ${socket.userSeenProducts.size}개)`);
                
                // 2. 세션에서 알림 닫기
                this.sessionAlertService.closeAlertInSession(sessionId, alertId);
                
                // 3. 해당 세션에만 업데이트된 알림 전송
                const sessionAlerts = this.sessionAlertService.getSessionAlerts(sessionId);
                socket.emit('alerts-updated', {
                    alerts: sessionAlerts,
                    timestamp: new Date(),
                    replace: true
                });
                
                console.log(`✅ 사용자별 알림 닫기 완료: ${sessionId} -> ${alertId}`);
            });
            
            // 알림 상호작용 처리
            socket.on('alert-interaction', (data) => {
                this.alertService.handleAlertInteraction(data.alertId, data.action, socket.id);
            });
            
            // 설정 업데이트
            socket.on('update-settings', (newSettings) => {
                this.storageService.updateSettings(newSettings);
                this.io.emit('settings-updated', newSettings);
                this.updateCronJobs(newSettings);
            });
            
            socket.on('disconnect', () => {
                console.log(`클라이언트 연결 해제됨: ${socket.id}`);
                
                // 세션 정리 (세션 ID가 있는 경우)
                if (socket.sessionId) {
                    this.sessionAlertService.cleanupSession(socket.sessionId);
                }
            });
        });
    }

    setupCronJobs() {
        const settings = this.storageService.getSettings();
        
        // 기본값: 1분마다 크롤링
        const cronExpression = this.getCronExpression(settings.general?.refreshInterval || 60);
        
        this.cronJob = cron.schedule(cronExpression, async () => {
            if (settings.general?.autoRefresh) {
                console.log('자동 크롤링 시작...');
                try {
                    await this.performCrawling();
                } catch (error) {
                    console.error('자동 크롤링 오류:', error);
                }
            }
        }, {
            scheduled: false // 처음엔 비활성화
        });
        
        // 자동 새로고침이 활성화되어 있으면 크론 작업 시작
        if (settings.general?.autoRefresh) {
            this.cronJob.start();
        }
    }

    getCronExpression(intervalSeconds) {
        if (intervalSeconds < 60) {
            return `*/${intervalSeconds} * * * * *`; // 초 단위
        } else {
            const minutes = Math.floor(intervalSeconds / 60);
            return `*/${minutes} * * * *`; // 분 단위
        }
    }

    updateCronJobs(newSettings) {
        if (this.cronJob) {
            this.cronJob.stop();
        }
        
        const cronExpression = this.getCronExpression(newSettings.general?.refreshInterval || 60);
        this.cronJob = cron.schedule(cronExpression, async () => {
            if (newSettings.general?.autoRefresh) {
                console.log('자동 크롤링 시작...');
                try {
                    await this.performCrawling();
                } catch (error) {
                    console.error('자동 크롤링 오류:', error);
                }
            }
        });
        
        if (newSettings.general?.autoRefresh) {
            this.cronJob.start();
        }
    }

    async performCrawling() {
        try {
            console.log('크롤링 시작...');
            const products = await this.crawlerService.crawlFallcent();
            
            if (products && products.length > 0) {
                console.log(`${products.length}개 상품 발견`);
                
                // 새로운 상품과 가격 변동 체크
                const alerts = this.alertService.processProducts(products);
                
                // 클라이언트에게 업데이트 전송
                this.io.emit('products-updated', {
                    products: products,
                    alerts: alerts,
                    timestamp: new Date()
                });
                
                console.log(`크롤링 완료 - ${alerts.length}개 알림 생성`);
            } else {
                console.log('크롤링 완료 - 새로운 상품 없음');
            }
        } catch (error) {
            console.error('크롤링 중 오류 발생:', error);
            this.io.emit('crawl-error', { error: error.message });
        }
    }

    start() {
        this.server.listen(this.port, '0.0.0.0', () => {
            console.log(`🚀 폴센트 알림 서버가 포트 ${this.port}에서 실행 중입니다.`);
            console.log(`📱 웹 인터페이스: http://localhost:${this.port}`);
            
            // 시작시 한번 크롤링 실행
            setTimeout(() => {
                this.performCrawling();
            }, 5000); // 5초 후 첫 크롤링
        });
    }

    stop() {
        if (this.cronJob) {
            this.cronJob.stop();
        }
        this.server.close();
    }
}

// 애플리케이션 시작
const app = new FallcentAlert();
app.start();

// 그레이스풀 셧다운
process.on('SIGINT', () => {
    console.log('\n서버를 종료합니다...');
    app.stop();
    process.exit(0);
});

module.exports = FallcentAlert; 