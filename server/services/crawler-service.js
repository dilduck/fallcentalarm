const axios = require('axios');
const cheerio = require('cheerio');

class CrawlerService {
    constructor(storageService) {
        this.storageService = storageService;
        this.SUPER_DISCOUNT_THRESHOLD = 49;
    }

    async crawlFallcent() {
        try {
            console.log('폴센트 크롤링 시작...');
            
            // HTTP 요청으로 HTML 가져오기
            const response = await axios.get('https://fallcent.com/', {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
                    'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache'
                },
                timeout: 30000, // 30초 타임아웃
                maxRedirects: 5
            });

            console.log(`응답 상태: ${response.status}`);
            
            // Cheerio로 파싱
            const $ = cheerio.load(response.data);
            
            // 가전/디지털 카테고리 상품 ID 먼저 추출
            const electronicProductIds = this.extractElectronicProductIds($);
            console.log(`가전/디지털 카테고리 상품 ID 수: ${electronicProductIds.size}`);
            
            // 상품 정보 추출
            const products = this.extractProducts($, electronicProductIds);
            
            console.log(`총 ${products.length}개 상품 추출 완료`);
            return products;
            
        } catch (error) {
            console.error('크롤링 중 오류:', error.message);
            
            // 타임아웃 오류인 경우
            if (error.code === 'ECONNABORTED') {
                console.error('⏱️ 요청 타임아웃. 네트워크 상태를 확인하세요.');
            }
            // 네트워크 오류인 경우
            else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
                console.error('🌐 네트워크 연결 오류. 인터넷 연결을 확인하세요.');
            }
            // HTTP 오류인 경우
            else if (error.response) {
                console.error(`🚫 HTTP 오류: ${error.response.status} ${error.response.statusText}`);
            }
            
            throw error;
        }
    }

    extractElectronicProductIds($) {
        const electronicProductIds = new Set();
        
        try {
            console.log('🔍 가전/디지털 카테고리 추출 시작...');
            
            // VB.NET처럼 정확히 ID로 찾기 - 여러 방법 시도
            let electronicsDiv = null;
            
            // 상품을 포함하는 가전/디지털 섹션 찾기 (여러 방법 시도)
            const candidates = [];

            // 후보 1: 구 형식 id="가전/디지털"
            $('[id]').each((i, element) => {
                const $el = $(element);
                const id = $el.attr('id') || '';
                if (id === '가전/디지털' || id === 'category_가전/디지털') {
                    candidates.push({ el: $el, id: id });
                } else if (id.includes('가전') || id.includes('디지털')) {
                    candidates.push({ el: $el, id: id });
                }
            });

            // 상품을 실제로 포함하는 후보 선택
            for (const candidate of candidates) {
                const productCount = candidate.el.find('.small_product_div').length;
                if (productCount > 0) {
                    electronicsDiv = candidate.el;
                    console.log(`✅ 가전/디지털 섹션 발견: id="${candidate.id}" (상품 ${productCount}개)`);
                    break;
                }
            }

            if (!electronicsDiv && candidates.length > 0) {
                console.log(`⚠️ 가전/디지털 관련 요소 ${candidates.length}개 발견했으나 상품 포함 요소 없음`);
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

                            // 새 형식: /product/{hash}/ 또는 구 형식: product_id=X&item_id=Y
                            let fullId = null;
                            const newUrlMatch = href.match(/\/product\/([A-Za-z0-9_-]+)\/?/);
                            const oldUrlMatch = href.match(/product_id=(\d+)&item_id=(\d+)/);

                            if (newUrlMatch) {
                                fullId = newUrlMatch[1];
                            } else if (oldUrlMatch) {
                                fullId = `${oldUrlMatch[1]}_${oldUrlMatch[2]}`;
                            }

                            if (fullId) {
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

            // 상품 ID 추출 - 새 형식: /product/{hash}/ 또는 구 형식: product_id=X&item_id=Y
            let fullId = null;

            const newUrlMatch = href.match(/\/product\/([A-Za-z0-9_-]+)\/?/);
            const oldUrlMatch = href.match(/product_id=(\d+)&item_id=(\d+)/);

            if (newUrlMatch) {
                fullId = newUrlMatch[1];
            } else if (oldUrlMatch) {
                fullId = `${oldUrlMatch[1]}_${oldUrlMatch[2]}`;
            }

            if (!fullId) return null;
            
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
            let productUrl;
            if (href.startsWith('http')) {
                productUrl = href;
            } else if (href.startsWith('/')) {
                productUrl = `https://fallcent.com${href}`;
            } else {
                productUrl = `https://fallcent.com/${href}`;
            }
            
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
                // [쿠팡] 텍스트 제거 및 공백 정규화
                title = title.replace(/\[쿠팡\]/g, '');
                title = title.replace(/\s+/g, ' ').trim();
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

    isElectronicProduct(fullId, title, electronicProductIds) {
        // 카테고리 기반 확인만 사용 (id="가전/디지털" div 내의 상품만 전자제품으로 분류)
        if (electronicProductIds.has(fullId)) {
            console.log(`🔧 가전/디지털 카테고리 상품: ${title} (${fullId})`);
            return true;
        }
        
        return false;
    }
}

module.exports = CrawlerService;