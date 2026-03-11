const axios = require('axios');
const cheerio = require('cheerio');

class CrawlerService {
    constructor(storageService) {
        this.storageService = storageService;
        this.SUPER_DISCOUNT_THRESHOLD = 49;
        this.CRAWL_URL = 'https://fallcent.com/product/recommend/?from=gnb';
    }

    async crawlFallcent() {
        try {
            console.log('폴센트 크롤링 시작...');
            console.log(`📍 크롤링 URL: ${this.CRAWL_URL}`);

            // HTTP 요청으로 HTML 가져오기
            const response = await axios.get(this.CRAWL_URL, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
                    'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache'
                },
                timeout: 30000,
                maxRedirects: 5
            });

            console.log(`응답 상태: ${response.status}`);

            // Cheerio로 파싱
            const $ = cheerio.load(response.data);

            // 가전/디지털 카테고리 상품 ID 추출 (카테고리별 급락한 상품 섹션)
            const electronicProductIds = this.extractElectronicProductIds($);
            console.log(`가전/디지털 카테고리 상품 ID 수: ${electronicProductIds.size}`);

            // 상품 정보 추출
            const products = this.extractProducts($, electronicProductIds);

            console.log(`총 ${products.length}개 상품 추출 완료`);
            return products;

        } catch (error) {
            console.error('크롤링 중 오류:', error.message);

            if (error.code === 'ECONNABORTED') {
                console.error('⏱️ 요청 타임아웃. 네트워크 상태를 확인하세요.');
            } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
                console.error('🌐 네트워크 연결 오류. 인터넷 연결을 확인하세요.');
            } else if (error.response) {
                console.error(`🚫 HTTP 오류: ${error.response.status} ${error.response.statusText}`);
            }

            throw error;
        }
    }

    extractElectronicProductIds($) {
        const electronicProductIds = new Set();

        try {
            console.log('🔍 가전/디지털 카테고리 추출 시작...');

            // 새 구조: data-category-group="가전/디지털" 또는
            // "카테고리별 급락한 상품" 섹션 내 가전/디지털 탭의 상품들

            // 방법 1: data-category-group 속성으로 직접 찾기
            const electronicGroups = $('[data-category-group]').filter((i, el) => {
                const category = $(el).attr('data-category-group') || '';
                return category === '가전/디지털';
            });

            if (electronicGroups.length > 0) {
                console.log(`✅ 가전/디지털 카테고리 그룹 발견: ${electronicGroups.length}개`);

                electronicGroups.each((i, group) => {
                    const links = $(group).find('a[href*="/product/"]');
                    links.each((j, link) => {
                        const href = $(link).attr('href') || '';
                        const productId = this.extractProductIdFromHref(href);
                        if (productId) {
                            electronicProductIds.add(productId);
                        }
                    });
                });
            }

            // 방법 2: 전체 상품 중 제목 키워드로 전자제품 추정
            // (카테고리 그룹이 없는 섹션의 상품도 포함하기 위해)
            if (electronicProductIds.size === 0) {
                console.log('⚠️ data-category-group으로 가전/디지털을 찾지 못함. 제목 키워드로 시도...');

                $('a[href*="/product/"]').each((i, link) => {
                    const $link = $(link);
                    const href = $link.attr('href') || '';
                    const productId = this.extractProductIdFromHref(href);
                    if (!productId) return;

                    // img alt 또는 p 텍스트에서 제목 추출
                    const imgAlt = $link.find('img').first().attr('alt') || '';
                    const pText = $link.find('p.line-clamp-2').text().trim() || '';
                    const title = pText || imgAlt;

                    if (this.isElectronicByKeyword(title)) {
                        electronicProductIds.add(productId);
                    }
                });
            }

        } catch (error) {
            console.error('가전/디지털 카테고리 추출 중 오류:', error);
        }

        console.log(`🔧 총 ${electronicProductIds.size}개의 가전/디지털 상품 ID가 추출되었습니다.`);
        return electronicProductIds;
    }

    /**
     * 제목 키워드로 전자제품 여부 추정 (카테고리 정보 없을 때 폴백)
     */
    isElectronicByKeyword(title) {
        if (!title) return false;
        const keywords = [
            '삼성전자', 'LG전자', '하이센스', '냉장고', '세탁기', '건조기',
            '에어컨', 'TV', '모니터', '노트북', '태블릿', '갤럭시', '아이폰',
            '아이패드', '맥북', '그램', '청소기', '로봇청소기', '전자레인지',
            '식기세척기', '공기청정기', '선풍기', '히터', '제습기', '가습기',
            'PC', '컴퓨터', '키보드', '마우스', '스피커', '이어폰', '헤드폰',
            '블루투스', 'SSD', 'HDD', '메모리', 'RAM', 'GPU', 'CPU',
            '프린터', '스캐너', '빔프로젝터', '프로젝터', '카메라', 'DSLR',
            '닌텐도', '플레이스테이션', 'PS5', 'Xbox', '스위치'
        ];
        const lowerTitle = title.toLowerCase();
        return keywords.some(kw => lowerTitle.includes(kw.toLowerCase()));
    }

    extractProducts($, electronicProductIds) {
        const products = [];
        const processedIds = new Set();

        console.log('\n📊 상품 추출 시작...');

        try {
            // 새 구조: 모든 상품 링크 <a href="/product/{hash}/..."> 찾기
            const allProductLinks = $('a[href*="/product/"]').filter((i, el) => {
                const href = $(el).attr('href') || '';
                // /product/recommend/ 등 페이지 자체 링크 제외, 상품 해시 링크만
                return /\/product\/[A-Za-z0-9_-]{10,}\//.test(href);
            });

            console.log(`🔍 전체 상품 링크 수: ${allProductLinks.length}개`);

            allProductLinks.each((index, element) => {
                try {
                    const $element = $(element);
                    const product = this.parseProductElement($element, $, electronicProductIds);

                    if (product && !processedIds.has(product.id)) {
                        processedIds.add(product.id);

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

    parseProductElement($element, $, electronicProductIds) {
        try {
            const href = ($element.attr('href') || '').replace(/&amp;/g, '&');

            // 상품 ID 추출
            const fullId = this.extractProductIdFromHref(href);
            if (!fullId) return null;

            // 상품명 추출
            const title = this.extractTitle($element, $);
            if (!title) return null;

            // 가격 추출
            const price = this.extractPrice($element, $);
            if (price === 0) return null;

            // 할인율 추출
            const discountRate = this.extractDiscountRate($element, $);

            // 이미지 URL 추출
            const imageUrl = this.extractImageUrl($element, $);

            // 상품 URL 생성
            let productUrl;
            if (href.startsWith('http')) {
                productUrl = href;
            } else if (href.startsWith('/')) {
                productUrl = `https://fallcent.com${href}`;
            } else {
                productUrl = `https://fallcent.com/${href}`;
            }

            // 배송/뱃지 정보 추출
            const badges = this.extractBadges($element, $);

            // 전자제품 여부 확인
            const isElectronic = this.isElectronicProduct(fullId, title, electronicProductIds);

            // 섹션 정보 추출
            const section = this.extractSection($element, $);

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
                isTiming: badges.isTiming,
                deliveryType: badges.deliveryType,
                section: section,
                isKeywordMatch: keywordMatch.matched,
                keywordInfo: keywordMatch.matched ? keywordMatch : null,
                seen: this.storageService.isProductSeen(fullId),
                priceChanged: this.checkPriceChange(fullId, price),
                timestamp: new Date()
            };

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

    /**
     * href에서 상품 ID(해시) 추출
     */
    extractProductIdFromHref(href) {
        if (!href) return null;
        href = href.replace(/&amp;/g, '&');

        // 새 형식: /product/{hash}/ (쿼리 파라미터 제외)
        const newUrlMatch = href.match(/\/product\/([A-Za-z0-9_-]{10,})\/?/);
        if (newUrlMatch) {
            return newUrlMatch[1];
        }

        // 구 형식 폴백: product_id=X&item_id=Y
        const oldUrlMatch = href.match(/product_id=(\d+)&item_id=(\d+)/);
        if (oldUrlMatch) {
            return `${oldUrlMatch[1]}_${oldUrlMatch[2]}`;
        }

        return null;
    }

    extractPrice($element, $) {
        try {
            // 새 구조: <span class="text-base font-bold">X,XXX원</span>
            const priceSpan = $element.find('span.text-base.font-bold');
            if (priceSpan.length > 0) {
                const priceText = priceSpan.first().text().trim();
                const priceMatch = priceText.match(/([\d,]+)\s*원/);
                if (priceMatch) {
                    const price = parseInt(priceMatch[1].replace(/,/g, ''));
                    if (price >= 100 && price <= 50000000) {
                        return price;
                    }
                }
            }

            // 폴백: "원"이 포함된 span/div 검색
            let foundPrice = 0;
            $element.find('span, div').each((i, el) => {
                const text = $(el).text().trim();
                if (text.includes('원') && /[\d,]+/.test(text) && !text.includes('%')) {
                    const match = text.match(/([\d,]+)\s*원/);
                    if (match) {
                        const price = parseInt(match[1].replace(/,/g, ''));
                        if (price >= 100 && price <= 50000000) {
                            foundPrice = price;
                            return false;
                        }
                    }
                }
            });

            return foundPrice;
        } catch (error) {
            console.warn('가격 추출 중 오류:', error.message);
            return 0;
        }
    }

    extractTitle($element, $) {
        try {
            // 새 구조: <p class="mt-1 text-sm leading-snug line-clamp-2">상품명</p>
            const titleP = $element.find('p.line-clamp-2');
            if (titleP.length > 0) {
                let title = titleP.first().text().trim();
                title = title.replace(/\[쿠팡\]/g, '');
                title = title.replace(/\s+/g, ' ').trim();
                if (title) return title;
            }

            // 폴백: img alt 속성
            const imgElement = $element.find('img').first();
            if (imgElement.length > 0) {
                let alt = imgElement.attr('alt') || '';
                if (alt) {
                    alt = alt.replace(/\[쿠팡\]/g, '').replace(/\s+/g, ' ').trim();
                    return alt;
                }
            }

            return '';
        } catch (error) {
            return '';
        }
    }

    extractDiscountRate($element, $) {
        try {
            // 새 구조: <span class="... text-price-down">▼ X%</span>
            const discountSpan = $element.find('.text-price-down, [class*="text-price-down"]');
            if (discountSpan.length > 0) {
                const discountText = discountSpan.first().text().trim();
                const discountMatch = discountText.match(/(\d+)%/);
                if (discountMatch) {
                    const discount = parseInt(discountMatch[1]);
                    if (discount >= 1 && discount <= 99) {
                        return discount;
                    }
                }
            }

            // 폴백: % 기호가 있는 span 검색
            let foundDiscount = 0;
            $element.find('span').each((i, el) => {
                const text = $(el).text().trim();
                if (text.includes('%') && /\d+%/.test(text)) {
                    const match = text.match(/(\d+)%/);
                    if (match) {
                        const discount = parseInt(match[1]);
                        if (discount >= 1 && discount <= 99) {
                            foundDiscount = discount;
                            return false;
                        }
                    }
                }
            });

            return foundDiscount;
        } catch (error) {
            console.warn('할인율 추출 중 오류:', error.message);
            return 0;
        }
    }

    extractImageUrl($element, $) {
        try {
            // 상품 이미지: <img class="... aspect-square ...">
            const imgElement = $element.find('img.aspect-square, img[loading="lazy"]').first();
            if (imgElement.length > 0) {
                return imgElement.attr('src') || '';
            }

            // 폴백: 첫 번째 img
            const firstImg = $element.find('img').first();
            if (firstImg.length > 0) {
                const src = firstImg.attr('src') || '';
                // 배지 이미지 제외 (badge/ 경로)
                if (!src.includes('/badge/')) {
                    return src;
                }
            }

            return '';
        } catch (error) {
            return '';
        }
    }

    extractBadges($element, $) {
        const badges = {
            isRocket: false,
            isLowest: false,
            isTiming: false,
            deliveryType: null
        };

        try {
            // 1. 배송 타입 확인 (badge 이미지 기반)
            const badgeImgs = $element.find('img[src*="/badge/"]');
            badgeImgs.each((i, img) => {
                const src = $(img).attr('src') || '';

                if (src.includes('rocket_1.svg')) {
                    badges.isRocket = true;
                    badges.deliveryType = '로켓배송';
                } else if (src.includes('rocket_2.svg')) {
                    badges.isRocket = true;
                    badges.deliveryType = '판매자로켓';
                } else if (src.includes('hammer_and_wrench.svg')) {
                    badges.isRocket = true;
                    badges.deliveryType = '로켓설치';
                } else if (src.includes('globe_with_meridians.svg')) {
                    badges.isRocket = true;
                    badges.deliveryType = '로켓직구';
                }
            });

            // 2. 배송 텍스트로도 확인 (폴백)
            if (!badges.isRocket) {
                const deliveryTexts = $element.find('span.text-xs.font-bold');
                deliveryTexts.each((i, el) => {
                    const text = $(el).text().trim();
                    if (text.includes('로켓배송')) {
                        badges.isRocket = true;
                        badges.deliveryType = '로켓배송';
                    } else if (text.includes('판매자로켓')) {
                        badges.isRocket = true;
                        badges.deliveryType = '판매자로켓';
                    } else if (text.includes('로켓설치')) {
                        badges.isRocket = true;
                        badges.deliveryType = '로켓설치';
                    } else if (text.includes('로켓직구')) {
                        badges.isRocket = true;
                        badges.deliveryType = '로켓직구';
                    }
                });
            }

            // 3. 역대최저가 뱃지 확인
            const badgeSpans = $element.find('span.bg-price-down');
            if (badgeSpans.length > 0) {
                badges.isLowest = true;
            }

            // 폴백: 텍스트로 역대최저가 확인
            if (!badges.isLowest) {
                $element.find('span').each((i, el) => {
                    const text = $(el).text().trim();
                    if (text === '역대' || text === '역대최저가') {
                        badges.isLowest = true;
                        return false;
                    }
                });
            }

            // 4. 구매타이밍 뱃지 확인
            const timingSpans = $element.find('span.bg-primary-light');
            if (timingSpans.length > 0) {
                badges.isTiming = true;
            }

        } catch (error) {
            console.warn('뱃지 추출 중 오류:', error.message);
        }

        return badges;
    }

    /**
     * 상품이 속한 섹션 정보 추출
     */
    extractSection($element, $) {
        try {
            // 부모 요소를 거슬러 올라가며 섹션 제목 찾기
            let parent = $element.parent();
            for (let level = 0; level < 10; level++) {
                if (parent.length === 0) break;

                // data-category-group 속성 확인 (카테고리별 급락한 상품 섹션)
                const categoryGroup = parent.attr('data-category-group');
                if (categoryGroup) {
                    return { name: '카테고리별 급락한 상품', category: categoryGroup };
                }

                // 이전 형제 요소에서 h2 제목 확인
                const prevSibling = parent.prev();
                const h2 = prevSibling.find('h2').first();
                if (h2.length > 0) {
                    return { name: h2.text().trim(), category: null };
                }

                parent = parent.parent();
            }

            return { name: 'unknown', category: null };
        } catch (error) {
            return { name: 'unknown', category: null };
        }
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
        // 1. 카테고리 기반 확인 (data-category-group="가전/디지털" 내의 상품)
        if (electronicProductIds.has(fullId)) {
            console.log(`🔧 가전/디지털 카테고리 상품: ${title} (${fullId})`);
            return true;
        }

        // 2. 키워드 기반 폴백 (카테고리 정보가 부족할 경우)
        if (this.isElectronicByKeyword(title)) {
            return true;
        }

        return false;
    }
}

module.exports = CrawlerService;
