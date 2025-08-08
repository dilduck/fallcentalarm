const fs = require('fs');
const path = require('path');

class StorageService {
    constructor() {
        this.dataDir = path.join(__dirname, '../../data');
        this.ensureDataDirectory();
        
        // 파일 경로
        this.paths = {
            viewedProducts: path.join(this.dataDir, 'viewed-products.json'),
            productPrices: path.join(this.dataDir, 'product-prices.json'),
            bannedProducts: path.join(this.dataDir, 'banned-products.json'),
            settings: path.join(this.dataDir, 'settings.json'),
            currentProducts: path.join(this.dataDir, 'current-products.json'),
            activeAlerts: path.join(this.dataDir, 'active-alerts.json')
        };
        
        // 메모리 캐시
        this.cache = {
            viewedProducts: new Map(),
            productPrices: new Map(),
            bannedProducts: new Map(),
            settings: null,
            currentProducts: [],
            activeAlerts: {
                super: [],
                electronics: [],
                best: [],
                keyword: []
            }
        };
        
        this.loadAllData();
    }

    ensureDataDirectory() {
        if (!fs.existsSync(this.dataDir)) {
            fs.mkdirSync(this.dataDir, { recursive: true });
        }
    }

    loadAllData() {
        try {
            // 본 상품 로드
            this.cache.viewedProducts = this.loadMapFromFile(this.paths.viewedProducts);
            
            // 상품 가격 로드
            this.cache.productPrices = this.loadMapFromFile(this.paths.productPrices);
            
            // 차단 상품 로드
            this.cache.bannedProducts = this.loadMapFromFile(this.paths.bannedProducts);
            
            // 설정 로드
            this.cache.settings = this.loadSettings();
            
            // 현재 상품 로드
            this.cache.currentProducts = this.loadArrayFromFile(this.paths.currentProducts);
            console.log(`📦 초기 로드: ${this.cache.currentProducts.length}개 상품 로드됨`);
            
            // 활성 알림 로드
            this.cache.activeAlerts = this.loadActiveAlerts();
            
            console.log('저장소 데이터 로드 완료');
        } catch (error) {
            console.error('데이터 로드 중 오류:', error);
        }
    }

    loadMapFromFile(filePath) {
        try {
            if (fs.existsSync(filePath)) {
                const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                return new Map(Object.entries(data));
            }
        } catch (error) {
            console.warn(`파일 로드 실패: ${filePath}`, error.message);
        }
        return new Map();
    }

    loadArrayFromFile(filePath) {
        try {
            if (fs.existsSync(filePath)) {
                return JSON.parse(fs.readFileSync(filePath, 'utf8'));
            }
        } catch (error) {
            console.warn(`파일 로드 실패: ${filePath}`, error.message);
        }
        return [];
    }

    loadSettings() {
        try {
            if (fs.existsSync(this.paths.settings)) {
                return JSON.parse(fs.readFileSync(this.paths.settings, 'utf8'));
            }
        } catch (error) {
            console.warn('설정 파일 로드 실패:', error.message);
        }
        
        // 기본 설정 반환
        return this.getDefaultSettings();
    }

    loadActiveAlerts() {
        try {
            if (fs.existsSync(this.paths.activeAlerts)) {
                return JSON.parse(fs.readFileSync(this.paths.activeAlerts, 'utf8'));
            }
        } catch (error) {
            console.warn('활성 알림 파일 로드 실패:', error.message);
        }
        
        // 기본 알림 구조 반환
        return {
            super: [],
            electronics: [],
            best: [],
            keyword: []
        };
    }

