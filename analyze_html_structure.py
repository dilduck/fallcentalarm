from bs4 import BeautifulSoup
import re

with open('fallcent_html_20250723_044925.html', 'r', encoding='utf-8') as f:
    html_content = f.read()

soup = BeautifulSoup(html_content, 'html.parser')

# 첫 번째 상품 div 찾기
first_product = soup.find('div', class_='small_product_div')
if first_product:
    print("첫 번째 상품의 HTML 구조:")
    print("-" * 60)
    print(first_product.prettify()[:2000])
    print("-" * 60)
    
    # 로켓배송 이미지 찾기
    rocket_imgs = first_product.find_all('img', src=lambda x: x and 'rocket' in x)
    print(f"\n로켓배송 이미지 수: {len(rocket_imgs)}")
    for img in rocket_imgs:
        print(f"- src: {img.get('src')}")
        print(f"  alt: {img.get('alt')}")

# 전체 상품에서 로켓배송 패턴 분석
print("\n\n전체 로켓배송 이미지 분석:")
all_rocket_imgs = soup.find_all('img', src=lambda x: x and 'web_rocket_icon' in x)
print(f"web_rocket_icon 이미지 총 개수: {len(all_rocket_imgs)}")

# 로켓배송 상품의 구조 패턴 분석
print("\n로켓배송 상품의 부모 구조 분석:")
for idx, img in enumerate(all_rocket_imgs[:3]):  # 처음 3개만
    parent = img.parent
    grandparent = parent.parent if parent else None
    great_grandparent = grandparent.parent if grandparent else None
    
    print(f"\n{idx+1}번째 로켓배송 이미지:")
    print(f"  부모 태그: {parent.name if parent else 'None'}")
    print(f"  조부모 태그: {grandparent.name if grandparent else 'None'}")
    print(f"  증조부모 태그: {great_grandparent.name if great_grandparent else 'None'}")
    
    # small_product_div까지 찾기
    current = img
    while current and 'small_product_div' not in current.get('class', []):
        current = current.parent
    
    if current:
        print(f"  small_product_div까지 거리: {len(list(img.parents)) - len(list(current.parents))} 단계")