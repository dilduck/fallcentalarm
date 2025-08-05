const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'data', 'current-products.json');

try {
    const data = fs.readFileSync(filePath, 'utf8');
    const products = JSON.parse(data);
    console.log(`현재 파일에 저장된 상품 수: ${products.length}개`);
    
    // 최근 5개 상품 제목 표시
    if (products.length > 0) {
        console.log('\n최근 상품 5개:');
        products.slice(0, 5).forEach((p, i) => {
            console.log(`${i + 1}. ${p.title} - ${p.price}원`);
        });
    }
} catch (error) {
    console.error('파일 읽기 오류:', error.message);
}