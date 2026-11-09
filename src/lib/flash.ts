/**
 * Short-lived confirmation messages.
 *
 * Several officer actions change the state of a record so that the form the
 * officer used is no longer rendered — approving a shortlist replaces the
 * "submit" control with nothing, and allocating every eligible candidate
 * empties the allocation form. The message returned by the action would
 * disappear with the form, leaving the officer without confirmation.
 *
 * A flash message is therefore written to a short-lived cookie and shown by
 * the layout on the next render, then dismissed.
 */
import 'server-only';
import { cookies } from 'next/headers';

const COOKIE = 'kgcsc_flash';

export type FlashTone = 'success' | 'info' | 'warning' | 'error';

export interface Flash {
  tone: FlashTone;
  message: string;
}

export async function setFlash(message: string, tone: FlashTone = 'success'): Promise<void> {
  try {
    const store = await cookies();
    store.set(COOKIE, JSON.stringify({ tone, message: message.slice(0, 600) }), {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60,
    });
  } catch {
    // Outside a request scope (for example a background job); nothing to show.
  }
}

export async function readFlash(): Promise<Flash | null> {
  try {
    const store = await cookies();
    const raw = store.get(COOKIE)?.value;
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Flash;
    if (!parsed?.message) return null;
    const tone: FlashTone =
      parsed.tone === 'info' || parsed.tone === 'warning' || parsed.tone === 'error'
        ? parsed.tone
        : 'success';
    return { tone, message: String(parsed.message) };
  } catch {
    return null;
  }
}

/** Set a confirmation and return the action state, for use in a server action. */
export async function flashOk(message: string, extra: Record<string, unknown> = {}) {
  await setFlash(message, 'success');
  return { ok: true as const, message, ...extra };
}
