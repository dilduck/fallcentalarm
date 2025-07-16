class FallcentAlertApp {
    constructor() {
        this.socket = io();
        this.currentProducts = [];
        this.currentSettings = {};
        this.alerts = {
            super: [],
            electronics: [],
            best: [],
            keyword: []
        };
        
        // 세션 관리 개선
        this.sessionId = this.generateSessionId();
        this.closedAlerts = new Set(); // 클라이언트 측에서도 닫힌 알림 추적
        
        // 유저별 읽은 상품 관리 (localStorage + 쿠키 하이브리드)
        this.userSeenProducts = this.loadUserSeenProducts();
        this.userId = this.getUserId();
        
        // 소리 생성을 위한 Audio Context
        this.audioContext = null;
        this.initAudioContext();
        
        this.initializeEventListeners();
        this.setupSocketListeners();
        this.requestNotificationPermission();
    }

    // 고유한 세션 ID 생성
    generateSessionId() {
        return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
    
    // 유저 ID 생성/로드 (localStorage + 쿠키 하이브리드)
    getUserId() {
        let userId = localStorage.getItem('fallcent_user_id');
        if (!userId) {
            userId = this.getCookie('fallcent_user_id');
        }
        if (!userId) {
            userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('fallcent_user_id', userId);
            this.setCookie('fallcent_user_id', userId, 365);
        }
        return userId;
    }
    
    // 유저별 읽은 상품 로드
    loadUserSeenProducts() {
        try {
            const localData = localStorage.getItem('fallcent_seen_products');
            if (localData) {
                return new Set(JSON.parse(localData));
            }
            
            const cookieData = this.getCookie('fallcent_seen_products');
            if (cookieData) {
                return new Set(JSON.parse(decodeURIComponent(cookieData)));
            }
        } catch (error) {
            console.warn('읽은 상품 로드 실패:', error);
        }
        return new Set();
    }
    
    // 유저별 읽은 상품 저장
    saveUserSeenProducts() {
        try {
            const seenArray = Array.from(this.userSeenProducts);
            localStorage.setItem('fallcent_seen_products', JSON.stringify(seenArray));
            this.setCookie('fallcent_seen_products', encodeURIComponent(JSON.stringify(seenArray)), 30);
        } catch (error) {
            console.warn('읽은 상품 저장 실패:', error);
        }
    }
    
    // 쿠키 설정
    setCookie(name, value, days) {
        const expires = new Date();
        expires.setTime(expires.getTime() + (days * 24 * 60 * 60 * 1000));
        document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/`;
    }
    
    // 쿠키 가져오기
    getCookie(name) {
        const nameEQ = name + '=';
        const ca = document.cookie.split(';');
        for (let i = 0; i < ca.length; i++) {
            let c = ca[i];
            while (c.charAt(0) === ' ') c = c.substring(1, c.length);
            if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
        }
        return null;
    }
    
    // 상품이 읽음 상태인지 확인
    isProductSeen(productId) {
        return this.userSeenProducts.has(productId);
    }
    
    // 상품을 읽음 상태로 표시
    markProductAsSeen(productId) {
        this.userSeenProducts.add(productId);
        this.saveUserSeenProducts();
    }

    // Web Audio API로 소리 생성 초기화
    initAudioContext() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.warn('Web Audio API가 지원되지 않습니다:', e);
        }
    }

    // VB.NET처럼 각 알림 타입별 다른 소리 생성
    playAlertSound(alertType) {
        this.playAlertSoundWithRepeat(alertType, { repeat: { enabled: false, count: 1, interval: 0 } });
    }

    // VB.NET처럼 각 알림 타입별 다른 소리 생성 (반복재생 지원)
    playAlertSoundWithRepeat(alertType, soundInfo) {
        if (!this.audioContext) {
            console.warn('Audio Context가 초기화되지 않았습니다.');
            return;
        }

        // 반복재생 설정 확인
        const repeat = soundInfo?.repeat || { enabled: false, count: 1, interval: 0 };
        
        // VB.NET의 알림 소리와 유사한 패턴으로 구현
        let frequency, duration, pattern;
        
        switch (alertType) {
            case 'super':
                // 초특가: 긴급한 느낌의 높은 주파수 반복음
                frequency = 1000;
                duration = 200;
                pattern = [1000, 1200, 1000, 1200]; // 4번 반복
                break;
            case 'electronics':
                // 가전/디지털: 중간 주파수의 안정적인 음
                frequency = 800;
                duration = 300;
                pattern = [800, 900]; // 2번 반복
                break;
            case 'best':
                // 베스트 딜: 부드러운 중저음
                frequency = 600;
                duration = 250;
                pattern = [600]; // 1번
                break;
            case 'keyword':
                // 키워드: 특별한 패턴의 음
                frequency = 750;
                duration = 150;
                pattern = [750, 850, 750]; // 3번 반복
                break;
            default:
                frequency = 440;
                duration = 200;
                pattern = [440];
        }

        // 반복재생 처리
        if (repeat.enabled && repeat.count > 1) {
            console.log(`🔊 알림 소리 반복재생: ${alertType} (${repeat.count}번, ${repeat.interval}ms 간격)`);
            
            for (let i = 0; i < repeat.count; i++) {
                setTimeout(() => {
                    this.playBeepPattern(pattern, duration);
                }, i * repeat.interval);
            }
        } else {
            console.log(`🔊 알림 소리 단일재생: ${alertType}`);
            this.playBeepPattern(pattern, duration);
        }
    }

    // 소리 패턴 재생
    playBeepPattern(frequencies, duration) {
        if (!this.audioContext) return;

        let delay = 0;
        frequencies.forEach((freq, index) => {
            setTimeout(() => {
                this.playBeep(freq, duration);
            }, delay);
            delay += duration + 100; // 소리 간격
        });
    }

    // 단일 beep 소리 생성
    playBeep(frequency, duration) {
        if (!this.audioContext) return;

        try {
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            oscillator.frequency.value = frequency;
            oscillator.type = 'sine';
            
            gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration / 1000);
            
            oscillator.start(this.audioContext.currentTime);
            oscillator.stop(this.audioContext.currentTime + duration / 1000);
        } catch (error) {
            console.warn('소리 재생 중 오류:', error);
        }
    }

    initializeEventListeners() {
        // 수동 새로고침 버튼
        document.getElementById('refreshBtn').addEventListener('click', () => {
            this.requestManualCrawl();
        });

        // 설정 버튼
        document.getElementById('settingsBtn').addEventListener('click', () => {
            this.openSettingsModal();
        });

        // 설정 모달 관련
        document.getElementById('closeSettingsBtn').addEventListener('click', () => {
            this.closeSettingsModal();
        });

        document.getElementById('saveSettingsBtn').addEventListener('click', () => {
            this.saveSettings();
        });

        document.getElementById('resetSettingsBtn').addEventListener('click', () => {
            this.resetSettings();
        });

        // 데이터 초기화 버튼들
        document.getElementById('clearViewedBtn').addEventListener('click', () => {
            this.clearViewedProducts();
        });

        document.getElementById('clearBannedBtn').addEventListener('click', () => {
            this.clearBannedProducts();
        });

        document.getElementById('resetAllDataBtn').addEventListener('click', () => {
            this.resetAllData();
        });

        // 정렬 및 필터 옵션
        document.getElementById('sortSelect').addEventListener('change', () => {
            this.renderProducts();
        });

        document.getElementById('rocketFilter').addEventListener('change', () => {
            this.renderProducts();
        });

        // 모달 외부 클릭시 닫기
        document.getElementById('settingsModal').addEventListener('click', (e) => {
            if (e.target.id === 'settingsModal') {
                this.closeSettingsModal();
            }
        });
        
        // 🔧 개선된 이벤트 위임 설정 (문서 레벨에서 처리)
        this.setupAlertEventDelegation();
    }

    setupSocketListeners() {
        // 연결 시 세션 초기화 요청 (사용자별 읽은 상품 정보 포함)
        this.socket.on('connect', () => {
            console.log(`🔌 서버에 연결됨`);
            console.log(`👤 사용자 ID: ${this.userId}`);
            console.log(`📋 세션 ID: ${this.sessionId}`);
            console.log(`📝 사용자 읽은 상품 ${this.userSeenProducts.size}개:`, Array.from(this.userSeenProducts));
            
            this.socket.emit('init-session', { 
                sessionId: this.sessionId,
                userSeenProducts: Array.from(this.userSeenProducts)
            });
        });

        // 초기 데이터 수신
        this.socket.on('initial-data', (data) => {
            console.log('📥 초기 데이터 수신:', data);
            console.log('📊 서버에서 받은 알림:', data.alerts);
            
            this.currentProducts = data.products || [];
            this.currentSettings = data.settings || {};
            this.updateStats(data.stats || {});
            
            // 기존 알림 복원 (서버에서 이미 사용자별 필터링 적용됨)
            if (data.alerts) {
                this.alerts = data.alerts;
                console.log('💾 서버에서 받은 필터링된 알림:', Object.keys(this.alerts).map(k => `${k}: ${this.alerts[k].length}개`).join(', '));
                
                // 클라이언트에서 추가 필터링 (이중 보안)
                this.filterAlertsForUser();
                console.log('💾 클라이언트 추가 필터링 후:', Object.keys(this.alerts).map(k => `${k}: ${this.alerts[k].length}개`).join(', '));
                
                // 🔊 초기 로드 시에는 소리 재생하지 않음 (이미 본 알림일 수 있음)
                const hasAlerts = Object.values(this.alerts).some(alertArray => alertArray.length > 0);
                if (hasAlerts) {
                    console.log('🔇 초기 로드: 기존 알림 있음 - 소리 재생 안 함');
                    // this.playInitialAlertSound(); // 비활성화
                }
            }
            
            this.renderProducts();
            this.updateSettingsUI();
        });

        // 상품 업데이트
        this.socket.on('products-updated', (data) => {
            console.log('상품 업데이트 수신:', data);
            this.currentProducts = data.products || [];
            this.renderProducts();
            this.updateLastUpdateTime();
            this.showToast('상품 목록이 업데이트되었습니다.', 'success');
        });

        // 새 알림
        this.socket.on('new-alerts', (data) => {
            console.log('새 알림 수신:', data);
            this.processNewAlerts(data.alerts);
        });

        // 카테고리별 알림
        this.socket.on('alerts-super', (data) => {
            this.alerts.super = data.alerts;
            const filteredAlerts = this.alerts.super.filter(alert => !this.isProductSeen(alert.productId));
            this.updateAlertSection('super', filteredAlerts);
            console.log(`🔥 초특가 알림 업데이트: ${data.alerts.length}개 -> 필터링후: ${filteredAlerts.length}개`);
        });

        this.socket.on('alerts-electronics', (data) => {
            this.alerts.electronics = data.alerts;
            const filteredAlerts = this.alerts.electronics.filter(alert => !this.isProductSeen(alert.productId));
            this.updateAlertSection('electronics', filteredAlerts);
            console.log(`🔧 가전/디지털 알림 업데이트: ${data.alerts.length}개 -> 필터링후: ${filteredAlerts.length}개`);
        });

        this.socket.on('alerts-best', (data) => {
            this.alerts.best = data.alerts;
            const filteredAlerts = this.alerts.best.filter(alert => !this.isProductSeen(alert.productId));
            this.updateAlertSection('best', filteredAlerts);
            console.log(`⭐ 베스트 딜 알림 업데이트: ${data.alerts.length}개 -> 필터링후: ${filteredAlerts.length}개`);
        });

        this.socket.on('alerts-keyword', (data) => {
            this.alerts.keyword = data.alerts;
            const filteredAlerts = this.alerts.keyword.filter(alert => !this.isProductSeen(alert.productId));
            this.updateAlertSection('keyword', filteredAlerts);
            console.log(`🔍 키워드 알림 업데이트: ${data.alerts.length}개 -> 필터링후: ${filteredAlerts.length}개`);
        });

        // 전체 알림 업데이트 (완전 교체)
        this.socket.on('alerts-updated', (data) => {
            console.log('🔄 전체 알림 업데이트 수신:', data);
            
            // 이전 알림 상태 저장 (새로운 알림 감지용)
            const previousAlerts = JSON.parse(JSON.stringify(this.alerts));
            
            // 전체 알림 상태를 서버에서 받은 것으로 완전 교체 (사용자별 필터링 적용)
            this.alerts = data.alerts;
            
            // 사용자별 필터링 적용
            this.filterAlertsForUser();
            
            // 새로운 알림이 있는지 확인하고 소리 재생
            this.checkAndPlaySoundForNewAlerts(previousAlerts, this.alerts);
            
            console.log('✅ 클라이언트 알림 상태 완전 동기화 완료');
        });

        // 브라우저 알림
        this.socket.on('browser-notification', (data) => {
            this.showBrowserNotification(data);
        });

        // 크롤링 완료
        this.socket.on('crawl-completed', () => {
            this.updateStatus('대기 중', 'green');
            this.showToast('크롤링이 완료되었습니다.', 'success');
        });

        // 크롤링 오류
        this.socket.on('crawl-error', (data) => {
            this.updateStatus('오류', 'red');
            this.showToast(`크롤링 오류: ${data.error}`, 'error');
        });

        // 연결 상태
        this.socket.on('connect', () => {
            console.log('서버에 연결되었습니다.');
            this.updateStatus('연결됨', 'green');
        });

        this.socket.on('disconnect', () => {
            console.log('서버와의 연결이 끊어졌습니다.');
            this.updateStatus('연결 끊김', 'red');
        });
    }

    // 🔧 개선된 이벤트 위임 설정 (문서 레벨에서 처리)
    setupAlertEventDelegation() {
        console.log('🔧 개선된 이벤트 위임 설정 중...');
        
        // 기존 이벤트 리스너 제거 (중복 방지)
        if (this.documentClickHandler) {
            document.removeEventListener('click', this.documentClickHandler);
        }
        
        // 문서 레벨에서 이벤트 위임 처리
        this.documentClickHandler = (e) => {
            const button = e.target.closest('.alert-action-btn');
            if (!button) return;
            
            e.preventDefault();
            e.stopPropagation();
            
            const action = button.dataset.action;
            const alertId = button.dataset.alertId;
            const productId = button.dataset.productId;
            
            console.log(`🔧 문서 레벨 이벤트 처리: ${action}, Alert ID: ${alertId}, Product ID: ${productId}`);
            
            switch (action) {
                case 'open':
                    this.openProduct(button.dataset.productUrl, productId);
                    break;
                case 'close':
                    this.closeAlert(alertId, productId);
                    break;
                case 'ban':
                    this.banProduct(productId, button.dataset.productTitle);
                    break;
            }
        };
        
        document.addEventListener('click', this.documentClickHandler);
        console.log('✅ 문서 레벨 이벤트 위임 설정 완료');
    }

    requestManualCrawl() {
        this.updateStatus('크롤링 중...', 'yellow');
        this.socket.emit('manual-crawl');
        
        // 버튼 비활성화
        const btn = document.getElementById('refreshBtn');
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>확인 중...';
        
        setTimeout(() => {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-sync-alt mr-2"></i>지금 확인';
        }, 5000);
    }

    processNewAlerts(alerts) {
        // 사용자별 필터링: 이미 본 상품의 알림 제외
        const filteredAlerts = alerts.filter(alert => !this.isProductSeen(alert.productId));
        
        filteredAlerts.forEach(alert => {
            // 알림 섹션 업데이트
            if (!this.alerts[alert.type]) {
                this.alerts[alert.type] = [];
            }
            this.alerts[alert.type].unshift(alert);
            
            // 최대 5개까지만 유지
            if (this.alerts[alert.type].length > 5) {
                this.alerts[alert.type] = this.alerts[alert.type].slice(0, 5);
            }
        });
        
        // 사용자별 필터링 적용 후 UI 업데이트
        this.filterAlertsForUser();
        
        // VB.NET처럼 각 알림 타입별 소리 재생 (우선순위 기반) - 필터링된 알림 기준
        if (filteredAlerts.length > 0) {
            // 우선순위가 가장 높은 알림의 소리 재생
            const priorityOrder = ['super', 'electronics', 'keyword', 'best'];
            for (const type of priorityOrder) {
                const typeAlerts = filteredAlerts.filter(alert => alert.type === type);
                if (typeAlerts.length > 0) {
                    // 해당 타입의 첫 번째 알림에서 소리 설정 가져오기
                    const soundInfo = typeAlerts[0].sound;
                    this.playAlertSoundWithRepeat(type, soundInfo);
                    break; // 가장 높은 우선순위 하나만 재생
                }
            }
        }
    }

    // 사용자별 알림 필터링
    filterAlertsForUser() {
        console.log(`👤 사용자별 알림 필터링 시작 (User ID: ${this.userId}, 읽은 상품: ${this.userSeenProducts.size}개)`);
        
        Object.keys(this.alerts).forEach(type => {
            const originalCount = this.alerts[type].length;
            const filteredAlerts = this.alerts[type].filter(alert => 
                !this.isProductSeen(alert.productId)
            );
            const filteredCount = filteredAlerts.length;
            
            if (originalCount > filteredCount) {
                console.log(`🚫 ${type} 알림 필터링: ${originalCount}개 -> ${filteredCount}개 (${originalCount - filteredCount}개 제외)`);
            }
            
            this.updateAlertSection(type, filteredAlerts);
        });
        
        console.log(`✅ 사용자별 알림 필터링 완료`);
    }

    updateAlertSection(type, alerts) {
        const sectionId = `${type}Alerts`;
        const section = document.getElementById(sectionId);
        
        if (!section) return;
        
        if (!alerts || alerts.length === 0) {
            section.innerHTML = '<p class="text-gray-500 text-center">알림 없음</p>';
            return;
        }
        
        // 할인률순으로 정렬 (높은순)
        const sortedAlerts = alerts.sort((a, b) => {
            return b.product.discountRate - a.product.discountRate;
        });
        
        const alertsHtml = sortedAlerts.map(alert => this.createAlertHTML(alert)).join('');
        section.innerHTML = alertsHtml;
    }

    createAlertHTML(alert) {
        const product = alert.product;
        const priceStr = new Intl.NumberFormat('ko-KR').format(product.price);
        
        return `
            <div class="alert-item border-b border-gray-200 pb-3 mb-3 last:border-b-0 last:pb-0 last:mb-0">
                <div class="flex items-start space-x-3">
                    <img src="${product.imageUrl}" alt="${product.title}" 
                         class="w-12 h-12 object-cover rounded flex-shrink-0"
                         onerror="this.src='/images/no-image.png'">
                    <div class="flex-1 min-w-0">
                        <h4 class="text-sm font-medium text-gray-900 truncate" title="${product.title}">
                            ${product.title}
                        </h4>
                        <div class="mt-1 flex items-center space-x-2">
                            <span class="text-lg font-bold text-red-600">${product.discountRate}%</span>
                            <span class="text-sm font-semibold">${priceStr}원</span>
                        </div>
                        <div class="mt-2 flex space-x-1">
                            ${product.isRocket ? '<span class="px-1 py-0.5 text-xs bg-blue-100 text-blue-600 rounded">로켓</span>' : ''}
                            ${product.isLowest ? '<span class="px-1 py-0.5 text-xs bg-green-100 text-green-600 rounded">최저가</span>' : ''}
                            ${product.isElectronic ? '<span class="px-1 py-0.5 text-xs bg-purple-100 text-purple-600 rounded">가전</span>' : ''}
                        </div>
                        <div class="mt-2 flex space-x-2">
                            <button data-action="open" data-product-url="${product.productUrl}" data-product-id="${product.id}" 
                                    class="alert-action-btn text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700">
                                보기
                            </button>
                            <button data-action="close" data-alert-id="${alert.id}" data-product-id="${product.id}" 
                                    class="alert-action-btn text-xs bg-gray-400 text-white px-2 py-1 rounded hover:bg-gray-500"
                                    title="Alert ID: ${alert.id}">
                                닫기
                            </button>
                            <button data-action="ban" data-product-id="${product.id}" data-product-title="${product.title}" 
                                    class="alert-action-btn text-xs bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600">
                                차단
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    renderProducts() {
        const container = document.getElementById('productsList');
        
        if (!this.currentProducts || this.currentProducts.length === 0) {
            container.innerHTML = `
                <div class="text-center py-12">
                    <i class="fas fa-shopping-cart text-gray-300 text-6xl mb-4"></i>
                    <p class="text-gray-500">상품이 없습니다.</p>
                </div>
            `;
            return;
        }
        
        // 필터링
        let filteredProducts = [...this.currentProducts];
        
        if (document.getElementById('rocketFilter').checked) {
            filteredProducts = filteredProducts.filter(p => p.isRocket);
        }
        
        // 정렬
        const sortType = document.getElementById('sortSelect').value;
        filteredProducts.sort((a, b) => {
            switch (sortType) {
                case 'discount-desc':
                    return b.discountRate - a.discountRate;
                case 'discount-asc':
                    return a.discountRate - b.discountRate;
                case 'price-asc':
                    return a.price - b.price;
                case 'price-desc':
                    return b.price - a.price;
                default:
                    return b.discountRate - a.discountRate;
            }
        });
        
        // 렌더링
        const productsHtml = filteredProducts.map(product => this.createProductHTML(product)).join('');
        container.innerHTML = `<div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">${productsHtml}</div>`;
        
        // 통계 업데이트
        document.getElementById('currentCount').textContent = filteredProducts.length;
    }

    createProductHTML(product) {
        const priceStr = new Intl.NumberFormat('ko-KR').format(product.price);
        const seenClass = product.seen ? 'opacity-60' : '';
        
        return `
            <div class="product-card bg-white rounded-lg shadow-md overflow-hidden ${seenClass}">
                <div class="relative">
                    <img src="${product.imageUrl}" alt="${product.title}" 
                         class="w-full h-48 object-cover"
                         onerror="this.src='/images/no-image.png'">
                    <div class="absolute top-2 left-2 flex flex-col space-y-1">
                        ${product.discountRate >= 49 ? '<span class="px-2 py-1 text-xs bg-red-500 text-white rounded font-bold">초특가</span>' : ''}
                        <span class="px-2 py-1 text-xs bg-red-600 text-white rounded font-bold">${product.discountRate}% 할인</span>
                    </div>
                    <div class="absolute top-2 right-2 flex flex-col space-y-1">
                        ${product.isRocket ? '<span class="px-2 py-1 text-xs bg-blue-500 text-white rounded">로켓배송</span>' : ''}
                        ${product.isLowest ? '<span class="px-2 py-1 text-xs bg-green-500 text-white rounded">최저가</span>' : ''}
                    </div>
                </div>
                <div class="p-4">
                    <h3 class="text-sm font-medium text-gray-900 mb-2 line-clamp-2" title="${product.title}">
                        ${product.title}
                    </h3>
                    <div class="flex justify-between items-center mb-3">
                        <span class="text-lg font-bold text-gray-900">${priceStr}원</span>
                        ${product.priceChanged?.changed ? 
                            `<span class="text-sm text-green-600">
                                <i class="fas fa-arrow-down"></i> 가격 인하
                            </span>` : ''
                        }
                    </div>
                    <div class="flex space-x-2">
                        <button onclick="app.openProduct('${product.productUrl}', '${product.id}')" 
                                class="flex-1 bg-blue-600 text-white py-2 px-3 rounded text-sm hover:bg-blue-700 transition-colors">
                            <i class="fas fa-external-link-alt mr-1"></i>보기
                        </button>
                        <button onclick="app.banProduct('${product.id}', '${product.title}')" 
                                class="bg-gray-400 text-white py-2 px-3 rounded text-sm hover:bg-gray-500 transition-colors">
                            <i class="fas fa-ban"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    openProduct(url, productId) {
        window.open(url, '_blank');
        
        // 유저별 읽은 상품으로 표시 (localStorage + 쿠키)
        this.markProductAsSeen(productId);
        
        // 서버에도 알림 (호환성 유지)
        this.socket.emit('mark-as-seen', productId);
        
        // UI에서 즉시 반영
        const productIndex = this.currentProducts.findIndex(p => p.id === productId);
        if (productIndex !== -1) {
            this.currentProducts[productIndex].seen = true;
            this.renderProducts();
        }
        
        // 알림 목록에서 해당 상품 제거 (즉시 반영)
        this.filterAlertsForUser();
    }

    banProduct(productId, title) {
        if (confirm(`"${title}" 상품을 차단하시겠습니까?`)) {
            this.socket.emit('ban-product', { id: productId, title: title });
            
            // UI에서 즉시 제거
            this.currentProducts = this.currentProducts.filter(p => p.id !== productId);
            this.renderProducts();
            
            this.showToast('상품이 차단되었습니다.', 'success');
        }
    }

    // 🔧 개선된 알림 닫기 처리
    closeAlert(alertId, productId) {
        console.log(`🔧 알림 닫기 처리: Alert ID: ${alertId}, Product ID: ${productId}, Session: ${this.sessionId}`);
        
        // 유저별 읽은 상품으로 표시 (localStorage + 쿠키)
        this.markProductAsSeen(productId);
        
        // 클라이언트 측에서 즉시 UI 업데이트
        this.closedAlerts.add(alertId);
        this.removeAlertFromUI(alertId);
        
        // 서버에 세션별 알림 닫기 요청
        this.socket.emit('close-alert', { 
            alertId, 
            productId, 
            sessionId: this.sessionId 
        });
        
        // 알림 목록에서 해당 상품 제거 (즉시 반영)
        this.filterAlertsForUser();
    }

    // UI에서 알림 제거
    removeAlertFromUI(alertId) {
        // 모든 알림 섹션에서 해당 알림 찾아서 제거
        Object.keys(this.alerts).forEach(type => {
            this.alerts[type] = this.alerts[type].filter(alert => alert.id !== alertId);
            this.updateAlertSection(type, this.alerts[type]);
        });
        
        console.log(`✅ UI에서 알림 제거됨: ${alertId}`);
    }

    openSettingsModal() {
        document.getElementById('settingsModal').classList.remove('hidden');
        this.updateSettingsUI();
    }

    closeSettingsModal() {
        document.getElementById('settingsModal').classList.add('hidden');
    }

    updateSettingsUI() {
        if (!this.currentSettings.general) return;
        
        document.getElementById('autoRefreshSetting').checked = this.currentSettings.general.autoRefresh || false;
        document.getElementById('refreshIntervalSetting').value = this.currentSettings.general.refreshInterval || 60;
        document.getElementById('rocketOnlySetting').checked = this.currentSettings.general.rocketOnly || false;
        
        if (this.currentSettings.notifications) {
            document.getElementById('browserNotificationsSetting').checked = this.currentSettings.notifications.browserNotifications || false;
            document.getElementById('notificationDurationSetting').value = this.currentSettings.notifications.notificationDuration || 5000;
            
            // 소리 반복재생 설정 UI 업데이트
            const soundRepeat = this.currentSettings.notifications.soundRepeat || {};
            
            // 초특가 알림
            const superRepeat = soundRepeat.super || { enabled: true, count: 3, interval: 1000 };
            document.getElementById('superSoundRepeatEnabled').checked = superRepeat.enabled;
            document.getElementById('superSoundRepeatCount').value = superRepeat.count;
            document.getElementById('superSoundRepeatInterval').value = superRepeat.interval;
            
            // 가전/디지털 알림
            const electronicsRepeat = soundRepeat.electronics || { enabled: true, count: 2, interval: 800 };
            document.getElementById('electronicsSoundRepeatEnabled').checked = electronicsRepeat.enabled;
            document.getElementById('electronicsSoundRepeatCount').value = electronicsRepeat.count;
            document.getElementById('electronicsSoundRepeatInterval').value = electronicsRepeat.interval;
            
            // 키워드 매칭 알림
            const keywordRepeat = soundRepeat.keyword || { enabled: true, count: 2, interval: 900 };
            document.getElementById('keywordSoundRepeatEnabled').checked = keywordRepeat.enabled;
            document.getElementById('keywordSoundRepeatCount').value = keywordRepeat.count;
            document.getElementById('keywordSoundRepeatInterval').value = keywordRepeat.interval;
            
            // 베스트 딜 알림
            const bestRepeat = soundRepeat.best || { enabled: false, count: 1, interval: 0 };
            document.getElementById('bestSoundRepeatEnabled').checked = bestRepeat.enabled;
            document.getElementById('bestSoundRepeatCount').value = bestRepeat.count;
            document.getElementById('bestSoundRepeatInterval').value = bestRepeat.interval;
        }
    }

    saveSettings() {
        const newSettings = {
            general: {
                autoRefresh: document.getElementById('autoRefreshSetting').checked,
                refreshInterval: parseInt(document.getElementById('refreshIntervalSetting').value),
                rocketOnly: document.getElementById('rocketOnlySetting').checked,
                minDiscountRate: this.currentSettings.general?.minDiscountRate || 20
            },
            notifications: {
                browserNotifications: document.getElementById('browserNotificationsSetting').checked,
                notificationDuration: parseInt(document.getElementById('notificationDurationSetting').value),
                sounds: this.currentSettings.notifications?.sounds || {
                    super: "super.wav",
                    electronics: "electronics.wav",
                    best: "best.wav",
                    keyword: "keyword.wav"
                },
                soundRepeat: {
                    super: {
                        enabled: document.getElementById('superSoundRepeatEnabled').checked,
                        count: parseInt(document.getElementById('superSoundRepeatCount').value),
                        interval: parseInt(document.getElementById('superSoundRepeatInterval').value)
                    },
                    electronics: {
                        enabled: document.getElementById('electronicsSoundRepeatEnabled').checked,
                        count: parseInt(document.getElementById('electronicsSoundRepeatCount').value),
                        interval: parseInt(document.getElementById('electronicsSoundRepeatInterval').value)
                    },
                    keyword: {
                        enabled: document.getElementById('keywordSoundRepeatEnabled').checked,
                        count: parseInt(document.getElementById('keywordSoundRepeatCount').value),
                        interval: parseInt(document.getElementById('keywordSoundRepeatInterval').value)
                    },
                    best: {
                        enabled: document.getElementById('bestSoundRepeatEnabled').checked,
                        count: parseInt(document.getElementById('bestSoundRepeatCount').value),
                        interval: parseInt(document.getElementById('bestSoundRepeatInterval').value)
                    }
                }
            },
            keywords: this.currentSettings.keywords || {},
            advanced: this.currentSettings.advanced || {}
        };
        
        this.socket.emit('update-settings', newSettings);
        this.currentSettings = newSettings;
        this.closeSettingsModal();
        this.showToast('설정이 저장되었습니다.', 'success');
    }

    resetSettings() {
        if (confirm('설정을 초기화하시겠습니까?')) {
            fetch('/api/settings/reset', { method: 'POST' })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        this.currentSettings = data.data;
                        this.updateSettingsUI();
                        this.showToast('설정이 초기화되었습니다.', 'success');
                    }
                });
        }
    }

    // 확인된 상품 기록 초기화
    clearViewedProducts() {
        if (confirm('모든 확인된 상품 기록을 초기화하시겠습니까?\n(상품들이 다시 "새로운" 상태로 표시됩니다)')) {
            fetch('/api/viewed-products', { method: 'DELETE' })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        this.showToast('확인된 상품 기록이 초기화되었습니다.', 'success');
                        // 즉시 재크롤링하여 변경사항 확인
                        setTimeout(() => {
                            this.requestManualCrawl();
                        }, 1000);
                    } else {
                        this.showToast('초기화에 실패했습니다.', 'error');
                    }
                })
                .catch(error => {
                    console.error('초기화 오류:', error);
                    this.showToast('초기화 중 오류가 발생했습니다.', 'error');
                });
        }
    }

    // 차단된 상품 목록 초기화
    clearBannedProducts() {
        if (confirm('모든 차단된 상품을 해제하시겠습니까?\n(차단된 상품들이 다시 표시됩니다)')) {
            fetch('/api/banned-products', { method: 'DELETE' })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        this.showToast('차단 상품 목록이 초기화되었습니다.', 'success');
                        // 즉시 재크롤링하여 변경사항 확인
                        setTimeout(() => {
                            this.requestManualCrawl();
                        }, 1000);
                    } else {
                        this.showToast('초기화에 실패했습니다.', 'error');
                    }
                })
                .catch(error => {
                    console.error('초기화 오류:', error);
                    this.showToast('초기화 중 오류가 발생했습니다.', 'error');
                });
        }
    }

    // 전체 데이터 초기화
    resetAllData() {
        if (confirm('⚠️ 전체 데이터를 초기화하시겠습니까?\n\n다음 데이터가 모두 삭제됩니다:\n- 확인된 상품 기록\n- 차단된 상품 목록\n- 가격 기록\n- 현재 상품 목록\n\n초기화 후 자동으로 재크롤링됩니다.')) {
            // 로딩 상태 표시
            this.updateStatus('전체 데이터 초기화 중...', 'yellow');
            this.showToast('전체 데이터를 초기화하고 있습니다...', 'info');
            
            fetch('/api/data/reset', { method: 'DELETE' })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        this.showToast('전체 데이터가 초기화되었습니다. 재크롤링을 시작합니다.', 'success');
                        
                        // 로컬 데이터도 초기화
                        this.currentProducts = [];
                        this.alerts = {
                            super: [],
                            electronics: [],
                            best: [],
                            keyword: []
                        };
                        
                        // UI 초기화
                        this.renderProducts();
                        Object.keys(this.alerts).forEach(type => {
                            this.updateAlertSection(type, []);
                        });
                        
                        // 2초 후 자동 재크롤링
                        setTimeout(() => {
                            this.updateStatus('재크롤링 중...', 'yellow');
                            this.requestManualCrawl();
                        }, 2000);
                        
                    } else {
                        this.showToast('전체 초기화에 실패했습니다.', 'error');
                        this.updateStatus('오류', 'red');
                    }
                })
                .catch(error => {
                    console.error('전체 초기화 오류:', error);
                    this.showToast('전체 초기화 중 오류가 발생했습니다.', 'error');
                    this.updateStatus('오류', 'red');
                });
        }
    }

    updateStatus(text, color) {
        const statusText = document.getElementById('statusText');
        const statusIndicator = document.getElementById('statusIndicator');
        
        statusText.textContent = text;
        
        statusIndicator.className = `w-3 h-3 rounded-full mr-2 ${
            color === 'green' ? 'bg-green-500' :
            color === 'yellow' ? 'bg-yellow-500' :
            color === 'red' ? 'bg-red-500' :
            'bg-gray-400'
        }`;
        
        if (color === 'yellow') {
            statusIndicator.classList.add('blink');
        } else {
            statusIndicator.classList.remove('blink');
        }
    }

    updateStats(stats) {
        document.getElementById('viewedCount').textContent = stats.viewedProductsCount || 0;
        document.getElementById('bannedCount').textContent = stats.bannedProductsCount || 0;
        document.getElementById('currentCount').textContent = stats.currentProductsCount || 0;
    }

    updateLastUpdateTime() {
        const now = new Date();
        const timeStr = now.toLocaleString('ko-KR');
        document.getElementById('lastUpdate').textContent = timeStr;
    }

    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `
            toast p-4 rounded-lg shadow-lg text-white max-w-sm
            ${type === 'success' ? 'bg-green-500' :
              type === 'error' ? 'bg-red-500' :
              type === 'warning' ? 'bg-yellow-500' :
              'bg-blue-500'}
        `;
        toast.textContent = message;
        
        const container = document.getElementById('toastContainer');
        container.appendChild(toast);
        
        // 자동 제거
        setTimeout(() => {
            toast.remove();
        }, 5000);
    }

    requestNotificationPermission() {
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }

    showBrowserNotification(data) {
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(data.title, {
                body: data.body,
                icon: data.icon || '/favicon.ico',
                badge: data.badge,
                requireInteraction: data.requireInteraction,
                silent: data.silent
            });
        }
    }

    checkAndPlaySoundForNewAlerts(previousAlerts, currentAlerts) {
        // 각 카테고리별로 새로운 알림 찾기
        const newAlerts = [];
        
        Object.keys(currentAlerts).forEach(type => {
            const prevTypeAlerts = previousAlerts[type] || [];
            const currTypeAlerts = currentAlerts[type] || [];
            
            // 현재 카테고리에서 새로 추가된 알림들 찾기
            currTypeAlerts.forEach(alert => {
                const isNewAlert = !prevTypeAlerts.some(prevAlert => prevAlert.id === alert.id);
                if (isNewAlert) {
                    newAlerts.push({ ...alert, type: type });
                }
            });
        });
        
        // 새로운 알림이 있으면 소리 재생
        if (newAlerts.length > 0) {
            console.log(`🔊 새로운 알림 ${newAlerts.length}개 감지 - 소리 재생`);
            
            // Web Audio Context 상태 확인 및 활성화
            if (this.audioContext && this.audioContext.state === 'suspended') {
                console.log('🔊 Audio Context가 일시중단됨 - 활성화 시도');
                this.audioContext.resume().then(() => {
                    console.log('🔊 Audio Context 활성화 성공');
                    this.playNewAlertsSound(newAlerts);
                }).catch(error => {
                    console.warn('🔊 Audio Context 활성화 실패:', error);
                });
            } else {
                this.playNewAlertsSound(newAlerts);
            }
        }
    }

    playNewAlertsSound(newAlerts) {
        // 우선순위가 가장 높은 알림의 소리 재생 (VB.NET 방식과 동일)
        const priorityOrder = ['super', 'electronics', 'keyword', 'best'];
        for (const type of priorityOrder) {
            const typeAlerts = newAlerts.filter(alert => alert.type === type);
            if (typeAlerts.length > 0) {
                // 해당 타입의 첫 번째 알림에서 소리 설정 가져오기
                const soundInfo = typeAlerts[0].sound;
                console.log(`🔊 ${type} 타입 알림 소리 재생 시작`);
                this.playAlertSoundWithRepeat(type, soundInfo);
                break; // 가장 높은 우선순위 하나만 재생
            }
        }
    }

    playInitialAlertSound() {
        // 우선순위에 따라 가장 높은 알림 타입의 소리 재생
        const priorityOrder = ['super', 'electronics', 'keyword', 'best'];
        
        for (const type of priorityOrder) {
            if (this.alerts[type] && this.alerts[type].length > 0) {
                console.log(`🔊 초기 알림 소리 재생: ${type} (${this.alerts[type].length}개 알림)`);
                
                // 해당 타입의 첫 번째 알림에서 소리 설정 가져오기
                const firstAlert = this.alerts[type][0];
                const soundInfo = firstAlert.sound || { repeat: { enabled: true, count: 1, interval: 1000 } };
                
                // 사용자 상호작용 후 소리 재생을 위해 클릭 이벤트 리스너 추가
                this.enableSoundOnFirstInteraction(() => {
                    this.playAlertSoundWithRepeat(type, soundInfo);
                });
                
                break; // 가장 높은 우선순위 하나만 재생
            }
        }
    }

    // 사용자 첫 상호작용 시 소리 활성화
    enableSoundOnFirstInteraction(callback) {
        const enableAudio = () => {
            if (this.audioContext && this.audioContext.state === 'suspended') {
                this.audioContext.resume().then(() => {
                    console.log('🔊 Audio Context 활성화됨');
                    callback();
                });
            } else {
                callback();
            }
            
            // 이벤트 리스너 제거 (한 번만 실행)
            document.removeEventListener('click', enableAudio);
            document.removeEventListener('keydown', enableAudio);
        };
        
        // 사용자의 첫 번째 클릭이나 키보드 입력을 기다림
        document.addEventListener('click', enableAudio, { once: true });
        document.addEventListener('keydown', enableAudio, { once: true });
        
        console.log('🔊 사용자 상호작용을 기다리는 중... (클릭 또는 키보드 입력)');
    }
}

// 앱 초기화
const app = new FallcentAlertApp();

// 전역에서 접근 가능하도록 설정
window.app = app; 