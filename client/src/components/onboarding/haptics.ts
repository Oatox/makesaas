/**
 * Short vibration on phones that support it. Browsers refuse (and log an error) before the first
 * tap on the page, so nothing is asked until the visitor has interacted.
 */
export function buzz(ms: number) {
  if (typeof navigator === "undefined" || !navigator.userActivation?.hasBeenActive) return;
  navigator.vibrate?.(ms);
}
