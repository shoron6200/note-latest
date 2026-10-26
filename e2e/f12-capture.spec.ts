import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import type { Page } from '@playwright/test';

import { back, button, chooseFromGallery, expect, expectAccessible, field, newNote, openApp, openCard, settle, test } from './fixtures';

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEklEQVR4nGPQaPiPFTEMLQkA9ywe4YzZq1EAAAAASUVORK5CYII=',
  'base64',
);
const PNG_URL = `data:image/png;base64,${PNG.toString('base64')}`;

// A fake microphone, for the voice note tests.
test.use({
  permissions: ['microphone'],
  launchOptions: {
    executablePath: process.env.PW_CHROMIUM || undefined,
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
  },
});

const card = (page: Page, title: string) =>
  page
    .getByRole('button', { name: new RegExp(`^(Pinned\\., )?${title}`) })
    .filter({ visible: true })
    .last();

/** What another app shares, handed to the web preview before the page loads. */
async function shareIn(page: Page, share: { text?: string; url?: string; title?: string; files?: { uri: string; mime: string; name?: string }[] }) {
  await page.addInitScript((s) => {
    (globalThis as { __pocketleafShare?: unknown }).__pocketleafShare = s;
  }, share);
}

test.describe('F13 share into Pocketleaf', () => {
  test('F13-H1 a shared link becomes a note with its page title and a label', async ({ page }) => {
    await openApp(page);
    // Make a label first, then share.
    await page.goto('/labels');
    await field(page, 'Create new label').fill('Reading');
    await button(page, 'Save').click();
    await shareIn(page, { text: 'Worth reading https://example.com/article', url: 'https://example.com/article', title: 'A good article' });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Save to Pocketleaf' }).filter({ visible: true })).toBeVisible({ timeout: 15_000 });
    await expect(field(page, 'Title')).toHaveValue('A good article');
    await expect(field(page, 'Note')).toHaveValue('Worth reading https://example.com/article');
    await page.getByRole('checkbox', { name: 'Reading' }).click();
    await settle(page, 400);
    await expectAccessible(page, 'S19 save shared');
    await button(page, 'Save').click();
    await expect(page.getByText('Saved to Pocketleaf.')).toBeVisible();
    await expect(card(page, 'A good article')).toBeVisible();
    await expect(card(page, 'A good article').getByText('Reading', { exact: true })).toBeVisible();
  });

  test('F13-H2 shared photos are added; a PDF is left out and said so', async ({ page }) => {
    await shareIn(page, {
      text: 'Receipts',
      files: [
        { uri: PNG_URL, mime: 'image/png', name: 'a.png' },
        { uri: PNG_URL, mime: 'image/png', name: 'b.png' },
        { uri: 'data:application/pdf;base64,JVBERi0=', mime: 'application/pdf', name: 'x.pdf' },
      ],
    });
    await page.goto('/');
    await expect(page.getByText('2 files')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('One file isn’t a photo, video or recording, so it’s left out.')).toBeVisible();
    await button(page, 'Save and open').click();
    await settle(page);
    await expect(button(page, 'Photo 1 of 2')).toBeVisible();
    await expect(field(page, 'Write something…')).toHaveValue('Receipts');
  });

  test('F13-E1 discard saves nothing', async ({ page }) => {
    await shareIn(page, { text: 'Not this one' });
    await page.goto('/');
    await expect(field(page, 'Note')).toHaveValue('Not this one', { timeout: 20_000 });
    await button(page, 'Discard').click();
    await settle(page);
    await expect(page.getByText('Not this one')).toHaveCount(0);
    await expect(button(page, 'Search your notes')).toBeVisible();
    await expect(page.getByText('A blank page')).toBeVisible();
  });
});

