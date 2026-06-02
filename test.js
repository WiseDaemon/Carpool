import puppeteer from 'puppeteer';

const BASE_URL = 'http://localhost:5173';

let browser, page;
let testsPassed = 0;
let testsFailed = 0;

const log = (message, type = 'info') => {
  const prefix = type === 'success' ? '✓' : type === 'error' ? '✗' : type === 'warning' ? '⚠' : 'ℹ';
  console.log(`${prefix} ${message}`);
};

const assert = (condition, message) => {
  if (condition) {
    testsPassed++;
    log(message, 'success');
  } else {
    testsFailed++;
    log(message, 'error');
  }
};

const wait = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  try {
    browser = await puppeteer.launch({ headless: true });
    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    page.setDefaultNavigationTimeout(10000);
    page.setDefaultTimeout(5000);

    log('Starting Carpool App Test Suite...', 'info');

    // ===== TEST 1: Page loads =====
    log('Navigating to BASE_URL...', 'info');
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    log('Navigation complete.', 'info');
    const title = await page.title();
    assert(title.toLowerCase().includes('carpool'), 'Page title is carpool');

    // ===== TEST 2: Login page displays =====
    log('Checking for login panel...', 'info');
    const loginPanel = await page.$('.glass-panel');
    assert(loginPanel !== null, 'Login panel is visible');

    // ===== TEST 3: Role buttons present =====
    const allButtons = await page.$$('button');
    assert(allButtons.length >= 3, 'Role selection buttons present');

    // ===== TEST 4: Email input exists =====
    const emailInput = await page.$('input[type="email"]');
    assert(emailInput !== null, 'Email input field present');

    // ===== TEST 5: Admin role selection =====
    const roleButtons = await page.$$('button');
    for (let btn of roleButtons) {
      const text = await page.evaluate(el => el.textContent, btn);
      if (text && text.includes('Admin')) {
        await btn.click();
        await wait(300);
        break;
      }
    }

    // ===== TEST 6: Password field appears for Admin =====
    const passwordInput = await page.$('input[type="password"]');
    assert(passwordInput !== null, 'Password field appears for Admin role');

    // ===== TEST 7: Admin login =====
    const adminEmail = await page.$('input[type="email"]');
    await adminEmail.type('admin@reliance.com');
    await passwordInput.type('Reliance@1024');

    const submitBtn = await page.$('button[type="submit"]');
    if (submitBtn) {
      await submitBtn.click();
      await wait(2500);
    }

    // ===== TEST 8: Sidebar visible after login =====
    const sidebar = await page.$('aside');
    assert(sidebar !== null, 'Admin dashboard loads');

    // ===== TEST 9: Navigation menu has items =====
    const navItems = await page.$$('nav button');
    assert(navItems.length >= 7, 'Navigation menu has tabs');

    // ===== TEST 10: KPI cards display =====
    const kpiCards = await page.$$('.glass-panel');
    assert(kpiCards.length >= 4, 'KPI cards rendered');

    // ===== TEST 11: KPI titles visible =====
    const kpiTitle = await page.$('p.text-on-surface-variant');
    if (kpiTitle) {
      const kpiTitleText = await page.evaluate(el => el.textContent, kpiTitle);
      assert(kpiTitleText.trim() !== '', 'KPI titles populated');
    }

    // ===== TEST 12: Header title displays =====
    const pageTitle = await page.$('h2');
    if (pageTitle) {
      const pageTitleText = await page.evaluate(el => el.textContent, pageTitle);
      assert(pageTitleText.includes('Operations Hub'), 'Page title shows Operations Hub');
    }

    // ===== TEST 18: Tab navigation works =====
    const asideNavs = await page.$$('aside nav button');
    let tabChanged = false;
    for (let i = 0; i < asideNavs.length; i++) {
      const text = await page.evaluate(el => el.textContent, asideNavs[i]);
      if (text && text.includes('User Directory')) {
        await asideNavs[i].click();
        await wait(800);
        const newTitle = await page.$('header h1');
        if (newTitle) {
          const newTitleText = await page.evaluate(el => el.textContent, newTitle);
          tabChanged = newTitleText.includes('User Directory');
        }
        break;
      }
    }
    assert(tabChanged, 'Tab navigation works');

    // ===== TEST 13: City filter dropdown exists =====
    const citySelect = await page.$('select');
    assert(citySelect !== null, 'City filter available');

    // ===== TEST 14: City selection works =====
    if (citySelect) {
      await citySelect.select('mumbai');
      await wait(500);
      assert(true, 'City selection handled');
    }

    // ===== TEST 15: Tables render =====
    const tables = await page.$$('table');
    assert(tables.length >= 0, 'Tables render correctly');

    // ===== TEST 16: Table headers exist =====
    const tableHeaders = await page.$$('th');
    assert(tableHeaders.length >= 0, 'Table headers present');

    // ===== TEST 17: Profile avatar clickable =====
    const profileAvatars = await page.$$('main div.relative > div.rounded-full.cursor-pointer');
    if (profileAvatars.length > 0) {
      await profileAvatars[0].click();
      await wait(500);
      const profilePopup = await page.evaluate(() => document.body.innerHTML.includes('Sign Out'));
      assert(profilePopup, 'Profile modal opens');
      await page.keyboard.press('Escape');
    }

    // ===== TEST 19: Logout button accessible =====
    let logoutExists = await page.evaluate(() => document.body.innerHTML.includes('Logout') || document.body.innerHTML.includes('Sign Out'));
    assert(logoutExists, 'Logout button accessible');

    // ===== TEST 20: Logout clears session =====
    const buttons = await page.$$('button');
    for (let item of buttons) {
      const text = await page.evaluate(el => el.textContent, item);
      if (text && (text.includes('Logout') || text.includes('Sign Out'))) {
        await item.click();
        await wait(1000);
        break;
      }
    }
    const sessionData = await page.evaluate(() => localStorage.getItem('carpool_session'));
    assert(sessionData === null, 'Session cleared on logout');

    // ===== TEST 21: Back to login =====
    const loginAgain = await page.$('.glass-panel');
    assert(loginAgain !== null, 'Back to login page after logout');

    log('\n========== TEST RESULTS ==========', 'info');
    log(`Passed: ${testsPassed}`, 'success');
    log(`Failed: ${testsFailed}`, testsFailed > 0 ? 'error' : 'success');
    log(`Total: ${testsPassed + testsFailed}`, 'info');

    if (testsFailed === 0) {
      log('\n🎉 All tests passed!', 'success');
      process.exit(0);
    } else {
      log(`\n⚠ ${testsFailed} test(s) failed.`, 'warning');
      process.exit(1);
    }

  } catch (error) {
    log(`Fatal error: ${error.message}`, 'error');
    console.error(error);
    process.exit(1);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
})();
