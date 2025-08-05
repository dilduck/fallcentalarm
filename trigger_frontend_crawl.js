const puppeteer = require('puppeteer');

async function triggerCrawl() {
    const browser = await puppeteer.launch({ 
        headless: false,
        defaultViewport: null 
    });
    const page = await browser.newPage();
    
    try {
        console.log('localhost:3000 접속 중...');
        await page.goto('http://localhost:3000', {
            waitUntil: 'networkidle0',
            timeout: 30000
        });
        
        // 페이지 로드 대기
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // "지금 확인" 버튼 클릭
        console.log('"지금 확인" 버튼 찾는 중...');
        const refreshBtn = await page.$('#refreshBtn');
        if (refreshBtn) {
            console.log('"지금 확인" 버튼 클릭');
            await refreshBtn.click();
            
            // 크롤링 완료 대기
            console.log('크롤링 진행 중... 30초 대기');
            await new Promise(resolve => setTimeout(resolve, 30000));
            
            // 로켓 필터 체크
            const rocketFilter = await page.$('#rocketFilter');
            if (rocketFilter) {
                const isChecked = await page.$eval('#rocketFilter', el => el.checked);
                if (!isChecked) {
                    console.log('로켓 필터 체크');
                    await rocketFilter.click();
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
            
            // 상품 수 확인
            const productCount = await page.evaluate(() => {
                const products = document.querySelectorAll('.product-card');
                return products.length;
            });
            console.log(`\n표시된 상품 수: ${productCount}개`);
            
            // 스크린샷
            await page.screenshot({ path: 'after_crawl.png', fullPage: true });
            console.log('스크린샷 저장: after_crawl.png');
            
        } else {
            console.log('❌ "지금 확인" 버튼을 찾을 수 없습니다');
        }
        
        console.log('\n10초 후 브라우저 닫힘...');
        await new Promise(resolve => setTimeout(resolve, 10000));
        
    } catch (error) {
        console.error('오류:', error);
    } finally {
        await browser.close();
    }
}

triggerCrawl();