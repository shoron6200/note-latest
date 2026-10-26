import { back, button, expect, openApp, openCard, settle, test } from './fixtures';

const trashIt = async (page: import('@playwright/test').Page) => {
  await button(page, 'More').click();
  await button(page, 'Move to trash').click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Move to trash' }).click();
  await settle(page);
};

test('F07-H1 share is offered', async ({ page }) => {
  await openApp(page, { demo: true });
  await openCard(page, 'Groceries');
  await button(page, 'More').click();
  await expect(button(page, 'Share')).toBeVisible();
});

test.describe('F08 delete and recover', () => {
  test('F08-H1 trash then Undo', async ({ page }) => {
    await openApp(page, { demo: true });
    await openCard(page, 'Bike service');
    await trashIt(page);
    await expect(page.getByText('Moved to trash.')).toBeVisible();
    await button(page, 'Undo').click();
    await expect(button(page, /^Bike service/)).toBeVisible();
  });

  test('F08-E1/E2 open a trashed note read-only, restore it', async ({ page }) => {
    await openApp(page, { demo: true });
    await page.goto('/trash');
    await openCard(page, 'Old shopping list');
    await expect(button(page, 'Restore')).toBeVisible();
    await button(page, 'Restore').click();
    await back(page);
    await expect(page.getByText('The trash is empty')).toBeVisible();
    await page.goto('/');
    await expect(button(page, /^Old shopping list/)).toBeVisible();
  });

  test('F08-E2 a trashed note opened directly is read-only', async ({ page }) => {
    await openApp(page, { demo: true });
    await openCard(page, 'Bike service');
    const url = page.url();
    await trashIt(page);
    await page.goto(url);
    await expect(page.getByText('This note is in the trash.')).toBeVisible();
    await expect(page.getByLabel('Title', { exact: true }).filter({ visible: true })).not.toBeEditable();
  });

  test('F08-E3/E4 delete for good, empty the trash', async ({ page }) => {
    await openApp(page, { demo: true });
    await openCard(page, 'Bike service');
    await trashIt(page);
    await page.goto('/trash');
    await openCard(page, 'Bike service');
    await button(page, 'More').click();
    await button(page, 'Delete for good').click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete for good' }).click();
    await expect(page.getByText('Deleted for good.')).toBeVisible();
    await button(page, 'More').click();
    await button(page, 'Empty trash').click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Empty trash' }).click();
    await expect(page.getByText('The trash is empty')).toBeVisible();
    await back(page);
  });
});
