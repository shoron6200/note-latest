import { button, expect, openApp, test } from './fixtures';

test('S12-H1 dark theme applies and survives a reload', async ({ page }) => {
  await openApp(page);
  await page.goto('/settings');
  await page.getByRole('radio', { name: 'Dark' }).click();
  await expect(page.getByRole('radio', { name: 'Dark' })).toHaveAttribute('aria-checked', 'true');
  await page.reload();
  await expect(page.getByRole('radio', { name: 'Dark' })).toHaveAttribute('aria-checked', 'true');
  await page.goto('/');
  await expect(page.getByText('A blank page')).toHaveCSS('color', 'rgb(228, 233, 227)'); // dark text
});

test('S12-H2 sort by title and list view', async ({ page }) => {
  await openApp(page, { demo: true });
  await page.goto('/settings');
  await page.getByRole('radio', { name: 'Title' }).click();
  await expect(page.getByRole('radio', { name: 'Title' })).toHaveAttribute('aria-checked', 'true');
  // The index (one column) is the default view: the grid switch starts off.
  const grid = page.getByRole('switch', { name: 'Show notes as a grid', exact: true });
  await expect(grid).toHaveAttribute('aria-checked', 'false');
  await page.goto('/');
  await expect(button(page, 'Show as grid')).toBeVisible();
  // Pinned first, then A to Z, untitled last; one column, so order is top to bottom.
  const order = ['Ideas for the weekend', 'Bike service', 'Book quotes', 'Groceries', 'Monday stand-up', 'Packing', 'Wi-Fi at the cabin'];
  const ys: number[] = [];
  for (const title of order) ys.push((await button(page, new RegExp(`^${title}`)).boundingBox())!.y);
  expect([...ys].sort((a, b) => a - b)).toEqual(ys);
});
