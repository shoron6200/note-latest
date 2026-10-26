import { button, expect, field, openApp, openCard, test } from './fixtures';

test.describe('F05 search', () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page, { demo: true });
    await button(page, 'Search your notes').click();
  });
  const q = (page: import('@playwright/test').Page, s: string) => field(page, 'Search your notes').fill(s);

  test('F05-H1 a word from a body', async ({ page }) => {
    await q(page, 'squeak');
    await expect(button(page, /^Bike service/)).toBeVisible();
  });
  test('F05-E2 a word only in a checklist item', async ({ page }) => {
    await q(page, 'basil');
    await expect(button(page, /^Groceries/)).toBeVisible();
    await expect(page.getByText('1 note')).toBeVisible();
  });
  test('F05-E3 search syntax characters do not break it', async ({ page }) => {
    for (const s of ['"', '(', 'AND', '*', 'a OR', '-x']) {
      await q(page, s);
      await page.waitForTimeout(300);
    }
    await q(page, 'quotes');
    await expect(button(page, /^Book quotes/)).toBeVisible();
  });
  test('F05-E4 trashed notes are not found', async ({ page }) => {
    await q(page, 'batteries');
    await expect(page.getByText('Nothing found')).toBeVisible();
  });
  test('F05-N1 nothing matches', async ({ page }) => {
    await q(page, 'zebra');
    await expect(page.getByText('No notes mention “zebra”.')).toBeVisible();
  });
  test('F05 opening a result opens the note', async ({ page }) => {
    await q(page, 'passport');
    await openCard(page, 'Packing');
    await expect(field(page, 'Title')).toHaveValue('Packing');
  });
});
