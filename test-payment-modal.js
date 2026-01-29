const puppeteer = require('puppeteer');

const TARGET_URL = 'http://52.63.232.141:8080';

async function testPaymentSwitchModal() {
  console.log('=== 납부계정 전환 확인 모달 테스트 시작 ===\n');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    // 1. 페이지 접속
    console.log('1. 페이지 접속 중...');
    await page.goto(TARGET_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    console.log('   페이지 로드 완료');

    // 2. 현재 페이지 제목 확인
    const title = await page.title();
    console.log(`   페이지 제목: ${title}`);

    // 3. 고객관리 메뉴 찾기
    console.log('\n2. 고객관리 메뉴 찾는 중...');
    await page.waitForSelector('button, a', { timeout: 5000 });

    // 메뉴 버튼들 확인
    const buttons = await page.$$eval('button', btns =>
      btns.map(b => b.textContent.trim()).filter(t => t.length > 0)
    );
    console.log(`   발견된 버튼들: ${buttons.slice(0, 10).join(', ')}`);

    // 고객관리 클릭
    const customerBtn = await page.$('button:has-text("고객관리")');
    if (customerBtn) {
      await customerBtn.click();
      console.log('   고객관리 클릭 완료');
      await page.waitForTimeout(1000);
    } else {
      // 다른 방법으로 찾기
      const allBtns = await page.$$('button');
      for (const btn of allBtns) {
        const text = await btn.evaluate(el => el.textContent);
        if (text && text.includes('고객')) {
          await btn.click();
          console.log('   고객 관련 버튼 클릭');
          break;
        }
      }
    }

    // 4. 스크린샷 저장
    await page.screenshot({ path: 'C:/bottle/dlive/frontend/test-screenshot.png', fullPage: true });
    console.log('\n3. 스크린샷 저장: test-screenshot.png');

    // 5. 현재 페이지 HTML 일부 출력
    const bodyText = await page.$eval('body', el => el.innerText.substring(0, 500));
    console.log('\n4. 페이지 내용 (처음 500자):');
    console.log(bodyText);

    console.log('\n=== 테스트 완료 ===');

  } catch (error) {
    console.error('테스트 오류:', error.message);
  } finally {
    await browser.close();
  }
}

testPaymentSwitchModal();
