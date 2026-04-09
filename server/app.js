const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const cron = require('node-cron');
const path = require('path');
const crypto = require('crypto');
const cookieParser = require('cookie-parser');

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
        this.AUTH_PASSWORD = '6739266';
        this.authTokens = new Set(); // 인증된 토큰 저장

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

    getClientIp(req) {
        return req.headers['x-forwarded-for']?.split(',')[0].trim() || req.ip?.replace('::ffff:', '') || req.connection.remoteAddress?.replace('::ffff:', '');
    }

    isAuthorized(req) {
        const clientIp = this.getClientIp(req);
        const ALLOWED_IPS = ['14.38.71.58'];
        if (ALLOWED_IPS.includes(clientIp) || clientIp === '127.0.0.1' || clientIp === '::1') return true;
        const token = req.cookies?.auth_token;
        if (token && this.authTokens.has(token)) return true;
        return false;
    }

    setupMiddleware() {
        // 쿠키 파서
        this.app.use(cookieParser());

        // CORS 설정
        this.app.use(cors());

        // JSON 파싱
        this.app.use(express.json());
        this.app.use(express.urlencoded({ extended: true }));

        // 로그인 페이지 & 처리 (인증 전에 접근 가능해야 함)
        this.app.get('/gate', (req, res) => {
            if (this.isAuthorized(req)) return res.redirect('/');
            res.send(`<!DOCTYPE html>
<html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Access</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0f172a;font-family:-apple-system,sans-serif}
.box{background:#1e293b;padding:2rem;border-radius:12px;width:320px}input{width:100%;padding:12px;border:1px solid #334155;border-radius:8px;background:#0f172a;color:#e2e8f0;font-size:16px;margin-bottom:12px;outline:none}
input:focus{border-color:#3b82f6}button{width:100%;padding:12px;border:none;border-radius:8px;background:#3b82f6;color:#fff;font-size:16px;cursor:pointer}
button:hover{background:#2563eb}.err{color:#f87171;font-size:14px;text-align:center;margin-bottom:12px;display:none}</style></head>
<body><div class="box"><form method="POST" action="/gate"><div class="err" id="err">비밀번호가 틀렸습니다</div>
<input type="password" name="password" placeholder="비밀번호" autofocus>
<button type="submit">접속</button></form></div>
<script>if(location.search.includes('fail'))document.getElementById('err').style.display='block'</script></body></html>`);
        });

        this.app.post('/gate', (req, res) => {
            if (req.body.password === this.AUTH_PASSWORD) {
                const token = crypto.randomBytes(32).toString('hex');
                this.authTokens.add(token);
                res.cookie('auth_token', token, { httpOnly: true, maxAge: 30 * 24 * 60 * 60 * 1000, sameSite: 'lax' });
                return res.redirect('/');
            }
            res.redirect('/gate?fail=1');
        });

        // 접근 제한 미들웨어
        this.app.use((req, res, next) => {
            if (this.isAuthorized(req)) return next();
            const clientIp = this.getClientIp(req);
            console.log(`🚫 차단된 접속: ${clientIp} -> ${req.path}`);
            res.redirect('/gate');
        });

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
        
        // 읽은 상품 목록 출력 (디버깅용)
        if (userSeenProducts.size > 0 && userSeenProducts.size <= 10) {
            console.log(`📋 읽은 상품 ID 목록:`, Array.from(userSeenProducts));
        } else if (userSeenProducts.size > 10) {
            console.log(`📋 읽은 상품 ID 목록 (처음 10개):`, Array.from(userSeenProducts).slice(0, 10));
        }
        
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
                return !isSeenByUser;
            });
            
            if (originalCount !== filteredAlerts[type].length) {
                console.log(`👤 ${type} 알림: ${originalCount}개 -> ${filteredAlerts[type].length}개 (필터링: ${originalCount - filteredAlerts[type].length}개)`);
            }
        });
        
        const totalOriginal = Object.values(globalAlerts).reduce((sum, alerts) => sum + alerts.length, 0);
        const totalFiltered = Object.values(filteredAlerts).reduce((sum, alerts) => sum + alerts.length, 0);
        console.log(`👤 사용자별 필터링 완료: 총 ${totalOriginal}개 -> ${totalFiltered}개`);
        
        return filteredAlerts;
    }

    setupSocketEvents() {
        // Socket.IO 접근 제한 (IP 또는 인증 토큰)
        const ALLOWED_IPS = ['14.38.71.58'];
        this.io.use((socket, next) => {
            const clientIp = socket.handshake.headers['x-forwarded-for']?.split(',')[0].trim() || socket.handshake.address?.replace('::ffff:', '');
            if (ALLOWED_IPS.includes(clientIp) || clientIp === '127.0.0.1' || clientIp === '::1') return next();
            // 쿠키에서 토큰 확인
            const cookies = socket.handshake.headers.cookie || '';
            const tokenMatch = cookies.match(/auth_token=([^;]+)/);
            if (tokenMatch && this.authTokens.has(tokenMatch[1])) return next();
            console.log(`🚫 소켓 차단: ${clientIp}`);
            next(new Error('Access Denied'));
        });

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
                console.log(`📤 초기 데이터 전송 준비:`);
                console.log(`  - 글로벌 알림:`, Object.keys(globalAlerts).map(type => `${type}: ${globalAlerts[type].length}개`).join(', '));
                console.log(`  - 사용자 필터링 후:`, Object.keys(userFilteredAlerts).map(type => `${type}: ${userFilteredAlerts[type].length}개`).join(', '));
                console.log(`  - 세션 필터링 후:`, Object.keys(sessionAlerts).map(type => `${type}: ${sessionAlerts[type].length}개`).join(', '));
                
                socket.emit('initial-data', {
                    products: this.storageService.getCurrentProducts(), // getAllProducts 대신 getCurrentProducts 사용
                    settings: this.storageService.getSettings(),
                    stats: {
                        ...this.storageService.getStats(),
                        viewedProductsCount: userSeenProducts.length // 사용자별 읽은 상품 개수
                    },
                    alerts: sessionAlerts
                });
                
                console.log(`✅ 초기 데이터 전송 완료: ${socket.id}`);
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
                
                // 통계 업데이트 전송
                socket.emit('stats-updated', {
                    viewedProductsCount: socket.userSeenProducts.size
                });
            });
            
            // 세션 데이터 초기화 처리
            socket.on('reset-session-data', () => {
                console.log(`🧹 세션 데이터 초기화 요청: ${socket.sessionId}`);
                
                // 세션별 닫힌 알림 목록 초기화
                if (socket.sessionId) {
                    this.sessionAlertService.resetSessionClosedAlerts(socket.sessionId);
                    console.log(`✅ 세션 ${socket.sessionId}의 닫힌 알림 목록 초기화 완료`);
                }
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
            
            // 🔧 사용자별 알림 닫기 처리
            socket.on('close-alert', (data) => {
                const { alertId, productId, sessionId } = data;
                console.log(`🔧 사용자별 알림 닫기 요청: ${sessionId} -> ${alertId}, 상품: ${productId}`);
                
                // 1. 사용자별 읽은 상품 목록에 추가 (소켓별 저장)
                if (!socket.userSeenProducts) {
                    socket.userSeenProducts = new Set();
                }
                socket.userSeenProducts.add(productId);
                console.log(`👤 사용자별 읽은 상품 추가: ${productId} (총 ${socket.userSeenProducts.size}개)`);
                
                // 2. 글로벌 읽은 상품 목록에도 추가 (충원 시 제외하기 위해)
                this.storageService.markProductAsSeen(productId);
                console.log(`🌍 글로벌 읽은 상품 목록에도 추가: ${productId}`);
                
                // 3. 세션에서 알림 닫기
                this.sessionAlertService.closeAlertInSession(sessionId, alertId);
                
                // 4. 알림 충원 - 전역 저장소에서 제거하고 새로운 알림 추가
                const removed = this.storageService.removeActiveAlert(alertId);
                if (removed) {
                    console.log(`🔄 알림 충원 시작...`);
                    this.alertService.replenishAlerts();
                    
                    // 전체 알림 업데이트를 모든 클라이언트에게 전송
                    this.alertService.sendAllAlertsToClients();
                }
                
                // 5. 해당 세션에만 업데이트된 알림 전송
                const sessionAlerts = this.sessionAlertService.getSessionAlerts(sessionId);
                socket.emit('alerts-updated', {
                    alerts: sessionAlerts,
                    timestamp: new Date(),
                    replace: true
                });
                
                // 6. 통계 업데이트 전송
                socket.emit('stats-updated', {
                    viewedProductsCount: socket.userSeenProducts.size
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
                
                // 크롤링한 상품들을 저장소에 저장 (이것이 누락되어 있었음!)
                this.storageService.updateCurrentProducts(products);
                console.log(`💾 ${products.length}개 상품을 저장소에 저장 완료`);
                
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