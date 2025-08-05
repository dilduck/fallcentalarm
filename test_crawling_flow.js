const axios = require('axios');
const io = require('socket.io-client');

async function testCrawlingFlow() {
    console.log('🔍 크롤링 플로우 테스트 시작...\n');
    
    // 1. 현재 저장된 상품 수 확인
    try {
        const response = await axios.get('http://localhost:3000/api/products');
        console.log(`1️⃣ 초기 상품 수: ${response.data.data.products.length}개`);
    } catch (error) {
        console.error('API 호출 실패:', error.message);
    }
    
    // 2. 소켓 연결로 크롤링 트리거
    const socket = io('http://localhost:3000');
    
    socket.on('connect', () => {
        console.log('2️⃣ 소켓 연결 성공');
        
        // 세션 초기화
        socket.emit('init-session', {
            sessionId: 'test-session-' + Date.now(),
            userSeenProducts: []
        });
    });
    
    socket.on('initial-data', (data) => {
        console.log(`3️⃣ 초기 데이터 받음 - 상품 수: ${data.products.length}개`);
        
        // 크롤링 요청
        console.log('4️⃣ 크롤링 요청 전송...');
        socket.emit('manual-crawl');
    });
    
    socket.on('products-updated', (data) => {
        console.log(`5️⃣ 크롤링 완료 - 받은 상품 수: ${data.products.length}개`);
        
        // 잠시 후 API로 다시 확인
        setTimeout(async () => {
            try {
                const response = await axios.get('http://localhost:3000/api/products');
                console.log(`6️⃣ 크롤링 후 API 상품 수: ${response.data.data.products.length}개`);
                
                // 파일 확인
                const fs = require('fs');
                const path = require('path');
                const filePath = path.join(__dirname, 'data', 'current-products.json');
                const fileData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                console.log(`7️⃣ 파일에 저장된 상품 수: ${fileData.length}개`);
                
                process.exit(0);
            } catch (error) {
                console.error('최종 확인 실패:', error.message);
                process.exit(1);
            }
        }, 5000);
    });
    
    socket.on('crawl-completed', (data) => {
        console.log('✅ 크롤링 완료 신호 받음');
    });
    
    socket.on('crawl-error', (error) => {
        console.error('❌ 크롤링 오류:', error);
    });
}

testCrawlingFlow();