import { test, expect } from '@playwright/test';

/* eslint-disable @typescript-eslint/no-explicit-any */

test.describe('Innerbloom Fluid', () => {
  test('boots without a fatal overlay and exposes the app', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error' && !m.text().includes('favicon')) errors.push(m.text());
    });

    await page.goto('/');
    await expect(page).toHaveTitle(/Innerbloom/i);

    const canvas = page.locator('#scene');
    await expect(canvas).toBeVisible();

    await page.waitForFunction(() => Boolean((window as any).__app));
    expect(await page.locator('.fatal').count()).toBe(0);
    expect(errors).toEqual([]);
  });

  test('renders a populated toolbar with palette swatches', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => Boolean((window as any).__app));
    await expect(page.locator('.toolbar')).toBeVisible();
    expect(await page.locator('.swatch').count()).toBe(4);
  });

  test('drag injects visible color into the fluid', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => Boolean((window as any).__app));

    const result = await page.evaluate(() => {
      const app = (window as any).__app;
      const gl = app.ctx.gl as WebGL2RenderingContext;
      app.reset();
      for (let k = 0; k < 16; k++) {
        app.sim.splat(0.5, 0.5, (k % 2 ? 1 : -1) * 6000, ((k % 3) - 1) * 6000, {
          r: 0.4,
          g: 0.25,
          b: 0.6,
        });
        app.sim.step(1 / 60);
      }
      app.sim.render(0);
      const w = gl.drawingBufferWidth;
      const h = gl.drawingBufferHeight;
      const px = new Uint8Array(w * h * 4);
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
      let nonblack = 0;
      for (let i = 0; i < px.length; i += 4) {
        if (px[i] > 8 || px[i + 1] > 8 || px[i + 2] > 8) nonblack++;
      }
      return { w, h, nonblack };
    });

    expect(result.w).toBeGreaterThan(0);
    expect(result.nonblack).toBeGreaterThan(200);
  });

  test('switching palette updates the document background', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => Boolean((window as any).__app));
    const before = await page.evaluate(() => document.body.style.background);
    await page.evaluate(() => (window as any).__app.setPalette('sunset'));
    const after = await page.evaluate(() => document.body.style.background);
    expect(after).not.toBe(before);
  });
});
