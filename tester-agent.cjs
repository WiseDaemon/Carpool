const puppeteer = require('puppeteer');

async function runTests() {
  console.log('Launching Puppeteer to test http://localhost:5174...');

  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  let passed = 0;
  let failed = 0;

  async function report(name, testFn) {
    try {
      await page.goto('http://localhost:5174');
      await page.evaluate(() => localStorage.clear());
      await testFn();
      console.log(`✅ PASS: ${name}`);
      passed++;
    } catch (e) {
      console.error(`❌ FAIL: ${name}`);
      console.error(e);
      failed++;
    }
  }

  try {
    await report('1. Passenger Login Flow', async () => {
      // Register user first to ensure they exist (ignoring if they already exist)
      await fetch('http://localhost:3001/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Rohan Sharma', email: 'rohan.sharma@reliance.com', password: 'Password123!', role: 'Passenger' })
      });

      await page.goto('http://localhost:5174');
      await page.waitForSelector('.glass-panel');
      const buttons = await page.$$('button');
      for (const btn of buttons) {
        const text = await page.evaluate(el => el.textContent, btn);
        if (text === 'Passenger') await btn.click();
      }
      await page.waitForSelector('input[type="email"]');
      await page.type('input[type="email"]', 'rohan.sharma@reliance.com');
      await page.type('input[type="password"]', 'Password123!');
      
      const submitBtn = await page.$('button[type="submit"]');
      await submitBtn.click();
      
      await page.waitForFunction(() => {
        return document.body.innerText.includes('Rohan Sharma') || document.body.innerText.includes('Passenger Dashboard');
      }, { timeout: 5000 });
    });

    await report('2. Admin Login Success', async () => {
      await page.goto('http://localhost:5174');
      await page.waitForSelector('.glass-panel');
      const buttons = await page.$$('button');
      for (const btn of buttons) {
        const text = await page.evaluate(el => el.textContent, btn);
        if (text === 'Admin') await btn.click();
      }
      
      await page.waitForSelector('input[type="email"]');
      await page.waitForSelector('input[type="password"]');
      
      const inputs = await page.$$('input');
      await inputs[0].type('admin@reliance.com');
      await inputs[1].type('Reliance@1024'); // New secure admin password
      
      const submitBtn = await page.$('button[type="submit"]');
      await submitBtn.click();
      
      await page.waitForFunction(() => {
        return document.body.innerText.includes('Overview') || 
               document.body.innerText.includes('Admin Dashboard');
      }, { timeout: 5000 });
    });

    await report('3. Admin Registration Blocked (Security Test)', async () => {
      const res = await fetch('http://localhost:3001/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Hacker', email: 'hacker@hack.com', password: 'Password123!', role: 'Admin' })
      });
      
      if (res.status !== 403) {
        throw new Error(`Expected 403 Forbidden for Admin registration, got ${res.status}`);
      }
    });

    await report('4. Pool Host Login Flow', async () => {
      await fetch('http://localhost:3001/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Priya Patel', email: 'priya.patel@reliance.com', password: 'Password123!', role: 'Pool Host' })
      });

      await page.goto('http://localhost:5174');
      await page.waitForSelector('.glass-panel');
      const buttons = await page.$$('button');
      for (const btn of buttons) {
        const text = await page.evaluate(el => el.textContent, btn);
        if (text === 'Pool Host') await btn.click();
      }
      await page.waitForSelector('input[type="email"]');
      await page.type('input[type="email"]', 'priya.patel@reliance.com');
      await page.type('input[type="password"]', 'Password123!');
      
      const submitBtn = await page.$('button[type="submit"]');
      await submitBtn.click();
      
      await page.waitForFunction(() => {
        return document.body.innerText.includes('Priya Patel') || document.body.innerText.includes('Pool Host Dashboard');
      }, { timeout: 5000 });
    });

    await report('5. Admin Real-Time SOS Notification (WebSocket)', async () => {
      await page.goto('http://localhost:5174');
      await page.waitForSelector('.glass-panel');
      const buttons = await page.$$('button');
      for (const btn of buttons) {
        const text = await page.evaluate(el => el.textContent, btn);
        if (text === 'Admin') await btn.click();
      }
      
      await page.waitForSelector('input[type="email"]');
      await page.waitForSelector('input[type="password"]');
      
      const inputs = await page.$$('input');
      await inputs[0].type('admin@reliance.com');
      await inputs[1].type('Reliance@1024');
      
      const submitBtn = await page.$('button[type="submit"]');
      await submitBtn.click();
      
      await page.waitForFunction(() => {
        return document.body.innerText.includes('Overview');
      }, { timeout: 5000 });

      // Trigger an SOS Alert from the frontend (logged in as Admin, so using their token)
      const randomSOS = `Test SOS Alert ${Math.random()}`;
      await page.evaluate(async (sosMsg) => {
        const token = localStorage.getItem('token');
        await fetch('http://localhost:3001/api/incidents/create', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ reported_by: 1, type: sosMsg })
        });
      }, randomSOS);

      // Verify the toast notification appears on the Admin's screen instantly via WebSockets
      await page.waitForFunction((sosMsg) => {
        return document.body.innerText.includes(sosMsg);
      }, { timeout: 5000 }, `New SOS Alert triggered: ${randomSOS}`);
    });

  } finally {
    await browser.close();
    console.log(`\nTest Summary: ${passed} Passed, ${failed} Failed`);
    process.exit(failed > 0 ? 1 : 0);
  }
}

runTests().catch(e => {
  console.error(e);
  process.exit(1);
});
