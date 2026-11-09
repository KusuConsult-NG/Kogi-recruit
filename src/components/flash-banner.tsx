import { readFlash } from '@/lib/flash';
import { Alert } from './ui';
import { FlashDismisser } from './flash-dismisser';

/**
 * Shows the confirmation left by the last officer action, then dismisses it so
 * it is not repeated on the next navigation.
 */
export async function FlashBanner() {
  const flash = await readFlash();
  if (!flash) return null;
  return (
    <div className="mb-5" role="status" aria-live="polite">
      <Alert tone={flash.tone}>{flash.message}</Alert>
      <FlashDismisser />
    </div>
  );
}
