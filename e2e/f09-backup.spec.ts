import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { button, expect, field, newNote, openApp, settle, test } from './fixtures';

async function download(page: import('@playwright/test').Page) {
  await page.goto('/settings/backup');
  const dl = page.waitForEvent('download');
  await button(page, 'Back up now').click();
  const file = path.join(os.tmpdir(), `pl-${Date.now()}-${Math.random()}.json`);
  await (await dl).saveAs(file);
  return file;
}

async function restore(page: import('@playwright/test').Page, file: string) {
  await page.goto('/settings/backup');
  const chooser = page.waitForEvent('filechooser');
  await button(page, 'Restore from a file').click();
  await (await chooser).setFiles(file);
}

test('F09-H1 back up and restore the same file', async ({ page }) => {
  await openApp(page, { demo: true });
  const file = await download(page);
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  expect(data.format).toBe('pocketleaf-backup');
  expect(data.notes).toHaveLength(8);
  await restore(page, file);
  await expect(page.getByText('It has 8 notes.', { exact: false })).toBeVisible();
  await button(page, 'Restore').click();
  await expect(page.getByText('Already up to date.')).toBeVisible();
});

test('F09-E1 restore into an install with other notes keeps both', async ({ page, browser }) => {
  await openApp(page, { demo: true });
  const file = await download(page);
  const other = await (await browser.newContext()).newPage();
  await openApp(other);
  await newNote(other, 'Note');
  await field(other, 'Title').fill('Mine only');
  await settle(other, 700);
  await restore(other, file);
  await button(other, 'Restore').click();
  await expect(other.getByText('Restored: 11 added, 0 updated.')).toBeVisible();
  await other.goto('/');
  await expect(button(other, /^Mine only/)).toBeVisible();
  await expect(button(other, /^Groceries/)).toBeVisible();
});

test('F09-N1 a file that is not a backup', async ({ page }) => {
  await openApp(page);
  const file = path.join(os.tmpdir(), `not-backup-${Date.now()}.json`);
  fs.writeFileSync(file, JSON.stringify({ hello: 'world' }));
  await restore(page, file);
  await expect(page.getByText('That file isn’t a Pocketleaf backup.')).toBeVisible();
});
