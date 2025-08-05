const puppeteer = require('puppeteer');
const fs = require('fs');

async function compareRealtime() {
    console.log('=== 실시간 fallcent.com 비교 분석 시작 ===\n');
    
    let browser;
    try {
        // 브라우저 실행
        browser = await puppeteer.launch({
            headless: false,  // 실시간 확인을 위해 브라우저 표시
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        const page = await browser.newPage();
        
        // User-Agent 설정
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');
        
        console.log('fallcent.com 접속 중...');
        await page.goto('https://fallcent.com/', {
            waitUntil: 'domcontentloaded',
            timeout: 60000
        });
        
        // 상품 로딩 대기
        await page.waitForSelector('.small_product_div', { timeout: 10000 });
        
        // 스크롤하여 모든 상품 로드
        console.log('페이지 스크롤 중...');
        await autoScroll(page);
        
        // 모든 상품 정보 추출
        const products = await page.evaluate(() => {
            const items = [];
            const productDivs = document.querySelectorAll('.small_product_div');
            
            productDivs.forEach(div => {
                // 로켓배송 여부 확인
                const rocketImg = div.querySelector('img[src*="web_rocket_icon"]');
                const isRocket = !!rocketImg;
                
                // 상품 링크에서 ID 추출
                const link = div.querySelector('a');
                if (link) {
                    const href = link.href;
                    const match = href.match(/product_id=(\d+)&item_id=(\d+)/);
                    if (match) {
                        const productId = `${match[1]}_${match[2]}`;
                        
                        // 상품명 추출
                        const titleEl = div.querySelector('.another_item_name');
                        const title = titleEl ? titleEl.textContent.trim() : '';
                        
                        // 할인율 추출
                        let discountRate = 0;
                        const discountEl = div.querySelector('div[style*="color: #F56666"], div[style*="color:#F56666"]');
                        if (discountEl) {
                            const match = discountEl.textContent.match(/(\d+)%/);
                            if (match) discountRate = parseInt(match[1]);
                        }
                        
                        items.push({
                            id: productId,
                            title: title,
                            isRocket: isRocket,
                            discountRate: discountRate
                        });
                    }
                }
            });
            
            return items;
        });
        
        console.log(`\n=== 실제 fallcent.com 데이터 ===`);
        console.log(`전체 상품 수: ${products.length}개`);
        
        const rocketProducts = products.filter(p => p.isRocket);
        console.log(`로켓배송 상품 수: ${rocketProducts.length}개`);
        
        const superDeals = rocketProducts.filter(p => p.discountRate >= 49);
        console.log(`초특가(49%+) 로켓배송 상품 수: ${superDeals.length}개`);
        
        // 서버 데이터와 비교
        const serverData = JSON.parse(fs.readFileSync('data/current-products.json', 'utf8'));
        const serverRocketProducts = serverData.filter(p => p.isRocket);
        
        console.log(`\n=== 서버 수집 데이터 ===`);
        console.log(`로켓배송 상품 수: ${serverRocketProducts.length}개`);
        
        // 상품 ID 세트로 변환
        const siteIds = new Set(rocketProducts.map(p => p.id));
        const serverIds = new Set(serverRocketProducts.map(p => p.id));
        
        // 교집합, 차집합 계산
        const common = [...serverIds].filter(id => siteIds.has(id));
        const serverOnly = [...serverIds].filter(id => !siteIds.has(id));
        const siteOnly = [...siteIds].filter(id => !serverIds.has(id));
        
        console.log(`\n=== 비교 결과 ===`);
        console.log(`일치하는 로켓배송 상품: ${common.length}개`);
        console.log(`서버에만 있는 상품: ${serverOnly.length}개`);
        console.log(`사이트에만 있는 상품: ${siteOnly.length}개`);
        
        const collectionRate = (common.length / siteIds.size * 100).toFixed(1);
        console.log(`\n수집률: ${collectionRate}%`);
        
        if (collectionRate < 50) {
            console.log('\n⚠️ 수집률이 50% 미만입니다. 크롤링 로직 점검이 필요합니다.');
            
            // 누락된 상품 샘플 출력
            console.log('\n누락된 상품 샘플 (최대 10개):');
            const missingSample = siteOnly.slice(0, 10);
            missingSample.forEach(id => {
                const product = rocketProducts.find(p => p.id === id);
                if (product) {
                    console.log(`- ${id}: ${product.title}`);
                }
            });
        }
        
        // 결과 저장
        const result = {
            timestamp: new Date().toISOString(),
            site: {
                total: products.length,
                rocket: rocketProducts.length,
                superDeal: superDeals.length
            },
            server: {
                rocket: serverRocketProducts.length
            },
            comparison: {
                common: common.length,
                serverOnly: serverOnly.length,
                siteOnly: siteOnly.length,
                collectionRate: parseFloat(collectionRate)
            }
        };
        
        fs.writeFileSync('realtime_comparison_result.json', JSON.stringify(result, null, 2));
        console.log('\n결과가 realtime_comparison_result.json에 저장되었습니다.');
        
    } catch (error) {
        console.error('비교 중 오류:', error);
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

// 자동 스크롤 함수
async function autoScroll(page) {
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
}

// 실행
compareRealtime();