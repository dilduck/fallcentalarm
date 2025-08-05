import json

try:
    with open('data/current-products.json', 'r', encoding='utf-8') as f:
        products = json.load(f)
        
    print(f"서버에 저장된 상품 수: {len(products)}개")
    
    # 카테고리별 통계
    super_deals = sum(1 for p in products if p.get('isSuperDeal', False))
    electronics = sum(1 for p in products if p.get('isElectronic', False))
    rocket = sum(1 for p in products if p.get('isRocket', False))
    
    print(f"\n카테고리별 통계:")
    print(f"- 초특가(49% 이상): {super_deals}개")
    print(f"- 가전/디지털: {electronics}개")
    print(f"- 로켓배송: {rocket}개")
    
    # 할인율 분포
    discount_distribution = {}
    for p in products:
        rate = p.get('discountRate', 0)
        if rate >= 60:
            discount_distribution['60% 이상'] = discount_distribution.get('60% 이상', 0) + 1
        elif rate >= 50:
            discount_distribution['50-59%'] = discount_distribution.get('50-59%', 0) + 1
        elif rate >= 40:
            discount_distribution['40-49%'] = discount_distribution.get('40-49%', 0) + 1
        elif rate >= 30:
            discount_distribution['30-39%'] = discount_distribution.get('30-39%', 0) + 1
        else:
            discount_distribution['30% 미만'] = discount_distribution.get('30% 미만', 0) + 1
    
    print(f"\n할인율 분포:")
    for range_name, count in sorted(discount_distribution.items(), reverse=True):
        print(f"- {range_name}: {count}개")
        
except Exception as e:
    print(f"오류: {e}")