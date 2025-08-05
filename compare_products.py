import json
import re
from bs4 import BeautifulSoup

# 1. 서버가 수집한 로켓배송 상품 ID 추출
print("1. 서버가 수집한 로켓배송 상품 분석...")
with open('data/current-products.json', 'r', encoding='utf-8') as f:
    server_products = json.load(f)

server_rocket_products = [p for p in server_products if p.get('isRocket', False)]
server_product_ids = set(p['id'] for p in server_rocket_products)

print(f"서버의 로켓배송 상품 수: {len(server_rocket_products)}개")
print("\n서버의 로켓배송 상품 ID 목록:")
for i, pid in enumerate(sorted(server_product_ids), 1):
    product = next(p for p in server_rocket_products if p['id'] == pid)
    print(f"{i}. {pid} - {product['title'][:50]}...")

# 2. fallcent.com HTML에서 로켓배송 상품 추출
print("\n\n2. fallcent.com에서 로켓배송 상품 추출...")

# 가장 최근 HTML 파일 찾기
import glob
import os

html_files = glob.glob('fallcent_html_*.html')
if html_files:
    latest_html = max(html_files, key=os.path.getctime)
    print(f"분석할 HTML 파일: {latest_html}")
    
    with open(latest_html, 'r', encoding='utf-8') as f:
        html_content = f.read()
    
    soup = BeautifulSoup(html_content, 'html.parser')
    
    # 로켓배송 상품 찾기
    fallcent_rocket_products = []
    all_products = soup.find_all('div', class_='small_product_div')
    
    for product_div in all_products:
        # 로켓배송 아이콘 확인
        rocket_img = product_div.find('img', src=lambda x: x and 'rocket' in x)
        if rocket_img:
            # 상품 ID 추출
            link = product_div.find('a')
            if link and link.get('href'):
                href = link['href']
                match = re.search(r'product_id=(\d+)&item_id=(\d+)', href)
                if match:
                    product_id = f"{match.group(1)}_{match.group(2)}"
                    title = product_div.find('img', alt=True)
                    title_text = title['alt'] if title else '제목 없음'
                    
                    fallcent_rocket_products.append({
                        'id': product_id,
                        'title': title_text
                    })
    
    fallcent_product_ids = set(p['id'] for p in fallcent_rocket_products)
    
    print(f"\nfallcent.com의 로켓배송 상품 수: {len(fallcent_rocket_products)}개")
    print("\nfallcent.com의 로켓배송 상품 ID 목록:")
    for i, product in enumerate(fallcent_rocket_products, 1):
        print(f"{i}. {product['id']} - {product['title'][:50]}...")
    
    # 3. 비교 분석
    print("\n\n3. 상품 ID 비교 분석")
    print("="*60)
    
    # 서버에만 있는 상품
    server_only = server_product_ids - fallcent_product_ids
    if server_only:
        print(f"\n서버에만 있는 상품 ({len(server_only)}개):")
        for pid in server_only:
            product = next(p for p in server_rocket_products if p['id'] == pid)
            print(f"- {pid}: {product['title'][:50]}...")
    else:
        print("\n서버에만 있는 상품: 없음")
    
    # fallcent에만 있는 상품
    fallcent_only = fallcent_product_ids - server_product_ids
    if fallcent_only:
        print(f"\nfallcent.com에만 있는 상품 ({len(fallcent_only)}개):")
        for pid in fallcent_only:
            product = next(p for p in fallcent_rocket_products if p['id'] == pid)
            print(f"- {pid}: {product['title'][:50]}...")
    else:
        print("\nfallcent.com에만 있는 상품: 없음")
    
    # 공통 상품
    common_products = server_product_ids & fallcent_product_ids
    print(f"\n양쪽에 모두 있는 상품: {len(common_products)}개")
    
    # 일치율
    if fallcent_product_ids:
        match_rate = len(common_products) / len(fallcent_product_ids) * 100
        print(f"\n일치율: {match_rate:.1f}%")
else:
    print("HTML 파일을 찾을 수 없습니다.")