    getDefaultSettings() {
        return {
            general: {
                refreshInterval: 60,
                autoRefresh: false,
                rocketOnly: false,
                minDiscountRate: 20
            },
            notifications: {
                sounds: {
                    super: "super.wav",
                    electronics: "electronics.wav", 
                    best: "best.wav",
                    keyword: "keyword.wav"
                },
                soundRepeat: {
                    super: { enabled: true, count: 3, interval: 1000 },      // 초특가: 3번 반복, 1초 간격
                    electronics: { enabled: true, count: 2, interval: 800 }, // 가전/디지털: 2번 반복, 0.8초 간격
                    keyword: { enabled: true, count: 2, interval: 900 },     // 키워드: 2번 반복, 0.9초 간격
                    best: { enabled: false, count: 1, interval: 0 }          // 베스트 딜: 반복 없음
                },
                browserNotifications: true,
                notificationDuration: 5000
            },
            keywords: {
                categories: [
                    {
                        id: "wireless_audio",
                        name: "무선이어폰 관련",
                        icon: "📱",
                        enabled: true,
                        priority: "high",
                        keywords: ["블루투스", "이어폰", "버즈", "에어팟", "무선이어폰"]
                    },
                    {
                        id: "mobile",
                        name: "휴대폰 관련",
                        icon: "📱",
                        enabled: true,
                        priority: "high",
                        keywords: ["갤럭시", "아이폰", "스마트폰"]
                    },
                    {
                        id: "computer",
                        name: "컴퓨터 관련",
                        icon: "💻",
                        enabled: true,
                        priority: "medium",
                        keywords: ["노트북", "맥북", "컴퓨터", "데스크탑"]
                    },
                    {
                        id: "display",
                        name: "디스플레이 관련",
                        icon: "🖥️",
                        enabled: true,
                        priority: "medium",
                        keywords: ["모니터", "TV", "텔레비전"]
                    },
                    {
                        id: "peripherals",
                        name: "주변기기",
                        icon: "⌨️",
                        enabled: true,
                        priority: "low",
                        keywords: ["키보드", "마우스", "헤드셋"]
                    },
                    {
                        id: "storage",
                        name: "저장장치",
                        icon: "💾",
                        enabled: true,
                        priority: "medium",
                        keywords: ["SSD", "HDD", "메모리"]
                    },
                    {
                        id: "large_appliances",
                        name: "대형가전",
                        icon: "🏠",
                        enabled: true,
                        priority: "low",
                        keywords: ["냉장고", "세탁기", "건조기"]
                    },
                    {
                        id: "small_appliances",
                        name: "소형가전",
                        icon: "🍳",
                        enabled: true,
                        priority: "low",
                        keywords: ["전자레인지", "에어프라이어", "공기청정기"]
                    }
                ]
            },
            advanced: {
                debugMode: false,
                showCrawlLogs: false
            }
        };
    }

    saveMapToFile(map, filePath) {
        try {
            const obj = Object.fromEntries(map);
            fs.writeFileSync(filePath, JSON.stringify(obj, null, 2), 'utf8');
        } catch (error) {
            console.error(`파일 저장 실패: ${filePath}`, error);
        }
    }

    saveArrayToFile(array, filePath) {
        try {
            fs.writeFileSync(filePath, JSON.stringify(array, null, 2), 'utf8');
        } catch (error) {
            console.error(`파일 저장 실패: ${filePath}`, error);
        }
    }

    saveObjectToFile(obj, filePath) {
        try {
            fs.writeFileSync(filePath, JSON.stringify(obj, null, 2), 'utf8');
        } catch (error) {
            console.error(`파일 저장 실패: ${filePath}`, error);
        }
    }

    // === 상품 확인 관련 ===
    markProductAsSeen(productId) {
        console.log(`👁️ markProductAsSeen 호출: ${productId}`);
        console.log(`📊 표시 전 확인된 상품 수: ${this.cache.viewedProducts.size}`);
        
        const wasAlreadySeen = this.cache.viewedProducts.has(productId);
        this.cache.viewedProducts.set(productId, new Date().toISOString());
        this.saveMapToFile(this.cache.viewedProducts, this.paths.viewedProducts);
        
        console.log(`${wasAlreadySeen ? '🔄' : '✅'} 상품 확인 처리 ${wasAlreadySeen ? '(이미 확인됨)' : '(새로 확인됨)'}: ${productId}`);
        console.log(`📊 표시 후 확인된 상품 수: ${this.cache.viewedProducts.size}`);
    }

    isProductSeen(productId) {
        return this.cache.viewedProducts.has(productId);
    }

    getSeenProductsCount() {
        return this.cache.viewedProducts.size;
    }

    clearViewedProducts() {
        this.cache.viewedProducts.clear();
        this.saveMapToFile(this.cache.viewedProducts, this.paths.viewedProducts);
    }

    // === 상품 가격 관련 ===
    updateProductPrice(productId, price) {
        this.cache.productPrices.set(productId, price);
        this.saveMapToFile(this.cache.productPrices, this.paths.productPrices);
    }

    getProductPrice(productId) {
        return this.cache.productPrices.get(productId);
    }

