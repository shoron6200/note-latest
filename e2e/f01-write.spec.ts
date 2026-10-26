import { back, button, expect, field, newNote, openApp, settle, test } from './fixtures';

test.describe('F01 write a quick text note', () => {
  test('F01-H1 write a note, it survives a reload', async ({ page }) => {
    await openApp(page);
    await expect(page.getByText('A blank page')).toBeVisible();
    await newNote(page, 'Note');
    await field(page, 'Title').fill('Dentist');
    await field(page, 'Write something…').fill('Call on Monday');
    await settle(page, 700);
    await back(page);
    await expect(button(page, /^Dentist Call on Monday/)).toBeVisible();
    await page.reload();
    await expect(button(page, /^Dentist Call on Monday/)).toBeVisible();
  });

  test('F01-E1 an empty new note is discarded', async ({ page }) => {
    await openApp(page);
    await newNote(page, 'Note');
    await back(page);
    await page.waitForTimeout(500);
    await expect(page.getByText('Empty note')).toHaveCount(0);
    await expect(page.getByText('A blank page')).toBeVisible();
  });

  test('F01-E2 very long title and body', async ({ page }) => {
    await openApp(page);
    await newNote(page, 'Note');
    await field(page, 'Title').fill('T'.repeat(400));
    await field(page, 'Write something…').fill('word '.repeat(2000));
    await settle(page, 700);
    expect((await field(page, 'Title').inputValue()).length).toBe(300);
    await back(page);
    const card = button(page, /^T{20}/);
    await expect(card).toBeVisible();
    const box = (await card.boundingBox())!;
    expect(box.height).toBeLessThan(400); // title 2 lines + preview 8 lines
  });

  test('F01-E3 emoji and accents are kept and searchable', async ({ page }) => {
    await openApp(page);
    await newNote(page, 'Note');
    await field(page, 'Title').fill('Café ☕ 🎉');
    await field(page, 'Write something…').fill('Žabljak — ćevapi, čaj');
    await settle(page, 700);
    await back(page);
    await page.reload();
    await expect(page.getByText('Café ☕ 🎉')).toBeVisible();
    await button(page, 'Search your notes').click();
    await field(page, 'Search your notes').fill('cevapi');
    await expect(page.getByText('1 note')).toBeVisible();
  });

  test('F01-E4 back pressed inside the autosave delay still saves', async ({ page }) => {
    await openApp(page);
    await newNote(page, 'Note');
    await field(page, 'Title').fill('Quick');
    await button(page, 'Back').click(); // no wait for the autosave
    await page.waitForURL('**/');
    await page.reload();
    await expect(page.getByText('Quick')).toBeVisible();
  });

  test('F01-E5 refresh inside the autosave delay still saves', async ({ page }) => {
    await openApp(page);
    await newNote(page, 'Note');
    await field(page, 'Title').fill('Saved before refresh');
    await settle(page, 700);
    await field(page, 'Write something…').fill('typed just now');
    await page.reload(); // inside the 500 ms debounce
    await page.goto('/');
    await expect(button(page, /^Saved before refresh typed just now/)).toBeVisible();
  });

  test('F01-E6 double-click on Note makes one note', async ({ page }) => {
    await openApp(page);
    await button(page, 'New').click();
    await button(page, 'Note').dblclick();
    await settle(page);
    await field(page, 'Title').fill('Only one');
    await settle(page, 700);
    await back(page);
    await page.reload();
    await expect(button(page, /^Only one/)).toHaveCount(1);
    await expect(page.getByText('Empty note')).toHaveCount(0);
  });

  test('F01-E7 a second tab explains itself (web only: one tab can hold the database)', async ({ page, context }) => {
    await openApp(page);
    const second = await context.newPage();
    await second.goto('/');
    await expect(second.getByText('Pocketleaf is open in another tab')).toBeVisible({ timeout: 10_000 });
    await second.close();
  });

  test('F01-E8 keyboard only', async ({ page }) => {
    await openApp(page);
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press('Tab');
      if ((await page.evaluate(() => document.activeElement?.getAttribute('aria-label'))) === 'New') break;
    }
    await page.keyboard.press('Enter');
    await expect(button(page, 'Note')).toBeVisible();
    await button(page, 'Note').focus();
    await page.keyboard.press('Enter');
    await settle(page);
    // A new note starts in the body, like a sheet of paper; the title is optional.
    await page.keyboard.type('Typed with keys');
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.type('Keys');
    await settle(page, 700);
    await page.goto('/');
    await expect(button(page, /^Keys Typed with keys/)).toBeVisible();
  });
});
