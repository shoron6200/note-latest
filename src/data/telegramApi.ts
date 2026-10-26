/**
 * The real Telegram connection (phone only), and where its credentials live.
 *
 * The bot token is typed into Settings on your phone and kept in the system's
 * secure storage (Android Keystore / iOS Keychain). It is never in the code,
 * the repository, the APK, a backup file or a log, so sharing the app with
 * someone shares nothing of your bot.
 */
import * as Crypto from 'expo-crypto';
import { Directory, File, Paths, UploadType } from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';

import { TelegramError, type SentDocument, type TelegramTransport } from './telegram';

const TOKEN_KEY = 'pocketleaf.telegram.token';
const CHAT_KEY = 'pocketleaf.telegram.chat';

export type TelegramLink = { chatId: string; chatName: string; botName: string };

/** Rough shape check before any network call: "123456789:AA..." */
export const looksLikeToken = (t: string) => /^\d{5,15}:[A-Za-z0-9_-]{30,60}$/.test(t.trim());

export const telegramSupported = () => SecureStore.isAvailableAsync();

export async function saveCredentials(token: string, link: TelegramLink) {
  await SecureStore.setItemAsync(TOKEN_KEY, token.trim());
  await SecureStore.setItemAsync(CHAT_KEY, JSON.stringify(link));
}

export async function getLink(): Promise<TelegramLink | null> {
  const raw = await SecureStore.getItemAsync(CHAT_KEY).catch(() => null);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as TelegramLink;
  } catch {
    return null;
  }
}

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY).catch(() => null);
}

export async function clearCredentials() {
  await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => undefined);
  await SecureStore.deleteItemAsync(CHAT_KEY).catch(() => undefined);
}

export async function sha256Bytes(b: Uint8Array): Promise<string> {
  const buf = await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, b as Uint8Array<ArrayBuffer>);
  return [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

type ApiReply<T> = { ok: boolean; result: T; error_code?: number; description?: string; parameters?: { retry_after?: number } };

function unwrap<T>(r: ApiReply<T>): T {
  if (!r.ok) throw new TelegramError(r.error_code ?? 0, r.description ?? 'Telegram error', r.parameters?.retry_after);
  return r.result;
}

/** Errors never carry the URL: it contains the token. */
function scrub(e: unknown): never {
  if (e instanceof TelegramError) throw e;
  throw new TelegramError(0, 'network error');
}

export function createTransport(token: string): TelegramTransport {
  const base = `https://api.telegram.org/bot${token}`;
  const scratch = () => {
    const d = new Directory(Paths.cache, 'telegram', Crypto.randomUUID());
    d.create({ intermediates: true });
    return d;
  };

  async function call<T>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    try {
      const res = await fetch(`${base}/${method}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      return unwrap<T>((await res.json()) as ApiReply<T>);
    } catch (e) {
      return scrub(e);
    }
  }

  return {
    call,

    async sendDocument(chatId, bytes, fileName, caption): Promise<SentDocument> {
      const dir = scratch();
      try {
        // The upload takes its file name from the file, so the part is written under that name.
        const f = new File(dir, fileName);
        f.create();
        f.write(bytes);
        const parameters: Record<string, string> = {
          chat_id: chatId,
          disable_notification: 'true',
          disable_content_type_detection: 'true',
        };
        if (caption) parameters.caption = caption;
        const res = await f
          .upload(`${base}/sendDocument`, {
            httpMethod: 'POST',
            uploadType: UploadType.MULTIPART,
            fieldName: 'document',
            mimeType: 'application/octet-stream',
            parameters,
          })
          .catch(scrub);
        const msg = unwrap(JSON.parse(res.body) as ApiReply<{ message_id: number; document?: { file_id: string; file_size?: number } }>);
        if (!msg.document) throw new TelegramError(0, 'Telegram did not keep the file');
        return { messageId: msg.message_id, fileId: msg.document.file_id, size: msg.document.file_size ?? bytes.length };
      } finally {
        dir.delete();
      }
    },

    async download(fileId) {
      const info = await call<{ file_path?: string }>('getFile', { file_id: fileId });
      if (!info.file_path) throw new TelegramError(400, 'file is not available');
      const dir = scratch();
      try {
        const f = await File.downloadFileAsync(`https://api.telegram.org/file/bot${token}/${info.file_path}`, new File(dir, 'part')).catch(scrub);
        return await f.bytes();
      } finally {
        dir.delete();
      }
    },
  };
}