    // === 상품 차단 관련 ===
    banProduct(productId, title) {
        const bannedProduct = {
            title: title,
            addedAt: new Date().toISOString()
        };
        this.cache.bannedProducts.set(productId, bannedProduct);
        this.saveMapToFile(this.cache.bannedProducts, this.paths.bannedProducts);
    }

    unbanProduct(productId) {
        this.cache.bannedProducts.delete(productId);
        this.saveMapToFile(this.cache.bannedProducts, this.paths.bannedProducts);
    }

    isProductBanned(productId) {
        return this.cache.bannedProducts.has(productId);
    }

    getBannedProducts() {
        return Array.from(this.cache.bannedProducts.entries()).map(([id, data]) => ({
            id: id,
            ...data
        }));
    }

    getBannedProductsCount() {
        return this.cache.bannedProducts.size;
    }

    clearBannedProducts() {
        this.cache.bannedProducts.clear();
        this.saveMapToFile(this.cache.bannedProducts, this.paths.bannedProducts);
    }

    // === 설정 관련 ===
    getSettings() {
        return this.cache.settings;
    }

    updateSettings(newSettings) {
        this.cache.settings = { ...this.cache.settings, ...newSettings };
        this.saveObjectToFile(this.cache.settings, this.paths.settings);
    }

    resetSettings() {
        this.cache.settings = this.getDefaultSettings();
        this.saveObjectToFile(this.cache.settings, this.paths.settings);
    }

    // === 키워드 관련 ===
    addKeyword(categoryId, keyword) {
        const category = this.cache.settings.keywords.categories.find(c => c.id === categoryId);
        if (category && !category.keywords.includes(keyword)) {
            category.keywords.push(keyword);
            this.saveObjectToFile(this.cache.settings, this.paths.settings);
            return true;
        }
        return false;
    }

    removeKeyword(categoryId, keyword) {
        const category = this.cache.settings.keywords.categories.find(c => c.id === categoryId);
        if (category) {
            category.keywords = category.keywords.filter(k => k !== keyword);
            this.saveObjectToFile(this.cache.settings, this.paths.settings);
            return true;
        }
        return false;
    }

    addKeywordCategory(categoryData) {
        this.cache.settings.keywords.categories.push(categoryData);
        this.saveObjectToFile(this.cache.settings, this.paths.settings);
    }

    removeKeywordCategory(categoryId) {
        this.cache.settings.keywords.categories = 
            this.cache.settings.keywords.categories.filter(c => c.id !== categoryId);
        this.saveObjectToFile(this.cache.settings, this.paths.settings);
    }

    // === 현재 상품 관련 ===
    updateCurrentProducts(products) {
        console.log(`💾 updateCurrentProducts 호출 - ${products.length}개 상품 저장 시작`);
        this.cache.currentProducts = products;
        this.saveArrayToFile(this.cache.currentProducts, this.paths.currentProducts);
        console.log(`✅ updateCurrentProducts 완료 - 메모리 캐시: ${this.cache.currentProducts.length}개`);
    }

    getAllProducts() {
        console.log(`📦 getAllProducts 호출 - 캐시에서 ${this.cache.currentProducts.length}개 상품 반환`);
        return this.cache.currentProducts;
    }
    
    getCurrentProducts() {
        return this.getAllProducts();
    }

    // === 통계 ===
    getStats() {
        return {
            viewedProductsCount: this.getSeenProductsCount(),
            bannedProductsCount: this.getBannedProductsCount(),
            currentProductsCount: this.cache.currentProducts.length,
            lastUpdate: this.cache.currentProducts.length > 0 ? 
                Math.max(...this.cache.currentProducts.map(p => new Date(p.timestamp))) : null
        };
    }

    // === 데이터 초기화 ===
    resetAllData() {
        this.cache.viewedProducts.clear();
        this.cache.productPrices.clear();
        this.cache.bannedProducts.clear();
        this.cache.currentProducts = [];
        this.cache.activeAlerts = {
            super: [],
            electronics: [],
            best: [],
            keyword: []
        };
        
        this.saveMapToFile(this.cache.viewedProducts, this.paths.viewedProducts);
        this.saveMapToFile(this.cache.productPrices, this.paths.productPrices);
        this.saveMapToFile(this.cache.bannedProducts, this.paths.bannedProducts);
        this.saveArrayToFile(this.cache.currentProducts, this.paths.currentProducts);
        this.saveObjectToFile(this.cache.activeAlerts, this.paths.activeAlerts);
    }

