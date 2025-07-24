const puppeteer = require('puppeteer');
const cheerio = require('cheerio');

class CrawlerService {
    constructor(storageService) {
        this.storageService = storageService;
        this.browser = null;
        this.SUPER_DISCOUNT_THRESHOLD = 49;
    }

    async getBrowser() {
        if (!this.browser) {
            this.browser = await puppeteer.launch({
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--disable-gpu'
                ]
            });
        }
        return this.browser;
    }

    async crawlFallcent() {
        let page = null;
        try {
            console.log('폴센트 크롤링 시작...');
            
            const browser = await this.getBrowser();
            page = await browser.newPage();
            
            // User-Agent 설정 (봇 감지 회피)
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');
            
            // 타임아웃 설정
            await page.setDefaultTimeout(30000);
            
            // 폴센트 메인 페이지 접속
            await page.goto('https://fallcent.com/', {
                waitUntil: 'networkidle0',
                timeout: 30000
            });

            // 페이지 로딩 대기
            await page.waitForSelector('.small_product_div', { timeout: 10000 });

            // 스크롤하여 모든 상품 로드
            console.log('페이지 스크롤하여 모든 상품 로드 중...');
            await this.autoScroll(page);
            
            // 스크롤 후 잠시 대기
            await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 2000)));

            // HTML 가져오기
            const html = await page.content();
            
            // Cheerio로 파싱
            const $ = cheerio.load(html);
            
            // 가전/디지털 카테고리 상품 ID 먼저 추출
            const electronicProductIds = this.extractElectronicProductIds($);
            console.log(`가전/디지털 카테고리 상품 ID 수: ${electronicProductIds.size}`);
            
            // 상품 정보 추출
            const products = this.extractProducts($, electronicProductIds);
            
            console.log(`총 ${products.length}개 상품 추출 완료`);
            return products;
            
        } catch (error) {
            console.error('크롤링 중 오류:', error);
            throw error;
        } finally {
            if (page) {
                await page.close();
            }
        }
    }

    extractElectronicProductIds($) {
        const electronicProductIds = new Set();
        
        try {
            console.log('🔍 가전/디지털 카테고리 추출 시작...');
            
            // VB.NET처럼 정확히 ID로 찾기 - 여러 방법 시도
            let electronicsDiv = null;
            
            // 1차: VB.NET처럼 정확한 ID로 찾기
            $('*').each((i, element) => {
                const $el = $(element);
                const id = $el.attr('id');
                if (id === '가전/디지털') {
                    electronicsDiv = $el;
                    console.log('✅ 가전/디지털 섹션을 ID로 찾았습니다:', id);
                    return false; // break
                }
            });
            
            // 2차: ID에 가전/디지털이 포함된 요소 찾기
            if (!electronicsDiv || electronicsDiv.length === 0) {
                $('*').each((i, element) => {
                    const $el = $(element);
                    const id = $el.attr('id') || '';
                    if (id.includes('가전') && id.includes('디지털')) {
                        electronicsDiv = $el;
                        console.log('✅ 가전/디지털 섹션을 부분 ID로 찾았습니다:', id);
                        return false; // break
                    }
                });
            }
            
            // 3차: 텍스트로 찾기
            if (!electronicsDiv || electronicsDiv.length === 0) {
                $('*').each((i, element) => {
                    const $el = $(element);
                    const text = $el.text().trim();
                    if (text === '가전/디지털' || text.includes('가전/디지털')) {
                        // 부모 요소들 중에서 상품을 포함할 가능성이 높은 것 찾기
                        let candidate = $el;
                        for (let level = 0; level < 5; level++) {
                            if (candidate.find('.small_product_div').length > 0) {
                                electronicsDiv = candidate;
                                console.log('✅ 가전/디지털 섹션을 텍스트로 찾았습니다:', text, '레벨:', level);
                                return false;
                            }
                            candidate = candidate.parent();
                            if (candidate.length === 0) break;
                        }
                    }
                });
            }
            
            // 4차: 모든 div를 검사해서 가전/디지털 상품이 많이 있는 섹션 찾기
            if (!electronicsDiv || electronicsDiv.length === 0) {
                console.log('🔍 모든 div를 검사하여 가전/디지털 섹션을 찾습니다...');
                let bestCandidate = null;
                let maxElectronicProducts = 0;
                
                $('div').each((i, element) => {
                    const $el = $(element);
                    const products = $el.find('.small_product_div');
                    if (products.length >= 5) { // 최소 5개 이상의 상품이 있는 섹션
                        let electronicCount = 0;
                        products.each((j, prod) => {
                            const $prod = $(prod);
                            const title = $prod.find('.another_item_name').text() || 
                                         $prod.find('img').attr('alt') || '';
                            
                            // 전자제품 키워드로 확인
                            if (this.isElectronicByKeyword(title)) {
                                electronicCount++;
                            }
                        });
                        
                        if (electronicCount > maxElectronicProducts && electronicCount >= Math.floor(products.length * 0.3)) {
                            maxElectronicProducts = electronicCount;
                            bestCandidate = $el;
                        }
                    }
                });
                
                if (bestCandidate) {
                    electronicsDiv = bestCandidate;
                    console.log(`✅ 추론으로 가전/디지털 섹션을 찾았습니다. 전자제품 ${maxElectronicProducts}개 감지`);
                }
            }
            
            if (electronicsDiv && electronicsDiv.length > 0) {
                console.log('🔍 가전/디지털 카테고리 섹션에서 상품 ID 추출 중...');
                
                // VB.NET처럼 해당 섹션 내의 모든 상품 div 찾기
                const productDivs = electronicsDiv.find('.small_product_div');
                console.log(`📋 가전/디지털 섹션에서 ${productDivs.length}개 상품 발견`);
                
                productDivs.each((index, element) => {
                    try {
                        const $element = $(element);
                        const linkElement = $element.find('a').first();
                        
                        if (linkElement.length > 0) {
                            let href = linkElement.attr('href') || '';
                            href = href.replace(/&amp;/g, '&');
                            
                            const urlMatch = href.match(/product_id=(\d+)&item_id=(\d+)/);
                            if (urlMatch) {
                                const productId = urlMatch[1];
                                const itemId = urlMatch[2];
                                const fullId = `${productId}_${itemId}`;
                                electronicProductIds.add(fullId);
                                
                                // 상품명도 출력해서 정말 전자제품인지 확인
                                const title = $element.find('.another_item_name').text() || 
                                             $element.find('img').attr('alt') || '';
                            }
                        }
                    } catch (err) {
                        console.warn('가전/디지털 상품 ID 추출 중 오류:', err.message);
                    }
                });
            } else {
                console.warn('❌ 가전/디지털 카테고리 섹션을 찾을 수 없습니다.');
                console.log('🔍 페이지 구조 분석을 위해 ID가 있는 모든 요소를 출력합니다:');
                
                $('[id]').each((i, element) => {
                    const $el = $(element);
                    const id = $el.attr('id');
                    const text = $el.text().trim().substring(0, 100);
                    console.log(`ID: "${id}" - 텍스트: "${text}"`);
                });
            }
            
        } catch (error) {
            console.error('가전/디지털 카테고리 추출 중 오류:', error);
        }
        
        console.log(`🔧 총 ${electronicProductIds.size}개의 가전/디지털 상품 ID가 추출되었습니다.`);
        return electronicProductIds;
    }

    // 키워드로 전자제품 여부 확인하는 헬퍼 함수
    isElectronicByKeyword(title) {
        if (!title) return false;
        
        const electronicKeywords = [
            '블루투스', '이어폰', '버즈', '에어팟', '헤드폰', '헤드셋',
            '갤럭시', '아이폰', '스마트폰', '휴대폰', '스마트워치',
            '노트북', '맥북', '컴퓨터', '데스크탑', 'PC', '모니터',
            'TV', '텔레비전', '디스플레이', '프로젝터',
            '키보드', '마우스', '스피커', '웹캠', '마이크',
            'SSD', 'HDD', '메모리', 'USB', '외장하드',
            '냉장고', '세탁기', '건조기', '에어컨', '정수기', '공기청정기',
            '전자레인지', '에어프라이어', '믹서', '블렌더', '전기밥솥',
            '충전기', '보조배터리', '무선충전', '어댑터', '케이블'
        ];
        
        const lowerTitle = title.toLowerCase();
        return electronicKeywords.some(keyword => lowerTitle.includes(keyword.toLowerCase()));
    }

    extractProducts($, electronicProductIds) {
        const products = [];
        const processedIds = new Set();
        
        console.log('\n📊 상품 추출 시작...');
        
        try {
            // 모든 상품 항목 찾기
            const allProductDivs = $('.small_product_div');
            console.log(`🔍 전체 상품 div 수: ${allProductDivs.length}개`);
            
            allProductDivs.each((index, element) => {
                try {
                    const $element = $(element);
                    const product = this.parseProductElement($element, electronicProductIds);
                    
                    if (product && !processedIds.has(product.id)) {
                        processedIds.add(product.id);
                        
                        // 차단된 상품 필터링
                        if (!this.storageService.isProductBanned(product.id)) {
                            products.push(product);
                        }
                    }
                } catch (err) {
                    console.warn('상품 파싱 중 오류:', err.message);
                }
            });
        } catch (error) {
            console.error('상품 추출 중 오류:', error);
        }
        
        console.log(`\n📊 상품 추출 완료 통계:`);
        console.log(`- 처리된 상품 수: ${processedIds.size}개`);
        console.log(`- 필터링 후 최종 상품 수: ${products.length}개`);
        console.log(`- 가전/디지털 상품 수: ${products.filter(p => p.isElectronic).length}개`);
        console.log(`- 초특가 상품 수: ${products.filter(p => p.isSuperDeal).length}개`);
        console.log(`- 로켓배송 상품 수: ${products.filter(p => p.isRocket).length}개`);
        
        return products;
    }

    parseProductElement($element, electronicProductIds) {
        try {
            // cheerio 인스턴스 가져오기
            const $ = $element.constructor;
            
            // 상품 링크 찾기
            const linkElement = $element.find('a').first();
            if (linkElement.length === 0) return null;
            
            let href = linkElement.attr('href') || '';
            href = href.replace(/&amp;/g, '&');
            
            // 상품 ID 추출
            const urlMatch = href.match(/product_id=(\d+)&item_id=(\d+)/);
            if (!urlMatch) return null;
            
            const productId = urlMatch[1];
            const itemId = urlMatch[2];
            const fullId = `${productId}_${itemId}`;
            
            // 가격 추출
            const price = this.extractPrice($element);
            if (price === 0) return null;
            
            // 상품명 추출
            const title = this.extractTitle($element);
            if (!title) return null;
            
            // 할인율 추출
            const discountRate = this.extractDiscountRate($element);
            
            // 이미지 URL 추출
            const imageUrl = this.extractImageUrl($element);
            
            // 상품 URL 생성
            const productUrl = href.startsWith('http') ? href : `https://fallcent.com${href}`;
            
            // 로켓배송/최저가 뱃지 확인 - cheerio 인스턴스 전달
            const badges = this.extractBadges($element, $);
            
            
            // 전자제품 여부 확인 - VB.NET의 IsElectronicProduct 함수 참고
            const isElectronic = this.isElectronicProduct(fullId, title, electronicProductIds);
            
            // 키워드 매칭 확인
            const keywordMatch = this.checkKeywordMatch(title);
            
            const product = {
                id: fullId,
                title: title,
                price: price,
                discountRate: discountRate,
                imageUrl: imageUrl,
                productUrl: productUrl,
                isElectronic: isElectronic,
                isSuperDeal: discountRate >= this.SUPER_DISCOUNT_THRESHOLD,
                isRocket: badges.isRocket,
                isLowest: badges.isLowest,
                isKeywordMatch: keywordMatch.matched,
                keywordInfo: keywordMatch.matched ? keywordMatch : null,
                seen: this.storageService.isProductSeen(fullId),
                priceChanged: this.checkPriceChange(fullId, price),
                timestamp: new Date()
            };
            
            // 디버깅: 전자제품 정보 로그
            if (isElectronic) {
                console.log(`🔧 전자제품 발견: ${title} (${fullId})`);
            }
            
            // 가격 정보 업데이트
            this.storageService.updateProductPrice(fullId, price);
            
            return product;
            
        } catch (error) {
            console.warn('상품 요소 파싱 중 오류:', error.message);
            return null;
        }
    }

    extractPrice($element) {
        try {
            // VB.NET 코드 참고하여 가격 추출 로직 개선
            let priceText = '';
            
            // 1차: white-space: nowrap 스타일을 가진 요소
            const priceElement1 = $element.find('div[style*="white-space: nowrap"]');
            if (priceElement1.length > 0) {
                priceText = priceElement1.text().trim();
            }
            
            // 2차: font-weight: 700 스타일을 가진 요소
            if (!priceText) {
                const priceElement2 = $element.find('div[style*="font-weight: 700"]');
                if (priceElement2.length > 0) {
                    priceText = priceElement2.text().trim();
                }
            }
            
            // 3차: 가격 패턴이 있는 모든 div 검색
            if (!priceText) {
                $element.find('div').each((i, el) => {
                    const text = $(el).text().trim();
                    // 원이 포함되고 숫자가 있으며, 할인율이 아닌 것
                    if (text.includes('원') && /[\d,]+/.test(text) && !text.includes('%')) {
                        priceText = text;
                        return false; // break
                    }
                });
            }
            
            if (priceText) {
                // VB.NET처럼 정교한 가격 추출
                // 먼저 할인율 패턴 제거
                let cleanPriceText = priceText.replace(/\d+%\s*(할인|OFF|DC)/gi, '');
                
                // 원 단위 가격 추출 - VB.NET의 priceMatch와 동일한 로직
                const priceMatch = cleanPriceText.match(/([\d,]+)\s*원/);
                if (priceMatch) {
                    const price = parseInt(priceMatch[1].replace(/,/g, ''));
                    // VB.NET처럼 최소 가격 검증 (100원 이상)
                    if (price >= 100 && price <= 50000000) { // 최대 5천만원까지 유효
                        return price;
                    }
                }
                
                // 원이 없는 경우 숫자만 추출 (단, 큰 숫자만)
                const numberOnlyMatch = cleanPriceText.match(/([\d,]+)/);
                if (numberOnlyMatch) {
                    const price = parseInt(numberOnlyMatch[1].replace(/,/g, ''));
                    // VB.NET처럼 유효한 가격 범위 검증
                    if (price >= 1000 && price <= 50000000) {
                        return price;
                    }
                }
            }
            
            return 0;
        } catch (error) {
            console.warn('가격 추출 중 오류:', error.message);
            return 0;
        }
    }

    extractTitle($element) {
        try {
            // 상품명 추출
            const titleElement = $element.find('.another_item_name');
            if (titleElement.length > 0) {
                let title = titleElement.text().trim();
                // [쿠팡] 텍스트 제거
                title = title.replace(/\[쿠팡\]/g, '').trim();
                return title;
            }
            
            // 대체 방법: img alt 속성
            const imgElement = $element.find('img').first();
            if (imgElement.length > 0) {
                let alt = imgElement.attr('alt') || '';
                // '상품의 현재 가격은' 부분 제거
                const altMatch = alt.match(/(.+)(?:이라는 상품의 현재 가격은)/);
                if (altMatch) {
                    return altMatch[1].trim();
                }
                return alt.trim();
            }
            
            return '';
        } catch (error) {
            return '';
        }
    }

    extractDiscountRate($element) {
        try {
            // VB.NET 로직과 동일하게 할인율 추출
            let discountText = '';
            
            // 1차: color: #F56666 스타일
            const discountElement1 = $element.find('div[style*="color: #F56666"], div[style*="color:#F56666"]');
            if (discountElement1.length > 0) {
                discountText = discountElement1.text().trim();
            }
            
            // 2차: background-color: #FFE2E2 스타일
            if (!discountText) {
                const discountElement2 = $element.find('div[style*="background-color: #FFE2E2"], div[style*="background-color:#FFE2E2"]');
                if (discountElement2.length > 0) {
                    discountText = discountElement2.text().trim();
                }
            }
            
            // 3차: % 기호가 있는 div 검색
            if (!discountText) {
                $element.find('div').each((i, el) => {
                    const text = $(el).text().trim();
                    if (text.includes('%') && /\d+%/.test(text)) {
                        discountText = text;
                        return false; // break
                    }
                });
            }
            
            if (discountText) {
                // VB.NET처럼 할인율 숫자만 추출
                const discountMatch = discountText.match(/(\d+)%/);
                if (discountMatch) {
                    const discount = parseInt(discountMatch[1]);
                    // 유효한 할인율 범위 (1~99%)
                    if (discount >= 1 && discount <= 99) {
                        return discount;
                    }
                }
            }
            
            return 0;
        } catch (error) {
            console.warn('할인율 추출 중 오류:', error.message);
            return 0;
        }
    }

    extractImageUrl($element) {
        try {
            const imgElement = $element.find('img').first();
            if (imgElement.length > 0) {
                return imgElement.attr('src') || '';
            }
            return '';
        } catch (error) {
            return '';
        }
    }

    extractBadges($element, $) {
        const badges = {
            isRocket: false,
            isLowest: false
        };
        
        try {
            // 1. img 태그의 alt 속성 확인 - 더 안전한 방식
            const images = $element.find('img');
            for (let i = 0; i < images.length; i++) {
                const img = images.eq(i);
                const alt = img.attr('alt') || '';
                const src = img.attr('src') || '';
                const title = img.attr('title') || '';
                
                
                // 로켓배송 키워드 확인 - web_rocket_icon 추가
                if (alt.includes('로켓배송') || 
                    alt.includes('로켓') ||
                    src.includes('rocket') || 
                    src.includes('web_rocket_icon') ||
                    src.includes('로켓') ||
                    src.includes('delivery') ||
                    alt.toLowerCase().includes('rocket')) {
                    badges.isRocket = true;
                }
                
                // 최저가 키워드 확인 - web_lowest_icon 추가
                if (alt.includes('최저가') || 
                    alt.includes('lowest') || 
                    src.includes('lowest') ||
                    src.includes('web_lowest_icon')) {
                    badges.isLowest = true;
                }
            }
            
            // 2. 전체 텍스트 확인
            const elementText = $element.text();
            if (elementText.includes('로켓배송') || 
                elementText.includes('로켓') ||
                elementText.includes('rocket') ||
                elementText.includes('당일배송')) {
                badges.isRocket = true;
            }
            
            if (elementText.includes('최저가')) {
                badges.isLowest = true;
            }
            
            // 3. CSS 클래스 확인
            const classNames = $element.attr('class') || '';
            if (classNames.includes('rocket') || 
                classNames.includes('로켓') || 
                classNames.includes('delivery')) {
                badges.isRocket = true;
                console.log(`🚀 로켓배송 클래스 발견: "${classNames}"`);
            }
            
            // 4. 개별 요소들 확인 - 더 안전한 방식
            const spans = $element.find('span, div, small, p');
            for (let i = 0; i < spans.length; i++) {
                const element = spans.eq(i);
                const text = element.text().trim();
                const lowerText = text.toLowerCase();
                
                if ((text.includes('로켓배송') || 
                     text.includes('로켓') ||
                     lowerText.includes('rocket') ||
                     text.includes('당일배송') ||
                     text.includes('빠른배송')) && 
                    text.length < 30) {
                    badges.isRocket = true;
                    console.log(`🚀 로켓배송 요소 발견: "${text}"`);
                    break;
                }
            }
            
            // 5. 디버깅: 로켓배송 미감지시 HTML 구조 출력
            if (!badges.isRocket) {
                const htmlSnippet = $element.html();
                if (htmlSnippet) {
                    console.log(`🔍 로켓배송 미감지 - HTML:`, htmlSnippet.substring(0, 200) + '...');
                }
            }
            
        } catch (error) {
            console.warn('뱃지 추출 중 오류:', error.message);
        }
        
        return badges;
    }

    checkKeywordMatch(title) {
        if (!title) return { matched: false };
        
        const settings = this.storageService.getSettings();
        const keywordCategories = settings.keywords?.categories || [];
        const lowerTitle = title.toLowerCase();
        
        for (const category of keywordCategories) {
            if (!category.enabled) continue;
            
            for (const keyword of category.keywords || []) {
                if (lowerTitle.includes(keyword.toLowerCase())) {
                    return {
                        matched: true,
                        keyword: keyword,
                        category: category.name,
                        priority: category.priority || 'medium'
                    };
                }
            }
        }
        
        return { matched: false };
    }

    checkPriceChange(productId, currentPrice) {
        const oldPrice = this.storageService.getProductPrice(productId);
        if (oldPrice && oldPrice !== currentPrice) {
            return {
                changed: true,
                oldPrice: oldPrice,
                newPrice: currentPrice,
                isDecrease: currentPrice < oldPrice
            };
        }
        return { changed: false };
    }

    async closeBrowser() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
        }
    }

    isElectronicProduct(fullId, title, electronicProductIds) {
        // 1차: 카테고리 기반 확인 (VB.NET처럼)
        if (electronicProductIds.has(fullId)) {
            return true;
        }
        
        // 2차: 키워드 기반 확인 (VB.NET의 IsKeywordProduct 로직 참고)
        if (!title) return false;
        
        // VB.NET에서 사용된 전자제품 키워드 목록
        const electronicKeywords = [
            // 무선이어폰 관련
            '블루투스', '이어폰', '버즈', '에어팟', '이어버드', '헤드폰', '헤드셋',
            
            // 휴대폰 관련  
            '갤럭시', '아이폰', '스마트폰', '휴대폰', '폰케이스', '스마트워치',
            
            // 컴퓨터 관련
            '노트북', '맥북', '컴퓨터', '데스크탑', 'PC', '모니터', 'CPU', 'GPU',
            
            // 디스플레이 관련
            'TV', '텔레비전', '모니터', '디스플레이', '프로젝터',
            
            // 주변기기
            '키보드', '마우스', '스피커', '웹캠', '마이크',
            
            // 저장장치
            'SSD', 'HDD', '메모리', 'USB', '외장하드', 'SD카드',
            
            // 대형가전
            '냉장고', '세탁기', '건조기', '에어컨', '정수기', '공기청정기',
            
            // 소형가전  
            '전자레인지', '에어프라이어', '믹서', '블렌더', '전기밥솥', '인덕션',
            '토스터', '전기포트', '커피머신', '전기면도기', '드라이어', '고데기',
            
            // 충전기/전원 관련
            '충전기', '보조배터리', '무선충전', '어댑터', '케이블', '선풍기',
            
            // 게임 관련
            '게임기', '콘솔', '조이스틱', '게임패드', 'VR',
            
            // 기타 전자제품
            '태블릿', '전자책', '스마트밴드', '액션캠', '드론', '로봇청소기'
        ];
        
        // 대소문자 구분 없이 검색
        const lowerTitle = title.toLowerCase();
        
        // 키워드 포함 여부 확인
        for (const keyword of electronicKeywords) {
            if (lowerTitle.includes(keyword.toLowerCase())) {
                console.log(`🔧 키워드 기반 전자제품 매칭: '${title}' -> '${keyword}'`);
                return true;
            }
        }
        
        return false;
    }

    async autoScroll(page) {
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
}

module.exports = CrawlerService; 