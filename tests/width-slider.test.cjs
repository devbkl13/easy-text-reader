'use strict';
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    const root = path.join(__dirname, '..');
    for (const entry of ['index.html', 'easy-text-reader-standalone.html']) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, offline: true });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(pathToFileURL(path.join(root, entry)).href);
      await page.locator('#readTab').click();
      await page.waitForFunction(() => window.scrollY === 0);
      await page.locator('#settingsButton').click();
      const slider = page.locator('#readingWidth');
      await slider.fill('480');
      const initial = await slider.boundingBox();
      const y = initial.y + initial.height / 2;
      const left = initial.x + 8;
      const right = initial.x + initial.width - 8;
      const initialArticleWidth = await page.locator('#readerArticle').evaluate(el => el.getBoundingClientRect().width);
      await page.mouse.move(left, y);
      await page.mouse.down();
      let previous = 480;
      for (let step = 0; step <= 12; step++) {
        await page.mouse.move(left + (right - left) * step / 12, y);
        const box = await slider.boundingBox();
        for (const key of ['x', 'y', 'width', 'height']) assert.ok(Math.abs(box[key] - initial[key]) < 1, entry + ': slider ' + key + ' stays fixed during a continuous drag');
        const value = Number(await slider.inputValue());
        assert.ok(value >= previous, 'moving right must not move the value backwards');
        previous = value;
      }
      assert.equal(previous, 1040, 'drag reaches maximum');
      assert.ok(await page.locator('#readerArticle').evaluate(el => el.getBoundingClientRect().width) > initialArticleWidth, 'article updates live while dragging');
      for (let step = 12; step >= 0; step--) {
        await page.mouse.move(left + (right - left) * step / 12, y);
        const box = await slider.boundingBox();
        assert.ok(Math.abs(box.x - initial.x) < 1 && Math.abs(box.y - initial.y) < 1, 'reverse drag keeps its target still');
        const value = Number(await slider.inputValue());
        assert.ok(value <= previous, 'moving left must not move the value forwards');
        previous = value;
      }
      await page.mouse.up();
      assert.equal(previous, 480, 'reverse drag reaches minimum');
      await slider.press('ArrowRight');
      assert.equal(await slider.inputValue(), '500', 'keyboard still adjusts the range');
      await page.setViewportSize({ width: 320, height: 680 });
      const panel = await page.locator('#readingSettings').boundingBox();
      assert.ok(panel.x >= 0 && panel.y >= 0 && panel.x + panel.width <= 320 && panel.y + panel.height <= 680, 'open panel stays inside a resized mobile viewport');
      await page.locator('#closeSettings').click();
      await page.locator('#settingsButton').click();
      assert.equal(await page.locator('#readingSettings').isVisible(), true, 'panel can reopen after layout changes');
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('#readingSettings').isVisible(), false, 'Escape still closes the panel');
      assert.deepEqual(errors, []);
      await context.close();
    }
    console.log('PASS: continuous forward/reverse pointer drag, fixed slider geometry, live article width, keyboard, viewport resize, close/reopen, offline source and portable app.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
