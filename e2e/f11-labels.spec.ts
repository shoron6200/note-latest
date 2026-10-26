import type { Page } from '@playwright/test';

import { back, button, drawerTo, expect, expectAccessible, field, newNote, openApp, openCard, settle, test } from './fixtures';

/** The drawer's "Create new label" opens Edit labels with the new-label field ready. */
async function createLabel(page: Page, name: string) {
  await button(page, 'Open menu').click();
  await settle(page, 400);
  await page.getByRole('navigation').getByRole('button', { name: 'Create new label', exact: true }).click();
  await settle(page);
  await field(page, 'Create new label').fill(name);
  await button(page, 'Save').click();
}

/** Press and hold, the way a finger selects a card. */
async function longPress(page: Page, target: ReturnType<Page['locator']>) {
  await target.hover();
  await page.mouse.down();
  await page.waitForTimeout(900);
  await page.mouse.up();
}

const card = (page: Page, title: string) =>
  page
    .getByRole('button', { name: new RegExp(`^(Pinned\\., )?${title}`) })
    .filter({ visible: true })
    .last();

test.describe('F11 labels (Keep-style)', () => {
  test('F11-H1 create a label from the drawer; it is listed there', async ({ page }) => {
    await openApp(page);
    await createLabel(page, 'Recipes');
    await expect(page.getByText('0 notes')).toBeVisible();
    await expectAccessible(page, 'S17 edit labels');
    await back(page);
    await button(page, 'Open menu').click();
    await expect(page.getByRole('navigation').getByRole('button', { name: 'Recipes', exact: true })).toBeVisible();
  });

  test('F11-H2 label a note from its menu; the card shows it; the label view filters', async ({ page }) => {
    await openApp(page, { demo: true });
    await openCard(page, 'Bike service');
    await button(page, 'More').click();
    await button(page, 'Labels').click();
    await settle(page);
    await field(page, 'Enter label name').fill('Errands');
    await button(page, 'Create “Errands”').click();
    await expect(page.getByRole('checkbox', { name: 'Errands' })).toHaveAttribute('aria-checked', 'true');
    await expectAccessible(page, 'S18 label picker');
    await button(page, 'Back').click();
    await settle(page, 400);
    await expect(button(page, 'Label Errands')).toBeVisible();
    await back(page);
    await expect(card(page, 'Bike service').getByText('Errands')).toBeVisible();
    await drawerTo(page, 'Errands');
    await expect(card(page, 'Bike service')).toBeVisible();
    await expect(card(page, 'Groceries')).toHaveCount(0);
  });

  test('F11-H3 typing #name in a note offers to create and add the label', async ({ page }) => {
    await openApp(page);
    await newNote(page, 'Note');
    await field(page, 'Title').fill('Pasta');
    const body = field(page, 'Write something…');
    await body.click();
    await body.pressSequentially('Dinner idea #dinner');
    await button(page, 'Create label “dinner”').click();
    await expect(button(page, 'Label dinner')).toBeVisible();
    await settle(page, 700);
    await back(page);
    await expect(card(page, 'Pasta').getByText('dinner', { exact: true })).toBeVisible();
  });

  test('F11-H4 several notes selected: a label on some of them is part-ticked; tapping puts it on all', async ({ page }) => {
    await openApp(page, { demo: true });
    // Label one note first.
    await openCard(page, 'Bike service');
    await button(page, 'More').click();
    await button(page, 'Labels').click();
    await settle(page);
    await field(page, 'Enter label name').fill('Chores');
    await button(page, 'Create “Chores”').click();
    await button(page, 'Back').click();
    await settle(page, 400);
    await back(page);

    await longPress(page, card(page, 'Bike service'));
    await card(page, 'Groceries').click();
    await expect(page.getByLabel('2 selected')).toBeVisible();
    await button(page, 'Labels').click();
    await settle(page);
    const home = page.getByRole('checkbox', { name: 'Chores' });
    await expect(home).toHaveAttribute('aria-checked', 'mixed');
    await home.click();
    await expect(home).toHaveAttribute('aria-checked', 'true');
    await button(page, 'Back').click();
    await settle(page);
    await drawerTo(page, 'Chores');
    await expect(card(page, 'Bike service')).toBeVisible();
    await expect(card(page, 'Groceries')).toBeVisible();
  });

  test('F11-N1 a duplicate name (any case) and an empty name are refused', async ({ page }) => {
    await openApp(page);
    await createLabel(page, 'Work');
    await expect(field(page, 'Create new label')).toHaveValue('');
    await field(page, 'Create new label').fill('wORK');
    await button(page, 'Save').click();
    await expect(page.getByText('There’s already a label with that name.')).toBeVisible();
    await field(page, 'Create new label').fill('   ');
    await button(page, 'Save').click();
    await expect(page.getByText('Give the label a name.')).toBeVisible();
  });

  test('F11-E1 rename a label, then delete it: its notes stay', async ({ page }) => {
    await openApp(page, { demo: true });
    await openCard(page, 'Bike service');
    await button(page, 'More').click();
    await button(page, 'Labels').click();
    await settle(page);
    await field(page, 'Enter label name').fill('Bikes');
    await button(page, 'Create “Bikes”').click();
    await button(page, 'Back').click();
    await settle(page, 400);
    await back(page);

    await page.goto('/labels');
    await button(page, 'Rename Bikes').click();
    await page.getByRole('textbox', { name: 'Rename Bikes' }).fill('Cycling');
    await button(page, 'Save').click();
    await expect(page.getByRole('textbox', { name: 'Rename Cycling' })).toHaveValue('Cycling');
    await button(page, 'Rename Cycling').click();
    await button(page, 'Delete Cycling').click();
    await expect(page.getByText('It comes off every note that has it. The notes themselves stay.')).toBeVisible();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
    await settle(page);
    await page.goto('/');
    await expect(card(page, 'Bike service')).toBeVisible();
    await expect(card(page, 'Bike service').getByText('Cycling')).toHaveCount(0);
  });

  test('F11-E2 a note made inside a label view starts with that label', async ({ page }) => {
    await openApp(page);
    await createLabel(page, 'Travel');
    await back(page);
    await drawerTo(page, 'Travel');
    await newNote(page, 'Note');
    await field(page, 'Title').fill('Packing');
    await expect(button(page, 'Label Travel')).toBeVisible();
    await settle(page, 700);
    await back(page);
    await expect(card(page, 'Packing')).toBeVisible();
  });
});
