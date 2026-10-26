import { back, button, chooseFromGallery, expect, field, newNote, openApp, openCard, settle, test } from './fixtures';
import type { Page } from '@playwright/test';

// A small real PNG (8x8, green), so the browser can decode and show it.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEklEQVR4nGPQaPiPFTEMLQkA9ywe4YzZq1EAAAAASUVORK5CYII=',
  'base64',
);

async function attachFromGallery(page: Page, names: string[]) {
  const chooser = chooseFromGallery(page);
  await (await chooser).setFiles(names.map((name) => ({ name, mimeType: 'image/png', buffer: PNG })));
}

test('F10-H1 add photos to a note; they survive a reload and show on the card', async ({ page }) => {
  await openApp(page);
  await newNote(page, 'Note');
  await field(page, 'Title').fill('Trip');
  await attachFromGallery(page, ['beach.png', 'hill.png']);
  await expect(page.getByText('2 added.')).toBeVisible();
  await expect(button(page, 'Photo 1 of 2')).toBeVisible();
  await expect(button(page, 'Photo 2 of 2')).toBeVisible();
  await settle(page, 700);
  await back(page);

  await page.reload();
  const card = button(page, /^Trip/);
  await expect(card).toBeVisible({ timeout: 15_000 });
  await expect(card.locator('img[src^="blob:"]')).toHaveCount(1);
  await expect(card.getByText('+1')).toBeVisible();

  await openCard(page, 'Trip');
  await expect(button(page, 'Photo 2 of 2')).toBeVisible();
});

test('F10-H2 open, step through and remove a photo', async ({ page }) => {
  await openApp(page);
  await newNote(page, 'Note');
  await field(page, 'Title').fill('Garden');
  await attachFromGallery(page, ['a.png', 'b.png']);
  await button(page, 'Photo 1 of 2').click();
  await settle(page);
  await expect(page.getByRole('heading', { name: 'Photo 1 of 2' })).toBeVisible();
  await expect(button(page, 'Previous')).toBeDisabled();
  await button(page, 'Next').click();
  await expect(page.getByRole('heading', { name: 'Photo 2 of 2' })).toBeVisible();

  await button(page, 'Remove from note').click();
  await expect(page.getByRole('dialog', { name: 'Remove this from the note?' })).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Remove from note' }).click();
  await expect(page.getByText('Removed.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Photo 1 of 1' })).toBeVisible();

  await button(page, 'Close').click();
  await settle(page);
  await expect(button(page, 'Photo 1 of 1')).toBeVisible();
});

test('F10-E1 a new note with only a photo is kept, not discarded as empty', async ({ page }) => {
  await openApp(page);
  await newNote(page, 'Note');
  await attachFromGallery(page, ['only.png']);
  await expect(page.getByText('Added.')).toBeVisible();
  await back(page);
  await expect(page.locator('img[src^="blob:"]').filter({ visible: true })).toHaveCount(1);
});

test('F10-E2 Telegram backup explains it is phone-only in the web preview', async ({ page }) => {
  await openApp(page);
  await page.goto('/settings');
  await button(page, /^Telegram backup/).click();
  await settle(page);
  await expect(page.getByText('Telegram backup works in the phone app.').filter({ visible: true })).toBeVisible();
  await expect(field(page, 'Bot token')).toHaveCount(0);
});
