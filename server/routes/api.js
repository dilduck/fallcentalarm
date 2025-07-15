const express = require('express');
const router = express.Router();

// 글로벌 서비스 참조 (app.js에서 설정됨)
let crawlerService, alertService, storageService;

// 서비스 의존성 주입
function setServices(services) {
    crawlerService = services.crawlerService;
    alertService = services.alertService;
    storageService = services.storageService;
}

// === 크롤링 관련 API ===

// 수동 크롤링 실행
router.post('/crawl', async (req, res) => {
    try {
        console.log('수동 크롤링 API 호출됨');
        const products = await crawlerService.crawlFallcent();
        
        if (products && products.length > 0) {
            const alerts = alertService.processProducts(products);
            
            res.json({
                success: true,
                message: `${products.length}개 상품 크롤링 완료`,
                data: {
                    products: products,
                    alerts: alerts,
                    timestamp: new Date()
                }
            });
        } else {
            res.json({
                success: true,
                message: '새로운 상품이 없습니다',
                data: {
                    products: [],
                    alerts: [],
                    timestamp: new Date()
                }
            });
        }
    } catch (error) {
        console.error('크롤링 API 오류:', error);
        res.status(500).json({
            success: false,
            message: '크롤링 중 오류가 발생했습니다',
            error: error.message
        });
    }
});

// 현재 상품 목록 조회
router.get('/products', (req, res) => {
    try {
        const products = storageService.getAllProducts();
        const stats = storageService.getStats();
        
        res.json({
            success: true,
            data: {
                products: products,
                stats: stats,
                timestamp: new Date()
            }
        });
    } catch (error) {
        console.error('상품 조회 API 오류:', error);
        res.status(500).json({
            success: false,
            message: '상품 조회 중 오류가 발생했습니다',
            error: error.message
        });
    }
});

// 상품 확인 처리
router.post('/products/:productId/seen', (req, res) => {
    try {
        const { productId } = req.params;
        storageService.markProductAsSeen(productId);
        
        res.json({
            success: true,
            message: '상품이 확인됨으로 표시되었습니다',
            data: { productId: productId }
        });
    } catch (error) {
        console.error('상품 확인 API 오류:', error);
        res.status(500).json({
            success: false,
            message: '상품 확인 처리 중 오류가 발생했습니다',
            error: error.message
        });
    }
});

// 상품 차단 처리
router.post('/products/:productId/ban', (req, res) => {
    try {
        const { productId } = req.params;
        const { title } = req.body;
        
        storageService.banProduct(productId, title);
        alertService.removeProductAlerts(productId);
        
        res.json({
            success: true,
            message: '상품이 차단되었습니다',
            data: { productId: productId, title: title }
        });
    } catch (error) {
        console.error('상품 차단 API 오류:', error);
        res.status(500).json({
            success: false,
            message: '상품 차단 처리 중 오류가 발생했습니다',
            error: error.message
        });
    }
});

// === 차단 상품 관리 API ===

// 차단된 상품 목록 조회
router.get('/banned-products', (req, res) => {
    try {
        const bannedProducts = storageService.getBannedProducts();
        
        res.json({
            success: true,
            data: {
                bannedProducts: bannedProducts,
                count: bannedProducts.length
            }
        });
    } catch (error) {
        console.error('차단 상품 조회 API 오류:', error);
        res.status(500).json({
            success: false,
            message: '차단 상품 조회 중 오류가 발생했습니다',
            error: error.message
        });
    }
});

// 상품 차단 해제
router.delete('/banned-products/:productId', (req, res) => {
    try {
        const { productId } = req.params;
        storageService.unbanProduct(productId);
        
        res.json({
            success: true,
            message: '상품 차단이 해제되었습니다',
            data: { productId: productId }
        });
    } catch (error) {
        console.error('차단 해제 API 오류:', error);
        res.status(500).json({
            success: false,
            message: '차단 해제 처리 중 오류가 발생했습니다',
            error: error.message
        });
    }
});

