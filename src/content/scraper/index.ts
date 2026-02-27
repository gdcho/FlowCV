/**
 * JD Scraper content script — runs on LinkedIn and Indeed pages.
 *
 * No floating button. No auto-scraping. Only responds to explicit
 * CAPTURE_JD_REQUEST messages sent from the popup.
 */

import { Readability } from "@mozilla/readability";
import { extractLinkedInJD } from "./linkedin";
import { extractIndeedJD } from "./indeed";
import { extractKeywords } from "./keywords";
import type { JobContext } from "@/types/job";

function detectPlatform(): "linkedin" | "indeed" | null {
  const { hostname } = window.location;
  if (hostname.includes("linkedin.com")) return "linkedin";
  if (hostname.includes("indeed.com")) return "indeed";
  return null;
}

/**
 * Strip UI artifacts from raw innerText.
 * LinkedIn / Indeed inject button labels, applicant counts, social metadata
 * and other noise into the DOM alongside the actual job description.
 */
function cleanJDText(raw: string): string {
  return (
    raw
      // "Show more" / "See more" / "Show less" button text
      .replace(/^\s*(show more|see more|show less|read more|expand)\s*$/gim, "")
      // Applicant / click counts
      .replace(
        /^\s*\d[\d,]*\s+(applicants?|people clicked apply|people applied|views?).*$/gim,
        "",
      )
      // "Over 200 applicants" variants
      .replace(/^\s*over\s+\d[\d,]*\s+applicants?\s*$/gim, "")
      // Standalone action-word lines (LinkedIn buttons that bleed into innerText)
      .replace(
        /^\s*(save|easy apply|apply now?|apply|report this job|report|share|follow|connect|message|send inmail)\s*$/gim,
        "",
      )
      // "Posted X days/weeks/months ago"
      .replace(/^\s*posted\s+\d+\s+\w+\s+ago\s*$/gim, "")
      // LinkedIn badges
      .replace(
        /^\s*(promoted|actively recruiting|actively hiring|be an early applicant|actively reviewed)\s*$/gim,
        "",
      )
      // "X of Y skills match" / "Add skills" lines
      .replace(/^\s*\d+\s+of\s+\d+\s+skills?\s+match.*$/gim, "")
      .replace(/^\s*add\s+(a\s+)?skills?\s*$/gim, "")
      // Normalize fancy bullet characters to a plain dash
      .replace(/^[•·◦▪▸►●○‣⁃]\s*/gm, "- ")
      // Collapse 3+ consecutive blank lines to 2
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

const SUMMARY_RE =
  /^(about (the |this )?(role|job|position|opportunity|company|us)|role (overview|summary)|overview|position (summary|overview)|job (summary|overview)|the role|what (is|this) (the )?role|who we are|our (mission|vision|team))/i;
const QUAL_RE =
  /^(requirements?|qualifications?|what (you('ll)?|we'?re? looking for|you bring|you have|you need)|must.?have|required|minimum qualifications?|basic qualifications?|about you|who you are|you are|you will have|you should have|preferred|nice.to.have|bonus)/i;
const RESP_RE =
  /^(responsibilities|what you'?ll do|key responsibilities|your role|what you'?ll be doing|the work|day.to.day|what we('re| are) looking|your impact|you will|you'?ll|in this role)/i;

const SENIORITY_RE =
  /\b(intern|junior|associate|mid.?level|senior|staff|principal|lead|director|manager|head of|vp|vice president|distinguished|fellow)\b/i;

function extractBullets(lines: string[]): string[] {
  return lines
    .filter((l) => /^(-|\d+\.|•)/.test(l.trim()) || l.trim().length > 15)
    .map((l) =>
      l
        .replace(/^[-•]\s*/, "")
        .replace(/^\d+\.\s*/, "")
        .trim(),
    )
    .filter((l) => l.length > 10 && l.length < 200)
}

/**
 * Parse summary, qualifications, responsibilities, and seniority from cleaned JD text.
 */
function parseSections(text: string): {
  summary: string | null;
  qualifications: string[];
  responsibilities: string[];
  seniority: string | null;
} {
  const lines = text.split("\n");
  let currentSection: "summary" | "qualifications" | "responsibilities" | "other" = "other";
  const summaryLines: string[] = [];
  const qualLines: string[] = [];
  const respLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Detect heading (short line matching a known pattern)
    if (trimmed.length < 90) {
      if (SUMMARY_RE.test(trimmed)) {
        currentSection = "summary";
        continue;
      }
      if (QUAL_RE.test(trimmed)) {
        currentSection = "qualifications";
        continue;
      }
      if (RESP_RE.test(trimmed)) {
        currentSection = "responsibilities";
        continue;
      }
    }

    if (currentSection === "summary" && summaryLines.length < 8)
      summaryLines.push(trimmed);
    else if (currentSection === "qualifications") qualLines.push(trimmed);
    else if (currentSection === "responsibilities") respLines.push(trimmed);
  }

  // Summary: join collected lines into one paragraph, cap at 280 chars
  let summary: string | null = null;
  if (summaryLines.length > 0) {
    summary = summaryLines
      .join(" ")
      .replace(/\s+/g, " ")
      .slice(0, 280)
      .trimEnd();
    if (summary.length === 280) summary += "…";
  } else {
    // Fallback: first paragraph with 80+ chars
    const first = lines.find((l) => l.trim().length >= 80);
    if (first) {
      summary = first.trim().slice(0, 280);
      if (first.trim().length > 280) summary += "…";
    }
  }

  // Seniority: scan the first 600 chars for a level signal
  const seniorityMatch = text.slice(0, 600).match(SENIORITY_RE);
  const seniority = seniorityMatch
    ? seniorityMatch[0].replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    : null;

  return {
    summary,
    qualifications: extractBullets(qualLines).slice(0, 8),
    responsibilities: extractBullets(respLines).slice(0, 6),
    seniority,
  };
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

const platform = detectPlatform();

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type !== "CAPTURE_JD_REQUEST") return false;

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
