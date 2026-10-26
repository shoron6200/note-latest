import { back, button, expect, field, newNote, openApp, openCard, test } from './fixtures';

test.describe('F06 reminders (saved in the web build; firing needs a phone)', () => {
  test('F06-H1 quick pick sets a reminder', async ({ page }) => {
    await openApp(page);
    await newNote(page, 'Note');
    await field(page, 'Title').fill('Call the bank');
    await button(page, 'Remind me').click();
    await button(page, 'Tomorrow morning').click();
    await button(page, 'Set reminder').click();
    await expect(page.getByText(/^I’ll remind you tomorrow 9:00/)).toBeVisible();
    await expect(button(page, /^Tomorrow 9:00/)).toBeVisible();
    await back(page);
    await expect(button(page, /^Call the bank.*Tomorrow 9:00/)).toBeVisible();
  });

  test('F06-N1 a time in the past cannot be set', async ({ page }) => {
    await openApp(page);
    await newNote(page, 'Note');
    await field(page, 'Title').fill('Past');
    await button(page, 'Remind me').click();
    for (let i = 0; i < 3; i++) await button(page, 'Earlier date').click();
    await expect(page.getByText('That time has already gone by.')).toBeVisible();
    await expect(button(page, 'Set reminder')).toHaveAttribute('aria-disabled', 'true');
  });

  test('F06-E1 remove a reminder', async ({ page }) => {
    await openApp(page, { demo: true });
    await openCard(page, 'Groceries');
    await button(page, 'Remind me').click();
    await button(page, 'Remove').click();
    await expect(page.getByText('Reminder removed.')).toBeVisible();
    await expect(button(page, /^Today 6:00/)).toHaveCount(0);
  });

  test('F06 overdue reminder shows on the card', async ({ page }) => {
    await openApp(page, { demo: true });
    await expect(button(page, /^Packing.*Yesterday 9:00/)).toBeVisible();
  });
});
