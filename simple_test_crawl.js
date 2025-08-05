const http = require('http');
const io = require('socket.io-client');
const fs = require('fs');
const path = require('path');

async function checkProductCount() {
    const filePath = path.join(__dirname, 'data', 'current-products.json');
    try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        return data.length;
    } catch (error) {
        return 0;
    }
}

async function testCrawl() {
    console.log('🔍 크롤링 테스트 시작...\n');
    
    // 1. 초기 상품 수 확인
    const initialCount = await checkProductCount();
    console.log(`1️⃣ 파일의 초기 상품 수: ${initialCount}개`);
    
    // 2. 소켓 연결
    const socket = io('http://localhost:3000');
    
    socket.on('connect', () => {
        console.log('2️⃣ 소켓 연결 성공');
        
        // 세션 초기화
        socket.emit('init-session', {
            sessionId: 'test-' + Date.now(),
            userSeenProducts: []
        });
    });
    
    socket.on('initial-data', (data) => {
        console.log(`3️⃣ 서버에서 받은 초기 상품 수: ${data.products.length}개`);
        
        // 크롤링 요청
        console.log('\n4️⃣ 크롤링 요청 전송...');
        socket.emit('manual-crawl');
    });
    
    socket.on('products-updated', async (data) => {
        console.log(`\n5️⃣ 크롤링 완료!`);
        console.log(`   - 소켓으로 받은 상품 수: ${data.products.length}개`);
        
        // 잠시 후 파일 확인
        setTimeout(async () => {
            const finalCount = await checkProductCount();
            console.log(`\n6️⃣ 최종 확인:`);
            console.log(`   - 파일에 저장된 상품 수: ${finalCount}개`);
            console.log(`   - 차이: ${finalCount - initialCount}개`);
            
            socket.close();
            process.exit(0);
        }, 3000);
    });
    
    socket.on('crawl-completed', () => {
        console.log('✅ 크롤링 완료 신호 받음');
    });
    
    socket.on('crawl-error', (error) => {
        console.error('❌ 크롤링 오류:', error);
        socket.close();
        process.exit(1);
    });
    
    // 타임아웃
    setTimeout(() => {
        console.error('\n⏱️ 타임아웃 - 60초 내에 완료되지 않음');
        socket.close();
        process.exit(1);
    }, 60000);
}

testCrawl();