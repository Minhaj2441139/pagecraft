export const ANNOUNCER_ID = "pc-announcer";

/** Speak a short status message through the editor's polite live region. */
export function announce(message: string): void {
  if (typeof document === "undefined") return;
  const region = document.getElementById(ANNOUNCER_ID);
  if (!region) return;
  // Clear first so repeating the same message is announced again.
  region.textContent = "";
  window.setTimeout(() => {
    region.textContent = message;
  }, 30);
}