test.describe('F14 voice notes (the web preview keeps the sound; text needs a phone)', () => {
  test('F14-H1 record from the editor; the voice note plays and survives a reload', async ({ page }) => {
    await openApp(page);
    await newNote(page, 'Note');
    await field(page, 'Title').fill('Idea');
    await button(page, 'Add').click();
    await button(page, 'Record voice note').click();
    await expect(page.getByText('This phone can’t turn speech into text here, so only the sound is kept.')).toBeVisible();
    await settle(page, 400);
    await expectAccessible(page, 'S20 recorder');
    await button(page, 'Start recording').click();
    await expect(page.getByText('Recording…')).toBeVisible();
    await page.waitForTimeout(1600);
    await button(page, 'Stop and save').click();
    await expect(page.getByText('Voice note saved. No words were recognised.')).toBeVisible({ timeout: 10_000 });
    await expect(button(page, 'Play: Voice note')).toBeVisible();
    await settle(page, 700);
    await back(page);
    await expect(card(page, 'Idea').getByText('Voice note', { exact: true })).toBeVisible();

    await page.reload();
    await openCard(page, 'Idea');
    await expect(button(page, 'Play: Voice note')).toBeVisible({ timeout: 10_000 });
    await button(page, 'Delete voice note: Voice note').click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete voice note' }).click();
    await expect(page.getByText('Voice note deleted.')).toBeVisible();
    await expect(button(page, 'Play: Voice note')).toHaveCount(0);
  });

  test('F14-H2 Voice from the + button opens the recorder; the Voice notes filter finds it', async ({ page }) => {
    await openApp(page);
    await button(page, 'New').click();
    await button(page, 'Voice').click();
    await expect(button(page, 'Start recording')).toBeVisible({ timeout: 10_000 });
    await button(page, 'Start recording').click();
    await page.waitForTimeout(1200);
    await button(page, 'Stop and save').click();
    await expect(button(page, 'Play: Voice note')).toBeVisible({ timeout: 10_000 });
    await field(page, 'Title').fill('Spoken');
    await settle(page, 700);
    await back(page);
    await button(page, 'Search your notes').click();
    await button(page, 'Voice notes').click();
    await expect(card(page, 'Spoken')).toBeVisible();
  });

  test('F14-N1 too short is not kept', async ({ page }) => {
    await openApp(page);
    await newNote(page, 'Note');
    await button(page, 'Add').click();
    await button(page, 'Record voice note').click();
    await button(page, 'Start recording').click();
    await button(page, 'Stop and save').click();
    await expect(page.getByText('Too short to keep.')).toBeVisible();
    await expect(button(page, 'Play: Voice note')).toHaveCount(0);
  });
});

test('F15-H1 text found in a photo: shown in the viewer, copied, added to the note, and searchable', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await openApp(page);
  await newNote(page, 'Note');
  await field(page, 'Title').fill('Receipt');
  await (await chooseFromGallery(page)).setFiles([{ name: 'r.png', mimeType: 'image/png', buffer: PNG }]);
  await expect(button(page, 'Photo 1 of 1')).toBeVisible();
  await settle(page, 700);
  await back(page);

  // The web preview cannot read photos; a phone would. Hand the text in through a backup.
  await page.goto('/settings/backup');
  const dl = page.waitForEvent('download');
  await button(page, 'Back up now').click();
  const file = path.join(os.tmpdir(), `pl-ocr-${Date.now()}.json`);
  await (await dl).saveAs(file);
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  data.attachments[0].text = 'INVOICE 2231\nTotal 14,90';
  data.notes[0].updated_at += 1000;
  fs.writeFileSync(file, JSON.stringify(data));
  const chooser = page.waitForEvent('filechooser');
  await button(page, 'Restore from a file').click();
  await (await chooser).setFiles(file);
  await button(page, 'Restore').click();
  await settle(page);

  await page.goto('/');
  await button(page, 'Search your notes').click();
  await field(page, 'Search your notes').fill('invoice');
  await expect(card(page, 'Receipt')).toBeVisible();
  await card(page, 'Receipt').click();
  await settle(page);
  await button(page, 'Photo 1 of 1').click();
  await settle(page);
  await button(page, 'Text in photo').click();
  await expect(page.getByText('INVOICE 2231')).toBeVisible();
  await settle(page, 400); // the sheet is named a dialog once it has slid in
  await expectAccessible(page, 'S21 photo text');
  await button(page, 'Copy text').click();
  await expect(page.getByText('Copied.')).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('INVOICE 2231\nTotal 14,90');
  await button(page, 'Text in photo').click();
  await button(page, 'Add to note').click();
  await expect(page.getByText('Added to the note.')).toBeVisible();
  await button(page, 'Close').click();
  await settle(page);
  await expect(field(page, 'Write something…')).toHaveValue('INVOICE 2231\nTotal 14,90');
});
