import json
import aiohttp
import asyncio
from bs4 import BeautifulSoup
import re

async def fetch_fallcent_html():
    """fallcent.com의 HTML을 가져와서 분석"""
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
    }
    
    async with aiohttp.ClientSession() as session:
        async with session.get('https://fallcent.com/', headers=headers) as response:
            return await response.text()

def analyze_server_data():
    """서버가 수집한 데이터 분석"""
    with open('data/current-products.json', 'r', encoding='utf-8') as f:
        products = json.load(f)
    
    rocket_products = [p for p in products if p.get('isRocket', False)]
    super_deals = [p for p in products if p.get('isSuperDeal', False)]
    
    print("=== 서버 수집 데이터 ===")
    print(f"전체 상품 수: {len(products)}개")
    print(f"로켓배송 상품 수: {len(rocket_products)}개")
    print(f"초특가(49%+) 상품 수: {len(super_deals)}개")
    
    # 할인율 분포
    discount_ranges = {"0-19%": 0, "20-29%": 0, "30-39%": 0, "40-48%": 0, "49%+": 0}
    for p in products:
        rate = p.get('discountRate', 0)
        if rate >= 49:
            discount_ranges["49%+"] += 1
        elif rate >= 40:
            discount_ranges["40-48%"] += 1
        elif rate >= 30:
            discount_ranges["30-39%"] += 1
        elif rate >= 20:
            discount_ranges["20-29%"] += 1
        else:
            discount_ranges["0-19%"] += 1
    
    print("\n할인율 분포:")
    for range_name, count in discount_ranges.items():
        print(f"  {range_name}: {count}개")
    
    return set(p['id'] for p in rocket_products)

async def analyze_fallcent_html(html):
    """fallcent.com HTML 분석"""
    soup = BeautifulSoup(html, 'html.parser')
    
    all_products = soup.find_all('div', class_='small_product_div')
    rocket_products = []
    
    for product_div in all_products:
        # 로켓배송 아이콘 확인
        rocket_img = product_div.find('img', src=lambda x: x and 'web_rocket_icon' in x)
        if rocket_img:
            # 상품 ID 추출
            link = product_div.find('a')
            if link and link.get('href'):
                href = link['href']
                match = re.search(r'product_id=(\d+)&item_id=(\d+)', href)
                if match:
                    product_id = f"{match.group(1)}_{match.group(2)}"
                    
                    # 할인율 추출
                    discount_text = product_div.find(text=re.compile(r'\d+%'))
                    discount_rate = 0
                    if discount_text:
                        discount_match = re.search(r'(\d+)%', discount_text)
                        if discount_match:
                            discount_rate = int(discount_match.group(1))
                    
                    rocket_products.append({
                        'id': product_id,
                        'discount_rate': discount_rate
                    })
    
    print("\n=== fallcent.com 실제 데이터 ===")
    print(f"전체 상품 수: {len(all_products)}개")
    print(f"로켓배송 상품 수: {len(rocket_products)}개")
    
    # 초특가 상품 수 (49% 이상)
    super_deals = [p for p in rocket_products if p['discount_rate'] >= 49]
    print(f"초특가(49%+) 상품 수: {len(super_deals)}개")
    
    return set(p['id'] for p in rocket_products)

async def main():
    print("서버 수집 데이터와 fallcent.com 비교 분석\n")
    
    # 1. 서버 데이터 분석
    server_rocket_ids = analyze_server_data()
    
    # 2. fallcent.com 데이터 가져오기
    print("\nfallcent.com 접속 중...")
    html = await fetch_fallcent_html()
    fallcent_rocket_ids = await analyze_fallcent_html(html)
    
    # 3. 비교 분석
    print("\n=== 비교 결과 ===")
    common_ids = server_rocket_ids & fallcent_rocket_ids
    server_only = server_rocket_ids - fallcent_rocket_ids
    fallcent_only = fallcent_rocket_ids - server_rocket_ids
    
    print(f"일치하는 로켓배송 상품: {len(common_ids)}개")
    print(f"서버에만 있는 상품: {len(server_only)}개")
    print(f"fallcent.com에만 있는 상품: {len(fallcent_only)}개")
    
    if len(fallcent_rocket_ids) > 0:
        match_rate = len(common_ids) / len(fallcent_rocket_ids) * 100
        print(f"\n수집률: {match_rate:.1f}%")
        
        if match_rate < 90:
            print("\n⚠️ 수집률이 90% 미만입니다. 크롤링 로직 점검이 필요할 수 있습니다.")
        else:
            print("\n✅ 정상적으로 대부분의 상품을 수집하고 있습니다.")

if __name__ == "__main__":
    asyncio.run(main())