/** Web preview: no Telegram backup (no secure storage for the token in a browser). */
import type { TelegramTransport } from './telegram';

export type TelegramLink = { chatId: string; chatName: string; botName: string };

export const looksLikeToken = (t: string) => /^\d{5,15}:[A-Za-z0-9_-]{30,60}$/.test(t.trim());
export const telegramSupported = async () => false;
export const saveCredentials = async (_token: string, _link: TelegramLink) => undefined;
export const getLink = async (): Promise<TelegramLink | null> => null;
export const getToken = async (): Promise<string | null> => null;
export const clearCredentials = async () => undefined;
export async function sha256Bytes(b: Uint8Array): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', b.slice());
  return [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, '0')).join('');
}
export function createTransport(_token: string): TelegramTransport {
  throw new Error('Telegram backup works in the phone app');
}