    // === 데이터 내보내기/가져오기 ===
    exportData() {
        return {
            viewedProducts: Object.fromEntries(this.cache.viewedProducts),
            productPrices: Object.fromEntries(this.cache.productPrices),
            bannedProducts: Object.fromEntries(this.cache.bannedProducts),
            settings: this.cache.settings,
            currentProducts: this.cache.currentProducts,
            exportedAt: new Date().toISOString()
        };
    }

    importData(data) {
        try {
            if (data.viewedProducts) {
                this.cache.viewedProducts = new Map(Object.entries(data.viewedProducts));
                this.saveMapToFile(this.cache.viewedProducts, this.paths.viewedProducts);
            }
            
            if (data.productPrices) {
                this.cache.productPrices = new Map(Object.entries(data.productPrices));
                this.saveMapToFile(this.cache.productPrices, this.paths.productPrices);
            }
            
            if (data.bannedProducts) {
                this.cache.bannedProducts = new Map(Object.entries(data.bannedProducts));
                this.saveMapToFile(this.cache.bannedProducts, this.paths.bannedProducts);
            }
            
            if (data.settings) {
                this.cache.settings = data.settings;
                this.saveObjectToFile(this.cache.settings, this.paths.settings);
            }
            
            if (data.currentProducts) {
                this.cache.currentProducts = data.currentProducts;
                this.saveArrayToFile(this.cache.currentProducts, this.paths.currentProducts);
            }
            
            return true;
        } catch (error) {
            console.error('데이터 가져오기 실패:', error);
            return false;
        }
    }

    // === 활성 알림 관련 ===
    addActiveAlert(alertType, alert) {
        if (!this.cache.activeAlerts[alertType]) {
            this.cache.activeAlerts[alertType] = [];
        }
        
        // 중복 제거 (같은 상품 ID)
        this.cache.activeAlerts[alertType] = this.cache.activeAlerts[alertType]
            .filter(existingAlert => existingAlert.productId !== alert.productId);
        
        // 새 알림 추가
        this.cache.activeAlerts[alertType].push(alert);
        
        // ✅ 추가 후 할인율순으로 정렬 (높은순)
        this.cache.activeAlerts[alertType].sort((a, b) => {
            // 1차: 할인율 높은순
            if (a.product.discountRate !== b.product.discountRate) {
                return b.product.discountRate - a.product.discountRate;
            }
            // 2차: 가격 낮은순 (같은 할인율일 때)
            return a.product.price - b.product.price;
        });
        
        // 최대 10개까지만 유지 (기존 5개에서 증가)
        if (this.cache.activeAlerts[alertType].length > 10) {
            this.cache.activeAlerts[alertType] = this.cache.activeAlerts[alertType].slice(0, 10);
        }
        
        this.saveObjectToFile(this.cache.activeAlerts, this.paths.activeAlerts);
    }

    removeActiveAlert(alertId) {
        console.log(`🔍 StorageService: 알림 ID "${alertId}" 제거 시도`);
        let found = false;
        let foundProductId = null;
        let removedCount = 0;
        
        // 먼저 해당 alertId를 가진 알림을 찾아서 productId를 가져옴
        Object.keys(this.cache.activeAlerts).forEach(type => {
            const alert = this.cache.activeAlerts[type].find(alert => alert.id === alertId);
            if (alert) {
                foundProductId = alert.productId;
                console.log(`✅ ${type} 카테고리에서 알림 발견! productId: ${foundProductId}`);
            }
        });
        
        // productId를 찾았으면 모든 카테고리에서 해당 productId를 가진 알림을 모두 제거
        if (foundProductId) {
            console.log(`🔍 모든 카테고리에서 productId "${foundProductId}"를 가진 알림 제거 중...`);
            
            Object.keys(this.cache.activeAlerts).forEach(type => {
                const originalLength = this.cache.activeAlerts[type].length;
                this.cache.activeAlerts[type] = this.cache.activeAlerts[type].filter(alert => alert.productId !== foundProductId);
                const removedFromType = originalLength - this.cache.activeAlerts[type].length;
                
                if (removedFromType > 0) {
                    console.log(`✅ ${type} 카테고리에서 ${removedFromType}개 알림 제거됨`);
                    removedCount += removedFromType;
                    found = true;
                }
            });
        }
        
        if (found) {
            this.saveObjectToFile(this.cache.activeAlerts, this.paths.activeAlerts);
            console.log(`💾 활성 알림 파일 저장 완료 - 총 ${removedCount}개 알림 제거됨`);
            
            // 제거 후 전체 상태 확인
            const totalAlerts = Object.values(this.cache.activeAlerts).reduce((sum, alerts) => sum + alerts.length, 0);
            console.log(`📊 전체 활성 알림 수: ${totalAlerts}`);
        } else {
            console.log(`❌ 알림 ID "${alertId}"를 어떤 카테고리에서도 찾을 수 없음`);
        }
        
        return found;
    }

