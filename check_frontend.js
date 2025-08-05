const puppeteer = require('puppeteer');

async function checkFrontend() {
    const browser = await puppeteer.launch({ 
        headless: false,  // 브라우저 보이게
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
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // 로켓 필터 체크
        const rocketFilterExists = await page.$('#rocketFilter');
        if (rocketFilterExists) {
            console.log('로켓 필터 체크박스 발견');
            const isChecked = await page.$eval('#rocketFilter', el => el.checked);
            console.log(`로켓 필터 상태: ${isChecked ? '체크됨' : '체크 안됨'}`);
            
            if (!isChecked) {
                await page.click('#rocketFilter');
                console.log('로켓 필터 체크함');
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        
        // product-card 클래스 찾기
        const productCards = await page.$$('.product-card');
        console.log(`\nproduct-card 요소 수: ${productCards.length}개`);
        
        // productsList 내부의 div 수 확인
        const productsListDivs = await page.$$eval('#productsList > div', divs => divs.length);
        console.log(`productsList 내부 div 수: ${productsListDivs}개`);
        
        // 실제 표시되는 상품 카드 HTML 구조 확인
        const sampleHTML = await page.$eval('#productsList', el => {
            const firstChild = el.firstElementChild;
            if (firstChild) {
                return firstChild.outerHTML.substring(0, 500) + '...';
            }
            return 'No products found';
        });
        console.log('\n첫 번째 상품 HTML 구조:');
        console.log(sampleHTML);
        
        // 화면에 표시되는 상품 수 확인
        const visibleProducts = await page.evaluate(() => {
            const productsList = document.getElementById('productsList');
            if (!productsList) return 0;
            
            // 상품을 나타내는 실제 요소들 찾기
            const productDivs = productsList.querySelectorAll('div[class*="border"]');
            return productDivs.length;
        });
        console.log(`\n화면에 표시되는 상품 수: ${visibleProducts}개`);
        
        // 스크린샷 저장
        await page.screenshot({ path: 'frontend_check.png', fullPage: true });
        console.log('\n스크린샷 저장됨: frontend_check.png');
        
        console.log('\n10초 후에 브라우저가 닫힙니다...');
        await new Promise(resolve => setTimeout(resolve, 10000));
        
    } catch (error) {
        console.error('오류 발생:', error);
    } finally {
        await browser.close();
    }
}

checkFrontend();