'use server';

import { cookies } from 'next/headers';

/** Clear the confirmation banner once it has been shown. */
export async function dismissFlash(): Promise<void> {
  try {
    const store = await cookies();
    store.delete('kgcsc_flash');
  } catch {
    /* nothing to clear */
  }
}
