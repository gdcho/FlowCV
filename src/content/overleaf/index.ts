/**
 * Overleaf content script - ISOLATED world.
 *
 * 1. Injects the Monaco bridge into the MAIN world.
 * 2. Mounts the Shadow DOM sidebar.
 * 3. Watches for Overleaf's single-page navigation.
 */

import { injectBridge } from "./bridge-injector";
import { mountSidebar } from "./sidebar/mount";

// Detect that we're on an Overleaf project page (not the dashboard)
function isProjectPage(): boolean {
  return window.location.pathname.startsWith("/project/");
}

async function initialize() {
  if (!isProjectPage()) return;

  // Inject bridge into MAIN world via background SW (bypasses Overleaf's CSP)
  await injectBridge();

  // Mount the React sidebar inside a Shadow DOM
  mountSidebar();

  console.log("[FlowCV] Overleaf content script initialized");
}

// Initial run
initialize().catch(console.error);

// Overleaf is a React SPA - handle client-side navigation
let lastPath = window.location.pathname;
const observer = new MutationObserver(() => {
  if (window.location.pathname !== lastPath) {
    lastPath = window.location.pathname;
    if (isProjectPage()) {
      // Give the SPA time to render the editor
      setTimeout(() => {
        initialize().catch(console.error);
      }, 2000);
    }
  }
});

observer.observe(document.body, { childList: true, subtree: true });
