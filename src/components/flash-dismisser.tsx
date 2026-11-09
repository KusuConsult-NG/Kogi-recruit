'use client';

import { useEffect } from 'react';
import { dismissFlash } from '@/actions/flash';

/** Clears the flash cookie once the banner has been rendered. */
export function FlashDismisser() {
  useEffect(() => {
    void dismissFlash();
  }, []);
  return null;
}
