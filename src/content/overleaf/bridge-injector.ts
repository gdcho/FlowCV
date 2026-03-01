/**
 * bridge-injector.ts - Runs in ISOLATED world.
 *
 * Asks the background service worker to inject bridge.js into the
 * Overleaf tab's MAIN world via chrome.scripting.executeScript.
 * This approach bypasses Overleaf's CSP (executeScript operates below CSP).
 */

let injected = false;

export async function injectBridge(): Promise<void> {
  if (injected) return;
  injected = true;

  try {
    const response = (await chrome.runtime.sendMessage({
      type: "BRIDGE_INJECT_REQUEST",
    })) as { ok: boolean; error?: string } | undefined;
    if (response?.ok === false) {
      console.error(
        "[FlowCV] Bridge injection rejected by SW:",
        response.error,
      );
      injected = false; // allow retry
    } else {
      console.log("[FlowCV] Bridge injected successfully");
    }
  } catch (err) {
    console.error("[FlowCV] Failed to send bridge injection request:", err);
    injected = false;
  }
}
