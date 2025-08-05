class AlertService {
    constructor(io, storageService) {
        this.io = io;
        this.storageService = storageService;
        this.sessionAlertService = null; // app.js에서 주입됨
        this.SUPER_DISCOUNT_THRESHOLD = 49; // 49%로 설정
    }

    setSessionAlertService(sessionAlertService) {
        this.sessionAlertService = sessionAlertService;
    }

    processProducts(products) {
        const alerts = [];
        const settings = this.storageService.getSettings();
        
        try {
            // 로켓배송 필터링 적용
            let filteredProducts = products;
            if (settings.general?.rocketOnly) {
                filteredProducts = products.filter(p => p.isRocket);
            }
            
            // 최소 할인율 필터링
            const minDiscountRate = settings.general?.minDiscountRate || 20;
            filteredProducts = filteredProducts.filter(p => p.discountRate >= minDiscountRate);
            
            // 알림 대상 상품 필터링 (새 상품 + 가격 인하 상품)
            const newProducts = filteredProducts.filter(p => !p.seen);
            const priceChangedProducts = filteredProducts.filter(p => p.priceChanged?.changed && p.priceChanged.isDecrease);
            const alertProducts = [...newProducts, ...priceChangedProducts];
            
            console.log(`🔎 알림 대상 상품: 새 상품 ${newProducts.length}개, 가격 인하 ${priceChangedProducts.length}개`);
            
            // 중복 제거 (상품 ID 기준)
            const uniqueAlertProducts = this.removeDuplicateProducts(alertProducts);
            
            // 각 상품에 대해 우선순위가 가장 높은 카테고리로만 알림 생성 (중복 방지)
            // ✅ 먼저 모든 알림을 생성만 하고 저장은 하지 않음
            console.log(`🔄 알림 생성 시작: ${uniqueAlertProducts.length}개 상품 검사`);
            for (const product of uniqueAlertProducts) {
                const alert = this.createBestAlert(product, settings);
                if (alert) {
                    alerts.push(alert);
                    console.log(`✅ 알림 추가됨: ${alert.type} - ${product.title.substring(0, 30)}...`);
                } else {
                    console.log(`❌ 알림 생성 실패: ${product.title.substring(0, 30)}...`);
                }
            }
            
            // ✅ 우선순위별 정렬 (할인율 우선)
            const prioritizedAlerts = this.prioritizeAlerts(alerts);
            
            // ✅ 카테고리별로 제한 (각 카테고리 최대 5개)
            const limitedAlerts = this.limitAlertsByCategory(prioritizedAlerts);
            
            // ✅ 정렬된 순서대로 활성 알림 DB에 저장
            for (const alert of limitedAlerts) {
                this.storageService.addActiveAlert(alert.type, alert);
                console.log(`💾 활성 알림 저장: ${alert.type} - ${alert.product.title.substring(0, 30)}...`);
            }
            
            // 🔇 사운드용 이벤트는 비활성화 (alerts-updated에서 처리)
            // if (limitedAlerts.length > 0) {
            //     this.sendNewAlertsForSound(limitedAlerts);
            // }
            
            // 기존 알림과 새 알림을 합쳐서 클라이언트에게 전송
            this.sendAllAlertsToClients();
            
            // 현재 상품 저장
            this.storageService.updateCurrentProducts(filteredProducts);
            
            console.log(`✅ 알림 처리 완료: ${limitedAlerts.length}개 새 알림 생성`);
            console.log(`📊 현재 활성 알림 총계:`, Object.keys(this.storageService.getActiveAlerts()).map(type => {
                const alerts = this.storageService.getActiveAlerts()[type];
                return `${type}: ${alerts.length}개`;
            }).join(', '));
            
            return limitedAlerts;
            
        } catch (error) {
            console.error('상품 처리 중 오류:', error);
            return [];
        }
    }

    createBestAlert(product, settings) {
        // 상품에 대해 가능한 모든 카테고리 확인하고 우선순위가 가장 높은 것 선택
        const possibleAlerts = [];
        
        console.log(`🔍 알림 생성 검사: ${product.title.substring(0, 30)}... (할인율: ${product.discountRate}%, seen: ${product.seen}, priceChanged: ${product.priceChanged?.changed})`);
        
        // 초특가 확인
        if (product.discountRate >= this.SUPER_DISCOUNT_THRESHOLD) {
            console.log(`✅ 초특가 조건 충족: ${product.discountRate}% >= ${this.SUPER_DISCOUNT_THRESHOLD}%`);
            possibleAlerts.push({
                type: 'super',
                category: '초특가',
                priority: 100 + Math.floor(product.discountRate / 10)
            });
        } else {
            console.log(`❌ 초특가 조건 미충족: ${product.discountRate}% < ${this.SUPER_DISCOUNT_THRESHOLD}%`);
        }
        
        // 전자제품 확인
        if (product.isElectronic) {
            possibleAlerts.push({
                type: 'electronics', 
                category: '가전/디지털',
                priority: 80 + Math.floor(product.discountRate / 10)
            });
        }
        
        // 키워드 매칭 확인
        if (product.isKeywordMatch) {
            const keywordPriority = product.keywordInfo?.priority === 'high' ? 20 : 
                                   product.keywordInfo?.priority === 'medium' ? 10 : 0;
            possibleAlerts.push({
                type: 'keyword',
                category: '키워드 매칭', 
                priority: 70 + keywordPriority + Math.floor(product.discountRate / 10)
            });
        }
        
        // 베스트 딜 확인 (20% 이상 할인)
        if (product.discountRate >= 20) {
            possibleAlerts.push({
                type: 'best',
                category: '베스트 딜',
                priority: 60 + Math.floor(product.discountRate / 10)
            });
        }
        
        // 우선순위가 가장 높은 카테고리 선택
        if (possibleAlerts.length === 0) {
            console.log(`⚠️ 가능한 알림 카테고리 없음: ${product.title.substring(0, 30)}...`);
            return null;
        }
        
        console.log(`📊 가능한 알림 카테고리: ${possibleAlerts.map(a => `${a.type}(${a.priority})`).join(', ')}`);
        const bestAlert = possibleAlerts.sort((a, b) => b.priority - a.priority)[0];
        console.log(`🎯 선택된 카테고리: ${bestAlert.type} (우선순위: ${bestAlert.priority})`);
        
        // 추가 우선순위 계산
        let finalPriority = bestAlert.priority;
        
        // 가격 변동에 따른 추가 우선순위
        if (product.priceChanged?.changed && product.priceChanged.isDecrease) {
            finalPriority += 15;
        }
        
        // 로켓배송 추가 우선순위
        if (product.isRocket) {
            finalPriority += 5;
        }
        
        // 최저가 추가 우선순위
        if (product.isLowest) {
            finalPriority += 5;
        }

        // 소리 정보 생성
        const soundInfo = this.getAlertSound(bestAlert.type, settings);
        
        // 고유한 알림 ID 생성 
        const alertId = `${bestAlert.type}_${product.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        console.log(`🔔 알림 생성: ${bestAlert.category} - ${product.title.substring(0, 30)}... (${product.discountRate}%)`);
        console.log(`🆔 생성된 알림 ID: ${alertId}`);
        console.log(`🔊 소리 설정:`, JSON.stringify(soundInfo));
        
        return {
            id: alertId,
            productId: product.id,
            type: bestAlert.type,
            category: bestAlert.category,
            product: product,
            priority: finalPriority,
            sound: soundInfo,
            timestamp: new Date(),
            duration: settings.notifications?.notificationDuration || 5000
        };
    }

    limitAlertsByCategory(alerts) {
        const categoryLimits = {
            super: 5,
            electronics: 5,
            keyword: 5,
            best: 5
        };
        
        const categoryCounts = {};
        const limitedAlerts = [];
        
        for (const alert of alerts) {
            const category = alert.type;
            const currentCount = categoryCounts[category] || 0;
            const limit = categoryLimits[category] || 5;
            
            if (currentCount < limit) {
                limitedAlerts.push(alert);
                categoryCounts[category] = currentCount + 1;
            }
        }
        
        return limitedAlerts;
    }

    removeDuplicateProducts(products) {
        const seen = new Map();
        const unique = [];
        
        for (const product of products) {
            if (!seen.has(product.id)) {
                seen.set(product.id, true);
                unique.push(product);
            }
        }
        
        return unique;
    }

    getAlertSound(alertType, settings) {
        const sounds = settings.notifications?.sounds || {};
        const soundRepeat = settings.notifications?.soundRepeat || {};
        
        const soundInfo = {
            file: sounds[alertType] || `${alertType}.wav`,
            repeat: soundRepeat[alertType] || { enabled: false, count: 1, interval: 0 }
        };
        
        return soundInfo;
    }

    prioritizeAlerts(alerts) {
        // 할인율과 우선순위로 정렬 (할인율을 더 우선시)
        return alerts.sort((a, b) => {
            // 1차: 할인율 높은순
            if (a.product.discountRate !== b.product.discountRate) {
                return b.product.discountRate - a.product.discountRate;
            }
            // 2차: 우선순위 높은순
            if (a.priority !== b.priority) {
                return b.priority - a.priority;
            }
            // 3차: 최신순
            return new Date(b.timestamp) - new Date(a.timestamp);
        });
    }

    sendAllAlertsToClients() {
        // StorageService에서 활성 알림 가져오기
        const activeAlerts = this.storageService.getActiveAlerts();
        
        console.log('🔄 모든 클라이언트에게 사용자별 알림 전송 중...');
        console.log('📊 현재 활성 알림 상태:', Object.keys(activeAlerts).map(type => 
            `${type}: ${activeAlerts[type].length}개`
        ).join(', '));
        
        // 각 연결된 클라이언트에게 사용자별 + 세션별 알림 전송
        const sockets = this.io.sockets.sockets;
        let clientCount = 0;
        
        sockets.forEach((socket) => {
            if (socket.sessionId) {
                clientCount++;
                console.log(`👤 클라이언트 ${socket.id} - 사용자 읽은 상품: ${socket.userSeenProducts?.size || 0}개`);
                
                // 사용자별 알림 필터링
                const userFilteredAlerts = this.filterAlertsForUser(activeAlerts, socket.userSeenProducts || new Set());
                
                console.log(`📊 필터링 후:`, Object.keys(userFilteredAlerts).map(type => 
                    `${type}: ${userFilteredAlerts[type].length}개`
                ).join(', '));
                
                // 세션별 알림 업데이트
                if (this.sessionAlertService) {
                    this.sessionAlertService.updateSession(socket.sessionId, userFilteredAlerts);
                    const sessionAlerts = this.sessionAlertService.getSessionAlerts(socket.sessionId);
                    
                    socket.emit('alerts-updated', {
                        alerts: sessionAlerts,
                        timestamp: new Date(),
                        replace: true
                    });
                    
                    console.log(`✅ 클라이언트 ${socket.id} - 필터링된 알림 전송 완료`);
                }
            }
        });
        
        console.log(`✅ 총 ${clientCount}명의 클라이언트에게 사용자별 + 세션별 알림을 전송했습니다.`);
    }

    // 사용자별 알림 필터링 메서드
    filterAlertsForUser(globalAlerts, userSeenProducts) {
        const filteredAlerts = {
            super: [],
            electronics: [],
            best: [],
            keyword: []
        };
        
        Object.keys(globalAlerts).forEach(type => {
            filteredAlerts[type] = globalAlerts[type].filter(alert => 
                !userSeenProducts.has(alert.productId)
            );
        });
        
        return filteredAlerts;
    }

    groupAlertsByCategory(alerts) {
        const grouped = {};
        
        alerts.forEach(alert => {
            const category = alert.type;
            if (!grouped[category]) {
                grouped[category] = [];
            }
            grouped[category].push(alert);
        });
        
        return grouped;
    }

    sendBrowserNotifications(alerts) {
        // 최고 우선순위 알림만 브라우저 알림으로 전송
        const topAlert = alerts[0];
        if (!topAlert) return;
        
        const notificationData = {
            title: `🔥 ${topAlert.category} 알림`,
            body: `${topAlert.product.title} - ${topAlert.product.discountRate}% 할인`,
            icon: '/images/icon-notification.png',
            badge: '/images/badge-notification.png',
            data: {
                productId: topAlert.productId,
                productUrl: topAlert.product.productUrl,
                alertType: topAlert.type
            },
            requireInteraction: true,
            silent: false
        };
        
        this.io.emit('browser-notification', notificationData);
    }

    // 실시간 알림 상태 관리
    handleAlertInteraction(alertId, action, clientId) {
        console.log(`알림 상호작용: ${alertId} - ${action} (클라이언트: ${clientId})`);
        
        // 다른 클라이언트들에게 알림 상태 변경 전송
        this.io.emit('alert-interaction', {
            alertId: alertId,
            action: action,
            clientId: clientId,
            timestamp: new Date()
        });
    }

    // 알림 제거 및 새 알림 충원
    removeAlert(alertId) {
        console.log(`🔍 알림 제거 요청: ${alertId}`);
        
        // 제거 전 현재 상태 로그
        const activeAlerts = this.storageService.getActiveAlerts();
        console.log('📋 제거 전 알림 상태:', Object.keys(activeAlerts).map(type => 
            `${type}: [${activeAlerts[type].map(a => a.id).join(', ')}]`
        ).join(' | '));
        
        const removed = this.storageService.removeActiveAlert(alertId);
        
        if (removed) {
            console.log(`✅ 알림 제거 성공: ${alertId}`);
            
            // 제거 후 상태 확인
            const updatedAlerts = this.storageService.getActiveAlerts();
            console.log('📋 제거 후 알림 상태:', Object.keys(updatedAlerts).map(type => 
                `${type}: [${updatedAlerts[type].map(a => a.id).join(', ')}]`
            ).join(' | '));
            
            // 알림이 제거된 카테고리에 새로운 알림 충원
            this.replenishAlerts();
            
            // 업데이트된 알림 전송
            this.sendAllAlertsToClients();
        } else {
            console.log(`❌ 알림 제거 실패: ${alertId} (알림을 찾을 수 없음)`);
        }
        
        return removed;
    }

    // 상품 확인 시 알림 제거 및 충원
    markProductAsSeen(productId) {
        this.storageService.markProductAsSeen(productId);
        const removed = this.storageService.removeActiveAlertByProductId(productId);
        
        if (removed) {
            console.log(`📤 상품 확인으로 알림 제거됨: ${productId}`);
            
            // 새로운 알림 충원
            this.replenishAlerts();
            
            // 업데이트된 알림 전송  
            this.sendAllAlertsToClients();
        }
    }

    // 알림 충원 (각 카테고리에 빈 자리 채우기)
    replenishAlerts() {
        const activeAlerts = this.storageService.getActiveAlerts();
        const settings = this.storageService.getSettings();
        
        Object.keys(activeAlerts).forEach(alertType => {
            const currentAlerts = activeAlerts[alertType];
            const maxAlerts = 5; // 카테고리별 최대 알림 수
            
            if (currentAlerts.length < maxAlerts) {
                const needed = maxAlerts - currentAlerts.length;
                const currentProductIds = currentAlerts.map(alert => alert.productId);
                
                // 다음으로 좋은 상품들 찾기
                for (let i = 0; i < needed; i++) {
                    const nextProduct = this.storageService.getNextBestAlert(alertType, currentProductIds);
                    
                    if (nextProduct) {
                        const newAlert = this.createBestAlert(nextProduct, settings);
                        if (newAlert) {
                            this.storageService.addActiveAlert(alertType, newAlert);
                            currentProductIds.push(nextProduct.id);
                            console.log(`🔄 새 알림 충원: ${alertType} - ${nextProduct.title.substring(0, 30)}...`);
                        }
                    } else {
                        break; // 더 이상 추가할 상품이 없음
                    }
                }
            }
        });
    }

    // 초기 로드 시 기존 알림 전송
    sendInitialAlerts(socketId = null) {
        if (socketId) {
            // 특정 클라이언트에게만 전송
            this.io.to(socketId).emit('initial-alerts', {
                alerts: this.storageService.getActiveAlerts(),
                timestamp: new Date()
            });
        } else {
            // 모든 클라이언트에게 전송
            this.sendAllAlertsToClients();
        }
    }

    // 특정 상품 알림 제거
    removeProductAlerts(productId) {
        this.io.emit('remove-product-alerts', {
            productId: productId,
            timestamp: new Date()
        });
    }

    // 모든 알림 제거
    clearAllAlerts() {
        this.io.emit('clear-all-alerts', {
            timestamp: new Date()
        });
    }

    // 알림 통계
    getAlertStats() {
        return {
            totalAlertsSent: this.totalAlertsSent || 0,
            alertsByType: this.alertsByType || {},
            lastAlertTime: this.lastAlertTime || null
        };
    }

    // 테스트 알림 전송
    sendTestAlert(alertType = 'test') {
        const testProduct = {
            id: `test_${Date.now()}`,
            title: '테스트 상품 - 초특가 할인',
            price: 29900,
            discountRate: 70,
            imageUrl: '/images/test-product.jpg',
            productUrl: 'https://fallcent.com',
            isElectronic: false,
            isSuperDeal: true,
            isRocket: true,
            isLowest: true,
            isKeywordMatch: false,
            timestamp: new Date()
        };
        
        const testAlert = this.createBestAlert(testProduct, this.storageService.getSettings());
        
        this.io.emit('test-alert', testAlert);
        
        console.log('테스트 알림을 전송했습니다.');
        return testAlert;
    }

    // 🔊 새로운 알림을 사운드 재생용으로 전송 (사용자별 필터링 적용)
    sendNewAlertsForSound(newAlerts) {
        if (newAlerts.length === 0) return;
        
        console.log(`🔊 새 알림 사운드 재생용 이벤트 전송 준비: ${newAlerts.length}개`);
        
        // 각 소켓별로 사용자별 필터링 적용
        const sockets = this.io.sockets.sockets;
        let totalSent = 0;
        
        sockets.forEach((socket) => {
            // 🔧 소켓에 사용자 읽은 상품 정보가 없으면 스킵
            if (!socket.userSeenProducts) {
                console.log(`⚠️ 사용자 ${socket.id}의 읽은 상품 정보가 없음 - 스킵`);
                return;
            }
            
            console.log(`👤 사용자 ${socket.id} 읽은 상품: ${socket.userSeenProducts.size}개`);
            
            // 사용자별 필터링 - 더 엄격하게 검사
            const userFilteredAlerts = newAlerts.filter(alert => {
                const isSeen = socket.userSeenProducts.has(alert.productId);
                if (isSeen) {
                    console.log(`🔇 사용자 ${socket.id}는 이미 본 상품: ${alert.productId} - ${alert.product?.title?.substring(0, 30)}...`);
                    return false;
                }
                
                // 추가 검증: 글로벌 읽은 상품도 확인
                const isGloballySeen = this.storageService.isProductSeen(alert.productId);
                if (isGloballySeen) {
                    console.log(`🔇 글로벌로 읽은 상품: ${alert.productId} - 사용자별에도 추가`);
                    socket.userSeenProducts.add(alert.productId);
                    return false;
                }
                
                return true;
            });
            
            // 필터링된 알림이 있는 경우에만 전송
            if (userFilteredAlerts.length > 0) {
                console.log(`🔊 사용자 ${socket.id}에게 ${userFilteredAlerts.length}개 알림 전송`);
                
                socket.emit('new-alerts', {
                    alerts: userFilteredAlerts,
                    timestamp: new Date(),
                    count: userFilteredAlerts.length
                });
                
                totalSent++;
            } else {
                console.log(`🔇 사용자 ${socket.id}는 모든 알림이 이미 본 상품`);
            }
        });
        
        console.log(`🔊 총 ${totalSent}명의 사용자에게 새 알림 사운드 재생용 이벤트를 전송했습니다.`);
    }
}

module.exports = AlertService; 