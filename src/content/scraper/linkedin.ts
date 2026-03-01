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

/** Find the element matching any CSS selector with non-trivial text. */
function queryNonEmpty(selectors: string[]): HTMLElement | null {
  for (const sel of selectors) {
    try {
      const el = document.querySelector<HTMLElement>(sel);
      if (el && (el.innerText?.trim().length ?? 0) > 80) return el;
    } catch {
      // ignore invalid selectors
    }
  }
  return null;
}

/** Like queryNonEmpty but for short labels (title, company - typically < 80 chars). */
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
      // Must contain newlines (real content, not a nav bar full of links)
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

// ─── Main extractor ───────────────────────────────────────────────────────────

export function extractLinkedInJD(): JobContext | null {
  // ── 1. Find the job description container ────────────────────────────────

  let descriptionEl: HTMLElement | null = null;

  // Strategy 0: On two-panel views (search/collections/recommended), scope to the
  // RIGHT detail panel only. This prevents the left-side job-feed list from being
  // mistaken for the job description when falling back to findLargestTextBlock.
  const detailPanel = document.querySelector<HTMLElement>(
    [
      ".scaffold-layout__detail",
      ".jobs-search-two-pane__detail-view",
      ".jobs-details",
      ".jobs-search-results-list ~ div", // sibling of results list
      '[class*="job-details"][class*="container"]',
    ].join(", "),
  );

  // Strategy A: Find "About the job" / "Job description" heading and walk up.
  // Scope to detail panel if available to avoid false matches in the feed.
  const searchRoot: Document | HTMLElement = detailPanel ?? document;
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
    // The sibling/next element usually holds the content; otherwise expand the parent
    const next = aboutHeading.nextElementSibling as HTMLElement | null;
    if (next && (next.innerText?.trim().length ?? 0) > 200) {
      descriptionEl = next;
    } else {
      descriptionEl = expandToContainer(aboutHeading, 400);
    }
  }

  // Strategy B: Known class-name selectors (LinkedIn changes these often but worth trying)
  if (!descriptionEl) {
    descriptionEl = queryNonEmpty([
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

  // Strategy C: Find the largest text block - scoped to detail panel when available
  if (!descriptionEl) {
    descriptionEl = findLargestTextBlockIn(detailPanel ?? document.body);
  }

  if (!descriptionEl) {
    console.warn("[FlowCV] Could not locate job description element");
    return null;
  }

  const fullText = descriptionEl.innerText?.trim() ?? "";
  if (fullText.length < 100) return null;

  // ── 2. Extract title and company ─────────────────────────────────────────
  // NOTE: queryShort is used here because job titles/company names are short
  // strings that won't pass the 80-char threshold of queryNonEmpty.

  const titleEl = queryShort([
    // 2024-2025 unified top-card (split-view and full-view)
    "h2.job-details-jobs-unified-top-card__job-title",
    "h1.job-details-jobs-unified-top-card__job-title",
    ".job-details-jobs-unified-top-card__job-title",
    // Older layouts
    "h1.topcard__title",
    "h1.t-24",
    ".jobs-details__main-content h1",
    // Attribute-based wildcards
    '[class*="job-title"] h1',
    '[class*="job-title"] h2',
    '[class*="job-title"] a',
    '[class*="jobs-unified-top-card__job-title"]',
    // Last resort: first h1/h2 inside the main content panel
    "main h1",
    "main h2",
  ]);

  const companyEl = queryShort([
    // 2024-2025 unified top-card
    ".job-details-jobs-unified-top-card__company-name a",
    ".job-details-jobs-unified-top-card__company-name",
    // Older
    ".jobs-unified-top-card__company-name a",
    ".jobs-unified-top-card__company-name",
    ".topcard__org-name-link",
    // Attribute wildcards
    '[class*="company-name"] a',
    '[class*="company-name"]',
    '[class*="employer-name"]',
  ]);

  // ── 3. Fallback: parse window.title "Job Title at Company | LinkedIn" ────
  let titleText = titleEl?.innerText?.trim() ?? null;
  let companyText = companyEl?.innerText?.trim() ?? null;

  if (!titleText || !companyText) {
    // LinkedIn page title format: "Job Title at Company | LinkedIn"
    const pageTitle = document.title ?? "";
    const pageTitleMatch = pageTitle.match(/^(.+?)\s+at\s+(.+?)\s*\|/);
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
