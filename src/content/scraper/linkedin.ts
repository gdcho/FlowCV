import type { JobContext } from "@/types/job";
import { extractKeywords } from "./keywords";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Walk up the DOM until the element's text is at least minLength chars. */
function expandToContainer(el: Element, minLength = 300): HTMLElement | null {
  let node: Element | null = el;
  while (node && (node.textContent?.length ?? 0) < minLength) {
    node = node.parentElement;
  }
  return node as HTMLElement | null;
}

/** Find an element whose trimmed text exactly matches one of the labels (case-insensitive). */
function findByExactTextIn(
  root: Document | HTMLElement,
  labels: string[],
): Element | null {
  const lower = labels.map((l) => l.toLowerCase());
  const all = root.querySelectorAll("h1, h2, h3, h4, h5, span, div, p, strong");
  for (const el of all) {
    const t = el.textContent?.trim().toLowerCase() ?? "";
    if (lower.includes(t) && el.children.length === 0) return el;
  }
  return null;
}

/** Find the element matching any CSS selector with non-trivial text, scoped to root. */
function queryNonEmptyIn(
  root: Document | HTMLElement,
  selectors: string[],
): HTMLElement | null {
  for (const sel of selectors) {
    try {
      const el = root.querySelector<HTMLElement>(sel);
      if (el && (el.innerText?.trim().length ?? 0) > 80) return el;
    } catch {
      // ignore invalid selectors
    }
  }
  return null;
}

/** Like queryNonEmptyIn but for short labels (title, company - typically < 80 chars). */
function queryShort(selectors: string[]): HTMLElement | null {
  for (const sel of selectors) {
    try {
      const el = document.querySelector<HTMLElement>(sel);
      if (el && (el.innerText?.trim().length ?? 0) > 0) return el;
    } catch {
      // ignore invalid selectors
    }
  }
  return null;
}

/** Last resort: find the div/section with the most text content within a root element. */
function findLargestTextBlockIn(
  root: HTMLElement,
  minLength = 400,
): HTMLElement | null {
  let best: HTMLElement | null = null;
  let bestLen = 0;
  const candidates = root.querySelectorAll<HTMLElement>(
    "div, section, article",
  );
  for (const el of candidates) {
    if (el === document.body) continue;
    const len = el.innerText?.trim().length ?? 0;
    if (len > bestLen && len < 30000) {
      const lines = (el.innerText ?? "")
        .split("\n")
        .filter((l) => l.trim().length > 20);
      if (lines.length >= 5 && len >= minLength) {
        best = el;
        bestLen = len;
      }
    }
  }
  return best;
}

/** Returns true if the text looks like a LinkedIn job-feed page rather than a job description. */
export function looksLikeFeed(text: string): boolean {
  const sample = text.toLowerCase().slice(0, 800);
  return (
    sample.includes("top job picks for you") ||
    sample.includes("based on your profile") ||
    sample.includes("based on your activity") ||
    sample.includes("people also viewed") ||
    sample.includes("jobs you may be interested in") ||
    sample.includes("show all results") ||
    // feed items typically have many "Promoted" or "Viewed" labels up top
    (sample.match(/\bpromoted\b/g)?.length ?? 0) >= 2 ||
    (sample.match(/\bviewed\b/g)?.length ?? 0) >= 3
  );
}

// ─── Main extractor ───────────────────────────────────────────────────────────

