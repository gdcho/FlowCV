/**
 * JD Scraper content script - runs on LinkedIn and Indeed pages.
 *
 * No floating button. No auto-scraping. Only responds to explicit
 * CAPTURE_JD_REQUEST messages sent from the popup.
 */

import { Readability } from "@mozilla/readability";
import { extractLinkedInJD } from "./linkedin";
import { extractIndeedJD } from "./indeed";
import { extractKeywords } from "./keywords";
import { cleanJDText, parseSections } from "./utils";
import type { JobContext } from "@/types/job";

function detectPlatform(): "linkedin" | "indeed" | null {
  const { hostname } = window.location;
  if (hostname.includes("linkedin.com")) return "linkedin";
  if (hostname.includes("indeed.com")) return "indeed";
  return null;
}

function extractWithReadability(): JobContext | null {
  try {
    const docClone = document.cloneNode(true) as Document;
    const reader = new Readability(docClone);
    const article = reader.parse();
    if (!article || article.textContent.length < 100) return null;
    const cleaned = cleanJDText(article.textContent);
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

function extractOnce(platform: "linkedin" | "indeed"): JobContext | null {
  try {
    const jd =
      platform === "linkedin" ? extractLinkedInJD() : extractIndeedJD();
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
  return extractWithReadability();
}

// ─── Listen for popup capture requests ───────────────────────────────────────

function isJobPosting(): boolean {
  const { href } = window.location;
  if (href.includes("linkedin.com"))
    return href.includes("currentJobId=") || href.includes("/jobs/view/");
  if (href.includes("indeed.com"))
    return href.includes("viewjob") || href.includes("jk=");
  return false;
}

const platform = detectPlatform();

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type !== "CAPTURE_JD_REQUEST") return false;

  if (platform && !isJobPosting()) {
    sendResponse({
      success: false,
      error:
        "Open a specific job posting first - the URL should contain currentJobId (LinkedIn) or jk= (Indeed)",
    });
    return false;
  }

  const jd = platform ? extractOnce(platform) : null;

  if (!jd) {
    sendResponse({
      success: false,
      error: "No job description found on this page",
    });
    return false;
  }

  chrome.runtime
    .sendMessage({ type: "SAVE_JD", payload: jd })
    .then(() => {
      console.log(
        `[FlowCV] JD captured: "${jd.title ?? "?"}" @ ${jd.company ?? "?"} | ${jd.fullText.length} chars | ${jd.keywords.length} keywords`,
      );
      sendResponse({ success: true, title: jd.title, company: jd.company });
    })
    .catch((err: unknown) => {
      sendResponse({
        success: false,
        error: err instanceof Error ? err.message : "Save failed",
      });
    });

  return true; // async sendResponse
});