// 모든 차단 상품 해제
router.delete('/banned-products', (req, res) => {
    try {
        storageService.clearBannedProducts();
        
        res.json({
            success: true,
            message: '모든 차단 상품이 해제되었습니다'
        });
    } catch (error) {
        console.error('전체 차단 해제 API 오류:', error);
        res.status(500).json({
            success: false,
            message: '전체 차단 해제 처리 중 오류가 발생했습니다',
            error: error.message
        });
    }
});

// === 설정 관리 API ===

// 설정 조회
router.get('/settings', (req, res) => {
    try {
        const settings = storageService.getSettings();
        
        res.json({
            success: true,
            data: settings
        });
    } catch (error) {
        console.error('설정 조회 API 오류:', error);
        res.status(500).json({
            success: false,
            message: '설정 조회 중 오류가 발생했습니다',
            error: error.message
        });
    }
});

// 설정 업데이트
router.put('/settings', (req, res) => {
    try {
        const newSettings = req.body;
        storageService.updateSettings(newSettings);
        
        res.json({
            success: true,
            message: '설정이 업데이트되었습니다',
            data: storageService.getSettings()
        });
    } catch (error) {
        console.error('설정 업데이트 API 오류:', error);
        res.status(500).json({
            success: false,
            message: '설정 업데이트 중 오류가 발생했습니다',
            error: error.message
        });
    }
});

// 설정 초기화
router.post('/settings/reset', (req, res) => {
    try {
        storageService.resetSettings();
        
        res.json({
            success: true,
            message: '설정이 초기화되었습니다',
            data: storageService.getSettings()
        });
    } catch (error) {
        console.error('설정 초기화 API 오류:', error);
        res.status(500).json({
            success: false,
            message: '설정 초기화 중 오류가 발생했습니다',
            error: error.message
        });
    }
});

// === 키워드 관리 API ===

// 키워드 추가
router.post('/keywords', (req, res) => {
    try {
        const { categoryId, keyword } = req.body;
        
        if (!categoryId || !keyword) {
            return res.status(400).json({
                success: false,
                message: '카테고리 ID와 키워드가 필요합니다'
            });
        }
        
        const success = storageService.addKeyword(categoryId, keyword);
        
        if (success) {
            res.json({
                success: true,
                message: '키워드가 추가되었습니다',
                data: { categoryId, keyword }
            });
        } else {
            res.status(400).json({
                success: false,
                message: '키워드 추가에 실패했습니다 (중복이거나 카테고리를 찾을 수 없음)'
            });
        }
    } catch (error) {
        console.error('키워드 추가 API 오류:', error);
        res.status(500).json({
            success: false,
            message: '키워드 추가 중 오류가 발생했습니다',
            error: error.message
        });
    }
});

// 키워드 삭제
router.delete('/keywords/:categoryId/:keyword', (req, res) => {
    try {
        const { categoryId, keyword } = req.params;
        const success = storageService.removeKeyword(categoryId, decodeURIComponent(keyword));
        
        if (success) {
            res.json({
                success: true,
                message: '키워드가 삭제되었습니다',
                data: { categoryId, keyword }
            });
        } else {
            res.status(404).json({
                success: false,
                message: '키워드를 찾을 수 없습니다'
            });
        }
    } catch (error) {
        console.error('키워드 삭제 API 오류:', error);
        res.status(500).json({
            success: false,
            message: '키워드 삭제 중 오류가 발생했습니다',
            error: error.message
        });
    }
});

// 키워드 카테고리 추가
router.post('/keyword-categories', (req, res) => {
    try {
        const categoryData = req.body;
        
        if (!categoryData.id || !categoryData.name) {
            return res.status(400).json({
                success: false,
                message: '카테고리 ID와 이름이 필요합니다'
            });
        }
        
        storageService.addKeywordCategory(categoryData);
        
        res.json({
            success: true,
            message: '키워드 카테고리가 추가되었습니다',
            data: categoryData
        });
    } catch (error) {
        console.error('카테고리 추가 API 오류:', error);
        res.status(500).json({
            success: false,
            message: '카테고리 추가 중 오류가 발생했습니다',
            error: error.message
        });
    }
});

