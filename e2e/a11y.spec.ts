import { button, chooseFromGallery, expectAccessible, openApp, openCard, test } from './fixtures';

test.describe('every screen passes axe (no serious or critical issues)', () => {
  test('S01 home', async ({ page }) => {
    await openApp(page, { demo: true });
    await expectAccessible(page, 'S01');
  });
  test('S02 new menu', async ({ page }) => {
    await openApp(page, { demo: true });
    await button(page, 'New').click();
    await expectAccessible(page, 'S02');
  });
  test('S03/S05/S06/S07/S10 editor and its sheets', async ({ page }) => {
    await openApp(page, { demo: true });
    await openCard(page, 'Ideas for the weekend');
    await expectAccessible(page, 'S03');
    for (const [label, id] of [['Colour', 'S05'], ['Font and size', 'S06'], ['Remind me', 'S07'], ['Add', 'S14'], ['More', 'S10']] as const) {
      await button(page, label).click();
      await page.waitForTimeout(400);
      await expectAccessible(page, id);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }
  });
  test('S15 photo viewer', async ({ page }) => {
    await openApp(page);
    await button(page, 'New').click();
    await button(page, 'Note').click();
    await page.waitForTimeout(600);
    const chooser = chooseFromGallery(page);
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEklEQVR4nGPQaPiPFTEMLQkA9ywe4YzZq1EAAAAASUVORK5CYII=', 'base64');
    await (await chooser).setFiles([{ name: 'a.png', mimeType: 'image/png', buffer: png }, { name: 'b.png', mimeType: 'image/png', buffer: png }]);
    await expectAccessible(page, 'S03-media');
    await button(page, 'Photo 1 of 2').click();
    await page.waitForTimeout(600);
    await expectAccessible(page, 'S15');
  });
  test('S04 checklist', async ({ page }) => {
    await openApp(page, { demo: true });
    await openCard(page, 'Groceries');
    await expectAccessible(page, 'S04');
  });
  for (const [route, id] of [['/folders', 'S08'], ['/search', 'S09'], ['/trash', 'S11'], ['/settings', 'S12'], ['/settings/backup', 'S13'], ['/settings/telegram', 'S16']] as const) {
    test(`${id} ${route}`, async ({ page }) => {
      await openApp(page, { demo: true });
      await page.goto(route);
      await page.waitForTimeout(800);
      await expectAccessible(page, id);
    });
  }
});
