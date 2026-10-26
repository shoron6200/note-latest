import { back, button, expect, field, newNote, openApp, openCard, settle, test } from './fixtures';

const items = (page: import('@playwright/test').Page) => page.getByLabel('Item text', { exact: true }).filter({ visible: true });

test.describe('F02 make a list and tick it off', () => {
  test('F02-H1 add two items, tick one', async ({ page }) => {
    await openApp(page);
    await newNote(page, 'List');
    await field(page, 'Title').fill('Shopping');
    await button(page, 'Add an item').click();
    await expect(items(page)).toHaveCount(1);
    await items(page).last().fill('Milk');
    await button(page, 'Add an item').click();
    await expect(items(page)).toHaveCount(2);
    await items(page).last().fill('Eggs');
    await settle(page, 700);
    await page.getByRole('checkbox', { name: 'Milk' }).click();
    await expect(page.getByText('Done (1)')).toBeVisible();
    await back(page);
    await expect(button(page, /^Shopping Eggs Milk/)).toBeVisible(); // open items first, ticked after
  });

  test('F02-E1/E2 Enter adds below and focuses, Backspace on empty removes', async ({ page }) => {
    await openApp(page);
    await newNote(page, 'List');
    await button(page, 'Add an item').click();
    await items(page).last().fill('first');
    await items(page).last().press('Enter');
    await expect(items(page)).toHaveCount(2);
    await expect(items(page).nth(1)).toBeFocused();
    await page.keyboard.press('Backspace');
    await expect(items(page)).toHaveCount(1);
  });

  test('F02-E3 pasted lines stay in one row', async ({ page }) => {
    await openApp(page);
    await newNote(page, 'List');
    await button(page, 'Add an item').click();
    await items(page).last().fill('one\ntwo');
    await expect(items(page).last()).toHaveValue('one two');
  });

  test('F02-E4 untick returns the item to the list', async ({ page }) => {
    await openApp(page, { demo: true });
    await openCard(page, 'Groceries');
    await page.getByRole('checkbox', { name: 'Bread' }).click();
    await expect(page.getByText('Done (1)')).toBeVisible();
    await expect(items(page).first()).toHaveValue('Oat milk');
  });

  test('F02-E6 drag an item down two places', async ({ page }) => {
    await openApp(page, { demo: true });
    await openCard(page, 'Groceries');
    const handle = page.getByLabel('Move Oat milk', { exact: true }).filter({ visible: true }).last();
    const b = (await handle.boundingBox())!;
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2 + 100, { steps: 20 });
    await page.mouse.up();
    await settle(page);
    await back(page);
    await openCard(page, 'Groceries');
    await expect(items(page).nth(2)).toHaveValue('Oat milk');
  });
});
