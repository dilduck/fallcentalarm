const puppeteer = require('puppeteer');
const cheerio = require('cheerio');

async function testCrawl() {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    
    try {
        console.log('폴센트 직접 크롤링 테스트 시작...');
        
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');
        await page.goto('https://fallcent.com/', {
            waitUntil: 'networkidle0',
            timeout: 30000
        });
        
        await page.waitForSelector('.small_product_div', { timeout: 10000 });
        
        // 스크롤 전 상품 수
        const beforeScrollProducts = await page.evaluate(() => {
            return document.querySelectorAll('.small_product_div').length;
        });
        console.log(`스크롤 전 상품 수: ${beforeScrollProducts}개`);
        
        // 스크롤하여 모든 상품 로드
        console.log('페이지 스크롤 중...');
        await page.evaluate(async () => {
            await new Promise((resolve) => {
                let totalHeight = 0;
                const distance = 100;
                const timer = setInterval(() => {
                    const scrollHeight = document.body.scrollHeight;
                    window.scrollBy(0, distance);
                    totalHeight += distance;

                    if(totalHeight >= scrollHeight){
                        clearInterval(timer);
                        resolve();
                    }
                }, 100);
            });
        });
        
        await page.waitForTimeout(2000);
        
        // 스크롤 후 상품 수
        const afterScrollProducts = await page.evaluate(() => {
            return document.querySelectorAll('.small_product_div').length;
        });
        console.log(`스크롤 후 상품 수: ${afterScrollProducts}개`);
        
        // HTML 가져오기
        const html = await page.content();
        const $ = cheerio.load(html);
        
        // 로켓배송 상품 찾기
        let rocketCount = 0;
        $('.small_product_div').each((i, element) => {
            const $el = $(element);
            const html = $el.html();
            
            // 다양한 방법으로 로켓배송 확인
            if (html.includes('로켓배송') || 
                html.includes('rocket') || 
                html.includes('web_rocket_icon') ||
                html.includes('로켓')) {
                rocketCount++;
            }
        });
        
        console.log(`\n=== 크롤링 결과 ===`);
        console.log(`전체 상품 수: ${afterScrollProducts}개`);
        console.log(`로켓배송 상품 수: ${rocketCount}개`);
        console.log(`로켓배송 비율: ${(rocketCount/afterScrollProducts*100).toFixed(1)}%`);
        
    } catch (error) {
        console.error('크롤링 오류:', error);
    } finally {
        await browser.close();
    }
}

testCrawl();