// 키워드 카테고리 삭제
router.delete('/keyword-categories/:categoryId', (req, res) => {
    try {
        const { categoryId } = req.params;
        storageService.removeKeywordCategory(categoryId);
        
        res.json({
            success: true,
            message: '키워드 카테고리가 삭제되었습니다',
            data: { categoryId }
        });
    } catch (error) {
        console.error('카테고리 삭제 API 오류:', error);
        res.status(500).json({
            success: false,
            message: '카테고리 삭제 중 오류가 발생했습니다',
            error: error.message
        });
    }
});

// === 통계 및 상태 API ===

// 통계 조회
router.get('/stats', (req, res) => {
    try {
        const stats = storageService.getStats();
        const alertStats = alertService.getAlertStats();
        
        res.json({
            success: true,
            data: {
                storage: stats,
                alerts: alertStats,
                timestamp: new Date()
            }
        });
    } catch (error) {
        console.error('통계 조회 API 오류:', error);
        res.status(500).json({
            success: false,
            message: '통계 조회 중 오류가 발생했습니다',
            error: error.message
        });
    }
});

// === 데이터 관리 API ===

// 확인된 상품 기록 초기화
router.delete('/viewed-products', (req, res) => {
    try {
        storageService.clearViewedProducts();
        
        res.json({
            success: true,
            message: '확인된 상품 기록이 초기화되었습니다'
        });
    } catch (error) {
        console.error('확인 기록 초기화 API 오류:', error);
        res.status(500).json({
            success: false,
            message: '확인 기록 초기화 중 오류가 발생했습니다',
            error: error.message
        });
    }
});

// 모든 데이터 초기화
router.delete('/data/reset', (req, res) => {
    try {
        storageService.resetAllData();
        alertService.clearAllAlerts();
        
        res.json({
            success: true,
            message: '모든 데이터가 초기화되었습니다'
        });
    } catch (error) {
        console.error('데이터 초기화 API 오류:', error);
        res.status(500).json({
            success: false,
            message: '데이터 초기화 중 오류가 발생했습니다',
            error: error.message
        });
    }
});

// 데이터 내보내기
router.get('/data/export', (req, res) => {
    try {
        const exportData = storageService.exportData();
        
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename=fallcentalert-export-${new Date().toISOString().split('T')[0]}.json`);
        
        res.json(exportData);
    } catch (error) {
        console.error('데이터 내보내기 API 오류:', error);
        res.status(500).json({
            success: false,
            message: '데이터 내보내기 중 오류가 발생했습니다',
            error: error.message
        });
    }
});

// 데이터 가져오기
router.post('/data/import', (req, res) => {
    try {
        const importData = req.body;
        const success = storageService.importData(importData);
        
        if (success) {
            res.json({
                success: true,
                message: '데이터가 성공적으로 가져와졌습니다'
            });
        } else {
            res.status(400).json({
                success: false,
                message: '데이터 가져오기에 실패했습니다'
            });
        }
    } catch (error) {
        console.error('데이터 가져오기 API 오류:', error);
        res.status(500).json({
            success: false,
            message: '데이터 가져오기 중 오류가 발생했습니다',
            error: error.message
        });
    }
});

// === 테스트 API ===

// 테스트 알림 전송
router.post('/test/alert', (req, res) => {
    try {
        const { alertType } = req.body;
        const testAlert = alertService.sendTestAlert(alertType);
        
        res.json({
            success: true,
            message: '테스트 알림이 전송되었습니다',
            data: testAlert
        });
    } catch (error) {
        console.error('테스트 알림 API 오류:', error);
        res.status(500).json({
            success: false,
            message: '테스트 알림 전송 중 오류가 발생했습니다',
            error: error.message
        });
    }
});

// 서버 상태 확인
router.get('/health', (req, res) => {
    res.json({
        success: true,
        message: '서버가 정상적으로 작동 중입니다',
        data: {
            timestamp: new Date(),
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            version: process.version
        }
    });
});

module.exports = { router, setServices }; 