export function extractLinkedInJD(): JobContext | null {
  // ── 1. Find the RIGHT detail panel ───────────────────────────────────────
  // On two-panel views (search, collections, home) the left side is the feed
  // list and the right side is the job detail. We MUST scope to the right side
  // or Strategy C will pick up the feed as the "largest text block".
  //
  // NOTE: Do NOT use data-job-id here — LinkedIn puts that attribute on the
  // feed card (left panel). Walking up from it overshoots into the whole page.

  const detailPanel = document.querySelector<HTMLElement>(
    [
      // Most common: scaffold detail pane (search, collections, recommended)
      ".scaffold-layout__detail",
      // Jobs home page variants
      ".jobs-search__job-details--wrapper",
      ".jobs-home-root .job-view-layout",
      ".jobs-home-root [class*='detail']",
      // Two-pane detail view
      ".jobs-search-two-pane__detail-view",
      ".jobs-details",
      // Generic fallback
      ".jobs-search-results-list ~ div",
      '[class*="job-details"][class*="container"]',
    ].join(", "),
  );

  let descriptionEl: HTMLElement | null = null;
  const searchRoot: Document | HTMLElement = detailPanel ?? document;

  // Strategy A: Find a "About the job" / "Job description" heading and walk up.
  // Scoped to the detail panel to avoid false matches in the feed.
  const aboutHeading = findByExactTextIn(searchRoot, [
    "about the job",
    "job description",
    "about this role",
    "about the role",
    "the role",
    "what you'll do",
    "responsibilities",
  ]);
  if (aboutHeading) {
    const next = aboutHeading.nextElementSibling as HTMLElement | null;
    if (next && (next.innerText?.trim().length ?? 0) > 200) {
      descriptionEl = next;
    } else {
      descriptionEl = expandToContainer(aboutHeading, 400);
    }
  }

  // Strategy B: Known class-name selectors — scoped to detail panel.
  if (!descriptionEl) {
    descriptionEl = queryNonEmptyIn(searchRoot, [
      // 2024-2025 class names
      ".jobs-description-content__text",
      ".jobs-description__content",
      ".job-details-jobs-unified-top-card__job-description",
      "div.jobs-description",
      "article.jobs-description",
      // Older class names
      "#job-details",
      ".jobs-details__main-content",
      ".description__text",
      // Generic fallbacks
      '[class*="description-content"]',
      '[class*="job-description"]',
      '[class*="jobDescription"]',
      '[class*="jobs-description"]',
    ]);
  }

  // Strategy C: Largest text block — only within the detail panel.
  // Never fall back to document.body: that includes the feed list.
  if (!descriptionEl && detailPanel) {
    descriptionEl = findLargestTextBlockIn(detailPanel);
  }

  if (!descriptionEl) {
    console.warn("[FlowCV] Could not locate job description element");
    return null;
  }

  const fullText = descriptionEl.innerText?.trim() ?? "";
  if (fullText.length < 100) return null;

  // Guard: reject if the extracted text looks like a job feed.
  if (looksLikeFeed(fullText)) {
    console.warn("[FlowCV] Extracted text looks like a job feed, not a job description.");
    return null;
  }

  // ── 2. Extract title and company ─────────────────────────────────────────

  const titleEl = queryShort([
    "h2.job-details-jobs-unified-top-card__job-title",
    "h1.job-details-jobs-unified-top-card__job-title",
    ".job-details-jobs-unified-top-card__job-title",
    "h1.topcard__title",
    "h1.t-24",
    ".jobs-details__main-content h1",
    '[class*="job-title"] h1',
    '[class*="job-title"] h2',
    '[class*="job-title"] a',
    '[class*="jobs-unified-top-card__job-title"]',
    "main h1",
    "main h2",
  ]);

  const companyEl = queryShort([
    ".job-details-jobs-unified-top-card__company-name a",
    ".job-details-jobs-unified-top-card__company-name",
    ".jobs-unified-top-card__company-name a",
    ".jobs-unified-top-card__company-name",
    ".topcard__org-name-link",
    '[class*="company-name"] a',
    '[class*="company-name"]',
    '[class*="employer-name"]',
  ]);

  // ── 3. Fallback: parse "Job Title at Company | LinkedIn" from page title ──
  let titleText = titleEl?.innerText?.trim() ?? null;
  let companyText = companyEl?.innerText?.trim() ?? null;

  if (!titleText || !companyText) {
    const pageTitleMatch = document.title.match(/^(.+?)\s+at\s+(.+?)\s*\|/);
    if (pageTitleMatch) {
      titleText = titleText ?? pageTitleMatch[1].trim();
      companyText = companyText ?? pageTitleMatch[2].trim();
    }
  }

  console.log(
    "[FlowCV] Extracted JD, length:",
    fullText.length,
    "| title:",
    titleText,
    "| company:",
    companyText,
  );

  return {
    fullText,
    title: titleText,
    company: companyText,
    url: window.location.href,
    keywords: extractKeywords(fullText),
    scrapedAt: Date.now(),
  };
}