    removeActiveAlertByProductId(productId) {
        let found = false;
        Object.keys(this.cache.activeAlerts).forEach(type => {
            const index = this.cache.activeAlerts[type].findIndex(alert => alert.productId === productId);
            if (index !== -1) {
                this.cache.activeAlerts[type].splice(index, 1);
                found = true;
            }
        });
        
        if (found) {
            this.saveObjectToFile(this.cache.activeAlerts, this.paths.activeAlerts);
        }
        
        return found;
    }

    getActiveAlerts() {
        return this.cache.activeAlerts;
    }

    getNextBestAlert(alertType, excludeProductIds = []) {
        console.log(`🔍 getNextBestAlert 호출: ${alertType} 타입, 제외 상품 수: ${excludeProductIds.length}`);
        console.log(`📊 전체 상품 수: ${this.cache.currentProducts.length}, 확인된 상품 수: ${this.getSeenProductsCount()}`);
        
        // 현재 상품 중에서 해당 알림 타입에 맞는 다음 최고 상품 찾기
        const availableProducts = this.cache.currentProducts.filter(product => {
            // 이미 알림에 있는 상품 제외
            if (excludeProductIds.includes(product.id)) {
                console.log(`⏭️ 이미 알림에 있는 상품 제외: ${product.title.substring(0, 30)}... (${product.id})`);
                return false;
            }
            
            // 이미 본 상품 제외 - StorageService의 viewedProducts 캐시를 확인
            if (this.isProductSeen(product.id)) {
                console.log(`👁️ 이미 확인된 상품 제외: ${product.title.substring(0, 30)}... (${product.id})`);
                return false;
            }
            
            // 차단된 상품 제외
            if (this.isProductBanned(product.id)) {
                console.log(`🚫 차단된 상품 제외: ${product.title.substring(0, 30)}... (${product.id})`);
                return false;
            }
            
            // 알림 타입에 맞는 조건 확인
            let matches = false;
            switch (alertType) {
                case 'super':
                    matches = product.discountRate >= 49;
                    break;
                case 'electronics':
                    matches = product.isElectronic;
                    break;
                case 'keyword':
                    matches = product.isKeywordMatch;
                    break;
                case 'best':
                    matches = product.discountRate >= 20;
                    break;
                default:
                    matches = false;
            }
            
            if (!matches) {
                console.log(`❌ ${alertType} 조건 불일치: ${product.title.substring(0, 30)}... (할인율: ${product.discountRate}%)`);
            } else {
                console.log(`✅ 조건 만족: ${product.title.substring(0, 30)}... (할인율: ${product.discountRate}%)`);
            }
            
            return matches;
        });
        
        console.log(`🎯 필터링 후 가능한 상품 수: ${availableProducts.length}`);
        
        // 할인율순으로 정렬하고 첫 번째 반환
        if (availableProducts.length > 0) {
            availableProducts.sort((a, b) => b.discountRate - a.discountRate);
            const selectedProduct = availableProducts[0];
            console.log(`🔥 선택된 상품: ${selectedProduct.title.substring(0, 30)}... (할인율: ${selectedProduct.discountRate}%)`);
            return selectedProduct;
        }
        
        console.log(`💔 ${alertType} 타입에 대해 충원 가능한 상품이 없습니다.`);
        return null;
    }

    clearActiveAlerts(alertType = null) {
        if (alertType) {
            this.cache.activeAlerts[alertType] = [];
        } else {
            this.cache.activeAlerts = {
                super: [],
                electronics: [],
                best: [],
                keyword: []
            };
        }
        
        this.saveObjectToFile(this.cache.activeAlerts, this.paths.activeAlerts);
    }
}

module.exports = StorageService; 