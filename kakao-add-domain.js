const puppeteer = require('puppeteer');

const accounts = [
  { email: 'mconaone@dlive.kr', password: 'elffkdlqm1!', appId: '1401235' },
  { email: 'mconatwo@dlive.kr', password: 'elffkdlqm1!', appId: '1401239' },
];

const DOMAIN_TO_ADD = 'https://mcona.dlive.kr:7080';

async function addDomain(account) {
  const browser = await puppeteer.launch({
    headless: 'shell',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');

    // Login
    console.log(`[${account.email}] Logging in...`);
    await page.goto('https://accounts.kakao.com/login?continue=https%3A%2F%2Fdevelopers.kakao.com%2Flogin%3Fcontinue%3D%252F', {
      waitUntil: 'networkidle2', timeout: 30000
    });
    const emailInput = await page.$('input[name="loginId"]') || await page.$('input[type="text"]');
    if (emailInput) { await emailInput.click(); await emailInput.type(account.email, { delay: 30 }); }
    await new Promise(r => setTimeout(r, 500));
    const pwInput = await page.$('input[type="password"]');
    if (pwInput) { await pwInput.click(); await pwInput.type(account.password, { delay: 30 }); }
    await new Promise(r => setTimeout(r, 500));
    const loginBtn = await page.$('button[type="submit"]');
    if (loginBtn) await loginBtn.click();
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
    console.log(`[${account.email}] Logged in.`);

    // Go to platform-key page to find the JS key's platform registration
    console.log(`[${account.email}] Going to platform-key page...`);
    await page.goto(`https://developers.kakao.com/console/app/${account.appId}/config/platform-key`, {
      waitUntil: 'networkidle2', timeout: 15000
    });
    await new Promise(r => setTimeout(r, 5000));

    // Get page text to understand structure
    const pageText = await page.evaluate(() => document.body.innerText);
    console.log(`[${account.email}] Page text (first 2000):`);
    console.log(pageText.substring(0, 2000));

    // Look for "더보기" button near JavaScript key section, or "플랫폼 등록" link
    const links = await page.evaluate(() => {
      return [...document.querySelectorAll('a, button')].map(el => ({
        tag: el.tagName,
        text: el.textContent.trim().substring(0, 60),
        href: el.href || el.getAttribute('href') || '',
        className: el.className.toString().substring(0, 80),
      })).filter(el =>
        el.text.includes('더보기') || el.text.includes('등록') || el.text.includes('추가') ||
        el.text.includes('플랫폼') || el.text.includes('도메인') || el.text.includes('Web') ||
        el.href.includes('platform')
      );
    });
    console.log(`[${account.email}] Relevant links/buttons:`, JSON.stringify(links, null, 2));

    // Click "더보기" next to JavaScript key
    console.log(`[${account.email}] Looking for JavaScript key 더보기 button...`);
    const moreClicked = await page.evaluate(() => {
      const allEls = [...document.querySelectorAll('button, a, [role="button"]')];
      // Find elements with "더보기" text
      const moreBtns = allEls.filter(el => el.textContent.trim().includes('더보기'));
      const results = moreBtns.map((btn, idx) => {
        // Check nearby context
        const parent = btn.closest('div, section, tr, li');
        const context = parent ? parent.textContent.substring(0, 100) : '';
        return { idx, text: btn.textContent.trim(), context: context.substring(0, 100) };
      });
      return results;
    });
    console.log(`[${account.email}] 더보기 buttons:`, JSON.stringify(moreClicked, null, 2));

    // Click the 더보기 near JavaScript key
    const jsMoreClicked = await page.evaluate(() => {
      const allBtns = [...document.querySelectorAll('button, [role="button"]')];
      const moreBtns = allBtns.filter(el => el.textContent.trim() === '더보기');

      for (const btn of moreBtns) {
        const parent = btn.closest('[class]');
        const context = parent ? parent.textContent : '';
        if (context.includes('JavaScript') || context.includes('JS Key')) {
          btn.click();
          return { clicked: true, context: context.substring(0, 100) };
        }
      }
      // If not found by context, click the second one (first=REST, second=JS, third=Native)
      if (moreBtns.length >= 2) {
        moreBtns[1].click();
        return { clicked: true, index: 1, total: moreBtns.length };
      }
      return { clicked: false };
    });
    console.log(`[${account.email}] JS 더보기 clicked:`, JSON.stringify(jsMoreClicked));
    await new Promise(r => setTimeout(r, 2000));

    // Check what appeared after clicking 더보기
    const afterMore = await page.evaluate(() => document.body.innerText);
    console.log(`[${account.email}] After 더보기 (last 1000):`, afterMore.substring(afterMore.length - 1000));

    // Look for dropdown menu items
    const menuItems = await page.evaluate(() => {
      return [...document.querySelectorAll('[role="menuitem"], [role="option"], [class*="dropdown"] a, [class*="menu"] button, [class*="popover"] button, [class*="popover"] a')]
        .map(el => ({ tag: el.tagName, text: el.textContent.trim().substring(0, 60), href: el.href || '' }));
    });
    console.log(`[${account.email}] Menu items:`, JSON.stringify(menuItems, null, 2));

    // Look for platform registration or domain input
    const domainInputs = await page.evaluate(() => {
      return [...document.querySelectorAll('input')]
        .map(inp => ({ name: inp.name, placeholder: inp.placeholder, type: inp.type, value: inp.value }));
    });
    console.log(`[${account.email}] Inputs:`, JSON.stringify(domainInputs));

    return { email: account.email, appId: account.appId };
  } catch (err) {
    console.error(`[${account.email}] Error:`, err.message);
    return null;
  } finally {
    await browser.close();
  }
}

(async () => {
  // Only test with first account to understand page structure
  const r = await addDomain(accounts[0]);
})();
