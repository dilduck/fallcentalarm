class SessionAlertService {
    constructor(storageService) {
        // 세션별 알림 상태 저장
        this.sessionAlerts = new Map(); // sessionId -> 알림 상태
        this.sessionClosedAlerts = new Map(); // sessionId -> Set(닫힌 알림 ID들)
        this.storageService = storageService; // 글로벌 읽은 상품 상태 확인용
    }

    // 세션 초기화 (이미 사용자별 필터링된 알림 받음)
    initSession(sessionId, userFilteredAlerts) {
        console.log(`🔧 세션 초기화: ${sessionId}`);
        
        if (!this.sessionClosedAlerts.has(sessionId)) {
            this.sessionClosedAlerts.set(sessionId, new Set());
        }
        
        // 이미 사용자별 필터링된 알림을 세션별로 추가 필터링 (닫힌 알림만 제외)
        const sessionAlerts = this.filterAlertsForSession(sessionId, userFilteredAlerts);
        this.sessionAlerts.set(sessionId, sessionAlerts);
        
        console.log(`✅ 세션 ${sessionId} 초기화 완료:`, Object.keys(sessionAlerts).map(type => 
            `${type}: ${sessionAlerts[type].length}개`
        ).join(', '));
        
        return sessionAlerts;
    }

    // 세션에서 알림 닫기
    closeAlertInSession(sessionId, alertId) {
        console.log(`🔧 세션별 알림 닫기: ${sessionId} -> ${alertId}`);
        
        if (!this.sessionClosedAlerts.has(sessionId)) {
            this.sessionClosedAlerts.set(sessionId, new Set());
        }
        
        // 닫힌 알림 목록에 추가
        this.sessionClosedAlerts.get(sessionId).add(alertId);
        
        // 세션 알림에서 제거
        if (this.sessionAlerts.has(sessionId)) {
            const sessionAlerts = this.sessionAlerts.get(sessionId);
            Object.keys(sessionAlerts).forEach(type => {
                sessionAlerts[type] = sessionAlerts[type].filter(alert => alert.id !== alertId);
            });
        }
        
        console.log(`✅ 세션 ${sessionId}에서 알림 ${alertId} 닫기 완료`);
    }

    // 모든 세션의 알림 업데이트
    updateAllSessions(globalAlerts) {
        console.log('🔄 모든 세션 알림 업데이트 중...');
        
        for (const [sessionId, sessionData] of this.sessionAlerts.entries()) {
            const filteredAlerts = this.filterAlertsForSession(sessionId, globalAlerts);
            this.sessionAlerts.set(sessionId, filteredAlerts);
        }
        
        console.log(`✅ ${this.sessionAlerts.size}개 세션 알림 업데이트 완료`);
    }

    // 특정 세션의 알림 업데이트
    updateSession(sessionId, userFilteredAlerts) {
        console.log(`🔄 세션 ${sessionId} 알림 업데이트 중...`);
        
        // 이미 사용자별 필터링된 알림을 세션별로 추가 필터링
        const sessionFilteredAlerts = this.filterAlertsForSession(sessionId, userFilteredAlerts);
        this.sessionAlerts.set(sessionId, sessionFilteredAlerts);
        
        console.log(`✅ 세션 ${sessionId} 알림 업데이트 완료`);
    }

    // 특정 세션의 알림 가져오기
    getSessionAlerts(sessionId) {
        return this.sessionAlerts.get(sessionId) || {
            super: [],
            electronics: [],
            best: [],
            keyword: []
        };
    }

    // 세션별로 알림 필터링 (닫힌 알림만 제외, 사용자별 필터링은 이미 적용됨)
    filterAlertsForSession(sessionId, userFilteredAlerts) {
        const closedAlerts = this.sessionClosedAlerts.get(sessionId) || new Set();
        const sessionAlerts = {
            super: [],
            electronics: [],
            best: [],
            keyword: []
        };
        
        let totalFiltered = 0;
        
        Object.keys(userFilteredAlerts).forEach(type => {
            const originalCount = userFilteredAlerts[type].length;
            
            sessionAlerts[type] = userFilteredAlerts[type].filter(alert => {
                // 세션별 닫힌 알림만 제외 (사용자별 필터링은 이미 적용됨)
                if (closedAlerts.has(alert.id)) {
                    totalFiltered++;
                    return false;
                }
                
                return true;
            });
            
            if (originalCount > sessionAlerts[type].length) {
                console.log(`📋 ${type} 세션 알림 필터링: ${originalCount}개 → ${sessionAlerts[type].length}개`);
            }
        });
        
        console.log(`🔍 세션 ${sessionId} 필터링 결과: 총 ${totalFiltered}개 닫힌 알림 제외됨`);
        
        return sessionAlerts;
    }

    // 세션 정리 (연결 해제 시)
    cleanupSession(sessionId) {
        console.log(`🧹 세션 정리: ${sessionId}`);
        this.sessionAlerts.delete(sessionId);
        // 닫힌 알림 정보는 유지 (재연결 시 복원용)
    }
    
    // 세션별 닫힌 알림 초기화
    resetSessionClosedAlerts(sessionId) {
        console.log(`🔄 세션 ${sessionId}의 닫힌 알림 목록 초기화`);
        
        if (this.sessionClosedAlerts.has(sessionId)) {
            const previousSize = this.sessionClosedAlerts.get(sessionId).size;
            this.sessionClosedAlerts.set(sessionId, new Set());
            console.log(`✅ 세션 ${sessionId}에서 ${previousSize}개의 닫힌 알림이 초기화됨`);
        } else {
            this.sessionClosedAlerts.set(sessionId, new Set());
            console.log(`✅ 세션 ${sessionId}의 닫힌 알림 목록 새로 생성됨`);
        }
    }

    // 세션 통계
    getSessionStats() {
        return {
            activeSessions: this.sessionAlerts.size,
            totalClosedAlerts: Array.from(this.sessionClosedAlerts.values())
                .reduce((total, set) => total + set.size, 0)
        };
    }
}

module.exports = SessionAlertService;