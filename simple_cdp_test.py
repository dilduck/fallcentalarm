import asyncio
import aiohttp
import json
from datetime import datetime

async def fetch_fallcent():
    """Simple HTTP request to fetch fallcent.com"""
    print("Fetching fallcent.com...")
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
    }
    
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get('https://fallcent.com/', headers=headers) as response:
                html = await response.text()
                
                # Count products
                product_count = html.count('small_product_div')
                thumbnail_count = html.count('coupangcdn.com/thumbnails')
                
                print("\nfallcent.com 분석 결과:")
                print(f"- HTML 크기: {len(html)} bytes")
                print(f"- 'small_product_div' 출현 횟수: {product_count}")
                print(f"- 쿠팡 썸네일 이미지 수: {thumbnail_count}")
                
                # Save HTML for analysis
                filename = f"fallcent_html_{datetime.now().strftime('%Y%m%d_%H%M%S')}.html"
                with open(filename, 'w', encoding='utf-8') as f:
                    f.write(html)
                print(f"\nHTML 저장됨: {filename}")
                
                # Extract some thumbnails
                import re
                thumbnails = re.findall(r'(https://thumbnail\d+\.coupangcdn\.com/[^"]+)', html)
                print("\n발견된 썸네일 예시 (처음 5개):")
                for i, thumb in enumerate(thumbnails[:5]):
                    print(f"  {i+1}. {thumb}")
                
                return html
                
    except Exception as e:
        print(f"오류 발생: {e}")
        return None

if __name__ == "__main__":
    asyncio.run(fetch_fallcent())