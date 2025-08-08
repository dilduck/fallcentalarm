// 브라우저 콘솔에서 실행하여 닫기 버튼 문제를 디버깅하는 스크립트

// 모든 닫기 버튼 찾기
const closeButtons = document.querySelectorAll('button[data-action="close"]');
console.log(`총 ${closeButtons.length}개의 닫기 버튼 발견`);

// 각 버튼의 데이터 속성 확인
closeButtons.forEach((btn, index) => {
    console.log(`버튼 ${index + 1}:`);
    console.log(`  - alertId: ${btn.dataset.alertId}`);
    console.log(`  - productId: ${btn.dataset.productId}`);
    console.log(`  - HTML: ${btn.outerHTML}`);
});

// 첫 번째 닫기 버튼 수동 클릭 테스트
if (closeButtons.length > 0) {
    console.log('\n첫 번째 닫기 버튼을 수동으로 클릭 시도...');
    const firstButton = closeButtons[0];
    const clickEvent = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: window
    });
    firstButton.dispatchEvent(clickEvent);
}

// 이벤트 리스너 확인
console.log('\n문서에 등록된 이벤트 리스너 확인:');
console.log('app.documentClickHandler:', typeof window.app?.documentClickHandler);

// app 객체 확인
console.log('\napp 객체 상태:');
console.log('app.alerts:', window.app?.alerts);
console.log('app.closedAlerts:', window.app?.closedAlerts);
console.log('app.userSeenProducts:', window.app?.userSeenProducts);