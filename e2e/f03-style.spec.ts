import { back, button, expect, field, newNote, openApp, settle, test } from './fixtures';

test('F03-H1 colour and font survive a reload', async ({ page }) => {
  await openApp(page);
  await newNote(page, 'Note');
  await field(page, 'Title').fill('Styled');
  await button(page, 'Colour').click();
  await page.getByRole('radio', { name: 'Yellow' }).click();
  await page.keyboard.press('Escape');
  await button(page, 'Font and size').click();
  await page.getByRole('radio', { name: 'Serif font' }).click();
  await page.getByRole('radio', { name: 'Large text', exact: true }).click();
  await page.keyboard.press('Escape');
  await settle(page, 700);
  await back(page);
  await page.reload();
  const card = button(page, /^Styled/);
  await expect(card).toHaveCSS('background-color', 'rgb(250, 244, 220)'); // note.light.yellow (the wash)
  await card.click();
  await settle(page);
  await expect(field(page, 'Title')).toHaveCSS('font-family', /SourceSerif4/);
  await button(page, 'Font and size').click();
  await expect(page.getByRole('radio', { name: 'Large text', exact: true })).toHaveAttribute('aria-checked', 'true');
});

test('F03-E1 dark mode uses the dark note colour', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await openApp(page, { demo: true });
  await expect(button(page, /^Ideas for the weekend/)).toHaveCSS('background-color', 'rgb(50, 51, 38)'); // note.dark.yellow (the wash)
});
