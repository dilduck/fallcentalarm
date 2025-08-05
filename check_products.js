const puppeteer = require('puppeteer');
const cheerio = require('cheerio');

async function checkFallcentProducts() {
    let browser;
    try {
        console.log('fallcent.com 상품 수 확인 시작...');
        
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');
        
        console.log('페이지 접속 중...');
        await page.goto('https://fallcent.com/', {
            waitUntil: 'networkidle0',
            timeout: 30000
        });
        
        await page.waitForSelector('.small_product_div', { timeout: 10000 });
        
        const html = await page.content();
        const $ = cheerio.load(html);
        
        // 전체 상품 수 카운트
        const allProducts = $('.small_product_div');
        console.log(`\n📊 fallcent.com 실제 상품 통계:`);
        console.log(`- 전체 상품 수: ${allProducts.length}개`);
        
        // 카테고리별 상품 수 카운트
        const categories = {};
        $('[id]').each((i, element) => {
            const $el = $(element);
            const id = $el.attr('id');
            const products = $el.find('.small_product_div');
            if (products.length > 0) {
                categories[id] = products.length;
            }
        });
        
        console.log('\n📂 카테고리별 상품 수:');
        for (const [category, count] of Object.entries(categories)) {
            console.log(`- ${category}: ${count}개`);
        }
        
        // 할인율별 상품 수
        let over40Count = 0;
        let over49Count = 0;
        let over60Count = 0;
        
        allProducts.each((i, element) => {
            const $element = $(element);
            const discountText = $element.find('.discount_rate').text() || 
                                $element.find('.percent').text() || '';
            const discountMatch = discountText.match(/(\d+)%/);
            
            if (discountMatch) {
                const discount = parseInt(discountMatch[1]);
                if (discount >= 40) over40Count++;
                if (discount >= 49) over49Count++;
                if (discount >= 60) over60Count++;
            }
        });
        
        console.log('\n💸 할인율별 상품 수:');
        console.log(`- 40% 이상: ${over40Count}개`);
        console.log(`- 49% 이상 (초특가): ${over49Count}개`);
        console.log(`- 60% 이상: ${over60Count}개`);
        
        // 로켓배송 상품 수
        const rocketCount = allProducts.filter((i, el) => {
            const $el = $(el);
            return $el.find('img[src*="rocket"]').length > 0 || 
                   $el.find('img[alt*="로켓"]').length > 0;
        }).length;
        
        console.log(`\n🚀 로켓배송 상품 수: ${rocketCount}개`);
        
    } catch (error) {
        console.error('오류 발생:', error);
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

checkFallcentProducts();