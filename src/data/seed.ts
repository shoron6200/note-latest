/**
 * Sample notes for the web preview (/?demo) and screenshots. Never runs on a
 * phone unless called explicitly, so your real notes start from an empty page.
 */
import { deviceTimeZone, formatLocalTime, localParts, zonedToUtc } from './time';
import type { Repo } from './repo';

export async function seedIfEmpty(repo: Repo) {
  if ((await repo.listNotes()).length || (await repo.listTrash()).length) return;
  const tz = deviceTimeZone();
  const at = (days: number, hh: number, mm = 0) => {
    const today = localParts(Date.now(), tz);
    const base = Date.UTC(today.y, today.m - 1, today.d + days);
    const d = new Date(base);
    return {
      fireAt: zonedToUtc({ y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(), hh, mm }, tz),
      timezone: tz,
      localTime: formatLocalTime(hh, mm),
    };
  };

  const work = await repo.createFolder('Work');
  const home = await repo.createFolder('Home');
  const reading = await repo.createFolder('Reading');

  const text = async (title: string, body: string, extra: Parameters<Repo['updateNote']>[1] = {}) => {
    const id = await repo.createNote({ type: 'text' });
    await repo.updateNote(id, { title, body, ...extra });
    return id;
  };
  const list = async (title: string, items: [string, boolean][], extra: Parameters<Repo['updateNote']>[1] = {}) => {
    const id = await repo.createNote({ type: 'checklist' });
    await repo.updateNote(id, { title, ...extra });
    for (const [t, done] of items) {
      const it = await repo.addItem(id, { text: t });
      if (done) await repo.toggleItem(it.id);
    }
    return id;
  };

  await text('Bike service', 'Chain, brakes, rear tyre pressure.\nAsk about the squeak from the pedal.', {
    color: 'orange',
    font: 'mono',
    folderId: home.id,
  });
  await text('Book quotes', 'Write down the lines worth keeping, with the page number.\n\np. 42 — "Small steps, every day."', {
    color: 'purple',
    font: 'serif',
    folderId: reading.id,
  });
  const packing = await list('Packing', [['Passport', false], ['Chargers', false], ['Rain jacket', true]], { color: 'blue', font: 'hand' });
  await text('', 'Wi-Fi at the cabin: ask the owner on arrival');
  const standup = await list('Monday stand-up', [['Release notes', true], ['Review the weekly report', false], ['Book the meeting room', false]], {
    color: 'teal',
    folderId: work.id,
  });
  const groceries = await list(
    'Groceries',
    [['Oat milk', false], ['Tomatoes', false], ['Coffee beans', false], ['Bread', true], ['Lemons', true], ['Rice', false], ['Basil', false], ['Eggs', false]],
    { color: 'green' },
  );
  const ideas = await text(
    'Ideas for the weekend',
    'Walk along the river if it is dry. Try the bakery near the station. Finish the second chapter.',
    { color: 'yellow', pinned: true },
  );

  await repo.setReminder(groceries, { ...at(0, 18), repeat: 'none' });
  await repo.setReminder(packing, { ...at(-1, 9), repeat: 'none' });
  await repo.setReminder(standup, { ...at(1, 8, 45), repeat: 'weekly' });
  await repo.setReminder(ideas, { ...at(5, 10), repeat: 'none' });
  await repo.reconcileReminders();

  const old = await text('Old shopping list', 'Batteries, light bulbs');
  await repo.trashNote(old);
}
