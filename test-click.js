const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.toString()));
  
  await page.goto('http://localhost:3000/papers/seed-paper-clinical-retrieval', { waitUntil: 'networkidle0' });
  
  console.log('Page loaded. Clicking button...');
  // Find the button that contains "Share as Card"
  const buttons = await page.$$('button');
  let clicked = false;
  for (const btn of buttons) {
    const text = await page.evaluate(el => el.textContent, btn);
    if (text && text.includes('Share as Card')) {
      await btn.click();
      clicked = true;
      break;
    }
  }
  
  if (!clicked) {
    console.log('Button not found');
  } else {
    console.log('Clicked. Waiting 3 seconds for action to complete...');
    await new Promise(r => setTimeout(r, 3000));
  }
  
  await browser.close();
})();
