import { back, button, drawerTo, expect, field, newNote, openApp, openCard, settle, test } from './fixtures';

/** Folders are managed from the drawer now (Keep layout), on their own screen. */
async function createFolder(page: import('@playwright/test').Page, name: string) {
  await page.goto('/folders');
  await button(page, 'New folder').click();
  await field(page, 'Name').fill(name);
  await button(page, 'Create').click();
}

test.describe('F04 folders', () => {
  test('F04-H1 create, move a note in, filter', async ({ page }) => {
    await openApp(page, { demo: true });
    await createFolder(page, 'Health');
    await expect(page.getByText('Health')).toBeVisible();
    await page.goto('/');
    await openCard(page, 'Bike service');
    await button(page, 'More').click();
    await button(page, 'Move to folder').click();
    await page.getByRole('radio', { name: 'Health' }).click();
    await expect(page.getByText('Moved to Health.')).toBeVisible();
    await back(page);
    await drawerTo(page, 'Health');
    await expect(button(page, /^Bike service/)).toBeVisible();
    await expect(button(page, /^Groceries/)).toHaveCount(0);
  });

  test('F04-N1 duplicate name in another case is refused', async ({ page }) => {
    await openApp(page, { demo: true });
    await createFolder(page, 'wORK');
    await expect(page.getByText('There’s already a folder with this name.')).toBeVisible();
  });

  test('F04-N2 empty name is refused', async ({ page }) => {
    await openApp(page);
    await createFolder(page, '   ');
    await expect(page.getByText('Give the folder a name.')).toBeVisible();
  });

  test('F04-E1 a 60-character name is kept in full', async ({ page }) => {
    await openApp(page);
    const name = 'A very long folder name that keeps going until sixty chars!!';
    expect(name.length).toBe(60);
    await createFolder(page, name);
    await page.goto('/folders');
    await expect(page.getByText(name)).toBeVisible();
  });

  test('F04-E2/E3 rename, then delete a folder: its notes stay', async ({ page }) => {
    await openApp(page, { demo: true });
    await page.goto('/folders');
    await button(page, 'Rename Work').click();
    await field(page, 'Name').fill('Office');
    await button(page, 'Rename').click();
    await expect(page.getByText('Office')).toBeVisible();
    await button(page, 'Delete folder Office').click();
    await expect(page.getByText('Its note stays in All, just without a folder.')).toBeVisible();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete folder' }).click();
    await settle(page);
    await page.goto('/');
    await expect(button(page, /^Monday stand-up/)).toBeVisible();
    await button(page, 'Open menu').click();
    await expect(page.getByRole('navigation').getByRole('button', { name: 'Office' })).toHaveCount(0);
  });
});
