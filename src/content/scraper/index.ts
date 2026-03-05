/**
 * JD Scraper content script - runs on LinkedIn pages.
 *
 * No floating button. No auto-scraping. Only responds to explicit
 * CAPTURE_JD_REQUEST messages sent from the popup.
 */

import { Readability } from "@mozilla/readability";
import { extractLinkedInJD, looksLikeFeed } from "./linkedin";
import { extractKeywords } from "./keywords";
import { cleanJDText, parseSections } from "./utils";
import type { JobContext } from "@/types/job";

function detectPlatform(): "linkedin" | null {
  const { hostname } = window.location;
  if (hostname.includes("linkedin.com")) return "linkedin";
  return null;
}

/**
 * Wait for LinkedIn's detail panel to appear and contain job content.
 * Needed because LinkedIn is a SPA — navigating between pages updates the URL
 * immediately but renders the detail panel asynchronously.
 */
async function waitForDetailPanel(timeout = 5000): Promise<HTMLElement | null> {
  const selectors = [
    ".scaffold-layout__detail",
    ".jobs-search__job-details--wrapper",
    ".jobs-home-root .job-view-layout",
    ".jobs-search-two-pane__detail-view",
    ".jobs-details",
  ];
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    for (const sel of selectors) {
      const el = document.querySelector<HTMLElement>(sel);
      // Require at least 300 chars — rules out empty/loading placeholders
      if (el && (el.innerText?.trim().length ?? 0) > 300) return el;
    }
    await new Promise<void>((r) => setTimeout(r, 250));
  }
  return null;
}

function extractWithReadability(): JobContext | null {
  try {
    const docClone = document.cloneNode(true) as Document;
    const reader = new Readability(docClone);
    const article = reader.parse();
    if (!article || article.textContent.length < 100) return null;
    const cleaned = cleanJDText(article.textContent);
    // Reject if Readability also captured feed content
    if (looksLikeFeed(cleaned)) return null;
    const { summary, qualifications, responsibilities, seniority } = parseSections(cleaned);
    return {
      fullText: cleaned,
      title: article.title || document.title,
      company: null,
      url: window.location.href,
      keywords: extractKeywords(cleaned),
      summary,
      qualifications,
      responsibilities,
      seniority,
      scrapedAt: Date.now(),
    };
  } catch {
    return null;
  }
}

async function extractOnce(platform: "linkedin"): Promise<JobContext | null> {
  // Wait for the detail panel to be rendered before attempting extraction.
  // This handles SPA navigation where the URL updates before the DOM does.
  await waitForDetailPanel();

  try {
    const jd = extractLinkedInJD();
    if (jd) {
      const cleaned = cleanJDText(jd.fullText);
      const { summary, qualifications, responsibilities, seniority } = parseSections(cleaned);
      return {
        ...jd,
        fullText: cleaned,
        keywords: extractKeywords(cleaned),
        summary,
        qualifications,
        responsibilities,
        seniority,
      };
    }
  } catch (err) {
    console.warn("[FlowCV] Platform extractor threw:", err);
  }
  // Only fall back to Readability if the LinkedIn extractor found nothing at all.
  // Skip it on LinkedIn pages where feed content would pollute the result.
  if (window.location.hostname.includes("linkedin.com")) return null;
  return extractWithReadability();
}

// ─── Listen for popup capture requests ───────────────────────────────────────

function isJobPosting(): boolean {
  const { href } = window.location;
  return href.includes("currentJobId=") || href.includes("/jobs/view/");
}

const platform = detectPlatform();

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type !== "CAPTURE_JD_REQUEST") return false;

  if (platform && !isJobPosting()) {
    sendResponse({
      success: false,
      error:
        "Open a specific LinkedIn job posting first - the URL should contain currentJobId",
    });
    return false;
  }

  if (!platform) {
    sendResponse({ success: false, error: "Not a supported page" });
    return false;
  }

  extractOnce(platform)
    .then((jd) => {
      if (!jd) {
        sendResponse({
          success: false,
          error: "No job description found on this page",
        });
        return;
      }
      return chrome.runtime
        .sendMessage({ type: "SAVE_JD", payload: jd })
        .then(() => {
          console.log(
            `[FlowCV] JD captured: "${jd.title ?? "?"}" @ ${jd.company ?? "?"} | ${jd.fullText.length} chars | ${jd.keywords.length} keywords`,
          );
          sendResponse({ success: true, title: jd.title, company: jd.company });
        });
    })
    .catch((err: unknown) => {
      sendResponse({
        success: false,
        error: err instanceof Error ? err.message : "Save failed",
      });
    });

  return true; // async sendResponse
});
